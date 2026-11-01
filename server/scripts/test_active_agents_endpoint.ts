import { query } from '../db.ts';

async function testAgents() {
  console.log('🔍 Testing Active Agents retrieval...');
  const agentsRes = await query(
    `SELECT ap.id, ap.agent_code, ap.status, 
            COALESCE(ap.telebirr_phone, u.phone) as telebirr_phone, 
            COALESCE(ap.telebirr_name, u.full_name, 'Agent') as telebirr_name, 
            COALESCE(ap.cbe_account, '1000' || SUBSTRING(COALESCE(u.phone, '0900000000') FROM 2)) as cbe_account, 
            COALESCE(ap.cbe_name, u.full_name, 'Sonic Gaming Agent') as cbe_name, 
            ap.mpesa_phone, ap.mpesa_name,
            COALESCE(ap.active_rails, 'Telebirr,CBE') as active_rails, 
            COALESCE(ap.is_online, true) as is_online, 
            ap.wallet_balance,
            u.full_name, u.phone as user_phone
     FROM agent_profiles ap
     JOIN users u ON ap.user_id = u.id
     WHERE ap.status = 'active'
       AND COALESCE(ap.is_online, true) = true
       AND ap.wallet_balance >= 50.00
     ORDER BY ap.wallet_balance DESC, ap.created_at ASC
     LIMIT 30`
  );

  const formattedAgents = agentsRes.rows.map(a => {
    const activeList = (a.active_rails || 'Telebirr,CBE').split(',').map((s: string) => s.trim());
    const supportedRails = activeList.filter((r: string) => {
      if (r === 'Telebirr') return Boolean(a.telebirr_phone);
      if (r === 'CBE') return Boolean(a.cbe_account);
      if (r === 'M-Pesa') return Boolean(a.mpesa_phone);
      return false;
    });

    return {
      id: a.id,
      agentCode: a.agent_code,
      displayName: `Sonic Agent #${a.agent_code}`,
      phone: a.telebirr_phone || a.mpesa_phone || a.user_phone || null,
      telebirrPhone: a.telebirr_phone || a.user_phone || null,
      telebirrName: a.telebirr_name || a.full_name || 'Agent',
      cbeAccount: a.cbe_account || null,
      cbeName: a.cbe_name || a.full_name || 'Sonic Gaming Agent',
      mpesaPhone: a.mpesa_phone || null,
      mpesaName: a.mpesa_name || a.full_name || 'Agent',
      supportedRails: supportedRails.length > 0 ? supportedRails : ['Telebirr', 'CBE'],
      isOnline: a.is_online !== false,
      avgApprovalMinutes: 2
    };
  }).filter(a => a.supportedRails.length > 0);

  console.log(`✅ Returned ${formattedAgents.length} Active Agents:`);
  formattedAgents.forEach(a => {
    console.log(`   - Code: ${a.agentCode} | Telebirr: ${a.telebirrPhone} | CBE: ${a.cbeAccount} | Rails: [${a.supportedRails.join(', ')}]`);
  });

  if (formattedAgents.length < 2) {
    console.error('❌ Expected at least 2 active agents!');
    process.exit(1);
  }

  console.log('🎉 ALL AGENTS VISIBILITY TEST PASSED 100%!');
  process.exit(0);
}

testAgents().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});

