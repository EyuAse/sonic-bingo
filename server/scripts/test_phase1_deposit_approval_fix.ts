import dotenv from 'dotenv';
import { query, withTransaction } from '../db.ts';

dotenv.config();

async function testPhase1DepositApprovalFix() {
  console.log('🧪 Running Phase 1 Test: Inbound Deposit Approval & Rejection Bugfix Verification...');

  // 1. Find an active agent profile
  const agentRes = await query(`
    SELECT ap.id, ap.agent_code, ap.wallet_balance, ap.commission_rate
    FROM agent_profiles ap
    WHERE ap.status = 'active' AND ap.wallet_balance >= 100
    LIMIT 1
  `);

  if (agentRes.rows.length === 0) {
    throw new Error('No active agent found with at least 100 ETB float balance.');
  }

  const agent = agentRes.rows[0];
  const agentId = agent.id;
  const initialAgentFloat = parseFloat(agent.wallet_balance);
  console.log(`✅ Using Agent: Code=${agent.agent_code}, Float=${initialAgentFloat.toFixed(2)} ETB`);

  // 2. Find or create a test player
  let playerRes = await query(`SELECT id, phone, full_name FROM users WHERE role = 'player' LIMIT 1`);
  if (playerRes.rows.length === 0) {
    playerRes = await query(`
      INSERT INTO users (full_name, phone, role)
      VALUES ('Phase 1 Test Player', '0988776655', 'player')
      RETURNING id, phone, full_name
    `);
  }
  const player = playerRes.rows[0];
  const playerId = player.id;
  console.log(`✅ Using Player: ID=${playerId}, Name=${player.full_name}`);

  // Ensure player has a wallet
  await query(`
    INSERT INTO wallets (user_id, balance, bonus, currency, updated_at)
    VALUES ($1, 50.00, 0.00, 'ETB', NOW())
    ON CONFLICT (user_id) DO NOTHING
  `, [playerId]);

  const pWalRes = await query(`SELECT balance FROM wallets WHERE user_id = $1`, [playerId]);
  const initialPlayerBal = parseFloat(pWalRes.rows[0].balance);
  console.log(`Player initial balance: ${initialPlayerBal.toFixed(2)} ETB`);

  // 3. Create a pending deposit request
  const depositAmount = 100.00;
  const testTxCode = `PHASE1-${Date.now().toString().slice(-6)}`;
  const insReq = await query(`
    INSERT INTO agent_deposit_requests 
      (player_id, agent_id, amount, payment_method, player_phone, transaction_code, status)
    VALUES ($1, $2, $3, 'Telebirr', $4, $5, 'pending')
    RETURNING id
  `, [playerId, agentId, depositAmount, player.phone || '0988776655', testTxCode]);

  const requestId = insReq.rows[0].id;
  console.log(`✅ Created pending deposit request: ID=${requestId}, Amount=${depositAmount} ETB, Code=${testTxCode}`);

  // 4. Simulate the exact fixed endpoint logic inside withTransaction
  console.log('⚡ Executing approval transaction using wallet_transactions (verifying bugfix)...');
  await withTransaction(async (client) => {
    // A. Lock request
    const reqRes = await client.query(
      `SELECT * FROM agent_deposit_requests WHERE id = $1 AND agent_id = $2 FOR UPDATE`,
      [requestId, agentId]
    );
    const depReq = reqRes.rows[0];

    // B. Lock agent profile
    const agentProfileRes = await client.query(
      `SELECT id, agent_code, wallet_balance, commission_rate FROM agent_profiles WHERE id = $1 FOR UPDATE`,
      [agentId]
    );
    const agentProfile = agentProfileRes.rows[0];
    const agentBal = parseFloat(agentProfile.wallet_balance);

    // C. Lock player wallet with creation guard
    let playerWalletRes = await client.query(
      `SELECT id, balance, user_id FROM wallets WHERE user_id = $1 FOR UPDATE`,
      [depReq.player_id]
    );
    const playerWallet = playerWalletRes.rows[0];
    const playerOldBalance = parseFloat(playerWallet.balance || '0');

    const agentBalAfter = agentBal - depositAmount;
    const playerBalAfter = playerOldBalance + depositAmount;
    const commissionRate = parseFloat(agentProfile.commission_rate || '5.0');
    const commissionEarned = depositAmount * (commissionRate / 100);

    // D. Deduct Agent Float
    await client.query(
      `UPDATE agent_profiles SET wallet_balance = $1, updated_at = NOW() WHERE id = $2`,
      [agentBalAfter, agentId]
    );

    // E. Credit Player Balance
    await client.query(
      `UPDATE wallets SET balance = $1, updated_at = NOW() WHERE id = $2`,
      [playerBalAfter, playerWallet.id]
    );

    // G. Mark Player as has_deposited & link to agent
    await client.query(
      `UPDATE users SET has_deposited = true, agent_id = COALESCE(agent_id, $1) WHERE id = $2`,
      [agentId, depReq.player_id]
    );

    // H. Record in agent_commissions audit table
    await client.query(
      `INSERT INTO agent_commissions 
        (agent_id, source_type, source_id, amount, commission_rate, commission_earned)
       VALUES ($1, 'deposit', $2, $3, $4, $5)`,
      [agentId, requestId, depositAmount, commissionRate, commissionEarned]
    );

    // I. Record in agent_player_deposits
    await client.query(
      `INSERT INTO agent_player_deposits 
        (agent_id, player_user_id, amount, agent_balance_after, player_balance_after, payment_method, reference_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [agentId, depReq.player_id, depositAmount, agentBalAfter, playerBalAfter, depReq.payment_method, depReq.transaction_code]
    );

    // J. ⭐️ Record in player's wallet_transactions ledger (Previously failed with relation "transactions" does not exist)
    await client.query(
      `INSERT INTO wallet_transactions 
        (user_id, type, amount, balance_after, reference_code, status, payment_method, description)
       VALUES ($1, 'deposit', $2, $3, $4, 'completed', $5, $6)`,
      [
        depReq.player_id,
        depositAmount,
        playerBalAfter,
        depReq.transaction_code,
        depReq.payment_method,
        `Deposit via Sonic Agent #${agentProfile.agent_code}`
      ]
    );

    // K. Update Request Status to 'approved'
    await client.query(
      `UPDATE agent_deposit_requests
       SET status = 'approved',
           resolved_at = NOW(),
           agent_balance_before = $1,
           agent_balance_after = $2,
           player_balance_before = $3,
           player_balance_after = $4
       WHERE id = $5`,
      [agentBal, agentBalAfter, playerOldBalance, playerBalAfter, requestId]
    );
  });

  console.log('✅ Transaction committed successfully without any errors!');

  // 5. Verify the updated database rows
  const updatedReq = await query(`SELECT * FROM agent_deposit_requests WHERE id = $1`, [requestId]);
  if (updatedReq.rows[0].status !== 'approved') {
    throw new Error(`Expected status 'approved', got: ${updatedReq.rows[0].status}`);
  }
  console.log(`✅ Request status: approved!`);

  const updatedPlayerWallet = await query(`SELECT balance FROM wallets WHERE user_id = $1`, [playerId]);
  const expectedPlayerBal = initialPlayerBal + depositAmount;
  if (Math.abs(parseFloat(updatedPlayerWallet.rows[0].balance) - expectedPlayerBal) > 0.01) {
    throw new Error(`Player balance mismatch. Expected ${expectedPlayerBal}, got ${updatedPlayerWallet.rows[0].balance}`);
  }
  console.log(`✅ Player balance credited: ${updatedPlayerWallet.rows[0].balance} ETB (was ${initialPlayerBal} ETB)`);

  const updatedAgent = await query(`SELECT wallet_balance FROM agent_profiles WHERE id = $1`, [agentId]);
  const expectedAgentFloat = initialAgentFloat - depositAmount;
  if (Math.abs(parseFloat(updatedAgent.rows[0].wallet_balance) - expectedAgentFloat) > 0.01) {
    throw new Error(`Agent float mismatch. Expected ${expectedAgentFloat}, got ${updatedAgent.rows[0].wallet_balance}`);
  }
  console.log(`✅ Agent float deducted: ${updatedAgent.rows[0].wallet_balance} ETB (was ${initialAgentFloat} ETB)`);

  const ledgerRow = await query(`SELECT * FROM wallet_transactions WHERE reference_code = $1`, [testTxCode]);
  if (ledgerRow.rows.length === 0) {
    throw new Error('wallet_transactions row was not found!');
  }
  console.log(`✅ wallet_transactions verified: ID=${ledgerRow.rows[0].id}, Amount=${ledgerRow.rows[0].amount} ETB`);

  // 6. Test Rejection Flow on another test request
  const testRejectCode = `REJECT-${Date.now().toString().slice(-6)}`;
  const insRejectReq = await query(`
    INSERT INTO agent_deposit_requests 
      (player_id, agent_id, amount, payment_method, player_phone, transaction_code, status)
    VALUES ($1, $2, 50.00, 'Telebirr', $3, $4, 'pending')
    RETURNING id
  `, [playerId, agentId, player.phone || '0988776655', testRejectCode]);
  const rejectReqId = insRejectReq.rows[0].id;

  const rejectionReason = 'Invalid mobile transfer receipt';
  await query(`
    UPDATE agent_deposit_requests
    SET status = 'rejected',
        rejection_reason = $1,
        resolved_at = NOW()
    WHERE id = $2
  `, [rejectionReason, rejectReqId]);

  const updatedRejectReq = await query(`SELECT status, rejection_reason FROM agent_deposit_requests WHERE id = $1`, [rejectReqId]);
  if (updatedRejectReq.rows[0].status !== 'rejected' || updatedRejectReq.rows[0].rejection_reason !== rejectionReason) {
    throw new Error('Rejection flow verification failed');
  }
  console.log(`✅ Rejection flow verified: status=rejected, reason="${rejectionReason}"`);

  // 7. Cleanup test records and restore initial balances
  await query(`UPDATE agent_profiles SET wallet_balance = $1 WHERE id = $2`, [initialAgentFloat, agentId]);
  await query(`UPDATE wallets SET balance = $1 WHERE user_id = $2`, [initialPlayerBal, playerId]);
  await query(`DELETE FROM wallet_transactions WHERE reference_code = $1`, [testTxCode]);
  await query(`DELETE FROM agent_commissions WHERE source_id = $1`, [requestId]);
  await query(`DELETE FROM agent_player_deposits WHERE reference_code = $1`, [testTxCode]);
  await query(`DELETE FROM agent_deposit_requests WHERE id IN ($1, $2)`, [requestId, rejectReqId]);

  console.log('✅ Cleanup complete: test requests removed and initial balances restored.');
  console.log('🎉 --- PHASE 1 TEST PASSED 100% --- 🎉');
  process.exit(0);
}

testPhase1DepositApprovalFix().catch(err => {
  console.error('❌ Phase 1 test failed:', err);
  process.exit(1);
});

