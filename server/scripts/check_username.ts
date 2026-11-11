import dotenv from 'dotenv';
dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const target = process.argv[2] || '@SonicBingoET_bot';

async function check() {
  const url = `https://api.telegram.org/bot${token}/getChat?chat_id=${target}`;
  const res = await fetch(url);
  const data = await res.json();
  console.log(`Telegram API check for ${target}:`, data);
}

check().catch(console.error);

