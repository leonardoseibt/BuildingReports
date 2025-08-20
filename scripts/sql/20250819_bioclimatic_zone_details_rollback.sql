-- Drop bioclimatic zone detail columns if they exist
ALTER TABLE IF EXISTS bioclimatic_zones
  DROP COLUMN IF EXISTS characteristics,
  DROP COLUMN IF EXISTS recommendations,
  DROP COLUMN IF EXISTS thermal_limits,
  DROP COLUMN IF EXISTS design_strategies;
