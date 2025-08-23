-- Create requirements table
CREATE TABLE requirements (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(16) NOT NULL UNIQUE,
  label VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Seed initial requirement categories
INSERT INTO requirements (code, label, is_active) VALUES
 ('1', 'Gerais', true),
 ('2', 'Sistemas Estruturais', true),
 ('3', 'Sistemas de Piso', true),
 ('4', 'Sistemas de Vedações Verticais', true),
 ('5', 'Sistemas de Coberturas', true),
 ('6', 'Sistemas Hidrossanitários', true);