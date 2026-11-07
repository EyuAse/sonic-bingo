import { Router, Response } from 'express';
import { query, withTransaction } from '../db.ts';
import { requireAdmin, AuthenticatedRequest } from '../middleware/auth.ts';
import { gameEngine } from '../game/BingoGameEngine.ts';
import { io } from '../io.ts';

export const adminJackpotsRouter = Router();

const STAKE_ROOMS = [
  { id: 'room-10', stake: 10, name: 'ETB 10 stake', defaultTarget: 500 },
  { id: 'room-20', stake: 20, name: 'ETB 20 stake', defaultTarget: 500 },
  { id: 'room-50', stake: 50, name: 'ETB 50 stake', defaultTarget: 500 },
  { id: 'room-100', stake: 100, name: 'ETB 100 stake', defaultTarget: 500 }
];

/**
 * Helper to compute precise ISO timestamps for timeframes.
 */
function resolveTimeBounds(period: string, from?: string, to?: string): { startIso: string; endIso: string; prevStartIso: string; prevEndIso: string; label: string } {
  const now = new Date();

  if (period === 'day') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);

    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - 1);
    const prevEnd = new Date(start);
    prevEnd.setMilliseconds(-1);

    return {
      startIso: start.toISOString(),
      endIso: now.toISOString(),
      prevStartIso: prevStart.toISOString(),
      prevEndIso: prevEnd.toISOString(),
      label: 'vs yesterday'
    };
  }

  if (period === 'week') {
    const duration = 7 * 24 * 60 * 60 * 1000;
    const start = new Date(now.getTime() - duration);
    const prevStart = new Date(start.getTime() - duration);

    return {
      startIso: start.toISOString(),
      endIso: now.toISOString(),
      prevStartIso: prevStart.toISOString(),
      prevEndIso: start.toISOString(),
      label: 'vs previous 7 days'
    };
  }

  if (period === 'month') {
    const duration = 30 * 24 * 60 * 60 * 1000;
    const start = new Date(now.getTime() - duration);
    const prevStart = new Date(start.getTime() - duration);

    return {
      startIso: start.toISOString(),
      endIso: now.toISOString(),
      prevStartIso: prevStart.toISOString(),
      prevEndIso: start.toISOString(),
      label: 'vs previous 30 days'
    };
  }

  if (period === 'custom' && from && to) {
    const start = new Date(`${from}T00:00:00.000Z`);
    const end = new Date(`${to}T23:59:59.999Z`);
    const duration = Math.max(end.getTime() - start.getTime(), 86400000);
    const prevStart = new Date(start.getTime() - duration);

    return {
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      prevStartIso: prevStart.toISOString(),
      prevEndIso: start.toISOString(),
      label: 'vs previous period'
    };
  }

  // Default: 'all'
  return {
    startIso: new Date(0).toISOString(),
    endIso: now.toISOString(),
    prevStartIso: new Date(0).toISOString(),
    prevEndIso: new Date(0).toISOString(),
    label: 'all time'
  };
}

/**
 * 1. GET /api/admin/jackpots/overview (or GET /api/admin/jackpots)
 * Returns live totals, 4 pool ring cards, 14-day stacked bar chart, and closest to target.
 */
adminJackpotsRouter.get('/overview', requireAdmin, handleOverview);
adminJackpotsRouter.get('/', requireAdmin, handleOverview);

async function handleOverview(_req: AuthenticatedRequest, res: Response) {
  try {
    // 1. Fetch DB jackpot pools
    const poolsRes = await query(`
      SELECT jp.*, gr.name as room_name, gr.stake_amount
      FROM jackpot_pool jp
      LEFT JOIN game_rooms gr ON jp.room_id = gr.id
      ORDER BY jp.room_id ASC
    `);

    // 2. Fetch today's contributions across all rooms
    const todayRes = await query(`
      SELECT COALESCE(SUM(jackpot_fee), 0) as today_contributed
      FROM game_rounds
      WHERE started_at >= CURRENT_DATE AND jackpot_fee > 0
    `);
    const contributedToday = parseFloat(todayRes.rows[0]?.today_contributed || '0');

    // 3. Fetch awarded in last 30 days
    const awarded30dRes = await query(`
      SELECT COALESCE(SUM(amount), 0) as awarded_30d
      FROM jackpot_winners
      WHERE won_at >= NOW() - INTERVAL '30 days'
    `);
    const awardedLast30Days = parseFloat(awarded30dRes.rows[0]?.awarded_30d || '0');

    // 4. Fetch per-room added today
    const roomTodayRes = await query(`
      SELECT room_id, COALESCE(SUM(jackpot_fee), 0) as added_today
      FROM game_rounds
      WHERE started_at >= CURRENT_DATE AND jackpot_fee > 0
      GROUP BY room_id
    `);
    const roomTodayMap = new Map(roomTodayRes.rows.map(r => [r.room_id, parseFloat(r.added_today || '0')]));

    // 5. Fetch 14-day history for the stacked chart
    const history14dRes = await query(`
      SELECT 
        TO_CHAR(started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') as date_str,
        room_id,
        COALESCE(SUM(jackpot_fee), 0) as fee
      FROM game_rounds
      WHERE started_at >= NOW() - INTERVAL '14 days' AND jackpot_fee > 0
      GROUP BY date_str, room_id
      ORDER BY date_str ASC
    `);

    // Build map: date -> { room10, room20, room50, room100, total }
    const dailyMap = new Map<string, { room10: number; room20: number; room50: number; room100: number; total: number }>();
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const ds = d.toISOString().split('T')[0];
      dailyMap.set(ds, { room10: 0, room20: 0, room50: 0, room100: 0, total: 0 });
    }

    for (const r of history14dRes.rows) {
      const ds = r.date_str;
      if (dailyMap.has(ds)) {
        const item = dailyMap.get(ds)!;
        const amt = parseFloat(r.fee || '0');
        if (r.room_id === 'room-10') item.room10 += amt;
        else if (r.room_id === 'room-20') item.room20 += amt;
        else if (r.room_id === 'room-50') item.room50 += amt;
        else if (r.room_id === 'room-100') item.room100 += amt;
        item.total += amt;
      }
    }

    const chart14Days = Array.from(dailyMap.entries()).map(([date, vals]) => {
      const d = new Date(`${date}T00:00:00.000Z`);
      const dayLabel = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
      return {
        date,
        dayLabel,
        ...vals
      };
    });

    // 6. Map pools & determine live HIT status
    let totalVaultBalance = 0;
    const pools = [];
    const dbPoolMap = new Map(poolsRes.rows.map(r => [r.room_id, r]));

    for (const s of STAKE_ROOMS) {
      const dbRow = dbPoolMap.get(s.id);
      const liveRoom = gameEngine.getRoom(s.id);
      const liveBal = liveRoom?.jackpotPoolBalance !== undefined ? liveRoom.jackpotPoolBalance : parseFloat(dbRow?.balance || '0');
      const seedBal = parseFloat(dbRow?.seed_amount || String(s.defaultTarget));
      const target = s.defaultTarget; // Standard 500 ETB trigger
      const addedToday = roomTodayMap.get(s.id) || 0;
      const isLive = liveBal >= target;

      totalVaultBalance += liveBal;

      // Check if there's a pending award / eligible latest winner
      let pendingAward = null;
      if (isLive) {
        const winnerRes = await query(`
          SELECT gr.id as round_id, gr.round_number, u.id as user_id, u.full_name as winner_name, u.phone as winner_phone, gr.winner_payout
          FROM game_rounds gr
          JOIN users u ON u.id = (gr.winner_user_ids->>0)::uuid
          WHERE gr.room_id = $1 AND gr.phase IN ('winner', 'ended')
          ORDER BY gr.started_at DESC
          LIMIT 1
        `, [s.id]);

        if (winnerRes.rows.length > 0) {
          const w = winnerRes.rows[0];
          pendingAward = {
            roundId: w.round_id,
            roundRef: `G-${w.round_number || String(w.round_id).slice(0, 5)}`,
            winnerUserId: w.user_id,
            winnerName: w.winner_name,
            winnerPhone: w.winner_phone,
            amount: liveBal
          };
        } else {
          pendingAward = {
            roundId: 'G-NEXT',
            roundRef: 'Active Round',
            winnerUserId: null,
            winnerName: 'Awaiting Next Strike',
            winnerPhone: '—',
            amount: liveBal
          };
        }
      }

      pools.push({
        roomId: s.id,
        stake: s.stake,
        name: s.name,
        balance: Math.round(liveBal * 10) / 10,
        target,
        seedAmount: seedBal,
        isLive,
        isActive: liveRoom?.isActive ?? true,
        addedToday: Math.round(addedToday * 10) / 10,
        lastAwarded: dbRow?.last_won_at || null,
        lastWonAmount: parseFloat(dbRow?.last_won_amount || '0'),
        pendingAward
      });
    }

    // 7. Find closest to target (among accumulating pools)
    const accumulating = pools.filter(p => !p.isLive);
    accumulating.sort((a, b) => (a.target - a.balance) - (b.target - b.balance));
    const closest = accumulating[0] ? {
      roomId: closestRoom(accumulating[0].roomId),
      stake: accumulating[0].stake,
      distance: Math.max(0, Math.round((accumulating[0].target - accumulating[0].balance) * 10) / 10),
      balance: accumulating[0].balance,
      target: accumulating[0].target
    } : null;

    return res.json({
      success: true,
      data: {
        totalVaultBalance: Math.round(totalVaultBalance * 10) / 10,
        contributedToday: Math.round(contributedToday * 10) / 10,
        awardedLast30Days: Math.round(awardedLast30Days * 10) / 10,
        closestToTarget: closest,
        pools,
        chart14Days
      }
    });
  } catch (error: any) {
    console.error('❌ [Admin Jackpots Overview Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve jackpot overview data' });
  }
}

function closestRoom(id: string): string {
  const match = id.replace('room-', '');
  return match;
}

/**
 * 2. GET /api/admin/jackpots/contributions
 * Filtered by period, room, date range, with volume breakdown and paginated ledger.
 */
adminJackpotsRouter.get('/contributions', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      period = 'month',
      from,
      to,
      roomId = 'all',
      page = '1',
      limit = '25',
      exportCsv = 'false'
    } = req.query as Record<string, string>;

    const bounds = resolveTimeBounds(period, from, to);
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = exportCsv === 'true' ? 10000 : Math.min(Math.max(parseInt(limit, 10) || 25, 1), 100);
    const offset = (pageNum - 1) * limitNum;

    // Build filter clause
    const filterClauses: string[] = ['gr.jackpot_fee > 0'];
    const filterValues: any[] = [];
    let idx = 1;

    filterClauses.push(`gr.started_at >= $${idx++}`);
    filterValues.push(bounds.startIso);

    filterClauses.push(`gr.started_at <= $${idx++}`);
    filterValues.push(bounds.endIso);

    if (roomId && roomId !== 'all') {
      filterClauses.push(`gr.room_id = $${idx++}`);
      filterValues.push(roomId);
    }

    const whereSql = filterClauses.length > 0 ? `WHERE ${filterClauses.join(' AND ')}` : '';

    // A. Query KPI Aggregates for current period
    const kpiRes = await query(`
      SELECT 
        COALESCE(SUM(gr.jackpot_fee), 0) as total_contributions,
        COUNT(gr.id) as games_count,
        COALESCE(MAX(gr.jackpot_fee), 0) as largest_contribution,
        COALESCE(AVG(gr.jackpot_fee), 0) as avg_contribution
      FROM game_rounds gr
      ${whereSql}
    `, filterValues);

    const kpiRow = kpiRes.rows[0];
    const totalContributions = parseFloat(kpiRow?.total_contributions || '0');
    const gamesCount = parseInt(kpiRow?.games_count || '0', 10);
    const largestContribution = parseFloat(kpiRow?.largest_contribution || '0');
    const avgContribution = parseFloat(kpiRow?.avg_contribution || '0');

    // B. Query Previous Period Total for trend comparison
    let prevWhereSql = `WHERE gr.jackpot_fee > 0 AND gr.started_at >= $1 AND gr.started_at <= $2`;
    const prevValues: any[] = [bounds.prevStartIso, bounds.prevEndIso];
    if (roomId && roomId !== 'all') {
      prevWhereSql += ` AND gr.room_id = $3`;
      prevValues.push(roomId);
    }

    const prevRes = await query(`
      SELECT COALESCE(SUM(gr.jackpot_fee), 0) as prev_total
      FROM game_rounds gr
      ${prevWhereSql}
    `, prevValues);

    const prevTotal = parseFloat(prevRes.rows[0]?.prev_total || '0');
    let trendPercent = 0;
    if (prevTotal > 0) {
      trendPercent = Math.round(((totalContributions - prevTotal) / prevTotal) * 1000) / 10;
    } else if (totalContributions > 0) {
      trendPercent = 100;
    }

    // C. Pool Breakdown Share
    const shareRes = await query(`
      SELECT gr.room_id, COALESCE(SUM(gr.jackpot_fee), 0) as room_total
      FROM game_rounds gr
      ${whereSql}
      GROUP BY gr.room_id
    `, filterValues);

    const roomShareMap = new Map(shareRes.rows.map(r => [r.room_id, parseFloat(r.room_total || '0')]));
    const poolBreakdown = STAKE_ROOMS.map(s => {
      const amt = roomShareMap.get(s.id) || 0;
      const share = totalContributions > 0 ? Math.round((amt / totalContributions) * 1000) / 10 : 0;
      return {
        roomId: s.id,
        stake: s.stake,
        name: s.name,
        amount: Math.round(amt * 10) / 10,
        sharePercent: share
      };
    });

    // D. Daily Timeline Buckets for the chart
    const dailyRes = await query(`
      SELECT 
        TO_CHAR(gr.started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') as date_str,
        COALESCE(SUM(gr.jackpot_fee), 0) as day_total
      FROM game_rounds gr
      ${whereSql}
      GROUP BY date_str
      ORDER BY date_str ASC
    `, filterValues);

    const dailyVolume = dailyRes.rows.map(r => ({
      date: r.date_str,
      amount: parseFloat(r.day_total || '0')
    }));

    // E. Paginated Ledger Rows
    const countRes = await query(`
      SELECT COUNT(gr.id) as total_rows
      FROM game_rounds gr
      ${whereSql}
    `, filterValues);
    const totalRows = parseInt(countRes.rows[0]?.total_rows || '0', 10);

    const ledgerRes = await query(`
      SELECT 
        gr.id,
        gr.room_id,
        gr.round_number,
        gr.total_pot,
        gr.jackpot_fee,
        gr.winner_payout,
        gr.winner_names,
        gr.started_at
      FROM game_rounds gr
      ${whereSql}
      ORDER BY gr.started_at DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `, [...filterValues, limitNum, offset]);

    const items = ledgerRes.rows.map(r => {
      const winNames = Array.isArray(r.winner_names) ? r.winner_names.join(', ') : (r.winner_names || '—');
      return {
        id: r.id,
        roundRef: `G-${r.round_number || String(r.id).slice(0, 6)}`,
        roomId: r.room_id,
        stake: r.room_id === 'room-10' ? 10 : r.room_id === 'room-20' ? 20 : r.room_id === 'room-50' ? 50 : 100,
        totalPot: parseFloat(r.total_pot || '0'),
        jackpotFee: parseFloat(r.jackpot_fee || '0'),
        winnerPayout: parseFloat(r.winner_payout || '0'),
        winnerNames: winNames,
        date: r.started_at
      };
    });

    // If CSV export requested, return formatted rows
    if (exportCsv === 'true') {
      const headers = ['Date', 'Round Ref', 'Room ID', 'Stake (ETB)', 'Total Pot', 'Jackpot Fee (ETB)', 'Winner(s)'];
      const csvRows = [headers.join(',')];
      for (const item of items) {
        csvRows.push([
          `"${new Date(item.date).toISOString()}"`,
          `"${item.roundRef}"`,
          `"${item.roomId}"`,
          item.stake,
          item.totalPot,
          item.jackpotFee,
          `"${String(item.winnerNames).replace(/"/g, '""')}"`
        ].join(','));
      }
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="jackpot-contributions-${period}.csv"`);
      return res.send(csvRows.join('\n'));
    }

    return res.json({
      success: true,
      data: {
        kpis: {
          totalContributions: Math.round(totalContributions * 10) / 10,
          gamesCount,
          largestContribution: Math.round(largestContribution * 10) / 10,
          avgContribution: Math.round(avgContribution * 10) / 10,
          trendPercent,
          trendLabel: bounds.label
        },
        poolBreakdown,
        dailyVolume,
        pagination: {
          page: pageNum,
          limit: limitNum,
          totalRows,
          totalPages: Math.ceil(totalRows / limitNum) || 1
        },
        items
      }
    });
  } catch (error: any) {
    console.error('❌ [Admin Jackpots Contributions Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve contributions ledger' });
  }
});

/**
 * 3. GET /api/admin/jackpots/winners
 * KPI cards, instant player search, room filter, pagination & CSV export.
 */
adminJackpotsRouter.get('/winners', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      roomId = 'all',
      query: searchQuery,
      page = '1',
      limit = '25',
      exportCsv = 'false'
    } = req.query as Record<string, string>;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = exportCsv === 'true' ? 10000 : Math.min(Math.max(parseInt(limit, 10) || 25, 1), 100);
    const offset = (pageNum - 1) * limitNum;

    // A. Query Overall KPIs
    const [kpiRes, poolsRes] = await Promise.all([
      query(`
        SELECT 
          COALESCE(SUM(amount), 0) as total_awarded,
          COUNT(id) as jackpots_paid,
          COALESCE(MAX(amount), 0) as largest_payout
        FROM jackpot_winners
      `),
      query(`SELECT room_id, balance, seed_amount FROM jackpot_pool`)
    ]);

    const totalAwarded = parseFloat(kpiRes.rows[0]?.total_awarded || '0');
    const jackpotsPaid = parseInt(kpiRes.rows[0]?.jackpots_paid || '0', 10);
    const largestPayout = parseFloat(kpiRes.rows[0]?.largest_payout || '0');

    // Awaiting award: count pools where balance >= 500
    let awaitingCount = 0;
    let awaitingTotal = 0;
    for (const p of poolsRes.rows) {
      const liveRoom = gameEngine.getRoom(p.room_id);
      const bal = liveRoom?.jackpotPoolBalance !== undefined ? liveRoom.jackpotPoolBalance : parseFloat(p.balance || '0');
      if (bal >= 500) {
        awaitingCount++;
        awaitingTotal += bal;
      }
    }

    // B. Build Filter Clauses for table
    const whereClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (roomId && roomId !== 'all') {
      whereClauses.push(`jw.room_id = $${idx++}`);
      values.push(roomId);
    }

    if (searchQuery && searchQuery.trim()) {
      const q = `%${searchQuery.trim()}%`;
      whereClauses.push(`(u.full_name ILIKE $${idx} OR u.phone ILIKE $${idx} OR jw.round_id::text ILIKE $${idx})`);
      values.push(q);
      idx++;
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // C. Count total rows
    const countRes = await query(`
      SELECT COUNT(jw.id) as total_rows
      FROM jackpot_winners jw
      JOIN users u ON jw.user_id = u.id
      ${whereSql}
    `, values);
    const totalRows = parseInt(countRes.rows[0]?.total_rows || '0', 10);

    // D. Fetch rows
    const winnersRes = await query(`
      SELECT 
        jw.id,
        jw.room_id,
        jw.round_id,
        jw.user_id,
        jw.amount,
        jw.balls_count,
        jw.won_at,
        u.full_name as winner_name,
        u.phone as winner_phone,
        u.telegram_username,
        gr.round_number
      FROM jackpot_winners jw
      JOIN users u ON jw.user_id = u.id
      LEFT JOIN game_rounds gr ON jw.round_id = gr.id
      ${whereSql}
      ORDER BY jw.won_at DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `, [...values, limitNum, offset]);

    const items = winnersRes.rows.map(w => ({
      id: w.id,
      roundRef: `G-${w.round_number || (w.round_id ? String(w.round_id).slice(0, 6) : 'OFFLINE')}`,
      roomId: w.room_id,
      stake: w.room_id === 'room-10' ? 10 : w.room_id === 'room-20' ? 20 : w.room_id === 'room-50' ? 50 : 100,
      userId: w.user_id,
      winnerName: w.winner_name || 'Anonymous Player',
      winnerPhone: w.winner_phone || '—',
      telegramUsername: w.telegram_username ? `@${w.telegram_username}` : null,
      amount: parseFloat(w.amount || '0'),
      ballsCount: w.balls_count || 15,
      date: w.won_at,
      status: 'Paid'
    }));

    if (exportCsv === 'true') {
      const headers = ['Date', 'Round Ref', 'Pool', 'Stake (ETB)', 'Winner Name', 'Phone', 'Payout Amount (ETB)', 'Balls Count', 'Status'];
      const csvRows = [headers.join(',')];
      for (const item of items) {
        csvRows.push([
          `"${new Date(item.date).toISOString()}"`,
          `"${item.roundRef}"`,
          `"${item.roomId}"`,
          item.stake,
          `"${String(item.winnerName).replace(/"/g, '""')}"`,
          `"${item.winnerPhone}"`,
          item.amount,
          item.ballsCount,
          `"${item.status}"`
        ].join(','));
      }
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="jackpot-winners-payouts.csv"`);
      return res.send(csvRows.join('\n'));
    }

    return res.json({
      success: true,
      data: {
        kpis: {
          totalAwarded: Math.round(totalAwarded * 10) / 10,
          jackpotsPaid,
          largestPayout: Math.round(largestPayout * 10) / 10,
          awaitingAwardCount: awaitingCount,
          awaitingAwardAmount: Math.round(awaitingTotal * 10) / 10
        },
        pagination: {
          page: pageNum,
          limit: limitNum,
          totalRows,
          totalPages: Math.ceil(totalRows / limitNum) || 1
        },
        items
      }
    });
  } catch (error: any) {
    console.error('❌ [Admin Jackpots Winners Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve jackpot winners ledger' });
  }
});

/**
 * 4. POST /api/admin/jackpots/award
 * Executes an ACID settlement: credits winner wallet, creates transaction,
 * inserts into jackpot_winners, resets pool to seed, and emits WebSocket update.
 */
adminJackpotsRouter.post('/award', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { roomId, winnerUserId, roundId, awardAmount } = req.body;
    if (!roomId) {
      return res.status(400).json({ success: false, error: 'Room ID is required' });
    }

    const result = await withTransaction(async (client) => {
      // 1. Lock jackpot pool row
      const poolRes = await client.query(`
        SELECT * FROM jackpot_pool WHERE room_id = $1 FOR UPDATE
      `, [roomId]);

      if (poolRes.rows.length === 0) {
        throw new Error(`Jackpot pool not found for ${roomId}`);
      }

      const poolRow = poolRes.rows[0];
      const currentBalance = parseFloat(poolRow.balance || '0');
      const seedAmount = parseFloat(poolRow.seed_amount || '500.00');
      const payoutAmount = typeof awardAmount === 'number' && awardAmount > 0 ? awardAmount : currentBalance;

      // 2. Resolve winner user
      let targetUserId = winnerUserId;
      let targetRoundId = roundId;

      if (!targetUserId) {
        const latestRoundRes = await client.query(`
          SELECT id, round_number, winner_user_ids
          FROM game_rounds
          WHERE room_id = $1 AND phase IN ('winner', 'ended')
          ORDER BY started_at DESC
          LIMIT 1
        `, [roomId]);

        if (latestRoundRes.rows.length > 0) {
          const wIds = latestRoundRes.rows[0].winner_user_ids;
          targetUserId = Array.isArray(wIds) ? wIds[0] : (typeof wIds === 'string' ? JSON.parse(wIds)[0] : null);
          targetRoundId = latestRoundRes.rows[0].id;
        }
      }

      if (!targetUserId) {
        throw new Error('No eligible winner found to award the jackpot to');
      }

      // Check winner user
      const userRes = await client.query(`
        SELECT id, full_name, phone FROM users WHERE id = $1
      `, [targetUserId]);

      if (userRes.rows.length === 0) {
        throw new Error('Winner user record not found');
      }
      const winnerUser = userRes.rows[0];

      // 3. Credit winner cash wallet
      const walletRes = await client.query(`
        UPDATE wallets 
        SET balance = balance + $1, updated_at = NOW() 
        WHERE user_id = $2 
        RETURNING balance
      `, [payoutAmount, targetUserId]);

      if (walletRes.rows.length === 0) {
        throw new Error('Winner wallet not found');
      }
      const newWalletBal = parseFloat(walletRes.rows[0].balance);

      // 4. Insert wallet transaction
      const refCode = `JP-AWARD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      await client.query(`
        INSERT INTO wallet_transactions (
          user_id, type, amount, balance_after, reference_code, status, description
        ) VALUES (
          $1, 'win', $2, $3, $4, 'completed', $5
        )
      `, [
        targetUserId,
        payoutAmount,
        newWalletBal,
        refCode,
        `Progressive Jackpot Award (${roomId.toUpperCase()} Stake)`
      ]);

      // 5. Insert jackpot_winners record
      const jwRes = await client.query(`
        INSERT INTO jackpot_winners (
          room_id, round_id, user_id, amount, balls_count, won_at
        ) VALUES (
          $1, $2, $3, $4, $5, NOW()
        )
        RETURNING id, won_at
      `, [
        roomId,
        targetRoundId || null,
        targetUserId,
        payoutAmount,
        15 // Speed 15 Golden Strike
      ]);

      // 6. Reset pool balance to seed amount
      const carryOver = Math.max(0, currentBalance - payoutAmount);
      const newPoolBal = seedAmount + carryOver;

      const updatedPoolRes = await client.query(`
        UPDATE jackpot_pool 
        SET balance = $1, 
            last_won_amount = $2, 
            last_winner_user_id = $3, 
            last_won_at = NOW(), 
            updated_at = NOW() 
        WHERE room_id = $4 
        RETURNING *
      `, [newPoolBal, payoutAmount, targetUserId, roomId]);

      return {
        awardId: jwRes.rows[0].id,
        wonAt: jwRes.rows[0].won_at,
        payoutAmount,
        newPoolBal,
        winnerName: winnerUser.full_name,
        winnerPhone: winnerUser.phone,
        refCode
      };
    });

    // 7. Sync live gameEngine memory pool
    const liveRoom = gameEngine.getRoom(roomId);
    if (liveRoom) {
      liveRoom.jackpotPoolBalance = result.newPoolBal;
    }

    // 8. Emit live WebSocket event
    io.emit('jackpot_update', {
      roomId,
      balance: result.newPoolBal,
      isAwarded: true,
      amount: result.payoutAmount,
      winnerName: result.winnerName
    });

    return res.json({
      success: true,
      message: `🎉 Jackpot of ${result.payoutAmount.toLocaleString()} ETB successfully awarded to ${result.winnerName}!`,
      data: result
    });
  } catch (error: any) {
    console.error('❌ [Admin Jackpots Award Error]:', error);
    return res.status(400).json({ success: false, error: error.message || 'Failed to award jackpot' });
  }
});

/**
 * 5. POST /api/admin/jackpots/adjust
 * Admin baseline seed & balance adjustment.
 */
adminJackpotsRouter.post('/adjust', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
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
      return res.status(404).json({ success: false, error: 'Jackpot pool not found' });
    }

    const updatedRow = result.rows[0];
    const liveRoom = gameEngine.getRoom(roomId);
    if (liveRoom && typeof balance === 'number') {
      liveRoom.jackpotPoolBalance = balance;
    }

    io.emit('jackpot_update', {
      roomId,
      balance: typeof balance === 'number' ? balance : parseFloat(updatedRow.balance)
    });

    return res.json({
      success: true,
      message: 'Jackpot pool successfully updated',
      pool: updatedRow
    });
  } catch (error: any) {
    console.error('❌ [Admin Jackpots Adjust Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to adjust jackpot pool' });
  }
});
