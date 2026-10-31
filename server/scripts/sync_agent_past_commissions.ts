import dotenv from 'dotenv';
dotenv.config();

import { query } from '../db.ts';

async function syncPastCommissions() {
  console.log('🔄 Starting Retroactive Agent Commission Synchronization...');

  try {
    // 1. Fetch all active agent profiles joined with users
    const agentsRes = await query(
      `SELECT ap.id, ap.agent_code, u.full_name, ap.wallet_balance, ap.commission_balance 
       FROM agent_profiles ap
       JOIN users u ON ap.user_id = u.id
       WHERE ap.status = 'active'`
    );

    console.log(`Found ${agentsRes.rows.length} active agent(s).`);

    for (const agent of agentsRes.rows) {
      console.log(`\n--------------------------------------------------`);
      console.log(`Agent: ${agent.full_name} (${agent.agent_code}) | ID: ${agent.id}`);
      console.log(`Current Float: ${agent.wallet_balance} ETB | Current Commission: ${agent.commission_balance} ETB`);

      // A. Sum from direct OTC deposits (agent_player_deposits)
      const otcRes = await query(
        `SELECT COALESCE(SUM(amount), 0) as total_otc, COUNT(*) as count_otc
         FROM agent_player_deposits
         WHERE agent_id = $1`,
        [agent.id]
      );
      const totalOtc = parseFloat(otcRes.rows[0].total_otc);
      const countOtc = parseInt(otcRes.rows[0].count_otc, 10);
      const otcCommission = Math.round(totalOtc * 0.05 * 100) / 100;

      // B. Sum from approved online deposit requests (agent_deposit_requests)
      const onlineDepRes = await query(
        `SELECT COALESCE(SUM(amount), 0) as total_online, COUNT(*) as count_online
         FROM agent_deposit_requests
         WHERE agent_id = $1 AND status = 'approved'`,
        [agent.id]
      );
      const totalOnline = parseFloat(onlineDepRes.rows[0].total_online);
      const countOnline = parseInt(onlineDepRes.rows[0].count_online, 10);
      const onlineCommission = Math.round(totalOnline * 0.05 * 100) / 100;

      // C. Sum from approved withdrawal payouts (agent_withdrawal_requests)
      const withRes = await query(
        `SELECT COALESCE(SUM(amount), 0) as total_with, COUNT(*) as count_with
         FROM agent_withdrawal_requests
         WHERE agent_id = $1 AND status = 'approved'`,
        [agent.id]
      );
      const totalWith = parseFloat(withRes.rows[0].total_with);
      const countWith = parseInt(withRes.rows[0].count_with, 10);
      const withCommission = Math.round(totalWith * 0.02 * 100) / 100;

      // D. Check any commission payouts / conversions already deducted
      const payoutRes = await query(
        `SELECT COALESCE(SUM(amount), 0) as total_payouts
         FROM agent_commission_payout_requests
         WHERE agent_id = $1 AND status IN ('pending', 'approved')`,
        [agent.id]
      );
      const totalPayouts = parseFloat(payoutRes.rows[0].total_payouts);

      const totalEarned = otcCommission + onlineCommission + withCommission;
      const netCommission = Math.max(0, totalEarned - totalPayouts);

      console.log(`📊 Accounting Breakdown:`);
      console.log(`   • OTC Cash-Ins: ${countOtc} transactions, ${totalOtc.toFixed(2)} ETB -> Commission (5%): +${otcCommission.toFixed(2)} ETB`);
      console.log(`   • Online Deposits: ${countOnline} requests, ${totalOnline.toFixed(2)} ETB -> Commission (5%): +${onlineCommission.toFixed(2)} ETB`);
      console.log(`   • Withdrawal Payouts: ${countWith} payouts, ${totalWith.toFixed(2)} ETB -> Commission (2%): +${withCommission.toFixed(2)} ETB`);
      console.log(`   • Cashouts / Converted: -${totalPayouts.toFixed(2)} ETB`);
      console.log(`   => Net Computed Commission: ${netCommission.toFixed(2)} ETB`);

      // Update agent commission_balance if greater than current or to netCommission
      await query(
        `UPDATE agent_profiles 
         SET commission_balance = $1, updated_at = NOW() 
         WHERE id = $2`,
        [netCommission, agent.id]
      );

      console.log(`✅ Updated Agent ${agent.agent_code} commission_balance to ${netCommission.toFixed(2)} ETB.`);
    }

    console.log('\n🎉 Retroactive Commission Synchronization Complete!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Sync failed:', err);
    process.exit(1);
  }
}

syncPastCommissions();
