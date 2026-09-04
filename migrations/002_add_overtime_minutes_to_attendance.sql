-- Migration: Add overtime_minutes column to attendance table
-- Run this against the Postgres DATABASE_URL used by the app

ALTER TABLE attendance
ADD COLUMN IF NOT EXISTS overtime_minutes INTEGER NOT NULL DEFAULT 0 CHECK (overtime_minutes >= 0);