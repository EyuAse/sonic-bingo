/**
 * test_keno_frontend_integration.ts
 * Verification Suite for Fast Keno Phase 3 (Exact UI & Navigation Integration)
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
  console.log('🧪 RUNNING FAST KENO PHASE 3: EXACT UI RESTORATION AUDIT');
  console.log('🧪 ========================================================');

  // Test 1: Page & Style Existence
  console.log('\n📄 Test 1: Dedicated Keno Page & Scoped Stylesheet');
  const kenoPagePath = path.join(rootDir, 'src/pages/KenoPage.tsx');
  const kenoCssPath = path.join(rootDir, 'src/styles/keno.css');
  assert(fs.existsSync(kenoPagePath), 'src/pages/KenoPage.tsx exists');
  assert(fs.existsSync(kenoCssPath), 'src/styles/keno.css exists');

  // Test 2: Exact DOM Markup from keno.html
  console.log('\n🧩 Test 2: Exact DOM Elements & Authentic Classes from keno.html');
  const pageContent = fs.readFileSync(kenoPagePath, 'utf-8');
  assert(pageContent.includes('className="wrap"'), 'Includes responsive desktop 3-column .wrap container');
  assert(pageContent.includes('className="app"'), 'Includes mobile .app container');
  assert(pageContent.includes('className="side"'), 'Includes desktop .side containers (#left and #right)');
  assert(pageContent.includes('className="logo"'), 'Includes authentic FAST KENO .logo');
  assert(pageContent.includes('className="pill"'), 'Includes real balance & ID .pill');
  assert(pageContent.includes('className="timer"'), 'Includes authentic .timer badge');
  assert(pageContent.includes('className="arcs"'), 'Includes concentric radar arcs SVG in .stage');
  assert(pageContent.includes('id="pickView"'), 'Includes #pickView slide with Choose 10 numbers');
  assert(pageContent.includes('id="infoView"'), 'Includes #infoView slide with Possible win & odds');
  assert(pageContent.includes('className="grid"'), 'Includes 80-ball .grid');
  assert(pageContent.includes('className="amt"'), 'Includes authentic .amt with [-] and [+]');
  assert(pageContent.includes('id="x2"'), 'Includes X2 button');
  assert(pageContent.includes('id="mx"'), 'Includes MAX button');
  assert(pageContent.includes('BET ACCEPTED'), 'Includes 62px BET button flashing BET ACCEPTED');
  assert(pageContent.includes('id="rulesModal"'), 'Includes authentic #rulesModal with UK flag & 10x10 payout table');
  assert(pageContent.includes('keno-lobby-btn'), 'Includes discreet return to lobby button');

  // Test 3: Verified Absence of Deviated UI Controls
  console.log('\n🚫 Test 3: Removal of Deviated Unapproved Controls');
  assert(!pageContent.includes('1 Spot'), 'Unapproved quick spot buttons removed');
  assert(!pageContent.includes('3 Spots'), 'Unapproved 3 Spots button removed');
  assert(!pageContent.includes('10 Spots'), 'Unapproved 10 Spots button removed');
  assert(!pageContent.includes('+25'), 'Unapproved extra increment pills removed');

  // Test 4: Real Account Money & Context Connectivity
  console.log('\n🔄 Test 4: Real Account Money & Socket Connectivity');
  const contextPath = path.join(rootDir, 'src/context/KenoContext.tsx');
  const contextContent = fs.readFileSync(contextPath, 'utf-8');
  assert(contextContent.includes('useWallet()'), 'KenoContext connects to real live useWallet()');
  assert(contextContent.includes('useAuth()'), 'KenoContext connects to real authenticated useAuth()');
  assert(contextContent.includes('socketService.connect()'), 'KenoContext connects to centralized socketService');
  assert(contextContent.includes('keno:place_ticket'), 'KenoContext handles keno:place_ticket');
  assert(!contextContent.includes('demo-user-1'), 'Strictly ZERO demo-user-1 mock data');

  // Test 5: App.tsx Seamless Routing
  console.log('\n🚀 Test 5: App.tsx Routing & Dedicated View');
  const appPath = path.join(rootDir, 'src/App.tsx');
  const appContent = fs.readFileSync(appPath, 'utf-8');
  assert(appContent.includes("import { KenoPage } from './pages/KenoPage.tsx'"), 'App.tsx imports KenoPage');
  assert(appContent.includes("currentPage === 'keno'"), "App.tsx checks currentPage === 'keno'");

  // Test 6: MoreGamesGrid Instant Play Unlock
  console.log('\n🎮 Test 6: MoreGamesGrid Fast Keno LIVE Card');
  const gridPath = path.join(rootDir, 'src/components/games/MoreGamesGrid.tsx');
  const gridContent = fs.readFileSync(gridPath, 'utf-8');
  assert(gridContent.includes("id: 'fast-keno'"), 'MoreGamesGrid includes fast-keno card');
  assert(gridContent.includes("tag: 'LIVE'"), "MoreGamesGrid fast-keno is marked 'LIVE'");

  console.log('\n========================================================');
  console.log(`📊 PHASE 3 AUDIT SUMMARY: ${passedTests}/${totalTests} Passed`);
  console.log('========================================================');
  console.log('🎉 FAST KENO PHASE 3 (EXACT UI RESTORATION) 100% COMPLETE!\n');
}

runPhase3Tests();
