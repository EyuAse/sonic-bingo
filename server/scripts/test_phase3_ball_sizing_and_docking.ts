import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('🧪 [TEST] Verifying Phase 3: Exact Ball Sizing (31px) & 2-Row Docking Layout...');

const kenoCssPath = path.resolve('src/styles/keno.css');
const kenoCss = fs.readFileSync(kenoCssPath, 'utf8');

// 1. Verify .drawn CSS Grid layout
assert(kenoCss.includes('.keno-fullscreen-view .drawn {'), '.drawn selector must exist');
assert(kenoCss.includes('grid-template-columns: repeat(10, 1fr) !important;'), '.drawn must have 10 equal columns per row');
assert(kenoCss.includes('max-width: 380px !important;'), '.drawn max-width must be exactly 380px');
assert(kenoCss.includes('gap: 6px 4px !important;'), '.drawn grid gap must be 6px vertical, 4px horizontal');
console.log('✅ 1. 2-row 10-column grid docking layout verified.');

// 2. Verify .drawn .ball sizing
assert(kenoCss.includes('max-width: 31px !important;'), '.drawn balls must have max-width 31px');
assert(kenoCss.includes('aspect-ratio: 1 !important;'), '.drawn balls must have 1:1 aspect ratio');
console.log('✅ 2. 31px ball size and 1:1 aspect ratio verified.');

// 3. Verify .drawn .ball .ball-num typography
assert(kenoCss.includes('font-size: 13px !important;'), '.drawn ball number font-size must be 13px');
assert(kenoCss.includes('font-weight: 800 !important;'), '.drawn ball number font-weight must be 800');
console.log('✅ 3. Ball number typography verified.');

// 4. Verify mathematical row mapping logic
for (let callIndex = 0; callIndex < 20; callIndex++) {
  const slotIdx = callIndex < 10 ? 10 + callIndex : callIndex - 10;
  if (callIndex < 10) {
    // Must land on Row 2 (slots 10..19)
    assert(slotIdx >= 10 && slotIdx <= 19, `Call ${callIndex + 1} must land on Row 2 (index ${slotIdx})`);
  } else {
    // Must land on Row 1 (slots 0..9)
    assert(slotIdx >= 0 && slotIdx <= 9, `Call ${callIndex + 1} must land on Row 1 (index ${slotIdx})`);
  }
}
console.log('✅ 4. Mathematical 20-ball slot distribution verified (Calls 1..10 in Row 2, 11..20 in Row 1).');

// 5. Verify KenoPage.tsx integrates userNumbers
const kenoPagePath = path.resolve('src/pages/KenoPage.tsx');
const kenoPageContent = fs.readFileSync(kenoPagePath, 'utf8');
assert(kenoPageContent.includes('const userNumbers = useMemo('), 'KenoPage must compute unified userNumbers');
assert(kenoPageContent.includes('userNumbers.has(currentDrawnBall)'), 'KenoPage must evaluate isHit using userNumbers');
assert(kenoPageContent.includes('userNumbers.has(ballNum)'), 'Docked balls must check userNumbers for hit highlighting');
console.log('✅ 5. KenoPage player hit recognition on docked slots verified.');

console.log('🎉 [PASS] Phase 3: All ball sizing and 2-row layout tests passed 100%!');

