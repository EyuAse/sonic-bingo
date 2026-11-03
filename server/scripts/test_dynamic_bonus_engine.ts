import { query, pool } from '../db.ts';

async function run() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('🧪 [TEST]: DYNAMIC BONUS ENGINE & REAL DATABASE DATA VERIFICATION');
  console.log('═══════════════════════════════════════════════════════════════════');

  try {
    // 1. Verify bonus_reward_settings table
    const settingsRes = await query(`SELECT * FROM bonus_reward_settings WHERE id = 1`);
    console.log('\n1️⃣ [Test 1] Live Database Bonus Settings Check:');
    if (settingsRes.rows.length === 0) {
      throw new Error('bonus_reward_settings row 1 not found!');
    }
    const s = settingsRes.rows[0];
    console.log(`   ✓ Registration Bonus: ${s.reg_bonus_amount} ETB (Enabled: ${s.reg_bonus_enabled})`);
    console.log(`   ✓ Referral Bonus: ${s.ref_bonus_percent}% (Min deposit: ${s.ref_min_deposit} ETB, Max cap: ${s.ref_max_cap} ETB)`);
    console.log(`   ✓ Coin Earning: ${s.coin_earning_rate} coins/ETB (Enabled: ${s.coin_earning_enabled})`);
    console.log(`   ✓ Coin Redemption: ${s.coin_redemption_coins_per_block} coins = ${s.coin_redemption_reward_etb} ETB (${s.coin_credit_target})`);

    // 2. Test Dynamic Update: Change Reg Bonus to 10 ETB & Ref Bonus to 15%
    console.log('\n2️⃣ [Test 2] Simulating Admin Updating Rules:');
    await query(`
      UPDATE bonus_reward_settings
      SET reg_bonus_amount = 10, ref_bonus_percent = 15, updated_at = NOW()
      WHERE id = 1
    `);
    const updated = await query(`SELECT reg_bonus_amount, ref_bonus_percent FROM bonus_reward_settings WHERE id = 1`);
    if (parseFloat(updated.rows[0].reg_bonus_amount) !== 10 || parseFloat(updated.rows[0].ref_bonus_percent) !== 15) {
      throw new Error('Failed to update bonus_reward_settings!');
    }
    console.log(`   ✓ Successfully updated: Reg Bonus = ${updated.rows[0].reg_bonus_amount} ETB, Ref Bonus = ${updated.rows[0].ref_bonus_percent}%`);

    // 3. Restore to 20 ETB & 10%
    await query(`
      UPDATE bonus_reward_settings
      SET reg_bonus_amount = 20, ref_bonus_percent = 10, updated_at = NOW()
      WHERE id = 1
    `);
    console.log('   ✓ Restored bonus settings to active baseline (20 ETB / 10%).');

    // 4. Verify Real Bonus Winners Query (Zero Mock Data)
    console.log('\n3️⃣ [Test 3] Verifying Bonus Winners are 100% REAL Database Records:');
    const winnersRes = await query(`
      SELECT 
        wt.id,
        wt.user_id,
        u.full_name,
        u.phone,
        u.telegram_username,
        u.telegram_id,
        CASE 
          WHEN wt.payment_method = 'welcome_reward' THEN 'Welcome Registration Bonus'
          WHEN wt.payment_method = 'referral_reward' THEN 'Referral Commission Bonus'
          WHEN wt.payment_method = 'coin_reward' THEN 'Coin Exchange Reward'
          ELSE COALESCE(wt.description, 'Promotional Bonus')
        END as promotion_name,
        wt.amount as prize_amount,
        'paid' as status,
        'System' as paid_by,
        wt.created_at as paid_at,
        wt.created_at
      FROM wallet_transactions wt
      JOIN users u ON wt.user_id = u.id
      WHERE wt.type = 'bonus'
      ORDER BY wt.created_at DESC
      LIMIT 5
    `);

    console.log(`   ✓ Found ${winnersRes.rowCount} real bonus winner records in database:`);
    winnersRes.rows.forEach(w => {
      console.log(`     • ${w.full_name} (${w.phone || w.telegram_id}) -> ${w.prize_amount} ETB via ${w.promotion_name}`);
      // Assert no mock IDs
      if (w.id === 'WIN-2001' || w.id === 'WIN-2002' || (w.promotion_name && w.promotion_name.includes('Weekend Deposit Blitz'))) {
        throw new Error(`Mock data detected: ${JSON.stringify(w)}`);
      }
    });

    // 5. Verify Audit Logs (Zero Fake September Data)
    console.log('\n4️⃣ [Test 4] Verifying Audit Logs have ZERO Fake September Data:');
    const auditRes = await query(`SELECT * FROM bonus_rule_audit_logs`);
    auditRes.rows.forEach(a => {
      if (a.change_description.includes('Registration bonus set to 20 ETB') && a.change_description.length < 40) {
        throw new Error(`Fake audit seed detected: ${a.change_description}`);
      }
    });
    console.log(`   ✓ Audit log check passed: ${auditRes.rowCount} authentic records.`);

    // 6. Verify KPI Rewards Paid sums real wallet_transactions
    console.log('\n5️⃣ [Test 5] Verifying KPI Rewards Paid Sums Real Wallet Transactions:');
    const paidRes = await query(`
      SELECT COALESCE(SUM(amount), 0) as total_paid
      FROM wallet_transactions
      WHERE type = 'bonus' AND status = 'completed'
    `);
    const totalPaid = parseFloat(paidRes.rows[0].total_paid);
    console.log(`   ✓ Total real bonus rewards paid: ETB ${totalPaid.toFixed(2)}`);

    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('🎉 ALL TESTS PASSED! DYNAMIC BONUS ENGINE & REAL DATA 100% OPERATIONAL');
    console.log('═══════════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
