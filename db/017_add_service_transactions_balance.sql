-- Add balance column to service_transactions
begin;

alter table public.service_transactions
  add column if not exists balance numeric(12, 2) not null default 0;

commit;