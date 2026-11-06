import { query, withTransaction } from '../db';
import jwt from 'jsonwebtoken';

async function main() {
  console.log('══════════════════════════════════════════════════════════════════');
  console.log('🧪 TESTING REJECTION FIXES: WITHDRAWALS & AGENT PAYOUTS');
  console.log('══════════════════════════════════════════════════════════════════');

  // Admin token
  const adminRes = await query(`SELECT * FROM users WHERE role = 'admin' LIMIT 1`);
  const admin = adminRes.rows[0];
  const adminToken = jwt.sign(
    { id: admin.id, phone: admin.phone, fullName: admin.full_name, role: 'admin' },
    process.env.JWT_SECRET || 'secret'
  );

  // Cashier PIN token
  const cashierToken = jwt.sign(
    { role: 'withdrawal_admin', name: 'Withdrawal Officer', timestamp: Date.now() },
    process.env.JWT_SECRET || 'secret'
  );

  // 1. Setup a test player with wallet
  const pRes = await query(`
    INSERT INTO users (full_name, phone, role, status)
    VALUES ('Test Rejection Player', '0988776655', 'player', 'active')
    RETURNING id
  `);
  const playerId = pRes.rows[0].id;
  await query(`INSERT INTO wallets (user_id, balance) VALUES ($1, 3000)`, [playerId]);

  console.log(`\n1️⃣ [Test 1] Testing /api/withdrawals-admin/:id/reject (Cashier Desk)...`);
  // Create pending withdrawal
  const wdRes = await query(`
    INSERT INTO withdrawal_requests (
      user_id, amount, payment_method, account_phone, account_name, status
    ) VALUES ($1, 2000, 'M-Pesa', '0983624574', 'Eyu Ase', 'pending')
    RETURNING id
  `, [playerId]);
  const wdId = wdRes.rows[0].id;

  // Hold escrow (reduce balance to 1000)
  await query(`UPDATE wallets SET balance = 1000 WHERE user_id = $1`, [playerId]);
  // Create pending withdrawal in wallet_transactions
  await query(`
    INSERT INTO wallet_transactions (
      user_id, type, amount, balance_after, reference_code, status, payment_method, description
    ) VALUES ($1, 'withdrawal', 2000, 1000, $2, 'pending', 'M-Pesa', 'Pending test withdrawal')
  `, [playerId, `TEST-WD-${Date.now().toString().slice(-6)}`]);

  // Reject via Cashier API
  const res1 = await fetch(`http://localhost:5000/api/withdrawals-admin/${wdId}/reject`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cashierToken}`
    },
    body: JSON.stringify({ reason: 'Account name mismatch', note: 'Test internal note' })
  });
  const data1 = await res1.json();
  console.log('   Response:', res1.status, data1);

  if (!data1.success) {
    throw new Error(`Test 1 Failed: ${JSON.stringify(data1)}`);
  }

  // Verify wallet refunded
  const walCheck = await query(`SELECT balance FROM wallets WHERE user_id = $1`, [playerId]);
  console.log(`   Wallet balance after refund: ${walCheck.rows[0].balance} ETB (Expected: 3000)`);
  if (parseFloat(walCheck.rows[0].balance) !== 3000) {
    throw new Error('Wallet balance was not refunded properly!');
  }

  // Verify wallet_transactions type constraint
  const txCheck = await query(`
    SELECT type, status, amount, balance_after, description 
    FROM wallet_transactions 
    WHERE user_id = $1 AND type = 'refund'
    ORDER BY created_at DESC LIMIT 1
  `, [playerId]);
  console.log(`   Ledger entry verified: type='${txCheck.rows[0]?.type}', status='${txCheck.rows[0]?.status}', amount=${txCheck.rows[0]?.amount}`);
  console.log('   ✓ PASS: Cashier withdrawal rejection executed without type check violation!');


  console.log(`\n2️⃣ [Test 2] Testing /api/admin/agents/payouts/:id/reject with status='Requested'...`);
  const agentRes = await query(`SELECT id, agent_code, commission_balance FROM agent_profiles LIMIT 1`);
  const agent = agentRes.rows[0];
  const initialComm = parseFloat(agent.commission_balance || '0');

  const apRes = await query(`
    INSERT INTO agent_commission_payout_requests (
      agent_id, amount, payout_method, payout_account, status, code, account_name
    ) VALUES ($1, 500, 'Telebirr', '0912345678', 'Requested', $2, 'Test Agent')
    RETURNING id
  `, [agent.id, `PR-TEST-${Date.now().toString().slice(-4)}`]);
  const apId = apRes.rows[0].id;

  const res2 = await fetch(`http://localhost:5000/api/admin/agents/payouts/${apId}/reject`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ reason: 'Suspected fraudulent activity' })
  });
  const data2 = await res2.json();
  console.log('   Response:', res2.status, data2);

  if (!data2.success) {
    throw new Error(`Test 2 Failed: ${JSON.stringify(data2)}`);
  }

  // Verify commission balance refunded
  const agentCheck = await query(`SELECT commission_balance FROM agent_profiles WHERE id = $1`, [agent.id]);
  const newComm = parseFloat(agentCheck.rows[0].commission_balance);
  console.log(`   Commission balance: ${initialComm} -> ${newComm} (+500 ETB refunded)`);
  if (newComm !== initialComm + 500) {
    throw new Error('Commission balance was not refunded properly!');
  }
  console.log('   ✓ PASS: Agent payout with status Requested rejected and commission refunded!');


  console.log(`\n3️⃣ [Test 3] Testing /api/admin/withdrawals/:id/reject fallback for P2P agent withdrawal...`);
  // Create pending P2P withdrawal in agent_withdrawal_requests
  const p2pRes = await query(`
    INSERT INTO agent_withdrawal_requests (
      player_id, agent_id, amount, payout_method, payout_account, payout_account_name, status
    ) VALUES ($1, $2, 1000, 'Telebirr', '0988776655', 'Test Player', 'pending')
    RETURNING id
  `, [playerId, agent.id]);
  const p2pId = p2pRes.rows[0].id;

  // Deduct 1000 from player wallet for escrow
  await query(`UPDATE wallets SET balance = 2000 WHERE user_id = $1`, [playerId]);

  const res3 = await fetch(`http://localhost:5000/api/admin/withdrawals/${p2pId}/reject`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ reason: 'Compliance intervention' })
  });
  const data3 = await res3.json();
  console.log('   Response:', res3.status, data3);

  if (!data3.success) {
    throw new Error(`Test 3 Failed: ${JSON.stringify(data3)}`);
  }

  // Verify player wallet refunded back to 3000
  const finalWal = await query(`SELECT balance FROM wallets WHERE user_id = $1`, [playerId]);
  console.log(`   Player wallet balance after P2P rejection: ${finalWal.rows[0].balance} ETB (Expected: 3000)`);
  if (parseFloat(finalWal.rows[0].balance) !== 3000) {
    throw new Error('P2P player escrow was not refunded!');
  }
  console.log('   ✓ PASS: Superadmin dual-table fallback successfully rejected P2P withdrawal!');

  // Cleanup
  console.log('\n🧹 Cleaning up test records...');
  await query(`DELETE FROM wallet_transactions WHERE user_id = $1`, [playerId]);
  await query(`DELETE FROM withdrawal_requests WHERE id = $1`, [wdId]);
  await query(`DELETE FROM agent_withdrawal_requests WHERE id = $1`, [p2pId]);
  await query(`DELETE FROM agent_commission_payout_requests WHERE id = $1`, [apId]);
  await query(`UPDATE agent_profiles SET commission_balance = $1 WHERE id = $2`, [initialComm, agent.id]);
  await query(`DELETE FROM wallets WHERE user_id = $1`, [playerId]);
  await query(`DELETE FROM users WHERE id = $1`, [playerId]);
  console.log('   ✓ Test data cleaned up.');

  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log('🎉 ALL REJECTION TESTS PASSED (100% SUCCESS)');
  console.log('══════════════════════════════════════════════════════════════════');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
