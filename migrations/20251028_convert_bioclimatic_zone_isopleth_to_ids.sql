-- Migration: Convert bioclimatic_zone and isopleth_code from codes (VARCHAR) to IDs (INTEGER)
-- This ensures consistency with other building attributes and enables proper foreign key constraints

BEGIN;

-- Step 1: Add new columns as nullable integers
ALTER TABLE buildings 
  ADD COLUMN bioclimatic_zone_id INTEGER,
  ADD COLUMN isopleth_id INTEGER;

-- Step 2: Migrate existing data - convert codes to IDs
-- For bioclimatic_zone
UPDATE buildings b
SET bioclimatic_zone_id = bz.id
FROM bioclimatic_zones bz
WHERE b.bioclimatic_zone = bz.code;

-- For isopleth_code
UPDATE buildings b
SET isopleth_id = i.id
FROM isopleths i
WHERE b.isopleth_code = i.code;

-- Step 3: Check and report invalid data
DO $$
DECLARE
  invalid_bz_count INTEGER;
  invalid_iso_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO invalid_bz_count 
  FROM buildings 
  WHERE bioclimatic_zone IS NOT NULL 
    AND bioclimatic_zone != '' 
    AND bioclimatic_zone_id IS NULL;
  
  IF invalid_bz_count > 0 THEN
    RAISE WARNING 'Found % buildings with invalid bioclimatic_zone codes that could not be converted', invalid_bz_count;
  END IF;
  
  SELECT COUNT(*) INTO invalid_iso_count 
  FROM buildings 
  WHERE isopleth_code IS NOT NULL 
    AND isopleth_code != '' 
    AND isopleth_id IS NULL;
  
  IF invalid_iso_count > 0 THEN
    RAISE WARNING 'Found % buildings with invalid isopleth codes that could not be converted', invalid_iso_count;
  END IF;
END $$;

-- Step 4: Make bioclimatic_zone_id NOT NULL (it's required)
-- First, set a default for any remaining NULLs (shouldn't happen in production)
UPDATE buildings 
SET bioclimatic_zone_id = (SELECT id FROM bioclimatic_zones WHERE code = 'ZB1' LIMIT 1)
WHERE bioclimatic_zone_id IS NULL;

ALTER TABLE buildings 
  ALTER COLUMN bioclimatic_zone_id SET NOT NULL;

-- Step 5: Drop old columns
ALTER TABLE buildings 
  DROP COLUMN bioclimatic_zone,
  DROP COLUMN isopleth_code;

-- Step 6: Add foreign key constraints
ALTER TABLE buildings
  ADD CONSTRAINT fk_buildings_bioclimatic_zone 
    FOREIGN KEY (bioclimatic_zone_id) 
    REFERENCES bioclimatic_zones(id)
    ON DELETE RESTRICT;

ALTER TABLE buildings
  ADD CONSTRAINT fk_buildings_isopleth 
    FOREIGN KEY (isopleth_id) 
    REFERENCES isopleths(id)
    ON DELETE RESTRICT;

-- Step 7: Create indexes for performance
CREATE INDEX idx_buildings_bioclimatic_zone_id ON buildings(bioclimatic_zone_id);
CREATE INDEX idx_buildings_isopleth_id ON buildings(isopleth_id);

-- Step 8: Add comments for documentation
COMMENT ON COLUMN buildings.bioclimatic_zone_id IS 'Foreign key to bioclimatic_zones table';
COMMENT ON COLUMN buildings.isopleth_id IS 'Foreign key to isopleths table (optional)';

-- Step 9: Update attribute_definitions to use the new columns
UPDATE attribute_definitions
SET 
  source_column = 'bioclimatic_zone_id',
  data_kind = 'reference',
  value_source = 'bioclimatic_zones',
  value_id_field = 'id',
  value_label_field = 'label',
  updated_at = NOW()
WHERE source_table = 'buildings' 
  AND source_column IN ('bioclimatic_zone', 'bioclimatic_zone_code');

UPDATE attribute_definitions
SET 
  source_column = 'isopleth_id',
  data_kind = 'reference',
  value_source = 'isopleths',
  value_id_field = 'id',
  value_label_field = 'label',
  updated_at = NOW()
WHERE source_table = 'buildings' 
  AND source_column IN ('isopleth_code', 'isopleth');

COMMIT;
