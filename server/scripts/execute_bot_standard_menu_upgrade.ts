import dotenv from 'dotenv';
import { pool } from '../db.ts';
import { telegramBotService } from '../services/telegramBotService.ts';

dotenv.config();

async function main() {
  console.log('🚀 Executing Telegram Bot Standard Menu Upgrade...\n');

  // 1. Verify Bot
  const me = await telegramBotService.getMe();
  console.log('1. Bot Identity:', me.ok ? `@${me.result?.username} (ID: ${me.result?.id})` : me);

  // 2. Register full official 9-command roster
  console.log('\n2. Registering official 9-command roster...');
  const cmdRes = await telegramBotService.setMyCommands();
  console.log('   Result:', cmdRes);

  // 3. Switch Menu Button to 'commands' mode (restores [ ☰ Menu ] button)
  console.log('\n3. Switching Chat Menu Button to "commands" mode...');
  const menuRes = await telegramBotService.setChatMenuButton('commands');
  console.log('   Result:', menuRes);

  // 4. Verify Registered Commands
  console.log('\n4. Verifying registered commands on Telegram API:');
  const checkCmds = await telegramBotService.getMyCommands();
  if (checkCmds.ok) {
    console.table(checkCmds.commands);
  } else {
    console.error('Failed to get commands:', checkCmds.error);
  }

  // 5. Verify Chat Menu Button on Telegram API
  console.log('\n5. Verifying Chat Menu Button on Telegram API:');
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const menuCheckRes = await fetch(`https://api.telegram.org/bot${token}/getChatMenuButton`);
  const menuCheck = await menuCheckRes.json();
  console.log('   Menu Button Config:', menuCheck);

  await pool.end();
  console.log('\n🎉 Upgrade completed successfully!');
}

main().catch(err => {
  console.error('❌ Upgrade script failed:', err);
  process.exit(1);
});
