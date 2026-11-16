import { ProvablyFairKeno } from '../server/game/provablyFair.ts';

console.log('═══════════════════════════════════════════════════════════════');
console.log('🛡️ [PHASE 5 TEST] CRYPTOGRAPHIC PROVABLY FAIR VERIFICATION AUDIT');
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

function runProvablyFairAudit() {
  console.log('1️⃣ Auditing Seed Generation & Hash Pre-Commitment...');
  const { serverSeed, serverSeedHash: seedHash } = ProvablyFairKeno.generateServerSeed();
  assert(serverSeed.length === 64, 'Server seed is 64 hex characters (256-bit)');
  assert(seedHash.length === 64, 'Seed hash is 64 hex characters (SHA-256)');

  // 2. Determinism Check
  console.log('\n2️⃣ Auditing Deterministic Draw Generation...');
  const clientSeed = 'test-client-seed-123';
  const nonce = 1001;

  const draw1 = ProvablyFairKeno.generateDraw(serverSeed, clientSeed, nonce);
  const draw2 = ProvablyFairKeno.generateDraw(serverSeed, clientSeed, nonce);

  assert(draw1.length === 20, 'Generates exactly 20 balls');
  assert(new Set(draw1).size === 20, 'All 20 balls are strictly unique (1 to 80)');
  assert(
    JSON.stringify(draw1) === JSON.stringify(draw2),
    'Draw is 100% deterministic (identical seeds yield identical sequence)'
  );

  // 3. Different Nonce / Seed Produces Different Draw
  console.log('\n3️⃣ Auditing Entropy & Nonce Sensitivity...');
  const draw3 = ProvablyFairKeno.generateDraw(serverSeed, clientSeed, nonce + 1);
  assert(
    JSON.stringify(draw1) !== JSON.stringify(draw3),
    'Incrementing nonce changes draw outcome completely'
  );

  // 4. Verification of Legit Round
  console.log('\n4️⃣ Auditing Cryptographic Verification Helper...');
  const legitVerification = ProvablyFairKeno.verifyRound(
    serverSeed,
    seedHash,
    clientSeed,
    nonce,
    draw1
  );
  assert(legitVerification.valid, 'Legitimate round verified successfully');

  // 5. Tamper Detection - Altered Draw
  console.log('\n5️⃣ Auditing Anti-Tampering Security...');
  const tamperedDraw = [...draw1];
  tamperedDraw[0] = tamperedDraw[0] === 1 ? 2 : 1; // Tamper with 1 ball
  const tamperedVerification = ProvablyFairKeno.verifyRound(
    serverSeed,
    seedHash,
    clientSeed,
    nonce,
    tamperedDraw
  );
  assert(!tamperedVerification.valid, 'Correctly detected and rejected tampered ball draw');

  // 6. Tamper Detection - Altered Seed Hash
  const wrongHash = seedHash.replace(/^./, seedHash[0] === 'a' ? 'b' : 'a');
  const fakeHashVerification = ProvablyFairKeno.verifyRound(
    serverSeed,
    wrongHash,
    clientSeed,
    nonce,
    draw1
  );
  assert(!fakeHashVerification.valid, 'Correctly rejected mismatched server seed hash');

  console.log('\n═══════════════════════════════════════════════════════════════');
  if (failed === 0) {
    console.log('🎉 ALL PROVABLY FAIR CRYPTOGRAPHIC CHECKS PASSED 100%!');
  } else {
    console.error(`❌ ${failed} CHECKS FAILED`);
    process.exit(1);
  }
  console.log('═══════════════════════════════════════════════════════════════\n');
}

runProvablyFairAudit();
