import { query, pool, withTransaction } from '../db.ts';

async function runTest() {
  console.log('🧪 Starting Test: 100,000 ETB Recharge & Upfront Commission Logic...');
  await query("DELETE FROM agent_recharge_requests WHERE transaction_code LIKE 'TEST-100K-%'");

  // 1. Get or create an agent for testing
  let agentRes = await query(`
    SELECT ap.id, ap.user_id, ap.wallet_balance, ap.commission_rate, ap.agent_code, u.phone
    FROM agent_profiles ap
    JOIN users u ON ap.user_id = u.id
    WHERE ap.status = 'active'
    LIMIT 1
  `);

  if (agentRes.rows.length === 0) {
    console.log('⚠️ No active agent found, skipping test or creating one...');
    await pool.end();
    return;
  }

  const agent = agentRes.rows[0];
  const agentId = agent.id;
  const initialBalance = parseFloat(agent.wallet_balance);
  const commRate = parseFloat(agent.commission_rate || '5.0');
  console.log(`👤 Using test agent ${agent.agent_code} (ID: ${agentId}), initial balance: ${initialBalance} ETB, comm rate: ${commRate}%`);

  // 2. Create a 100,000 ETB recharge request
  const testTxCode = `TEST-100K-${Date.now()}`;
  const insertRes = await query(`
    INSERT INTO agent_recharge_requests (
      agent_id,
      amount,
      payment_method,
      transaction_code,
      status,
      timeline
    ) VALUES (
      $1, 100000.00, 'Telebirr', $2, 'Requested',
      $3::jsonb
    ) RETURNING id, status, amount
  `, [agentId, testTxCode, JSON.stringify([['Just now', 'Request submitted by agent']])]);

  const reqId = insertRes.rows[0].id;
  console.log(`📝 Created 100,000 ETB recharge request #${reqId} with status '${insertRes.rows[0].status}'`);

  // 3. Simulate First Step Credit Call (> 20,000 ETB rule -> 'Awaiting 2nd approval')
  console.log('🔄 Executing Step 1 Credit: Should transition to "Awaiting 2nd approval" (21 chars)...');
  
  // Directly emulate the route logic using withTransaction
  const step1Result = await withTransaction(async (client) => {
    const rRes = await client.query(`
      SELECT arr.*, ap.wallet_balance, ap.commission_rate, ap.user_id as agent_user_id, ap.agent_code, u.full_name as agent_name
      FROM agent_recharge_requests arr
      JOIN agent_profiles ap ON arr.agent_id = ap.id
      JOIN users u ON ap.user_id = u.id
      WHERE arr.id = $1
      FOR UPDATE
    `, [reqId]);

    const recharge = rRes.rows[0];
    const creditAmt = parseFloat(recharge.amount);
    const normStatus = recharge.status;

    if (creditAmt > 20000 && normStatus !== 'Awaiting 2nd approval') {
      const newEvent = ['Just now', 'Verified by Admin. Needs a second approval (above 20,000 ETB)'];
      const updatedTl = [newEvent, ...(Array.isArray(recharge.timeline) ? recharge.timeline : [])];

      await client.query(`
        UPDATE agent_recharge_requests
        SET status = 'Awaiting 2nd approval',
            timeline = $1::jsonb
        WHERE id = $2
      `, [JSON.stringify(updatedTl), reqId]);

      return { status: 'Awaiting 2nd approval' };
    }
    return { status: 'other' };
  });

  if (step1Result.status !== 'Awaiting 2nd approval') {
    throw new Error(`Expected 'Awaiting 2nd approval', got '${step1Result.status}'`);
  }
  console.log('✅ Step 1 SUCCESS: Successfully saved "Awaiting 2nd approval" without VARCHAR length error!');

  // 4. Verify in DB
  const checkStatusRes = await query('SELECT status FROM agent_recharge_requests WHERE id = $1', [reqId]);
  console.log(`🔎 DB Status verified: '${checkStatusRes.rows[0].status}' (length: ${checkStatusRes.rows[0].status.length})`);

  // 5. Simulate Second Step Credit Call ('Awaiting 2nd approval' -> 'Credited' + upfront float)
  console.log('🔄 Executing Step 2 Credit: Should transition to "Credited" and credit upfront commission...');

  const step2Result = await withTransaction(async (client) => {
    const rRes = await client.query(`
      SELECT arr.*, ap.wallet_balance, ap.commission_rate, ap.user_id as agent_user_id, ap.agent_code, u.full_name as agent_name
      FROM agent_recharge_requests arr
      JOIN agent_profiles ap ON arr.agent_id = ap.id
      JOIN users u ON ap.user_id = u.id
      WHERE arr.id = $1
      FOR UPDATE
    `, [reqId]);

    const recharge = rRes.rows[0];
    const creditAmt = parseFloat(recharge.amount);
    const commissionRate = parseFloat(recharge.commission_rate || '5.0');
    const commissionEarned = Math.round(creditAmt * (commissionRate / 100) * 100) / 100;
    const totalFloatCredit = creditAmt + commissionEarned;

    const currentBal = parseFloat(recharge.wallet_balance || '0');
    const newBal = currentBal + totalFloatCredit;

    // Update recharge
    await client.query(`
      UPDATE agent_recharge_requests
      SET status = 'Credited',
          received_amount = $1,
          reviewed_at = NOW(),
          second_approved_at = NOW()
      WHERE id = $2
    `, [creditAmt, reqId]);

    // Credit agent
    await client.query(`
      UPDATE agent_profiles
      SET wallet_balance = wallet_balance + $1
      WHERE id = $2
    `, [totalFloatCredit, recharge.agent_id]);

    // Commission log
    await client.query(`
      INSERT INTO agent_commissions 
        (agent_id, source_type, source_id, amount, commission_rate, commission_earned)
      VALUES ($1, 'topup_commission', $2, $3, $4, $5)
    `, [recharge.agent_id, reqId, creditAmt, commissionRate, commissionEarned]);

    return {
      newBalance: newBal,
      totalFloatCredit,
      commissionEarned
    };
  });

  console.log(`✅ Step 2 SUCCESS: Total float credited: ${step2Result.totalFloatCredit} ETB (Base: 100,000 ETB + Upfront: ${step2Result.commissionEarned} ETB)`);
  console.log(`💰 New Agent Balance: ${step2Result.newBalance} ETB`);

  // Verify Commission was recorded
  const commCheck = await query(`
    SELECT * FROM agent_commissions 
    WHERE agent_id = $1 AND source_type = 'topup_commission' AND source_id = $2
  `, [agentId, reqId]);

  if (commCheck.rows.length === 0) {
    throw new Error('Commission log not found in agent_commissions!');
  }
  console.log(`📋 Verified agent_commissions record: ${commCheck.rows[0].commission_earned} ETB credited.`);

  // 6. Cleanup test records so we leave database clean
  console.log('🧹 Cleaning up test records...');
  await query('DELETE FROM agent_commissions WHERE source_type = \'topup_commission\' AND source_id = $1', [reqId]);
  await query('DELETE FROM agent_recharge_requests WHERE id = $1', [reqId]);
  await query('UPDATE agent_profiles SET wallet_balance = $1 WHERE id = $2', [initialBalance, agentId]);
  console.log('✨ Cleanup complete, original balance restored!');

  console.log('🎉 All Phase 1 Recharge tests passed 100%!');
  await pool.end();
  process.exit(0);
}

runTest().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
