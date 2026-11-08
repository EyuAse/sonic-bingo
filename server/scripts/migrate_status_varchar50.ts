import { query, pool } from '../db.ts';

async function main() {
  console.log('🔄 Executing Phase 1: Expanding status columns to VARCHAR(50)...');

  await query(`
    ALTER TABLE agent_recharge_requests ALTER COLUMN status TYPE VARCHAR(50);
    ALTER TABLE agent_commission_payout_requests ALTER COLUMN status TYPE VARCHAR(50);
    ALTER TABLE agent_deposit_requests ALTER COLUMN status TYPE VARCHAR(50);

    ALTER TABLE agent_commissions DROP CONSTRAINT IF EXISTS agent_commissions_source_type_check;
    ALTER TABLE agent_commissions ADD CONSTRAINT agent_commissions_source_type_check 
      CHECK (source_type IN ('deposit', 'cash_in', 'withdrawal', 'cashout_voucher', 'referral_first_deposit', 'commission_to_float', 'recharge', 'topup_commission', 'upfront_float_bonus'));
  `);
  console.log('✅ Altered status columns to VARCHAR(50) successfully!');

  // Verify the new column lengths
  const res = await query(`
    SELECT table_name, column_name, data_type, character_maximum_length 
    FROM information_schema.columns 
    WHERE table_name IN ('agent_recharge_requests', 'agent_commission_payout_requests', 'agent_deposit_requests')
      AND column_name = 'status'
  `);
  console.table(res.rows);

  await pool.end();
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
