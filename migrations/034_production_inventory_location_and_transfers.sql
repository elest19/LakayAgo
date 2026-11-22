begin;

alter table public.production_inventory
  rename column restaurant to location;

alter table public.production_inventory
  drop constraint if exists production_inventory_restaurant_check;

alter table public.production_inventory
  add constraint production_inventory_location_check
  check (location in ('Warehouse', 'Lakay Ago', 'Aroo', 'Pasalubong Center', 'Food Cart'));

alter table public.production_inventory
  rename constraint production_inventory_name_restaurant_unique
  to production_inventory_name_location_unique;

do $$
begin
  if to_regclass('public.production_inventory_name_restaurant_unique') is not null then
    alter index public.production_inventory_name_restaurant_unique
      rename to production_inventory_name_location_unique;
  end if;
end;
$$;

-- Keep the existing trigger's stock-moving behavior; it works for any source/destination rows.
create or replace function public.apply_production_inventory_transfer()
returns trigger
language plpgsql
as $$
begin
  update public.production_inventory
    set stock = stock - NEW.quantity
    where production_inventory_id = NEW.from_production_inventory_id;

  update public.production_inventory
    set stock = stock + NEW.quantity
    where production_inventory_id = NEW.to_production_inventory_id;

  return NEW;
end;
$$;

create or replace function public.validate_recipe_restaurant_match()
returns trigger
language plpgsql
as $$
declare
  dish_restaurant text;
  ingredient_location text;
begin
  select restaurant into dish_restaurant
  from public.food_and_beverage_inventory
  where food_and_beverage_id = NEW.food_and_beverage_id;

  select location into ingredient_location
  from public.production_inventory
  where production_inventory_id = NEW.production_inventory_id;

  if dish_restaurant not in ('Lakay Ago', 'Aroo') then
    raise exception 'Recipe dish restaurant (%) must be Lakay Ago or Aroo', dish_restaurant;
  end if;

  if ingredient_location not in ('Lakay Ago', 'Aroo') then
    raise exception 'Recipe ingredient location (%) must be Lakay Ago or Aroo', ingredient_location;
  end if;

  if dish_restaurant <> ingredient_location then
    raise exception 'Recipe ingredient location (%) does not match dish restaurant (%)', ingredient_location, dish_restaurant;
  end if;

  return NEW;
end;
$$;

commit;
