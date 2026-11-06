import { query } from '../db.ts';
import { parseTelebirrSMS } from '../services/telebirrParser.ts';
import { executeAgentDepositApproval } from '../services/depositAutoApprovalService.ts';

async function runSecurityTests() {
  console.log('🔒 ==========================================');
  console.log('🔒 RUNNING TELEBIRR SECURITY HARDENING TESTS');
  console.log('🔒 ==========================================\n');

  let passed = 0;
  let failed = 0;

  // ----------------------------------------------------
  // TEST 1: Outgoing Transfer (Debit) Rejection Guard
  // ----------------------------------------------------
  console.log('👉 [Test 1] Outgoing Transfer Detection:');
  const outgoingSms = `Dear FEVEN \nYou have transferred ETB 150.00 to Hakafen Regasa (0937****11) on 06/11/2026 12:29:21. Your transaction number is DK62RU01DG. Your current E-Money Account balance is ETB 1,562.63.`;
  const parsedOutgoing = parseTelebirrSMS(outgoingSms);

  if (!parsedOutgoing.success && parsedOutgoing.isOutgoing) {
    console.log('✅ PASS: Outgoing transfer correctly identified and blocked from deposit consideration.');
    passed++;
  } else {
    console.error('❌ FAIL: Outgoing transfer was NOT properly rejected!', parsedOutgoing);
    failed++;
  }

  // ----------------------------------------------------
  // TEST 2: Amount Mismatch Exploit (53 vs 100 ETB)
  // ----------------------------------------------------
  console.log('\n👉 [Test 2] Amount Mismatch Exploit (Transfer 53 ETB, claim 100 ETB):');
  const testTxRef = `SEC_MISMATCH_${Date.now().toString().slice(-6)}`;
  
  // 1. Seed SMS log with 53 ETB
  const smsInsert = await query(
    `INSERT INTO telebirr_sms_logs 
      (sender, message_body, transaction_ref, amount, payer_phone, recipient_name, status)
     VALUES ('127', 'Test SMS 53 ETB', $1, 53.00, '2519****7911', 'FEVEN', 'unmatched')
     RETURNING id`,
    [testTxRef]
  );
  const smsLogId = smsInsert.rows[0].id;

  // 2. Fetch a valid agent and player for testing
  const agentRes = await query(`SELECT id, agent_code, wallet_balance FROM agent_profiles LIMIT 1`);
  const userRes = await query(`SELECT id FROM users LIMIT 1`);
  const agentId = agentRes.rows[0].id;
  const userId = userRes.rows[0].id;

  // 3. User maliciously enters 100.00 ETB in the deposit form
  const depInsert = await query(
    `INSERT INTO agent_deposit_requests 
      (player_id, agent_id, amount, payment_method, player_phone, transaction_code, status)
     VALUES ($1, $2, 100.00, 'Telebirr', '0965277911', $3, 'pending')
     RETURNING id`,
    [userId, agentId, testTxRef]
  );
  const depReqId = depInsert.rows[0].id;

  // 4. Attempt auto-approval
  const approvalResult = await executeAgentDepositApproval(depReqId, testTxRef, smsLogId);

  // Check results: Approval must FAIL with AMOUNT_MISMATCH
  if (!approvalResult.success && approvalResult.error === 'AMOUNT_MISMATCH') {
    // Check that request is marked 'rejected' in DB
    const checkReq = await query(`SELECT status, rejection_reason FROM agent_deposit_requests WHERE id = $1`, [depReqId]);
    if (checkReq.rows[0].status === 'rejected') {
      console.log(`✅ PASS: Exploit BLOCKED! System detected claimed 100.00 ETB vs verified 53.00 ETB and rejected request.`);
      passed++;
    } else {
      console.error('❌ FAIL: Request status was not updated to rejected:', checkReq.rows[0]);
      failed++;
    }
  } else {
    console.error('❌ FAIL: System did NOT block the amount mismatch!', approvalResult);
    failed++;
  }

  // ----------------------------------------------------
  // TEST 3: Legitimate Exact-Amount Auto-Approval
  // ----------------------------------------------------
  console.log('\n👉 [Test 3] Legitimate Match (Transfer 50 ETB, claim 50 ETB):');
  const legitTxRef = `SEC_LEGIT_${Date.now().toString().slice(-6)}`;

  // Seed SMS log with 50 ETB
  const legitSms = await query(
    `INSERT INTO telebirr_sms_logs 
      (sender, message_body, transaction_ref, amount, payer_phone, recipient_name, status)
     VALUES ('127', 'Test SMS 50 ETB', $1, 50.00, '2519****7911', 'FEVEN', 'unmatched')
     RETURNING id`,
    [legitTxRef]
  );
  const legitSmsId = legitSms.rows[0].id;

  // Player enters exactly 50.00 ETB
  const legitDep = await query(
    `INSERT INTO agent_deposit_requests 
      (player_id, agent_id, amount, payment_method, player_phone, transaction_code, status)
     VALUES ($1, $2, 50.00, 'Telebirr', '0965277911', $3, 'pending')
     RETURNING id`,
    [userId, agentId, legitTxRef]
  );
  const legitDepId = legitDep.rows[0].id;

  // Get player wallet balance before
  const walBefore = await query(`SELECT balance FROM wallets WHERE user_id = $1`, [userId]);
  const prevBal = parseFloat(walBefore.rows[0]?.balance || '0');

  // Attempt auto-approval
  const legitResult = await executeAgentDepositApproval(legitDepId, legitTxRef, legitSmsId);

  if (legitResult.success && legitResult.amount === 50) {
    const walAfter = await query(`SELECT balance FROM wallets WHERE user_id = $1`, [userId]);
    const afterBal = parseFloat(walAfter.rows[0]?.balance || '0');
    if (Math.abs(afterBal - (prevBal + 50)) < 0.01) {
      console.log(`✅ PASS: Legitimate 50 ETB deposit approved instantly! Wallet balance correctly increased by 50 ETB.`);
      passed++;
    } else {
      console.error(`❌ FAIL: Wallet balance mismatch: ${prevBal} + 50 != ${afterBal}`);
      failed++;
    }
  } else {
    console.error('❌ FAIL: Legitimate deposit failed to approve:', legitResult);
    failed++;
  }

  // ----------------------------------------------------
  // CLEANUP TEST DATA
  // ----------------------------------------------------
  await query(`DELETE FROM agent_deposit_requests WHERE transaction_code IN ($1, $2)`, [testTxRef, legitTxRef]);
  await query(`DELETE FROM telebirr_sms_logs WHERE transaction_ref IN ($1, $2)`, [testTxRef, legitTxRef]);

  console.log('\n🔒 ==========================================');
  console.log(`🔒 RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('🔒 ==========================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runSecurityTests().catch((err) => {
  console.error('Test script crashed:', err);
  process.exit(1);
});
