-- Migration: Replace absent/undertime-by-hour fields with undertime deduction settings

ALTER TABLE payroll_settings
  DROP COLUMN IF EXISTS absent_deduction_per_day,
  DROP COLUMN IF EXISTS undertime_deduction_per_hour;

ALTER TABLE payroll_settings
  ADD COLUMN IF NOT EXISTS undertime_deduction NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (undertime_deduction >= 0),
  ADD COLUMN IF NOT EXISTS undertime_deduction_rate_type TEXT NOT NULL DEFAULT 'Hour' CHECK (undertime_deduction_rate_type IN ('Hour', 'Minute')),
  ADD COLUMN IF NOT EXISTS undertime_deduction_rate NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (undertime_deduction_rate >= 0);
