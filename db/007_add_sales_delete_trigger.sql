-- Add AFTER DELETE trigger to restore production inventory when a sales row is deleted
-- and drop the unused two-argument overload of apply_sale_deductions if present.

begin;

-- 1) Trigger function that calls the active 3-arg apply_sale_deductions with a negated delta
create or replace function trg_sales_delete_deductions()
returns trigger
language plpgsql
as $$
begin
    perform apply_sale_deductions(old.food_and_beverage_id, -old.number_of_sales, old.sales_id);
    return old;
end;
$$;

-- 2) Trigger that fires after delete on sales
create trigger trg_after_sales_delete_deductions
    after delete on sales
    for each row
    execute function trg_sales_delete_deductions();

-- 3) Safely remove any leftover two-argument overload of apply_sale_deductions
--    We locate public functions named apply_sale_deductions with exactly two args
--    and issue DROP FUNCTION for the matching identity signature.
DO $$
DECLARE
  r RECORD;
  nargs INT;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args, array_length(p.proargtypes::oid[], 1) AS nargs
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'apply_sale_deductions' AND n.nspname = 'public'
  LOOP
    IF r.nargs = 2 THEN
      RAISE NOTICE 'Dropping function public.% with args %', r.proname, r.args;
      EXECUTE format('DROP FUNCTION IF EXISTS public.%s(%s);', r.proname, r.args);
    END IF;
  END LOOP;
END;
$$ language plpgsql;

commit;
