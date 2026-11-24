-- Allow production inventory locations to be stored in audit_logs.restaurant.
-- The column remains named restaurant for backward compatibility.
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_restaurant_check;

ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_restaurant_check
  CHECK (
    restaurant IS NULL
    OR restaurant = ANY (ARRAY[
      'Lakay Ago'::text,
      'Aroo'::text,
      'Both'::text,
      'Warehouse'::text,
      'Pasalubong Center'::text,
      'Food Cart'::text
    ])
  );
