import {
  ATLAS_V_PAYTABLE,
  calculateRTP,
  evaluateKenoTicket,
  combinations,
  kenoProbability
} from '../server/game/kenoMath.ts';
import { ProvablyFairKeno } from '../server/game/provablyFair.ts';
import { walletAdapter } from '../server/db/walletAdapter.ts';

console.log('═══════════════════════════════════════════════════════════════');
console.log('🧪 [PHASE 1 STANDALONE TEST] ATLAS-V KENO MATH & ENGINE AUDIT');
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

// 1. Audit Paytable & Combinatorics
console.log('1️⃣ Auditing Atlas-V 10-Tier Multiplier Matrix...');
assert(ATLAS_V_PAYTABLE[10][10] === 10000, '10 Spots top jackpot is exactly 10,000x');
assert(ATLAS_V_PAYTABLE[9][9] === 5000, '9 Spots top prize is exactly 5,000x');
assert(ATLAS_V_PAYTABLE[8][8] === 2000, '8 Spots top prize is exactly 2,000x');
assert(ATLAS_V_PAYTABLE[7][7] === 1000, '7 Spots top prize is exactly 1,000x');

// Audit 0-hit refund feature (Atlas-V signature rule)
assert(ATLAS_V_PAYTABLE[7][0] === 1, '7 Spots with 0 hits refunds 1x stake');
assert(ATLAS_V_PAYTABLE[8][0] === 1, '8 Spots with 0 hits refunds 1x stake');
assert(ATLAS_V_PAYTABLE[9][0] === 2, '9 Spots with 0 hits refunds 2x stake');
assert(ATLAS_V_PAYTABLE[10][0] === 2, '10 Spots with 0 hits refunds 2x stake');
assert(ATLAS_V_PAYTABLE[6][0] === undefined, '6 Spots with 0 hits gives 0x (no refund)');

// Combinations verification: 80C20 = 3,535,316,142,212,174,320
const totalWays = combinations(80, 20);
assert(totalWays > 3.5e18 && totalWays < 3.6e18, 'Total 80C20 combinations is ~3.535 x 10^18');

// 2. Audit Theoretical RTP Distribution
console.log('\n2️⃣ Auditing Theoretical RTP per Spot Count (1 to 10)...');
for (let spots = 1; spots <= 10; spots++) {
  const rtp = calculateRTP(spots);
  const rtpPercent = (rtp * 100).toFixed(2);
  console.log(`   • Spots ${spots.toString().padStart(2)}: RTP = ${rtpPercent}%`);
  assert(rtp >= 0.85 && rtp <= 1.00, `Spots ${spots} RTP (${rtpPercent}%) preserves house edge (< 100%)`);
}

// 3. Audit Provably Fair Cryptographic Draw Generation
console.log('\n3️⃣ Auditing SHA-256 HMAC Provably Fair RNG...');
const { serverSeed, serverSeedHash } = ProvablyFairKeno.generateServerSeed();
assert(serverSeed.length === 64, 'Server seed is 32 bytes hex (64 chars)');
assert(serverSeedHash.length === 64, 'Server seed hash is valid SHA-256 (64 chars)');

const clientSeed = 'sonic-test-client-seed';
const nonce = 101;
const drawn = ProvablyFairKeno.generateDraw(serverSeed, clientSeed, nonce);

assert(drawn.length === 20, 'Draw sequence produces exactly 20 balls');
const uniqueDrawn = new Set(drawn);
assert(uniqueDrawn.size === 20, 'All 20 drawn balls are strictly unique (no duplicates)');
const inRange = drawn.every(b => b >= 1 && b <= 80);
assert(inRange, 'All 20 drawn balls fall strictly within [1, 80]');

// Verify round check
const verification = ProvablyFairKeno.verifyRound(serverSeed, serverSeedHash, clientSeed, nonce, drawn);
assert(verification.valid, 'Provably fair verification succeeds for genuine round');

// Tamper test (wrong seed should fail)
const badVerification = ProvablyFairKeno.verifyRound('wrong_seed_1234', serverSeedHash, clientSeed, nonce, drawn);
assert(!badVerification.valid, 'Provably fair correctly rejects tampered server seed');

// 4. Audit Mock Wallet Adapter (In-Memory, Zero DB)
console.log('\n4️⃣ Auditing In-Memory Standalone Wallet Adapter...');
async function testWallet() {
  const initial = await walletAdapter.getBalance('demo-user-1');
  assert(initial.balance === 250, 'Initial demo balance is 250 ETB');

  // Deduct 20 ETB bet
  const debit = await walletAdapter.deductBet('demo-user-1', 20.00, 'round-test-1', false);
  assert(debit.success && debit.balanceAfter === 230, '20 ETB bet deducted cleanly (Balance: 230 ETB)');

  // Credit 150 ETB win
  const credit = await walletAdapter.creditWin('demo-user-1', 150.00, 'round-test-1', debit.referenceCode);
  assert(credit.success && credit.balanceAfter === 380, '150 ETB win credited cleanly (Balance: 380 ETB)');

  // Insufficient balance test
  const overBet = await walletAdapter.deductBet('demo-user-1', 99999.00, 'round-test-2', false);
  assert(!overBet.success, 'Correctly blocks bet exceeding wallet balance');
}

testWallet().then(() => {
  console.log('\n═══════════════════════════════════════════════════════════════');
  if (failed === 0) {
    console.log('🎉 ALL PHASE 1 STANDALONE AUDIT CHECKS PASSED (100% OPERATIONAL)');
  } else {
    console.error(`❌ ${failed} CHECKS FAILED`);
    process.exit(1);
  }
  console.log('═══════════════════════════════════════════════════════════════\n');
});
