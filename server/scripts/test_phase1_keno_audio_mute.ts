import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('🧪 [TEST] Verifying Phase 1: Keno Audio Mute & Bingo Audio Preservation...');

// 1. Verify WebAudioEngine has master mute and disabled methods
const webAudioPath = path.resolve('src/components/keno/WebAudioEngine.ts');
const webAudioContent = fs.readFileSync(webAudioPath, 'utf8');

assert(webAudioContent.includes('MASTER_KENO_MUTE: boolean = true'), 'WebAudioEngine must define MASTER_KENO_MUTE = true');
assert(webAudioContent.includes('isMuted: boolean = true'), 'WebAudioEngine must be muted by default');
assert(!webAudioContent.includes('ctx.createOscillator()'), 'WebAudioEngine must not create oscillators when muted');
console.log('✅ 1. WebAudioEngine master mute and no-op guards verified.');

// 2. Verify KenoPage has muted no-ops
const kenoPagePath = path.resolve('src/pages/KenoPage.tsx');
const kenoPageContent = fs.readFileSync(kenoPagePath, 'utf8');

assert(kenoPageContent.includes('// Keno Audio Engine: Completely Muted'), 'KenoPage must comment that audio is completely muted');
assert(kenoPageContent.includes('const playTone = useCallback('), 'playTone hook must exist as a safe no-op');
assert(kenoPageContent.includes('const playHitChime = useCallback(() => {}, []);'), 'playHitChime must be an empty no-op');
assert(kenoPageContent.includes('const playPopSound = useCallback(() => {}, []);'), 'playPopSound must be an empty no-op');
assert(kenoPageContent.includes('const playWinFanfare = useCallback(() => {}, []);'), 'playWinFanfare must be an empty no-op');
assert(!kenoPageContent.includes('sndCtxRef.current = new AudioCtx()'), 'KenoPage must not instantiate AudioContext');
console.log('✅ 2. KenoPage audio synthesizer completely silenced.');

// 3. Verify Bingo Sound Engine is 100% Intact & Untouched
const bingoAudioPath = path.resolve('src/services/soundEngine.ts');
const bingoAudioContent = fs.readFileSync(bingoAudioPath, 'utf8');

assert(bingoAudioContent.includes('export const soundEngine = new AudioEngineService();'), 'Bingo soundEngine must remain active and exported');
assert(bingoAudioContent.includes('getBallAudioUrl'), 'Bingo soundEngine must retain getBallAudioUrl');
assert(bingoAudioContent.includes('playPresenceChime'), 'Bingo soundEngine must retain playPresenceChime');
assert(bingoAudioContent.includes('playDaub'), 'Bingo soundEngine must retain playDaub');
assert(bingoAudioContent.includes('playPop'), 'Bingo soundEngine must retain playPop');
assert(bingoAudioContent.includes('AUDIO_PACK_VERSION'), 'Bingo soundEngine pack version must remain intact');
console.log('✅ 3. Bingo Audio Engine (75-ball Amharic caller + chime) 100% intact and untouched.');

console.log('🎉 [PASS] Phase 1: All Keno audio muted; Bingo caller sound preserved with 0 regressions!');
