-- Migration: Remove roofing_systems and sealing_systems tables
-- Date: 2025-09-16
-- Description: Remove roofing_systems and sealing_systems tables that are no longer used

-- Drop foreign key constraints first
ALTER TABLE IF EXISTS roofing_systems DROP CONSTRAINT IF EXISTS roofing_systems_building_id_fkey;
ALTER TABLE IF EXISTS sealing_systems DROP CONSTRAINT IF EXISTS sealing_systems_building_id_fkey;

-- Drop indexes
DROP INDEX IF EXISTS idx_roofing_systems_building;
DROP INDEX IF EXISTS idx_sealing_systems_building;

-- Drop the tables
DROP TABLE IF EXISTS roofing_systems;
DROP TABLE IF EXISTS sealing_systems;

-- Clean up any remaining references in the buildings table relations
-- (Note: These foreign key columns don't exist in buildings table, but checking for completeness)
-- The relations were defined in the schema but not as actual foreign key columns in buildings

-- Verification query to ensure tables are removed
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('roofing_systems', 'sealing_systems');

-- If the query above returns no rows, the migration was successful