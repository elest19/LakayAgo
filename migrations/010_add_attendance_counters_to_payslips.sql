-- Migration: add attendance counters to payslips
-- Adds late_minutes, undertime_minutes, and half_day_count to persist counters at payroll approval

alter table if exists payslips
  add column if not exists late_minutes integer not null default 0,
  add column if not exists undertime_minutes integer not null default 0,
  add column if not exists half_day_count integer not null default 0;

-- no rollback here; this is additive only
