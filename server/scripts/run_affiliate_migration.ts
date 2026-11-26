import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { pool, checkDbConnection } from '../db.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function applyAffiliateSchema() {
  console.log('🚀 [Affiliate Migration] Connecting to Neon PostgreSQL...');
  const health = await checkDbConnection();
  if (!health.connected) {
    console.error('❌ [Affiliate Migration] DB connection failed:', health.error);
    process.exit(1);
  }
  console.log(`✅ [Affiliate Migration] Connected to Neon DB (${health.latencyMs}ms)`);

  const sqlPath = path.join(__dirname, '../db/migrations/20261126_affiliate_agent_system.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('📄 [Affiliate Migration] Executing additive DDL...');
    await client.query(sql);
    await client.query('COMMIT');

    const rulesRes = await client.query(
      `SELECT commission_type, version, calc_mode, rate_or_amount, min_qualifying_deposit, min_monthly_players, is_active
       FROM affiliate_commission_rules
       ORDER BY id ASC`
    );
    const payoutRes = await client.query(`SELECT * FROM affiliate_payout_settings WHERE id = 1`);

    console.log('🎉 [Affiliate Migration] Applied cleanly. Seeded rules:', rulesRes.rows.length);
    console.table(rulesRes.rows);
    console.log('⚙️ [Payout Settings]:', payoutRes.rows[0]);
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('❌ [Affiliate Migration Error]:', err?.message || err);
    process.exit(1);
  } finally {
    client.release();
  }
}

applyAffiliateSchema().then(() => {
  console.log('🏁 [Affiliate Migration] Done.');
  process.exit(0);
});
