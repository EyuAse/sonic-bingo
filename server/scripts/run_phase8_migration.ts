import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { query } from '../db.ts';

dotenv.config();

async function runMigration() {
  console.log('🚀 Running Phase 8 migration on Neon PostgreSQL...');
  const migrationPath = path.join(process.cwd(), 'server', 'db', 'migrations', '20261031_phase8_agent_withdrawals_and_commissions.sql');
  const sql = fs.readFileSync(migrationPath, 'utf-8');

  await query(sql);
  console.log('✅ Phase 8 migration executed successfully on Neon DB!');
  process.exit(0);
}

runMigration().catch(err => {
  console.error('❌ Phase 8 migration failed:', err);
  process.exit(1);
});

