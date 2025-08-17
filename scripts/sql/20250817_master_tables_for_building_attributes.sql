-- Create master tables for typologies, noise classes, and aggressiveness classes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'typologies'
  ) THEN
    CREATE TABLE typologies (
      id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      code varchar(64) UNIQUE NOT NULL,
      label varchar(255) NOT NULL,
      is_active boolean DEFAULT true,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'noise_classes'
  ) THEN
    CREATE TABLE noise_classes (
      id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      code varchar(64) UNIQUE NOT NULL,
      label varchar(255) NOT NULL,
      is_active boolean DEFAULT true,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'aggressiveness_classes'
  ) THEN
    CREATE TABLE aggressiveness_classes (
      id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      code varchar(64) UNIQUE NOT NULL,
      label varchar(255) NOT NULL,
      is_active boolean DEFAULT true,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    );
  END IF;
END $$;

-- Seed defaults if empty
INSERT INTO typologies (code, label)
SELECT v.code, v.label
FROM (VALUES
  ('unifamiliar','Unifamiliar'),
  ('multifamiliar','Multifamiliar'),
  ('comercial','Comercial'),
  ('institucional','Institucional')
) AS v(code,label)
WHERE NOT EXISTS (SELECT 1 FROM typologies);

INSERT INTO noise_classes (code, label)
SELECT v.code, v.label
FROM (VALUES
  ('classe1','Classe 1'),
  ('classe2','Classe 2'),
  ('classe3','Classe 3'),
  ('classe4','Classe 4')
) AS v(code,label)
WHERE NOT EXISTS (SELECT 1 FROM noise_classes);

INSERT INTO aggressiveness_classes (code, label)
SELECT v.code, v.label
FROM (VALUES
  ('caa1','CAA 1'),
  ('caa2','CAA 2'),
  ('caa3','CAA 3'),
  ('caa4','CAA 4')
) AS v(code,label)
WHERE NOT EXISTS (SELECT 1 FROM aggressiveness_classes);
