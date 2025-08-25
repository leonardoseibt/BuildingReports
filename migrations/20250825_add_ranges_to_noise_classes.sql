-- Add range columns (idempotent pattern: each guarded separately)
DO $$ BEGIN
  ALTER TABLE noise_classes ADD COLUMN day_min_db smallint NOT NULL DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE noise_classes ADD COLUMN day_max_db smallint NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE noise_classes ADD COLUMN night_min_db smallint NOT NULL DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE noise_classes ADD COLUMN night_max_db smallint NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Constraints (skip if already exist)
DO $$ BEGIN
  ALTER TABLE noise_classes ADD CONSTRAINT chk_noise_day CHECK (day_min_db <= COALESCE(day_max_db, 32767));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE noise_classes ADD CONSTRAINT chk_noise_night CHECK (night_min_db <= COALESCE(night_max_db, 32767));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
