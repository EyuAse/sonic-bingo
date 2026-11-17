import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { pool, checkDbConnection } from '../db.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function applyKenoSchema() {
  console.log('🚀 [Keno Migration] Connecting to Neon PostgreSQL...');
  const health = await checkDbConnection();
  if (!health.connected) {
    console.error('❌ [Keno Migration] DB connection failed:', health.error);
    process.exit(1);
  }
  console.log(`✅ [Keno Migration] Connected to Neon DB. Latency: ${health.latencyMs}ms`);

  const sqlPath = path.join(__dirname, '../db/migrations/20261117_production_keno_schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('📄 [Keno Migration] Executing 100% additive DDL (keno_rounds, keno_tickets)...');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('🎉 [Keno Migration] Success! keno_rounds and keno_tickets created successfully.');
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('❌ [Keno Migration Error]:', err?.message || err);
    process.exit(1);
  } finally {
    client.release();
  }
}

applyKenoSchema().then(() => {
  console.log('🏁 [Keno Migration] Done.');
  process.exit(0);
});

