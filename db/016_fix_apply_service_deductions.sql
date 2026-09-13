-- Fix apply_service_deductions function to work against the modern sub-service model
-- and prevent repeated stock deductions once the booking is finalized.

begin;

alter table public.service_transactions
  add column if not exists deductions_applied boolean not null default false;

drop trigger if exists trg_after_service_transactions_deductions on public.service_transactions;
drop function if exists public.apply_service_deductions();

drop function if exists public.convert_recipe_quantity_to_stock_unit(numeric, text, text, text, numeric);

create or replace function public.convert_recipe_quantity_to_stock_unit(
    p_quantity numeric,
    p_ingredient_category text,
    p_recipe_unit text,
    p_stock_unit text,
    p_conversion_factor numeric
)
returns numeric
language plpgsql
as $$
declare
    v_quantity numeric := p_quantity;
    v_recipe_unit text := lower(trim(coalesce(p_recipe_unit, '')));
    v_stock_unit text := lower(trim(coalesce(p_stock_unit, '')));
    v_base_weight numeric;
    v_recipe_factor numeric;
    v_stock_factor numeric;
    v_recipe_is_spoon boolean;
    v_stock_is_spoon boolean;
begin
    if p_ingredient_category = 'quantity' then
        return v_quantity;
    end if;

    if p_ingredient_category = 'volume' then
        if v_recipe_unit = 'teaspoon (tsp)' or v_recipe_unit = 'tsp' then
            v_recipe_factor := 1.0/3.0;
        elsif v_recipe_unit = 'tablespoon (tbsp)' or v_recipe_unit = 'tbsp' then
            v_recipe_factor := 1.0;
        elsif v_recipe_unit = 'cup' or v_recipe_unit = 'cup (cup)' then
            v_recipe_factor := 16.0;
        elsif v_recipe_unit = 'fluid ounce (fl_oz)' or v_recipe_unit = 'fl_oz' then
            v_recipe_factor := 2.0;
        elsif v_recipe_unit = 'milliliter (ml)' or v_recipe_unit = 'ml' then
            v_recipe_factor := 1.0 / 14.7868;
        elsif v_recipe_unit = 'liter (l)' or v_recipe_unit = 'l' then
            v_recipe_factor := 67.628;
        else
            raise exception 'Unsupported volume recipe unit: %', p_recipe_unit;
        end if;

        if v_stock_unit = 'teaspoon (tsp)' or v_stock_unit = 'tsp' then
            v_stock_factor := 1.0/3.0;
        elsif v_stock_unit = 'tablespoon (tbsp)' or v_stock_unit = 'tbsp' then
            v_stock_factor := 1.0;
        elsif v_stock_unit = 'cup' or v_stock_unit = 'cup (cup)' then
            v_stock_factor := 16.0;
        elsif v_stock_unit = 'fluid ounce (fl_oz)' or v_stock_unit = 'fl_oz' then
            v_stock_factor := 2.0;
        elsif v_stock_unit = 'milliliter (ml)' or v_stock_unit = 'ml' then
            v_stock_factor := 1.0 / 14.7868;
        elsif v_stock_unit = 'liter (l)' or v_stock_unit = 'l' then
            v_stock_factor := 67.628;
        else
            raise exception 'Unsupported stock unit: %', p_stock_unit;
        end if;

        return (v_quantity * v_recipe_factor) / v_stock_factor;
    end if;

    if p_ingredient_category = 'weight' then
        v_recipe_is_spoon := v_recipe_unit in ('tablespoon (tbsp)', 'tbsp', 'teaspoon (tsp)', 'tsp', 'cup', 'cup (cup)');
        v_stock_is_spoon := v_stock_unit in ('tablespoon (tbsp)', 'tbsp', 'teaspoon (tsp)', 'tsp', 'cup', 'cup (cup)');

        if not v_recipe_is_spoon and not v_stock_is_spoon then
            if v_recipe_unit = 'gram (g)' or v_recipe_unit = 'g' then
                v_recipe_factor := 1.0;
            elsif v_recipe_unit = 'kilogram (kg)' or v_recipe_unit = 'kg' then
                v_recipe_factor := 1000.0;
            elsif v_recipe_unit = 'ounce (oz)' or v_recipe_unit = 'oz' then
                v_recipe_factor := 28.3495;
            elsif v_recipe_unit = 'pound (lb)' or v_recipe_unit = 'lb' then
                v_recipe_factor := 453.592;
            else
                raise exception 'Unsupported weight recipe unit: %', p_recipe_unit;
            end if;

            if v_stock_unit = 'gram (g)' or v_stock_unit = 'g' then
                v_stock_factor := 1.0;
            elsif v_stock_unit = 'kilogram (kg)' or v_stock_unit = 'kg' then
                v_stock_factor := 1000.0;
            elsif v_stock_unit = 'ounce (oz)' or v_stock_unit = 'oz' then
                v_stock_factor := 28.3495;
            elsif v_stock_unit = 'pound (lb)' or v_stock_unit = 'lb' then
                v_stock_factor := 453.592;
            else
                raise exception 'Unsupported stock unit: %', p_stock_unit;
            end if;

            return (v_quantity * v_recipe_factor) / v_stock_factor;
        end if;

        if p_conversion_factor is null then
            raise exception 'Missing conversion_factor for ingredient using spoon units';
        end if;

        v_base_weight := case
            when v_recipe_is_spoon then v_quantity * p_conversion_factor
            else v_quantity
        end;

        if v_stock_is_spoon then
            return v_base_weight / p_conversion_factor;
        end if;

        if v_stock_unit = 'gram (g)' or v_stock_unit = 'g' then
            return v_base_weight / 1.0;
        elsif v_stock_unit = 'kilogram (kg)' or v_stock_unit = 'kg' then
            return v_base_weight / 1000.0;
        elsif v_stock_unit = 'ounce (oz)' or v_stock_unit = 'oz' then
            return v_base_weight / 28.3495;
        elsif v_stock_unit = 'pound (lb)' or v_stock_unit = 'lb' then
            return v_base_weight / 453.592;
        else
            raise exception 'Unsupported weight stock unit: %', p_stock_unit;
        end if;
    end if;

    raise exception 'Unsupported ingredient category: %', p_ingredient_category;
end;
$$;

create or replace function public.apply_service_deductions()
returns trigger
language plpgsql
as $function$
declare
    pkg_item record;
    rec record;
    sub_service record;
    v_needed numeric;
    v_stock numeric;
    v_food_package_id bigint;
begin
    if (
        new.deductions_applied = false
        and new.status = 'Finalized'
        and (tg_op = 'INSERT' or old.status is distinct from 'Finalized')
    ) then
        for sub_service in
            select ss.food_package_id
            from public.service_sub_services sss
            join public.sub_services ss on ss.sub_service_id = sss.sub_service_id
            where sss.service_id = new.service_id
              and ss.is_archived = false
              and ss.food_package_id is not null
        loop
            v_food_package_id := sub_service.food_package_id;

            for pkg_item in
                select fpi.food_and_beverage_id, fpi.quantity
                from public.food_package_items fpi
                where fpi.food_package_id = v_food_package_id
            loop
                for rec in
                    select far.production_inventory_id,
                           far.quantity_required * pkg_item.quantity as quantity_required,
                           p.unit as stock_unit,
                           p.recipe_unit,
                           p.conversion_factor,
                           p.ingredient_category
                    from public.food_and_beverage_recipe far
                    join public.production_inventory p on p.production_inventory_id = far.production_inventory_id
                    where far.food_and_beverage_id = pkg_item.food_and_beverage_id
                loop
                    v_needed := public.convert_recipe_quantity_to_stock_unit(
                        rec.quantity_required,
                        rec.ingredient_category,
                        rec.recipe_unit,
                        rec.stock_unit,
                        rec.conversion_factor
                    );

                    select stock
                    into v_stock
                    from public.production_inventory
                    where production_inventory_id = rec.production_inventory_id
                    for update;

                    if v_stock is null then
                        raise exception 'Production inventory % not found', rec.production_inventory_id;
                    end if;

                    if v_stock < v_needed then
                        raise exception 'Insufficient production inventory % (have %, need %)', rec.production_inventory_id, v_stock, v_needed;
                    end if;

                    update public.production_inventory
                    set stock = stock - v_needed
                    where production_inventory_id = rec.production_inventory_id;

                    insert into public.audit_logs(user_id, action, table_name, record_id, old_data, new_data, description)
                    values (
                        null,
                        'food_package_deduction',
                        'production_inventory',
                        cast(rec.production_inventory_id as text),
                        to_jsonb(json_build_object('stock', v_stock)),
                        to_jsonb(json_build_object('stock', v_stock - v_needed)),
                        concat('Service ', new.service_id)
                    );
                end loop;
            end loop;
        end loop;

        update public.service_transactions
        set deductions_applied = true
        where service_transaction_id = new.service_transaction_id;
    end if;

    return new;
end;
$function$;

create trigger trg_after_service_transactions_deductions
after insert or update on public.service_transactions
for each row execute function public.apply_service_deductions();

commit;