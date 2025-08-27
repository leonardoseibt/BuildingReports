-- Create enums and tables for building systems if missing

-- Structural system enum
DO $$ BEGIN
  CREATE TYPE structural_system AS ENUM ('concrete','steel','masonry','wood');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- structural_systems table
CREATE TABLE IF NOT EXISTS structural_systems (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  building_id INTEGER NOT NULL,
  system_type structural_system NOT NULL,
  material_resistance NUMERIC(8,2),
  design_life INTEGER NOT NULL,
  design_loads NUMERIC(10,2),
  created_at TIMESTAMP DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE structural_systems
    ADD CONSTRAINT structural_systems_building_id_fkey
    FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_structural_systems_building ON structural_systems(building_id);

-- sealing_systems table
CREATE TABLE IF NOT EXISTS sealing_systems (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  building_id INTEGER NOT NULL,
  external_walls JSONB,
  internal_walls JSONB,
  acoustic_properties JSONB,
  thermal_properties JSONB,
  created_at TIMESTAMP DEFAULT now()
);
DO $$ BEGIN
  ALTER TABLE sealing_systems
    ADD CONSTRAINT sealing_systems_building_id_fkey
    FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_sealing_systems_building ON sealing_systems(building_id);

-- roofing_systems table
CREATE TABLE IF NOT EXISTS roofing_systems (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  building_id INTEGER NOT NULL,
  roofing_type TEXT NOT NULL,
  thermal_properties JSONB,
  waterproofing BOOLEAN DEFAULT false,
  slope NUMERIC(4,2),
  thermal_insulation JSONB,
  created_at TIMESTAMP DEFAULT now()
);
DO $$ BEGIN
  ALTER TABLE roofing_systems
    ADD CONSTRAINT roofing_systems_building_id_fkey
    FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_roofing_systems_building ON roofing_systems(building_id);
