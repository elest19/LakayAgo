-- Add SPECIAL holiday_type value if missing
ALTER TYPE holiday_type ADD VALUE IF NOT EXISTS 'SPECIAL';
