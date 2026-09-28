-- Reduce the app role set to Admin and Staff only.
-- Existing SuperAdmin values are migrated to Admin without deleting any records.

UPDATE users
SET role = 'Admin'
WHERE role = 'SuperAdmin' OR role = 'Super Admin';

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role = ANY (ARRAY['Admin'::text, 'Staff'::text]));
