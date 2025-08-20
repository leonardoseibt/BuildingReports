-- Normalize coverages: create states, cities, and reshape coverages to only (zone_id, city_id)
DO $$
BEGIN
  -- Create states table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'states'
  ) THEN
    CREATE TABLE states (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      code VARCHAR(2) NOT NULL UNIQUE,
      name VARCHAR(128) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  END IF;

  -- Seed Brazilian states (27 units)
  INSERT INTO states (code, name)
  VALUES
    ('AC','Acre'),('AL','Alagoas'),('AP','Amapá'),('AM','Amazonas'),('BA','Bahia'),
    ('CE','Ceará'),('DF','Distrito Federal'),('ES','Espírito Santo'),('GO','Goiás'),('MA','Maranhão'),
    ('MT','Mato Grosso'),('MS','Mato Grosso do Sul'),('MG','Minas Gerais'),('PA','Pará'),('PB','Paraíba'),
    ('PR','Paraná'),('PE','Pernambuco'),('PI','Piauí'),('RJ','Rio de Janeiro'),('RN','Rio Grande do Norte'),
    ('RS','Rio Grande do Sul'),('RO','Rondônia'),('RR','Roraima'),('SC','Santa Catarina'),('SP','São Paulo'),
    ('SE','Sergipe'),('TO','Tocantins')
  ON CONFLICT (code) DO NOTHING;

  -- Create cities table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'cities'
  ) THEN
    CREATE TABLE cities (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      state_id INTEGER NOT NULL REFERENCES states(id),
      name VARCHAR(128) NOT NULL,
      region VARCHAR(64),
      latitude NUMERIC(10,6),
      longitude NUMERIC(10,6),
      altitude_m NUMERIC(10,2),
      tbs_c NUMERIC(10,2),
      ur_percent NUMERIC(5,2),
      radiacao_wm2 NUMERIC(10,2),
      vento_m_s NUMERIC(10,2),
      amplitude_c NUMERIC(10,2),
      created_at TIMESTAMP DEFAULT NOW(),
      CONSTRAINT uq_city UNIQUE (state_id, name)
    );
  END IF;

  -- If old coverages has detailed columns, migrate them into cities
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bioclimatic_zone_coverages' AND column_name='state') THEN
    -- Insert cities from distinct coverages
    INSERT INTO cities (state_id, name, region, latitude, longitude, altitude_m, tbs_c, ur_percent, radiacao_wm2, vento_m_s, amplitude_c)
    SELECT s.id, c.city, c.region, c.latitude, c.longitude, c.altitude_m, c.tbs_c, c.ur_percent, c.radiacao_wm2, c.vento_m_s, c.amplitude_c
    FROM (
      SELECT DISTINCT state, city, region, latitude, longitude, altitude_m, tbs_c, ur_percent, radiacao_wm2, vento_m_s, amplitude_c
      FROM bioclimatic_zone_coverages
      WHERE city IS NOT NULL AND city <> ''
    ) c
    JOIN states s ON s.code = c.state
    ON CONFLICT (state_id, name) DO NOTHING;
  END IF;

  -- Create new coverages table shape
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'bioclimatic_zone_coverages_new'
  ) THEN
    CREATE TABLE bioclimatic_zone_coverages_new (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      zone_id INTEGER NOT NULL REFERENCES bioclimatic_zones(id),
      city_id INTEGER NOT NULL REFERENCES cities(id),
      created_at TIMESTAMP DEFAULT NOW()
    );
  END IF;

  -- Migrate associations
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bioclimatic_zone_coverages' AND column_name='state') THEN
    INSERT INTO bioclimatic_zone_coverages_new (zone_id, city_id)
    SELECT old.zone_id, ci.id
    FROM bioclimatic_zone_coverages old
    JOIN states st ON st.code = old.state
    JOIN cities ci ON ci.state_id = st.id AND ci.name = COALESCE(old.city,'')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Replace old coverages table with new one
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='bioclimatic_zone_coverages') THEN
    DROP TABLE bioclimatic_zone_coverages;
  END IF;
  ALTER TABLE bioclimatic_zone_coverages_new RENAME TO bioclimatic_zone_coverages;
END $$;
