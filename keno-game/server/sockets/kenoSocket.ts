import { Server as SocketIOServer, Socket } from 'socket.io';
import { KenoGameEngine } from '../game/KenoGameEngine.ts';
import { ProvablyFairKeno } from '../game/provablyFair.ts';

export function setupKenoSockets(io: SocketIOServer, engine: KenoGameEngine): void {
  // ── Engine Event Forwarders ──

  engine.on('round:started', (data) => {
    io.emit('keno:round_started', data);
  });

  engine.on('round:tick', (data) => {
    io.emit('keno:tick', data);
  });

  engine.on('round:draw_started', (data) => {
    io.emit('keno:draw_started', data);
  });

  engine.on('round:ball_drawn', (data) => {
    io.emit('keno:ball_drawn', data);
  });

  engine.on('round:settled', (data) => {
    io.emit('keno:round_settled', {
      ...data,
      hotCold: engine.getHotColdStats()
    });
  });

  engine.on('player:settled', (data) => {
    // Send settlement to user's private socket room
    io.to(`user:${data.userId}`).emit('keno:player_settled', data);
  });

  // ── Client Connection Handlers ──

  io.on('connection', (socket: Socket) => {
    let currentUserId = (socket.handshake.query.userId as string) || 'demo-user-1';
    socket.join(`user:${currentUserId}`);

    // 1. Join & State Sync
    socket.on('keno:join', (data?: { userId?: string }) => {
      if (data?.userId) {
        socket.leave(`user:${currentUserId}`);
        currentUserId = data.userId;
        socket.join(`user:${currentUserId}`);
      }

      const state = engine.getCurrentState();
      const myTickets = engine.getUserTickets(currentUserId);
      socket.emit('keno:init_state', {
        ...state,
        userTickets: myTickets
      });
    });

    // 2. Place Ticket Bet
    socket.on('keno:place_ticket', async (payload: {
      selectedNumbers: number[];
      betAmount: number;
      isBonus?: boolean;
    }, callback?: (response: any) => void) => {
      try {
        const result = await engine.placeTicket(
          currentUserId,
          payload.selectedNumbers,
          payload.betAmount,
          Boolean(payload.isBonus)
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
    });

    // 3. Provably Fair Round Verification
    socket.on('keno:verify_round', (payload: {
      serverSeed: string;
      expectedHash: string;
      clientSeed: string;
      nonce: number;
      expectedDrawn: number[];
    }, callback?: (res: any) => void) => {
      const result = ProvablyFairKeno.verifyRound(
        payload.serverSeed,
        payload.expectedHash,
        payload.clientSeed,
        payload.nonce,
        payload.expectedDrawn
      );

      if (callback) callback(result);
      else socket.emit('keno:verify_round_result', result);
    });
  });
}

