import { KenoGameEngine } from '../server/game/KenoGameEngine.ts';
import { walletAdapter } from '../server/db/walletAdapter.ts';
import { ProvablyFairKeno } from '../server/game/provablyFair.ts';

console.log('═══════════════════════════════════════════════════════════════');
console.log('🧪 [PHASE 2 TEST] KENO GAME ENGINE & MULTIPLAYER LOOP AUDIT');
console.log('═══════════════════════════════════════════════════════════════\n');

let failed = 0;
function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`   ✓ PASS: ${msg}`);
  } else {
    console.error(`   ✗ FAIL: ${msg}`);
    failed++;
  }
}

async function runEngineAudit() {
  const engine = KenoGameEngine.getInstance(walletAdapter);

  // 1. Initial State Check
  console.log('1️⃣ Auditing Engine Initial State & Clock...');
  assert(engine.currentPhase === 'betting', 'Initial phase is "betting"');
  assert(engine.phaseTimeRemaining <= 30 && engine.phaseTimeRemaining >= 1, 'Betting timer is active (30s window)');
  assert(engine.serverSeedHash.length === 64, 'Server seed hash is pre-committed');

  // 2. Hot & Cold Statistical Engine
  console.log('\n2️⃣ Auditing 100-Round Hot & Cold Analytics...');
  const stats = engine.getHotColdStats();
  assert(stats.hotNumbers.length === 5, 'Exactly 5 Hot numbers calculated');
  assert(stats.coldNumbers.length === 5, 'Exactly 5 Cold numbers calculated');
  assert(Object.keys(stats.frequencyMap).length === 80, 'All 80 numbers have frequency counters');
  console.log(`   • Top 5 Hot Numbers (🔥):  [${stats.hotNumbers.join(', ')}]`);
  console.log(`   • Top 5 Cold Numbers (❄️): [${stats.coldNumbers.join(', ')}]`);

  // 3. Multi-Ticket Placement & Validation
  console.log('\n3️⃣ Auditing Multi-Ticket Placement & Validation...');
  const testUserId = 'audit-player-1';
  // Give player 500 ETB
  const initialBal = await walletAdapter.getBalance(testUserId);
  console.log(`   • Player Initial Balance: ${initialBal.balance} ETB`);

  // Place Ticket 1: 3 Spots [7, 14, 21], stake 10 ETB
  const t1 = await engine.placeTicket(testUserId, [7, 14, 21], 10.00, false);
  assert(t1.success && t1.ticket?.spotCount === 3, 'Ticket #1 (3 spots, 10 ETB) placed successfully');

  // Place Ticket 2: 10 Spots [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], stake 25 ETB
  const t2 = await engine.placeTicket(testUserId, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 25.00, false);
  assert(t2.success && t2.ticket?.spotCount === 10, 'Ticket #2 (10 spots, 25 ETB) placed successfully');

  // Attempt invalid ticket (11 spots - exceeds maximum)
  const tInvalid = await engine.placeTicket(testUserId, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 10.00, false);
  assert(!tInvalid.success, 'Correctly rejected ticket with > 10 spots');

  // Attempt duplicate numbers on a ticket
  const tDup = await engine.placeTicket(testUserId, [5, 5, 12], 10.00, false);
  assert(!tDup.success, 'Correctly rejected ticket with duplicate numbers');

  const activeTickets = engine.getUserTickets(testUserId);
  assert(activeTickets.length === 2, 'User has exactly 2 active tickets registered for this round');

  // 4. Live Draw Sequence
  console.log('\n4️⃣ Testing Provably Fair Draw Generation...');
  const draw = ProvablyFairKeno.generateDraw(engine.serverSeed, engine.clientSeed, engine.nonce);
  assert(draw.length === 20, '20 balls generated deterministically');
  const uniqueSet = new Set(draw);
  assert(uniqueSet.size === 20, 'All 20 balls strictly unique');

  // 5. Provably Fair Round Verification
  console.log('\n5️⃣ Testing Provably Fair Cryptographic Verification...');
  const verifyResult = ProvablyFairKeno.verifyRound(
    engine.serverSeed,
    engine.serverSeedHash,
    engine.clientSeed,
    engine.nonce,
    draw
  );
  assert(verifyResult.valid, 'Cryptographic proof verified against server seed hash');

  console.log('\n═══════════════════════════════════════════════════════════════');
  if (failed === 0) {
    console.log('🎉 ALL PHASE 2 ENGINE & MULTIPLAYER AUDIT CHECKS PASSED!');
  } else {
    console.error(`❌ ${failed} CHECKS FAILED`);
    process.exit(1);
  }
  console.log('═══════════════════════════════════════════════════════════════\n');
  process.exit(0);
}

runEngineAudit().catch(err => {
  console.error('Fatal engine audit error:', err);
  process.exit(1);
});

