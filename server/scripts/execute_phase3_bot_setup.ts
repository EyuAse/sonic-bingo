import dotenv from 'dotenv';
dotenv.config();

import { telegramBotService } from '../services/telegramBotService.ts';
import { query, pool } from '../db.ts';

async function main() {
  console.log('══════════════════════════════════════════════════════════════');
  console.log('🤖 [Phase 3] Configuring Telegram Bot @sonicbingobot');
  console.log('══════════════════════════════════════════════════════════════\n');

  telegramBotService.clearConfigCache();

  // 1. Verify Bot Identity
  console.log('1️⃣ Verifying Bot Credentials via getMe...');
  const meRes = await telegramBotService.getMe();
  if (!meRes.ok) {
    throw new Error(`Failed to authenticate bot with Telegram API: ${meRes.description}`);
  }
  const botInfo = meRes.result;
  console.log(`   ✓ Authenticated as: @${botInfo.username} (${botInfo.first_name}) [ID: ${botInfo.id}]`);

  // 2. Set Bot Description
  console.log('\n2️⃣ Updating Bot Description & Short Description...');
  const desc = "👑 Welcome to Sonic Bingo! Ethiopia's #1 Live Real-Time Multiplayer Bingo in Telegram. 50 ETB Welcome Gift, 600 Cartelas, Instant Cashier Payouts!";
  const shortDesc = "👑 Sonic Bingo: Live multiplayer bingo with instant payouts!";
  
  const descRes = await telegramBotService.setMyDescription(desc);
  console.log('   ✓ setMyDescription:', descRes.message);
  
  const shortDescRes = await telegramBotService.setMyShortDescription(shortDesc);
  console.log('   ✓ setMyShortDescription:', shortDescRes.message);

  // 3. Register Slash Commands
  console.log('\n3️⃣ Registering Bot Commands Menu...');
  const cmdRes = await telegramBotService.setMyCommands([
    { command: 'play', description: '🎮 Launch Sonic Bingo Mini App' },
    { command: 'start', description: '👑 Welcome & 50 ETB Bonus Gift' },
    { command: 'link_phone', description: '📱 Link Verified Phone Number' },
    { command: 'bonus', description: '🎁 Claim 50 ETB Welcome Bonus' }
  ]);
  console.log('   ✓ setMyCommands:', cmdRes.message);

  // 4. Configure Persistent Chat Menu Button (🎮 Play Bingo)
  const webAppUrl = process.env.TELEGRAM_WEBAPP_URL || 'https://sonic-bingo.asoeyo029.workers.dev';
  console.log(`\n4️⃣ Configuring Chat Menu Button to: ${webAppUrl}...`);
  const menuRes = await telegramBotService.setChatMenuButton('web_app', webAppUrl);
  console.log('   ✓ setChatMenuButton:', menuRes.message);

  // 5. Check Telegram Channel @sonicbingo Connection & Admin Permissions
  console.log('\n5️⃣ Verifying Channel Connection (@sonicbingo)...');
  const channelStatus = await telegramBotService.verifyChannelStatus('@sonicbingo');
  console.log('   Channel:', channelStatus.channel);
  console.log('   Accessible:', channelStatus.ok);
  console.log('   Is Administrator:', channelStatus.isAdministrator);
  console.log('   Can Post Messages:', channelStatus.canPost);
  console.log('   Status Details:', channelStatus.description);

  await pool.end();
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('🎉 [Phase 3] Bot API Configuration Complete!');
  console.log('══════════════════════════════════════════════════════════════');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Phase 3 setup failed:', err);
  process.exit(1);
});
