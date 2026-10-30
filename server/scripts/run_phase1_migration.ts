import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { pool, checkDbConnection, query } from '../db.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runPhase1Migration() {
  console.log('🚀 [Phase 1 Migration] Connecting to Neon PostgreSQL...');
  const health = await checkDbConnection();
  if (!health.connected) {
    console.error('❌ [Phase 1 Migration] DB Connection Failed:', health.error);
    process.exit(1);
  }
  console.log(`✅ [Neon Connected] Host: ${health.databaseUrl ? health.databaseUrl.split('@')[1]?.split('/')[0] : 'connected'} (Latency: ${health.latencyMs}ms)`);

  const migrationFile = path.resolve(__dirname, '../db/migrations/20261031_phase1_enqu_upgrade.sql');
  const sqlContent = fs.readFileSync(migrationFile, 'utf-8');

  console.log('📄 [Phase 1 Migration] Executing migration statements...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(sqlContent);
    await client.query('COMMIT');
    console.log('✅ [Phase 1 Migration] All DDL statements executed successfully!');

    // Verify created tables
    const tableRes = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    const tables = tableRes.rows.map((r: any) => r.table_name);
    console.log('📊 [Total Public Tables in Neon]:', tables.length);
    console.log('📋 [Tables List]:', tables.join(', '));

    // Verify default bonus setting on wallets table
    const bonusColRes = await client.query(`
      SELECT column_default
      FROM information_schema.columns
      WHERE table_name = 'wallets' AND column_name = 'bonus';
    `);
    console.log('🎁 [wallets.bonus Column Default]:', bonusColRes.rows[0]?.column_default);

    // Verify jackpot_pool rows
    const jackpotRes = await client.query('SELECT room_id, balance, seed_amount FROM jackpot_pool ORDER BY room_id');
    console.log('🏆 [Jackpot Pools Seeded]:', jackpotRes.rows);

    // Verify admin_settings
    const settingsRes = await client.query('SELECT key, value FROM admin_settings ORDER BY key');
    console.log('⚙️ [Admin Settings Count]:', settingsRes.rows.length);

    console.log('🎉 [Phase 1 Migration] Phase 1 Database Migration is 100% COMPLETE!');
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('❌ [Phase 1 Migration Error]:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runPhase1Migration().catch((err) => {
  console.error('Fatal Phase 1 error:', err);
  process.exit(1);
});
