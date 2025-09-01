import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });

// Log graceful on connection resets (ECONNRESET) so we can investigate
pool.on('error', (err: any) => {
  if (err?.code === 'ECONNRESET') {
    console.error('Database connection reset (ECONNRESET). Pool will attempt reuse.');
  } else {
    console.error('Database pool error:', err);
  }
});