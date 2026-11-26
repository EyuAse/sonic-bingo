/**
 * server/sockets/kenoSocket.ts
 * Room-Scoped Socket.IO Event Handlers for Fast Keno ('keno_room' & keno:* namespace)
 * 100% Additive & Network-Isolated: Zero broadcasts sent to Bingo or Lobby players.
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { KenoGameEngine } from '../game/KenoGameEngine.ts';
import { ProvablyFairKeno } from '../game/provablyFair.ts';
import { query } from '../db.ts';
import { postgresWalletAdapter } from '../db/PostgresWalletAdapter.ts';

const KENO_ROOM = 'keno_room';

export function setupKenoSockets(io: SocketIOServer, engine: KenoGameEngine): void {
  const syncWatcherCount = () => {
    const size = io.sockets.adapter.rooms.get(KENO_ROOM)?.size || 0;
    engine.setWatcherCount(size);
  };

  // ── Room-Scoped Engine Event Forwarders (Strictly only to 'keno_room') ──

  engine.on('round:started', (data) => {
    io.to(KENO_ROOM).emit('keno:round_started', data);
  });

  engine.on('round:tick', (data) => {
    io.to(KENO_ROOM).emit('keno:tick', data);
  });

  engine.on('round:draw_started', (data) => {
    io.to(KENO_ROOM).emit('keno:draw_started', data);
  });

  engine.on('round:ball_drawn', (data) => {
    io.to(KENO_ROOM).emit('keno:ball_drawn', data);
  });

  engine.on('round:settled', (data) => {
    io.to(KENO_ROOM).emit('keno:round_settled', {
      ...data,
      hotCold: engine.getHotColdStats()
    });
    io.to(KENO_ROOM).emit('keno:recent_results_updated', {
      recentHistory: engine.getCurrentState().recentHistory
    });
  });

  engine.on('player:settled', (data) => {
    io.to(`user:${data.userId}`).emit('keno:player_settled', data);
    if (typeof data.balanceAfter === 'number') {
      io.to(`user_${data.userId}`).emit(`user_${data.userId}_balance`, {
        userId: data.userId,
        balance: data.balanceAfter,
        bonus: data.bonusAfter,
        type: data.userTotalWin > 0 ? 'keno_win' : 'keno_settled'
      });
    }
  });

  engine.on('ticket:placed', (data: { ticket: any; balanceAfter?: number }) => {
    io.to(KENO_ROOM).emit('keno:ticket_placed', {
      ticket: {
        ticketId: data.ticket.ticketId,
        ticketDbId: data.ticket.ticketDbId,
        userId: data.ticket.userId,
        roundNumber: data.ticket.roundNumber,
        selectedNumbers: data.ticket.selectedNumbers,
        spotCount: data.ticket.spotCount,
        betAmount: data.ticket.betAmount,
        isBonus: data.ticket.isBonus,
        status: data.ticket.status,
        createdAt: data.ticket.createdAt
      }
    });
  });

  // ── Client Connection Handlers ──

  io.on('connection', (socket: Socket) => {
    let currentUserId =
      (socket.handshake.auth?.userId as string) ||
      (socket.handshake.query?.userId as string) ||
      '';

    if (currentUserId) {
      socket.join(`user:${currentUserId}`);
    }

    // 1. Join Keno Room & Sync State
    socket.on('keno:join', async (data?: { userId?: string }) => {
      if (data?.userId && data.userId !== currentUserId) {
        if (currentUserId) socket.leave(`user:${currentUserId}`);
        currentUserId = data.userId;
        socket.join(`user:${currentUserId}`);
      }

      await socket.join(KENO_ROOM);
      syncWatcherCount();
      await engine.ensureActiveLoop();

      const state = engine.getCurrentState();
      const userTickets = currentUserId ? engine.getUserTickets(currentUserId) : [];
      const allActiveTickets = engine.getAllActiveTickets();
      const recentAwaySettlement = currentUserId ? engine.consumeRecentUserSettlement(currentUserId) : null;

      socket.emit('keno:init_state', {
        ...state,
        userTickets,
        allActiveTickets,
        recentAwaySettlement
      });
    });

    // Leave Keno Room cleanly when player exits Keno page
    socket.on('keno:leave', async () => {
      await socket.leave(KENO_ROOM);
      syncWatcherCount();
    });

    socket.on('disconnect', () => {
      // Wait next tick so Socket.IO adapter cleans disconnected socket from rooms first
      setTimeout(syncWatcherCount, 0);
    });

    // Handle universal identify_user from socketService
    socket.on('identify_user', (data?: { userId?: string }) => {
      if (data?.userId && data.userId !== currentUserId) {
        if (currentUserId) socket.leave(`user:${currentUserId}`);
        currentUserId = data.userId;
        socket.join(`user:${currentUserId}`);
      }
    });

    // 2. Place Ticket Bet (Atomic Neon Deduction + Idempotency Key)
    socket.on(
      'keno:place_ticket',
      async (
        payload: {
          selectedNumbers: number[];
          betAmount: number;
          isBonus?: boolean;
          userId?: string;
          idempotencyKey?: string;
        },
        callback?: (response: any) => void
      ) => {
        try {
          const targetUserId = payload.userId || currentUserId;
          if (!targetUserId) {
            const errResp = { success: false, error: 'Authentication required to place ticket' };
            if (callback) callback(errResp);
            else socket.emit('keno:ticket_placed_result', errResp);
            return;
          }

          const result = await engine.placeTicket(
            targetUserId,
            payload.selectedNumbers,
            payload.betAmount,
            Boolean(payload.isBonus),
            payload.idempotencyKey
          );

          if (callback) {
            callback(result);
          } else {
            socket.emit('keno:ticket_placed_result', result);
          }
        } catch (err: any) {
          const errResp = { success: false, error: err?.message || 'Failed to place ticket' };
          if (callback) callback(errResp);
          else socket.emit('keno:ticket_placed_result', errResp);
        }
      }
    );

    // 3. Cryptographic Verification
    socket.on(
      'keno:verify_round',
      (
        payload: {
          serverSeed: string;
          expectedHash: string;
          clientSeed: string;
          nonce: number;
          expectedDrawn: number[];
        },
        callback?: (res: any) => void
      ) => {
        const result = ProvablyFairKeno.verifyRound(
          payload.serverSeed,
          payload.expectedHash,
          payload.clientSeed,
          payload.nonce,
          payload.expectedDrawn
        );

        if (callback) callback(result);
        else socket.emit('keno:verify_round_result', result);
      }
    );

    // 4. Fetch Authenticated Player's Ticket History
    socket.on('keno:get_player_history', async (data: { userId?: string }, callback) => {
      try {
        const targetUserId = data?.userId || currentUserId;
        if (!targetUserId) {
          if (callback) callback({ success: false, history: [] });
          socket.emit('keno:player_history', { success: false, history: [] });
          return;
        }

        const resolvedUserId = await postgresWalletAdapter.resolveUserId(targetUserId);

        const res = await query<any>(
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

        const history = res.rows.map(r => ({
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

        if (callback) callback({ success: true, history });
        socket.emit('keno:player_history', { success: true, history });
      } catch (err: any) {
        console.error('⚠️ [Keno] Error fetching player history:', err?.message || err);
        if (callback) callback({ success: false, history: [], error: err?.message });
        socket.emit('keno:player_history', { success: false, history: [], error: err?.message });
      }
    });

    // 5. Fetch Recent Completed Rounds
    socket.on('keno:get_recent_results', async (_data, callback) => {
      try {
        const res = await query<any>(
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

        const results = res.rows.map(r => ({
          roundNumber: parseInt(r.round_number, 10),
          drawnNumbers: r.drawn_numbers || [],
          serverSeed: r.server_seed || '',
          serverSeedHash: r.server_seed_hash || '',
          totalBets: r.total_bets_count || 0,
          totalPayout: parseFloat(r.total_payout || '0'),
          drawnAt: parseFloat(r.drawn_at || String(Date.now()))
        }));

        if (callback) callback({ success: true, results });
        socket.emit('keno:recent_results', { success: true, results });
      } catch (err: any) {
        console.error('⚠️ [Keno] Error fetching recent results:', err?.message || err);
        const memoryResults = engine.getCurrentState().recentHistory;
        if (callback) callback({ success: true, results: memoryResults });
        socket.emit('keno:recent_results', { success: true, results: memoryResults });
      }
    });

    // 6. Fetch Global Leaderboard (Latest 10 Winning Bets)
    socket.on('keno:get_leaderboard', async (_data, callback) => {
      try {
        const res = await query<any>(
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

        const leaders = res.rows.map(r => {
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

        if (callback) callback({ success: true, leaders });
        socket.emit('keno:leaderboard', { success: true, leaders });
      } catch (err: any) {
        console.error('⚠️ [Keno] Error fetching leaderboard:', err?.message || err);
        if (callback) callback({ success: false, leaders: [] });
        socket.emit('keno:leaderboard', { success: false, leaders: [] });
      }
    });

    // 7. Fetch Hot/Cold Statistics
    socket.on('keno:get_stats', (_data, callback) => {
      const stats = engine.getHotColdStats();
      if (callback) callback({ success: true, stats });
      socket.emit('keno:stats', { success: true, stats });
    });
  });
}
