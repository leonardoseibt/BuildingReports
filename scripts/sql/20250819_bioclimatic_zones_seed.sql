-- Seed default ZB1..ZB8 zones if table is empty
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM bioclimatic_zones) THEN
    INSERT INTO bioclimatic_zones (code, label, is_active)
    VALUES
      ('ZB1', 'Zona Bioclimática 1 - Clima Frio', true),
      ('ZB2', 'Zona Bioclimática 2 - Clima Temperado', true),
      ('ZB3', 'Zona Bioclimática 3 - Clima Ameno', true),
      ('ZB4', 'Zona Bioclimática 4 - Clima Quente e Seco', true),
      ('ZB5', 'Zona Bioclimática 5 - Clima Quente e Úmido', true),
      ('ZB6', 'Zona Bioclimática 6 - Clima Quente e Seco', true),
      ('ZB7', 'Zona Bioclimática 7 - Clima Quente e Seco', true),
      ('ZB8', 'Zona Bioclimática 8 - Clima Quente e Úmido', true);
  END IF;
END $$;
