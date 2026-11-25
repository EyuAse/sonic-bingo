import { Router, Response } from 'express';
import { query } from '../db.ts';
import { requireAdmin, AuthenticatedRequest } from '../middleware/auth.ts';
import { kenoEngine } from '../game/KenoGameEngine.ts';

export const adminKenoRouter = Router();

function resolvePeriodBounds(period: string): { startIso: string; endIso: string; label: string } {
  const now = new Date();

  if (period === 'today') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { startIso: start.toISOString(), endIso: now.toISOString(), label: 'Today' };
  }

  if (period === 'yesterday') {
    const start = new Date(now);
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    return { startIso: start.toISOString(), endIso: end.toISOString(), label: 'Yesterday' };
  }

  if (period === 'week') {
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { startIso: start.toISOString(), endIso: now.toISOString(), label: 'Last 7 Days' };
  }

  if (period === 'month') {
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { startIso: start.toISOString(), endIso: now.toISOString(), label: 'Last 30 Days' };
  }

  return {
    startIso: new Date('2024-01-01T00:00:00.000Z').toISOString(),
    endIso: now.toISOString(),
    label: 'All Time'
  };
}

/**
 * GET /api/admin/keno/overview?period=today|yesterday|week|month|all
 * Executive Keno Dashboard telemetry: live round snapshot, unique players, turnover, payouts, and House Profit/Loss.
 */
adminKenoRouter.get('/overview', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const period = typeof req.query.period === 'string' ? req.query.period : 'today';
    const { startIso, endIso, label } = resolvePeriodBounds(period);

    const [ticketStatsRes, roundsCountRes, recentRoundsRes] = await Promise.all([
      query(
        `SELECT
           COUNT(DISTINCT user_id) as unique_players,
           COUNT(*) as tickets_count,
           COUNT(*) FILTER (WHERE status = 'won') as won_count,
           COUNT(*) FILTER (WHERE status = 'lost') as lost_count,
           COUNT(*) FILTER (WHERE status = 'active') as active_count,
           COUNT(*) FILTER (WHERE is_bonus = FALSE) as cash_tickets,
           COUNT(*) FILTER (WHERE is_bonus = TRUE) as bonus_tickets,
           COALESCE(SUM(bet_amount), 0) as total_turnover,
           COALESCE(SUM(bet_amount) FILTER (WHERE is_bonus = FALSE), 0) as cash_turnover,
           COALESCE(SUM(bet_amount) FILTER (WHERE is_bonus = TRUE), 0) as bonus_turnover,
           COALESCE(SUM(payout_amount), 0) as total_payouts
         FROM keno_tickets
         WHERE created_at >= $1 AND created_at <= $2`,
        [startIso, endIso]
      ),
      query(
        `SELECT COUNT(*) as rounds_settled
         FROM keno_rounds
         WHERE status = 'settled'
           AND COALESCE(settled_at, started_at) >= $1
           AND COALESCE(settled_at, started_at) <= $2`,
        [startIso, endIso]
      ),
      query(
        `SELECT
           r.round_number,
           r.status,
           r.total_bets_count,
           r.total_wagered,
           r.total_payout,
           r.server_seed_hash,
           r.settled_at,
           r.started_at,
           COALESCE((SELECT COUNT(DISTINCT t.user_id) FROM keno_tickets t WHERE t.round_number = r.round_number), 0) as unique_players
         FROM keno_rounds r
         WHERE r.status = 'settled'
           AND COALESCE(r.settled_at, r.started_at) >= $1
           AND COALESCE(r.settled_at, r.started_at) <= $2
         ORDER BY r.round_number DESC
         LIMIT 10`,
        [startIso, endIso]
      )
    ]);

    const tRow = ticketStatsRes.rows[0] || {};
    const totalTurnover = parseFloat(tRow.total_turnover || '0');
    const cashTurnover = parseFloat(tRow.cash_turnover || '0');
    const bonusTurnover = parseFloat(tRow.bonus_turnover || '0');
    const totalPayouts = parseFloat(tRow.total_payouts || '0');
    const netProfitLoss = Number((totalTurnover - totalPayouts).toFixed(2));
    const actualRtpPercent = totalTurnover > 0 ? Number(((totalPayouts / totalTurnover) * 100).toFixed(1)) : 0;
    const holdPercent = totalTurnover > 0 ? Number(((netProfitLoss / totalTurnover) * 100).toFixed(1)) : 0;

    const recentRounds = recentRoundsRes.rows.map(r => {
      const wagered = parseFloat(r.total_wagered || '0');
      const payout = parseFloat(r.total_payout || '0');
      return {
        roundNumber: parseInt(r.round_number, 10),
        status: r.status,
        ticketsCount: parseInt(r.total_bets_count || '0', 10),
        uniquePlayers: parseInt(r.unique_players || '0', 10),
        totalWagered: wagered,
        totalPayout: payout,
        profitLoss: Number((wagered - payout).toFixed(2)),
        serverSeedHash: r.server_seed_hash || '',
        settledAt: r.settled_at || r.started_at
      };
    });

    return res.json({
      success: true,
      periodLabel: label,
      snapshot: kenoEngine.getAdminLiveSnapshot(),
      kpis: {
        uniquePlayersCount: parseInt(tRow.unique_players || '0', 10),
        roundsSettled: parseInt(roundsCountRes.rows[0]?.rounds_settled || '0', 10),
        ticketsCount: parseInt(tRow.tickets_count || '0', 10),
        wonTicketsCount: parseInt(tRow.won_count || '0', 10),
        lostTicketsCount: parseInt(tRow.lost_count || '0', 10),
        activeTicketsCount: parseInt(tRow.active_count || '0', 10),
        cashTicketsCount: parseInt(tRow.cash_tickets || '0', 10),
        bonusTicketsCount: parseInt(tRow.bonus_tickets || '0', 10),
        cashTurnover,
        bonusTurnover,
        totalTurnover,
        totalPayouts,
        netProfitLoss,
        actualRtpPercent,
        holdPercent
      },
      recentRounds
    });
  } catch (err: any) {
    console.error('❌ [Admin Keno Overview Error]:', err);
    return res.status(500).json({ success: false, error: 'Failed to load Keno overview' });
  }
});

/**
 * GET /api/admin/keno/rounds?page=1&limit=20&search=
 */
adminKenoRouter.get('/rounds', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 20, 1), 100);
    const offset = (page - 1) * limit;
    const search = typeof req.query.search === 'string' ? req.query.search.trim().replace(/^#/, '') : '';

    const params: any[] = [];
    let whereSql = '';
    if (search) {
      params.push(`%${search}%`);
      whereSql = `WHERE r.round_number::text ILIKE $1 OR r.server_seed_hash ILIKE $1`;
    }

    const [countRes, rowsRes] = await Promise.all([
      query(`SELECT COUNT(*) as total FROM keno_rounds r ${whereSql}`, params),
      query(
        `SELECT
           r.id,
           r.round_number,
           r.status,
           r.drawn_numbers,
           r.total_bets_count,
           r.total_wagered,
           r.total_payout,
           r.server_seed_hash,
           r.started_at,
           r.settled_at,
           COALESCE((SELECT COUNT(DISTINCT t.user_id) FROM keno_tickets t WHERE t.round_number = r.round_number), 0) as unique_players
         FROM keno_rounds r
         ${whereSql}
         ORDER BY r.round_number DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      )
    ]);

    const totalCount = parseInt(countRes.rows[0]?.total || '0', 10);
    const rounds = rowsRes.rows.map(r => {
      const wagered = parseFloat(r.total_wagered || '0');
      const payout = parseFloat(r.total_payout || '0');
      return {
        id: r.id,
        roundNumber: parseInt(r.round_number, 10),
        status: r.status,
        drawnNumbers: Array.isArray(r.drawn_numbers) ? r.drawn_numbers : [],
        ticketsCount: parseInt(r.total_bets_count || '0', 10),
        uniquePlayers: parseInt(r.unique_players || '0', 10),
        totalWagered: wagered,
        totalPayout: payout,
        profitLoss: Number((wagered - payout).toFixed(2)),
        serverSeedHash: r.server_seed_hash || '',
        startedAt: r.started_at,
        settledAt: r.settled_at
      };
    });

    return res.json({
      success: true,
      rounds,
      totalCount,
      page,
      totalPages: Math.ceil(totalCount / limit) || 1
    });
  } catch (err: any) {
    console.error('❌ [Admin Keno Rounds Error]:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch Keno rounds' });
  }
});

/**
 * GET /api/admin/keno/tickets?page=1&limit=25&status=all|won|lost|active&funding=all|cash|bonus&search=
 */
adminKenoRouter.get('/tickets', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 25, 1), 100);
    const offset = (page - 1) * limit;
    const status = typeof req.query.status === 'string' ? req.query.status : 'all';
    const funding = typeof req.query.funding === 'string' ? req.query.funding : 'all';
    const search = typeof req.query.search === 'string' ? req.query.search.trim().replace(/^#/, '') : '';

    const conditions: string[] = [];
    const params: any[] = [];

    if (status === 'won' || status === 'lost' || status === 'active') {
      params.push(status);
      conditions.push(`t.status = $${params.length}`);
    }

    if (funding === 'cash') {
      conditions.push(`t.is_bonus = FALSE`);
    } else if (funding === 'bonus') {
      conditions.push(`t.is_bonus = TRUE`);
    }

    if (search) {
      params.push(`%${search}%`);
      const idx = params.length;
      conditions.push(
        `(t.round_number::text ILIKE $${idx} OR COALESCE(u.full_name, '') ILIKE $${idx} OR COALESCE(u.phone, '') ILIKE $${idx} OR COALESCE(u.telegram_username, '') ILIKE $${idx} OR COALESCE(u.public_id::text, '') ILIKE $${idx})`
      );
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRes, rowsRes] = await Promise.all([
      query(
        `SELECT COUNT(*) as total
         FROM keno_tickets t
         LEFT JOIN users u ON t.user_id = u.id
         ${whereSql}`,
        params
      ),
      query(
        `SELECT
           t.id,
           t.round_number,
           t.user_id,
           t.selected_numbers,
           t.spot_count,
           t.bet_amount,
           t.is_bonus,
           t.hit_numbers,
           t.hit_count,
           t.multiplier,
           t.payout_amount,
           t.status,
           t.created_at,
           u.full_name,
           u.phone,
           u.telegram_username,
           u.public_id
         FROM keno_tickets t
         LEFT JOIN users u ON t.user_id = u.id
         ${whereSql}
         ORDER BY t.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      )
    ]);

    const totalCount = parseInt(countRes.rows[0]?.total || '0', 10);
    const tickets = rowsRes.rows.map(t => {
      const stake = parseFloat(t.bet_amount || '0');
      const payout = parseFloat(t.payout_amount || '0');
      return {
        id: t.id,
        roundNumber: parseInt(t.round_number, 10),
        userId: t.user_id,
        playerName: t.full_name || 'Anonymous',
        playerPhone: t.phone || (t.telegram_username ? `@${t.telegram_username}` : (t.public_id ? `ID:${t.public_id}` : '')),
        selectedNumbers: Array.isArray(t.selected_numbers) ? t.selected_numbers : [],
        spotCount: parseInt(t.spot_count || '0', 10),
        betAmount: stake,
        isBonus: Boolean(t.is_bonus),
        hitNumbers: Array.isArray(t.hit_numbers) ? t.hit_numbers : [],
        hitCount: parseInt(t.hit_count || '0', 10),
        multiplier: parseFloat(t.multiplier || '0'),
        payoutAmount: payout,
        houseNet: Number((stake - payout).toFixed(2)),
        status: t.status,
        createdAt: t.created_at
      };
    });

    return res.json({
      success: true,
      tickets,
      totalCount,
      page,
      totalPages: Math.ceil(totalCount / limit) || 1
    });
  } catch (err: any) {
    console.error('❌ [Admin Keno Tickets Error]:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch Keno tickets' });
  }
});

/**
 * POST /api/admin/keno/toggle-pause
 * Emergency pause/resume control for Fast Keno ticket acceptance.
 */
adminKenoRouter.post('/toggle-pause', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const requestedPaused = typeof req.body?.paused === 'boolean'
    ? req.body.paused
    : !kenoEngine.isMaintenancePaused;

  if (requestedPaused) {
    kenoEngine.pauseMaintenance();
  } else {
    kenoEngine.resumeMaintenance();
  }

  return res.json({
    success: true,
    snapshot: kenoEngine.getAdminLiveSnapshot()
  });
});
