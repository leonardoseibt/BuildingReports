-- Isopleth coverages association table (city -> isopleth)
-- Versão PostgreSQL idempotente.
-- OBS: Certifique-se de que a migração que cria a tabela 'isopleths' já tenha sido executada
-- antes desta (o arquivo '20250828_add_isopleths.sql'). Caso a ordem alfabética esteja
-- invertida no seu processo, renomeie este arquivo para executar depois.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'isopleth_coverages'
  ) THEN
    CREATE TABLE isopleth_coverages (
      id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      isopleth_id INTEGER NOT NULL REFERENCES isopleths(id) ON DELETE CASCADE,
      city_id     INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
      created_at  TIMESTAMP DEFAULT NOW(),
      CONSTRAINT uq_isopleth_coverages UNIQUE (isopleth_id, city_id)
    );
  END IF;
END $$;

-- Indexes (criadas fora do bloco para poderem usar IF NOT EXISTS diretamente)
CREATE INDEX IF NOT EXISTS idx_isopleth_coverages_isopleth ON isopleth_coverages(isopleth_id);
CREATE INDEX IF NOT EXISTS idx_isopleth_coverages_city ON isopleth_coverages(city_id);