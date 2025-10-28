-- Migration: Fix color_groups migration - add alpha column and populate from absorptance_min/max
-- Date: 2025-10-27

-- Passo 1: Adicionar coluna alpha se não existir
ALTER TABLE colors ADD COLUMN IF NOT EXISTS alpha DECIMAL(3,2);

-- Passo 2: Calcular alpha como média de absorptance_min e absorptance_max (ou usar absorptance_min se max for NULL)
UPDATE colors SET alpha = COALESCE(
  CASE 
    WHEN absorptance_min IS NOT NULL AND absorptance_max IS NOT NULL 
      THEN (absorptance_min + absorptance_max) / 2
    WHEN absorptance_min IS NOT NULL 
      THEN absorptance_min
    WHEN absorptance_max IS NOT NULL 
      THEN absorptance_max
    ELSE 0.50
  END,
  0.50
);

-- Passo 3: Atualizar cores existentes com seus grupos (agora que alpha existe)
UPDATE colors SET color_group_id = (
  SELECT id FROM color_groups 
  WHERE colors.alpha >= color_groups.min_alpha 
    AND colors.alpha <= color_groups.max_alpha
  LIMIT 1
);

-- Passo 4: Remover colunas antigas absorptance_min e absorptance_max
ALTER TABLE colors DROP COLUMN IF EXISTS absorptance_min;
ALTER TABLE colors DROP COLUMN IF EXISTS absorptance_max;

-- Passo 5: Tornar alpha NOT NULL (agora que todos os registros têm valor)
ALTER TABLE colors ALTER COLUMN alpha SET NOT NULL;

COMMENT ON COLUMN colors.alpha IS 'Absortância térmica específica da cor (0-1)';
