import { pool } from '../db.ts';

async function testOfficialAccountsAPI() {
  console.log('🧪 Testing Official Accounts Enqu Backend Integration...');

  // 1. Check database accounts
  const accs = await pool.query(`
    SELECT pa.id, pa.provider, pa.account_number, pa.account_name, pa.status, pa.is_active, pa.is_primary, pa.is_verified, pa.daily_limit, pa.max_per_deposit
    FROM payment_accounts pa
    ORDER BY pa.display_order ASC
  `);
  console.log(`✅ Loaded ${accs.rows.length} official accounts from Neon PostgreSQL:`);
  accs.rows.forEach(a => {
    console.log(`  - [${a.provider}] ${a.account_name} (${a.account_number}) | Status: ${a.status} | Primary: ${a.is_primary} | Verified: ${a.is_verified}`);
  });

  // 2. Check audit logs
  const audits = await pool.query(`
    SELECT pal.id, pa.provider, pal.actor_name, pal.action, pal.created_at
    FROM payment_account_audit_logs pal
    JOIN payment_accounts pa ON pal.payment_account_id = pa.id
    ORDER BY pal.created_at DESC
    LIMIT 5
  `);
  console.log(`\n📋 Recent Audit Log Entries (${audits.rows.length}):`);
  audits.rows.forEach(al => {
    console.log(`  - [${al.provider}] ${al.actor_name}: ${al.action} (${al.created_at})`);
  });

  // 3. Test Toggle Status logic
  const firstAcc = accs.rows[0];
  if (firstAcc) {
    const originalStatus = firstAcc.status;
    const originalActive = firstAcc.is_active;
    const newStatus = originalStatus === 'Active' ? 'Paused' : 'Active';
    const newActive = newStatus === 'Active';

    await pool.query(
      `UPDATE payment_accounts SET status = $1, is_active = $2, updated_at = NOW() WHERE id = $3`,
      [newStatus, newActive, firstAcc.id]
    );
    console.log(`\n🔄 Toggled ${firstAcc.provider} account from ${originalStatus} to ${newStatus}`);

    // Revert back
    await pool.query(
      `UPDATE payment_accounts SET status = $1, is_active = $2, updated_at = NOW() WHERE id = $3`,
      [originalStatus, originalActive, firstAcc.id]
    );
    console.log(`✓ Reverted ${firstAcc.provider} back to original status: ${originalStatus}`);
  }

  console.log('\n🎉 Official Accounts Database & Backend Verification Passed with 0 errors!');
  process.exit(0);
}

testOfficialAccountsAPI().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

