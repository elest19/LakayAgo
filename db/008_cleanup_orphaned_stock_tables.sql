-- ============================================================
-- Cleanup orphaned stock tables, old inventory table, and legacy RPC
-- ============================================================
-- This removes the now-unused stock tracking objects that were left
-- behind when the app moved away from the restaurants-era schema.
-- The script is idempotent and safe to rerun.
-- ============================================================

begin;

-- Verify and drop the old stock trigger and its function.
drop trigger if exists trg_set_stock_transaction_restaurant on stock_transactions;
drop function if exists set_stock_transaction_restaurant();

-- Drop the legacy RPC used by the old sales route.
drop function if exists create_sales_with_stock_transactions();
drop function if exists create_sales_with_stock_transactions(text, jsonb, bigint, text);

-- Drop the obsolete inventory display view.
drop view if exists inventory_display;

-- Drop orphaned stock tables if they still exist.
drop table if exists stock_transactions cascade;
drop table if exists kitchen_stock cascade;
drop table if exists production_stock cascade;
drop table if exists inventory cascade;

commit;
