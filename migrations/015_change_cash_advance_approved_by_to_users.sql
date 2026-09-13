ALTER TABLE public.cash_advances
  DROP CONSTRAINT IF EXISTS cash_advances_approved_by_fkey;

-- NOTE: public.users uses user_id as its primary key and that column is uuid,
-- not bigint. Existing employee-based approver IDs are intentionally cleared
-- because they are not valid auth.user references.
ALTER TABLE public.cash_advances
  ALTER COLUMN approved_by TYPE uuid USING NULL;

ALTER TABLE public.cash_advances
  ADD CONSTRAINT cash_advances_approved_by_fkey
  FOREIGN KEY (approved_by) REFERENCES public.users(user_id) ON DELETE SET NULL;
