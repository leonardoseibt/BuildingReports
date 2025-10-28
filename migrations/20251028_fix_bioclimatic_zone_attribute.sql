-- Fix bioclimatic zone attribute to use CODE instead of ID
-- Problem: buildings.bioclimatic_zone stores CODE (varchar "ZB1", "ZB3A", etc.)
--          but attribute was configured to compare with bioclimatic_zones.id (integer)
-- Solution: Configure attribute to use 'code' field instead of 'id' for comparison

-- Update attribute definition to use CODE for comparisons
UPDATE attribute_definitions
SET 
  source_column = 'bioclimatic_zone',
  data_kind = 'reference',
  value_source = 'bioclimatic_zones',
  value_id_field = 'code',  -- KEY FIX: Use CODE instead of ID for comparison
  value_label_field = 'label',
  updated_at = NOW()
WHERE source_table = 'buildings' 
  AND source_column IN ('bioclimatic_zone_code', 'bioclimatic_zone');

-- Note: Existing parameters with attributeValueId referencing bioclimatic_zones.id
-- will need to be re-saved through the UI to use bioclimatic_zones.code instead.
-- The frontend will automatically send the code value when using value_id_field = 'code'.
