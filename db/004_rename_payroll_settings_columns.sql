-- Migration: Rename and retype payroll_settings columns
-- Run this against the Postgres DATABASE_URL used by the app

-- Rename undertime_deduction_per_minute to undertime_deduction_per_hour
ALTER TABLE payroll_settings RENAME COLUMN undertime_deduction_per_minute TO undertime_deduction_per_hour;

-- Rename overtime_rate_multiplier to overtime_rate
ALTER TABLE payroll_settings RENAME COLUMN overtime_rate_multiplier TO overtime_rate;

-- Change overtime_rate, undertime_deduction_per_hour, and absent_deduction_per_day from numeric to int
ALTER TABLE payroll_settings ALTER COLUMN overtime_rate TYPE INTEGER USING ROUND(overtime_rate);
ALTER TABLE payroll_settings ALTER COLUMN undertime_deduction_per_hour TYPE INTEGER USING ROUND(undertime_deduction_per_hour);
ALTER TABLE payroll_settings ALTER COLUMN absent_deduction_per_day TYPE INTEGER USING ROUND(absent_deduction_per_day);