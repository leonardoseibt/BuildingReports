ALTER TABLE cities ADD COLUMN vento_basico_m_s numeric(5,2);
-- Optional: create index if queries will filter by this value
-- CREATE INDEX idx_cities_vento_basico_m_s ON cities(vento_basico_m_s);
