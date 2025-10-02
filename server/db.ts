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

export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  // Configurações otimizadas para Neon serverless
  max: 10, // Reduzido para evitar excesso de conexões
  idleTimeoutMillis: 60000, // 60s - manter conexões por mais tempo
  connectionTimeoutMillis: 10000, // 10s para estabelecer conexão
  allowExitOnIdle: false,
});

export const db = drizzle({ client: pool, schema });

// Contador de conexões para log condicional
let connectionCount = 0;
let removeCount = 0;

// Log e tratamento de erros de conexão (apenas erros, não eventos normais)
pool.on('error', (err: any) => {
  if (err?.code === 'ECONNRESET') {
    console.error('⚠️  Database connection reset (ECONNRESET). Pool will create new connection.');
  } else if (err?.code === 'ETIMEDOUT') {
    console.error('⚠️  Database connection timeout. Pool will retry.');
  } else if (err?.message?.includes('Connection terminated')) {
    console.error('⚠️  Database connection terminated unexpectedly. Pool will reconnect.');
  } else {
    console.error('❌ Database pool error:', err);
  }
});

// Log apenas a primeira conexão e periodicamente (evitar spam)
pool.on('connect', () => {
  connectionCount++;
  if (connectionCount === 1) {
    console.log('✅ Database connection pool initialized');
  } else if (connectionCount % 10 === 0) {
    console.log(`🔄 Pool stats: ${connectionCount} connections created, ${removeCount} removed`);
  }
});

pool.on('remove', () => {
  removeCount++;
});