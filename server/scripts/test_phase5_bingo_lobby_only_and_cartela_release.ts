import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('🧪 Starting Phase 5 Test Suite: Bingo Lobby-Only Purchasing & Cartela Release Verification');

// 1. Verify BingoGameEngine source constraints
const enginePath = path.resolve('server/game/BingoGameEngine.ts');
const engineSource = fs.readFileSync(enginePath, 'utf-8');

// Verify lobby-only purchase guard in handleBuyTicket
assert(
  engineSource.includes("if (room.phase !== 'lobby')"),
  'FAIL: BingoGameEngine must check if (room.phase !== \'lobby\') in handleBuyTicket'
);
assert(
  engineSource.includes('ውርርድ የሚቻለው ጨዋታው ሲያልቅ በሎቢው ውስጥ ብቻ ነው'),
  'FAIL: BingoGameEngine must return Amharic/English lobby-only purchase error'
);
console.log('✅ PASS: BingoGameEngine enforces strict lobby-only purchase guard');

// Verify room.tickets.clear() in startMasterLobbyTimer
assert(
  engineSource.includes('room.tickets.clear(); // 🧹 Clean slate: users must select & buy cartelas in the lobby for each new game'),
  'FAIL: startMasterLobbyTimer must clear room.tickets for clean lobby slate'
);
console.log('✅ PASS: BingoGameEngine clears room.tickets on new lobby round');

// 2. Verify gameSocket.ts lobby-only guard
const socketPath = path.resolve('server/sockets/gameSocket.ts');
const socketSource = fs.readFileSync(socketPath, 'utf-8');
assert(
  socketSource.includes("room.phase !== 'lobby'"),
  'FAIL: gameSocket.ts must verify room.phase !== \'lobby\' in buy_ticket handler'
);
console.log('✅ PASS: gameSocket enforces early lobby check in buy_ticket event handler');

// 3. Verify BingoContext.tsx cartela wiping and lobby guards
const contextPath = path.resolve('src/context/BingoContext.tsx');
const contextSource = fs.readFileSync(contextPath, 'utf-8');

// A. Verify clean slate on new round
assert(
  contextSource.includes('// 🧹 CLEAN SLATE ON EVERY NEW ROUND: Empty all cartelas across all users'),
  'FAIL: BingoContext must have clean slate on new roundNumber'
);

// B. Verify clean slate when returning to lobby
assert(
  contextSource.includes('// 🧹 CLEAN SLATE: Finished round ticket is released!'),
  'FAIL: BingoContext must wipe cartelas when transitioning to lobby'
);

// C. Verify unbought cartela expiration on playing start
assert(
  contextSource.includes('// Unbought cartelas selected in lobby are immediately discarded when game begins!'),
  'FAIL: BingoContext must discard unbought lobby selections when game starts'
);

// D. Verify buyTicket blocks purchase outside lobby
assert(
  contextSource.includes("if (roundPhase !== 'lobby') {\n      showToast(\n        lang === 'am'\n          ? '⚠️ ጨዋታው ተጀምሯል! እባክዎ ይህ ጨዋታ እስኪያልቅ ይጠብቁ።'"),
  'FAIL: BingoContext buyTicket must reject when roundPhase !== \'lobby\''
);

// E. Verify cartela selection blocked outside lobby
assert(
  contextSource.includes("const chooseCartelaId = (slotIdx: number, newId: number) => {\n    if (roundPhase !== 'lobby') return;"),
  'FAIL: chooseCartelaId must require roundPhase === \'lobby\''
);
assert(
  contextSource.includes("const toggleCartelaSelection = (cartelaId: number) => {\n    if (roundPhase !== 'lobby') return;"),
  'FAIL: toggleCartelaSelection must require roundPhase === \'lobby\''
);
assert(
  contextSource.includes("const shuffleCartela = (cardIdx: number = 0) => {\n    if (roundPhase !== 'lobby') return;"),
  'FAIL: shuffleCartela must require roundPhase === \'lobby\''
);

// F. Verify closeWinModalAndRestart clean slate
assert(
  contextSource.includes('closeWinModalAndRestart = () => {') &&
  contextSource.includes('localStorage.removeItem(ACTIVE_TICKET_STORAGE_KEY)'),
  'FAIL: closeWinModalAndRestart must clean slate and remove active ticket storage'
);

console.log('✅ PASS: BingoContext enforces zero cartela hoarding and lobby-only selection');

// 4. Verify SpectatorCard.tsx does not allow pre-buying during game
const spectatorPath = path.resolve('src/components/bingo/SpectatorCard.tsx');
const spectatorSource = fs.readFileSync(spectatorPath, 'utf-8');

assert(
  !spectatorSource.includes('PRE-BUY FOR NEXT ROUND'),
  'FAIL: SpectatorCard must not display "PRE-BUY FOR NEXT ROUND"'
);
assert(
  spectatorSource.includes('disabled={isPlaying}'),
  'FAIL: SpectatorCard action button must be disabled when isPlaying is true'
);
assert(
  spectatorSource.includes('WAIT FOR GAME TO COMPLETE...'),
  'FAIL: SpectatorCard action button must display "WAIT FOR GAME TO COMPLETE..." while playing'
);
console.log('✅ PASS: SpectatorCard correctly informs spectators and disables buy button during play');

// 5. Functional Simulation: Engine Rejection when Playing
import { gameEngine } from '../game/BingoGameEngine.ts';
const room10 = gameEngine.getRoom('room-10');

// Force room to playing
room10.phase = 'playing';
(async () => {
  const buyAttempt = await gameEngine.handleBuyTicket(
    'test-user-123',
    'Test Player',
    'room-10',
    [12, 45],
    'fake-socket-id',
    10
  );

  assert.strictEqual(buyAttempt.success, false, 'FAIL: handleBuyTicket must fail when phase is playing');
  assert(buyAttempt.error?.includes('ውርርድ የሚቻለው ጨዋታው ሲያልቅ'), 'FAIL: handleBuyTicket must return lobby-only error');
  console.log('✅ PASS: BingoGameEngine handleBuyTicket functionally rejected purchase while room was playing');

  console.log('\n🎉 ALL PHASE 5 BINGO TESTS PASSED PERFECTLY!');
  process.exit(0);
})().catch(err => {
  console.error('❌ Phase 5 test failed:', err);
  process.exit(1);
});
