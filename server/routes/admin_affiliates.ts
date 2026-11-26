import { Router, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, withTransaction } from '../db.ts';
import { requireAdmin, AuthenticatedRequest } from '../middleware/auth.ts';
import {
  adjustAffiliateWallet,
  approveCommission,
  logAffiliateAudit,
  rejectCommission,
  reverseCommission,
  runPeriodicCommissions
} from '../services/affiliateCommissionService.ts';

export const adminAffiliatesRouter = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'lomi_bingo_super_secret_production_key_2026_et';

function normalizePhone(raw: string): string {
  const clean = String(raw || '').trim().replace(/^\+?251/, '0').replace(/[\s\-()]/g, '');
  if (!clean) return '';
  return clean.startsWith('0') ? clean : `0${clean}`;
}

async function generateUniqueAffiliateCode(): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = `AFF-${1000 + Math.floor(Math.random() * 9000)}`;
    const existing = await query(`SELECT id FROM affiliates WHERE affiliate_code = $1 LIMIT 1`, [code]);
    if (existing.rows.length === 0) return code;
  }
  return `AFF-${Date.now().toString().slice(-6)}`;
}

// ============================================================================
// 1. STATIC SUMMARY, LINKS, RULES, PAYOUT SETTINGS, COMMISSIONS, WITHDRAWALS & AUDIT
// ============================================================================

/**
 * GET /api/admin/affiliates/overview
 */
adminAffiliatesRouter.get('/overview', requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const [affRes, playersRes, depositsRes, commRes, wdRes, targetRuleRes] = await Promise.all([
      query(`
        SELECT
          COUNT(*) as total_affiliates,
          COUNT(*) FILTER (WHERE status = 'active' AND approval_status = 'approved') as active_affiliates,
          COUNT(*) FILTER (WHERE approval_status = 'pending') as pending_applications,
          COALESCE(SUM(wallet_balance), 0) as total_wallet_balance,
          COALESCE(SUM(pending_commission), 0) as total_pending_commission,
          COALESCE(SUM(total_earned), 0) as total_earned,
          COALESCE(SUM(total_withdrawn), 0) as total_withdrawn
        FROM affiliates
      `),
      query(`
        SELECT
          COUNT(*) as total_referred_players,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as new_players_30d
        FROM users
        WHERE affiliate_id IS NOT NULL
      `),
      query(`
        SELECT
          COALESCE(SUM(dep.amount), 0) as total_affiliate_deposits,
          COALESCE(SUM(dep.amount) FILTER (WHERE dep.approved_at >= NOW() - INTERVAL '30 days'), 0) as deposits_30d,
          COUNT(DISTINCT CASE WHEN dep.approved_at >= NOW() - INTERVAL '14 days' THEN u.id END) as active_players_14d
        FROM users u
        JOIN (
          SELECT user_id as uid, amount, COALESCE(reviewed_at, created_at) as approved_at
          FROM deposit_requests WHERE status = 'approved'
          UNION ALL
          SELECT player_id as uid, amount, COALESCE(resolved_at, created_at) as approved_at
          FROM agent_deposit_requests WHERE status = 'approved'
        ) dep ON dep.uid = u.id
        WHERE u.affiliate_id IS NOT NULL
      `),
      query(`
        SELECT
          COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0) as pending_amt,
          COALESCE(SUM(amount) FILTER (WHERE status = 'approved'), 0) as approved_amt,
          COALESCE(SUM(amount) FILTER (WHERE status = 'reversed'), 0) as reversed_amt,
          COUNT(*) FILTER (WHERE status = 'pending') as pending_count
        FROM affiliate_commissions
      `),
      query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'pending') as pending_withdrawals,
          COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0) as pending_withdrawal_amt,
          COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0) as paid_withdrawal_amt
        FROM affiliate_withdrawal_requests
      `),
      query(`SELECT min_monthly_players FROM affiliate_commission_rules WHERE commission_type = 'target' LIMIT 1`)
    ]);

    const a = affRes.rows[0] || {};
    const p = playersRes.rows[0] || {};
    const d = depositsRes.rows[0] || {};
    const c = commRes.rows[0] || {};
    const w = wdRes.rows[0] || {};

    return res.json({
      success: true,
      overview: {
        totalAffiliates: parseInt(a.total_affiliates || '0', 10),
        activeAffiliates: parseInt(a.active_affiliates || '0', 10),
        pendingApplications: parseInt(a.pending_applications || '0', 10),
        totalWalletBalance: parseFloat(a.total_wallet_balance || '0'),
        totalPendingCommission: parseFloat(a.total_pending_commission || '0'),
        totalEarned: parseFloat(a.total_earned || '0'),
        totalWithdrawn: parseFloat(a.total_withdrawn || '0'),
        totalReferredPlayers: parseInt(p.total_referred_players || '0', 10),
        newPlayers30d: parseInt(p.new_players_30d || '0', 10),
        activePlayers14d: parseInt(d.active_players_14d || '0', 10),
        totalAffiliateDeposits: parseFloat(d.total_affiliate_deposits || '0'),
        deposits30d: parseFloat(d.deposits_30d || '0'),
        pendingCommissionsCount: parseInt(c.pending_count || '0', 10),
        pendingCommissionsAmt: parseFloat(c.pending_amt || '0'),
        approvedCommissionsAmt: parseFloat(c.approved_amt || '0'),
        reversedCommissionsAmt: parseFloat(c.reversed_amt || '0'),
        pendingWithdrawalsCount: parseInt(w.pending_withdrawals || '0', 10),
        pendingWithdrawalsAmt: parseFloat(w.pending_withdrawal_amt || '0'),
        paidWithdrawalsAmt: parseFloat(w.paid_withdrawal_amt || '0'),
        defaultMonthlyTarget: parseInt(targetRuleRes.rows[0]?.min_monthly_players || '50', 10)
      }
    });
  } catch (err: any) {
    console.error('❌ [Admin Affiliates Overview Error]:', err);
    return res.status(500).json({ success: false, error: 'Failed to load affiliate overview' });
  }
});

/**
 * GET /api/admin/affiliates/links/list
 */
adminAffiliatesRouter.get('/links/list', requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const linksRes = await query(
      `SELECT id, token, label, max_uses, uses_count, requires_approval, is_active, expires_at, created_at
       FROM affiliate_registration_links
       ORDER BY created_at DESC
       LIMIT 50`
    );
    return res.json({ success: true, links: linksRes.rows });
  } catch (err: any) {
    console.error('❌ [Admin Affiliate Links Error]:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch registration links' });
  }
});

/**
 * POST /api/admin/affiliates/links
 */
adminAffiliatesRouter.post('/links', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { label, maxUses, requiresApproval = true } = req.body;
    const token = crypto.randomBytes(8).toString('hex').toUpperCase();
    const parsedMax = maxUses ? Math.max(1, parseInt(maxUses, 10)) : null;

    const insertRes = await query(
      `INSERT INTO affiliate_registration_links (token, label, max_uses, requires_approval, is_active, created_by)
       VALUES ($1, $2, $3, $4, TRUE, $5)
       RETURNING *`,
      [token, label?.trim() || 'Partner Registration Link', parsedMax, Boolean(requiresApproval), req.user?.id || null]
    );

    await logAffiliateAudit(
      query,
      { id: req.user?.id, fullName: req.user?.fullName },
      'REGISTRATION_LINK_CREATED',
      'affiliate_registration_link',
      insertRes.rows[0].id,
      null,
      { token, label: label?.trim() || 'Partner Registration Link', maxUses: parsedMax }
    );

    return res.json({ success: true, link: insertRes.rows[0] });
  } catch (err: any) {
    console.error('❌ [Create Affiliate Link Error]:', err);
    return res.status(500).json({ success: false, error: 'Failed to create registration link' });
  }
});

/**
 * PATCH /api/admin/affiliates/links/:lid
 */
adminAffiliatesRouter.patch('/links/:lid', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { lid } = req.params;
    const { isActive } = req.body;
    const upRes = await query(
      `UPDATE affiliate_registration_links SET is_active = $1 WHERE id = $2 RETURNING *`,
      [Boolean(isActive), lid]
    );
    if (upRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Registration link not found' });
    }
    return res.json({ success: true, link: upRes.rows[0] });
  } catch (err: any) {
    console.error('❌ [Toggle Affiliate Link Error]:', err);
    return res.status(500).json({ success: false, error: 'Failed to update link' });
  }
});

/**
 * GET /api/admin/affiliates/rules
 */
adminAffiliatesRouter.get('/rules', requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const rulesRes = await query(`SELECT * FROM affiliate_commission_rules ORDER BY id ASC`);
    return res.json({ success: true, rules: rulesRes.rows });
  } catch (err: any) {
    console.error('❌ [Get Affiliate Rules Error]:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch commission rules' });
  }
});

/**
 * PUT /api/admin/affiliates/rules/:type
 * Updates a single commission rule and bumps its version so historical earned commissions remain unchanged.
 */
adminAffiliatesRouter.put('/rules/:type', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { type } = req.params;
    const {
      calcMode,
      rateOrAmount,
      minQualifyingDeposit,
      minMonthlyPlayers,
      activeWindowDays,
      autoApprove,
      isActive,
      description
    } = req.body;

    const existingRes = await query(`SELECT * FROM affiliate_commission_rules WHERE commission_type = $1`, [type]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Commission rule type not found' });
    }
    const prev = existingRes.rows[0];

    const nextCalcMode = calcMode === 'fixed' || calcMode === 'percent' ? calcMode : prev.calc_mode;
    const nextRate = rateOrAmount !== undefined ? Math.max(0, parseFloat(rateOrAmount)) : parseFloat(prev.rate_or_amount);
    const nextMinDeposit = minQualifyingDeposit !== undefined ? Math.max(0, parseFloat(minQualifyingDeposit)) : parseFloat(prev.min_qualifying_deposit);
    const nextMinPlayers = minMonthlyPlayers !== undefined ? Math.max(0, parseInt(minMonthlyPlayers, 10)) : parseInt(prev.min_monthly_players, 10);
    const nextWindowDays = activeWindowDays !== undefined ? Math.max(1, parseInt(activeWindowDays, 10)) : parseInt(prev.active_window_days, 10);
    const nextAutoApprove = typeof autoApprove === 'boolean' ? autoApprove : prev.auto_approve;
    const nextActive = typeof isActive === 'boolean' ? isActive : prev.is_active;

    const upRes = await query(
      `UPDATE affiliate_commission_rules
       SET calc_mode = $1,
           rate_or_amount = $2,
           min_qualifying_deposit = $3,
           min_monthly_players = $4,
           active_window_days = $5,
           auto_approve = $6,
           is_active = $7,
           description = COALESCE($8, description),
           version = version + 1,
           updated_by = $9,
           updated_at = NOW()
       WHERE commission_type = $10
       RETURNING *`,
      [
        nextCalcMode,
        nextRate,
        nextMinDeposit,
        nextMinPlayers,
        nextWindowDays,
        nextAutoApprove,
        nextActive,
        description?.trim() || null,
        req.user?.id || null,
        type
      ]
    );

    await logAffiliateAudit(
      query,
      { id: req.user?.id, fullName: req.user?.fullName },
      'COMMISSION_RULE_UPDATED',
      'affiliate_commission_rule',
      type,
      {
        version: prev.version,
        calcMode: prev.calc_mode,
        rateOrAmount: prev.rate_or_amount,
        minQualifyingDeposit: prev.min_qualifying_deposit,
        minMonthlyPlayers: prev.min_monthly_players,
        activeWindowDays: prev.active_window_days,
        autoApprove: prev.auto_approve,
        isActive: prev.is_active
      },
      {
        version: upRes.rows[0].version,
        calcMode: nextCalcMode,
        rateOrAmount: nextRate,
        minQualifyingDeposit: nextMinDeposit,
        minMonthlyPlayers: nextMinPlayers,
        activeWindowDays: nextWindowDays,
        autoApprove: nextAutoApprove,
        isActive: nextActive
      },
      `Updated ${type} rule to v${upRes.rows[0].version}`
    );

    return res.json({ success: true, rule: upRes.rows[0] });
  } catch (err: any) {
    console.error('❌ [Update Affiliate Rule Error]:', err);
    return res.status(500).json({ success: false, error: 'Failed to update commission rule' });
  }
});

/**
 * GET /api/admin/affiliates/payout-settings
 */
adminAffiliatesRouter.get('/payout-settings', requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const r = await query(`SELECT * FROM affiliate_payout_settings WHERE id = 1`);
    return res.json({ success: true, settings: r.rows[0] || { min_withdrawal_amount: 100, payout_schedule_mode: 'end_of_month', payout_window_days: 3 } });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to load payout settings' });
  }
});

/**
 * PUT /api/admin/affiliates/payout-settings
 */
adminAffiliatesRouter.put('/payout-settings', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { minWithdrawalAmount, payoutScheduleMode, payoutWindowDays } = req.body;
    const prevRes = await query(`SELECT * FROM affiliate_payout_settings WHERE id = 1`);
    const prev = prevRes.rows[0] || {};

    const minAmt = minWithdrawalAmount !== undefined ? Math.max(10, parseFloat(minWithdrawalAmount)) : parseFloat(prev.min_withdrawal_amount || '100');
    const mode = payoutScheduleMode === 'anytime' || payoutScheduleMode === 'end_of_month' ? payoutScheduleMode : (prev.payout_schedule_mode || 'end_of_month');
    const winDays = payoutWindowDays !== undefined ? Math.max(1, Math.min(15, parseInt(payoutWindowDays, 10))) : parseInt(prev.payout_window_days || '3', 10);

    const upRes = await query(
      `UPDATE affiliate_payout_settings
       SET min_withdrawal_amount = $1, payout_schedule_mode = $2, payout_window_days = $3, updated_by = $4, updated_at = NOW()
       WHERE id = 1
       RETURNING *`,
      [minAmt, mode, winDays, req.user?.id || null]
    );

    await logAffiliateAudit(
      query,
      { id: req.user?.id, fullName: req.user?.fullName },
      'PAYOUT_SETTINGS_UPDATED',
      'affiliate_payout_settings',
      '1',
      prev,
      upRes.rows[0]
    );

    return res.json({ success: true, settings: upRes.rows[0] });
  } catch (err: any) {
    console.error('❌ [Update Affiliate Payout Settings Error]:', err);
    return res.status(500).json({ success: false, error: 'Failed to update payout settings' });
  }
});

/**
 * GET /api/admin/affiliates/commissions
 */
adminAffiliatesRouter.get('/commissions', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : 'all';
    const type = typeof req.query.type === 'string' ? req.query.type : 'all';
    const affiliateId = typeof req.query.affiliateId === 'string' ? req.query.affiliateId : '';
    const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 25, 1), 100);
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];

    if (['pending', 'approved', 'rejected', 'reversed'].includes(status)) {
      params.push(status);
      conditions.push(`c.status = $${params.length}`);
    }
    if (['registration', 'first_deposit', 'regular_deposit', 'target', 'monthly', 'loyalty'].includes(type)) {
      params.push(type);
      conditions.push(`c.commission_type = $${params.length}`);
    }
    if (affiliateId) {
      params.push(affiliateId);
      conditions.push(`c.affiliate_id = $${params.length}`);
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRes, rowsRes] = await Promise.all([
      query(`SELECT COUNT(*) as total FROM affiliate_commissions c ${whereSql}`, params),
      query(
        `SELECT c.*, a.full_name as affiliate_name, a.affiliate_code,
                u.full_name as player_name, u.phone as player_phone
         FROM affiliate_commissions c
         JOIN affiliates a ON c.affiliate_id = a.id
         LEFT JOIN users u ON c.player_user_id = u.id
         ${whereSql}
         ORDER BY c.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      )
    ]);

    const totalCount = parseInt(countRes.rows[0]?.total || '0', 10);
    return res.json({
      success: true,
      commissions: rowsRes.rows,
      totalCount,
      page,
      totalPages: Math.ceil(totalCount / limit) || 1
    });
  } catch (err: any) {
    console.error('❌ [List Affiliate Commissions Error]:', err);
    return res.status(500).json({ success: false, error: 'Failed to load commissions' });
  }
});

adminAffiliatesRouter.post('/commissions/:cid/approve', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await approveCommission(
      req.params.cid,
      { id: req.user?.id, fullName: req.user?.fullName },
      req.body?.note
    );
    return res.json({ success: true, ...result });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err?.message || 'Failed to approve commission' });
  }
});

adminAffiliatesRouter.post('/commissions/:cid/reject', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const reason = String(req.body?.reason || '').trim() || 'Rejected by Admin';
    const result = await rejectCommission(req.params.cid, { id: req.user?.id, fullName: req.user?.fullName }, reason);
    return res.json({ success: true, ...result });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err?.message || 'Failed to reject commission' });
  }
});

adminAffiliatesRouter.post('/commissions/:cid/reverse', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await reverseCommission(
      req.params.cid,
      { id: req.user?.id, fullName: req.user?.fullName },
      req.body?.reason
    );
    return res.json({ success: true, ...result });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err?.message || 'Failed to reverse commission' });
  }
});

adminAffiliatesRouter.post('/run-periodic', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const now = new Date();
    const defaultPeriod = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const periodMonth = typeof req.body?.periodMonth === 'string' && req.body.periodMonth.trim()
      ? req.body.periodMonth.trim()
      : defaultPeriod;

    const result = await runPeriodicCommissions(periodMonth, { id: req.user?.id, fullName: req.user?.fullName });
    return res.json({ success: true, ...result });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err?.message || 'Failed to execute periodic commission batch' });
  }
});

/**
 * GET /api/admin/affiliates/withdrawals
 */
adminAffiliatesRouter.get('/withdrawals', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : 'all';
    const params: any[] = [];
    let whereSql = '';
    if (['pending', 'approved', 'paid', 'rejected'].includes(status)) {
      params.push(status);
      whereSql = `WHERE w.status = $1`;
    }

    const rowsRes = await query(
      `SELECT w.*, a.full_name as affiliate_name, a.affiliate_code, a.phone as affiliate_phone
       FROM affiliate_withdrawal_requests w
       JOIN affiliates a ON w.affiliate_id = a.id
       ${whereSql}
       ORDER BY w.created_at DESC
       LIMIT 100`,
      params
    );

    return res.json({ success: true, withdrawals: rowsRes.rows });
  } catch (err: any) {
    console.error('❌ [List Affiliate Withdrawals Error]:', err);
    return res.status(500).json({ success: false, error: 'Failed to load withdrawal requests' });
  }
});

adminAffiliatesRouter.post('/withdrawals/:wid/approve', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const upRes = await query(
      `UPDATE affiliate_withdrawal_requests
       SET status = 'approved', reviewed_by = $1, reviewed_at = NOW()
       WHERE id = $2 AND status = 'pending'
       RETURNING *`,
      [req.user?.id || null, req.params.wid]
    );
    if (upRes.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Pending withdrawal request not found' });
    }
    await logAffiliateAudit(query, { id: req.user?.id, fullName: req.user?.fullName }, 'WITHDRAWAL_APPROVED', 'affiliate_withdrawal', req.params.wid, { status: 'pending' }, { status: 'approved' });
    return res.json({ success: true, withdrawal: upRes.rows[0] });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to approve withdrawal' });
  }
});

adminAffiliatesRouter.post('/withdrawals/:wid/mark-paid', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const paymentRef = String(req.body?.paymentReference || '').trim();
    const result = await withTransaction(async (client) => {
      const wRes = await client.query(`SELECT * FROM affiliate_withdrawal_requests WHERE id = $1 FOR UPDATE`, [req.params.wid]);
      if (wRes.rows.length === 0) throw new Error('Withdrawal request not found');
      const w = wRes.rows[0];
      if (!['pending', 'approved'].includes(w.status)) {
        throw new Error(`Withdrawal is already ${w.status}`);
      }
      const amt = parseFloat(w.amount);

      const affRes = await client.query(
        `UPDATE affiliates
         SET total_withdrawn = total_withdrawn + $1, updated_at = NOW()
         WHERE id = $2
         RETURNING wallet_balance`,
        [amt, w.affiliate_id]
      );

      const upRes = await client.query(
        `UPDATE affiliate_withdrawal_requests
         SET status = 'paid', payment_reference = $1, paid_by = $2, paid_at = NOW(),
             reviewed_by = COALESCE(reviewed_by, $2), reviewed_at = COALESCE(reviewed_at, NOW())
         WHERE id = $3
         RETURNING *`,
        [paymentRef || `PAID-${Date.now().toString().slice(-6)}`, req.user?.id || null, req.params.wid]
      );

      await client.query(
        `INSERT INTO affiliate_wallet_transactions (affiliate_id, type, amount, balance_after, reason, reference_id, performed_by)
         VALUES ($1, 'withdrawal_paid', 0, $2, $3, $4, $5)`,
        [
          w.affiliate_id,
          parseFloat(affRes.rows[0]?.wallet_balance || '0'),
          `Withdrawal paid (${paymentRef || 'Cashier transfer'})`,
          w.id,
          req.user?.id || null
        ]
      );

      await logAffiliateAudit(
        client.query.bind(client),
        { id: req.user?.id, fullName: req.user?.fullName },
        'WITHDRAWAL_PAID',
        'affiliate_withdrawal',
        w.id,
        { status: w.status },
        { status: 'paid', paymentReference: paymentRef || null, amount: amt }
      );

      return upRes.rows[0];
    });

    return res.json({ success: true, withdrawal: result });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err?.message || 'Failed to record withdrawal payment' });
  }
});

adminAffiliatesRouter.post('/withdrawals/:wid/reject', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const reason = String(req.body?.reason || '').trim() || 'Rejected by Admin';
    const result = await withTransaction(async (client) => {
      const wRes = await client.query(`SELECT * FROM affiliate_withdrawal_requests WHERE id = $1 FOR UPDATE`, [req.params.wid]);
      if (wRes.rows.length === 0) throw new Error('Withdrawal request not found');
      const w = wRes.rows[0];
      if (!['pending', 'approved'].includes(w.status)) {
        throw new Error(`Withdrawal is already ${w.status}`);
      }
      const amt = parseFloat(w.amount);

      const affRes = await client.query(
        `UPDATE affiliates SET wallet_balance = wallet_balance + $1, updated_at = NOW() WHERE id = $2 RETURNING wallet_balance`,
        [amt, w.affiliate_id]
      );
      const newBal = parseFloat(affRes.rows[0].wallet_balance || '0');

      await client.query(
        `INSERT INTO affiliate_wallet_transactions (affiliate_id, type, amount, balance_after, reason, reference_id, performed_by)
         VALUES ($1, 'withdrawal_refund', $2, $3, $4, $5, $6)`,
        [w.affiliate_id, amt, newBal, `Withdrawal rejected: ${reason}`, w.id, req.user?.id || null]
      );

      const upRes = await client.query(
        `UPDATE affiliate_withdrawal_requests
         SET status = 'rejected', rejection_reason = $1, reviewed_by = $2, reviewed_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [reason, req.user?.id || null, w.id]
      );

      await logAffiliateAudit(
        client.query.bind(client),
        { id: req.user?.id, fullName: req.user?.fullName },
        'WITHDRAWAL_REJECTED',
        'affiliate_withdrawal',
        w.id,
        { status: w.status },
        { status: 'rejected', refundedAmount: amt },
        reason
      );

      return upRes.rows[0];
    });

    return res.json({ success: true, withdrawal: result });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err?.message || 'Failed to reject withdrawal' });
  }
});

/**
 * GET /api/admin/affiliates/audit-logs
 */
adminAffiliatesRouter.get('/audit-logs', requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const logsRes = await query(
      `SELECT * FROM affiliate_audit_logs ORDER BY created_at DESC LIMIT 60`
    );
    return res.json({ success: true, logs: logsRes.rows });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to load affiliate audit logs' });
  }
});

// ============================================================================
// 2. AFFILIATES DIRECTORY, CRUD, APPLICATIONS, WALLETS & SUPPORT ACCESS
// ============================================================================

/**
 * GET /api/admin/affiliates
 */
adminAffiliatesRouter.get('/', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status : 'all';
    const approval = typeof req.query.approval === 'string' ? req.query.approval : 'all';

    const conditions: string[] = [];
    const params: any[] = [];

    if (['active', 'inactive', 'suspended'].includes(status)) {
      params.push(status);
      conditions.push(`a.status = $${params.length}`);
    }
    if (['pending', 'approved', 'rejected'].includes(approval)) {
      params.push(approval);
      conditions.push(`a.approval_status = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      const idx = params.length;
      conditions.push(`(a.full_name ILIKE $${idx} OR a.phone ILIKE $${idx} OR a.affiliate_code ILIKE $${idx})`);
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const [targetRes, listRes] = await Promise.all([
      query(`SELECT min_monthly_players FROM affiliate_commission_rules WHERE commission_type = 'target' LIMIT 1`),
      query(
        `SELECT
           a.*,
           COALESCE((SELECT COUNT(*) FROM users u WHERE u.affiliate_id = a.id), 0) as total_players,
           COALESCE((SELECT COUNT(*) FROM users u WHERE u.affiliate_id = a.id AND u.created_at >= date_trunc('month', NOW())), 0) as month_players,
           COALESCE((
             SELECT COUNT(DISTINCT u.id)
             FROM users u
             JOIN (
               SELECT user_id as uid, COALESCE(reviewed_at, created_at) as approved_at FROM deposit_requests WHERE status = 'approved'
               UNION ALL
               SELECT player_id as uid, COALESCE(resolved_at, created_at) as approved_at FROM agent_deposit_requests WHERE status = 'approved'
             ) dep ON dep.uid = u.id
             WHERE u.affiliate_id = a.id AND dep.approved_at >= NOW() - INTERVAL '14 days'
           ), 0) as active_players,
           COALESCE((
             SELECT SUM(dep.amount)
             FROM users u
             JOIN (
               SELECT user_id as uid, amount FROM deposit_requests WHERE status = 'approved'
               UNION ALL
               SELECT player_id as uid, amount FROM agent_deposit_requests WHERE status = 'approved'
             ) dep ON dep.uid = u.id
             WHERE u.affiliate_id = a.id
           ), 0) as total_deposits_generated
         FROM affiliates a
         ${whereSql}
         ORDER BY
           CASE WHEN a.approval_status = 'pending' THEN 0 ELSE 1 END,
           a.created_at DESC
         LIMIT 200`,
        params
      )
    ]);

    const defaultTarget = parseInt(targetRes.rows[0]?.min_monthly_players || '50', 10);
    const affiliates = listRes.rows.map(r => ({
      id: r.id,
      affiliateCode: r.affiliate_code,
      fullName: r.full_name,
      phone: r.phone,
      payoutMethod: r.payout_method,
      payoutAccount: r.payout_account,
      payoutAccountName: r.payout_account_name,
      status: r.status,
      approvalStatus: r.approval_status,
      rejectionReason: r.rejection_reason,
      walletBalance: parseFloat(r.wallet_balance || '0'),
      pendingCommission: parseFloat(r.pending_commission || '0'),
      totalEarned: parseFloat(r.total_earned || '0'),
      totalWithdrawn: parseFloat(r.total_withdrawn || '0'),
      monthlyTarget: r.monthly_target_override ? parseInt(r.monthly_target_override, 10) : defaultTarget,
      monthlyTargetOverride: r.monthly_target_override ? parseInt(r.monthly_target_override, 10) : null,
      totalPlayers: parseInt(r.total_players || '0', 10),
      monthPlayers: parseInt(r.month_players || '0', 10),
      activePlayers: parseInt(r.active_players || '0', 10),
      totalDepositsGenerated: parseFloat(r.total_deposits_generated || '0'),
      applicationNotes: r.application_notes,
      createdAt: r.created_at
    }));

    return res.json({ success: true, affiliates });
  } catch (err: any) {
    console.error('❌ [List Affiliates Error]:', err);
    return res.status(500).json({ success: false, error: 'Failed to load affiliates' });
  }
});

/**
 * POST /api/admin/affiliates
 * Manually register an approved affiliate from Admin Panel.
 */
adminAffiliatesRouter.post('/', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { fullName, phone, password, payoutMethod, payoutAccount, payoutAccountName, monthlyTargetOverride } = req.body;
    const cleanName = String(fullName || '').trim();
    const cleanPhone = normalizePhone(phone);

    if (!cleanName || cleanPhone.length < 9) {
      return res.status(400).json({ success: false, error: 'Full name and valid phone number are required' });
    }

    const dup = await query(`SELECT id FROM affiliates WHERE phone = $1 LIMIT 1`, [cleanPhone]);
    if (dup.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'An affiliate with this phone number already exists' });
    }

    const affiliateCode = await generateUniqueAffiliateCode();
    const passwordHash = await bcrypt.hash(String(password || '1234').trim() || '1234', 10);
    const targetOverride = monthlyTargetOverride ? Math.max(1, parseInt(monthlyTargetOverride, 10)) : null;

    const insRes = await query(
      `INSERT INTO affiliates (
         affiliate_code, full_name, phone, password_hash, payout_method, payout_account,
         payout_account_name, status, approval_status, monthly_target_override, approved_by, approved_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', 'approved', $8, $9, NOW())
       RETURNING *`,
      [
        affiliateCode,
        cleanName,
        cleanPhone,
        passwordHash,
        payoutMethod || 'Telebirr',
        payoutAccount?.trim() || cleanPhone,
        payoutAccountName?.trim() || cleanName,
        targetOverride,
        req.user?.id || null
      ]
    );

    await logAffiliateAudit(
      query,
      { id: req.user?.id, fullName: req.user?.fullName },
      'AFFILIATE_CREATED_MANUALLY',
      'affiliate',
      insRes.rows[0].id,
      null,
      { affiliateCode, fullName: cleanName, phone: cleanPhone }
    );

    return res.json({ success: true, affiliate: insRes.rows[0] });
  } catch (err: any) {
    console.error('❌ [Create Affiliate Error]:', err);
    return res.status(500).json({ success: false, error: 'Failed to create affiliate' });
  }
});

/**
 * GET /api/admin/affiliates/:id
 */
adminAffiliatesRouter.get('/:id', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const affRes = await query(`SELECT * FROM affiliates WHERE id = $1`, [id]);
    if (affRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Affiliate not found' });
    }

    const [playersRes, txsRes, commsRes, wdRes] = await Promise.all([
      query(
        `SELECT u.id, u.full_name, u.phone, u.created_at,
                COALESCE((
                  SELECT SUM(amount) FROM (
                    SELECT user_id as uid, amount FROM deposit_requests WHERE status = 'approved'
                    UNION ALL
                    SELECT player_id as uid, amount FROM agent_deposit_requests WHERE status = 'approved'
                  ) d WHERE d.uid = u.id
                ), 0) as total_deposited
         FROM users u WHERE u.affiliate_id = $1 ORDER BY u.created_at DESC LIMIT 50`,
        [id]
      ),
      query(`SELECT * FROM affiliate_wallet_transactions WHERE affiliate_id = $1 ORDER BY created_at DESC LIMIT 30`, [id]),
      query(`SELECT * FROM affiliate_commissions WHERE affiliate_id = $1 ORDER BY created_at DESC LIMIT 30`, [id]),
      query(`SELECT * FROM affiliate_withdrawal_requests WHERE affiliate_id = $1 ORDER BY created_at DESC LIMIT 20`, [id])
    ]);

    return res.json({
      success: true,
      affiliate: affRes.rows[0],
      players: playersRes.rows,
      transactions: txsRes.rows,
      commissions: commsRes.rows,
      withdrawals: wdRes.rows
    });
  } catch (err: any) {
    console.error('❌ [Affiliate Detail Error]:', err);
    return res.status(500).json({ success: false, error: 'Failed to load affiliate details' });
  }
});

/**
 * PUT /api/admin/affiliates/:id
 */
adminAffiliatesRouter.put('/:id', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const prevRes = await query(`SELECT * FROM affiliates WHERE id = $1`, [id]);
    if (prevRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Affiliate not found' });
    }
    const prev = prevRes.rows[0];
    const { fullName, phone, payoutMethod, payoutAccount, payoutAccountName, monthlyTargetOverride, status } = req.body;

    const cleanPhone = phone ? normalizePhone(phone) : prev.phone;
    const targetOverride = monthlyTargetOverride === '' || monthlyTargetOverride === null
      ? null
      : (monthlyTargetOverride !== undefined ? Math.max(1, parseInt(monthlyTargetOverride, 10)) : prev.monthly_target_override);
    const nextStatus = ['active', 'inactive', 'suspended'].includes(status) ? status : prev.status;

    const upRes = await query(
      `UPDATE affiliates
       SET full_name = $1, phone = $2, payout_method = $3, payout_account = $4,
           payout_account_name = $5, monthly_target_override = $6, status = $7, updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [
        fullName?.trim() || prev.full_name,
        cleanPhone,
        payoutMethod || prev.payout_method,
        payoutAccount !== undefined ? String(payoutAccount).trim() : prev.payout_account,
        payoutAccountName !== undefined ? String(payoutAccountName).trim() : prev.payout_account_name,
        targetOverride,
        nextStatus,
        id
      ]
    );

    await logAffiliateAudit(
      query,
      { id: req.user?.id, fullName: req.user?.fullName },
      'AFFILIATE_UPDATED',
      'affiliate',
      id,
      { fullName: prev.full_name, phone: prev.phone, status: prev.status, monthlyTargetOverride: prev.monthly_target_override },
      { fullName: upRes.rows[0].full_name, phone: upRes.rows[0].phone, status: nextStatus, monthlyTargetOverride: targetOverride }
    );

    return res.json({ success: true, affiliate: upRes.rows[0] });
  } catch (err: any) {
    console.error('❌ [Edit Affiliate Error]:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Failed to update affiliate' });
  }
});

/**
 * PATCH /api/admin/affiliates/:id/status
 */
adminAffiliatesRouter.patch('/:id/status', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;
    if (!['active', 'inactive', 'suspended'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status value' });
    }

    const prevRes = await query(`SELECT status FROM affiliates WHERE id = $1`, [id]);
    if (prevRes.rows.length === 0) return res.status(404).json({ success: false, error: 'Affiliate not found' });

    const upRes = await query(`UPDATE affiliates SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`, [status, id]);

    await logAffiliateAudit(
      query,
      { id: req.user?.id, fullName: req.user?.fullName },
      'AFFILIATE_STATUS_CHANGED',
      'affiliate',
      id,
      { status: prevRes.rows[0].status },
      { status },
      reason
    );

    return res.json({ success: true, affiliate: upRes.rows[0] });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to update affiliate status' });
  }
});

/**
 * POST /api/admin/affiliates/:id/approve-registration
 */
adminAffiliatesRouter.post('/:id/approve-registration', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { decision, reason } = req.body;
    const isApprove = decision === 'approve';

    const upRes = await query(
      `UPDATE affiliates
       SET approval_status = $1,
           status = $2,
           rejection_reason = $3,
           approved_by = $4,
           approved_at = CASE WHEN $1 = 'approved' THEN NOW() ELSE approved_at END,
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [
        isApprove ? 'approved' : 'rejected',
        isApprove ? 'active' : 'inactive',
        isApprove ? null : (String(reason || '').trim() || 'Application declined by Admin'),
        req.user?.id || null,
        id
      ]
    );
    if (upRes.rows.length === 0) return res.status(404).json({ success: false, error: 'Affiliate not found' });

    await logAffiliateAudit(
      query,
      { id: req.user?.id, fullName: req.user?.fullName },
      isApprove ? 'AFFILIATE_APPROVED' : 'AFFILIATE_REJECTED',
      'affiliate',
      id,
      { approvalStatus: 'pending' },
      { approvalStatus: isApprove ? 'approved' : 'rejected' },
      reason
    );

    return res.json({ success: true, affiliate: upRes.rows[0] });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to review affiliate application' });
  }
});

/**
 * POST /api/admin/affiliates/:id/wallet-adjust
 */
adminAffiliatesRouter.post('/:id/wallet-adjust', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { mode, amount, reason } = req.body;
    if (!['recharge', 'credit', 'debit'].includes(mode)) {
      return res.status(400).json({ success: false, error: 'Mode must be recharge, credit, or debit' });
    }
    const result = await adjustAffiliateWallet(
      req.params.id,
      mode,
      Number(amount),
      reason,
      { id: req.user?.id, fullName: req.user?.fullName }
    );
    return res.json({ success: true, ...result });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err?.message || 'Wallet adjustment failed' });
  }
});

/**
 * GET /api/admin/affiliates/:id/wallet-transactions
 */
adminAffiliatesRouter.get('/:id/wallet-transactions', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rowsRes = await query(
      `SELECT * FROM affiliate_wallet_transactions WHERE affiliate_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.params.id]
    );
    return res.json({ success: true, transactions: rowsRes.rows });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to load wallet transactions' });
  }
});

/**
 * POST /api/admin/affiliates/:id/impersonate
 * Generates a scoped support token so Admin can inspect an affiliate's portal directly.
 */
adminAffiliatesRouter.post('/:id/impersonate', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const affRes = await query(`SELECT id, affiliate_code, full_name, phone, status, approval_status FROM affiliates WHERE id = $1`, [req.params.id]);
    if (affRes.rows.length === 0) return res.status(404).json({ success: false, error: 'Affiliate not found' });
    const aff = affRes.rows[0];

    const token = jwt.sign(
      {
        id: aff.id,
        affiliateCode: aff.affiliate_code,
        fullName: aff.full_name,
        phone: aff.phone,
        role: 'affiliate',
        impersonatedByAdmin: req.user?.id || 'admin'
      },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    await logAffiliateAudit(
      query,
      { id: req.user?.id, fullName: req.user?.fullName },
      'ADMIN_PORTAL_SUPPORT_ACCESS',
      'affiliate',
      aff.id,
      null,
      { affiliateCode: aff.affiliate_code }
    );

    return res.json({
      success: true,
      token,
      affiliate: {
        id: aff.id,
        affiliateCode: aff.affiliate_code,
        fullName: aff.full_name,
        phone: aff.phone
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to generate affiliate portal access token' });
  }
});
