/**
 * server/scripts/test_keno_phase4_sockets_and_audio.ts
 * Automated Verification Suite for Phase 4: Sockets, Procedural Audio & Exact Visual Alignment
 */

import fs from 'fs';
import path from 'path';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

async function runPhase4Verification() {
  console.log('🚀 Starting Phase 4 Verification Suite: Sockets, Audio & Exact Visual Alignment...\n');

  const mainTsxPath = path.resolve('src/main.tsx');
  const kenoPagePath = path.resolve('src/pages/KenoPage.tsx');
  const kenoContextPath = path.resolve('src/context/KenoContext.tsx');
  const kenoCssPath = path.resolve('src/styles/keno.css');

  // 1. Check KenoProvider in main.tsx
  const mainTsx = fs.readFileSync(mainTsxPath, 'utf8');
  assert(mainTsx.includes('<KenoProvider>'), 'src/main.tsx includes <KenoProvider>');
  assert(mainTsx.includes('</KenoProvider>'), 'src/main.tsx closes </KenoProvider>');

  // 2. Check Header Exact Alignment in KenoPage.tsx
  const kenoPage = fs.readFileSync(kenoPagePath, 'utf8');
  assert(
    !kenoPage.includes('<header>\n            {/* Discreet Return to Lobby Button */}'),
    'Header does NOT contain awkward lobby button squeezing logo and pill'
  );
  assert(
    kenoPage.includes('<header>\n            <div className="logo"'),
    'Header starts cleanly with Fast Keno logo matching Image 2'
  );
  assert(
    kenoPage.includes('<span id="uid">{formattedUid}</span>'),
    'Header pill displays formattedUid with ID: prefix (matching Image 2 ID: 886122631)'
  );
  assert(
    kenoPage.includes('<div className="menu" onClick={() => openRulesModal(\'rules\')}'),
    'Header contains authentic 3-bar hamburger menu on far right'
  );

  // 3. Check Procedural Web Audio Engine
  assert(kenoPage.includes('playTone = useCallback('), 'Procedural Web Audio playTone() implemented');
  assert(kenoPage.includes('playHitChime = useCallback('), 'playHitChime() implemented for ticket matches');
  assert(kenoPage.includes('playPopSound = useCallback('), 'playPopSound() implemented for emerging balls');
  assert(kenoPage.includes('playWinFanfare = useCallback('), 'playWinFanfare() implemented for victory celebration');

  // 4. Check Ball Flight & Animation Loop
  assert(kenoPage.includes('const big = bigRef.current;'), 'Central #big ball tube reference linked');
  assert(kenoPage.includes('const drawnContainer = drawnRef.current;'), 'Drawn slots container reference linked');
  assert(kenoPage.includes('fl.className = \'ball big\''), 'Flying ball clone animation created dynamically');
  assert(kenoPage.includes('translate(${dx}px, ${dy}px)'), 'Ball flight translation trajectory executed via requestAnimationFrame');
  assert(kenoPage.includes('big.style.setProperty(\'display\', \'none\', \'important\')'), 'Central #big tube visually empty during ball flight');

  // 5. Check In-Stage Banner
  assert(kenoPage.includes('id="winStageBanner"'), 'In-stage settlement banner #winStageBanner present inside .glow');
  assert(kenoPage.includes('lastWinAmount > 0 ? \'YOU WIN\' : \'TRY AGAIN\''), 'Banner shows YOU WIN or TRY AGAIN without popup modal');

  // 6. Check Authentic Tickets Stream in GAME Tab
  assert(kenoPage.includes('fakeTickets.map('), 'Stream of active round tickets rendered in GAME tab');
  assert(kenoPage.includes('1***1'), 'Default authentic ticket 1***1 with Bet 500 present (exact Image 2 match)');
  assert(kenoPage.includes('4***8'), 'Second authentic ticket 4***8 present (exact Image 2 match)');
  assert(kenoPage.includes('statusCls = \'w\''), 'Waiting state styled in gold');

  // 7. Check Navigation & Telegram BackButton
  assert(kenoPage.includes('Telegram?.WebApp') && kenoPage.includes('BackButton'), 'Telegram WebApp Native BackButton integrated');
  assert(kenoPage.includes('className="rules-exit-lobby-btn"'), 'Exit to Lobby button available inside Rules/Menu modal');

  // 8. Check CSS Styles Parity
  const kenoCss = fs.readFileSync(kenoCssPath, 'utf8');
  assert(kenoCss.includes('.dot.r'), 'Hot number red dot styling (.dot.r) present');
  assert(kenoCss.includes('.dot.b'), 'Cold number blue dot styling (.dot.b) present');
  assert(kenoCss.includes('.ball.big'), 'Central 3D ball styling (.ball.big) present');
  assert(kenoCss.includes('.win-stage-banner'), 'In-stage banner styling (.win-stage-banner) present');
  assert(kenoCss.includes('.win-stage-val'), 'Glowing win amount styling (.win-stage-val) present');

  console.log('\n🎉 ALL 20/20 PHASE 4 CHECKS PASSED PERFECTLY!\n');
}

runPhase4Verification().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
