-- Make the sales AFTER DELETE deduction trigger conditional.
-- The trigger restores (returns) ingredient stock for every deleted sale.
-- The API now honors the frontend "return_stock" checkbox: when the user does
-- NOT want the stock returned, the delete runs inside a transaction with the
-- custom session GUC app.skip_sales_delete_deductions set to 'on', and this
-- trigger skips the stock restoration for that delete only.

begin;

-- 1) Trigger function that calls the active 3-arg apply_sale_deductions with a
--    negated delta, unless the caller opted out via the session GUC.
create or replace function trg_sales_delete_deductions()
returns trigger
language plpgsql
as $$
begin
    if coalesce(current_setting('app.skip_sales_delete_deductions', true), '') in ('on', 'true', '1') then
        return old;
    end if;

    perform apply_sale_deductions(old.food_and_beverage_id, -old.number_of_sales, old.sales_id);
    return old;
end;
$$;

-- 2) Re-attach the trigger so it picks up the updated function (idempotent)
drop trigger if exists trg_after_sales_delete_deductions on sales;

create trigger trg_after_sales_delete_deductions
    after delete on sales
    for each row
    execute function trg_sales_delete_deductions();

commit;