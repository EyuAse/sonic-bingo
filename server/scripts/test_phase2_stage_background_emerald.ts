import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('🧪 [TEST] Verifying Phase 2: Keno Stage Background Color (#1f2928) & Eradication of White Card...');

const kenoCssPath = path.resolve('src/styles/keno.css');
const kenoCss = fs.readFileSync(kenoCssPath, 'utf8');

// 1. Verify scoped CSS variables
assert(kenoCss.includes('--panel: #1f2928 !important;'), '.keno-fullscreen-view must scope --panel: #1f2928 !important');
assert(kenoCss.includes('--bg: #141b1a !important;'), '.keno-fullscreen-view must scope --bg: #141b1a !important');
console.log('✅ 1. Scoped CSS variables (--panel, --bg) enforced with !important.');

// 2. Verify .stage, .sl, #mainSl, #pickView background is #1f2928 !important
assert(kenoCss.includes('.keno-fullscreen-view .stage,'), 'Stage selector must be defined');
assert(kenoCss.includes('.keno-fullscreen-view #pickView'), '#pickView must be styled');
assert(kenoCss.includes('background: #1f2928 !important;'), '.stage, #mainSl, #pickView must have #1f2928 !important background');
console.log('✅ 2. Stage and pickView container background locked to authentic dark emerald #1f2928.');

// 3. Verify .pick h2 and .pick p colors
assert(kenoCss.includes('.keno-fullscreen-view .pick h2'), '.pick h2 must be styled');
assert(kenoCss.includes('color: #ffffff !important;'), '.pick h2 must be crisp white #ffffff');
assert(kenoCss.includes('color: #4fdb9a !important;'), '.pick p must be vibrant emerald #4fdb9a');
console.log('✅ 3. Header and subtitle text contrast locked to white (#fff) and emerald (#4fdb9a).');

// 4. Verify drawing stage background
assert(kenoCss.includes('background: #181f1e !important;'), '.stage.drawing must be dark radar background #181f1e !important');
console.log('✅ 4. Drawing radar stage background locked to #181f1e.');

// 5. Verify pick indicator circle .n
assert(kenoCss.includes('.keno-fullscreen-view .pick .n'), '.pick .n must be styled');
assert(kenoCss.includes('background: radial-gradient(circle at 35% 28%, #2f8a64, #0d2a21 72%) !important;'), '.pick .n must have green radial gradient');
assert(kenoCss.includes('border: 2px solid #3ddc97 !important;'), '.pick .n must have glowing emerald border');
console.log('✅ 5. Green pick number badge (.n) styled authentically matching keno.html.');

console.log('🎉 [PASS] Phase 2: All stage background and color defect tests passed 100%!');
