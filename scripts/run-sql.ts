import pg from 'pg';
const { Pool } = pg;
import fs from 'fs';

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: tsx scripts/run-sql.ts <file.sql>');
    process.exit(1);
  }
  const sql = fs.readFileSync(file, 'utf8');
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Migration executed successfully');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', e);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
