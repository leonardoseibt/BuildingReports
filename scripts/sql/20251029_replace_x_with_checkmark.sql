-- Replace 'X' and 'x' with checkmark symbol (✓) in parameters table
-- Date: 2025-10-29

BEGIN;

-- Update minimum_value column
UPDATE parameters
SET minimum_value = '✓'
WHERE minimum_value IN ('X', 'x');

-- Update intermediate_value column
UPDATE parameters
SET intermediate_value = '✓'
WHERE intermediate_value IN ('X', 'x');

-- Update superior_value column
UPDATE parameters
SET superior_value = '✓'
WHERE superior_value IN ('X', 'x');

-- Show affected rows count
SELECT 
  COUNT(*) FILTER (WHERE minimum_value = '✓') as minimum_checkmarks,
  COUNT(*) FILTER (WHERE intermediate_value = '✓') as intermediate_checkmarks,
  COUNT(*) FILTER (WHERE superior_value = '✓') as superior_checkmarks
FROM parameters;

COMMIT;
