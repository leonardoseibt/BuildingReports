-- Script de Recovery: Completar Migration de Zona Bioclimática e Isopleta
-- Execute este script no servidor de produção se a migration principal falhou

BEGIN;

-- Passo 1: Verificar se as colunas antigas ainda existem
DO $$
DECLARE
  has_old_bioclimatic BOOLEAN;
  has_old_isopleth BOOLEAN;
BEGIN
  -- Verificar coluna bioclimatic_zone
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'buildings' AND column_name = 'bioclimatic_zone'
  ) INTO has_old_bioclimatic;
  
  -- Verificar coluna isopleth_code
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'buildings' AND column_name = 'isopleth_code'
  ) INTO has_old_isopleth;

  IF has_old_bioclimatic OR has_old_isopleth THEN
    RAISE NOTICE 'Colunas antigas detectadas. Procedendo com migration...';
  ELSE
    RAISE NOTICE 'Colunas antigas já foram removidas. Verificando dados...';
  END IF;
END $$;

-- Passo 2: Migrar dados das colunas antigas para as novas (se ainda existirem)
-- BIOCLIMATIC ZONE
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'buildings' AND column_name = 'bioclimatic_zone') THEN
    RAISE NOTICE 'Migrando bioclimatic_zone -> bioclimatic_zone_id...';
    
    UPDATE buildings b
    SET bioclimatic_zone_id = bz.id
    FROM bioclimatic_zones bz
    WHERE b.bioclimatic_zone = bz.code
    AND b.bioclimatic_zone_id IS NULL; -- Só atualizar se ainda não foi migrado
    
    RAISE NOTICE 'Dados de zona bioclimática migrados!';
  END IF;
END $$;

-- ISOPLETH
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'buildings' AND column_name = 'isopleth_code') THEN
    RAISE NOTICE 'Migrando isopleth_code -> isopleth_id...';
    
    UPDATE buildings b
    SET isopleth_id = i.id
    FROM isopleths i
    WHERE b.isopleth_code = i.code
    AND b.isopleth_id IS NULL; -- Só atualizar se ainda não foi migrado
    
    RAISE NOTICE 'Dados de isopleta migrados!';
  END IF;
END $$;

-- Passo 3: Definir valores padrão para registros sem zona bioclimática
UPDATE buildings
SET bioclimatic_zone_id = (SELECT id FROM bioclimatic_zones WHERE code = 'ZB3' LIMIT 1)
WHERE bioclimatic_zone_id IS NULL;

-- Passo 4: Tornar bioclimatic_zone_id NOT NULL (se ainda não for)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'buildings' 
    AND column_name = 'bioclimatic_zone_id'
    AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE buildings ALTER COLUMN bioclimatic_zone_id SET NOT NULL;
    RAISE NOTICE 'bioclimatic_zone_id agora é NOT NULL';
  END IF;
END $$;

-- Passo 5: Remover colunas antigas (se ainda existirem)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'buildings' AND column_name = 'bioclimatic_zone') THEN
    ALTER TABLE buildings DROP COLUMN bioclimatic_zone;
    RAISE NOTICE 'Coluna bioclimatic_zone removida';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'buildings' AND column_name = 'isopleth_code') THEN
    ALTER TABLE buildings DROP COLUMN isopleth_code;
    RAISE NOTICE 'Coluna isopleth_code removida';
  END IF;
END $$;

-- Passo 6: Criar foreign keys (se ainda não existirem)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'buildings' 
    AND constraint_name = 'fk_buildings_bioclimatic_zone'
  ) THEN
    ALTER TABLE buildings
      ADD CONSTRAINT fk_buildings_bioclimatic_zone
      FOREIGN KEY (bioclimatic_zone_id)
      REFERENCES bioclimatic_zones(id)
      ON DELETE RESTRICT;
    RAISE NOTICE 'FK para bioclimatic_zones criada';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'buildings' 
    AND constraint_name = 'fk_buildings_isopleth'
  ) THEN
    ALTER TABLE buildings
      ADD CONSTRAINT fk_buildings_isopleth
      FOREIGN KEY (isopleth_id)
      REFERENCES isopleths(id)
      ON DELETE RESTRICT;
    RAISE NOTICE 'FK para isopleths criada';
  END IF;
END $$;

-- Passo 7: Criar índices (se ainda não existirem)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'buildings' 
    AND indexname = 'idx_buildings_bioclimatic_zone_id'
  ) THEN
    CREATE INDEX idx_buildings_bioclimatic_zone_id ON buildings(bioclimatic_zone_id);
    RAISE NOTICE 'Índice idx_buildings_bioclimatic_zone_id criado';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'buildings' 
    AND indexname = 'idx_buildings_isopleth_id'
  ) THEN
    CREATE INDEX idx_buildings_isopleth_id ON buildings(isopleth_id);
    RAISE NOTICE 'Índice idx_buildings_isopleth_id criado';
  END IF;
END $$;

-- Passo 8: Atualizar attribute_definitions
UPDATE attribute_definitions
SET 
  source_column = 'bioclimatic_zone_id',
  data_kind = 'reference',
  value_source = 'bioclimatic_zones',
  value_id_field = 'id',
  value_label_field = 'label',
  updated_at = NOW()
WHERE source_table = 'buildings' 
  AND (source_column = 'bioclimatic_zone' OR source_column = 'bioclimatic_zone_code' OR source_column = 'bioclimatic_zone_id');

UPDATE attribute_definitions
SET 
  source_column = 'isopleth_id',
  data_kind = 'reference',
  value_source = 'isopleths',
  value_id_field = 'id',
  value_label_field = 'label',
  updated_at = NOW()
WHERE source_table = 'buildings' 
  AND (source_column = 'isopleth_code' OR source_column = 'isopleth' OR source_column = 'isopleth_id');

COMMIT;

-- Verificação final
SELECT 
  'VERIFICAÇÃO FINAL' as status,
  COUNT(*) as total_edificacoes,
  COUNT(bioclimatic_zone_id) as com_zona_bioclimatica,
  COUNT(isopleth_id) as com_isopleta
FROM buildings;

SELECT 
  'attribute_definitions' as tabela,
  id,
  friendly_name,
  source_column,
  value_source
FROM attribute_definitions
WHERE source_table = 'buildings'
AND (source_column LIKE '%bioclimatic%' OR source_column LIKE '%isopleth%');
