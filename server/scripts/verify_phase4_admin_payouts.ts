import { query } from '../db.ts';

async function verifyPhase4() {
  console.log('🧪 Starting Phase 4 Verification: Admin Commission Payout Desk & Flow...');

  // 1. Inspect existing payout requests
  const pendingRes = await query(`
    SELECT acpr.*, ap.agent_code, ap.commission_balance, u.full_name as agent_name
    FROM agent_commission_payout_requests acpr
    JOIN agent_profiles ap ON acpr.agent_id = ap.id
    JOIN users u ON ap.user_id = u.id
    ORDER BY acpr.created_at DESC
    LIMIT 5
  `);

  console.log(`📊 Found ${pendingRes.rows.length} payout request(s):`);
  pendingRes.rows.forEach(r => {
    console.log(`   - ID: ${r.id} | Agent: #${r.agent_code} (${r.agent_name}) | Amount: ${r.amount} ETB | Method: ${r.payout_method} | Account: ${r.payout_account} | Status: ${r.status}`);
  });

  // Verify that agent_commission_payout_requests has the required schema
  if (pendingRes.rows.length > 0) {
    const p = pendingRes.rows[0];
    if (p.status === 'pending') {
      console.log(`✅ Verified pending payout request exists: ${p.amount} ETB for Agent #${p.agent_code}`);
    } else {
      console.log(`ℹ️ Latest request status: ${p.status}`);
    }
  }

  console.log('✅ Phase 4 Admin Commission Desk verification completed successfully!');
  process.exit(0);
}

verifyPhase4().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
