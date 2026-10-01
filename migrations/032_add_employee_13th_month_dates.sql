-- Migration 032: replace report-period special-month flag with employee-specific 13th month tracking

ALTER TABLE public.report_periods
  DROP COLUMN IF EXISTS is_special_month;

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS special_month_pay DATE;

ALTER TABLE public.employees
  ADD CONSTRAINT employees_special_month_pay_min_12_months_check
    CHECK (
      start_date IS NULL OR
      special_month_pay IS NULL OR
      special_month_pay >= (start_date + INTERVAL '12 months')
    );

CREATE OR REPLACE FUNCTION public.normalize_employee_13th_month_dates()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.start_date IS NOT NULL AND NEW.special_month_pay IS NULL THEN
    NEW.special_month_pay := (NEW.start_date + INTERVAL '12 months')::DATE;
  END IF;

  IF NEW.start_date IS NOT NULL
     AND NEW.special_month_pay IS NOT NULL
     AND NEW.special_month_pay < (NEW.start_date + INTERVAL '12 months') THEN
    RAISE EXCEPTION 'special_month_pay must be at least 12 months after start_date';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS employees_13th_month_dates_trigger ON public.employees;

CREATE TRIGGER employees_13th_month_dates_trigger
BEFORE INSERT OR UPDATE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.normalize_employee_13th_month_dates();

CREATE INDEX IF NOT EXISTS idx_employees_special_month_pay
  ON public.employees (special_month_pay);
