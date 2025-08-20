BEGIN;
TRUNCATE TABLE bioclimatic_zone_coverages RESTART IDENTITY CASCADE;
TRUNCATE TABLE bioclimatic_zones RESTART IDENTITY CASCADE;

INSERT INTO bioclimatic_zones (code, label, is_active)
VALUES
  ('1R', 'Muito fria com inverno rigoroso', true),
  ('1M', 'Muito fria com inverno moderado', true),
  ('2R', 'Fria com inverno rigoroso', true),
  ('2M', 'Fria com inverno moderado', true),
  ('3A', 'Mista e úmida', true),
  ('3B', 'Mista e seca', true),
  ('4A', 'Levemente quente e úmida', true),
  ('4B', 'Levemente quente e seca', true),
  ('5A', 'Quente e úmida', true),
  ('5B', 'Quente e seca', true),
  ('6A', 'Muito quente e úmida', true),
  ('6B', 'Muito quente e seca', true);
COMMIT;
