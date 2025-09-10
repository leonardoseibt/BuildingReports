-- Merge day/night ranges into single range columns
DO $$ BEGIN
  ALTER TABLE noise_classes ADD COLUMN min_db smallint NOT NULL DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE noise_classes ADD COLUMN max_db smallint NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='noise_classes' AND column_name='day_min_db'
  ) THEN
    UPDATE noise_classes SET
      min_db = LEAST(day_min_db, night_min_db),
      max_db = CASE
        WHEN day_max_db IS NULL AND night_max_db IS NULL THEN NULL
        WHEN day_max_db IS NULL THEN night_max_db
        WHEN night_max_db IS NULL THEN day_max_db
        ELSE GREATEST(day_max_db, night_max_db)
      END;
  END IF;
END $$;

DO $$ BEGIN ALTER TABLE noise_classes DROP CONSTRAINT IF EXISTS chk_noise_day; END $$;
DO $$ BEGIN ALTER TABLE noise_classes DROP CONSTRAINT IF EXISTS chk_noise_night; END $$;

DO $$ BEGIN ALTER TABLE noise_classes DROP COLUMN IF EXISTS day_min_db; END $$;
DO $$ BEGIN ALTER TABLE noise_classes DROP COLUMN IF EXISTS day_max_db; END $$;
DO $$ BEGIN ALTER TABLE noise_classes DROP COLUMN IF EXISTS night_min_db; END $$;
DO $$ BEGIN ALTER TABLE noise_classes DROP COLUMN IF EXISTS night_max_db; END $$;

DO $$ BEGIN
  ALTER TABLE noise_classes ADD CONSTRAINT chk_noise_range CHECK (min_db <= COALESCE(max_db, 32767));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
