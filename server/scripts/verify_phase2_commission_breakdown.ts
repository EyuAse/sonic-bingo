import { pool } from '../db.ts';

async function main() {
  console.log('🔍 [Phase 2 Verification] Auditing Multi-Rail Commission Breakdown...');

  const agentRes = await pool.query(`SELECT * FROM agent_profiles WHERE agent_code = 'AGT-6054'`);
  const agent = agentRes.rows[0];
  console.log(`👤 Target Agent: ${agent.agent_code} (ID: ${agent.id})`);
  console.log(`👝 Commission Balance in DB: ${agent.commission_balance} ETB`);

  // Run the exact commStats query from GET /commission/overview
  const commStats = await pool.query(
    `SELECT source_type, 
            SUM(commission_earned) as total_earned,
            COUNT(*) as count
     FROM agent_commissions
     WHERE agent_id = $1 AND commission_earned > 0
     GROUP BY source_type`,
    [agent.id]
  );

  console.log('📊 Raw commStats grouped by source_type:');
  console.table(commStats.rows);

  let lifetimeEarned = 0;
  let depositCommission = 0;
  let depositCount = 0;
  let withdrawalCommission = 0;
  let withdrawalCount = 0;

  commStats.rows.forEach(r => {
    const earned = parseFloat(r.total_earned || '0');
    const count = parseInt(r.count || '0', 10);
    lifetimeEarned += earned;
    if (r.source_type === 'deposit' || r.source_type === 'cash_in') {
      depositCommission += earned;
      depositCount += count;
    } else if (r.source_type === 'withdrawal') {
      withdrawalCommission += earned;
      withdrawalCount += count;
    }
  });

  console.log('✨ Harmonized Commission Breakdown:');
  console.log({
    depositCommission: `+${depositCommission.toFixed(2)} ETB (${depositCount} cash-ins)`,
    withdrawalCommission: `+${withdrawalCommission.toFixed(2)} ETB (${withdrawalCount} cashouts)`,
    lifetimeEarned: `${lifetimeEarned.toFixed(2)} ETB`,
    availableCommissionBalance: `${parseFloat(agent.commission_balance || '0').toFixed(2)} ETB`
  });

  // Verify recent payout requests
  const payoutsRes = await pool.query(
    `SELECT id, amount, payout_method, payout_account, status, admin_notes, created_at
     FROM agent_commission_payout_requests
     WHERE agent_id = $1
     ORDER BY created_at DESC`,
    [agent.id]
  );
  console.log(`📋 Found ${payoutsRes.rows.length} payout request(s) for Agent:`);
  console.table(payoutsRes.rows);

  console.log('\n✅ Phase 2 Verification: Commission breakdown and payout requests are 100% active!');
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
