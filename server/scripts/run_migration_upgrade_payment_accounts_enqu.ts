import { pool } from '../db.ts';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('🚀 Running Migration: Upgrade payment_accounts for Enqu Payment Accounts UI...');

  const migrationPath = path.join(process.cwd(), 'server', 'db', 'migrations', '20261107_upgrade_payment_accounts_enqu.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('📜 Executing SQL against Neon PostgreSQL...');
  await pool.query(sql);
  console.log('✅ Migration executed successfully!');

  // Verify columns
  const cols = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'payment_accounts'
    ORDER BY ordinal_position
  `);
  console.log('\n📋 Upgraded payment_accounts columns:');
  cols.rows.forEach(c => console.log(`  - ${c.column_name} (${c.data_type})`));

  // Verify accounts in DB
  const accounts = await pool.query(`
    SELECT id, provider, account_name, account_number, is_active, status, is_primary, is_verified, daily_limit, max_per_deposit
    FROM payment_accounts 
    ORDER BY display_order ASC, created_at ASC
  `);
  console.log('\n🏛️ Current Official Accounts:');
  console.table(accounts.rows);

  const audits = await pool.query(`SELECT COUNT(*) as audit_count FROM payment_account_audit_logs`);
  console.log(`\n📝 Total Audit Log Records: ${audits.rows[0].audit_count}`);

  process.exit(0);
}

main().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});

