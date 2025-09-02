BEGIN;
ALTER TABLE parameters DROP COLUMN IF EXISTS attribute_table;
ALTER TABLE parameters DROP COLUMN IF EXISTS attribute_column;
-- Mantemos attribute_value_id pois ainda é utilizado para atributos reference
COMMIT;
