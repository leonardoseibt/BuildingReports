-- Create / adjust attribute_definitions table without code/unit/description columns.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'attribute_definitions') THEN
    CREATE TABLE attribute_definitions (
      id                serial PRIMARY KEY,
      friendly_name     varchar(128) NOT NULL,
      source_table      varchar(64) NOT NULL,
      source_column     varchar(64) NOT NULL,
      data_kind         varchar(16) NOT NULL,
      value_source      varchar(64),
      value_id_field    varchar(64) DEFAULT 'id',
      value_label_field varchar(64) DEFAULT 'label',
      is_active         boolean DEFAULT true,
      created_at        timestamptz DEFAULT now(),
      updated_at        timestamptz DEFAULT now(),
      CONSTRAINT uq_attribute_def_src UNIQUE (source_table, source_column)
    );
  ELSE
    -- Table exists: drop obsolete columns if still present
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='attribute_definitions' AND column_name='code') THEN
      EXECUTE 'ALTER TABLE attribute_definitions DROP COLUMN code';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='attribute_definitions' AND column_name='description') THEN
      EXECUTE 'ALTER TABLE attribute_definitions DROP COLUMN description';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='attribute_definitions' AND column_name='unit') THEN
      EXECUTE 'ALTER TABLE attribute_definitions DROP COLUMN unit';
    END IF;
    -- Add unique constraint on (source_table, source_column) if missing
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname = 'attribute_definitions' AND c.conname = 'uq_attribute_def_src'
    ) THEN
      ALTER TABLE attribute_definitions ADD CONSTRAINT uq_attribute_def_src UNIQUE (source_table, source_column);
    END IF;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_attribute_def_kind ON attribute_definitions(data_kind);
CREATE INDEX IF NOT EXISTS idx_attribute_def_value_source ON attribute_definitions(value_source);
CREATE INDEX IF NOT EXISTS idx_attribute_def_active ON attribute_definitions(is_active);

-- Seed (idempotent) based on source_table + source_column
INSERT INTO attribute_definitions (friendly_name, source_table, source_column, data_kind, value_source)
VALUES
  ('Tipologia', 'buildings', 'typology_id', 'reference', 'typologies'),
  ('Classe de Ruído', 'buildings', 'noise_class_id', 'reference', 'noise_classes'),
  ('Classe de Agressividade', 'buildings', 'aggressiveness_class_id', 'reference', 'aggressiveness_classes'),
  ('Zona Bioclimática Código', 'buildings', 'bioclimatic_zone_code', 'reference', 'bioclimatic_zones'),
  ('Isopleta Código', 'buildings', 'isopleth_code', 'reference', 'isopleths'),
  ('Altura da Edificação', 'buildings', 'building_height', 'numeric', NULL)
ON CONFLICT (source_table, source_column) DO NOTHING;