import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

function assert(condition: boolean, desc: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${desc}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${desc}`);
    failed++;
  }
}

console.log('🧪 ========================================================');
console.log('🧪 RUNNING AGENT PWA & ZERO-REGRESSION COMPREHENSIVE AUDIT');
console.log('🧪 ========================================================\n');

// 1. MANIFEST.JSON AUDIT
console.log('📋 Test 1: Web App Manifest Schema & Standalone Route');
const manifestPath = path.resolve(process.cwd(), 'public/manifest.json');
assert(fs.existsSync(manifestPath), 'public/manifest.json exists');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
assert(manifest.start_url === '/#/agent-portal', `start_url is "/#/agent-portal" (got: ${manifest.start_url})`);
assert(manifest.display === 'standalone', `display is "standalone" (got: ${manifest.display})`);
assert(manifest.theme_color === '#dc2626', `theme_color is "#dc2626" (got: ${manifest.theme_color})`);
assert(manifest.icons && manifest.icons.length >= 3, `contains at least 3 icons (got: ${manifest.icons?.length})`);

// 2. PWA ICONS AUDIT
console.log('\n👑 Test 2: PWA High-Resolution & Apple Touch Icons');
const icon192 = path.resolve(process.cwd(), 'public/icons/icon-192.png');
const icon512 = path.resolve(process.cwd(), 'public/icons/icon-512.png');
const maskable512 = path.resolve(process.cwd(), 'public/icons/icon-512-maskable.png');
const appleTouch = path.resolve(process.cwd(), 'public/icons/apple-touch-icon.png');
const appleTouch180 = path.resolve(process.cwd(), 'public/icons/apple-touch-icon-180.png');
assert(fs.existsSync(icon192), 'public/icons/icon-192.png exists');
assert(fs.existsSync(icon512), 'public/icons/icon-512.png exists');
assert(fs.existsSync(maskable512), 'public/icons/icon-512-maskable.png exists');
assert(fs.existsSync(appleTouch), 'public/icons/apple-touch-icon.png exists');
assert(fs.existsSync(appleTouch180), 'public/icons/apple-touch-icon-180.png exists');

// 3. INDEX.HTML APPLE META & VIEWPORT AUDIT
console.log('\n🍏 Test 3: Apple Standalone Meta Tags & Safe Area Viewport in index.html');
const indexHtml = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
assert(indexHtml.includes('viewport-fit=cover'), 'index.html includes viewport-fit=cover');
assert(indexHtml.includes('apple-mobile-web-app-capable'), 'index.html includes apple-mobile-web-app-capable');
assert(indexHtml.includes('apple-mobile-web-app-status-bar-style'), 'index.html includes apple-mobile-web-app-status-bar-style');
assert(indexHtml.includes('rel="apple-touch-icon"'), 'index.html links apple-touch-icon');
assert(indexHtml.includes('rel="manifest" href="/manifest.json"'), 'index.html links manifest.json');

// 4. SERVICE WORKER DYNAMIC FIREWALL AUDIT
console.log('\n⚡ Test 4: Service Worker Dynamic Route Bypass Firewall');
const swJs = fs.readFileSync(path.resolve(process.cwd(), 'public/sw.js'), 'utf8');
assert(swJs.includes("url.pathname.startsWith('/api')"), 'sw.js strictly bypasses /api');
assert(swJs.includes("url.pathname.startsWith('/socket.io')"), 'sw.js strictly bypasses /socket.io');
assert(swJs.includes("url.hostname.includes('onrender.com')"), 'sw.js strictly bypasses onrender.com');
assert(swJs.includes('caches.delete'), 'sw.js purges stale caches on activation');

// 5. TELEGRAM ISOLATION AUDIT
console.log('\n🛡️ Test 5: Telegram Mini-App Isolation Guard');
const pwaReg = fs.readFileSync(path.resolve(process.cwd(), 'src/services/pwaRegistration.ts'), 'utf8');
assert(pwaReg.includes('Telegram?.WebApp?.initData'), 'pwaRegistration.ts checks for Telegram WebApp');
const hookFile = fs.readFileSync(path.resolve(process.cwd(), 'src/hooks/usePWAInstall.ts'), 'utf8');
assert(hookFile.includes('telegramActive'), 'usePWAInstall hook isolates Telegram users');

// 6. ZERO REGRESSION: RED LUXURY THEME & PURGED LEMONS AUDIT
console.log('\n🎨 Test 6: Zero Regression on Red Luxury UI, Splash Screen & Purged Lemons');
const landingPage = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/LandingPage.tsx'), 'utf8');
assert(!landingPage.includes('+ 1 Free Cartela'), 'LandingPage has NO "1 Free Cartela" pill');
const splashScreen = fs.readFileSync(path.resolve(process.cwd(), 'src/components/common/AppSplashScreen.tsx'), 'utf8');
assert(splashScreen.includes('#ffffff') && splashScreen.includes('#fff9f9'), 'AppSplashScreen maintains Light Luxury White/Cream background');

// 7. MULTI-ROOM INTEGRITY
console.log('\n🎰 Test 7: Multi-Room Bot Isolation Firewall');
const gameEngine = fs.readFileSync(path.resolve(process.cwd(), 'server/game/BingoGameEngine.ts'), 'utf8');
assert(gameEngine.includes("roomId === 'room-10'"), 'Bots are strictly confined to Room 10');

console.log('\n========================================================');
console.log(`📊 AUDIT SUMMARY: ${passed} Passed, ${failed} Failed`);
console.log('========================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL PWA & ZERO-REGRESSION INVARIANTS 100% SATISFIED!');
}

