import assert from 'node:assert';
import { gameEngine } from '../game/BingoGameEngine.ts';
import { generateCardFromId, checkWinningPattern } from '../game/cartelaGenerator.ts';

async function runPhase2Verification() {
  console.log('=================================================================');
  console.log('🧪 VERIFYING PHASE 2: Winner Ball Sequence Targets Bonus Cartela');
  console.log('=================================================================\n');

  const room10 = gameEngine.getRoom('room-10');
  assert.ok(room10, 'Room 10 must exist');

  const bonusUserId = 'test_bonus_user_phase2';
  const bonusUserName = 'Tadesse Gemechu';
  const bonusCartelaId = 33;
  const bonusCardMatrix = generateCardFromId(bonusCartelaId);

  // 1. Confirm user is a pure bonus user (never deposited)
  const isDeposited = gameEngine.isDepositedUser(bonusUserId);
  console.log(`1️⃣ Bonus user status: isDepositedUser('${bonusUserId}') = ${isDeposited} (Must be false)`);
  assert.strictEqual(isDeposited, false, 'User must not be deposited');

  // 2. Setup Room 10 with 1 Bonus Player Cartela + 10 Standby Bots
  console.log('\n2️⃣ Setting up Room 10 with 1 Bonus Cartela (#33) + 10 Standby Bots...');
  gameEngine.setBotConfig({ mode: 'fixed', fixedCount: 10 });
  room10.tickets.clear();
  room10.tickets.set(bonusUserId, [{
    userId: bonusUserId,
    userName: bonusUserName,
    cartelaId: bonusCartelaId,
    cardMatrix: bonusCardMatrix,
    betAmount: 10,
    socketId: 'mock_socket_phase2',
    isBonus: true
  }]);

  (gameEngine as any).syncRoom10StandbyBots(room10, true);
  console.log(`   • Real tickets: 1 (Cartela #${bonusCartelaId}, isBonus: true)`);
  console.log(`   • Bot tickets:  ${room10.opponentCards.length}`);

  // 3. Test prepareBallSequence when targetWinnerType is 'real'
  console.log('\n3️⃣ Generating Ball Sequence with targetWinnerType = "real"...');
  room10.targetWinnerType = 'real';

  // Call private prepareBallSequence via reflection
  const sequence: number[] = (gameEngine as any).prepareBallSequence(room10);

  console.log(`   • Generated Sequence Length: ${sequence.length} balls`);
  assert.strictEqual(sequence.length, 75, 'Sequence must contain all 75 bingo balls');

  // 4. Simulate calling balls one by one using .pop() (exact engine execution)
  console.log('\n4️⃣ Simulating live ball call progression on Bonus Cartela #33:');
  const calledNumbers: number[] = [];
  let winningBallCount: number | null = null;
  let winningPattern: string | null = null;

  const simSequence = [...sequence];
  let ballIdx = 0;
  while (simSequence.length > 0) {
    ballIdx++;
    const ball = simSequence.pop()!;
    calledNumbers.push(ball);
    const winResult = checkWinningPattern(bonusCardMatrix, calledNumbers);
    if (winResult.isWin) {
      winningBallCount = ballIdx;
      winningPattern = winResult.winningPattern || 'Standard Line';
      break;
    }
  }

  console.log(`   • Bingo Pattern Detected: "${winningPattern}"`);
  console.log(`   • Winning Ball Index:      Ball #${winningBallCount}`);
  console.log(`   • Target Finish Ball:      Ball #${room10.targetFinishBall}`);

  assert.ok(winningBallCount !== null, 'Bonus cartela must hit a winning bingo pattern');
  assert.strictEqual(
    winningBallCount,
    room10.targetFinishBall,
    `Bonus cartela must hit bingo on exact target finish ball ${room10.targetFinishBall}`
  );
  assert.ok(
    winningBallCount >= 15 && winningBallCount <= 25,
    `Winning ball ${winningBallCount} must be strictly within standard 15-25 ball window`
  );
  console.log(`   ✅ PASS: Bonus cartela #33 hits "${winningPattern}" on exact Ball #${winningBallCount} (within 15-25)!`);

  // 5. Test prepareMasterBallSequence across multiple iterations
  console.log('\n5️⃣ Testing Master Ball Sequence generator over 5 distinct rounds:');
  for (let r = 1; r <= 5; r++) {
    room10.targetWinnerType = 'real';
    const masterSeq: number[] = (gameEngine as any).prepareMasterBallSequence([room10]);

    const simMaster = [...masterSeq];
    const drawnSub: number[] = [];
    let wonAt: number | null = null;
    let count = 0;

    while (simMaster.length > 0) {
      count++;
      drawnSub.push(simMaster.pop()!);
      if (checkWinningPattern(bonusCardMatrix, drawnSub).isWin) {
        wonAt = count;
        break;
      }
    }

    console.log(`   Round ${r}: Bonus Cartela wins at Ball #${wonAt} (Target: ${room10.targetFinishBall})`);
    assert.ok(wonAt !== null, `Round ${r} bonus cartela must win`);
    assert.strictEqual(wonAt, room10.targetFinishBall, `Round ${r} finish ball ${wonAt} must equal target ${room10.targetFinishBall}`);
    assert.ok(wonAt >= 15 && wonAt <= 25, `Round ${r} finish ball ${wonAt} must be in 15-25`);
  }
  console.log('   ✅ PASS: All synchronized rounds accurately finish for bonus player within 15-25 balls!');

  // Cleanup
  room10.tickets.clear();
  gameEngine.setBotConfig({ mode: 'dynamic' });
  console.log('\n=================================================================');
  console.log('🎉 ALL PHASE 2 VERIFICATION CHECKS PASSED SUCCESSFULLY!');
  console.log('=================================================================');
  process.exit(0);
}

runPhase2Verification().catch(err => {
  console.error('❌ Phase 2 Verification Failed:', err);
  process.exit(1);
});
