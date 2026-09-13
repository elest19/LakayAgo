-- Add is_archived to food_and_beverage_recipe if missing
alter table food_and_beverage_recipe
  add column if not exists is_archived boolean not null default false;
