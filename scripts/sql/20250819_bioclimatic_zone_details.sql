-- Add JSONB detail fields to bioclimatic_zones (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='bioclimatic_zones' AND column_name='characteristics'
  ) THEN
    ALTER TABLE bioclimatic_zones ADD COLUMN characteristics jsonb;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='bioclimatic_zones' AND column_name='recommendations'
  ) THEN
    ALTER TABLE bioclimatic_zones ADD COLUMN recommendations jsonb;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='bioclimatic_zones' AND column_name='thermal_limits'
  ) THEN
    ALTER TABLE bioclimatic_zones ADD COLUMN thermal_limits jsonb;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='bioclimatic_zones' AND column_name='design_strategies'
  ) THEN
    ALTER TABLE bioclimatic_zones ADD COLUMN design_strategies jsonb;
  END IF;
END $$;
