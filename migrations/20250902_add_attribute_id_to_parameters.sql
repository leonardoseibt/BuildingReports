-- Add attribute_id to parameters and backfill
-- PostgreSQL migration: add attribute_id column and backfill
BEGIN;
ALTER TABLE parameters ADD COLUMN IF NOT EXISTS attribute_id integer;

UPDATE parameters p
SET attribute_id = ad.id
FROM attribute_definitions ad
WHERE p.attribute_id IS NULL
  AND p.attribute_table = ad.source_table
  AND p.attribute_column = ad.source_column;

-- Add FK if not present
DO $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'parameters_attribute_id_fkey'
  ) INTO v_exists;
  IF NOT v_exists THEN
    ALTER TABLE parameters
      ADD CONSTRAINT parameters_attribute_id_fkey FOREIGN KEY (attribute_id) REFERENCES attribute_definitions(id) ON DELETE RESTRICT;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_parameters_attribute_id ON parameters(attribute_id);
COMMIT;
