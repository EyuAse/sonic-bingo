import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { pool, checkDbConnection } from '../db.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runPhase5Migration() {
  console.log('🚀 [Phase 5 Migration] Connecting to Neon PostgreSQL...');
  const health = await checkDbConnection();
  if (!health.connected) {
    console.error('❌ [Phase 5 Migration] DB Connection Failed:', health.error);
    process.exit(1);
  }
  console.log(`✅ [Neon Connected] Latency: ${health.latencyMs}ms`);

  const migrationFile = path.resolve(__dirname, '../db/migrations/20261031_phase5_agent_portal.sql');
  const sqlContent = fs.readFileSync(migrationFile, 'utf-8');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sqlContent);
    await client.query('COMMIT');
    console.log('🎉 [Phase 5 Migration] Phase 5 Migration executed successfully!');
    process.exit(0);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ [Phase 5 Migration Error]:', err);
    process.exit(1);
  } finally {
    client.release();
  }
}

runPhase5Migration();
