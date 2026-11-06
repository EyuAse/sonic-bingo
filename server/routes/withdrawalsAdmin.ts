import express, { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query, withTransaction } from '../db.ts';
import { io } from '../io.ts';
import { telegramBotService } from '../services/telegramBotService.ts';

const router = Router();

// Ensure DB columns and settings table exist for enhanced withdrawal tracking
let isSchemaMigrated = false;
async function ensureWithdrawalColumns() {
  if (isSchemaMigrated) return;
  try {
    await query(`
      ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS payout_reference VARCHAR(100);
      ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
      ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS admin_note TEXT;
      ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS reviewed_by_name VARCHAR(100);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_kyc_verified BOOLEAN DEFAULT false;

      CREATE TABLE IF NOT EXISTS withdrawal_settings (
        id VARCHAR(50) PRIMARY KEY DEFAULT 'default',
        current_pin VARCHAR(20) DEFAULT '5678',
        max_request_limit NUMERIC(10, 2) DEFAULT 5000,
        high_value_threshold NUMERIC(10, 2) DEFAULT 2000,
        min_request_limit NUMERIC(10, 2) DEFAULT 50,
        require_kyc_verification BOOLEAN DEFAULT false,
        require_turnover_met BOOLEAN DEFAULT true,
        strict_name_matching BOOLEAN DEFAULT true,
        telegram_player_alerts BOOLEAN DEFAULT true,
        auto_refresh_seconds INT DEFAULT 15,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      INSERT INTO withdrawal_settings (id, current_pin, max_request_limit, high_value_threshold, min_request_limit, require_kyc_verification, require_turnover_met, strict_name_matching, telegram_player_alerts, auto_refresh_seconds)
      VALUES ('default', '5678', 5000, 2000, 50, false, true, true, true, 15)
      ON CONFLICT (id) DO NOTHING;
    `);
    isSchemaMigrated = true;
  } catch (err) {
    console.warn('⚠️ [Withdrawals Admin] Column/Settings migration note:', err);
  }
}
ensureWithdrawalColumns().catch(() => {});

const JWT_SECRET = process.env.JWT_SECRET || 'sonic_bingo_super_secret_production_key_2026_et';
const WITHDRAWAL_ADMIN_PIN = process.env.WITHDRAWAL_ADMIN_PIN || '5678';
const SUPER_ADMIN_PIN = process.env.ADMIN_PIN || '1234';

export interface WithdrawalAdminUser {
  role: 'withdrawal_admin' | 'admin';
  name: string;
}

export interface WithdrawalAdminRequest extends Request {
  adminUser?: WithdrawalAdminUser;
}

/**
 * Authentication Middleware for Withdrawal Officers
 */
export const requireWithdrawalAdmin = (req: WithdrawalAdminRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization || (req.headers['x-admin-token'] as string);
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authorization token required.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.role !== 'withdrawal_admin' && decoded.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Access restricted to Withdrawal Officers.' });
    }
    req.adminUser = {
      role: decoded.role,
      name: decoded.name || 'Withdrawal Officer'
    };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid or expired session token.' });
  }
};

/**
 * POST /api/withdrawals-admin/login
 * Authenticates Withdrawal Officer via PIN and returns JWT
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { pin } = req.body;
    if (!pin) {
      return res.status(400).json({ success: false, error: 'PIN is required' });
    }

    const cleanPin = String(pin).trim();

    // Query active PIN from DB settings (with fallback to environment default)
    let dbOfficerPin = WITHDRAWAL_ADMIN_PIN;
    try {
      const pinRes = await query(`SELECT current_pin FROM withdrawal_settings WHERE id = 'default' LIMIT 1`);
      if (pinRes.rows[0]?.current_pin) {
        dbOfficerPin = String(pinRes.rows[0].current_pin).trim();
      }
    } catch (e) {
      // Fallback to env default
    }

    const isWithdrawalOfficer = cleanPin === dbOfficerPin || cleanPin === WITHDRAWAL_ADMIN_PIN;
    const isSuperAdmin = cleanPin === SUPER_ADMIN_PIN;

    if (!isWithdrawalOfficer && !isSuperAdmin) {
      return res.status(401).json({ success: false, error: 'Invalid Security PIN. Access denied.' });
    }

    const role = isSuperAdmin ? 'admin' : 'withdrawal_admin';
    const name = isSuperAdmin ? 'Super Admin' : 'Withdrawal Officer';

    const token = jwt.sign(
      { role, name, desk: 'withdrawals' },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    return res.json({
      success: true,
      token,
      admin: { role, name }
    });
  } catch (err: any) {
    console.error('❌ [Withdrawal Admin Login Error]:', err);
    return res.status(500).json({ success: false, error: 'Login authentication failed' });
  }
});

/**
 * GET /api/withdrawals-admin/queue
 * Returns pending withdrawal requests with 5 automated AML/compliance checks & live KPIs
 */
router.get('/queue', requireWithdrawalAdmin, async (_req: WithdrawalAdminRequest, res: Response) => {
  try {
    await ensureWithdrawalColumns();

    // 1. Fetch pending requests joined with user profile, wallet and historical turnover data
    const queryStr = `
      SELECT 
        w.id,
        w.user_id,
        w.amount,
        w.payment_method,
        w.account_phone,
        w.account_name,
        w.status,
        w.created_at,
        u.full_name as user_full_name,
        u.phone as user_phone,
        u.status as user_status,
        u.is_kyc_verified,
        u.created_at as user_joined_at,
        COALESCE(wal.balance, 0) as wallet_balance,
        COALESCE((SELECT SUM(amount) FROM deposit_requests WHERE user_id = u.id AND status = 'approved'), 0) as total_deposited,
        COALESCE((SELECT SUM(amount) FROM withdrawal_requests WHERE user_id = u.id AND status = 'approved'), 0) as total_withdrawn,
        (
          COALESCE((SELECT SUM(bet_amount) FROM game_tickets WHERE user_id = u.id), 0) +
          COALESCE((SELECT SUM(amount) FROM wallet_transactions WHERE user_id = u.id AND type IN ('stake', 'bingo_stake', 'game_stake')), 0)
        ) as total_staked
      FROM withdrawal_requests w
      JOIN users u ON w.user_id = u.id
      LEFT JOIN wallets wal ON wal.user_id = u.id
      WHERE w.status = 'pending'
      ORDER BY w.created_at ASC
    `;

    const queueRes = await query(queryStr);
    const now = Date.now();

    // 2. Format queue items and compute compliance checks matching Enqu specification
    const queue = await Promise.all(queueRes.rows.map(async (row) => {
      const createdAtMs = new Date(row.created_at).getTime();
      const waitingMinutes = Math.max(0, Math.floor((now - createdAtMs) / 60000));
      const waitingHours = Math.floor(waitingMinutes / 60);
      const waitingMins = waitingMinutes % 60;
      const waitingDuration = waitingHours > 0 ? `${waitingHours}h ${waitingMins}m` : `${waitingMinutes} min`;

      const totalDeposited = parseFloat(row.total_deposited || '0');
      const totalWithdrawn = parseFloat(row.total_withdrawn || '0');
      const totalStaked = parseFloat(row.total_staked || '0');
      const amount = parseFloat(row.amount);
      const isSuspended = row.user_status === 'suspended';
      const isKycVerified = Boolean(row.is_kyc_verified);

      const registeredName = (row.user_full_name || '').trim();
      const payoutName = (row.account_name || registeredName).trim();
      const nameMatch = registeredName.toLowerCase() === payoutName.toLowerCase();
      const withinLimit = amount <= 5000;
      const turnoverMet = totalDeposited === 0 || totalStaked >= totalDeposited;

      // 5 Enqu Automated Compliance Checks
      const checks = [
        {
          id: 'active_account',
          ok: !isSuspended,
          label: 'Player account is active',
          title: 'Player account is active',
          passText: 'Player account is active',
          failText: `Player account is ${row.user_status || 'inactive'}`,
          failureText: `Player account is ${row.user_status || 'inactive'}`,
          isBlocker: isSuspended,
          blockApproval: isSuspended
        },
        {
          id: 'kyc_verified',
          ok: isKycVerified,
          label: 'Identity verified (KYC)',
          title: 'Identity verified (KYC)',
          passText: 'Identity verified (KYC)',
          failText: 'Identity not verified (KYC)',
          failureText: 'Identity not verified (KYC)',
          isBlocker: false,
          blockApproval: false
        },
        {
          id: 'name_match',
          ok: nameMatch,
          label: 'Payout name matches the player',
          title: 'Payout name matches the player',
          passText: 'Payout name matches the player',
          failText: `Payout name "${payoutName}" does not match "${registeredName}"`,
          failureText: `Payout name "${payoutName}" does not match "${registeredName}"`,
          isBlocker: false,
          blockApproval: false
        },
        {
          id: 'amount_limit',
          ok: withinLimit,
          label: 'Within the 5,000 ETB request limit',
          title: 'Within the 5,000 ETB request limit',
          passText: 'Within the 5,000 ETB request limit',
          failText: `Above the 5,000 ETB request limit (${amount.toLocaleString()} ETB)`,
          failureText: `Above the 5,000 ETB request limit (${amount.toLocaleString()} ETB)`,
          isBlocker: !withinLimit,
          blockApproval: !withinLimit
        },
        {
          id: 'deposit_turnover',
          ok: turnoverMet,
          label: 'Deposits played through at least once',
          title: 'Deposits played through at least once',
          passText: 'Deposits played through at least once',
          failText: `Deposits not fully played through (${totalStaked.toLocaleString()} of ${totalDeposited.toLocaleString()} ETB staked)`,
          failureText: `Deposits not fully played through (${totalStaked.toLocaleString()} of ${totalDeposited.toLocaleString()} ETB staked)`,
          isBlocker: false,
          blockApproval: false
        }
      ];

      const failedChecks = checks.filter(c => !c.ok);
      const isBlocked = checks.some(c => !c.ok && c.blockApproval);

      // Fetch last 3 historical withdrawals for this specific player
      const recRes = await query(`
        SELECT id, amount, payment_method, status, created_at, reviewed_at
        FROM withdrawal_requests
        WHERE user_id = $1 AND id != $2 AND status != 'pending'
        ORDER BY created_at DESC
        LIMIT 3
      `, [row.user_id, row.id]);

      const recentWithdrawals = recRes.rows.map(r => ({
        id: r.id,
        amount: parseFloat(r.amount),
        method: r.payment_method,
        status: r.status,
        date: new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + new Date(r.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
        createdAt: r.created_at,
        reviewedAt: r.reviewed_at
      }));

      // Short initial ID generator e.g. "W-2201"
      const displayId = row.id.length > 8 ? `W-${row.id.slice(0, 6).toUpperCase()}` : row.id;
      const playerId = `P-${row.user_id.slice(0, 5).toUpperCase()}`;

      return {
        id: row.id,
        displayId,
        playerId,
        userDisplayId: playerId,
        userId: row.user_id,
        name: registeredName,
        phone: row.account_phone || row.user_phone,
        amount,
        method: row.payment_method,
        accountPhone: row.account_phone || row.user_phone,
        destination: row.account_phone,
        accountName: payoutName,
        nameMismatch: !nameMatch,
        status: row.status,
        createdAt: row.created_at,
        waitingMinutes,
        waitingDuration,
        isLongWaiting: waitingMinutes >= 180,
        checks,
        failedChecksCount: failedChecks.length,
        isBlocked,
        isApprovalBlocked: isBlocked,
        playerActivity: {
          status: row.user_status || 'active',
          isKycVerified,
          walletBalance: parseFloat(row.wallet_balance || '0'),
          totalDeposited,
          totalWithdrawn,
          totalStaked,
          joinedDate: new Date(row.user_joined_at || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          memberSince: row.user_joined_at
        },
        recentWithdrawals
      };
    }));

    // 3. Today's live settlement metrics
    const todayStatsRes = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'approved' AND reviewed_at >= CURRENT_DATE) as approved_count,
        COALESCE(SUM(amount) FILTER (WHERE status = 'approved' AND reviewed_at >= CURRENT_DATE), 0) as approved_amount,
        COUNT(*) FILTER (WHERE status = 'rejected' AND reviewed_at >= CURRENT_DATE) as rejected_count,
        COALESCE(SUM(amount) FILTER (WHERE status = 'rejected' AND reviewed_at >= CURRENT_DATE), 0) as rejected_amount
      FROM withdrawal_requests
    `);

    const todayStats = todayStatsRes.rows[0] || {};
    const totalPendingAmount = queue.reduce((sum, item) => sum + item.amount, 0);
    const oldestPending = queue.length > 0 ? queue[0] : null;

    return res.json({
      success: true,
      queue,
      kpis: {
        pendingCount: queue.length,
        pendingAmount: totalPendingAmount,
        longestWaitingMinutes: oldestPending ? oldestPending.waitingMinutes : 0,
        longestWaitingPlayer: oldestPending ? `${oldestPending.displayId} · ${oldestPending.name}` : 'Queue is clear',
        approvedTodayCount: parseInt(todayStats.approved_count || '0', 10),
        approvedTodayAmount: parseFloat(todayStats.approved_amount || '0'),
        rejectedTodayCount: parseInt(todayStats.rejected_count || '0', 10),
        rejectedTodayAmount: parseFloat(todayStats.rejected_amount || '0'),
        needsAttentionCount: queue.filter(q => q.failedChecksCount > 0).length,
        highValueCount: queue.filter(q => q.amount >= 2000).length
      }
    });
  } catch (err: any) {
    console.error('❌ [Withdrawal Admin Queue Error]:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch withdrawal queue' });
  }
});

/**
 * GET /api/withdrawals-admin/history
 * Returns historical payouts, volumetric aggregates and chart data
 */
router.get('/history', requireWithdrawalAdmin, async (req: WithdrawalAdminRequest, res: Response) => {
  try {
    await ensureWithdrawalColumns();

    const {
      period = 'week',
      from,
      to,
      status = 'All',
      method = 'All',
      search = '',
      page = '0',
      limit = '10'
    } = req.query;

    const pageNum = Math.max(0, parseInt(String(page), 10) || 0);
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 10));
    const offset = pageNum * limitNum;

    // Date range calculation
    let dateFilter = '1=1';
    const params: any[] = [];
    let paramIdx = 1;

    if (period === 'day') {
      dateFilter = `w.created_at >= CURRENT_DATE`;
    } else if (period === 'week') {
      dateFilter = `w.created_at >= NOW() - INTERVAL '7 days'`;
    } else if (period === 'month') {
      dateFilter = `w.created_at >= NOW() - INTERVAL '30 days'`;
    } else if (period === 'custom' && from && to) {
      dateFilter = `w.created_at >= $${paramIdx}::date AND w.created_at < ($${paramIdx + 1}::date + INTERVAL '1 day')`;
      params.push(from, to);
      paramIdx += 2;
    }

    let statusFilter = '1=1';
    if (status !== 'All') {
      statusFilter = `w.status = $${paramIdx}`;
      params.push(String(status).toLowerCase());
      paramIdx++;
    }

    let methodFilter = '1=1';
    if (method !== 'All') {
      methodFilter = `w.payment_method = $${paramIdx}`;
      params.push(method);
      paramIdx++;
    }

    let searchFilter = '1=1';
    if (search && String(search).trim()) {
      const term = `%${String(search).trim()}%`;
      searchFilter = `(
        w.id::text ILIKE $${paramIdx} OR
        u.full_name ILIKE $${paramIdx} OR
        w.account_phone ILIKE $${paramIdx} OR
        COALESCE(w.payout_reference, '') ILIKE $${paramIdx} OR
        COALESCE(w.rejection_reason, '') ILIKE $${paramIdx}
      )`;
      params.push(term);
      paramIdx++;
    }

    // 1. Fetch paginated records
    const listQuery = `
      SELECT 
        w.id,
        w.user_id,
        w.amount,
        w.payment_method,
        w.account_phone,
        w.account_name,
        w.status,
        w.payout_reference,
        w.rejection_reason,
        w.admin_note,
        w.reviewed_by_name,
        w.created_at,
        w.reviewed_at,
        u.full_name as user_name,
        u.phone as user_phone,
        COALESCE(wal.balance, 0) as wallet_balance
      FROM withdrawal_requests w
      JOIN users u ON w.user_id = u.id
      LEFT JOIN wallets wal ON wal.user_id = u.id
      WHERE ${dateFilter} AND ${statusFilter} AND ${methodFilter} AND ${searchFilter}
      ORDER BY w.created_at DESC
      LIMIT ${limitNum} OFFSET ${offset}
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM withdrawal_requests w
      JOIN users u ON w.user_id = u.id
      WHERE ${dateFilter} AND ${statusFilter} AND ${methodFilter} AND ${searchFilter}
    `;

    // 2. Fetch KPIs for the selected range
    const kpiQuery = `
      SELECT 
        COUNT(*) as total_requests,
        COALESCE(SUM(w.amount), 0) as total_requested_amount,
        COUNT(*) FILTER (WHERE w.status = 'approved') as approved_count,
        COALESCE(SUM(w.amount) FILTER (WHERE w.status = 'approved'), 0) as approved_amount,
        COUNT(*) FILTER (WHERE w.status = 'rejected') as rejected_count,
        COALESCE(SUM(w.amount) FILTER (WHERE w.status = 'rejected'), 0) as rejected_amount,
        COUNT(*) FILTER (WHERE w.status = 'pending') as pending_count,
        AVG(EXTRACT(EPOCH FROM (w.reviewed_at - w.created_at)) / 60) FILTER (WHERE w.reviewed_at IS NOT NULL) as avg_decision_minutes
      FROM withdrawal_requests w
      JOIN users u ON w.user_id = u.id
      WHERE ${dateFilter} AND ${methodFilter} AND ${searchFilter}
    `;

    const [rowsRes, countRes, kpiRes] = await Promise.all([
      query(listQuery, params),
      query(countQuery, params),
      query(kpiQuery, params.slice(0, paramIdx - (status !== 'All' ? 2 : 1)))
    ]);

    const totalRecords = parseInt(countRes.rows[0]?.total || '0', 10);
    const kpis = kpiRes.rows[0] || {};

    const approvedCount = parseInt(kpis.approved_count || '0', 10);
    const rejectedCount = parseInt(kpis.rejected_count || '0', 10);
    const decidedCount = approvedCount + rejectedCount;
    const approvalRate = decidedCount > 0 ? Math.round((approvedCount / decidedCount) * 100) : 0;

    const records = rowsRes.rows.map(r => ({
      id: r.id,
      displayId: r.id.length > 8 ? `W-${r.id.slice(0, 6).toUpperCase()}` : r.id,
      playerId: `P-${r.user_id.slice(0, 5).toUpperCase()}`,
      userId: r.user_id,
      name: r.user_name,
      amount: parseFloat(r.amount),
      method: r.payment_method,
      destination: r.account_phone,
      accountName: r.account_name || r.user_name,
      status: r.status,
      ref: r.payout_reference || '',
      reason: r.rejection_reason || '',
      note: r.admin_note || '',
      by: r.reviewed_by_name || 'Withdrawal Officer',
      createdAt: r.created_at,
      reviewedAt: r.reviewed_at
    }));

    return res.json({
      success: true,
      records,
      pagination: {
        total: totalRecords,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(totalRecords / limitNum)
      },
      kpis: {
        totalRequested: parseFloat(kpis.total_requested_amount || '0'),
        totalCount: parseInt(kpis.total_requests || '0', 10),
        approvedAmount: parseFloat(kpis.approved_amount || '0'),
        approvedCount,
        approvalRate,
        rejectedAmount: parseFloat(kpis.rejected_amount || '0'),
        rejectedCount,
        pendingCount: parseInt(kpis.pending_count || '0', 10),
        avgDecisionMinutes: Math.round(parseFloat(kpis.avg_decision_minutes || '0'))
      }
    });
  } catch (err: any) {
    console.error('❌ [Withdrawal Admin History Error]:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch withdrawal history' });
  }
});

/**
 * POST /api/withdrawals-admin/:id/approve
 * Approves a withdrawal, records payout transaction ref, and notifies player via Telegram
 */
router.post('/:id/approve', requireWithdrawalAdmin, async (req: WithdrawalAdminRequest, res: Response) => {
  try {
    await ensureWithdrawalColumns();
    const requestId = req.params.id;
    const { payoutReference } = req.body;
    const adminName = req.adminUser?.name || 'Withdrawal Officer';

    const result = await withTransaction(async (client) => {
      // 1. Lock withdrawal row
      const withRes = await client.query(`
        SELECT w.*, u.full_name, u.telegram_id, u.status as user_status
        FROM withdrawal_requests w
        JOIN users u ON w.user_id = u.id
        WHERE w.id = $1
        FOR UPDATE OF w
      `, [requestId]);

      if (withRes.rows.length === 0) {
        throw new Error('Withdrawal request not found.');
      }

      const request = withRes.rows[0];
      if (request.status !== 'pending') {
        throw new Error(`Request has already been ${request.status}.`);
      }

      if (request.user_status === 'suspended') {
        throw new Error('Approval is blocked while the player account is suspended.');
      }

      const cleanRef = payoutReference ? String(payoutReference).trim() : null;

      // 2. Update status to approved
      await client.query(`
        UPDATE withdrawal_requests 
        SET status = 'approved',
            payout_reference = $1,
            reviewed_by_name = $2,
            reviewed_at = NOW()
        WHERE id = $3
      `, [cleanRef, adminName, requestId]);

      // 3. Mark wallet_transactions as completed
      await client.query(`
        UPDATE wallet_transactions
        SET status = 'completed',
            reference_code = COALESCE($1, reference_code)
        WHERE user_id = $2 AND type = 'withdrawal' AND status = 'pending' AND amount = $3
      `, [cleanRef, request.user_id, request.amount]);

      return {
        id: request.id,
        userId: request.user_id,
        amount: parseFloat(request.amount),
        method: request.payment_method,
        destination: request.account_phone,
        accountName: request.account_name,
        telegramId: request.telegram_id,
        playerName: request.full_name,
        ref: cleanRef
      };
    });

    // 4. Real-time WebSocket broadcasts
    io.emit('withdrawal_status_updated', {
      id: result.id,
      status: 'approved',
      reference: result.ref
    });

    io.emit(`user_${result.userId}_withdrawal_approved`, {
      requestId: result.id,
      amount: result.amount,
      method: result.method,
      reference: result.ref
    });

    // 5. Send Telegram DM notification to player
    if (result.telegramId) {
      const msg = `🎉 *የገንዘብ ማውጣት ጥያቄዎ ፀድቋል! / Withdrawal Approved!*\n\n` +
        `💰 *Amount:* ETB ${result.amount.toLocaleString()}\n` +
        `🏦 *Method:* ${result.method}\n` +
        `📱 *Account/Phone:* \`${result.destination}\`\n` +
        `👤 *Name:* ${result.accountName || result.playerName}\n` +
        (result.ref ? `🔖 *Transaction Ref:* \`${result.ref}\`\n` : '') +
        `\nገንዘቡ በተሳካ ሁኔታ ወደ ሂሳብዎ ተላልፏል! እናመሰግናለን።\n` +
        `Funds have been disbursed to your account. Thank you for playing Sonic Bingo!`;

      telegramBotService.sendMessage(result.telegramId, msg).catch((err) => {
        console.warn('⚠️ [Telegram Send DM Error]:', err.message);
      });
    }

    return res.json({
      success: true,
      message: `Approved ${result.amount} ETB for ${result.playerName}`,
      withdrawal: result
    });
  } catch (err: any) {
    console.error('❌ [Withdrawal Approve Error]:', err);
    return res.status(400).json({ success: false, error: err.message || 'Failed to approve withdrawal' });
  }
});

/**
 * POST /api/withdrawals-admin/:id/reject
 * Rejects withdrawal, instantly refunds held escrow balance to player wallet, and notifies player
 */
router.post('/:id/reject', requireWithdrawalAdmin, async (req: WithdrawalAdminRequest, res: Response) => {
  try {
    await ensureWithdrawalColumns();
    const requestId = req.params.id;
    const { reason, note } = req.body;
    const adminName = req.adminUser?.name || 'Withdrawal Officer';

    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ success: false, error: 'Rejection reason is required.' });
    }

    const rejectionReason = String(reason).trim();
    const adminNote = note ? String(note).trim() : null;

    const result = await withTransaction(async (client) => {
      // 1. Lock withdrawal row
      const withRes = await client.query(`
        SELECT w.*, u.full_name, u.telegram_id
        FROM withdrawal_requests w
        JOIN users u ON w.user_id = u.id
        WHERE w.id = $1
        FOR UPDATE OF w
      `, [requestId]);

      if (withRes.rows.length === 0) {
        throw new Error('Withdrawal request not found.');
      }

      const request = withRes.rows[0];
      if (request.status !== 'pending') {
        throw new Error(`Request has already been ${request.status}.`);
      }

      const refundAmount = parseFloat(request.amount);

      // 2. Lock user wallet and refund held escrow
      const walRes = await client.query(`
        SELECT balance FROM wallets WHERE user_id = $1 FOR UPDATE
      `, [request.user_id]);

      if (walRes.rows.length === 0) {
        throw new Error('Player wallet not found for refund.');
      }

      const currentBalance = parseFloat(walRes.rows[0].balance);
      const newBalance = currentBalance + refundAmount;

      await client.query(`
        UPDATE wallets 
        SET balance = $1, updated_at = NOW() 
        WHERE user_id = $2
      `, [newBalance, request.user_id]);

      // 3. Update withdrawal request status
      await client.query(`
        UPDATE withdrawal_requests 
        SET status = 'rejected',
            rejection_reason = $1,
            admin_note = $2,
            reviewed_by_name = $3,
            reviewed_at = NOW()
        WHERE id = $4
      `, [rejectionReason, adminNote, adminName, requestId]);

      // 4. Update pending transaction and insert refund log
      await client.query(`
        UPDATE wallet_transactions
        SET status = 'rejected'
        WHERE user_id = $1 AND type = 'withdrawal' AND status = 'pending' AND amount = $2
      `, [request.user_id, refundAmount]);

      await client.query(`
        INSERT INTO wallet_transactions (user_id, type, amount, balance_after, reference_code, status, payment_method, description)
        VALUES ($1, 'refund', $2, $3, $4, 'completed', $5, $6)
      `, [
        request.user_id,
        refundAmount,
        newBalance,
        `REF-${Date.now().toString().slice(-6)}`,
        request.payment_method,
        `Withdrawal Refund: Escrow released back to wallet (${rejectionReason})`
      ]);

      return {
        id: request.id,
        userId: request.user_id,
        amount: refundAmount,
        newBalance,
        reason: rejectionReason,
        telegramId: request.telegram_id,
        playerName: request.full_name
      };
    });

    // 5. Real-time WebSocket broadcasts
    io.emit('withdrawal_status_updated', {
      id: result.id,
      status: 'rejected',
      reason: result.reason
    });

    io.emit(`user_${result.userId}_withdrawal_rejected`, {
      requestId: result.id,
      reason: result.reason,
      newBalance: result.newBalance
    });

    io.emit(`user_${result.userId}_balance`, {
      userId: result.userId,
      balance: result.newBalance,
      type: 'withdrawal_refund'
    });

    // 6. Send Telegram DM notification to player
    if (result.telegramId) {
      const msg = `⚠️ *የገንዘብ ማውጣት ጥያቄዎ ውድቅ ተደርጓል / Withdrawal Request Rejected*\n\n` +
        `💰 *Refunded Amount:* ETB ${result.amount.toLocaleString()}\n` +
        `❌ *Reason:* ${result.reason}\n` +
        `💳 *Current Wallet Balance:* ETB ${result.newBalance.toLocaleString()}\n\n` +
        `የተያዘው ገንዘብ ወዲያውኑ ወደ ቢንጎ ዋሌትዎ ተመልሷል!\n` +
        `The held amount has been returned to your wallet balance.`;

      telegramBotService.sendMessage(result.telegramId, msg).catch((err) => {
        console.warn('⚠️ [Telegram Send DM Error]:', err.message);
      });
    }

    return res.json({
      success: true,
      message: `Rejected request for ${result.playerName}. ${result.amount} ETB refunded to wallet.`,
      newBalance: result.newBalance
    });
  } catch (err: any) {
    console.error('❌ [Withdrawal Reject Error]:', err);
    return res.status(400).json({ success: false, error: err.message || 'Failed to reject withdrawal' });
  }
});

/**
 * GET /api/withdrawals-admin/settings
 * Retrieves operational payout policies and limits
 */
router.get('/settings', requireWithdrawalAdmin, async (_req: WithdrawalAdminRequest, res: Response) => {
  try {
    const result = await query(`
      SELECT 
        max_request_limit,
        high_value_threshold,
        min_request_limit,
        require_kyc_verification,
        require_turnover_met,
        strict_name_matching,
        telegram_player_alerts,
        auto_refresh_seconds,
        updated_at
      FROM withdrawal_settings
      WHERE id = 'default'
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        settings: {
          max_request_limit: 5000,
          high_value_threshold: 2000,
          min_request_limit: 50,
          require_kyc_verification: false,
          require_turnover_met: true,
          strict_name_matching: true,
          telegram_player_alerts: true,
          auto_refresh_seconds: 15
        }
      });
    }

    const row = result.rows[0];
    return res.json({
      success: true,
      settings: {
        max_request_limit: Number(row.max_request_limit || 5000),
        high_value_threshold: Number(row.high_value_threshold || 2000),
        min_request_limit: Number(row.min_request_limit || 50),
        require_kyc_verification: Boolean(row.require_kyc_verification),
        require_turnover_met: Boolean(row.require_turnover_met),
        strict_name_matching: Boolean(row.strict_name_matching),
        telegram_player_alerts: Boolean(row.telegram_player_alerts),
        auto_refresh_seconds: Number(row.auto_refresh_seconds || 15),
        updated_at: row.updated_at
      }
    });
  } catch (err: any) {
    console.error('❌ [Withdrawal Get Settings Error]:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve settings' });
  }
});

/**
 * POST /api/withdrawals-admin/settings
 * Updates operational payout limits and AML policy preferences
 */
router.post('/settings', requireWithdrawalAdmin, async (req: WithdrawalAdminRequest, res: Response) => {
  try {
    const {
      max_request_limit,
      high_value_threshold,
      min_request_limit,
      require_kyc_verification,
      require_turnover_met,
      strict_name_matching,
      telegram_player_alerts,
      auto_refresh_seconds
    } = req.body;

    const result = await query(`
      INSERT INTO withdrawal_settings (
        id,
        max_request_limit,
        high_value_threshold,
        min_request_limit,
        require_kyc_verification,
        require_turnover_met,
        strict_name_matching,
        telegram_player_alerts,
        auto_refresh_seconds,
        updated_at
      ) VALUES (
        'default',
        COALESCE($1, 5000),
        COALESCE($2, 2000),
        COALESCE($3, 50),
        COALESCE($4, false),
        COALESCE($5, true),
        COALESCE($6, true),
        COALESCE($7, true),
        COALESCE($8, 15),
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        max_request_limit = COALESCE(EXCLUDED.max_request_limit, withdrawal_settings.max_request_limit),
        high_value_threshold = COALESCE(EXCLUDED.high_value_threshold, withdrawal_settings.high_value_threshold),
        min_request_limit = COALESCE(EXCLUDED.min_request_limit, withdrawal_settings.min_request_limit),
        require_kyc_verification = COALESCE(EXCLUDED.require_kyc_verification, withdrawal_settings.require_kyc_verification),
        require_turnover_met = COALESCE(EXCLUDED.require_turnover_met, withdrawal_settings.require_turnover_met),
        strict_name_matching = COALESCE(EXCLUDED.strict_name_matching, withdrawal_settings.strict_name_matching),
        telegram_player_alerts = COALESCE(EXCLUDED.telegram_player_alerts, withdrawal_settings.telegram_player_alerts),
        auto_refresh_seconds = COALESCE(EXCLUDED.auto_refresh_seconds, withdrawal_settings.auto_refresh_seconds),
        updated_at = NOW()
      RETURNING *
    `, [
      max_request_limit != null ? Number(max_request_limit) : null,
      high_value_threshold != null ? Number(high_value_threshold) : null,
      min_request_limit != null ? Number(min_request_limit) : null,
      require_kyc_verification != null ? Boolean(require_kyc_verification) : null,
      require_turnover_met != null ? Boolean(require_turnover_met) : null,
      strict_name_matching != null ? Boolean(strict_name_matching) : null,
      telegram_player_alerts != null ? Boolean(telegram_player_alerts) : null,
      auto_refresh_seconds != null ? Number(auto_refresh_seconds) : null
    ]);

    const updated = result.rows[0];
    return res.json({
      success: true,
      message: 'Withdrawal operational settings saved successfully.',
      settings: updated
    });
  } catch (err: any) {
    console.error('❌ [Withdrawal Save Settings Error]:', err);
    return res.status(500).json({ success: false, error: 'Failed to update settings' });
  }
});

/**
 * POST /api/withdrawals-admin/change-pin
 * Validates the current PIN and updates to a new 4-6 digit officer PIN
 */
router.post('/change-pin', requireWithdrawalAdmin, async (req: WithdrawalAdminRequest, res: Response) => {
  try {
    const { currentPin, newPin } = req.body;
    if (!currentPin || !newPin) {
      return res.status(400).json({ success: false, error: 'Current PIN and New PIN are both required' });
    }

    const cleanCurrent = String(currentPin).trim();
    const cleanNew = String(newPin).trim();

    if (!/^\d{4,6}$/.test(cleanNew)) {
      return res.status(400).json({ success: false, error: 'New PIN must be 4 to 6 numeric digits' });
    }

    // Verify current PIN against DB (fallback to env)
    const pinRes = await query(`SELECT current_pin FROM withdrawal_settings WHERE id = 'default' LIMIT 1`);
    const activePin = pinRes.rows[0]?.current_pin ? String(pinRes.rows[0].current_pin).trim() : WITHDRAWAL_ADMIN_PIN;

    const isCurrentValid = cleanCurrent === activePin || cleanCurrent === WITHDRAWAL_ADMIN_PIN || cleanCurrent === SUPER_ADMIN_PIN;
    if (!isCurrentValid) {
      return res.status(401).json({ success: false, error: 'Incorrect current PIN. Verification failed.' });
    }

    // Update PIN in database
    await query(`
      INSERT INTO withdrawal_settings (id, current_pin, updated_at)
      VALUES ('default', $1, NOW())
      ON CONFLICT (id) DO UPDATE SET
        current_pin = EXCLUDED.current_pin,
        updated_at = NOW()
    `, [cleanNew]);

    return res.json({
      success: true,
      message: 'Officer security PIN updated successfully. Please use the new PIN on your next login.'
    });
  } catch (err: any) {
    console.error('❌ [Withdrawal Change PIN Error]:', err);
    return res.status(500).json({ success: false, error: 'Failed to change security PIN' });
  }
});

export default router;
