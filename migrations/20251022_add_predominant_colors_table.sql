-- Criar tabela de cores predominantes
CREATE TABLE IF NOT EXISTS predominant_colors (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(64) NOT NULL UNIQUE,
  label VARCHAR(255) NOT NULL,
  absorptance_min DECIMAL(5,3),
  absorptance_max DECIMAL(5,3),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Adicionar campo de cor predominante em buildings
ALTER TABLE buildings 
ADD COLUMN IF NOT EXISTS predominant_color_id INTEGER REFERENCES predominant_colors(id);

-- Inserir cores básicas com valores de absortância térmica
-- Fonte: NBR 15220 e NBR 15575 (valores típicos)
INSERT INTO predominant_colors (code, label, absorptance_min, absorptance_max) VALUES
  ('BRANCA', 'Branca', 0.200, 0.300),
  ('AMARELA_CLARA', 'Amarela Clara', 0.300, 0.400),
  ('BEGE_CLARA', 'Bege Clara', 0.350, 0.450),
  ('CREME', 'Creme', 0.350, 0.450),
  ('VERDE_CLARA', 'Verde Clara', 0.400, 0.500),
  ('CINZA_CLARA', 'Cinza Clara', 0.400, 0.500),
  ('AMARELA', 'Amarela', 0.500, 0.600),
  ('BEGE', 'Bege', 0.500, 0.600),
  ('VERDE', 'Verde', 0.650, 0.750),
  ('CINZA', 'Cinza', 0.650, 0.750),
  ('AZUL', 'Azul', 0.700, 0.800),
  ('MARROM', 'Marrom', 0.750, 0.850),
  ('VERMELHA', 'Vermelha', 0.750, 0.850),
  ('VERDE_ESCURA', 'Verde Escura', 0.800, 0.900),
  ('CINZA_ESCURA', 'Cinza Escura', 0.800, 0.900),
  ('MARROM_ESCURA', 'Marrom Escura', 0.850, 0.950),
  ('PRETA', 'Preta', 0.900, 1.000);

COMMENT ON TABLE predominant_colors IS 'Cores predominantes das fachadas externas com valores de absortância térmica';
COMMENT ON COLUMN predominant_colors.absorptance_min IS 'Absortância térmica mínima (0-1)';
COMMENT ON COLUMN predominant_colors.absorptance_max IS 'Absortância térmica máxima (0-1)';
COMMENT ON COLUMN buildings.predominant_color_id IS 'Cor predominante das fachadas externas';
