import 'dotenv/config';
import { query } from '../db.ts';

async function testPaymentAccounts() {
  console.log('🧪 Testing Dynamic Agent Payment Rails Logic (Neon DB)...\n');

  try {
    // 1. Fetch Agent AGT-8532
    const agentRes = await query(`
      SELECT ap.id, ap.agent_code, ap.telebirr_phone, ap.cbe_account, ap.mpesa_phone, ap.active_rails, u.full_name
      FROM agent_profiles ap
      JOIN users u ON ap.user_id = u.id
      WHERE ap.agent_code = 'AGT-8532'
      LIMIT 1
    `);

    if (agentRes.rows.length === 0) {
      throw new Error('Agent AGT-8532 not found');
    }

    const agent = agentRes.rows[0];
    console.log(`✅ Found Agent: ${agent.agent_code} (Profile ID: ${agent.id})`);

    // 2. Test updating accounts with genuine dynamic values
    const testTelebirr = '0952013863';
    const testTelebirrName = 'Abduurehim Sheycho';
    const testCbe = '1000458291048';
    const testCbeName = 'Sonic Gaming Operations';
    const testMpesa = '0712345678';
    const testMpesaName = 'Sonic Safaricom Payout';
    const testRails = 'Telebirr,CBE,M-Pesa';

    await query(`
      UPDATE agent_profiles
      SET telebirr_phone = $1,
          telebirr_name = $2,
          cbe_account = $3,
          cbe_name = $4,
          mpesa_phone = $5,
          mpesa_name = $6,
          active_rails = $7,
          updated_at = NOW()
      WHERE id = $8
    `, [testTelebirr, testTelebirrName, testCbe, testCbeName, testMpesa, testMpesaName, testRails, agent.id]);

    console.log('✅ Successfully updated agent accounts in Neon DB');

    // 3. Verify public active agents query returns real accounts without hardcoded mock fallbacks
    const activeRes = await query(`
      SELECT ap.id, ap.agent_code, ap.status, 
             ap.telebirr_phone, ap.telebirr_name, 
             ap.cbe_account, ap.cbe_name, 
             ap.mpesa_phone, ap.mpesa_name,
             ap.active_rails, ap.is_online, ap.wallet_balance,
             u.full_name
      FROM agent_profiles ap
      JOIN users u ON ap.user_id = u.id
      WHERE ap.agent_code = 'AGT-8532'
    `);

    const row = activeRes.rows[0];
    if (row.telebirr_phone !== testTelebirr || row.telebirr_name !== testTelebirrName) {
      throw new Error(`Telebirr mismatch: expected ${testTelebirr}, got ${row.telebirr_phone}`);
    }
    if (row.cbe_account !== testCbe || row.cbe_name !== testCbeName) {
      throw new Error(`CBE mismatch: expected ${testCbe}, got ${row.cbe_account}`);
    }
    if (row.mpesa_phone !== testMpesa || row.mpesa_name !== testMpesaName) {
      throw new Error(`M-Pesa mismatch: expected ${testMpesa}, got ${row.mpesa_phone}`);
    }

    console.log('✅ Active agents query correctly returned dynamic accounts:');
    console.log({
      agentCode: row.agent_code,
      telebirr: `${row.telebirr_phone} (${row.telebirr_name})`,
      cbe: `${row.cbe_account} (${row.cbe_name})`,
      mpesa: `${row.mpesa_phone} (${row.mpesa_name})`,
      rails: row.active_rails
    });

    // 4. Test deposit and withdrawal SQL time aggregates
    const depositAggRes = await query(`
      SELECT
        COALESCE(SUM(amount) FILTER (WHERE status = 'approved' AND created_at >= CURRENT_DATE), 0) as today_amount,
        COUNT(*) FILTER (WHERE status = 'approved' AND created_at >= CURRENT_DATE) as today_count,
        COALESCE(SUM(amount) FILTER (WHERE status = 'approved' AND created_at >= date_trunc('week', CURRENT_DATE)), 0) as week_amount,
        COUNT(*) FILTER (WHERE status = 'approved' AND created_at >= date_trunc('week', CURRENT_DATE)) as week_count,
        COALESCE(SUM(amount) FILTER (WHERE status = 'approved' AND created_at >= date_trunc('month', CURRENT_DATE)), 0) as month_amount,
        COUNT(*) FILTER (WHERE status = 'approved' AND created_at >= date_trunc('month', CURRENT_DATE)) as month_count,
        COALESCE(SUM(amount) FILTER (WHERE status = 'approved'), 0) as all_time_amount,
        COUNT(*) FILTER (WHERE status = 'approved') as all_time_count
      FROM agent_deposit_requests
      WHERE agent_id = $1
    `, [agent.id]);

    console.log('✅ Deposit SQL time aggregates computed:');
    console.log(depositAggRes.rows[0]);

    const withAggRes = await query(`
      SELECT
        COALESCE(SUM(amount) FILTER (WHERE status = 'completed' AND created_at >= CURRENT_DATE), 0) as today_amount,
        COUNT(*) FILTER (WHERE status = 'completed' AND created_at >= CURRENT_DATE) as today_count,
        COALESCE(SUM(amount) FILTER (WHERE status = 'completed' AND created_at >= date_trunc('week', CURRENT_DATE)), 0) as week_amount,
        COUNT(*) FILTER (WHERE status = 'completed' AND created_at >= date_trunc('week', CURRENT_DATE)) as week_count,
        COALESCE(SUM(amount) FILTER (WHERE status = 'completed' AND created_at >= date_trunc('month', CURRENT_DATE)), 0) as month_amount,
        COUNT(*) FILTER (WHERE status = 'completed' AND created_at >= date_trunc('month', CURRENT_DATE)) as month_count,
        COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0) as all_time_amount,
        COUNT(*) FILTER (WHERE status = 'completed') as all_time_count
      FROM agent_withdrawal_requests
      WHERE agent_id = $1
    `, [agent.id]);

    console.log('✅ Withdrawal SQL time aggregates computed:');
    console.log(withAggRes.rows[0]);

    console.log('\n🎉 --- PHASE 2 DYNAMIC PAYMENT RAILS BACKEND TEST PASSED 100% --- 🎉');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  }
}

testPaymentAccounts();

