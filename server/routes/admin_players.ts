import { Router, Response } from 'express';
import { query } from '../db.ts';
import { requireAdmin, AuthenticatedRequest, markUserSuspended, markUserActive } from '../middleware/auth.ts';
import { TelegramBotService } from '../services/telegramBotService.ts';
import { io } from '../io.ts';

export const adminPlayersRouter = Router();

// Helper to format relative time
function formatRelativeTime(date: Date | string | null): string {
  if (!date) return 'Just now';
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 2) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} d ago`;
}

/**
 * 1. GET /api/admin/players/stats
 * Real-time KPI Card Metrics
 */
adminPlayersRouter.get('/stats', requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const statsRes = await query(`
      SELECT 
        COUNT(*) as total_players,
        COUNT(*) FILTER (WHERE status = 'active' OR status IS NULL) as active_players,
        COUNT(*) FILTER (WHERE status IN ('suspended', 'banned')) as suspended_players,
        COUNT(*) FILTER (WHERE status = 'under_review' OR status = 'review') as review_players,
        COUNT(*) FILTER (WHERE last_login_at >= NOW() - INTERVAL '30 minutes') as online_now,
        COALESCE((
          SELECT SUM(w.balance) 
          FROM wallets w 
          JOIN users u2 ON w.user_id = u2.id 
          WHERE u2.role = 'player' AND (u2.is_bot IS NULL OR u2.is_bot = false)
        ), 0) as total_wallet_balance,
        COALESCE((
          SELECT SUM(w.bonus) 
          FROM wallets w 
          JOIN users u2 ON w.user_id = u2.id 
          WHERE u2.role = 'player' AND (u2.is_bot IS NULL OR u2.is_bot = false)
        ), 0) as total_bonus_balance
      FROM users
      WHERE role = 'player' 
        AND (is_bot IS NULL OR is_bot = false) 
        AND full_name NOT LIKE 'Synthetic%'
    `);

    const r = statsRes.rows[0] || {};
    const totalPlayers = parseInt(r.total_players || '0', 10);
    const activePlayers = parseInt(r.active_players || '0', 10);
    const suspendedPlayers = parseInt(r.suspended_players || '0', 10);
    const reviewPlayers = parseInt(r.review_players || '0', 10);
    const onlineNow = parseInt(r.online_now || '0', 10);
    const totalWalletBalance = parseFloat(r.total_wallet_balance || '0');
    const totalBonusBalance = parseFloat(r.total_bonus_balance || '0');

    return res.json({
      success: true,
      stats: {
        totalPlayers,
        activePlayers,
        suspendedPlayers,
        reviewPlayers,
        needsAttentionCount: suspendedPlayers + reviewPlayers,
        onlineNow: Math.max(onlineNow, 1),
        totalWalletBalance,
        totalBonusBalance
      }
    });
  } catch (error: any) {
    console.error('❌ [Admin Players Stats Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve player stats' });
  }
});

/**
 * 2. GET /api/admin/players
 * Filtered, Searchable & Paginated Players Directory Table
 */
adminPlayersRouter.get('/', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 8, 1), 50);
    const offset = (page - 1) * limit;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : 'All';
    const source = typeof req.query.source === 'string' ? req.query.source.trim() : 'All';
    const sort = typeof req.query.sort === 'string' ? req.query.sort.trim() : 'new';

    const conditions: string[] = [
      "u.role = 'player'",
      "(u.is_bot IS NULL OR u.is_bot = false)",
      "u.full_name NOT LIKE 'Synthetic%'"
    ];
    const params: any[] = [];

    // Search condition
    if (search) {
      params.push(`%${search}%`);
      const idx = params.length;
      conditions.push(`(
        u.full_name ILIKE $${idx} OR 
        u.phone ILIKE $${idx} OR 
        u.telegram_username ILIKE $${idx} OR 
        CAST(u.telegram_id AS TEXT) ILIKE $${idx} OR
        CAST(u.id AS TEXT) ILIKE $${idx}
      )`);
    }

    // Status filter
    if (status && status !== 'All') {
      if (status.toLowerCase() === 'active') {
        conditions.push("(u.status = 'active' OR u.status IS NULL)");
      } else if (status.toLowerCase() === 'suspended') {
        conditions.push("u.status IN ('suspended', 'banned')");
      } else if (status.toLowerCase().includes('review')) {
        conditions.push("u.status IN ('under_review', 'review')");
      }
    }

    // Source filter
    if (source && source !== 'All') {
      if (source.toLowerCase() === 'agent') {
        conditions.push("u.agent_id IS NOT NULL");
      } else if (source.toLowerCase() === 'referral') {
        conditions.push("u.referred_by IS NOT NULL");
      } else if (source.toLowerCase() === 'direct') {
        conditions.push("u.agent_id IS NULL AND u.referred_by IS NULL");
      }
    }

    // Sort clause
    let orderClause = 'u.created_at DESC';
    if (sort === 'bal') {
      orderClause = 'COALESCE(w.balance, 0) DESC, u.created_at DESC';
    } else if (sort === 'act') {
      orderClause = '"gamesCount" DESC, u.created_at DESC';
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Total filtered count
    const countQuery = `
      SELECT COUNT(*) as filtered_count
      FROM users u
      LEFT JOIN wallets w ON u.id = w.user_id
      ${whereClause}
    `;
    const countRes = await query(countQuery, params);
    const totalCount = parseInt(countRes.rows[0]?.filtered_count || '0', 10);

    // Main players query
    const playersQuery = `
      SELECT 
        u.id,
        u.full_name as name,
        COALESCE(u.phone, CONCAT('09', RIGHT(CAST(u.telegram_id AS TEXT), 8))) as phone,
        u.telegram_username,
        u.telegram_id,
        COALESCE(u.status, 'active') as status,
        COALESCE(w.balance, 0.00) as wallet,
        COALESCE(w.bonus, 0.00) as bonus,
        COALESCE(cw.balance, 0) as coins,
        u.created_at as joined_at,
        COALESCE(u.last_login_at, u.created_at) as last_active_at,
        COALESCE((SELECT COUNT(*) FROM game_tickets WHERE user_id = u.id), 0) as "gamesCount",
        CASE 
          WHEN u.agent_id IS NOT NULL THEN CONCAT('Agent: ', COALESCE(ap.agent_code, 'Partner'))
          WHEN u.referred_by IS NOT NULL THEN 'Referral'
          ELSE 'Direct'
        END as source
      FROM users u
      LEFT JOIN wallets w ON u.id = w.user_id
      LEFT JOIN coin_wallets cw ON u.id = cw.user_id
      LEFT JOIN agent_profiles ap ON u.agent_id = ap.id
      ${whereClause}
      ORDER BY ${orderClause}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const playersRes = await query(playersQuery, [...params, limit, offset]);

    const formatted = playersRes.rows.map((p, i) => {
      const codeNum = 1001 + offset + i;
      const statusNormalized = 
        p.status === 'suspended' || p.status === 'banned' ? 'Suspended' :
        p.status === 'under_review' || p.status === 'review' ? 'Under review' : 'Active';

      return {
        id: p.id,
        playerCode: `P-${codeNum}`,
        name: p.name,
        phone: p.phone,
        telegramUsername: p.telegram_username,
        status: statusNormalized,
        wallet: parseFloat(p.wallet || '0'),
        bonus: parseFloat(p.bonus || '0'),
        coins: parseInt(p.coins || '0', 10),
        games: parseInt(p.gamesCount || '0', 10),
        source: p.source,
        joinedAt: new Date(p.joined_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
        lastActive: formatRelativeTime(p.last_active_at)
      };
    });

    return res.json({
      success: true,
      players: formatted,
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit) || 1
    });
  } catch (error: any) {
    console.error('❌ [Admin Players Directory Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve players' });
  }
});

/**
 * 3. GET /api/admin/players/:id/details
 * Deep-Dive Dossier (Overview, Transactions, Games, Notes, Audit Logs)
 */
adminPlayersRouter.get('/:id/details', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // 1. Basic Profile & Balances
    const userRes = await query(`
      SELECT 
        u.id,
        u.full_name as name,
        COALESCE(u.phone, CONCAT('09', RIGHT(CAST(u.telegram_id AS TEXT), 8))) as phone,
        u.telegram_username,
        u.telegram_id,
        COALESCE(u.status, 'active') as status,
        COALESCE(w.balance, 0.00) as wallet,
        COALESCE(w.bonus, 0.00) as bonus,
        COALESCE(cw.balance, 0) as coins,
        u.created_at as joined_at,
        COALESCE(u.last_login_at, u.created_at) as last_active_at,
        u.referral_code,
        CASE 
          WHEN u.agent_id IS NOT NULL THEN CONCAT('Agent: ', COALESCE(ap.agent_code, 'Partner'))
          WHEN u.referred_by IS NOT NULL THEN 'Referral'
          ELSE 'Direct'
        END as source,
        ref_u.full_name as referred_by_name
      FROM users u
      LEFT JOIN wallets w ON u.id = w.user_id
      LEFT JOIN coin_wallets cw ON u.id = cw.user_id
      LEFT JOIN agent_profiles ap ON u.agent_id = ap.id
      LEFT JOIN users ref_u ON u.referred_by = ref_u.id
      WHERE u.id = $1
    `, [id]);

    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Player not found' });
    }
    const user = userRes.rows[0];

    // 2. Financial Aggregates
    const [depRes, wdRes, stakeRes, winRes, notesRes, logsRes, txsRes, gamesRes, refCountRes] = await Promise.all([
      // Total approved deposits (Direct + P2P)
      query(`
        SELECT COALESCE(SUM(amount), 0) as total_dep
        FROM (
          SELECT amount FROM deposit_requests WHERE user_id = $1 AND status = 'approved'
          UNION ALL
          SELECT amount FROM agent_deposit_requests WHERE player_id = $1 AND status = 'approved'
        ) d
      `, [id]),
      // Total approved withdrawals (Direct + P2P)
      query(`
        SELECT COALESCE(SUM(amount), 0) as total_wd
        FROM (
          SELECT amount FROM withdrawal_requests WHERE user_id = $1 AND status = 'approved'
          UNION ALL
          SELECT amount FROM agent_withdrawal_requests WHERE player_id = $1 AND status = 'approved'
        ) w
      `, [id]),
      // Total staked & count
      query(`
        SELECT COALESCE(SUM(bet_amount), 0) as total_stk, COUNT(*) as games_count
        FROM game_tickets
        WHERE user_id = $1
      `, [id]),
      // Total won & wins count
      query(`
        SELECT COALESCE(SUM(amount), 0) as total_won, COUNT(*) as wins_count
        FROM wallet_transactions
        WHERE user_id = $1 AND type = 'win'
      `, [id]),
      // Notes
      query(`
        SELECT id, note, created_by, created_at
        FROM player_notes
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 20
      `, [id]),
      // Audit Logs
      query(`
        SELECT id, action, details, performed_by, created_at
        FROM player_audit_logs
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 30
      `, [id]),
      // Recent Transactions
      query(`
        SELECT 
          created_at,
          type,
          CASE WHEN type = 'bonus' THEN 'Bonus' ELSE 'Withdrawable' END as wallet,
          amount,
          status
        FROM wallet_transactions
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 10
      `, [id]),
      // Recent Games
      query(`
        SELECT 
          gt.created_at,
          COALESCE(gr.room_id, 'room-10') as room_id,
          gt.bet_amount as stake,
          gt.cartela_id,
          gt.status
        FROM game_tickets gt
        LEFT JOIN game_rounds gr ON gt.round_id = gr.id
        WHERE gt.user_id = $1
        ORDER BY gt.created_at DESC
        LIMIT 10
      `, [id]),
      // Referral count
      query(`SELECT COUNT(*) as refs FROM referrals WHERE referrer_id = $1`, [id])
    ]);

    const totalDep = parseFloat(depRes.rows[0]?.total_dep || '0');
    const totalWd = parseFloat(wdRes.rows[0]?.total_wd || '0');
    const totalStk = parseFloat(stakeRes.rows[0]?.total_stk || '0');
    const totalWon = parseFloat(winRes.rows[0]?.total_won || '0');
    const gamesCount = parseInt(stakeRes.rows[0]?.games_count || '0', 10);
    const winsCount = parseInt(winRes.rows[0]?.wins_count || '0', 10);
    const netResult = totalWon - totalStk;
    const refCount = parseInt(refCountRes.rows[0]?.refs || '0', 10);

    const formattedTxs = txsRes.rows.map(tx => {
      const d = new Date(tx.created_at);
      const isPositive = ['deposit', 'win', 'bonus'].includes(tx.type) || tx.amount > 0;
      return [
        d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        tx.type.charAt(0).toUpperCase() + tx.type.slice(1).replace('_', ' '),
        tx.wallet,
        `${isPositive ? '+' : '-'}${Math.abs(parseFloat(tx.amount)).toFixed(2)}`,
        tx.status ? (tx.status.charAt(0).toUpperCase() + tx.status.slice(1)) : 'Completed'
      ];
    });

    const formattedGames = gamesRes.rows.map(g => {
      const d = new Date(g.created_at);
      const roomLabel = g.room_id.replace('room-', 'Room ');
      return [
        d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        roomLabel,
        `ETB ${parseFloat(g.stake).toFixed(0)}`,
        `Cartela #${g.cartela_id}`,
        g.status === 'won' ? 'Won' : 'Lost'
      ];
    });

    const formattedLogs = logsRes.rows.map(l => {
      const d = new Date(l.created_at);
      const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' + 
                      ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
      return {
        id: l.id,
        t: dateStr,
        a: l.action,
        d: l.details || ''
      };
    });

    const statusNormalized = 
      user.status === 'suspended' || user.status === 'banned' ? 'Suspended' :
      user.status === 'under_review' || user.status === 'review' ? 'Under review' : 'Active';

    return res.json({
      success: true,
      player: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        telegramUsername: user.telegram_username,
        telegramId: user.telegram_id,
        status: statusNormalized,
        city: 'Addis Ababa',
        source: user.source,
        referredBy: user.referred_by_name || '-',
        referralCode: user.referral_code || 'ENQ' + user.phone.slice(-4),
        referralCount: refCount,
        joinedAt: new Date(user.joined_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
        lastActive: formatRelativeTime(user.last_active_at),
        kycStatus: 'Verified',
        wallet: parseFloat(user.wallet || '0'),
        bonus: parseFloat(user.bonus || '0'),
        coins: parseInt(user.coins || '0', 10),
        totalDeposits: totalDep,
        totalWithdrawals: totalWd,
        totalStaked: totalStk,
        totalWon: totalWon,
        netResult,
        gamesCount,
        winsCount,
        notes: notesRes.rows.map(n => ({
          id: n.id,
          note: n.note,
          createdBy: n.created_by,
          createdAt: new Date(n.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
        })),
        txs: formattedTxs,
        gms: formattedGames,
        logs: formattedLogs
      }
    });
  } catch (error: any) {
    console.error('❌ [Admin Player Details Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve player dossier' });
  }
});

/**
 * 4. POST /api/admin/players/:id/status
 * Suspend or Activate Player with Audit Log
 */
adminPlayersRouter.post('/:id/status', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, reason, note, notify } = req.body;

    const newStatus = status === 'suspended' ? 'suspended' : 'active';

    const userRes = await query(`SELECT id, full_name, phone, telegram_id FROM users WHERE id = $1`, [id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Player not found' });
    }
    const u = userRes.rows[0];
    const strId = String(id);
    const tgId = u.telegram_id ? String(u.telegram_id) : null;

    if (newStatus === 'suspended') {
      await query(
        `UPDATE users SET status = 'suspended', suspend_reason = $1, suspended_at = NOW() WHERE id = $2`,
        [reason || 'Suspicious activity or terms violation', id]
      );
      markUserSuspended(strId, reason || 'Suspicious activity or terms violation');
      if (tgId) markUserSuspended(tgId, reason || 'Suspicious activity or terms violation');

      // Real-time WebSocket kick & notification to active client
      const suspendPayload = {
        userId: strId,
        telegramId: tgId,
        reason: reason || 'Suspicious activity or terms violation'
      };
      io.to(`user_${strId}`).emit('user_account_suspended', suspendPayload);
      io.to(`user_${u.id}`).emit('user_account_suspended', suspendPayload);
      if (tgId) {
        io.to(`user_${tgId}`).emit('user_account_suspended', suspendPayload);
      }
      io.emit(`user_${strId}_suspended`, { suspended: true, reason: suspendPayload.reason });
      if (tgId) {
        io.emit(`user_${tgId}_suspended`, { suspended: true, reason: suspendPayload.reason });
      }
      io.emit('user_account_status_changed', { userId: strId, telegramId: tgId, status: 'suspended', reason: suspendPayload.reason });
    } else {
      await query(
        `UPDATE users SET status = 'active', suspend_reason = NULL, suspended_at = NULL WHERE id = $1`,
        [id]
      );
      markUserActive(strId);
      if (tgId) markUserActive(tgId);

      const activatePayload = {
        userId: strId,
        telegramId: tgId,
        message: 'Your account has been reactivated.'
      };
      io.to(`user_${strId}`).emit('user_account_activated', activatePayload);
      io.to(`user_${u.id}`).emit('user_account_activated', activatePayload);
      if (tgId) {
        io.to(`user_${tgId}`).emit('user_account_activated', activatePayload);
      }
      io.emit(`user_${strId}_suspended`, { suspended: false });
      if (tgId) {
        io.emit(`user_${tgId}_suspended`, { suspended: false });
      }
      io.emit('user_account_status_changed', { userId: strId, telegramId: tgId, status: 'active' });
    }

    // Record audit log
    const action = newStatus === 'suspended' ? 'Suspended' : 'Activated';
    const detailParts: string[] = [];
    if (reason) detailParts.push(reason);
    if (note && note.trim()) detailParts.push(note.trim());
    if (notify) detailParts.push('(player notified via bot)');
    const details = detailParts.length > 0 ? detailParts.join(': ') : `Account ${newStatus} by admin`;

    await query(`
      INSERT INTO player_audit_logs (user_id, action, details, performed_by)
      VALUES ($1, $2, $3, $4)
    `, [id, action, details, 'Admin']);

    // Send Telegram notification if requested and telegram_id exists
    if (notify && u.telegram_id) {
      const reasonSafe = (reason || 'Account review')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      const msg = newStatus === 'suspended'
        ? `⚠️ <b>Your Sonic Bingo account has been suspended</b>\n\n<b>Reason:</b> ${reasonSafe}\n\nSuspending blocks play, deposits, and withdrawals. If you believe this was done in error, please contact official support.\n\n<i>Action recorded in security compliance ledger.</i>`
        : `✅ <b>Your Sonic Bingo account has been reactivated</b>\n\nYou may now resume playing, deposits, and withdrawals! Welcome back.`;
      try {
        await TelegramBotService.getInstance().sendMessage(u.telegram_id, msg, { parseMode: 'HTML' });
      } catch (tgErr) {
        console.warn('Telegram notify notice:', tgErr);
      }
    }

    return res.json({
      success: true,
      message: `Player ${u.full_name} has been ${action.toLowerCase()} successfully!`,
      status: newStatus === 'suspended' ? 'Suspended' : 'Active'
    });
  } catch (error: any) {
    console.error('❌ [Admin Player Status Update Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to update player status' });
  }
});

/**
 * 5. POST /api/admin/players/:id/adjust-balance
 * Credit or Debit Player Withdrawable or Bonus Wallet
 */
adminPlayersRouter.post('/:id/adjust-balance', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { wallet = 'wal', type = 'Credit', amount, reason = 'Correction', note } = req.body;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, error: 'A positive amount is required' });
    }
    if (!note || !note.trim()) {
      return res.status(400).json({ success: false, error: 'An explanatory note is required for all balance adjustments' });
    }

    const isBonus = wallet === 'bon';
    const isCredit = type === 'Credit';
    const delta = isCredit ? numAmount : -numAmount;

    // Check user & wallet
    const walRes = await query(`SELECT balance, bonus FROM wallets WHERE user_id = $1`, [id]);
    if (walRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Player wallet not found' });
    }
    const currentWal = parseFloat(walRes.rows[0].balance || '0');
    const currentBon = parseFloat(walRes.rows[0].bonus || '0');

    if (!isCredit) {
      if (isBonus && numAmount > currentBon) {
        return res.status(400).json({ success: false, error: 'Debit amount exceeds bonus wallet balance' });
      }
      if (!isBonus && numAmount > currentWal) {
        return res.status(400).json({ success: false, error: 'Debit amount exceeds withdrawable wallet balance' });
      }
    }

    // Atomic update
    let newBal = currentWal;
    let newBon = currentBon;

    if (isBonus) {
      newBon = Math.max(0, currentBon + delta);
      await query(`UPDATE wallets SET bonus = $1, updated_at = NOW() WHERE user_id = $2`, [newBon, id]);
    } else {
      newBal = Math.max(0, currentWal + delta);
      await query(`UPDATE wallets SET balance = $1, updated_at = NOW() WHERE user_id = $2`, [newBal, id]);
    }

    // Record immutable wallet transaction
    const refCode = `ADJ-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const wlLabel = isBonus ? 'Bonus' : 'Withdrawable';
    await query(`
      INSERT INTO wallet_transactions 
        (user_id, type, amount, balance_after, reference_code, status, description)
      VALUES 
        ($1, 'admin_adjustment', $2, $3, $4, 'completed', $5)
    `, [
      id,
      delta,
      isBonus ? newBon : newBal,
      refCode,
      `Manual admin ${type.toLowerCase()} (${wlLabel}): ${reason}. ${note.trim()}`
    ]);

    // Record audit log
    await query(`
      INSERT INTO player_audit_logs (user_id, action, details, performed_by)
      VALUES ($1, $2, $3, $4)
    `, [
      id,
      'Balance adjusted',
      `${type} ${numAmount.toFixed(2)} ETB (${wlLabel}): ${reason}. ${note.trim()}`,
      'Admin'
    ]);

    // Query user profile for Telegram notification & ID normalization
    const strId = String(id);
    let tgId: string | null = null;
    let playerName = 'Player';
    try {
      const userRow = await query(`SELECT telegram_id, full_name FROM users WHERE id = $1`, [id]);
      if (userRow.rows.length > 0) {
        if (userRow.rows[0].telegram_id) tgId = String(userRow.rows[0].telegram_id);
        if (userRow.rows[0].full_name) playerName = userRow.rows[0].full_name;
      }
    } catch {}

    // Real-time WebSocket sync to player client with dual-tier targeting
    const balancePayload = {
      userId: strId,
      telegramId: tgId,
      balance: newBal,
      bonus: newBon,
      newBalance: newBal,
      delta,
      reason
    };
    io.to(`user_${strId}`).emit('user_balance_updated', balancePayload);
    if (tgId) {
      io.to(`user_${tgId}`).emit('user_balance_updated', balancePayload);
    }
    io.emit(`user_${strId}_balance`, balancePayload);
    if (tgId) {
      io.emit(`user_${tgId}_balance`, balancePayload);
    }
    io.emit('user_balance_updated', balancePayload);

    // Send official Telegram Bot alert to player
    if (tgId) {
      try {
        const actionIcon = isCredit ? '➕' : '➖';
        const actionLabel = isCredit ? 'Credit (ተቀማጭ)' : 'Debit (ተቀናሽ)';
        const safeName = playerName
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        const safeReason = (reason || 'Administrative adjustment')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        const msg = `💰 <b>Sonic Bingo Wallet Update</b>\n\n` +
          `Hello <b>${safeName}</b>, your account balance has been updated by administration:\n` +
          `• <b>Action:</b> ${actionLabel} ${actionIcon}\n` +
          `• <b>Amount:</b> ${numAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB\n` +
          `• <b>Wallet:</b> ${wlLabel} Wallet\n` +
          `• <b>Reason:</b> ${safeReason}\n` +
          `• <b>Updated Balance:</b> ${(isBonus ? newBon : newBal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB\n\n` +
          `<i>Thank you for choosing Sonic Bingo!</i>`;
        await TelegramBotService.getInstance().sendMessage(tgId, msg, { parseMode: 'HTML' });
      } catch (tgErr) {
        console.warn('Telegram balance adjust notify notice:', tgErr);
      }
    }

    return res.json({
      success: true,
      message: `Successfully adjusted balance by ${isCredit ? '+' : '-'}${numAmount.toFixed(2)} ETB!`,
      wallet: newBal,
      bonus: newBon
    });
  } catch (error: any) {
    console.error('❌ [Admin Balance Adjustment Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to adjust balance' });
  }
});

/**
 * 6. POST /api/admin/players/:id/notes
 * Add Persistent Internal Note
 */
adminPlayersRouter.post('/:id/notes', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    if (!note || !note.trim()) {
      return res.status(400).json({ success: false, error: 'Note text cannot be empty' });
    }

    const insertRes = await query(`
      INSERT INTO player_notes (user_id, note, created_by)
      VALUES ($1, $2, $3)
      RETURNING id, note, created_by, created_at
    `, [id, note.trim(), 'Admin']);

    const newNote = insertRes.rows[0];

    // Record in audit log
    await query(`
      INSERT INTO player_audit_logs (user_id, action, details, performed_by)
      VALUES ($1, 'Note added', $2, 'Admin')
    `, [id, note.trim()]);

    return res.json({
      success: true,
      message: 'Note added successfully',
      note: {
        id: newNote.id,
        note: newNote.note,
        createdBy: newNote.created_by,
        createdAt: new Date(newNote.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
      }
    });
  } catch (error: any) {
    console.error('❌ [Admin Add Note Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to add internal note' });
  }
});

/**
 * 7. POST /api/admin/players/:id/message
 * Send Direct Bot Message to Player
 */
adminPlayersRouter.post('/:id/message', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, error: 'Message content cannot be empty' });
    }

    const userRes = await query(`SELECT telegram_id, full_name FROM users WHERE id = $1`, [id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Player not found' });
    }
    const user = userRes.rows[0];

    if (!user.telegram_id) {
      return res.status(400).json({ success: false, error: 'This player does not have an attached Telegram account' });
    }

    const safeContent = message.trim()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const formattedMsg = `📩 <b>Official Notice from Sonic Bingo Administration</b>\n\n${safeContent}\n\n<i>This is a direct message sent via @SonicGameOfficialBot. For help, contact support.</i>`;

    await TelegramBotService.getInstance().sendMessage(user.telegram_id, formattedMsg, { parseMode: 'HTML' });

    // Record in audit log
    await query(`
      INSERT INTO player_audit_logs (user_id, action, details, performed_by)
      VALUES ($1, 'Message sent', $2, 'Admin')
    `, [id, `Telegram message dispatched: "${message.trim().slice(0, 50)}..."`]);

    return res.json({
      success: true,
      message: `Message dispatched successfully to ${user.full_name} via Telegram!`
    });
  } catch (error: any) {
    console.error('❌ [Admin Send Player Message Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to dispatch Telegram message' });
  }
});

/**
 * 8. GET /api/admin/players/export-csv
 * Stream Clean Filtered CSV Export
 */
adminPlayersRouter.get('/export-csv', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : 'All';
    const source = typeof req.query.source === 'string' ? req.query.source.trim() : 'All';

    const conditions: string[] = [
      "u.role = 'player'",
      "(u.is_bot IS NULL OR u.is_bot = false)",
      "u.full_name NOT LIKE 'Synthetic%'"
    ];
    const params: any[] = [];

    if (search) {
      params.push(`%${search}%`);
      const idx = params.length;
      conditions.push(`(u.full_name ILIKE $${idx} OR u.phone ILIKE $${idx})`);
    }

    if (status && status !== 'All') {
      if (status.toLowerCase() === 'active') conditions.push("(u.status = 'active' OR u.status IS NULL)");
      else if (status.toLowerCase() === 'suspended') conditions.push("u.status IN ('suspended', 'banned')");
      else if (status.toLowerCase().includes('review')) conditions.push("u.status IN ('under_review', 'review')");
    }

    if (source && source !== 'All') {
      if (source.toLowerCase() === 'agent') conditions.push("u.agent_id IS NOT NULL");
      else if (source.toLowerCase() === 'referral') conditions.push("u.referred_by IS NOT NULL");
      else if (source.toLowerCase() === 'direct') conditions.push("u.agent_id IS NULL AND u.referred_by IS NULL");
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const exportQuery = `
      SELECT 
        u.id,
        u.full_name as name,
        COALESCE(u.phone, CONCAT('09', RIGHT(CAST(u.telegram_id AS TEXT), 8))) as phone,
        COALESCE(u.status, 'active') as status,
        COALESCE(w.balance, 0.00) as wallet,
        COALESCE(w.bonus, 0.00) as bonus,
        COALESCE(cw.balance, 0) as coins,
        u.created_at as joined_at,
        COALESCE((SELECT COUNT(*) FROM game_tickets WHERE user_id = u.id), 0) as games_count
      FROM users u
      LEFT JOIN wallets w ON u.id = w.user_id
      LEFT JOIN coin_wallets cw ON u.id = cw.user_id
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT 1000
    `;

    const exportRes = await query(exportQuery, params);

    const csvRows: string[] = [
      'Player ID,Full Name,Phone Number,Status,Wallet (ETB),Bonus (ETB),Coins,Games Played,Joined Date'
    ];

    exportRes.rows.forEach(r => {
      csvRows.push([
        `"${r.id}"`,
        `"${r.name.replace(/"/g, '""')}"`,
        `"${r.phone}"`,
        `"${r.status}"`,
        r.wallet,
        r.bonus,
        r.coins,
        r.games_count,
        `"${new Date(r.joined_at).toISOString().split('T')[0]}"`
      ].join(','));
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="sonic_players_${Date.now()}.csv"`);
    return res.send(csvRows.join('\n'));
  } catch (error: any) {
    console.error('❌ [Admin Export CSV Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to export players CSV' });
  }
});

