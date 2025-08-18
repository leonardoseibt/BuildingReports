-- Add FK columns to buildings to reference master tables and backfill from existing codes
DO $$
BEGIN
  -- typology_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buildings' AND column_name = 'typology_id'
  ) THEN
    ALTER TABLE buildings
      ADD COLUMN typology_id integer NULL,
      ADD CONSTRAINT fk_buildings_typology
        FOREIGN KEY (typology_id) REFERENCES typologies(id) ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;

  -- noise_class_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buildings' AND column_name = 'noise_class_id'
  ) THEN
    ALTER TABLE buildings
      ADD COLUMN noise_class_id integer NULL,
      ADD CONSTRAINT fk_buildings_noise_class
        FOREIGN KEY (noise_class_id) REFERENCES noise_classes(id) ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;

  -- aggressiveness_class_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buildings' AND column_name = 'aggressiveness_class_id'
  ) THEN
    ALTER TABLE buildings
      ADD COLUMN aggressiveness_class_id integer NULL,
      ADD CONSTRAINT fk_buildings_aggressiveness_class
        FOREIGN KEY (aggressiveness_class_id) REFERENCES aggressiveness_classes(id) ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

-- Backfill IDs from existing code columns when possible
UPDATE buildings b
SET typology_id = t.id
FROM typologies t
WHERE b.typology_id IS NULL AND b.typology = t.code;

UPDATE buildings b
SET noise_class_id = n.id
FROM noise_classes n
WHERE b.noise_class_id IS NULL AND b.noise_class = n.code;

UPDATE buildings b
SET aggressiveness_class_id = a.id
FROM aggressiveness_classes a
WHERE b.aggressiveness_class_id IS NULL AND b.aggressiveness_class = a.code;

-- Optionally, create indexes for faster joins
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename = 'buildings' AND indexname = 'idx_buildings_typology_id'
  ) THEN
    CREATE INDEX idx_buildings_typology_id ON buildings(typology_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename = 'buildings' AND indexname = 'idx_buildings_noise_class_id'
  ) THEN
    CREATE INDEX idx_buildings_noise_class_id ON buildings(noise_class_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename = 'buildings' AND indexname = 'idx_buildings_aggressiveness_class_id'
  ) THEN
    CREATE INDEX idx_buildings_aggressiveness_class_id ON buildings(aggressiveness_class_id);
  END IF;
END $$;
