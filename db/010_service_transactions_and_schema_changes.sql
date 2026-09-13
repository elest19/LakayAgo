-- Migration: split services transactions from catalog, add service_transactions and assets, archive flags, penalties
begin;

-- 1a) services: drop expenses, add is_archived & is_special, remove deductions trigger
alter table public.services
  drop column if exists expenses,
  add column if not exists is_archived boolean not null default false,
  add column if not exists is_special boolean not null default false;

drop trigger if exists trg_after_services_deductions on public.services;

-- 1b) food_packages: add is_special
alter table public.food_packages
  add column if not exists is_special boolean not null default false;

-- 1c) assets_inventory: add is_archived & penalty_amount
alter table public.assets_inventory
  add column if not exists is_archived boolean not null default false,
  add column if not exists penalty_amount numeric(12,2) not null default 0;

alter table public.assets_inventory
  add constraint if not exists assets_inventory_penalty_amount_check check (penalty_amount >= 0);

-- 1d) Create service_transactions table
create table if not exists public.service_transactions (
  service_transaction_id bigint generated always as identity not null,
  service_id bigint not null,
  restaurant text not null,
  service_date date not null,
  price numeric(12,2) not null,
  downpayment numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  expenses numeric(12,2) not null default 0,
  status text not null,
  created_at timestamptz not null default now(),
  constraint service_transactions_pkey primary key (service_transaction_id),
  constraint service_transactions_service_id_fkey foreign key (service_id)
    references public.services (service_id) on delete restrict,
  constraint service_transactions_price_check check (price >= 0),
  constraint service_transactions_downpayment_check check (downpayment >= 0),
  constraint service_transactions_discount_check check (discount >= 0),
  constraint service_transactions_expenses_check check (expenses >= 0),
  constraint service_transactions_restaurant_check check (restaurant = any (array['Lakay Ago'::text, 'Aroo'::text, 'Both'::text])),
  constraint service_transactions_status_check check (status = any (array['Under Reservation'::text, 'Partial Payment'::text, 'Finalized'::text, 'Fully Paid'::text]))
);

-- 1e) service_transaction_assets table
create table if not exists public.service_transaction_assets (
  service_transaction_asset_id bigint generated always as identity not null,
  service_transaction_id bigint not null,
  asset_id bigint not null,
  quantity_returned integer not null default 0,
  constraint service_transaction_assets_pkey primary key (service_transaction_asset_id),
  constraint service_transaction_assets_transaction_fkey foreign key (service_transaction_id)
    references public.service_transactions (service_transaction_id) on delete cascade,
  constraint service_transaction_assets_asset_fkey foreign key (asset_id)
    references public.assets_inventory (asset_id) on delete restrict,
  constraint service_transaction_assets_quantity_check check (quantity_returned >= 0)
);

-- 1d continued: triggers for restaurant auto-copy and status auto-set
create or replace function public.set_service_transaction_restaurant()
returns trigger as $$
begin
  select restaurant into new.restaurant
  from public.services
  where service_id = new.service_id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_service_transaction_restaurant on public.service_transactions;
create trigger trg_set_service_transaction_restaurant
before insert or update on public.service_transactions
for each row execute function public.set_service_transaction_restaurant();

create or replace function public.set_service_transaction_status()
returns trigger as $$
begin
  if new.status is null or new.status in ('Under Reservation', 'Partial Payment') then
    if new.downpayment = 0 then
      new.status := 'Under Reservation';
    else
      new.status := 'Partial Payment';
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_service_transaction_status on public.service_transactions;
create trigger trg_set_service_transaction_status
before insert or update on public.service_transactions
for each row execute function public.set_service_transaction_status();

-- 1f) Move apply_service_deductions trigger to service_transactions if function exists
-- We attach the existing deduction function to run after insert or update on service_transactions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'apply_service_deductions') THEN
    execute 'drop trigger if exists trg_after_service_transactions_deductions on public.service_transactions';
    execute 'create trigger trg_after_service_transactions_deductions after insert or update on public.service_transactions for each row execute function public.apply_service_deductions()';
  END IF;
END;
$$;

commit;
