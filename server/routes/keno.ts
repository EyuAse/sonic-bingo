/**
 * server/routes/keno.ts
 * Isolated HTTP REST Endpoints for Fast Keno (Neon Database Backed)
 */

import { Router } from 'express';
import { query } from '../db.ts';
import { kenoEngine } from '../game/KenoGameEngine.ts';
import { postgresWalletAdapter } from '../db/PostgresWalletAdapter.ts';

const router = Router();

router.get('/history', async (req, res) => {
  try {
    const targetUserId = req.query.userId as string;
    if (!targetUserId) {
      return res.json({ success: true, history: [] });
    }
    const resolvedUserId = await postgresWalletAdapter.resolveUserId(targetUserId);
    const dbRes = await query<any>(
      `SELECT 
         t.id as ticket_id,
         t.round_number,
         t.selected_numbers,
         t.spot_count,
         t.bet_amount,
         t.hit_numbers,
         t.hit_count,
         t.multiplier,
         t.payout_amount,
         t.status,
         EXTRACT(EPOCH FROM t.created_at) * 1000 as created_at,
         r.drawn_numbers,
         r.server_seed,
         r.server_seed_hash
       FROM keno_tickets t
       LEFT JOIN keno_rounds r ON t.round_id = r.id OR t.round_number = r.round_number
       WHERE t.user_id = $1 OR t.user_id = $2
       ORDER BY t.created_at DESC
       LIMIT 10`,
      [resolvedUserId, targetUserId]
    );

    const history = dbRes.rows.map(r => ({
      ticketId: r.ticket_id,
      roundNumber: parseInt(r.round_number, 10),
      selectedNumbers: r.selected_numbers || [],
      spotCount: r.spot_count || (r.selected_numbers || []).length,
      betAmount: parseFloat(r.bet_amount || '0'),
      hitNumbers: r.hit_numbers || [],
      hitCount: r.hit_count || 0,
      multiplier: parseFloat(r.multiplier || '0'),
      payoutAmount: parseFloat(r.payout_amount || '0'),
      status: r.status,
      createdAt: parseFloat(r.created_at || String(Date.now())),
      drawnNumbers: r.drawn_numbers || [],
      serverSeed: r.server_seed || '',
      serverSeedHash: r.server_seed_hash || ''
    }));

    return res.json({ success: true, history });
  } catch (err: any) {
    console.error('⚠️ [API] Failed to fetch keno history:', err?.message || err);
    return res.status(500).json({ success: false, error: 'Failed to fetch history', history: [] });
  }
});

router.get('/results', async (_req, res) => {
  try {
    const dbRes = await query<any>(
      `SELECT 
         round_number,
         drawn_numbers,
         server_seed,
         server_seed_hash,
         total_bets_count,
         total_payout,
         COALESCE(EXTRACT(EPOCH FROM settled_at) * 1000, EXTRACT(EPOCH FROM started_at) * 1000) as drawn_at
       FROM keno_rounds
       WHERE status = 'settled'
       ORDER BY round_number DESC
       LIMIT 10`
    );

    const results = dbRes.rows.map(r => ({
      roundNumber: parseInt(r.round_number, 10),
      drawnNumbers: r.drawn_numbers || [],
      serverSeed: r.server_seed || '',
      serverSeedHash: r.server_seed_hash || '',
      totalBets: r.total_bets_count || 0,
      totalPayout: parseFloat(r.total_payout || '0'),
      drawnAt: parseFloat(r.drawn_at || String(Date.now()))
    }));

    return res.json({ success: true, results });
  } catch (err: any) {
    console.error('⚠️ [API] Failed to fetch keno results:', err?.message || err);
    return res.json({ success: true, results: kenoEngine.getCurrentState().recentHistory });
  }
});

router.get('/leaderboard', async (_req, res) => {
  try {
    const dbRes = await query<any>(
      `SELECT 
         t.id,
         t.bet_amount,
         t.payout_amount,
         t.round_number,
         COALESCE(u.public_id::text, u.telegram_id::text, u.phone, u.id::text, '600001') as player_identifier
       FROM keno_tickets t
       LEFT JOIN users u ON t.user_id = u.id
       WHERE t.payout_amount > 0 AND t.status = 'won'
       ORDER BY t.created_at DESC
       LIMIT 10`
    );

    const leaders = dbRes.rows.map(r => {
      const rawId = String(r.player_identifier || '600001').replace(/\D/g, '') || String(r.player_identifier || '600001');
      const maskedId = rawId.length >= 2
        ? `${rawId.slice(0, 1)}***${rawId.slice(-1)}`
        : `${rawId}***`;
      return {
        id: maskedId,
        b: parseFloat(r.bet_amount || '0'),
        w: parseFloat(r.payout_amount || '0')
      };
    });

    return res.json({ success: true, leaders });
  } catch (err: any) {
    console.error('⚠️ [API] Failed to fetch keno leaderboard:', err?.message || err);
    return res.json({ success: true, leaders: [] });
  }
});

router.get('/stats', (_req, res) => {
  res.json({ success: true, stats: kenoEngine.getHotColdStats() });
});

export default router;
