-- Seed UF-wide coverages for bioclimatic zones based on prior server mapping
-- Each UF gets a coverage (city NULL) pointing to the mapped zone
WITH mapping(state, code) AS (
  VALUES
    ('AC','ZB8'),
    ('AL','ZB8'),
    ('AP','ZB8'),
    ('AM','ZB8'),
    ('BA','ZB8'),
    ('CE','ZB8'),
    ('DF','ZB4'),
    ('ES','ZB8'),
    ('GO','ZB6'),
    ('MA','ZB8'),
    ('MT','ZB7'),
    ('MS','ZB6'),
    ('MG','ZB3'),
    ('PA','ZB8'),
    ('PB','ZB8'),
    ('PR','ZB2'),
    ('PE','ZB8'),
    ('PI','ZB7'),
    ('RJ','ZB8'),
    ('RN','ZB8'),
    ('RS','ZB2'),
    ('RO','ZB8'),
    ('RR','ZB8'),
    ('SC','ZB2'),
    ('SP','ZB3'),
    ('SE','ZB8'),
    ('TO','ZB7')
)
INSERT INTO bioclimatic_zone_coverages (zone_id, state, city)
SELECT z.id, m.state, NULL
FROM mapping m
JOIN bioclimatic_zones z ON z.code = m.code
WHERE NOT EXISTS (
  SELECT 1 FROM bioclimatic_zone_coverages c
  WHERE c.state = m.state AND c.city IS NULL
);
