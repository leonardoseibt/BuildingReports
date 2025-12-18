-- Ensure bioclimatic zone attribute definition uses the correct column
UPDATE attribute_definitions
   SET source_column = 'bioclimatic_zone'
 WHERE source_table = 'buildings'
   AND source_column = 'bioclimatic_zone_code';
