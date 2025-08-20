-- Extend bioclimatic_zone_coverages with metadata columns (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bioclimatic_zone_coverages' AND column_name='region') THEN
    ALTER TABLE bioclimatic_zone_coverages ADD COLUMN region varchar(64);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bioclimatic_zone_coverages' AND column_name='latitude') THEN
    ALTER TABLE bioclimatic_zone_coverages ADD COLUMN latitude numeric(10,6);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bioclimatic_zone_coverages' AND column_name='longitude') THEN
    ALTER TABLE bioclimatic_zone_coverages ADD COLUMN longitude numeric(10,6);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bioclimatic_zone_coverages' AND column_name='altitude_m') THEN
    ALTER TABLE bioclimatic_zone_coverages ADD COLUMN altitude_m numeric(10,2);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bioclimatic_zone_coverages' AND column_name='tbs_c') THEN
    ALTER TABLE bioclimatic_zone_coverages ADD COLUMN tbs_c numeric(10,2);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bioclimatic_zone_coverages' AND column_name='ur_percent') THEN
    ALTER TABLE bioclimatic_zone_coverages ADD COLUMN ur_percent numeric(5,2);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bioclimatic_zone_coverages' AND column_name='radiacao_wm2') THEN
    ALTER TABLE bioclimatic_zone_coverages ADD COLUMN radiacao_wm2 numeric(10,2);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bioclimatic_zone_coverages' AND column_name='vento_m_s') THEN
    ALTER TABLE bioclimatic_zone_coverages ADD COLUMN vento_m_s numeric(10,2);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bioclimatic_zone_coverages' AND column_name='amplitude_c') THEN
    ALTER TABLE bioclimatic_zone_coverages ADD COLUMN amplitude_c numeric(10,2);
  END IF;
END $$;
