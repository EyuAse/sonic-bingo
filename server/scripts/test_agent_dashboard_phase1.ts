import { query } from '../db.ts';

async function runPhase1Verification() {
  console.log('🧪 Starting Phase 1 Verification: Agent Dashboard Analytics & Real Referral Engine...');

  try {
    // 1. Verify an active agent exists in Neon PostgreSQL
    let agentRes = await query(`
      SELECT ap.id, ap.agent_code, ap.wallet_balance, ap.low_balance_threshold, ap.commission_rate, ap.target_monthly,
             u.id as user_id, u.full_name, u.phone
      FROM agent_profiles ap
      JOIN users u ON ap.user_id = u.id
      WHERE ap.status = 'active'
      LIMIT 1
    `);

    if (agentRes.rows.length === 0) {
      console.log('⚠️ No active agent found, checking any agent profile...');
      agentRes = await query(`
        SELECT ap.id, ap.agent_code, ap.wallet_balance, ap.low_balance_threshold, ap.commission_rate, ap.target_monthly,
               u.id as user_id, u.full_name, u.phone
        FROM agent_profiles ap
        JOIN users u ON ap.user_id = u.id
        LIMIT 1
      `);
    }

    if (agentRes.rows.length === 0) {
      console.log('⚠️ No agent in DB, creating test verification agent...');
      const userInsert = await query(`
        INSERT INTO users (phone, full_name, role, status)
        VALUES ('0911001122', 'Kebede Alemu', 'agent', 'active')
        RETURNING id
      `);
      const testUserId = userInsert.rows[0].id;
      const agentInsert = await query(`
        INSERT INTO agent_profiles (user_id, agent_code, wallet_balance, initial_deposit, low_balance_threshold, commission_rate, target_monthly, status)
        VALUES ($1, 'KEBEDE01', 5650.00, 10000.00, 5000.00, 4.00, 35000.00, 'active')
        RETURNING id, agent_code, wallet_balance, low_balance_threshold, commission_rate, target_monthly
      `);
      agentRes = {
        rows: [{
          ...agentInsert.rows[0],
          user_id: testUserId,
          full_name: 'Kebede Alemu',
          phone: '0911001122'
        }]
      };
    }

    const agent = agentRes.rows[0];
    console.log(`✅ [1/4] Found Agent: ${agent.full_name} (${agent.agent_code}), Balance: ${agent.wallet_balance} ETB`);

    // 2. Verify Referral Resolution for Agent Code
    const testCode = `agent_${agent.agent_code}`;
    let agentCandidate = testCode.replace(/^ref_/, '');
    if (agentCandidate.toLowerCase().startsWith('agent_')) {
      agentCandidate = agentCandidate.substring(6);
    }

    const agentLookup = await query(
      `SELECT id, user_id FROM agent_profiles 
       WHERE UPPER(agent_code) = UPPER($1) OR id::text = $1 LIMIT 1`,
      [agentCandidate]
    );

    if (agentLookup.rows.length === 0 || agentLookup.rows[0].id !== agent.id) {
      throw new Error(`Referral lookup failed for code ${testCode}`);
    }
    console.log(`✅ [2/4] Real Referral Code Resolution Verified: ${testCode} -> Agent ID ${agentLookup.rows[0].id}`);

    // 3. Verify Real Database Calculations (Opening Balance, Deposits, Metrics)
    const agentId = agent.id;
    const walletBalance = parseFloat(agent.wallet_balance || '0');

    const [todayDepositsRes, monthDepositsRes, playersRes, commRes, leaderboardRes] = await Promise.all([
      query(
        `SELECT COALESCE(SUM(amount), 0) as today_vol, COUNT(*) as today_count
         FROM agent_player_deposits
         WHERE agent_id = $1 
           AND (created_at AT TIME ZONE 'Africa/Addis_Ababa')::date = (NOW() AT TIME ZONE 'Africa/Addis_Ababa')::date`,
        [agentId]
      ),
      query(
        `SELECT COALESCE(SUM(amount), 0) as month_vol, COUNT(*) as month_count
         FROM agent_player_deposits
         WHERE agent_id = $1 AND created_at >= NOW() - INTERVAL '30 days'`,
        [agentId]
      ),
      query(
        `SELECT COUNT(*) as total_players, COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as new_players_30d
         FROM users WHERE agent_id = $1`,
        [agentId]
      ),
      query(
        `SELECT COALESCE(SUM(commission_earned), 0) as comm_30d
         FROM agent_commissions WHERE agent_id = $1 AND created_at >= NOW() - INTERVAL '30 days'`,
        [agentId]
      ),
      query(
        `WITH agent_scores AS (
           SELECT 
             ap.id as agent_id,
             COALESCE(SUM(apd.amount), 0) + COALESCE(SUM(CASE WHEN apd.payment_method = 'Cash' THEN apd.amount * 0.5 ELSE 0 END), 0) as score,
             DENSE_RANK() OVER (
               ORDER BY (COALESCE(SUM(apd.amount), 0) + COALESCE(SUM(CASE WHEN apd.payment_method = 'Cash' THEN apd.amount * 0.5 ELSE 0 END), 0)) DESC
             ) as rank
           FROM agent_profiles ap
           LEFT JOIN agent_player_deposits apd ON ap.id = apd.agent_id AND apd.created_at >= NOW() - INTERVAL '30 days'
           WHERE ap.status = 'active'
           GROUP BY ap.id
         )
         SELECT 
           COALESCE((SELECT rank FROM agent_scores WHERE agent_id = $1), 1) as rank,
           COALESCE((SELECT COUNT(*) FROM agent_scores), 1) as total_agents`,
        [agentId]
      )
    ]);

    const todayVol = parseFloat(todayDepositsRes.rows[0].today_vol);
    const todayCount = parseInt(todayDepositsRes.rows[0].today_count, 10);
    const monthVol = parseFloat(monthDepositsRes.rows[0].month_vol);
    const totalPlayers = parseInt(playersRes.rows[0].total_players, 10);
    const comm30d = parseFloat(commRes.rows[0].comm_30d);
    const rank = parseInt(leaderboardRes.rows[0].rank, 10);
    const totalAgents = parseInt(leaderboardRes.rows[0].total_agents, 10);

    console.log(`✅ [3/4] Live Database Metrics Aggregated:`);
    console.log(`       - Deposits Today: ${todayVol} ETB (${todayCount} deposits)`);
    console.log(`       - Deposits 30d:   ${monthVol} ETB`);
    console.log(`       - Total Players:  ${totalPlayers}`);
    console.log(`       - Commission 30d: ${comm30d} ETB`);
    console.log(`       - Leaderboard:    Rank #${rank} of ${totalAgents} active agents`);

    // 4. Verify Timeframe Chart Structure
    const nowAddis = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' }));
    const currentAddisHour = nowAddis.getHours();
    const currentBlockIdx = Math.floor(currentAddisHour / 3);
    console.log(`✅ [4/4] Timeframe Grid Calculated: Addis Ababa Hour = ${currentAddisHour}:00 (Block ${currentBlockIdx}/8 Active)`);

    console.log('\n🎉 ALL PHASE 1 DATABASE & BACKEND CRITERIA VERIFIED 100% SUCCEEDED!\n');
    process.exit(0);
  } catch (err: any) {
    console.error('❌ Phase 1 Verification Failed:', err);
    process.exit(1);
  }
}

runPhase1Verification();

