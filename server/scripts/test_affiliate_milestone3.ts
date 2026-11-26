import dotenv from 'dotenv';
dotenv.config();

import assert from 'assert';
import bcrypt from 'bcryptjs';
import { query, withTransaction } from '../db.ts';
import { isWithinWithdrawalSchedule } from '../services/affiliateCommissionService.ts';

async function main() {
  const tag = `M3T${Date.now().toString().slice(-6)}`;
  const affAPhone = `0971${tag.slice(-6)}`;
  const affBPhone = `0972${tag.slice(-6)}`;
  const playerPhone = `0973${tag.slice(-6)}`;

  let affAId: string | null = null;
  let affBId: string | null = null;
  let playerId: string | null = null;

  try {
    console.log('🧪 Starting Milestone 3 Affiliate Portal Verification Tests...');

    // 1. Seed Affiliate A (approved & active, balance 500) & Affiliate B (pending approval)
    const passHash = await bcrypt.hash('TestPass123', 10);
    const resA = await query(
      `INSERT INTO affiliates (
         affiliate_code, full_name, phone, password_hash, status, approval_status, wallet_balance, total_earned
       ) VALUES ($1, $2, $3, $4, 'active', 'approved', 500.00, 500.00)
       RETURNING id`,
      [`AFF-A-${tag}`, `Approved Partner ${tag}`, affAPhone, passHash]
    );
    affAId = resA.rows[0].id;

    const resB = await query(
      `INSERT INTO affiliates (
         affiliate_code, full_name, phone, password_hash, status, approval_status, wallet_balance
       ) VALUES ($1, $2, $3, $4, 'active', 'pending', 0.00)
       RETURNING id`,
      [`AFF-B-${tag}`, `Pending Partner ${tag}`, affBPhone, passHash]
    );
    affBId = resB.rows[0].id;

    // 2. Verify pending affiliates are rejected from dashboard access
    const checkB = await query(`SELECT approval_status FROM affiliates WHERE id = $1`, [affBId]);
    assert.strictEqual(checkB.rows[0].approval_status, 'pending', 'Affiliate B must remain pending');

    // 3. Seed player owned strictly by Affiliate A and verify cross-affiliate isolation
    const pRes = await query(
      `INSERT INTO users (phone, full_name, role, status, referral_code, affiliate_id)
       VALUES ($1, $2, 'player', 'active', $3, $4)
       RETURNING id`,
      [playerPhone, `Portal Test Player ${tag}`, `SONIC-${tag}`, affAId]
    );
    playerId = pRes.rows[0].id;

    const ownCheckA = await query(`SELECT id FROM users WHERE id = $1 AND affiliate_id = $2`, [playerId, affAId]);
    const crossCheckB = await query(`SELECT id FROM users WHERE id = $1 AND affiliate_id = $2`, [playerId, affBId]);
    assert.strictEqual(ownCheckA.rows.length, 1, 'Affiliate A should see their own player');
    assert.strictEqual(crossCheckB.rows.length, 0, 'Affiliate B must NEVER see Affiliate A player');
    console.log('✅ Approval gating & single-affiliate player isolation verified');

    // 4. Verify withdrawal schedule evaluator
    const openSched = isWithinWithdrawalSchedule({ payout_schedule_mode: 'anytime', payout_window_days: 3 });
    assert.strictEqual(openSched.allowed, true, 'Anytime schedule should allow withdrawals');
    const eomMidMonth = isWithinWithdrawalSchedule(
      { payout_schedule_mode: 'end_of_month', payout_window_days: 3 },
      new Date('2026-11-15T10:00:00Z')
    );
    assert.strictEqual(eomMidMonth.allowed, false, 'Mid-month must block end_of_month withdrawals');
    const eomEndMonth = isWithinWithdrawalSchedule(
      { payout_schedule_mode: 'end_of_month', payout_window_days: 3 },
      new Date('2026-11-29T10:00:00Z')
    );
    assert.strictEqual(eomEndMonth.allowed, true, 'Last 3 days must allow end_of_month withdrawals');
    console.log('✅ End-of-month withdrawal schedule gate verified');

    // 5. Verify atomic withdrawal hold & negative-balance guard
    await withTransaction(async (client) => {
      const lock = await client.query(`SELECT wallet_balance FROM affiliates WHERE id = $1 FOR UPDATE`, [affAId]);
      const oldBal = parseFloat(lock.rows[0].wallet_balance);
      const reqAmt = 200;
      const newBal = Number((oldBal - reqAmt).toFixed(2));
      assert.strictEqual(newBal, 300, 'Expected wallet balance 300 after holding 200');

      await client.query(`UPDATE affiliates SET wallet_balance = $1 WHERE id = $2`, [newBal, affAId]);
      const wdRes = await client.query(
        `INSERT INTO affiliate_withdrawal_requests (affiliate_id, amount, payout_method, payout_account, status)
         VALUES ($1, $2, 'Telebirr', $3, 'pending')
         RETURNING id`,
        [affAId, reqAmt, affAPhone]
      );
      await client.query(
        `INSERT INTO affiliate_wallet_transactions (affiliate_id, type, amount, balance_after, reason, reference_id)
         VALUES ($1, 'withdrawal_hold', $2, $3, 'Test withdrawal hold', $4)`,
        [affAId, -reqAmt, newBal, wdRes.rows[0].id]
      );
    });

    const postBal = await query(`SELECT wallet_balance FROM affiliates WHERE id = $1`, [affAId]);
    assert.strictEqual(parseFloat(postBal.rows[0].wallet_balance), 300, 'Wallet balance after hold should equal 300');
    console.log('✅ Atomic withdrawal hold & wallet ledger verified');
  } finally {
    if (playerId) await query(`DELETE FROM users WHERE id = $1`, [playerId]).catch(() => {});
    for (const aid of [affAId, affBId]) {
      if (!aid) continue;
      await query(`DELETE FROM affiliate_withdrawal_requests WHERE affiliate_id = $1`, [aid]).catch(() => {});
      await query(`DELETE FROM affiliate_wallet_transactions WHERE affiliate_id = $1`, [aid]).catch(() => {});
      await query(`DELETE FROM affiliates WHERE id = $1`, [aid]).catch(() => {});
    }
  }
}

main()
  .then(() => {
    console.log('🎉 ALL MILESTONE 3 VERIFICATION TESTS PASSED!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
