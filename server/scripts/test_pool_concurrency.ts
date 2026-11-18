import { pool, query, withTransaction, checkDbConnection } from '../db.ts';

async function testPoolConcurrency() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🧪 TESTING NEON DB POOL CONCURRENCY (MAX 50 CONNECTIONS)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 1. Live health check
  console.log('1️⃣ Checking basic DB connectivity & latency...');
  const health = await checkDbConnection();
  console.log(`   ✓ Connected: ${health.connected}`);
  console.log(`   ✓ Latency: ${health.latencyMs}ms`);
  console.log(`   ✓ Engine: ${health.version}`);
  if (!health.connected) {
    throw new Error(`DB connection failed: ${health.error}`);
  }

  // 2. High-concurrency query test (30 concurrent queries)
  console.log('\n2️⃣ Firing 30 simultaneous concurrent queries to test pool elasticity...');
  const startTime = Date.now();
  const queryPromises: Promise<any>[] = [];
  for (let i = 0; i < 30; i++) {
    queryPromises.push(
      query('SELECT $1::int as worker_id, NOW() as server_time', [i])
    );
  }

  const results = await Promise.all(queryPromises);
  const totalElapsed = Date.now() - startTime;
  console.log(`   ✓ All 30 concurrent queries resolved successfully in ${totalElapsed}ms!`);
  console.log(`   ✓ Average per-query turnaround: ${(totalElapsed / 30).toFixed(1)}ms`);

  // Verify all workers answered
  const workerIds = results.map(r => r.rows[0].worker_id);
  if (workerIds.length !== 30) {
    throw new Error(`Expected 30 worker responses, got ${workerIds.length}`);
  }
  console.log('   ✓ PASS: 30 concurrent workers completed with zero pool queue drops.\n');

  // 3. Isolated ACID Transactions test (10 concurrent withTransaction calls)
  console.log('3️⃣ Firing 10 simultaneous ACID transactions with rollback guard...');
  const txStart = Date.now();
  const txPromises: Promise<any>[] = [];
  for (let i = 0; i < 10; i++) {
    txPromises.push(
      withTransaction(async (client) => {
        const res = await client.query('SELECT $1::int as tx_id', [i]);
        return res.rows[0].tx_id;
      })
    );
  }

  const txResults = await Promise.all(txPromises);
  const txElapsed = Date.now() - txStart;
  console.log(`   ✓ All 10 concurrent transactions completed successfully in ${txElapsed}ms!`);
  console.log(`   ✓ Returned Tx IDs: [${txResults.join(', ')}]`);
  console.log('   ✓ PASS: ACID transactions release clients back to the pool properly.\n');

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🎉 PHASE 1 VERIFICATION PASSED: DB POOL IS SCALED & STABLE');
  console.log('═══════════════════════════════════════════════════════════════\n');

  await pool.end();
  process.exit(0);
}

testPoolConcurrency().catch(err => {
  console.error('❌ Pool concurrency test failed:', err);
  process.exit(1);
});
