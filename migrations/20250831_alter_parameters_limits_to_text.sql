-- Converte min_limit e max_limit de numeric para text (assumindo PostgreSQL)
ALTER TABLE parameters
  ALTER COLUMN min_limit TYPE text;
ALTER TABLE parameters
  ALTER COLUMN max_limit TYPE text;
