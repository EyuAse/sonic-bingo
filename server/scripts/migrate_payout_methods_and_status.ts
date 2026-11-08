import { pool } from '../db.ts';

async function run() {
  console.log('🔄 Updating agent_commission_payout_requests constraints...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('ALTER TABLE agent_commission_payout_requests DROP CONSTRAINT IF EXISTS agent_commission_payout_requests_payout_method_check');
    await client.query(`ALTER TABLE agent_commission_payout_requests ADD CONSTRAINT agent_commission_payout_requests_payout_method_check CHECK (payout_method IN ('Telebirr', 'M-Pesa', 'Bank transfer', 'CBE', 'CBEBirr'))`);

    await client.query('ALTER TABLE agent_commission_payout_requests DROP CONSTRAINT IF EXISTS agent_commission_payout_requests_status_check');
    await client.query(`ALTER TABLE agent_commission_payout_requests ADD CONSTRAINT agent_commission_payout_requests_status_check CHECK (status IN ('Requested', 'Under review', 'Awaiting 2nd approval', 'Paid', 'Rejected', 'Cancelled', 'pending', 'approved', 'rejected'))`);

    await client.query('COMMIT');
    console.log('✅ Constraints successfully updated!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

run();

