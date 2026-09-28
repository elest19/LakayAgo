-- Migration 033: Drop global leave_number from leave_types

begin;

alter table public.leave_types
  drop column if exists leave_number;

commit;
