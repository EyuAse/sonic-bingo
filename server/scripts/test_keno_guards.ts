import assert from 'node:assert/strict';
import { PostgresWalletAdapter } from '../db/PostgresWalletAdapter.js';
import { KenoGameEngine } from '../game/KenoGameEngine.js';

interface DebitResult {
    success: boolean;
    realDeducted: number;
    bonusDeducted: number;
    alreadyProcessed?: boolean;
    usedBonus?: boolean;
    balanceAfter?: number;
    error?: string;
}

interface CreditResult {
    success: boolean;
    newBalance?: number;
    error?: string;
}

class MockWalletAdapter {
    public deductAttempts = 0;
    public actualBalanceDebits = 0;
    public refundCalls = 0;
    public creditCalls = 0;
    public balance = 1000;
    public seenIdempotencyKeys = new Set<string>();
    public onDeductHook?: () => void;

    async resolveUserId(userId: string): Promise<string> {
        return userId;
    }

    async getBalance(_userId: string): Promise<{ balance: number; bonus: number }> {
        return { balance: this.balance, bonus: 0 };
    }

    async deductBet(
        _userId: string,
        amount: number,
        _roundId: string,
        _isBonus: boolean,
        _roundNumber?: number,
        idempotencyKey?: string
    ): Promise<DebitResult> {
        this.deductAttempts += 1;
        if (this.onDeductHook) {
            this.onDeductHook();
        }
        if (idempotencyKey && this.seenIdempotencyKeys.has(idempotencyKey)) {
            return {
                success: true,
                realDeducted: 0,
                bonusDeducted: 0,
                alreadyProcessed: true,
                balanceAfter: this.balance,
            };
        }
        if (this.balance < amount) {
            return { success: false, realDeducted: 0, bonusDeducted: 0, error: 'Insufficient balance' };
        }
        if (idempotencyKey) {
            this.seenIdempotencyKeys.add(idempotencyKey);
        }
        this.actualBalanceDebits += 1;
        this.balance -= amount;
        return {
            success: true,
            realDeducted: amount,
            bonusDeducted: 0,
            balanceAfter: this.balance,
        };
    }

    async refundBet(
        _userId: string,
        realAmount: number,
        bonusAmount: number,
        _roundId: string,
        _referenceCode: string,
        _roundNumber?: number
    ): Promise<CreditResult> {
        this.refundCalls += 1;
        this.balance += realAmount + bonusAmount;
        return { success: true, newBalance: this.balance };
    }

    async creditWin(
        _userId: string,
        amount: number,
        _roundId: string,
        _referenceCode: string,
        _roundNumber?: number
    ): Promise<CreditResult> {
        this.creditCalls += 1;
        this.balance += amount;
        return { success: true, newBalance: this.balance };
    }
}

async function main() {
    // 1. Verify PostgresWalletAdapter exports expected atomic/idempotent methods
    assert.equal(typeof PostgresWalletAdapter.prototype.deductBet, 'function', 'PostgresWalletAdapter.deductBet must exist');
    assert.equal(typeof PostgresWalletAdapter.prototype.refundBet, 'function', 'PostgresWalletAdapter.refundBet must exist');
    assert.equal(typeof PostgresWalletAdapter.prototype.creditWin, 'function', 'PostgresWalletAdapter.creditWin must exist');

    // 2. Test idempotencyKey deduplication in KenoGameEngine.placeTicket
    const wallet1 = new MockWalletAdapter();
    const engine1 = new (KenoGameEngine as any)(wallet1);
    (engine1 as any).isInitialized = true;
    (engine1 as any).isIdlePaused = false;
    (engine1 as any).activeWatchersCount = 1;
    (engine1 as any).currentPhase = 'betting';
    (engine1 as any).phaseTimeRemaining = 20;
    (engine1 as any).currentRoundNumber = 101;
    (engine1 as any).currentRoundDbId = ''; // Skip live DB insert in offline unit test

    const res1 = await engine1.placeTicket('user-idem-1', [1, 2, 3, 4], 50, false, 'idem-key-123');
    assert.equal(res1.success, true, 'First placeTicket should succeed');
    assert.equal(wallet1.actualBalanceDebits, 1, 'First bet should debit balance once');

    const res2 = await engine1.placeTicket('user-idem-1', [1, 2, 3, 4], 50, false, 'idem-key-123');
    assert.equal(res2.success, true, 'Duplicate idempotencyKey should succeed with cached ticket');
    assert.equal(wallet1.actualBalanceDebits, 1, 'Duplicate idempotencyKey must debit balance only once');
    assert.equal(wallet1.balance, 950, 'Balance must reflect single 50 ETB deduction');
    assert.equal(res2.ticket?.ticketId, res1.ticket?.ticketId, 'Duplicate idempotencyKey must return identical ticketId');

    // 3. Test mid-debit phase transition to 'drawing' triggers automatic refundBet
    const wallet2 = new MockWalletAdapter();
    const engine2 = new (KenoGameEngine as any)(wallet2);
    (engine2 as any).isInitialized = true;
    (engine2 as any).isIdlePaused = false;
    (engine2 as any).activeWatchersCount = 1;
    (engine2 as any).currentPhase = 'betting';
    (engine2 as any).phaseTimeRemaining = 5;
    (engine2 as any).currentRoundNumber = 102;
    (engine2 as any).currentRoundDbId = '';
    wallet2.onDeductHook = () => {
        (engine2 as any).currentPhase = 'drawing';
        (engine2 as any).isDrawing = true;
    };

    const resMidDraw = await engine2.placeTicket('user-race-1', [5, 6, 7], 25, false, 'idem-race-1');
    assert.equal(resMidDraw.success, false, 'Mid-debit transition to drawing must reject bet');
    assert.equal(wallet2.refundCalls, 1, 'Mid-debit phase transition must call refundBet once');
    assert.equal(wallet2.balance, 1000, 'Mid-debit rejection must leave wallet balance intact');

    // 4. Test background settlement with 0 active watchers and consumeRecentUserSettlement
    const wallet3 = new MockWalletAdapter();
    const engine3 = new (KenoGameEngine as any)(wallet3);
    (engine3 as any).isInitialized = true;
    (engine3 as any).activeWatchersCount = 0;
    (engine3 as any).currentPhase = 'drawing';
    (engine3 as any).currentRoundNumber = 103;
    (engine3 as any).currentRoundDbId = '';
    (engine3 as any).drawnBallsThisRound = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
    (engine3 as any).activeTickets.set('user-away-1', [
        {
            ticketDbId: '',
            ticketId: 'ticket-bg-1',
            userId: 'user-away-1',
            roundNumber: 103,
            selectedNumbers: [1, 2, 3, 4],
            spotCount: 4,
            betAmount: 20,
            isBonus: false,
            hitNumbers: [],
            hitCount: 0,
            multiplier: 0,
            payoutAmount: 0,
            status: 'active',
            createdAt: Date.now(),
            realDeducted: 20,
            bonusDeducted: 0,
        },
    ]);

    await (engine3 as any).settleRound();

    assert.ok(wallet3.creditCalls >= 1, 'Winning background ticket (4/4 hits) must credit win');
    const awayNotice = engine3.consumeRecentUserSettlement('user-away-1');
    assert.ok(awayNotice !== null, 'Background settlement with 0 watchers must record recent away settlement');
    assert.equal(awayNotice.roundNumber, 103, 'Away settlement must preserve settled roundNumber');
    assert.ok(awayNotice.totalWin > 0, 'Away settlement must report winning payout');
    assert.equal(
        engine3.consumeRecentUserSettlement('user-away-1'),
        null,
        'consumeRecentUserSettlement must be single-consumption'
    );

    console.log('ALL KENO GUARD CHECKS PASSED');
    process.exit(0);
}

main().catch((err) => {
    console.error('KENO GUARD TEST FAILED:', err);
    process.exit(1);
});
