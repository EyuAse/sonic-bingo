import dotenv from 'dotenv';
dotenv.config();

import assert from 'assert';
import crypto from 'crypto';
import { query } from '../db.ts';
import {
  triggerRegistrationCommission,
  triggerDepositCommission,
  triggerTargetCommissionIfReached
} from '../services/affiliateCommissionService.ts';

async function main() {
  const tag = `M2T${Date.now().toString().slice(-6)}`;
  const affCode = `AFF-${tag}`;
  const affPhone = `0999${tag.slice(-6)}`;
  const playerPhone = `0988${tag.slice(-6)}`;
  const linkToken = `TOK-${tag}`;

  let affiliateId: string | null = null;
  let linkId: string | null = null;
  let playerId: string | null = null;

  try {
    console.log('🧪 Starting Milestone 2 Affiliate Commission & Attribution Tests...');

    // 1. Seed temporary invite link & approved affiliate (monthly_target_override = 1 so target triggers on 1st player)
    const linkRes = await query(
      `INSERT INTO affiliate_registration_links (token, label, max_uses, requires_approval, is_active)
       VALUES ($1, 'Milestone 2 Auto Test', 5, TRUE, TRUE)
       RETURNING id`,
      [linkToken]
    );
    linkId = linkRes.rows[0].id;

    const affRes = await query(
      `INSERT INTO affiliates (
         affiliate_code, full_name, phone, password_hash, status, approval_status, monthly_target_override, invited_by_token
       ) VALUES ($1, $2, $3, 'hash_placeholder', 'active', 'approved', 1, $4)
       RETURNING id`,
      [affCode, `Test Partner ${tag}`, affPhone, linkToken]
    );
    affiliateId = affRes.rows[0].id;
    assert(affiliateId, 'Affiliate should be created');

    // 2. Seed synthetic player bound to affiliateId (mirrors attribute-player endpoint)
    const playerRes = await query(
      `INSERT INTO users (phone, full_name, role, status, referral_code, affiliate_id)
       VALUES ($1, $2, 'player', 'active', $3, $4)
       RETURNING id`,
      [playerPhone, `Test Player ${tag}`, `SONIC-${tag}`, affiliateId]
    );
    playerId = playerRes.rows[0].id;
    assert(playerId, 'Player should be created');

    // 3. Test Registration Commission + Target Trigger + Idempotency
    await triggerRegistrationCommission(playerId, affiliateId);
    await triggerRegistrationCommission(playerId, affiliateId); // duplicate call must be no-op
    await triggerTargetCommissionIfReached(affiliateId); // duplicate target check must be no-op

    const regComms = await query(
      `SELECT commission_type, amount FROM affiliate_commissions
       WHERE affiliate_id = $1 AND commission_type IN ('registration', 'target')`,
      [affiliateId]
    );
    const regCount = regComms.rows.filter(r => r.commission_type === 'registration').length;
    const targetCount = regComms.rows.filter(r => r.commission_type === 'target').length;
    assert.strictEqual(regCount, 1, 'Expected exactly 1 registration commission (idempotent)');
    assert.strictEqual(targetCount, 1, 'Expected exactly 1 target commission (once per month)');
    console.log('✅ Registration commission + Target bonus idempotency verified');

    // 4. Test First Deposit below threshold (ETB 300 <= 500) -> should NOT award first_deposit
    const belowRes = await triggerDepositCommission(playerId, 300, `REF-SMALL-${tag}`);
    assert.strictEqual(belowRes, null, 'Deposit <= 500 ETB must not qualify for first_deposit bonus');

    // 5. Test First Qualifying Deposit (ETB 600 > 500) -> 6% = ETB 36
    const firstDep = await triggerDepositCommission(playerId, 600, `REF-FIRST-${tag}`);
    assert(firstDep && Math.abs(firstDep.amount - 36) < 0.01, `Expected ETB 36.00 first deposit commission, got ${firstDep?.amount}`);

    // Duplicate deposit_ref_id must be no-op
    const dupFirst = await triggerDepositCommission(playerId, 600, `REF-FIRST-${tag}`);
    assert.strictEqual(dupFirst, null, 'Duplicate deposit_ref_id must not double-credit commission');

    // 6. Test Regular Subsequent Deposit (ETB 500) -> 2% = ETB 10
    const regDep = await triggerDepositCommission(playerId, 500, `REF-REG-${tag}`);
    assert(regDep && Math.abs(regDep.amount - 10) < 0.01, `Expected ETB 10.00 regular deposit commission, got ${regDep?.amount}`);
    console.log('✅ First Deposit (6% > 500 ETB), Regular Deposit (2%), and Ref Idempotency verified');

    // 7. Verify wallet / pending totals match ledger cleanly
    const finalAff = await query(
      `SELECT wallet_balance, pending_commission, total_earned FROM affiliates WHERE id = $1`,
      [affiliateId]
    );
    const sumRes = await query(
      `SELECT
         COALESCE(SUM(amount) FILTER (WHERE status = 'approved'), 0) as app_sum,
         COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0) as pend_sum
       FROM affiliate_commissions WHERE affiliate_id = $1`,
      [affiliateId]
    );
    const aRow = finalAff.rows[0];
    const sRow = sumRes.rows[0];
    assert(
      Math.abs(parseFloat(aRow.wallet_balance) - parseFloat(sRow.app_sum)) < 0.01,
      `Affiliate wallet (${aRow.wallet_balance}) should match approved sum (${sRow.app_sum})`
    );
    assert(
      Math.abs(parseFloat(aRow.pending_commission) - parseFloat(sRow.pend_sum)) < 0.01,
      `Affiliate pending (${aRow.pending_commission}) should match pending sum (${sRow.pend_sum})`
    );
    console.log('✅ Wallet balance & pending commission ledger invariants passed!');
  } finally {
    // Clean up all synthetic test artifacts so Neon DB stays clean
    if (playerId) await query(`DELETE FROM users WHERE id = $1`, [playerId]).catch(() => {});
    if (affiliateId) {
      await query(`DELETE FROM affiliate_wallet_transactions WHERE affiliate_id = $1`, [affiliateId]).catch(() => {});
      await query(`DELETE FROM affiliate_commissions WHERE affiliate_id = $1`, [affiliateId]).catch(() => {});
      await query(`DELETE FROM affiliates WHERE id = $1`, [affiliateId]).catch(() => {});
    }
    if (linkId) await query(`DELETE FROM affiliate_registration_links WHERE id = $1`, [linkId]).catch(() => {});
    void crypto;
  }
}

main()
  .then(() => {
    console.log('🎉 ALL MILESTONE 2 VERIFICATION TESTS PASSED!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
