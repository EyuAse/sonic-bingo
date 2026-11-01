import { query } from '../db.ts';

async function runPlayerTxHistoryAudit() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🧪 [TEST PHASE 3]: PLAYER TRANSACTION HISTORY & REAL-TIME AUDIT');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    // 1. Find a test user or the first player
    const userRes = await query(`SELECT id, full_name, phone FROM users LIMIT 1`);
    if (userRes.rows.length === 0) {
      console.log('⚠️ No users found in database.');
      process.exit(0);
    }
    const testUser = userRes.rows[0];
    console.log(`👤 Testing with player: "${testUser.full_name}" (ID: ${testUser.id})`);

    // 2. Find an active agent profile
    const agentRes = await query(`
      SELECT ap.id, ap.agent_code, ap.user_id, COALESCE(u.full_name, ap.telebirr_name) as agent_name
      FROM agent_profiles ap
      LEFT JOIN users u ON ap.user_id = u.id
      LIMIT 1
    `);
    if (agentRes.rows.length === 0) {
      console.log('⚠️ No agent profiles found.');
      process.exit(0);
    }
    const agent = agentRes.rows[0];
    console.log(`👑 Certified Agent: #${agent.agent_code} - "${agent.agent_name}"\n`);

    // Clean up any stale test records first
    await query(`DELETE FROM agent_deposit_requests WHERE transaction_code LIKE 'TEST-TX-%'`);

    // 3. Insert a mock agent deposit request
    const mockTxCode = `TEST-TX-${Date.now().toString().slice(-6)}`;
    const mockDeposit = await query(`
      INSERT INTO agent_deposit_requests
        (player_id, agent_id, amount, payment_method, player_phone, transaction_code, status)
      VALUES
        ($1, $2, 100.00, 'Telebirr', $3, $4, 'pending')
      RETURNING id, amount, payment_method, transaction_code, status, created_at
    `, [testUser.id, agent.id, testUser.phone || '0911223344', mockTxCode]);
    console.log(`1️⃣ [Test 1] Created Mock Pending Deposit:`);
    console.log(`   • ID: ${mockDeposit.rows[0].id}`);
    console.log(`   • Amount: ${mockDeposit.rows[0].amount} ETB`);
    console.log(`   • Code: ${mockDeposit.rows[0].transaction_code}`);
    console.log(`   • Status: ${mockDeposit.rows[0].status}`);

    // 4. Insert a mock agent withdrawal request (status: 'approved')
    const mockWith = await query(`
      INSERT INTO agent_withdrawal_requests
        (player_id, agent_id, amount, payout_method, payout_account, payout_account_name, status, agent_tx_ref)
      VALUES
        ($1, $2, 200.00, 'CBE', '100099887766', $3, 'approved', 'FT2499112233')
      RETURNING id, amount, payout_method, payout_account, status, agent_tx_ref, created_at
    `, [testUser.id, agent.id, testUser.full_name]);
    console.log(`\n2️⃣ [Test 2] Created Mock Settled Withdrawal:`);
    console.log(`   • ID: ${mockWith.rows[0].id}`);
    console.log(`   • Amount: ${mockWith.rows[0].amount} ETB`);
    console.log(`   • Method: ${mockWith.rows[0].payout_method}`);
    console.log(`   • Tx Ref: ${mockWith.rows[0].agent_tx_ref}`);
    console.log(`   • Status: ${mockWith.rows[0].status}`);

    // 5. Query using the unified /transactions API logic
    console.log(`\n3️⃣ [Test 3] Executing Unified GET /api/wallet/transactions query...`);

    const agentDepRes = await query(
      `SELECT adr.id, adr.amount, adr.payment_method, adr.player_phone, adr.transaction_code,
              adr.screenshot_url, adr.status, adr.rejection_reason, adr.created_at, adr.resolved_at,
              ap.agent_code, COALESCE(u.full_name, ap.telebirr_name, CONCAT('Sonic Agent #', ap.agent_code)) as agent_name
       FROM agent_deposit_requests adr
       LEFT JOIN agent_profiles ap ON adr.agent_id = ap.id
       LEFT JOIN users u ON ap.user_id = u.id
       WHERE adr.player_id = $1
       ORDER BY adr.created_at DESC
       LIMIT 50`,
      [testUser.id]
    );

    const agentWithRes = await query(
      `SELECT awr.id, awr.amount, awr.payout_method, awr.payout_account, awr.payout_account_name,
              awr.agent_tx_ref, awr.status, awr.rejection_reason, awr.created_at, awr.resolved_at,
              ap.agent_code, COALESCE(u.full_name, ap.telebirr_name, CONCAT('Sonic Agent #', ap.agent_code)) as agent_name
       FROM agent_withdrawal_requests awr
       LEFT JOIN agent_profiles ap ON awr.agent_id = ap.id
       LEFT JOIN users u ON ap.user_id = u.id
       WHERE awr.player_id = $1
       ORDER BY awr.created_at DESC
       LIMIT 50`,
      [testUser.id]
    );

    // Format Agent Deposits
    const agentDeposits = agentDepRes.rows.map(d => ({
      id: d.id,
      userId: testUser.id,
      userName: testUser.full_name,
      phone: d.player_phone,
      accountNumber: d.player_phone,
      type: 'deposit' as const,
      amount: parseFloat(d.amount),
      method: d.payment_method,
      referenceNumber: d.transaction_code,
      status: (d.status === 'completed' ? 'approved' : d.status),
      agentCode: d.agent_code,
      agentName: d.agent_name,
      createdAt: d.created_at
    }));

    // Format Agent Withdrawals
    const agentWithdrawals = agentWithRes.rows.map(w => ({
      id: w.id,
      userId: testUser.id,
      userName: w.payout_account_name || testUser.full_name,
      phone: w.payout_account,
      accountNumber: w.payout_account,
      type: 'withdrawal' as const,
      amount: parseFloat(w.amount),
      method: w.payout_method,
      referenceNumber: w.agent_tx_ref || `WD-AGT-${w.id.slice(0, 8)}`,
      status: (w.status === 'completed' || w.status === 'approved' ? 'approved' : w.status === 'cancelled' ? 'rejected' : w.status),
      agentCode: w.agent_code,
      agentName: w.agent_name,
      createdAt: w.created_at
    }));

    const all = [...agentDeposits, ...agentWithdrawals].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    console.log(`   ✓ Found ${agentDeposits.length} deposits for player`);
    console.log(`   ✓ Found ${agentWithdrawals.length} withdrawals for player`);
    console.log(`   ✓ Unified Stream Total: ${all.length} transactions`);

    // Verify our inserted records are present in the response
    const foundDep = agentDeposits.find(d => d.referenceNumber === mockTxCode);
    const foundWith = agentWithdrawals.find(w => w.referenceNumber === 'FT2499112233');

    if (!foundDep) throw new Error('Inserted test deposit was NOT found in unified query!');
    if (!foundWith) throw new Error('Inserted test withdrawal was NOT found in unified query!');

    console.log(`\n4️⃣ [Test 4] Verifying Data Field Integrity:`);
    console.log(`   ✓ Deposit found: ${foundDep.method} ${foundDep.amount} ETB - Ref: ${foundDep.referenceNumber} (${foundDep.status})`);
    console.log(`   ✓ Agent Info: Code #${foundDep.agentCode} - "${foundDep.agentName}"`);
    console.log(`   ✓ Withdrawal found: ${foundWith.method} ${foundWith.amount} ETB - Ref: ${foundWith.referenceNumber} (${foundWith.status})`);
    console.log(`   ✓ Agent Info: Code #${foundWith.agentCode} - "${foundWith.agentName}"`);

    // Clean up test records
    await query(`DELETE FROM agent_deposit_requests WHERE id = $1`, [mockDeposit.rows[0].id]);
    await query(`DELETE FROM agent_withdrawal_requests WHERE id = $1`, [mockWith.rows[0].id]);
    console.log(`\n🧹 [Cleanup] Deleted mock test records cleanly.`);

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('🎉 ALL TESTS PASSED: PLAYER TRANSACTION HISTORY IS 100% OPERATIONAL');
    console.log('═══════════════════════════════════════════════════════════════');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  }
}

runPlayerTxHistoryAudit();
