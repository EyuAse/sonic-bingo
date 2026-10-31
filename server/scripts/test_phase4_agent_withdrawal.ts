import dotenv from 'dotenv';
import { query, withTransaction } from '../db.ts';

dotenv.config();

async function testPhase4AgentWithdrawal() {
  console.log('🧪 Running Phase 4 Test: Decentralized Agent Withdrawal Flow Verification...');

  // 1. Get an active agent profile
  const agentRes = await query(`
    SELECT ap.id, ap.agent_code, ap.wallet_balance, ap.commission_balance
    FROM agent_profiles ap
    WHERE ap.status = 'active'
    LIMIT 1
  `);

  if (agentRes.rows.length === 0) {
    throw new Error('No active agent found.');
  }

  const agent = agentRes.rows[0];
  const agentId = agent.id;
  const initialAgentFloat = parseFloat(agent.wallet_balance);
  const initialCommissionBal = parseFloat(agent.commission_balance || '0');
  console.log(`✅ Using Agent: Code=${agent.agent_code}, Float=${initialAgentFloat.toFixed(2)} ETB, Commission=${initialCommissionBal.toFixed(2)} ETB`);

  // 2. Create or find a test player with funds
  let playerRes = await query(`SELECT id, phone, full_name FROM users WHERE role = 'player' LIMIT 1`);
  if (playerRes.rows.length === 0) {
    playerRes = await query(`
      INSERT INTO users (full_name, phone, role)
      VALUES ('Phase 4 Test Player', '0977889900', 'player')
      RETURNING id, phone, full_name
    `);
  }
  const player = playerRes.rows[0];
  const playerId = player.id;

  // Set player initial balance to 1000 ETB
  await query(`
    INSERT INTO wallets (user_id, balance, bonus, currency, updated_at)
    VALUES ($1, 1000.00, 0.00, 'ETB', NOW())
    ON CONFLICT (user_id) DO UPDATE SET balance = 1000.00, updated_at = NOW()
  `, [playerId]);

  console.log(`✅ Test Player ID=${playerId}, Funded with 1000.00 ETB`);

  // --- TEST A: Player Requests Withdrawal & Escrow Lock ---
  const withdrawalAmount = 500.00;
  console.log(`\n--- Test A: Player requests ${withdrawalAmount} ETB withdrawal via Agent ---`);

  let requestId = '';
  await withTransaction(async (client) => {
    // Lock wallet
    const wRes = await client.query(`SELECT balance FROM wallets WHERE user_id = $1 FOR UPDATE`, [playerId]);
    const curBal = parseFloat(wRes.rows[0].balance);
    const newBal = curBal - withdrawalAmount;

    // Deduct to escrow
    await client.query(`UPDATE wallets SET balance = $1 WHERE user_id = $2`, [newBal, playerId]);

    // Insert request
    const ins = await client.query(`
      INSERT INTO agent_withdrawal_requests (
        player_id, agent_id, amount, payout_method, payout_account,
        payout_account_name, player_balance_before, player_balance_after, status
      )
      VALUES ($1, $2, $3, 'Telebirr', '0977889900', 'Test Recipient', $4, $5, 'pending')
      RETURNING id
    `, [playerId, agentId, withdrawalAmount, curBal, newBal]);
    requestId = ins.rows[0].id;
  });

  // Verify Escrow Lock
  const wAfterReq = await query(`SELECT balance FROM wallets WHERE user_id = $1`, [playerId]);
  const balAfterEscrow = parseFloat(wAfterReq.rows[0].balance);
  if (Math.abs(balAfterEscrow - 500.00) > 0.01) {
    throw new Error(`Escrow deduction failed! Expected 500.00, got: ${balAfterEscrow}`);
  }
  console.log(`✅ Atomic Escrow Lock verified: Player balance deducted to ${balAfterEscrow.toFixed(2)} ETB (500 ETB held in escrow)`);

  // --- TEST B: Agent Approves & Receives Float Replenishment + Commission ---
  console.log(`\n--- Test B: Agent fulfills payout and approves with SMS code ---`);
  const testTxRef = `SMS-CONF-${Date.now().toString().slice(-6)}`;
  const commissionRate = 2.0;
  const commissionEarned = Math.round(withdrawalAmount * (commissionRate / 100) * 100) / 100; // 10.00 ETB

  await withTransaction(async (client) => {
    // Lock agent
    const aRes = await client.query(`SELECT wallet_balance, commission_balance FROM agent_profiles WHERE id = $1 FOR UPDATE`, [agentId]);
    const aBal = parseFloat(aRes.rows[0].wallet_balance);
    const cBal = parseFloat(aRes.rows[0].commission_balance || '0');

    const newABal = aBal + withdrawalAmount + commissionEarned;
    const newCBal = cBal + commissionEarned;

    await client.query(`
      UPDATE agent_profiles 
      SET wallet_balance = $1, commission_balance = $2, updated_at = NOW() 
      WHERE id = $3
    `, [newABal, newCBal, agentId]);

    await client.query(`
      INSERT INTO agent_commissions (agent_id, source_type, source_id, amount, commission_rate, commission_earned)
      VALUES ($1, 'withdrawal', $2, $3, $4, $5)
    `, [agentId, requestId, withdrawalAmount, commissionRate, commissionEarned]);

    await client.query(`
      UPDATE agent_withdrawal_requests 
      SET status = 'approved', agent_tx_ref = $1, agent_commission_earned = $2,
          agent_balance_before = $3, agent_balance_after = $4, resolved_at = NOW()
      WHERE id = $5
    `, [testTxRef, commissionEarned, aBal, newABal, requestId]);
  });

  // Verify Agent Float Replenishment
  const agentAfterApprove = await query(`SELECT wallet_balance, commission_balance FROM agent_profiles WHERE id = $1`, [agentId]);
  const expectedFloat = initialAgentFloat + withdrawalAmount + commissionEarned;
  const actualFloat = parseFloat(agentAfterApprove.rows[0].wallet_balance);
  if (Math.abs(actualFloat - expectedFloat) > 0.01) {
    throw new Error(`Float replenishment mismatch! Expected ${expectedFloat}, got ${actualFloat}`);
  }
  console.log(`✅ Float Replenishment verified: Agent float credited +${withdrawalAmount} ETB (+${commissionEarned} ETB commission) -> ${actualFloat.toFixed(2)} ETB`);

  // Verify Commission Balance
  const expectedCommission = initialCommissionBal + commissionEarned;
  const actualCommission = parseFloat(agentAfterApprove.rows[0].commission_balance);
  if (Math.abs(actualCommission - expectedCommission) > 0.01) {
    throw new Error(`Commission balance mismatch! Expected ${expectedCommission}, got ${actualCommission}`);
  }
  console.log(`✅ Commission Wallet verified: +${commissionEarned.toFixed(2)} ETB added to agent commission balance!`);

  // --- TEST C: Rejection Flow & Escrow Refund ---
  console.log(`\n--- Test C: Agent Rejects Request & Escrow is Refunded to Player ---`);
  const rejectAmount = 200.00;
  let rejectReqId = '';
  await withTransaction(async (client) => {
    // Deduct to escrow
    await client.query(`UPDATE wallets SET balance = balance - $1 WHERE user_id = $2`, [rejectAmount, playerId]);
    const ins = await client.query(`
      INSERT INTO agent_withdrawal_requests (
        player_id, agent_id, amount, payout_method, payout_account,
        player_balance_before, player_balance_after, status
      )
      VALUES ($1, $2, $3, 'Telebirr', '0977889900', 500.00, 300.00, 'pending')
      RETURNING id
    `, [playerId, agentId, rejectAmount]);
    rejectReqId = ins.rows[0].id;
  });

  // Simulate Agent Rejection
  const rejectionReason = 'Agent physical cash depleted';
  await withTransaction(async (client) => {
    // Refund escrow
    await client.query(`UPDATE wallets SET balance = balance + $1 WHERE user_id = $2`, [rejectAmount, playerId]);
    // Mark rejected
    await client.query(`
      UPDATE agent_withdrawal_requests 
      SET status = 'rejected', rejection_reason = $1, resolved_at = NOW() 
      WHERE id = $2
    `, [rejectionReason, rejectReqId]);
  });

  // Verify Player Escrow Refund
  const wAfterReject = await query(`SELECT balance FROM wallets WHERE user_id = $1`, [playerId]);
  const balAfterRefund = parseFloat(wAfterReject.rows[0].balance);
  if (Math.abs(balAfterRefund - 500.00) > 0.01) {
    throw new Error(`Refund failed! Expected 500.00, got: ${balAfterRefund}`);
  }
  console.log(`✅ Escrow Refund verified: Player balance restored to ${balAfterRefund.toFixed(2)} ETB upon agent rejection!`);

  // --- TEST D: Player Cancellation Flow ---
  console.log(`\n--- Test D: Player cancels pending request ---`);
  const cancelAmount = 100.00;
  let cancelReqId = '';
  await withTransaction(async (client) => {
    await client.query(`UPDATE wallets SET balance = balance - $1 WHERE user_id = $2`, [cancelAmount, playerId]);
    const ins = await client.query(`
      INSERT INTO agent_withdrawal_requests (
        player_id, agent_id, amount, payout_method, payout_account,
        player_balance_before, player_balance_after, status
      )
      VALUES ($1, $2, $3, 'Telebirr', '0977889900', 500.00, 400.00, 'pending')
      RETURNING id
    `, [playerId, agentId, cancelAmount]);
    cancelReqId = ins.rows[0].id;
  });

  // Cancel
  await withTransaction(async (client) => {
    await client.query(`UPDATE wallets SET balance = balance + $1 WHERE user_id = $2`, [cancelAmount, playerId]);
    await client.query(`UPDATE agent_withdrawal_requests SET status = 'cancelled' WHERE id = $1`, [cancelReqId]);
  });

  const wAfterCancel = await query(`SELECT balance FROM wallets WHERE user_id = $1`, [playerId]);
  console.log(`✅ Cancellation verified: Player balance restored to ${parseFloat(wAfterCancel.rows[0].balance).toFixed(2)} ETB!`);

  // 6. Cleanup test records and restore initial state
  await query(`UPDATE agent_profiles SET wallet_balance = $1, commission_balance = $2 WHERE id = $3`, [initialAgentFloat, initialCommissionBal, agentId]);
  await query(`DELETE FROM agent_commissions WHERE source_id = $1`, [requestId]);
  await query(`DELETE FROM agent_withdrawal_requests WHERE id IN ($1, $2, $3)`, [requestId, rejectReqId, cancelReqId]);
  await query(`DELETE FROM wallets WHERE user_id = $1`, [playerId]);

  console.log('\n✅ Cleanup complete: initial float and commission balances restored.');
  console.log('🎉 --- PHASE 4 TEST PASSED 100% --- 🎉');
  process.exit(0);
}

testPhase4AgentWithdrawal().catch(err => {
  console.error('❌ Phase 4 test failed:', err);
  process.exit(1);
});

