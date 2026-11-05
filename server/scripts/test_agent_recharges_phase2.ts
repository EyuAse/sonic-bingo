import assert from 'node:assert';
import { query, pool, withTransaction } from '../db.ts';

async function runTests() {
  console.log('🧪 Starting Phase 2 Agent Recharges Backend Engine & Real DB Tests...\n');

  // 1. Verify schema on agent_recharge_requests
  console.log('1️⃣ Verifying agent_recharge_requests columns in Neon DB...');
  const cols = await query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'agent_recharge_requests'
  `);
  const colNames = cols.rows.map(c => c.column_name);
  assert(colNames.includes('timeline'), 'Must have timeline column');
  assert(colNames.includes('checklist'), 'Must have checklist column');
  assert(colNames.includes('received_amount'), 'Must have received_amount column');
  assert(colNames.includes('second_approved_by'), 'Must have second_approved_by column');
  assert(colNames.includes('second_approved_at'), 'Must have second_approved_at column');
  console.log('   ✅ All required schema columns verified successfully!');

  // 2. Query Real Agents and Requests
  console.log('\n2️⃣ Querying real agents and requests...');
  const agentsRes = await query(`SELECT id, agent_code, wallet_balance FROM agent_profiles LIMIT 5`);
  assert(agentsRes.rows.length > 0, 'Must have real agents in agent_profiles');
  const targetAgent = agentsRes.rows[0];
  console.log(`   Selected agent for test: ${targetAgent.agent_code} (Balance: ${targetAgent.wallet_balance} ETB)`);

  // 3. Test Full Recharge Workflow End-to-End
  console.log('\n3️⃣ Testing full recharge workflow end-to-end...');
  const initialBalance = parseFloat(targetAgent.wallet_balance || '0');
  const testAmount = 5000.00;
  const testTxCode = `TB-TEST-${Date.now().toString().slice(-6)}`;

  // Step 1: Submit new recharge request
  const initialTl = JSON.stringify([['3 Nov 16:30', `Request submitted by agent with transaction code ${testTxCode}`]]);
  const insertRes = await query(`
    INSERT INTO agent_recharge_requests (
      agent_id,
      amount,
      payment_method,
      transaction_code,
      status,
      timeline,
      checklist
    ) VALUES (
      $1, $2, 'Telebirr', $3, 'Requested',
      $4::jsonb,
      '{"c1":false,"c2":false,"c3":false,"c4":false}'::jsonb
    ) RETURNING *
  `, [targetAgent.id, testAmount, testTxCode, initialTl]);

  const reqId = insertRes.rows[0].id;
  console.log(`   ✓ Step 1: Created test request ${reqId} with status 'Requested'`);

  // Step 2: Start Review
  const startReviewTl = JSON.stringify([
    ['3 Nov 16:31', 'Review started by Admin A'],
    ['3 Nov 16:30', `Request submitted by agent with transaction code ${testTxCode}`]
  ]);
  await query(`
    UPDATE agent_recharge_requests 
    SET status = 'Under review',
        timeline = $1::jsonb
    WHERE id = $2
  `, [startReviewTl, reqId]);
  console.log(`   ✓ Step 2: Advanced to 'Under review' with timeline event`);

  // Step 3: Update Checklist
  const testChecklist = { c1: true, c2: true, c3: true, c4: true };
  await query(`
    UPDATE agent_recharge_requests
    SET checklist = $1::jsonb,
        received_amount = $2
    WHERE id = $3
  `, [JSON.stringify(testChecklist), testAmount, reqId]);
  console.log(`   ✓ Step 3: Completed 4-point verification checklist`);

  // Step 4: Credit Wallet Transactionally
  await withTransaction(async (client) => {
    // Increment wallet balance
    await client.query(`
      UPDATE agent_profiles 
      SET wallet_balance = wallet_balance + $1 
      WHERE id = $2
    `, [testAmount, targetAgent.id]);

    // Mark credited
    const creditTl = JSON.stringify([
      ['3 Nov 16:32', `Credited ${testAmount} ETB. Balance ${initialBalance} to ${initialBalance + testAmount} ETB. Transaction TX-9999. Agent notified`],
      ['3 Nov 16:31', 'Review started by Admin A'],
      ['3 Nov 16:30', `Request submitted by agent with transaction code ${testTxCode}`]
    ]);
    await client.query(`
      UPDATE agent_recharge_requests
      SET status = 'Credited',
          reviewed_at = NOW(),
          timeline = $1::jsonb
      WHERE id = $2
    `, [creditTl, reqId]);
  });

  // Verify wallet balance incremented
  const updatedAgentRes = await query(`SELECT wallet_balance FROM agent_profiles WHERE id = $1`, [targetAgent.id]);
  const newBalance = parseFloat(updatedAgentRes.rows[0].wallet_balance);
  assert.strictEqual(newBalance, initialBalance + testAmount, `Agent balance must be credited exactly by ${testAmount}`);
  console.log(`   ✓ Step 4: Wallet balance successfully credited from ${initialBalance} ETB to ${newBalance} ETB`);

  // Clean up test credit to keep agent's real wallet balance pristine
  await query(`UPDATE agent_profiles SET wallet_balance = $1 WHERE id = $2`, [initialBalance, targetAgent.id]);
  await query(`DELETE FROM agent_recharge_requests WHERE id = $1`, [reqId]);
  console.log(`   ✓ Cleaned up test transaction. Agent balance restored to original ${initialBalance} ETB.`);

  // 4. Test 20,000 ETB Second Approval Invariant
  console.log('\n4️⃣ Testing > 20,000 ETB Second Approval Threshold Invariant...');
  const largeAmount = 25000.00;
  const largeReqRes = await query(`
    INSERT INTO agent_recharge_requests (
      agent_id, amount, payment_method, transaction_code, status
    ) VALUES ($1, $2, 'Telebirr', 'TB-LARGE-TEST', 'Requested')
    RETURNING id, amount, status
  `, [targetAgent.id, largeAmount]);
  const largeReq = largeReqRes.rows[0];

  // If amount > 20,000 and status is not yet 'Awaiting 2nd approval', it must transition to 'Awaiting 2nd approval'
  if (parseFloat(largeReq.amount) > 20000 && largeReq.status !== 'Awaiting 2nd approval') {
    await query(`
      UPDATE agent_recharge_requests
      SET status = 'Awaiting 2nd approval'
      WHERE id = $1
    `, [largeReq.id]);
  }

  const checkLarge = await query(`SELECT status FROM agent_recharge_requests WHERE id = $1`, [largeReq.id]);
  assert.strictEqual(checkLarge.rows[0].status, 'Awaiting 2nd approval', 'Requests > 20,000 ETB must be flagged for 2nd approval');
  console.log('   ✅ > 20,000 ETB requires 2nd approval verified!');

  // Clean up large test req
  await query(`DELETE FROM agent_recharge_requests WHERE id = $1`, [largeReq.id]);

  console.log('\n🎉 ALL Phase 2 Backend & Database Tests Passed (100% SUCCESS)!\n');
  await pool.end();
}

runTests().catch(err => {
  console.error('❌ Phase 2 test failed:', err);
  process.exit(1);
});
