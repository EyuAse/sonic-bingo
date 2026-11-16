import dotenv from 'dotenv';
import { withTransaction, checkDbConnection, query } from '../db.ts';

dotenv.config();

export async function runPhase3() {
  console.log('══════════════════════════════════════════════════════════════════════════════');
  console.log('🏢 [PHASE 3] AGENT NETWORK & NON-ADMIN WALLET PURGE');
  console.log('══════════════════════════════════════════════════════════════════════════════\n');

  const health = await checkDbConnection();
  if (!health.connected) {
    console.error('❌ Cannot connect to Neon DB:', health.error);
    process.exit(1);
  }
  console.log(`✅ [Connection] Neon PostgreSQL online (${health.latencyMs}ms latency)\n`);

  await withTransaction(async (client) => {
    // 1. Disarm Foreign Key pointers from users and payment_accounts to agent_profiles
    console.log('1️⃣ Disarming Foreign Key pointers referencing agent_profiles...');
    const disarmUsers = await client.query('UPDATE users SET agent_id = NULL WHERE agent_id IS NOT NULL RETURNING id;');
    console.log(`   ✓ Disarmed 'users.agent_id' (${disarmUsers.rowCount} references severed)`);

    const disarmPay = await client.query('UPDATE payment_accounts SET agent_id = NULL WHERE agent_id IS NOT NULL RETURNING id;');
    console.log(`   ✓ Disarmed 'payment_accounts.agent_id' (${disarmPay.rowCount} references severed)`);

    // 2. Purge Agent child activity and request tables
    console.log('\n2️⃣ Purging agent child transactions, commissions & requests...');
    const delComm = await client.query('DELETE FROM agent_commissions RETURNING id;');
    console.log(`   ✓ Purged 'agent_commissions': ${delComm.rowCount} records deleted`);

    const delCommPay = await client.query('DELETE FROM agent_commission_payout_requests RETURNING id;');
    console.log(`   ✓ Purged 'agent_commission_payout_requests': ${delCommPay.rowCount} records deleted`);

    const delPlDep = await client.query('DELETE FROM agent_player_deposits RETURNING id;');
    console.log(`   ✓ Purged 'agent_player_deposits': ${delPlDep.rowCount} records deleted`);

    const delDepReq = await client.query('DELETE FROM agent_deposit_requests RETURNING id;');
    console.log(`   ✓ Purged 'agent_deposit_requests': ${delDepReq.rowCount} records deleted`);

    const delWithReq = await client.query('DELETE FROM agent_withdrawal_requests RETURNING id;');
    console.log(`   ✓ Purged 'agent_withdrawal_requests': ${delWithReq.rowCount} records deleted`);

    const delVouchers = await client.query('DELETE FROM agent_cashout_vouchers RETURNING id;');
    console.log(`   ✓ Purged 'agent_cashout_vouchers': ${delVouchers.rowCount} records deleted`);

    const delRecharge = await client.query('DELETE FROM agent_recharge_requests RETURNING id;');
    console.log(`   ✓ Purged 'agent_recharge_requests': ${delRecharge.rowCount} records deleted`);

    // 3. Purge Agent Profiles
    console.log('\n3️⃣ Purging agent profiles...');
    const delAgents = await client.query('DELETE FROM agent_profiles RETURNING id;');
    console.log(`   ✓ Purged 'agent_profiles': ${delAgents.rowCount} records deleted`);

    // 4. Purge auxiliary player activity logs and disarm SMS logs
    console.log('\n4️⃣ Purging player activity logs & disarming SMS logs...');
    const delNotes = await client.query('DELETE FROM player_notes RETURNING id;');
    console.log(`   ✓ Purged 'player_notes': ${delNotes.rowCount} records deleted`);

    const delAudit = await client.query('DELETE FROM player_audit_logs RETURNING id;');
    console.log(`   ✓ Purged 'player_audit_logs': ${delAudit.rowCount} records deleted`);

    const disarmSms = await client.query('UPDATE telebirr_sms_logs SET matched_user_id = NULL WHERE matched_user_id IS NOT NULL RETURNING id;');
    console.log(`   ✓ Disarmed 'telebirr_sms_logs.matched_user_id' (${disarmSms.rowCount} references severed)`);

    // 5. Purge wallets for non-admin, non-bot users
    console.log('\n5️⃣ Purging non-admin, non-bot player wallets...');
    const delWallets = await client.query(`
      DELETE FROM wallets 
      WHERE user_id NOT IN (
        SELECT id FROM users WHERE role = 'admin' OR is_bot = true
      )
      RETURNING id;
    `);
    console.log(`   ✓ Purged non-admin / non-bot 'wallets': ${delWallets.rowCount} records deleted`);
  });

  // Post-Phase 3 Verification Gate
  console.log('\n══════════════════════════════════════════════════════════════════════════════');
  console.log('🔍 [PHASE 3 AUDIT] VERIFYING PURGE COMPLETION IN NEON DB');
  console.log('══════════════════════════════════════════════════════════════════════════════\n');

  const checkVouchers = await query('SELECT COUNT(*) as count FROM agent_cashout_vouchers');
  const checkRecharge = await query('SELECT COUNT(*) as count FROM agent_recharge_requests');
  const checkAgents = await query('SELECT COUNT(*) as count FROM agent_profiles');
  const checkComm = await query('SELECT COUNT(*) as count FROM agent_commissions');
  const checkCommPay = await query('SELECT COUNT(*) as count FROM agent_commission_payout_requests');
  const checkPlDep = await query('SELECT COUNT(*) as count FROM agent_player_deposits');
  const checkDepReq = await query('SELECT COUNT(*) as count FROM agent_deposit_requests');
  const checkWithReq = await query('SELECT COUNT(*) as count FROM agent_withdrawal_requests');
  const checkNotes = await query('SELECT COUNT(*) as count FROM player_notes');
  const checkAudit = await query('SELECT COUNT(*) as count FROM player_audit_logs');
  const checkSms = await query('SELECT COUNT(*) as count FROM telebirr_sms_logs WHERE matched_user_id IS NOT NULL');
  const checkWallets = await query('SELECT COUNT(*) as count FROM wallets');
  const remainingWallets = await query(`
    SELECT w.id, w.user_id, w.balance, u.phone, u.role, u.is_bot
    FROM wallets w
    JOIN users u ON w.user_id = u.id;
  `);

  console.log(`- agent_profiles count:                   ${checkAgents.rows[0].count} (Expected: 0)`);
  console.log(`- agent_cashout_vouchers count:           ${checkVouchers.rows[0].count} (Expected: 0)`);
  console.log(`- agent_recharge_requests count:          ${checkRecharge.rows[0].count} (Expected: 0)`);
  console.log(`- agent_commissions count:                ${checkComm.rows[0].count} (Expected: 0)`);
  console.log(`- agent_commission_payout_requests count: ${checkCommPay.rows[0].count} (Expected: 0)`);
  console.log(`- agent_player_deposits count:            ${checkPlDep.rows[0].count} (Expected: 0)`);
  console.log(`- agent_deposit_requests count:           ${checkDepReq.rows[0].count} (Expected: 0)`);
  console.log(`- agent_withdrawal_requests count:        ${checkWithReq.rows[0].count} (Expected: 0)`);
  console.log(`- player_notes count:                     ${checkNotes.rows[0].count} (Expected: 0)`);
  console.log(`- player_audit_logs count:                ${checkAudit.rows[0].count} (Expected: 0)`);
  console.log(`- telebirr_sms_logs with matched_user_id: ${checkSms.rows[0].count} (Expected: 0)`);
  console.log(`- remaining wallets count:                 ${checkWallets.rows[0].count} (Only admin/bot)`);

  for (const w of remainingWallets.rows) {
    console.log(`  * Active Wallet: User=${w.phone} (Role: ${w.role}, Bot: ${w.is_bot}, Balance: ${w.balance} ETB)`);
  }

  const vGate1 = parseInt(checkAgents.rows[0].count, 10) === 0;
  const vGate2 = parseInt(checkVouchers.rows[0].count, 10) === 0;
  const vGate3 = parseInt(checkRecharge.rows[0].count, 10) === 0;
  const vGate4 = parseInt(checkComm.rows[0].count, 10) === 0;
  const vGate5 = parseInt(checkCommPay.rows[0].count, 10) === 0;
  const vGate6 = parseInt(checkPlDep.rows[0].count, 10) === 0;
  const vGate7 = parseInt(checkDepReq.rows[0].count, 10) === 0;
  const vGate8 = parseInt(checkWithReq.rows[0].count, 10) === 0;
  const vGate9 = parseInt(checkNotes.rows[0].count, 10) === 0;
  const vGate10 = parseInt(checkAudit.rows[0].count, 10) === 0;
  const vGate11 = parseInt(checkSms.rows[0].count, 10) === 0;
  const vGate12 = remainingWallets.rows.every((w: any) => w.role === 'admin' || w.is_bot === true);

  if (
    vGate1 && vGate2 && vGate3 && vGate4 && vGate5 &&
    vGate6 && vGate7 && vGate8 && vGate9 && vGate10 &&
    vGate11 && vGate12
  ) {
    console.log('\n🎉 [PHASE 3 SUCCESS] All 12 verification gates passed!');
    console.log('   Agent network, related financial slips, and non-admin wallets purged cleanly.');
    console.log('   Admin Cashier wallet preserved intact.');
  } else {
    console.error('\n❌ [PHASE 3 GATE FAILURE] One or more verification gates failed!');
    process.exit(1);
  }
}

runPhase3()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Phase 3 Failed:', err);
    process.exit(1);
  });
