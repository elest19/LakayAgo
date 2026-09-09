ALTER TABLE public.users ADD COLUMN IF NOT EXISTS id uuid;

UPDATE public.users
SET id = user_id
WHERE id IS NULL;

ALTER TABLE public.users
  ALTER COLUMN id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_id ON public.users(id);

CREATE OR REPLACE FUNCTION sync_users_id_alias()
RETURNS trigger AS $$
BEGIN
  IF NEW.id IS NULL AND NEW.user_id IS NOT NULL THEN
    NEW.id := NEW.user_id;
  ELSIF NEW.user_id IS NULL AND NEW.id IS NOT NULL THEN
    NEW.user_id := NEW.id;
  ELSIF NEW.id IS NOT NULL AND NEW.user_id IS NOT NULL AND NEW.id <> NEW.user_id THEN
    NEW.user_id := NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_sync_id_alias ON public.users;

CREATE TRIGGER users_sync_id_alias
BEFORE INSERT OR UPDATE OF id, user_id ON public.users
FOR EACH ROW
EXECUTE FUNCTION sync_users_id_alias();
