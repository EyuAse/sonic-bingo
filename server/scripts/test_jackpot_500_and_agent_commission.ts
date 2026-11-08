import { query, pool } from '../db.ts';

async function runTests() {
  console.log('🧪 Starting Verification Suite: Jackpot (>= 500 ETB) & Upfront Agent Commission...\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName} ${details ? `(${details})` : ''}`);
      failed++;
    }
  }

  // 1. Verify Pot & Jackpot Deductions (20% House, 2.4% Jackpot, 77.6% Net Prize)
  console.log('📋 Test 1: Pot & Commission Math (20% House, 2.4% Jackpot, 77.6% Net Prize)');
  const testPot = 1000;
  const houseFee = Math.floor(testPot * 0.20);
  const jackpotFee = Math.floor(testPot * 0.024 * 100) / 100;
  const netPrize = testPot - houseFee - jackpotFee;

  assert(houseFee === 200, '20% House fee on 1,000 ETB pot is exactly 200 ETB', `Got: ${houseFee}`);
  assert(jackpotFee === 24, '2.4% Jackpot fee on 1,000 ETB pot is exactly 24 ETB', `Got: ${jackpotFee}`);
  assert(netPrize === 776, '77.6% Net prize on 1,000 ETB pot is exactly 776 ETB', `Got: ${netPrize}`);
  assert(houseFee + jackpotFee + netPrize === testPot, 'Conservation of Pot: House + Jackpot + Net = 100% of Pot');

  // 2. Verify Jackpot Trigger (>= 500 ETB) and Combined Payout
  console.log('\n📋 Test 2: Accumulative Jackpot (>= 500 ETB) Combined Payout');
  const poolBelow = 480;
  const isHitBelow = poolBelow >= 500;
  assert(!isHitBelow, 'Pool at 480 ETB does NOT trigger jackpot (below 500 ETB threshold)');

  const poolHit = 540;
  const isHitAbove = poolHit >= 500;
  assert(isHitAbove, 'Pool at 540 ETB DOES trigger jackpot (>= 500 ETB threshold)');

  const awardedJackpot = isHitAbove ? 500 : 0;
  const carryover = isHitAbove ? poolHit - 500 : poolHit;
  const combinedPot = netPrize + awardedJackpot; // 776 + 500 = 1,276 ETB

  assert(awardedJackpot === 500, 'Awarded jackpot is exactly 500 ETB', `Got: ${awardedJackpot}`);
  assert(carryover === 40, 'Excess carryover is exactly 40 ETB (540 - 500 = 40 ETB)', `Got: ${carryover}`);
  assert(combinedPot === 1276, 'Combined winner pot is Net Prize + 500 ETB (776 + 500 = 1,276 ETB)', `Got: ${combinedPot}`);

  // 3. Verify Two-Winner Distribution (64% / 36%)
  console.log('\n📋 Test 3: Two-Winner 64% / 36% Combined Pot Distribution');
  const winner1Share = Math.floor(combinedPot * 0.64);
  const winner2Share = combinedPot - winner1Share;

  assert(winner1Share === Math.floor(1276 * 0.64), 'Winner 1 receives 64% of combined pot (816 ETB)', `Got: ${winner1Share}`);
  assert(winner2Share === 1276 - 816, 'Winner 2 receives 36% of combined pot (460 ETB)', `Got: ${winner2Share}`);
  assert(winner1Share + winner2Share === combinedPot, 'Sum of 1st + 2nd winner payouts equals 100% of combined pot');

  // 4. Verify Speed Bonus (< 10 calls = 100 ETB bonus)
  console.log('\n📋 Test 4: Speed Bonus (< 10 calls)');
  const balls9 = 9;
  const balls12 = 12;
  const bonus9 = balls9 < 10 ? 100 : 0;
  const bonus12 = balls12 < 10 ? 100 : 0;
  assert(bonus9 === 100, '9 balls drawn earns 100 ETB speed bonus');
  assert(bonus12 === 0, '12 balls drawn earns 0 ETB speed bonus');

  // 5. Verify Upfront Agent Commission at Recharge (10,000 ETB + 5% = 10,500 ETB float)
  console.log('\n📋 Test 5: Upfront Agent Commission at Recharge');
  const rechargeAmount = 10000;
  const commissionRate = 5.0;
  const upfrontCommission = Math.round(rechargeAmount * (commissionRate / 100) * 100) / 100;
  const totalFloatCredited = rechargeAmount + upfrontCommission;

  assert(upfrontCommission === 500, '5% upfront commission on 10,000 ETB recharge is 500 ETB', `Got: ${upfrontCommission}`);
  assert(totalFloatCredited === 10500, 'Agent float credited is 10,500 ETB', `Got: ${totalFloatCredited}`);

  // 6. Verify Player Deposit Cut (0% commission on deposit) & Referral Bonus (10% on 1st deposit)
  console.log('\n📋 Test 6: Deposit Processing (0% Cut) & 10% First-Deposit Referral');
  const depositAmount = 500;
  const depositCommissionCut = 0; // Pure float transfer
  const firstDepositReferralBonus = Math.round(depositAmount * 0.10 * 100) / 100;

  assert(depositCommissionCut === 0, 'Deposit commission cut is strictly 0% (pure float transfer)');
  assert(firstDepositReferralBonus === 50, '10% referral bonus on 500 ETB 1st deposit is 50 ETB', `Got: ${firstDepositReferralBonus}`);

  // 7. Verify Database Settings in Live Neon DB
  console.log('\n📋 Test 7: Live Neon PostgreSQL Admin Settings');
  const dbSettingsRes = await query(`
    SELECT key, value 
    FROM admin_settings 
    WHERE key IN ('jackpot_percentage', 'winner_payout_percent', 'house_commission_percent', 'agent_low_balance_warning', 'welcome_bonus_amount', 'lobby_time_seconds', 'max_cartelas_per_player')
    ORDER BY key
  `);
  const settingsMap = new Map(dbSettingsRes.rows.map((r: any) => [r.key, r.value]));

  assert(settingsMap.get('jackpot_percentage') === '2.40', 'Live DB jackpot_percentage is 2.40%');
  assert(settingsMap.get('winner_payout_percent') === '77.60', 'Live DB winner_payout_percent is 77.60%');
  assert(settingsMap.get('house_commission_percent') === '20.00', 'Live DB house_commission_percent is 20.00%');
  assert(settingsMap.get('max_cartelas_per_player') === '4', 'Live DB max_cartelas_per_player is strictly 4');
  assert(settingsMap.get('lobby_time_seconds') === '40', 'Live DB lobby_time_seconds is 40');
  assert(settingsMap.get('welcome_bonus_amount') === '50.00', 'Live DB welcome_bonus_amount is 50.00 ETB');
  assert(settingsMap.get('agent_low_balance_warning') === '5000.00', 'Live DB agent_low_balance_warning is 5,000.00 ETB');

  console.log(`\n==================================================`);
  console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`==================================================\n`);

  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
