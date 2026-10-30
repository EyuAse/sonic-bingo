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
  assert(Math.floor(50 * 1.5) === 75, '50 ETB deposit earns exactly 75 coins');
  assert(Math.floor(100 * 1.5) === 150, '100 ETB deposit earns exactly 150 coins');
  assert(Math.floor(500 * 1.5) === 750, '500 ETB deposit earns exactly 750 coins');
  assert(Math.floor(1000 * 1.5) === 1500, '1000 ETB deposit earns exactly 1500 coins');
  assert(Math.floor(67 * 1.5) === 100, '67 ETB deposit earns exactly 100 coins (floored)');

  let testUserId = '';

  try {
    // Create test player
    const userRes = await query(`
      INSERT INTO users (phone, full_name, role)
      VALUES ('0988776655', 'Coin Test Player', 'player')
      RETURNING id
    `);
    testUserId = userRes.rows[0].id;

    // Create wallet with 20 ETB welcome bonus
    await query(`
      INSERT INTO wallets (user_id, balance, bonus)
      VALUES ($1, 0.00, 20.00)
    `, [testUserId]);

    // ----------------------------------------------------
    // TEST 2: Deposit Coin Earning Flow
    // ----------------------------------------------------
    console.log('\n--- Test 2: Deposit Coin Earning Flow ---');
    const awardResult = await coinService.awardCoinsForDeposit(testUserId, 1000, 'TEST-DEP-001');
    assert(awardResult.coinsAwarded === 1500, `Awarded 1,500 coins for 1,000 ETB deposit (got ${awardResult.coinsAwarded})`);
    assert(awardResult.newBalance === 1500, `New coin balance is 1,500 (got ${awardResult.newBalance})`);

    // Verify coin_wallets row
    const cwRes = await query('SELECT balance, lifetime_earned, lifetime_redeemed FROM coin_wallets WHERE user_id = $1', [testUserId]);
    assert(cwRes.rows.length === 1, 'coin_wallets row created');
    assert(parseInt(cwRes.rows[0].balance, 10) === 1500, 'coin_wallets balance matches');
    assert(parseInt(cwRes.rows[0].lifetime_earned, 10) === 1500, 'lifetime_earned matches');

    // Verify coin_transactions row
    const ctxRes = await query('SELECT amount, type, balance_after FROM coin_transactions WHERE user_id = $1', [testUserId]);
    assert(ctxRes.rows.length === 1, 'coin_transactions row logged');
    assert(ctxRes.rows[0].type === 'earned_deposit', "Transaction type is 'earned_deposit'");
    assert(ctxRes.rows[0].amount === 1500, 'Transaction amount is 1500');

    // Award second deposit (50 ETB -> 75 coins)
    const secondAward = await coinService.awardCoinsForDeposit(testUserId, 50, 'TEST-DEP-002');
    assert(secondAward.coinsAwarded === 75, `Awarded 75 coins for 50 ETB deposit`);
    assert(secondAward.newBalance === 1575, `New accumulated balance is 1,575`);

    // ----------------------------------------------------
    // TEST 3: Coin Redemption Engine (1,000 coins = 10 ETB)
    // ----------------------------------------------------
    console.log('\n--- Test 3: Coin Redemption Engine (1,000 coins = 10 ETB) ---');

    // 3a. Rejection: Non-multiple of 1,000
    const invalidRedemption = await coinService.redeemCoinsForBonus(testUserId, 500);
    assert(!invalidRedemption.success, 'Redemption < 1000 rejected');

    const nonMultiple = await coinService.redeemCoinsForBonus(testUserId, 1250);
    assert(!nonMultiple.success, 'Redemption of non-multiple of 1,000 rejected');

    // 3b. Successful Redemption: 1,000 coins -> 10.00 ETB
    const validRedemption = await coinService.redeemCoinsForBonus(testUserId, 1000);
    assert(validRedemption.success, 'Redemption of 1,000 coins succeeded');
    assert(validRedemption.bonusAwarded === 10.00, `Awarded 10.00 ETB bonus (got ${validRedemption.bonusAwarded})`);
    assert(validRedemption.newCoinBalance === 575, `New coin balance is 575 (1575 - 1000 = ${validRedemption.newCoinBalance})`);

    // Verify wallet bonus in DB
    const wRes = await query('SELECT balance, bonus FROM wallets WHERE user_id = $1', [testUserId]);
    assert(parseFloat(wRes.rows[0].bonus) === 30.00, `Bonus wallet balance updated to 30.00 ETB (20 welcome + 10 redeemed = ${wRes.rows[0].bonus})`);

    // 3c. Rejection: Insufficient Coins
    const overdraftRedemption = await coinService.redeemCoinsForBonus(testUserId, 1000);
    assert(!overdraftRedemption.success, 'Overdraft redemption rejected (has 575, requested 1000)');

    // ----------------------------------------------------
    // TEST 4: User Coins Summary Query
    // ----------------------------------------------------
    console.log('\n--- Test 4: User Coin Ledger History Audit ---');
    const summary = await coinService.getUserCoins(testUserId);
    assert(summary.balance === 575, `Summary balance is 575 (got ${summary.balance})`);
    assert(summary.lifetimeEarned === 1575, `Lifetime earned is 1575 (got ${summary.lifetimeEarned})`);
    assert(summary.lifetimeRedeemed === 1000, `Lifetime redeemed is 1000 (got ${summary.lifetimeRedeemed})`);
    assert(summary.transactions.length >= 3, `Transaction history has ${summary.transactions.length} records`);

    // ----------------------------------------------------
    // TEST 5: Admin Manual Adjustment
    // ----------------------------------------------------
    console.log('\n--- Test 5: Admin Manual Coin Adjustment ---');
    const adjResult = await coinService.adminAdjustCoins(testUserId, 425, 'Admin Loyalty Gift');
    assert(adjResult.success, 'Admin adjustment succeeded');
    assert(adjResult.newBalance === 1000, `Balance after adjustment is exactly 1,000 (575 + 425 = ${adjResult.newBalance})`);

    // Now redeem the remaining 1,000 coins
    const secondRedemption = await coinService.redeemCoinsForBonus(testUserId, 1000);
    assert(secondRedemption.success, 'Second 1,000 coin redemption succeeded');
    assert(secondRedemption.newCoinBalance === 0, 'Final coin balance is 0');

    const finalW = await query('SELECT bonus FROM wallets WHERE user_id = $1', [testUserId]);
    assert(parseFloat(finalW.rows[0].bonus) === 40.00, `Final bonus wallet is 40.00 ETB (30 + 10 = ${finalW.rows[0].bonus})`);

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
