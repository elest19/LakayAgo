ALTER TABLE public.leave_types
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_leave_types_is_archived
  ON public.leave_types (is_archived);