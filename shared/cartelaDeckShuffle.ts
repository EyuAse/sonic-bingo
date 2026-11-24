/**
 * Deterministic 600-Card Deck Permutation Utility
 * Preserves the exact 600 master Cartela cards (#1..#600) while shuffling which
 * master card occupies each numbered slot after every completed round.
 */

export const TOTAL_CARTELA_CARDS = 600;

let cachedSeed = -1;
let cachedDeck: Uint16Array | null = null;

function createPrng(seed: number): () => number {
  let a = (seed >>> 0) || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Builds the 600-element 1-to-1 permutation mapping slot index (0..599) to master card ID (1..600).
 * Seed 0 returns identity [1..600] for backwards compatibility.
 */
export function buildCartelaDeck(shuffleSeed: number = 0): Uint16Array {
  const normalizedSeed = shuffleSeed > 0 ? (shuffleSeed >>> 0) : 0;
  if (cachedDeck && cachedSeed === normalizedSeed) {
    return cachedDeck;
  }

  const deck = new Uint16Array(TOTAL_CARTELA_CARDS);
  for (let i = 0; i < TOTAL_CARTELA_CARDS; i++) {
    deck[i] = i + 1;
  }

  if (normalizedSeed > 0) {
    const rand = createPrng(normalizedSeed);
    for (let i = TOTAL_CARTELA_CARDS - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = deck[i];
      deck[i] = deck[j];
      deck[j] = tmp;
    }
  }

  cachedSeed = normalizedSeed;
  cachedDeck = deck;
  return deck;
}

/**
 * Resolves the master card ID (1..600) assigned to a player-facing slot number (e.g. #8).
 */
export function resolveMappedCardId(cartelaId: number, shuffleSeed: number = 0): number {
  if (!Number.isFinite(cartelaId)) return 1;
  const clamped = Math.max(1, Math.min(TOTAL_CARTELA_CARDS, Math.trunc(cartelaId)));
  if (!shuffleSeed || shuffleSeed <= 0) return clamped;

  const deck = buildCartelaDeck(shuffleSeed);
  return deck[clamped - 1] || clamped;
}

/**
 * Returns true iff NO slot (1..600) maps to the same master card in deckA and deckB.
 */
export function isDerangementOfDecks(deckA: Uint16Array, deckB: Uint16Array): boolean {
  if (deckA.length !== deckB.length) return false;
  for (let i = 0; i < deckA.length; i++) {
    if (deckA[i] === deckB[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Finds a random seed whose 600-card permutation is a strict derangement of `currentSeed`
 * (meaning ALL 600 slots, e.g. #8, receive a different card than the previous round).
 * Note: ~36.8% of random 600-permutations are pure derangements, so this takes ~2.7 tries on average.
 */
export function findNonRepeatingNextShuffleSeed(
  currentSeed: number,
  randomSeedFn: () => number
): number {
  const currentDeck = buildCartelaDeck(currentSeed);

  for (let attempt = 0; attempt < 64; attempt++) {
    const candidateSeed = Math.max(1, randomSeedFn() >>> 0);
    if (candidateSeed === currentSeed) continue;
    const candidateDeck = buildCartelaDeck(candidateSeed);
    if (isDerangementOfDecks(currentDeck, candidateDeck)) {
      return candidateSeed;
    }
  }

  // Deterministic fallback guaranteed not to equal currentSeed
  return Math.max(1, ((currentSeed + 7919) >>> 0));
}

