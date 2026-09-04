-- Atomic function to create sales, corresponding stock_transactions, and an audit log
-- Inserts sales rows, decrements stock (kitchen_stock or standalone inventory),
-- creates stock_transactions (letting the trigger derive restaurants_id),
-- and writes a single audit_logs row. All actions occur atomically.

create or replace function create_sales_with_stock_transactions(
    p_restaurant_id bigint,
    p_sales jsonb,
    p_user_id bigint,
    p_performed_by text default null
) returns jsonb as $$
declare
    rec record;
    v_sales_count integer := 0;
    v_tx_count integer := 0;
    v_new_sales jsonb := '[]'::jsonb;
    v_new_txs jsonb := '[]'::jsonb;

    -- temp mappings
    type inv_agg_t is record (inventory_id bigint, kitchen_id bigint, total_qty numeric, name text);
    inv_agg inv_agg_t;
    inv_cursor refcursor;
    v_inventory_id bigint;
    v_kitchen_id bigint;
    v_total_qty numeric;
    v_name text;
    v_tx_id bigint;
begin
    if p_sales is null then
        raise exception 'p_sales payload required';
    end if;

    -- 1) Build a temporary set of sales and aggregate quantities per inventory_id
    -- We'll use a CTE to extract the input rows and then aggregate by inventory_id.

    -- Validate inventory ownership and prepare aggregated locks.
    for inv_agg in
        select
            ns.inventory_id,
            i.kitchen_id,
            sum(ns.number_of_sales)::numeric as total_qty,
            coalesce(ks.product, i.name) as name,
            i.restaurants_id as inventory_owner
        from (
            select
                (elem->>'inventory_id')::bigint            as inventory_id,
                coalesce((elem->>'number_of_sales')::integer, 0) as number_of_sales,
                elem->>'item'                               as item,
                (elem->>'cost')::numeric                    as cost,
                elem->>'category'                           as category,
                coalesce((elem->>'discount')::numeric, 0)   as discount
            from jsonb_array_elements(p_sales) as arr(elem)
        ) ns
        left join inventory i on i.inventory_id = ns.inventory_id
        left join kitchen_stock ks on ks.kitchen_id = i.kitchen_id
        where ns.inventory_id is not null
        group by ns.inventory_id, i.kitchen_id, ks.product, i.name, i.restaurants_id
    loop
        -- If inventory exists, ensure it belongs to the restaurant creating the sale
        if inv_agg.inventory_owner is not null and inv_agg.inventory_owner <> p_restaurant_id then
            raise exception 'Inventory % does not belong to restaurant %', inv_agg.inventory_id, p_restaurant_id;
        end if;
    end loop;

    -- 2) Lock affected kitchen_stock and inventory rows in a deterministic order to avoid deadlocks.
    -- Lock kitchen_stock rows for inventories that have kitchen_id not null.
    for rec in
        select distinct i.kitchen_id
        from (
            select (elem->>'inventory_id')::bigint as inventory_id from jsonb_array_elements(p_sales) as arr(elem)
        ) s
        join inventory i on i.inventory_id = s.inventory_id
        where i.kitchen_id is not null
        order by i.kitchen_id
    loop
        perform 1 from kitchen_stock where kitchen_id = rec.kitchen_id for update;
    end loop;

    -- Lock standalone inventory rows (those with no kitchen_id) ordered by inventory_id
    for rec in
        select distinct s.inventory_id
        from (
            select (elem->>'inventory_id')::bigint as inventory_id from jsonb_array_elements(p_sales) as arr(elem)
        ) s
        join inventory i on i.inventory_id = s.inventory_id
        where i.kitchen_id is null
        order by s.inventory_id
    loop
        perform 1 from inventory where inventory_id = rec.inventory_id for update;
    end loop;

    -- 3) Re-run aggregation and validate stock sufficiency, then decrement stock.
    for inv_agg in
        select
            ns.inventory_id,
            i.kitchen_id,
            sum(ns.number_of_sales)::numeric as total_qty,
            coalesce(ks.product, i.name) as name
        from (
            select
                (elem->>'inventory_id')::bigint            as inventory_id,
                coalesce((elem->>'number_of_sales')::integer, 0) as number_of_sales
            from jsonb_array_elements(p_sales) as arr(elem)
        ) ns
        left join inventory i on i.inventory_id = ns.inventory_id
        left join kitchen_stock ks on ks.kitchen_id = i.kitchen_id
        where ns.inventory_id is not null
        group by ns.inventory_id, i.kitchen_id, ks.product, i.name
    loop
        if inv_agg.kitchen_id is not null then
            -- check kitchen_stock stock
            select stock into v_total_qty from kitchen_stock where kitchen_id = inv_agg.kitchen_id;
            if v_total_qty is null then
                raise exception 'Kitchen stock not found for kitchen_id=%', inv_agg.kitchen_id;
            end if;
            if v_total_qty < inv_agg.total_qty then
                raise exception 'Insufficient kitchen stock for kitchen_id=% (have %, need %)', inv_agg.kitchen_id, v_total_qty, inv_agg.total_qty;
            end if;
            -- decrement aggregated amount
            update kitchen_stock set stock = stock - inv_agg.total_qty where kitchen_id = inv_agg.kitchen_id;
        else
            -- standalone inventory
            select stock into v_total_qty from inventory where inventory_id = inv_agg.inventory_id;
            if v_total_qty is null then
                raise exception 'Inventory row not found for inventory_id=%', inv_agg.inventory_id;
            end if;
            if v_total_qty < inv_agg.total_qty then
                raise exception 'Insufficient inventory stock for inventory_id=% (have %, need %)', inv_agg.inventory_id, v_total_qty, inv_agg.total_qty;
            end if;
            update inventory set stock = stock - inv_agg.total_qty where inventory_id = inv_agg.inventory_id;
        end if;
    end loop;

    -- 4) Insert sales rows and return inserted rows to create stock_transactions per row.
    for rec in
        with new_sales as (
            select
                (elem->>'inventory_id')::bigint            as inventory_id,
                elem->>'item'                               as item,
                (elem->>'cost')::numeric                    as cost,
                (elem->>'number_of_sales')::integer        as number_of_sales,
                elem->>'category'                           as category,
                coalesce((elem->>'discount')::numeric, 0)   as discount
            from jsonb_array_elements(p_sales) as arr(elem)
        )
        insert into sales(restaurants_id, inventory_id, item, cost, number_of_sales, category, discount)
        select p_restaurant_id, inventory_id, item, cost, number_of_sales, category, discount
        from new_sales
        returning sales_id, restaurants_id, inventory_id, item, cost, number_of_sales, category, discount, created_at
    loop
        v_sales_count := v_sales_count + 1;
        v_new_sales := v_new_sales || to_jsonb(rec)::jsonb;

        if rec.inventory_id is not null then
            -- determine name and kitchen_id for this inventory
            select i.kitchen_id, coalesce(ks.product, i.name) into v_kitchen_id, v_name
            from inventory i
            left join kitchen_stock ks on ks.kitchen_id = i.kitchen_id
            where i.inventory_id = rec.inventory_id;

            -- Only create a stock_transaction when the inventory is linked to a kitchen_stock.
            -- The schema requires `SALE` transactions to have a non-null kitchen_id.
            if v_kitchen_id is not null then
                insert into stock_transactions(kitchen_id, production_id, inventory_id, name, transaction_type, quantity, from_location, to_location, performed_by)
                values (v_kitchen_id, null, rec.inventory_id, v_name, 'SALE', rec.number_of_sales, 'kitchen', 'menu', p_performed_by)
                returning stock_transaction_id into v_tx_id;

                v_tx_count := v_tx_count + 1;
                v_new_txs := v_new_txs || jsonb_build_object('stock_transaction_id', v_tx_id, 'inventory_id', rec.inventory_id, 'quantity', rec.number_of_sales);
            end if;
        end if;
    end loop;

    -- 5) Insert audit log
    insert into audit_logs(user_id, restaurant_id, action, table_name, record_id, old_data, new_data)
    values (
        p_user_id,
        p_restaurant_id,
        'create_sales_with_stock_transactions',
        'sales',
        null,
        null,
        jsonb_build_object('sales', v_new_sales, 'stock_transactions', v_new_txs)
    );

    return jsonb_build_object('sales_count', v_sales_count, 'stock_transactions_count', v_tx_count, 'sales', v_new_sales, 'stock_transactions', v_new_txs);
end;
$$ language plpgsql;
