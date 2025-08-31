-- Add min and max limit columns to parameters
ALTER TABLE parameters ADD COLUMN min_limit numeric(12,4);
ALTER TABLE parameters ADD COLUMN max_limit numeric(12,4);
