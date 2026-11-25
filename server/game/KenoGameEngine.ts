/**
 * server/game/KenoGameEngine.ts
 * Production-Ready Fast Keno Game Engine
 * 100% Real Neon PostgreSQL Ledger • Provably Fair SHA-256 RNG • Idle-Room DB Guard
 * Zero impact on BingoGameEngine or Neon free-tier writes when Keno has 0 active players.
 */

import { EventEmitter } from 'events';
import { evaluateKenoTicket } from './kenoMath.ts';
import { ProvablyFairKeno } from './provablyFair.ts';
import { postgresWalletAdapter, PostgresWalletAdapter } from '../db/PostgresWalletAdapter.ts';
import { query } from '../db.ts';

export type KenoPhase = 'betting' | 'drawing' | 'settling';

export interface KenoTicket {
  ticketDbId?: string;
  ticketId: string;
  userId: string;
  roundNumber: number;
  selectedNumbers: number[];
  spotCount: number;
  betAmount: number;
  isBonus: boolean;
  hitNumbers: number[];
  hitCount: number;
  multiplier: number;
  payoutAmount: number;
  status: 'active' | 'won' | 'lost';
  createdAt: number;
}

export interface CompletedRound {
  roundNumber: number;
  drawnNumbers: number[];
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  totalBets: number;
  totalPayout: number;
  drawnAt: number;
}

export interface KenoHotColdStats {
  hotNumbers: number[];
  coldNumbers: number[];
  frequencyMap: Record<number, number>;
}

export class KenoGameEngine extends EventEmitter {
  private static instance: KenoGameEngine;

  public readonly BETTING_SECONDS = 30;
  public readonly DRAW_BALL_INTERVAL_MS = 1200;
  public readonly SETTLEMENT_SECONDS = 6;
  public readonly MIN_BET = 2.00;
  public readonly MAX_TICKET_BET = 500.00;
  public readonly MAX_ROUND_BET = 1000.00;

  public currentRoundNumber = 1;
  public currentRoundDbId = '';
  public currentPhase: KenoPhase = 'betting';
  public phaseTimeRemaining = 30;
  public drawnBallsThisRound: number[] = [];
  public currentDrawSequence: number[] = [];

  public serverSeed = '';
  public serverSeedHash = '';
  public clientSeed = 'sonic-bingo-public';
  public nonce = 1;

  private activeTickets: Map<string, KenoTicket[]> = new Map();
  private roundHistory: CompletedRound[] = [];
  private numberFrequencyLast100: Map<number, number> = new Map();

  private timerInterval: NodeJS.Timeout | null = null;
  private settlementTimer: NodeJS.Timeout | null = null;
  private isDrawing = false;
  private isInitialized = false;
  private isIdlePaused = true;
  public isMaintenancePaused = false;
  private activeWatchersCount = 0;

  private constructor(private wallet: PostgresWalletAdapter = postgresWalletAdapter) {
    super();
    this.initNumberFrequency();
  }

  public static getInstance(wallet?: PostgresWalletAdapter): KenoGameEngine {
    if (!KenoGameEngine.instance) {
      KenoGameEngine.instance = new KenoGameEngine(wallet);
    }
    return KenoGameEngine.instance;
  }

  private initNumberFrequency(): void {
    for (let i = 1; i <= 80; i++) {
      this.numberFrequencyLast100.set(i, 0);
    }
  }

  public setWatcherCount(count: number): void {
    this.activeWatchersCount = Math.max(0, count);
  }

  /**
   * Ensures an active round is running when at least one player opens Keno.
   */
  public async ensureActiveLoop(): Promise<void> {
    if (!this.isInitialized) {
      await this.initializeFromDatabase();
    }
    if (this.isMaintenancePaused) {
      return;
    }
    if (this.isIdlePaused) {
      this.isIdlePaused = false;
      await this.startNewRound();
    }
  }

  /**
   * Loads historical Keno sequence & stats from Neon PostgreSQL without burning idle round writes.
   */
  public async initializeFromDatabase(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('🎰 [Fast Keno Engine] Bootstrapping history from Neon PostgreSQL...');

      // Clean up any stale interrupted rounds left in 'betting' or 'drawing' across restarts
      await query(
        `UPDATE keno_rounds
         SET status = 'cancelled'
         WHERE status IN ('betting', 'drawing')
           AND started_at < NOW() - INTERVAL '5 minutes'`
      ).catch(() => {});

      const seqRes = await query<{ max_round: string }>(
        `SELECT COALESCE(MAX(round_number), 0) as max_round FROM keno_rounds`
      );
      const maxRound = parseInt(seqRes.rows[0]?.max_round || '0', 10);
      this.currentRoundNumber = maxRound > 0 ? maxRound + 1 : 1;
      this.nonce = this.currentRoundNumber;

      const historyRes = await query<{
        round_number: string;
        drawn_numbers: number[];
        server_seed: string;
        server_seed_hash: string;
        client_seed: string;
        nonce: string;
        total_bets_count: number;
        total_payout: string;
        drawn_at: string;
      }>(
        `SELECT 
           round_number, drawn_numbers, server_seed, server_seed_hash, 
           client_seed, nonce, total_bets_count, total_payout,
           COALESCE(EXTRACT(EPOCH FROM settled_at) * 1000, EXTRACT(EPOCH FROM started_at) * 1000) as drawn_at
         FROM keno_rounds 
         WHERE status = 'settled' 
         ORDER BY round_number DESC 
         LIMIT 100`
      );

      this.roundHistory = [];
      for (const row of historyRes.rows) {
        const drawn = row.drawn_numbers || [];
        this.roundHistory.push({
          roundNumber: parseInt(row.round_number, 10),
          drawnNumbers: drawn,
          serverSeed: row.server_seed,
          serverSeedHash: row.server_seed_hash,
          clientSeed: row.client_seed,
          nonce: parseInt(row.nonce, 10),
          totalBets: row.total_bets_count || 0,
          totalPayout: parseFloat(row.total_payout || '0.00'),
          drawnAt: parseFloat(row.drawn_at || String(Date.now()))
        });

        for (const n of drawn) {
          this.numberFrequencyLast100.set(n, (this.numberFrequencyLast100.get(n) || 0) + 1);
        }
      }

      this.isInitialized = true;

      if (this.activeWatchersCount > 0) {
        this.isIdlePaused = false;
        await this.startNewRound();
      } else {
        this.isIdlePaused = true;
        console.log(`🎰 [Fast Keno Engine] Ready at Round #${this.currentRoundNumber} (Idle until a player opens Keno)`);
      }
    } catch (err: any) {
      console.error('❌ [Fast Keno Engine Initialization Error]:', err?.message || err);
      this.isInitialized = true;
      this.isIdlePaused = true;
    }
  }

  /**
   * Starts a fresh round if watchers or active tickets exist; otherwise enters zero-DB idle standby.
   */
  public async startNewRound(): Promise<void> {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.settlementTimer) {
      clearTimeout(this.settlementTimer);
      this.settlementTimer = null;
    }

    // Clear previous round's tickets here (after the full 6s settlement window completes)
    this.activeTickets.clear();

    if (this.isMaintenancePaused || (this.activeWatchersCount === 0 && this.activeTickets.size === 0)) {
      this.isIdlePaused = true;
      this.currentPhase = 'betting';
      this.phaseTimeRemaining = this.BETTING_SECONDS;
      this.drawnBallsThisRound = [];
      this.currentDrawSequence = [];
      this.isDrawing = false;
      return;
    }

    this.isIdlePaused = false;
    this.currentPhase = 'betting';
    this.phaseTimeRemaining = this.BETTING_SECONDS;
    this.drawnBallsThisRound = [];
    this.currentDrawSequence = [];
    this.activeTickets.clear();
    this.isDrawing = false;

    const seeds = ProvablyFairKeno.generateServerSeed();
    this.serverSeed = seeds.serverSeed;
    this.serverSeedHash = seeds.serverSeedHash;
    this.nonce = this.currentRoundNumber;

    try {
      const insertRes = await query<{ id: string }>(
        `INSERT INTO keno_rounds (
           round_number, status, server_seed, server_seed_hash, client_seed, nonce
         ) VALUES ($1, 'betting', $2, $3, $4, $5)
         RETURNING id`,
        [this.currentRoundNumber, this.serverSeed, this.serverSeedHash, this.clientSeed, this.nonce]
      );
      this.currentRoundDbId = insertRes.rows[0]?.id || '';
    } catch (dbErr: any) {
      console.error(`⚠️ [Fast Keno] Failed to persist Round #${this.currentRoundNumber} init to DB:`, dbErr?.message || dbErr);
    }

    this.emit('round:started', {
      roundNumber: this.currentRoundNumber,
      phase: this.currentPhase,
      timeRemaining: this.phaseTimeRemaining,
      serverSeedHash: this.serverSeedHash,
      clientSeed: this.clientSeed,
      nonce: this.nonce
    });

    this.startCountdownLoop();
  }

  private startCountdownLoop(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);

    this.timerInterval = setInterval(() => {
      if (this.currentPhase !== 'betting') return;

      this.phaseTimeRemaining--;
      this.emit('round:tick', {
        roundNumber: this.currentRoundNumber,
        phase: this.currentPhase,
        timeRemaining: this.phaseTimeRemaining
      });

      if (this.phaseTimeRemaining <= 0) {
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.startDrawPhase().catch(err => {
          console.error('❌ [Fast Keno Draw Error]:', err);
        });
      }
    }, 1000);
  }

  public async placeTicket(
    userId: string,
    selectedNumbers: number[],
    betAmount: number,
    isBonus = false
  ): Promise<{ success: boolean; error?: string; ticket?: KenoTicket; balanceAfter?: number }> {
    if (this.isMaintenancePaused) {
      return { success: false, error: 'Fast Keno is temporarily paused for maintenance' };
    }

    await this.ensureActiveLoop();

    if (this.currentPhase !== 'betting') {
      return { success: false, error: 'Betting is closed for this round' };
    }

    if (this.phaseTimeRemaining < 1) {
      return { success: false, error: 'Round draw is starting, bets locked' };
    }

    const spots = selectedNumbers.length;
    if (spots < 1 || spots > 10) {
      return { success: false, error: 'You must select between 1 and 10 numbers' };
    }

    const unique = new Set(selectedNumbers);
    if (unique.size !== spots) {
      return { success: false, error: 'Duplicate numbers are not allowed on a single ticket' };
    }

    const allValid = selectedNumbers.every(n => Number.isInteger(n) && n >= 1 && n <= 80);
    if (!allValid) {
      return { success: false, error: 'All numbers must be integers between 1 and 80' };
    }

    if (!Number.isFinite(betAmount) || betAmount < this.MIN_BET || betAmount > this.MAX_TICKET_BET) {
      return { success: false, error: `Stake must be between ${this.MIN_BET.toFixed(2)} and ${this.MAX_TICKET_BET.toFixed(2)} ETB` };
    }

    const userActive = this.activeTickets.get(userId) || [];
    if (userActive.length >= 10) {
      return { success: false, error: 'Maximum 10 tickets per round reached' };
    }

    const currentUserRoundStake = userActive.reduce((sum, t) => sum + Number(t.betAmount || 0), 0);
    if (currentUserRoundStake + betAmount > this.MAX_ROUND_BET) {
      const remaining = Math.max(0, this.MAX_ROUND_BET - currentUserRoundStake);
      return {
        success: false,
        error: `Max ${this.MAX_ROUND_BET.toFixed(0)} ETB total per round reached (Remaining: ${remaining.toFixed(2)} ETB)`
      };
    }

    const debit = await this.wallet.deductBet(
      userId,
      betAmount,
      this.currentRoundDbId || `round-${this.currentRoundNumber}`,
      isBonus,
      this.currentRoundNumber
    );
    if (!debit.success) {
      return { success: false, error: debit.error || 'Insufficient funds' };
    }

    const sortedNumbers = [...selectedNumbers].sort((a, b) => a - b);
    const effectiveIsBonus = Boolean(isBonus || debit.usedBonus);
    let ticketDbId = '';

    try {
      const resolvedUserId = await this.wallet.resolveUserId(userId);
      const ticketInsertRes = await query<{ id: string }>(
        `INSERT INTO keno_tickets (
           round_id, round_number, user_id, selected_numbers, spot_count, bet_amount, is_bonus, status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
         RETURNING id`,
        [
          this.currentRoundDbId,
          this.currentRoundNumber,
          resolvedUserId,
          sortedNumbers,
          spots,
          betAmount,
          effectiveIsBonus
        ]
      );
      ticketDbId = ticketInsertRes.rows[0]?.id || '';
    } catch (insertErr: any) {
      console.error(`⚠️ [Fast Keno] Failed to persist ticket to DB:`, insertErr?.message || insertErr);
    }

    const ticket: KenoTicket = {
      ticketDbId,
      ticketId: ticketDbId || `KT-${this.currentRoundNumber}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`,
      userId,
      roundNumber: this.currentRoundNumber,
      selectedNumbers: sortedNumbers,
      spotCount: spots,
      betAmount,
      isBonus: effectiveIsBonus,
      hitNumbers: [],
      hitCount: 0,
      multiplier: 0,
      payoutAmount: 0,
      status: 'active',
      createdAt: Date.now()
    };

    if (!this.activeTickets.has(userId)) {
      this.activeTickets.set(userId, []);
    }
    this.activeTickets.get(userId)!.push(ticket);

    this.emit('ticket:placed', {
      ticket,
      balanceAfter: debit.balanceAfter
    });

    return {
      success: true,
      ticket,
      balanceAfter: debit.balanceAfter
    };
  }

  private async startDrawPhase(): Promise<void> {
    if (this.isDrawing) return;
    this.isDrawing = true;
    this.currentPhase = 'drawing';

    this.currentDrawSequence = ProvablyFairKeno.generateDraw(this.serverSeed, this.clientSeed, this.nonce);
    this.drawnBallsThisRound = [];

    if (this.currentRoundDbId) {
      query(
        `UPDATE keno_rounds SET status = 'drawing', drawn_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [this.currentRoundDbId]
      ).catch(() => {});
    }

    this.emit('round:draw_started', {
      roundNumber: this.currentRoundNumber,
      serverSeedHash: this.serverSeedHash
    });

    for (let index = 0; index < this.currentDrawSequence.length; index++) {
      const ball = this.currentDrawSequence[index];
      this.drawnBallsThisRound.push(ball);

      this.emit('round:ball_drawn', {
        roundNumber: this.currentRoundNumber,
        ball,
        ballIndex: index + 1,
        totalDrawn: this.drawnBallsThisRound.length,
        drawnBalls: [...this.drawnBallsThisRound]
      });

      if (index < this.currentDrawSequence.length - 1) {
        await new Promise(res => setTimeout(res, this.DRAW_BALL_INTERVAL_MS));
      }
    }

    // Allow ball 20 to complete its emergence & flight animation before revealing win/loss banner
    await new Promise(res => setTimeout(res, 900));

    await this.settleRound();
  }

  private async settleRound(): Promise<void> {
    this.currentPhase = 'settling';
    this.phaseTimeRemaining = this.SETTLEMENT_SECONDS;

    let totalRoundWagered = 0;
    let totalRoundPayout = 0;
    const settledTickets: KenoTicket[] = [];

    for (const [userId, tickets] of this.activeTickets.entries()) {
      let userTotalWin = 0;

      for (const ticket of tickets) {
        totalRoundWagered += ticket.betAmount;

        const evalResult = evaluateKenoTicket(ticket.selectedNumbers, this.drawnBallsThisRound);
        ticket.hitNumbers = evalResult.hits;
        ticket.hitCount = evalResult.hitCount;
        ticket.multiplier = evalResult.multiplier;
        ticket.payoutAmount = Number((ticket.betAmount * evalResult.multiplier).toFixed(2));
        ticket.status = ticket.payoutAmount > 0 ? 'won' : 'lost';

        settledTickets.push(ticket);

        if (ticket.payoutAmount > 0) {
          userTotalWin += ticket.payoutAmount;
          totalRoundPayout += ticket.payoutAmount;
          await this.wallet.creditWin(
            userId,
            ticket.payoutAmount,
            this.currentRoundDbId,
            ticket.ticketId,
            this.currentRoundNumber
          );
        }

        if (ticket.ticketDbId) {
          query(
            `UPDATE keno_tickets 
             SET hit_numbers = $1, hit_count = $2, multiplier = $3, payout_amount = $4, status = $5, settled_at = CURRENT_TIMESTAMP
             WHERE id = $6`,
            [
              ticket.hitNumbers,
              ticket.hitCount,
              ticket.multiplier,
              ticket.payoutAmount,
              ticket.status,
              ticket.ticketDbId
            ]
          ).catch(e => console.error(`⚠️ [Fast Keno] Ticket DB update error:`, e?.message));
        }
      }

      const latestBalance = await this.wallet.getBalance(userId);
      this.emit('player:settled', {
        userId,
        roundNumber: this.currentRoundNumber,
        tickets,
        userTotalWin,
        balanceAfter: latestBalance.balance
      });
    }

    for (const n of this.drawnBallsThisRound) {
      this.numberFrequencyLast100.set(n, (this.numberFrequencyLast100.get(n) || 0) + 1);
    }

    if (this.currentRoundDbId) {
      query(
        `UPDATE keno_rounds 
         SET status = 'settled', drawn_numbers = $1, total_bets_count = $2, total_wagered = $3, total_payout = $4, settled_at = CURRENT_TIMESTAMP
         WHERE id = $5`,
        [
          this.drawnBallsThisRound,
          settledTickets.length,
          totalRoundWagered,
          totalRoundPayout,
          this.currentRoundDbId
        ]
      ).catch(e => console.error(`⚠️ [Fast Keno] Round settlement DB update error:`, e?.message));
    }

    const completedRound: CompletedRound = {
      roundNumber: this.currentRoundNumber,
      drawnNumbers: [...this.drawnBallsThisRound],
      serverSeed: this.serverSeed,
      serverSeedHash: this.serverSeedHash,
      clientSeed: this.clientSeed,
      nonce: this.nonce,
      totalBets: settledTickets.length,
      totalPayout: totalRoundPayout,
      drawnAt: Date.now()
    };

    this.roundHistory.unshift(completedRound);
    if (this.roundHistory.length > 100) {
      this.roundHistory.pop();
    }

    this.emit('round:settled', {
      roundNumber: this.currentRoundNumber,
      drawnNumbers: this.drawnBallsThisRound,
      serverSeed: this.serverSeed,
      serverSeedHash: this.serverSeedHash,
      totalWagered: totalRoundWagered,
      totalPayout: totalRoundPayout,
      settledTicketsCount: settledTickets.length
    });

    this.settlementTimer = setTimeout(() => {
      this.currentRoundNumber++;
      this.startNewRound().catch(err => {
        console.error('❌ [Fast Keno startNewRound Error]:', err);
      });
    }, this.SETTLEMENT_SECONDS * 1000);
  }

  public getHotColdStats(): KenoHotColdStats {
    const entries = Array.from(this.numberFrequencyLast100.entries());
    entries.sort((a, b) => b[1] - a[1]);

    const hotNumbers = entries.slice(0, 5).map(e => e[0]);
    const coldNumbers = entries.slice(-5).map(e => e[0]);
    const frequencyMap: Record<number, number> = {};
    for (const [num, count] of entries) {
      frequencyMap[num] = count;
    }

    return {
      hotNumbers,
      coldNumbers,
      frequencyMap
    };
  }

  public getCurrentState() {
    return {
      roundNumber: this.currentRoundNumber,
      phase: this.currentPhase,
      timeRemaining: this.phaseTimeRemaining,
      serverSeedHash: this.serverSeedHash,
      drawnBalls: [...this.drawnBallsThisRound],
      hotCold: this.getHotColdStats(),
      recentHistory: this.roundHistory.slice(0, 10).map(r => ({
        roundNumber: r.roundNumber,
        drawnNumbers: r.drawnNumbers,
        serverSeed: r.serverSeed,
        drawnAt: r.drawnAt
      }))
    };
  }

  public getUserTickets(userId: string): KenoTicket[] {
    return this.activeTickets.get(userId) || [];
  }

  public getAllActiveTickets(): KenoTicket[] {
    const all: KenoTicket[] = [];
    for (const tickets of this.activeTickets.values()) {
      all.push(...tickets);
    }
    return all;
  }

  public pauseMaintenance(): void {
    this.isMaintenancePaused = true;
  }

  public resumeMaintenance(): void {
    this.isMaintenancePaused = false;
    void this.ensureActiveLoop();
  }

  public getAdminLiveSnapshot() {
    let activeTicketsCount = 0;
    let activeStakedTotal = 0;
    for (const tickets of this.activeTickets.values()) {
      activeTicketsCount += tickets.length;
      for (const t of tickets) {
        activeStakedTotal += Number(t.betAmount || 0);
      }
    }

    return {
      roundNumber: this.currentRoundNumber,
      phase: this.currentPhase,
      timeRemaining: this.phaseTimeRemaining,
      watchersCount: this.activeWatchersCount,
      activeTicketsCount,
      activeStakedTotal: Number(activeStakedTotal.toFixed(2)),
      isMaintenancePaused: this.isMaintenancePaused,
      isIdlePaused: this.isIdlePaused,
      serverSeedHash: this.serverSeedHash
    };
  }
}

export const kenoEngine = KenoGameEngine.getInstance();
