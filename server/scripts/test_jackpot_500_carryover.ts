// Automated Verification Test Suite for 500 ETB Progressive Jackpot Engine & Carryover Math
import assert from 'assert';

function calculateJackpotPayout(currentJackpotPool: number, netPot: number) {
  const isJackpotHit = currentJackpotPool >= 500;
  const totalJackpotAwarded = isJackpotHit ? 500 : 0;
  const excessJackpotCarryover = isJackpotHit ? Math.max(0, currentJackpotPool - 500) : currentJackpotPool;
  const totalWinnerPayout = netPot + totalJackpotAwarded;

  return {
    isJackpotHit,
    totalJackpotAwarded,
    excessJackpotCarryover,
    totalWinnerPayout
  };
}

console.log('🧪 Testing 500 ETB Progressive Jackpot & Carryover Engine...\n');

// Test Case 1: Pool is 499 ETB (Threshold not reached)
{
  const res = calculateJackpotPayout(499, 424);
  assert.strictEqual(res.isJackpotHit, false, 'Pool at 499 must not trigger jackpot');
  assert.strictEqual(res.totalJackpotAwarded, 0, 'No jackpot awarded when < 500');
  assert.strictEqual(res.excessJackpotCarryover, 499, 'Pool must carry over completely');
  assert.strictEqual(res.totalWinnerPayout, 424, 'Winner receives only standard net pot');
  console.log('✅ Test 1: Pool at 499 ETB -> No jackpot hit, pool remains intact.');
}

// Test Case 2: Pool reaches exactly 500 ETB
{
  const res = calculateJackpotPayout(500, 424);
  assert.strictEqual(res.isJackpotHit, true, 'Pool at exactly 500 must trigger jackpot');
  assert.strictEqual(res.totalJackpotAwarded, 500, 'Exactly 500 ETB awarded');
  assert.strictEqual(res.excessJackpotCarryover, 0, 'Carryover is 0 when pool is exactly 500');
  assert.strictEqual(res.totalWinnerPayout, 924, 'Winner receives net pot + 500 ETB');
  console.log('✅ Test 2: Pool at 500 ETB -> 500 ETB awarded, carryover = 0 ETB, total win = 924 ETB.');
}

// Test Case 3: Pool reaches 501 ETB (User Example)
{
  const res = calculateJackpotPayout(501, 424);
  assert.strictEqual(res.isJackpotHit, true, 'Pool at 501 must trigger jackpot');
  assert.strictEqual(res.totalJackpotAwarded, 500, 'Winner wins exactly 500 ETB');
  assert.strictEqual(res.excessJackpotCarryover, 1, '1 ETB carries over to seed the next pool');
  assert.strictEqual(res.totalWinnerPayout, 924, 'Winner receives net pot + 500 ETB');
  console.log('✅ Test 3: Pool at 501 ETB -> 500 ETB won, 1 ETB starts next pool.');
}

// Test Case 4: Pool reaches 542.50 ETB
{
  const res = calculateJackpotPayout(542.50, 424);
  assert.strictEqual(res.isJackpotHit, true, 'Pool at 542.50 must trigger jackpot');
  assert.strictEqual(res.totalJackpotAwarded, 500, 'Winner wins exactly 500 ETB');
  assert.strictEqual(res.excessJackpotCarryover, 42.50, '42.50 ETB carries over to seed the next pool');
  assert.strictEqual(res.totalWinnerPayout, 924, 'Winner receives net pot + 500 ETB');
  console.log('✅ Test 4: Pool at 542.50 ETB -> 500 ETB won, 42.50 ETB starts next pool.');
}

console.log('\n🎉 All 500 ETB Progressive Jackpot tests passed with 100% mathematical precision!\n');
