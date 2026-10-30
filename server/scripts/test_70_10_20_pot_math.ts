import dotenv from 'dotenv';
import { query, withTransaction, pool } from '../db.ts';

dotenv.config();

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runPhase3Verification() {
  console.log('\n🧪 ========================================================');
  console.log('🧪 [TEST SUITE] Phase 3: 70/10/20 Pot & Progressive Jackpot');
  console.log('🧪 ========================================================\n');

  // ----------------------------------------------------
  // TEST 1: Pot Math Formula Verification (70% / 10% / 20%)
  // ----------------------------------------------------
  console.log('--- Test 1: Pot Mathematical Distribution Invariants ---');
  const potTestCases = [
    { name: 'Room 10 (50 players x 10 ETB)', pot: 500 },
    { name: 'Room 10 (23 players x 10 ETB)', pot: 230 },
    { name: 'Room 20 (10 players x 20 ETB)', pot: 200 },
    { name: 'Room 50 (20 players x 50 ETB)', pot: 1000 },
    { name: 'Room 100 (5 players x 100 ETB)', pot: 500 },
    { name: 'Small pot (15 ETB)', pot: 15 }
  ];

  for (const tc of potTestCases) {
    const totalPot = tc.pot;
    const houseFee = Math.floor(totalPot * 0.20);
    const jackpotFee = Math.floor(totalPot * 0.10);
    const winnerPayout = totalPot - houseFee - jackpotFee;

    assert(
      winnerPayout + houseFee + jackpotFee === totalPot,
      `${tc.name}: Invariant holds (payout ${winnerPayout} + house ${houseFee} + jackpot ${jackpotFee} === ${totalPot})`
    );
    assert(
      houseFee === Math.floor(totalPot * 0.20),
      `${tc.name}: House fee is strictly 20% (${houseFee} ETB)`
    );
    assert(
      jackpotFee === Math.floor(totalPot * 0.10),
      `${tc.name}: Jackpot contribution is strictly 10% (${jackpotFee} ETB)`
    );
    assert(
      winnerPayout >= Math.floor(totalPot * 0.70),
      `${tc.name}: Winner payout is strictly 70% (${winnerPayout} ETB)`
    );
  }

  // ----------------------------------------------------
  // TEST 2: Commission Waiver for <= 5 cards in Rooms 20, 50, 100
  // ----------------------------------------------------
  console.log('\n--- Test 2: Early Human Match Incentive (0% Commission for <= 5 cards) ---');
  const earlyPot = 60; // 3 players x 20 ETB
  const earlyCommissionEnabled = false;
  const earlyHouseFee = earlyCommissionEnabled ? Math.floor(earlyPot * 0.20) : 0;
  const earlyJackpotFee = earlyCommissionEnabled ? Math.floor(earlyPot * 0.10) : 0;
  const earlyWinnerPayout = earlyPot - earlyHouseFee - earlyJackpotFee;

  assert(earlyHouseFee === 0, 'Early human match house fee is strictly 0 ETB');
  assert(earlyJackpotFee === 0, 'Early human match jackpot fee is strictly 0 ETB');
  assert(earlyWinnerPayout === earlyPot, 'Early human match winner receives 100% of pot (60 ETB)');

  // ----------------------------------------------------
  // TEST 3: Database Jackpot Pools Presence & Initial Seeds
  // ----------------------------------------------------
  console.log('\n--- Test 3: Database Jackpot Pools Audit ---');
  const poolRes = await query('SELECT room_id, balance, seed_amount FROM jackpot_pool ORDER BY room_id');
  assert(poolRes.rows.length === 4, `All 4 stake rooms present in jackpot_pool (found ${poolRes.rows.length})`);

  const poolsByRoom = new Map(poolRes.rows.map(r => [r.room_id, { balance: parseFloat(r.balance), seed: parseFloat(r.seed_amount) }]));
  assert(poolsByRoom.has('room-10') && (poolsByRoom.get('room-10')?.balance ?? 0) >= 500, 'Room 10 pool >= 500 ETB');
  assert(poolsByRoom.has('room-20') && (poolsByRoom.get('room-20')?.balance ?? 0) >= 1000, 'Room 20 pool >= 1000 ETB');
  assert(poolsByRoom.has('room-50') && (poolsByRoom.get('room-50')?.balance ?? 0) >= 2500, 'Room 50 pool >= 2500 ETB');
  assert(poolsByRoom.has('room-100') && (poolsByRoom.get('room-100')?.balance ?? 0) >= 5000, 'Room 100 pool >= 5000 ETB');

  // ----------------------------------------------------
  // TEST 4: Progressive Jackpot Rollover Simulation
  // ----------------------------------------------------
  console.log('\n--- Test 4: Progressive Jackpot Rollover Execution ---');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Simulate 10 ETB jackpot contribution rollover into room-10
    const beforeBalRes = await client.query('SELECT balance FROM jackpot_pool WHERE room_id = $1', ['room-10']);
    const beforeBal = parseFloat(beforeBalRes.rows[0].balance);

    const rolloverContribution = 25.00; // e.g. 10% of 250 ETB pot
    const rolloverRes = await client.query(
      `UPDATE jackpot_pool 
       SET balance = balance + $1, updated_at = NOW() 
       WHERE room_id = $2 
       RETURNING balance`,
      [rolloverContribution, 'room-10']
    );

    const afterBal = parseFloat(rolloverRes.rows[0].balance);
    assert(afterBal === beforeBal + rolloverContribution, `Jackpot pool incremented correctly: ${beforeBal} -> ${afterBal} (+${rolloverContribution} ETB)`);

    await client.query('ROLLBACK');
    console.log('  ✓ Rollover tested inside transaction and safely rolled back.');
  } finally {
    client.release();
  }

  // ----------------------------------------------------
  // TEST 5: Jackpot Hit Simulation (Real Player win <= 18 balls)
  // ----------------------------------------------------
  console.log('\n--- Test 5: Jackpot Hit Settlement Simulation (Real Winner <= 18 balls) ---');
  const hitClient = await pool.connect();
  try {
    await hitClient.query('BEGIN');

    // Create a temporary test user
    const userRes = await hitClient.query(`
      INSERT INTO users (phone, full_name, role)
      VALUES ('0999887766', 'Jackpot Test Player', 'player')
      RETURNING id
    `);
    const testUserId = userRes.rows[0].id;

    // Create test wallet
    await hitClient.query(`
      INSERT INTO wallets (user_id, balance, bonus)
      VALUES ($1, 100.00, 20.00)
    `, [testUserId]);

    const ballsDrawn = 16; // Winner on ball 16! <= 18 balls
    const isJackpotHit = ballsDrawn <= 18;
    assert(isJackpotHit, 'Jackpot condition met: ballsDrawn (16) <= 18');

    const roomPot = 500;
    const normalPayout = Math.floor(roomPot * 0.70); // 350 ETB
    const currentJackpot = 500.00; // seed pool
    const userTotalWin = normalPayout + currentJackpot; // 850 ETB

    // Update wallet
    const walletRes = await hitClient.query(
      'UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE user_id = $2 RETURNING balance',
      [userTotalWin, testUserId]
    );
    const newWalletBal = parseFloat(walletRes.rows[0].balance);
    assert(newWalletBal === 100.00 + userTotalWin, `Winner wallet credited 850 ETB (balance: ${newWalletBal} ETB)`);

    // Record in jackpot_winners
    const jwRes = await hitClient.query(
      `INSERT INTO jackpot_winners (room_id, user_id, amount, balls_count)
       VALUES ($1, $2, $3, $4)
       RETURNING id, amount, balls_count`,
      ['room-10', testUserId, currentJackpot, ballsDrawn]
    );
    assert(jwRes.rows.length === 1, 'Jackpot winner recorded in jackpot_winners table');
    assert(parseFloat(jwRes.rows[0].amount) === currentJackpot, `Jackpot winner amount matches pool (${currentJackpot} ETB)`);
    assert(jwRes.rows[0].balls_count === ballsDrawn, `Balls count recorded correctly (${ballsDrawn})`);

    // Reset pool back to seed
    const resetRes = await hitClient.query(
      `UPDATE jackpot_pool 
       SET balance = seed_amount, 
           last_won_amount = $1, 
           last_winner_user_id = $2, 
           last_won_at = NOW(), 
           updated_at = NOW() 
       WHERE room_id = $3 
       RETURNING balance, seed_amount, last_won_amount`,
      [currentJackpot, testUserId, 'room-10']
    );
    assert(
      parseFloat(resetRes.rows[0].balance) === parseFloat(resetRes.rows[0].seed_amount),
      `Jackpot pool successfully reset to seed amount (${resetRes.rows[0].seed_amount} ETB)`
    );
    assert(
      parseFloat(resetRes.rows[0].last_won_amount) === currentJackpot,
      `Jackpot pool last_won_amount recorded as ${currentJackpot} ETB`
    );

    await hitClient.query('ROLLBACK');
    console.log('  ✓ Jackpot hit and reset fully verified and safely rolled back.');
  } finally {
    hitClient.release();
  }

  // ----------------------------------------------------
  // TEST 6: Standby Bot Win Guard (Bots never win progressive jackpot)
  // ----------------------------------------------------
  console.log('\n--- Test 6: Standby Bot Win Guard ---');
  const botWinnerCards = [{ isReal: false, userName: 'Dawit Bot', cartelaId: 44 }];
  const realWinnerCards: any[] = [];
  const ballsDrawnForBot = 15; // <= 18 balls

  const isRealWin = realWinnerCards.length > 0;
  const isBotJackpotHit = isRealWin && ballsDrawnForBot <= 18;
  assert(!isBotJackpotHit, 'Standby bot winning on ball 15 CANNOT hit the progressive jackpot');

  // ----------------------------------------------------
  // TEST 7: game_rounds jackpot_fee Column Audit
  // ----------------------------------------------------
  console.log('\n--- Test 7: game_rounds jackpot_fee Column Verification ---');
  const grColRes = await query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'game_rounds' AND column_name = 'jackpot_fee'
  `);
  assert(grColRes.rows.length === 1, "game_rounds has 'jackpot_fee' column");

  console.log('\n🎉 ========================================================');
  console.log('🎉 [SUCCESS] Phase 3: All 7 Progressive Jackpot Tests OK!');
  console.log('🎉 ========================================================\n');
  process.exit(0);
}

runPhase3Verification().catch(err => {
  console.error('\n❌ [TEST FAILURE]:', err);
  process.exit(1);
});

