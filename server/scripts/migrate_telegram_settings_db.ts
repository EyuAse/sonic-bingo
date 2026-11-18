import dotenv from 'dotenv';
dotenv.config();

import { query, pool } from '../db.ts';

async function main() {
  console.log('🔄 [Phase 1] Updating admin_settings in Neon PostgreSQL...');

  const settingsToUpdate = [
    { key: 'telegram_bot_token', value: '8736053891:AAHCNqXA-1DZIJA5ylb-oYw1EAEkHfX9Xjc' },
    { key: 'telegram_bot_username', value: 'sonicbingobot' },
    { key: 'telegram_channel_id', value: '@sonicbingo' },
    { key: 'telegram_webapp_url', value: 'https://sonic-bingo.asoeyo029.workers.dev' },
    { key: 'telegram_active_promo_button_url', value: 'https://t.me/sonicbingobot/play' }
  ];

  for (const s of settingsToUpdate) {
    await query(
      `INSERT INTO admin_settings (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [s.key, s.value]
    );
    console.log(`   ✓ Set ${s.key} = ${s.value}`);
  }

  const res = await query(`SELECT key, value, updated_at FROM admin_settings WHERE key LIKE 'telegram_%' ORDER BY key`);
  console.log('\n📊 Current Telegram Configuration in Database:');
  console.table(res.rows);

  await pool.end();
  console.log('✅ [Phase 1] Database configuration migration completed successfully.');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
