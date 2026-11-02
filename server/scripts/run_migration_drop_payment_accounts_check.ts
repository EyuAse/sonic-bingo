import { pool } from '../db.ts';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('🚀 Running Phase 1 Migration: Drop payment_accounts_provider_check constraint...');

  const migrationPath = path.join(process.cwd(), 'server', 'db', 'migrations', '20261102_drop_payment_accounts_provider_check.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('📜 Executing SQL statements:');
  console.log(sql);

  await pool.query(sql);
  console.log('✅ Migration executed successfully against Neon PostgreSQL!');

  // Test inserting an account with provider = 'Bank of Abyssinia' (as in user screenshot)
  const testNumber = `TEST-BOA-${Date.now().toString().slice(-6)}`;
  console.log(`\n🧪 Testing insert of Official Account with provider="Bank of Abyssinia", account_number="${testNumber}"...`);

  const insertRes = await pool.query(`
    INSERT INTO payment_accounts (
      provider, account_title, account_name, account_number, badge, is_active, display_order, daily_limit
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8
    )
    RETURNING id, provider, account_title, account_name, account_number, is_active
  `, [
    'Bank of Abyssinia',
    'BANK OF ABYSSINIA SUPER AGENT',
    'Abyssinia Operations',
    testNumber,
    '⚡ Instant Fast Track',
    true,
    5,
    500000.00
  ]);

  const inserted = insertRes.rows[0];
  console.log('✓ Successfully inserted official account:', inserted);
  console.log('🎉 NO CONSTRAINT VIOLATION! Bank of Abyssinia is 100% accepted by Neon DB!');

  // Clean up test account
  await pool.query(`DELETE FROM payment_accounts WHERE id = $1`, [inserted.id]);
  console.log('🧹 Cleaned up test account.');

  // Check current official accounts
  const listRes = await pool.query(`SELECT id, provider, account_title, account_number, is_active FROM payment_accounts ORDER BY display_order ASC`);
  console.log('\n📋 Current Official Accounts in Neon DB:');
  listRes.rows.forEach((r, idx) => {
    console.log(`  ${idx + 1}. [${r.provider}] ${r.account_title || 'No Title'} - ${r.account_number} (Active: ${r.is_active})`);
  });

  process.exit(0);
}

main().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});

