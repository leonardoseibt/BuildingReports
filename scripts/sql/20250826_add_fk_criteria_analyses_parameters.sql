-- Idempotent migration (PostgreSQL)
DO $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE c.conname = 'fk_analyses_criterion' AND t.relname = 'analyses'
  ) INTO v_exists;
  IF NOT v_exists THEN
    EXECUTE 'ALTER TABLE analyses ADD CONSTRAINT fk_analyses_criterion FOREIGN KEY (criterion_id) REFERENCES criteria(id) ON UPDATE CASCADE ON DELETE RESTRICT';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE c.conname = 'fk_parameters_analysis' AND t.relname = 'parameters'
  ) INTO v_exists;
  IF NOT v_exists THEN
    EXECUTE 'ALTER TABLE parameters ADD CONSTRAINT fk_parameters_analysis FOREIGN KEY (analysis_id) REFERENCES analyses(id) ON UPDATE CASCADE ON DELETE RESTRICT';
  END IF;
END$$;

-- Optional verification:
-- SELECT conname, pg_get_constraintdef(c.oid) FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid WHERE t.relname IN ('analyses','parameters') AND conname IN ('fk_analyses_criterion','fk_parameters_analysis');
