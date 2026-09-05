-- Adds the trigger date used to determine when 13th month pay is active in the current payroll period.
-- The value is a DATE stored in payroll_settings and is read by payroll calculation logic.

alter table if exists payroll_settings
    add column if not exists special_month_pay date;
