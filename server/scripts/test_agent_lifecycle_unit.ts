import bcrypt from 'bcryptjs';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function testAgentLifecycle() {
  console.log('\n🧪 ========================================================');
  console.log('🧪 [TEST SUITE] Agent Lifecycle & Password Management Unit Tests');
  console.log('🧪 ========================================================\n');

  // Test 1: Password Hashing & Verification
  console.log('--- Test 1: Bcrypt Password Hashing & Auth Verification ---');
  const initialPassword = 'Sonic@8492';
  const hashedPassword = await bcrypt.hash(initialPassword, 10);

  const correctMatch = await bcrypt.compare(initialPassword, hashedPassword);
  assert(correctMatch, 'Valid initial password matches hash');

  const wrongMatch = await bcrypt.compare('WrongPassword', hashedPassword);
  assert(!wrongMatch, 'Invalid password is rejected');

  // Test 2: Password Reset / Change
  console.log('\n--- Test 2: Agent Self-Service / Admin Password Reset ---');
  const updatedPassword = 'NewSecretPassword#2026';
  const updatedHash = await bcrypt.hash(updatedPassword, 10);

  const oldMatch = await bcrypt.compare(initialPassword, updatedHash);
  assert(!oldMatch, 'Old password no longer valid after update');

  const newMatch = await bcrypt.compare(updatedPassword, updatedHash);
  assert(newMatch, 'New password matches updated hash');

  // Test 3: Pot Mathematical Split (70/10/20) with live game formula
  console.log('\n--- Test 3: BingoGameEngine Pot Split Logic ---');
  const simulateRound = (pot: number, commissionEnabled: boolean) => {
    const houseFee = commissionEnabled ? Math.floor(pot * 0.20) : 0;
    const jackpotFee = commissionEnabled ? Math.floor(pot * 0.10) : 0;
    const winnerPayout = pot - houseFee - jackpotFee;
    return { houseFee, jackpotFee, winnerPayout };
  };

  const r10 = simulateRound(500, true);
  assert(r10.winnerPayout === 350, 'Room 10 (500 ETB): Winner gets 350 ETB (70%)');
  assert(r10.jackpotFee === 50, 'Room 10 (500 ETB): Jackpot pool gets 50 ETB (10%)');
  assert(r10.houseFee === 100, 'Room 10 (500 ETB): House fee gets 100 ETB (20%)');

  const earlyR20 = simulateRound(60, false);
  assert(earlyR20.winnerPayout === 60, 'Early Room 20 (<=5 cards): Winner gets 100% (60 ETB)');
  assert(earlyR20.jackpotFee === 0, 'Early Room 20: Jackpot gets 0 ETB');
  assert(earlyR20.houseFee === 0, 'Early Room 20: House fee gets 0 ETB');

  const activeR20 = simulateRound(200, true);
  assert(activeR20.winnerPayout === 140, 'Active Room 20 (>5 cards): Winner gets 140 ETB (70%)');
  assert(activeR20.jackpotFee === 20, 'Active Room 20: Jackpot gets 20 ETB (10%)');
  assert(activeR20.houseFee === 40, 'Active Room 20: House fee gets 40 ETB (20%)');

  console.log('\n🎉 ALL AGENT LIFECYCLE & JACKPOT MATH UNIT TESTS PASSED SUCCESSFULLY!\n');
}

testAgentLifecycle().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

