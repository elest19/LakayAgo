-- Adds the frozen, resolved 13th month pay amount for each payslip.
-- This is written once at payroll approval time and should remain read-only afterward.

alter table if exists payslips
    add column if not exists special_month numeric(12,2) not null default 0;
