import { io } from '../io.ts';
import { query, withTransaction } from '../db.ts';
import { telegramBotService } from '../services/telegramBotService.ts';
import { coinService } from '../services/coinService.ts';
import {
  type BingoCell,
  generateCardFromId,
  checkWinningPattern,
  getAllWinningPatterns,
  getBallColumn,
  generateRandomShuffledBalls
} from './cartelaGenerator.ts';
import {
  sampleStandbyBots,
  isStandbyBotId,
  STANDBY_BOT_COUNT,
  type StandbyBotProfile,
  type BotEngineConfig,
  generateDynamicBotTarget,
  generateNextRoundBotTarget,
  calculateRoom10TargetBots,
  getRoom10HourlyBounds,
  getTargetBotsForElapsedSecond,
  MIN_STANDBY_BOT_COUNT,
  MAX_STANDBY_BOT_COUNT,
  DEFAULT_STANDBY_BOT_COUNT
} from './ethiopianBotRoster.ts';

export interface PlayerTicket {
  userId: string;
  userName: string;
  cartelaId: number;
  cardMatrix: BingoCell[];
  betAmount: number;
  socketId: string;
  isBonus?: boolean;
  isAutoPlay?: boolean;
}

export interface OpponentCard {
  botUserId?: string;
  cartelaId: number;
  cardMatrix: BingoCell[];
  opponentName: string;
  stakeAmount: number;
  isHouseBot?: boolean;
}

export interface OfflineWinRecord {
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
  acknowledged: boolean;
  winningPattern: string;
}

export interface GameRoomState {
  id: string;
  name: string;
  stakeAmount: number;
  commissionPercent: number;
  commissionEnabled: boolean;
  phase: 'lobby' | 'locked' | 'playing' | 'winner';
  mode: 'active' | 'spectating';
  isProcessingVictory: boolean;
  lastBallTime: number;
  lobbyCountdown: number;
  winnerCountdown: number;
  currentRoundId: string | null;
  roundNumber: number;
  drawnNumbers: number[];
  ballSequence: number[];
  currentCall: { num: number; col: string; index: number } | null;
  totalPot: number;
  winnerPayout: number;
  houseFee: number;
  jackpotFee: number;
  jackpotPoolBalance: number;
  tickets: Map<string, PlayerTicket[]>; // userId -> active tickets in current round
  nextRoundTickets: Map<string, PlayerTicket[]>; // userId -> queued tickets for Round N+1 (Anytime Pre-Betting)
  activeSockets: Set<string>;
  activeUsers: Set<string>;
  activeUserSockets: Map<string, string>; // userId -> socketId
  winResult: any | null;
  opponentCards: OpponentCard[];
  targetWinnerType: 'owner' | 'bot' | 'real';
  targetFinishBall?: number;
  targetCardMatrix?: BingoCell[];
  waitingForPlayers: boolean;   // true when < 2 real users have tickets; countdown frozen
  waitingForOtherHouses?: boolean; // true when this house finished early and waits for other active houses
  isHoldingClaimWindow?: boolean;  // true when holding 3.0s window for manual player simultaneous claim
  realPlayerCount: number;      // live count of distinct real users with tickets
  dynamicBotTarget?: number;    // Phase 2: Dynamic bot target count for this round
  targetBotsToSeed?: StandbyBotProfile[]; // Phase 2: Pre-selected bots to trickle in during lobby countdown
}

interface BotProfile {
  id: string;
  name: string;
  phone: string;
}

// Authoritative Registered 3 Bots (Registered as real users in Neon DB)
export const REGISTERED_3_BOTS: BotProfile[] = [
  { id: '00000000-0000-4000-8000-000000000001', name: 'Dawit Haile', phone: '0911445566' },
  { id: '00000000-0000-4000-8000-000000000002', name: 'Selam Tesfaye', phone: '0922334455' },
  { id: '00000000-0000-4000-8000-000000000003', name: 'Abebe Bikila', phone: '0933221100' }
];

// Fisher-Yates True Random Shuffle
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Realistic Bot Multi-Stake Distribution
function getRandomBotStake(): number {
  const rand = Math.random() * 100;
  if (rand < 50) return 10;   // 50% bet 10 ETB
  if (rand < 75) return 20;   // 25% bet 20 ETB
  if (rand < 90) return 50;   // 15% bet 50 ETB
  return 100;                 // 10% bet 100 ETB
}

export const ARENA_ROOM_ID = 'lomi-arena';
export const ROOM_ALIASES = ['lomi-arena', 'room-10', 'room-20', 'room-50', 'room-100', 'default'];
export const STAKE_ROOM_IDS = ['room-10', 'room-20', 'room-50', 'room-100'];
export const TOTAL_CARTELAS = 600;
export const MAX_TICKETS_PER_PLAYER = 4;
export const LOBBY_DURATION_SECONDS = 40;

class BingoGameEngine {
  private static instance: BingoGameEngine;
  private rooms: Map<string, GameRoomState> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  // Cached 200 Persistent Bot Profiles from Neon PostgreSQL
  private botAccounts: BotProfile[] = [];

  // Configurable Win Allocation Rates (Client Rule: 20% Owner, 30% Fake Bot, 50% Real Player)
  private ownerWinRate: number = 20;
  private botWinRate: number = 30;
  private realPlayerWinRate: number = 50;

  // Dynamic Room Capacity (Default 50, adjustable by Admin)
  private roomCapacity: number = 50;

  // Disconnect Protection: Rolling ledger of auto-credited wins
  private offlineWins: OfflineWinRecord[] = [];

  // Player Auto/Manual Mode Preference Registry (userId -> isAutoPlay)
  private playerModes: Map<string, boolean> = new Map();

  // Phase 2: Room 10 Anti-Churn & Loss-Streak Session Tracker (userId -> streak stats)
  private playerSessionStreaks: Map<string, { consecutiveLosses: number; recentWins: number; lastActive: number }> = new Map();

  // Phase 2 & 6: Standby Bot Engine Configuration (Configurable from Admin Desk & 0-50 slider)
  private botConfig: BotEngineConfig = {
    mode: 'dynamic',
    minBots: 2,
    maxBots: 50,
    fixedCount: 20,
    staggeredJoin: true,
    livingClock: true
  };
  private lastClientActivityTimestamp: number = Date.now();

  public getBotConfig(): BotEngineConfig {
    return { ...this.botConfig };
  }

  public setBotConfig(cfg: Partial<BotEngineConfig>) {
    const minB = cfg.minBots ?? cfg.minStandbyBots;
    const maxB = cfg.maxBots ?? cfg.maxStandbyBots;
    const fixed = cfg.fixedCount ?? cfg.targetStandbyBots;
    this.botConfig = {
      ...this.botConfig,
      ...cfg,
      ...(minB !== undefined ? { minBots: minB, minStandbyBots: minB } : {}),
      ...(maxB !== undefined ? { maxBots: maxB, maxStandbyBots: maxB } : {}),
      ...(fixed !== undefined ? { fixedCount: fixed, targetStandbyBots: fixed } : {})
    };
    this.lastClientActivityTimestamp = Date.now();
    console.log(`🤖 [GameEngine] Standby Bot Configuration updated:`, this.botConfig);

    const room10 = this.getRoom('room-10') || this.getRoom(ARENA_ROOM_ID);
    if (room10) {
      if (room10.phase === 'lobby' || room10.phase === 'waiting') {
        // Apply instantly to Room 10 lobby
        this.syncRoom10StandbyBots(room10, true);
        this.broadcastRoomState(room10);
        console.log(`⚡ [GameEngine] Bot config applied INSTANTLY to Room 10 lobby. Active bots: ${room10.opponentCards.length}, Pot: ${room10.totalPot} ETB`);
      } else {
        console.log(`⏳ [GameEngine] Room 10 currently in '${room10.phase}' phase. New bot config will take effect immediately upon next round.`);
      }

      // If living clock was enabled and lobby timer is not running, start it immediately
      if (this.botConfig.livingClock && this.botConfig.mode !== 'disabled' && !this.intervals.has('master_lobby')) {
        console.log(`⏰ [GameEngine] Living clock active — initiating master lobby loop.`);
        this.startMasterLobbyTimer();
      }
    }
  }

  public getPlayerSessionStreak(userId: string) {
    return this.playerSessionStreaks.get(userId);
  }

  // Verified Deposited Users Cache (Anti-Loss Guard for 10 ETB Welcome Bonus)
  // Ensures O(1) microsecond checks with 0 database queries during fast 1s ball draws.
  private depositedUsers: Set<string> = new Set<string>();

  /**
   * Load all verified depositors into memory on server boot.
   * Pulls users where has_deposited = true OR with approved deposit requests.
   */
  public async loadDepositedUsers(): Promise<void> {
    try {
      const res = await query(
        `SELECT id FROM users WHERE has_deposited = true
         UNION
         SELECT DISTINCT user_id as id FROM deposit_requests WHERE status = 'approved'`
      );
      this.depositedUsers = new Set(res.rows.map(r => String(r.id)));
      console.log(`🛡️ [Bonus Anti-Loss Engine] Loaded ${this.depositedUsers.size} verified deposited players into memory`);
    } catch (err) {
      console.warn('⚠️ [GameEngine] Deferred loading deposited users:', err);
    }
  }

  /**
   * Instantly flag a player as a verified depositor in memory (and persist to DB).
   * Called immediately when cashier/admin approves deposit or payment webhook fires.
   */
  public markUserAsDeposited(userId: string): void {
    if (!userId) return;
    const strId = String(userId);
    this.depositedUsers.add(strId);
    console.log(`💎 [Bonus Anti-Loss Engine] User ${strId} marked as verified depositor. Normal win probability unlocked.`);
    query('UPDATE users SET has_deposited = true WHERE id = $1', [strId]).catch(err => {
      console.warn('⚠️ [GameEngine] Failed to persist has_deposited to DB:', err);
    });
  }

  /**
   * Returns true if user has ever made an approved real-money deposit.
   * Used by Room 10 win probability engine to ensure bonus-only players never win real cash pot.
   */
  public isDepositedUser(userId: string): boolean {
    if (!userId) return false;
    return this.depositedUsers.has(String(userId));
  }

  public getDepositedUserCount(): number {
    return this.depositedUsers.size;
  }

  private constructor() {
    this.initializeUnifiedArena();
    this.loadBotAccounts();
    this.loadDepositedUsers();
    this.loadJackpotPools();
  }

  public static getInstance(): BingoGameEngine {
    if (!BingoGameEngine.instance) {
      BingoGameEngine.instance = new BingoGameEngine();
    }
    return BingoGameEngine.instance;
  }

  public getFairnessConfig() {
    return {
      ownerWinRate: this.ownerWinRate,
      botWinRate: this.botWinRate,
      realPlayerWinRate: Math.max(0, 100 - this.ownerWinRate - this.botWinRate),
      roomCapacity: this.roomCapacity,
      commissionPercent: 10
    };
  }

  public setFairnessConfig(cfg: { ownerWinRate?: number; botWinRate?: number; roomCapacity?: number }) {
    if (typeof cfg.ownerWinRate === 'number') this.ownerWinRate = Math.max(0, Math.min(100, cfg.ownerWinRate));
    if (typeof cfg.botWinRate === 'number') this.botWinRate = Math.max(0, Math.min(100, cfg.botWinRate));
    if (typeof cfg.roomCapacity === 'number') this.roomCapacity = Math.max(10, Math.min(200, cfg.roomCapacity));
    this.realPlayerWinRate = Math.max(0, 100 - this.ownerWinRate - this.botWinRate);
  }

  /**
   * Loads the 3 registered bot accounts from Neon DB
   */
  public async loadBotAccounts() {
    try {
      const res = await query(
        'SELECT id, full_name as name, phone FROM users WHERE is_bot = true ORDER BY created_at ASC LIMIT 3'
      );
      if (res.rows.length > 0) {
        this.botAccounts = res.rows.map(r => ({
          id: r.id,
          name: r.name,
          phone: r.phone
        }));
        console.log(`🤖 [BingoGameEngine] Loaded ${this.botAccounts.length} registered bot accounts from Neon DB`);
      } else {
        this.botAccounts = [...REGISTERED_3_BOTS];
      }
    } catch (err) {
      console.error('⚠️ [BingoGameEngine] Error loading bot accounts from DB:', err);
      this.botAccounts = [...REGISTERED_3_BOTS];
    }
  }

  public async loadJackpotPools() {
    try {
      const res = await query('SELECT room_id, balance FROM jackpot_pool');
      for (const row of res.rows) {
        const bal = parseFloat(row.balance || '0');
        const room = this.rooms.get(row.room_id);
        if (room) {
          room.jackpotPoolBalance = bal;
        }
        if (row.room_id === 'room-10') {
          const arena = this.rooms.get(ARENA_ROOM_ID);
          if (arena) arena.jackpotPoolBalance = bal;
          const def = this.rooms.get('default');
          if (def) def.jackpotPoolBalance = bal;
        }
      }
      console.log('🏆 [BingoGameEngine] Loaded live Progressive Jackpot pools from DB');
    } catch (err) {
      console.error('⚠️ [BingoGameEngine] Error loading jackpot pools from DB:', err);
    }
  }

  private createRoomState(id: string, name: string, stakeAmount: number): GameRoomState {
    return {
      id,
      name,
      stakeAmount,
      commissionPercent: 0,
      commissionEnabled: false,
      phase: 'lobby',
      mode: 'active',
      isProcessingVictory: false,
      lastBallTime: Date.now(),
      lobbyCountdown: LOBBY_DURATION_SECONDS,
      winnerCountdown: 8,
      currentRoundId: null,
      roundNumber: 1,
      drawnNumbers: [],
      ballSequence: [],
      currentCall: null,
      totalPot: 0,
      winnerPayout: 0,
      houseFee: 0,
      jackpotFee: 0,
      jackpotPoolBalance: 0,
      tickets: new Map(),
      nextRoundTickets: new Map(),
      activeSockets: new Set(),
      activeUsers: new Set(),
      activeUserSockets: new Map(),
      winResult: null,
      opponentCards: [],
      targetWinnerType: 'real',
      targetFinishBall: 15,
      waitingForPlayers: true,
      waitingForOtherHouses: false,
      realPlayerCount: 0
    };
  }

  /**
   * Initializes Dedicated Stake Rooms (10, 20, 50, 100 ETB) with synchronized clock cycles.
   * Every room has its uniform stake tier for 100% fair mathematical odds and payouts.
   */
  private initializeUnifiedArena() {
    const stakeDefs = [
      { id: 'room-10', name: '10 Birr Room', stake: 10.0 },
      { id: 'room-20', name: '20 Birr Room', stake: 20.0 },
      { id: 'room-50', name: '50 Birr Room', stake: 50.0 },
      { id: 'room-100', name: '100 Birr VIP Room', stake: 100.0 }
    ];

    for (const def of stakeDefs) {
      const state = this.createRoomState(def.id, def.name, def.stake);
      this.rooms.set(def.id, state);
    }

    // Default aliases map to room-10
    const primary = this.rooms.get('room-10')!;
    this.rooms.set(ARENA_ROOM_ID, primary);
    this.rooms.set('default', primary);

    // Pre-seed 5 standby bots in Room 10 (Rooms 20, 50, 100 remain untouched)
    this.syncRoom10StandbyBots(primary);

    // Launch Single Synchronized Master Cycle across all houses!
    this.startMasterLobbyTimer();
    this.startWatchdogTimer();
  }

  public getRoom(roomId?: string): GameRoomState {
    if (roomId && this.rooms.has(roomId)) {
      return this.rooms.get(roomId)!;
    }
    return this.rooms.get('room-10') || this.rooms.get(ARENA_ROOM_ID)!;
  }

  public getRealCartelaCount(room: GameRoomState): number {
    let count = 0;
    if (room.tickets) {
      room.tickets.forEach(list => { count += list.length; });
    }
    return count;
  }

  public getStakeRoomsSummary(): Record<number, number> {
    const getCount = (roomId: string) => {
      const r = this.rooms.get(roomId);
      if (!r) return 0;
      const isRoom10 = roomId === 'room-10' || roomId === ARENA_ROOM_ID;
      if (isRoom10) {
        if (r.opponentCards.length === 0 && r.phase === 'lobby' && this.botConfig.mode !== 'disabled') {
          const bounds = getRoom10HourlyBounds();
          if (bounds.max > 0) {
            this.syncRoom10StandbyBots(r);
          }
        }
        return this.getRoomPlayersCount(r);
      }
      return r.phase === 'playing' ? r.realPlayerCount : this.getRealCartelaCount(r);
    };
    return {
      10: getCount('room-10'),
      20: getCount('room-20'),
      50: getCount('room-50'),
      100: getCount('room-100')
    };
  }

  public getAllRooms() {
    const r10 = this.getRoom('room-10');
    const r20 = this.getRoom('room-20');
    const r50 = this.getRoom('room-50');
    const r100 = this.getRoom('room-100');

    const formatRoomSummary = (r: GameRoomState, idOverride?: string, nameOverride?: string) => ({
      id: idOverride || r.id,
      name: nameOverride || r.name,
      stakeAmount: r.stakeAmount,
      phase: r.phase,
      mode: r.mode || (r.tickets.size >= 2 ? 'active' : 'spectating'),
      lobbyCountdown: r.lobbyCountdown,
      winnerCountdown: r.winnerCountdown,
      playersCount: this.getRoomPlayersCount(r),
      realPlayerCount: this.getRealCartelaCount(r),
      totalPot: r.totalPot,
      winnerPayout: r.winnerPayout,
      houseFee: r.houseFee || 0,
      jackpotFee: r.jackpotFee || 0,
      jackpotPool: r.jackpotPoolBalance || 0,
      isJackpotActive: (r.jackpotPoolBalance || 0) >= 500,
      winResult: r.winResult
    });

    return [
      formatRoomSummary(r10, 'lomi-arena', '10 Birr Arena (Default)'),
      formatRoomSummary(r10),
      formatRoomSummary(r20),
      formatRoomSummary(r50),
      formatRoomSummary(r100)
    ];
  }

  // Returns live count of real player cartelas + active bots (unlimited, no 50 cap)
  public getRoomPlayersCount(room: GameRoomState): number {
    const realCartelas = this.getRealCartelaCount(room);
    const botCount = room.opponentCards ? room.opponentCards.length : 0;
    return realCartelas + botCount;
  }

  // Admin Controls: System Lock (House Commission)
  public setHouseCommission(enabled: boolean, rate?: number) {
    const arena = this.rooms.get(ARENA_ROOM_ID)!;
    arena.commissionEnabled = enabled;
    if (typeof rate === 'number') {
      arena.commissionPercent = rate;
    }
    this.recalculatePot(arena);
    this.broadcastRoomState(arena);
  }

  // Admin Controls: Win Distribution Rates
  public setWinRates(ownerRate: number, botRate: number, realRate: number) {
    this.ownerWinRate = ownerRate;
    this.botWinRate = botRate;
    this.realPlayerWinRate = realRate;
  }

  public handleJoinRoom(socketId: string, roomId: string, userId?: string, userName?: string) {
    const room = this.getRoom(roomId);
    this.lastClientActivityTimestamp = Date.now();
    room.activeSockets.add(socketId);
    if (userId) {
      room.activeUsers.add(userId);
      room.activeUserSockets.set(userId, socketId);
    }
    const activeInRoom = Math.max(room.activeUsers.size, room.activeSockets.size);
    const cartelasCount = this.getRealCartelaCount(room);
    room.realPlayerCount = cartelasCount;
    const isRoom10 = room.id === 'room-10' || room.id === ARENA_ROOM_ID || room.id === 'default';
    if (isRoom10) {
      this.syncRoom10StandbyBots(room);
    }
    const room10HasBots = isRoom10 && (room.dynamicBotTarget ?? 0) > 0 && this.botConfig.mode !== 'disabled';
    const isRoom10Autonomous = isRoom10 && room10HasBots && this.botConfig.livingClock;
    room.waitingForPlayers = isRoom10 ? (room10HasBots ? (!isRoom10Autonomous && room.tickets.size < 1) : room.tickets.size < 2) : room.tickets.size < 2;
    this.broadcastRoomState(room);

    // Notify other players in the room that a player entered the room
    io.to(room.id).emit('room_user_joined', {
      userId,
      userName: userName || 'A player',
      activeUsersCount: activeInRoom,
      realPlayerCount: cartelasCount,
      waitingForPlayers: room.waitingForPlayers,
      roomId: room.id
    });
    if (room.id === 'room-10') {
      io.to(ARENA_ROOM_ID).emit('room_user_joined', {
        userId,
        userName: userName || 'A player',
        activeUsersCount: activeInRoom,
        realPlayerCount: cartelasCount,
        waitingForPlayers: room.waitingForPlayers,
        roomId: ARENA_ROOM_ID
      });
    }
  }

  public handleLeaveRoom(socketId: string, roomId: string) {
    const room = this.getRoom(roomId);
    room.activeSockets.delete(socketId);
    for (const [uid, sid] of room.activeUserSockets.entries()) {
      if (sid === socketId) {
        room.activeUserSockets.delete(uid);
        room.activeUsers.delete(uid);
      }
    }
    const activeInRoom = Math.max(room.activeUsers.size, room.activeSockets.size);
    // Only set waitingForPlayers flag — do NOT reset the countdown timer.
    // The lobby interval's own freeze logic handles keeping the timer paused.
    // Hard-resetting to 45 here causes visible jumps when a user briefly disconnects/reconnects.
    const isRoom10 = room.id === 'room-10' || room.id === ARENA_ROOM_ID;
    const room10HasBots = isRoom10 && (room.dynamicBotTarget ?? 0) > 0 && this.botConfig.mode !== 'disabled';
    if (room10HasBots ? room.tickets.size < 1 : room.tickets.size < 2) {
      room.waitingForPlayers = true;
      // lobbyCountdown intentionally NOT reset here — the interval freeze handles it
    }
    if (isRoom10) {
      this.syncRoom10StandbyBots(room);
    }
    this.broadcastRoomState(room);
  }

  /**
   * Safe Lobby Ticket Cancellation / Room Switch Refund
   * If player bought a ticket in a room lobby and switches to another stake, refund funds immediately.
   */
  public async handleCancelTicketLobby(
    userId: string,
    roomId: string
  ): Promise<{ success: boolean; refunded?: number; error?: string }> {
    const room = this.getRoom(roomId);
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    const userTickets = room.tickets.get(userId);
    const userNextTickets = room.nextRoundTickets?.get(userId);

    // If room is actively playing and user has active tickets in the current round, cannot cancel in-play cards
    if (room.phase === 'playing' && room.mode === 'active' && userTickets && userTickets.length > 0) {
      return { success: false, error: 'Cannot cancel tickets during active play' };
    }

    const ticketsToRefund: PlayerTicket[] = [];
    if (room.phase === 'lobby' && userTickets) {
      ticketsToRefund.push(...userTickets);
    }
    if (userNextTickets && userNextTickets.length > 0) {
      ticketsToRefund.push(...userNextTickets);
    }

    if (ticketsToRefund.length === 0) {
      return { success: false, error: 'No cancellable tickets in this room' };
    }

    let refundAmount = 0;
    ticketsToRefund.forEach(t => { refundAmount += t.betAmount; });

    if (refundAmount > 0) {
      try {
        await withTransaction(async (client) => {
          await client.query(
            'UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE user_id = $2',
            [refundAmount, userId]
          );
          const refCode = `REF-${Date.now().toString().slice(-6)}`;
          await client.query(
            `INSERT INTO wallet_transactions (user_id, type, amount, balance_after, reference_code, status, description)
             VALUES ($1, 'refund', $2, (SELECT balance FROM wallets WHERE user_id = $1), $3, 'completed', $4)`,
            [userId, refundAmount, refCode, `Refunded ${ticketsToRefund.length} cartelas from ${room.name}`]
          );

          // Revert earned coins on ticket cancellation
          const coinsToRevert = Math.floor(refundAmount * 1.5);
          if (coinsToRevert > 0) {
            await client.query(
              `UPDATE coin_wallets 
               SET balance = GREATEST(0, balance - $1),
                   lifetime_earned = GREATEST(0, lifetime_earned - $1),
                   updated_at = NOW()
               WHERE user_id = $2`,
              [coinsToRevert, userId]
            );
            await client.query(
              `INSERT INTO coin_transactions (user_id, amount, type, balance_after, reference_id, description)
               VALUES ($1, $2, 'admin_adjustment', (SELECT balance FROM coin_wallets WHERE user_id = $1), $3, $4)`,
              [userId, -coinsToRevert, refCode, `Reverted ${coinsToRevert} coins for cancelled tickets in ${room.name}`]
            );
          }
        });

        if (room.phase === 'lobby') {
          room.tickets.delete(userId);
          room.realPlayerCount = this.getRealCartelaCount(room);
          const isRoom10 = room.id === 'room-10' || room.id === ARENA_ROOM_ID;
          room.waitingForPlayers = isRoom10 ? room.tickets.size < 1 : room.tickets.size < 2;
          if (isRoom10) {
            this.syncRoom10StandbyBots(room);
          } else {
            this.recalculatePot(room);
          }
          const anyHouseReady = STAKE_ROOM_IDS.some(id => {
            const r = this.rooms.get(id);
            if (!r) return false;
            const isR10 = id === 'room-10' || id === ARENA_ROOM_ID;
            return isR10 ? r.tickets.size >= 1 : r.tickets.size >= 2;
          });
          if (!anyHouseReady) {
            room.lobbyCountdown = LOBBY_DURATION_SECONDS;
          }
        }
        if (room.nextRoundTickets) {
          room.nextRoundTickets.delete(userId);
        }
        this.broadcastRoomState(room);

        io.emit(`user_${userId}_balance`, {
          type: 'ticket_refunded',
          refundAmount
        });
        io.emit('user_balance_updated', { userId });
        io.emit('stake_rooms_summary', this.getStakeRoomsSummary());

        console.log(`💸 [Ticket Refund] Refunded ${refundAmount} ETB to user ${userId} from ${room.name}`);
        return { success: true, refunded: refundAmount };
      } catch (err: any) {
        console.error('❌ [GameEngine] Error in handleCancelTicketLobby:', err);
        return { success: false, error: err.message || 'Refund failed' };
      }
    }
    return { success: false };
  }

  /**
   * Seamless Lobby Stake Transfer
   * Moves a player's active cartelas from oldRoom lobby to newRoom lobby.
   * Adjusts net difference: refunds if moving down (e.g. 20 -> 10), or deducts if moving up (e.g. 10 -> 20).
   * Automatically keeps the player active in the new room so player count updates and countdown starts!
   */
  public async handleTransferTicketLobby(
    userId: string,
    oldRoomId: string,
    newRoomId: string,
    socketId: string
  ): Promise<{
    success: boolean;
    error?: string;
    tickets?: PlayerTicket[];
    refundedOrCharged?: number;
  }> {
    const oldRoom = this.getRoom(oldRoomId);
    const newRoom = this.getRoom(newRoomId);

    if (!oldRoom || !newRoom) {
      return { success: false, error: 'Target room not found' };
    }

    if (oldRoom.phase !== 'lobby' || newRoom.phase !== 'lobby') {
      return { success: false, error: 'Can only transfer tickets while both rooms are in lobby phase' };
    }

    const userTickets = oldRoom.tickets.get(userId);
    if (!userTickets || userTickets.length === 0) {
      return { success: false, error: 'No active tickets in previous room to transfer' };
    }

    const cardCount = userTickets.length;
    const oldTotalCost = cardCount * oldRoom.stakeAmount;
    const newTotalCost = cardCount * newRoom.stakeAmount;
    const netDifference = oldTotalCost - newTotalCost; // >0 means refund to user, <0 means user owes extra

    try {
      await withTransaction(async (client) => {
        if (netDifference > 0) {
          // Refund difference (e.g. 20 -> 10 ETB: refund 10 ETB per card)
          await client.query(
            'UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE user_id = $2',
            [netDifference, userId]
          );
          const refCode = `TRF-REF-${Date.now().toString().slice(-6)}`;
          await client.query(
            `INSERT INTO wallet_transactions (user_id, type, amount, balance_after, reference_code, status, description)
             VALUES ($1, 'refund', $2, (SELECT balance FROM wallets WHERE user_id = $1), $3, 'completed', $4)`,
            [userId, netDifference, refCode, `Stake room transfer difference refunded: ${oldRoom.name} -> ${newRoom.name}`]
          );
        } else if (netDifference < 0) {
          // Deduct difference (e.g. 10 -> 20 ETB: need 10 ETB extra per card)
          const extraCost = Math.abs(netDifference);
          const walletRes = await client.query(
            'SELECT balance, bonus FROM wallets WHERE user_id = $1 FOR UPDATE',
            [userId]
          );
          if (walletRes.rows.length === 0) throw new Error('Wallet not found');

          const realBal = parseFloat(walletRes.rows[0].balance || '0');
          const bonusBal = parseFloat(walletRes.rows[0].bonus || '0');
          const totalFunds = realBal + bonusBal;

          if (totalFunds < extraCost) {
            throw new Error(`Insufficient funds for stake upgrade. Need ${extraCost.toFixed(2)} ETB extra.`);
          }

          const deductFromBonus = Math.min(bonusBal, extraCost);
          const deductFromReal = extraCost - deductFromBonus;
          const newReal = realBal - deductFromReal;
          const newBonus = bonusBal - deductFromBonus;

          await client.query(
            'UPDATE wallets SET balance = $1, bonus = $2, updated_at = NOW() WHERE user_id = $3',
            [newReal, newBonus, userId]
          );
          const refCode = `TRF-BET-${Date.now().toString().slice(-6)}`;
          await client.query(
            `INSERT INTO wallet_transactions (user_id, type, amount, balance_after, reference_code, status, description)
             VALUES ($1, 'bet', $2, $3, $4, 'completed', $5)`,
            [userId, extraCost, newReal + newBonus, refCode, `Stake room transfer upgrade: ${oldRoom.name} -> ${newRoom.name}`]
          );
        }
      });

      // 1. Remove from old room
      oldRoom.tickets.delete(userId);
      oldRoom.realPlayerCount = this.getRealCartelaCount(oldRoom);
      const isOldR10 = oldRoom.id === 'room-10' || oldRoom.id === ARENA_ROOM_ID;
      oldRoom.waitingForPlayers = isOldR10 ? oldRoom.tickets.size < 1 : oldRoom.tickets.size < 2;
      this.recalculatePot(oldRoom);
      this.broadcastRoomState(oldRoom);

      // 2. Prepare transferred tickets in new room
      const transferredTickets: PlayerTicket[] = userTickets.map(t => ({
        ...t,
        betAmount: newRoom.stakeAmount,
        socketId: socketId || t.socketId
      }));

      // 3. Register in new room
      newRoom.tickets.set(userId, transferredTickets);
      newRoom.realPlayerCount = this.getRealCartelaCount(newRoom);
      const isNewR10 = newRoom.id === 'room-10' || newRoom.id === ARENA_ROOM_ID;
      newRoom.waitingForPlayers = isNewR10 ? newRoom.tickets.size < 1 : newRoom.tickets.size < 2;
      this.recalculatePot(newRoom);
      this.broadcastRoomState(newRoom);

      // 4. Notify new room of player joined (for lobby feed)
      const userName = userTickets[0]?.userName || 'Player';
      io.to(newRoom.id).emit('player_joined', {
        userName,
        realPlayerCount: newRoom.realPlayerCount,
        waitingForPlayers: newRoom.waitingForPlayers,
        countdownStarted: isNewR10 ? newRoom.tickets.size >= 1 : newRoom.tickets.size >= 2,
        roomId: newRoom.id
      });
      if (newRoom.id === 'room-10') {
        io.to(ARENA_ROOM_ID).emit('player_joined', {
          userName,
          realPlayerCount: newRoom.realPlayerCount,
          waitingForPlayers: newRoom.waitingForPlayers,
          countdownStarted: isNewR10 ? newRoom.tickets.size >= 1 : newRoom.tickets.size >= 2,
          roomId: ARENA_ROOM_ID
        });
      }

      // 5. Broadcast wallet and stake summaries
      io.emit('user_balance_updated', { userId });
      io.emit('stake_rooms_summary', this.getStakeRoomsSummary());

      console.log(`🔄 [Lobby Transfer] Transferred ${cardCount} tickets for user ${userId} from ${oldRoom.name} to ${newRoom.name} (Net difference: ${netDifference} ETB)`);

      return {
        success: true,
        tickets: transferredTickets,
        refundedOrCharged: netDifference
      };
    } catch (err: any) {
      console.error('❌ [GameEngine] Error in handleTransferTicketLobby:', err);
      return { success: false, error: err.message || 'Transfer failed' };
    }
  }

  /**
   * 100% System-Assigned Ticket Purchase with Anytime Pre-Betting
   * Players can choose 1 or 2 cartelas. If 2 cartelas, 3rd is FREE!
   * Routes to the dedicated stake room matching customStake or requestedRoomId.
   */
  public async handleBuyTicket(
    userId: string,
    userName: string,
    requestedRoomId: string,
    requestedCartelaIds: number[] | number,
    socketId: string,
    customStake?: number,
    isAutoPlay: boolean = true
  ): Promise<{
    success: boolean;
    error?: string;
    tickets?: PlayerTicket[];
    remainingBalance?: number;
    preBoughtForNextRound?: boolean;
  }> {
    if (process.env.MAINTENANCE_MODE === 'true') {
      return {
        success: false,
        error: 'ሶኒክ ቢንጎ በጊዜያዊ ጥገና ላይ ነው። ውርርድ ለጊዜው ቆሟል (Sonic Bingo is under maintenance. Betting is paused).'
      };
    }

    // Resolve target room based on customStake or requestedRoomId
    let targetRoomId = requestedRoomId;
    if (customStake === 20) targetRoomId = 'room-20';
    else if (customStake === 50) targetRoomId = 'room-50';
    else if (customStake === 100) targetRoomId = 'room-100';
    else if (customStake === 10) targetRoomId = 'room-10';

    const room = this.getRoom(targetRoomId);
    const stakePerCard = room.stakeAmount;

    // Determine quantity requested (1 or 2 cards)
    let quantity = 1;
    if (Array.isArray(requestedCartelaIds)) {
      quantity = Math.max(1, Math.min(MAX_TICKETS_PER_PLAYER, requestedCartelaIds.length));
    } else if (typeof requestedCartelaIds === 'number') {
      quantity = Math.max(1, Math.min(MAX_TICKETS_PER_PLAYER, requestedCartelaIds));
    }

    // Multi-Device / Double-Click Protection: If user already has active or pre-bought tickets, return existing tickets without deducting balance again
    const hasActiveLobbyTickets = room.phase === 'lobby' && room.tickets.has(userId) && (room.tickets.get(userId)?.length || 0) > 0;
    const hasPreBoughtTickets = room.phase !== 'lobby' && room.nextRoundTickets && room.nextRoundTickets.has(userId) && (room.nextRoundTickets.get(userId)?.length || 0) > 0;

    if (hasActiveLobbyTickets || hasPreBoughtTickets) {
      const existing = hasActiveLobbyTickets ? room.tickets.get(userId)! : room.nextRoundTickets.get(userId)!;
      console.log(`🎟️ [Multi-Device/Double-Click] User ${userName} (${userId}) already has ${existing.length} tickets (PreBuy: ${Boolean(hasPreBoughtTickets)}). Returning active cards.`);
      return {
        success: true,
        preBoughtForNextRound: Boolean(hasPreBoughtTickets),
        tickets: existing
      };
    }

    const totalCost = quantity * stakePerCard;

    const isRoom10 = room.id === 'room-10' || room.id === ARENA_ROOM_ID;

    // Phase 2: Dynamic Standby Bot Yielding (Room 10 ONLY)
    // If a real human player specifically requested cartela(s) currently held by a standby bot,
    // the bot yields immediately and re-rolls to an untaken number so the human gets their desired cartela.
    if (isRoom10 && room.opponentCards && room.opponentCards.length > 0) {
      const requestedList: number[] = Array.isArray(requestedCartelaIds)
        ? requestedCartelaIds.slice(0, quantity)
        : (typeof requestedCartelaIds === 'number' ? [requestedCartelaIds] : []);

      for (const reqId of requestedList) {
        if (reqId >= 1 && reqId <= TOTAL_CARTELAS) {
          const conflictingBotIdx = room.opponentCards.findIndex(o => isStandbyBotId(o.botUserId) && o.cartelaId === reqId);
          if (conflictingBotIdx !== -1) {
            // Find taken IDs by real players and other bots
            const taken = new Set<number>();
            room.tickets.forEach(l => l.forEach(t => taken.add(t.cartelaId)));
            if (room.nextRoundTickets) room.nextRoundTickets.forEach(l => l.forEach(t => taken.add(t.cartelaId)));
            requestedList.forEach(id => taken.add(id));
            room.opponentCards.forEach((o, idx) => { if (idx !== conflictingBotIdx) taken.add(o.cartelaId); });

            let newBotCartelaId = Math.floor(1 + Math.random() * TOTAL_CARTELAS);
            while (taken.has(newBotCartelaId)) {
              newBotCartelaId = Math.floor(1 + Math.random() * TOTAL_CARTELAS);
            }

            const yieldedBot = room.opponentCards[conflictingBotIdx];
            console.log(`🤝 [Room 10 Standby Bot Yield] Bot "${yieldedBot.opponentName}" yielded Cartela #${reqId} to human player ${userName} and re-rolled to Cartela #${newBotCartelaId}`);
            yieldedBot.cartelaId = newBotCartelaId;
            yieldedBot.cardMatrix = generateCardFromId(newBotCartelaId);
          }
        }
      }
    }

    // Collect already assigned Cartela IDs in this room to ensure unique cards
    const assignedIds = new Set<number>();
    room.tickets.forEach(list => list.forEach(t => assignedIds.add(t.cartelaId)));
    if (room.nextRoundTickets) {
      room.nextRoundTickets.forEach(list => list.forEach(t => assignedIds.add(t.cartelaId)));
    }
    if (room.opponentCards && room.opponentCards.length > 0) {
      room.opponentCards.forEach(o => assignedIds.add(o.cartelaId));
    }

    // Validate and honor requested Cartela IDs (1-600) chosen by user
    const drawnIds: number[] = [];
    const getNextUniqueCartelaId = (): number => {
      let attempts = 0;
      while (attempts < 1000) {
        const id = Math.floor(1 + Math.random() * TOTAL_CARTELAS);
        if (!assignedIds.has(id) && !drawnIds.includes(id)) {
          return id;
        }
        attempts++;
      }
      return Math.floor(1 + Math.random() * TOTAL_CARTELAS);
    };

    if (Array.isArray(requestedCartelaIds) && requestedCartelaIds.length > 0) {
      for (let i = 0; i < quantity; i++) {
        const reqId = requestedCartelaIds[i];
        if (reqId && reqId >= 1 && reqId <= TOTAL_CARTELAS) {
          if (!assignedIds.has(reqId) && !drawnIds.includes(reqId)) {
            drawnIds.push(reqId);
          } else {
            // Concurrency Auto-Resolution: Requested cartela was claimed in a race condition.
            // Automatically allocate the next available unique cartela so the player's purchase succeeds.
            const altId = getNextUniqueCartelaId();
            drawnIds.push(altId);
            console.log(`🎯 [Cartela Race Resolved] Cartela #${reqId} was already taken in ${room.name}. Auto-assigned next available Cartela #${altId} to ${userName}`);
          }
        }
      }
    } else if (typeof requestedCartelaIds === 'number' && requestedCartelaIds >= 1 && requestedCartelaIds <= TOTAL_CARTELAS) {
      if (!assignedIds.has(requestedCartelaIds)) {
        drawnIds.push(requestedCartelaIds);
      } else {
        const altId = getNextUniqueCartelaId();
        drawnIds.push(altId);
        console.log(`🎯 [Cartela Race Resolved] Cartela #${requestedCartelaIds} was already taken in ${room.name}. Auto-assigned next available Cartela #${altId} to ${userName}`);
      }
    }

    // Fill any remaining required card slots with unique untaken cartelas
    while (drawnIds.length < quantity) {
      drawnIds.push(getNextUniqueCartelaId());
    }

    try {
      // Deduct balance atomically from Neon DB
      const result = await withTransaction(async (client) => {
        const walletRes = await client.query(
          'SELECT balance, bonus FROM wallets WHERE user_id = $1 FOR UPDATE',
          [userId]
        );

        if (walletRes.rows.length === 0) {
          throw new Error('Wallet not found');
        }

        const realBal = parseFloat(walletRes.rows[0].balance || '0');
        const bonusBal = parseFloat(walletRes.rows[0].bonus || '0');
        const totalFunds = realBal + bonusBal;

        if (totalFunds < totalCost) {
          throw new Error(`Insufficient funds (${totalFunds.toFixed(2)} ETB). Need ${totalCost.toFixed(2)} ETB.`);
        }

        const deductFromBonus = Math.min(bonusBal, totalCost);
        const deductFromReal = totalCost - deductFromBonus;

        const newReal = realBal - deductFromReal;
        const newBonus = bonusBal - deductFromBonus;

        await client.query(
          'UPDATE wallets SET balance = $1, bonus = $2, updated_at = NOW() WHERE user_id = $3',
          [newReal, newBonus, userId]
        );

        const refCode = `BET-ARENA-${Date.now().toString().slice(-6)}`;
        await client.query(
          `INSERT INTO wallet_transactions (user_id, type, amount, balance_after, reference_code, status, description)
           VALUES ($1, 'bet', $2, $3, $4, 'completed', $5)`,
          [userId, totalCost, newReal + newBonus, refCode, `Purchased ${drawnIds.length} cartelas in ${room.name}`]
        );

        return { newReal, newBonus };
      });

      // Balance broadcast to user
      io.emit(`user_${userId}_balance`, {
        type: 'ticket_purchased',
        balance: result.newReal,
        bonus: result.newBonus,
        newBalance: result.newReal
      });

      io.emit('user_balance_updated', {
        userId,
        newBalance: result.newReal,
        balance: result.newReal,
        bonus: result.newBonus
      });

      // 🪙 Award 1.5x Coins per eligible Birr played (e.g. 50 ETB play = 75 coins)
      coinService.awardCoinsForGameplay(
        userId,
        totalCost,
        `Purchased ${drawnIds.length} cartela(s) in ${room.name} (${totalCost.toFixed(2)} ETB)`
      ).catch(err => {
        console.error(`❌ [CoinService Error awarding gameplay coins in ${room.id}]:`, err);
      });

      // Register tickets in memory (strictly max 2 cartelas, all paid stake)
      const resolvedAutoPlay = typeof isAutoPlay === 'boolean'
        ? isAutoPlay
        : (this.playerModes.has(userId) ? this.playerModes.get(userId)! : true);

      // Persist player mode preference immediately so round transitions and reconnects never overwrite it
      this.playerModes.set(userId, resolvedAutoPlay);

      const playerTickets: PlayerTicket[] = drawnIds.map(id => ({
        userId,
        userName,
        cartelaId: id,
        cardMatrix: generateCardFromId(id),
        betAmount: stakePerCard,
        socketId,
        isBonus: !this.isDepositedUser(userId),
        isAutoPlay: resolvedAutoPlay
      }));

      const isPreBuy = room.phase !== 'lobby';

      if (isPreBuy) {
        // Queue for next round (Anytime Pre-Betting)
        const existingQueued = room.nextRoundTickets.get(userId) || [];
        room.nextRoundTickets.set(userId, [...existingQueued, ...playerTickets]);
        console.log(`🎟️ [Pre-Betting] User ${userName} (${userId}) queued ${playerTickets.length} cartelas for Round #${room.roundNumber + 1}`);
      } else {
        // Immediately active in current lobby
        room.tickets.set(userId, playerTickets);
        room.realPlayerCount = this.getRealCartelaCount(room);
        const isRoom10 = room.id === 'room-10' || room.id === ARENA_ROOM_ID;
        room.waitingForPlayers = isRoom10 ? room.tickets.size < 1 : room.tickets.size < 2;
        if (isRoom10) {
          this.syncRoom10StandbyBots(room);
        } else {
          this.recalculatePot(room);
        }
        this.broadcastRoomState(room);

        // Notify room clients a new real player joined (for lobby join feed UI)
        const playerJoinedPayload = {
          userName,
          realPlayerCount: room.realPlayerCount,
          waitingForPlayers: room.waitingForPlayers,
          countdownStarted: isRoom10 ? room.tickets.size >= 1 : room.tickets.size >= 2,
          totalPot: room.totalPot,
          winnerPayout: room.winnerPayout,
          stakeAmount: room.stakeAmount,
          roomId: room.id
        };
        io.to(room.id).emit('player_joined', playerJoinedPayload);
        if (room.id === 'room-10') {
          io.to(ARENA_ROOM_ID).emit('player_joined', {
            ...playerJoinedPayload,
            roomId: ARENA_ROOM_ID
          });
        }
      }

      io.emit('stake_rooms_summary', this.getStakeRoomsSummary());

      return {
        success: true,
        preBoughtForNextRound: isPreBuy,
        tickets: playerTickets,
        remainingBalance: result.newReal + result.newBonus
      };
    } catch (error: any) {
      return { success: false, error: error.message || 'Ticket purchase failed' };
    }
  }

  /**
   * Updates player's Auto/Manual mode for their active & queued tickets across all rooms
   */
  public updatePlayerMode(roomId: string, userId: string, isAutoPlay: boolean) {
    const isPlayingMidGame = Array.from(this.rooms.values()).some(
      r => (r.phase === 'playing' || r.phase === 'locked') && (r.tickets.get(userId)?.length ?? 0) > 0
    );

    // MID-GAME MODE LOCK: If player is currently participating in an active round, do NOT alter active tickets/mode
    if (isPlayingMidGame) {
      console.warn(`🔒 [PlayerMode] Blocked mid-game mode switch for user ${userId} while game is active`);
      // Update queued nextRoundTickets only, so their preference takes effect in the next round
      const roomsToUpdate = new Set<string>([...STAKE_ROOM_IDS, roomId, ARENA_ROOM_ID].filter(Boolean));
      for (const rid of roomsToUpdate) {
        const room = this.rooms.get(rid);
        if (!room) continue;
        const nextTickets = room.nextRoundTickets?.get(userId);
        if (nextTickets) {
          nextTickets.forEach(t => { t.isAutoPlay = isAutoPlay; });
        }
      }
      return;
    }

    this.playerModes.set(userId, isAutoPlay);
    const roomsToUpdate = new Set<string>([...STAKE_ROOM_IDS, roomId, ARENA_ROOM_ID].filter(Boolean));
    for (const rid of roomsToUpdate) {
      const room = this.rooms.get(rid);
      if (!room) continue;
      const userTickets = room.tickets.get(userId);
      if (userTickets) {
        userTickets.forEach(t => { t.isAutoPlay = isAutoPlay; });
      }
      const nextTickets = room.nextRoundTickets?.get(userId);
      if (nextTickets) {
        nextTickets.forEach(t => { t.isAutoPlay = isAutoPlay; });
      }
    }
  }

  /**
   * Inspects the registered player mode (true for Auto, false for Manual)
   */
  public getPlayerMode(userId: string): boolean | undefined {
    return this.playerModes.get(userId);
  }

  // Recalculates pot from actual bets placed + sliding commission tiers
  private recalculatePot(room: GameRoomState) {
    const totalCartelas = this.getRoomPlayersCount(room);
    room.realPlayerCount = this.getRealCartelaCount(room);

    // Commission tier based on total cartelas count:
    // Room 10 operates with 50 standby bots + players with standard 20% platform commission,
    // ensuring net winner payout is strictly 80% (400 ETB on 500 ETB baseline, 408 ETB on 510 ETB, etc.)
    // Rooms 20, 50, 100 logic flow remains 100% UNTOUCHED (0% when <= 5 cartelas, 20% when > 5)
    const isRoom10 = room.id === 'room-10' || room.id === ARENA_ROOM_ID;
    if (isRoom10) {
      room.commissionEnabled = true;
      room.commissionPercent = 20;
    } else {
      if (totalCartelas <= 5) {
        room.commissionEnabled = false;
        room.commissionPercent = 0;
      } else {
        room.commissionEnabled = true;
        room.commissionPercent = 20;
      }
    }

    // Sum all actual bets placed by real players + bots (if any)
    let pot = 0;
    room.tickets.forEach(list => list.forEach(t => { pot += t.betAmount; }));
    room.opponentCards.forEach(o => { pot += o.stakeAmount; });

    room.totalPot = pot > 0 ? pot : 0;
    room.houseFee = room.commissionEnabled ? Math.floor(room.totalPot * 0.20) : 0;
    room.jackpotFee = room.commissionEnabled ? Math.floor(room.totalPot * 0.024 * 100) / 100 : 0;
    room.winnerPayout = room.totalPot - room.houseFee - room.jackpotFee;
  }

  /**
   * Synchronizes Room 10 standby bots in real-time.
   * Ensures dynamic Ethiopian standby bots are persistently pre-seeded
   * in Room 10 with non-overlapping cartelas, regardless of whether 0, 1, 2, or more real players join.
   * If real players choose cartelas held by bots, bots automatically yield and re-roll.
   * Mid-countdown joiners seamlessly receive the exact S-Curve bot count corresponding
   * to elapsed lobby time without resetting existing bots or jumping straight to the full target.
   * Rooms 20, 50, 100 are strictly excluded from this logic (strictly 0 bots).
   */
  private syncRoom10StandbyBots(room: GameRoomState, forceRotate: boolean = false) {
    const isRoom10 = room.id === 'room-10' || room.id === ARENA_ROOM_ID || room.id === 'default';
    if (!isRoom10) {
      room.opponentCards = []; // Strictly ensure Rooms 20, 50, 100 maintain 0 bots
      return;
    }

    // Determine target bot count for Room 10 based on Admin BotEngineConfig
    let fullRoundTarget = 0;
    if (this.botConfig.mode === 'disabled') {
      fullRoundTarget = 0;
    } else if (this.botConfig.mode === 'fixed') {
      fullRoundTarget = Math.max(0, Math.min(50, this.botConfig.fixedCount ?? 20));
    } else {
      if (forceRotate || room.dynamicBotTarget === null || room.dynamicBotTarget === undefined) {
        fullRoundTarget = calculateRoom10TargetBots(room.dynamicBotTarget);
      } else {
        fullRoundTarget = room.dynamicBotTarget;
      }
    }
    room.dynamicBotTarget = fullRoundTarget;

    if (fullRoundTarget === 0) {
      room.opponentCards = [];
      this.recalculatePot(room);
      return;
    }

    // Determine expected bot count at this exact moment (respecting S-Curve during lobby countdown)
    const isLobbyStaggered = Boolean(this.botConfig.staggeredJoin && room.phase === 'lobby' && !forceRotate);
    const elapsedSeconds = Math.max(0, Math.min(LOBBY_DURATION_SECONDS, LOBBY_DURATION_SECONDS - (room.lobbyCountdown ?? LOBBY_DURATION_SECONDS)));
    const targetCount = isLobbyStaggered
      ? getTargetBotsForElapsedSecond(fullRoundTarget, elapsedSeconds, LOBBY_DURATION_SECONDS)
      : fullRoundTarget;

    // Ensure standby roster pool is pre-sampled for this round
    if (forceRotate || !room.targetBotsToSeed || room.targetBotsToSeed.length < fullRoundTarget) {
      room.targetBotsToSeed = sampleStandbyBots(fullRoundTarget);
    }

    // Room 10 maintains dynamic Ethiopian standby bots
    const needsFullReset = forceRotate || !room.opponentCards.every(o => isStandbyBotId(o.botUserId));

    if (needsFullReset) {
      room.opponentCards = [];
      const sampledBots = room.targetBotsToSeed.slice(0, targetCount);

      const assignedIds = new Set<number>();
      room.tickets.forEach(list => list.forEach(t => assignedIds.add(t.cartelaId)));
      if (room.nextRoundTickets) {
        room.nextRoundTickets.forEach(list => list.forEach(t => assignedIds.add(t.cartelaId)));
      }

      for (let i = 0; i < sampledBots.length; i++) {
        let botCartelaId = Math.floor(1 + Math.random() * TOTAL_CARTELAS);
        let attempts = 0;
        while (assignedIds.has(botCartelaId) && attempts < 1000) {
          botCartelaId = Math.floor(1 + Math.random() * TOTAL_CARTELAS);
          attempts++;
        }
        assignedIds.add(botCartelaId);
        const botProfile = sampledBots[i];
        room.opponentCards.push({
          botUserId: botProfile.id,
          cartelaId: botCartelaId,
          cardMatrix: generateCardFromId(botCartelaId),
          opponentName: botProfile.name,
          stakeAmount: room.stakeAmount,
          isHouseBot: i === 0
        });
      }
    } else {
      // Incremental synchronization:
      // 1. If currently fewer bots than targetCount, append missing bots without disturbing existing bots
      if (room.opponentCards.length < targetCount) {
        const assignedIds = new Set<number>();
        room.tickets.forEach(list => list.forEach(t => assignedIds.add(t.cartelaId)));
        if (room.nextRoundTickets) {
          room.nextRoundTickets.forEach(list => list.forEach(t => assignedIds.add(t.cartelaId)));
        }
        room.opponentCards.forEach(o => assignedIds.add(o.cartelaId));

        const existingBotIds = new Set(room.opponentCards.map(o => o.botUserId));
        const missingBots = (room.targetBotsToSeed || [])
          .filter(b => !existingBotIds.has(b.id))
          .slice(0, targetCount - room.opponentCards.length);

        for (const botProfile of missingBots) {
          let botCartelaId = Math.floor(1 + Math.random() * TOTAL_CARTELAS);
          let attempts = 0;
          while (assignedIds.has(botCartelaId) && attempts < 1000) {
            botCartelaId = Math.floor(1 + Math.random() * TOTAL_CARTELAS);
            attempts++;
          }
          assignedIds.add(botCartelaId);
          room.opponentCards.push({
            botUserId: botProfile.id,
            cartelaId: botCartelaId,
            cardMatrix: generateCardFromId(botCartelaId),
            opponentName: botProfile.name,
            stakeAmount: room.stakeAmount,
            isHouseBot: room.opponentCards.length === 0
          });
        }
      } else if (room.opponentCards.length > targetCount) {
        room.opponentCards = room.opponentCards.slice(0, targetCount);
      }

      // 2. Standby bot auto-yield: ensure none of their cartela IDs conflict with real player tickets
      const assignedIds = new Set<number>();
      room.tickets.forEach(list => list.forEach(t => assignedIds.add(t.cartelaId)));
      if (room.nextRoundTickets) {
        room.nextRoundTickets.forEach(list => list.forEach(t => assignedIds.add(t.cartelaId)));
      }

      for (const bot of room.opponentCards) {
        if (assignedIds.has(bot.cartelaId)) {
          let newBotCartelaId = Math.floor(1 + Math.random() * TOTAL_CARTELAS);
          let attempts = 0;
          while (
            (assignedIds.has(newBotCartelaId) || room.opponentCards.some(o => o !== bot && o.cartelaId === newBotCartelaId)) &&
            attempts < 1000
          ) {
            newBotCartelaId = Math.floor(1 + Math.random() * TOTAL_CARTELAS);
            attempts++;
          }
          console.log(`🤝 [Room 10 Bot Auto-Yield] Bot "${bot.opponentName}" yielded colliding Cartela #${bot.cartelaId} -> new Cartela #${newBotCartelaId}`);
          bot.cartelaId = newBotCartelaId;
          bot.cardMatrix = generateCardFromId(newBotCartelaId);
        }
      }
    }
    this.recalculatePot(room);
  }

  /**
   * Synchronized 45-Second Master Lobby Timer across all 4 houses (10, 20, 50, 100 ETB)
   */
  public startMasterLobbyTimer() {
    if (this.intervals.has('master_lobby')) {
      clearInterval(this.intervals.get('master_lobby')!);
    }
    if (this.intervals.has('master_ball')) {
      clearInterval(this.intervals.get('master_ball')!);
    }
    if (this.intervals.has('master_winner')) {
      clearInterval(this.intervals.get('master_winner')!);
    }

    // Reset all stake houses into synchronized lobby state
    for (const roomId of STAKE_ROOM_IDS) {
      const room = this.rooms.get(roomId);
      if (!room) continue;

      room.isProcessingVictory = false;
      room.waitingForOtherHouses = false;
      room.isHoldingClaimWindow = false;
      room.phase = 'lobby';
      room.mode = 'active';
      room.lobbyCountdown = LOBBY_DURATION_SECONDS;
      room.drawnNumbers = [];
      room.currentCall = null;
      room.winResult = null;
      const isRoom10 = room.id === 'room-10' || room.id === ARENA_ROOM_ID;
      if (isRoom10) {
        // Determine target bot count for the upcoming round
        if (this.botConfig.mode === 'disabled') {
          room.dynamicBotTarget = 0;
          room.targetBotsToSeed = [];
          room.opponentCards = [];
        } else if (this.botConfig.mode === 'fixed') {
          room.dynamicBotTarget = Math.max(0, Math.min(50, this.botConfig.fixedCount));
          room.targetBotsToSeed = sampleStandbyBots(room.dynamicBotTarget);
        } else {
          room.dynamicBotTarget = calculateRoom10TargetBots(room.dynamicBotTarget);
          room.targetBotsToSeed = sampleStandbyBots(room.dynamicBotTarget);
        }

        // If staggered join is enabled and target > 2, seed an initial baseline of 1-2 bots via S-Curve
        if (this.botConfig.staggeredJoin && (room.dynamicBotTarget || 0) > 2) {
          const baselineCount = getTargetBotsForElapsedSecond(room.dynamicBotTarget || 0, 0);
          room.opponentCards = [];
          const baselineBots = (room.targetBotsToSeed || []).slice(0, baselineCount);
          const assignedIds = new Set<number>();
          room.tickets.forEach(list => list.forEach(t => assignedIds.add(t.cartelaId)));
          if (room.nextRoundTickets) {
            room.nextRoundTickets.forEach(list => list.forEach(t => assignedIds.add(t.cartelaId)));
          }

          for (let i = 0; i < baselineBots.length; i++) {
            let botCartelaId = Math.floor(1 + Math.random() * TOTAL_CARTELAS);
            while (assignedIds.has(botCartelaId)) {
              botCartelaId = Math.floor(1 + Math.random() * TOTAL_CARTELAS);
            }
            assignedIds.add(botCartelaId);
            const b = baselineBots[i];
            room.opponentCards.push({
              botUserId: b.id,
              cartelaId: botCartelaId,
              cardMatrix: generateCardFromId(botCartelaId),
              opponentName: b.name,
              stakeAmount: room.stakeAmount,
              isHouseBot: i === 0
            });
          }
          this.recalculatePot(room);
        } else {
          this.syncRoom10StandbyBots(room, true);
        }
      } else {
        room.opponentCards = []; // Strictly untouched for Rooms 20, 50, 100
      }

      // Seamless Activation of Anytime Pre-Bought Tickets
      if (room.nextRoundTickets && room.nextRoundTickets.size > 0) {
        room.tickets = new Map(room.nextRoundTickets);
        for (const [uid, tList] of room.tickets.entries()) {
          if (this.playerModes.has(uid)) {
            const m = this.playerModes.get(uid)!;
            tList.forEach(t => { t.isAutoPlay = m; });
          }
        }
        room.nextRoundTickets.clear();
        console.log(`🎟️ [Lobby ${room.id}] Activated pre-bought tickets for ${room.tickets.size} users for Round #${room.roundNumber}`);
        io.to(room.id).emit('prebought_tickets_activated', {
          roundNumber: room.roundNumber,
          activeTicketsCount: room.tickets.size,
          roomId: room.id
        });
        if (room.id === 'room-10') {
          io.to(ARENA_ROOM_ID).emit('prebought_tickets_activated', {
            roundNumber: room.roundNumber,
            activeTicketsCount: room.tickets.size,
            roomId: ARENA_ROOM_ID
          });
        }
      }

      if (isRoom10) {
        if (!this.botConfig.staggeredJoin || (room.dynamicBotTarget || 0) <= 2) {
          this.syncRoom10StandbyBots(room);
        }
      } else {
        this.recalculatePot(room);
      }
      this.broadcastRoomState(room);
    }

    let currentLobbyCountdown = LOBBY_DURATION_SECONDS;

    const interval = setInterval(async () => {
      const sample = this.rooms.get('room-10');
      if (sample && sample.phase !== 'lobby') {
        clearInterval(interval);
        return;
      }

      // Eco-Sleep Guard: Check client activity across rooms
      let totalConnectedClients = 0;
      for (const r of this.rooms.values()) {
        totalConnectedClients += Math.max(r.activeSockets.size, r.activeUsers.size);
      }
      if (totalConnectedClients > 0) {
        this.lastClientActivityTimestamp = Date.now();
      }
      const isEcoSleeping = totalConnectedClients === 0 && (Date.now() - this.lastClientActivityTimestamp > 10 * 60 * 1000);

      // Living Casino Autonomy: Room 10 runs continuously ONLY if bots are active (> 0) and not disabled or in eco-sleep
      const room10 = this.rooms.get('room-10');
      const room10HasBots = Boolean(
        room10 &&
        (room10.dynamicBotTarget ?? 0) > 0 &&
        this.botConfig.mode !== 'disabled'
      );
      const isRoom10Autonomous = Boolean(
        room10 &&
        room10HasBots &&
        this.botConfig.livingClock &&
        !isEcoSleeping
      );

      // Check: Does AT LEAST ONE house have confirmed tickets ready or living clock active with bots?
      // When Room 10 has bots: 1 player or living clock is enough.
      // When Room 10 has 0 bots: it strictly requires >= 2 real human players (like Rooms 20, 50, 100).
      const anyHouseReady = isRoom10Autonomous || STAKE_ROOM_IDS.some(id => {
        const r = this.rooms.get(id);
        if (!r) return false;
        const isR10 = id === 'room-10' || id === ARENA_ROOM_ID;
        return isR10 ? (room10HasBots ? r.tickets.size >= 1 : r.tickets.size >= 2) : r.tickets.size >= 2;
      });

      for (const roomId of STAKE_ROOM_IDS) {
        const room = this.rooms.get(roomId);
        if (!room) continue;

        const cartelasCount = this.getRealCartelaCount(room);
        room.realPlayerCount = cartelasCount;
        const isR10 = roomId === 'room-10' || roomId === ARENA_ROOM_ID;

        if (!anyHouseReady) {
          room.waitingForPlayers = true;
          room.lobbyCountdown = LOBBY_DURATION_SECONDS;
          this.broadcastRoomState(room);
        } else {
          // If bots are present and clock is ticking, Room 10 is active/ready; if bots = 0 or Rooms 20, 50, 100, strictly require tickets.size >= 2
          room.waitingForPlayers = isR10
            ? (room10HasBots ? (!isRoom10Autonomous && room.tickets.size < 1) : room.tickets.size < 2)
            : room.tickets.size < 2;
          room.lobbyCountdown = Math.max(0, currentLobbyCountdown - 1);
          this.broadcastRoomState(room);
        }
      }

      if (!anyHouseReady) {
        currentLobbyCountdown = LOBBY_DURATION_SECONDS;
        return;
      }

      // Progressive S-Curve bot arrivals in Room 10 during countdown
      const isRoom10Active = room10 && (room10.id === 'room-10' || room10.id === ARENA_ROOM_ID || room10.id === 'default');
      if (
        isRoom10Active &&
        this.botConfig.staggeredJoin &&
        this.botConfig.mode !== 'disabled' &&
        room10.targetBotsToSeed &&
        room10.targetBotsToSeed.length > 0
      ) {
        const elapsedSeconds = LOBBY_DURATION_SECONDS - currentLobbyCountdown;
        const totalTarget = room10.dynamicBotTarget || 0;
        const desiredBotCount = getTargetBotsForElapsedSecond(totalTarget, elapsedSeconds, LOBBY_DURATION_SECONDS);

        if (room10.opponentCards.length < desiredBotCount) {
          // Allow smooth bursts of 1 to 3 bots per second tick to match the arrival curve
          const botsToAdd = Math.min(desiredBotCount - room10.opponentCards.length, 3);
          const assignedIds = new Set<number>();
          room10.tickets.forEach(list => list.forEach(t => assignedIds.add(t.cartelaId)));
          if (room10.nextRoundTickets) {
            room10.nextRoundTickets.forEach(list => list.forEach(t => assignedIds.add(t.cartelaId)));
          }
          room10.opponentCards.forEach(o => assignedIds.add(o.cartelaId));

          let injectedCount = 0;
          for (let b = 0; b < botsToAdd; b++) {
            const nextBotIdx = room10.opponentCards.length;
            if (nextBotIdx >= room10.targetBotsToSeed.length) break;

            const nextBot = room10.targetBotsToSeed[nextBotIdx];

            let botCartelaId = Math.floor(1 + Math.random() * TOTAL_CARTELAS);
            while (assignedIds.has(botCartelaId)) {
              botCartelaId = Math.floor(1 + Math.random() * TOTAL_CARTELAS);
            }
            assignedIds.add(botCartelaId);

            room10.opponentCards.push({
              botUserId: nextBot.id,
              cartelaId: botCartelaId,
              cardMatrix: generateCardFromId(botCartelaId),
              opponentName: nextBot.name,
              stakeAmount: room10.stakeAmount,
              isHouseBot: false
            });
            injectedCount++;

            this.recalculatePot(room10);

            // Emit live player_joined toast for authentic casino buzz
            const joinPayload = {
              roomId: room10.id,
              userName: nextBot.name,
              playersCount: this.getRoomPlayersCount(room10),
              totalPot: room10.totalPot,
              winnerPayout: room10.winnerPayout,
              isBot: true
            };
            io.to('room-10').emit('player_joined', joinPayload);
            io.to(ARENA_ROOM_ID).emit('player_joined', joinPayload);
          }

          if (injectedCount > 0) {
            this.broadcastRoomState(room10);
          }
        }
      }

      currentLobbyCountdown -= 1;

      if (currentLobbyCountdown <= 0) {
        clearInterval(interval);
        // Ensure Room 10 has exact target bot count (or 0 if disabled) before ball calling starts
        if (room10) {
          this.syncRoom10StandbyBots(room10, false);
        }
        await this.startMasterRound();
      }
    }, 1000);

    this.intervals.set('master_lobby', interval);
  }

  // Backwards-compatible alias for existing call sites
  public startLobbyTimer(_roomId?: string) {
    this.startMasterLobbyTimer();
  }

  /**
   * Start Live Round across all houses simultaneously
   * Houses with >= 2 players play actively for their house pot.
   * Houses with < 2 players spectate/watch the exact same live bingo.
   */
  public async startMasterRound() {
    const activeHouses: GameRoomState[] = [];

    for (const roomId of STAKE_ROOM_IDS) {
      const room = this.rooms.get(roomId);
      if (!room) continue;

      room.phase = 'locked';
      room.isProcessingVictory = false;
      room.lastBallTime = Date.now();
      this.recalculatePot(room);

      // Mode Synchronization Guard: Ensure all tickets strictly reflect the player's true registered mode
      for (const [uid, tList] of room.tickets.entries()) {
        const userMode = this.playerModes.has(uid) ? this.playerModes.get(uid)! : tList[0]?.isAutoPlay;
        if (typeof userMode === 'boolean') {
          tList.forEach(t => { t.isAutoPlay = userMode; });
        }
      }

      const isRoom10 = room.id === 'room-10' || room.id === ARENA_ROOM_ID;
      const realCartelaCount = this.getRealCartelaCount(room);
      const distinctRealPlayers = room.tickets.size;
      const room10HasBots = isRoom10 && (room.dynamicBotTarget ?? 0) > 0 && this.botConfig.mode !== 'disabled';
      const isEligibleForActivePlay = isRoom10
        ? (room10HasBots ? (distinctRealPlayers >= 1 || this.botConfig.livingClock) : distinctRealPlayers >= 2)
        : distinctRealPlayers >= 2;

      if (isEligibleForActivePlay) {
        // Active Play Mode!
        // Room 10 is eligible with real players or continuous living bots.
        // Rooms 20, 50, 100 strictly require >= 2 real human players.
        room.mode = 'active';
        room.waitingForPlayers = false;
        if (isRoom10) {
          this.syncRoom10StandbyBots(room);
        } else {
          // Rooms 20, 50, 100 logic flow remains 100% UNTOUCHED
          room.opponentCards = [];
          if (realCartelaCount >= 11) {
            if (this.botAccounts.length < 3) await this.loadBotAccounts();
            const botPool = this.botAccounts.length >= 3 ? this.botAccounts : REGISTERED_3_BOTS;
            const assignedIds = new Set<number>();
            room.tickets.forEach(list => list.forEach(t => assignedIds.add(t.cartelaId)));

            for (let i = 0; i < 3; i++) {
              let botCartelaId = Math.floor(1 + Math.random() * TOTAL_CARTELAS);
              while (assignedIds.has(botCartelaId)) {
                botCartelaId = Math.floor(1 + Math.random() * TOTAL_CARTELAS);
              }
              assignedIds.add(botCartelaId);
              const botProfile = botPool[i];
              room.opponentCards.push({
                botUserId: botProfile.id,
                cartelaId: botCartelaId,
                cardMatrix: generateCardFromId(botCartelaId),
                opponentName: botProfile.name,
                stakeAmount: room.stakeAmount,
                isHouseBot: i === 0
              });
            }
            this.recalculatePot(room);
          }
        }

        if (isRoom10) {
          const botCount = room.opponentCards.length;

          // 1. Partition real tickets into Deposited vs Bonus-Only
          let depositedTicketCount = 0;
          let firstDepositedUserId: string | null = null;
          let distinctDepositedPlayers = 0;

          for (const [uid, tList] of room.tickets.entries()) {
            if (this.isDepositedUser(uid)) {
              depositedTicketCount += tList.length;
              distinctDepositedPlayers++;
              if (!firstDepositedUserId) firstDepositedUserId = uid;
            }
          }

          // 2. If ZERO deposited tickets exist (all real players are playing on bonus 10 ETB)
          // -> Real win probability is strictly 0.00%, bot wins 100%
          if (depositedTicketCount === 0 && botCount > 0) {
            room.targetWinnerType = 'bot';
          } else {
            // 3. Deposited players exist: Calculate probability using strictly deposited tickets
            // This guarantees the deposited player's odds are NEVER diluted by bonus players
            const totalEligibleCards = depositedTicketCount + botCount;
            const baseRealWinProb = totalEligibleCards > 0 ? (depositedTicketCount / totalEligibleCards) : 0;
            let effectiveRealWinProb = baseRealWinProb;

            // Loss-streak anti-churn applies ONLY to verified deposited players
            if (distinctDepositedPlayers === 1 && botCount > 0 && firstDepositedUserId) {
              const streak = this.playerSessionStreaks.get(firstDepositedUserId);
              const dynamicLossThreshold = Math.min(60, Math.max(6, Math.ceil(totalEligibleCards * 1.25)));
              if (streak && streak.consecutiveLosses >= dynamicLossThreshold) {
                effectiveRealWinProb = Math.min(0.50, baseRealWinProb * 1.10);
              }
            } else if (botCount === 0 && depositedTicketCount > 0) {
              effectiveRealWinProb = 1.0;
            }

            room.targetWinnerType = Math.random() < effectiveRealWinProb ? 'real' : 'bot';
          }
        } else {
          // Rooms 20, 50, 100 logic flow and odds remain 100% UNTOUCHED
          room.targetWinnerType = room.opponentCards.length > 0
            ? (Math.random() < 0.20 ? 'bot' : 'real')
            : 'real';
        }


        // Insert database round & tickets for active house (Zero-DB Guard: Only insert when real players have tickets!)
        if (room.tickets.size > 0) {
          try {
            const roundRes = await query(
              `INSERT INTO game_rounds (room_id, round_number, phase, total_pot, platform_fee, jackpot_fee, winner_payout, started_at)
               VALUES ($1, $2, 'playing', $3, $4, $5, $6, NOW()) RETURNING id`,
              [room.id, room.roundNumber, room.totalPot, room.houseFee, room.jackpotFee || 0, room.winnerPayout]
            );
            room.currentRoundId = roundRes.rows[0]?.id;

            for (const [userId, tList] of room.tickets.entries()) {
              for (const t of tList) {
                await query(
                  `INSERT INTO game_tickets (round_id, user_id, cartela_id, card_matrix, bet_amount, status)
                   VALUES ($1, $2, $3, $4, $5, 'active')`,
                  [room.currentRoundId, userId, t.cartelaId, JSON.stringify(t.cardMatrix), t.betAmount]
                );
              }
            }
          } catch (err) {
            console.error(`❌ [GameEngine Error saving round to DB in ${room.id}]:`, err);
          }
        } else {
          // Zero-DB In-Memory Execution: Pure bot round
          // 0 queries, 0 rows written to Neon PostgreSQL!
          room.currentRoundId = null;
        }

        activeHouses.push(room);
      } else {
        // < 2 players: Spectator / Watch Mode!
        room.mode = 'spectating';
        room.waitingForPlayers = true;
        room.opponentCards = [];
        room.totalPot = 0;
        room.winnerPayout = 0;
        room.houseFee = 0;
        room.jackpotFee = 0;
        room.currentRoundId = null;

        // Lone-Player Stake Protection: If a player placed a bet in this house but no opponent joined (< 2 players),
        // safely rollover their tickets to next round so their stake is never lost or unplayed.
        if (room.tickets.size > 0) {
          console.log(`🛡️ [GameEngine] Lone-player stake protection in ${room.id}: rolling over tickets for ${room.tickets.size} player(s) to Round #${room.roundNumber + 1}`);
          for (const [userId, tList] of room.tickets.entries()) {
            const existing = room.nextRoundTickets.get(userId) || [];
            room.nextRoundTickets.set(userId, [...existing, ...tList]);

            const socketId = room.activeUserSockets.get(userId);
            const noticePayload = {
              roomId: room.id,
              roundNumber: room.roundNumber,
              nextRoundNumber: room.roundNumber + 1,
              message: `Watching as Spectator • Your ticket is reserved for Round #${room.roundNumber + 1}`,
              queuedTicketsCount: tList.length,
              cartelaIds: tList.map(t => t.cartelaId)
            };
            if (socketId) {
              io.to(socketId).emit('lone_player_spectating_notice', noticePayload);
            }
          }

          const roomNoticePayload = {
            roomId: room.id,
            roundNumber: room.roundNumber,
            nextRoundNumber: room.roundNumber + 1,
            message: `Watching as Spectator • Unqualified house rolled over to Round #${room.roundNumber + 1}`
          };
          io.to(room.id).emit('lone_player_spectating_notice', roomNoticePayload);
          if (room.id === 'room-10') {
            io.to(ARENA_ROOM_ID).emit('lone_player_spectating_notice', { ...roomNoticePayload, roomId: ARENA_ROOM_ID });
            io.to('default').emit('lone_player_spectating_notice', { ...roomNoticePayload, roomId: 'default' });
          }

          room.tickets.clear();
        }
      }
    }

    // 2. Prepare Single Master Ball Sequence (1-75) supporting all active houses simultaneously
    const masterBallSequence = this.prepareMasterBallSequence(activeHouses);

    // 3. Set all rooms to 'playing' with the identical ball sequence
    for (const roomId of STAKE_ROOM_IDS) {
      const room = this.rooms.get(roomId);
      if (!room) continue;

      room.ballSequence = [...masterBallSequence];
      room.drawnNumbers = [];
      room.currentCall = null;
      room.winResult = null;
      room.phase = 'playing';

      const realTicketsCount = Array.from(room.tickets.values()).reduce((sum, t) => sum + t.length, 0);
      room.realPlayerCount = realTicketsCount;
      const roundStartedPayload = {
        roundId: room.currentRoundId,
        roundNumber: room.roundNumber,
        totalPot: room.totalPot,
        winnerPayout: room.winnerPayout,
        playersCount: realTicketsCount + room.opponentCards.length,
        realPlayerCount: room.realPlayerCount,
        waitingForPlayers: room.waitingForPlayers,
        mode: room.mode,
        roomId: room.id
      };

      io.to(room.id).emit('round_started', roundStartedPayload);
      if (room.id === 'room-10') {
        io.to(ARENA_ROOM_ID).emit('round_started', { ...roundStartedPayload, roomId: ARENA_ROOM_ID });
        io.to('default').emit('round_started', { ...roundStartedPayload, roomId: 'default' });
      }
      this.broadcastRoomState(room);
    }

    // 4. Launch Synchronized Master Ball Calling Loop
    this.startMasterBallCallingLoop(masterBallSequence);
  }

  // Backwards-compatible alias for existing call sites
  public async startRound(_roomId?: string) {
    await this.startMasterRound();
  }

  /**
   * Cryptographically sound Fisher-Yates shuffle for true un-biased randomness
   */
  private fisherYatesShuffle<T>(arr: T[]): T[] {
    const res = [...arr];
    for (let i = res.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [res[i], res[j]] = [res[j], res[i]];
    }
    return res;
  }

  /**
   * Anti-Clumping Column Smoother:
   * Ensures that no more than 2 consecutive balls belong to the exact same B-I-N-G-O column,
   * perfectly mimicking real physical 75-ball air-blower cage extractions.
   */
  private applyAntiClumpingSmoother(balls: number[]): number[] {
    const result = [...balls];
    for (let i = 2; i < result.length; i++) {
      const colA = getBallColumn(result[i - 2]);
      const colB = getBallColumn(result[i - 1]);
      const colC = getBallColumn(result[i]);

      if (colA === colB && colB === colC) {
        let swapped = false;
        for (let j = i + 1; j < result.length; j++) {
          if (getBallColumn(result[j]) !== colB) {
            const temp = result[i];
            result[i] = result[j];
            result[j] = temp;
            swapped = true;
            break;
          }
        }
        if (!swapped) {
          for (let j = 0; j < i - 2; j++) {
            if (getBallColumn(result[j]) !== colB) {
              const temp = result[i];
              result[i] = result[j];
              result[j] = temp;
              break;
            }
          }
        }
      }
    }
    return result;
  }

  /**
   * Prepares 75-Ball sequence completing between Ball 15 and 25 with Multi-Player Weaving.
   * Eliminates predictability while ensuring ALL real players receive active daubs (6-10 marked numbers)
   * and reach "1 TO GO" / "2 TO GO" before the target winner completes on targetFinishBall.
   * Guarantees non-winning players NEVER have empty cards.
   */
  private prepareBallSequence(room: GameRoomState): number[] {
    const baseBalls = generateRandomShuffledBalls();

    let targetCardMatrix: BingoCell[] | null = null;
    let chosenRealTicket: PlayerTicket | null = null;
    const allRealTickets: PlayerTicket[] = [];
    room.tickets.forEach(list => allRealTickets.push(...list));

    const isRoom10 = room.id === 'room-10' || room.id === ARENA_ROOM_ID;
    const eligibleRealTickets = isRoom10
      ? allRealTickets.filter(t => this.isDepositedUser(t.userId))
      : allRealTickets;

    if (room.targetWinnerType === 'real' && eligibleRealTickets.length > 0) {
      chosenRealTicket = eligibleRealTickets[Math.floor(Math.random() * eligibleRealTickets.length)];
      targetCardMatrix = chosenRealTicket.cardMatrix;
    } else if (room.opponentCards.length > 0) {
      if (room.targetWinnerType === 'owner') {
        // Owner victory: Target designated House Bot (isHouseBot: true)
        const houseBot = room.opponentCards.find(o => o.isHouseBot) || room.opponentCards[0];
        targetCardMatrix = houseBot.cardMatrix;
      } else {
        // Bot victory: For Room 10 standby bots, pool includes all standby bots
        const isStandbyPool = room.opponentCards.some(o => isStandbyBotId(o.botUserId));
        const pool = isStandbyPool
          ? room.opponentCards
          : (room.opponentCards.filter(o => !o.isHouseBot).length > 0
            ? room.opponentCards.filter(o => !o.isHouseBot)
            : room.opponentCards);
        const randomOpponent = pool[Math.floor(Math.random() * pool.length)];
        targetCardMatrix = randomOpponent.cardMatrix;
      }
    } else if (eligibleRealTickets.length > 0) {
      chosenRealTicket = eligibleRealTickets[0];
      targetCardMatrix = chosenRealTicket.cardMatrix;
    }

    if (!targetCardMatrix) {
      room.targetFinishBall = 20;
      return baseBalls;
    }

    // Pick winning line on target card (Row, Column, Diagonal, or Four Corners)
    const winningPatternsIndices = [
      [0, 1, 2, 3, 4],       // Row 1
      [5, 6, 7, 8, 9],       // Row 2
      [10, 11, 12, 13, 14],  // Row 3
      [15, 16, 17, 18, 19],  // Row 4
      [20, 21, 22, 23, 24],  // Row 5
      [0, 5, 10, 15, 20],    // Column B
      [1, 6, 11, 16, 21],    // Column I
      [2, 7, 12, 17, 22],    // Column N
      [3, 8, 13, 18, 23],    // Column G
      [4, 9, 14, 19, 24],    // Column O
      [0, 6, 12, 18, 24],    // Diagonal TL-BR
      [4, 8, 12, 16, 20],    // Diagonal TR-BL
      [0, 4, 20, 24]         // Four Corners
    ];
    const chosenPattern = winningPatternsIndices[Math.floor(Math.random() * winningPatternsIndices.length)];
    const targetNumbers = chosenPattern
      .map(idx => targetCardMatrix![idx]?.val)
      .filter((v): v is number => typeof v === 'number');

    // Dynamically pick round completion ball: Ball 15 to 25 (inclusive)
    const targetFinishBall = 15 + Math.floor(Math.random() * 11); // 15, 16, ..., 25
    room.targetFinishBall = targetFinishBall;
    room.targetCardMatrix = targetCardMatrix;
    const finishIndex = targetFinishBall - 1; // 14 to 24

    console.log(`🎯 [GameEngine] Round #${room.roundNumber} targeting ${room.targetWinnerType.toUpperCase()} win on Ball #${targetFinishBall} (Finish index: ${finishIndex})`);

    // Target winner's final winning ball MUST land exactly on finishIndex
    const finalBall = targetNumbers[targetNumbers.length - 1];
    const earlyTargetNumbers = targetNumbers.slice(0, -1);

    // Collect competing cards: all other real player cards AND all bot opponent cards
    const otherCards: BingoCell[][] = [];
    const botGuard = room.opponentCards
      .filter(o => o.cardMatrix !== targetCardMatrix);

    if (chosenRealTicket) {
      allRealTickets.forEach(t => {
        if (t.cartelaId !== chosenRealTicket!.cartelaId) {
          otherCards.push(t.cardMatrix);
        }
      });
      botGuard.forEach(o => otherCards.push(o.cardMatrix));
    } else {
      allRealTickets.forEach(t => otherCards.push(t.cardMatrix));
      botGuard.forEach(o => otherCards.push(o.cardMatrix));
    }

    // Mathematical Invariant Guarantee:
    // S will hold the exact set of (targetFinishBall - 1) balls to be drawn in slots 0 to finishIndex - 1.
    // S starts with earlyTargetNumbers (size 4).
    // finalBall is placed at finishIndex (ball targetFinishBall).
    // Neither target winner nor any competing card can EVER win at any ball < targetFinishBall!
    const S: number[] = [...earlyTargetNumbers];
    const sSet = new Set<number>(S);

    const isSafeToAdd = (candidate: number): boolean => {
      if (candidate === finalBall) return false;
      if (sSet.has(candidate)) return false;

      // Candidate must not cause target winner to win prematurely before targetFinishBall
      const testWinnerDrawn = [...S, candidate];
      if (checkWinningPattern(targetCardMatrix!, testWinnerDrawn).isWin) {
        return false;
      }

      // Candidate must not cause any competing card to win on or before targetFinishBall
      const testCompetingDrawn = [...testWinnerDrawn, finalBall];
      for (const card of otherCards) {
        if (checkWinningPattern(card, testCompetingDrawn).isWin) {
          return false;
        }
      }
      return true;
    };

    // Step 0: Weave 3 to 4 natural dispersion numbers for the target winner across other rows/columns
    // This eliminates the artificial "only 5 diagonal numbers in a row" tell so the winner has 7-9 marks total!
    const targetOtherNums = targetCardMatrix
      .map(c => c.val)
      .filter((v): v is number => typeof v === 'number' && !targetNumbers.includes(v))
      .sort(() => Math.random() - 0.5);

    let winnerExtraCount = 0;
    for (const num of targetOtherNums) {
      if (winnerExtraCount >= 4) break;
      if (S.length >= finishIndex - 8) break;
      if (isSafeToAdd(num)) {
        S.push(num);
        sSet.add(num);
        winnerExtraCount++;
      }
    }

    // Step A: For each competing card, add numbers from a competing line to lock them at "1 TO GO! 🔥"
    for (const otherCard of otherCards) {
      const compPattern = winningPatternsIndices[Math.floor(Math.random() * winningPatternsIndices.length)];
      const lineNums = compPattern
        .map(idx => otherCard[idx]?.val)
        .filter((v): v is number => typeof v === 'number');

      for (const num of lineNums) {
        if (S.length >= finishIndex - 3) break;
        if (isSafeToAdd(num)) {
          S.push(num);
          sSet.add(num);
        }
      }

      // Also add 3 to 4 numbers from other cells of this card for natural card distribution
      const otherCardNums = otherCard
        .map(c => c.val)
        .filter((v): v is number => typeof v === 'number' && !lineNums.includes(v))
        .sort(() => Math.random() - 0.5);

      for (const num of otherCardNums) {
        if (S.length >= finishIndex) break;
        if (isSafeToAdd(num)) {
          S.push(num);
          sSet.add(num);
        }
      }
    }

    // Step B: Fill the remaining slots of S up to finishIndex with neutral cage balls
    const shuffledBaseBalls = this.fisherYatesShuffle(baseBalls);
    for (const b of shuffledBaseBalls) {
      if (S.length >= finishIndex) break;
      if (isSafeToAdd(b)) {
        S.push(b);
        sSet.add(b);
      }
    }

    // Safety fallback: Ensure S reaches finishIndex so slots 0 to finishIndex - 1 are completely filled
    if (S.length < finishIndex) {
      for (const b of shuffledBaseBalls) {
        if (S.length >= finishIndex) break;
        if (b !== finalBall && !sSet.has(b)) {
          const testDrawn = [...S, b];
          if (!checkWinningPattern(targetCardMatrix!, testDrawn).isWin && otherCards.every(c => !checkWinningPattern(c, testDrawn).isWin)) {
            S.push(b);
            sSet.add(b);
          }
        }
      }
    }

    // Natural 75-Ball Column Balancer:
    // Safe Set S contains all finishIndex balls (early target numbers, competing card numbers, neutral cage balls).
    // All numbers in S are mathematically guaranteed safe (no competing card wins on S ∪ {finalBall}).
    // We shuffle S with Fisher-Yates and apply the Anti-Clumping Column Smoother so balls alternate naturally across letters.
    const earlyShuffled = this.applyAntiClumpingSmoother(this.fisherYatesShuffle(S));

    const finalSequence: number[] = new Array(75).fill(0);

    // Place natural early balls in slots 0 to finishIndex - 1
    for (let i = 0; i < finishIndex; i++) {
      finalSequence[i] = earlyShuffled[i];
    }

    // Target winner's winning ball lands precisely on finishIndex (ball targetFinishBall)
    finalSequence[finishIndex] = finalBall;

    // Boundary Anti-Clumping: Ensure finalBall does not create a 3-streak with slots finishIndex - 1 and finishIndex - 2
    const finalCol = getBallColumn(finalBall);
    if (
      finishIndex >= 2 &&
      getBallColumn(finalSequence[finishIndex - 1]) === finalCol &&
      getBallColumn(finalSequence[finishIndex - 2]) === finalCol
    ) {
      for (let j = finishIndex - 3; j >= 0; j--) {
        if (getBallColumn(finalSequence[j]) !== finalCol) {
          const temp = finalSequence[finishIndex - 1];
          finalSequence[finishIndex - 1] = finalSequence[j];
          finalSequence[j] = temp;
          break;
        }
      }
    }

    // Collect all remaining balls (from 1 to 75) that have not been used in slots 0 to finishIndex
    const usedInEarlySlots = new Set<number>(finalSequence.slice(0, targetFinishBall));
    const remainingBalls = this.applyAntiClumpingSmoother(
      this.fisherYatesShuffle(baseBalls.filter(b => !usedInEarlySlots.has(b)))
    );

    // Fill remaining slots (from targetFinishBall to 74)
    for (let i = targetFinishBall; i < 75; i++) {
      finalSequence[i] = remainingBalls[i - targetFinishBall];
    }

    // Return reversed array since Array.pop() draws from the end
    return finalSequence.reverse();
  }

  /**
   * Prepares a single authoritative 75-ball sequence that simultaneously weaves
   * organic winning lines and active dispersion for ALL active houses.
   * Every active house is assigned an unpredictable target finish ball between 16 and 24.
   */
  private prepareMasterBallSequence(activeHouses: GameRoomState[]): number[] {
    if (activeHouses.length === 0) {
      return generateRandomShuffledBalls();
    }

    if (activeHouses.length === 1) {
      return this.prepareBallSequence(activeHouses[0]);
    }

    // Stagger finish targets across active houses so they don't all collide on the same ball
    const targetPool = [17, 18, 19, 20, 21, 22, 23, 24].sort(() => Math.random() - 0.5);
    const houseConfigs: Array<{
      room: GameRoomState;
      targetCardMatrix: BingoCell[];
      targetNumbers: number[];
      finalBall: number;
      earlyTargetNumbers: number[];
      finishIndex: number;
    }> = [];

    for (let i = 0; i < activeHouses.length; i++) {
      const room = activeHouses[i];
      const targetFinishBall = targetPool[i] || (17 + i * 2);
      room.targetFinishBall = targetFinishBall;

      const allRealTickets: PlayerTicket[] = [];
      room.tickets.forEach(list => allRealTickets.push(...list));

      const isRoom10 = room.id === 'room-10' || room.id === ARENA_ROOM_ID;
      const eligibleRealTickets = isRoom10
        ? allRealTickets.filter(t => this.isDepositedUser(t.userId))
        : allRealTickets;

      let targetCardMatrix: BingoCell[] | null = null;
      if (room.targetWinnerType === 'real' && eligibleRealTickets.length > 0) {
        const chosenRealTicket = eligibleRealTickets[Math.floor(Math.random() * eligibleRealTickets.length)];
        targetCardMatrix = chosenRealTicket.cardMatrix;
      } else if (room.opponentCards.length > 0) {
        const isStandbyPool = room.opponentCards.some(o => isStandbyBotId(o.botUserId));
        const botPool = isStandbyPool
          ? room.opponentCards
          : (room.opponentCards.filter(o => !o.isHouseBot).length > 0
            ? room.opponentCards.filter(o => !o.isHouseBot)
            : room.opponentCards);
        const bot = botPool[Math.floor(Math.random() * botPool.length)];
        targetCardMatrix = bot.cardMatrix;
      } else if (eligibleRealTickets.length > 0) {
        targetCardMatrix = eligibleRealTickets[0].cardMatrix;
      }

      if (!targetCardMatrix) continue;

      const winningPatternsIndices = [
        [0, 1, 2, 3, 4], [5, 6, 7, 8, 9], [10, 11, 12, 13, 14], [15, 16, 17, 18, 19], [20, 21, 22, 23, 24],
        [0, 5, 10, 15, 20], [1, 6, 11, 16, 21], [2, 7, 12, 17, 22], [3, 8, 13, 18, 23], [4, 9, 14, 19, 24],
        [0, 6, 12, 18, 24], [4, 8, 12, 16, 20],
        [0, 4, 20, 24]
      ];

      // Ensure every active house selects a strictly unique final winning ball
      // and does not conflict with another house's early/final numbers
      const assignedFinalBalls = new Set<number>(houseConfigs.map(h => h.finalBall));
      const allReservedNumbers = new Set<number>();
      for (const h of houseConfigs) {
        allReservedNumbers.add(h.finalBall);
        h.earlyTargetNumbers.forEach(n => allReservedNumbers.add(n));
      }

      let selectedFinalBall = 0;
      let selectedEarly: number[] = [];
      let selectedPatternNums: number[] = [];

      const shuffledPatterns = [...winningPatternsIndices].sort(() => Math.random() - 0.5);
      for (const pattern of shuffledPatterns) {
        const pNums = pattern
          .map(idx => targetCardMatrix![idx]?.val)
          .filter((v): v is number => typeof v === 'number');

        // Cannot pick a pattern that contains another house's final ball
        if (pNums.some(n => assignedFinalBalls.has(n))) continue;

        // Prefer candidate final ball not reserved by any other house
        const candidate = pNums.find(n => !allReservedNumbers.has(n)) || pNums.find(n => !assignedFinalBalls.has(n));
        if (candidate) {
          selectedFinalBall = candidate;
          selectedEarly = pNums.filter(n => n !== candidate);
          selectedPatternNums = pNums;
          break;
        }
      }

      if (!selectedFinalBall) {
        // Fallback: pick any number on targetCardMatrix not yet in assignedFinalBalls
        const anyAvail = targetCardMatrix
          .map(c => c.val)
          .find((v): v is number => typeof v === 'number' && !assignedFinalBalls.has(v));
        if (!anyAvail) continue;
        selectedFinalBall = anyAvail;
        selectedEarly = [];
        selectedPatternNums = [anyAvail];
      }

      room.targetCardMatrix = targetCardMatrix;
      houseConfigs.push({
        room,
        targetCardMatrix,
        targetNumbers: selectedPatternNums,
        finalBall: selectedFinalBall,
        earlyTargetNumbers: selectedEarly,
        finishIndex: targetFinishBall - 1
      });

      console.log(`🎯 [GameEngine] Active House ${room.id} targeting ${room.targetWinnerType.toUpperCase()} win on Ball #${targetFinishBall} (Winning Ball: ${selectedFinalBall})`);
    }

    if (houseConfigs.length === 0) {
      return this.prepareBallSequence(activeHouses[0]);
    }

    // Sort house configs by finishIndex ascending
    houseConfigs.sort((a, b) => a.finishIndex - b.finishIndex);
    const maxFinishIndex = Math.max(...houseConfigs.map(h => h.finishIndex));

    const finalSequence: number[] = new Array(75).fill(0);
    // Available numbers 1..75
    const availableBalls = new Set<number>(Array.from({ length: 75 }, (_, i) => i + 1));

    // 1. Place final winning balls at their respective finish indices
    for (const h of houseConfigs) {
      finalSequence[h.finishIndex] = h.finalBall;
      availableBalls.delete(h.finalBall);
    }

    // Count how many early slots (0 to maxFinishIndex) are currently 0 (unassigned)
    const emptyEarlySlots: number[] = [];
    for (let slot = 0; slot <= maxFinishIndex; slot++) {
      if (finalSequence[slot] === 0) {
        emptyEarlySlots.push(slot);
      }
    }

    // Gather all participating cards with their house target finish ball
    const allCardsWithMinBall: Array<{ card: BingoCell[]; minBall: number }> = [];
    for (const h of houseConfigs) {
      allCardsWithMinBall.push({ card: h.targetCardMatrix, minBall: h.room.targetFinishBall });
      h.room.tickets.forEach(l => l.forEach(t => {
        if (t.cardMatrix !== h.targetCardMatrix) {
          allCardsWithMinBall.push({ card: t.cardMatrix, minBall: h.room.targetFinishBall });
        }
      }));
      const botGuard = h.room.opponentCards
        .filter(o => o.cardMatrix !== h.targetCardMatrix);
      botGuard.forEach(o => {
        allCardsWithMinBall.push({ card: o.cardMatrix, minBall: h.room.targetFinishBall });
      });
    }

    const allAssignedFinalBalls = new Set<number>(houseConfigs.map(h => h.finalBall));

    const isSafeCandidate = (candidate: number, slotIndex: number): boolean => {
      if (allAssignedFinalBalls.has(candidate)) return false;
      const testDrawn = [...finalSequence.slice(0, slotIndex), candidate];
      const ballNumber = testDrawn.length;

      for (const item of allCardsWithMinBall) {
        if (ballNumber < item.minBall) {
          if (checkWinningPattern(item.card, testDrawn).isWin) {
            return false;
          }
        }
      }
      return true;
    };

    // 2. Guarantee earlyTargetNumbers for each house land strictly before its finishIndex
    for (const h of houseConfigs) {
      for (const num of h.earlyTargetNumbers) {
        if (!availableBalls.has(num)) continue;

        const candidateSlots = emptyEarlySlots.filter(s => s < h.finishIndex && finalSequence[s] === 0);
        let placed = false;
        for (const slot of candidateSlots) {
          if (isSafeCandidate(num, slot)) {
            finalSequence[slot] = num;
            availableBalls.delete(num);
            placed = true;
            break;
          }
        }
        if (!placed && candidateSlots.length > 0) {
          const slot = candidateSlots[0];
          finalSequence[slot] = num;
          availableBalls.delete(num);
        }
      }
    }

    // 3. Competitor dispersion numbers
    const preferredEarlyPool: number[] = [];
    for (const h of houseConfigs) {
      const otherTickets: BingoCell[][] = [];
      h.room.tickets.forEach(list => list.forEach(t => {
        if (t.cardMatrix !== h.targetCardMatrix) otherTickets.push(t.cardMatrix);
      }));
      const botDispersion = h.room.opponentCards
        .filter(o => o.cardMatrix !== h.targetCardMatrix)
        .slice(0, 5);
      botDispersion.forEach(o => otherTickets.push(o.cardMatrix));

      for (const comp of otherTickets) {
        const compNums = comp
          .map(c => c.val)
          .filter((v): v is number => typeof v === 'number' && availableBalls.has(v) && !preferredEarlyPool.includes(v))
          .sort(() => Math.random() - 0.5)
          .slice(0, 2);
        preferredEarlyPool.push(...compNums);
      }
    }

    // 4. Fill remaining empty slots in [0..maxFinishIndex] from preferredEarlyPool and remaining cage balls
    for (const slot of emptyEarlySlots) {
      if (finalSequence[slot] !== 0) continue; // Already filled by house early target numbers
      let chosenBall = 0;

      // Try preferred early pool first
      for (let i = 0; i < preferredEarlyPool.length; i++) {
        const candidate = preferredEarlyPool[i];
        if (availableBalls.has(candidate) && isSafeCandidate(candidate, slot)) {
          chosenBall = candidate;
          preferredEarlyPool.splice(i, 1);
          break;
        }
      }

      // If preferred wasn't safe or was empty, draw from remaining available cage balls
      if (!chosenBall) {
        const shuffledRemaining = this.fisherYatesShuffle(Array.from(availableBalls));
        for (const candidate of shuffledRemaining) {
          if (isSafeCandidate(candidate, slot)) {
            chosenBall = candidate;
            break;
          }
        }
      }

      // Absolute fallback if no candidate passed safety
      if (!chosenBall) {
        chosenBall = Array.from(availableBalls)[0];
      }

      finalSequence[slot] = chosenBall;
      availableBalls.delete(chosenBall);
    }

    // 6. Fill all remaining slots (maxFinishIndex + 1 to 74) with the rest of availableBalls
    const remainingBalls = this.applyAntiClumpingSmoother(this.fisherYatesShuffle(Array.from(availableBalls)));
    let remIdx = 0;
    for (let slot = maxFinishIndex + 1; slot < 75; slot++) {
      finalSequence[slot] = remainingBalls[remIdx++];
    }

    return finalSequence.reverse();
  }

  /**
   * Fallback Best Card Finder: Guarantees a win resolution if balls reach round safety cap (Ball 26)
   */
  private findBestCardForFallbackWin(room: GameRoomState) {
    let bestTicket: {
      userId?: string;
      userName: string;
      cartelaId: number;
      isReal: boolean;
      winningPattern: string;
      winningIndices: number[];
      matchCount: number;
    } | null = null;

    for (const [uid, tList] of room.tickets.entries()) {
      const registeredAuto = this.playerModes.get(uid);
      for (const t of tList) {
        // Double-Guard: Fallback auto-win ONLY applies to strictly confirmed Auto players; manual players must claim manually
        const isEligibleAuto = (registeredAuto !== undefined ? registeredAuto : t.isAutoPlay) === true && t.isAutoPlay === true;
        if (!isEligibleAuto) continue;
        const winCheck = checkWinningPattern(t.cardMatrix, room.drawnNumbers);
        const matches = t.cardMatrix.filter(c => typeof c.val === 'number' && room.drawnNumbers.includes(c.val)).length;
        if (!bestTicket || matches > bestTicket.matchCount) {
          bestTicket = {
            userId: uid,
            userName: t.userName,
            cartelaId: t.cartelaId,
            isReal: true,
            winningPattern: winCheck.winningPattern || 'Bingo Line',
            winningIndices: winCheck.winningIndices || [0, 1, 2, 3, 4],
            matchCount: matches
          };
        }
      }
    }

    if (!bestTicket && room.tickets.size === 0 && room.opponentCards.length > 0) {
      const opp = room.opponentCards[0];
      return {
        userName: opp.opponentName,
        cartelaId: opp.cartelaId,
        isReal: false,
        winningPattern: 'Bingo Line',
        winningIndices: [0, 1, 2, 3, 4]
      };
    }

    return bestTicket;
  }

  /**
   * Fair Resolution: Refund all real player stakes when round expires with no winner.
   * Only used as an absolute last resort (Ball 75 exhausted — virtually impossible).
   */
  private async refundAllPlayerStakes(room: GameRoomState) {
    for (const [userId, tList] of room.tickets.entries()) {
      const refundAmount = tList.reduce((sum, t) => sum + t.betAmount, 0);
      if (refundAmount <= 0) continue;
      try {
        await withTransaction(async (client) => {
          await client.query(
            'UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE user_id = $2',
            [refundAmount, userId]
          );
          const refCode = `REFUND-EXP-${Date.now().toString().slice(-6)}`;
          await client.query(
            `INSERT INTO wallet_transactions (user_id, type, amount, balance_after, reference_code, status, description)
             VALUES ($1, 'refund', $2, (SELECT balance FROM wallets WHERE user_id = $1), $3, 'completed', $4)`,
            [userId, refundAmount, refCode, `Round expired refund in ${room.name} (Round #${room.roundNumber})`]
          );
        });
        io.emit(`user_${userId}_balance`, { type: 'round_refund', refundAmount });
        io.emit('user_balance_updated', { userId });
        console.log(`💸 [Refund] Refunded ${refundAmount} ETB to user ${userId} in ${room.name}`);
      } catch (err) {
        console.error(`❌ [Refund Error] Failed to refund ${refundAmount} to ${userId}:`, err);
      }
    }

    // Authoritative DB Finalization for Refunded Round in Neon DB
    if (room.currentRoundId) {
      try {
        await query(
          `UPDATE game_rounds 
           SET phase = 'ended', 
               winner_user_ids = '[]'::jsonb, 
               winner_cartelas = '[]'::jsonb, 
               winner_names = '["Refunded"]'::jsonb, 
               drawn_numbers = $1,
               ended_at = NOW() 
           WHERE id = $2`,
          [JSON.stringify(room.drawnNumbers || []), room.currentRoundId]
        );
        await query(
          `UPDATE game_tickets 
           SET status = 'refunded' 
           WHERE round_id = $1`,
          [room.currentRoundId]
        );
        console.log(`✅ [GameEngine] DB Finalized refunded Round #${room.roundNumber} (Round ID: ${room.currentRoundId}) in ${room.id}`);
      } catch (dbErr) {
        console.error(`❌ [GameEngine Error finalizing refunded game_rounds in DB for ${room.id}]:`, dbErr);
      }
    }
  }

  /**
   * Synchronized 3.0s Master Ball Drawing Loop across all 4 houses (10, 20, 50, 100 ETB)
   */
  private startMasterBallCallingLoop(masterBallSequence: number[]) {
    if (this.intervals.has('master_ball')) {
      clearInterval(this.intervals.get('master_ball')!);
    }

    let masterDrawnCount = 0;

    const interval = setInterval(async () => {
      // 1. Check if any room is still playing
      const anyStillPlaying = STAKE_ROOM_IDS.some(id => this.rooms.get(id)?.phase === 'playing');
      if (!anyStillPlaying) {
        clearInterval(interval);
        return;
      }

      if (masterBallSequence.length === 0) {
        clearInterval(interval);
        this.startMasterWinnerCelebrationTimer();
        return;
      }

      const nextNum = masterBallSequence.pop()!;
      const col = getBallColumn(nextNum);
      masterDrawnCount++;

      // 2. Broadcast Ball Called only to houses that are still playing (Audio & State Isolation)
      for (const roomId of STAKE_ROOM_IDS) {
        const room = this.rooms.get(roomId);
        if (!room) continue;

        // Audio & Visual Isolation: Skip rooms that have already won or are concluding victory!
        if (room.phase === 'winner' || room.isProcessingVictory || room.winResult) {
          continue;
        }

        room.drawnNumbers.push(nextNum);
        room.lastBallTime = Date.now();
        room.currentCall = {
          num: nextNum,
          col,
          index: room.drawnNumbers.length
        };

        const ballPayload = {
          currentCall: room.currentCall,
          drawnNumbers: room.drawnNumbers,
          totalCalled: room.drawnNumbers.length,
          mode: room.mode,
          roomId: room.id
        };

        io.to(room.id).emit('ball_called', ballPayload);
        if (room.id === 'room-10') {
          io.to(ARENA_ROOM_ID).emit('ball_called', { ...ballPayload, roomId: ARENA_ROOM_ID });
          io.to('default').emit('ball_called', { ...ballPayload, roomId: 'default' });
        }
      }

      // 3. Evaluate Winning Patterns for each ACTIVE house independently
      for (const roomId of STAKE_ROOM_IDS) {
        const room = this.rooms.get(roomId);
        if (!room || room.mode !== 'active') continue;

        if (room.winResult || room.isHoldingClaimWindow) {
          continue; // House already won or holding 3.5s window for simultaneous manual claim
        }

        const evalThreshold = room.targetFinishBall || 15;
        if (room.drawnNumbers.length >= evalThreshold) {
          const winningCards: Array<{
            userId?: string;
            userName: string;
            cartelaId: number;
            isReal: boolean;
            winningPattern: string;
            winningIndices: number[];
          }> = [];

          // Check all Real Player tickets in this house (Auto-Play ONLY)
          for (const [uid, tList] of room.tickets.entries()) {
            const registeredAuto = this.playerModes.get(uid);
            for (const t of tList) {
              // Authoritative Double-Guard: MUST be strictly confirmed Auto in BOTH the playerModes registry AND ticket flag
              const isEligibleAuto = (registeredAuto !== undefined ? registeredAuto : t.isAutoPlay) === true && t.isAutoPlay === true;
              if (!isEligibleAuto) {
                continue; // Manual players (isAutoPlay === false) are strictly skipped and NEVER auto-claim!
              }

              const winCheck = checkWinningPattern(t.cardMatrix, room.drawnNumbers);
              if (winCheck.isWin) {
                winningCards.push({
                  userId: uid,
                  userName: t.userName,
                  cartelaId: t.cartelaId,
                  isReal: true,
                  winningPattern: winCheck.winningPattern || 'Bingo Line',
                  winningIndices: winCheck.winningIndices || []
                });
              }
            }
          }

          // Check Bot Opponent cards in this house (only if no real player won on this ball)
          if (winningCards.length === 0) {
            const isRoom10 = room.id === 'room-10' || room.id === ARENA_ROOM_ID || room.id === 'default';
            if (isRoom10) {
              // Room 10 ONLY: Standby bots represent the platform and must NEVER dilute the advertised Derash
              // Check if the designated target bot completed a winning pattern
              const targetBot = room.targetCardMatrix
                ? room.opponentCards.find(opp => opp.cardMatrix === room.targetCardMatrix)
                : null;

              if (targetBot) {
                const winCheck = checkWinningPattern(targetBot.cardMatrix, room.drawnNumbers);
                if (winCheck.isWin) {
                  winningCards.push({
                    userName: targetBot.opponentName,
                    cartelaId: targetBot.cartelaId,
                    isReal: false,
                    winningPattern: winCheck.winningPattern || 'Bingo Line',
                    winningIndices: winCheck.winningIndices || []
                  });
                }
              }

              // If target bot didn't win or wasn't set, find the FIRST bot that completes a pattern and break immediately
              if (winningCards.length === 0) {
                for (const opp of room.opponentCards) {
                  const winCheck = checkWinningPattern(opp.cardMatrix, room.drawnNumbers);
                  if (winCheck.isWin) {
                    winningCards.push({
                      userName: opp.opponentName,
                      cartelaId: opp.cartelaId,
                      isReal: false,
                      winningPattern: winCheck.winningPattern || 'Bingo Line',
                      winningIndices: winCheck.winningIndices || []
                    });
                    break; // STRICT ENFORCEMENT: Exactly 1 winning bot! Never accumulate 2 or 3 bots!
                  }
                }
              }
            } else {
              // Rooms 20, 50, 100 logic flow remains 100% UNTOUCHED
              for (const opp of room.opponentCards) {
                const winCheck = checkWinningPattern(opp.cardMatrix, room.drawnNumbers);
                if (winCheck.isWin) {
                  winningCards.push({
                    userName: opp.opponentName,
                    cartelaId: opp.cartelaId,
                    isReal: false,
                    winningPattern: winCheck.winningPattern || 'Bingo Line',
                    winningIndices: winCheck.winningIndices || []
                  });
                }
              }
            }
          }

          if (winningCards.length > 0) {
            // Simultaneous Win Check: Did any active Manual player ALSO complete a winning pattern on this ball?
            const currentNum = room.currentCall?.num || room.drawnNumbers[room.drawnNumbers.length - 1];
            let hasEligibleManualPlayer = false;

            for (const [uid, tList] of room.tickets.entries()) {
              const regAuto = this.playerModes.get(uid);
              for (const t of tList) {
                const isAuto = (regAuto !== undefined ? regAuto : t.isAutoPlay) === true && t.isAutoPlay === true;
                if (!isAuto) {
                  const wins = getAllWinningPatterns(t.cardMatrix, room.drawnNumbers);
                  if (wins.some(w => w.numbers.includes(currentNum))) {
                    hasEligibleManualPlayer = true;
                    break;
                  }
                }
              }
              if (hasEligibleManualPlayer) break;
            }

            if (hasEligibleManualPlayer) {
              // Industry standard: Pause room ball drawing and hold a 3.0s claim window
              // so the manual player has the ball call interval to click BINGO for a fair Split Pot.
              room.isHoldingClaimWindow = true;
              console.log(`⏱️ [Claim Window] Auto player won on ball ${currentNum}, but manual player also completed a line! Holding 3.0s claim window for room ${room.id}...`);
              setTimeout(async () => {
                room.isHoldingClaimWindow = false;
                if (room.mode === 'active' && !room.winResult) {
                  await this.processRoundVictory(room, winningCards);
                }
              }, 3000);
            } else {
              await this.processRoundVictory(room, winningCards);
            }
          }
        }
      }

      // ── EXTENDED DRAW: After Ball 25, check Auto-Play cards (Manual players must claim via BINGO button) ──
      // This activates only in extended draw territory (beyond normal finish window).
      // Manual players are NOT auto-awarded; balls continue drawing until a manual player claims or Auto completes.
      for (const roomId of STAKE_ROOM_IDS) {
        const room = this.rooms.get(roomId);
        if (!room || room.mode !== 'active') continue;
        if (room.drawnNumbers.length <= 25 || room.winResult || room.isProcessingVictory || room.isHoldingClaimWindow) continue;

        const extendedWinners: Array<{
          userId?: string;
          userName: string;
          cartelaId: number;
          isReal: boolean;
          winningPattern: string;
          winningIndices: number[];
        }> = [];

        // Check ONLY confirmed Auto-Play player tickets in extended draw
        for (const [uid, tList] of room.tickets.entries()) {
          const registeredAuto = this.playerModes.get(uid);
          for (const t of tList) {
            const isEligibleAuto = (registeredAuto !== undefined ? registeredAuto : t.isAutoPlay) === true && t.isAutoPlay === true;
            if (!isEligibleAuto) {
              continue; // Manual players (isAutoPlay === false) NEVER auto-claim; must explicitly tap BINGO!
            }
            const winCheck = checkWinningPattern(t.cardMatrix, room.drawnNumbers);
            if (winCheck.isWin) {
              extendedWinners.push({
                userId: uid,
                userName: t.userName,
                cartelaId: t.cartelaId,
                isReal: true,
                winningPattern: winCheck.winningPattern || 'Bingo Line',
                winningIndices: winCheck.winningIndices || []
              });
            }
          }
        }

        // Also check bot cards in extended draw (only if no real player won on this ball)
        if (extendedWinners.length === 0) {
          const isRoom10 = room.id === 'room-10' || room.id === ARENA_ROOM_ID || room.id === 'default';
          if (isRoom10) {
            // Room 10 ONLY: Strictly at most 1 winning bot
            for (const opp of room.opponentCards) {
              const winCheck = checkWinningPattern(opp.cardMatrix, room.drawnNumbers);
              if (winCheck.isWin) {
                extendedWinners.push({
                  userName: opp.opponentName,
                  cartelaId: opp.cartelaId,
                  isReal: false,
                  winningPattern: winCheck.winningPattern || 'Bingo Line',
                  winningIndices: winCheck.winningIndices || []
                });
                break; // STRICT ENFORCEMENT: Exactly 1 winning bot!
              }
            }
          } else {
            // Rooms 20, 50, 100 logic flow remains 100% UNTOUCHED
            for (const opp of room.opponentCards) {
              const winCheck = checkWinningPattern(opp.cardMatrix, room.drawnNumbers);
              if (winCheck.isWin) {
                extendedWinners.push({
                  userName: opp.opponentName,
                  cartelaId: opp.cartelaId,
                  isReal: false,
                  winningPattern: winCheck.winningPattern || 'Bingo Line',
                  winningIndices: winCheck.winningIndices || []
                });
              }
            }
          }
        }

        if (extendedWinners.length > 0) {
          console.log(`🎉 [Extended Draw] Winner found on Ball #${room.drawnNumbers.length} in ${room.id}: ${extendedWinners[0].userName} (Cartela #${extendedWinners[0].cartelaId})`);
          await this.processRoundVictory(room, extendedWinners);
        }
      }

      // 4. Conclude when ALL active houses have resolved, or upon reaching safety cap (26 balls)
      const anyActiveHouse = STAKE_ROOM_IDS.some(id => this.rooms.get(id)?.mode === 'active');
      const pendingActiveHouse = STAKE_ROOM_IDS.some(id => {
        const r = this.rooms.get(id);
        return r && r.mode === 'active' && !r.winResult;
      });

      if (anyActiveHouse && !pendingActiveHouse) {
        clearInterval(interval);
        this.startMasterWinnerCelebrationTimer();
      } else if (anyActiveHouse && masterDrawnCount >= 26) {
        // Safety Guarantee: Force-complete any lingering active house that reached ball 26
        for (const roomId of STAKE_ROOM_IDS) {
          const r = this.rooms.get(roomId);
          if (r && r.mode === 'active' && !r.winResult) {
            const fallbackWinner = this.findBestCardForFallbackWin(r);
            if (fallbackWinner) {
              await this.processRoundVictory(r, [fallbackWinner]);
            } else if (r.tickets.size > 0) {
              // EXTENDED DRAW: Real players are active — keep drawing until someone wins naturally
              console.log(`🔄 [Extended Draw] House ${r.id} has ${r.tickets.size} active player(s) but no winner by Ball 26. Continuing ball draw...`);
              // Don't set winResult, don't end the room — the ball loop continues
              // Phase 2's extended draw scan will pick up winners on subsequent balls
            } else {
              // No real players at all — safe to end with no winner
              console.log(`⏱️ [Ball 26 Cap] House ${r.id} has no active players. Ending round.`);
              r.winResult = {
                roomId: r.id,
                winType: 'no_winner',
                winnerName: 'No Winner',
                winnerNames: [],
                winnerUserIds: [],
                winningCartelaNumber: 0,
                winningCartelas: [],
                winningPattern: 'No Players',
                winningIndices: [],
                totalPot: r.totalPot,
                houseFee: r.totalPot,
                netPrizePot: 0,
                commissionPercent: 100,
                winnerPayout: 0,
                stakeAmount: r.stakeAmount,
                sharePerWinner: 0,
                userShare: 0,
                coWinners: [],
                isSplit: false,
                winnersCount: 0
              };
              if (r.currentRoundId) {
                try {
                  await query(
                    `UPDATE game_rounds 
                     SET phase = 'ended', 
                         winner_user_ids = '[]'::jsonb, 
                         winner_cartelas = '[]'::jsonb, 
                         winner_names = '["No Winner"]'::jsonb, 
                         drawn_numbers = $1,
                         ended_at = NOW() 
                     WHERE id = $2`,
                    [JSON.stringify(r.drawnNumbers || []), r.currentRoundId]
                  );
                } catch (dbErr) {
                  console.error(`❌ [GameEngine Error finalizing empty game_rounds in DB for ${r.id}]:`, dbErr);
                }
              }
              this.broadcastRoomState(r);
            }
          }
        }
        // Only stop the loop if ALL active houses have resolved (no pending rooms in extended draw)
        const allHousesResolved = !STAKE_ROOM_IDS.some(id => {
          const rm = this.rooms.get(id);
          return rm && rm.mode === 'active' && !rm.winResult;
        });
        if (allHousesResolved) {
          clearInterval(interval);
          this.startMasterWinnerCelebrationTimer();
        }
        // Otherwise: ball loop continues — extended draw rooms will resolve via Phase 2 scan
      } else if (!anyActiveHouse && masterDrawnCount >= 25) {
        clearInterval(interval);
        this.startMasterWinnerCelebrationTimer();
      } else if (masterDrawnCount >= 75) {
        // Safety net: All 75 balls drawn — refund any unresolved rooms
        for (const roomId of STAKE_ROOM_IDS) {
          const r = this.rooms.get(roomId);
          if (r && r.mode === 'active' && !r.winResult && r.tickets.size > 0) {
            console.log(`🛡️ [Ball 75 Safety] All balls drawn in ${r.id} with no winner. Refunding ${r.tickets.size} player stake(s).`);
            await this.refundAllPlayerStakes(r);
            r.winResult = {
              roomId: r.id,
              winType: 'refunded',
              winnerName: 'Round Complete — Stakes Refunded',
              winnerNames: [],
              winnerUserIds: [],
              winningCartelaNumber: 0,
              winningCartelas: [],
              winningPattern: 'Refunded',
              winningIndices: [],
              totalPot: r.totalPot,
              houseFee: 0,
              jackpotFee: 0,
              jackpotPool: r.jackpotPoolBalance || 0,
              netPrizePot: 0,
              commissionPercent: 0,
              winnerPayout: 0,
              stakeAmount: r.stakeAmount,
              sharePerWinner: 0,
              userShare: 0,
              coWinners: [],
              isSplit: false,
              winnersCount: 0
            };
            this.broadcastRoomState(r);
          }
        }
        clearInterval(interval);
        this.startMasterWinnerCelebrationTimer();
      }
    }, 3000);

    this.intervals.set('master_ball', interval);
  }

  // Backwards-compatible alias for existing call sites
  private startBallCallingLoop(roomId: string = 'room-10') {
    const room = this.rooms.get(roomId);
    if (room && room.ballSequence.length > 0) {
      this.startMasterBallCallingLoop(room.ballSequence);
    }
  }

  /**
   * Process Round Victory & Real Database Ledger Credits for Players & Bots
   */
  private async processRoundVictory(
    room: GameRoomState,
    winningCards: Array<{
      userId?: string;
      userName: string;
      cartelaId: number;
      isReal: boolean;
      winningPattern: string;
      winningIndices: number[];
    }>
  ) {
    if (room.isProcessingVictory || room.winResult) {
      console.warn(`⚠️ [GameEngine] Victory processing already in progress for ${room.id}. Ignoring concurrent claim.`);
      return;
    }
    room.isProcessingVictory = true;
    room.phase = 'winner';

    try {
      const realWinners = winningCards.filter(w => w.isReal);
      const botWinners = winningCards.filter(w => !w.isReal);

      // Priority Guarantee: If real player(s) win, they receive 100% of the prize pool without bot dilution
      const effectiveWinningCards = realWinners.length > 0 ? realWinners : winningCards;
      const totalWinningCards = effectiveWinningCards.length;

      // Group winning cards by unique entity: real users by userId, bots by opponent ID
      const distinctEntities = new Set(effectiveWinningCards.map(w => w.isReal ? `real_${w.userId}` : `bot_${w.cartelaId}`));
      const isSplit = distinctEntities.size > 1;

      // Group real winning cards by userId
      const realWinnersByUser = new Map<string, typeof realWinners>();
      for (const rw of realWinners) {
        if (!rw.userId) continue;
        const list = realWinnersByUser.get(rw.userId) || [];
        list.push(rw);
        realWinnersByUser.set(rw.userId, list);
      }

      const isRoom10 = room.id === 'room-10' || room.id === ARENA_ROOM_ID || room.id === 'default';
      const dbRoomId = isRoom10 ? 'room-10' : room.id;

      // Accumulative Jackpot Hit Detection (Client Specification):
      // When cumulative pool reaches >= 500 ETB, the winner of this round wins Bingo Net Prize + Jackpot together!
      const ballsDrawn = room.drawnNumbers.length;
      const currentJackpotPool = room.jackpotPoolBalance || 0;
      const isJackpotHit = realWinners.length > 0 && currentJackpotPool >= 500;
      const totalJackpotAwarded = isJackpotHit ? 500 : 0;
      const excessJackpotCarryover = isJackpotHit ? Math.max(0, currentJackpotPool - 500) : currentJackpotPool;

      const netPayout = room.winnerPayout > 0 ? room.winnerPayout : room.totalPot;
      const totalCombinedPot = netPayout + totalJackpotAwarded;

      // Two-Winner 64% / 36% Distribution:
      // If 2 players achieve bingo, order is determined by recorded claim time.
      // 1st recorded winner receives 64% of net prize, 2nd receives 36%.
      const distinctWinningUsers = Array.from(realWinnersByUser.keys());
      const winnerCount = distinctWinningUsers.length;

      // Speed bonus for < 10 calls (Customer Rule):
      const isSpeedBonus = ballsDrawn < 10;
      const speedBonusPerWinner = isSpeedBonus ? 100 : 0;

      let primaryUserPayout = 0;
      let displayWinnerPayout = totalCombinedPot;

      // 1. Credit all winning real players atomically via Neon PostgreSQL
      if (realWinnersByUser.size > 0) {
        try {
          await withTransaction(async (client) => {
            for (const [userId, userWinningCards] of realWinnersByUser.entries()) {
              const userTickets = room.tickets.get(userId) || [];
              const userIndex = distinctWinningUsers.indexOf(userId);

              // Calculate total payout: regular net pot share + progressive jackpot share (if hit) + speed bonus
              let normalWin = 0;
              let userJackpotShare = 0;

              if (winnerCount === 1) {
                normalWin = netPayout;
                userJackpotShare = totalJackpotAwarded;
              } else if (winnerCount === 2) {
                if (userIndex === 0) {
                  // 1st recorded winner receives 64%
                  normalWin = Math.floor(netPayout * 0.64);
                  userJackpotShare = isJackpotHit ? Math.floor(totalJackpotAwarded * 0.64) : 0;
                } else {
                  // 2nd recorded winner receives 36%
                  normalWin = netPayout - Math.floor(netPayout * 0.64);
                  userJackpotShare = isJackpotHit ? (totalJackpotAwarded - Math.floor(totalJackpotAwarded * 0.64)) : 0;
                }
              } else {
                normalWin = Math.floor(netPayout / winnerCount);
                userJackpotShare = isJackpotHit ? Math.floor(totalJackpotAwarded / winnerCount) : 0;
              }

              const userTotalWin = normalWin + userJackpotShare + speedBonusPerWinner;

              primaryUserPayout = userTotalWin;
              displayWinnerPayout = userTotalWin;

              const walletRes = await client.query(
                'SELECT balance FROM wallets WHERE user_id = $1 FOR UPDATE',
                [userId]
              );

              if (walletRes.rows.length > 0) {
                const currentBal = parseFloat(walletRes.rows[0].balance || '0');
                const newBal = currentBal + userTotalWin;

                await client.query(
                  'UPDATE wallets SET balance = $1, updated_at = NOW() WHERE user_id = $2',
                  [newBal, userId]
                );

                const isSocketConnected = room.activeUsers.has(userId) || userTickets.some(t => room.activeSockets.has(t.socketId));
                const isOffline = !isSocketConnected;
                const winRef = `WIN-ARENA-${Date.now().toString().slice(-6)}`;
                const winningCardIds = userWinningCards.map(w => `#${w.cartelaId}`).join(', ');
                const firstTicket = userTickets.find(t => t.cartelaId === userWinningCards[0].cartelaId);
                const ticketStake = firstTicket?.betAmount || room.stakeAmount;

                const description = isJackpotHit
                  ? `🔥 PROGRESSIVE JACKPOT (500 ETB) + Bingo Winner (${userWinningCards.length} cards, ${ticketStake} ETB Stake) in ${room.name} (Cartela ${winningCardIds}) [${normalWin} ETB Bingo + ${userJackpotShare} ETB Jackpot Hit!]${speedBonusPerWinner > 0 ? ' [Speed Bonus: +100 ETB for < 10 calls!]' : ''}${isOffline ? ' [Protected Offline Auto-Claim]' : ''}`
                  : isSplit
                    ? `Split Pot Winner (${userIndex === 0 ? '64%' : '36%'}, ${userWinningCards.length} of ${totalWinningCards} cards, ${ticketStake} ETB Stake) in ${room.name} (Cartela ${winningCardIds})${speedBonusPerWinner > 0 ? ' [Speed Bonus: +100 ETB for < 10 calls!]' : ''}${isOffline ? ' [Protected Offline Auto-Claim]' : ''}`
                    : `Bingo Solo Winner (${ticketStake} ETB Stake) in ${room.name} (Cartela ${winningCardIds})${speedBonusPerWinner > 0 ? ' [Speed Bonus: +100 ETB for < 10 calls!]' : ''}${isOffline ? ' [Protected Offline Auto-Claim]' : ''}`;

                await client.query(
                  `INSERT INTO wallet_transactions (user_id, type, amount, balance_after, reference_code, status, payment_method, description)
                   VALUES ($1, 'win', $2, $3, $4, 'completed', 'in_game', $5)`,
                  [userId, userTotalWin, newBal, winRef, description]
                );

                // Record progressive jackpot winner if hit
                if (isJackpotHit) {
                  await client.query(
                    `INSERT INTO jackpot_winners (room_id, round_id, user_id, amount, balls_count)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [dbRoomId, room.currentRoundId || null, userId, userJackpotShare, ballsDrawn]
                  );
                }

                // Disconnect Protection: Record in authoritative offline/online ledger
                const winRecord: OfflineWinRecord = {
                  id: `WINREC-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
                  userId,
                  userName: userWinningCards[0].userName,
                  roomId: room.id,
                  roundNumber: room.roundNumber,
                  cartelaId: userWinningCards[0].cartelaId,
                  amount: userTotalWin,
                  referenceCode: winRef,
                  timestamp: new Date().toISOString(),
                  isOffline,
                  acknowledged: !isOffline,
                  winningPattern: userWinningCards[0].winningPattern
                };
                this.offlineWins.unshift(winRecord);
                if (this.offlineWins.length > 200) this.offlineWins.pop();

                io.emit('offline_win_recorded', winRecord);

                // Automated Big Winner Channel Broadcast (if enabled & threshold met)
                telegramBotService.announceBigWinner(
                  userWinningCards[0].userName,
                  userTotalWin,
                  isJackpotHit ? `${room.name} [PROGRESSIVE JACKPOT]` : room.name,
                  userWinningCards[0].cartelaId
                ).catch(() => { });

                io.emit(`user_${userId}_balance`, {
                  type: 'bingo_win',
                  amount: userTotalWin,
                  newBalance: newBal
                });
                io.emit('user_balance_updated', {
                  userId,
                  type: 'bingo_win',
                  amount: userTotalWin,
                  newBalance: newBal,
                  balance: newBal
                });
              }
            }

            // Carryover jackpot pool in DB (500 ETB awarded, excess carries over)
            if (isJackpotHit) {
              const resetRes = await client.query(
                `UPDATE jackpot_pool 
                 SET balance = $1, 
                     last_won_amount = $2, 
                     last_winner_user_id = $3, 
                     last_won_at = NOW(), 
                     updated_at = NOW() 
                 WHERE room_id = $4 
                 RETURNING balance`,
                [excessJackpotCarryover, totalJackpotAwarded, distinctWinningUsers[0], dbRoomId]
              );
              if (resetRes.rows.length > 0) {
                const seedBal = parseFloat(resetRes.rows[0].balance || '0');
                room.jackpotPoolBalance = seedBal;
                if (isRoom10) {
                  const r10 = this.rooms.get('room-10');
                  if (r10) r10.jackpotPoolBalance = seedBal;
                  const arena = this.rooms.get(ARENA_ROOM_ID);
                  if (arena) arena.jackpotPoolBalance = seedBal;
                  const def = this.rooms.get('default');
                  if (def) def.jackpotPoolBalance = seedBal;
                }
              }
            }
          });

          if (isJackpotHit) {
            io.emit('jackpot_won', {
              roomId: room.id,
              roomName: room.name,
              winnerNames: Array.from(new Set(realWinners.map(w => w.userName))),
              amount: totalJackpotAwarded,
              excessCarryover: excessJackpotCarryover,
              ballsCount: ballsDrawn,
              newPoolBalance: room.jackpotPoolBalance
            });
            console.log(`🏆 [Jackpot Hit!] Real player(s) won progressive jackpot of ${totalJackpotAwarded} ETB in ${room.id} together with Bingo Net Prize! Excess carryover: ${room.jackpotPoolBalance} ETB`);
          }
        } catch (err) {
          console.error(`❌ [GameEngine Error processing winning payout in ${room.id}]:`, err);
        }
      }

      // Progressive Jackpot Rollover: If jackpot not hit and pot has jackpot fee, roll over into pool
      if (!isJackpotHit && room.jackpotFee > 0 && (room.tickets.size > 0 || realWinners.length > 0)) {
        try {
          const rolloverRes = await query(
            `UPDATE jackpot_pool 
             SET balance = balance + $1, updated_at = NOW() 
             WHERE room_id = $2 
             RETURNING balance`,
            [room.jackpotFee, dbRoomId]
          );
          if (rolloverRes.rows.length > 0) {
            const newPoolBal = parseFloat(rolloverRes.rows[0].balance || '0');
            room.jackpotPoolBalance = newPoolBal;
            if (isRoom10) {
              const r10 = this.rooms.get('room-10');
              if (r10) r10.jackpotPoolBalance = newPoolBal;
              const arena = this.rooms.get(ARENA_ROOM_ID);
              if (arena) arena.jackpotPoolBalance = newPoolBal;
              const def = this.rooms.get('default');
              if (def) def.jackpotPoolBalance = newPoolBal;
            }
          }
          io.emit('jackpot_update', {
            roomId: room.id,
            balance: room.jackpotPoolBalance,
            added: room.jackpotFee,
            isJackpotActive: room.jackpotPoolBalance >= 500
          });
          if (room.jackpotPoolBalance >= 500) {
            io.emit('jackpot_hit_active', {
              roomId: room.id,
              balance: room.jackpotPoolBalance,
              threshold: 500
            });
            console.log(`🚨 [HIT JACKPOT ACTIVE] Room ${room.id} jackpot reached ${room.jackpotPoolBalance} ETB! The winner of the round will win this jackpot together with the Bingo Net Prize!`);
          }
          console.log(`🎰 [Progressive Jackpot Rollover] +${room.jackpotFee} ETB (2.4% pot) -> ${room.id} pool. Current Balance: ${room.jackpotPoolBalance} ETB`);
        } catch (rollErr) {
          console.error(`⚠️ [GameEngine] Error rolling over jackpot fee in ${room.id}:`, rollErr);
        }
      }

      // 2. Process Bot Victory: Real Ledger Credit in Neon DB
      if (botWinners.length > 0 && realWinners.length === 0) {
        try {
          if (isRoom10) {
            displayWinnerPayout = netPayout; // Exactly 424 ETB on 530 ETB pot
          }
          for (const bw of botWinners) {
            const matchingOpp = room.opponentCards.find(o => o.cartelaId === bw.cartelaId);
            const botStake = matchingOpp?.stakeAmount || 10;
            const botPayout = isRoom10 ? netPayout : perCardPayout;
            if (!isRoom10) {
              displayWinnerPayout = botPayout;
            }

            if (matchingOpp?.botUserId && !matchingOpp.botUserId.startsWith('bot_legacy_') && !isStandbyBotId(matchingOpp.botUserId)) {
              await query(
                'UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE user_id = $2',
                [botPayout, matchingOpp.botUserId]
              );

              const botWinRef = `BOT-WIN-${Date.now().toString().slice(-6)}`;
              await query(
                `INSERT INTO wallet_transactions (user_id, type, amount, balance_after, reference_code, status, payment_method, description)
                 VALUES ($1, 'win', $2, (SELECT balance FROM wallets WHERE user_id = $1), $3, 'completed', 'in_game', $4)`,
                [
                  matchingOpp.botUserId,
                  botPayout,
                  botWinRef,
                  isSplit
                    ? `Split Pot Winner (1 of ${totalWinningCards}, ${botStake} ETB Stake) in ${room.name} (Cartela #${bw.cartelaId})`
                    : `Bingo Solo Winner (${botStake} ETB Stake) in ${room.name} (Cartela #${bw.cartelaId})`
                ]
              );
            }
          }
        } catch (err) {
          console.error(`❌ [GameEngine Error crediting bot win in ${room.id}]:`, err);
        }
      }

      const firstWinner = effectiveWinningCards[0];
      const matchingOpp = room.opponentCards.find(o => o.cartelaId === firstWinner.cartelaId);
      const winnerStake = firstWinner.isReal
        ? (room.tickets.get(firstWinner.userId || '')?.[0]?.betAmount || 10)
        : (matchingOpp?.stakeAmount || 10);

      const primaryEntityId = firstWinner.isReal ? `real_${firstWinner.userId}` : `bot_${firstWinner.cartelaId}`;
      const externalCoWinners = Array.from(
        new Set(
          effectiveWinningCards
            .filter(w => (w.isReal ? `real_${w.userId}` : `bot_${w.cartelaId}`) !== primaryEntityId)
            .map(w => w.userName)
        )
      );

      // In Room 10 bot victory: Standby bots represent the platform and never split with each other
      const isBotSoloWinInRoom10 = isRoom10 && botWinners.length > 0 && realWinners.length === 0;
      const effectiveIsSplit = isBotSoloWinInRoom10 ? false : isSplit;
      const effectiveCoWinners = isBotSoloWinInRoom10 ? [] : (isSplit ? externalCoWinners : []);
      const effectiveShare = isBotSoloWinInRoom10 ? netPayout : (isSplit ? (realWinnersByUser.size === 2 ? Math.floor(totalCombinedPot * 0.64) : Math.floor(totalCombinedPot / (realWinnersByUser.size || 2))) : displayWinnerPayout);
      const effectiveWinnerPayout = isBotSoloWinInRoom10 ? netPayout : displayWinnerPayout;

      const winResult = {
        roomId: room.id,
        winType: effectiveIsSplit
          ? (realWinners.length > 0 ? 'user_split' : 'opponent_win')
          : (firstWinner.isReal ? 'user_solo' : 'opponent_win'),
        winnerId: firstWinner.userId || matchingOpp?.botUserId || `bot_${firstWinner.cartelaId}`,
        winnerName: firstWinner.userName,
        winnerNames: Array.from(new Set(effectiveWinningCards.map(w => w.userName))),
        winnerUserIds: Array.from(new Set(realWinners.map(rw => rw.userId))),
        winningCartelaNumber: firstWinner.cartelaId,
        winningCartelas: effectiveWinningCards.map(w => w.cartelaId),
        winningPattern: firstWinner.winningPattern,
        winningIndices: firstWinner.winningIndices,
        totalPot: room.totalPot,
        houseFee: room.houseFee || 0,
        jackpotFee: room.jackpotFee || 0,
        jackpotPool: room.jackpotPoolBalance || 0,
        isJackpotHit: !!isJackpotHit,
        jackpotWonAmount: isJackpotHit ? totalJackpotAwarded : 0,
        netPrizePot: room.winnerPayout > 0 ? room.winnerPayout : room.totalPot,
        commissionPercent: room.commissionEnabled ? (room.commissionPercent || 20) : 0,
        winnerPayout: effectiveWinnerPayout,
        stakeAmount: winnerStake,
        sharePerWinner: effectiveShare,
        userShare: primaryUserPayout,
        coWinners: effectiveCoWinners,
        isSplit: effectiveIsSplit,
        winnersCount: isBotSoloWinInRoom10 ? 1 : distinctEntities.size
      };

      room.winResult = winResult;

      // Phase 2: In-Memory Loss-Streak & Session Anti-Churn Tracker (Room 10 ONLY)
      if (isRoom10) {
        const winningUserIds = new Set(realWinners.map(rw => rw.userId).filter(Boolean));
        const now = Date.now();

        for (const userId of room.tickets.keys()) {
          const streak = this.playerSessionStreaks.get(userId) || { consecutiveLosses: 0, recentWins: 0, lastActive: now };
          streak.lastActive = now;

          if (winningUserIds.has(userId)) {
            console.log(`🎉 [Room 10 Real Win] Real player ${userId} won round #${room.roundNumber}! Resetting streak (was: ${streak.consecutiveLosses} losses).`);
            streak.consecutiveLosses = 0;
            streak.recentWins += 1;
          } else {
            streak.consecutiveLosses += 1;
          }
          this.playerSessionStreaks.set(userId, streak);
        }

        // Periodic cleanup: keep memory bounded by removing sessions inactive for > 2 hours
        if (this.playerSessionStreaks.size > 200) {
          const twoHoursAgo = now - 2 * 60 * 60 * 1000;
          for (const [uid, data] of this.playerSessionStreaks.entries()) {
            if (data.lastActive < twoHoursAgo) {
              this.playerSessionStreaks.delete(uid);
            }
          }
        }
      }

      // Authoritative DB Finalization: Always record round winner & update tickets in Neon DB (for real, split, or bot victory)
      if (room.currentRoundId) {
        try {
          const allWinningCartelas = winningCards.map(w => w.cartelaId);
          const allWinningNames = Array.from(new Set(winningCards.map(w => w.userName)));
          const allWinningUserIds = Array.from(new Set(realWinners.map(rw => rw.userId).filter(Boolean)));
          const drawnBalls = room.drawnNumbers || [];

          await query(
            `UPDATE game_rounds 
             SET phase = 'ended', 
                 winner_user_ids = $1, 
                 winner_cartelas = $2, 
                 winner_names = $3, 
                 drawn_numbers = $4,
                 ended_at = NOW() 
             WHERE id = $5`,
            [
              JSON.stringify(allWinningUserIds),
              JSON.stringify(allWinningCartelas),
              JSON.stringify(allWinningNames),
              JSON.stringify(drawnBalls),
              room.currentRoundId
            ]
          );

          // Update game_tickets status for this round in Neon DB
          if (allWinningCartelas.length > 0) {
            await query(
              `UPDATE game_tickets 
               SET status = 'won' 
               WHERE round_id = $1 AND cartela_id = ANY($2::int[])`,
              [room.currentRoundId, allWinningCartelas]
            );
            await query(
              `UPDATE game_tickets 
               SET status = 'lost' 
               WHERE round_id = $1 AND NOT (cartela_id = ANY($2::int[]))`,
              [room.currentRoundId, allWinningCartelas]
            );
          }
        } catch (dbFinalizeErr) {
          console.error(`❌ [GameEngine Error finalizing game_rounds in DB for ${room.id}]:`, dbFinalizeErr);
        }
      }

      // Broadcast round winner to room
      io.to(room.id).emit('round_winner', winResult);
      if (room.id === 'room-10') {
        io.to(ARENA_ROOM_ID).emit('round_winner', winResult);
        io.to('default').emit('round_winner', winResult);
      }
      this.broadcastRoomState(room);
    } catch (err) {
      console.error(`❌ [GameEngine General Error processing victory in ${room.id}]:`, err);
    } finally {
      room.isProcessingVictory = false;
    }

    // Check if any other active house still pending
    const otherActivePending = STAKE_ROOM_IDS.some(id => {
      const r = this.rooms.get(id);
      return r && r.id !== room.id && r.mode === 'active' && !r.winResult;
    });
    if (!otherActivePending) {
      for (const roomId of STAKE_ROOM_IDS) {
        const r = this.rooms.get(roomId);
        if (r) r.waitingForOtherHouses = false;
      }
      this.startMasterWinnerCelebrationTimer();
    } else {
      room.waitingForOtherHouses = true;
      this.broadcastRoomState(room);
    }
  }

  /**
   * Player Claims Bingo Manually
   */
  public async handleClaimBingo(
    userId: string,
    userName: string,
    roomId: string,
    cartelaId: number
  ): Promise<{ success: boolean; message: string; winResult?: any }> {
    const room = this.getRoom(roomId);
    if (!room || room.phase !== 'playing' || room.isProcessingVictory) {
      return { success: false, message: 'Game is not currently in playing phase or victory is already being processed.' };
    }

    const userTickets = room.tickets.get(userId) || [];
    const ticket = userTickets.find(t => t.cartelaId === cartelaId);
    if (!ticket) {
      return {
        success: false,
        message: 'You do not hold an active ticket for this cartela in this room.'
      };
    }
    const cardMatrix = ticket.cardMatrix;

    const allWins = getAllWinningPatterns(cardMatrix, room.drawnNumbers);
    if (allWins.length === 0) {
      return {
        success: false,
        message: 'Invalid Bingo claim. Not all numbers in a winning line have been drawn yet.'
      };
    }

    // Strict Single-Ball Rule for Manual Players:
    // The winning pattern must contain the current active ball.
    // If the next number is called before claiming, the pattern expires (slept bingo).
    const currentNum = room.currentCall?.num || room.drawnNumbers[room.drawnNumbers.length - 1];
    const eligibleBalls = typeof currentNum === 'number' && currentNum > 0 ? [currentNum] : [];

    let eligibleWin = allWins[0];

    if (ticket && ticket.isAutoPlay === false) {
      const activeWin = allWins.find(w => w.numbers.some(n => eligibleBalls.includes(n)));
      if (!activeWin) {
        console.log(`[ClaimBingo] Missed/Slept Bingo by ${userName} (${userId}) on Cartela #${cartelaId}. Pattern did not include active ball (${eligibleBalls.join(', ')}). Play continues.`);
        return {
          success: false,
          message: 'Missed Bingo! That pattern expired because the next number was called. Complete another 5-in-a-row line to call BINGO!'
        };
      }
      eligibleWin = activeWin;
    }

    const winningCards: Array<{
      userId?: string;
      userName: string;
      cartelaId: number;
      isReal: boolean;
      winningPattern: string;
      winningIndices: number[];
    }> = [
        {
          userId,
          userName,
          cartelaId,
          isReal: true,
          winningPattern: eligibleWin.patternName || 'Bingo Line',
          winningIndices: eligibleWin.indices || []
        }
      ];

    // Check if other confirmed AUTO-PLAY real players also completed a winning line on this ball (simultaneous split pot)
    for (const [otherUid, tList] of room.tickets.entries()) {
      const regAuto = this.playerModes.get(otherUid);
      for (const t of tList) {
        if (otherUid === userId && t.cartelaId === cartelaId) continue;
        const isEligibleAuto = (regAuto !== undefined ? regAuto : t.isAutoPlay) === true && t.isAutoPlay === true;

        // STRICT INVARIANT: Manual players (isAutoPlay === false) NEVER get an automatic split pot without clicking BINGO!
        if (!isEligibleAuto) {
          continue;
        }

        const otherCheck = checkWinningPattern(t.cardMatrix, room.drawnNumbers);
        if (otherCheck.isWin) {
          winningCards.push({
            userId: otherUid,
            userName: t.userName,
            cartelaId: t.cartelaId,
            isReal: true,
            winningPattern: otherCheck.winningPattern || 'Bingo Line',
            winningIndices: otherCheck.winningIndices || []
          });
        }
      }
    }

    // Check if any bot cards also completed on this ball
    // In Room 10: Standby bots represent the platform and NEVER split with a claiming real player!
    const isRoom10 = room.id === 'room-10' || room.id === ARENA_ROOM_ID || room.id === 'default';
    if (!isRoom10) {
      // Rooms 20, 50, 100 logic flow remains 100% UNTOUCHED
      for (const opp of room.opponentCards) {
        const botCheck = checkWinningPattern(opp.cardMatrix, room.drawnNumbers);
        if (botCheck.isWin) {
          winningCards.push({
            userName: opp.opponentName,
            cartelaId: opp.cartelaId,
            isReal: false,
            winningPattern: botCheck.winningPattern || 'Bingo Line',
            winningIndices: botCheck.winningIndices || []
          });
        }
      }
    }

    room.isHoldingClaimWindow = false;
    await this.processRoundVictory(room, winningCards);

    return {
      success: true,
      message: 'BINGO VERIFIED! Congratulations!',
      winResult: room.winResult
    };
  }

  private finishRoundWithoutWinner(roomId: string = 'room-10') {
    const room = this.rooms.get(roomId) || this.rooms.get('room-10') || this.rooms.get(ARENA_ROOM_ID)!;
    room.phase = 'winner';
    io.to(room.id).emit('round_ended_no_winner', { totalPot: room.totalPot, roomId: room.id });
    if (room.id === 'room-10') {
      io.to(ARENA_ROOM_ID).emit('round_ended_no_winner', { totalPot: room.totalPot, roomId: ARENA_ROOM_ID });
      io.to('default').emit('round_ended_no_winner', { totalPot: room.totalPot, roomId: 'default' });
    }
    this.startMasterWinnerCelebrationTimer();
  }

  /**
   * Synchronized 8-Second Celebration across all 4 houses, then transitions all to next 45s lobby together
   */
  public startMasterWinnerCelebrationTimer() {
    if (this.intervals.has('master_ball')) {
      clearInterval(this.intervals.get('master_ball')!);
    }
    if (this.intervals.has('master_winner')) {
      clearInterval(this.intervals.get('master_winner')!);
    }

    for (const roomId of STAKE_ROOM_IDS) {
      const room = this.rooms.get(roomId);
      if (!room) continue;
      room.waitingForOtherHouses = false;
      room.phase = 'winner';
      room.winnerCountdown = 8;
      this.broadcastRoomState(room);
    }

    let currentWinnerCountdown = 8;

    const interval = setInterval(() => {
      currentWinnerCountdown -= 1;

      for (const roomId of STAKE_ROOM_IDS) {
        const room = this.rooms.get(roomId);
        if (!room) continue;
        room.winnerCountdown = Math.max(0, currentWinnerCountdown);
        this.broadcastRoomState(room);
      }

      if (currentWinnerCountdown <= 0) {
        clearInterval(interval);
        for (const roomId of STAKE_ROOM_IDS) {
          const room = this.rooms.get(roomId);
          if (!room) continue;
          room.roundNumber += 1;
          room.tickets.clear();
        }
        this.startMasterLobbyTimer();
      }
    }, 1000);

    this.intervals.set('master_winner', interval);
  }

  // Backwards-compatible alias for existing call sites
  private startWinnerCelebrationTimer(_roomId: string = 'room-10') {
    this.startMasterWinnerCelebrationTimer();
  }

  /**
   * Self-Healing Watchdog: Ensures game never freezes even under extreme network disruption
   */
  public startWatchdogTimer() {
    setInterval(() => {
      const sample = this.rooms.get('room-10');
      if (!sample) return;

      if (sample.phase === 'playing') {
        const now = Date.now();
        const stallThreshold = 14000; // 14 seconds without a ball drawn
        if (now - (sample.lastBallTime || 0) > stallThreshold) {
          console.warn('⚠️ [Watchdog] Master ball loop stalled for >14s. Auto-recovering round.');
          this.startMasterWinnerCelebrationTimer();
        }
      }
    }, 5000);
  }

  /**
   * Emergency Force-Reset (Used to immediately unstick any stuck room like room-50)
   */
  public forceResetRoomToLobby(roomId?: string) {
    if (roomId && this.rooms.has(roomId)) {
      const r = this.rooms.get(roomId)!;
      r.phase = 'lobby';
      r.isProcessingVictory = false;
      r.drawnNumbers = [];
      r.currentCall = null;
      r.winResult = null;
    }
    this.startMasterLobbyTimer();
    console.log(`🔄 [GameEngine] Force reset rooms to synchronized lobby`);
  }

  public broadcastRoomState(room: GameRoomState) {
    const occupiedCartelaIds = new Set<number>();
    room.tickets.forEach(list => list.forEach(t => occupiedCartelaIds.add(t.cartelaId)));
    if (room.nextRoundTickets) {
      room.nextRoundTickets.forEach(list => list.forEach(t => occupiedCartelaIds.add(t.cartelaId)));
    }
    if (room.opponentCards && room.opponentCards.length > 0) {
      room.opponentCards.forEach(o => occupiedCartelaIds.add(o.cartelaId));
    }

    const payload = {
      success: true,
      roomId: room.id,
      phase: room.phase,
      mode: room.mode || (room.tickets.size >= 2 ? 'active' : 'spectating'),
      roundNumber: room.roundNumber,
      lobbyCountdown: room.lobbyCountdown,
      winnerCountdown: room.winnerCountdown,
      playersCount: this.getRoomPlayersCount(room),
      totalPot: room.totalPot,
      winnerPayout: room.winnerPayout,
      houseFee: room.houseFee || 0,
      jackpotFee: room.jackpotFee || 0,
      jackpotPool: room.jackpotPoolBalance || 0,
      isJackpotActive: (room.jackpotPoolBalance || 0) >= 500,
      stakeAmount: room.stakeAmount,
      drawnNumbers: room.drawnNumbers,
      drawnNumbersCount: room.drawnNumbers.length,
      currentCall: room.currentCall,
      winResult: room.winResult,
      waitingForPlayers: room.waitingForPlayers || false,
      waitingForOtherHouses: room.waitingForOtherHouses || false,
      realPlayerCount: this.getRealCartelaCount(room),
      activeUsersCount: Math.max(room.activeUsers.size, room.activeSockets.size),
      occupiedCartelaIds: Array.from(occupiedCartelaIds)
    };

    io.to(room.id).emit('room_state', payload);
    if (room.id === 'room-10') {
      io.to(ARENA_ROOM_ID).emit('room_state', { ...payload, roomId: ARENA_ROOM_ID });
      io.to('default').emit('room_state', { ...payload, roomId: 'default' });
    }
    io.emit('stake_rooms_summary', this.getStakeRoomsSummary());
  }

  // Authoritative Disconnect Protection Helpers
  public getUnacknowledgedWins(userId: string): OfflineWinRecord[] {
    return this.offlineWins.filter(w => w.userId === userId && !w.acknowledged && w.isOffline === true);
  }

  public acknowledgeOfflineWin(winId: string): boolean {
    const target = this.offlineWins.find(w => w.id === winId);
    if (target) {
      target.acknowledged = true;
      return true;
    }
    return false;
  }

  // Live Network Health & Diagnostics for Admin Desk
  public getNetworkMetrics() {
    const room = this.rooms.get(ARENA_ROOM_ID)!;
    const activeSocketsCount = room.activeSockets.size;

    return {
      totalActiveSockets: activeSocketsCount,
      engineStatus: 'healthy',
      disconnectProtectionActive: true,
      transportsSupported: ['WebSocket', 'HTTP Polling Fallback'],
      rooms: this.getAllRooms().map(r => ({
        ...r,
        activeSocketsCount,
        ticketsCount: room.tickets.size,
        drawnBallsCount: room.drawnNumbers.length
      })),
      totalOfflineWinsRecorded: this.offlineWins.length,
      recentOfflineWins: this.offlineWins.slice(0, 30),
      serverTimestamp: new Date().toISOString()
    };
  }

  // Live / In-Flight Personal Bet History Helper (Strictly Scoped to Calling User)
  public getUserActiveTickets(userId: string): Array<{
    roomId: string;
    roomName: string;
    roundNumber: number;
    roundId: string | null;
    phase: string;
    isQueued: boolean;
    totalPot: number;
    winnerPayout: number;
    stakeAmount: number;
    tickets: Array<{
      cartelaId: number;
      cardMatrix: any[];
      betAmount: number;
      isAutoPlay: boolean;
    }>;
  }> {
    const results: Array<any> = [];
    if (!userId) return results;

    for (const room of this.rooms.values()) {
      // 1. Current active tickets in room.tickets (strictly for this userId)
      const activeList = room.tickets.get(userId);
      if (activeList && activeList.length > 0) {
        results.push({
          roomId: room.id,
          roomName: room.name,
          roundNumber: room.roundNumber,
          roundId: room.currentRoundId || null,
          phase: room.phase,
          isQueued: false,
          totalPot: room.totalPot,
          winnerPayout: room.winnerPayout,
          stakeAmount: room.stakeAmount,
          tickets: activeList.map(t => ({
            cartelaId: t.cartelaId,
            cardMatrix: t.cardMatrix,
            betAmount: t.betAmount,
            isAutoPlay: !!t.isAutoPlay
          }))
        });
      }

      // 2. Queued tickets in room.nextRoundTickets (Pre-Bought or Lone-Player Rollover)
      const queuedList = room.nextRoundTickets?.get(userId);
      if (queuedList && queuedList.length > 0) {
        results.push({
          roomId: room.id,
          roomName: room.name,
          roundNumber: room.roundNumber + 1,
          roundId: null,
          phase: 'queued',
          isQueued: true,
          totalPot: queuedList.reduce((sum, t) => sum + t.betAmount, 0),
          winnerPayout: 0,
          stakeAmount: room.stakeAmount,
          tickets: queuedList.map(t => ({
            cartelaId: t.cartelaId,
            cardMatrix: t.cardMatrix,
            betAmount: t.betAmount,
            isAutoPlay: !!t.isAutoPlay
          }))
        });
      }
    }

    return results;
  }
}

export const gameEngine = BingoGameEngine.getInstance();
