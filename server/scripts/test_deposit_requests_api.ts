import { query } from '../db.ts';

async function testDepositRequestsData() {
  console.log('🧪 Inspecting Neon DB for Agent Deposit Requests...');

  // 1. Get Active Agent
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
  console.log(`✅ [1/3] Found Active Agent: ${agent.full_name} (${agent.agent_code})`);
  console.log(`       Wallet: ETB ${agent.wallet_balance}, Alert Threshold: ETB ${agent.low_balance_threshold}`);

  // 2. Query Agent Deposit Requests Breakdown
  const reqStatsRes = await query(`
    SELECT
      COUNT(*) as total_requests,
      COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
      COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0) as pending_sum,
      ROUND(EXTRACT(EPOCH FROM (NOW() - MIN(created_at) FILTER (WHERE status = 'pending'))) / 60) as oldest_waiting_min,
      COUNT(*) FILTER (WHERE status = 'approved' AND (created_at AT TIME ZONE 'Africa/Addis_Ababa')::date = (NOW() AT TIME ZONE 'Africa/Addis_Ababa')::date) as accepted_today_count,
      COALESCE(SUM(amount) FILTER (WHERE status = 'approved' AND (created_at AT TIME ZONE 'Africa/Addis_Ababa')::date = (NOW() AT TIME ZONE 'Africa/Addis_Ababa')::date), 0) as accepted_today_sum,
      COUNT(*) FILTER (WHERE status = 'rejected' AND (created_at AT TIME ZONE 'Africa/Addis_Ababa')::date = (NOW() AT TIME ZONE 'Africa/Addis_Ababa')::date) as rejected_today_count,
      COALESCE(SUM(amount) FILTER (WHERE status = 'rejected' AND (created_at AT TIME ZONE 'Africa/Addis_Ababa')::date = (NOW() AT TIME ZONE 'Africa/Addis_Ababa')::date), 0) as rejected_today_sum
    FROM agent_deposit_requests
    WHERE agent_id = $1
  `, [agentId]);

  const stats = reqStatsRes.rows[0];
  console.log(`✅ [2/3] Deposit Requests Real Stats for ${agent.agent_code}:`);
  console.log(`       - Total: ${stats.total_requests}`);
  console.log(`       - Pending: ${stats.pending_count} (Sum: ETB ${stats.pending_sum}, Oldest: ${stats.oldest_waiting_min || 0} min)`);
  console.log(`       - Accepted Today: ${stats.accepted_today_count} (Sum: ETB ${stats.accepted_today_sum})`);
  console.log(`       - Rejected Today: ${stats.rejected_today_count} (Sum: ETB ${stats.rejected_today_sum})`);

  // 3. Query sample requests
  const sampleRes = await query(`
    SELECT req.id, req.amount, req.payment_method, req.player_phone, req.transaction_code, req.status, req.created_at,
           u.full_name as player_name
    FROM agent_deposit_requests req
    JOIN users u ON req.player_id = u.id
    WHERE req.agent_id = $1
    ORDER BY req.created_at DESC
    LIMIT 5
  `, [agentId]);

  console.log(`✅ [3/3] Found ${sampleRes.rows.length} sample requests:`);
  sampleRes.rows.forEach(r => {
    console.log(`       ${r.id.slice(0, 8)} | ${r.player_name} (${r.player_phone}) | ETB ${r.amount} | ${r.payment_method} | ${r.status}`);
  });

  process.exit(0);
}

testDepositRequestsData().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

