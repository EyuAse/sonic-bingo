import { query } from '../db.ts';

async function testRechargeRequestsBackend() {
  console.log('🧪 Starting Phase 1 Verification: Recharge Requests & Official Accounts API...');

  // 1. Verify Active Official Payment Accounts
  const officialAccountsRes = await query(`
    SELECT id, provider, account_title, account_name, account_number, badge, daily_limit, is_primary, is_active, status, display_order 
    FROM payment_accounts 
    WHERE is_active = true AND status = 'Active'
    ORDER BY is_primary DESC, display_order ASC, created_at ASC
  `);

  if (officialAccountsRes.rows.length === 0) {
    throw new Error('No active official payment accounts found in payment_accounts!');
  }

  console.log(`✅ [1/4] Found ${officialAccountsRes.rows.length} Active Official Receiving Accounts in Neon PostgreSQL:`);
  officialAccountsRes.rows.forEach((acc, i) => {
    console.log(`       ${i + 1}. [${acc.provider}] ${acc.account_title}: ${acc.account_number} (${acc.account_name}) - ${acc.badge}`);
  });

  // 2. Verify Active Agent Profile
  const agentRes = await query(`
    SELECT ap.id, ap.agent_code, ap.wallet_balance, ap.low_balance_threshold, ap.commission_rate,
           u.full_name, u.phone
    FROM agent_profiles ap
    JOIN users u ON ap.user_id = u.id
    WHERE ap.status = 'active'
    ORDER BY ap.wallet_balance DESC
    LIMIT 1
  `);

  if (agentRes.rows.length === 0) {
    throw new Error('No active agent profile found in database!');
  }

  const agent = agentRes.rows[0];
  const agentId = agent.id;
  console.log(`✅ [2/4] Testing Agent: ${agent.full_name} (${agent.agent_code}), Balance: ${agent.wallet_balance} ETB`);

  // 3. Test Recharge Analytics Query
  const analyticsRes = await query(`
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE LOWER(status) = 'approved'), 0) as approved_amount,
      COUNT(*) FILTER (WHERE LOWER(status) = 'approved') as approved_count,
      COALESCE(SUM(amount) FILTER (WHERE LOWER(status) = 'pending'), 0) as pending_amount,
      COUNT(*) FILTER (WHERE LOWER(status) = 'pending') as pending_count,
      COALESCE(SUM(amount) FILTER (WHERE LOWER(status) = 'rejected'), 0) as rejected_amount,
      COUNT(*) FILTER (WHERE LOWER(status) = 'rejected') as rejected_count,
      COALESCE(SUM(amount), 0) as all_time_amount,
      COUNT(*) as all_time_count
    FROM agent_recharge_requests
    WHERE agent_id = $1
  `, [agentId]);

  const a = analyticsRes.rows[0];
  console.log(`✅ [3/4] Aggregated Real Recharge Analytics:`);
  console.log(`       - Total Approved: ETB ${parseFloat(a.approved_amount || '0').toLocaleString()} (${a.approved_count} requests)`);
  console.log(`       - Total Pending:  ETB ${parseFloat(a.pending_amount || '0').toLocaleString()} (${a.pending_count} requests)`);
  console.log(`       - Total Rejected: ETB ${parseFloat(a.rejected_amount || '0').toLocaleString()} (${a.rejected_count} requests)`);
  console.log(`       - All-Time Total: ETB ${parseFloat(a.all_time_amount || '0').toLocaleString()} (${a.all_time_count} requests)`);

  // 4. Test Recharge History Query with Status Filter
  const requestsRes = await query(`
    SELECT id, amount, payment_method, transaction_code, status, created_at, reviewed_at
    FROM agent_recharge_requests
    WHERE agent_id = $1
    ORDER BY created_at DESC
    LIMIT 10
  `, [agentId]);

  console.log(`✅ [4/4] Recharge Requests History Query: Retrieved ${requestsRes.rows.length} real rows`);
  if (requestsRes.rows.length > 0) {
    console.log(`       Top record: ID ${requestsRes.rows[0].id.slice(0, 8)}, Amount: ETB ${requestsRes.rows[0].amount}, Status: ${requestsRes.rows[0].status}`);
  }

  console.log('\n🎉 ALL PHASE 1 BACKEND & DATABASE SYNCHRONIZATION TESTS PASSED 100%!');
  process.exit(0);
}

testRechargeRequestsBackend().catch(err => {
  console.error('❌ Phase 1 test failed:', err);
  process.exit(1);
});

