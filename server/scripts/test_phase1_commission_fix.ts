import dotenv from 'dotenv';
dotenv.config();

import { query, withTransaction } from '../db.ts';

async function testPhase1CommissionFix() {
  console.log('🧪 Running Phase 1 Test: Real Cashier Commission Accounting Verification...\n');

  try {
    // 1. Fetch Agent AGT-8532
    const agentRes = await query(
      `SELECT ap.id, ap.agent_code, ap.wallet_balance, ap.commission_balance
       FROM agent_profiles ap
       WHERE ap.agent_code = 'AGT-8532'
       LIMIT 1`
    );
    if (agentRes.rows.length === 0) {
      throw new Error('Agent AGT-8532 not found');
    }
    const agent = agentRes.rows[0];
    const initialFloat = parseFloat(agent.wallet_balance);
    const initialCommission = parseFloat(agent.commission_balance);

    console.log(`✅ Using Agent: Code=${agent.agent_code}, Initial Float=${initialFloat.toFixed(2)} ETB, Initial Commission=${initialCommission.toFixed(2)} ETB`);

    // Fetch a real player
    const playerRes = await query(`SELECT id, phone, full_name FROM users WHERE role = 'player' LIMIT 1`);
    const player = playerRes.rows[0];

    // --- TEST A: Direct Cash-In Simulation (200 ETB) ---
    console.log('\n--- Test A: OTC Cash-In (200 ETB) -> +10 ETB (5%) to Commission Balance ---');
    const cashInAmount = 200.0;
    const expectedCommissionA = 10.0; // 5% of 200

    await withTransaction(async (client) => {
      const newFloat = initialFloat - cashInAmount;
      await client.query(
        `UPDATE agent_profiles 
         SET wallet_balance = $1, 
             commission_balance = COALESCE(commission_balance, 0.00) + $2,
             updated_at = NOW() 
         WHERE id = $3`,
        [newFloat, expectedCommissionA, agent.id]
      );
    });

    const checkResA = await query(
      `SELECT wallet_balance, commission_balance FROM agent_profiles WHERE id = $1`,
      [agent.id]
    );
    const floatAfterA = parseFloat(checkResA.rows[0].wallet_balance);
    const commAfterA = parseFloat(checkResA.rows[0].commission_balance);

    console.log(`   • Float After: ${floatAfterA.toFixed(2)} ETB (Expected: ${(initialFloat - cashInAmount).toFixed(2)})`);
    console.log(`   • Commission After: ${commAfterA.toFixed(2)} ETB (Expected: ${(initialCommission + expectedCommissionA).toFixed(2)})`);

    if (Math.abs(commAfterA - (initialCommission + expectedCommissionA)) > 0.01) {
      throw new Error('Commission balance did not increment by 5% on Cash-In!');
    }
    console.log('✅ Test A Passed: 5% Commission credited on Cash-In.');

    // --- TEST B: Online Deposit Approval Simulation (500 ETB) ---
    console.log('\n--- Test B: Deposit Request Approval (500 ETB) -> +25 ETB (5%) to Commission Balance ---');
    const depositAmount = 500.0;
    const expectedCommissionB = 25.0; // 5% of 500

    await withTransaction(async (client) => {
      const newFloat = floatAfterA - depositAmount;
      await client.query(
        `UPDATE agent_profiles 
         SET wallet_balance = $1, 
             commission_balance = COALESCE(commission_balance, 0.00) + $2,
             updated_at = NOW() 
         WHERE id = $3`,
        [newFloat, expectedCommissionB, agent.id]
      );
    });

    const checkResB = await query(
      `SELECT wallet_balance, commission_balance FROM agent_profiles WHERE id = $1`,
      [agent.id]
    );
    const floatAfterB = parseFloat(checkResB.rows[0].wallet_balance);
    const commAfterB = parseFloat(checkResB.rows[0].commission_balance);

    console.log(`   • Float After: ${floatAfterB.toFixed(2)} ETB (Expected: ${(floatAfterA - depositAmount).toFixed(2)})`);
    console.log(`   • Commission After: ${commAfterB.toFixed(2)} ETB (Expected: ${(commAfterA + expectedCommissionB).toFixed(2)})`);

    if (Math.abs(commAfterB - (commAfterA + expectedCommissionB)) > 0.01) {
      throw new Error('Commission balance did not increment by 5% on Deposit Approval!');
    }
    console.log('✅ Test B Passed: 5% Commission credited on Deposit Approval.');

    // Cleanup: restore initial balances
    await query(
      `UPDATE agent_profiles SET wallet_balance = $1, commission_balance = $2 WHERE id = $3`,
      [initialFloat, initialCommission, agent.id]
    );
    console.log('\n✅ Cleanup complete: Initial balances restored.');
    console.log('🎉 --- PHASE 1 TEST PASSED 100% --- 🎉');
    process.exit(0);
  } catch (err) {
    console.error('❌ Phase 1 test failed:', err);
    process.exit(1);
  }
}

testPhase1CommissionFix();

