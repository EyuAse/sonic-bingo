import crypto from 'crypto';
import { resolveMappedCardId } from '../../shared/cartelaDeckShuffle.ts';

export interface BingoCell {
  index: number;
  row: number;
  col: number;
  colLetter: 'B' | 'I' | 'N' | 'G' | 'O';
  val: number | 'FREE';
  isFree: boolean;
}

/**
 * Deterministic PRNG using Cartela ID (mapped via optional round shuffleSeed).
 * Matches frontend generator perfectly so Cartela #X has identical numbers everywhere.
 */
export function generateCardFromId(cartelaId: number, shuffleSeed: number = 0): BingoCell[] {
  const effectiveCardId = resolveMappedCardId(cartelaId, shuffleSeed);
  let seed = effectiveCardId * 7919 + 1013;
  const pseudoRandom = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  const getUniqueRandoms = (min: number, max: number, count: number): number[] => {
    const pool: number[] = [];
    for (let i = min; i <= max; i++) pool.push(i);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(pseudoRandom() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count);
  };

  const bNums = getUniqueRandoms(1, 15, 5);
  const iNums = getUniqueRandoms(16, 30, 5);
  const nNums = getUniqueRandoms(31, 45, 4); // 4 + FREE center
  const gNums = getUniqueRandoms(46, 60, 5);
  const oNums = getUniqueRandoms(61, 75, 5);

  const cells: BingoCell[] = [];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const idx = row * 5 + col;
      let val: number | 'FREE';
      let colLetter: 'B' | 'I' | 'N' | 'G' | 'O';
      let isFree = false;

      if (col === 0) { val = bNums[row]; colLetter = 'B'; }
      else if (col === 1) { val = iNums[row]; colLetter = 'I'; }
      else if (col === 2) {
        if (row === 2) { val = 'FREE'; colLetter = 'N'; isFree = true; }
        else { val = nNums[row > 2 ? row - 1 : row]; colLetter = 'N'; }
      }
      else if (col === 3) { val = gNums[row]; colLetter = 'G'; }
      else { val = oNums[row]; colLetter = 'O'; }

      cells.push({ index: idx, row, col, colLetter, val, isFree });
    }
  }

  return cells;
}

/**
 * Server-Side Win Validation Engine
 */
export interface WinningPatternResult {
  patternName: string;
  indices: number[];
  numbers: number[];
}

/**
  * Returns all completed winning patterns for a card matrix against drawn balls
  */
export function getAllWinningPatterns(
  cardMatrix: BingoCell[],
  drawnNumbers: number[]
): WinningPatternResult[] {
  const drawnSet = new Set(drawnNumbers);
  const isMarked = (cell: BingoCell) => cell.isFree || (typeof cell.val === 'number' && drawnSet.has(cell.val));
  const results: WinningPatternResult[] = [];

  // 1. Check 5 Horizontal Rows
  for (let row = 0; row < 5; row++) {
    const rowCells = cardMatrix.filter(c => c.row === row);
    if (rowCells.every(isMarked)) {
      results.push({
        patternName: `Row ${row + 1}`,
        indices: rowCells.map(c => c.index),
        numbers: rowCells.filter(c => !c.isFree && typeof c.val === 'number').map(c => c.val as number)
      });
    }
  }

  // 2. Check 5 Vertical Columns
  for (let col = 0; col < 5; col++) {
    const colCells = cardMatrix.filter(c => c.col === col);
    if (colCells.every(isMarked)) {
      results.push({
        patternName: `Column ${['B', 'I', 'N', 'G', 'O'][col]}`,
        indices: colCells.map(c => c.index),
        numbers: colCells.filter(c => !c.isFree && typeof c.val === 'number').map(c => c.val as number)
      });
    }
  }

  // 3. Check Main Diagonal (\)
  const diag1 = cardMatrix.filter(c => c.row === c.col);
  if (diag1.every(isMarked)) {
    results.push({
      patternName: 'Diagonal \\',
      indices: diag1.map(c => c.index),
      numbers: diag1.filter(c => !c.isFree && typeof c.val === 'number').map(c => c.val as number)
    });
  }

  // 4. Check Anti-Diagonal (/)
  const diag2 = cardMatrix.filter(c => c.row + c.col === 4);
  if (diag2.every(isMarked)) {
    results.push({
      patternName: 'Diagonal /',
      indices: diag2.map(c => c.index),
      numbers: diag2.filter(c => !c.isFree && typeof c.val === 'number').map(c => c.val as number)
    });
  }

  // 5. Check 4 Corners
  const cornerIndices = [0, 4, 20, 24];
  const cornerCells = cardMatrix.filter(c => cornerIndices.includes(c.index));
  if (cornerCells.length === 4 && cornerCells.every(isMarked)) {
    results.push({
      patternName: 'Four Corners',
      indices: cornerIndices,
      numbers: cornerCells.filter(c => !c.isFree && typeof c.val === 'number').map(c => c.val as number)
    });
  }

  return results;
}

/**
 * Validates whether a given card matrix has achieved a complete winning line against drawn balls
 */
export function checkWinningPattern(
  cardMatrix: BingoCell[],
  drawnNumbers: number[]
): { isWin: boolean; winningPattern?: string; winningIndices?: number[] } {
  const all = getAllWinningPatterns(cardMatrix, drawnNumbers);
  if (all.length > 0) {
    return {
      isWin: true,
      winningPattern: all[0].patternName,
      winningIndices: all[0].indices
    };
  }
  return { isWin: false };
}

/**
 * Get ball column letter for 1-75 standard 75-Ball Bingo
 */
export function getBallColumn(num: number): 'B' | 'I' | 'N' | 'G' | 'O' {
  if (num <= 15) return 'B';
  if (num <= 30) return 'I';
  if (num <= 45) return 'N';
  if (num <= 60) return 'G';
  return 'O';
}

/**
 * Generate cryptographically secure shuffle of numbers 1 to 75
 */
export function generateRandomShuffledBalls(): number[] {
  const balls: number[] = Array.from({ length: 75 }, (_, i) => i + 1);
  for (let i = balls.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [balls[i], balls[j]] = [balls[j], balls[i]];
  }
  return balls;
}
