-- Add attribute linkage fields to parameters table (idempotent pattern)
ALTER TABLE parameters ADD COLUMN attribute_table varchar(64);
ALTER TABLE parameters ADD COLUMN attribute_column varchar(64);
ALTER TABLE parameters ADD COLUMN attribute_value_id integer;
