DO $$
BEGIN
  -- typology
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buildings' AND column_name = 'typology'
  ) THEN
    ALTER TABLE buildings DROP COLUMN typology;
  END IF;

  -- noise_class
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buildings' AND column_name = 'noise_class'
  ) THEN
    ALTER TABLE buildings DROP COLUMN noise_class;
  END IF;

  -- aggressiveness_class
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buildings' AND column_name = 'aggressiveness_class'
  ) THEN
    ALTER TABLE buildings DROP COLUMN aggressiveness_class;
  END IF;
END $$;
