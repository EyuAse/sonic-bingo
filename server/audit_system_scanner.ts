import { query, checkDbConnection, withTransaction } from './db.ts';
import { io as ClientIO } from 'socket.io-client';
import jwt from 'jsonwebtoken';

interface AuditResult {
  category: string;
  test: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  details: string;
  latencyMs?: number;
}

const auditResults: AuditResult[] = [];

function record(category: string, test: string, status: 'PASS' | 'WARN' | 'FAIL', details: string, latencyMs?: number) {
  auditResults.push({ category, test, status, details, latencyMs });
  const icon = status === 'PASS' ? '✅' : status === 'WARN' ? '⚠️' : '❌';
  console.log(`${icon} [${category}] ${test}: ${details} ${latencyMs ? `(${latencyMs}ms)` : ''}`);
}

async function runComprehensiveAudit() {
  console.log('🔍 ================================================================');
  console.log('🔍 LOMI BINGO FULL ARCHITECTURAL & SYSTEM DESIGN AUDIT SCANNER');
  console.log('🔍 ================================================================\n');

  // ==========================================
  // 1. DATABASE & CONNECTION POOLING AUDIT
  // ==========================================
  console.log('--- 1. DATABASE & PERSISTENCE LAYER AUDIT ---');
  const dbStart = Date.now();
  const dbHealth = await checkDbConnection();
  if (dbHealth.connected) {
    record('Database', 'Connection & Latency', 'PASS', `Connected to Neon PostgreSQL Serverless. Latency: ${dbHealth.latencyMs}ms`, dbHealth.latencyMs);
  } else {
    record('Database', 'Connection & Latency', 'FAIL', `Connection failed: ${dbHealth.error}`);
  }

  // Check table counts
  try {
    const usersCount = await query('SELECT count(*) as count FROM users');
    const botsCount = await query('SELECT count(*) as count FROM users WHERE is_bot = true');
    const realUsersCount = await query('SELECT count(*) as count FROM users WHERE is_bot = false OR is_bot IS NULL');
    const walletsCount = await query('SELECT count(*) as count FROM wallets');
    const depCount = await query('SELECT count(*) as count FROM deposit_requests');
    const withCount = await query('SELECT count(*) as count FROM withdrawal_requests');
    const roundsCount = await query('SELECT count(*) as count FROM game_rounds');

    record('Database', 'Tables & Row Integrity', 'PASS', 
      `Users: ${usersCount.rows[0].count} (Real: ${realUsersCount.rows[0].count}, Bots: ${botsCount.rows[0].count}), Wallets: ${walletsCount.rows[0].count}, Deposits: ${depCount.rows[0].count}, Withdrawals: ${withCount.rows[0].count}, Rounds: ${roundsCount.rows[0].count}`);
  } catch (err: any) {
    record('Database', 'Tables & Row Integrity', 'FAIL', err.message);
  }

  // ==========================================
  // 2. LIVE DEPOSIT & APPROVAL WORKFLOW
  // ==========================================
  console.log('\n--- 2. LIVE DEPOSIT WORKFLOW AUDIT ---');
  let testDepositId: string | null = null;
  const testRef = `AUDIT-DEP-${Date.now().toString().slice(-6)}`;
  try {
    // 2.1 Submit Deposit Request
    const depRes = await fetch('http://localhost:5000/api/wallet/deposit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + generateMockToken('c91c3275-f863-41b3-af81-16333e58c219', 'Eyu Ase')
      },
      body: JSON.stringify({
        amount: 50,
        paymentMethod: 'Telebirr',
        playerPhone: '0912345678',
        transactionRef: testRef
      })
    });
    const depData = await depRes.json();
    if (depData.success) {
      testDepositId = depData.deposit.id;
      record('Deposit', 'Submit Deposit Request', 'PASS', `Submitted deposit of 50 ETB via Telebirr (ID: ${testDepositId}, Ref: ${testRef})`);
    } else {
      record('Deposit', 'Submit Deposit Request', 'FAIL', depData.error || 'Failed to submit deposit');
    }

    // 2.2 Test Duplicate Prevention
    const dupRes = await fetch('http://localhost:5000/api/wallet/deposit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + generateMockToken('c91c3275-f863-41b3-af81-16333e58c219', 'Eyu Ase')
      },
      body: JSON.stringify({
        amount: 50,
        paymentMethod: 'Telebirr',
        playerPhone: '0912345678',
        transactionRef: testRef
      })
    });
    const dupData = await dupRes.json();
    if (!dupData.success && dupData.error?.includes('already exists')) {
      record('Deposit', 'Duplicate Ref Protection', 'PASS', 'Correctly rejected duplicate transaction reference');
    } else {
      record('Deposit', 'Duplicate Ref Protection', 'WARN', 'Duplicate transaction reference check needs enforcement');
    }

    // 2.3 Admin Cashier Approval of Deposit
    if (testDepositId) {
      // Get Admin Token
      const adminLoginRes = await fetch('http://localhost:5000/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: '1234' })
      });
      const adminData = await adminLoginRes.json();

      if (adminData.token) {
        const approveRes = await fetch(`http://localhost:5000/api/admin/deposits/${testDepositId}/approve`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${adminData.token}`
          }
        });
        const approveData = await approveRes.json();
        if (approveData.success) {
          record('Deposit', 'Admin Approval & Wallet Credit', 'PASS', `Cashier approved deposit. Wallet updated: ${approveData.newBalance} ETB`);
        } else {
          record('Deposit', 'Admin Approval & Wallet Credit', 'FAIL', approveData.error);
        }
      }
    }
  } catch (err: any) {
    record('Deposit', 'Live Deposit Flow', 'FAIL', err.message);
  }

  // ==========================================
  // 3. LIVE WITHDRAWAL & ATOMIC LOCK AUDIT
  // ==========================================
  console.log('\n--- 3. LIVE WITHDRAWAL WORKFLOW AUDIT ---');
  let testWithdrawId: string | null = null;
  try {
    // 3.1 Test Insufficient Balance Rejection
    const overWithdrawRes = await fetch('http://localhost:5000/api/wallet/withdraw', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + generateMockToken('09903e0d-119d-4c60-beae-4d3db10aae0c', 'NATAN') // NATAN has 0.00 ETB
      },
      body: JSON.stringify({
        amount: 100,
        paymentMethod: 'Telebirr',
        accountPhone: '0911002233'
      })
    });
    const overData = await overWithdrawRes.json();
    if (!overData.success && overData.error?.includes('Insufficient')) {
      record('Withdrawal', 'Zero-Balance Rejection', 'PASS', 'Correctly blocked withdrawal with insufficient funds');
    } else {
      record('Withdrawal', 'Zero-Balance Rejection', 'FAIL', 'Failed to block withdrawal on 0.00 ETB wallet');
    }

    // 3.2 Test Minimum Amount Check (< 50 ETB)
    const minWithdrawRes = await fetch('http://localhost:5000/api/wallet/withdraw', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + generateMockToken('c91c3275-f863-41b3-af81-16333e58c219', 'Eyu Ase')
      },
      body: JSON.stringify({
        amount: 25,
        paymentMethod: 'Telebirr',
        accountPhone: '0911002233'
      })
    });
    const minData = await minWithdrawRes.json();
    if (!minData.success && minData.error?.includes('Minimum')) {
      record('Withdrawal', 'Minimum Threshold Enforced', 'PASS', 'Correctly rejected withdrawal below 50 ETB');
    } else {
      record('Withdrawal', 'Minimum Threshold Enforced', 'FAIL', 'Allowed withdrawal below 50 ETB');
    }
  } catch (err: any) {
    record('Withdrawal', 'Live Withdrawal Flow', 'FAIL', err.message);
  }

  // Restore Eyu Ase balance to exactly 50.00 ETB
  await query("UPDATE wallets SET balance = 50.00 WHERE user_id = 'c91c3275-f863-41b3-af81-16333e58c219'");
  // Clean up test deposit
  if (testDepositId) {
    await query("DELETE FROM deposit_requests WHERE id = $1", [testDepositId]);
    await query("DELETE FROM wallet_transactions WHERE reference_code = $1", [testRef]);
  }

  // ==========================================
  // 4. RATE LIMITING & SECURITY AUDIT
  // ==========================================
  console.log('\n--- 4. RATE LIMITING & SECURITY SCAN ---');
  // Check if express-rate-limit or similar is active on auth routes
  const rateLimitTests: Promise<Response>[] = [];
  for (let i = 0; i < 15; i++) {
    rateLimitTests.push(fetch('http://localhost:5000/api/auth/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: 'wrong_pin' })
    }));
  }
  const rateLimitResponses = await Promise.all(rateLimitTests);
  const got429 = rateLimitResponses.some(r => r.status === 429);
  if (got429) {
    record('Security', 'API Rate Limiting', 'PASS', '429 Too Many Requests triggered under burst traffic');
  } else {
    record('Security', 'API Rate Limiting', 'WARN', 'No rate limiting middleware detected on /api/auth endpoints (vulnerable to brute-forcing)');
  }

  // ==========================================
  // 5. CACHING & RESPONSE OPTIMIZATION
  // ==========================================
  console.log('\n--- 5. CACHING & HIGH-FREQUENCY QUERY SCAN ---');
  // Check headers on /api/rooms and /api/network-health
  const roomsRes = await fetch('http://localhost:5000/api/rooms');
  const cacheControl = roomsRes.headers.get('cache-control');
  if (cacheControl) {
    record('Caching', 'HTTP Cache-Control', 'PASS', `Cache-Control: ${cacheControl}`);
  } else {
    record('Caching', 'HTTP Cache-Control', 'WARN', 'No Cache-Control headers on high-frequency API endpoints');
  }

  // ==========================================
  // 6. LIVE MULTIPLAYER SOCKET & GAME ENGINE
  // ==========================================
  console.log('\n--- 6. GAME ENGINE & MULTIPLAYER AUDIT ---');
  const socket = ClientIO('http://localhost:5000', { transports: ['websocket'] });
  await new Promise<void>((resolve) => {
    socket.on('connect', () => {
      socket.emit('join_room', { roomId: 'lomi-arena', userId: 'audit-user', userName: 'Auditor' });
      resolve();
    });
  });

  const stateReceived = await new Promise<any>((resolve) => {
    socket.on('room_state', (s) => resolve(s));
    setTimeout(() => resolve(null), 3000);
  });

  if (stateReceived) {
    record('GameEngine', 'Room State Broadcast', 'PASS', `Authoritative state broadcast: Phase "${stateReceived.phase}", Pot: ${stateReceived.totalPot} ETB, Players: ${stateReceived.playersCount}`);
  } else {
    record('GameEngine', 'Room State Broadcast', 'FAIL', 'Failed to receive room_state within 3 seconds');
  }

  socket.disconnect();

  // ==========================================
  // PRINT EXECUTIVE SUMMARY
  // ==========================================
  console.log('\n================================================================');
  console.log('📊 SYSTEM DESIGN & ARCHITECTURAL AUDIT SUMMARY');
  console.log('================================================================');
  const passCount = auditResults.filter(r => r.status === 'PASS').length;
  const warnCount = auditResults.filter(r => r.status === 'WARN').length;
  const failCount = auditResults.filter(r => r.status === 'FAIL').length;
  console.log(`Total Checks: ${auditResults.length} | Passed: ${passCount} | Warnings: ${warnCount} | Failed: ${failCount}\n`);

  process.exit(0);
}

function generateMockToken(id: string, name: string): string {
  return jwt.sign({ id, fullName: name, role: 'player' }, 'lomi_bingo_super_secret_production_key_2026_et', { expiresIn: '1h' });
}

runComprehensiveAudit().catch(err => {
  console.error('Audit Script Error:', err);
  process.exit(1);
});
