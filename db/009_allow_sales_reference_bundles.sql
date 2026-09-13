-- Allow sales.food_and_beverage_id to reference either food_and_beverage_inventory or food_packages
begin;

-- 1) Drop the strict FK to food_and_beverage_inventory
alter table public.sales
  drop constraint if exists sales_food_and_beverage_fkey;

-- 2) Prevent id collisions by moving food_packages id range up
alter table food_packages alter column food_package_id restart with 1000000;

-- 3) Trigger function to resolve restaurant from either table and reject unknown ids
create or replace function set_sales_restaurant()
returns trigger
language plpgsql
as $$
declare
  v_restaurant text;
begin
  select restaurant into v_restaurant
  from food_and_beverage_inventory
  where food_and_beverage_id = new.food_and_beverage_id
  limit 1;

  if v_restaurant is null then
    select restaurant into v_restaurant
    from food_packages
    where food_package_id = new.food_and_beverage_id
    limit 1;
  end if;

  if v_restaurant is null then
    raise exception 'No matching food_and_beverage_inventory or food_packages row for id = %', new.food_and_beverage_id;
  end if;

  new.restaurant := v_restaurant;
  return new;
end;
$$;

-- Attach before-insert and before-update trigger to ensure restaurant is set and id is valid
drop trigger if exists trg_set_sales_restaurant on sales;
create trigger trg_set_sales_restaurant
before insert or update on sales
for each row execute function set_sales_restaurant();

-- 4) Prevent actual deletion of food items/packages referenced by sales
create or replace function prevent_delete_if_referenced_by_sales_item()
returns trigger
language plpgsql
as $$
begin
  if exists (select 1 from sales where food_and_beverage_id = old.food_and_beverage_id) then
    raise exception 'Cannot delete: referenced by existing sales records';
  end if;
  return old;
end;
$$;

create or replace function prevent_delete_if_referenced_by_sales_package()
returns trigger
language plpgsql
as $$
begin
  if exists (select 1 from sales where food_and_beverage_id = old.food_package_id) then
    raise exception 'Cannot delete: referenced by existing sales records';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_prevent_delete_food_item on food_and_beverage_inventory;
create trigger trg_prevent_delete_food_item
before delete on food_and_beverage_inventory
for each row execute function prevent_delete_if_referenced_by_sales_item();

drop trigger if exists trg_prevent_delete_food_package on food_packages;
create trigger trg_prevent_delete_food_package
before delete on food_packages
for each row execute function prevent_delete_if_referenced_by_sales_package();

commit;
