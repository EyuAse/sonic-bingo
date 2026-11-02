import fs from 'fs';
import path from 'path';

function replaceInFile(filePath: string, search: string | RegExp, replacement: string) {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`File not found: ${filePath}`);
    return false;
  }
  let content = fs.readFileSync(fullPath, 'utf8');
  if (typeof search === 'string') {
    if (!content.includes(search)) {
      console.warn(`[WARN] Search string not found in ${filePath}: "${search.slice(0, 40)}..."`);
      return false;
    }
    content = content.replaceAll(search, replacement);
  } else {
    content = content.replace(search, replacement);
  }
  fs.writeFileSync(fullPath, content, 'utf8');
  console.log(`✅ Updated ${filePath}`);
  return true;
}

console.log('🚀 Linking official Sonic Channel @SonicGameEthiopia and cleaning up residual emojis...');

// 1. telegramBotService.ts
let tgBotPath = path.resolve('server/services/telegramBotService.ts');
let tgBot = fs.readFileSync(tgBotPath, 'utf8');
tgBot = tgBot.replaceAll('@BRILV', '@SonicGameEthiopia');
tgBot = tgBot.replaceAll('https://t.me/BRILV', 'https://t.me/SonicGameEthiopia');

// Improve verifyChannelStatus to support both Channels and Supergroups without permission mismatches
const oldCanPost = `    const isAdm = member.status === 'administrator' || member.status === 'creator';
    const canPost = isAdm && (member.status === 'creator' || member.can_post_messages === true);`;
const newCanPost = `    const isAdm = member.status === 'administrator' || member.status === 'creator';
    const canPost = isAdm && (
      member.status === 'creator' ||
      member.can_post_messages === true ||
      (chatRes.result?.type === 'supergroup' || chatRes.result?.type === 'group' || member.can_manage_chat === true)
    );`;
tgBot = tgBot.replace(oldCanPost, newCanPost);

fs.writeFileSync(tgBotPath, tgBot, 'utf8');
console.log('✅ Updated server/services/telegramBotService.ts');

// 2. TelegramBotDesk.tsx
let deskPath = path.resolve('src/components/admin/TelegramBotDesk.tsx');
let desk = fs.readFileSync(deskPath, 'utf8');

// Replace channel handles
desk = desk.replaceAll('@BRILV', '@SonicGameEthiopia');
desk = desk.replaceAll('https://t.me/BRILV', 'https://t.me/SonicGameEthiopia');
desk = desk.replaceAll('-1004345393319', '@SonicGameEthiopia');

// Replace residual lemon emojis with royal gold crowns
desk = desk.replaceAll('Weekend 10,000 ETB Mega Pot Tournament! 🍋🏆', 'Weekend 10,000 ETB Mega Pot Tournament! 👑🏆');
desk = desk.replaceAll('🍋🏆', '👑🏆');
desk = desk.replaceAll('🍋💵', '👑💵');
desk = desk.replaceAll('🍋✨', '👑✨');
desk = desk.replaceAll('🍋🎁', '👑🎁');
desk = desk.replaceAll('Set to @BRILV', 'Set to @SonicGameEthiopia');
desk = desk.replaceAll('>Set to @SonicGameEthiopia<', '>Set to @SonicGameEthiopia<');

// Replace avatar emoji in preview
desk = desk.replace(
  /<div className="msg-preview-avatar">[\s\S]*?<\/div>/,
  `<div className="msg-preview-avatar" style={{ background: 'radial-gradient(circle at 35% 30%, #fef08a 0%, #f59e0b 55%, #b45309 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                👑
              </div>`
);

// Replace active promo banner lemon if any
desk = desk.replace(
  /<div className="promo-active-icon">[\s\S]*?<\/div>/,
  `<div className="promo-active-icon" style={{ background: 'radial-gradient(circle at 35% 30%, #fef08a 0%, #f59e0b 55%, #b45309 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                👑
              </div>`
);

fs.writeFileSync(deskPath, desk, 'utf8');
console.log('✅ Updated src/components/admin/TelegramBotDesk.tsx');

console.log('🎉 Successfully linked @SonicGameEthiopia and refreshed Telegram Bot Desk!');
