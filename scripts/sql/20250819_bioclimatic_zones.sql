-- Create bioclimatic zones and coverages tables (idempotent)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name='bioclimatic_zones'
    ) THEN
        CREATE TABLE bioclimatic_zones (
            id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            code varchar(8) UNIQUE NOT NULL,
            label varchar(255) NOT NULL,
            is_active boolean DEFAULT true,
            created_at timestamp DEFAULT now(),
            updated_at timestamp DEFAULT now()
        );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name='bioclimatic_zone_coverages'
    ) THEN
        CREATE TABLE bioclimatic_zone_coverages (
            id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            zone_id integer NOT NULL REFERENCES bioclimatic_zones(id),
            state varchar(2) NOT NULL,
            city varchar(128),
            created_at timestamp DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_bzc_zone_id ON bioclimatic_zone_coverages(zone_id);
        CREATE INDEX IF NOT EXISTS idx_bzc_state_city ON bioclimatic_zone_coverages(state, city);
    END IF;
END $$;
