begin;

alter table public.service_transactions
  add column if not exists deductions_applied boolean not null default false;

commit;
