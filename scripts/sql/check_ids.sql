-- Verify id columns are integers and identity
SELECT
  table_name,
  column_name,
  data_type,
  is_identity,
  column_default
FROM information_schema.columns
WHERE table_name IN (
  'users','buildings','structural_systems','sealing_systems','roofing_systems','performance_evaluations','reports','technicians'
) AND column_name='id'
ORDER BY table_name;
