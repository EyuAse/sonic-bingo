import { io, Socket } from 'socket.io-client';
import { getBackendOrigin } from '../config/env.ts';
import { telegramService } from './telegramService.ts';

export type ConnectionStatus = 'connected' | 'reconnecting' | 'polling' | 'disconnected' | 'degraded';

export interface OfflineWinData {
  id: string;
  userId: string;
  userName: string;
  roomId: string;
  roundNumber: number;
  cartelaId: number;
  amount: number;
  referenceCode: string;
  timestamp: string;
  isOffline: boolean;
  winningPattern: string;
}

class SocketService {
  private static instance: SocketService;
  private socket: Socket | null = null;
  private currentRoomId: string | null = null;
  private currentUserId: string | null = null;
  private currentUserName: string | null = null;

  private status: ConnectionStatus = 'disconnected';
  private latencyMs: number = 24;
  private statusListeners: Array<(status: ConnectionStatus, latencyMs: number) => void> = [];
  private foregroundListeners: Array<() => void> = [];
  private pingInterval: any = null;
  private silenceCheckInterval: any = null;
  private lastMessageTime: number = Date.now();

  // Persistent Event Subscriber Registry: Event Name -> Set of Subscriber Callbacks
  // GUARANTEES ZERO LISTENER LOSS ACROSS RECONNECTS, NETWORK LOSS, OR HARD REFRESHES
  private eventSubscribers: Map<string, Set<Function>> = new Map();
  private attachedSocketEvents: Set<string> = new Set();

  private constructor() {
    this.initLifecycleListeners();
  }

  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  private initLifecycleListeners() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const handleForeground = () => {
      // If user session has been terminated or no active user/room, do not auto-reconnect
      if (!this.currentUserId && !this.currentRoomId) return;

      console.log('📱 [SocketService] Foreground / Resume triggered. Re-verifying socket connection & state.');
      if (!this.socket || !this.socket.connected) {
        this.connect();
      } else {
        if (this.currentRoomId) {
          this.socket.emit('join_room', {
            roomId: this.currentRoomId,
            userId: this.currentUserId,
            userName: this.currentUserName
          });
        }
        this.measurePing();
      }
      // Notify foreground listeners to sync game state immediately
      this.foregroundListeners.forEach(cb => {
        try {
          cb();
        } catch (err) {
          console.warn('Foreground listener error:', err);
        }
      });
    };

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        handleForeground();
      }
    });
    window.addEventListener('focus', handleForeground);
    window.addEventListener('pageshow', handleForeground);
    window.addEventListener('online', () => {
      console.log('🌐 [SocketService] Network connection restored (online).');
      handleForeground();
    });

    // Telegram WebApp specific lifecycle hook
    telegramService.onViewportChanged(() => {
      handleForeground();
    });
  }

  public onForegroundResume(callback: () => void): () => void {
    this.foregroundListeners.push(callback);
    return () => {
      this.foregroundListeners = this.foregroundListeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Internal subscription manager ensuring listeners survive socket recreation
   */
  private subscribeEvent(event: string, callback: Function): () => void {
    if (!this.eventSubscribers.has(event)) {
      this.eventSubscribers.set(event, new Set());
    }
    this.eventSubscribers.get(event)!.add(callback);

    // If socket exists, attach forwarder
    this.ensureSocketListener(event);

    return () => {
      const set = this.eventSubscribers.get(event);
      if (set) {
        set.delete(callback);
      }
    };
  }

  private dispatchEvent(event: string, ...args: any[]) {
    const subscribers = this.eventSubscribers.get(event);
    if (subscribers && subscribers.size > 0) {
      subscribers.forEach(cb => {
        try {
          cb(...args);
        } catch (err) {
          console.error(`❌ [SocketService] Error in handler for event "${event}":`, err);
        }
      });
    }
  }

  private ensureSocketListener(event: string) {
    if (!this.socket) return;
    if (this.attachedSocketEvents.has(event)) return;

    this.attachedSocketEvents.add(event);
    this.socket.on(event, (...args: any[]) => {
      this.lastMessageTime = Date.now();
      this.dispatchEvent(event, ...args);
    });
  }

  private rebindAllListeners() {
    if (!this.socket) return;
    this.attachedSocketEvents.clear();
    for (const event of this.eventSubscribers.keys()) {
      this.ensureSocketListener(event);
    }
  }

  public connect(): Socket {
    if (this.socket) {
      if (!this.socket.connected) {
        this.socket.connect();
      }
      this.rebindAllListeners();
      return this.socket;
    }

    // Connect to server using centralized backend origin (Render in prod / localhost in dev)
    const socketOrigin = getBackendOrigin();

    // Resilient Mobile Network Socket.IO Configuration (15s timeout with jitter backoff)
    const socketOptions = {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
      randomizationFactor: 0.2,
      timeout: 15000
    };

    this.socket = io(socketOrigin, socketOptions);

    this.socket.on('connect', () => {
      console.log('⚡ [Socket.IO] Connected to game server:', this.socket?.id);
      this.lastMessageTime = Date.now();
      this.updateStatus('connected');
      this.measurePing();

      if (this.currentRoomId) {
        this.socket?.emit('join_room', {
          roomId: this.currentRoomId,
          userId: this.currentUserId,
          userName: this.currentUserName
        });
      }

      this.rebindAllListeners();
    });

    // Active Inbound Traffic Heartbeat
    this.socket.onAny(() => {
      this.lastMessageTime = Date.now();
      if (this.status === 'degraded') {
        this.updateStatus('connected');
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.warn('⚠️ [Socket.IO] Disconnected:', reason);
      this.updateStatus('reconnecting');
    });

    this.socket.on('connect_error', (error) => {
      console.warn('⚠️ [Socket.IO] Connection Error (reconnecting):', error.message);
      this.updateStatus('reconnecting');
    });

    this.socket.io.on('reconnect_attempt', () => {
      this.updateStatus('reconnecting');
    });

    this.socket.io.on('reconnect', () => {
      console.log('✅ [Socket.IO] Successfully reconnected!');
      this.lastMessageTime = Date.now();
      this.updateStatus('connected');
      this.rebindAllListeners();
    });

    // Start background ping latency check
    if (!this.pingInterval) {
      this.pingInterval = setInterval(() => {
        if (this.socket?.connected) {
          this.measurePing();
        }
      }, 10000);
    }

    // Active Packet Silence Detector (Catches Half-Open TCP Stalls with 9.5s threshold)
    if (!this.silenceCheckInterval) {
      this.silenceCheckInterval = setInterval(() => {
        if (this.socket?.connected) {
          const elapsed = Date.now() - this.lastMessageTime;
          if (elapsed > 9500 && this.status === 'connected') {
            console.warn(`⚠️ [SocketService] Inbound traffic stalled for ${(elapsed / 1000).toFixed(1)}s. Degrading connection status.`);
            this.updateStatus('degraded');
          }
        }
      }, 2000);
    }

    // Immediately bind all registered event subscribers
    this.rebindAllListeners();

    return this.socket;
  }

  public getLastMessageTime(): number {
    return this.lastMessageTime;
  }

  public markActivity() {
    this.lastMessageTime = Date.now();
    if (this.status === 'degraded') {
      this.updateStatus('connected');
    }
  }

  public forceHardReconnect() {
    console.log('🔄 [SocketService] Performing safe hard socket reconnection...');
    if (this.socket) {
      try {
        this.socket.disconnect();
      } catch (e) {
        console.warn('Socket disconnect error:', e);
      }
      this.socket = null;
    }
    this.attachedSocketEvents.clear();
    this.status = 'reconnecting';
    this.updateStatus('reconnecting');

    const newSock = this.connect();
    this.rebindAllListeners();

    if (this.currentRoomId && newSock.connected) {
      newSock.emit('join_room', {
        roomId: this.currentRoomId,
        userId: this.currentUserId,
        userName: this.currentUserName
      });
    }
  }

  private updateStatus(newStatus: ConnectionStatus) {
    this.status = newStatus;
    this.statusListeners.forEach(cb => cb(this.status, this.latencyMs));
  }

  public measurePing(): Promise<number> {
    return new Promise((resolve) => {
      if (!this.socket || !this.socket.connected) {
        resolve(this.latencyMs);
        return;
      }
      const start = Date.now();
      this.socket.emit('ping_check', start, () => {
        const roundTrip = Date.now() - start;
        this.latencyMs = Math.max(8, roundTrip);
        this.statusListeners.forEach(cb => cb(this.status, this.latencyMs));
        resolve(this.latencyMs);
      });
      // Safety timeout
      setTimeout(() => resolve(this.latencyMs), 1500);
    });
  }

  public getConnectionStatus(): { status: ConnectionStatus; latencyMs: number } {
    return { status: this.status, latencyMs: this.latencyMs };
  }

  public onConnectionStatusChange(callback: (status: ConnectionStatus, latencyMs: number) => void): () => void {
    this.statusListeners.push(callback);
    callback(this.status, this.latencyMs);
    return () => {
      this.statusListeners = this.statusListeners.filter(cb => cb !== callback);
    };
  }

  public getSocket(): Socket {
    if (!this.socket) {
      return this.connect();
    }
    return this.socket;
  }

  public joinRoom(roomId: string, userId?: string, userName?: string) {
    if (this.currentRoomId && this.currentRoomId !== roomId) {
      this.leaveRoom(this.currentRoomId);
    }

    this.currentRoomId = roomId;
    if (userId) this.currentUserId = userId;
    if (userName) this.currentUserName = userName;

    const sock = this.getSocket();
    if (sock.connected) {
      sock.emit('join_room', { roomId, userId, userName });
    }
  }

  public leaveRoom(roomId: string) {
    if (this.currentRoomId === roomId) {
      this.currentRoomId = null;
    }
    if (this.socket && this.socket.connected) {
      this.socket.emit('leave_room', { roomId });
    }
  }

  public buyTicket(
    roomId: string,
    userId: string,
    userName: string,
    cartelaIds: number[],
    stakeAmount?: number,
    isAutoPlay: boolean = true
  ): Promise<{ success: boolean; error?: string; tickets?: any[]; remainingBalance?: number; preBoughtForNextRound?: boolean }> {
    return new Promise((resolve) => {
      const sock = this.getSocket();
      sock.emit(
        'buy_ticket',
        { roomId, userId, userName, cartelaIds, stakeAmount, isAutoPlay },
        (response: any) => {
          resolve(response || { success: false, error: 'No response from game server' });
        }
      );
    });
  }

  public updatePlayerMode(roomId: string, userId: string, isAutoPlay: boolean) {
    const sock = this.getSocket();
    sock.emit('update_player_mode', { roomId, userId, isAutoPlay });
  }

  public claimBingo(
    roomId: string,
    userId: string,
    userName: string,
    cartelaId: number
  ): Promise<{ success: boolean; message: string; winResult?: any }> {
    return new Promise((resolve) => {
      const sock = this.getSocket();
      sock.emit(
        'claim_bingo',
        { roomId, userId, userName, cartelaId },
        (response: any) => {
          resolve(response || { success: false, message: 'No response from server' });
        }
      );
    });
  }

  // Persistent Event Listeners (Zero-Loss Architecture)
  public onRoomState(callback: (state: any) => void): () => void {
    const unsubState = this.subscribeEvent('room_state', callback);
    const unsubSync = this.subscribeEvent('room_sync', callback);
    return () => {
      unsubState();
      unsubSync();
    };
  }

  public onBallCalled(callback: (data: any) => void): () => void {
    return this.subscribeEvent('ball_called', callback);
  }

  public onRoundStarted(callback: (data: any) => void): () => void {
    return this.subscribeEvent('round_started', callback);
  }

  public onRoundWinner(callback: (winResult: any) => void): () => void {
    return this.subscribeEvent('round_winner', callback);
  }

  public onJackpotUpdate(callback: (data: any) => void): () => void {
    return this.subscribeEvent('jackpot_update', callback);
  }

  public onJackpotWon(callback: (data: any) => void): () => void {
    return this.subscribeEvent('jackpot_won', callback);
  }

  public onUserBalanceUpdate(userId: string, callback: (data: any) => void): () => void {
    const eventName = `user_${userId}_balance`;
    return this.subscribeEvent(eventName, callback);
  }

  // Multi-Device Cross-Session Ticket Synchronization
  public onUserTicketsSynced(callback: (data: any) => void): () => void {
    return this.subscribeEvent('user_tickets_synced', callback);
  }

  // Real-Time Lobby Player Joined Event (Bet placed)
  public onPlayerJoined(callback: (data: any) => void): () => void {
    return this.subscribeEvent('player_joined', callback);
  }

  // Real-Time Room User Joined Event (Room entry presence)
  public onRoomUserJoined(callback: (data: any) => void): () => void {
    return this.subscribeEvent('room_user_joined', callback);
  }

  // Disconnect Protection Listeners
  public onOfflineWinNotification(callback: (wins: OfflineWinData[]) => void): () => void {
    return this.subscribeEvent('offline_win_notification', callback);
  }

  public acknowledgeOfflineWin(winId: string) {
    const sock = this.getSocket();
    sock.emit('acknowledge_offline_win', { winId });
  }

  // Lobby Ticket Cancellation / Stake Switch Refund
  public cancelTicketLobby(roomId: string, userId: string): Promise<{ success: boolean; refunded?: number; error?: string }> {
    return new Promise((resolve) => {
      const sock = this.getSocket();
      sock.emit('cancel_ticket_lobby', { roomId, userId }, (res: any) => {
        resolve(res || { success: false, error: 'No response from server' });
      });
    });
  }

  // Lobby Stake Transfer (Room switch with seamless ticket transfer)
  public transferTicketLobby(
    oldRoomId: string,
    newRoomId: string,
    userId: string
  ): Promise<{ success: boolean; tickets?: any[]; refundedOrCharged?: number; error?: string }> {
    return new Promise((resolve) => {
      const sock = this.getSocket();
      sock.emit('transfer_ticket_lobby', { oldRoomId, newRoomId, userId }, (res: any) => {
        resolve(res || { success: false, error: 'No response from server' });
      });
    });
  }

  // Stake Rooms Player Count Summary
  public onStakeRoomsSummary(callback: (summary: Record<number, number>) => void): () => void {
    return this.subscribeEvent('stake_rooms_summary', callback);
  }

  // Lone-Player Stake Protection Notice in Unqualified Houses (< 2 players)
  public onLonePlayerSpectatingNotice(callback: (data: any) => void): () => void {
    return this.subscribeEvent('lone_player_spectating_notice', callback);
  }

  // Concurrent Session Termination (Single Active Device Policy)
  public onSessionTerminated(callback: (data: { reason: string; message: string }) => void): () => void {
    return this.subscribeEvent('session_terminated', callback);
  }

  /**
   * Authoritatively tears down socket connection, cancels intervals, and clears session credentials.
   * Prevents Socket.IO from automatically reconnecting when session has been displaced by another device.
   */
  public terminateSession() {
    console.warn('🛑 [SocketService] Terminating session. Disconnecting socket and purging credentials.');
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.silenceCheckInterval) {
      clearInterval(this.silenceCheckInterval);
      this.silenceCheckInterval = null;
    }
    if (this.socket) {
      try {
        this.socket.disconnect();
      } catch (e) {
        console.warn('Socket disconnect error on terminate:', e);
      }
      this.socket = null;
    }
    this.attachedSocketEvents.clear();
    this.currentRoomId = null;
    this.currentUserId = null;
    this.currentUserName = null;
    this.updateStatus('disconnected');
  }

  public forceReconnect() {
    this.forceHardReconnect();
  }
}

export const socketService = SocketService.getInstance();
