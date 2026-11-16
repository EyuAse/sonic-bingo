import { EventEmitter } from 'events';
import { ATLAS_V_PAYTABLE, evaluateKenoTicket } from './kenoMath.ts';
import { ProvablyFairKeno } from './provablyFair.ts';
import { walletAdapter, IWalletAdapter } from '../db/walletAdapter.ts';

export type KenoPhase = 'betting' | 'drawing' | 'settling';

export interface KenoTicket {
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
  public currentRoundNumber = 1001;
  public currentPhase: KenoPhase = 'betting';
  public phaseTimeRemaining = 30;
  public drawnBallsThisRound: number[] = [];
  public currentDrawSequence: number[] = [];

  // Provably Fair State
  public serverSeed = '';
  public serverSeedHash = '';
  public clientSeed = 'sonic-bingo-public';
  public nonce = 1001;

  // Active Tickets & History
  private activeTickets: Map<string, KenoTicket[]> = new Map(); // userId -> tickets[]
  private roundHistory: CompletedRound[] = [];
  private numberFrequencyLast100: Map<number, number> = new Map();

  // Internal Loop Timer
  private timerInterval: NodeJS.Timeout | null = null;
  private isDrawing = false;

  private constructor(private wallet: IWalletAdapter = walletAdapter) {
    super();
    this.initNumberFrequency();
    this.seedInitialHistory();
    this.startNewRound();
  }

  public static getInstance(wallet?: IWalletAdapter): KenoGameEngine {
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
   * Pre-seeds recent round history so Hot/Cold stats and recent draws display immediately
   */
  private seedInitialHistory(): void {
    const now = Date.now();
    for (let i = 14; i >= 1; i--) {
      const { serverSeed, serverSeedHash } = ProvablyFairKeno.generateServerSeed();
      const rNum = this.currentRoundNumber - i;
      const drawn = ProvablyFairKeno.generateDraw(serverSeed, this.clientSeed, rNum);

      this.roundHistory.push({
        roundNumber: rNum,
        drawnNumbers: drawn,
        serverSeed,
        serverSeedHash,
        clientSeed: this.clientSeed,
        nonce: rNum,
        totalBets: Math.floor(10 + Math.random() * 25),
        totalPayout: Math.floor(150 + Math.random() * 800),
        drawnAt: now - i * 30000
      });

      // Accumulate frequency
      for (const n of drawn) {
        this.numberFrequencyLast100.set(n, (this.numberFrequencyLast100.get(n) || 0) + 1);
      }
    }
  }

  /**
   * Starts a brand new round with fresh cryptographic seed
   */
  public startNewRound(): void {
    this.currentPhase = 'betting';
    this.phaseTimeRemaining = this.BETTING_SECONDS;
    this.drawnBallsThisRound = [];
    this.currentDrawSequence = [];
    this.activeTickets.clear();
    this.isDrawing = false;

    // Cryptographic Provably Fair Commit
    const seeds = ProvablyFairKeno.generateServerSeed();
    this.serverSeed = seeds.serverSeed;
    this.serverSeedHash = seeds.serverSeedHash;
    this.nonce = this.currentRoundNumber;

    // Emit live round start event
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
        this.startDrawPhase();
      }
    }, 1000);
  }

  /**
   * Places an authenticated ticket bet for a player
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
      return { success: false, error: 'Round is starting draw, bets locked' };
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

    // Stake validation
    if (betAmount < 1.00 || betAmount > 5000.00) {
      return { success: false, error: 'Stake must be between 1.00 and 5,000.00 ETB' };
    }

    // Atomic Balance Deduction
    const debit = await this.wallet.deductBet(userId, betAmount, `round-${this.currentRoundNumber}`, isBonus);
    if (!debit.success) {
      return { success: false, error: debit.error || 'Insufficient funds' };
    }

    const ticket: KenoTicket = {
      ticketId: `KT-${this.currentRoundNumber}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`,
      userId,
      roundNumber: this.currentRoundNumber,
      selectedNumbers: [...selectedNumbers].sort((a, b) => a - b),
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

    this.emit('round:draw_started', {
      roundNumber: this.currentRoundNumber,
      serverSeedHash: this.serverSeedHash
    });

    // Sequentially emit all 20 balls with exact Atlas-V timing (~450ms)
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
   * Settles all placed tickets, evaluates hits, and credits winnings
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

        if (ticket.payoutAmount > 0) {
          userTotalWin += ticket.payoutAmount;
          totalRoundPayout += ticket.payoutAmount;
          await this.wallet.creditWin(userId, ticket.payoutAmount, `round-${this.currentRoundNumber}`, ticket.ticketId);
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

    // Update Hot/Cold statistical frequencies
    for (const n of this.drawnBallsThisRound) {
      this.numberFrequencyLast100.set(n, (this.numberFrequencyLast100.get(n) || 0) + 1);
    }

    // Record round in history
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

    // Wait 5 seconds before starting next round
    setTimeout(() => {
      this.currentRoundNumber++;
      this.startNewRound();
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

