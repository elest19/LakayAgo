-- Migration: Add half_day column to attendance_settings table
-- Run this against the Postgres DATABASE_URL used by the app

ALTER TABLE attendance_settings
ADD COLUMN IF NOT EXISTS half_day TIME DEFAULT '12:00:00';
