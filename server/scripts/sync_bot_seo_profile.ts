import dotenv from 'dotenv';
dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN is not defined in .env');
  process.exit(1);
}

const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function callTelegram(method: string, body?: any) {
  const url = `${API_BASE}/${method}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  return res.json();
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('🤖 TELEGRAM BOT SEARCH SEO & DISCOVERY PROFILE SYNC');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // 1. Check current info
  const me = await callTelegram('getMe');
  console.log('Current Bot Account:', {
    id: me.result?.id,
    first_name: me.result?.first_name,
    username: me.result?.username,
    has_main_web_app: me.result?.has_main_web_app
  });

  // 2. Set Bot Name with space and bilingual Ethiopian keywords
  // "Sonic Game | ሶኒክ ቢንጎ" matches searches for "Sonic", "Sonic Game", "ሶኒክ", "ቢንጎ"
  const newName = 'Sonic Game | ሶኒክ ቢንጎ';
  console.log(`\n1️⃣ Updating Bot Display Name to: "${newName}"...`);
  const nameRes = await callTelegram('setMyName', { name: newName });
  console.log('   Result:', nameRes);

  // 3. Set Short Description (Profile card bio, max 120 chars)
  const newShortDesc = '👑 Sonic Game: Ethiopia\'s #1 Live Multiplayer Bingo Casino! 20 ETB Gift, 600 Cartelas & Instant Payouts.';
  console.log(`\n2️⃣ Updating Short Description (${newShortDesc.length} chars)...`);
  const shortDescRes = await callTelegram('setMyShortDescription', { short_description: newShortDesc });
  console.log('   Result:', shortDescRes);

  // 4. Set Description (Welcome card shown before clicking Start)
  const newDesc = `👋 Welcome to Sonic Game (ሶኒክ ቢንጎ)! 👑🎯

🇪🇹 Ethiopia's #1 Real-Time Multiplayer Live Bingo in Telegram!

🎁 20 ETB Free Welcome Bonus for new players
⚡ Instant Telebirr Cashier Deposits & Withdrawals
🎙️ Authentic Amharic & English Voice Ball Caller
🛡️ 100% Escrow & Disconnect Protection

Tap Start or the Menu Button below to play!`;

  console.log('\n3️⃣ Updating Welcome Description...');
  const descRes = await callTelegram('setMyDescription', { description: newDesc });
  console.log('   Result:', descRes);

  // 5. Verify the updated profile
  console.log('\n🔍 Verifying updated profile from Telegram Bot API...');
  const updatedMe = await callTelegram('getMe');
  const updatedName = await callTelegram('getMyName');
  const updatedShortDesc = await callTelegram('getMyShortDescription');
  const updatedDesc = await callTelegram('getMyDescription');

  console.log('\n✅ UPDATED TELEGRAM BOT PROFILE:');
  console.log('   • Display Name:', updatedName.result?.name || updatedMe.result?.first_name);
  console.log('   • Username:    ', `@${updatedMe.result?.username}`);
  console.log('   • Short Bio:   ', updatedShortDesc.result?.short_description);
  console.log('   • Description: ', updatedDesc.result?.description?.split('\n')[0]);

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('🎉 BOT SEO PROFILE SYNCED SUCCESSFULLY!');
  console.log('═══════════════════════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('❌ Failed to sync bot SEO profile:', err);
  process.exit(1);
});

