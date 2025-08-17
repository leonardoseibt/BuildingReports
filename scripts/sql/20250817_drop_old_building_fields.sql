-- Drop obsolete columns from buildings table (moved to technicians)
-- Idempotent: safe to run multiple times
DO $$
BEGIN
  -- Drop technical_responsible if exists
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'buildings' AND column_name = 'technical_responsible'
  ) THEN
    ALTER TABLE buildings DROP COLUMN technical_responsible;
  END IF;

  -- Drop crea_cau if exists
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'buildings' AND column_name = 'crea_cau'
  ) THEN
    ALTER TABLE buildings DROP COLUMN crea_cau;
  END IF;
END $$;
