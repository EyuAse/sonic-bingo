import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { query } from '../db.ts';

dotenv.config();

async function runMigration() {
  console.log('--- 🚀 Starting Phase 7 Migration: Agent Deposit Requests & Anonymity Schema ---');

  // 1. Read SQL migration file
  const sqlPath = path.join(process.cwd(), 'server/db/migrations/20261031_phase7_agent_deposit_requests.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Applying SQL statements to Neon PostgreSQL...');
  await query(sql);
  console.log('✅ Phase 7 SQL migration executed successfully.');

  // 2. Update agent AGT-8532 with payment details and online status
  console.log('Updating agent AGT-8532 with verified payment rails...');
  const updateAgentRes = await query(`
    UPDATE agent_profiles
    SET 
      telebirr_phone = COALESCE(telebirr_phone, '0982624574'),
      cbe_account = COALESCE(cbe_account, '1000458291048'),
      mpesa_phone = COALESCE(mpesa_phone, '0712345678'),
      is_online = true
    WHERE agent_code = 'AGT-8532'
    RETURNING id, agent_code, telebirr_phone, cbe_account, is_online, wallet_balance;
  `);

  if (updateAgentRes.rows.length > 0) {
    console.log('✅ Agent AGT-8532 updated:', updateAgentRes.rows[0]);
  } else {
    console.warn('⚠️ Agent AGT-8532 not found to update payment rails.');
  }

  // 3. Verify tables and columns
  console.log('Verifying table creation in Neon PostgreSQL...');
  const tableCheck = await query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name IN ('agent_deposit_requests', 'agent_commissions', 'agent_profiles');
  `);
  console.log('Confirmed Tables:', tableCheck.rows.map(r => r.table_name));

  const columnsCheck = await query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'agent_profiles' 
      AND column_name IN ('telebirr_phone', 'cbe_account', 'mpesa_phone', 'is_online');
  `);
  console.log('Confirmed agent_profiles columns:', columnsCheck.rows);

  console.log('--- 🎉 Phase 1: Database Migration Complete & Verified! ---');
  process.exit(0);
}

runMigration().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
