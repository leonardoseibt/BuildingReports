-- Migration: Criar tabela color_groups e renomear predominant_colors para colors
-- Date: 2025-10-27
-- Description: 
--   1. Cria tabela color_groups para agrupar cores por faixa de absortância térmica
--   2. Renomeia predominant_colors para colors
--   3. Remove campos min_alpha e max_alpha de colors
--   4. Adiciona FK color_group_id em colors

-- Passo 1: Criar tabela color_groups
CREATE TABLE IF NOT EXISTS color_groups (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  label VARCHAR(255) NOT NULL,
  min_alpha DECIMAL(3,2) NOT NULL CHECK (min_alpha >= 0 AND min_alpha <= 1),
  max_alpha DECIMAL(3,2) NOT NULL CHECK (max_alpha >= 0 AND max_alpha <= 1),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT check_alpha_range CHECK (min_alpha <= max_alpha)
);

-- Inserir grupos padrão baseados em absortância térmica
INSERT INTO color_groups (code, label, min_alpha, max_alpha, description) VALUES
  ('CLARA', 'Cores Claras', 0.00, 0.60, 'Absortância térmica baixa (α ≤ 0,60)'),
  ('MEDIA', 'Cores Médias', 0.61, 0.80, 'Absortância térmica média (0,61 ≤ α ≤ 0,80)'),
  ('ESCURA', 'Cores Escuras', 0.81, 1.00, 'Absortância térmica alta (α > 0,81)');

-- Passo 2: Renomear predominant_colors para colors
ALTER TABLE predominant_colors RENAME TO colors;

-- Passo 3: Adicionar coluna color_group_id
ALTER TABLE colors ADD COLUMN color_group_id INTEGER REFERENCES color_groups(id) ON DELETE SET NULL;

-- Passo 4: Atualizar cores existentes com seus grupos (baseado no alpha)
UPDATE colors SET color_group_id = (
  SELECT id FROM color_groups 
  WHERE colors.alpha >= color_groups.min_alpha 
    AND colors.alpha <= color_groups.max_alpha
  LIMIT 1
);

-- Passo 5: Remover colunas min_alpha e max_alpha (se existirem)
ALTER TABLE colors DROP COLUMN IF EXISTS min_alpha;
ALTER TABLE colors DROP COLUMN IF EXISTS max_alpha;

-- Passo 6: Criar índices
CREATE INDEX idx_colors_color_group_id ON colors(color_group_id);
CREATE INDEX idx_color_groups_code ON color_groups(code);

-- Passo 7: Atualizar FK em buildings (renomear predominant_color_id para color_id se necessário)
-- Nota: Mantendo predominant_color_id por enquanto para compatibilidade

-- Comentários
COMMENT ON TABLE color_groups IS 'Grupos de cores por faixa de absortância térmica';
COMMENT ON COLUMN color_groups.min_alpha IS 'Absortância térmica mínima do grupo (0-1)';
COMMENT ON COLUMN color_groups.max_alpha IS 'Absortância térmica máxima do grupo (0-1)';
COMMENT ON TABLE colors IS 'Catálogo de cores com valores de absortância térmica';
COMMENT ON COLUMN colors.color_group_id IS 'Grupo de absortância térmica ao qual a cor pertence';
