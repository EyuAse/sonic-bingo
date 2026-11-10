/**
 * 🎲 Test Suite: Agent Weighted Assignment & Damped Probability Engine
 * 
 * Verifies:
 * 1. Damped square-root weight calculation: weight_i = 100 + floor(sqrt(balance_i))
 * 2. Roulette-wheel selection properties across 10,000 iterations:
 *    - All eligible agents receive non-zero selection share (fair baseline).
 *    - Higher float balance receives strictly higher share than lower balance.
 *    - No agent monopolizes the pool (damped advantage prevents winner-take-all).
 * 3. Exclusion logic: `excludeAgentId` strictly avoids the excluded agent.
 * 4. Preferred agent logic: `preferredAgentId` retains active assigned agent across sessions.
 * 5. Edge cases: 0 agents, 1 agent.
 */

interface MockAgent {
  id: string;
  agentCode: string;
  walletBalance: number;
  weight: number;
}

function calculateWeight(balance: number): number {
  const raw = Math.max(0, balance);
  return 100 + Math.floor(Math.sqrt(raw));
}

function selectWeightedAgent(agents: MockAgent[], excludeId?: string, preferredId?: string): MockAgent | null {
  if (agents.length === 0) return null;

  // Session persistence: if preferred agent exists and not excluded, return it
  if (preferredId && !excludeId) {
    const pref = agents.find(a => a.id === preferredId || a.agentCode === preferredId);
    if (pref) return pref;
  }

  // Filter out excludeId if multiple agents exist
  let pool = agents;
  if (excludeId && agents.length > 1) {
    const filtered = agents.filter(a => a.id !== excludeId && a.agentCode !== excludeId);
    if (filtered.length > 0) {
      pool = filtered;
    }
  }

  const totalWeight = pool.reduce((sum, a) => sum + a.weight, 0);
  let randomVal = Math.random() * totalWeight;

  for (const candidate of pool) {
    if (randomVal < candidate.weight) {
      return candidate;
    }
    randomVal -= candidate.weight;
  }

  return pool[0];
}

async function runSimulation() {
  console.log('\n======================================================');
  console.log('🎰 AGENT DAMPED WEIGHTED ASSIGNMENT MATHEMATICAL SIMULATION');
  console.log('======================================================\n');

  // Test 1: Weight Formula Assertions
  console.log('--- Test 1: Weight Formula Verification ---');
  const balances = [0, 50, 1000, 10000, 50000];
  balances.forEach(bal => {
    const w = calculateWeight(bal);
    console.log(`Balance: ${bal.toLocaleString()} ETB -> Weight: ${w}`);
  });

  const w0 = calculateWeight(0);
  const w1k = calculateWeight(1000);
  const w10k = calculateWeight(10000);
  const w50k = calculateWeight(50000);

  if (w0 !== 100) throw new Error(`Expected baseline weight 100, got ${w0}`);
  if (w1k !== 131) throw new Error(`Expected weight 131 for 1,000 ETB, got ${w1k}`);
  if (w10k !== 200) throw new Error(`Expected weight 200 for 10,000 ETB, got ${w10k}`);
  if (w50k !== 323) throw new Error(`Expected weight 323 for 50,000 ETB, got ${w50k}`);
  console.log('✅ Test 1 Passed: Weight formulas match specification.\n');

  // Test 2: Edge Cases (0 agents, 1 agent)
  console.log('--- Test 2: Edge Cases (0 agents, 1 agent) ---');
  const emptyRes = selectWeightedAgent([]);
  if (emptyRes !== null) throw new Error('Expected null for empty agent roster');

  const soloAgent: MockAgent = {
    id: 'agent-1',
    agentCode: 'AGT-1001',
    walletBalance: 500,
    weight: calculateWeight(500)
  };
  const soloRes = selectWeightedAgent([soloAgent]);
  if (soloRes?.id !== 'agent-1') throw new Error('Expected solo agent to be returned');
  console.log('✅ Test 2 Passed: 0 and 1 agent handled safely.\n');

  // Test 3: Monte Carlo Roulette Simulation (10,000 Iterations)
  console.log('--- Test 3: Monte Carlo Simulation (10,000 Iterations) ---');
  const agentRoster: MockAgent[] = [
    { id: 'agent-A', agentCode: 'AGT-LOW', walletBalance: 1000, weight: calculateWeight(1000) },       // Weight 131
    { id: 'agent-B', agentCode: 'AGT-MID', walletBalance: 10000, weight: calculateWeight(10000) },     // Weight 200
    { id: 'agent-C', agentCode: 'AGT-HIGH', walletBalance: 50000, weight: calculateWeight(50000) },   // Weight 323
  ];

  const totalWeight = agentRoster.reduce((sum, a) => sum + a.weight, 0); // 131 + 200 + 323 = 654
  const expectedP_A = agentRoster[0].weight / totalWeight; // ~20.03%
  const expectedP_B = agentRoster[1].weight / totalWeight; // ~30.58%
  const expectedP_C = agentRoster[2].weight / totalWeight; // ~49.39%

  console.log(`Pool Total Weight: ${totalWeight}`);
  console.log(`Expected Shares: Agent A (1k ETB): ${(expectedP_A * 100).toFixed(2)}% | Agent B (10k ETB): ${(expectedP_B * 100).toFixed(2)}% | Agent C (50k ETB): ${(expectedP_C * 100).toFixed(2)}%`);

  const iterations = 10000;
  const counts: Record<string, number> = { 'agent-A': 0, 'agent-B': 0, 'agent-C': 0 };

  for (let i = 0; i < iterations; i++) {
    const selected = selectWeightedAgent(agentRoster);
    if (selected) {
      counts[selected.id]++;
    }
  }

  const pA = counts['agent-A'] / iterations;
  const pB = counts['agent-B'] / iterations;
  const pC = counts['agent-C'] / iterations;

  console.log(`Simulated Shares (10,000 runs):`);
  console.log(`  Agent A (1,000 ETB):  ${counts['agent-A']} wins (${(pA * 100).toFixed(2)}%)`);
  console.log(`  Agent B (10,000 ETB): ${counts['agent-B']} wins (${(pB * 100).toFixed(2)}%)`);
  console.log(`  Agent C (50,000 ETB): ${counts['agent-C']} wins (${(pC * 100).toFixed(2)}%)`);

  // Assertions:
  // 1. Strictly monotonic ordering: P(C) > P(B) > P(A)
  if (!(pC > pB && pB > pA)) {
    throw new Error(`Monotonic ordering failed: pC=${pC}, pB=${pB}, pA=${pA}`);
  }
  // 2. Statistical tolerance check (+- 3.5% margin of error at 10,000 runs)
  const tolerance = 0.035;
  if (Math.abs(pA - expectedP_A) > tolerance) throw new Error(`Agent A out of tolerance`);
  if (Math.abs(pB - expectedP_B) > tolerance) throw new Error(`Agent B out of tolerance`);
  if (Math.abs(pC - expectedP_C) > tolerance) throw new Error(`Agent C out of tolerance`);
  // 3. Anti-monopoly guard: Agent C with 50x more money should not get more than 60%
  if (pC > 0.60) throw new Error(`Agent C monopolized the pool: ${(pC * 100).toFixed(2)}%`);

  console.log('✅ Test 3 Passed: Monte Carlo shares strictly respect damped weighted probability without monopoly.\n');

  // Test 4: Exclusion (Re-Roll) Verification
  console.log('--- Test 4: Exclusion (Re-Roll) Verification ---');
  let excludedPicked = 0;
  for (let i = 0; i < 1000; i++) {
    const res = selectWeightedAgent(agentRoster, 'agent-C');
    if (res?.id === 'agent-C') excludedPicked++;
  }
  if (excludedPicked > 0) throw new Error(`Excluded agent was selected ${excludedPicked} times!`);
  console.log('✅ Test 4 Passed: excludeAgentId strictly avoids current agent on re-roll.\n');

  // Test 5: Preferred Session Persistence
  console.log('--- Test 5: Preferred Session Persistence ---');
  for (let i = 0; i < 100; i++) {
    const res = selectWeightedAgent(agentRoster, undefined, 'agent-B');
    if (res?.id !== 'agent-B') throw new Error(`Preferred session agent was not retained!`);
  }
  console.log('✅ Test 5 Passed: preferredAgentId reliably preserves active session agent.\n');

  console.log('======================================================');
  console.log('🎉 ALL 5 AGENT WEIGHTED ASSIGNMENT TESTS PASSED PERFECTLY!');
  console.log('======================================================\n');
}

runSimulation().catch(err => {
  console.error('❌ Simulation Error:', err);
  process.exit(1);
});

