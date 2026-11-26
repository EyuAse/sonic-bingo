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
    const fromDate = typeof req.query.from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.from) ? req.query.from : '';
    const toDate = typeof req.query.to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.to) ? req.query.to : '';
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
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
    if (fromDate) {
      params.push(fromDate);
      conditions.push(`c.created_at >= ($${params.length}::date AT TIME ZONE 'Africa/Addis_Ababa')`);
    }
    if (toDate) {
      params.push(toDate);
      conditions.push(`c.created_at < (($${params.length}::date + INTERVAL '1 day') AT TIME ZONE 'Africa/Addis_Ababa')`);
    }
    if (search) {
      params.push(`%${search}%`);
      const idx = params.length;
      conditions.push(
        `(a.full_name ILIKE $${idx} OR a.affiliate_code ILIKE $${idx} OR COALESCE(u.full_name, '') ILIKE $${idx} OR COALESCE(u.phone, '') ILIKE $${idx} OR COALESCE(c.note, '') ILIKE $${idx})`
      );
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRes, rowsRes] = await Promise.all([
      query(
        `SELECT COUNT(*) as total
         FROM affiliate_commissions c
         JOIN affiliates a ON c.affiliate_id = a.id
         LEFT JOIN users u ON c.player_user_id = u.id
         ${whereSql}`,
        params
      ),
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

function formatEatDateStr(d: Date): string {
  const eatMs = d.getTime() + 3 * 60 * 60 * 1000;
  return new Date(eatMs).toISOString().slice(0, 10);
}

function addDaysYmd(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return dt.toISOString().slice(0, 10);
}

function resolveReportRange(period: string, rawFrom: string, rawTo: string) {
  const todayYmd = formatEatDateStr(new Date());
  const isValid = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

  if (period === 'custom' && (isValid(rawFrom) || isValid(rawTo))) {
    const f = isValid(rawFrom) ? rawFrom : (isValid(rawTo) ? addDaysYmd(rawTo, -29) : addDaysYmd(todayYmd, -29));
    const t = isValid(rawTo) ? rawTo : todayYmd;
    return f <= t ? { from: f, to: t, isAllTime: false } : { from: t, to: f, isAllTime: false };
  }
  if (period === 'today') return { from: todayYmd, to: todayYmd, isAllTime: false };
  if (period === 'yesterday') {
    const yest = addDaysYmd(todayYmd, -1);
    return { from: yest, to: yest, isAllTime: false };
  }
  if (period === 'week') return { from: addDaysYmd(todayYmd, -6), to: todayYmd, isAllTime: false };
  if (period === 'all') return { from: '2024-01-01', to: todayYmd, isAllTime: true };
  // Default 'month': rolling 30 days ending today EAT
  return { from: addDaysYmd(todayYmd, -29), to: todayYmd, isAllTime: false };
}

function buildContiguousBuckets(fromYmd: string, toYmd: string, granularity: 'daily' | 'weekly' | 'monthly') {
  const keys: Array<{ bucketKey: string; label: string; subLabel: string }> = [];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (granularity === 'monthly') {
    let curY = parseInt(fromYmd.slice(0, 4), 10);
    let curM = parseInt(fromYmd.slice(5, 7), 10);
    const endY = parseInt(toYmd.slice(0, 4), 10);
    const endM = parseInt(toYmd.slice(5, 7), 10);
    let guard = 0;
    while ((curY < endY || (curY === endY && curM <= endM)) && guard < 24) {
      const key = `${curY}-${String(curM).padStart(2, '0')}-01`;
      keys.push({ bucketKey: key, label: monthNames[curM - 1] || key, subLabel: String(curY) });
      curM += 1;
      if (curM > 12) { curM = 1; curY += 1; }
      guard += 1;
    }
    return keys;
  }

  const startDt = new Date(`${fromYmd}T00:00:00Z`);
  const endDt = new Date(`${toYmd}T00:00:00Z`);

  if (granularity === 'weekly') {
    const startDow = (startDt.getUTCDay() + 6) % 7; // Monday = 0
    const cur = new Date(startDt.getTime() - startDow * 86400000);
    let guard = 0;
    while (cur <= endDt && guard < 24) {
      const key = cur.toISOString().slice(0, 10);
      keys.push({
        bucketKey: key,
        label: `Wk ${monthNames[cur.getUTCMonth()]} ${cur.getUTCDate()}`,
        subLabel: key
      });
      cur.setUTCDate(cur.getUTCDate() + 7);
      guard += 1;
    }
    return keys;
  }

  // Daily (cap contiguous zero-fill at 45 days; if wider, caller falls back to data buckets)
  const diffDays = Math.round((endDt.getTime() - startDt.getTime()) / 86400000);
  if (diffDays <= 45 && diffDays >= 0) {
    const cur = new Date(startDt.getTime());
    while (cur <= endDt) {
      const key = cur.toISOString().slice(0, 10);
      keys.push({
        bucketKey: key,
        label: `${monthNames[cur.getUTCMonth()]} ${cur.getUTCDate()}`,
        subLabel: dayNames[cur.getUTCDay()]
      });
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  }
  return keys;
}

/**
 * GET /api/admin/affiliates/reports
 * Comprehensive Daily / Weekly / Monthly / Custom-Date Affiliate Analytics
 */
adminAffiliatesRouter.get('/reports', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const period = typeof req.query.period === 'string' ? req.query.period : 'month';
    const rawFrom = typeof req.query.from === 'string' ? req.query.from.trim() : '';
    const rawTo = typeof req.query.to === 'string' ? req.query.to.trim() : '';
    const rawGranularity = typeof req.query.granularity === 'string' ? req.query.granularity : '';
    const affiliateId = typeof req.query.affiliateId === 'string' ? req.query.affiliateId.trim() : '';

    const range = resolveReportRange(period, rawFrom, rawTo);
    const granularity: 'daily' | 'weekly' | 'monthly' =
      rawGranularity === 'daily' || rawGranularity === 'weekly' || rawGranularity === 'monthly'
        ? rawGranularity
        : range.isAllTime
          ? 'monthly'
          : 'daily';

    const bucketExpr = (col: string) => {
      if (granularity === 'monthly') {
        return `TO_CHAR(date_trunc('month', ${col} AT TIME ZONE 'Africa/Addis_Ababa')::date, 'YYYY-MM-01')`;
      }
      if (granularity === 'weekly') {
        return `TO_CHAR(date_trunc('week', ${col} AT TIME ZONE 'Africa/Addis_Ababa')::date, 'YYYY-MM-DD')`;
      }
      return `TO_CHAR((${col} AT TIME ZONE 'Africa/Addis_Ababa')::date, 'YYYY-MM-DD')`;
    };

    const baseParams: any[] = [range.from, range.to];
    const hasAff = Boolean(affiliateId);
    if (hasAff) baseParams.push(affiliateId);

    const affCondC = hasAff ? `AND c.affiliate_id = $3` : '';
    const affCondU = hasAff ? `AND u.affiliate_id = $3` : '';
    const affCondW = hasAff ? `AND w.affiliate_id = $3` : '';

    const rangeSql = (col: string) =>
      `${col} >= ($1::date AT TIME ZONE 'Africa/Addis_Ababa') AND ${col} < (($2::date + INTERVAL '1 day') AT TIME ZONE 'Africa/Addis_Ababa')`;

    const trendFrom = range.isAllTime ? addDaysYmd(range.to, -364) : range.from;
    const trendParams: any[] = [trendFrom, range.to];
    if (hasAff) trendParams.push(affiliateId);

    const [
      commTypeRes,
      depKpiRes,
      playersKpiRes,
      wdSummaryRes,
      wdRowsRes,
      trendCommRes,
      trendDepRes,
      trendRegRes,
      trendWdRes,
      leaderboardRes,
      defaultTargetRes
    ] = await Promise.all([
      // 1. Commissions summary + 6-type breakdown
      query(
        `SELECT
           c.commission_type,
           COUNT(*) as tx_count,
           COUNT(*) FILTER (WHERE c.status = 'pending') as pending_count,
           COALESCE(SUM(c.amount) FILTER (WHERE c.status = 'approved'), 0) as approved_amt,
           COALESCE(SUM(c.amount) FILTER (WHERE c.status = 'pending'), 0) as pending_amt,
           COALESCE(SUM(c.amount) FILTER (WHERE c.status = 'reversed'), 0) as reversed_amt,
           COALESCE(SUM(c.amount) FILTER (WHERE c.status = 'rejected'), 0) as rejected_amt
         FROM affiliate_commissions c
         WHERE ${rangeSql('c.created_at')} ${affCondC}
         GROUP BY c.commission_type`,
        baseParams
      ),
      // 2. Generated player deposits in period
      query(
        `SELECT
           COALESCE(SUM(dep.amount), 0) as generated_deposits,
           COUNT(*) as deposit_count,
           COUNT(DISTINCT u.id) as active_depositors
         FROM users u
         JOIN (
           SELECT user_id as uid, amount, COALESCE(reviewed_at, created_at) as approved_at
           FROM deposit_requests WHERE status = 'approved'
           UNION ALL
           SELECT player_id as uid, amount, COALESCE(resolved_at, created_at) as approved_at
           FROM agent_deposit_requests WHERE status = 'approved'
         ) dep ON dep.uid = u.id
         WHERE u.affiliate_id IS NOT NULL ${affCondU} AND ${rangeSql('dep.approved_at')}`,
        baseParams
      ),
      // 3. New referred players registered in period
      query(
        `SELECT COUNT(*) as new_players
         FROM users u
         WHERE u.affiliate_id IS NOT NULL ${affCondU} AND ${rangeSql('u.created_at')}`,
        baseParams
      ),
      // 4. Withdrawal summary in period
      query(
        `SELECT
           COALESCE(SUM(w.amount) FILTER (WHERE w.status = 'paid'), 0) as paid_amt,
           COALESCE(SUM(w.amount) FILTER (WHERE w.status = 'approved'), 0) as approved_amt,
           COALESCE(SUM(w.amount) FILTER (WHERE w.status = 'pending'), 0) as pending_amt,
           COALESCE(SUM(w.amount) FILTER (WHERE w.status = 'rejected'), 0) as rejected_amt,
           COUNT(*) as total_count
         FROM affiliate_withdrawal_requests w
         WHERE ${rangeSql('w.created_at')} ${affCondW}`,
        baseParams
      ),
      // 5. Recent withdrawals in period
      query(
        `SELECT w.*, a.full_name as affiliate_name, a.affiliate_code, a.phone as affiliate_phone
         FROM affiliate_withdrawal_requests w
         JOIN affiliates a ON w.affiliate_id = a.id
         WHERE ${rangeSql('w.created_at')} ${affCondW}
         ORDER BY w.created_at DESC
         LIMIT 50`,
        baseParams
      ),
      // 6a. Trend: commissions
      query(
        `SELECT ${bucketExpr('c.created_at')} as bucket_key,
                COALESCE(SUM(c.amount) FILTER (WHERE c.status IN ('approved', 'pending')), 0) as commissions
         FROM affiliate_commissions c
         WHERE ${rangeSql('c.created_at')} ${affCondC}
         GROUP BY bucket_key`,
        trendParams
      ),
      // 6b. Trend: deposits
      query(
        `SELECT ${bucketExpr('dep.approved_at')} as bucket_key,
                COALESCE(SUM(dep.amount), 0) as deposits
         FROM users u
         JOIN (
           SELECT user_id as uid, amount, COALESCE(reviewed_at, created_at) as approved_at
           FROM deposit_requests WHERE status = 'approved'
           UNION ALL
           SELECT player_id as uid, amount, COALESCE(resolved_at, created_at) as approved_at
           FROM agent_deposit_requests WHERE status = 'approved'
         ) dep ON dep.uid = u.id
         WHERE u.affiliate_id IS NOT NULL ${affCondU} AND ${rangeSql('dep.approved_at')}
         GROUP BY bucket_key`,
        trendParams
      ),
      // 6c. Trend: player registrations
      query(
        `SELECT ${bucketExpr('u.created_at')} as bucket_key,
                COUNT(*) as registrations
         FROM users u
         WHERE u.affiliate_id IS NOT NULL ${affCondU} AND ${rangeSql('u.created_at')}
         GROUP BY bucket_key`,
        trendParams
      ),
      // 6d. Trend: paid withdrawals
      query(
        `SELECT ${bucketExpr('w.created_at')} as bucket_key,
                COALESCE(SUM(w.amount) FILTER (WHERE w.status = 'paid'), 0) as withdrawals
         FROM affiliate_withdrawal_requests w
         WHERE ${rangeSql('w.created_at')} ${affCondW}
         GROUP BY bucket_key`,
        trendParams
      ),
      // 7. Period Leaderboard
      query(
        `SELECT
           a.id, a.affiliate_code, a.full_name, a.status, a.wallet_balance, a.monthly_target_override,
           COALESCE(pc.new_players, 0) as new_players,
           COALESCE(lt.total_players, 0) as total_players,
           COALESCE(ap.active_players_14d, 0) as active_players,
           COALESCE(dp.deposits, 0) as deposits,
           COALESCE(cm.commissions_earned, 0) as commissions_earned,
           COALESCE(cm.pending_commissions, 0) as pending_commissions
         FROM affiliates a
         LEFT JOIN (
           SELECT u.affiliate_id, COUNT(*) as new_players
           FROM users u
           WHERE u.affiliate_id IS NOT NULL AND ${rangeSql('u.created_at')}
           GROUP BY u.affiliate_id
         ) pc ON pc.affiliate_id = a.id
         LEFT JOIN (
           SELECT affiliate_id, COUNT(*) as total_players
           FROM users WHERE affiliate_id IS NOT NULL GROUP BY affiliate_id
         ) lt ON lt.affiliate_id = a.id
         LEFT JOIN (
           SELECT u.affiliate_id, COUNT(DISTINCT u.id) as active_players_14d
           FROM users u
           JOIN (
             SELECT user_id as uid, COALESCE(reviewed_at, created_at) as dt FROM deposit_requests WHERE status = 'approved'
             UNION ALL
             SELECT player_id as uid, COALESCE(resolved_at, created_at) as dt FROM agent_deposit_requests WHERE status = 'approved'
           ) d14 ON d14.uid = u.id
           WHERE u.affiliate_id IS NOT NULL AND d14.dt >= NOW() - INTERVAL '14 days'
           GROUP BY u.affiliate_id
         ) ap ON ap.affiliate_id = a.id
         LEFT JOIN (
           SELECT u.affiliate_id, COALESCE(SUM(dep.amount), 0) as deposits
           FROM users u
           JOIN (
             SELECT user_id as uid, amount, COALESCE(reviewed_at, created_at) as dt FROM deposit_requests WHERE status = 'approved'
             UNION ALL
             SELECT player_id as uid, amount, COALESCE(resolved_at, created_at) as dt FROM agent_deposit_requests WHERE status = 'approved'
           ) dep ON dep.uid = u.id
           WHERE u.affiliate_id IS NOT NULL AND ${rangeSql('dep.dt')}
           GROUP BY u.affiliate_id
         ) dp ON dp.affiliate_id = a.id
         LEFT JOIN (
           SELECT affiliate_id,
                  COALESCE(SUM(amount) FILTER (WHERE status = 'approved'), 0) as commissions_earned,
                  COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0) as pending_commissions
           FROM affiliate_commissions
           WHERE ${rangeSql('created_at')}
           GROUP BY affiliate_id
         ) cm ON cm.affiliate_id = a.id
         WHERE a.approval_status = 'approved' ${hasAff ? 'AND a.id = $3' : ''}
         ORDER BY commissions_earned DESC, deposits DESC, new_players DESC, a.created_at DESC
         LIMIT 25`,
        baseParams
      ),
      query(`SELECT min_monthly_players FROM affiliate_commission_rules WHERE commission_type = 'target' LIMIT 1`)
    ]);

    const RULE_LABELS: Array<{ type: string; label: string }> = [
      { type: 'registration', label: 'Registration' },
      { type: 'first_deposit', label: 'First Deposit' },
      { type: 'regular_deposit', label: 'Regular Deposit' },
      { type: 'target', label: 'Monthly Target' },
      { type: 'monthly', label: 'Monthly Active' },
      { type: 'loyalty', label: 'Loyalty Retention' }
    ];

    const typeMap = new Map<string, any>();
    for (const row of commTypeRes.rows) typeMap.set(row.commission_type, row);

    let approvedCommissions = 0;
    let pendingCommissions = 0;
    let reversedCommissions = 0;
    let pendingCount = 0;
    const typeBreakdown = RULE_LABELS.map(({ type, label }) => {
      const r = typeMap.get(type);
      const approved = parseFloat(r?.approved_amt || '0');
      const pending = parseFloat(r?.pending_amt || '0');
      const reversed = parseFloat(r?.reversed_amt || '0');
      const count = parseInt(r?.tx_count || '0', 10);
      const pendCnt = parseInt(r?.pending_count || '0', 10);
      approvedCommissions += approved;
      pendingCommissions += pending;
      reversedCommissions += reversed;
      pendingCount += pendCnt;
      return {
        commissionType: type,
        label,
        count,
        approvedAmt: approved,
        pendingAmt: pending,
        totalAmt: approved + pending
      };
    });

    const depRow = depKpiRes.rows[0] || {};
    const wdRow = wdSummaryRes.rows[0] || {};
    const defTarget = parseInt(defaultTargetRes.rows[0]?.min_monthly_players || '50', 10);

    // Merge trend buckets
    const bucketDataMap = new Map<string, { deposits: number; commissions: number; withdrawals: number; registrations: number }>();
    const ensureBucket = (k: string) => {
      if (!bucketDataMap.has(k)) bucketDataMap.set(k, { deposits: 0, commissions: 0, withdrawals: 0, registrations: 0 });
      return bucketDataMap.get(k)!;
    };
    for (const r of trendCommRes.rows) ensureBucket(r.bucket_key).commissions = parseFloat(r.commissions || '0');
    for (const r of trendDepRes.rows) ensureBucket(r.bucket_key).deposits = parseFloat(r.deposits || '0');
    for (const r of trendRegRes.rows) ensureBucket(r.bucket_key).registrations = parseInt(r.registrations || '0', 10);
    for (const r of trendWdRes.rows) ensureBucket(r.bucket_key).withdrawals = parseFloat(r.withdrawals || '0');

    const seedKeys = buildContiguousBuckets(trendFrom, range.to, granularity);
    let trendBuckets: Array<{
      bucketKey: string;
      label: string;
      subLabel: string;
      deposits: number;
      commissions: number;
      withdrawals: number;
      registrations: number;
    }>;

    if (seedKeys.length > 0) {
      trendBuckets = seedKeys.map(sk => {
        const val = bucketDataMap.get(sk.bucketKey) || { deposits: 0, commissions: 0, withdrawals: 0, registrations: 0 };
        return { ...sk, ...val };
      });
    } else {
      trendBuckets = Array.from(bucketDataMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => ({ bucketKey: k, label: k, subLabel: '', ...v }));
    }

    const leaderboard = leaderboardRes.rows.map((r: any) => ({
      id: r.id,
      affiliateCode: r.affiliate_code,
      fullName: r.full_name,
      status: r.status,
      walletBalance: parseFloat(r.wallet_balance || '0'),
      monthlyTarget: parseInt(r.monthly_target_override || defTarget || 50, 10),
      newPlayers: parseInt(r.new_players || '0', 10),
      totalPlayers: parseInt(r.total_players || '0', 10),
      activePlayers: parseInt(r.active_players || '0', 10),
      deposits: parseFloat(r.deposits || '0'),
      commissionsEarned: parseFloat(r.commissions_earned || '0'),
      pendingCommissions: parseFloat(r.pending_commissions || '0')
    }));

    return res.json({
      success: true,
      range: { from: range.from, to: range.to, period, granularity, isAllTime: range.isAllTime },
      kpis: {
        totalCommissions: approvedCommissions + pendingCommissions,
        approvedCommissions,
        pendingCommissions,
        pendingCount,
        reversedCommissions,
        generatedDeposits: parseFloat(depRow.generated_deposits || '0'),
        depositCount: parseInt(depRow.deposit_count || '0', 10),
        activeDepositors: parseInt(depRow.active_depositors || '0', 10),
        newPlayers: parseInt(playersKpiRes.rows[0]?.new_players || '0', 10),
        paidWithdrawals: parseFloat(wdRow.paid_amt || '0'),
        approvedWithdrawals: parseFloat(wdRow.approved_amt || '0'),
        pendingWithdrawals: parseFloat(wdRow.pending_amt || '0'),
        rejectedWithdrawals: parseFloat(wdRow.rejected_amt || '0'),
        withdrawalsCount: parseInt(wdRow.total_count || '0', 10)
      },
      trendBuckets,
      typeBreakdown,
      leaderboard,
      withdrawals: wdRowsRes.rows
    });
  } catch (err: any) {
    console.error('❌ [Affiliate Reports Error]:', err);
    return res.status(500).json({ success: false, error: 'Failed to generate affiliate reports' });
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
