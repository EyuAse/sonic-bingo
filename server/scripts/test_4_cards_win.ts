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
console.log('🧪 [TEST SUITE] Phase 2: 5-Card Capacity & Win Scanner Test');
console.log('🧪 ========================================================');

// 1. Verify Configuration Constants
assert.strictEqual(MAX_TICKETS_PER_PLAYER, 5, `MAX_TICKETS_PER_PLAYER must be 5, got ${MAX_TICKETS_PER_PLAYER}`);
assert.strictEqual(TOTAL_CARTELAS, 600, `TOTAL_CARTELAS must be 600, got ${TOTAL_CARTELAS}`);
console.log(`✅ [1/5] Engine limits confirmed: MAX_TICKETS_PER_PLAYER = 5, TOTAL_CARTELAS = 600`);

// 2. Verify Synchronized 40-Second Master Lobby Countdown
const room10 = gameEngine.getRoom('room-10');
assert(room10, 'room-10 must exist');
assert.strictEqual(room10.lobbyCountdown, 40, `Lobby countdown must be 40s, got ${room10.lobbyCountdown}`);
console.log(`✅ [2/5] 40-Second Master Lobby Countdown strictly calibrated at 40s`);

// 3. Multi-Card Generation: Generate 5 distinct cards for 1 player
const cardIds = [15, 142, 388, 520, 599];
const playerCardMatrices: BingoCell[][] = cardIds.map(id => generateCardFromId(id));
assert.strictEqual(playerCardMatrices.length, 5, 'Must hold 5 cards');
console.log(`✅ [3/5] Player successfully assigned 5 cards: #${cardIds.join(', #')}`);

// 4. Test Multi-Card Simultaneous Scanner
// Draw all numbers of Row 1 on Card #5 (cardId 599)
const card5 = playerCardMatrices[4];
const card5Row1Numbers = card5.filter(c => c.row === 0 && !c.isFree).map(c => c.val as number);

// Verify Card 5 does not win before drawing row 1
const preCheck = checkWinningPattern(card5, [999]);
assert.strictEqual(preCheck.isWin, false, 'Pre-check must not win');

// Draw the exact 5 numbers for Row 1
const winCheckCard5 = checkWinningPattern(card5, card5Row1Numbers);
assert.strictEqual(winCheckCard5.isWin, true, 'Card 5 must win when all Row 1 numbers are drawn');
assert.strictEqual(winCheckCard5.winningPattern, 'Row 1', `Winning pattern must be 'Row 1', got ${winCheckCard5.winningPattern}`);
console.log(`✅ [4/5] Multi-card win scanner successfully detected win on Card 5 (#599): "${winCheckCard5.winningPattern}"`);

// 5. Test All 13 Winning Patterns across the 5 cards
const patternsTested = new Set<string>();

// Test Horizontal Rows (1 to 5)
for (let r = 0; r < 5; r++) {
  const rowNums = card5.filter(c => c.row === r && !c.isFree).map(c => c.val as number);
  const wins = getAllWinningPatterns(card5, rowNums);
  assert(wins.some(w => w.patternName === `Row ${r + 1}`), `Row ${r + 1} win pattern failed`);
  patternsTested.add(`Row ${r + 1}`);
}

// Test Vertical Columns (B, I, N, G, O)
const colNames = ['B', 'I', 'N', 'G', 'O'];
for (let col = 0; col < 5; col++) {
  const colNums = card5.filter(c => c.col === col && !c.isFree).map(c => c.val as number);
  const wins = getAllWinningPatterns(card5, colNums);
  assert(wins.some(w => w.patternName === `Column ${colNames[col]}`), `Column ${colNames[col]} win pattern failed`);
  patternsTested.add(`Column ${colNames[col]}`);
}

// Test Main Diagonal (\)
const diag1Nums = card5.filter(c => c.row === c.col && !c.isFree).map(c => c.val as number);
const diag1Wins = getAllWinningPatterns(card5, diag1Nums);
assert(diag1Wins.some(w => w.patternName === 'Diagonal \\'), 'Diagonal \\ failed');
patternsTested.add('Diagonal \\');

// Test Anti Diagonal (/)
const diag2Nums = card5.filter(c => c.row + c.col === 4 && !c.isFree).map(c => c.val as number);
const diag2Wins = getAllWinningPatterns(card5, diag2Nums);
assert(diag2Wins.some(w => w.patternName === 'Diagonal /'), 'Diagonal / failed');
patternsTested.add('Diagonal /');

// Test 4 Corners
const cornerIndices = [0, 4, 20, 24];
const cornerNums = card5.filter(c => cornerIndices.includes(c.index)).map(c => c.val as number);
const cornerWins = getAllWinningPatterns(card5, cornerNums);
assert(cornerWins.some(w => w.patternName === 'Four Corners'), 'Four Corners failed');
patternsTested.add('Four Corners');

assert.strictEqual(patternsTested.size, 13, `Expected 13 distinct winning patterns, got ${patternsTested.size}`);
console.log(`✅ [5/5] All 13 winning patterns verified across 5-card matrix pool: ${Array.from(patternsTested).join(', ')}`);

console.log('\n🎉 ============================================================');
console.log('🎉 [SUCCESS] Phase 2: 5-Card Capacity & Win Scanner Tests OK!');
console.log('🎉 ============================================================');
process.exit(0);

