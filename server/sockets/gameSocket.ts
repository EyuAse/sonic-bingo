import { Server, Socket } from 'socket.io';
import { gameEngine } from '../game/BingoGameEngine.ts';

// Single Active Device Session Registry: userId -> { socketId, connectedAt }
const activeUserSessions = new Map<string, { socketId: string; connectedAt: number }>();

function isAuthorizedSession(socketId: string, userId?: string): boolean {
  if (!userId) return true;
  const session = activeUserSessions.get(userId);
  return !session || session.socketId === socketId;
}

export function setupGameSockets(io: Server) {
  io.on('connection', (socket: Socket) => {
    if (process.env.MAINTENANCE_MODE === 'true') {
      socket.emit('maintenance_mode', {
        message: 'ሶኒክ ቢንጎ በጊዜያዊ ጥገና ላይ ነው። ጨዋታዎች ለጊዜው ቆመዋል (Sonic Bingo is under scheduled maintenance).'
      });
      socket.disconnect(true);
      return;
    }

    let currentRoomId: string | null = null;
    let authUserId: string | null = null;
    let authUserName: string = 'Sonic Player';

    // Helper: Register user session, enforce single-device policy, and join user room
    const registerUserSession = (userId: string, userName?: string) => {
      if (!userId) return;
      authUserId = userId;
      if (userName) authUserName = userName;

      // Enforce Single Active Device Policy: Prohibit simultaneous logins on 2 or more devices
      const existingSession = activeUserSessions.get(userId);
      if (existingSession && existingSession.socketId !== socket.id) {
        const oldSocket = io.sockets.sockets.get(existingSession.socketId);
        if (oldSocket) {
          console.log(`⚠️ [Single-Device Policy] User ${userId} connected from new socket ${socket.id}. Disconnecting previous socket ${existingSession.socketId}.`);
          oldSocket.emit("session_terminated", {
            reason: "concurrent_device",
            message: "⚠️ Your account was opened on another device. Simultaneous play on multiple devices is strictly prohibited."
          });
          oldSocket.leave(`user_${userId}`);
          if (currentRoomId) {
            oldSocket.leave(currentRoomId);
          }
          oldSocket.disconnect(true);
        }
      }
      activeUserSessions.set(userId, { socketId: socket.id, connectedAt: Date.now() });

      socket.join(`user_${userId}`);
      console.log(`⚡ [Socket.IO] User ${userId} joined room user_${userId} on socket ${socket.id}`);

      // Check for Disconnect Protection wins that occurred while offline
      const unackedWins = gameEngine.getUnacknowledgedWins(userId);
      if (unackedWins && unackedWins.length > 0) {
        socket.emit("offline_win_notification", unackedWins);
      }
    };

    // Auto-identify if credentials provided in connection handshake auth/query
    const handshakeUserId = (socket.handshake.auth?.userId || socket.handshake.query?.userId) as string | undefined;
    const handshakeUserName = (socket.handshake.auth?.userName || socket.handshake.query?.userName) as string | undefined;
    if (handshakeUserId) {
      registerUserSession(handshakeUserId, handshakeUserName);
    }

    // Explicit User Identification Event: Allows instant room registration without entering a game room
    socket.on("identify_user", (data: { userId?: string; userName?: string }) => {
      if (data?.userId) {
        registerUserSession(data.userId, data.userName);
      }
    });

    // 1. Join Game Room
    socket.on("join_room", (data: { roomId: string; userId?: string; userName?: string }) => {
      const { roomId, userId, userName } = data;
      if (!roomId) return;

      if (currentRoomId && currentRoomId !== roomId) {
        socket.leave(currentRoomId);
        gameEngine.handleLeaveRoom(socket.id, currentRoomId);
      }

      currentRoomId = roomId;
      if (userId) {
        registerUserSession(userId, userName);
      }
      if (userName) authUserName = userName;

      socket.join(roomId);
      gameEngine.handleJoinRoom(socket.id, roomId, userId, authUserName);
      const room = gameEngine.getRoom(roomId);
      if (room) {
        // Find any existing active or queued pre-bought tickets for this user
        const existingTickets = userId
          ? (room.tickets.get(userId) || room.nextRoundTickets.get(userId) || [])
          : [];
        const isPreBuy = Boolean(userId && room.nextRoundTickets.has(userId));

        const occupiedCartelaIds: number[] = [];
        room.tickets.forEach(list => list.forEach(t => occupiedCartelaIds.push(t.cartelaId)));
        if (room.nextRoundTickets) {
          room.nextRoundTickets.forEach(list => list.forEach(t => occupiedCartelaIds.push(t.cartelaId)));
        }
        if (room.opponentCards && room.opponentCards.length > 0) {
          room.opponentCards.forEach(o => occupiedCartelaIds.push(o.cartelaId));
        }

        // Send immediate authoritative room snapshot to joining player
        socket.emit('room_sync', {
          success: true,
          roomId: roomId,
          phase: room.phase,
          mode: room.mode || (room.tickets.size >= 2 ? 'active' : 'spectating'),
          roundNumber: room.roundNumber,
          lobbyCountdown: room.lobbyCountdown,
          winnerCountdown: room.winnerCountdown,
          stakeAmount: room.stakeAmount,
          totalPot: room.totalPot,
          winnerPayout: room.winnerPayout,
          playersCount: gameEngine.getRoomPlayersCount(room),
          realPlayerCount: room.realPlayerCount,
          activeUsersCount: Math.max(room.activeUsers.size, room.activeSockets.size),
          waitingForPlayers: room.waitingForPlayers,
          drawnNumbers: room.drawnNumbers,
          currentCall: room.currentCall,
          winResult: room.winResult,
          occupiedCartelaIds,
          stakeRoomsSummary: gameEngine.getStakeRoomsSummary(),
          userTickets: existingTickets,
          isPreBuy
        });

        // If user already had bought tickets for this round/room, sync them directly to the reconnecting socket
        if (existingTickets.length > 0) {
          socket.emit('user_tickets_synced', {
            roomId,
            userId,
            roundNumber: room.roundNumber,
            isPreBuy,
            tickets: existingTickets
          });
        }
      }
      socket.emit('stake_rooms_summary', gameEngine.getStakeRoomsSummary());
    });

    // Cancel Ticket in Lobby (Room switch refund)
    socket.on('cancel_ticket_lobby', async (data: { roomId: string; userId: string }, callback?: (res: any) => void) => {
      const { roomId, userId } = data;
      if (!isAuthorizedSession(socket.id, userId)) {
        const errRes = { success: false, error: 'Session expired or active on another device.' };
        if (callback) callback(errRes);
        socket.disconnect(true);
        return;
      }
      const result = await gameEngine.handleCancelTicketLobby(userId, roomId);
      if (callback) {
        callback(result);
      } else {
        socket.emit('cancel_ticket_lobby_response', result);
      }
    });

    // Seamless Stake Transfer in Lobby (Room switch with automatic ticket transfer)
    socket.on(
      'transfer_ticket_lobby',
      async (data: { oldRoomId: string; newRoomId: string; userId: string }, callback?: (res: any) => void) => {
        const { oldRoomId, newRoomId, userId } = data;
        if (!isAuthorizedSession(socket.id, userId)) {
          const errRes = { success: false, error: 'Session expired or active on another device.' };
          if (callback) callback(errRes);
          socket.disconnect(true);
          return;
        }
        const result = await gameEngine.handleTransferTicketLobby(userId, oldRoomId, newRoomId, socket.id);
        if (callback) {
          callback(result);
        } else {
          socket.emit('transfer_ticket_lobby_response', result);
        }
      }
    );

    // Admin Socket Config Controls
    socket.on('admin_set_commission', (data: { enabled: boolean; rate?: number }) => {
      gameEngine.setHouseCommission(data.enabled, data.rate);
    });

    socket.on('admin_set_win_rates', (data: { ownerRate: number; botRate: number; realRate: number }) => {
      gameEngine.setWinRates(data.ownerRate, data.botRate, data.realRate);
    });

    socket.on('admin_set_bot_config', (data: any) => {
      gameEngine.setBotConfig(data);
      const updatedConfig = gameEngine.getBotConfig();
      const room10 = gameEngine.getRoom('room-10');
      io.emit('bot_config_updated', {
        botConfig: updatedConfig,
        roomId: 'room-10',
        activeBotCount: room10 ? room10.opponentCards.length : 0
      });
    });

    // 2. Buy Ticket Event
    socket.on(
      'buy_ticket',
      async (
        data: { roomId: string; userId: string; userName: string; cartelaIds: number[]; stakeAmount?: number; isAutoPlay?: boolean },
        callback?: (res: any) => void
      ) => {
        const { roomId, userId, userName, cartelaIds, stakeAmount, isAutoPlay } = data;
        if (!isAuthorizedSession(socket.id, userId)) {
          const errRes = { success: false, error: 'Session active on another device. Simultaneous play is prohibited.' };
          if (callback) callback(errRes);
          else socket.emit('buy_ticket_response', errRes);
          socket.emit('session_terminated', {
            reason: 'concurrent_device',
            message: '⚠️ Your account was opened on another device. Simultaneous play on multiple devices is strictly prohibited.'
          });
          socket.disconnect(true);
          return;
        }
        const result = await gameEngine.handleBuyTicket(
          userId,
          userName || authUserName,
          roomId,
          cartelaIds,
          socket.id,
          stakeAmount,
          isAutoPlay
        );

        if (callback) {
          callback(result);
        } else {
          socket.emit('buy_ticket_response', result);
        }

        // Multi-Device Mirroring: Broadcast synced tickets to ALL devices logged in as this user
        if (result.success && userId) {
          const room = gameEngine.getRoom(roomId);
          io.to(`user_${userId}`).emit('user_tickets_synced', {
            roomId,
            userId,
            roundNumber: room?.roundNumber,
            isPreBuy: result.preBoughtForNextRound,
            tickets: result.tickets,
            remainingBalance: result.remainingBalance
          });
        }
      }
    );

    // 2.2 Update Player Auto/Manual Mode Event
    socket.on('update_player_mode', (data: { roomId: string; userId: string; isAutoPlay: boolean }) => {
      if (!data?.userId) return;
      const targetUserId = data.userId;
      const targetRoomId = data.roomId || currentRoomId || 'room-10';
      const isAuto = Boolean(data.isAutoPlay);

      if (authUserId === targetUserId || isAuthorizedSession(socket.id, targetUserId)) {
        if (!activeUserSessions.has(targetUserId)) {
          activeUserSessions.set(targetUserId, { socketId: socket.id, connectedAt: Date.now() });
        }
        gameEngine.updatePlayerMode(targetRoomId, targetUserId, isAuto);
        console.log(`🎮 [PlayerMode] User ${targetUserId} set mode to ${isAuto ? 'AUTO ⚡' : 'MANUAL ✋'}`);
      } else {
        console.warn(`⚠️ [PlayerMode] Ignored mode switch for user ${targetUserId} from unauthorized socket ${socket.id}`);
      }
    });

    // 3. Claim Bingo Event
    socket.on(
      'claim_bingo',
      async (
        data: { roomId: string; userId: string; userName: string; cartelaId: number },
        callback?: (res: any) => void
      ) => {
        const { roomId, userId, userName, cartelaId } = data;
        if (!isAuthorizedSession(socket.id, userId)) {
          const errRes = { success: false, message: 'Session active on another device.' };
          if (callback) callback(errRes);
          else socket.emit('claim_bingo_response', errRes);
          socket.disconnect(true);
          return;
        }
        const result = await gameEngine.handleClaimBingo(
          userId,
          userName || authUserName,
          roomId,
          cartelaId
        );

        if (callback) {
          callback(result);
        } else {
          socket.emit('claim_bingo_response', result);
        }
      }
    );

    // 4. Leave Room Event
    socket.on('leave_room', (data: { roomId: string }) => {
      const { roomId } = data;
      if (roomId) {
        socket.leave(roomId);
        gameEngine.handleLeaveRoom(socket.id, roomId);
        if (currentRoomId === roomId) {
          currentRoomId = null;
        }
      }
    });

    // 5. Authoritative Disconnect Protection Acknowledgement
    socket.on('acknowledge_offline_win', (data: { winId: string }) => {
      if (data?.winId) {
        gameEngine.acknowledgeOfflineWin(data.winId);
      }
    });

    // 6. Network Latency Ping Check
    socket.on('ping_check', (clientTimestamp: number, callback?: (data: any) => void) => {
      const serverTime = Date.now();
      if (typeof callback === 'function') {
        callback({ clientTimestamp, serverTime });
      } else {
        socket.emit('pong_check', { clientTimestamp, serverTime });
      }
    });

    // 7. Disconnect
    socket.on('disconnect', () => {
      if (authUserId && activeUserSessions.get(authUserId)?.socketId === socket.id) {
        activeUserSessions.delete(authUserId);
      }
      if (currentRoomId) {
        gameEngine.handleLeaveRoom(socket.id, currentRoomId);
      }
    });
  });
}
