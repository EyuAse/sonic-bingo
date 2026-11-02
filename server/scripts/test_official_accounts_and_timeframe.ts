import bcrypt from 'bcryptjs';
import { query, withTransaction } from '../db.ts';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runTests() {
  console.log('\n🧪 ========================================================');
  console.log('🧪 [TEST SUITE] Official Accounts, Timeframe & Agent Lifecycle');
  console.log('🧪 ========================================================\n');

  // Test 1: Verify users table has updated_at and password_hash
  console.log('--- Test 1: Verify users table schema columns ---');
  const colsRes = await query(
    `SELECT column_name, data_type 
     FROM information_schema.columns 
     WHERE table_name = 'users' AND column_name IN ('updated_at', 'password_hash')`
  );
  assert(colsRes.rows.length === 2, 'Both updated_at and password_hash exist on users table');

  // Test 2: Admin Agent Edit / Password Reset test
  console.log('\n--- Test 2: Admin Agent Edit with updated_at & password_hash ---');
  // Find or create test agent
  const agentUserRes = await query(
    `SELECT u.id as user_id, u.full_name, u.phone, ap.id as agent_id, ap.agent_code 
     FROM agent_profiles ap 
     JOIN users u ON ap.user_id = u.id 
     LIMIT 1`
  );
  assert(agentUserRes.rows.length > 0, 'Found registered agent in database');
  const agent = agentUserRes.rows[0];

  const testNewPass = 'SonicTest#9981';
  const newHash = await bcrypt.hash(testNewPass, 10);

  // Simulate Admin Edit Agent
  await query(
    `UPDATE users 
     SET full_name = $1, password_hash = $2, pin_hash = $2, updated_at = NOW() 
     WHERE id = $3`,
    [agent.full_name, newHash, agent.user_id]
  );
  console.log('  ✓ Admin successfully updated agent info and password without "column updated_at does not exist" error');

  // Test 3: Agent Self-Service Password / PIN update
  console.log('\n--- Test 3: Agent Self-Service Password / PIN Update ---');
  const agentSelfNewPass = 'AgentNewPass$2026';
  const agentSelfHash = await bcrypt.hash(agentSelfNewPass, 10);

  // Check current password matches
  const checkUserRes = await query(
    `SELECT u.id, u.pin_hash, COALESCE(u.password_hash, u.pin_hash) as password_hash, ap.agent_code 
     FROM users u 
     JOIN agent_profiles ap ON u.id = ap.user_id 
     WHERE u.id = $1`,
    [agent.user_id]
  );
  const currentHash = checkUserRes.rows[0].password_hash;
  const isMatchCurrent = await bcrypt.compare(testNewPass, currentHash);
  assert(isMatchCurrent, 'Agent current password matches previous hash');

  // Update to new password
  await query(
    `UPDATE users 
     SET pin_hash = $1, password_hash = $1, updated_at = NOW() 
     WHERE id = $2`,
    [agentSelfHash, agent.user_id]
  );
  const updatedUser = await query(`SELECT password_hash FROM users WHERE id = $1`, [agent.user_id]);
  const isMatchNew = await bcrypt.compare(agentSelfNewPass, updatedUser.rows[0].password_hash);
  assert(isMatchNew, 'Agent new password updated and verified via Bcrypt');

  // Test 4: Timeframe SQL logic (Trailing 7 days for 'This Week' includes yesterday)
  console.log('\n--- Test 4: Deposit Timeframe Query (Trailing 7d includes yesterday) ---');
  // Check if test deposit exists or create a mock deposit timestamped yesterday (24h ago)
  const playerRes = await query(`SELECT id, phone FROM users WHERE role = 'player' LIMIT 1`);
  const playerId = playerRes.rows[0]?.id || agent.user_id;

  const mockTxCode = `TEST_TF_${Date.now()}`;
  const insertDep = await query(
    `INSERT INTO agent_deposit_requests (agent_id, player_id, amount, payment_method, player_phone, transaction_code, status, created_at)
     VALUES ($1, $2, 250.00, 'Telebirr', '0912345678', $3, 'approved', NOW() - INTERVAL '24 hours')
     RETURNING id, created_at`,
    [agent.agent_id, playerId, mockTxCode]
  );
  const depId = insertDep.rows[0].id;
  console.log(`  ✓ Inserted test deposit 24h ago (id: ${depId})`);

  // Query with timeframe = 'week' (Trailing 7 days)
  const weekQueryRes = await query(
    `SELECT id, amount, created_at 
     FROM agent_deposit_requests 
     WHERE agent_id = $1 AND id = $2 AND created_at >= NOW() - INTERVAL '7 days'`,
    [agent.agent_id, depId]
  );
  assert(weekQueryRes.rows.length === 1, 'Trailing 7 days query includes yesterday transaction');

  // Clean up test deposit
  await query(`DELETE FROM agent_deposit_requests WHERE id = $1`, [depId]);
  console.log('  ✓ Cleaned up test deposit');

  // Test 5: Official Accounts CRUD & Toggle
  console.log('\n--- Test 5: Official Platform Receiving Accounts ---');
  const officialAccountsRes = await query(
    `SELECT id, provider, account_title, account_name, account_number, badge, is_active, display_order 
     FROM payment_accounts 
     ORDER BY display_order ASC`
  );
  assert(officialAccountsRes.rows.length >= 3, 'Found at least 3 official platform accounts (Telebirr, CBE, M-Pesa)');

  const telebirrAcc = officialAccountsRes.rows.find(a => a.provider === 'Telebirr');
  assert(telebirrAcc !== undefined, 'Telebirr official account exists');
  assert(telebirrAcc.account_number === '0952013863', 'Telebirr account number is 0952013863');

  const cbeAcc = officialAccountsRes.rows.find(a => a.provider === 'CBE');
  assert(cbeAcc !== undefined, 'CBE official account exists');
  assert(cbeAcc.account_number === '1000458291048', 'CBE account number is 1000458291048');

  const mpesaAcc = officialAccountsRes.rows.find(a => a.provider === 'M-Pesa');
  assert(mpesaAcc !== undefined, 'M-Pesa official account exists');
  assert(mpesaAcc.account_number === '0712345678', 'M-Pesa account number is 0712345678');

  // Test Toggle
  const initialActive = telebirrAcc.is_active;
  await query(`UPDATE payment_accounts SET is_active = NOT is_active WHERE id = $1`, [telebirrAcc.id]);
  const toggled = await query(`SELECT is_active FROM payment_accounts WHERE id = $1`, [telebirrAcc.id]);
  assert(toggled.rows[0].is_active === !initialActive, '1-Click toggle successfully inverted is_active status');

  // Revert toggle back
  await query(`UPDATE payment_accounts SET is_active = $1 WHERE id = $2`, [initialActive, telebirrAcc.id]);
  console.log('  ✓ 1-Click toggle verified and restored to active state');

  console.log('\n🎉 ALL 5 INTEGRATION TESTS PASSED 100%!');
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
