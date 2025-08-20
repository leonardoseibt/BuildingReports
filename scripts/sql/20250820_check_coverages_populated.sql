SELECT 
  COUNT(*) AS total,
  SUM(CASE WHEN city IS NULL THEN 1 ELSE 0 END) AS city_null,
  SUM(CASE WHEN COALESCE(city,'')='' THEN 1 ELSE 0 END) AS city_blank,
  SUM(CASE WHEN region IS NULL THEN 1 ELSE 0 END) AS region_null,
  SUM(CASE WHEN COALESCE(region,'')='' THEN 1 ELSE 0 END) AS region_blank,
  SUM(CASE WHEN radiacao_wm2 IS NULL THEN 1 ELSE 0 END) AS rad_null
FROM bioclimatic_zone_coverages;

-- Sample rows with missing values
SELECT id, state, city, region, radiacao_wm2
FROM bioclimatic_zone_coverages
WHERE city IS NULL OR COALESCE(city,'')='' OR region IS NULL OR COALESCE(region,'')='' OR radiacao_wm2 IS NULL
ORDER BY id DESC
LIMIT 20;
