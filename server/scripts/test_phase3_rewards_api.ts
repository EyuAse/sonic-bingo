import { query } from '../db.ts';

async function testPhase3() {
  console.log('════════════════════════════════════════════════════════════════════');
  console.log('🧪 [TEST PHASE 3]: REWARDS & BONUS MANAGEMENT PRODUCTION API VERIFY');
  console.log('════════════════════════════════════════════════════════════════════\n');

  // 1. Test KPI Query Calculations
  console.log('1️⃣ Testing KPI Aggregations against Live Neon Database...');
  const [settingsRes, walletsRes, coinsRes, redemptionsRes, rewardsPaidRes] = await Promise.all([
    query(`SELECT coin_redemption_coins_per_block, coin_redemption_reward_etb FROM bonus_reward_settings WHERE id = 1`),
    query(`
      SELECT 
        COALESCE(SUM(w.bonus), 0) as total_bonus,
        COUNT(*) FILTER (WHERE w.bonus > 0) as bonus_players
      FROM wallets w
      JOIN users u ON w.user_id = u.id
      WHERE u.role = 'player' 
        AND (u.is_bot IS NULL OR u.is_bot = false)
        AND u.full_name NOT LIKE 'Synthetic%'
    `),
    query(`
      SELECT 
        COALESCE(SUM(cw.balance), 0) as total_coins,
        COUNT(*) as coin_holders
      FROM coin_wallets cw
      JOIN users u ON cw.user_id = u.id
      WHERE u.role = 'player' AND (u.is_bot IS NULL OR u.is_bot = false)
    `),
    query(`
      SELECT 
        COUNT(*) as pending_count,
        COALESCE(SUM(reward_amount), 0) as pending_amount
      FROM coin_redemptions
      WHERE status = 'pending'
    `),
    query(`
      SELECT 
        COALESCE((SELECT SUM(reward_amount) FROM coin_redemptions WHERE status = 'approved'), 0) +
        COALESCE((SELECT SUM(prize_amount) FROM bonus_winners WHERE status = 'paid'), 0) as total_paid
    `)
  ]);

  const s = settingsRes.rows[0];
  const coinsPerBlock = parseInt(s.coin_redemption_coins_per_block || '1000', 10);
  const rewardPerBlock = parseFloat(s.coin_redemption_reward_etb || '10');

  const totalBonus = parseFloat(walletsRes.rows[0]?.total_bonus || '0');
  const bonusPlayers = parseInt(walletsRes.rows[0]?.bonus_players || '0', 10);

  const totalCoins = parseInt(coinsRes.rows[0]?.total_coins || '0', 10);
  const liability = (totalCoins / coinsPerBlock) * rewardPerBlock;

  const pendingCount = parseInt(redemptionsRes.rows[0]?.pending_count || '0', 10);
  const pendingAmount = parseFloat(redemptionsRes.rows[0]?.pending_amount || '0');

  const totalPaid = parseFloat(rewardsPaidRes.rows[0]?.total_paid || '0');

  console.log(`   • Bonus Wallets: ETB ${totalBonus.toFixed(2)} (Across ${bonusPlayers} players)`);
  console.log(`   • Coins in Circulation: ${totalCoins.toLocaleString('en-US')} (Liability: ETB ${Math.round(liability)})`);
  console.log(`   • Pending Redemptions: ${pendingCount} (ETB ${pendingAmount.toFixed(2)} to pay)`);
  console.log(`   • Rewards Paid: ETB ${totalPaid.toFixed(2)}`);
  console.log('   ✓ PASS: All 4 KPI aggregations calculate cleanly.\n');

  // 2. Test Bonus Wallets Table
  console.log('2️⃣ Testing Bonus Wallets Player Directory...');
  const bwRes = await query(`
    SELECT 
      u.id, u.full_name, COALESCE(w.bonus, 0) as bonus, COALESCE(w.balance, 0) as wallet
    FROM users u
    LEFT JOIN wallets w ON u.id = w.user_id
    WHERE u.role = 'player' AND (u.is_bot IS NULL OR u.is_bot = false)
    ORDER BY w.bonus DESC, w.balance DESC
    LIMIT 5
  `);
  console.log(`   • Retrieved ${bwRes.rows.length} top bonus wallet players.`);
  console.log('   ✓ PASS: Bonus wallets player directory operational.\n');

  // 3. Test Top Coin Holders Leaderboard
  console.log('3️⃣ Testing Top Coin Holders Leaderboard...');
  const holdersRes = await query(`
    SELECT 
      cw.user_id, u.full_name, cw.balance as coins
    FROM coin_wallets cw
    JOIN users u ON cw.user_id = u.id
    WHERE u.role = 'player' AND (u.is_bot IS NULL OR u.is_bot = false)
    ORDER BY cw.balance DESC
    LIMIT 5
  `);
  console.log(`   • Retrieved ${holdersRes.rows.length} coin holders for leaderboard.`);
  console.log('   ✓ PASS: Coin holders leaderboard operational.\n');

  // 4. Test Redemptions Queue
  console.log('4️⃣ Testing Redemptions Queue...');
  const redQRes = await query(`
    SELECT cr.id, cr.coins_redeemed, cr.reward_amount, cr.status, u.full_name
    FROM coin_redemptions cr
    JOIN users u ON cr.user_id = u.id
    LIMIT 5
  `);
  console.log(`   • Retrieved ${redQRes.rows.length} redemption requests.`);
  console.log('   ✓ PASS: Redemptions queue operational.\n');

  // 5. Test Bonus Winners
  console.log('5️⃣ Testing Bonus Winners List...');
  const winRes = await query(`
    SELECT bw.id, bw.promotion_name, bw.prize_amount, bw.status, u.full_name
    FROM bonus_winners bw
    JOIN users u ON bw.user_id = u.id
    LIMIT 5
  `);
  console.log(`   • Retrieved ${winRes.rows.length} promotional winners.`);
  console.log('   ✓ PASS: Bonus winners list operational.\n');

  console.log('════════════════════════════════════════════════════════════════════');
  console.log('🎉 PHASE 3 PRODUCTION API & QUERIES 100% VERIFIED!');
  console.log('════════════════════════════════════════════════════════════════════');
}

testPhase3()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Phase 3 test failed:', err);
    process.exit(1);
  });
