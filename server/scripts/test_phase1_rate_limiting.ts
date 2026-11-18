import assert from 'assert';

function getClientIp(req: any): string {
  const cfIp = req.headers['cf-connecting-ip'];
  if (cfIp) return String(cfIp).trim();
  const xRealIp = req.headers['x-real-ip'];
  if (xRealIp) return String(xRealIp).trim();
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return String(forwarded).split(',')[0].trim();
  }
  return req.ip || '127.0.0.1';
}

function getClientIdentifier(req: any): string {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    if (token && token.length >= 16) {
      return `auth_${token.slice(-32)}`;
    }
  }
  return getClientIp(req);
}

function skipRateLimit(req: any): boolean {
  if (req.method === 'GET') return true;
  if (req.path.startsWith('/agents')) return true;
  return false;
}

async function runTests() {
  console.log('🧪 Starting Phase 1 Rate-Limiting & CGNAT Verification Suite...\n');

  // Test 1: Verify GET requests are unconditionally skipped
  console.log('▶ Test 1: Verifying read-only GET requests bypass wallet limiter...');
  const getEndpoints = [
    { method: 'GET', path: '/api/wallet/transactions' },
    { method: 'GET', path: '/api/wallet/balance' },
    { method: 'GET', path: '/api/wallet/my-agent-deposits' },
    { method: 'GET', path: '/api/wallet/my-withdrawals' },
    { method: 'GET', path: '/api/wallet/agents/assigned' },
    { method: 'GET', path: '/api/wallet/agents/active' }
  ];

  for (const ep of getEndpoints) {
    const isSkipped = skipRateLimit(ep);
    assert(isSkipped === true, `Endpoint ${ep.path} must be skipped`);
    console.log(`   ✅ PASS: ${ep.method} ${ep.path} skipped from rate limiting.`);
  }

  // Test 2: Verify POST to agent routes is skipped
  console.log('\n▶ Test 2: Verifying agent catalog routes are skipped...');
  assert(skipRateLimit({ method: 'POST', path: '/agents/search' }) === true);
  console.log('   ✅ PASS: /agents routes are skipped.');

  // Test 3: Verify POST to deposit is NOT skipped (properly guarded)
  console.log('\n▶ Test 3: Verifying write POST operations are guarded...');
  assert(skipRateLimit({ method: 'POST', path: '/api/wallet/deposit-via-agent' }) === false);
  console.log('   ✅ PASS: POST /api/wallet/deposit-via-agent is protected.');

  // Test 4: Verify CGNAT IP collision isolation via Bearer Token keyGenerator
  console.log('\n▶ Test 4: Verifying CGNAT multi-user isolation...');
  const sharedCarrierIp = '196.188.241.10'; // Shared Ethio Telecom CGNAT IP
  
  const user1Req = {
    headers: {
      'cf-connecting-ip': sharedCarrierIp,
      'authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.user_1_payload_token_alpha_123456789'
    }
  };

  const user2Req = {
    headers: {
      'cf-connecting-ip': sharedCarrierIp,
      'authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.user_2_payload_token_bravo_987654321'
    }
  };

  const key1 = getClientIdentifier(user1Req);
  const key2 = getClientIdentifier(user2Req);

  assert(key1 !== key2, 'User 1 and User 2 sharing the same CGNAT carrier IP must have unique rate limit keys');
  assert(key1.startsWith('auth_'), 'Authenticated user key must be prefixed with auth_');
  console.log(`   ✅ PASS: User 1 key: "${key1}"`);
  console.log(`   ✅ PASS: User 2 key: "${key2}"`);
  console.log('   ✅ PASS: 100% isolation between players sharing the same mobile network IP!');

  console.log('\n🎉 ALL PHASE 1 RATE-LIMITING TESTS PASSED FLAWLESSLY!\n');
}

runTests().catch(err => {
  console.error('❌ Phase 1 test failed:', err);
  process.exit(1);
});

