-- Ajusta as colunas min_limit e max_limit para 2 casas decimais (reduzindo scale de 4 -> 2)
-- Para Postgres, basta mudar o tipo (numeric(12,4) -> numeric(12,2)); truncamento será aplicado.
ALTER TABLE parameters
  ALTER COLUMN min_limit TYPE numeric(12,2);
ALTER TABLE parameters
  ALTER COLUMN max_limit TYPE numeric(12,2);
