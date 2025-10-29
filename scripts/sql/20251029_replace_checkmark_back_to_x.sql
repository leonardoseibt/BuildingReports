-- Replace checkmark symbol (✓) back to 'X' in parameters table
-- Date: 2025-10-29

BEGIN;

-- Update minimum_value column
UPDATE parameters
SET minimum_value = 'X'
WHERE minimum_value = '✓';

-- Update intermediate_value column
UPDATE parameters
SET intermediate_value = 'X'
WHERE intermediate_value = '✓';

-- Update superior_value column
UPDATE parameters
SET superior_value = 'X'
WHERE superior_value = '✓';

-- Show affected rows count
SELECT 
  COUNT(*) FILTER (WHERE minimum_value = 'X') as minimum_x_count,
  COUNT(*) FILTER (WHERE intermediate_value = 'X') as intermediate_x_count,
  COUNT(*) FILTER (WHERE superior_value = 'X') as superior_x_count
FROM parameters;

COMMIT;
