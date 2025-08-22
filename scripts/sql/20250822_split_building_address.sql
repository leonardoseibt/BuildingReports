-- Split legacy address text into structured fields street, number, neighborhood, city, state
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS street varchar(255);
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS city varchar(128);
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS state varchar(2);

-- If legacy address column exists and street is null, attempt parse: Rua, Numero, Bairro, Cidade, UF
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id, address FROM buildings WHERE street IS NULL AND address IS NOT NULL LOOP
    BEGIN
      UPDATE buildings
      SET street = split_part(r.address, ',', 1),
          -- number already stored in address_number; keep
          neighborhood = COALESCE(neighborhood, NULLIF(split_part(r.address, ',', 3), '')),
          city = COALESCE(city, NULLIF(split_part(r.address, ',', 4), '')),
          state = COALESCE(state, NULLIF(split_part(r.address, ',', 5), ''))
      WHERE id = r.id;
    EXCEPTION WHEN others THEN
      -- ignore parse failures
      NULL;
    END;
  END LOOP;
END $$;

-- Not dropping old address column yet for rollback safety