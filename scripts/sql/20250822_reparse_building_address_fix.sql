-- Migration: Re-parse legacy address strings to correct neighborhood/city/state misalignments
-- Problem: Some legacy rows lacked the address number in the concatenated address string (format became: Rua, Bairro, Cidade, UF)
-- Previous parsing assumed always: Rua, Número, Bairro, Cidade, UF causing an index shift.
-- This script attempts to re-derive neighborhood/city/state using heuristic detection of the numeric second token.

DO $$
DECLARE r RECORD;
DECLARE parts TEXT[];
DECLARE p1 TEXT; -- street
DECLARE p2 TEXT; -- could be number or neighborhood
DECLARE p3 TEXT;
DECLARE p4 TEXT;
DECLARE p5 TEXT;
BEGIN
  FOR r IN
    SELECT id, address, address_number, neighborhood, city, state
    FROM buildings
    WHERE address IS NOT NULL
      AND (
        (city ~ '^[A-Z]{2}$' AND (state IS NULL OR state = ''))
        OR (neighborhood = city AND NOT (city ~ '^[A-Z]{2}$'))
        OR (neighborhood IS NULL OR neighborhood = '')
      )
  LOOP
    BEGIN
      parts := regexp_split_to_array(r.address, '\s*,\s*');
      IF array_length(parts,1) IS NULL OR array_length(parts,1) < 3 THEN
        CONTINUE;
      END IF;
      p1 := parts[1];
      p2 := parts[2];
      p3 := parts[3];
      p4 := parts[4];
      p5 := parts[5];

      IF p2 ~ '^[0-9]{1,6}([A-Za-z0-9\-/]{0,4})?$' THEN
        UPDATE buildings
        SET street = COALESCE(street, NULLIF(p1,'')),
            neighborhood = NULLIF(p3,''),
            city = NULLIF(p4,''),
            state = NULLIF(p5,'')
        WHERE id = r.id;
      ELSE
        UPDATE buildings
        SET street = COALESCE(street, NULLIF(p1,'')),
            neighborhood = NULLIF(p2,''),
            city = NULLIF(p3,''),
            state = NULLIF(p4,'')
        WHERE id = r.id;
      END IF;
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END LOOP;
END $$;

-- Additional correction: If after parsing city still contains a UF (2 letters) and state is null, swap.
UPDATE buildings
SET state = city,
    city = NULL
WHERE city ~ '^[A-Z]{2}$' AND (state IS NULL OR state = '');
