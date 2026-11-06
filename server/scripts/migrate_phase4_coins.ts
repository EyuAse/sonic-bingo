import { query } from '../db.ts';

async function main() {
  console.log('⚡ Migrating coin_transactions check constraint and bonus_reward_settings...');

  // 1. Update check constraint on coin_transactions
  await query(`ALTER TABLE coin_transactions DROP CONSTRAINT IF EXISTS coin_transactions_type_check`);
  await query(`
    ALTER TABLE coin_transactions ADD CONSTRAINT coin_transactions_type_check 
      CHECK (type IN ('earned_deposit', 'earned_gameplay', 'redeemed_bonus', 'admin_adjustment'))
  `);
  console.log('✅ Updated coin_transactions_type_check constraint with earned_gameplay');

  // 2. Update bonus_reward_settings
  await query(`
    UPDATE bonus_reward_settings 
    SET coin_earning_rate = 1.50,
        coin_redemption_coins_per_block = 1000,
        coin_redemption_reward_etb = 20.00,
        coin_redemption_min_coins = 1000,
        coin_credit_target = 'Bonus wallet',
        updated_at = NOW()
    WHERE id = 1
  `);
  console.log('✅ Updated bonus_reward_settings: rate=1.5x, 1000 coins = 20 ETB, target=Bonus wallet');

  // Verify
  const settings = await query('SELECT * FROM bonus_reward_settings WHERE id = 1');
  console.log('Current settings:', settings.rows[0]);

  process.exit(0);
}

main().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});

