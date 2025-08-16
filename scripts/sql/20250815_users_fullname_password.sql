-- 1) Add new columns if not exist
ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS password_hash varchar;

-- 2) Backfill full_name from first/last if needed
UPDATE users
SET full_name = COALESCE(NULLIF(full_name, ''), TRIM(BOTH FROM CONCAT_WS(' ', NULLIF(first_name, ''), NULLIF(last_name, ''))))
WHERE full_name IS NULL OR full_name = '';

-- 3) Set NOT NULL on full_name after backfill
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'full_name'
    ) THEN
        BEGIN
            ALTER TABLE users ALTER COLUMN full_name SET NOT NULL;
        EXCEPTION WHEN others THEN
            -- ignore if already not null
            NULL;
        END;
    END IF;
END $$;

-- 4) Drop legacy columns if they exist
ALTER TABLE IF EXISTS users
  DROP COLUMN IF EXISTS first_name,
  DROP COLUMN IF EXISTS last_name,
  DROP COLUMN IF EXISTS profile_image_url;
