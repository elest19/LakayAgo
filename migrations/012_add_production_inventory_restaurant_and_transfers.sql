-- Add restaurant column, uniqueness constraint, and transfers table

alter table production_inventory
  add column if not exists restaurant text check (restaurant in ('Aroo', 'Lakay Ago'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'production_inventory_name_restaurant_unique'
  ) THEN
    ALTER TABLE production_inventory
      ADD CONSTRAINT production_inventory_name_restaurant_unique UNIQUE (name, restaurant);
  END IF;
END
$$;

-- Assign existing rows to Lakay Ago by default
update production_inventory set restaurant = 'Lakay Ago' where restaurant is null;

alter table production_inventory
  alter column restaurant set not null;

-- Create transfers table
create table if not exists production_inventory_transfers (
  transfer_id bigint generated always as identity primary key,
  from_production_inventory_id bigint not null references production_inventory (production_inventory_id) on delete restrict,
  to_production_inventory_id bigint not null references production_inventory (production_inventory_id) on delete restrict,
  quantity numeric(14,4) not null check (quantity > 0),
  transferred_by bigint references users (user_id),
  created_at timestamptz not null default now(),
  constraint production_inventory_transfers_different_rows check (from_production_inventory_id <> to_production_inventory_id)
);

-- Trigger function to apply transfer quantities
create or replace function apply_production_inventory_transfer()
returns trigger as $$
begin
  update production_inventory
    set stock = stock - NEW.quantity
    where production_inventory_id = NEW.from_production_inventory_id;

  update production_inventory
    set stock = stock + NEW.quantity
    where production_inventory_id = NEW.to_production_inventory_id;

  return NEW;
end;
$$ language plpgsql;

create trigger trg_apply_production_inventory_transfer
  after insert on production_inventory_transfers
  for each row execute function apply_production_inventory_transfer();

-- Note: consider adding checks to prevent negative stock on from row if desired.
