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

console.log('🚀 Applying Phase 2 Admin Portal Complete Clean-Up...');

// 1. AdminPINModal.tsx
replaceInFile(
  'src/components/admin/AdminPINModal.tsx',
  '<span className="text-white">LOMI</span> <span className="text-gold">BINGO</span>',
  '<span className="text-white">SONIC</span> <span className="text-gold">BINGO</span>'
);
replaceInFile(
  'src/components/admin/AdminPINModal.tsx',
  'Protected by Lomi Bingo Engine V3 Security',
  'Protected by Sonic Bingo Engine V3 Security'
);

// 2. AdminPage.tsx
replaceInFile(
  'src/pages/AdminPage.tsx',
  'የቀን ተቀማጭ፣ የክፍያ ወጪ እና የተጣራ የሎሚ ቢንጎ ገቢ ዝርዝር',
  'የቀን ተቀማጭ፣ የክፍያ ወጪ እና የተጣራ የሶኒክ ቢንጎ ገቢ ዝርዝር'
);

// 3. DashboardOverview.tsx
replaceInFile(
  'src/components/admin/DashboardOverview.tsx',
  'LOMI BINGO PLATFORM OPERATIONS DESK',
  'SONIC BINGO PLATFORM OPERATIONS DESK'
);
replaceInFile(
  'src/components/admin/DashboardOverview.tsx',
  'የሎሚ ቢንጎ የቀጥታ ጨዋታዎችን፣ የኮሚሽን ትርፍን እና የክፍያዎችን ፍሰት በአንድ ማዕከል ይቆጣጠሩ',
  'የሶኒክ ቢንጎ የቀጥታ ጨዋታዎችን፣ የኮሚሽን ትርፍን እና የክፍያዎችን ፍሰት በአንድ ማዕከል ይቆጣጠሩ'
);

// 4. PlayerAccountsDesk.tsx
replaceInFile(
  'src/components/admin/PlayerAccountsDesk.tsx',
  'LOMI BINGO PLAYER ACCOUNTS & WALLETS DIRECTORY',
  'SONIC BINGO PLAYER ACCOUNTS & WALLETS DIRECTORY'
);

// 5. CartelasDesk.tsx
const cartelaSearch = `<div className="lomi-logo-artwork mini">
                    <span className="lomi-letter-l">L</span>
                    <span className="lomi-lemon-o">🍋</span>
                    <span className="lomi-letter-m">M</span>
                    <span className="lomi-letter-i">I</span>
                  </div>`;
const cartelaReplace = `<div className="sonic-card-watermark mini" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: 900, color: '#f59e0b', fontSize: '11px', letterSpacing: '1px' }}>
                    <span>👑</span>
                    <span style={{ color: '#0284c7' }}>SONIC</span>
                  </div>`;
// Support both CRLF and LF
const cartelasPath = path.resolve('src/components/admin/CartelasDesk.tsx');
let cartelasContent = fs.readFileSync(cartelasPath, 'utf8');
cartelasContent = cartelasContent.replace(
  /<div className="lomi-logo-artwork mini">[\s\S]*?<\/div>/,
  cartelaReplace
);
fs.writeFileSync(cartelasPath, cartelasContent, 'utf8');
console.log('✅ Updated src/components/admin/CartelasDesk.tsx');

// 6. CashFlowAnalytics.tsx
replaceInFile(
  'src/components/admin/CashFlowAnalytics.tsx',
  'የቀን ተቀማጭ፣ የክፍያ ወጪ እና የተጣራ የሎሚ ቢንጎ የኮሚሽን ገቢ ዝርዝር የሂሳብ መረጃ',
  'የቀን ተቀማጭ፣ የክፍያ ወጪ እና የተጣራ የሶኒክ ቢንጎ የኮሚሽን ገቢ ዝርዝር የሂሳብ መረጃ'
);

// 7. AdminSettings.tsx
replaceInFile(
  'src/components/admin/AdminSettings.tsx',
  "brandName || 'Lomi Bingo'",
  "brandName || 'Sonic Bingo'"
);
replaceInFile(
  'src/components/admin/AdminSettings.tsx',
  'placeholder="e.g. Lomi Bingo"',
  'placeholder="e.g. Sonic Bingo"'
);

// 8. TelegramBotDesk.tsx
replaceInFile(
  'src/components/admin/TelegramBotDesk.tsx',
  "🍋 Welcome to Lomi Bingo! Ethiopia's #1 Live Real-Time Multiplayer Bingo in Telegram. 20 ETB Welcome Gift, 600 Cartelas, Instant Cashier Payouts!",
  "👑 Welcome to Sonic Bingo! Ethiopia's #1 Live Real-Time Multiplayer Bingo in Telegram. 20 ETB Welcome Gift, 600 Cartelas, Instant Cashier Payouts!"
);
replaceInFile(
  'src/components/admin/TelegramBotDesk.tsx',
  "🍋 Lomi Bingo: Live multiplayer bingo with instant payouts!",
  "👑 Sonic Bingo: Live multiplayer bingo with instant payouts!"
);
replaceInFile(
  'src/components/admin/TelegramBotDesk.tsx',
  "'👋 <b>እንኳን ወደ ሎሚ ቢንጎ በደህና መጡ!</b> 🍋🎯\\n' +",
  "'👋 <b>እንኳን ወደ ሶኒክ ቢንጎ በደህና መጡ!</b> 👑🎯\\n' +"
);
replaceInFile(
  'src/components/admin/TelegramBotDesk.tsx',
  "'<b>Welcome to Lomi / Betika Bingo!</b>\\n\\n' +",
  "'<b>Welcome to Sonic Bingo!</b>\\n\\n' +"
);
replaceInFile(
  'src/components/admin/TelegramBotDesk.tsx',
  "'👋 <b>እንኳን ወደ ሎሚ ቢንጎ በደህና መጡ!</b> 🍋🎁\\n' +",
  "'👋 <b>እንኳን ወደ ሶኒክ ቢንጎ በደህና መጡ!</b> 👑🎁\\n' +"
);
replaceInFile(
  'src/components/admin/TelegramBotDesk.tsx',
  "'Betika / Lomi Bingo Bot'",
  "'Sonic Bingo Bot'"
);
replaceInFile(
  'src/components/admin/TelegramBotDesk.tsx',
  "status?.bot?.first_name || 'Lomi Bingo'",
  "status?.bot?.first_name || 'Sonic Bingo'"
);
replaceInFile(
  'src/components/admin/TelegramBotDesk.tsx',
  'placeholder="e.g. 🍋 Lomi Bingo: Live multiplayer bingo with instant payouts!"',
  'placeholder="e.g. 👑 Sonic Bingo: Live multiplayer bingo with instant payouts!"'
);

console.log('🎉 Phase 2 Admin Portal text replacements executed successfully!');

// 9. TelegramBotDesk.tsx Fallback Bot & Channel handles
let tgContent = fs.readFileSync(path.resolve('src/components/admin/TelegramBotDesk.tsx'), 'utf8');
tgContent = tgContent.replaceAll("'LomiBingobot'", "'SonicGameOfficialBot'");
tgContent = tgContent.replaceAll('@LomiBingobot', '@SonicGameOfficialBot');
tgContent = tgContent.replaceAll('@lomibingo_official', '@BRILV');
tgContent = tgContent.replaceAll('@lomibingo', '@BRILV');
tgContent = tgContent.replaceAll('https://t.me/lomibingo_official', 'https://t.me/BRILV');
fs.writeFileSync(path.resolve('src/components/admin/TelegramBotDesk.tsx'), tgContent, 'utf8');
console.log('✅ Updated TelegramBotDesk bot username and channel fallbacks to @SonicGameOfficialBot / @BRILV');
