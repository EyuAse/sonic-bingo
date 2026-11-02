import { pool } from '../db.ts';

async function main() {
  console.log('🧪 Starting Direct Cash-In, Recharge History, and Dashboard Sync Audit...');

  // 1. Find an active agent profile
  const agentRes = await pool.query(`
    SELECT ap.id, ap.user_id, ap.agent_code, ap.wallet_balance, ap.commission_rate, u.phone
    FROM agent_profiles ap
    JOIN users u ON ap.user_id = u.id
    WHERE ap.status = 'active'
    ORDER BY ap.created_at ASC
    LIMIT 1
  `);

  if (agentRes.rows.length === 0) {
    console.error('❌ No active agent profile found');
    process.exit(1);
  }

  const agent = agentRes.rows[0];
  console.log(`👤 Using agent: ${agent.agent_code} (Profile ID: ${agent.id}, Float: ${agent.wallet_balance} ETB, Commission: ${agent.commission_rate}%)`);

  // 2. Find a test player
  const playerRes = await pool.query(`
    SELECT id, phone, full_name
    FROM users
    WHERE role != 'admin' AND role != 'agent'
    LIMIT 1
  `);

  if (playerRes.rows.length === 0) {
    console.error('❌ No player found');
    process.exit(1);
  }

  const player = playerRes.rows[0];
  console.log(`🎮 Using player: ${player.full_name || player.phone_number} (ID: ${player.id})`);

  // 3. Test Direct Cash-In (UUID Fix Verification)
  const depositAmount = 50;
  const commissionAmount = Number(((depositAmount * Number(agent.commission_rate)) / 100).toFixed(2));
  const testRefCode = `AGT-DEP-${Math.floor(100000 + Math.random() * 900000)}`;

  console.log(`\n⚡ Testing Direct Cash-In with string refCode: "${testRefCode}"`);

  // Test insert into agent_player_deposits
  const depInsert = await pool.query(`
    INSERT INTO agent_player_deposits (
      agent_id, player_user_id, amount, agent_balance_after, player_balance_after, payment_method, reference_code
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, reference_code
  `, [agent.id, player.id, depositAmount, 10000, 100, 'Telebirr', testRefCode]);

  console.log(`✓ Inserted agent_player_deposits record #${depInsert.rows[0].id} with ref: ${depInsert.rows[0].reference_code}`);

  // Test insert into agent_commissions with source_id = testRefCode (previously caused UUID error!)
  const commInsert = await pool.query(`
    INSERT INTO agent_commissions (
      agent_id, source_type, source_id, amount, commission_rate, commission_earned
    ) VALUES ($1, 'cash_in', $2, $3, $4, $5)
    RETURNING id, source_id, source_type, commission_earned
  `, [agent.id, testRefCode, depositAmount, Number(agent.commission_rate), commissionAmount]);

  console.log(`✓ Successfully recorded in agent_commissions #${commInsert.rows[0].id} with source_id="${commInsert.rows[0].source_id}" and source_type="${commInsert.rows[0].source_type}"! NO UUID ERROR!`);

  // Clean up test commission and deposit
  await pool.query(`DELETE FROM agent_commissions WHERE id = $1`, [commInsert.rows[0].id]);
  await pool.query(`DELETE FROM agent_player_deposits WHERE id = $1`, [depInsert.rows[0].id]);
  console.log('🧹 Cleaned up test cash-in records.');

  // 4. Test Recharge History Queries with Timeframe Filtering
  console.log('\n📊 Testing Recharge History Queries with Timeframe:');
  const timeframes = ['today', 'week', 'month', 'all'];

  for (const tf of timeframes) {
    let dateFilter = '';
    if (tf === 'today') {
      dateFilter = `AND (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Addis_Ababa')::date = (NOW() AT TIME ZONE 'Africa/Addis_Ababa')::date`;
    } else if (tf === 'week') {
      dateFilter = `AND created_at >= NOW() - INTERVAL '7 days'`;
    } else if (tf === 'month') {
      dateFilter = `AND created_at >= NOW() - INTERVAL '30 days'`;
    }

    const countRes = await pool.query(`
      SELECT 
        COUNT(*) as total_count,
        COALESCE(SUM(amount), 0) as total_volume,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'approved') as approved_count
      FROM agent_recharge_requests
      WHERE agent_id = $1 ${dateFilter}
    `, [agent.id]);

    const stats = countRes.rows[0];
    console.log(`  [Timeframe: ${tf.padEnd(5)}] Count: ${stats.total_count}, Volume: ${stats.total_volume} ETB, Pending: ${stats.pending_count}, Approved: ${stats.approved_count}`);
  }

  // 5. Test Unified Deposit Analytics
  console.log('\n📈 Testing Unified Deposit Analytics (Online Requests + Over-The-Counter Cash-In):');
  const analyticsRes = await pool.query(`
    WITH combined_deposits AS (
      SELECT amount, created_at FROM agent_deposit_requests WHERE agent_id = $1 AND status = 'approved'
      UNION ALL
      SELECT amount, created_at FROM agent_player_deposits WHERE agent_id = $1
    )
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE created_at >= (NOW() AT TIME ZONE 'Africa/Addis_Ababa')::date), 0) as today_amount,
      COUNT(*) FILTER (WHERE created_at >= (NOW() AT TIME ZONE 'Africa/Addis_Ababa')::date) as today_count,
      COALESCE(SUM(amount) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days'), 0) as week_amount,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as week_count,
      COALESCE(SUM(amount) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days'), 0) as month_amount,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as month_count,
      COALESCE(SUM(amount), 0) as all_time_amount,
      COUNT(*) as all_time_count
    FROM combined_deposits
  `, [agent.id]);

  const a = analyticsRes.rows[0];
  const commRate = Number(agent.commission_rate || 5);
  const todayAmt = Number(a.today_amount);
  const weekAmt = Number(a.week_amount);
  const monthAmt = Number(a.month_amount);
  const allTimeAmt = Number(a.all_time_amount);

  console.log(`  ✓ Today:    ${todayAmt.toFixed(2)} ETB (${a.today_count} tx, +${((todayAmt * commRate) / 100).toFixed(2)} commission)`);
  console.log(`  ✓ Week:     ${weekAmt.toFixed(2)} ETB (${a.week_count} tx, +${((weekAmt * commRate) / 100).toFixed(2)} commission)`);
  console.log(`  ✓ Month:    ${monthAmt.toFixed(2)} ETB (${a.month_count} tx, +${((monthAmt * commRate) / 100).toFixed(2)} commission)`);
  console.log(`  ✓ All Time: ${allTimeAmt.toFixed(2)} ETB (${a.all_time_count} tx, +${((allTimeAmt * commRate) / 100).toFixed(2)} commission)`);

  console.log('\n🎉 ALL CASH-IN, RECHARGE HISTORY, AND DASHBOARD ANALYTICS TESTS PASSED!');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
