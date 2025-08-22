-- Migration: Drop legacy address column from buildings
-- Preconditions: street / neighborhood / city / state already populated.
-- Safety: only drop if column exists.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='buildings' AND column_name='address'
  ) THEN
    ALTER TABLE buildings DROP COLUMN address;
  END IF;
END $$;
