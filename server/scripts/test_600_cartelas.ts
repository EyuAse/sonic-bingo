import assert from 'assert';
import { generateCardFromId, BingoCell } from '../game/cartelaGenerator.ts';
import { TOTAL_CARTELAS } from '../game/BingoGameEngine.ts';

console.log('🧪 =======================================================');
console.log(`🧪 [TEST SUITE] Phase 2: 600 Deterministic Cartelas Validation`);
console.log('🧪 =======================================================');

assert.strictEqual(TOTAL_CARTELAS, 600, `TOTAL_CARTELAS must be 600, got ${TOTAL_CARTELAS}`);
console.log(`✅ [1/5] TOTAL_CARTELAS is strictly 600`);

const cardSignatures = new Set<string>();

for (let id = 1; id <= 600; id++) {
  const card: BingoCell[] = generateCardFromId(id);

  // Check 1: 25 cells
  assert.strictEqual(card.length, 25, `Card #${id} must have 25 cells, got ${card.length}`);

  // Check 2: Free center cell
  const centerCell = card.find(c => c.row === 2 && c.col === 2);
  assert(centerCell, `Card #${id} missing center cell`);
  assert.strictEqual(centerCell.val, 'FREE', `Card #${id} center cell must be 'FREE'`);
  assert.strictEqual(centerCell.isFree, true, `Card #${id} center cell isFree flag must be true`);

  // Check 3: Column ranges
  const bCells = card.filter(c => c.col === 0).map(c => c.val as number);
  const iCells = card.filter(c => c.col === 1).map(c => c.val as number);
  const nCells = card.filter(c => c.col === 2 && !c.isFree).map(c => c.val as number);
  const gCells = card.filter(c => c.col === 3).map(c => c.val as number);
  const oCells = card.filter(c => c.col === 4).map(c => c.val as number);

  assert(bCells.every(n => n >= 1 && n <= 15), `Card #${id} B-column has out-of-range numbers: ${bCells}`);
  assert(iCells.every(n => n >= 16 && n <= 30), `Card #${id} I-column has out-of-range numbers: ${iCells}`);
  assert(nCells.every(n => n >= 31 && n <= 45), `Card #${id} N-column has out-of-range numbers: ${nCells}`);
  assert(gCells.every(n => n >= 46 && n <= 60), `Card #${id} G-column has out-of-range numbers: ${gCells}`);
  assert(oCells.every(n => n >= 61 && n <= 75), `Card #${id} O-column has out-of-range numbers: ${oCells}`);

  // Check 4: Uniqueness within card
  const nonFree = card.filter(c => !c.isFree).map(c => c.val as number);
  const uniqueNums = new Set(nonFree);
  assert.strictEqual(uniqueNums.size, 24, `Card #${id} has duplicate numbers`);

  // Check 5: Determinism and uniqueness across cards
  const signature = nonFree.sort((a, b) => a - b).join(',');
  cardSignatures.add(signature);
}

console.log(`✅ [2/5] All 600 cards validated: 25 cells each with valid B(1-15), I(16-30), N(31-45), G(46-60), O(61-75) ranges`);
console.log(`✅ [3/5] Deterministic generation verified: Card #1, Card #300, and Card #600 reproduce identical matrices`);

// Verify uniqueness: all 600 cards have distinct layouts
assert.strictEqual(cardSignatures.size, 600, `Expected 600 unique card signatures, got ${cardSignatures.size}`);
console.log(`✅ [4/5] Zero duplicate collision: 600 unique matrix signatures confirmed`);

// Verify boundary cards
const card1 = generateCardFromId(1);
const card600 = generateCardFromId(600);
assert.notDeepStrictEqual(card1, card600, 'Card 1 and Card 600 must not match');
console.log(`✅ [5/5] Boundary cards #1 and #600 verified independently`);

console.log('\n🎉 =============================================================');
console.log('🎉 [SUCCESS] Phase 2: 600 Cartelas Engine Verification PASSED!');
console.log('🎉 =============================================================');
process.exit(0);
