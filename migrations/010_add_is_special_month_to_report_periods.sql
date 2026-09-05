-- Migration 010: add is_special_month boolean to report_periods
ALTER TABLE report_periods
ADD COLUMN IF NOT EXISTS is_special_month BOOLEAN NOT NULL DEFAULT FALSE;
