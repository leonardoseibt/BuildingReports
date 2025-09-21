-- Idempotent migration: add default value 0.00 to building_height column
DO $$ BEGIN
    -- Set default value for building_height column
    ALTER TABLE buildings ALTER COLUMN building_height SET DEFAULT 0.00;
    
    -- Update existing NULL values to 0.00
    UPDATE buildings SET building_height = 0.00 WHERE building_height IS NULL;
EXCEPTION
    WHEN others THEN NULL; -- Ignore if already has default or other errors
END $$;

-- Add comment to describe the change
DO $$ BEGIN
    EXECUTE 'COMMENT ON COLUMN buildings.building_height IS ''Altura da edificação em metros (padrão: 0.00)''';
EXCEPTION
    WHEN others THEN NULL; -- Ignore if comment cannot be added
END $$;