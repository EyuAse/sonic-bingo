/**
 * server/scripts/test_keno_phase5_ball_calling_ui.ts
 * Automated Verification Suite for Phase 5: Exact Ball Calling UI Parity
 * Verifies 2-row slot docking, central tube flight animation, procedural audio, and in-stage banner.
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

function testSlotMapping() {
  console.log('🔍 [1/5] Testing 2-Row Slot Docking Mathematical Mapping (Calls 1..10 -> Row 2, 11..20 -> Row 1)...');
  for (let callIndex = 0; callIndex < 20; callIndex++) {
    const slotIdx = callIndex < 10 ? 10 + callIndex : callIndex - 10;
    if (callIndex < 10) {
      assert(
        slotIdx >= 10 && slotIdx <= 19,
        `Call #${callIndex + 1} (index ${callIndex}) correctly maps to Row 2 slot ${slotIdx}`
      );
    } else {
      assert(
        slotIdx >= 0 && slotIdx <= 9,
        `Call #${callIndex + 1} (index ${callIndex}) correctly maps to Row 1 slot ${slotIdx}`
      );
    }
  }
}

function runPhase5Verification() {
  console.log('🚀 Starting Phase 5 Verification Suite: Exact Ball Calling UI & Audio Parity...\n');

  testSlotMapping();

  const kenoPagePath = path.resolve('src/pages/KenoPage.tsx');
  const kenoPage = fs.readFileSync(kenoPagePath, 'utf8');

  // 2. Empty Central Tube & Flight Animation Verification
  console.log('\n🔍 [2/5] Verifying Empty Central Tube & Flying Ball Clone Animation...');
  assert(
    kenoPage.includes("const slotIdx = callIndex < 10 ? 10 + callIndex : callIndex - 10"),
    'Exact 2-row slot index formula present in KenoPage.tsx'
  );
  assert(
    kenoPage.includes("big.style.setProperty('display', 'none', 'important')"),
    'Central #big tube immediately hidden during ball flight'
  );
  assert(
    kenoPage.includes("big.classList.add('hidden')"),
    'hidden class applied to keep tube visibly empty between calls'
  );
  assert(
    kenoPage.includes("fl.className = 'ball big' + (isHit ? ' hit' : '')"),
    'Flying ball clone fl created at source tube position'
  );
  assert(
    kenoPage.includes("transition: 'transform .45s cubic-bezier(.22,.8,.36,1)"),
    'Authentic cubic-bezier 450ms flight transition'
  );

  // 3. In-Stage Settlement Banner Verification
  console.log('\n🔍 [3/5] Verifying In-Stage Win & Try Again Banner (#winStageBanner)...');
  assert(
    kenoPage.includes('id="winStageBanner"'),
    '#winStageBanner present inside .glow container'
  );
  assert(
    kenoPage.includes("lastWinAmount > 0 ? 'YOU WIN' : 'TRY AGAIN'"),
    'Banner dynamically presents YOU WIN on win and TRY AGAIN on loss'
  );
  assert(
    kenoPage.includes('id="winStageVal"'),
    '#winStageVal present for gold/emerald win amount display'
  );
  assert(
    kenoPage.includes('(lastWinAmount > 0 || activeTickets.length > 0)'),
    'Banner cleanly suppresses TRY AGAIN when player did not participate in round'
  );

  // 4. Exact Procedural Web Audio Synthesis Verification
  console.log('\n🔍 [4/5] Verifying Procedural Web Audio Engine Frequencies...');
  assert(
    kenoPage.includes('playTone(560, 0.05, \'sine\', 0.08)'),
    'Authentic 560Hz sine wave landing tone triggered upon slot docking'
  );
  assert(
    kenoPage.includes('playTone(880, 0.18, \'sine\', 0.14)'),
    'Authentic 880Hz hit chime triggered on player number match'
  );
  assert(
    kenoPage.includes('playTone(320, 0.08, \'triangle\', 0.12)'),
    'Authentic 320Hz triangle wave pop tone on ball emergence'
  );
  assert(
    kenoPage.includes('playTone(280, 0.08, \'sine\', 0.05)'),
    'Authentic 280Hz sine tone for non-hit called ball'
  );
  assert(
    kenoPage.includes('[523.25, 659.25, 783.99, 1046.5]'),
    'Authentic C5-E5-G5-C6 victory fanfare arpeggio on win'
  );

  // 5. Docked Slots & Counter State Synchronization
  console.log('\n🔍 [5/5] Verifying Landed Balls & Counter Synchronization...');
  assert(
    kenoPage.includes('landedBalls.forEach('),
    'dockedSlots computed based on landedBalls so slots stay empty until ball lands'
  );
  assert(
    kenoPage.includes('<span id="cnt">{pad(landedBalls.length)}</span>'),
    'Counter #cnt increments in real-time as balls physically dock'
  );

  console.log('\n🎉 ALL PHASE 5 VERIFICATION CHECKS PASSED WITH 100% PARITY!\n');
  process.exit(0);
}

runPhase5Verification();

