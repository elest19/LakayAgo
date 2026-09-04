-- Migration: Add is_halfday column to attendance table
-- Run this against the Postgres DATABASE_URL used by the app

ALTER TABLE attendance
ADD COLUMN is_halfday boolean NOT NULL default false;