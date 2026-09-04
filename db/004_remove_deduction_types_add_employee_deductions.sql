-- Migration: Remove deduction_types table and add SSS/PhilHealth/Pag-IBIG to employees
-- Run this in Supabase SQL editor

begin;

-- 1. Drop dependent objects first (foreign keys, triggers, etc.)
-- Check for any foreign keys referencing deduction_types
-- (none expected since we already removed references in code, but let's be safe)

-- 2. Drop the deduction_types table completely
drop table if exists deduction_types cascade;

-- 3. Add SSS, PhilHealth, Pag-IBIG columns to employees table
-- These store the actual deduction amounts per employee
alter table employees
  add column if not exists sss numeric(10,2) default 0,
  add column if not exists philhealth numeric(10,2) default 0,
  add column if not exists pagibig numeric(10,2) default 0;

-- Optional: Add comments for clarity
comment on column employees.sss is 'SSS contribution amount';
comment on column employees.philhealth is 'PhilHealth contribution amount';
comment on column employees.pagibig is 'Pag-IBIG contribution amount';

-- 4. If deductions table has a foreign key to deduction_types, drop it too
-- (deductions table references deduction_types via deduction_type_id)
-- We'll keep the deductions table but remove the FK constraint if it exists
alter table deductions drop constraint if exists deductions_deduction_type_id_fkey;

commit;