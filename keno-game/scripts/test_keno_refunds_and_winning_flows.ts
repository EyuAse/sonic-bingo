import { ATLAS_V_PAYTABLE } from '../server/game/kenoMath.ts';

console.log('═══════════════════════════════════════════════════════════════');
console.log('🧪 [VERIFICATION TEST] ATLAS-V KENO REFUNDS & WINNING FLOWS');
console.log('═══════════════════════════════════════════════════════════════\n');

// 1. Audit Partial & Catch-Zero Refunds
console.log('1️⃣ Auditing Authentic Refund Mechanics:');

// Test 2 Spots: Catch 1 should refund stake (1.0x)
const spot2_hit1 = ATLAS_V_PAYTABLE[2][1];
if (spot2_hit1 === 1.0) {
  console.log('   ✓ PASS: 2 Spots - 1 Hit returns exactly 1.0x (Stake Refund / Money Back 🛡️)');
} else {
  throw new Error(`Expected 2 spots 1 hit to be 1.0, got ${spot2_hit1}`);
}

// Test 2 Spots: Catch 2 should pay 10.0x
const spot2_hit2 = ATLAS_V_PAYTABLE[2][2];
if (spot2_hit2 === 10.0) {
  console.log('   ✓ PASS: 2 Spots - 2 Hits returns exactly 10.0x (Win 🏆)');
} else {
  throw new Error(`Expected 2 spots 2 hits to be 10.0, got ${spot2_hit2}`);
}

// Test 5 Spots: Catch 2 should refund stake (1.0x)
const spot5_hit2 = ATLAS_V_PAYTABLE[5][2];
if (spot5_hit2 === 1.0) {
  console.log('   ✓ PASS: 5 Spots - 2 Hits returns exactly 1.0x (Stake Refund / Money Back 🛡️)');
} else {
  throw new Error(`Expected 5 spots 2 hits to be 1.0, got ${spot5_hit2}`);
}

// Test 7 Spots: Catch 0 should refund stake (1.0x)
const spot7_hit0 = ATLAS_V_PAYTABLE[7][0];
if (spot7_hit0 === 1.0) {
  console.log('   ✓ PASS: 7 Spots - 0 Hits returns exactly 1.0x (Catch-Zero Refund 🛡️)');
} else {
  throw new Error(`Expected 7 spots 0 hits to be 1.0, got ${spot7_hit0}`);
}

// Test 8 Spots: Catch 0 should refund stake (1.0x)
const spot8_hit0 = ATLAS_V_PAYTABLE[8][0];
if (spot8_hit0 === 1.0) {
  console.log('   ✓ PASS: 8 Spots - 0 Hits returns exactly 1.0x (Catch-Zero Refund 🛡️)');
} else {
  throw new Error(`Expected 8 spots 0 hits to be 1.0, got ${spot8_hit0}`);
}

// Test 9 Spots: Catch 0 should pay 2.0x bonus
const spot9_hit0 = ATLAS_V_PAYTABLE[9][0];
if (spot9_hit0 === 2.0) {
  console.log('   ✓ PASS: 9 Spots - 0 Hits returns exactly 2.0x (Catch-Zero Bonus Win 🎁)');
} else {
  throw new Error(`Expected 9 spots 0 hits to be 2.0, got ${spot9_hit0}`);
}

// Test 10 Spots: Catch 0 should pay 2.0x bonus & 10 hits 10,000x jackpot
const spot10_hit0 = ATLAS_V_PAYTABLE[10][0];
const spot10_hit10 = ATLAS_V_PAYTABLE[10][10];
if (spot10_hit0 === 2.0 && spot10_hit10 === 10000.0) {
  console.log('   ✓ PASS: 10 Spots - 0 Hits pays 2.0x Bonus, 10 Hits pays 10,000x TOP JACKPOT 🌟');
} else {
  throw new Error(`Expected 10 spots 0=2.0 and 10=10000.0, got 0=${spot10_hit0}, 10=${spot10_hit10}`);
}

// 2. Multi-Ticket Settlement Calculation Simulation
console.log('\n2️⃣ Testing Multi-Ticket Settlement & Itemized Victory Calculation:');
const roundTickets = [
  { id: 'tk-1', spotCount: 2, selectedNumbers: [7, 14], betAmount: 10 },
  { id: 'tk-2', spotCount: 2, selectedNumbers: [3, 28], betAmount: 20 },
  { id: 'tk-3', spotCount: 10, selectedNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], betAmount: 10 }
];

// Simulated draw: 7, 14, 45, 56, 67, ... (no 3, 28, and no 1..10 except 7)
const drawnBalls = [7, 14, 21, 22, 23, 24, 25, 26, 27, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40];

let totalWon = 0;
let totalStake = 0;
const itemized = roundTickets.map((t) => {
  totalStake += t.betAmount;
  const hits = t.selectedNumbers.filter(n => drawnBalls.includes(n));
  const p = ATLAS_V_PAYTABLE[t.spotCount] || {};
  const mult = p[hits.length] !== undefined ? p[hits.length] : (hits.length === 0 && p[0] !== undefined ? p[0] : 0);
  const win = mult * t.betAmount;
  totalWon += win;
  return {
    id: t.id,
    hits: hits.length,
    spots: t.spotCount,
    mult,
    bet: t.betAmount,
    win,
    isRefund: win === t.betAmount && mult === 1.0
  };
});

// Ticket 1: 7, 14 -> 2 hits out of 2 -> 10x -> 100 ETB
console.log(`   • Ticket #1 (2 Spots, 10 ETB): ${itemized[0].hits}/${itemized[0].spots} Hits -> ${itemized[0].mult}x -> ${itemized[0].win} ETB Won`);
if (itemized[0].win === 100) {
  console.log('   ✓ PASS: Ticket #1 won 100 ETB');
} else {
  throw new Error(`Ticket 1 payout mismatch: expected 100, got ${itemized[0].win}`);
}

// Ticket 2: 3, 28 -> 0 hits out of 2 -> 0x -> 0 ETB
console.log(`   • Ticket #2 (2 Spots, 20 ETB): ${itemized[1].hits}/${itemized[1].spots} Hits -> ${itemized[1].mult}x -> ${itemized[1].win} ETB`);

// Check Net Profit
const netProfit = totalWon - totalStake;
console.log(`   • Total Stake: ${totalStake} ETB | Total Payout: ${totalWon} ETB | Net: +${netProfit} ETB`);
if (totalWon === 100 && totalStake === 40 && netProfit === 60) {
  console.log('   ✓ PASS: Itemized calculation and ledger math match perfectly!');
} else {
  throw new Error('Ledger mismatch');
}

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('🎉 ALL ATLAS-V REFUND & WINNING FLOW AUDITS PASSED CLEANLY');
console.log('═══════════════════════════════════════════════════════════════\n');

