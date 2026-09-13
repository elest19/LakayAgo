ALTER TABLE food_packages ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'catering_package';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'food_packages_type_check'
      AND conrelid = 'public.food_packages'::regclass
  ) THEN
    ALTER TABLE public.food_packages
      ADD CONSTRAINT food_packages_type_check
      CHECK (type = ANY (ARRAY['catering_package'::text, 'menu_bundle'::text]));
  END IF;
END $$;
