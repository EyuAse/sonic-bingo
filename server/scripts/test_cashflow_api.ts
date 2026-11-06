import { query } from '../db.ts';
import jwt from 'jsonwebtoken';

async function main() {
  console.log('══════════════════════════════════════════════════════════════════');
  console.log('🧪 TESTING PHASE 1: CASHFLOW & TREASURY ANALYTICS API');
  console.log('══════════════════════════════════════════════════════════════════');

  const adminRes = await query(`SELECT * FROM users WHERE role = 'admin' LIMIT 1`);
  const admin = adminRes.rows[0];
  const adminToken = jwt.sign(
    { id: admin.id, phone: admin.phone, fullName: admin.full_name, role: 'admin' },
    process.env.JWT_SECRET || 'secret'
  );

  const BASE_URL = 'http://localhost:5000/api/admin/cashflow';
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminToken}`
  };

  // Test 1: KPIs
  console.log('\n1️⃣ [Test 1] Testing GET /api/admin/cashflow/kpis?period=all...');
  const kpiRes = await fetch(`${BASE_URL}/kpis?period=all`, { headers });
  const kpiData = await kpiRes.json();
  console.log(`   Status: ${kpiRes.status}, Success: ${kpiData.success}`);
  if (!kpiData.success) throw new Error(`KPIs failed: ${JSON.stringify(kpiData)}`);
  console.log(`   Inflows: ${kpiData.kpis.grossInflows.totalAmount} ETB (${kpiData.kpis.grossInflows.count} txs)`);
  console.log(`   Outflows: ${kpiData.kpis.grossOutflows.totalAmount} ETB (${kpiData.kpis.grossOutflows.count} txs)`);
  console.log(`   Net Cashflow: ${kpiData.kpis.netCashFlow.amount} ETB (${kpiData.kpis.netCashFlow.status})`);
  console.log(`   Gaming GGR: ${kpiData.kpis.gaming.ggr} ETB, Derash: ${kpiData.kpis.gaming.playerWinnings} ETB`);
  console.log(`   Player Balance Liability: ${kpiData.kpis.liabilities.playerBalances} ETB`);
  console.log(`   Agent Float Liability: ${kpiData.kpis.liabilities.agentFloat} ETB`);
  console.log(`   Pending Escrow: ${kpiData.kpis.liabilities.pendingWithdrawals} ETB`);
  console.log('   ✓ PASS: KPIs endpoint verified.');

  // Test 2: Trend
  console.log('\n2️⃣ [Test 2] Testing GET /api/admin/cashflow/trend?period=month...');
  const trendRes = await fetch(`${BASE_URL}/trend?period=month`, { headers });
  const trendData = await trendRes.json();
  console.log(`   Status: ${trendRes.status}, Success: ${trendData.success}, Buckets: ${trendData.buckets?.length}`);
  if (!trendData.success) throw new Error(`Trend failed: ${JSON.stringify(trendData)}`);
  console.log(`   Sample bucket:`, trendData.buckets?.[trendData.buckets.length - 1]);
  console.log('   ✓ PASS: Trend endpoint verified.');

  // Test 3: Stream
  console.log('\n3️⃣ [Test 3] Testing GET /api/admin/cashflow/stream?period=all&limit=5...');
  const streamRes = await fetch(`${BASE_URL}/stream?period=all&limit=5`, { headers });
  const streamData = await streamRes.json();
  console.log(`   Status: ${streamRes.status}, Success: ${streamData.success}, Total: ${streamData.pagination?.total}`);
  if (!streamData.success) throw new Error(`Stream failed: ${JSON.stringify(streamData)}`);
  console.log(`   Fetched ${streamData.transactions?.length} transactions.`);
  if (streamData.transactions?.length > 0) {
    console.log(`   Top record: ${streamData.transactions[0].refCode} - ${streamData.transactions[0].flow} - ${streamData.transactions[0].amount} ETB (${streamData.transactions[0].category})`);
  }
  console.log('   ✓ PASS: Unified Stream endpoint verified.');

  // Test 4: Gaming Breakdown
  console.log('\n4️⃣ [Test 4] Testing GET /api/admin/cashflow/gaming-breakdown?period=all...');
  const gamingRes = await fetch(`${BASE_URL}/gaming-breakdown?period=all`, { headers });
  const gamingData = await gamingRes.json();
  console.log(`   Status: ${gamingRes.status}, Success: ${gamingData.success}, Rooms count: ${gamingData.rooms?.length}`);
  if (!gamingData.success) throw new Error(`Gaming breakdown failed: ${JSON.stringify(gamingData)}`);
  gamingData.rooms.forEach((r: any) => {
    console.log(`   [${r.roomId}] Rounds: ${r.rounds}, Staked: ${r.totalStaked} ETB, House 20%: ${r.houseFeeGgr} ETB, Payouts 80%: ${r.playerPayouts} ETB`);
  });
  console.log('   ✓ PASS: Gaming breakdown endpoint verified.');

  // Test 5: Treasury Balance Sheet
  console.log('\n5️⃣ [Test 5] Testing GET /api/admin/cashflow/treasury-balance...');
  const balRes = await fetch(`${BASE_URL}/treasury-balance`, { headers });
  const balData = await balRes.json();
  console.log(`   Status: ${balRes.status}, Success: ${balData.success}`);
  if (!balData.success) throw new Error(`Treasury balance failed: ${JSON.stringify(balData)}`);
  console.log(`   Total Circulating Liabilities: ${balData.balanceSheet.totalCirculatingLiabilities} ETB`);
  console.log(`   Player Cash: ${balData.balanceSheet.playerCashLiabilities} ETB (${balData.balanceSheet.playerCount} users)`);
  console.log(`   Agent Float: ${balData.balanceSheet.agentFloatLiabilities} ETB (${balData.balanceSheet.agentCount} agents)`);
  console.log(`   Pending Escrow: ${balData.balanceSheet.pendingWithdrawalEscrow} ETB`);
  console.log('   ✓ PASS: Treasury balance sheet verified.');

  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log('🎉 ALL PHASE 1 CASHFLOW ENDPOINTS PASSED WITH 100% SUCCESS!');
  console.log('══════════════════════════════════════════════════════════════════');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Test crashed:', err);
  process.exit(1);
});
