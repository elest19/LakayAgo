-- Migration 009: drop special_month_pay from payroll_settings
ALTER TABLE payroll_settings DROP COLUMN IF EXISTS special_month_pay;
