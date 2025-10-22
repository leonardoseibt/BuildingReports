import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;
import fs from 'fs';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const file = 'migrations/20251023_add_performance_indexes.sql';
  const sql = fs.readFileSync(file, 'utf8');
  
  // Split SQL into individual statements
  const statements = sql
    .split('\n')
    .filter(line => line.trim() && !line.trim().startsWith('--'))
    .filter(line => line.trim().startsWith('CREATE INDEX'));
  
  console.log(`Found ${statements.length} CREATE INDEX statements\n`);
  
  let successful = 0;
  let failed = 0;
  
  for (const statement of statements) {
    try {
      await pool.query(statement);
      const indexName = statement.match(/idx_\w+/)?.[0] || 'unknown';
      console.log(`✅ ${indexName}`);
      successful++;
    } catch (e: any) {
      const indexName = statement.match(/idx_\w+/)?.[0] || 'unknown';
      console.error(`❌ ${indexName}: ${e.message}`);
      failed++;
    }
  }
  
  console.log(`\n📊 Summary: ${successful} successful, ${failed} failed`);
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
