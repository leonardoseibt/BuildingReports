-- Define vento_basico_m_s = 45 para todas as cidades de Mato Grosso do Sul (MS) onde ainda está NULL.
-- Execute com:  tsx scripts/run-sql.ts scripts/sql/20250827_set_wind_speed_ms.sql

UPDATE cities
SET vento_basico_m_s = 45
WHERE vento_basico_m_s IS NULL
  AND state_id IN (SELECT id FROM states WHERE code = 'MS');

-- (Opcional) Verifique quantas linhas ficaram com 45:
-- SELECT COUNT(*) FROM cities c JOIN states s ON s.id=c.state_id WHERE s.code='MS' AND c.vento_basico_m_s = 45;
