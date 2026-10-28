-- Add the missing Better Auth username display field in the app's existing snake_case schema.
-- This is safe to re-run and does not modify existing users or other columns.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS display_username text;

-- The app already stores username as a unique field. This keeps the existing uniqueness intact
-- without altering current data or creating an additional camelCase column.
CREATE UNIQUE INDEX IF NOT EXISTS users_username_key
  ON public.users (username)
  WHERE username IS NOT NULL;
