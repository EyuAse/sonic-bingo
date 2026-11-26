import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, withTransaction } from '../db.ts';
import { isWithinWithdrawalSchedule, logAffiliateAudit } from '../services/affiliateCommissionService.ts';

export const affiliatePortalRouter = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'lomi_bingo_super_secret_production_key_2026_et';

interface AffiliateAuthRequest extends Request {
  affiliate?: any;
  impersonatedByAdmin?: string | null;
}

function normalizePhone(raw: string): string {
  const clean = String(raw || '').trim().replace(/^\+?251/, '0').replace(/[\s\-()]/g, '');
  if (!clean) return '';
  return clean.startsWith('0') ? clean : `0${clean}`;
}

async function requireAffiliate(req: AffiliateAuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) {
      return res.status(401).json({ success: false, error: 'Affiliate authentication required' });
    }

    const decoded: any = jwt.verify(token, JWT_SECRET);
    if (!decoded || decoded.role !== 'affiliate' || !decoded.id) {
      return res.status(401).json({ success: false, error: 'Invalid affiliate session token' });
    }

    const affRes = await query(`SELECT * FROM affiliates WHERE id = $1 LIMIT 1`, [decoded.id]);
    if (affRes.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Affiliate account not found' });
    }

    const aff = affRes.rows[0];
    if (!decoded.impersonatedByAdmin) {
      if (aff.approval_status !== 'approved') {
        return res.status(403).json({
          success: false,
          error: 'Only approved affiliates can access the affiliate dashboard.'
        });
      }
      if (aff.status === 'suspended') {
        return res.status(403).json({
          success: false,
          error: 'Your affiliate account has been suspended. Please contact support.'
        });
      }
    }

    req.affiliate = aff;
    req.impersonatedByAdmin = decoded.impersonatedByAdmin || null;
    next();
  } catch (err: any) {
    return res.status(401).json({ success: false, error: 'Session expired or invalid. Please sign in again.' });
  }
}

/**
 * POST /api/affiliate-portal/login
 */
affiliatePortalRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { phone, password } = req.body || {};
    const cleanPhone = normalizePhone(phone || '');
    const cleanPass = String(password || '').trim();

    if (!cleanPhone || !cleanPass) {
      return res.status(400).json({ success: false, error: 'Phone number and password are required' });
    }

    const affRes = await query(`SELECT * FROM affiliates WHERE phone = $1 LIMIT 1`, [cleanPhone]);
    if (affRes.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid phone number or password' });
    }

    const aff = affRes.rows[0];
    const validPass = await bcrypt.compare(cleanPass, aff.password_hash || '');
    if (!validPass) {
      return res.status(401).json({ success: false, error: 'Invalid phone number or password' });
    }

    if (aff.approval_status === 'pending') {
      return res.status(403).json({
        success: false,
        error: 'Your affiliate application is still pending Admin approval.'
      });
    }
    if (aff.approval_status === 'rejected') {
      return res.status(403).json({
        success: false,
        error: aff.rejection_reason
          ? `Your application was declined: ${aff.rejection_reason}`
          : 'Your affiliate application was declined.'
      });
    }
    if (aff.status === 'suspended') {
      return res.status(403).json({
        success: false,
        error: 'Your affiliate account is currently suspended. Contact Admin.'
      });
    }

    const token = jwt.sign(
      {
        id: aff.id,
        affiliateCode: aff.affiliate_code,
        fullName: aff.full_name,
        phone: aff.phone,
        role: 'affiliate'
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      token,
      affiliate: {
        id: aff.id,
        affiliateCode: aff.affiliate_code,
        fullName: aff.full_name,
        phone: aff.phone,
        payoutMethod: aff.payout_method,
        payoutAccount: aff.payout_account,
        payoutAccountName: aff.payout_account_name,
        status: aff.status,
        approvalStatus: aff.approval_status
      }
    });
  } catch (err: any) {
    console.error('❌ [Affiliate Portal Login Error]:', err);
    return res.status(500).json({ success: false, error: 'Affiliate login failed' });
  }
});

/**
 * GET /api/affiliate-portal/overview
 */
affiliatePortalRouter.get('/overview', requireAffiliate, async (req: AffiliateAuthRequest, res: Response) => {
  try {
    const aff = req.affiliate;

    const [playersRes, depositsRes, targetRuleRes, payoutRes, activeRulesRes] = await Promise.all([
      query(
        `SELECT
           COUNT(*) as total_players,
           COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as new_players_30d,
           COUNT(*) FILTER (
             WHERE TO_CHAR((created_at AT TIME ZONE 'Africa/Addis_Ababa')::date, 'YYYY-MM') =
                   TO_CHAR((NOW() AT TIME ZONE 'Africa/Addis_Ababa')::date, 'YYYY-MM')
           ) as month_players
         FROM users
         WHERE affiliate_id = $1`,
        [aff.id]
      ),
      query(
        `SELECT
           COALESCE(SUM(dep.amount), 0) as lifetime_deposits,
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
         WHERE u.affiliate_id = $1`,
        [aff.id]
      ),
      query(`SELECT min_monthly_players FROM affiliate_commission_rules WHERE commission_type = 'target' LIMIT 1`),
      query(`SELECT * FROM affiliate_payout_settings WHERE id = 1`),
      query(
        `SELECT commission_type, display_name, calc_mode, rate_or_amount, min_qualifying_deposit, min_monthly_players, is_active
         FROM affiliate_commission_rules
         WHERE is_active = TRUE
         ORDER BY id ASC`
      )
    ]);

    const pRow = playersRes.rows[0] || {};
    const dRow = depositsRes.rows[0] || {};
    const defaultTarget = parseInt(targetRuleRes.rows[0]?.min_monthly_players || '50', 10);
    const monthlyTarget = Math.max(1, parseInt(aff.monthly_target_override || defaultTarget || 50, 10));
    const monthPlayersCount = parseInt(pRow.month_players || '0', 10);
    const targetProgressPct = Math.min(100, Math.round((monthPlayersCount / monthlyTarget) * 100));

    const settings = payoutRes.rows[0] || {
      min_withdrawal_amount: 100,
      payout_schedule_mode: 'end_of_month',
      payout_window_days: 3
    };
    const scheduleStatus = isWithinWithdrawalSchedule(settings);

    return res.json({
      success: true,
      overview: {
        id: aff.id,
        affiliateCode: aff.affiliate_code,
        fullName: aff.full_name,
        phone: aff.phone,
        status: aff.status,
        approvalStatus: aff.approval_status,
        payoutMethod: aff.payout_method,
        payoutAccount: aff.payout_account,
        payoutAccountName: aff.payout_account_name,
        totalPlayers: parseInt(pRow.total_players || '0', 10),
        newPlayers30d: parseInt(pRow.new_players_30d || '0', 10),
        activePlayers14d: parseInt(dRow.active_players_14d || '0', 10),
        monthPlayersCount,
        monthlyTarget,
        targetProgressPct,
        totalDeposits30d: parseFloat(dRow.deposits_30d || '0'),
        lifetimeDeposits: parseFloat(dRow.lifetime_deposits || '0'),
        walletBalance: parseFloat(aff.wallet_balance || '0'),
        pendingCommission: parseFloat(aff.pending_commission || '0'),
        totalEarned: parseFloat(aff.total_earned || '0'),
        totalWithdrawn: parseFloat(aff.total_withdrawn || '0'),
        payoutSettings: {
          minWithdrawalAmount: parseFloat(settings.min_withdrawal_amount || '100'),
          payoutScheduleMode: settings.payout_schedule_mode || 'end_of_month',
          payoutWindowDays: parseInt(settings.payout_window_days || '3', 10)
        },
        scheduleStatus,
        activeRules: activeRulesRes.rows,
        impersonatedByAdmin: req.impersonatedByAdmin || null,
        botUsername: process.env.TELEGRAM_BOT_USERNAME || 'LomiBingobot'
      }
    });
  } catch (err: any) {
    console.error('❌ [Affiliate Portal Overview Error]:', err);
    return res.status(500).json({ success: false, error: 'Failed to load affiliate dashboard' });
  }
});

/**
 * GET /api/affiliate-portal/players
 */
affiliatePortalRouter.get('/players', requireAffiliate, async (req: AffiliateAuthRequest, res: Response) => {
  try {
    const aff = req.affiliate;
    const filter = typeof req.query.filter === 'string' ? req.query.filter : 'all';
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 25, 1), 100);
    const offset = (page - 1) * limit;

    const params: any[] = [aff.id];
    const baseConditions: string[] = [`u.affiliate_id = $1`];

    if (search) {
      params.push(`%${search}%`);
      const idx = params.length;
      baseConditions.push(`(COALESCE(u.full_name, '') ILIKE $${idx} OR COALESCE(u.phone, '') ILIKE $${idx})`);
    }

    let filterCondition = '';
    if (filter === 'new_30d') {
      filterCondition = `WHERE p.created_at >= NOW() - INTERVAL '30 days'`;
    } else if (filter === 'active_14d') {
      filterCondition = `WHERE p.is_active_14d = TRUE`;
    } else if (filter === 'inactive') {
      filterCondition = `WHERE p.is_active_14d = FALSE`;
    }

    const cteSql = `
      WITH player_stats AS (
        SELECT
          u.id,
          u.full_name,
          u.phone,
          u.created_at,
          (u.created_at >= NOW() - INTERVAL '30 days') as is_new_30d,
          COALESCE(SUM(dep.amount), 0) as total_deposits,
          COUNT(dep.amount) as deposit_count,
          MAX(dep.approved_at) as last_deposit_at,
          COALESCE(BOOL_OR(dep.approved_at >= NOW() - INTERVAL '14 days'), FALSE) as is_active_14d
        FROM users u
        LEFT JOIN (
          SELECT user_id as uid, amount, COALESCE(reviewed_at, created_at) as approved_at
          FROM deposit_requests WHERE status = 'approved'
          UNION ALL
          SELECT player_id as uid, amount, COALESCE(resolved_at, created_at) as approved_at
          FROM agent_deposit_requests WHERE status = 'approved'
        ) dep ON dep.uid = u.id
        WHERE ${baseConditions.join(' AND ')}
        GROUP BY u.id, u.full_name, u.phone, u.created_at
      )
    `;

    const [countRes, rowsRes] = await Promise.all([
      query(`${cteSql} SELECT COUNT(*) as total FROM player_stats p ${filterCondition}`, params),
      query(
        `${cteSql}
         SELECT * FROM player_stats p
         ${filterCondition}
         ORDER BY p.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      )
    ]);

    const totalCount = parseInt(countRes.rows[0]?.total || '0', 10);
    return res.json({
      success: true,
      players: rowsRes.rows.map((r: any) => ({
        id: r.id,
        fullName: r.full_name || 'Player',
        phone: r.phone || '—',
        createdAt: r.created_at,
        isNew30d: Boolean(r.is_new_30d),
        isActive14d: Boolean(r.is_active_14d),
        totalDeposits: parseFloat(r.total_deposits || '0'),
        depositCount: parseInt(r.deposit_count || '0', 10),
        lastDepositAt: r.last_deposit_at || null
      })),
      totalCount,
      page,
      totalPages: Math.ceil(totalCount / limit) || 1
    });
  } catch (err: any) {
    console.error('❌ [Affiliate Portal Players Error]:', err);
    return res.status(500).json({ success: false, error: 'Failed to load referred players' });
  }
});

/**
 * GET /api/affiliate-portal/players/:pid/deposits
 * Strictly enforces single-affiliate ownership (u.affiliate_id = req.affiliate.id)
 */
affiliatePortalRouter.get('/players/:pid/deposits', requireAffiliate, async (req: AffiliateAuthRequest, res: Response) => {
  try {
    const aff = req.affiliate;
    const pid = req.params.pid;

    const ownerCheck = await query(
      `SELECT id, full_name, phone, created_at FROM users WHERE id = $1 AND affiliate_id = $2 LIMIT 1`,
      [pid, aff.id]
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Referred player not found' });
    }

    const depRes = await query(
      `SELECT id, amount, payment_method, transaction_ref, status, created_at, reviewed_at as resolved_at, 'direct' as channel
       FROM deposit_requests
       WHERE user_id = $1
       UNION ALL
       SELECT id, amount, payment_method, transaction_code as transaction_ref, status, created_at, resolved_at, 'agent' as channel
       FROM agent_deposit_requests
       WHERE player_id = $1
       ORDER BY created_at DESC
       LIMIT 60`,
      [pid]
    );

    const p = ownerCheck.rows[0];
    return res.json({
      success: true,
      player: {
        id: p.id,
        fullName: p.full_name || 'Player',
        phone: p.phone || '—',
        createdAt: p.created_at
      },
      deposits: depRes.rows.map((d: any) => ({
        id: d.id,
        amount: parseFloat(d.amount || '0'),
        paymentMethod: d.payment_method,
        transactionRef: d.transaction_ref,
        status: d.status,
        channel: d.channel,
        createdAt: d.created_at,
        resolvedAt: d.resolved_at
      }))
    });
  } catch (err: any) {
    console.error('❌ [Affiliate Player Deposits Error]:', err);
    return res.status(500).json({ success: false, error: 'Failed to load player deposit history' });
  }
});

/**
 * GET /api/affiliate-portal/commissions
 */
affiliatePortalRouter.get('/commissions', requireAffiliate, async (req: AffiliateAuthRequest, res: Response) => {
  try {
    const aff = req.affiliate;
    const type = typeof req.query.type === 'string' ? req.query.type : 'all';
    const status = typeof req.query.status === 'string' ? req.query.status : 'all';
    const fromDate = typeof req.query.from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.from) ? req.query.from : '';
    const toDate = typeof req.query.to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.to) ? req.query.to : '';
    const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 25, 1), 100);
    const offset = (page - 1) * limit;

    const params: any[] = [aff.id];
    const conditions: string[] = [`c.affiliate_id = $1`];

    if (['registration', 'first_deposit', 'regular_deposit', 'target', 'monthly', 'loyalty'].includes(type)) {
      params.push(type);
      conditions.push(`c.commission_type = $${params.length}`);
    }
    if (['pending', 'approved', 'rejected', 'reversed'].includes(status)) {
      params.push(status);
      conditions.push(`c.status = $${params.length}`);
    }
    if (fromDate) {
      params.push(fromDate);
      conditions.push(`c.created_at >= ($${params.length}::date AT TIME ZONE 'Africa/Addis_Ababa')`);
    }
    if (toDate) {
      params.push(toDate);
      conditions.push(`c.created_at < (($${params.length}::date + INTERVAL '1 day') AT TIME ZONE 'Africa/Addis_Ababa')`);
    }

    const whereSql = `WHERE ${conditions.join(' AND ')}`;

    const [countRes, rowsRes, summaryRes] = await Promise.all([
      query(`SELECT COUNT(*) as total FROM affiliate_commissions c ${whereSql}`, params),
      query(
        `SELECT c.*, u.full_name as player_name, u.phone as player_phone
         FROM affiliate_commissions c
         LEFT JOIN users u ON c.player_user_id = u.id
         ${whereSql}
         ORDER BY c.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      ),
      query(
        `SELECT
           c.commission_type,
           COALESCE(SUM(c.amount) FILTER (WHERE c.status = 'approved'), 0) as approved_amt,
           COALESCE(SUM(c.amount) FILTER (WHERE c.status = 'pending'), 0) as pending_amt,
           COALESCE(SUM(c.amount) FILTER (WHERE c.status = 'reversed'), 0) as reversed_amt,
           COUNT(*) as tx_count
         FROM affiliate_commissions c
         WHERE c.affiliate_id = $1
         GROUP BY c.commission_type`,
        [aff.id]
      )
    ]);

    const TYPES = [
      { type: 'registration', label: 'Registration' },
      { type: 'first_deposit', label: 'First Deposit' },
      { type: 'regular_deposit', label: 'Regular Deposit' },
      { type: 'target', label: 'Monthly Target' },
      { type: 'monthly', label: 'Monthly Active' },
      { type: 'loyalty', label: 'Loyalty' }
    ];
    const map = new Map<string, any>();
    summaryRes.rows.forEach((r: any) => map.set(r.commission_type, r));

    const breakdown = TYPES.map(t => {
      const r = map.get(t.type);
      const approvedAmt = parseFloat(r?.approved_amt || '0');
      const pendingAmt = parseFloat(r?.pending_amt || '0');
      return {
        commissionType: t.type,
        label: t.label,
        count: parseInt(r?.tx_count || '0', 10),
        approvedAmt,
        pendingAmt,
        totalAmt: approvedAmt + pendingAmt
      };
    });

    const totalCount = parseInt(countRes.rows[0]?.total || '0', 10);
    return res.json({
      success: true,
      commissions: rowsRes.rows,
      breakdown,
      totalCount,
      page,
      totalPages: Math.ceil(totalCount / limit) || 1
    });
  } catch (err: any) {
    console.error('❌ [Affiliate Portal Commissions Error]:', err);
    return res.status(500).json({ success: false, error: 'Failed to load commissions history' });
  }
});

/**
 * GET /api/affiliate-portal/wallet
 */
affiliatePortalRouter.get('/wallet', requireAffiliate, async (req: AffiliateAuthRequest, res: Response) => {
  try {
    const aff = req.affiliate;

    const [txRes, wdRes, payoutRes] = await Promise.all([
      query(
        `SELECT * FROM affiliate_wallet_transactions WHERE affiliate_id = $1 ORDER BY created_at DESC LIMIT 60`,
        [aff.id]
      ),
      query(
        `SELECT * FROM affiliate_withdrawal_requests WHERE affiliate_id = $1 ORDER BY created_at DESC LIMIT 40`,
        [aff.id]
      ),
      query(`SELECT * FROM affiliate_payout_settings WHERE id = 1`)
    ]);

    const settings = payoutRes.rows[0] || {
      min_withdrawal_amount: 100,
      payout_schedule_mode: 'end_of_month',
      payout_window_days: 3
    };
    const scheduleStatus = isWithinWithdrawalSchedule(settings);

    return res.json({
      success: true,
      wallet: {
        walletBalance: parseFloat(aff.wallet_balance || '0'),
        pendingCommission: parseFloat(aff.pending_commission || '0'),
        totalEarned: parseFloat(aff.total_earned || '0'),
        totalWithdrawn: parseFloat(aff.total_withdrawn || '0'),
        payoutMethod: aff.payout_method,
        payoutAccount: aff.payout_account,
        payoutAccountName: aff.payout_account_name,
        payoutSettings: {
          minWithdrawalAmount: parseFloat(settings.min_withdrawal_amount || '100'),
          payoutScheduleMode: settings.payout_schedule_mode || 'end_of_month',
          payoutWindowDays: parseInt(settings.payout_window_days || '3', 10)
        },
        scheduleStatus,
        transactions: txRes.rows,
        withdrawals: wdRes.rows
      }
    });
  } catch (err: any) {
    console.error('❌ [Affiliate Portal Wallet Error]:', err);
    return res.status(500).json({ success: false, error: 'Failed to load wallet data' });
  }
});

/**
 * POST /api/affiliate-portal/withdrawals
 */
affiliatePortalRouter.post('/withdrawals', requireAffiliate, async (req: AffiliateAuthRequest, res: Response) => {
  try {
    const aff = req.affiliate;
    if (aff.status !== 'active' || aff.approval_status !== 'approved') {
      return res.status(403).json({ success: false, error: 'Only active, approved affiliates can request withdrawals.' });
    }

    const amount = Number(Number(req.body?.amount || 0).toFixed(2));
    const payoutMethod = String(req.body?.payoutMethod || aff.payout_method || 'Telebirr').trim();
    const payoutAccount = String(req.body?.payoutAccount || aff.payout_account || aff.phone || '').trim();
    const payoutAccountName = String(req.body?.payoutAccountName || aff.payout_account_name || aff.full_name || '').trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Please enter a valid withdrawal amount.' });
    }
    if (!payoutAccount) {
      return res.status(400).json({ success: false, error: 'Payout account / phone number is required.' });
    }

    const payoutRes = await query(`SELECT * FROM affiliate_payout_settings WHERE id = 1`);
    const settings = payoutRes.rows[0] || {
      min_withdrawal_amount: 100,
      payout_schedule_mode: 'end_of_month',
      payout_window_days: 3
    };

    const scheduleStatus = isWithinWithdrawalSchedule(settings);
    if (!scheduleStatus.allowed) {
      return res.status(400).json({
        success: false,
        error: `Monthly withdrawal window is currently closed. Next open payout window: ${scheduleStatus.nextWindowLabel}.`
      });
    }

    const minWithdrawal = parseFloat(settings.min_withdrawal_amount || '100');
    if (amount < minWithdrawal) {
      return res.status(400).json({
        success: false,
        error: `Minimum withdrawal amount is ETB ${minWithdrawal.toFixed(2)}.`
      });
    }

    const result = await withTransaction(async (client) => {
      const lockRes = await client.query(
        `SELECT id, wallet_balance, status, approval_status FROM affiliates WHERE id = $1 FOR UPDATE`,
        [aff.id]
      );
      const locked = lockRes.rows[0];
      if (!locked || locked.status !== 'active' || locked.approval_status !== 'approved') {
        throw new Error('Affiliate account is not eligible for withdrawal');
      }

      const currentBal = parseFloat(locked.wallet_balance || '0');
      if (currentBal < amount) {
        throw new Error(`Insufficient wallet balance (Available: ETB ${currentBal.toFixed(2)})`);
      }

      const newBal = Number((currentBal - amount).toFixed(2));
      await client.query(`UPDATE affiliates SET wallet_balance = $1, updated_at = NOW() WHERE id = $2`, [newBal, aff.id]);

      const wdInsert = await client.query(
        `INSERT INTO affiliate_withdrawal_requests (
           affiliate_id, amount, payout_method, payout_account, payout_account_name, status
         ) VALUES ($1, $2, $3, $4, $5, 'pending')
         RETURNING *`,
        [aff.id, amount, payoutMethod, payoutAccount, payoutAccountName]
      );
      const wd = wdInsert.rows[0];

      await client.query(
        `INSERT INTO affiliate_wallet_transactions (affiliate_id, type, amount, balance_after, reason, reference_id)
         VALUES ($1, 'withdrawal_hold', $2, $3, $4, $5)`,
        [aff.id, -amount, newBal, `Withdrawal request (${payoutMethod}: ${payoutAccount})`, wd.id]
      );

      await logAffiliateAudit(
        client.query.bind(client),
        { id: aff.id, fullName: `${aff.full_name} (${aff.affiliate_code})` },
        'AFFILIATE_WITHDRAWAL_REQUESTED',
        'affiliate_withdrawal',
        wd.id,
        { walletBalance: currentBal },
        { walletBalance: newBal, requestedAmount: amount, payoutMethod, payoutAccount }
      );

      return { withdrawal: wd, newBalance: newBal };
    });

    return res.status(201).json({
      success: true,
      withdrawal: result.withdrawal,
      walletBalance: result.newBalance
    });
  } catch (err: any) {
    console.error('❌ [Affiliate Withdrawal Request Error]:', err);
    return res.status(400).json({ success: false, error: err?.message || 'Withdrawal request failed' });
  }
});

/**
 * PUT /api/affiliate-portal/profile
 */
affiliatePortalRouter.put('/profile', requireAffiliate, async (req: AffiliateAuthRequest, res: Response) => {
  try {
    const aff = req.affiliate;
    const { fullName, phone, payoutMethod, payoutAccount, payoutAccountName, currentPassword, newPassword } = req.body || {};

    const nextName = fullName !== undefined ? String(fullName).trim() : aff.full_name;
    const nextPhone = phone !== undefined ? normalizePhone(phone) : aff.phone;
    const nextMethod = payoutMethod !== undefined ? String(payoutMethod).trim() : aff.payout_method;
    const nextAccount = payoutAccount !== undefined ? String(payoutAccount).trim() : aff.payout_account;
    const nextAccountName = payoutAccountName !== undefined ? String(payoutAccountName).trim() : aff.payout_account_name;

    if (nextName.length < 2) {
      return res.status(400).json({ success: false, error: 'Full name must be at least 2 characters.' });
    }
    if (nextPhone.length < 9) {
      return res.status(400).json({ success: false, error: 'Valid Ethiopian phone number is required.' });
    }

    if (nextPhone !== aff.phone) {
      const dup = await query(`SELECT id FROM affiliates WHERE phone = $1 AND id <> $2 LIMIT 1`, [nextPhone, aff.id]);
      if (dup.rows.length > 0) {
        return res.status(400).json({ success: false, error: 'Phone number is already used by another affiliate.' });
      }
    }

    let nextHash = aff.password_hash;
    if (newPassword && String(newPassword).trim()) {
      const cleanNewPass = String(newPassword).trim();
      if (cleanNewPass.length < 4) {
        return res.status(400).json({ success: false, error: 'New password must be at least 4 characters.' });
      }
      if (!req.impersonatedByAdmin) {
        const match = await bcrypt.compare(String(currentPassword || ''), aff.password_hash || '');
        if (!match) {
          return res.status(400).json({ success: false, error: 'Current password is incorrect.' });
        }
      }
      nextHash = await bcrypt.hash(cleanNewPass, 10);
    }

    const upRes = await query(
      `UPDATE affiliates
       SET full_name = $1, phone = $2, payout_method = $3, payout_account = $4,
           payout_account_name = $5, password_hash = $6, updated_at = NOW()
       WHERE id = $7
       RETURNING id, affiliate_code, full_name, phone, payout_method, payout_account, payout_account_name, status, approval_status`,
      [nextName, nextPhone, nextMethod, nextAccount, nextAccountName, nextHash, aff.id]
    );

    const updated = upRes.rows[0];
    return res.json({
      success: true,
      affiliate: {
        id: updated.id,
        affiliateCode: updated.affiliate_code,
        fullName: updated.full_name,
        phone: updated.phone,
        payoutMethod: updated.payout_method,
        payoutAccount: updated.payout_account,
        payoutAccountName: updated.payout_account_name,
        status: updated.status,
        approvalStatus: updated.approval_status
      }
    });
  } catch (err: any) {
    console.error('❌ [Affiliate Profile Update Error]:', err);
    return res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
});
