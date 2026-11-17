/**
 * server/game/KenoGameEngine.ts
 * Production-Ready Fast Keno Game Engine
 * 100% Real Neon PostgreSQL Ledger • Provably Fair SHA-256 RNG • Zero Mock/Seed Data
 * 60-Second Autonomous Lifecycle (30s Betting, 24s 20-Ball Reveal, 6s Settlement)
 */

import { EventEmitter } from 'events';
import { ATLAS_V_PAYTABLE, evaluateKenoTicket } from './kenoMath.ts';
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
  hotNumbers: number[]; // Top 5 drawn numbers
  coldNumbers: number[]; // Bottom 5 drawn numbers
  frequencyMap: Record<number, number>; // Number -> Count in last 100 rounds
}

export class KenoGameEngine extends EventEmitter {
  private static instance: KenoGameEngine;

  // Round Timing Configurations (Atlas-V Fast Keno: 60s Total Round Cycle)
  public readonly BETTING_SECONDS = 30; // 30s Betting Window
  public readonly DRAW_BALL_INTERVAL_MS = 1200; // 1.2s per ball (24s for 20 balls)
  public readonly SETTLEMENT_SECONDS = 6; // 6s Celebration & Settlement

  // State Machine Variables
  public currentRoundNumber = 1;
  public currentRoundDbId = '';
  public currentPhase: KenoPhase = 'betting';
  public phaseTimeRemaining = 30;
  public drawnBallsThisRound: number[] = [];
  public currentDrawSequence: number[] = [];

  // Provably Fair Cryptographic State
  public serverSeed = '';
  public serverSeedHash = '';
  public clientSeed = 'sonic-bingo-public';
  public nonce = 1;

  // Active Tickets & History (Synced with Neon DB)
  private activeTickets: Map<string, KenoTicket[]> = new Map(); // userId -> tickets[]
  private roundHistory: CompletedRound[] = [];
  private numberFrequencyLast100: Map<number, number> = new Map();

  // Internal Loop Timer
  private timerInterval: NodeJS.Timeout | null = null;
  private isDrawing = false;
  private isInitialized = false;

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

  /**
   * Initializes numbers 1 to 80 frequency counter
   */
  private initNumberFrequency(): void {
    for (let i = 1; i <= 80; i++) {
      this.numberFrequencyLast100.set(i, 0);
    }
  }

  /**
   * Initializes the engine state directly from Neon PostgreSQL (Zero Mock Data)
   */
  public async initializeFromDatabase(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('🎰 [Fast Keno Engine] Bootstrapping state from Neon PostgreSQL...');

      // 1. Get current sequential round number
      const seqRes = await query<{ max_round: string }>(
        `SELECT COALESCE(MAX(round_number), 0) as max_round FROM keno_rounds`
      );
      const maxRound = parseInt(seqRes.rows[0]?.max_round || '0', 10);
      this.currentRoundNumber = maxRound > 0 ? maxRound + 1 : 1;
      this.nonce = this.currentRoundNumber;

      console.log(`🎰 [Fast Keno Engine] Resuming at Round #${this.currentRoundNumber}`);

      // 2. Query settled historical rounds from DB to populate Hot/Cold analytics
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
      await this.startNewRound();
    } catch (err: any) {
      console.error('❌ [Fast Keno Engine Initialization Error]:', err?.message || err);
      // Fallback: start round cleanly
      this.isInitialized = true;
      await this.startNewRound();
    }
  }

  /**
   * Starts a brand new round with fresh cryptographic seed and persists commit to Neon DB
   */
  public async startNewRound(): Promise<void> {
    this.currentPhase = 'betting';
    this.phaseTimeRemaining = this.BETTING_SECONDS;
    this.drawnBallsThisRound = [];
    this.currentDrawSequence = [];
    this.activeTickets.clear();
    this.isDrawing = false;

    // Cryptographic Provably Fair Commit (CSPRNG 32 bytes)
    const seeds = ProvablyFairKeno.generateServerSeed();
    this.serverSeed = seeds.serverSeed;
    this.serverSeedHash = seeds.serverSeedHash;
    this.nonce = this.currentRoundNumber;

    // Persist new round to Neon DB with commit hash
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

    // Emit live round start event to all connected sockets
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

  /**
   * Core 1-second countdown clock for the betting phase
   */
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

  /**
   * Places an authenticated ticket bet for a real player with ACID balance debit
   */
  public async placeTicket(
    userId: string,
    selectedNumbers: number[],
    betAmount: number,
    isBonus = false
  ): Promise<{ success: boolean; error?: string; ticket?: KenoTicket; balanceAfter?: number }> {
    if (this.currentPhase !== 'betting') {
      return { success: false, error: 'Betting is closed for this round' };
    }

    if (this.phaseTimeRemaining < 1) {
      return { success: false, error: 'Round draw is starting, bets locked' };
    }

    // Spot count validation (1 to 10 spots)
    const spots = selectedNumbers.length;
    if (spots < 1 || spots > 10) {
      return { success: false, error: 'You must select between 1 and 10 numbers' };
    }

    // Range & uniqueness validation
    const unique = new Set(selectedNumbers);
    if (unique.size !== spots) {
      return { success: false, error: 'Duplicate numbers are not allowed on a single ticket' };
    }

    const allValid = selectedNumbers.every(n => Number.isInteger(n) && n >= 1 && n <= 80);
    if (!allValid) {
      return { success: false, error: 'All numbers must be integers between 1 and 80' };
    }

    // Stake validation (1.00 to 500.00 ETB - matching keno.html 2 ETB starting stake)
    if (betAmount < 1.00 || betAmount > 500.00) {
      return { success: false, error: 'Stake must be between 1.00 and 500.00 ETB' };
    }

    // Limit active tickets per user per round to 10
    const userActive = this.activeTickets.get(userId) || [];
    if (userActive.length >= 10) {
      return { success: false, error: 'Maximum 10 tickets per round reached' };
    }

    // Atomic Neon Balance Deduction
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
    let ticketDbId = '';

    // Persist ticket to Neon DB
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
          isBonus
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
      isBonus,
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

  /**
   * Executes the 20-Ball Live Draw Phase
   */
  private async startDrawPhase(): Promise<void> {
    if (this.isDrawing) return;
    this.isDrawing = true;
    this.currentPhase = 'drawing';

    // Generate deterministic 20-ball draw from Provably Fair seed
    this.currentDrawSequence = ProvablyFairKeno.generateDraw(this.serverSeed, this.clientSeed, this.nonce);
    this.drawnBallsThisRound = [];

    // Update round status in Neon DB
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

    // Sequentially emit all 20 balls with exact 1.2s cadence
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

      await new Promise(res => setTimeout(res, this.DRAW_BALL_INTERVAL_MS));
    }

    await this.settleRound();
  }

  /**
   * Settles all placed tickets, evaluates hits, and credits winnings via ACID transactions
   */
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

        // Credit winnings atomically to player's Neon wallet
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

        // Update ticket in Neon DB
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

    // Update Hot/Cold statistical frequencies in memory
    for (const n of this.drawnBallsThisRound) {
      this.numberFrequencyLast100.set(n, (this.numberFrequencyLast100.get(n) || 0) + 1);
    }

    // Update round status in Neon DB
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

    // Record round in memory history
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

    // Reveal server seed for provably fair verification
    this.emit('round:settled', {
      roundNumber: this.currentRoundNumber,
      drawnNumbers: this.drawnBallsThisRound,
      serverSeed: this.serverSeed,
      serverSeedHash: this.serverSeedHash,
      totalWagered: totalRoundWagered,
      totalPayout: totalRoundPayout,
      settledTicketsCount: settledTickets.length
    });

    // Schedule next round after settlement window
    setTimeout(() => {
      this.currentRoundNumber++;
      this.startNewRound().catch(err => {
        console.error('❌ [Fast Keno startNewRound Error]:', err);
      });
    }, this.SETTLEMENT_SECONDS * 1000);
  }

  /**
   * Returns calculated Hot (top 5) and Cold (bottom 5) statistics
   */
  public getHotColdStats(): KenoHotColdStats {
    const entries = Array.from(this.numberFrequencyLast100.entries());
    entries.sort((a, b) => b[1] - a[1]); // Descending by frequency

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

  /**
   * Returns current round status for joining clients
   */
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

  /**
   * Returns all active tickets for a user
   */
  public getUserTickets(userId: string): KenoTicket[] {
    return this.activeTickets.get(userId) || [];
  }
}

export const kenoEngine = KenoGameEngine.getInstance();

