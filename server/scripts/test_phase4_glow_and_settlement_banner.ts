import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('🧪 [TEST] Verifying Phase 4: Ball Hit Emerald Glow & In-Stage Settlement Banner Flow...');

// 1. Verify kenoSocket.ts handles identify_user
const kenoSocketPath = path.resolve('server/sockets/kenoSocket.ts');
const kenoSocketContent = fs.readFileSync(kenoSocketPath, 'utf8');

assert(kenoSocketContent.includes("socket.on('identify_user',"), 'kenoSocket must register identify_user event listener');
assert(kenoSocketContent.includes("socket.join(`user:${currentUserId}`)"), 'kenoSocket must join socket to user:${userId} room');
console.log('✅ 1. kenoSocket identify_user and private room subscription verified.');

// 2. Verify KenoPage.tsx settlement calculations and banner display
const kenoPagePath = path.resolve('src/pages/KenoPage.tsx');
const kenoPageContent = fs.readFileSync(kenoPagePath, 'utf8');

assert(kenoPageContent.includes('const roundTotalWin = useMemo('), 'KenoPage must compute client-side instant roundTotalWin');
assert(kenoPageContent.includes('const effectiveWin = lastWinAmount > 0 ? lastWinAmount : roundTotalWin;'), 'KenoPage must determine effectiveWin');
assert(kenoPageContent.includes("effectiveWin > 0 ? 'YOU WIN' : 'TRY AGAIN'"), 'KenoPage must display YOU WIN if effectiveWin > 0 or TRY AGAIN if bet lost');
assert(kenoPageContent.includes("style={currentDrawnBall && phase !== 'settlement' ? undefined : { display: 'none' }}"), '#big must be hidden during settlement phase');
console.log('✅ 2. KenoPage instant settlement flow & banner logic verified.');

// 3. Verify CSS styling for .ball.big.hit glow and settlement banner
const kenoCssPath = path.resolve('src/styles/keno.css');
const kenoCss = fs.readFileSync(kenoCssPath, 'utf8');

assert(kenoCss.includes('.keno-fullscreen-view .ball.big.hit {'), '.ball.big.hit selector must exist');
assert(kenoCss.includes('#3fd08a 0, #13693f 30%'), '.ball.big.hit must have emerald radial gradient');
assert(kenoCss.includes('0 0 28px #3ddc97cc'), '.ball.big.hit must have radiant emerald glow box-shadow');
assert(kenoCss.includes('.keno-fullscreen-view .win-stage-banner {'), '.win-stage-banner must be styled');
assert(kenoCss.includes('.keno-fullscreen-view .win-stage-title {'), '.win-stage-title must be styled');
assert(kenoCss.includes('.keno-fullscreen-view .win-stage-val {'), '.win-stage-val must be styled');
console.log('✅ 3. Radiant emerald hit glow and in-stage banner CSS verified.');

console.log('🎉 [PASS] Phase 4: All hit glow and settlement banner tests passed 100%!');

