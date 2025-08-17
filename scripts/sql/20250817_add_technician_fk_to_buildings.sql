DO $$
BEGIN
  -- Add technician_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buildings' AND column_name = 'technician_id'
  ) THEN
    ALTER TABLE buildings ADD COLUMN technician_id integer;
  END IF;

  -- Add foreign key constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'buildings'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'technician_id'
  ) THEN
    ALTER TABLE buildings
      ADD CONSTRAINT fk_buildings_technician
      FOREIGN KEY (technician_id)
      REFERENCES technicians(id)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;

  -- Optional backfill: link by same user and matching name (case-insensitive)
  UPDATE buildings b
  SET technician_id = t.id
  FROM technicians t
  WHERE b.technician_id IS NULL
    AND lower(b.technical_responsible) = lower(t.full_name)
    AND t.user_id = b.user_id;
END $$;
