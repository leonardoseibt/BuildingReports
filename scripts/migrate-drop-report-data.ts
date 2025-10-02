import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  console.log('🔄 Running migration: Drop report_data column...');
  
  const migrationPath = path.join(__dirname, '..', 'migrations', '20250828_drop_report_data_column.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
  
  try {
    await db.execute(sql.raw(migrationSql));
    console.log('✅ Migration completed successfully!');
    console.log('   - Removed report_data (JSONB) column from reports table');
    console.log('   - Now using relational tables exclusively');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
  
  process.exit(0);
}

runMigration();
