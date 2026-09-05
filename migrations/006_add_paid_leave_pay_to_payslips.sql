-- Required schema addition for paid leave support.
-- The live database already contains `on_leave` and `is_paid` on the relevant tables.
-- This migration adds the pay component to payslips so payroll approval can persist it.

alter table if exists payslips
    add column if not exists paid_leave_pay numeric(12,2) not null default 0;
