begin;

alter table public.services
  drop column if exists food_package_id,
  drop column if exists is_special,
  drop column if exists penalty;

alter table public.service_transactions
  add column if not exists penalty numeric(12,2) not null default 0;

alter table public.service_transactions
  add constraint if not exists service_transactions_penalty_check check (penalty >= 0);

alter table public.sub_services
  drop column if exists expenses,
  drop column if exists penalty;

commit;
