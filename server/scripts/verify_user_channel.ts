import { telegramBotService } from '../services/telegramBotService.ts';

async function verifyNewChannel() {
  console.log('🔍 Checking connection to user channel @SonicGameEthiopia...');

  const channel = '@SonicGameEthiopia';
  const chatRes = await (telegramBotService as any).callApi('getChat', { chat_id: channel });
  console.log('Chat Info:', chatRes);

  const meRes = await telegramBotService.getMe();
  const botId = meRes.result.id;

  const memberRes = await (telegramBotService as any).callApi('getChatMember', {
    chat_id: channel,
    user_id: botId
  });
  console.log('Member Admin Permissions:', memberRes);

  process.exit(0);
}

verifyNewChannel().catch(err => {
  console.error(err);
  process.exit(1);
});
