import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query, withTransaction, getDatabaseStorageStats } from '../db.ts';
import { requireAdmin, AuthenticatedRequest } from '../middleware/auth.ts';
import { io } from '../io.ts';
import { gameEngine } from '../game/BingoGameEngine.ts';
import { exportDatabaseBackup } from '../scripts/backup_database.ts';
import { coinService } from '../services/coinService.ts';
import { adminPlayersRouter } from './admin_players.ts';
import { adminRewardsRouter } from './admin_rewards.ts';

const router = Router();

// Mount Dedicated Player Accounts Router
router.use('/players', adminPlayersRouter);

// Mount Dedicated Bonus & Reward Management Router
router.use('/rewards', adminRewardsRouter);

/**
 * Get All Real Users from Neon DB
 */
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);
    const limitParam = req.query.limit as string;
    let limit = 50;
    if (limitParam === 'all') {
      limit = 5000;
    } else if (limitParam) {
      limit = Math.min(Math.max(parseInt(limitParam, 10) || 50, 1), 2000);
    }
    const offset = (page - 1) * limit;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const sortBy = typeof req.query.sortBy === 'string' ? req.query.sortBy.trim() : 'newest';
    const segment = typeof req.query.segment === 'string' ? req.query.segment.trim() : 'all';

    // Map allowed sort orders to secure SQL expressions
    const SORT_MAP: Record<string, string> = {
      'balance-desc': 'COALESCE(w.balance, 0) DESC, u.created_at DESC',
      'deposit-desc': '"totalDeposited" DESC, u.created_at DESC',
      'referrals-desc': '"referralCount" DESC, u.created_at DESC',
      'newest': 'u.created_at DESC'
    };
    const orderClause = SORT_MAP[sortBy] || SORT_MAP['newest'];

    // Map segment filters to secure SQL conditions
    let segmentCondition = '';
    if (segment === 'active') {
      segmentCondition = " AND u.status = 'active'";
    } else if (segment === 'suspended') {
      segmentCondition = " AND u.status = 'suspended'";
    } else if (segment === 'vip') {
      segmentCondition = " AND COALESCE((SELECT SUM(amount) FROM deposit_requests WHERE user_id = u.id AND status = 'approved'), 0) >= 1000";
    } else if (segment === 'bonus') {
      segmentCondition = " AND COALESCE(w.bonus, 0) > 0";
    }

    const countQuery = `
      SELECT 
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE u.status = 'active') as active_count,
        COUNT(*) FILTER (WHERE u.status = 'suspended') as suspended_count,
        COUNT(*) FILTER (WHERE COALESCE((SELECT SUM(amount) FROM deposit_requests WHERE user_id = u.id AND status = 'approved'), 0) >= 1000) as vip_count,
        COUNT(*) FILTER (WHERE COALESCE(w.bonus, 0) > 0) as bonus_count,
        COALESCE(SUM(w.balance), 0) as total_cash_float,
        COALESCE(SUM(w.bonus), 0) as total_bonus_float
      FROM users u
      LEFT JOIN wallets w ON u.id = w.user_id
      WHERE u.role = 'player' 
        AND (u.is_bot IS NULL OR u.is_bot = false)
        AND u.full_name NOT LIKE 'Synthetic%'
    `;

    const hasFilter = Boolean(search || segmentCondition);

    const filterCountQuery = search
      ? `
        SELECT COUNT(*) as filtered_count
        FROM users u
        LEFT JOIN wallets w ON u.id = w.user_id
        WHERE u.role = 'player' 
          AND (u.is_bot IS NULL OR u.is_bot = false)
          AND u.full_name NOT LIKE 'Synthetic%'
          ${segmentCondition}
          AND (
            u.full_name ILIKE $1 
            OR u.phone ILIKE $1 
            OR u.telegram_username ILIKE $1 
            OR CAST(u.telegram_id AS TEXT) ILIKE $1
          )
      `
      : `
        SELECT COUNT(*) as filtered_count
        FROM users u
        LEFT JOIN wallets w ON u.id = w.user_id
        WHERE u.role = 'player' 
          AND (u.is_bot IS NULL OR u.is_bot = false)
          AND u.full_name NOT LIKE 'Synthetic%'
          ${segmentCondition}
      `;

    const usersQuery = search
      ? `
        SELECT 
          u.id,
          u.full_name as name,
          COALESCE(u.phone, CONCAT('09', RIGHT(CAST(u.telegram_id AS TEXT), 8))) as phone,
          u.telegram_username,
          u.telegram_id,
          COALESCE(w.balance, 0.00) as balance,
          COALESCE(w.bonus, 0.00) as bonus,
          u.status,
          u.role,
          u.created_at as "createdAt",
          COALESCE((SELECT SUM(amount) FROM deposit_requests WHERE user_id = u.id AND status = 'approved'), 0) as "totalDeposited",
          COALESCE((SELECT SUM(amount) FROM withdrawal_requests WHERE user_id = u.id AND status = 'approved'), 0) as "totalWithdrawn",
          COALESCE((SELECT COUNT(*) FROM referrals WHERE referrer_id = u.id), 0) as "referralCount"
        FROM users u
        LEFT JOIN wallets w ON u.id = w.user_id
        WHERE u.role = 'player' 
          AND (u.is_bot IS NULL OR u.is_bot = false)
          AND u.full_name NOT LIKE 'Synthetic%'
          ${segmentCondition}
          AND (
            u.full_name ILIKE $1 
            OR u.phone ILIKE $1 
            OR u.telegram_username ILIKE $1 
            OR CAST(u.telegram_id AS TEXT) ILIKE $1
          )
        ORDER BY ${orderClause}
        LIMIT $2 OFFSET $3
      `
      : `
        SELECT 
          u.id,
          u.full_name as name,
          COALESCE(u.phone, CONCAT('09', RIGHT(CAST(u.telegram_id AS TEXT), 8))) as phone,
          u.telegram_username,
          u.telegram_id,
          COALESCE(w.balance, 0.00) as balance,
          COALESCE(w.bonus, 0.00) as bonus,
          u.status,
          u.role,
          u.created_at as "createdAt",
          COALESCE((SELECT SUM(amount) FROM deposit_requests WHERE user_id = u.id AND status = 'approved'), 0) as "totalDeposited",
          COALESCE((SELECT SUM(amount) FROM withdrawal_requests WHERE user_id = u.id AND status = 'approved'), 0) as "totalWithdrawn",
          COALESCE((SELECT COUNT(*) FROM referrals WHERE referrer_id = u.id), 0) as "referralCount"
        FROM users u
        LEFT JOIN wallets w ON u.id = w.user_id
        WHERE u.role = 'player' 
          AND (u.is_bot IS NULL OR u.is_bot = false)
          AND u.full_name NOT LIKE 'Synthetic%'
          ${segmentCondition}
        ORDER BY ${orderClause}
        LIMIT $1 OFFSET $2
      `;

    const [countRes, filterCountRes, usersRes] = await Promise.all([
      query(countQuery),
      hasFilter
        ? (search ? query(filterCountQuery, [`%${search}%`]) : query(filterCountQuery))
        : Promise.resolve({ rows: [] } as any),
      search
        ? query(usersQuery, [`%${search}%`, limit, offset])
        : query(usersQuery, [limit, offset])
    ]);

    const statsRow = countRes.rows[0] || {};
    const totalCount = parseInt(statsRow.total_count || '0', 10);
    const filteredCount = hasFilter
      ? parseInt(filterCountRes.rows[0]?.filtered_count || '0', 10)
      : totalCount;

    const stats = {
      totalPlayers: totalCount,
      activePlayers: parseInt(statsRow.active_count || '0', 10),
      suspendedPlayers: parseInt(statsRow.suspended_count || '0', 10),
      vipPlayers: parseInt(statsRow.vip_count || '0', 10),
      bonusPlayers: parseInt(statsRow.bonus_count || '0', 10),
      totalCashFloat: parseFloat(statsRow.total_cash_float || '0'),
      totalBonusFloat: parseFloat(statsRow.total_bonus_float || '0')
    };

    const formatted = usersRes.rows.map(u => ({
      id: u.id,
      name: u.name,
      phone: u.phone,
      telegramUsername: u.telegram_username,
      telegramId: u.telegram_id,
      balance: parseFloat(u.balance),
      bonus: parseFloat(u.bonus),
      referralCount: parseInt(u.referralCount, 10) || 0,
      totalDeposited: parseFloat(u.totalDeposited),
      totalWithdrawn: parseFloat(u.totalWithdrawn),
      status: u.status,
      role: u.role,
      createdAt: u.createdAt
    }));

    return res.json({
      success: true,
      users: formatted,
      totalCount: filteredCount,
      totalPlayers: totalCount,
      page,
      limit,
      totalPages: Math.ceil(filteredCount / limit) || 1,
      sortBy,
      segment,
      stats
    });
  } catch (error: any) {
    console.error('❌ [Admin Users Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve users' });
  }
});

/**
 * GET /api/admin/cashier-ledger
 * Authoritative P2P Cashier Surveillance & Network Audit Ledger
 * Combines Agent Deposits, Agent Withdrawals, and Historical Direct Transactions
 */
router.get('/cashier-ledger', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { timeframe = 'today', rail = 'all', status = 'all', type = 'all', search } = req.query as {
      timeframe?: string;
      rail?: string;
      status?: string;
      type?: string;
      search?: string;
    };

    // 1. Authoritative Network KPI Ribbon from PostgreSQL
    const [depStatsRes, wdStatsRes, floatStatsRes, commStatsRes] = await Promise.all([
      // Today's P2P Deposits
      query(`
        SELECT 
          COALESCE(SUM(amount), 0) as amount,
          COUNT(*) as count,
          COALESCE(SUM(amount * 0.05), 0) as commission
        FROM agent_deposit_requests
        WHERE status = 'approved' AND created_at >= CURRENT_DATE
      `),
      // Today's P2P Withdrawals
      query(`
        SELECT 
          COALESCE(SUM(amount), 0) as amount,
          COUNT(*) as count,
          COALESCE(SUM(COALESCE(agent_commission_earned, amount * 0.02)), 0) as commission
        FROM agent_withdrawal_requests
        WHERE status = 'approved' AND created_at >= CURRENT_DATE
      `),
      // Agent Float in Circulation
      query(`
        SELECT COALESCE(SUM(wallet_balance), 0) as total_float
        FROM agent_profiles
        WHERE status = 'active'
      `),
      // Total Agent Commission Distributed
      query(`
        SELECT COALESCE(SUM(commission_earned), 0) as total_comm
        FROM agent_commissions
      `)
    ]);

    const stats = {
      todayDepositsAmount: parseFloat(depStatsRes.rows[0]?.amount || '0'),
      todayDepositsCount: parseInt(depStatsRes.rows[0]?.count || '0', 10),
      todayDepositsCommission: parseFloat(depStatsRes.rows[0]?.commission || '0'),
      todayWithdrawalsAmount: parseFloat(wdStatsRes.rows[0]?.amount || '0'),
      todayWithdrawalsCount: parseInt(wdStatsRes.rows[0]?.count || '0', 10),
      todayWithdrawalsFee: parseFloat(wdStatsRes.rows[0]?.commission || '0'),
      agentFloatCirculation: parseFloat(floatStatsRes.rows[0]?.total_float || '0'),
      totalCommissionDistributed: parseFloat(commStatsRes.rows[0]?.total_comm || '0')
    };

    // 2. Build Unified Surveillance Ledger Query
    const whereClauses: string[] = [];
    const queryParams: any[] = [];

    if (timeframe === 'today') {
      whereClauses.push(`created_at >= CURRENT_DATE`);
    } else if (timeframe === 'week') {
      whereClauses.push(`created_at >= NOW() - INTERVAL '7 days'`);
    } else if (timeframe === 'month') {
      whereClauses.push(`created_at >= NOW() - INTERVAL '30 days'`);
    }

    if (rail && rail !== 'all') {
      queryParams.push(rail);
      whereClauses.push(`payment_method = $${queryParams.length}`);
    }

    if (status && status !== 'all') {
      queryParams.push(status);
      whereClauses.push(`status = $${queryParams.length}`);
    }

    if (type && type !== 'all') {
      queryParams.push(type);
      whereClauses.push(`type = $${queryParams.length}`);
    }

    if (search && search.trim()) {
      queryParams.push(`%${search.trim().toLowerCase()}%`);
      const pIdx = queryParams.length;
      whereClauses.push(`(
        LOWER(COALESCE(user_name, '')) LIKE $${pIdx} OR 
        LOWER(COALESCE(user_phone, '')) LIKE $${pIdx} OR 
        LOWER(COALESCE(player_phone, '')) LIKE $${pIdx} OR 
        LOWER(COALESCE(agent_code, '')) LIKE $${pIdx} OR 
        LOWER(COALESCE(agent_name, '')) LIKE $${pIdx} OR 
        LOWER(COALESCE(reference_number, '')) LIKE $${pIdx}
      )`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const ledgerSql = `
      WITH p2p_txs AS (
        SELECT 
          adr.id,
          'deposit' as type,
          adr.amount,
          adr.payment_method,
          adr.player_phone,
          adr.transaction_code as reference_number,
          adr.status,
          adr.rejection_reason,
          adr.screenshot_url as receipt_image,
          ROUND(adr.amount * 0.05, 2) as agent_commission,
          adr.created_at,
          adr.resolved_at,
          u.id as user_id,
          u.full_name as user_name,
          u.phone as user_phone,
          ap.id as agent_id,
          ap.agent_code,
          COALESCE(au.full_name, ap.telebirr_name, CONCAT('Sonic Agent #', ap.agent_code)) as agent_name,
          ap.telebirr_phone as agent_telebirr,
          ap.cbe_account as agent_cbe
        FROM agent_deposit_requests adr
        JOIN users u ON adr.player_id = u.id
        JOIN agent_profiles ap ON adr.agent_id = ap.id
        LEFT JOIN users au ON ap.user_id = au.id

        UNION ALL

        SELECT 
          awr.id,
          'withdrawal' as type,
          awr.amount,
          awr.payout_method as payment_method,
          awr.payout_account as player_phone,
          COALESCE(awr.agent_tx_ref, CONCAT('WD-', UPPER(awr.payout_method), '-', SUBSTRING(CAST(awr.id as TEXT), 1, 6))) as reference_number,
          awr.status,
          awr.rejection_reason,
          NULL as receipt_image,
          COALESCE(awr.agent_commission_earned, ROUND(awr.amount * 0.02, 2)) as agent_commission,
          awr.created_at,
          awr.resolved_at,
          u.id as user_id,
          u.full_name as user_name,
          u.phone as user_phone,
          ap.id as agent_id,
          ap.agent_code,
          COALESCE(au.full_name, ap.telebirr_name, CONCAT('Sonic Agent #', ap.agent_code)) as agent_name,
          ap.telebirr_phone as agent_telebirr,
          ap.cbe_account as agent_cbe
        FROM agent_withdrawal_requests awr
        JOIN users u ON awr.player_id = u.id
        JOIN agent_profiles ap ON awr.agent_id = ap.id
        LEFT JOIN users au ON ap.user_id = au.id

        UNION ALL

        SELECT 
          dr.id,
          'deposit' as type,
          dr.amount,
          dr.payment_method,
          dr.player_phone,
          dr.transaction_ref as reference_number,
          dr.status,
          dr.admin_notes as rejection_reason,
          CASE WHEN (dr.receipt_image IS NOT NULL AND dr.receipt_image != '' AND dr.receipt_image NOT LIKE '[ARCHIVED%') THEN CONCAT('/api/admin/deposits/', dr.id, '/receipt') ELSE NULL END as receipt_image,
          0.00 as agent_commission,
          dr.created_at,
          dr.reviewed_at as resolved_at,
          u.id as user_id,
          u.full_name as user_name,
          u.phone as user_phone,
          NULL as agent_id,
          'DIRECT' as agent_code,
          'Central Treasury' as agent_name,
          NULL as agent_telebirr,
          NULL as agent_cbe
        FROM deposit_requests dr
        JOIN users u ON dr.user_id = u.id

        UNION ALL

        SELECT 
          wr.id,
          'withdrawal' as type,
          wr.amount,
          wr.payment_method,
          wr.account_phone as player_phone,
          CONCAT('WD-', UPPER(wr.payment_method), '-', SUBSTRING(CAST(wr.id as TEXT), 1, 6)) as reference_number,
          wr.status,
          NULL as rejection_reason,
          NULL as receipt_image,
          0.00 as agent_commission,
          wr.created_at,
          wr.reviewed_at as resolved_at,
          u.id as user_id,
          u.full_name as user_name,
          u.phone as user_phone,
          NULL as agent_id,
          'DIRECT' as agent_code,
          'Central Treasury' as agent_name,
          NULL as agent_telebirr,
          NULL as agent_cbe
        FROM withdrawal_requests wr
        JOIN users u ON wr.user_id = u.id
      )
      SELECT * FROM p2p_txs
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT 200;
    `;

    const txRes = await query(ledgerSql, queryParams);

    const formattedTxs = txRes.rows.map(r => ({
      id: r.id,
      type: r.type,
      amount: parseFloat(r.amount),
      paymentMethod: r.payment_method,
      playerPhone: r.player_phone,
      referenceNumber: r.reference_number,
      status: r.status,
      rejectionReason: r.rejection_reason,
      receiptImage: r.receipt_image,
      agentCommission: parseFloat(r.agent_commission || '0'),
      createdAt: r.created_at,
      resolvedAt: r.resolved_at,
      userId: r.user_id,
      userName: r.user_name,
      userPhone: r.user_phone,
      agentId: r.agent_id,
      agentCode: r.agent_code,
      agentName: r.agent_name,
      agentTelebirr: r.agent_telebirr,
      agentCbe: r.agent_cbe
    }));

    return res.json({
      success: true,
      stats,
      transactions: formattedTxs
    });
  } catch (error: any) {
    console.error('❌ [Admin Cashier Ledger Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve cashier audit ledger' });
  }
});

/**
 * Get All Deposit Requests (Admin/Cashier View)
 */
router.get('/deposits', requireAdmin, async (_req, res) => {
  try {
    const depositRes = await query(`
      SELECT 
        d.id,
        d.user_id,
        d.amount,
        d.payment_method,
        d.player_phone,
        d.transaction_ref,
        d.status,
        d.admin_notes,
        d.reviewed_at,
        d.created_at,
        (d.receipt_image IS NOT NULL AND d.receipt_image != '' AND d.receipt_image NOT LIKE '[ARCHIVED%') as has_receipt,
        u.full_name as user_name,
        u.phone as user_phone,
        u.telegram_username,
        COALESCE((SELECT SUM(amount) FROM deposit_requests WHERE user_id = d.user_id AND status = 'approved'), 0) as user_lifetime_deposits,
        COALESCE((SELECT SUM(amount) FROM withdrawal_requests WHERE user_id = d.user_id AND status = 'approved'), 0) as user_lifetime_withdrawals
      FROM deposit_requests d
      JOIN users u ON d.user_id = u.id
      ORDER BY d.created_at DESC
      LIMIT 100
    `);

    const formatted = depositRes.rows.map(d => ({
      id: d.id,
      userId: d.user_id,
      userName: d.user_name,
      userPhone: d.user_phone || d.player_phone,
      telegramUsername: d.telegram_username,
      amount: parseFloat(d.amount),
      paymentMethod: d.payment_method,
      playerPhone: d.player_phone,
      transactionRef: d.transaction_ref,
      receiptImage: d.has_receipt ? `/api/admin/deposits/${d.id}/receipt` : null,
      status: d.status,
      adminNotes: d.admin_notes,
      reviewedAt: d.reviewed_at,
      createdAt: d.created_at,
      userLifetimeDeposits: parseFloat(d.user_lifetime_deposits || 0),
      userLifetimeWithdrawals: parseFloat(d.user_lifetime_withdrawals || 0)
    }));

    return res.json({ success: true, deposits: formatted });
  } catch (error: any) {
    console.error('❌ [Admin Deposits Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve deposits' });
  }
});

/**
 * Stream Single Deposit Receipt Image On-Demand
 * Eliminates multi-megabyte payload bloat from deposit list queries.
 */
router.get('/deposits/:id/receipt', async (req, res) => {
  try {
    const depositId = req.params.id;

    // UUID format validation guard
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(depositId)) {
      return res.status(400).send('Invalid receipt ID');
    }

    const receiptRes = await query(
      'SELECT receipt_image FROM deposit_requests WHERE id = $1',
      [depositId]
    );

    if (receiptRes.rows.length === 0 || !receiptRes.rows[0].receipt_image) {
      return res.status(404).send('Receipt not found');
    }

    const rawData = receiptRes.rows[0].receipt_image.trim();
    if (rawData.startsWith('[ARCHIVED')) {
      return res.status(404).send('Receipt image has been archived');
    }

    // Case 1: External URL
    if (rawData.startsWith('http://') || rawData.startsWith('https://')) {
      return res.redirect(rawData);
    }

    // Case 2: Data URI (e.g. data:image/jpeg;base64,...)
    const dataUriMatch = rawData.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/s);
    if (dataUriMatch) {
      const mimeSubtype = dataUriMatch[1].toLowerCase();
      const base64Data = dataUriMatch[2];
      const buffer = Buffer.from(base64Data, 'base64');
      const contentType = mimeSubtype === 'jpg' ? 'image/jpeg' : `image/${mimeSubtype}`;

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Cache-Control', 'private, max-age=86400');
      return res.end(buffer);
    }

    // Case 3: Raw base64 string
    const buffer = Buffer.from(rawData, 'base64');
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    return res.end(buffer);
  } catch (error: any) {
    console.error('❌ [Receipt Stream Error]:', error);
    return res.status(500).send('Failed to stream receipt');
  }
});

/**
 * Approve Deposit & Credit User Balance Atomically
 */
router.post('/deposits/:id/approve', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const depositId = req.params.id;
    const adminId = req.user!.id;

    const result = await withTransaction(async (client) => {
      // 1. Lock deposit row
      const depRes = await client.query(
        'SELECT id, user_id, amount, payment_method, transaction_ref, status FROM deposit_requests WHERE id = $1 FOR UPDATE',
        [depositId]
      );

      if (depRes.rows.length === 0) {
        throw new Error('Deposit request not found.');
      }

      const deposit = depRes.rows[0];
      if (deposit.status !== 'pending') {
        throw new Error(`Deposit has already been ${deposit.status}.`);
      }

      const amount = parseFloat(deposit.amount);

      // 2. Lock and credit player's wallet
      const walletRes = await client.query(
        'SELECT balance FROM wallets WHERE user_id = $1 FOR UPDATE',
        [deposit.user_id]
      );

      if (walletRes.rows.length === 0) {
        throw new Error('Player wallet not found.');
      }

      const currentBalance = parseFloat(walletRes.rows[0].balance);
      const newBalance = currentBalance + amount;

      await client.query(
        'UPDATE wallets SET balance = $1, updated_at = NOW() WHERE user_id = $2',
        [newBalance, deposit.user_id]
      );

      // 3. Mark deposit approved and flag user as verified depositor
      await client.query(
        `UPDATE deposit_requests 
         SET status = 'approved', reviewed_by = $1, reviewed_at = NOW() 
         WHERE id = $2`,
        [adminId, depositId]
      );

      await client.query(
        'UPDATE users SET has_deposited = TRUE WHERE id = $1',
        [deposit.user_id]
      );

      // 4. Create completed transaction in ledger
      await client.query(
        `INSERT INTO wallet_transactions (user_id, type, amount, balance_after, reference_code, status, payment_method, description)
         VALUES ($1, 'deposit', $2, $3, $4, 'completed', $5, $6)`,
        [
          deposit.user_id,
          amount,
          newBalance,
          deposit.transaction_ref,
          deposit.payment_method,
          `Deposit approved via ${deposit.payment_method} (${deposit.transaction_ref})`
        ]
      );

      // 4b. Coin Earning Engine: 1.5x Coins per Eligible Deposit ETB (50 ETB -> 75 coins)
      try {
        await coinService.awardCoinsForDeposit(deposit.user_id, amount, deposit.transaction_ref, client);
      } catch (coinErr) {
        console.error('⚠️ [Admin Approve Deposit] Failed to award coins:', coinErr);
      }

      // 5. One-Time 10% Referral Bonus (Friend's 1st Approved Deposit)
      let referralBonusPaid = false;
      let referrerId: string | null = null;
      let referralBonusAmount = 0;

      // Verify this is the user's first approved deposit ever
      const prevDepCheck = await client.query(
        `SELECT COUNT(*) as count FROM deposit_requests WHERE user_id = $1 AND status = 'approved' AND id != $2`,
        [deposit.user_id, depositId]
      );
      const isFirstApprovedDeposit = parseInt(prevDepCheck.rows[0]?.count || '0', 10) === 0;

      if (isFirstApprovedDeposit) {
        // Look up pending referral record
        const refRes = await client.query(
          `SELECT id, referrer_id 
           FROM referrals 
           WHERE referred_user_id = $1 AND status = 'pending_deposit'
           LIMIT 1`,
          [deposit.user_id]
        );

        if (refRes.rows.length > 0) {
          const refRecord = refRes.rows[0];
          referrerId = refRecord.referrer_id;
          // Query dynamic referral bonus settings from bonus_reward_settings
          const refSettingsRes = await client.query(
            `SELECT ref_bonus_enabled, ref_bonus_percent, ref_min_deposit, ref_max_cap FROM bonus_reward_settings WHERE id = 1`
          );
          const refSettings = refSettingsRes.rows[0];
          const isRefEnabled = refSettings ? refSettings.ref_bonus_enabled !== false : true;
          const refPercent = refSettings ? parseFloat(refSettings.ref_bonus_percent || '10') : 10;
          const refMinDeposit = refSettings ? parseFloat(refSettings.ref_min_deposit || '50') : 50;
          const refMaxCap = refSettings ? parseFloat(refSettings.ref_max_cap || '500') : 500;

          if (isRefEnabled && amount >= refMinDeposit) {
            referralBonusAmount = Math.min(refMaxCap, Math.round(amount * (refPercent / 100) * 100) / 100);
          } else {
            referralBonusAmount = 0;
          }

          if (referralBonusAmount > 0 && referrerId) {
            // Credit referrer's BONUS wallet (for gameplay only, non-withdrawable directly)
            await client.query(
              `UPDATE wallets 
               SET bonus = bonus + $1, updated_at = NOW() 
               WHERE user_id = $2`,
              [referralBonusAmount, referrerId]
            );

            // Record transaction in ledger
            const refBonusRef = `REF-BONUS-${Date.now().toString().slice(-6)}`;
            await client.query(
              `INSERT INTO wallet_transactions (user_id, type, amount, balance_after, reference_code, status, payment_method, description)
               VALUES ($1, 'bonus', $2, (SELECT bonus FROM wallets WHERE user_id = $1), $3, 'completed', 'referral_reward', $4)`,
              [
                referrerId,
                referralBonusAmount,
                refBonusRef,
                `Referral Bonus (${refPercent}% of friend's 1st deposit of ${amount.toFixed(2)} ETB) - Game Play Bonus`
              ]
            );

            // Mark referral as rewarded (ensures one-time bonus guarantee)
            await client.query(
              `UPDATE referrals 
               SET status = 'rewarded', deposit_amount = $1, reward_amount = $2, rewarded_at = NOW() 
               WHERE id = $3`,
              [amount, referralBonusAmount, refRecord.id]
            );

            referralBonusPaid = true;
            console.log(`🎁 [Referral Bonus] Credited ${refPercent}% (${referralBonusAmount} ETB) bonus to referrer ${referrerId}`);
          }
        }
      }

      return {
        userId: deposit.user_id,
        amount,
        newBalance,
        ref: deposit.transaction_ref,
        referralBonusPaid,
        referrerId,
        referralBonusAmount
      };
    });

    // Instantly unlock normal win probability in game engine
    gameEngine.markUserAsDeposited(result.userId);

    // Notify the depositing user in real-time over WebSocket
    io.emit(`user_${result.userId}_balance`, {
      type: 'deposit_approved',
      amount: result.amount,
      newBalance: result.newBalance,
      reference: result.ref
    });

    io.emit(`user_${result.userId}_deposit_approved`, {
      requestId: depositId,
      amount: result.amount,
      newBalance: result.newBalance,
      transactionCode: result.ref,
      agentDisplayName: 'Sonic Official Cashier'
    });

    io.emit('user_balance_updated', {
      userId: result.userId,
      amount: result.amount,
      newBalance: result.newBalance,
      balance: result.newBalance,
      type: 'deposit_credited'
    });

    // If a referral bonus was awarded, notify the referrer in real-time!
    if (result.referralBonusPaid && result.referrerId) {
      io.emit(`user_${result.referrerId}_balance`, {
        type: 'referral_bonus_credited',
        bonusAmount: result.referralBonusAmount
      });
      io.emit('user_balance_updated', {
        userId: result.referrerId
      });
    }

    // Broadcast generic update for admin dashboard
    io.emit('deposit_status_updated', { id: depositId, status: 'approved' });

    return res.json({
      success: true,
      message: `Deposit of ${result.amount} ETB successfully approved.${result.referralBonusPaid ? ` (10% Referral bonus of ${result.referralBonusAmount} ETB credited to referrer)` : ''}`,
      newBalance: result.newBalance
    });
  } catch (error: any) {
    console.error('❌ [Admin Approve Deposit Error]:', error);
    return res.status(400).json({ success: false, error: error.message || 'Deposit approval failed' });
  }
});

/**
 * Reject Deposit Request
 */
router.post('/deposits/:id/reject', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const depositId = req.params.id;
    const adminId = req.user!.id;
    const { reason } = req.body;

    const depRes = await query(
      'SELECT id, user_id, amount, payment_method, transaction_ref, status FROM deposit_requests WHERE id = $1',
      [depositId]
    );
    if (depRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deposit request not found.' });
    }

    const deposit = depRes.rows[0];
    if (deposit.status !== 'pending') {
      return res.status(400).json({ success: false, error: `Deposit has already been ${deposit.status}.` });
    }

    await query(
      `UPDATE deposit_requests 
       SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW(), admin_notes = $2 
       WHERE id = $3`,
      [adminId, reason || 'Transaction could not be verified by Cashier', depositId]
    );

    const rejectionMsg = reason || 'Transaction could not be verified by Cashier';
    io.emit('deposit_status_updated', { id: depositId, status: 'rejected' });
    io.emit(`user_${deposit.user_id}_deposit_rejected`, {
      requestId: depositId,
      reason: rejectionMsg,
      agentDisplayName: 'Sonic Official Cashier'
    });
    io.emit('user_balance_updated', { userId: deposit.user_id });
    io.emit(`user_${deposit.user_id}_balance`, { type: 'deposit_rejected', userId: deposit.user_id });

    return res.json({ success: true, message: 'Deposit request rejected.' });
  } catch (error: any) {
    console.error('❌ [Admin Reject Deposit Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to reject deposit' });
  }
});

/**
 * Get All Withdrawal Requests
 */
router.get('/withdrawals', requireAdmin, async (_req, res) => {
  try {
    const withdrawRes = await query(`
      SELECT 
        w.*, 
        u.full_name as user_name, 
        u.phone as user_phone, 
        u.telegram_username,
        COALESCE((SELECT SUM(amount) FROM deposit_requests WHERE user_id = w.user_id AND status = 'approved'), 0) as user_lifetime_deposits,
        COALESCE((SELECT SUM(amount) FROM withdrawal_requests WHERE user_id = w.user_id AND status = 'approved'), 0) as user_lifetime_withdrawals
      FROM withdrawal_requests w
      JOIN users u ON w.user_id = u.id
      ORDER BY w.created_at DESC
      LIMIT 100
    `);

    const formatted = withdrawRes.rows.map(w => ({
      id: w.id,
      userId: w.user_id,
      userName: w.user_name,
      userPhone: w.user_phone || w.account_phone,
      telegramUsername: w.telegram_username,
      amount: parseFloat(w.amount),
      paymentMethod: w.payment_method,
      accountPhone: w.account_phone,
      accountName: w.account_name,
      status: w.status,
      reviewedAt: w.reviewed_at,
      createdAt: w.created_at,
      userLifetimeDeposits: parseFloat(w.user_lifetime_deposits || 0),
      userLifetimeWithdrawals: parseFloat(w.user_lifetime_withdrawals || 0)
    }));

    return res.json({ success: true, withdrawals: formatted });
  } catch (error: any) {
    console.error('❌ [Admin Withdrawals Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve withdrawals' });
  }
});

/**
 * Approve/Complete Withdrawal
 */
router.post('/withdrawals/:id/approve', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const withdrawalId = req.params.id;
    const adminId = req.user!.id;

    const wRes = await query(
      `UPDATE withdrawal_requests 
       SET status = 'approved', reviewed_by = $1, reviewed_at = NOW() 
       WHERE id = $2
       RETURNING user_id, amount`,
      [adminId, withdrawalId]
    );

    if (wRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Withdrawal request not found.' });
    }

    const w = wRes.rows[0];
    const walRes = await query('SELECT balance FROM wallets WHERE user_id = $1', [w.user_id]);
    const currentBal = parseFloat(walRes.rows[0]?.balance || '0');

    io.emit('withdrawal_status_updated', { id: withdrawalId, status: 'approved' });
    io.emit(`user_${w.user_id}_withdrawal_approved`, {
      requestId: withdrawalId,
      amount: parseFloat(w.amount),
      newBalance: currentBal,
      balance: currentBal,
      agentDisplayName: 'Sonic Official Cashier'
    });
    io.emit('user_balance_updated', {
      userId: w.user_id,
      newBalance: currentBal,
      balance: currentBal,
      type: 'withdrawal_settled'
    });
    io.emit(`user_${w.user_id}_balance`, {
      userId: w.user_id,
      newBalance: currentBal,
      balance: currentBal,
      type: 'withdrawal_settled'
    });

    return res.json({ success: true, message: 'Withdrawal marked as completed/sent.' });
  } catch (error: any) {
    console.error('❌ [Admin Approve Withdrawal Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to approve withdrawal' });
  }
});

/**
 * Reject Withdrawal and Refund Balance to User's Wallet
 */
router.post('/withdrawals/:id/reject', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const withdrawalId = req.params.id;
    const adminId = req.user!.id;
    const { reason } = req.body;

    const result = await withTransaction(async (client) => {
      const wRes = await client.query(
        'SELECT * FROM withdrawal_requests WHERE id = $1 FOR UPDATE',
        [withdrawalId]
      );

      if (wRes.rows.length === 0) {
        throw new Error('Withdrawal request not found.');
      }

      const withdrawal = wRes.rows[0];
      if (withdrawal.status !== 'pending') {
        throw new Error(`Withdrawal has already been ${withdrawal.status}.`);
      }

      const amount = parseFloat(withdrawal.amount);

      // Refund balance to user
      const walletRes = await client.query(
        'SELECT balance FROM wallets WHERE user_id = $1 FOR UPDATE',
        [withdrawal.user_id]
      );

      const currentBalance = parseFloat(walletRes.rows[0].balance);
      const newBalance = currentBalance + amount;

      await client.query(
        'UPDATE wallets SET balance = $1, updated_at = NOW() WHERE user_id = $2',
        [newBalance, withdrawal.user_id]
      );

      // Mark rejected
      await client.query(
        `UPDATE withdrawal_requests 
         SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW() 
         WHERE id = $2`,
        [adminId, withdrawalId]
      );

      // Record refund in ledger
      await client.query(
        `INSERT INTO wallet_transactions (user_id, type, amount, balance_after, reference_code, status, payment_method, description)
         VALUES ($1, 'refund', $2, $3, $4, 'completed', $5, $6)`,
        [
          withdrawal.user_id,
          amount,
          newBalance,
          `REFUND-WD-${Date.now().toString().slice(-6)}`,
          withdrawal.payment_method,
          `Withdrawal rejected: ${reason || 'Invalid account details'}. Funds refunded.`
        ]
      );

      return {
        userId: withdrawal.user_id,
        amount,
        newBalance
      };
    });

    // Notify user over WebSocket
    io.emit(`user_${result.userId}_balance`, {
      type: 'withdrawal_refunded',
      amount: result.amount,
      newBalance: result.newBalance,
      balance: result.newBalance
    });

    io.emit('user_balance_updated', {
      userId: result.userId,
      amount: result.amount,
      newBalance: result.newBalance,
      balance: result.newBalance,
      type: 'withdrawal_refunded'
    });

    io.emit(`user_${result.userId}_withdrawal_rejected`, {
      requestId: withdrawalId,
      reason: reason || 'Invalid account details',
      newBalance: result.newBalance,
      amount: result.amount,
      agentDisplayName: 'Sonic Official Cashier'
    });

    io.emit('withdrawal_status_updated', { id: withdrawalId, status: 'rejected' });

    return res.json({ success: true, message: 'Withdrawal rejected and amount refunded to user wallet.' });
  } catch (error: any) {
    console.error('❌ [Admin Reject Withdrawal Error]:', error);
    return res.status(400).json({ success: false, error: error.message || 'Failed to reject withdrawal' });
  }
});

/**
 * Platform Analytics & Real-Time Stats
 */
router.get('/stats', requireAdmin, async (_req, res) => {
  try {
    const [
      userCountRes,
      depositSumRes,
      withdrawSumRes,
      roundsStatsRes,
      netCashRes,
      jackpotPoolRes,
      jackpotPaidRes,
      agentStatsRes,
      weeklyRevenueRes
    ] = await Promise.all([
      query(
        "SELECT COUNT(*) as count FROM users WHERE role = 'player' AND (is_bot IS NULL OR is_bot = false) AND full_name NOT LIKE 'Synthetic%'"
      ),
      query("SELECT COALESCE(SUM(amount), 0) as total FROM deposit_requests WHERE status = 'approved'"),
      query("SELECT COALESCE(SUM(amount), 0) as total FROM withdrawal_requests WHERE status = 'approved'"),
      query(`
        SELECT 
          COUNT(*) as total_games_played,
          COUNT(*) FILTER (WHERE started_at >= CURRENT_DATE) as today_games_played,
          COALESCE(SUM(platform_fee), 0) as total_house_revenue,
          COALESCE(SUM(platform_fee) FILTER (WHERE started_at >= CURRENT_DATE), 0) as today_house_revenue
        FROM game_rounds
      `),
      query(`
        SELECT 
          COALESCE(SUM(amount) FILTER (WHERE wt.type = 'bet'), 0) -
          COALESCE(SUM(amount) FILTER (WHERE wt.type = 'win'), 0) -
          COALESCE(SUM(amount) FILTER (WHERE wt.type = 'refund'), 0) as today_net_cash_profit
        FROM wallet_transactions wt
        JOIN users u ON wt.user_id = u.id
        WHERE wt.created_at >= CURRENT_DATE
          AND u.role = 'player'
          AND (u.is_bot IS NULL OR u.is_bot = false)
      `),
      query("SELECT COALESCE(SUM(balance), 0) as total_jackpot_pool FROM jackpot_pool"),
      query("SELECT COALESCE(SUM(amount), 0) as total_jackpot_paid FROM jackpot_winners"),
      query(`
        SELECT 
          COUNT(*) as total_agents,
          COALESCE(SUM(wallet_balance), 0) as total_agent_balance,
          COUNT(*) FILTER (WHERE status = 'active') as active_agents
        FROM agent_profiles
      `),
      query(`
        SELECT 
          TO_CHAR(d::date, 'Dy') as day_name,
          TO_CHAR(d::date, 'YYYY-MM-DD') as round_date,
          COALESCE(SUM(gr.platform_fee), 0) as daily_revenue
        FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, '1 day'::interval) d
        LEFT JOIN game_rounds gr ON DATE(gr.started_at) = d::date
        GROUP BY d::date
        ORDER BY d::date ASC
      `)
    ]);

    const rStats = roundsStatsRes.rows[0] || {};
    const netCash = parseFloat(netCashRes.rows[0]?.today_net_cash_profit || '0');
    const aStats = agentStatsRes.rows[0] || {};

    return res.json({
      success: true,
      stats: {
        totalPlayers: parseInt(userCountRes.rows[0]?.count || '0', 10),
        totalDeposits: parseFloat(depositSumRes.rows[0]?.total || '0'),
        totalWithdrawals: parseFloat(withdrawSumRes.rows[0]?.total || '0'),
        totalGamesPlayed: parseInt(rStats.total_games_played || '0', 10),
        todayGamesPlayed: parseInt(rStats.today_games_played || '0', 10),
        totalHouseRevenue: parseFloat(rStats.total_house_revenue || '0'),
        todayHouseRevenue: parseFloat(rStats.today_house_revenue || '0'),
        todayNetCashProfit: netCash,
        totalJackpotPool: parseFloat(jackpotPoolRes.rows[0]?.total_jackpot_pool || '0'),
        totalJackpotPaid: parseFloat(jackpotPaidRes.rows[0]?.total_jackpot_paid || '0'),
        defaultCommissionRate: 20,
        totalAgents: parseInt(aStats.total_agents || '0', 10),
        totalAgentBalance: parseFloat(aStats.total_agent_balance || '0'),
        activeAgentsCount: parseInt(aStats.active_agents || '0', 10),
        weeklyRevenue: weeklyRevenueRes.rows.map(r => ({
          day: r.day_name,
          date: r.round_date,
          revenue: parseFloat(r.daily_revenue || '0')
        }))
      }
    });
  } catch (error: any) {
    console.error('❌ [Admin Stats Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve stats' });
  }
});

/**
 * Registered Bot Player Accounts Desk (Dedicated Admin Management)
 */
router.get('/bot-users', requireAdmin, async (_req, res) => {
  try {
    const botsRes = await query(`
      SELECT 
        u.id,
        u.full_name as name,
        COALESCE(u.phone, '0912345678') as phone,
        COALESCE(w.balance, 0.00) as balance,
        COALESCE(w.bonus, 0.00) as bonus,
        u.status,
        u.created_at as "createdAt",
        (SELECT COUNT(*) FROM wallet_transactions WHERE user_id = u.id AND type = 'win') as "totalWins",
        COALESCE((SELECT SUM(amount) FROM wallet_transactions WHERE user_id = u.id AND type = 'win'), 0) as "totalWonAmount"
      FROM users u
      LEFT JOIN wallets w ON u.id = w.user_id
      WHERE u.is_bot = true
      ORDER BY u.created_at ASC
    `);

    const formatted = botsRes.rows.map(b => ({
      id: b.id,
      name: b.name,
      phone: b.phone,
      balance: parseFloat(b.balance),
      bonus: parseFloat(b.bonus),
      status: b.status,
      totalWins: parseInt(b.totalWins || '0', 10),
      totalWonAmount: parseFloat(b.totalWonAmount || '0'),
      createdAt: b.createdAt
    }));

    return res.json({ success: true, bots: formatted, count: formatted.length });
  } catch (error: any) {
    console.error('❌ [Admin Bot Users Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve bot users' });
  }
});

/**
 * Auto-Replenish House Bot Accounts to 500 ETB
 */
router.post('/bot-users/replenish', requireAdmin, async (_req, res) => {
  try {
    await query(`
      UPDATE wallets 
      SET balance = 500.00, updated_at = NOW() 
      WHERE user_id IN (SELECT id FROM users WHERE is_bot = true) AND balance < 50.00
    `);
    return res.json({ success: true, message: 'All low bot balances replenished to 500.00 ETB' });
  } catch (error: any) {
    console.error('❌ [Admin Replenish Bots Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to replenish bots' });
  }
});

/**
 * Get Live Fairness & Win Rate Engine Configuration
 */
router.get('/fairness-config', requireAdmin, async (_req, res) => {
  try {
    const config = gameEngine.getFairnessConfig();
    return res.json({ success: true, config });
  } catch (error: any) {
    console.error('❌ [Admin Fairness Config GET Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve fairness config' });
  }
});

/**
 * Update Fairness & Win Rate Engine Configuration
 */
router.post('/fairness-config', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { ownerWinRate, botWinRate, roomCapacity } = req.body;
    gameEngine.setFairnessConfig({
      ownerWinRate: typeof ownerWinRate === 'number' ? ownerWinRate : undefined,
      botWinRate: typeof botWinRate === 'number' ? botWinRate : undefined,
      roomCapacity: typeof roomCapacity === 'number' ? roomCapacity : undefined
    });
    return res.json({ success: true, config: gameEngine.getFairnessConfig() });
  } catch (error: any) {
    console.error('❌ [Admin Fairness Config POST Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to update fairness config' });
  }
});

/**
 * GET /api/admin/bot-config
 * Returns current standby bot configuration (0-50), living clock state, and live Room 10 telemetry
 */
router.get('/bot-config', requireAdmin, async (_req, res) => {
  try {
    const botConfig = gameEngine.getBotConfig();
    const room10 = gameEngine.getRoom('room-10');
    return res.json({
      success: true,
      botConfig,
      telemetry: {
        activeBotCount: room10 ? room10.opponentCards.length : 0,
        roundNumber: room10 ? room10.roundNumber : 1,
        phase: room10 ? room10.phase : 'lobby',
        totalPot: room10 ? room10.totalPot : 0,
        winnerPayout: room10 ? room10.winnerPayout : 0,
        realPlayerCount: room10 ? room10.realPlayerCount : 0
      }
    });
  } catch (error: any) {
    console.error('❌ [Admin Bot Config GET Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve bot config' });
  }
});

/**
 * POST /api/admin/bot-config
 * Updates Room 10 bot pool settings (0 to 50 bots), mode, living clock, etc.
 * Broadcasts bot_config_updated event via Socket.IO
 */
router.post('/bot-config', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { mode, minBots, maxBots, fixedCount, staggeredJoin, livingClock } = req.body;

    // Validate mode if provided
    if (mode !== undefined && !['dynamic', 'fixed', 'disabled'].includes(mode)) {
      return res.status(400).json({ success: false, error: "Invalid mode. Allowed: 'dynamic', 'fixed', 'disabled'" });
    }

    // Validate bounds (0 to 50)
    if (minBots !== undefined && (typeof minBots !== 'number' || minBots < 0 || minBots > 50)) {
      return res.status(400).json({ success: false, error: "minBots must be between 0 and 50" });
    }
    if (maxBots !== undefined && (typeof maxBots !== 'number' || maxBots < 0 || maxBots > 50)) {
      return res.status(400).json({ success: false, error: "maxBots must be between 0 and 50" });
    }
    if (minBots !== undefined && maxBots !== undefined && minBots > maxBots) {
      return res.status(400).json({ success: false, error: "minBots cannot be greater than maxBots" });
    }
    if (fixedCount !== undefined && (typeof fixedCount !== 'number' || fixedCount < 0 || fixedCount > 50)) {
      return res.status(400).json({ success: false, error: "fixedCount must be between 0 and 50" });
    }

    gameEngine.setBotConfig({
      mode,
      minBots,
      maxBots,
      fixedCount,
      staggeredJoin: typeof staggeredJoin === 'boolean' ? staggeredJoin : undefined,
      livingClock: typeof livingClock === 'boolean' ? livingClock : undefined
    });

    const updatedConfig = gameEngine.getBotConfig();
    const room10 = gameEngine.getRoom('room-10');

    // Broadcast update over WebSockets
    io.emit('bot_config_updated', {
      botConfig: updatedConfig,
      roomId: 'room-10',
      activeBotCount: room10 ? room10.opponentCards.length : 0
    });

    return res.json({
      success: true,
      botConfig: updatedConfig,
      telemetry: {
        activeBotCount: room10 ? room10.opponentCards.length : 0,
        roundNumber: room10 ? room10.roundNumber : 1,
        phase: room10 ? room10.phase : 'lobby'
      }
    });
  } catch (error: any) {
    console.error('❌ [Admin Bot Config POST Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to update bot config' });
  }
});

/**
 * Live Neon PostgreSQL Health & Storage Quota Monitor
 */
router.get('/database-health', requireAdmin, async (_req, res) => {
  try {
    const stats = await getDatabaseStorageStats();
    return res.json({ success: true, stats });
  } catch (error: any) {
    console.error('❌ [Admin DB Health Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to query database health' });
  }
});

/**
 * 1-Click Authoritative Database Snapshot Download (JSON)
 */
router.get('/database-backup', requireAdmin, async (_req, res) => {
  try {
    const backup = await exportDatabaseBackup();
    const filename = `neon-backup-${new Date().toISOString().slice(0, 10)}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(JSON.stringify(backup, null, 2));
  } catch (error: any) {
    console.error('❌ [Admin DB Backup Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to generate database backup' });
  }
});

/**
 * Free-Tier Storage Optimizer: Prune Heavy Base64 Receipts Older than 30 Days
 */
router.post('/database-prune', requireAdmin, async (_req, res) => {
  try {
    // Prune base64 receipt screenshots for resolved deposits older than 30 days
    const result = await query(`
      UPDATE deposit_requests
      SET receipt_image = '[ARCHIVED_SAVED_STORAGE]'
      WHERE status IN ('approved', 'rejected')
        AND receipt_image IS NOT NULL
        AND receipt_image NOT LIKE '[ARCHIVED%'
        AND created_at < NOW() - INTERVAL '30 days'
    `);

    const stats = await getDatabaseStorageStats();
    return res.json({
      success: true,
      message: `Pruned base64 receipts from ${result.rowCount} legacy deposits.`,
      prunedCount: result.rowCount,
      stats
    });
  } catch (error: any) {
    console.error('❌ [Admin DB Prune Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to optimize database storage' });
  }
});

/**
 * Progressive Jackpots Desk: View all pools & recent jackpot winners
 */
router.get('/jackpots', requireAdmin, async (_req, res) => {
  try {
    const [poolsRes, winnersRes] = await Promise.all([
      query(`
        SELECT jp.*, gr.name as room_name, gr.stake_amount
        FROM jackpot_pool jp
        LEFT JOIN game_rooms gr ON jp.room_id = gr.id
        ORDER BY jp.room_id
      `),
      query(`
        SELECT jw.*, u.full_name as winner_name, u.phone as winner_phone, gr.name as room_name
        FROM jackpot_winners jw
        JOIN users u ON jw.user_id = u.id
        LEFT JOIN game_rooms gr ON jw.room_id = gr.id
        ORDER BY jw.won_at DESC
        LIMIT 50
      `)
    ]);

    const pools = poolsRes.rows.map(row => {
      const liveRoom = gameEngine.getRoom(row.room_id);
      return {
        ...row,
        liveBalance: liveRoom?.jackpotPoolBalance !== undefined ? liveRoom.jackpotPoolBalance : parseFloat(row.balance || '0')
      };
    });

    return res.json({
      success: true,
      pools,
      winners: winnersRes.rows
    });
  } catch (error: any) {
    console.error('❌ [Admin Jackpots GET Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve jackpot data' });
  }
});

/**
 * Progressive Jackpots Desk: Admin Seed / Balance Adjustment
 */
router.post('/jackpots/adjust', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { roomId, balance, seedAmount } = req.body;
    if (!roomId) {
      return res.status(400).json({ success: false, error: 'Room ID is required' });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (typeof balance === 'number' && balance >= 0) {
      updates.push(`balance = $${idx++}`);
      values.push(balance);
    }
    if (typeof seedAmount === 'number' && seedAmount >= 0) {
      updates.push(`seed_amount = $${idx++}`);
      values.push(seedAmount);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid fields to update' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(roomId);

    const updateQuery = `
      UPDATE jackpot_pool 
      SET ${updates.join(', ')} 
      WHERE room_id = $${idx} 
      RETURNING *
    `;

    const result = await query(updateQuery, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Jackpot pool for room not found' });
    }

    // Update in-memory engine pool immediately
    const updatedRow = result.rows[0];
    const liveRoom = gameEngine.getRoom(roomId);
    if (liveRoom && typeof balance === 'number') {
      liveRoom.jackpotPoolBalance = balance;
      if (roomId === 'room-10') {
        const arena = gameEngine.getRoom('lomi-arena');
        if (arena) arena.jackpotPoolBalance = balance;
        const def = gameEngine.getRoom('default');
        if (def) def.jackpotPoolBalance = balance;
      }
    }

    return res.json({
      success: true,
      message: `Progressive jackpot pool for ${roomId} updated successfully`,
      pool: updatedRow
    });
  } catch (error: any) {
    console.error('❌ [Admin Jackpots Adjust Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to adjust jackpot pool' });
  }
});

/**
 * Coins & Rewards Desk: View circulation, top coin holders & recent coin transactions
 */
router.get('/coins', requireAdmin, async (_req, res) => {
  try {
    const [statsRes, topUsersRes, recentTxRes] = await Promise.all([
      query(`
        SELECT 
          COALESCE(SUM(balance), 0) as total_circulation,
          COALESCE(SUM(lifetime_earned), 0) as total_earned,
          COALESCE(SUM(lifetime_redeemed), 0) as total_redeemed,
          COUNT(*) as total_holders
        FROM coin_wallets
      `),
      query(`
        SELECT cw.*, u.full_name as user_name, u.phone as user_phone
        FROM coin_wallets cw
        JOIN users u ON cw.user_id = u.id
        ORDER BY cw.balance DESC
        LIMIT 25
      `),
      query(`
        SELECT ct.*, u.full_name as user_name, u.phone as user_phone
        FROM coin_transactions ct
        JOIN users u ON ct.user_id = u.id
        ORDER BY ct.created_at DESC
        LIMIT 50
      `)
    ]);

    const s = statsRes.rows[0] || {};
    return res.json({
      success: true,
      stats: {
        totalCirculation: parseInt(s.total_circulation || '0', 10),
        totalEarned: parseInt(s.total_earned || '0', 10),
        totalRedeemed: parseInt(s.total_redeemed || '0', 10),
        totalHolders: parseInt(s.total_holders || '0', 10),
        earningRate: '1.5 coins per 1 ETB deposit',
        redemptionRate: '1,000 coins = 10 ETB bonus'
      },
      topHolders: topUsersRes.rows,
      recentTransactions: recentTxRes.rows
    });
  } catch (error: any) {
    console.error('❌ [Admin Coins GET Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve coin statistics' });
  }
});

/**
 * Coins & Rewards Desk: Admin Manual Coin Credit/Debit
 */
router.post('/coins/adjust', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { userId, amount, reason } = req.body;
    if (!userId || typeof amount !== 'number' || amount === 0) {
      return res.status(400).json({ success: false, error: 'Valid userId and non-zero amount are required' });
    }

    const desc = reason || `Admin manual adjustment of ${amount > 0 ? '+' : ''}${amount} coins`;
    const result = await coinService.adminAdjustCoins(userId, amount, desc);

    return res.json({
      success: true,
      message: `Coins adjusted successfully for user ${userId}`,
      newBalance: result.newBalance
    });
  } catch (error: any) {
    console.error('❌ [Admin Coins Adjust Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to adjust coins' });
  }
});

/**
 * Agents Desk: List All Registered Agents
 */
router.get('/agents', requireAdmin, async (_req, res) => {
  try {
    const [agentsRes, summaryRes] = await Promise.all([
      query(`
        SELECT 
          ap.*,
          u.full_name,
          u.phone,
          u.created_at as user_created_at,
          COALESCE((SELECT COUNT(*) FROM users WHERE agent_id = ap.id), 0) as total_players,
          COALESCE((SELECT COUNT(*) FROM users WHERE agent_id = ap.id AND has_deposited = true), 0) as active_players,
          COALESCE((SELECT SUM(amount) FROM agent_player_deposits WHERE agent_id = ap.id), 0) as total_volume_deposited
        FROM agent_profiles ap
        JOIN users u ON ap.user_id = u.id
        ORDER BY ap.created_at DESC
      `),
      query(`
        SELECT 
          COUNT(*) as total_agents,
          COUNT(*) FILTER (WHERE status = 'active') as active_agents,
          COUNT(*) FILTER (WHERE status = 'pending') as pending_agents,
          COUNT(*) FILTER (WHERE status = 'suspended') as suspended_agents,
          COALESCE(SUM(wallet_balance), 0) as total_float,
          COUNT(*) FILTER (WHERE wallet_balance < low_balance_threshold AND status = 'active') as low_balance_alerts
        FROM agent_profiles
      `)
    ]);

    const s = summaryRes.rows[0] || {};

    return res.json({
      success: true,
      summary: {
        totalAgents: parseInt(s.total_agents || '0', 10),
        activeAgents: parseInt(s.active_agents || '0', 10),
        pendingAgents: parseInt(s.pending_agents || '0', 10),
        suspendedAgents: parseInt(s.suspended_agents || '0', 10),
        totalFloat: parseFloat(s.total_float || '0'),
        lowBalanceAlerts: parseInt(s.low_balance_alerts || '0', 10)
      },
      agents: agentsRes.rows.map(row => ({
        ...row,
        city: row.city || 'Addis Ababa',
        target_players: parseInt(row.target_players || '50', 10),
        portal_access: row.portal_access ?? true,
        wallet_balance: parseFloat(row.wallet_balance || '0'),
        initial_deposit: parseFloat(row.initial_deposit || '10000'),
        low_balance_threshold: parseFloat(row.low_balance_threshold || '1000'),
        target_monthly: parseFloat(row.target_monthly || '50000'),
        commission_rate: parseFloat(row.commission_rate || '3.00'),
        cashout_commission_rate: parseFloat(row.cashout_commission_rate || '2.00'),
        total_players: parseInt(row.total_players || '0', 10),
        active_players: parseInt(row.active_players || '0', 10),
        total_volume_deposited: parseFloat(row.total_volume_deposited || '0'),
        refLink: `https://t.me/SonicGameOfficialBot?start=agent_${row.agent_code}`
      }))
    });
  } catch (error: any) {
    console.error('❌ [Admin GET Agents Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve agents list' });
  }
});

/**
 * Agents Desk: Get Detailed Agent Profile, Recruited Players & Cash Flow
 */
router.get('/agents/:id/details', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const agentRes = await query(`
      SELECT ap.*, u.full_name, u.phone, u.created_at as user_created_at
      FROM agent_profiles ap
      JOIN users u ON ap.user_id = u.id
      WHERE ap.id = $1
    `, [id]);

    if (agentRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Agent profile not found' });
    }
    const agent = agentRes.rows[0];

    const [playersRes, depositsRes, payoutsRes, recentTxRes] = await Promise.all([
      query(`
        SELECT u.id, u.full_name, u.phone, u.created_at, u.has_deposited,
               COALESCE(w.balance, 0) as wallet_balance,
               COALESCE((SELECT SUM(amount) FROM deposit_requests WHERE user_id = u.id AND status = 'approved'), 0) as total_deposited
        FROM users u
        LEFT JOIN wallets w ON u.id = w.user_id
        WHERE u.agent_id = $1
        ORDER BY u.created_at DESC
        LIMIT 50
      `, [id]),
      query(`
        SELECT COALESCE(SUM(amount), 0) as total_deposits, COUNT(*) as total_deposit_count
        FROM agent_player_deposits
        WHERE agent_id = $1
      `, [id]),
      query(`
        SELECT COALESCE(SUM(amount), 0) as total_payouts, COUNT(*) as total_payout_count
        FROM agent_commission_payout_requests
        WHERE agent_id = $1 AND status = 'approved'
      `, [id]),
      query(`
        SELECT 
          apd.id, 
          COALESCE(u.full_name, 'Player') as player_name, 
          COALESCE(u.phone, '—') as player_phone, 
          apd.amount, 
          apd.payment_method as deposit_method, 
          'completed' as status, 
          apd.created_at
        FROM agent_player_deposits apd
        LEFT JOIN users u ON apd.player_user_id = u.id
        WHERE apd.agent_id = $1
        ORDER BY apd.created_at DESC
        LIMIT 10
      `, [id])
    ]);

    return res.json({
      success: true,
      agent: {
        ...agent,
        city: agent.city || 'Addis Ababa',
        target_players: parseInt(agent.target_players || '50', 10),
        portal_access: agent.portal_access ?? true,
        wallet_balance: parseFloat(agent.wallet_balance || '0'),
        commission_rate: parseFloat(agent.commission_rate || '3.00'),
        cashout_commission_rate: parseFloat(agent.cashout_commission_rate || '2.00'),
        target_monthly: parseFloat(agent.target_monthly || '50000.00'),
        low_balance_threshold: parseFloat(agent.low_balance_threshold || '1000.00'),
        refLink: `https://t.me/SonicGameOfficialBot?start=agent_${agent.agent_code}`
      },
      stats: {
        totalDeposits: parseFloat(depositsRes.rows[0]?.total_deposits || '0'),
        depositCount: parseInt(depositsRes.rows[0]?.total_deposit_count || '0', 10),
        totalPayouts: parseFloat(payoutsRes.rows[0]?.total_payouts || '0'),
        payoutCount: parseInt(payoutsRes.rows[0]?.total_payout_count || '0', 10),
        totalPlayers: playersRes.rows.length
      },
      players: playersRes.rows.map(p => ({
        id: p.id,
        fullName: p.full_name || 'Player',
        phone: p.phone,
        balance: parseFloat(p.wallet_balance || '0'),
        totalDeposited: parseFloat(p.total_deposited || '0'),
        hasDeposited: p.has_deposited || false,
        createdAt: p.created_at
      })),
      recentTransactions: recentTxRes.rows
    });
  } catch (error: any) {
    console.error('❌ [Admin Agent Details Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve agent details' });
  }
});

/**
 * Agents Desk: Create / Register New Agent
 */
router.post('/agents/create', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      fullName,
      phone,
      city,
      initialDeposit,
      targetMonthly,
      targetPlayers,
      commissionRate,
      cashoutCommissionRate,
      customCode,
      password
    } = req.body;

    if (!fullName || !phone) {
      return res.status(400).json({ success: false, error: 'Full name and phone number are required' });
    }

    const cleanPhone = phone.trim();
    const cleanName = fullName.trim();
    const cleanCity = (city || 'Addis Ababa').trim();
    const initDeposit = typeof initialDeposit === 'number' && initialDeposit >= 0 ? initialDeposit : 10000.00;
    const target = typeof targetMonthly === 'number' && targetMonthly > 0 ? targetMonthly : 50000.00;
    const playersTarget = typeof targetPlayers === 'number' && targetPlayers > 0 ? targetPlayers : 50;
    const depCommission = typeof commissionRate === 'number' && commissionRate >= 0 ? commissionRate : 3.00;
    const withCommission = typeof cashoutCommissionRate === 'number' && cashoutCommissionRate >= 0 ? cashoutCommissionRate : 2.00;

    // Use admin-supplied password or generate secure default
    const rawPassword = (typeof password === 'string' && password.trim().length >= 4)
      ? password.trim()
      : `Sonic@${Math.floor(1000 + Math.random() * 9000)}`;
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    const agentCode = customCode
      ? customCode.trim().toUpperCase()
      : `AGT-${Math.floor(1000 + Math.random() * 9000)}`;

    const result = await withTransaction(async (client) => {
      let userId: string;
      const userCheck = await client.query('SELECT id FROM users WHERE phone = $1', [cleanPhone]);

      if (userCheck.rows.length > 0) {
        userId = userCheck.rows[0].id;
        await client.query(
          "UPDATE users SET role = 'agent', full_name = $1, password_hash = $2, pin_hash = $2, updated_at = NOW() WHERE id = $3",
          [cleanName, hashedPassword, userId]
        );
      } else {
        const newUserRes = await client.query(
          "INSERT INTO users (phone, full_name, role, password_hash, pin_hash) VALUES ($1, $2, 'agent', $3, $3) RETURNING id",
          [cleanPhone, cleanName, hashedPassword]
        );
        userId = newUserRes.rows[0].id;
        await client.query("INSERT INTO wallets (user_id, balance, bonus) VALUES ($1, 0.00, 20.00)", [userId]);
      }

      const profileCheck = await client.query('SELECT id FROM agent_profiles WHERE user_id = $1', [userId]);
      if (profileCheck.rows.length > 0) {
        throw new Error('This user is already registered as an agent.');
      }

      const apRes = await client.query(
        `INSERT INTO agent_profiles (
          user_id, agent_code, status, wallet_balance, initial_deposit,
          low_balance_threshold, target_monthly, target_players,
          commission_rate, cashout_commission_rate, city, portal_access
        )
        VALUES ($1, $2, 'active', $3, $3, 1000.00, $4, $5, $6, $7, $8, true)
        RETURNING *`,
        [userId, agentCode, initDeposit, target, playersTarget, depCommission, withCommission, cleanCity]
      );

      return {
        userId,
        profile: apRes.rows[0]
      };
    });

    return res.json({
      success: true,
      message: `Agent registered successfully with code ${result.profile.agent_code}`,
      agent: {
        ...result.profile,
        fullName: cleanName,
        phone: cleanPhone,
        city: cleanCity,
        initialPassword: rawPassword,
        refLink: `https://t.me/SonicGameOfficialBot?start=agent_${result.profile.agent_code}`
      }
    });
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(409).json({ success: false, error: 'Agent code or phone already exists.' });
    }
    console.error('❌ [Admin Create Agent Error]:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to create agent' });
  }
});

/**
 * Agents Desk: Full Control Edit Agent
 */
router.put('/agents/:id', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const {
      fullName,
      phone,
      city,
      commissionRate,
      cashoutCommissionRate,
      targetMonthly,
      targetPlayers,
      lowBalanceThreshold,
      walletBalance,
      password,
      status,
      portalAccess
    } = req.body;

    const agentRes = await query('SELECT * FROM agent_profiles WHERE id = $1', [id]);
    if (agentRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Agent profile not found' });
    }
    const agent = agentRes.rows[0];
    const userId = agent.user_id;

    await withTransaction(async (client) => {
      // 1. Update user fields
      const userUpdates: string[] = [];
      const userValues: any[] = [];
      let uIdx = 1;

      if (typeof fullName === 'string' && fullName.trim()) {
        userUpdates.push(`full_name = $${uIdx++}`);
        userValues.push(fullName.trim());
      }
      if (typeof phone === 'string' && phone.trim()) {
        userUpdates.push(`phone = $${uIdx++}`);
        userValues.push(phone.trim());
      }
      if (typeof password === 'string' && password.trim().length >= 4) {
        const hash = await bcrypt.hash(password.trim(), 10);
        userUpdates.push(`password_hash = $${uIdx++}`);
        userValues.push(hash);
        userUpdates.push(`pin_hash = $${uIdx++}`);
        userValues.push(hash);
      }

      if (userUpdates.length > 0) {
        userUpdates.push('updated_at = NOW()');
        userValues.push(userId);
        await client.query(
          `UPDATE users SET ${userUpdates.join(', ')} WHERE id = $${uIdx}`,
          userValues
        );
      }

      // 2. Update agent profile fields
      const profUpdates: string[] = [];
      const profValues: any[] = [];
      let pIdx = 1;

      if (typeof commissionRate === 'number' && commissionRate >= 0) {
        profUpdates.push(`commission_rate = $${pIdx++}`);
        profValues.push(commissionRate);
      }
      if (typeof cashoutCommissionRate === 'number' && cashoutCommissionRate >= 0) {
        profUpdates.push(`cashout_commission_rate = $${pIdx++}`);
        profValues.push(cashoutCommissionRate);
      }
      if (typeof city === 'string' && city.trim()) {
        profUpdates.push(`city = $${pIdx++}`);
        profValues.push(city.trim());
      }
      if (typeof targetMonthly === 'number' && targetMonthly >= 0) {
        profUpdates.push(`target_monthly = $${pIdx++}`);
        profValues.push(targetMonthly);
      }
      if (typeof targetPlayers === 'number' && targetPlayers >= 0) {
        profUpdates.push(`target_players = $${pIdx++}`);
        profValues.push(targetPlayers);
      }
      if (typeof lowBalanceThreshold === 'number' && lowBalanceThreshold >= 0) {
        profUpdates.push(`low_balance_threshold = $${pIdx++}`);
        profValues.push(lowBalanceThreshold);
      }
      if (typeof walletBalance === 'number' && walletBalance >= 0) {
        profUpdates.push(`wallet_balance = $${pIdx++}`);
        profValues.push(walletBalance);
      }
      if (typeof status === 'string' && ['active', 'suspended', 'pending'].includes(status)) {
        profUpdates.push(`status = $${pIdx++}`);
        profValues.push(status);
      }
      if (typeof portalAccess === 'boolean') {
        profUpdates.push(`portal_access = $${pIdx++}`);
        profValues.push(portalAccess);
      }

      if (profUpdates.length > 0) {
        profUpdates.push('updated_at = NOW()');
        profValues.push(id);
        await client.query(
          `UPDATE agent_profiles SET ${profUpdates.join(', ')} WHERE id = $${pIdx}`,
          profValues
        );
      }
    });

    const updatedRes = await query(
      `SELECT ap.*, u.full_name, u.phone 
       FROM agent_profiles ap 
       JOIN users u ON ap.user_id = u.id 
       WHERE ap.id = $1`,
      [id]
    );

    return res.json({
      success: true,
      message: 'Agent information updated successfully',
      agent: updatedRes.rows[0]
    });
  } catch (error: any) {
    console.error('❌ [Admin Update Agent Error]:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to update agent' });
  }
});

/**
 * Agents Desk: Toggle Portal Access
 */
router.post('/agents/:id/portal-toggle', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { portalAccess } = req.body;
    const updateRes = await query(
      'UPDATE agent_profiles SET portal_access = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [Boolean(portalAccess), id]
    );
    if (updateRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }
    return res.json({ success: true, agent: updateRes.rows[0] });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Agents Desk: Delete Agent (Safe Revocation)
 */
router.delete('/agents/:id', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const agentRes = await query('SELECT * FROM agent_profiles WHERE id = $1', [id]);
    if (agentRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Agent profile not found' });
    }
    const agent = agentRes.rows[0];
    const userId = agent.user_id;

    await withTransaction(async (client) => {
      await client.query("DELETE FROM agent_recharge_requests WHERE agent_id = $1 AND status = 'pending'", [id]);
      await client.query('DELETE FROM agent_profiles WHERE id = $1', [id]);
      await client.query("UPDATE users SET role = 'player', updated_at = NOW() WHERE id = $1", [userId]);
    });

    return res.json({
      success: true,
      message: `Agent ${agent.agent_code} deleted successfully. Account downgraded to player.`
    });
  } catch (error: any) {
    console.error('❌ [Admin Delete Agent Error]:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to delete agent' });
  }
});

/**
 * Agents Desk: Update Agent Status (active / suspended)
 */
router.post('/agents/:id/status', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'suspended', 'pending'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status value' });
    }

    const updateRes = await query(
      'UPDATE agent_profiles SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, id]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }

    return res.json({
      success: true,
      message: `Agent status updated to ${status}`,
      agent: updateRes.rows[0]
    });
  } catch (error: any) {
    console.error('❌ [Admin Agent Status Error]:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/agents/recharges', requireAdmin, async (req, res) => {
  try {
    const status = req.query.status as string;
    const whereClause = status ? 'WHERE arr.status = $1' : '';
    const params = status ? [status] : [];

    const rechargesRes = await query(
      `SELECT arr.*, ap.agent_code, u.full_name as agent_name, u.phone as agent_phone, ap.wallet_balance as current_agent_balance
       FROM agent_recharge_requests arr
       JOIN agent_profiles ap ON arr.agent_id = ap.id
       JOIN users u ON ap.user_id = u.id
       ${whereClause}
       ORDER BY arr.created_at DESC
       LIMIT 100`,
      params
    );

    return res.json({
      success: true,
      recharges: rechargesRes.rows
    });
  } catch (error: any) {
    console.error('❌ [Admin Agent Recharges GET Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve agent recharge requests' });
  }
});

/**
 * Agents Desk: Approve Agent Recharge Request
 */
router.post('/agents/recharges/:id/approve', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user!.id;

    const result = await withTransaction(async (client) => {
      const reqRes = await client.query(
        'SELECT * FROM agent_recharge_requests WHERE id = $1 FOR UPDATE',
        [id]
      );

      if (reqRes.rows.length === 0) {
        throw new Error('Recharge request not found');
      }

      const recharge = reqRes.rows[0];
      if (recharge.status !== 'pending') {
        throw new Error(`Request is already ${recharge.status}`);
      }

      const amount = parseFloat(recharge.amount);

      // 1. Mark recharge approved
      await client.query(
        `UPDATE agent_recharge_requests 
         SET status = 'approved', reviewed_by = $1, reviewed_at = NOW() 
         WHERE id = $2`,
        [adminId, id]
      );

      // 2. Credit agent wallet
      const agentRes = await client.query(
        `UPDATE agent_profiles 
         SET wallet_balance = wallet_balance + $1, 
             low_balance_alert_sent = FALSE,
             updated_at = NOW() 
         WHERE id = $2 
         RETURNING wallet_balance, agent_code`,
        [amount, recharge.agent_id]
      );

      return {
        agentId: recharge.agent_id,
        amount,
        newBalance: parseFloat(agentRes.rows[0]?.wallet_balance || '0'),
        agentCode: agentRes.rows[0]?.agent_code
      };
    });

    // Notify agent via WebSocket
    io.emit(`agent_${result.agentId}_balance`, {
      type: 'recharge_approved',
      amount: result.amount,
      newBalance: result.newBalance
    });

    return res.json({
      success: true,
      message: `Recharge of ${result.amount.toFixed(2)} ETB approved for agent ${result.agentCode}`,
      newAgentBalance: result.newBalance
    });
  } catch (error: any) {
    console.error('❌ [Admin Approve Recharge Error]:', error);
    return res.status(400).json({ success: false, error: error.message || 'Failed to approve recharge request' });
  }
});

/**
 * Agents Desk: Reject Agent Recharge Request
 */
router.post('/agents/recharges/:id/reject', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user!.id;
    const { adminNotes } = req.body;

    const result = await query(
      `UPDATE agent_recharge_requests 
       SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW(), admin_notes = $2 
       WHERE id = $3 AND status = 'pending' 
       RETURNING *`,
      [adminId, adminNotes || 'Rejected by admin', id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Pending recharge request not found' });
    }

    return res.json({
      success: true,
      message: 'Recharge request rejected',
      recharge: result.rows[0]
    });
  } catch (error: any) {
    console.error('❌ [Admin Reject Recharge Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to reject recharge request' });
  }
});

/**
 * Agent Commission Payout Requests (Admin Control Desk)
 * GET /api/admin/agents/payouts
 */
router.get('/agents/payouts', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const status = (req.query.status as string || 'all').toLowerCase();
    let sql = `
      SELECT acpr.id, acpr.agent_id, acpr.amount, acpr.payout_method, acpr.payout_account,
             acpr.status, acpr.admin_notes, acpr.created_at, acpr.settled_at,
             ap.agent_code, ap.commission_balance, ap.wallet_balance,
             u.full_name as agent_name, u.phone as agent_phone, u.telegram_username as agent_username
      FROM agent_commission_payout_requests acpr
      JOIN agent_profiles ap ON acpr.agent_id = ap.id
      JOIN users u ON ap.user_id = u.id
    `;
    const params: any[] = [];
    if (status !== 'all') {
      params.push(status);
      sql += ` WHERE acpr.status = $${params.length}`;
    }
    sql += ` ORDER BY acpr.created_at DESC LIMIT 100`;

    const [payoutsRes, countsRes] = await Promise.all([
      query(sql, params),
      query(`
        SELECT 
          COUNT(*) as total_count,
          COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
          COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
          COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count,
          COALESCE(SUM(amount) FILTER (WHERE status = 'approved'), 0) as total_approved_amount,
          COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0) as total_pending_amount
        FROM agent_commission_payout_requests
      `)
    ]);

    const c = countsRes.rows[0] || {};
    return res.json({
      success: true,
      pendingCount: parseInt(c.pending_count || '0', 10),
      summary: {
        totalCount: parseInt(c.total_count || '0', 10),
        pendingCount: parseInt(c.pending_count || '0', 10),
        approvedCount: parseInt(c.approved_count || '0', 10),
        rejectedCount: parseInt(c.rejected_count || '0', 10),
        totalApprovedAmount: parseFloat(c.total_approved_amount || '0'),
        totalPendingAmount: parseFloat(c.total_pending_amount || '0')
      },
      payouts: payoutsRes.rows.map(p => ({
        id: p.id,
        agentId: p.agent_id,
        agentCode: p.agent_code,
        agentName: p.agent_name || 'Agent',
        agentPhone: p.agent_phone || '',
        agentUsername: p.agent_username || '',
        amount: parseFloat(p.amount),
        payoutMethod: p.payout_method,
        payoutAccount: p.payout_account,
        status: p.status,
        adminNotes: p.admin_notes || null,
        createdAt: p.created_at,
        settledAt: p.settled_at
      }))
    });
  } catch (error: any) {
    console.error('❌ [Admin GET Agent Payouts Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve agent payout requests' });
  }
});

/**
 * Approve Agent Commission Payout
 * POST /api/admin/agents/payouts/:id/approve
 */
router.post('/agents/payouts/:id/approve', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { txRef, notes } = req.body;
    const adminRef = (txRef || '').trim() || (notes || '').trim() || 'ADMIN-DISBURSED';

    const result = await withTransaction(async (client) => {
      const pRes = await client.query(
        `SELECT acpr.*, ap.agent_code, ap.user_id, u.full_name as agent_name 
         FROM agent_commission_payout_requests acpr
         JOIN agent_profiles ap ON acpr.agent_id = ap.id
         JOIN users u ON ap.user_id = u.id
         WHERE acpr.id = $1 FOR UPDATE`,
        [id]
      );

      if (pRes.rows.length === 0) {
        throw new Error('Payout request not found');
      }

      const payout = pRes.rows[0];
      if (payout.status !== 'pending') {
        throw new Error(`Payout request is already ${payout.status}`);
      }

      // Mark request as approved with admin transaction reference
      await client.query(
        `UPDATE agent_commission_payout_requests
         SET status = 'approved',
             settled_at = NOW(),
             admin_notes = $1
         WHERE id = $2`,
        [adminRef, id]
      );

      return {
        id: payout.id,
        agentId: payout.agent_id,
        agentCode: payout.agent_code,
        agentName: payout.agent_name,
        amount: parseFloat(payout.amount),
        payoutMethod: payout.payout_method,
        payoutAccount: payout.payout_account,
        adminRef
      };
    });

    // Notify agent via WebSocket
    io.emit(`agent_${result.agentId}_payout_approved`, {
      id: result.id,
      amount: result.amount,
      payoutMethod: result.payoutMethod,
      adminRef: result.adminRef,
      status: 'approved'
    });
    io.emit('agent_payout_status_updated', { id: result.id, status: 'approved' });

    return res.json({
      success: true,
      message: `Commission payout of ${result.amount.toFixed(2)} ETB approved for Agent #${result.agentCode}. Ref: ${result.adminRef}`,
      payout: result
    });
  } catch (error: any) {
    console.error('❌ [Admin Approve Agent Payout Error]:', error);
    return res.status(400).json({ success: false, error: error.message || 'Failed to approve payout request' });
  }
});

/**
 * Reject Agent Commission Payout & Refund Commission Balance
 * POST /api/admin/agents/payouts/:id/reject
 */
router.post('/agents/payouts/:id/reject', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const rejectionReason = (reason || '').trim() || 'Disbursement rejected by compliance';

    const result = await withTransaction(async (client) => {
      const pRes = await client.query(
        `SELECT acpr.*, ap.agent_code, ap.commission_balance, u.full_name as agent_name 
         FROM agent_commission_payout_requests acpr
         JOIN agent_profiles ap ON acpr.agent_id = ap.id
         JOIN users u ON ap.user_id = u.id
         WHERE acpr.id = $1 FOR UPDATE`,
        [id]
      );

      if (pRes.rows.length === 0) {
        throw new Error('Payout request not found');
      }

      const payout = pRes.rows[0];
      if (payout.status !== 'pending') {
        throw new Error(`Payout request is already ${payout.status}`);
      }

      const refundAmount = parseFloat(payout.amount);

      // 1. Mark request rejected
      await client.query(
        `UPDATE agent_commission_payout_requests
         SET status = 'rejected',
             settled_at = NOW(),
             admin_notes = $1
         WHERE id = $2`,
        [rejectionReason, id]
      );

      // 2. Refund deducted commission balance back to agent profile
      const agentUpdateRes = await client.query(
        `UPDATE agent_profiles
         SET commission_balance = COALESCE(commission_balance, 0) + $1,
             updated_at = NOW()
         WHERE id = $2
         RETURNING commission_balance`,
        [refundAmount, payout.agent_id]
      );

      const newCommissionBalance = parseFloat(agentUpdateRes.rows[0]?.commission_balance || '0');

      return {
        id: payout.id,
        agentId: payout.agent_id,
        agentCode: payout.agent_code,
        agentName: payout.agent_name,
        amount: refundAmount,
        newCommissionBalance,
        reason: rejectionReason
      };
    });

    // Notify agent via WebSocket
    io.emit(`agent_${result.agentId}_payout_rejected`, {
      id: result.id,
      amount: result.amount,
      reason: result.reason,
      newCommissionBalance: result.newCommissionBalance,
      status: 'rejected'
    });
    io.emit('agent_payout_status_updated', { id: result.id, status: 'rejected' });

    return res.json({
      success: true,
      message: `Commission payout of ${result.amount.toFixed(2)} ETB rejected for Agent #${result.agentCode}. ${result.amount.toFixed(2)} ETB refunded back to commission balance!`,
      payout: result
    });
  } catch (error: any) {
    console.error('❌ [Admin Reject Agent Payout Error]:', error);
    return res.status(400).json({ success: false, error: error.message || 'Failed to reject payout request' });
  }
});

/**
 * Official Platform Receiving Accounts Management (Admin Control Desk)
 */
router.get('/official-accounts', requireAdmin, async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM payment_accounts ORDER BY display_order ASC, created_at ASC`
    );
    return res.json({
      success: true,
      accounts: result.rows
    });
  } catch (error: any) {
    console.error('❌ [Admin GET Official Accounts Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch official accounts' });
  }
});

router.post('/official-accounts', requireAdmin, async (req, res) => {
  try {
    const { provider, accountTitle, accountName, accountNumber, badge, dailyLimit, isActive, displayOrder } = req.body;

    if (!provider || !accountNumber || !accountName) {
      return res.status(400).json({ success: false, error: 'Provider, account number, and account name are required' });
    }

    const cleanNumber = String(accountNumber).trim();
    const cleanProvider = String(provider).trim();
    const cleanName = String(accountName).trim();
    const cleanTitle = (accountTitle || `${cleanProvider.toUpperCase()} OFFICIAL`).trim();
    const cleanBadge = (badge || '⚡ Verified Rail').trim();
    const limit = typeof dailyLimit === 'number' && dailyLimit > 0 ? dailyLimit : 500000;
    const active = isActive !== false;
    const order = typeof displayOrder === 'number' ? displayOrder : 1;

    const result = await query(
      `INSERT INTO payment_accounts (provider, account_title, account_name, account_number, badge, is_active, display_order, daily_limit)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (account_number) DO UPDATE
       SET provider = EXCLUDED.provider,
           account_title = EXCLUDED.account_title,
           account_name = EXCLUDED.account_name,
           badge = EXCLUDED.badge,
           is_active = EXCLUDED.is_active,
           display_order = EXCLUDED.display_order,
           daily_limit = EXCLUDED.daily_limit,
           updated_at = NOW()
       RETURNING *`,
      [cleanProvider, cleanTitle, cleanName, cleanNumber, cleanBadge, active, order, limit]
    );

    io.emit('official_accounts_updated', { account: result.rows[0], action: 'created' });

    return res.json({
      success: true,
      account: result.rows[0],
      message: 'Official account saved successfully'
    });
  } catch (error: any) {
    console.error('❌ [Admin Create Official Account Error]:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to create official account' });
  }
});

router.put('/official-accounts/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { provider, accountTitle, accountName, accountNumber, badge, dailyLimit, isActive, displayOrder } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (provider) { updates.push(`provider = $${idx++}`); values.push(provider.trim()); }
    if (accountTitle) { updates.push(`account_title = $${idx++}`); values.push(accountTitle.trim()); }
    if (accountName) { updates.push(`account_name = $${idx++}`); values.push(accountName.trim()); }
    if (accountNumber) { updates.push(`account_number = $${idx++}`); values.push(accountNumber.trim()); }
    if (badge) { updates.push(`badge = $${idx++}`); values.push(badge.trim()); }
    if (typeof dailyLimit === 'number') { updates.push(`daily_limit = $${idx++}`); values.push(dailyLimit); }
    if (typeof isActive === 'boolean') { updates.push(`is_active = $${idx++}`); values.push(isActive); }
    if (typeof displayOrder === 'number') { updates.push(`display_order = $${idx++}`); values.push(displayOrder); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields provided for update' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await query(
      `UPDATE payment_accounts SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Official account not found' });
    }

    io.emit('official_accounts_updated', { account: result.rows[0], action: 'updated' });

    return res.json({
      success: true,
      account: result.rows[0],
      message: 'Official account updated successfully'
    });
  } catch (error: any) {
    console.error('❌ [Admin Update Official Account Error]:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to update official account' });
  }
});

router.patch('/official-accounts/:id/toggle', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `UPDATE payment_accounts 
       SET is_active = NOT is_active, updated_at = NOW() 
       WHERE id = $1 
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Official account not found' });
    }

    io.emit('official_accounts_updated', { account: result.rows[0], action: 'toggled' });

    return res.json({
      success: true,
      account: result.rows[0],
      message: `Account status updated to ${result.rows[0].is_active ? 'Active' : 'Inactive'}`
    });
  } catch (error: any) {
    console.error('❌ [Admin Toggle Official Account Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to toggle account status' });
  }
});

router.delete('/official-accounts/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `DELETE FROM payment_accounts WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Official account not found' });
    }

    io.emit('official_accounts_updated', { id, action: 'deleted' });

    return res.json({
      success: true,
      message: 'Official account deleted successfully'
    });
  } catch (error: any) {
    console.error('❌ [Admin Delete Official Account Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete official account' });
  }
});

export default router;

