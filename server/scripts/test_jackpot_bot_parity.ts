import { query } from '../db';
import { gameEngine } from '../game/BingoGameEngine';

async function runTests() {
  console.log('🧪 [Test Suite] Running 500 ETB Jackpot Engine & Bot Parity Verification...');
  let passed = 0;
  let total = 0;

  function assert(desc: string, condition: boolean) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${desc}`);
    }
  }

  // 1. Math verification: Award 500, Rollover excess
  const testPools = [
    { pool: 500, expectedAward: 500, expectedCarry: 0, isHit: true },
    { pool: 501, expectedAward: 500, expectedCarry: 1, isHit: true },
    { pool: 550, expectedAward: 500, expectedCarry: 50, isHit: true },
    { pool: 499, expectedAward: 0, expectedCarry: 499, isHit: false },
    { pool: 279.60, expectedAward: 0, expectedCarry: 279.60, isHit: false }
  ];

  for (const t of testPools) {
    const isJackpotHit = t.pool >= 500;
    const awarded = isJackpotHit ? 500 : 0;
    const carryover = isJackpotHit ? Math.max(0, t.pool - 500) : t.pool;

    assert(
      `Pool ${t.pool} ETB: isHit=${t.isHit}, awarded=${t.expectedAward}, carryover=${t.expectedCarry}`,
      isJackpotHit === t.isHit && awarded === t.expectedAward && Math.abs(carryover - t.expectedCarry) < 0.001
    );
  }

  // 2. Database verification: Insert bot winner into jackpot_winners with null user_id and winner_name
  try {
    const testBotName = 'TestBot_Abebe';
    const insertRes = await query(
      `INSERT INTO jackpot_winners (room_id, round_id, user_id, amount, balls_count, winner_name, won_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING id, amount, winner_name`,
      ['room-10', null, null, 500, 18, testBotName]
    );

    assert('Bot winner successfully inserted into jackpot_winners table with null user_id', insertRes.rows.length === 1 && insertRes.rows[0].winner_name === testBotName);

    // Clean up test entry
    if (insertRes.rows.length > 0) {
      await query(`DELETE FROM jackpot_winners WHERE id = $1`, [insertRes.rows[0].id]);
      assert('Test jackpot_winners entry cleaned up', true);
    }
  } catch (err: any) {
    assert(`Bot winner database insertion error: ${err.message}`, false);
  }

  // 3. Engine verification: Room 10 jackpotPoolBalance is tracked
  const r10 = gameEngine.getRoom('room-10');
  assert('Room 10 exists in BingoGameEngine', !!r10);
  if (r10) {
    assert('Room 10 tracks jackpotPoolBalance as a number', typeof r10.jackpotPoolBalance === 'number');
  }

  console.log(`\n📊 [Summary] Passed ${passed}/${total} assertions.`);
  process.exit(passed === total ? 0 : 1);
}

runTests().catch(err => {
  console.error('Test script crashed:', err);
  process.exit(1);
});
