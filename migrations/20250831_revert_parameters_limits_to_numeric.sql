-- Revert min_limit and max_limit from text back to numeric(12,2)
-- Assumes existing text values are plain numbers or empty/null. Non-numeric will become NULL.
ALTER TABLE parameters
    ALTER COLUMN min_limit TYPE numeric(12,2) USING NULLIF(btrim(min_limit),'')::numeric;

ALTER TABLE parameters
    ALTER COLUMN max_limit TYPE numeric(12,2) USING NULLIF(btrim(max_limit),'')::numeric;
