-- Migration: Create settings and holidays tables
-- Run this against the Postgres DATABASE_URL used by the app

CREATE TABLE IF NOT EXISTS attendance_settings (
  id SERIAL PRIMARY KEY,
  grace_period INTEGER NOT NULL DEFAULT 0 CHECK (grace_period >= 0),
  required_daily_hours NUMERIC(5,2) NOT NULL DEFAULT 8.00 CHECK (required_daily_hours >= 0),
  break_duration INTEGER NOT NULL DEFAULT 0 CHECK (break_duration >= 0),
  overtime_threshold INTEGER NOT NULL DEFAULT 0 CHECK (overtime_threshold >= 0),
  start_time TIME,
  end_time TIME,
  half_day TIME DEFAULT '12:00:00',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS payroll_settings (
  id SERIAL PRIMARY KEY,
  undertime_deduction NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (undertime_deduction >= 0),
  undertime_deduction_rate_type TEXT NOT NULL DEFAULT 'Hour' CHECK (undertime_deduction_rate_type IN ('Hour', 'Minute')),
  undertime_deduction_rate NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (undertime_deduction_rate >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TYPE IF NOT EXISTS holiday_type AS ENUM ('REGULAR', 'SPECIAL_NON_WORKING', 'COMPANY');

CREATE TABLE IF NOT EXISTS holidays (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  holiday_name TEXT NOT NULL,
  type holiday_type NOT NULL DEFAULT 'REGULAR',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(date)
);

-- Trigger to update updated_at on row updates
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER IF NOT EXISTS attendance_settings_updated_at BEFORE UPDATE ON attendance_settings
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE TRIGGER IF NOT EXISTS payroll_settings_updated_at BEFORE UPDATE ON payroll_settings
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE TRIGGER IF NOT EXISTS holidays_updated_at BEFORE UPDATE ON holidays
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
