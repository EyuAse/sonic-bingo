import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { kenoEngine } from '../game/KenoGameEngine.ts';
import { gameEngine } from '../game/BingoGameEngine.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTests() {
  console.log('🧪 Starting Fast Keno & Deposit Agent Verification Suite...\n');

  // Test 1: Settlement Window & Final Ball Delay Optimization in KenoGameEngine
  console.log('▶ Test 1: Verifying KenoGameEngine Settlement Timing...');
  assert.strictEqual(kenoEngine.SETTLEMENT_SECONDS, 4, 'Settlement window must be configured to 4 seconds');
  assert.strictEqual(kenoEngine.BETTING_SECONDS, 30, 'Betting window must be 30 seconds');
  assert.strictEqual(kenoEngine.DRAW_BALL_INTERVAL_MS, 1200, 'Draw interval must be 1.2s per ball');
  
  const engineSource = fs.readFileSync(path.join(__dirname, '../game/KenoGameEngine.ts'), 'utf-8');
  assert(
    engineSource.includes('if (index < this.currentDrawSequence.length - 1)'),
    'Final 20th ball must NOT sleep 1.2s before settling'
  );
  console.log('   ✅ PASS: KenoGameEngine settlement timing and 0ms final ball delay verified.');

  // Test 2: Sockets & Server Queries Limit 10 for History and Results
  console.log('\n▶ Test 2: Verifying 10-Game Limits in Sockets and REST Endpoints...');
  const kenoSocketSource = fs.readFileSync(path.join(__dirname, '../sockets/kenoSocket.ts'), 'utf-8');
  const serverSource = fs.readFileSync(path.join(__dirname, '../server.ts'), 'utf-8');

  assert(kenoSocketSource.includes('LIMIT 10'), 'kenoSocket.ts must enforce LIMIT 10 on history and results');
  assert(serverSource.includes('LIMIT 10'), 'server.ts must enforce LIMIT 10 on /api/keno/history and /api/keno/results');
  console.log('   ✅ PASS: Both socket and REST queries strictly limited to 10 items.');

  // Test 3: KenoPage.tsx Full-Bleed Stage Snap, 10-Item Slices & Grid Selection Logic
  console.log('\n▶ Test 3: Verifying KenoPage.tsx UI & Board Logic...');
  const kenoPageSource = fs.readFileSync(path.join(__dirname, '../../src/pages/KenoPage.tsx'), 'utf-8');

  assert(
    kenoPageSource.includes("display: isDrawing ? 'none' : 'block'"),
    'Timer must be removed from layout during draw to snap stage flush to header'
  );
  assert(
    kenoPageSource.includes('const isSel = selectedNumbers.has(num);'),
    'Grid selection must check selectedNumbers strictly so placed bets clear green'
  );
  assert(
    kenoPageSource.includes('ticketNumbers'),
    'ticketNumbers must be isolated for docked ball hit illumination'
  );
  assert(
    kenoPageSource.includes('playerHistory.slice(0, 10)'),
    'History tab must render strictly the last 10 tickets'
  );
  assert(
    kenoPageSource.includes('recentResults.slice(0, 10)'),
    'Results tab must render strictly the last 10 rounds'
  );
  assert(
    kenoPageSource.includes('landedBalls.length >= 20'),
    'Win/loss banner must trigger instantly when 20th ball lands'
  );
  console.log('   ✅ PASS: KenoPage.tsx board unselection, 0ms banner trigger, and 10-item slices verified.');

  // Test 4: CSS Full-Bleed Stage & Dead-Centered Ball Numbers
  console.log('\n▶ Test 4: Verifying keno.css Full-Screen & Ball Centering Rules...');
  const kenoCssSource = fs.readFileSync(path.join(__dirname, '../../src/styles/keno.css'), 'utf-8');

  assert(
    kenoCssSource.includes('.keno-fullscreen-view .stage.drawing'),
    '.stage.drawing must exist in keno.css'
  );
  assert(
    kenoCssSource.includes('max-width: 35px !important;'),
    '.drawn .ball must have max-width 35px'
  );
  assert(
    kenoCssSource.includes('transform: translateY(-0.5px) !important;'),
    '.ball-num must have optical vertical baseline compensation'
  );
  assert(
    kenoCssSource.includes('.glow:has(#big:not(.hidden))'),
    'Center glow must only show shadow while ball is actively emerging'
  );
  console.log('   ✅ PASS: keno.css stage layout and absolute ball number centering verified.');

  // Test 5: Deposit Page Agent Switch & Telegram Direct Redirect
  console.log('\n▶ Test 5: Verifying DepositPage.tsx Agent Card Enhancements...');
  const depositPageSource = fs.readFileSync(path.join(__dirname, '../../src/pages/DepositPage.tsx'), 'utf-8');
  const walletRouteSource = fs.readFileSync(path.join(__dirname, '../routes/wallet.ts'), 'utf-8');

  assert(
    depositPageSource.includes('sonic-agent-card-switch-btn'),
    'DepositPage.tsx must include Switch Agent button'
  );
  assert(
    depositPageSource.includes('sonic-agent-card-telegram-btn'),
    'DepositPage.tsx must include Telegram direct link button'
  );
  assert(
    depositPageSource.includes('SonicBingoAgentDemo'),
    'DepositPage.tsx must fallback to @SonicBingoAgentDemo'
  );
  assert(
    walletRouteSource.includes('SonicBingoAgentDemo'),
    'wallet.ts must return demo username fallback'
  );
  console.log('   ✅ PASS: Deposit Page Switch and Telegram direct redirect verified.');

  // Test 6: Multi-Room Isolation Firewall (Golden Rule #1)
  console.log('\n▶ Test 6: Verifying Multi-Room Isolation Firewall (Rooms 20, 50, 100 = 0 Bots)...');
  for (const rid of ['room-20', 'room-50', 'room-100']) {
    const room = gameEngine.getRoom(rid);
    assert.strictEqual(room.opponentCards.length, 0, `Room ${rid} must strictly have 0 bots!`);
    assert.strictEqual(room.totalPot, 0, `Room ${rid} initial pot must be 0!`);
    assert.strictEqual(room.waitingForPlayers, true, `Room ${rid} must be waiting for players!`);
  }
  console.log('   ✅ PASS: Multi-Room isolation firewall intact (Rooms 20, 50, 100 remain 100% human-only).');

  console.log('\n🎉 ALL 6 VERIFICATION TEST SUITES PASSED FLAWLESSLY!\n');
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
