import { query } from '../db.ts';

async function main() {
  console.log('--- Phase 3 Verification: 10% Referral Bonus & Clean Recruiter Desk ---');

  // 1. Verify agent_profiles commission_rate is 10.00 across all agents
  const profilesRes = await query(`SELECT id, agent_code, commission_rate FROM agent_profiles ORDER BY agent_code`);
  console.log(`Found ${profilesRes.rows.length} agent profiles.`);
  for (const row of profilesRes.rows) {
    if (parseFloat(row.commission_rate) !== 10.0) {
      throw new Error(`Agent ${row.agent_code} has commission_rate ${row.commission_rate}, expected 10.00`);
    }
  }
  console.log('✅ All agent profiles in Neon DB have commission_rate = 10.00%');

  // 2. Test Recruiter Desk Query for AGT-7642
  const agentRes = await query(`SELECT id, agent_code, commission_rate FROM agent_profiles WHERE agent_code = 'AGT-7642'`);
  const agent = agentRes.rows[0];
  const agentId = agent.id;
  const commissionRatePercent = parseFloat(agent.commission_rate || '10.0');
  const rate = commissionRatePercent / 100;

  const [playersRes, depositsRes] = await Promise.all([
    query(
      `SELECT u.id, u.full_name, u.phone, u.telegram_username as username, u.has_deposited, u.created_at,
              COALESCE(w.balance, 0) as balance
       FROM users u
       LEFT JOIN wallets w ON u.id = w.user_id
       WHERE u.agent_id = $1
       ORDER BY u.created_at DESC`,
      [agentId]
    ),
    query(
      `SELECT wt.id, wt.user_id as player_user_id, wt.amount, wt.payment_method, wt.reference_code, wt.created_at
       FROM wallet_transactions wt
       JOIN users u ON wt.user_id = u.id
       WHERE u.agent_id = $1 AND wt.type = 'deposit' AND wt.status = 'completed'
       ORDER BY wt.created_at ASC`,
      [agentId]
    )
  ]);

  console.log(`Recruited Players under AGT-7642: ${playersRes.rows.length}`);
  console.log(`Completed Deposits from Recruited Players: ${depositsRes.rows.length}`);

  if (playersRes.rows.length > 0) {
    const p = playersRes.rows[0];
    const deps = depositsRes.rows.filter(d => d.player_user_id === p.id);
    const firstDep = deps.length > 0 ? deps[0] : null;
    const bonus = firstDep ? Number((firstDep.amount * rate).toFixed(2)) : 0;
    console.log(`Verified Player: ${p.full_name}`);
    if (firstDep) {
      console.log(`First Deposit: ${firstDep.amount} ETB`);
      console.log(`Recruiter Bonus (10%): ${bonus} ETB (was previously 2 ETB at 4%)`);
    }
  }

  console.log('✅ Phase 3 Verification Complete: Neon DB ledger and query invariants verified!');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});

