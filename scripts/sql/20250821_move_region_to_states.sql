-- Move 'region' from cities to states
-- 1) Add column region to states
ALTER TABLE states ADD COLUMN IF NOT EXISTS region varchar(64);

-- 2) Optional: Backfill state's region from any city that has it set (first non-null per state)
WITH first_city_region AS (
  SELECT state_id, MAX(region) FILTER (WHERE region IS NOT NULL AND region <> '') AS region
  FROM cities
  GROUP BY state_id
)
UPDATE states s
SET region = COALESCE(s.region, f.region)
FROM first_city_region f
WHERE s.id = f.state_id;

-- 3) Keep city.region for now to avoid breaking existing data; front-end no longer uses it.
-- If you want to drop later, run:
-- ALTER TABLE cities DROP COLUMN region;
