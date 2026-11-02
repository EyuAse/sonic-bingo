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

console.log('🚀 Applying Phase 4 Backend Bot & Server Messages Clean-Up...');

// 1. telegramBotService.ts
let tgBotPath = path.resolve('server/services/telegramBotService.ts');
let tgBot = fs.readFileSync(tgBotPath, 'utf8');

tgBot = tgBot.replaceAll("description: '🎮 Launch Lomi Bingo Mini App'", "description: '🎮 Launch Sonic Bingo Mini App'");
tgBot = tgBot.replaceAll('🏆 <b>MEGA WINNER IN LOMI BINGO!</b> 🍋🎉', '🏆 <b>MEGA WINNER IN SONIC BINGO!</b> 👑🎉');
tgBot = tgBot.replaceAll('🛠️ <b>ውድ ደንበኞቻችን፣ ሎሚ ቢንጎ በጊዜያዊ ጥገና ላይ ነው!</b> 🍋', '🛠️ <b>ውድ ደንበኞቻችን፣ ሶኒክ ቢንጎ በጊዜያዊ ጥገና ላይ ነው!</b> 👑');
tgBot = tgBot.replaceAll('🛠️ <b>Lomi Bingo is under scheduled maintenance.</b>', '🛠️ <b>Sonic Bingo is under scheduled maintenance.</b>');
tgBot = tgBot.replaceAll('👋 <b>እንኳን ወደ ሎሚ ቢንጎ በደህና መጡ!</b> 🍋🎯', '👋 <b>እንኳን ወደ ሶኒክ ቢንጎ በደህና መጡ!</b> 👑🎯');
tgBot = tgBot.replaceAll('<b>Welcome to Lomi / Betika Bingo!</b>', '<b>Welcome to Sonic Bingo!</b>');
tgBot = tgBot.replaceAll('📖 <b>Lomi Bingo Help & Guides</b> 🍋', '📖 <b>Sonic Bingo Help & Guides</b> 👑');
tgBot = tgBot.replaceAll('🎁 <b>የሎሚ ቢንጎ ልዩ ማስተዋወቂያዎች!</b> 🍋✨', '🎁 <b>የሶኒክ ቢንጎ ልዩ ማስተዋወቂያዎች!</b> 👑✨');
tgBot = tgBot.replaceAll('<b>Active Lomi Bingo Promotions:</b>', '<b>Active Sonic Bingo Promotions:</b>');
tgBot = tgBot.replaceAll("'LomiBingobot'", "'SonicGameOfficialBot'");
tgBot = tgBot.replaceAll('@lomibingo_official', '@BRILV');
tgBot = tgBot.replaceAll('https://t.me/lomibingo_official', 'https://t.me/BRILV');

fs.writeFileSync(tgBotPath, tgBot, 'utf8');
console.log('✅ Updated server/services/telegramBotService.ts');

// 2. BingoGameEngine.ts
replaceInFile(
  'server/game/BingoGameEngine.ts',
  "error: 'ሎሚ ቢንጎ በጊዜያዊ ጥገና ላይ ነው። ውርርድ ለጊዜው ቆሟል (Lomi Bingo is under maintenance. Betting is paused).'",
  "error: 'ሶኒክ ቢንጎ በጊዜያዊ ጥገና ላይ ነው። ውርርድ ለጊዜው ቆሟል (Sonic Bingo is under maintenance. Betting is paused).'"
);

// 3. gameSocket.ts
replaceInFile(
  'server/sockets/gameSocket.ts',
  "message: 'ሎሚ ቢንጎ በጊዜያዊ ጥገና ላይ ነው። ጨዋታዎች ለጊዜው ቆመዋል (Lomi Bingo is under scheduled maintenance).'",
  "message: 'ሶኒክ ቢንጎ በጊዜያዊ ጥገና ላይ ነው። ጨዋታዎች ለጊዜው ቆመዋል (Sonic Bingo is under scheduled maintenance).'"
);

// 4. server.ts
replaceInFile(
  'server/server.ts',
  "service: 'Lomi Bingo Production API',",
  "service: 'Sonic Bingo Production API',"
);
replaceInFile(
  'server/server.ts',
  "error: 'ሎሚ ቢንጎ በጊዜያዊ ጥገና ላይ ነው። ጨዋታዎች ለጊዜው ቆመዋል (Lomi Bingo is under scheduled maintenance).'",
  "error: 'ሶኒክ ቢንጎ በጊዜያዊ ጥገና ላይ ነው። ጨዋታዎች ለጊዜው ቆመዋል (Sonic Bingo is under scheduled maintenance).'"
);
replaceInFile(
  'server/server.ts',
  "'Lomi Bingo is under scheduled maintenance. We will be back soon.'",
  "'Sonic Bingo is under scheduled maintenance. We will be back soon.'"
);
replaceInFile(
  'server/server.ts',
  "[Lomi Bingo Server]",
  "[Sonic Bingo Server]"
);

// 5. auth.ts
replaceInFile(
  'server/routes/auth.ts',
  "const name = (fullName || 'Lomi Player').trim();",
  "const name = (fullName || 'Sonic Player').trim();"
);
replaceInFile(
  'server/routes/auth.ts',
  "const myReferralCode = 'LOMI-' + Math.random().toString(36).substring(2, 8).toUpperCase();",
  "const myReferralCode = 'SONIC-' + Math.random().toString(36).substring(2, 8).toUpperCase();"
);

// 6. wallet.ts
replaceInFile(
  'server/routes/wallet.ts',
  "referralCode = 'LOMI-' + Math.random().toString(36).substring(2, 8).toUpperCase();",
  "referralCode = 'SONIC-' + Math.random().toString(36).substring(2, 8).toUpperCase();"
);
replaceInFile(
  'server/routes/wallet.ts',
  "const referralLink = `https://t.me/LomiBingobot/play?startapp=ref_${referralCode}`;",
  "const referralLink = `https://t.me/SonicGameOfficialBot/play?startapp=ref_${referralCode}`;"
);

// 7. telegramBot.ts
replaceInFile(
  'server/routes/telegramBot.ts',
  "const botUser = meRes.result?.username || 'LomiBingobot';",
  "const botUser = meRes.result?.username || 'SonicGameOfficialBot';"
);

// 8. ethiopianBotRoster.ts
replaceInFile(
  'server/game/ethiopianBotRoster.ts',
  "name: 'Lomi Fan 🍋'",
  "name: 'Sonic Fan 👑'"
);

console.log('🎉 Phase 4 Backend Bot & Server Messages text replacements executed successfully!');
