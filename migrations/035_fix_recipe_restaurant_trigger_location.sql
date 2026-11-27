begin;

-- The production_inventory column was renamed from restaurant to location.
-- Recreate the recipe validator so inserts/updates use the current column.
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

-- If this trigger is missing, create it; if it points to the function, it is now fixed above.
drop trigger if exists validate_recipe_restaurant_match on public.food_and_beverage_recipe;
create trigger validate_recipe_restaurant_match
before insert or update on public.food_and_beverage_recipe
for each row execute function public.validate_recipe_restaurant_match();

commit;
