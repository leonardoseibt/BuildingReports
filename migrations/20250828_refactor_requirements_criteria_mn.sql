-- Refactor Requisitos <-> Critérios to M:N and move requirement link to analyses
-- Idempotent-ish guards to allow re-run (no-op if already applied)

DO $$ BEGIN
  -- 1. Pivot table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'requirements_criteria'
  ) THEN
    CREATE TABLE requirements_criteria (
      requirement_id INT NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
      criterion_id INT NOT NULL REFERENCES criteria(id) ON DELETE CASCADE,
      PRIMARY KEY (requirement_id, criterion_id)
    );
    CREATE INDEX idx_reqcrit_requirement ON requirements_criteria(requirement_id);
    CREATE INDEX idx_reqcrit_criterion ON requirements_criteria(criterion_id);
  END IF;

  -- 2. Backfill pivot from old criteria.requirement_id if column still exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='criteria' AND column_name='requirement_id'
  ) THEN
    INSERT INTO requirements_criteria (requirement_id, criterion_id)
    SELECT DISTINCT requirement_id, id FROM criteria
    ON CONFLICT DO NOTHING;
  END IF;

  -- 3. Add requirement_id to analyses if not present
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='analyses' AND column_name='requirement_id'
  ) THEN
    ALTER TABLE analyses ADD COLUMN requirement_id INT;
  END IF;

  -- 4. Backfill analyses.requirement_id from criteria.requirement_id or from pivot
  UPDATE analyses a
  SET requirement_id = c.requirement_id
  FROM criteria c
  WHERE a.criterion_id = c.id
    AND a.requirement_id IS NULL
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='criteria' AND column_name='requirement_id');

  -- Fallback using pivot (if criteria column already gone)
  UPDATE analyses a
  SET requirement_id = rc.requirement_id
  FROM requirements_criteria rc
  WHERE a.criterion_id = rc.criterion_id AND a.requirement_id IS NULL;

  -- 5. Set NOT NULL after backfill
  ALTER TABLE analyses ALTER COLUMN requirement_id SET NOT NULL;

  -- 6. Unique constraint on (requirement_id, criterion_id, code)
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname='uq_analyses_req_crit_code'
  ) THEN
    CREATE UNIQUE INDEX uq_analyses_req_crit_code ON analyses(requirement_id, criterion_id, code);
  END IF;

  -- 7. Drop old FK column from criteria if still exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='criteria' AND column_name='requirement_id'
  ) THEN
    ALTER TABLE criteria DROP COLUMN requirement_id;
  END IF;
END $$;
