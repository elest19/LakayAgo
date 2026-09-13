-- Add recipe_unit, conversion_factor, ingredient_category to production_inventory
alter table production_inventory
  add column if not exists recipe_unit text;

alter table production_inventory
  add column if not exists conversion_factor numeric(12,6);

alter table production_inventory
  add column if not exists ingredient_category text check (ingredient_category in ('weight','volume','quantity'));

-- NOTE: Do NOT set defaults for existing rows. Leave new columns NULL so the
-- UI can surface items that need review and manual backfill.
