-- Remove legacy sales insert/update deduction triggers that duplicate the
-- application-level stock deduction already performed in app/api/sales/route.ts.
-- The delete trigger remains intact so sales deletion can restore stock.

begin;

drop trigger if exists trg_after_sales_insert_deductions on sales;
drop trigger if exists trg_after_sales_update_deductions on sales;

drop function if exists trg_sales_insert_deductions();
drop function if exists trg_sales_update_deductions();

commit;
