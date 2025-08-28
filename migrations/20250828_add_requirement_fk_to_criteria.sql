-- Add requirement_id to criteria (PostgreSQL)
DO $$ BEGIN
	ALTER TABLE criteria ADD COLUMN requirement_id integer;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Backfill (adjust as needed): pick first requirement if none set
UPDATE criteria SET requirement_id = (
	SELECT id FROM requirements ORDER BY id LIMIT 1
) WHERE requirement_id IS NULL;

-- Ensure NOT NULL
ALTER TABLE criteria ALTER COLUMN requirement_id SET NOT NULL;

-- Add FK constraint safely
DO $$ BEGIN
	ALTER TABLE criteria ADD CONSTRAINT fk_criteria_requirement FOREIGN KEY (requirement_id) REFERENCES requirements(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Index
CREATE INDEX IF NOT EXISTS idx_criteria_requirement ON criteria(requirement_id);
