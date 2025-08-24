-- Create enums if they don't exist
DO $$ BEGIN
  CREATE TYPE performance_level AS ENUM ('minimum','intermediate','superior');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE evaluation_status AS ENUM ('pending','in_progress','completed','approved');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Create performance_evaluations table
CREATE TABLE IF NOT EXISTS performance_evaluations (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  building_id INTEGER NOT NULL,
  structural_safety performance_level,
  thermal_performance performance_level,
  acoustic_performance performance_level,
  water_tightness performance_level,
  fire_safety performance_level,
  evaluation_data JSONB,
  status evaluation_status DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- FK (wrap in block to ignore if already exists)
DO $$ BEGIN
  ALTER TABLE performance_evaluations
    ADD CONSTRAINT performance_evaluations_building_id_fkey
    FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Helpful index for lookups by building
CREATE INDEX IF NOT EXISTS idx_performance_evaluations_building ON performance_evaluations(building_id);
