import { query } from '../db.ts';

async function testPlayersEnquBackend() {
  console.log('🧪 Testing Enhanced Players API & Analytics against Neon DB...');

  // 1. Get Active Agent Profile
  const agentRes = await query(`
    SELECT ap.id, ap.agent_code, ap.commission_rate, ap.wallet_balance,
           u.full_name, u.phone
    FROM agent_profiles ap
    JOIN users u ON ap.user_id = u.id
    WHERE ap.status = 'active'
    ORDER BY ap.wallet_balance DESC
    LIMIT 1
  `);

  if (agentRes.rows.length === 0) throw new Error('No active agent profile found');
  const agent = agentRes.rows[0];
  const agentId = agent.id;
  console.log(`✅ [1/4] Found Agent: ${agent.full_name} (${agent.agent_code}), Rate: ${agent.commission_rate}%`);

  // 2. Query Players associated with this agent
  const playersRes = await query(`
    SELECT u.id, u.full_name, u.phone, u.telegram_username as username, u.has_deposited, u.created_at,
           COALESCE(w.balance, 0) as balance
    FROM users u
    LEFT JOIN wallets w ON u.id = w.user_id
    WHERE u.agent_id = $1
       OR u.id IN (SELECT player_user_id FROM agent_player_deposits WHERE agent_id = $1)
       OR u.id IN (SELECT player_id FROM agent_deposit_requests WHERE agent_id = $1)
    ORDER BY u.created_at DESC
  `, [agentId]);

  console.log(`✅ [2/4] Retrieved ${playersRes.rows.length} referred/active players`);

  // 3. Query all deposits for these players under this agent
  const depositsRes = await query(`
    SELECT id, player_user_id, amount, payment_method, reference_code, created_at
    FROM agent_player_deposits
    WHERE agent_id = $1
    ORDER BY created_at ASC
  `, [agentId]);

  console.log(`✅ [3/4] Retrieved ${depositsRes.rows.length} deposit records under this agent`);

  // Group deposits by player
  const depositsByPlayer: Record<string, any[]> = {};
  depositsRes.rows.forEach(d => {
    if (!depositsByPlayer[d.player_user_id]) depositsByPlayer[d.player_user_id] = [];
    depositsByPlayer[d.player_user_id].push({
      id: d.id,
      amount: parseFloat(d.amount),
      paymentMethod: d.payment_method,
      referenceCode: d.reference_code,
      createdAt: d.created_at
    });
  });

  const now = new Date();
  const nowMs = now.getTime();
  const rate = parseFloat(agent.commission_rate || '10.0') / 100;

  // Process players
  let totalDepositsVolume30Days = 0;
  let totalReferralBonus = 0;
  let bonusLast30Days = 0;
  let activeCount = 0;
  let inactiveCount = 0;
  let awaitingCount = 0;
  let firstDepositsCount = 0;
  let new30DaysCount = 0;

  const processedPlayers = playersRes.rows.map(p => {
    const deps = depositsByPlayer[p.id] || [];
    const totalDeposited = deps.reduce((sum, d) => sum + d.amount, 0);
    const firstDep = deps.length > 0 ? deps[0] : null;
    const lastDep = deps.length > 0 ? deps[deps.length - 1] : null;
    const bonus = firstDep ? Number((firstDep.amount * rate).toFixed(2)) : 0;

    const createdAt = new Date(p.created_at);
    const joinDaysAgo = Math.floor((nowMs - createdAt.getTime()) / 86400000);
    if (joinDaysAgo < 30) new30DaysCount++;

    const lastDepDaysAgo = lastDep ? Math.floor((nowMs - new Date(lastDep.createdAt).getTime()) / 86400000) : 999;

    let status: 'active' | 'inactive' | 'new' | 'awaiting_deposit' = 'awaiting_deposit';
    if (deps.length === 0) {
      status = joinDaysAgo <= 3 ? 'new' : 'awaiting_deposit';
      awaitingCount++;
    } else {
      firstDepositsCount++;
      totalReferralBonus += bonus;
      if (firstDep && Math.floor((nowMs - new Date(firstDep.createdAt).getTime()) / 86400000) < 30) {
        bonusLast30Days += bonus;
      }
      if (lastDepDaysAgo <= 14) {
        status = 'active';
        activeCount++;
      } else {
        status = 'inactive';
        inactiveCount++;
      }
    }

    // 30 day volume
    deps.forEach(d => {
      if (Math.floor((nowMs - new Date(d.createdAt).getTime()) / 86400000) < 30) {
        totalDepositsVolume30Days += d.amount;
      }
    });

    return {
      id: p.id,
      fullName: p.full_name || 'Anonymous Player',
      phone: p.phone || 'No phone',
      username: p.username,
      createdAt: p.created_at,
      joinDaysAgo,
      deposits: deps,
      totalDeposited,
      depositCount: deps.length,
      firstDeposit: firstDep,
      lastDeposit: lastDep,
      bonusEarned: bonus,
      status
    };
  });

  // Calculate 6 periods of 5 days each (for last 30 days)
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const periods5Day: any[] = [];
  for (let k = 5; k >= 0; k--) {
    const periodStart = new Date(nowMs - (k + 1) * 5 * 86400000);
    const periodEnd = new Date(nowMs - k * 5 * 86400000);
    const label = `${periodStart.getUTCDate()} ${MONTHS[periodStart.getUTCMonth()]}`;
    const count = processedPlayers.filter(p => {
      const d = new Date(p.createdAt).getTime();
      return d >= periodStart.getTime() && d < periodEnd.getTime();
    }).length;
    periods5Day.push({ periodIndex: 5 - k, label, count });
  }

  console.log(`✅ [4/4] Summary & Aggregates Computed:`);
  console.log(`       - Total Players: ${processedPlayers.length} (+${new30DaysCount} in 30d)`);
  console.log(`       - Active: ${activeCount} | Inactive: ${inactiveCount} | Awaiting 1st Dep: ${awaitingCount}`);
  console.log(`       - Their Deposits (30d): ETB ${totalDepositsVolume30Days.toLocaleString()}`);
  console.log(`       - Referral Bonus Earned: ETB ${totalReferralBonus.toLocaleString()}`);
  console.log(`       - 5-Day Registration Periods:`, periods5Day.map(p => `${p.label}: ${p.count}`).join(' | '));

  process.exit(0);
}

testPlayersEnquBackend().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
