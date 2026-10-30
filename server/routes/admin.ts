import { Router } from 'express';
import { query, withTransaction, getDatabaseStorageStats } from '../db.ts';
import { requireAdmin, AuthenticatedRequest } from '../middleware/auth.ts';
import { io } from '../io.ts';
import { gameEngine } from '../game/BingoGameEngine.ts';
import { exportDatabaseBackup } from '../scripts/backup_database.ts';

const router = Router();

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
        u.telegram_username
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
      createdAt: d.created_at
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
          // Calculate 10% flat bonus
          referralBonusAmount = Math.round(amount * 0.10 * 100) / 100;

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
                `Referral Bonus (10% of friend's 1st deposit of ${amount.toFixed(2)} ETB) - Game Play Bonus`
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
            console.log(`🎁 [Referral Bonus] Credited 10% (${referralBonusAmount} ETB) bonus to referrer ${referrerId}`);
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

    io.emit('user_balance_updated', {
      userId: result.userId,
      amount: result.amount,
      newBalance: result.newBalance
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

    io.emit('deposit_status_updated', { id: depositId, status: 'rejected' });

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
      SELECT w.*, u.full_name as user_name, u.phone as user_phone, u.telegram_username
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
      createdAt: w.created_at
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

    await query(
      `UPDATE withdrawal_requests 
       SET status = 'approved', reviewed_by = $1, reviewed_at = NOW() 
       WHERE id = $2`,
      [adminId, withdrawalId]
    );

    io.emit('withdrawal_status_updated', { id: withdrawalId, status: 'approved' });

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
      newBalance: result.newBalance
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
    const [userCountRes, depositSumRes, withdrawSumRes, roundsStatsRes, netCashRes, jackpotPoolRes, jackpotPaidRes] = await Promise.all([
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
      query("SELECT COALESCE(SUM(amount), 0) as total_jackpot_paid FROM jackpot_winners")
    ]);

    const rStats = roundsStatsRes.rows[0] || {};
    const netCash = parseFloat(netCashRes.rows[0]?.today_net_cash_profit || '0');

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
        defaultCommissionRate: 20
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

export default router;

