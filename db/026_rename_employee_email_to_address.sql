ALTER TABLE IF EXISTS employees
  RENAME COLUMN email TO address;

-- Optional compatibility for older installs that still have the old column name.
-- If the migration is run on an already-migrated database, it is a no-op.
