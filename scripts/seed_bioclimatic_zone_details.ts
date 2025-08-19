import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;

// Import the TS source with details
import { BIOCLIMATIC_ZONES } from '../client/src/lib/bioclimatic-zones.ts';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const [code, info] of Object.entries(BIOCLIMATIC_ZONES)) {
      await client.query(
        `UPDATE bioclimatic_zones
         SET characteristics = $1::jsonb,
             recommendations = $2::jsonb,
             thermal_limits = $3::jsonb,
             design_strategies = $4::jsonb,
             updated_at = now()
         WHERE code = $5`,
        [JSON.stringify(info.characteristics), JSON.stringify(info.recommendations), JSON.stringify(info.thermalLimits), JSON.stringify(info.designStrategies), code]
      );
    }
    await client.query('COMMIT');
    console.log('Bioclimatic zone details seeded successfully');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', e);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
