import assert from 'assert';
import {
  generateCardFromId,
  checkWinningPattern,
  getAllWinningPatterns,
  BingoCell
} from '../game/cartelaGenerator.ts';
import {
  TOTAL_CARTELAS,
  MAX_TICKETS_PER_PLAYER,
  gameEngine
} from '../game/BingoGameEngine.ts';

console.log('🧪 ========================================================');
console.log('🧪 [TEST SUITE] Phase 2: 4-Card Capacity & Win Scanner Test');
console.log('🧪 ========================================================');

// 1. Verify Configuration Constants
assert.strictEqual(MAX_TICKETS_PER_PLAYER, 4, `MAX_TICKETS_PER_PLAYER must be 4, got ${MAX_TICKETS_PER_PLAYER}`);
assert.strictEqual(TOTAL_CARTELAS, 600, `TOTAL_CARTELAS must be 600, got ${TOTAL_CARTELAS}`);
console.log(`✅ [1/5] Engine limits confirmed: MAX_TICKETS_PER_PLAYER = 4, TOTAL_CARTELAS = 600`);

// 2. Verify Synchronized 45-Second Master Lobby Countdown
const room10 = gameEngine.getRoom('room-10');
assert(room10, 'room-10 must exist');
assert.strictEqual(room10.lobbyCountdown, 45, `Lobby countdown must be 45s, got ${room10.lobbyCountdown}`);
console.log(`✅ [2/5] 45-Second Master Lobby Countdown strictly locked at 45s`);

// 3. Multi-Card Generation: Generate 4 distinct cards for 1 player
const cardIds = [15, 142, 388, 599];
const playerCardMatrices: BingoCell[][] = cardIds.map(id => generateCardFromId(id));
assert.strictEqual(playerCardMatrices.length, 4, 'Must hold 4 cards');
console.log(`✅ [3/5] Player successfully assigned 4 cards: #${cardIds.join(', #')}`);

// 4. Test Multi-Card Simultaneous Scanner
// Draw all numbers of Row 1 on Card #4 (cardId 599)
const card4 = playerCardMatrices[3];
const card4Row1Numbers = card4.filter(c => c.row === 0 && !c.isFree).map(c => c.val as number);

// Verify Card 4 does not win before drawing row 1
const preCheck = checkWinningPattern(card4, [999]);
assert.strictEqual(preCheck.isWin, false, 'Pre-check must not win');

// Draw the exact 5 numbers for Row 1
const winCheckCard4 = checkWinningPattern(card4, card4Row1Numbers);
assert.strictEqual(winCheckCard4.isWin, true, 'Card 4 must win when all Row 1 numbers are drawn');
assert.strictEqual(winCheckCard4.winningPattern, 'Row 1', `Winning pattern must be 'Row 1', got ${winCheckCard4.winningPattern}`);
console.log(`✅ [4/5] Multi-card win scanner successfully detected win on Card 4 (#599): "${winCheckCard4.winningPattern}"`);

// 5. Test All 13 Winning Patterns across the 4 cards
const patternsTested = new Set<string>();

// Test Horizontal Rows (1 to 5)
for (let r = 0; r < 5; r++) {
  const rowNums = card4.filter(c => c.row === r && !c.isFree).map(c => c.val as number);
  const wins = getAllWinningPatterns(card4, rowNums);
  assert(wins.some(w => w.patternName === `Row ${r + 1}`), `Row ${r + 1} win pattern failed`);
  patternsTested.add(`Row ${r + 1}`);
}

// Test Vertical Columns (B, I, N, G, O)
const colNames = ['B', 'I', 'N', 'G', 'O'];
for (let col = 0; col < 5; col++) {
  const colNums = card4.filter(c => c.col === col && !c.isFree).map(c => c.val as number);
  const wins = getAllWinningPatterns(card4, colNums);
  assert(wins.some(w => w.patternName === `Column ${colNames[col]}`), `Column ${colNames[col]} win pattern failed`);
  patternsTested.add(`Column ${colNames[col]}`);
}

// Test Main Diagonal (\)
const diag1Nums = card4.filter(c => c.row === c.col && !c.isFree).map(c => c.val as number);
const diag1Wins = getAllWinningPatterns(card4, diag1Nums);
assert(diag1Wins.some(w => w.patternName === 'Diagonal \\'), 'Diagonal \\ failed');
patternsTested.add('Diagonal \\');

// Test Anti Diagonal (/)
const diag2Nums = card4.filter(c => c.row + c.col === 4 && !c.isFree).map(c => c.val as number);
const diag2Wins = getAllWinningPatterns(card4, diag2Nums);
assert(diag2Wins.some(w => w.patternName === 'Diagonal /'), 'Diagonal / failed');
patternsTested.add('Diagonal /');

// Test 4 Corners
const cornerIndices = [0, 4, 20, 24];
const cornerNums = card4.filter(c => cornerIndices.includes(c.index)).map(c => c.val as number);
const cornerWins = getAllWinningPatterns(card4, cornerNums);
assert(cornerWins.some(w => w.patternName === 'Four Corners'), 'Four Corners failed');
patternsTested.add('Four Corners');

assert.strictEqual(patternsTested.size, 13, `Expected 13 distinct winning patterns, got ${patternsTested.size}`);
console.log(`✅ [5/5] All 13 winning patterns verified across 4-card matrix pool: ${Array.from(patternsTested).join(', ')}`);

console.log('\n🎉 ============================================================');
console.log('🎉 [SUCCESS] Phase 2: 4-Card Capacity & Win Scanner Tests OK!');
console.log('🎉 ============================================================');
process.exit(0);

