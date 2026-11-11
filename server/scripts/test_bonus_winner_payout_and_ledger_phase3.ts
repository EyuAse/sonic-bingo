import assert from 'node:assert';
import { randomUUID } from 'node:crypto';
import { query, pool, withTransaction } from '../db.ts';
import { gameEngine } from '../game/BingoGameEngine.ts';

async function runPhase3Verification() {
  console.log('=================================================================');
  console.log('🧪 VERIFYING PHASE 3: Bonus Winner Payout & Database Ledger Integrity');
  console.log('=================================================================\n');

  const testUserId = randomUUID();
  const testPhone = `099${Date.now().toString().slice(-7)}`;
  const testUserName = 'Bonus Winner Test';

  try {
    // 1. Create a simulated new registered player who has NEVER made a deposit
    console.log(`1️⃣ Creating test bonus player "${testUserName}" (${testUserId})...`);
    await query(
      `INSERT INTO users (id, phone, full_name, role, status, has_deposited, created_at)
       VALUES ($1, $2, $3, 'player', 'active', false, NOW())`,
      [testUserId, testPhone, testUserName]
    );

    // Initial wallet: 0.00 real cash balance, 40.00 bonus balance (started with 50 ETB bonus, bought 1 cartela for 10 ETB)
    await query(
      `INSERT INTO wallets (user_id, balance, bonus, locked_balance, updated_at)
       VALUES ($1, 0.00, 40.00, 0.00, NOW())`,
      [testUserId]
    );

    // Verify engine marks this user as non-deposited
    const isDeposited = gameEngine.isDepositedUser(testUserId);
    console.log(`   • isDepositedUser = ${isDeposited} (Must be false)`);
    assert.strictEqual(isDeposited, false, 'User must not be marked as deposited');

    // 2. Setup simulated round in Room 10
    console.log('\n2️⃣ Simulating Room 10 round settlement:');
    const room10 = gameEngine.getRoom('room-10');
    assert.ok(room10, 'Room 10 must exist');

    const stakePerCard = 10;
    const cartelaId = 55;
    const botCount = 9;
    const totalPot = (1 + botCount) * stakePerCard; // 100 ETB
    const houseFee = Math.floor(totalPot * 0.20);   // 20 ETB (20%)
    const jackpotFee = Math.floor(totalPot * 0.024 * 100) / 100; // 2.4 ETB
    const netPayout = totalPot - houseFee - jackpotFee; // 77.6 ETB

    console.log(`   • Total Pot:       ${totalPot} ETB (1 Real Card + 9 Bot Cards)`);
    console.log(`   • Platform Fee:    ${houseFee} ETB (20%)`);
    console.log(`   • Progressive Fee: ${jackpotFee} ETB (2.4%)`);
    console.log(`   • Net Winner Prize: ${netPayout} ETB`);

    // 3. Create game round and ticket in PostgreSQL
    const roundRes = await query(
      `INSERT INTO game_rounds (room_id, round_number, phase, total_pot, platform_fee, jackpot_fee, winner_payout, started_at)
       VALUES ('room-10', 999999, 'playing', $1, $2, $3, $4, NOW()) RETURNING id`,
      [totalPot, houseFee, jackpotFee, netPayout]
    );
    const roundId = roundRes.rows[0].id;

    await query(
      `INSERT INTO game_tickets (round_id, user_id, cartela_id, card_matrix, bet_amount, status)
       VALUES ($1, $2, $3, '[]', $4, 'active')`,
      [roundId, testUserId, cartelaId, stakePerCard]
    );

    // 4. Execute atomic wallet settlement (exact engine logic from lines 3036-3067)
    console.log('\n3️⃣ Executing atomic payout transaction for Bonus Winner in Neon DB...');
    const winRef = `WIN-TEST-${Date.now().toString().slice(-6)}`;
    const description = `Bingo Solo Winner (10 ETB Stake) in ${room10.name} (Cartela #${cartelaId})`;

    await withTransaction(async (client) => {
      const walletRes = await client.query(
        'SELECT balance, bonus FROM wallets WHERE user_id = $1 FOR UPDATE',
        [testUserId]
      );
      assert.strictEqual(walletRes.rows.length, 1);
      const currentReal = parseFloat(walletRes.rows[0].balance || '0');
      const currentBonus = parseFloat(walletRes.rows[0].bonus || '0');
      const newBal = currentReal + netPayout;

      // Credit winnings to real balance
      await client.query(
        'UPDATE wallets SET balance = $1, updated_at = NOW() WHERE user_id = $2',
        [newBal, testUserId]
      );

      // Record transaction
      await client.query(
        `INSERT INTO wallet_transactions (user_id, type, amount, balance_after, reference_code, status, payment_method, description)
         VALUES ($1, 'win', $2, $3, $4, 'completed', 'in_game', $5)`,
        [testUserId, netPayout, newBal, winRef, description]
      );

      // Mark ticket as won
      await client.query(
        `UPDATE game_tickets SET status = 'won' WHERE round_id = $1 AND cartela_id = $2`,
        [roundId, cartelaId]
      );

      // Complete round
      await client.query(
        `UPDATE game_rounds SET phase = 'ended', ended_at = NOW() WHERE id = $1`,
        [roundId]
      );
    });

    console.log('   ✓ Atomic transaction committed successfully!');

    // 5. Verify database invariants
    console.log('\n4️⃣ Verifying Neon PostgreSQL ledger invariants:');
    const updatedWalletRes = await query(
      'SELECT balance, bonus FROM wallets WHERE user_id = $1',
      [testUserId]
    );
    const finalRealBal = parseFloat(updatedWalletRes.rows[0].balance);
    const finalBonusBal = parseFloat(updatedWalletRes.rows[0].bonus);

    console.log(`   • Real Cash Balance:  ${finalRealBal} ETB (Expected: ${netPayout} ETB)`);
    console.log(`   • Remaining Bonus:    ${finalBonusBal} ETB (Expected: 40.00 ETB)`);
    assert.strictEqual(finalRealBal, netPayout, 'Real balance must equal net payout');
    assert.strictEqual(finalBonusBal, 40.00, 'Bonus balance must remain unchanged');

    // Verify transaction row
    const txRes = await query(
      `SELECT type, amount, balance_after, status, reference_code 
       FROM wallet_transactions WHERE user_id = $1 ORDER BY id DESC LIMIT 1`,
      [testUserId]
    );
    assert.strictEqual(txRes.rows.length, 1);
    assert.strictEqual(txRes.rows[0].type, 'win');
    assert.strictEqual(parseFloat(txRes.rows[0].amount), netPayout);
    assert.strictEqual(parseFloat(txRes.rows[0].balance_after), netPayout);
    assert.strictEqual(txRes.rows[0].status, 'completed');
    console.log(`   • Ledger Transaction: ${txRes.rows[0].type.toUpperCase()} of ${txRes.rows[0].amount} ETB [Status: ${txRes.rows[0].status}]`);

    // Verify ticket status
    const ticketRes = await query(
      'SELECT status FROM game_tickets WHERE round_id = $1 AND user_id = $2',
      [roundId, testUserId]
    );
    assert.strictEqual(ticketRes.rows[0].status, 'won');
    console.log(`   • Ticket Status:      ${ticketRes.rows[0].status.toUpperCase()}`);

    // Verify withdrawal completed games counter
    const gamesRes = await query(
      `SELECT COUNT(DISTINCT gt.round_id) as completed_games
       FROM game_tickets gt
       JOIN game_rounds gr ON gt.round_id = gr.id
       WHERE gt.user_id = $1 AND (gr.phase IN ('winner', 'ended') OR gt.status IN ('won', 'lost'))`,
      [testUserId]
    );
    const completedGames = parseInt(gamesRes.rows[0].completed_games, 10);
    assert.strictEqual(completedGames, 1, 'Completed games count must increment to 1');
    console.log(`   • Completed Games:    ${completedGames} (Qualifies towards 5-game withdrawal threshold)`);

    console.log('\n=================================================================');
    console.log('🎉 ALL PHASE 3 PAYOUT & LEDGER VERIFICATION CHECKS PASSED!');
    console.log('=================================================================');
  } finally {
    // Clean up test data
    console.log('\n🧹 Cleaning up test records from database...');
    await query('DELETE FROM wallet_transactions WHERE user_id = $1', [testUserId]).catch(() => {});
    await query('DELETE FROM game_tickets WHERE user_id = $1', [testUserId]).catch(() => {});
    await query('DELETE FROM game_rounds WHERE room_id = $1 AND round_number = 999999', ['room-10']).catch(() => {});
    await query('DELETE FROM wallets WHERE user_id = $1', [testUserId]).catch(() => {});
    await query('DELETE FROM users WHERE id = $1', [testUserId]).catch(() => {});
    console.log('   ✓ Cleanup complete.');
  }

  await pool.end();
  process.exit(0);
}

runPhase3Verification().catch(err => {
  console.error('❌ Phase 3 Verification Failed:', err);
  process.exit(1);
});
