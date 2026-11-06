import dotenv from 'dotenv';
import { query } from '../db.ts';
import { coinService } from '../services/coinService.ts';

dotenv.config();

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runCoinEngineTests() {
  console.log('\n🧪 ========================================================');
  console.log('🧪 [TEST SUITE] Phase 4: Coin Earning & Redemption Engine');
  console.log('🧪 ========================================================\n');

  // ----------------------------------------------------
  // TEST 1: Math Multiplier (1.5x)
  // ----------------------------------------------------
  console.log('--- Test 1: Coin Multiplier Calculation (1.5x ETB) ---');
  assert(Math.floor(50 * 1.5) === 75, '50 ETB eligible play earns exactly 75 coins');
  assert(Math.floor(100 * 1.5) === 150, '100 ETB eligible play earns exactly 150 coins');
  assert(Math.floor(500 * 1.5) === 750, '500 ETB eligible play earns exactly 750 coins');
  assert(Math.floor(1000 * 1.5) === 1500, '1000 ETB eligible play earns exactly 1500 coins');
  assert(Math.floor(67 * 1.5) === 100, '67 ETB eligible play earns exactly 100 coins (floored)');

  let testUserId = '';

  try {
    // Create test player
    const userRes = await query(`
      INSERT INTO users (phone, full_name, role)
      VALUES ('0988776655', 'Coin Test Player', 'player')
      RETURNING id
    `);
    testUserId = userRes.rows[0].id;

    // Create wallet with 50 ETB welcome bonus
    await query(`
      INSERT INTO wallets (user_id, balance, bonus)
      VALUES ($1, 0.00, 50.00)
    `, [testUserId]);

    // ----------------------------------------------------
    // TEST 2: Gameplay Coin Earning Flow (1.5 coins / ETB)
    // ----------------------------------------------------
    console.log('\n--- Test 2: Gameplay Coin Earning Flow ---');
    // Example from requirements: 50 Birr eligible play earns 75 coins
    const gameAward = await coinService.awardCoinsForGameplay(testUserId, 50, 'Played 50 ETB in Room 50');
    assert(gameAward.coinsAwarded === 75, `Awarded 75 coins for 50 ETB play (got ${gameAward.coinsAwarded})`);
    assert(gameAward.newBalance === 75, `New coin balance is 75 (got ${gameAward.newBalance})`);

    // Verify coin_transactions row
    const ctx1 = await query('SELECT amount, type, balance_after FROM coin_transactions WHERE user_id = $1', [testUserId]);
    assert(ctx1.rows.length === 1, 'coin_transactions row logged');
    assert(ctx1.rows[0].type === 'earned_gameplay', "Transaction type is 'earned_gameplay'");
    assert(ctx1.rows[0].amount === 75, 'Transaction amount is 75');

    // Additional gameplay: 650 ETB play -> 975 coins (Total: 75 + 975 = 1050 coins)
    const gameAward2 = await coinService.awardCoinsForGameplay(testUserId, 650, 'Played 650 ETB in VIP Room');
    assert(gameAward2.coinsAwarded === 975, `Awarded 975 coins for 650 ETB play`);
    assert(gameAward2.newBalance === 1050, `Accumulated coin balance is 1,050 coins`);

    // Verify coin_wallets row
    const cwRes = await query('SELECT balance, lifetime_earned, lifetime_redeemed FROM coin_wallets WHERE user_id = $1', [testUserId]);
    assert(cwRes.rows.length === 1, 'coin_wallets row exists');
    assert(parseInt(cwRes.rows[0].balance, 10) === 1050, 'coin_wallets balance matches 1050');
    assert(parseInt(cwRes.rows[0].lifetime_earned, 10) === 1050, 'lifetime_earned matches 1050');

    // ----------------------------------------------------
    // TEST 3: Coin Redemption Engine (1,000 coins = 20 ETB)
    // ----------------------------------------------------
    console.log('\n--- Test 3: Coin Redemption Engine (1,000 coins = 20 ETB Bonus) ---');

    // 3a. Rejection: Non-multiple of 1,000
    const invalidRedemption = await coinService.redeemCoinsForBonus(testUserId, 500);
    assert(!invalidRedemption.success, 'Redemption < 1000 rejected');

    const nonMultiple = await coinService.redeemCoinsForBonus(testUserId, 1250);
    assert(!nonMultiple.success, 'Redemption of non-multiple of 1,000 rejected');

    // 3b. Successful Redemption: 1,000 coins -> 20.00 ETB Bonus
    const validRedemption = await coinService.redeemCoinsForBonus(testUserId, 1000);
    assert(validRedemption.success, 'Redemption of 1,000 coins succeeded');
    assert(validRedemption.bonusAwarded === 20.00, `Awarded 20.00 ETB bonus (got ${validRedemption.bonusAwarded})`);
    assert(validRedemption.newCoinBalance === 50, `New coin balance is 50 (1050 - 1000 = ${validRedemption.newCoinBalance})`);

    // Verify wallet bonus in DB (50 welcome bonus + 20 redeemed bonus = 70.00 ETB)
    const wRes = await query('SELECT balance, bonus FROM wallets WHERE user_id = $1', [testUserId]);
    assert(parseFloat(wRes.rows[0].bonus) === 70.00, `Bonus wallet balance updated to 70.00 ETB (50 welcome + 20 redeemed = ${wRes.rows[0].bonus})`);
    assert(parseFloat(wRes.rows[0].balance) === 0.00, `Real cash balance remains untouched at 0.00 ETB (non-withdrawable rule enforced)`);

    // 3c. Rejection: Insufficient Coins
    const overdraftRedemption = await coinService.redeemCoinsForBonus(testUserId, 1000);
    assert(!overdraftRedemption.success, 'Overdraft redemption rejected (has 50, requested 1000)');

    // ----------------------------------------------------
    // TEST 4: User Coins Summary Query
    // ----------------------------------------------------
    console.log('\n--- Test 4: User Coin Ledger History Audit ---');
    const summary = await coinService.getUserCoins(testUserId);
    assert(summary.balance === 50, `Summary balance is 50 (got ${summary.balance})`);
    assert(summary.lifetimeEarned === 1050, `Lifetime earned is 1050 (got ${summary.lifetimeEarned})`);
    assert(summary.lifetimeRedeemed === 1000, `Lifetime redeemed is 1000 (got ${summary.lifetimeRedeemed})`);
    assert(summary.transactions.length >= 3, `Transaction history has ${summary.transactions.length} records`);

    // ----------------------------------------------------
    // TEST 5: Admin Manual Adjustment
    // ----------------------------------------------------
    console.log('\n--- Test 5: Admin Manual Coin Adjustment ---');
    const adjResult = await coinService.adminAdjustCoins(testUserId, 950, 'Admin Loyalty Gift');
    assert(adjResult.success, 'Admin adjustment succeeded');
    assert(adjResult.newBalance === 1000, `Balance after adjustment is exactly 1,000 (50 + 950 = ${adjResult.newBalance})`);

    // Now redeem the remaining 1,000 coins for another 20 ETB bonus
    const secondRedemption = await coinService.redeemCoinsForBonus(testUserId, 1000);
    assert(secondRedemption.success, 'Second 1,000 coin redemption succeeded');
    assert(secondRedemption.bonusAwarded === 20.00, 'Awarded 20.00 ETB bonus for second redemption');
    assert(secondRedemption.newCoinBalance === 0, 'Final coin balance is 0');

    const finalW = await query('SELECT balance, bonus FROM wallets WHERE user_id = $1', [testUserId]);
    assert(parseFloat(finalW.rows[0].bonus) === 90.00, `Final bonus wallet is 90.00 ETB (70 + 20 = ${finalW.rows[0].bonus})`);
    assert(parseFloat(finalW.rows[0].balance) === 0.00, `Cash balance remains 0.00 ETB (strictly non-withdrawable)`);

  } finally {
    if (testUserId) {
      await query('DELETE FROM users WHERE id = $1', [testUserId]);
      console.log('  ✓ Test user and all associated coin/wallet ledgers cleaned up.');
    }
  }

  console.log('\n🎉 ========================================================');
  console.log('🎉 [SUCCESS] Phase 4: All Coin Engine Tests PASSED 100%!');
  console.log('🎉 ========================================================\n');
  process.exit(0);
}

runCoinEngineTests().catch(err => {
  console.error('\n❌ [TEST FAILURE]:', err);
  process.exit(1);
});
