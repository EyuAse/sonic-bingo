import { query } from '../db.ts';

async function syncAgent() {
  console.log('🔄 Syncing Agent AGT-6054 in Neon PostgreSQL...');
  const res = await query(
    `UPDATE agent_profiles 
     SET telebirr_phone = '0972565677',
         telebirr_name = 'Amanuel (Sonic Agent)',
         cbe_account = '1000972565677',
         cbe_name = 'Amanuel CBE',
         active_rails = 'Telebirr,CBE',
         is_online = true,
         updated_at = NOW()
     WHERE agent_code = 'AGT-6054'
     RETURNING id, agent_code, telebirr_phone, cbe_account, active_rails, is_online, wallet_balance`
  );

  console.log('✅ Agent AGT-6054 Sync Result:', res.rows);
  process.exit(0);
}

syncAgent().catch(err => {
  console.error('❌ Sync failed:', err);
  process.exit(1);
});

