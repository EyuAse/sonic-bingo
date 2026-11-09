import { query, withTransaction } from '../db.ts';
import assert from 'assert';

async function test() {
  console.log('🧪 Testing Upfront Float Bonus Registration & Update Logic...');

  const testPhone = '0999001122';
  const testName = 'Test Agent Float Bonus';
  const baseDeposit = 10000;
  const floatBonusRate = 5.0; // 5%
  const expectedBonus = 500; // 500 ETB
  const expectedTotalFloat = 10500; // 10,500 ETB

  // Clean up any existing test records first
  await query(`DELETE FROM users WHERE phone = $1`, [testPhone]);

  let agentProfileId: string = '';
  let userId: string = '';

  try {
    // 1. Simulate registration
    await withTransaction(async (client) => {
      const userRes = await client.query(
        `INSERT INTO users (phone, full_name, role, password_hash, pin_hash) 
         VALUES ($1, $2, 'agent', 'hash', 'hash') RETURNING id`,
        [testPhone, testName]
      );
      userId = userRes.rows[0].id;

      const upfrontComm = Math.round(baseDeposit * (floatBonusRate / 100) * 100) / 100;
      const totalInitialFloat = baseDeposit + upfrontComm;

      const apRes = await client.query(
        `INSERT INTO agent_profiles (
          user_id, agent_code, status, wallet_balance, initial_deposit,
          low_balance_threshold, target_monthly, target_players,
          commission_rate, cashout_commission_rate, city, portal_access
        )
        VALUES ($1, 'AGT-TEST-FLOAT', 'active', $2, $3, 5000.00, 50000, 50, $4, 0.00, 'Addis Ababa', true)
        RETURNING *`,
        [userId, totalInitialFloat, baseDeposit, floatBonusRate]
      );
      agentProfileId = apRes.rows[0].id;

      await client.query(
        `INSERT INTO agent_commissions 
          (agent_id, source_type, source_id, amount, commission_rate, commission_earned)
         VALUES ($1, 'topup_commission', $2, $3, $4, $5)`,
        [agentProfileId, agentProfileId, baseDeposit, floatBonusRate, upfrontComm]
      );
    });

    console.log(`✅ Test Agent created with ID: ${agentProfileId}`);

    // 2. Verify Initial Balance in DB
    const apCheck = await query(`SELECT wallet_balance, commission_rate, cashout_commission_rate FROM agent_profiles WHERE id = $1`, [agentProfileId]);
    const balance = parseFloat(apCheck.rows[0].wallet_balance);
    const commRate = parseFloat(apCheck.rows[0].commission_rate);
    const cashoutRate = parseFloat(apCheck.rows[0].cashout_commission_rate);

    console.log(`💰 Agent Initial Wallet: ${balance} ETB (Expected: ${expectedTotalFloat} ETB)`);
    console.log(`📊 Float Bonus Rate: ${commRate}% (Expected: ${floatBonusRate}%)`);
    console.log(`🚫 Cashout Rate: ${cashoutRate}% (Expected: 0%)`);

    assert.strictEqual(balance, expectedTotalFloat, `Initial wallet must be ${expectedTotalFloat} ETB`);
    assert.strictEqual(commRate, floatBonusRate, `Float bonus rate must be ${floatBonusRate}%`);
    assert.strictEqual(cashoutRate, 0, `Cashout rate must be 0%`);

    // 3. Verify audit record
    const commCheck = await query(`SELECT amount, commission_earned, source_type FROM agent_commissions WHERE agent_id = $1`, [agentProfileId]);
    assert.strictEqual(commCheck.rows.length, 1, 'Should have 1 upfront bonus record');
    assert.strictEqual(parseFloat(commCheck.rows[0].commission_earned), expectedBonus, `Earned upfront bonus must be ${expectedBonus} ETB`);
    console.log(`📋 Verified Upfront Commission Audit Record: ${commCheck.rows[0].commission_earned} ETB credited`);

    // 4. Test updating float bonus rate (e.g. from 5% to 6.5%)
    await query(`UPDATE agent_profiles SET commission_rate = $1, cashout_commission_rate = 0.00 WHERE id = $2`, [6.5, agentProfileId]);
    const updatedCheck = await query(`SELECT commission_rate, cashout_commission_rate FROM agent_profiles WHERE id = $1`, [agentProfileId]);
    assert.strictEqual(parseFloat(updatedCheck.rows[0].commission_rate), 6.5, 'Float bonus rate updated to 6.5%');
    console.log(`🔄 Updated float bonus rate to 6.5% successfully!`);

    console.log('🎉 All Upfront Float Bonus Registration & Update tests passed 100%!');
  } finally {
    // Cleanup
    if (userId) {
      await query(`DELETE FROM users WHERE id = $1`, [userId]);
      console.log('🧹 Cleaned up test agent and associated records.');
    }
  }
}

test().then(() => process.exit(0)).catch(e => { console.error('❌ Test failed:', e); process.exit(1); });

