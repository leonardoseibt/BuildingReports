import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'buildings' 
      ORDER BY ordinal_position
    `);
    console.log('Buildings table columns:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type})`);
    });
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
