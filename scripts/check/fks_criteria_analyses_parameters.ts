import 'dotenv/config';
import pg from 'pg';
const { Client } = pg;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  const client = new Client({ connectionString: url });
  await client.connect();
  const sql = `SELECT t.relname AS table, c.conname, pg_get_constraintdef(c.oid) AS definition
               FROM pg_constraint c
               JOIN pg_class t ON t.oid = c.conrelid
               WHERE t.relname IN ('analyses','parameters')
                 AND c.conname IN ('fk_analyses_criterion','fk_parameters_analysis')
               ORDER BY t.relname, c.conname;`;
  const res = await client.query(sql);
  if (res.rows.length === 0) {
    console.log('No FK constraints found (unexpected).');
  } else {
    console.table(res.rows);
  }
  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
