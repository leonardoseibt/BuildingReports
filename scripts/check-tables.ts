import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;

async function checkTable(tableName: string) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const result = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = $1 
      ORDER BY ordinal_position
    `, [tableName]);
    console.log(`\n${tableName}:`, result.rows.map(r => r.column_name).join(', '));
  } finally {
    await pool.end();
  }
}

Promise.all([
  checkTable('reports'),
  checkTable('bioclimatic_zone_coverages'),
  checkTable('parameters'),
  checkTable('criteria')
]).catch(console.error);
