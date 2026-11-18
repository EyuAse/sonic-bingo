import assert from 'assert';
import { query } from '../db.ts';

async function runTests() {
  console.log('🧪 Starting Deposit Agent Loading & Resilience Test Suite...\n');

  // Test 1: Verify SQL query returns active agents with phone numbers
  console.log('▶ Test 1: Testing active agents query with user phone fallback...');
  const agentsRes = await query(
    `SELECT ap.id, ap.agent_code, ap.status, 
            ap.telebirr_phone, 
            ap.telebirr_name, 
            ap.mpesa_phone, 
            ap.mpesa_name,
            ap.active_rails, 
            COALESCE(ap.is_online, true) as is_online, 
            ap.wallet_balance,
            u.full_name, u.phone as user_phone, u.telegram_username as user_telegram
     FROM agent_profiles ap
     JOIN users u ON ap.user_id = u.id
     WHERE ap.status = 'active'
       AND COALESCE(ap.is_online, true) = true
       AND ap.wallet_balance >= 50.00
     ORDER BY ap.wallet_balance DESC, ap.created_at ASC`
  );

  assert(agentsRes.rows.length >= 1, 'At least 1 active agent must exist in database');
  console.log(`   Found ${agentsRes.rows.length} agents in DB matching criteria.`);

  // Test 2: Verify formatting logic with fallback
  console.log('\n▶ Test 2: Verifying agent formatting and payment rails fallback...');
  const formattedAgents = agentsRes.rows.map(a => {
    const activeList = (a.active_rails || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    const supportedRails: string[] = [];
    
    const rawTelebirr = (a.telebirr_phone && String(a.telebirr_phone).trim()) || (a.user_phone && String(a.user_phone).trim()) || '';
    const cleanTelebirr = rawTelebirr.replace(/\s+/g, '');
    if (cleanTelebirr.length >= 8 && (activeList.includes('Telebirr') || activeList.length === 0)) {
      supportedRails.push('Telebirr');
    }

    const rawMpesa = (a.mpesa_phone && String(a.mpesa_phone).trim()) || (a.user_phone && String(a.user_phone).trim()) || '';
    const cleanMpesa = rawMpesa.replace(/\s+/g, '');
    if (cleanMpesa.length >= 8 && activeList.includes('M-Pesa')) {
      supportedRails.push('M-Pesa');
    }

    if (supportedRails.length === 0 && cleanTelebirr.length >= 8) {
      supportedRails.push('Telebirr');
    }

    const effectiveTelebirrName = (a.telebirr_name && a.telebirr_name.trim()) || (a.full_name && a.full_name.trim()) || `Sonic Agent #${a.agent_code}`;

    return {
      id: a.id,
      agentCode: a.agent_code,
      displayName: `Sonic Agent #${a.agent_code}`,
      phone: cleanTelebirr || cleanMpesa || a.user_phone || null,
      telebirrPhone: cleanTelebirr || null,
      telebirrName: effectiveTelebirrName,
      supportedRails,
      hasConfiguredRails: supportedRails.length > 0,
      isOnline: a.is_online !== false,
      telegramUsername: a.user_telegram ? a.user_telegram.replace(/^@/, '') : 'SonicBingoAgentDemo'
    };
  });

  for (const ag of formattedAgents) {
    assert(ag.hasConfiguredRails === true, `Agent ${ag.agentCode} must have configured rails`);
    assert(ag.telebirrPhone && ag.telebirrPhone.length >= 9, `Agent ${ag.agentCode} must have valid Telebirr phone`);
    assert(ag.telebirrName && ag.telebirrName.length > 0, `Agent ${ag.agentCode} must have valid Telebirr name`);
    console.log(`   ✅ Agent #${ag.agentCode}: Name="${ag.telebirrName}", Phone="${ag.telebirrPhone}", Rails=${JSON.stringify(ag.supportedRails)}, TG=@${ag.telegramUsername}`);
  }

  // Test 3: Verify agent rotation with multiple agents
  console.log('\n▶ Test 3: Verifying exclusion rotation...');
  if (formattedAgents.length > 1) {
    const firstAgent = formattedAgents[0];
    const rotated = formattedAgents.filter(a => a.id !== firstAgent.id);
    assert(rotated.length > 0, 'Exclusion must yield an alternate candidate');
    console.log(`   ✅ Successfully rotated from #${firstAgent.agentCode} to #${rotated[0].agentCode}`);
  } else {
    console.log('   ℹ️ Single agent in pool; fallback gracefully retains agent.');
  }

  console.log('\n🎉 ALL DEPOSIT AGENT TESTS PASSED SUCCESSFULLY!\n');
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

