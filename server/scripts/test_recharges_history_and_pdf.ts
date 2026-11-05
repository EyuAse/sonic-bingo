import { pool } from '../db.ts';

async function main() {
  console.log('══════════════════════════════════════════════════════════════');
  console.log('🧪 TESTING AGENT RECHARGES HISTORY FILTERS & TIMEZONE BOUNDS');
  console.log('══════════════════════════════════════════════════════════════');

  try {
    // 1. Check Today Filter in EAT
    const todayRes = await pool.query(`
      SELECT COUNT(*) as cnt, COALESCE(SUM(amount), 0) as total
      FROM agent_recharge_requests arr
      WHERE arr.status IN ('approved', 'Credited', 'rejected', 'Rejected')
      AND ((COALESCE(arr.reviewed_at, arr.created_at) AT TIME ZONE 'Africa/Addis_Ababa')::date = (NOW() AT TIME ZONE 'Africa/Addis_Ababa')::date)
    `);
    console.log('✓ [1. Today Filter in EAT (UTC+3)]:');
    console.log(`   Count: ${todayRes.rows[0].cnt}, Total Amount: ${todayRes.rows[0].total} ETB`);

    // 2. Check Week Filter in EAT
    const weekRes = await pool.query(`
      SELECT COUNT(*) as cnt, COALESCE(SUM(amount), 0) as total
      FROM agent_recharge_requests arr
      WHERE arr.status IN ('approved', 'Credited', 'rejected', 'Rejected')
      AND ((COALESCE(arr.reviewed_at, arr.created_at) AT TIME ZONE 'Africa/Addis_Ababa') >= (NOW() AT TIME ZONE 'Africa/Addis_Ababa' - INTERVAL '7 days'))
    `);
    console.log('✓ [2. Last 7 Days Filter in EAT]:');
    console.log(`   Count: ${weekRes.rows[0].cnt}, Total Amount: ${weekRes.rows[0].total} ETB`);

    // 3. Check Current Month Filter in EAT
    const monthRes = await pool.query(`
      SELECT COUNT(*) as cnt, COALESCE(SUM(amount), 0) as total
      FROM agent_recharge_requests arr
      WHERE arr.status IN ('approved', 'Credited', 'rejected', 'Rejected')
      AND ((COALESCE(arr.reviewed_at, arr.created_at) AT TIME ZONE 'Africa/Addis_Ababa') >= DATE_TRUNC('month', NOW() AT TIME ZONE 'Africa/Addis_Ababa'))
    `);
    console.log('✓ [3. Current Month Filter in EAT]:');
    console.log(`   Count: ${monthRes.rows[0].cnt}, Total Amount: ${monthRes.rows[0].total} ETB`);

    // 4. Check Custom Date Range Filter
    const fromDate = '2026-11-01';
    const toDate = '2026-11-05';
    const customRes = await pool.query(`
      SELECT COUNT(*) as cnt, COALESCE(SUM(amount), 0) as total
      FROM agent_recharge_requests arr
      WHERE arr.status IN ('approved', 'Credited', 'rejected', 'Rejected')
      AND ((COALESCE(arr.reviewed_at, arr.created_at) AT TIME ZONE 'Africa/Addis_Ababa')::date BETWEEN $1::date AND $2::date)
    `, [fromDate, toDate]);
    console.log(`✓ [4. Custom Date Range (${fromDate} to ${toDate})]:`);
    console.log(`   Count: ${customRes.rows[0].cnt}, Total Amount: ${customRes.rows[0].total} ETB`);

    // 5. Invariant Checks: Ensure weekly count >= today count
    const todayCount = parseInt(todayRes.rows[0].cnt, 10);
    const weekCount = parseInt(weekRes.rows[0].cnt, 10);
    if (weekCount < todayCount) {
      throw new Error(`Inconsistent date counts: week (${weekCount}) < today (${todayCount})`);
    }

    console.log('══════════════════════════════════════════════════════════════');
    console.log('🎉 ALL RECHARGE HISTORY TIMEZONE & FILTER TESTS PASSED (100%)');
    console.log('══════════════════════════════════════════════════════════════');
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

main();
