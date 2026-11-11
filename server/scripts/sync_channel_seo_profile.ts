import dotenv from 'dotenv';
dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID = '@SonicGameEthiopia';

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
  console.log('📢 TELEGRAM PUBLIC CHANNEL SEO & SEARCH ANCHOR SYNC');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // 1. Update Channel Title to bilingual search keywords
  const newTitle = 'Sonic Game | ሶኒክ ቢንጎ 🇪🇹';
  console.log(`1️⃣ Updating Channel Title to: "${newTitle}"...`);
  const titleRes = await callTelegram('setChatTitle', {
    chat_id: CHANNEL_ID,
    title: newTitle
  });
  console.log('   Result:', titleRes);

  // 2. Update Channel Description (Bio indexed in search)
  const newDescription = `👑 የሶኒክ ቢንጎ ይፋዊ ቻናል (Official Sonic Game Channel)። 

🇪🇹 የቀጥታ የቢንጎ ጨዋታ በቴሌግራም!
⚡ ፈጣን ተቀማጭ እና ወጪ ክፍያዎች በቴሌብር
🎙️ የቀጥታ የድምፅ ጠሪ በአማርኛ እና በእንግሊዝኛ
🎁 ነፃ ቦነስ ለአዲስ ተጫዋቾች!

🎮 ወደ ጨዋታው ይግቡ / Play Now: @SonicGameOfficialBot
👉 ይፋዊ ቦት: @SonicGameOfficialBot`;

  console.log(`\n2️⃣ Updating Channel Description / Bio...`);
  const descRes = await callTelegram('setChatDescription', {
    chat_id: CHANNEL_ID,
    description: newDescription
  });
  console.log('   Result:', descRes);

  // 3. Post a clean, high-visibility search anchor message to the channel with 1-click Play Button
  console.log(`\n3️⃣ Posting High-Visibility Search Gateway message to ${CHANNEL_ID}...`);
  const postText = `👑 <b>እንኳን ወደ ሶኒክ ቢንጎ በደህና መጡ!</b> 🎯🇪🇹\n<b>Welcome to Sonic Game (Sonic Bingo)!</b>\n\nበኢትዮጵያ ቀዳሚው የቀጥታ ባለብዙ ተጫዋች የቢንጎ ጨዋታ በቴሌግራም!\n\n🎁 <b>ነፃ ቦነስ</b> ለአዲስ ተጫዋቾች\n⚡ <b>ፈጣን ተቀማጭ እና ወጪ ክፍያዎች</b> በቴሌብር\n🎙️ <b>የቀጥታ የድምፅ ጠሪ</b> በአማርኛ እና በእንግሊዝኛ\n🛡️ <b>100% አስተማማኝ</b> እና ፈጣን ክፍያ\n\n👇 <b>ጨዋታውን አሁኑኑ ለመጀመር ከታች ያለውን ይጫኑ:</b>`;

  const postRes = await callTelegram('sendMessage', {
    chat_id: CHANNEL_ID,
    text: postText,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '🎮 አሁኑኑ ይጫወቱ (Play Bingo)',
            url: 'https://t.me/SonicGameOfficialBot/play'
          }
        ],
        [
          {
            text: '🤖 ወደ ይፋዊ ቦት ይሂዱ (Open Bot)',
            url: 'https://t.me/SonicGameOfficialBot'
          }
        ]
      ]
    }
  });
  console.log('   Post Result:', { ok: postRes.ok, message_id: postRes.result?.message_id });

  // 4. Pin the post in the channel
  if (postRes.ok && postRes.result?.message_id) {
    console.log(`\n4️⃣ Pinning search gateway message (ID: ${postRes.result.message_id})...`);
    const pinRes = await callTelegram('pinChatMessage', {
      chat_id: CHANNEL_ID,
      message_id: postRes.result.message_id
    });
    console.log('   Pin Result:', pinRes);
  }

  // 5. Verify the updated channel info
  console.log('\n🔍 Verifying updated channel profile from Telegram API...');
  const chatInfo = await callTelegram('getChat', { chat_id: CHANNEL_ID });
  console.log('\n✅ UPDATED CHANNEL PROFILE:');
  console.log('   • Channel Title:', chatInfo.result?.title);
  console.log('   • Channel Handle:', `@${chatInfo.result?.username}`);
  console.log('   • Channel Bio:  ', chatInfo.result?.description?.split('\n')[0]);
  console.log('   • Pinned Msg ID:', chatInfo.result?.pinned_message?.message_id);

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('🎉 CHANNEL SEO SEARCH ANCHOR SYNC COMPLETE!');
  console.log('═══════════════════════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('❌ Channel sync failed:', err);
  process.exit(1);
});

