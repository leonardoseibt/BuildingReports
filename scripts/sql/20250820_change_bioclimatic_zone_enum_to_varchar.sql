-- Change buildings.bioclimatic_zone from enum to varchar(16)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='buildings' AND column_name='bioclimatic_zone'
  ) THEN
    -- If column is of enum type, cast to text then to varchar(16)
    ALTER TABLE buildings ALTER COLUMN bioclimatic_zone TYPE varchar(16) USING bioclimatic_zone::text;
  END IF;
END$$;

-- Keep existing enum type for legacy refs; optional: drop type if unused
-- DO $$
-- BEGIN
--   IF EXISTS (SELECT 1 FROM pg_type WHERE typname='bioclimatic_zone') THEN
--     DROP TYPE bioclimatic_zone; -- only if no other columns depend on it
--   END IF;
-- END$$;
