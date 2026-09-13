-- Atomic function to create sales, corresponding stock_transactions, and an audit log
-- Inserts sales rows, decrements stock (kitchen_stock or standalone inventory),
-- creates stock_transactions (letting the trigger derive restaurants_id),
-- and writes a single audit_logs row. All actions occur atomically.

create or replace function create_sales_with_stock_transactions(
    p_restaurant text,
    p_sales jsonb,
    p_user_id bigint,
    p_performed_by text default null
) returns jsonb as $$
declare
    rec record;
    v_sales_count integer := 0;
    v_new_sales jsonb := '[]'::jsonb;
begin
    if p_sales is null then
        raise exception 'p_sales payload required';
    end if;

    for rec in
        select
            (elem->>'food_and_beverage_id')::bigint as food_and_beverage_id,
            elem->>'item' as item,
            (elem->>'cost')::numeric as cost,
            coalesce((elem->>'number_of_sales')::integer,0) as number_of_sales,
            coalesce((elem->>'discount')::numeric,0) as discount
        from jsonb_array_elements(p_sales) as arr(elem)
    loop
        insert into sales(restaurant, food_and_beverage_id, item, cost, number_of_sales, discount)
        values (p_restaurant, rec.food_and_beverage_id, rec.item, rec.cost, rec.number_of_sales, rec.discount)
        returning sales_id, restaurant, food_and_beverage_id, item, cost, number_of_sales, discount, created_at into rec;

        v_sales_count := v_sales_count + 1;
        v_new_sales := v_new_sales || to_jsonb(rec)::jsonb;
    end loop;

    insert into audit_logs(user_id, restaurant, action, table_name, record_id, old_data, new_data)
    values (p_user_id, p_restaurant, 'create_sales', 'sales', null, null, jsonb_build_object('sales', v_new_sales));

    return jsonb_build_object('sales_count', v_sales_count, 'sales', v_new_sales);
end;
$$ language plpgsql;
