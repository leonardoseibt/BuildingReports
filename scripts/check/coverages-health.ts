import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const agg = await client.query(`
      SELECT 
        COUNT(*)::int AS total,
        SUM(CASE WHEN city IS NULL THEN 1 ELSE 0 END)::int AS city_null,
        SUM(CASE WHEN COALESCE(city,'')='' THEN 1 ELSE 0 END)::int AS city_blank,
        SUM(CASE WHEN region IS NULL THEN 1 ELSE 0 END)::int AS region_null,
        SUM(CASE WHEN COALESCE(region,'')='' THEN 1 ELSE 0 END)::int AS region_blank,
        SUM(CASE WHEN radiacao_wm2 IS NULL THEN 1 ELSE 0 END)::int AS rad_null
      FROM bioclimatic_zone_coverages;
    `);
    console.log('Coverage fields health:', agg.rows[0]);

    const sample = await client.query(`
      SELECT id, state, city, region, radiacao_wm2
      FROM bioclimatic_zone_coverages
      WHERE city IS NULL OR COALESCE(city,'')='' OR region IS NULL OR COALESCE(region,'')='' OR radiacao_wm2 IS NULL
      ORDER BY id DESC
      LIMIT 10;
    `);
    if (sample.rowCount && sample.rowCount > 0) {
      console.log('Sample rows with missing values:', sample.rows);
    } else {
      console.log('No rows with missing city/region/radiacao_wm2 values.');
    }

    const nonNullCount = await client.query(`
      SELECT 
        SUM(CASE WHEN city IS NOT NULL AND city <> '' THEN 1 ELSE 0 END)::int AS city_filled,
        SUM(CASE WHEN region IS NOT NULL AND region <> '' THEN 1 ELSE 0 END)::int AS region_filled,
        SUM(CASE WHEN radiacao_wm2 IS NOT NULL THEN 1 ELSE 0 END)::int AS rad_filled
      FROM bioclimatic_zone_coverages;
    `);
    console.log('Filled counts:', nonNullCount.rows[0]);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
