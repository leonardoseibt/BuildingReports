-- Idempotent migration adding missing FKs on buildings optional master references
DO $$
DECLARE v_exists BOOLEAN; BEGIN
  -- typology
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
    WHERE c.conname = 'fk_buildings_typology' AND t.relname = 'buildings'
  ) INTO v_exists;
  IF NOT v_exists THEN
    EXECUTE 'ALTER TABLE buildings ADD CONSTRAINT fk_buildings_typology FOREIGN KEY (typology_id) REFERENCES typologies(id) ON UPDATE CASCADE ON DELETE RESTRICT';
  END IF;
  -- noise class
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
    WHERE c.conname = 'fk_buildings_noise_class' AND t.relname = 'buildings'
  ) INTO v_exists;
  IF NOT v_exists THEN
    EXECUTE 'ALTER TABLE buildings ADD CONSTRAINT fk_buildings_noise_class FOREIGN KEY (noise_class_id) REFERENCES noise_classes(id) ON UPDATE CASCADE ON DELETE RESTRICT';
  END IF;
  -- aggressiveness class
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
    WHERE c.conname = 'fk_buildings_aggressiveness_class' AND t.relname = 'buildings'
  ) INTO v_exists;
  IF NOT v_exists THEN
    EXECUTE 'ALTER TABLE buildings ADD CONSTRAINT fk_buildings_aggressiveness_class FOREIGN KEY (aggressiveness_class_id) REFERENCES aggressiveness_classes(id) ON UPDATE CASCADE ON DELETE RESTRICT';
  END IF;
END $$ LANGUAGE plpgsql;
