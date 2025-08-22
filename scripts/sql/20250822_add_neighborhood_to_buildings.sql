/* Migration: add neighborhood column to buildings (idempotent) */
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='buildings' AND column_name='neighborhood'
  ) THEN
    ALTER TABLE buildings ADD COLUMN neighborhood VARCHAR(128);
  END IF;
END $$;

/* Heuristic backfill (Rua, Numero, Bairro, Cidade, UF) */
UPDATE buildings
SET neighborhood = NULLIF(split_part(address, ',', 3), '')
WHERE (neighborhood IS NULL OR neighborhood = '')
  AND address IS NOT NULL
  AND split_part(address, ',', 3) <> '';