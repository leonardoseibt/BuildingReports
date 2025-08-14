-- Safe migration from varchar/uuid ids to integer identity ids in PostgreSQL
-- Assumptions: tables had `id` varchar/uuid; FKs reference them. We'll:
-- 1) Add new int identity columns
-- 2) Backfill using row_number() over stable order
-- 3) Swap PKs and update FKs
-- 4) Drop old columns

-- USERS: add int column, sequence, backfill, swap
-- First, drop FKs that currently reference users(id) so we can drop/replace the PK
ALTER TABLE IF EXISTS buildings DROP CONSTRAINT IF EXISTS buildings_user_id_users_id_fk;
ALTER TABLE IF EXISTS technicians DROP CONSTRAINT IF EXISTS technicians_user_id_users_id_fk;

ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS id_int integer;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'users_id_int_seq') THEN
    CREATE SEQUENCE users_id_int_seq OWNED BY users.id_int;
  END IF;
END $$;
UPDATE users SET id_int = nextval('users_id_int_seq') WHERE id_int IS NULL;
ALTER TABLE users ALTER COLUMN id_int SET DEFAULT nextval('users_id_int_seq');
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE users RENAME COLUMN id TO id_old;
ALTER TABLE users RENAME COLUMN id_int TO id;
ALTER TABLE users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
ALTER TABLE users DROP COLUMN IF EXISTS id_old;

-- TECHNICIANS: add columns, backfill FKs, swap
ALTER TABLE IF EXISTS technicians ADD COLUMN IF NOT EXISTS id_int integer;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'technicians_id_int_seq') THEN
    CREATE SEQUENCE technicians_id_int_seq OWNED BY technicians.id_int;
  END IF;
END $$;
UPDATE technicians SET id_int = nextval('technicians_id_int_seq') WHERE id_int IS NULL;
ALTER TABLE technicians ALTER COLUMN id_int SET DEFAULT nextval('technicians_id_int_seq');
ALTER TABLE IF EXISTS technicians ADD COLUMN IF NOT EXISTS user_id_int integer;
UPDATE technicians t SET user_id_int = u.id FROM users u WHERE t.user_id::text = u.id::text;
ALTER TABLE technicians DROP CONSTRAINT IF EXISTS technicians_pkey;
ALTER TABLE technicians RENAME COLUMN id TO id_old;
ALTER TABLE technicians RENAME COLUMN id_int TO id;
ALTER TABLE technicians ADD CONSTRAINT technicians_pkey PRIMARY KEY (id);
ALTER TABLE technicians DROP CONSTRAINT IF EXISTS technicians_user_id_fkey;
ALTER TABLE technicians DROP COLUMN IF EXISTS user_id;
ALTER TABLE technicians RENAME COLUMN user_id_int TO user_id;
ALTER TABLE technicians ADD CONSTRAINT technicians_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- BUILDINGS
-- Drop dependents referencing buildings(id) so we can replace its PK
ALTER TABLE IF EXISTS structural_systems DROP CONSTRAINT IF EXISTS structural_systems_building_id_buildings_id_fk;
ALTER TABLE IF EXISTS sealing_systems DROP CONSTRAINT IF EXISTS sealing_systems_building_id_buildings_id_fk;
ALTER TABLE IF EXISTS roofing_systems DROP CONSTRAINT IF EXISTS roofing_systems_building_id_buildings_id_fk;
ALTER TABLE IF EXISTS performance_evaluations DROP CONSTRAINT IF EXISTS performance_evaluations_building_id_buildings_id_fk;
ALTER TABLE IF EXISTS reports DROP CONSTRAINT IF EXISTS reports_building_id_buildings_id_fk;

ALTER TABLE IF EXISTS buildings ADD COLUMN IF NOT EXISTS id_int integer;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'buildings_id_int_seq') THEN
    CREATE SEQUENCE buildings_id_int_seq OWNED BY buildings.id_int;
  END IF;
END $$;
UPDATE buildings SET id_int = nextval('buildings_id_int_seq') WHERE id_int IS NULL;
ALTER TABLE buildings ALTER COLUMN id_int SET DEFAULT nextval('buildings_id_int_seq');
ALTER TABLE IF EXISTS buildings ADD COLUMN IF NOT EXISTS user_id_int integer;
UPDATE buildings b SET user_id_int = u.id FROM users u WHERE b.user_id::text = u.id::text;
ALTER TABLE buildings DROP CONSTRAINT IF EXISTS buildings_pkey;
ALTER TABLE buildings RENAME COLUMN id TO id_old;
ALTER TABLE buildings RENAME COLUMN id_int TO id;
ALTER TABLE buildings ADD CONSTRAINT buildings_pkey PRIMARY KEY (id);
ALTER TABLE buildings DROP CONSTRAINT IF EXISTS buildings_user_id_fkey;
ALTER TABLE buildings DROP COLUMN IF EXISTS user_id;
ALTER TABLE buildings RENAME COLUMN user_id_int TO user_id;
ALTER TABLE buildings ADD CONSTRAINT buildings_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- STRUCTURAL SYSTEMS
ALTER TABLE IF EXISTS structural_systems ADD COLUMN IF NOT EXISTS id_int integer;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'structural_systems_id_int_seq') THEN
    CREATE SEQUENCE structural_systems_id_int_seq OWNED BY structural_systems.id_int;
  END IF;
END $$;
UPDATE structural_systems SET id_int = nextval('structural_systems_id_int_seq') WHERE id_int IS NULL;
ALTER TABLE structural_systems ALTER COLUMN id_int SET DEFAULT nextval('structural_systems_id_int_seq');
ALTER TABLE IF EXISTS structural_systems ADD COLUMN IF NOT EXISTS building_id_int integer;
UPDATE structural_systems s SET building_id_int = b.id FROM buildings b WHERE s.building_id::text = b.id::text;
ALTER TABLE structural_systems DROP CONSTRAINT IF EXISTS structural_systems_pkey;
ALTER TABLE structural_systems RENAME COLUMN id TO id_old;
ALTER TABLE structural_systems RENAME COLUMN id_int TO id;
ALTER TABLE structural_systems ADD CONSTRAINT structural_systems_pkey PRIMARY KEY (id);
ALTER TABLE structural_systems DROP CONSTRAINT IF EXISTS structural_systems_building_id_fkey;
ALTER TABLE structural_systems DROP COLUMN IF EXISTS building_id;
ALTER TABLE structural_systems RENAME COLUMN building_id_int TO building_id;
ALTER TABLE structural_systems ADD CONSTRAINT structural_systems_building_id_fkey FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE;

-- SEALING SYSTEMS
ALTER TABLE IF EXISTS sealing_systems ADD COLUMN IF NOT EXISTS id_int integer;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'sealing_systems_id_int_seq') THEN
    CREATE SEQUENCE sealing_systems_id_int_seq OWNED BY sealing_systems.id_int;
  END IF;
END $$;
UPDATE sealing_systems SET id_int = nextval('sealing_systems_id_int_seq') WHERE id_int IS NULL;
ALTER TABLE sealing_systems ALTER COLUMN id_int SET DEFAULT nextval('sealing_systems_id_int_seq');
ALTER TABLE IF EXISTS sealing_systems ADD COLUMN IF NOT EXISTS building_id_int integer;
UPDATE sealing_systems s SET building_id_int = b.id FROM buildings b WHERE s.building_id::text = b.id::text;
ALTER TABLE sealing_systems DROP CONSTRAINT IF EXISTS sealing_systems_pkey;
ALTER TABLE sealing_systems RENAME COLUMN id TO id_old;
ALTER TABLE sealing_systems RENAME COLUMN id_int TO id;
ALTER TABLE sealing_systems ADD CONSTRAINT sealing_systems_pkey PRIMARY KEY (id);
ALTER TABLE sealing_systems DROP CONSTRAINT IF EXISTS sealing_systems_building_id_fkey;
ALTER TABLE sealing_systems DROP COLUMN IF EXISTS building_id;
ALTER TABLE sealing_systems RENAME COLUMN building_id_int TO building_id;
ALTER TABLE sealing_systems ADD CONSTRAINT sealing_systems_building_id_fkey FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE;

-- ROOFING SYSTEMS
ALTER TABLE IF EXISTS roofing_systems ADD COLUMN IF NOT EXISTS id_int integer;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'roofing_systems_id_int_seq') THEN
    CREATE SEQUENCE roofing_systems_id_int_seq OWNED BY roofing_systems.id_int;
  END IF;
END $$;
UPDATE roofing_systems SET id_int = nextval('roofing_systems_id_int_seq') WHERE id_int IS NULL;
ALTER TABLE roofing_systems ALTER COLUMN id_int SET DEFAULT nextval('roofing_systems_id_int_seq');
ALTER TABLE IF EXISTS roofing_systems ADD COLUMN IF NOT EXISTS building_id_int integer;
UPDATE roofing_systems s SET building_id_int = b.id FROM buildings b WHERE s.building_id::text = b.id::text;
ALTER TABLE roofing_systems DROP CONSTRAINT IF EXISTS roofing_systems_pkey;
ALTER TABLE roofing_systems RENAME COLUMN id TO id_old;
ALTER TABLE roofing_systems RENAME COLUMN id_int TO id;
ALTER TABLE roofing_systems ADD CONSTRAINT roofing_systems_pkey PRIMARY KEY (id);
ALTER TABLE roofing_systems DROP CONSTRAINT IF EXISTS roofing_systems_building_id_fkey;
ALTER TABLE roofing_systems DROP COLUMN IF EXISTS building_id;
ALTER TABLE roofing_systems RENAME COLUMN building_id_int TO building_id;
ALTER TABLE roofing_systems ADD CONSTRAINT roofing_systems_building_id_fkey FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE;

-- PERFORMANCE EVALUATIONS
ALTER TABLE IF EXISTS reports DROP CONSTRAINT IF EXISTS reports_evaluation_id_performance_evaluations_id_fk;
ALTER TABLE IF EXISTS performance_evaluations ADD COLUMN IF NOT EXISTS id_int integer;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'performance_evaluations_id_int_seq') THEN
    CREATE SEQUENCE performance_evaluations_id_int_seq OWNED BY performance_evaluations.id_int;
  END IF;
END $$;
UPDATE performance_evaluations SET id_int = nextval('performance_evaluations_id_int_seq') WHERE id_int IS NULL;
ALTER TABLE performance_evaluations ALTER COLUMN id_int SET DEFAULT nextval('performance_evaluations_id_int_seq');
ALTER TABLE IF EXISTS performance_evaluations ADD COLUMN IF NOT EXISTS building_id_int integer;
UPDATE performance_evaluations e SET building_id_int = b.id FROM buildings b WHERE e.building_id::text = b.id::text;
ALTER TABLE performance_evaluations DROP CONSTRAINT IF EXISTS performance_evaluations_pkey;
ALTER TABLE performance_evaluations RENAME COLUMN id TO id_old;
ALTER TABLE performance_evaluations RENAME COLUMN id_int TO id;
ALTER TABLE performance_evaluations ADD CONSTRAINT performance_evaluations_pkey PRIMARY KEY (id);
ALTER TABLE performance_evaluations DROP CONSTRAINT IF EXISTS performance_evaluations_building_id_fkey;
ALTER TABLE performance_evaluations DROP COLUMN IF EXISTS building_id;
ALTER TABLE performance_evaluations RENAME COLUMN building_id_int TO building_id;
ALTER TABLE performance_evaluations ADD CONSTRAINT performance_evaluations_building_id_fkey FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE;

-- REPORTS
ALTER TABLE IF EXISTS reports ADD COLUMN IF NOT EXISTS id_int integer;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'reports_id_int_seq') THEN
    CREATE SEQUENCE reports_id_int_seq OWNED BY reports.id_int;
  END IF;
END $$;
UPDATE reports SET id_int = nextval('reports_id_int_seq') WHERE id_int IS NULL;
ALTER TABLE reports ALTER COLUMN id_int SET DEFAULT nextval('reports_id_int_seq');
ALTER TABLE IF EXISTS reports ADD COLUMN IF NOT EXISTS building_id_int integer;
ALTER TABLE IF EXISTS reports ADD COLUMN IF NOT EXISTS evaluation_id_int integer;
UPDATE reports r SET building_id_int = b.id FROM buildings b WHERE r.building_id::text = b.id::text;
UPDATE reports r SET evaluation_id_int = e.id FROM performance_evaluations e WHERE r.evaluation_id::text = e.id::text;
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_pkey;
ALTER TABLE reports RENAME COLUMN id TO id_old;
ALTER TABLE reports RENAME COLUMN id_int TO id;
ALTER TABLE reports ADD CONSTRAINT reports_pkey PRIMARY KEY (id);
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_building_id_fkey;
ALTER TABLE reports DROP COLUMN IF EXISTS building_id;
ALTER TABLE reports RENAME COLUMN building_id_int TO building_id;
ALTER TABLE reports ADD CONSTRAINT reports_building_id_fkey FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE;
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_evaluation_id_fkey;
ALTER TABLE reports DROP COLUMN IF EXISTS evaluation_id;
ALTER TABLE reports RENAME COLUMN evaluation_id_int TO evaluation_id;
ALTER TABLE reports ADD CONSTRAINT reports_evaluation_id_fkey FOREIGN KEY (evaluation_id) REFERENCES performance_evaluations(id) ON DELETE CASCADE;
