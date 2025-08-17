-- Alter buildings enum-like columns to text to allow configurable master tables
DO $$
BEGIN
  -- typology to text
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'buildings' AND column_name = 'typology' AND udt_name <> 'text'
  ) THEN
    ALTER TABLE buildings ALTER COLUMN typology TYPE text USING typology::text;
  END IF;

  -- noise_class to text
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'buildings' AND column_name = 'noise_class' AND udt_name <> 'text'
  ) THEN
    ALTER TABLE buildings ALTER COLUMN noise_class TYPE text USING noise_class::text;
  END IF;

  -- aggressiveness_class to text
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'buildings' AND column_name = 'aggressiveness_class' AND udt_name <> 'text'
  ) THEN
    ALTER TABLE buildings ALTER COLUMN aggressiveness_class TYPE text USING aggressiveness_class::text;
  END IF;
END $$;

-- Optionally drop old enum types if present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'building_typology') THEN
    DROP TYPE building_typology;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'noise_class') THEN
    DROP TYPE noise_class;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'aggressiveness_class') THEN
    DROP TYPE aggressiveness_class;
  END IF;
END $$;
