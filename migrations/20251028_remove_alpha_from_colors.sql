-- Migration: Remove alpha column from colors and make color_group_id mandatory
-- Date: 2025-10-28
-- Description:
--   1. Remove coluna alpha (absortância específica não é mais necessária)
--   2. Torna color_group_id NOT NULL (grupo é obrigatório)
--   3. Altera label para VARCHAR(50)

-- Passo 1: Garantir que todas as cores têm um grupo atribuído (atribuir ao grupo padrão se NULL)
UPDATE colors SET color_group_id = (SELECT id FROM color_groups WHERE code = 'CLARA' LIMIT 1) WHERE color_group_id IS NULL;

-- Passo 2: Tornar color_group_id NOT NULL
ALTER TABLE colors ALTER COLUMN color_group_id SET NOT NULL;

-- Passo 3: Remover coluna alpha
ALTER TABLE colors DROP COLUMN IF EXISTS alpha;

-- Passo 4: Alterar label para VARCHAR(50)
ALTER TABLE colors ALTER COLUMN label TYPE VARCHAR(50);

-- Comentários atualizados
COMMENT ON TABLE colors IS 'Catálogo de cores - absortância térmica definida pelo grupo';
COMMENT ON COLUMN colors.label IS 'Descrição curta da cor (máx 50 caracteres)';
COMMENT ON COLUMN colors.color_group_id IS 'Grupo de absortância térmica (obrigatório)';
