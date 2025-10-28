-- Migration: Add second attribute support to parameters
-- Date: 2025-10-27
-- Description: Adds attribute2_id and attribute_value2_id columns to parameters table
--              to support filtering by two attributes instead of just one

-- Add attribute2_id column (nullable, references attribute_definitions)
ALTER TABLE parameters
ADD COLUMN attribute2_id INTEGER REFERENCES attribute_definitions(id) ON DELETE SET NULL;

-- Add attribute_value2_id column (nullable, stores the value for reference-type attributes)
ALTER TABLE parameters
ADD COLUMN attribute_value2_id INTEGER;

-- Add indexes for performance
CREATE INDEX idx_parameters_attribute2_id ON parameters(attribute2_id);
CREATE INDEX idx_parameters_attribute_value2_id ON parameters(attribute_value2_id);

-- Add comments for documentation
COMMENT ON COLUMN parameters.attribute2_id IS 'Second optional attribute for parameter filtering';
COMMENT ON COLUMN parameters.attribute_value2_id IS 'Value for second reference-type attribute';
