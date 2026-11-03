import assert from 'node:assert';
import { markUserSuspended, markUserActive, checkIfUserSuspended } from '../middleware/auth.ts';
import { query, pool } from '../db.ts';

async function runTest() {
  console.log('🧪 Starting Phase 1 Instant Reactivation & Cache Invalidation Test Suite...\n');

  // Test 1: In-memory multi-key suspension & immediate reactivation
  const testUuid = '20171a0b-a3ae-4d2d-9a11-10c29389dcc9';
  const testTgId = '2005113062';
  const testPhone = '+251983624574';

  console.log('1️⃣ Testing markUserSuspended multi-key caching...');
  markUserSuspended(testUuid, 'Test compliance review', testTgId, testPhone);

  const checkUuid = await checkIfUserSuspended(testUuid);
  assert.strictEqual(checkUuid.suspended, true, 'UUID should be marked suspended in cache');
  assert.strictEqual(checkUuid.reason, 'Test compliance review');

  const checkTg = await checkIfUserSuspended(testTgId);
  assert.strictEqual(checkTg.suspended, true, 'Telegram ID should be marked suspended in cache');

  const checkPhone = await checkIfUserSuspended(testPhone);
  assert.strictEqual(checkPhone.suspended, true, 'Phone should be marked suspended in cache');
  console.log('   ✅ All 3 aliases immediately report suspended!');

  console.log('\n2️⃣ Testing markUserActive multi-key instant purge (NO redeployment needed)...');
  markUserActive(testUuid, testTgId, testPhone);

  const checkUuidAct = await checkIfUserSuspended(testUuid);
  assert.strictEqual(checkUuidAct.suspended, false, 'UUID should be immediately active in cache');

  const checkTgAct = await checkIfUserSuspended(testTgId);
  assert.strictEqual(checkTgAct.suspended, false, 'Telegram ID should be immediately active in cache');

  const checkPhoneAct = await checkIfUserSuspended(testPhone);
  assert.strictEqual(checkPhoneAct.suspended, false, 'Phone should be immediately active in cache');
  console.log('   ✅ All 3 aliases immediately report active in < 1ms without needing a process restart!');

  console.log('\n3️⃣ Verifying target user (Eyu Ase) in Neon DB...');
  const dbUser = await query(`
    SELECT id, full_name, phone, telegram_id, status, suspend_reason 
    FROM users 
    WHERE id = $1
  `, [testUuid]);

  assert.strictEqual(dbUser.rows.length, 1, 'Target user Eyu Ase must exist');
  const userRow = dbUser.rows[0];
  console.log(`   User found: ${userRow.full_name} (${userRow.id})`);
  console.log(`   DB Status: ${userRow.status}`);
  console.log(`   DB Suspend Reason: ${userRow.suspend_reason}`);
  assert.strictEqual(userRow.status, 'active', 'User status in PostgreSQL must be active');
  assert.strictEqual(userRow.suspend_reason, null, 'User suspend_reason in PostgreSQL must be null');
  console.log('   ✅ Neon DB state verified as active!');

  console.log('\n🎉 ALL Phase 1 Tests Passed Successfully!\n');
  await pool.end();
}

runTest().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
