import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { pool, checkDbConnection } from '../db.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function applyUsersPublicIdMigration() {
  console.log('🚀 [Public ID Migration] Connecting to Neon PostgreSQL...');
  const health = await checkDbConnection();
  if (!health.connected) {
    console.error('❌ [Public ID Migration] DB connection failed:', health.error);
    process.exit(1);
  }

  const sqlPath = path.join(__dirname, '../db/migrations/20261125_add_users_public_id.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    const verifyRes = await client.query<{ total: string; with_id: string }>(
      `SELECT COUNT(*)::text AS total, COUNT(public_id)::text AS with_id FROM users`
    );
    await client.query('COMMIT');
    console.log('✅ [Public ID Migration] Complete:', verifyRes.rows[0]);
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('❌ [Public ID Migration Error]:', err?.message || err);
    process.exit(1);
  } finally {
    client.release();
  }
}

applyUsersPublicIdMigration().then(() => process.exit(0));
