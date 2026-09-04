-- Migration: Remove overtime_rate column from payroll_settings
-- Run this against the Postgres DATABASE_URL used by the app

-- Remove overtime_rate column from payroll_settings
ALTER TABLE payroll_settings DROP COLUMN IF EXISTS overtime_rate;