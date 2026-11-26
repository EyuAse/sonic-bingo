import { query, withTransaction } from '../db.ts';

export type AffiliateCommissionType =
  | 'registration'
  | 'first_deposit'
  | 'regular_deposit'
  | 'target'
  | 'monthly'
  | 'loyalty';

export interface AdminActor {
  id?: string;
  fullName?: string;
}

type QueryRunner = (text: string, params?: any[]) => Promise<{ rows: any[] }>;

/**
 * Records an immutable audit trail entry for admin affiliate rule, wallet, or status changes.
 */
export async function logAffiliateAudit(
  runner: QueryRunner,
  actor: AdminActor,
  action: string,
  targetType: string,
  targetId: string,
  oldValue: unknown,
  newValue: unknown,
  reason?: string
): Promise<void> {
  await runner(
    `INSERT INTO affiliate_audit_logs (admin_id, admin_name, action, target_type, target_id, old_value, new_value, reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      actor.id || null,
      actor.fullName || 'Super Admin',
      action,
      targetType,
      targetId,
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null,
      reason || null
    ]
  );
}

/**
 * Checks whether the current date falls within the Admin-configured withdrawal schedule.
 */
export function isWithinWithdrawalSchedule(
  settings: { payout_schedule_mode: string; payout_window_days: number },
  now: Date = new Date()
): { allowed: boolean; nextWindowLabel: string } {
  if (settings.payout_schedule_mode === 'anytime') {
    return { allowed: true, nextWindowLabel: 'Open Anytime' };
  }

  const windowDays = Math.max(1, Math.min(15, Number(settings.payout_window_days || 3)));
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstOpenDay = Math.max(1, daysInMonth - windowDays + 1);
  const currentDay = now.getDate();

  const monthName = now.toLocaleString('en-US', { month: 'short' });
  const label = `${monthName} ${firstOpenDay}–${daysInMonth}`;

  return {
    allowed: currentDay >= firstOpenDay,
    nextWindowLabel: label
  };
}

/**
 * Approves a pending commission and moves funds into the affiliate's available wallet balance.
 */
export async function approveCommission(commissionId: string, actor: AdminActor, note?: string) {
  return withTransaction(async (client) => {
    const commRes = await client.query(
      `SELECT * FROM affiliate_commissions WHERE id = $1 FOR UPDATE`,
      [commissionId]
    );
    if (commRes.rows.length === 0) {
      throw new Error('Commission record not found');
    }
    const comm = commRes.rows[0];
    if (comm.status !== 'pending') {
      throw new Error(`Commission is already ${comm.status}`);
    }

    const affRes = await client.query(
      `SELECT id, wallet_balance, pending_commission, total_earned FROM affiliates WHERE id = $1 FOR UPDATE`,
      [comm.affiliate_id]
    );
    if (affRes.rows.length === 0) {
      throw new Error('Affiliate account not found');
    }
    const aff = affRes.rows[0];
    const amt = parseFloat(comm.amount || '0');
    const newWallet = Number((parseFloat(aff.wallet_balance || '0') + amt).toFixed(2));
    const newPending = Number(Math.max(0, parseFloat(aff.pending_commission || '0') - amt).toFixed(2));
    const newEarned = Number((parseFloat(aff.total_earned || '0') + amt).toFixed(2));

    await client.query(
      `UPDATE affiliates
       SET wallet_balance = $1, pending_commission = $2, total_earned = $3, updated_at = NOW()
       WHERE id = $4`,
      [newWallet, newPending, newEarned, aff.id]
    );

    await client.query(
      `UPDATE affiliate_commissions
       SET status = 'approved', reviewed_by = $1, reviewed_at = NOW(), note = COALESCE($2, note)
       WHERE id = $3`,
      [actor.id || null, note || null, commissionId]
    );

    await client.query(
      `INSERT INTO affiliate_wallet_transactions (affiliate_id, type, amount, balance_after, reason, reference_id, performed_by)
       VALUES ($1, 'commission_approved', $2, $3, $4, $5, $6)`,
      [
        aff.id,
        amt,
        newWallet,
        note || `Approved ${comm.commission_type} commission`,
        commissionId,
        actor.id || null
      ]
    );

    await logAffiliateAudit(
      client.query.bind(client),
      actor,
      'COMMISSION_APPROVED',
      'affiliate_commission',
      commissionId,
      { status: 'pending', amount: amt },
      { status: 'approved', walletBalance: newWallet },
      note
    );

    return { commissionId, affiliateId: aff.id, amount: amt, walletBalance: newWallet };
  });
}

/**
 * Rejects a pending commission and removes it from pending balance.
 */
export async function rejectCommission(commissionId: string, actor: AdminActor, reason: string) {
  return withTransaction(async (client) => {
    const commRes = await client.query(
      `SELECT * FROM affiliate_commissions WHERE id = $1 FOR UPDATE`,
      [commissionId]
    );
    if (commRes.rows.length === 0) throw new Error('Commission record not found');
    const comm = commRes.rows[0];
    if (comm.status !== 'pending') throw new Error(`Commission is already ${comm.status}`);

    const affRes = await client.query(
      `SELECT id, pending_commission FROM affiliates WHERE id = $1 FOR UPDATE`,
      [comm.affiliate_id]
    );
    const aff = affRes.rows[0];
    const amt = parseFloat(comm.amount || '0');
    const newPending = Number(Math.max(0, parseFloat(aff?.pending_commission || '0') - amt).toFixed(2));

    await client.query(
      `UPDATE affiliates SET pending_commission = $1, updated_at = NOW() WHERE id = $2`,
      [newPending, comm.affiliate_id]
    );

    await client.query(
      `UPDATE affiliate_commissions
       SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW(), note = $2
       WHERE id = $3`,
      [actor.id || null, reason, commissionId]
    );

    await logAffiliateAudit(
      client.query.bind(client),
      actor,
      'COMMISSION_REJECTED',
      'affiliate_commission',
      commissionId,
      { status: 'pending', amount: amt },
      { status: 'rejected', pendingCommission: newPending },
      reason
    );

    return { commissionId, status: 'rejected' };
  });
}

/**
 * Reverses a pending or approved commission (e.g. fraudulent/reversed deposit) with full ledger & audit trail.
 */
export async function reverseCommission(commissionId: string, actor: AdminActor, reason: string) {
  const cleanReason = String(reason || '').trim();
  if (!cleanReason) {
    throw new Error('A reversal reason is required');
  }

  return withTransaction(async (client) => {
    const commRes = await client.query(
      `SELECT * FROM affiliate_commissions WHERE id = $1 FOR UPDATE`,
      [commissionId]
    );
    if (commRes.rows.length === 0) throw new Error('Commission record not found');
    const comm = commRes.rows[0];
    if (comm.status === 'reversed' || comm.status === 'rejected') {
      throw new Error(`Commission is already ${comm.status}`);
    }

    const affRes = await client.query(
      `SELECT id, wallet_balance, pending_commission, total_earned FROM affiliates WHERE id = $1 FOR UPDATE`,
      [comm.affiliate_id]
    );
    const aff = affRes.rows[0];
    const amt = parseFloat(comm.amount || '0');
    let newWallet = parseFloat(aff.wallet_balance || '0');
    let newPending = parseFloat(aff.pending_commission || '0');
    let newEarned = parseFloat(aff.total_earned || '0');

    if (comm.status === 'pending') {
      newPending = Number(Math.max(0, newPending - amt).toFixed(2));
    } else if (comm.status === 'approved') {
      if (newWallet < amt) {
        throw new Error(`Cannot reverse ETB ${amt.toFixed(2)}: affiliate wallet balance is only ETB ${newWallet.toFixed(2)}`);
      }
      newWallet = Number((newWallet - amt).toFixed(2));
      newEarned = Number(Math.max(0, newEarned - amt).toFixed(2));

      await client.query(
        `INSERT INTO affiliate_wallet_transactions (affiliate_id, type, amount, balance_after, reason, reference_id, performed_by)
         VALUES ($1, 'reversal_debit', $2, $3, $4, $5, $6)`,
        [aff.id, -amt, newWallet, cleanReason, commissionId, actor.id || null]
      );
    }

    await client.query(
      `UPDATE affiliates
       SET wallet_balance = $1, pending_commission = $2, total_earned = $3, updated_at = NOW()
       WHERE id = $4`,
      [newWallet, newPending, newEarned, aff.id]
    );

    await client.query(
      `UPDATE affiliate_commissions
       SET status = 'reversed', reversed_by = $1, reversed_at = NOW(), note = $2
       WHERE id = $3`,
      [actor.id || null, cleanReason, commissionId]
    );

    await logAffiliateAudit(
      client.query.bind(client),
      actor,
      'COMMISSION_REVERSED',
      'affiliate_commission',
      commissionId,
      { status: comm.status, amount: amt },
      { status: 'reversed', walletBalance: newWallet, pendingCommission: newPending },
      cleanReason
    );

    return { commissionId, affiliateId: aff.id, walletBalance: newWallet, status: 'reversed' };
  });
}

/**
 * Manual admin wallet recharge, credit, or debit with mandatory reason and immutable ledger entry.
 */
export async function adjustAffiliateWallet(
  affiliateId: string,
  mode: 'recharge' | 'credit' | 'debit',
  rawAmount: number,
  reason: string,
  actor: AdminActor
) {
  const amount = Number(Number(rawAmount).toFixed(2));
  const cleanReason = String(reason || '').trim();

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Amount must be greater than 0');
  }
  if (!cleanReason) {
    throw new Error('A reason is required for wallet adjustments');
  }

  return withTransaction(async (client) => {
    const affRes = await client.query(
      `SELECT id, full_name, wallet_balance FROM affiliates WHERE id = $1 FOR UPDATE`,
      [affiliateId]
    );
    if (affRes.rows.length === 0) {
      throw new Error('Affiliate not found');
    }

    const oldBal = parseFloat(affRes.rows[0].wallet_balance || '0');
    const signedDelta = mode === 'debit' ? -amount : amount;
    const newBal = Number((oldBal + signedDelta).toFixed(2));

    if (newBal < 0) {
      throw new Error(`Insufficient wallet balance (Available: ETB ${oldBal.toFixed(2)})`);
    }

    await client.query(
      `UPDATE affiliates SET wallet_balance = $1, updated_at = NOW() WHERE id = $2`,
      [newBal, affiliateId]
    );

    const txType = mode === 'recharge' ? 'recharge' : mode === 'credit' ? 'manual_credit' : 'manual_debit';
    await client.query(
      `INSERT INTO affiliate_wallet_transactions (affiliate_id, type, amount, balance_after, reason, performed_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [affiliateId, txType, signedDelta, newBal, cleanReason, actor.id || null]
    );

    await logAffiliateAudit(
      client.query.bind(client),
      actor,
      `WALLET_${mode.toUpperCase()}`,
      'affiliate',
      affiliateId,
      { walletBalance: oldBal },
      { walletBalance: newBal },
      cleanReason
    );

    return { affiliateId, oldBalance: oldBal, newBalance: newBal, amount: signedDelta };
  });
}

/**
 * Runs idempotent monthly commission calculations for Monthly (2%) and Loyalty (1%) rules
 * across active referred players (deposited within the rule's active_window_days).
 */
export async function runPeriodicCommissions(periodMonth: string, actor: AdminActor) {
  if (!/^\d{4}-\d{2}$/.test(periodMonth)) {
    throw new Error('periodMonth must follow YYYY-MM format');
  }

  const [yearStr, monthStr] = periodMonth.split('-');
  const monthStart = new Date(Date.UTC(Number(yearStr), Number(monthStr) - 1, 1, 0, 0, 0));
  const monthEnd = new Date(Date.UTC(Number(yearStr), Number(monthStr), 1, 0, 0, 0));

  const rulesRes = await query(
    `SELECT * FROM affiliate_commission_rules WHERE commission_type IN ('monthly', 'loyalty') AND is_active = TRUE`
  );
  if (rulesRes.rows.length === 0) {
    return { periodMonth, createdCount: 0, totalAmount: 0 };
  }

  let createdCount = 0;
  let totalAmount = 0;

  for (const rule of rulesRes.rows) {
    const activeWindowDays = Math.max(1, parseInt(rule.active_window_days || '14', 10));
    const minDeposit = parseFloat(rule.min_qualifying_deposit || '0');
    const rateVal = parseFloat(rule.rate_or_amount || '0');
    if (rateVal <= 0) continue;

    // Retention clause for 'loyalty': player registered before this month started
    const retentionFilter = rule.commission_type === 'loyalty' ? 'AND u.created_at < $1' : '';

    const eligibleRes = await query(
      `WITH player_month_deposits AS (
         SELECT
           u.id as player_id,
           u.affiliate_id,
           u.created_at as player_joined_at,
           COALESCE(SUM(dep.amount), 0) as month_deposit_sum,
           MAX(dep.approved_at) as last_deposit_at
         FROM users u
         JOIN (
           SELECT user_id as uid, amount, COALESCE(reviewed_at, created_at) as approved_at
           FROM deposit_requests
           WHERE status = 'approved'
           UNION ALL
           SELECT player_id as uid, amount, COALESCE(resolved_at, created_at) as approved_at
           FROM agent_deposit_requests
           WHERE status = 'approved'
         ) dep ON dep.uid = u.id
         JOIN affiliates a ON u.affiliate_id = a.id
         WHERE u.affiliate_id IS NOT NULL
           AND a.status = 'active'
           AND a.approval_status = 'approved'
           AND dep.approved_at >= $1 AND dep.approved_at < $2
           ${retentionFilter}
         GROUP BY u.id, u.affiliate_id, u.created_at
       )
       SELECT *
       FROM player_month_deposits
       WHERE month_deposit_sum >= $3
         AND last_deposit_at >= NOW() - ($4::int * INTERVAL '1 day')`,
      [monthStart.toISOString(), monthEnd.toISOString(), minDeposit, activeWindowDays]
    );

    for (const row of eligibleRes.rows) {
      const baseAmount = parseFloat(row.month_deposit_sum || '0');
      const calcAmt =
        rule.calc_mode === 'fixed'
          ? Number(rateVal.toFixed(2))
          : Number(((baseAmount * rateVal) / 100).toFixed(2));
      if (calcAmt <= 0) continue;

      const inserted = await withTransaction(async (client) => {
        const dup = await client.query(
          `SELECT id FROM affiliate_commissions
           WHERE affiliate_id = $1 AND player_user_id = $2 AND commission_type = $3 AND period_month = $4
             AND status <> 'reversed'
           LIMIT 1`,
          [row.affiliate_id, row.player_id, rule.commission_type, periodMonth]
        );
        if (dup.rows.length > 0) return false;

        const initialStatus = rule.auto_approve ? 'approved' : 'pending';
        const commInsert = await client.query(
          `INSERT INTO affiliate_commissions (
             affiliate_id, player_user_id, commission_type, rule_version, calc_mode,
             base_amount, rate_applied, amount, status, period_month, note, reviewed_by, reviewed_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           RETURNING id`,
          [
            row.affiliate_id,
            row.player_id,
            rule.commission_type,
            rule.version,
            rule.calc_mode,
            baseAmount,
            rateVal,
            calcAmt,
            initialStatus,
            periodMonth,
            `${rule.display_name} (${periodMonth})`,
            rule.auto_approve ? (actor.id || null) : null,
            rule.auto_approve ? new Date() : null
          ]
        );

        const commId = commInsert.rows[0].id;
        if (rule.auto_approve) {
          const affRes = await client.query(
            `UPDATE affiliates
             SET wallet_balance = wallet_balance + $1, total_earned = total_earned + $1, updated_at = NOW()
             WHERE id = $2
             RETURNING wallet_balance`,
            [calcAmt, row.affiliate_id]
          );
          await client.query(
            `INSERT INTO affiliate_wallet_transactions (affiliate_id, type, amount, balance_after, reason, reference_id, performed_by)
             VALUES ($1, 'commission_approved', $2, $3, $4, $5, $6)`,
            [
              row.affiliate_id,
              calcAmt,
              parseFloat(affRes.rows[0].wallet_balance || '0'),
              `${rule.display_name} (${periodMonth})`,
              commId,
              actor.id || null
            ]
          );
        } else {
          await client.query(
            `UPDATE affiliates SET pending_commission = pending_commission + $1, updated_at = NOW() WHERE id = $2`,
            [calcAmt, row.affiliate_id]
          );
        }

        return true;
      });

      if (inserted) {
        createdCount++;
        totalAmount = Number((totalAmount + calcAmt).toFixed(2));
      }
    }
  }

  await logAffiliateAudit(
    query,
    actor,
    'RUN_PERIODIC_COMMISSIONS',
    'affiliate_commissions',
    periodMonth,
    null,
    { periodMonth, createdCount, totalAmount },
    `Monthly batch run for ${periodMonth}`
  );

  return { periodMonth, createdCount, totalAmount };
}
