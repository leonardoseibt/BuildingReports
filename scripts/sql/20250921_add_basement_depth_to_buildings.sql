-- Idempotent migration: add basement_depth to buildings table
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='buildings' AND column_name='basement_depth'
    ) THEN
        ALTER TABLE buildings ADD COLUMN basement_depth numeric(10,2) DEFAULT 0.00;
    END IF;
END $$;

-- Add comment to describe the column
DO $$ BEGIN
    EXECUTE 'COMMENT ON COLUMN buildings.basement_depth IS ''Profundidade do subsolo em metros''';
EXCEPTION
    WHEN others THEN NULL; -- Ignore if comment cannot be added
END $$;