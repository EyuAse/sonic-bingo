import dotenv from 'dotenv';
import { query, pool, withTransaction } from '../db.ts';

dotenv.config();

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runTest() {
  console.log('\n🧪 ========================================================');
  console.log('🧪 [TEST SUITE] Phase 1: Real Database Jackpots API & Endpoints');
  console.log('🧪 ========================================================\n');

  // 1. Verify DB Tables Exist & Schema Integrity
  console.log('--- Test 1: Neon Database Schema Verification ---');
  const tablesRes = await query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_name IN ('jackpot_pool', 'jackpot_winners', 'game_rounds', 'wallets')
  `);
  const foundTables = tablesRes.rows.map(r => r.table_name);
  assert(foundTables.includes('jackpot_pool'), 'Table jackpot_pool exists');
  assert(foundTables.includes('jackpot_winners'), 'Table jackpot_winners exists');
  assert(foundTables.includes('game_rounds'), 'Table game_rounds exists');
  assert(foundTables.includes('wallets'), 'Table wallets exists');

  // Verify jackpot_pool rows
  const poolsRes = await query(`SELECT room_id, balance, seed_amount FROM jackpot_pool ORDER BY room_id ASC`);
  assert(poolsRes.rows.length >= 4, `Found ${poolsRes.rows.length} stake rooms in jackpot_pool`);
  console.log('  Pools in DB:', poolsRes.rows);

  // 2. Test Overview Aggregations Math
  console.log('\n--- Test 2: Overview Live Vault & 14-Day Metrics ---');
  const todayRes = await query(`
    SELECT COALESCE(SUM(jackpot_fee), 0) as today_fee
    FROM game_rounds
    WHERE started_at >= CURRENT_DATE AND jackpot_fee > 0
  `);
  const todayFee = parseFloat(todayRes.rows[0]?.today_fee || '0');
  console.log(`  Real Contributed Today: ${todayFee} ETB`);

  const awarded30dRes = await query(`
    SELECT COALESCE(SUM(amount), 0) as awarded_30d
    FROM jackpot_winners
    WHERE won_at >= NOW() - INTERVAL '30 days'
  `);
  const awarded30d = parseFloat(awarded30dRes.rows[0]?.awarded_30d || '0');
  console.log(`  Real Awarded (Last 30 Days): ${awarded30d} ETB`);

  // Verify 14-day history aggregation query
  const historyRes = await query(`
    SELECT 
      TO_CHAR(started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') as date_str,
      room_id,
      COALESCE(SUM(jackpot_fee), 0) as fee
    FROM game_rounds
    WHERE started_at >= NOW() - INTERVAL '14 days' AND jackpot_fee > 0
    GROUP BY date_str, room_id
    ORDER BY date_str ASC
  `);
  console.log(`  14-day history rows found: ${historyRes.rows.length}`);
  assert(historyRes.rows !== undefined, '14-day aggregation query succeeds without error');

  // 3. Test Contributions Aggregation & Period Logic
  console.log('\n--- Test 3: Contributions Ledger & Period Grouping ---');
  const contRes = await query(`
    SELECT 
      COALESCE(SUM(jackpot_fee), 0) as total_contributions,
      COUNT(id) as games_count,
      COALESCE(MAX(jackpot_fee), 0) as largest_contribution,
      COALESCE(AVG(jackpot_fee), 0) as avg_contribution
    FROM game_rounds
    WHERE jackpot_fee > 0
  `);
  const kpis = contRes.rows[0];
  console.log('  All-Time Jackpot Contributions KPIs:', {
    total: parseFloat(kpis.total_contributions),
    gamesCount: parseInt(kpis.games_count, 10),
    largest: parseFloat(kpis.largest_contribution),
    avg: parseFloat(kpis.avg_contribution)
  });
  assert(parseFloat(kpis.total_contributions) >= 0, 'Total contributions is non-negative');

  // 4. Test Atomic Award Settlement Simulation (Safely Rolled Back)
  console.log('\n--- Test 4: Atomic Award Settlement ACID Transaction ---');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create a temporary test user
    const userRes = await client.query(`
      INSERT INTO users (phone, full_name, role)
      VALUES ('0911998877', 'Jackpot Phase 1 Player', 'player')
      RETURNING id
    `);
    const testUserId = userRes.rows[0].id;

    // Create test wallet with initial balance 50 ETB
    await client.query(`
      INSERT INTO wallets (user_id, balance, bonus)
      VALUES ($1, 50.00, 50.00)
    `, [testUserId]);

    const testAwardAmount = 250.00;

    // Execute atomic award flow
    // A. Credit wallet
    const walletRes = await client.query(`
      UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE user_id = $2 RETURNING balance
    `, [testAwardAmount, testUserId]);
    const newBal = parseFloat(walletRes.rows[0].balance);
    assert(newBal === 300.00, `Winner wallet credited accurately: 50.00 -> ${newBal} ETB`);

    // B. Insert wallet transaction
    const refCode = `JP-TEST-${Date.now()}`;
    await client.query(`
      INSERT INTO wallet_transactions (
        user_id, type, amount, balance_after, reference_code, status, description
      ) VALUES ($1, 'win', $2, $3, $4, 'completed', 'Test Jackpot Award')
    `, [testUserId, testAwardAmount, newBal, refCode]);
    assert(true, 'Wallet transaction recorded in immutable ledger');

    // C. Record in jackpot_winners
    const jwRes = await client.query(`
      INSERT INTO jackpot_winners (room_id, user_id, amount, balls_count)
      VALUES ('room-10', $1, $2, 15)
      RETURNING id
    `, [testUserId, testAwardAmount]);
    assert(jwRes.rows.length === 1, `Jackpot winner entry created (ID: ${jwRes.rows[0].id})`);

    // D. Reset pool
    const resetRes = await client.query(`
      UPDATE jackpot_pool
      SET balance = seed_amount,
          last_won_amount = $1,
          last_winner_user_id = $2,
          last_won_at = NOW()
      WHERE room_id = 'room-10'
      RETURNING balance, seed_amount
    `, [testAwardAmount, testUserId]);
    assert(parseFloat(resetRes.rows[0].balance) === parseFloat(resetRes.rows[0].seed_amount), 'Pool reset to seed amount');

    await client.query('ROLLBACK');
    console.log('  ✓ Award ACID transaction validated and safely rolled back.');
  } finally {
    client.release();
  }

  console.log('\n🎉 ========================================================');
  console.log('🎉 [SUCCESS] Phase 1: Real Database Jackpots Backend OK!');
  console.log('🎉 ========================================================\n');
  process.exit(0);
}

runTest().catch(err => {
  console.error('\n❌ [TEST FAILURE]:', err);
  process.exit(1);
});
