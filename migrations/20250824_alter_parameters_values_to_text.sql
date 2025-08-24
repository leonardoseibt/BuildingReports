-- Alter parameter value columns from numeric to text (no calculation usage)
-- Safe approach: rename old columns, add new text columns, copy data (cast), drop old.

ALTER TABLE parameters RENAME COLUMN minimum_value TO minimum_value_num;
ALTER TABLE parameters RENAME COLUMN intermediate_value TO intermediate_value_num;
ALTER TABLE parameters RENAME COLUMN superior_value TO superior_value_num;

ALTER TABLE parameters ADD COLUMN minimum_value text;
ALTER TABLE parameters ADD COLUMN intermediate_value text;
ALTER TABLE parameters ADD COLUMN superior_value text;

UPDATE parameters SET
  minimum_value = minimum_value_num::text,
  intermediate_value = intermediate_value_num::text,
  superior_value = superior_value_num::text;

ALTER TABLE parameters DROP COLUMN minimum_value_num;
ALTER TABLE parameters DROP COLUMN intermediate_value_num;
ALTER TABLE parameters DROP COLUMN superior_value_num;
