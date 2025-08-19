-- Idempotent migration: add address_number and building_height to buildings
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='buildings' AND column_name='address_number'
    ) THEN
        ALTER TABLE buildings ADD COLUMN address_number varchar(20);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='buildings' AND column_name='building_height'
    ) THEN
        ALTER TABLE buildings ADD COLUMN building_height numeric(10,2);
    END IF;
END $$;

-- Optional helpful indexes
-- CREATE INDEX IF NOT EXISTS idx_buildings_address_number ON buildings(address_number);
