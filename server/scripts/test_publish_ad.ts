import { telegramBotService } from '../services/telegramBotService.ts';

async function testPublish() {
  console.log('🚀 Testing Ad Publishing to @SonicGameEthiopia...');

  const result = await telegramBotService.broadcast({
    targetType: 'channel',
    targetId: '@SonicGameEthiopia',
    title: 'Weekend 10,000 ETB Mega Pot Tournament! 👑🏆',
    message:
      '🎉 <b>ታላቅ የሳምንቱ መጨረሻ የሶኒክ ቢንጎ ውድድር!</b> 👑🏆\n\n' +
      '💰 አጠቃላይ የሽልማት ፈንድ: <b>10,000 ETB!</b>\n' +
      '⚡ ፈጣን ክፍያዎች በቴሌብር እና በሲቢኢ ብር\n' +
      '🎁 አዲስ ለተመዘገቡ ተጫዋቾች <b>10 ETB ነፃ ቦነስ</b> ተዘጋጅቷል!\n\n' +
      'ካርቴላዎን አሁኑኑ ይቁረጡ እና ያሸንፉ! 👇',
    imageUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=800&auto=format&fit=crop&q=80',
    buttonText: '🎮 Play Bingo Now & Get 10 ETB',
    buttonUrl: 'https://t.me/SonicGameOfficialBot/play',
    pinMessage: false
  });

  console.log('Publish result:', result);
  process.exit(0);
}

testPublish().catch(err => {
  console.error('Publish error:', err);
  process.exit(1);
});
