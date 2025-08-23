-- Using explicit transaction and runtime checks for compatibility with Postgres
-- Table creation (will error if already exists; adjust manually if needed)
CREATE TABLE constructive_systems (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(64) NOT NULL UNIQUE,
  label VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Seed initial common constructive systems
INSERT INTO constructive_systems (code, label, is_active) VALUES
  ('alv_conv', 'Alvenaria Convencional', true),
  ('alv_est', 'Alvenaria Estrutural', true),
  ('concreto_mold', 'Concreto Moldado in loco', true),
  ('concreto_prem', 'Concreto Pré-moldado', true),
  ('aco', 'Estrutura em Aço', true),
  ('madeira', 'Estrutura em Madeira', true);