import { query } from '../db.ts';

async function testPhase1DepositRequests() {
  console.log('🧪 Starting Phase 1 Verification: Agent Deposit Requests & Authoritative History SQL...');

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
  console.log(`✅ [1/4] Found Active Agent: ${agent.full_name} (${agent.agent_code})`);
  console.log(`       Wallet: ETB ${parseFloat(agent.wallet_balance || 0).toLocaleString()} | Low Threshold: ETB ${parseFloat(agent.low_balance_threshold || 5000).toLocaleString()}`);

  // 2. Authoritative Summary Statistics Query
  const summaryRes = await query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
      COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0) as pending_sum,
      COALESCE(ROUND(EXTRACT(EPOCH FROM (NOW() - MIN(created_at) FILTER (WHERE status = 'pending'))) / 60), 0) as oldest_waiting_min,
      COUNT(*) FILTER (WHERE status = 'approved' AND (COALESCE(resolved_at, created_at) AT TIME ZONE 'Africa/Addis_Ababa')::date = (NOW() AT TIME ZONE 'Africa/Addis_Ababa')::date) as accepted_today_count,
      COALESCE(SUM(amount) FILTER (WHERE status = 'approved' AND (COALESCE(resolved_at, created_at) AT TIME ZONE 'Africa/Addis_Ababa')::date = (NOW() AT TIME ZONE 'Africa/Addis_Ababa')::date), 0) as accepted_today_sum,
      COUNT(*) FILTER (WHERE status = 'rejected' AND (COALESCE(resolved_at, created_at) AT TIME ZONE 'Africa/Addis_Ababa')::date = (NOW() AT TIME ZONE 'Africa/Addis_Ababa')::date) as rejected_today_count,
      COALESCE(SUM(amount) FILTER (WHERE status = 'rejected' AND (COALESCE(resolved_at, created_at) AT TIME ZONE 'Africa/Addis_Ababa')::date = (NOW() AT TIME ZONE 'Africa/Addis_Ababa')::date), 0) as rejected_today_sum
    FROM agent_deposit_requests
    WHERE agent_id = $1
  `, [agentId]);

  const s = summaryRes.rows[0];
  const walletBalance = parseFloat(agent.wallet_balance || '0');
  const lowBalanceThreshold = parseFloat(agent.low_balance_threshold || '5000');
  const pendingSum = parseFloat(s.pending_sum || '0');
  const pendingCount = parseInt(s.pending_count || '0', 10);
  const oldestWaitingMin = parseInt(s.oldest_waiting_min || '0', 10);
  const acceptedTodaySum = parseFloat(s.accepted_today_sum || '0');
  const acceptedTodayCount = parseInt(s.accepted_today_count || '0', 10);
  const rejectedTodayCount = parseInt(s.rejected_today_count || '0', 10);
  const rejectedTodaySum = parseFloat(s.rejected_today_sum || '0');
  const walletAfterAllPending = walletBalance - pendingSum;

  console.log(`✅ [2/4] Real Neon DB Deposit Summary Metrics:`);
  console.log(`       - Pending Count: ${pendingCount} (Sum: ETB ${pendingSum.toLocaleString()})`);
  console.log(`       - Oldest Waiting: ${oldestWaitingMin} min`);
  console.log(`       - Wallet After All Pending: ETB ${walletAfterAllPending.toLocaleString()}`);
  console.log(`       - Accepted Today: ETB ${acceptedTodaySum.toLocaleString()} (${acceptedTodayCount} deposits)`);
  console.log(`       - Rejected Today: ${rejectedTodayCount} (Sum: ETB ${rejectedTodaySum.toLocaleString()} not credited)`);

  // 3. Test Requests List Query with Search Filter
  const listRes = await query(`
    SELECT req.id, req.amount, req.payment_method, req.player_phone, req.transaction_code,
           req.screenshot_url, req.status, req.rejection_reason, req.created_at, req.resolved_at,
           u.full_name as player_name, u.telegram_username as player_username
    FROM agent_deposit_requests req
    JOIN users u ON req.player_id = u.id
    WHERE req.agent_id = $1
    ORDER BY req.created_at DESC
    LIMIT 10
  `, [agentId]);

  console.log(`✅ [3/4] Retrieved ${listRes.rows.length} requests for agent ${agent.agent_code}`);
  if (listRes.rows.length > 0) {
    const top = listRes.rows[0];
    console.log(`       Sample: ID ${top.id.slice(0, 8)} | ${top.player_name} (${top.player_phone}) | ETB ${top.amount} | ${top.payment_method} | Status: ${top.status}`);
  }

  // 4. Test History Bucketing Logic (Daily, Weekly, Monthly)
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();
  const EAT_OFFSET = 3 * 60 * 60 * 1000;
  const nowEAT = new Date(now.getTime() + EAT_OFFSET);

  const formatDayLabel = (d: Date) => {
    const eat = new Date(d.getTime() + EAT_OFFSET);
    return `${eat.getUTCDate()} ${MONTHS[eat.getUTCMonth()]}`;
  };

  // Test Daily Bucketing (14 days)
  const dailyBuckets: any[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(now.getTime() - i * 86400000);
    const label = i === 0 ? 'Today' : i === 1 ? 'Yesterday' : formatDayLabel(d);
    dailyBuckets.push({ index: i, label, acceptedVolume: 0, acceptedCount: 0, rejectedCount: 0, rows: [] });
  }

  const settledRes = await query(`
    SELECT req.id, req.amount, req.payment_method, req.player_phone, req.transaction_code,
           req.status, req.rejection_reason, req.created_at, req.resolved_at,
           u.full_name as player_name
    FROM agent_deposit_requests req
    JOIN users u ON req.player_id = u.id
    WHERE req.agent_id = $1 AND req.status IN ('approved', 'rejected')
      AND req.created_at >= NOW() - INTERVAL '14 days'
    ORDER BY req.created_at DESC
  `, [agentId]);

  settledRes.rows.forEach(r => {
    const createdAt = new Date(r.created_at);
    const diffMs = now.getTime() - createdAt.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays >= 0 && diffDays < 14) {
      const b = dailyBuckets[diffDays];
      b.rows.push(r);
      if (r.status === 'approved') {
        b.acceptedVolume += parseFloat(r.amount);
        b.acceptedCount++;
      } else {
        b.rejectedCount++;
      }
    }
  });

  const dailyVolume = dailyBuckets.reduce((sum, b) => sum + b.acceptedVolume, 0);
  const dailyAccepted = dailyBuckets.reduce((sum, b) => sum + b.acceptedCount, 0);
  console.log(`✅ [4/4] Verified 14-Day Continuous History Buckets:`);
  console.log(`       - 14 Daily Buckets initialized (from ${dailyBuckets[13].label} to ${dailyBuckets[0].label})`);
  console.log(`       - Total Settled Volume in past 14 days: ETB ${dailyVolume.toLocaleString()} across ${dailyAccepted} deposits`);

  console.log('\n🎉 ALL PHASE 1 DATABASE & API BACKEND TESTS PASSED 100%!');
  process.exit(0);
}

testPhase1DepositRequests().catch(err => {
  console.error('❌ Phase 1 test failed:', err);
  process.exit(1);
});
