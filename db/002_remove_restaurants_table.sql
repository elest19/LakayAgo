-- ============================================================
-- MIGRATION: Replace restaurants table + id columns with a
-- text `restaurant` column using values 'Lakay Ago', 'Aroo', 'Both'
--
-- Defensive + idempotent:
--   * Tables may carry EITHER `restaurant_id` OR `restaurants_id`
--     depending on how they were created, so this drops BOTH
--     column names if they exist.
--   * Drops the FK constraint, exists check, before adding the text
--     column, and re-runs are safe.
--   * The `restaurants` lookup table is dropped at the very end.
--
-- Run inside a transaction against Supabase.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 0. Drop objects that depend on the id columns first
-- ------------------------------------------------------------
drop trigger if exists trg_set_stock_transaction_restaurant on stock_transactions;
drop function if exists set_stock_transaction_restaurant();
drop view if exists inventory_display;

-- ------------------------------------------------------------
-- Helper is not supported inside a single ALTER, so we just
-- repeat both drops per table.
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 1. DOMAIN MODULE tables (had `restaurant_id` / `restaurants_id`)
-- ------------------------------------------------------------
-- For each table: drop FK, drop BOTH id columns, add `restaurant`
-- ------------------------------------------------------------

-- employees
alter table employees drop constraint if exists employees_restaurant_id_fkey;
alter table employees drop constraint if exists employees_restaurants_id_fkey;
alter table employees drop column if exists restaurant_id;
alter table employees drop column if exists restaurants_id;
alter table employees add column if not exists restaurant text not null default 'Both'
    check (restaurant in ('Lakay Ago', 'Aroo', 'Both'));

-- leave_types
alter table leave_types drop constraint if exists leave_types_restaurant_id_fkey;
alter table leave_types drop constraint if exists leave_types_restaurants_id_fkey;
alter table leave_types drop column if exists restaurant_id;
alter table leave_types drop column if exists restaurants_id;
alter table leave_types add column if not exists restaurant text not null default 'Both'
    check (restaurant in ('Lakay Ago', 'Aroo', 'Both'));

-- employee_leave_balances
alter table employee_leave_balances drop constraint if exists employee_leave_balances_restaurant_id_fkey;
alter table employee_leave_balances drop constraint if exists employee_leave_balances_restaurants_id_fkey;
alter table employee_leave_balances drop column if exists restaurant_id;
alter table employee_leave_balances drop column if exists restaurants_id;
alter table employee_leave_balances add column if not exists restaurant text not null default 'Both'
    check (restaurant in ('Lakay Ago', 'Aroo', 'Both'));

-- leave_requests
alter table leave_requests drop constraint if exists leave_requests_restaurant_id_fkey;
alter table leave_requests drop constraint if exists leave_requests_restaurants_id_fkey;
alter table leave_requests drop column if exists restaurant_id;
alter table leave_requests drop column if exists restaurants_id;
alter table leave_requests add column if not exists restaurant text not null default 'Both'
    check (restaurant in ('Lakay Ago', 'Aroo', 'Both'));

-- deduction_types
alter table deduction_types drop constraint if exists deduction_types_restaurant_id_fkey;
alter table deduction_types drop constraint if exists deduction_types_restaurants_id_fkey;
alter table deduction_types drop column if exists restaurant_id;
alter table deduction_types drop column if exists restaurants_id;
alter table deduction_types add column if not exists restaurant text not null default 'Both'
    check (restaurant in ('Lakay Ago', 'Aroo', 'Both'));

-- report_periods
alter table report_periods drop constraint if exists report_periods_restaurant_id_fkey;
alter table report_periods drop constraint if exists report_periods_restaurants_id_fkey;
alter table report_periods drop column if exists restaurant_id;
alter table report_periods drop column if exists restaurants_id;
alter table report_periods add column if not exists restaurant text not null default 'Both'
    check (restaurant in ('Lakay Ago', 'Aroo', 'Both'));

-- deductions
alter table deductions drop constraint if exists deductions_restaurant_id_fkey;
alter table deductions drop constraint if exists deductions_restaurants_id_fkey;
alter table deductions drop column if exists restaurant_id;
alter table deductions drop column if exists restaurants_id;
alter table deductions add column if not exists restaurant text not null default 'Both'
    check (restaurant in ('Lakay Ago', 'Aroo', 'Both'));

-- attendance
alter table attendance drop constraint if exists attendance_restaurant_id_fkey;
alter table attendance drop constraint if exists attendance_restaurants_id_fkey;
alter table attendance drop column if exists restaurant_id;
alter table attendance drop column if exists restaurants_id;
alter table attendance add column if not exists restaurant text not null default 'Both'
    check (restaurant in ('Lakay Ago', 'Aroo', 'Both'));

-- audit_logs (nullable FK)
alter table audit_logs drop constraint if exists audit_logs_restaurant_id_fkey;
alter table audit_logs drop constraint if exists audit_logs_restaurants_id_fkey;
alter table audit_logs drop column if exists restaurant_id;
alter table audit_logs drop column if exists restaurants_id;
alter table audit_logs add column if not exists restaurant text
    check (restaurant in ('Lakay Ago', 'Aroo', 'Both'));

-- expenses
alter table expenses drop constraint if exists expenses_restaurant_id_fkey;
alter table expenses drop constraint if exists expenses_restaurants_id_fkey;
alter table expenses drop column if exists restaurant_id;
alter table expenses drop column if exists restaurants_id;
alter table expenses add column if not exists restaurant text not null default 'Both'
    check (restaurant in ('Lakay Ago', 'Aroo', 'Both'));

-- ------------------------------------------------------------
-- 2. INVENTORY MODULE tables (had `restaurants_id` / `restaurant_id`)
-- ------------------------------------------------------------

-- production_stock
alter table production_stock drop constraint if exists production_stock_restaurants_id_fkey;
alter table production_stock drop constraint if exists production_stock_restaurant_id_fkey;
alter table production_stock drop column if exists restaurants_id;
alter table production_stock drop column if exists restaurant_id;
alter table production_stock add column if not exists restaurant text not null default 'Both'
    check (restaurant in ('Lakay Ago', 'Aroo', 'Both'));

-- kitchen_stock
alter table kitchen_stock drop constraint if exists kitchen_stock_restaurants_id_fkey;
alter table kitchen_stock drop constraint if exists kitchen_stock_restaurant_id_fkey;
alter table kitchen_stock drop column if exists restaurants_id;
alter table kitchen_stock drop column if exists restaurant_id;
alter table kitchen_stock add column if not exists restaurant text not null default 'Both'
    check (restaurant in ('Lakay Ago', 'Aroo', 'Both'));

-- inventory
alter table inventory drop constraint if exists inventory_restaurants_id_fkey;
alter table inventory drop constraint if exists inventory_restaurant_id_fkey;
alter table inventory drop column if exists restaurants_id;
alter table inventory drop column if exists restaurant_id;
alter table inventory add column if not exists restaurant text not null default 'Both'
    check (restaurant in ('Lakay Ago', 'Aroo', 'Both'));

-- sales
alter table sales drop constraint if exists sales_restaurants_id_fkey;
alter table sales drop constraint if exists sales_restaurant_id_fkey;
alter table sales drop column if exists restaurants_id;
alter table sales drop column if exists restaurant_id;
alter table sales add column if not exists restaurant text not null default 'Both'
    check (restaurant in ('Lakay Ago', 'Aroo', 'Both'));

-- stock_transactions
alter table stock_transactions drop constraint if exists stock_transactions_restaurants_id_fkey;
alter table stock_transactions drop constraint if exists stock_transactions_restaurant_id_fkey;
alter table stock_transactions drop column if exists restaurants_id;
alter table stock_transactions drop column if exists restaurant_id;
alter table stock_transactions add column if not exists restaurant text not null default 'Both'
    check (restaurant in ('Lakay Ago', 'Aroo', 'Both'));

-- ------------------------------------------------------------
-- 3. Drop the restaurants lookup table
-- ------------------------------------------------------------
drop table if exists restaurants;

-- ------------------------------------------------------------
-- 4. Rebuild the inventory_display view (text restaurant)
-- ------------------------------------------------------------
create or replace view inventory_display
with (security_invoker = true)
as
select
    i.inventory_id,
    i.restaurant,
    coalesce(ks.product, i.name) as name,
    i.price,
    coalesce(ks.stock, i.stock) as stock,
    i.category,
    i.kitchen_id,
    i.is_archived,
    i.created_at
from inventory i
left join kitchen_stock ks
    on ks.kitchen_id = i.kitchen_id;

comment on view inventory_display is
'Resolved Inventory read view. Linked Inventory rows use the corresponding Kitchen Stock product and stock; standalone Inventory rows use their own name and stock. Cross-restaurant Kitchen relationships are allowed.';

-- ------------------------------------------------------------
-- 5. Rebuild the stock_transactions trigger (text restaurant)
--    restaurant is derived from the destination side:
--    - TRANSFER / SELF_PRODUCE -> kitchen_stock.restaurant
--    - SALE -> inventory.restaurant
-- ------------------------------------------------------------
create or replace function set_stock_transaction_restaurant()
returns trigger as $$
declare
    v_production_product text;
    v_kitchen_product text;
begin
    if new.transaction_type in ('TRANSFER', 'SELF_PRODUCE') then
        select restaurant into new.restaurant
        from kitchen_stock
        where kitchen_id = new.kitchen_id;
    elsif new.transaction_type = 'SALE' then
        select restaurant into new.restaurant
        from inventory
        where inventory_id = new.inventory_id;
    end if;

    if new.restaurant is null then
        raise exception
            'Could not derive restaurant for stock_transactions row (transaction_type=%, kitchen_id=%, inventory_id=%)',
            new.transaction_type, new.kitchen_id, new.inventory_id;
    end if;

    -- A TRANSFER must move the same item, not rename it —
    -- production_stock.product and kitchen_stock.product must match,
    -- even across a cross-restaurant transfer.
    if new.transaction_type = 'TRANSFER' then
        select product into v_production_product
        from production_stock
        where production_id = new.production_id;

        select product into v_kitchen_product
        from kitchen_stock
        where kitchen_id = new.kitchen_id;

        if v_production_product is distinct from v_kitchen_product then
            raise exception
                'Product name mismatch on TRANSFER: production_stock.product = %, kitchen_stock.product = % (production_id=%, kitchen_id=%). A transfer must move the same item, not rename it.',
                v_production_product, v_kitchen_product, new.production_id, new.kitchen_id;
        end if;
    end if;

    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_stock_transaction_restaurant on stock_transactions;
create trigger trg_set_stock_transaction_restaurant
    before insert or update on stock_transactions
    for each row execute function set_stock_transaction_restaurant();

-- ------------------------------------------------------------
-- 6. Seed deduction types per restaurant (text list)
--    Idempotent: only inserts rows that don't already exist by
--    checking (restaurant, name) via a NOT EXISTS guard, since the
--    previous unique constraint was dropped with the old FK column.
-- ------------------------------------------------------------
insert into deduction_types (restaurant, name, is_statutory)
select r.restaurant, dt.name, dt.is_statutory
from (values ('Lakay Ago'), ('Aroo')) as r(restaurant)
cross join (
    values
        ('SSS', true),
        ('PhilHealth', true),
        ('Pag-IBIG', true)
) as dt(name, is_statutory)
where not exists (
    select 1 from deduction_types d
    where d.restaurant = r.restaurant and d.name = dt.name
);

commit;