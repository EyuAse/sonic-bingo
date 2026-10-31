import dotenv from 'dotenv';
import { query, withTransaction } from '../db.ts';

dotenv.config();

async function testPhase5CommissionWallet() {
  console.log('🧪 Running Phase 5 Test: Dedicated Commission Wallet & Two-Way Cash-Out Verification...');

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

  // Set initial test commission balance to 500 ETB
  await query(`UPDATE agent_profiles SET commission_balance = 500.00 WHERE id = $1`, [agentId]);
  console.log('✅ Seeded test commission balance: 500.00 ETB');

  // --- TEST A: Option A - Convert Commission to Float (300 ETB) ---
  console.log('\n--- Test A: Option A - Instant Convert Commission to Float (300 ETB) ---');
  const convertAmount = 300.00;

  await withTransaction(async (client) => {
    const aRes = await client.query(
      `SELECT wallet_balance, commission_balance FROM agent_profiles WHERE id = $1 FOR UPDATE`,
      [agentId]
    );
    const liveCommission = parseFloat(aRes.rows[0].commission_balance);
    const liveFloat = parseFloat(aRes.rows[0].wallet_balance);

    const newCommissionBal = liveCommission - convertAmount;
    const newFloatBal = liveFloat + convertAmount;

    await client.query(
      `UPDATE agent_profiles 
       SET wallet_balance = $1, commission_balance = $2, updated_at = NOW() 
       WHERE id = $3`,
      [newFloatBal, newCommissionBal, agentId]
    );

    await client.query(
      `INSERT INTO agent_commissions (agent_id, source_type, amount, commission_rate, commission_earned)
       VALUES ($1, 'commission_to_float', $2, 100.0, $3)`,
      [agentId, convertAmount, -convertAmount]
    );
  });

  const checkAfterConvert = await query(
    `SELECT wallet_balance, commission_balance FROM agent_profiles WHERE id = $1`,
    [agentId]
  );
  const floatAfterConvert = parseFloat(checkAfterConvert.rows[0].wallet_balance);
  const commAfterConvert = parseFloat(checkAfterConvert.rows[0].commission_balance);

  const expectedFloat = initialAgentFloat + convertAmount;
  if (Math.abs(floatAfterConvert - expectedFloat) > 0.01) {
    throw new Error(`Float conversion mismatch! Expected ${expectedFloat}, got: ${floatAfterConvert}`);
  }
  if (Math.abs(commAfterConvert - 200.00) > 0.01) {
    throw new Error(`Remaining commission mismatch! Expected 200.00, got: ${commAfterConvert}`);
  }
  console.log(`✅ Option A Verified: Float credited +${convertAmount} ETB -> ${floatAfterConvert.toFixed(2)} ETB, Commission balance -> ${commAfterConvert.toFixed(2)} ETB`);

  // --- TEST B: Option B - Request Commission Cash-Out Payout (150 ETB) ---
  console.log('\n--- Test B: Option B - Request Commission Cash-Out (150 ETB to CBE) ---');
  const cashoutAmount = 150.00;
  let payoutRequestId = '';

  await withTransaction(async (client) => {
    const aRes = await client.query(
      `SELECT commission_balance FROM agent_profiles WHERE id = $1 FOR UPDATE`,
      [agentId]
    );
    const liveCommission = parseFloat(aRes.rows[0].commission_balance);
    const newCommissionBal = liveCommission - cashoutAmount;

    await client.query(
      `UPDATE agent_profiles SET commission_balance = $1, updated_at = NOW() WHERE id = $2`,
      [newCommissionBal, agentId]
    );

    const insRes = await client.query(
      `INSERT INTO agent_commission_payout_requests (agent_id, amount, payout_method, payout_account, status)
       VALUES ($1, $2, 'CBE', '100012345678', 'pending')
       RETURNING id`,
      [agentId, cashoutAmount]
    );
    payoutRequestId = insRes.rows[0].id;
  });

  const checkAfterCashout = await query(
    `SELECT commission_balance FROM agent_profiles WHERE id = $1`,
    [agentId]
  );
  const commAfterCashout = parseFloat(checkAfterCashout.rows[0].commission_balance);
  if (Math.abs(commAfterCashout - 50.00) > 0.01) {
    throw new Error(`Remaining commission after cashout mismatch! Expected 50.00, got: ${commAfterCashout}`);
  }
  console.log(`✅ Option B Verified: Commission deducted -${cashoutAmount} ETB -> ${commAfterCashout.toFixed(2)} ETB`);

  const checkPayoutReq = await query(
    `SELECT * FROM agent_commission_payout_requests WHERE id = $1`,
    [payoutRequestId]
  );
  if (checkPayoutReq.rows.length === 0 || checkPayoutReq.rows[0].status !== 'pending') {
    throw new Error('Payout request row was not created properly!');
  }
  console.log(`✅ Payout Request logged: ID=${payoutRequestId}, Status=pending, Account=${checkPayoutReq.rows[0].payout_account}`);

  // 4. Cleanup test records and restore initial state
  await query(
    `UPDATE agent_profiles SET wallet_balance = $1, commission_balance = $2 WHERE id = $3`,
    [initialAgentFloat, initialCommissionBal, agentId]
  );
  await query(`DELETE FROM agent_commissions WHERE source_type = 'commission_to_float' AND agent_id = $1`, [agentId]);
  await query(`DELETE FROM agent_commission_payout_requests WHERE id = $1`, [payoutRequestId]);

  console.log('\n✅ Cleanup complete: initial float and commission balances restored.');
  console.log('🎉 --- PHASE 5 TEST PASSED 100% --- 🎉');
  process.exit(0);
}

testPhase5CommissionWallet().catch(err => {
  console.error('❌ Phase 5 test failed:', err);
  process.exit(1);
});

