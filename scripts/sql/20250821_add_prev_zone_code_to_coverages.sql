-- Add optional prev_zone_code column to bioclimatic_zone_coverages (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bioclimatic_zone_coverages' AND column_name = 'prev_zone_code'
  ) THEN
    ALTER TABLE bioclimatic_zone_coverages ADD COLUMN prev_zone_code varchar(8);
  END IF;
END $$;
