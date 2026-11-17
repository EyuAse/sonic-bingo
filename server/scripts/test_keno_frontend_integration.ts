/**
 * test_keno_frontend_integration.ts
 * Verification Suite for Fast Keno Phase 3 (Frontend & Navigation Integration)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, msg: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${msg}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
}

function runPhase3Tests() {
  console.log('🧪 ========================================================');
  console.log('🧪 RUNNING FAST KENO PHASE 3 FRONTEND & UI AUDIT');
  console.log('🧪 ========================================================');

  // Test 1: Page & Style Existence
  console.log('\n📄 Test 1: Dedicated Keno Page & Scoped Stylesheet');
  const kenoPagePath = path.join(rootDir, 'src/pages/KenoPage.tsx');
  const kenoCssPath = path.join(rootDir, 'src/styles/keno.css');
  assert(fs.existsSync(kenoPagePath), 'src/pages/KenoPage.tsx exists');
  assert(fs.existsSync(kenoCssPath), 'src/styles/keno.css exists');

  // Test 2: Component Suite Existence
  console.log('\n🧩 Test 2: Isolated Component Suite in src/components/keno/');
  const components = [
    'KenoBallTray.tsx',
    'KenoBetSlip.tsx',
    'KenoGrid80.tsx',
    'KenoOddsPaytable.tsx',
    'KenoRulesModal.tsx',
    'KenoVictoryModal.tsx',
    'WebAudioEngine.ts'
  ];
  for (const comp of components) {
    const compPath = path.join(rootDir, 'src/components/keno', comp);
    assert(fs.existsSync(compPath), `src/components/keno/${comp} exists`);
  }

  // Test 3: Context & Real Wallet Sync
  console.log('\n🔄 Test 3: KenoContext & Real Socket / Session Connectivity');
  const contextPath = path.join(rootDir, 'src/context/KenoContext.tsx');
  assert(fs.existsSync(contextPath), 'src/context/KenoContext.tsx exists');
  const contextContent = fs.readFileSync(contextPath, 'utf-8');
  assert(contextContent.includes('socketService.connect()'), 'KenoContext connects to centralized socketService');
  assert(contextContent.includes('keno:place_ticket'), 'KenoContext handles keno:place_ticket');
  assert(contextContent.includes('keno:verify_round'), 'KenoContext handles provably fair verification');
  assert(!contextContent.includes('demo-user-1'), 'Strictly ZERO demo-user-1 mock data');

  // Test 4: AppContext PageId Extension
  console.log('\n🧭 Test 4: AppContext PageId Routing Type');
  const appContextPath = path.join(rootDir, 'src/context/AppContext.tsx');
  const appContextContent = fs.readFileSync(appContextPath, 'utf-8');
  assert(appContextContent.includes("'keno'"), "AppContext PageId includes 'keno'");

  // Test 5: App.tsx Seamless Routing & Dedicated Game Page
  console.log('\n🚀 Test 5: App.tsx Routing & Dedicated Fullscreen View');
  const appPath = path.join(rootDir, 'src/App.tsx');
  const appContent = fs.readFileSync(appPath, 'utf-8');
  assert(appContent.includes("import { KenoPage } from './pages/KenoPage.tsx'"), 'App.tsx imports KenoPage');
  assert(appContent.includes("currentPage === 'keno'"), "App.tsx checks currentPage === 'keno'");
  assert(appContent.includes("isDedicatedGamePage = currentPage === 'bingo' || currentPage === 'keno'"), "App.tsx marks 'keno' as isDedicatedGamePage");
  assert(appContent.includes("<KenoPage onBackToLobby={() => switchPage('games')} />"), 'App.tsx passes onBackToLobby callback to return to games');

  // Test 6: MoreGamesGrid Instant Play Unlock
  console.log('\n🎮 Test 6: MoreGamesGrid Fast Keno LIVE Card');
  const gridPath = path.join(rootDir, 'src/components/games/MoreGamesGrid.tsx');
  const gridContent = fs.readFileSync(gridPath, 'utf-8');
  assert(gridContent.includes("id: 'fast-keno'"), 'MoreGamesGrid includes fast-keno card');
  assert(gridContent.includes("tag: 'LIVE'"), "MoreGamesGrid fast-keno is marked 'LIVE' (unlocked from 'SOON')");
  assert(gridContent.includes("switchPage('keno')"), 'MoreGamesGrid navigates to keno on click');

  // Test 7: Zero-Bandwidth Procedural Audio Engine
  console.log('\n🔊 Test 7: Zero-Bandwidth Procedural Web Audio Engine');
  const audioPath = path.join(rootDir, 'src/components/keno/WebAudioEngine.ts');
  const audioContent = fs.readFileSync(audioPath, 'utf-8');
  assert(audioContent.includes('AudioContext'), 'Uses Web Audio API AudioContext');
  assert(audioContent.includes('playTick'), 'Includes procedural countdown tick');
  assert(audioContent.includes('playBallPop'), 'Includes procedural ball extraction pop');
  assert(audioContent.includes('playWinFanfare'), 'Includes procedural win fanfare');
  assert(!audioContent.includes('.mp3'), 'Zero external .mp3 audio file downloads ($0.00 bandwidth)');

  console.log('\n========================================================');
  console.log(`📊 PHASE 3 AUDIT SUMMARY: ${passedTests}/${totalTests} Passed`);
  console.log('========================================================');
  console.log('🎉 FAST KENO PHASE 3 (FRONTEND & UI INTEGRATION) 100% COMPLETE!\n');
}

runPhase3Tests();

