import assert from 'node:assert/strict';
import { ProvablyFairKeno } from '../game/provablyFair.js';
import { KenoGameEngine } from '../game/KenoGameEngine.js';

class MockWallet {
    async resolveUserId(id: string) { return id; }
    async getBalance() { return { balance: 10000, bonus: 0 }; }
    async deductBet() { return { success: true, realDeducted: 10, bonusDeducted: 0, balanceAfter: 9990 }; }
    async refundBet() { return { success: true, newBalance: 10000 }; }
    async creditWin() { return { success: true, newBalance: 10000 }; }
}

async function main() {
    // 1. Verify rejection-sampled Fisher-Yates produces uniform 1..80 distribution
    const counts = new Array(81).fill(0);
    const sampleRounds = 10000;
    for (let i = 0; i < sampleRounds; i++) {
        const cand = ProvablyFairKeno.generateRandomCandidate('test-client', i + 1);
        assert.equal(cand.drawn.length, 20, 'Draw must contain 20 numbers');
        assert.equal(new Set(cand.drawn).size, 20, 'Draw must contain 20 unique numbers');
        const verify = ProvablyFairKeno.verifyRound(cand.serverSeed, cand.serverSeedHash, 'test-client', i + 1, cand.drawn);
        assert.equal(verify.valid, true, 'Chosen candidate seed/hash must verify cleanly');
        for (const n of cand.drawn) counts[n] += 1;
    }
    const expected = (sampleRounds * 20) / 80; // 2500
    for (let n = 1; n <= 80; n++) {
        assert.ok(counts[n] > expected * 0.85 && counts[n] < expected * 1.15, `Ball ${n} frequency ${counts[n]} out of expected ~${expected}`);
    }

    // 2. Simulate 1,000 Spot-2 rounds (10 ETB each) through KenoGameEngine smooth RTP selector
    const engine = new (KenoGameEngine as any)(new MockWallet());
    let totalWagered = 0;
    let totalPaid = 0;
    let small1xWins = 0;
    let big10xWins = 0;

    for (let r = 1; r <= 1000; r++) {
        (engine as any).currentRoundNumber = r;
        (engine as any).nonce = r;
        (engine as any).activeTickets.set('sim-user', [{
            ticketId: `T-${r}`,
            userId: 'sim-user',
            roundNumber: r,
            selectedNumbers: [12, 45],
            spotCount: 2,
            betAmount: 10,
            isBonus: false,
            hitNumbers: [],
            hitCount: 0,
            multiplier: 0,
            payoutAmount: 0,
            status: 'active',
            createdAt: Date.now(),
        }]);

        const drawn: number[] = (engine as any).selectSmoothRtpDraw();
        (engine as any).drawnBallsThisRound = drawn;
        await (engine as any).settleRound();

        const settled = (engine as any).activeTickets.get('sim-user')[0];
        totalWagered += 10;
        totalPaid += settled.payoutAmount;
        if (settled.multiplier === 1) small1xWins += 1;
        if (settled.multiplier === 10) big10xWins += 1;
        (engine as any).activeTickets.clear();
    }

    const actualRtp = totalPaid / totalWagered;
    console.log(`Simulation 1,000 Spot-2 rounds: Wagered=${totalWagered} ETB, Paid=${totalPaid} ETB, ActualRTP=${(actualRtp * 100).toFixed(2)}%, 1xHits=${small1xWins}, 10xHits=${big10xWins}`);

    assert.ok(big10xWins > 0, 'Players must still hit full 10x (100 ETB) wins');
    assert.ok(small1xWins > 0, 'Players must still hit 1x (10 ETB) small wins');
    assert.ok(actualRtp >= 0.80 && actualRtp <= 0.96, `Simulated RTP ${(actualRtp * 100).toFixed(2)}% should converge near 90% target`);

    // 3. Verify Last-100 sliding frequency window stays exact (total sum = 100 rounds * 20 balls = 2000)
    const statsAfter1000 = engine.getHotColdStats();
    const totalFreqSum = Object.values(statsAfter1000.frequencyMap as Record<number, number>).reduce((a, b) => a + b, 0);
    assert.equal(totalFreqSum, 2000, `Last-100 frequency sum must equal 2000 balls, got ${totalFreqSum}`);

    console.log('ALL KENO RTP GUARD CHECKS PASSED');
    process.exit(0);
}

main().catch((err) => {
    console.error('KENO RTP GUARD TEST FAILED:', err);
    process.exit(1);
});
