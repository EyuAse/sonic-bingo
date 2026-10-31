import dotenv from 'dotenv';
dotenv.config();

import { query } from '../db.ts';

async function testPhase2Ledger() {
  console.log('🧪 Running Phase 2 Test: Unified Real-Time Statements & ACID Ledger Backend...\n');

  try {
    // 1. Fetch Agent AGT-8532
    const agentRes = await query(
      `SELECT ap.id, ap.agent_code 
       FROM agent_profiles ap 
       WHERE ap.agent_code = 'AGT-8532' LIMIT 1`
    );
    if (agentRes.rows.length === 0) {
      throw new Error('Agent AGT-8532 not found');
    }
    const agentId = agentRes.rows[0].id;
    console.log(`✅ Using Agent ID: ${agentId} (${agentRes.rows[0].agent_code})`);

    // 2. Run the unified queries
    const [depositsRes, withdrawalsRes, redemptionsRes] = await Promise.all([
      query(
        `SELECT apd.id, 'cash_in' as type, apd.amount, apd.payment_method, apd.reference_code,
                ROUND(apd.amount * 0.05, 2) as agent_commission_earned,
                apd.agent_balance_after, apd.created_at,
                u.full_name as player_name, 
                COALESCE(u.phone, u.telegram_username, 'Player') as player_phone
         FROM agent_player_deposits apd
         JOIN users u ON apd.player_user_id = u.id
         WHERE apd.agent_id = $1
         ORDER BY apd.created_at DESC
         LIMIT 60`,
        [agentId]
      ),
      query(
        `SELECT awr.id, 'cash_out' as type, awr.amount, awr.payout_method as payment_method,
                COALESCE(awr.agent_tx_ref, 'TX-WITH') as reference_code,
                COALESCE(awr.agent_commission_earned, ROUND(awr.amount * 0.02, 2)) as agent_commission_earned,
                awr.agent_balance_after,
                COALESCE(awr.resolved_at, awr.created_at) as created_at,
                u.full_name as player_name,
                COALESCE(u.phone, u.telegram_username, 'Player') as player_phone
         FROM agent_withdrawal_requests awr
         JOIN users u ON awr.player_id = u.id
         WHERE awr.agent_id = $1 AND awr.status = 'approved'
         ORDER BY awr.created_at DESC
         LIMIT 60`,
        [agentId]
      ),
      query(
        `SELECT v.id, 'cash_out' as type, v.amount, 'Cash Counter' as payment_method,
                v.voucher_code as reference_code, 
                COALESCE(v.agent_commission_earned, ROUND(v.amount * 0.015, 2)) as agent_commission_earned,
                NULL as agent_balance_after,
                v.redeemed_at as created_at,
                u.full_name as player_name, 
                COALESCE(u.phone, u.telegram_username, 'Player') as player_phone
         FROM agent_cashout_vouchers v
         JOIN users u ON v.user_id = u.id
         WHERE v.redeemed_by_agent_id = $1 AND v.status = 'redeemed'
         ORDER BY v.redeemed_at DESC
         LIMIT 60`,
        [agentId]
      )
    ]);

    const formattedDeposits = depositsRes.rows.map(r => ({
      ...r,
      amount: parseFloat(r.amount),
      agent_commission_earned: parseFloat(r.agent_commission_earned || '0')
    }));

    const formattedWithdrawals = withdrawalsRes.rows.map(r => ({
      ...r,
      amount: parseFloat(r.amount),
      agent_commission_earned: parseFloat(r.agent_commission_earned || '0')
    }));

    const formattedVouchers = redemptionsRes.rows.map(r => ({
      ...r,
      amount: parseFloat(r.amount),
      agent_commission_earned: parseFloat(r.agent_commission_earned || '0')
    }));

    const combined = [...formattedDeposits, ...formattedWithdrawals, ...formattedVouchers]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    console.log(`📊 Ledger Breakdown for Agent AGT-8532:`);
    console.log(`   • Cash-In Deposits: ${formattedDeposits.length} transactions`);
    formattedDeposits.forEach(d => {
      console.log(`     -> ${d.reference_code}: ${d.amount} ETB | Comm: +${d.agent_commission_earned} ETB | Player: ${d.player_name} (${d.player_phone})`);
    });

    console.log(`   • Withdrawal Payouts: ${formattedWithdrawals.length} transactions`);
    console.log(`   • Voucher Cashouts: ${formattedVouchers.length} transactions`);

    const totalCashIn = formattedDeposits.reduce((sum, t) => sum + t.amount, 0);
    const totalCashOut = [...formattedWithdrawals, ...formattedVouchers].reduce((sum, t) => sum + t.amount, 0);
    const totalCommission = combined.reduce((sum, t) => sum + (t.agent_commission_earned || 0), 0);

    console.log(`\n📈 Summary Totals:`);
    console.log(`   • Total Cash-In Volume: ${totalCashIn.toFixed(2)} ETB`);
    console.log(`   • Total Cash-Out Paid: ${totalCashOut.toFixed(2)} ETB`);
    console.log(`   • Total Commission Earned: +${totalCommission.toFixed(2)} ETB`);

    if (formattedDeposits.length === 0) {
      throw new Error('Expected at least 1 deposit in ledger');
    }
    if (totalCommission <= 0) {
      throw new Error('Total commission should be greater than 0');
    }

    console.log('\n🎉 --- PHASE 2 TEST PASSED 100% --- 🎉');
    process.exit(0);
  } catch (err) {
    console.error('❌ Phase 2 test failed:', err);
    process.exit(1);
  }
}

testPhase2Ledger();
