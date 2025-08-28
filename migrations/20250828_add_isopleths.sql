-- Simplified migration without DO block for environments that don't support PostgreSQL procedural syntax
CREATE TABLE IF NOT EXISTS isopleths (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  code VARCHAR(16) NOT NULL UNIQUE,
  label VARCHAR(255) NOT NULL,
  wind_min_m_s NUMERIC(6,2),
  wind_max_m_s NUMERIC(6,2),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);