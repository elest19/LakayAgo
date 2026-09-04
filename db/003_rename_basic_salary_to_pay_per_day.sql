-- Migration: Rename basic_salary to pay_per_day in employees table
-- Run this in Supabase SQL editor

begin;

-- 1. Rename the column
alter table employees rename column basic_salary to pay_per_day;

-- 2. Update any existing constraints/indexes that reference the old name
-- (PostgreSQL automatically updates column references in constraints)

-- 3. Optional: If you want to change the data type (e.g., from numeric to integer)
-- alter table employees alter column pay_per_day type integer using pay_per_day::integer;

commit;