import fs from 'fs';
import path from 'path';

function replaceInFile(filePath: string, search: string | RegExp, replacement: string) {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`File not found: ${filePath}`);
    return false;
  }
  const content = fs.readFileSync(fullPath, 'utf8');
  let newContent: string;
  if (typeof search === 'string') {
    if (!content.includes(search)) {
      console.warn(`[WARN] Search string not found in ${filePath}: "${search.slice(0, 40)}..."`);
      return false;
    }
    newContent = content.replaceAll(search, replacement);
  } else {
    newContent = content.replace(search, replacement);
  }
  fs.writeFileSync(fullPath, newContent, 'utf8');
  console.log(`✅ Updated ${filePath}`);
  return true;
}

console.log('🚀 Applying Phase 3 Player UI & Modals Clean-Up...');

// 1. TelegramRegisterModal.tsx
replaceInFile(
  'src/components/auth/TelegramRegisterModal.tsx',
  '/assets/images/lomi_crowned_lemon_badge.png',
  '/assets/images/wallet-vip-crown-ribbon.jpg'
);
replaceInFile(
  'src/components/auth/TelegramRegisterModal.tsx',
  'alt="Lomi Crowned Lemon"',
  'alt="Sonic Crown VIP Badge"'
);
replaceInFile(
  'src/components/auth/TelegramRegisterModal.tsx',
  '<>የእርስዎን <span style={{ color: \'#16a34a\' }}>ሎሚ</span> መለያ ይፍጠሩ</>',
  '<>የእርስዎን <span style={{ color: \'#0ea5e9\' }}>ሶኒክ</span> መለያ ይፍጠሩ</>'
);
replaceInFile(
  'src/components/auth/TelegramRegisterModal.tsx',
  '<>Create Your <span style={{ color: \'#16a34a\' }}>Lomi</span> Account</>',
  '<>Create Your <span style={{ color: \'#0ea5e9\' }}>Sonic</span> Account</>'
);
replaceInFile(
  'src/components/auth/TelegramRegisterModal.tsx',
  '/assets/images/lomi_etb_coins_reward.png',
  '/assets/images/sonic-rewards-chest-coins.png'
);

// 2. WinModal.tsx
replaceInFile(
  'src/components/bingo/WinModal.tsx',
  '`🎉 I just won ${safeLocale(userShare)} ETB on Lomi 75-Ball Bingo! Come play and win with me: https://t.me/LomiBingobot/play`',
  '`🎉 I just won ${safeLocale(userShare)} ETB on Sonic 75-Ball Bingo! Come play and win with me: https://t.me/SonicGameOfficialBot/play`'
);
replaceInFile(
  'src/components/bingo/WinModal.tsx',
  'https://t.me/share/url?url=https://t.me/LomiBingobot/play',
  'https://t.me/share/url?url=https://t.me/SonicGameOfficialBot/play'
);

// 3. FooterBanner.tsx
replaceInFile(
  'src/components/games/FooterBanner.tsx',
  '<span className="promo-tag">🍋 LOMI VIP</span>',
  '<span className="promo-tag">👑 SONIC VIP</span>'
);

// 4. translations.ts
replaceInFile(
  'src/locales/translations.ts',
  "title: 'ስለ ሎሚ ቢንጎ',",
  "title: 'ስለ ሶኒክ ቢንጎ',"
);
replaceInFile(
  'src/locales/translations.ts',
  'በሎሚ ኢንተርቴይንመንት ኃ/የተ/የግ/ማህበር',
  'በሶኒክ ኢንተርቴይንመንት ኃ/የተ/የግ/ማህበር'
);
replaceInFile(
  'src/locales/translations.ts',
  "aboutLomi: 'About Sonic Bingo',",
  "aboutSonic: 'About Sonic Bingo',\n      aboutLomi: 'About Sonic Bingo',"
);
replaceInFile(
  'src/locales/translations.ts',
  "aboutLomi: 'ስለ ሶኒክ ቢንጎ',",
  "aboutSonic: 'ስለ ሶኒክ ቢንጎ',\n      aboutLomi: 'ስለ ሶኒክ ቢንጎ',"
);

// 5. BlumOnboardingCarousel.tsx
replaceInFile(
  'src/components/landing/BlumOnboardingCarousel.tsx',
  "art: '/assets/images/lomi-hero-75.jpg',",
  "art: '/assets/images/sonic-hero-75-vip.jpg',"
);

// 6. AffiliatePage.tsx
replaceInFile(
  'src/pages/AffiliatePage.tsx',
  'src="/assets/images/lomi_rewards_chest_etb.png"',
  'src="/assets/images/sonic-rewards-chest-coins.png"'
);

// 7. LandingPage.tsx
replaceInFile(
  'src/pages/LandingPage.tsx',
  "(e.target as HTMLImageElement).src = '/assets/images/lomi-hero-75.jpg';",
  "(e.target as HTMLImageElement).src = '/assets/images/fast-bingo-exact-hero.jpg';"
);

// 8. authService.ts
replaceInFile(
  'src/services/authService.ts',
  'const token = `lomi_tg_jwt_${Date.now()}_${user.id}`;',
  'const token = `sonic_tg_jwt_${Date.now()}_${user.id}`;'
);
replaceInFile(
  'src/services/authService.ts',
  'const token = `lomi_jwt_${Date.now()}_${newUser.id}`;',
  'const token = `sonic_jwt_${Date.now()}_${newUser.id}`;'
);
replaceInFile(
  'src/services/authService.ts',
  'const token = `lomi_jwt_${Date.now()}_${user.id}`;',
  'const token = `sonic_jwt_${Date.now()}_${user.id}`;'
);

// 9. ProfilePage.tsx
replaceInFile(
  'src/pages/ProfilePage.tsx',
  "{t('profile.aboutLomi')}",
  "{t('profile.aboutSonic') || t('profile.aboutLomi')}"
);
replaceInFile(
  'src/pages/ProfilePage.tsx',
  "{t('profile.aboutLomiSub')}",
  "{t('profile.aboutSonicSub') || t('profile.aboutLomiSub')}"
);

console.log('🎉 Phase 3 Player UI & Modals text replacements executed successfully!');

// 10. LanguageContext.tsx
replaceInFile(
  'src/context/LanguageContext.tsx',
  "const saved = localStorage.getItem('lomi_bingo_lang');",
  "const saved = localStorage.getItem('sonic_bingo_lang') || localStorage.getItem('lomi_bingo_lang');"
);
replaceInFile(
  'src/context/LanguageContext.tsx',
  "localStorage.setItem('lomi_bingo_lang', nextLang);",
  "localStorage.setItem('sonic_bingo_lang', nextLang);"
);

// 11. TelegramRegisterModal comment
replaceInFile(
  'src/components/auth/TelegramRegisterModal.tsx',
  '{/* 2. Dual-Tone Title: Create Your Lomi Account */}',
  '{/* 2. Dual-Tone Title: Create Your Sonic Account */}'
);

console.log('✅ Finalized LanguageContext and modal comment cleanups');
