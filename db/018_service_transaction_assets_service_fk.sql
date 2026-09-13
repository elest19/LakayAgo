begin;

-- service_assets needs a uniqueness guarantee to be a valid composite FK target
alter table public.service_assets
  drop constraint if exists service_assets_service_asset_unique;

alter table public.service_assets
  add constraint service_assets_service_asset_unique unique (service_id, asset_id);

-- add the denormalized service_id column to service_transaction_assets
alter table public.service_transaction_assets
  add column if not exists service_id bigint;

-- backfill existing rows from their parent transaction before making the column required
update public.service_transaction_assets sta
set service_id = st.service_id
from public.service_transactions st
where st.service_transaction_id = sta.service_transaction_id
  and sta.service_id is null;

-- enforce not null after backfill
alter table public.service_transaction_assets
  alter column service_id set not null;

-- add composite foreign key to guarantee the returned asset is actually assigned to this service
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'service_transaction_assets_service_assets_fkey'
  ) THEN
    alter table public.service_transaction_assets
      add constraint service_transaction_assets_service_assets_fkey
      foreign key (service_id, asset_id)
      references public.service_assets (service_id, asset_id)
      on delete restrict;
  END IF;
END $$;

create or replace function public.set_service_transaction_asset_service_id()
returns trigger
language plpgsql
as $$
begin
  select st.service_id
  into new.service_id
  from public.service_transactions st
  where st.service_transaction_id = new.service_transaction_id;

  if new.service_id is null then
    raise exception 'service_transaction_id % does not resolve to a valid service_transactions row', new.service_transaction_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_set_service_transaction_asset_service_id on public.service_transaction_assets;
create trigger trg_set_service_transaction_asset_service_id
before insert or update on public.service_transaction_assets
for each row
execute function public.set_service_transaction_asset_service_id();

commit;
