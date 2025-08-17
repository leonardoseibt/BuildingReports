import 'dotenv/config';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
const { Pool } = pg;
import fs from 'fs';
import fsPromises from 'fs/promises';

async function main() {
  // Ensure .env is loaded regardless of how the script is invoked
  if (!process.env.DATABASE_URL) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    // Try CWD, then script-relative ../.env
    dotenv.config({ path: path.resolve(process.cwd(), '.env') });
    if (!process.env.DATABASE_URL) {
      dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
    }
    // Manual fallback: parse .env for DATABASE_URL
    if (!process.env.DATABASE_URL) {
      const candidatePaths = [
        path.resolve(process.cwd(), '.env'),
        path.resolve(__dirname, '..', '.env'),
        path.resolve(__dirname, '..', '..', '.env'),
      ];
      for (const p of candidatePaths) {
        try {
          const content = await fsPromises.readFile(p, 'utf8');
          const match = content.match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/m);
          if (match) {
            process.env.DATABASE_URL = match[1].trim();
            break;
          }
        } catch (_) {
          // ignore
        }
      }
    }
  }
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
