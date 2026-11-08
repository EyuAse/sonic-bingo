import { query, pool } from '../db.ts';

async function main() {
  console.log('🔄 Updating database settings for Jackpot & Commission alignment...');

  const settings: [string, string][] = [
    ['jackpot_percentage', '2.40'],
    ['winner_payout_percent', '77.60'],
    ['house_commission_percent', '20.00'],
    ['agent_low_balance_warning', '5000.00'],
    ['welcome_bonus_amount', '50.00'],
    ['lobby_time_seconds', '40'],
    ['max_cartelas_per_player', '4'] // Strictly 4 cartelas per user request
  ];

  for (const [k, v] of settings) {
    await query(
      `INSERT INTO admin_settings (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [k, v]
    );
    console.log(`✅ Set ${k} = ${v}`);
  }

  const res = await query(`
    SELECT key, value 
    FROM admin_settings 
    WHERE key IN ('jackpot_percentage', 'winner_payout_percent', 'house_commission_percent', 'agent_low_balance_warning', 'welcome_bonus_amount', 'lobby_time_seconds', 'max_cartelas_per_player')
    ORDER BY key
  `);
  console.table(res.rows);

  await pool.end();
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error updating settings:', err);
  process.exit(1);
});
