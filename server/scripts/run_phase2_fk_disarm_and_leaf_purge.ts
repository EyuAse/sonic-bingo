import dotenv from 'dotenv';
import { withTransaction, checkDbConnection, query } from '../db.ts';

dotenv.config();

export async function runPhase2() {
  console.log('══════════════════════════════════════════════════════════════════════════════');
  console.log('🔓 [PHASE 2] FOREIGN-KEY DISARMING & LEAF ACTIVITY PURGE');
  console.log('══════════════════════════════════════════════════════════════════════════════\n');

  const health = await checkDbConnection();
  if (!health.connected) {
    console.error('❌ Cannot connect to Neon DB:', health.error);
    process.exit(1);
  }
  console.log(`✅ [Connection] Neon PostgreSQL online (${health.latencyMs}ms latency)\n`);

  await withTransaction(async (client) => {
    // 1. Disarm Foreign Key pointers from singleton/system tables
    console.log('1️⃣ Disarming Foreign Key pointers on singleton & self-referencing tables...');
    
    // Disarm jackpot_pool
    const jpRes = await client.query(`
      UPDATE jackpot_pool 
      SET last_winner_user_id = NULL, last_won_amount = 0.00, last_won_at = NULL, balance = seed_amount;
    `);
    console.log(`   ✓ Disarmed 'jackpot_pool' (${jpRes.rowCount} room pools reset to seed with NULL winner)`);

    // Disarm users.referred_by self-references
    const refUsersRes = await client.query(`
      UPDATE users 
      SET referred_by = NULL;
    `);
    console.log(`   ✓ Disarmed 'users.referred_by' (${refUsersRes.rowCount} self-references severed)`);

    // 2. Clear Jackpot & Bonus Prize Winners FIRST (references game_rounds and users)
    console.log('\n2️⃣ Purging prize winners that reference game rounds & users...');
    try {
      const jWinRes = await client.query('DELETE FROM jackpot_winners RETURNING id;');
      console.log(`   ✓ Purged 'jackpot_winners': ${jWinRes.rowCount} records removed`);
    } catch (_) {}

    try {
      const bWinRes = await client.query('DELETE FROM bonus_winners RETURNING id;');
      console.log(`   ✓ Purged 'bonus_winners': ${bWinRes.rowCount} records removed`);
    } catch (_) {}

    // 3. Clear Gameplay Tickets & Game Rounds (now that jackpot_winners is clean)
    console.log('\n3️⃣ Purging game tickets & past round history...');
    const ticketsRes = await client.query('DELETE FROM game_tickets RETURNING id;');
    console.log(`   ✓ Purged 'game_tickets': ${ticketsRes.rowCount} records removed`);

    const roundsRes = await client.query('DELETE FROM game_rounds RETURNING id;');
    console.log(`   ✓ Purged 'game_rounds': ${roundsRes.rowCount} records removed`);

    // 4. Clear Financial Requests & Ledger Transactions
    console.log('\n4️⃣ Purging leaf financial requests & immutable transaction ledgers...');
    const depRes = await client.query('DELETE FROM deposit_requests RETURNING id;');
    console.log(`   ✓ Purged 'deposit_requests': ${depRes.rowCount} records removed`);

    const withRes = await client.query('DELETE FROM withdrawal_requests RETURNING id;');
    console.log(`   ✓ Purged 'withdrawal_requests': ${withRes.rowCount} records removed`);

    const txRes = await client.query('DELETE FROM wallet_transactions RETURNING id;');
    console.log(`   ✓ Purged 'wallet_transactions': ${txRes.rowCount} records removed`);

    // 5. Clear Loyalty Coins, Redemptions & Referrals
    console.log('\n5️⃣ Purging loyalty coins, redemptions & referral linkages...');
    const coinTxRes = await client.query('DELETE FROM coin_transactions RETURNING id;');
    console.log(`   ✓ Purged 'coin_transactions': ${coinTxRes.rowCount} records removed`);

    try {
      const coinRedRes = await client.query('DELETE FROM coin_redemptions RETURNING id;');
      console.log(`   ✓ Purged 'coin_redemptions': ${coinRedRes.rowCount} records removed`);
    } catch (_) {}

    const coinWalRes = await client.query('DELETE FROM coin_wallets RETURNING id;');
    console.log(`   ✓ Purged 'coin_wallets': ${coinWalRes.rowCount} records removed`);

    const refRes = await client.query('DELETE FROM referrals RETURNING id;');
    console.log(`   ✓ Purged 'referrals': ${refRes.rowCount} records removed`);

    // 6. Clear Marketing Broadcast History
    console.log('\n6️⃣ Purging past marketing broadcast records...');
    const broadRes = await client.query('DELETE FROM telegram_broadcasts RETURNING id;');
    console.log(`   ✓ Purged 'telegram_broadcasts': ${broadRes.rowCount} records removed`);
  });

  // 7. Post-Phase 2 Verification Gate Assertions
  console.log('\n══════════════════════════════════════════════════════════════════════════════');
  console.log('🔍 [PHASE 2 AUDIT] VERIFYING LEAF ACTIVITY PURGE IN NEON DB');
  console.log('══════════════════════════════════════════════════════════════════════════════\n');

  const checkDep = await query('SELECT COUNT(*) as count FROM deposit_requests');
  const checkWith = await query('SELECT COUNT(*) as count FROM withdrawal_requests');
  const checkTx = await query('SELECT COUNT(*) as count FROM wallet_transactions');
  const checkTickets = await query('SELECT COUNT(*) as count FROM game_tickets');
  const checkRounds = await query('SELECT COUNT(*) as count FROM game_rounds');
  const checkCoinTx = await query('SELECT COUNT(*) as count FROM coin_transactions');
  const checkCoinWal = await query('SELECT COUNT(*) as count FROM coin_wallets');
  const checkJpWinners = await query('SELECT COUNT(*) as count FROM jackpot_winners');
  const checkJpPoolFk = await query('SELECT COUNT(*) as count FROM jackpot_pool WHERE last_winner_user_id IS NOT NULL');

  const results = [
    { entity: 'deposit_requests', count: parseInt(checkDep.rows[0].count, 10), expected: 0 },
    { entity: 'withdrawal_requests', count: parseInt(checkWith.rows[0].count, 10), expected: 0 },
    { entity: 'wallet_transactions', count: parseInt(checkTx.rows[0].count, 10), expected: 0 },
    { entity: 'game_tickets', count: parseInt(checkTickets.rows[0].count, 10), expected: 0 },
    { entity: 'game_rounds', count: parseInt(checkRounds.rows[0].count, 10), expected: 0 },
    { entity: 'coin_transactions', count: parseInt(checkCoinTx.rows[0].count, 10), expected: 0 },
    { entity: 'coin_wallets', count: parseInt(checkCoinWal.rows[0].count, 10), expected: 0 },
    { entity: 'jackpot_winners', count: parseInt(checkJpWinners.rows[0].count, 10), expected: 0 },
    { entity: 'jackpot_pool (active FKs)', count: parseInt(checkJpPoolFk.rows[0].count, 10), expected: 0 }
  ];

  console.table(results);

  const allPassed = results.every(r => r.count === r.expected);
  if (!allPassed) {
    console.error('❌ PHASE 2 VERIFICATION FAILED: Some tables still contain records!');
    process.exit(1);
  }

  console.log('🎉 [PHASE 2 COMPLETE] All leaf activity records and FK pointers purged cleanly!');
  console.log('══════════════════════════════════════════════════════════════════════════════');
  console.log('✅ PHASE 2 VERIFICATION GATE PASSED - SAFE TO PROCEED TO PHASE 3');
  console.log('══════════════════════════════════════════════════════════════════════════════\n');
}

if (process.argv[1] && process.argv[1].includes('run_phase2_fk_disarm_and_leaf_purge')) {
  runPhase2()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Phase 2 Transaction Aborted:', err);
      process.exit(1);
    });
}
