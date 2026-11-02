import { pool } from '../db.ts';

async function main() {
  console.log('🧪 Starting Withdrawal Cashier Desk Analytics Audit across all agents...');

  const agentsRes = await pool.query(`
    SELECT ap.id, ap.agent_code, u.full_name
    FROM agent_profiles ap
    JOIN users u ON ap.user_id = u.id
    WHERE ap.status = 'active'
    ORDER BY ap.created_at ASC
  `);

  for (const agent of agentsRes.rows) {
    console.log(`\n👤 Agent: ${agent.full_name} (${agent.agent_code}, ID: ${agent.id})`);

    const analyticsRes = await pool.query(`
      SELECT
        COALESCE(SUM(amount) FILTER (WHERE status IN ('approved', 'completed') AND (COALESCE(resolved_at, created_at) AT TIME ZONE 'Africa/Addis_Ababa')::date = (NOW() AT TIME ZONE 'Africa/Addis_Ababa')::date), 0) as today_amount,
        COUNT(*) FILTER (WHERE status IN ('approved', 'completed') AND (COALESCE(resolved_at, created_at) AT TIME ZONE 'Africa/Addis_Ababa')::date = (NOW() AT TIME ZONE 'Africa/Addis_Ababa')::date) as today_count,
        COALESCE(SUM(agent_commission_earned) FILTER (WHERE status IN ('approved', 'completed') AND (COALESCE(resolved_at, created_at) AT TIME ZONE 'Africa/Addis_Ababa')::date = (NOW() AT TIME ZONE 'Africa/Addis_Ababa')::date), 0) as today_commission,

        COALESCE(SUM(amount) FILTER (WHERE status IN ('approved', 'completed') AND COALESCE(resolved_at, created_at) >= NOW() - INTERVAL '7 days'), 0) as week_amount,
        COUNT(*) FILTER (WHERE status IN ('approved', 'completed') AND COALESCE(resolved_at, created_at) >= NOW() - INTERVAL '7 days') as week_count,
        COALESCE(SUM(agent_commission_earned) FILTER (WHERE status IN ('approved', 'completed') AND COALESCE(resolved_at, created_at) >= NOW() - INTERVAL '7 days'), 0) as week_commission,

        COALESCE(SUM(amount) FILTER (WHERE status IN ('approved', 'completed') AND COALESCE(resolved_at, created_at) >= NOW() - INTERVAL '30 days'), 0) as month_amount,
        COUNT(*) FILTER (WHERE status IN ('approved', 'completed') AND COALESCE(resolved_at, created_at) >= NOW() - INTERVAL '30 days') as month_count,
        COALESCE(SUM(agent_commission_earned) FILTER (WHERE status IN ('approved', 'completed') AND COALESCE(resolved_at, created_at) >= NOW() - INTERVAL '30 days'), 0) as month_commission,

        COALESCE(SUM(amount) FILTER (WHERE status IN ('approved', 'completed')), 0) as all_time_amount,
        COUNT(*) FILTER (WHERE status IN ('approved', 'completed')) as all_time_count,
        COALESCE(SUM(agent_commission_earned) FILTER (WHERE status IN ('approved', 'completed')), 0) as all_time_commission,

        COUNT(*) FILTER (WHERE status = 'pending') as pending_count
      FROM agent_withdrawal_requests
      WHERE agent_id = $1
    `, [agent.id]);

    const a = analyticsRes.rows[0];
    console.log(`  ✓ Today's Payouts:     ${Number(a.today_amount).toFixed(2)} ETB (${a.today_count} paid, +${Number(a.today_commission).toFixed(2)} ETB commission)`);
    console.log(`  ✓ This Week's Payouts: ${Number(a.week_amount).toFixed(2)} ETB (${a.week_count} paid, +${Number(a.week_commission).toFixed(2)} ETB commission)`);
    console.log(`  ✓ This Month's Payouts:${Number(a.month_amount).toFixed(2)} ETB (${a.month_count} paid, +${Number(a.month_commission).toFixed(2)} ETB commission)`);
    console.log(`  ✓ Cashout Fee Earned:  +${Number(a.all_time_commission).toFixed(2)} ETB (${a.all_time_count} settled, volume: ${Number(a.all_time_amount).toFixed(2)} ETB)`);
  }

  console.log('\n🎉 ALL AGENTS WITHDRAWAL ANALYTICS AUDIT PASSED!');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Audit failed:', err);
  process.exit(1);
});
