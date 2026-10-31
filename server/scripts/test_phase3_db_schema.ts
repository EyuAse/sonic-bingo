import dotenv from 'dotenv';
import { query } from '../db.ts';

dotenv.config();

async function testPhase3DbSchema() {
  console.log('🧪 Verifying Phase 3 Database Schema & Mock Cleanup...');

  // 1. Verify mock players are gone
  const mockCheck = await query(`
    SELECT count(*) as count 
    FROM users 
    WHERE phone IN ('0911882201', '0922773302', '0933664403', '0944555504')
  `);
  if (parseInt(mockCheck.rows[0].count, 10) !== 0) {
    throw new Error('Mock players still exist in database!');
  }
  console.log('✅ Confirmed: 0 mock players in database.');

  // 2. Verify agent_withdrawal_requests table exists
  const tableCheck1 = await query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'agent_withdrawal_requests'
  `);
  if (tableCheck1.rows.length === 0) {
    throw new Error('agent_withdrawal_requests table was not created!');
  }
  console.log(`✅ agent_withdrawal_requests table verified with ${tableCheck1.rows.length} columns.`);

  // 3. Verify commission_balance in agent_profiles
  const colCheck = await query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'agent_profiles' AND column_name = 'commission_balance'
  `);
  if (colCheck.rows.length === 0) {
    throw new Error('commission_balance column missing in agent_profiles!');
  }
  console.log('✅ agent_profiles.commission_balance column verified.');

  // 4. Verify agent_commission_payout_requests table
  const tableCheck2 = await query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'agent_commission_payout_requests'
  `);
  if (tableCheck2.rows.length === 0) {
    throw new Error('agent_commission_payout_requests table was not created!');
  }
  console.log(`✅ agent_commission_payout_requests table verified with ${tableCheck2.rows.length} columns.`);

  console.log('🎉 --- PHASE 3 VERIFICATION PASSED 100% --- 🎉');
  process.exit(0);
}

testPhase3DbSchema().catch(err => {
  console.error('❌ Phase 3 verification failed:', err);
  process.exit(1);
});

