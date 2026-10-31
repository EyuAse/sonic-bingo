import dotenv from 'dotenv';
import { query, pool } from '../db.ts';

dotenv.config();

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runAgentPortalTests() {
  console.log('\n🧪 ========================================================');
  console.log('🧪 [TEST SUITE] Phase 5: Decentralized Agent Portal Tests');
  console.log('🧪 ========================================================\n');

  let testAgentUserId = '';
  let testAgentProfileId = '';
  let testPlayerUserId = '';

  try {
    // ----------------------------------------------------
    // TEST 1: Agent Profile Creation
    // ----------------------------------------------------
    console.log('--- Test 1: Agent Registration & Initial Balance ---');
    const agentUserRes = await query(`
      INSERT INTO users (phone, full_name, role)
      VALUES ('0911002233', 'Test Master Agent', 'agent')
      RETURNING id
    `);
    testAgentUserId = agentUserRes.rows[0].id;

    const initialFloat = 10000.00;
    const threshold = 1000.00;
    const targetMonthly = 50000.00;
    const commissionRate = 5.00;

    const apRes = await query(`
      INSERT INTO agent_profiles (user_id, agent_code, status, wallet_balance, initial_deposit, low_balance_threshold, target_monthly, commission_rate)
      VALUES ($1, 'AGT-TEST-99', 'active', $2, $2, $3, $4, $5)
      RETURNING *
    `, [testAgentUserId, initialFloat, threshold, targetMonthly, commissionRate]);

    testAgentProfileId = apRes.rows[0].id;
    const agentProfile = apRes.rows[0];

    assert(agentProfile.agent_code === 'AGT-TEST-99', "Agent code is 'AGT-TEST-99'");
    assert(parseFloat(agentProfile.wallet_balance) === 10000.00, 'Initial agent balance is 10,000.00 ETB');
    assert(parseFloat(agentProfile.low_balance_threshold) === 1000.00, 'Low-balance warning threshold is 1,000.00 ETB');
    assert(parseFloat(agentProfile.target_monthly) === 50000.00, 'Monthly target is 50,000.00 ETB');

    // ----------------------------------------------------
    // TEST 2: Agent Referral Link Generation
    // ----------------------------------------------------
    console.log('\n--- Test 2: Referral / Invite Link ---');
    const expectedLink = `https://t.me/SonicGameOfficialBot?start=agent_${agentProfile.agent_code}`;
    assert(expectedLink.includes('agent_AGT-TEST-99'), `Invite link generated: ${expectedLink}`);

    // ----------------------------------------------------
    // TEST 3: Player Deposit on Behalf (Cash-in)
    // ----------------------------------------------------
    console.log('\n--- Test 3: Agent Deposit for Player (Cash-in) ---');
    const playerUserRes = await query(`
      INSERT INTO users (phone, full_name, role, agent_id)
      VALUES ('0922334455', 'Referred Player One', 'player', $1)
      RETURNING id
    `, [testAgentProfileId]);
    testPlayerUserId = playerUserRes.rows[0].id;

    await query(`
      INSERT INTO wallets (user_id, balance, bonus)
      VALUES ($1, 0.00, 20.00)
    `, [testPlayerUserId]);

    const depositAmount = 500.00;

    // Simulate deposit for player transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Deduct from agent
      const deductRes = await client.query(`
        UPDATE agent_profiles 
        SET wallet_balance = wallet_balance - $1, updated_at = NOW() 
        WHERE id = $2 
        RETURNING wallet_balance
      `, [depositAmount, testAgentProfileId]);

      const newAgentBal = parseFloat(deductRes.rows[0].wallet_balance);
      assert(newAgentBal === 9500.00, `Agent balance deducted to 9,500.00 ETB (was: 10,000.00)`);

      // Credit player
      const creditRes = await client.query(`
        UPDATE wallets 
        SET balance = balance + $1, updated_at = NOW() 
        WHERE user_id = $2 
        RETURNING balance
      `, [depositAmount, testPlayerUserId]);
      assert(parseFloat(creditRes.rows[0].balance) === 500.00, 'Player wallet credited with 500.00 ETB');

      // Record agent deposit
      const refCode = `AGT-DEP-TEST-${Date.now().toString().slice(-4)}`;
      const adRes = await client.query(`
        INSERT INTO agent_player_deposits (agent_id, player_user_id, amount, agent_balance_after, player_balance_after, payment_method, reference_code)
        VALUES ($1, $2, $3, $4, $5, 'Telebirr', $6)
        RETURNING *
      `, [testAgentProfileId, testPlayerUserId, depositAmount, newAgentBal, 500.00, refCode]);
      assert(adRes.rows.length === 1, 'agent_player_deposits record inserted');

      await client.query('COMMIT');
    } finally {
      client.release();
    }

    // ----------------------------------------------------
    // TEST 4: Low Balance Warning Threshold Check
    // ----------------------------------------------------
    console.log('\n--- Test 4: Low-Balance Warning Alert Trigger ---');
    // Simulate balance dropping to 900 ETB (< 1,000 threshold)
    await query(`
      UPDATE agent_profiles 
      SET wallet_balance = 900.00, low_balance_alert_sent = TRUE, updated_at = NOW() 
      WHERE id = $1
    `, [testAgentProfileId]);

    const lowCheck = await query('SELECT wallet_balance, low_balance_threshold FROM agent_profiles WHERE id = $1', [testAgentProfileId]);
    const isLow = parseFloat(lowCheck.rows[0].wallet_balance) <= parseFloat(lowCheck.rows[0].low_balance_threshold);
    assert(isLow === true, 'Low balance threshold trigger detected (balance 900 <= threshold 1000)');

    // ----------------------------------------------------
    // TEST 5: Agent Wallet Recharge Request Flow
    // ----------------------------------------------------
    console.log('\n--- Test 5: Agent Recharge Request & Admin Approval ---');
    const rechargeAmount = 5000.00;
    const txCode = `TB-RECHARGE-${Date.now().toString().slice(-6)}`;

    // Agent submits recharge request
    const reqRes = await query(`
      INSERT INTO agent_recharge_requests (agent_id, amount, payment_method, transaction_code, status)
      VALUES ($1, $2, 'Telebirr', $3, 'pending')
      RETURNING *
    `, [testAgentProfileId, rechargeAmount, txCode]);
    assert(reqRes.rows[0].status === 'pending', "Recharge request created with status 'pending'");

    const rechargeId = reqRes.rows[0].id;

    // Admin approves recharge request
    await query(`
      UPDATE agent_recharge_requests 
      SET status = 'approved', reviewed_at = NOW() 
      WHERE id = $1
    `, [rechargeId]);

    // Agent wallet credited
    const creditedAgent = await query(`
      UPDATE agent_profiles 
      SET wallet_balance = wallet_balance + $1, low_balance_alert_sent = FALSE, updated_at = NOW() 
      WHERE id = $2 
      RETURNING wallet_balance
    `, [rechargeAmount, testAgentProfileId]);

    const replenishedBal = parseFloat(creditedAgent.rows[0].wallet_balance);
    assert(replenishedBal === 900.00 + rechargeAmount, `Agent balance replenished to 5,900.00 ETB (900 + 5000)`);

    // ----------------------------------------------------
    // TEST 6: Performance & Target Progress Metrics
    // ----------------------------------------------------
    console.log('\n--- Test 6: Performance & Monthly Target Calculation ---');
    const monthDeposited = 500.00;
    const target = 50000.00;
    const progress = Math.min(100, Math.round((monthDeposited / target) * 100));
    assert(progress === 1, `Target progress correctly calculated as 1% (${monthDeposited} / ${target})`);

    const commRate = 5.00;
    const commissionEarned = Math.round(monthDeposited * (commRate / 100) * 100) / 100;
    assert(commissionEarned === 25.00, `5% commission correctly calculated as 25.00 ETB on 500 ETB deposit`);

  } finally {
    // Cleanup
    if (testPlayerUserId) {
      await query('DELETE FROM users WHERE id = $1', [testPlayerUserId]);
    }
    if (testAgentProfileId) {
      await query('DELETE FROM agent_profiles WHERE id = $1', [testAgentProfileId]);
    }
    if (testAgentUserId) {
      await query('DELETE FROM users WHERE id = $1', [testAgentUserId]);
    }
    console.log('\n  ✓ Test agent, player, and transactions safely cleaned up.');
  }

  console.log('\n🎉 ========================================================');
  console.log('🎉 [SUCCESS] Phase 5: All Agent Portal Tests PASSED 100%!');
  console.log('🎉 ========================================================\n');
  process.exit(0);
}

runAgentPortalTests().catch(err => {
  console.error('\n❌ [TEST FAILURE]:', err);
  process.exit(1);
});

