ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_users_is_archived
  ON public.users (is_archived);
