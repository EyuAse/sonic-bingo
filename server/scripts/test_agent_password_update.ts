import { query, pool } from '../db.ts';
import bcrypt from 'bcryptjs';
import assert from 'assert';

async function test() {
  console.log('🧪 Testing Real Agent Password / PIN Update & Login Verification...');

  const phone = '0988776655';
  const initialPass = 'Sonic@1234';
  const newPass = 'Sonic@NewPass99';

  // Cleanup old test records
  await query(`DELETE FROM users WHERE phone = $1`, [phone]);

  let userId = '';
  let agentId = '';

  try {
    const hashedInitial = await bcrypt.hash(initialPass, 10);
    const userRes = await query(
      `INSERT INTO users (phone, full_name, role, password_hash, pin_hash)
       VALUES ($1, 'Test Agent Pass', 'agent', $2, $2) RETURNING id`,
      [phone, hashedInitial]
    );
    userId = userRes.rows[0].id;

    const apRes = await query(
      `INSERT INTO agent_profiles (user_id, agent_code, status, wallet_balance, initial_deposit)
       VALUES ($1, 'AGT-TEST-PASS', 'active', 10000, 10000) RETURNING id, agent_code`,
      [userId]
    );
    agentId = apRes.rows[0].id;

    console.log(`👤 Created test agent user: ${userId}, code: ${apRes.rows[0].agent_code}`);

    // Verify initial login password works
    const check1 = await query(`SELECT password_hash, pin_hash FROM users WHERE id = $1`, [userId]);
    const matchesInitial = await bcrypt.compare(initialPass, check1.rows[0].password_hash);
    assert.strictEqual(matchesInitial, true, 'Initial password must match');
    console.log('✅ Initial password verified successfully.');

    // Simulate password update with valid current password
    const cleanCurrent = initialPass.trim();
    const cleanNew = newPass.trim();

    // Check verification logic from handlePasswordUpdate
    let isValidCurrent = false;
    const existingHash = check1.rows[0].password_hash || check1.rows[0].pin_hash;
    if (existingHash) {
      isValidCurrent = await bcrypt.compare(cleanCurrent, existingHash);
    }
    assert.strictEqual(isValidCurrent, true, 'Current password verification must succeed');

    // Hash new password and update in DB
    const hashedNew = await bcrypt.hash(cleanNew, 10);
    await query(
      `UPDATE users 
       SET pin_hash = $1, password_hash = $1, updated_at = NOW() 
       WHERE id = $2`,
      [hashedNew, userId]
    );
    console.log('🔄 Updated password_hash and pin_hash in database.');

    // Verify old password NO LONGER works
    const check2 = await query(`SELECT password_hash, pin_hash FROM users WHERE id = $1`, [userId]);
    const oldStillWorks = await bcrypt.compare(initialPass, check2.rows[0].password_hash);
    assert.strictEqual(oldStillWorks, false, 'Old password must NOT work anymore');
    console.log('✅ Verified old password is invalid.');

    // Verify new password works
    const newWorks = await bcrypt.compare(newPass, check2.rows[0].password_hash);
    assert.strictEqual(newWorks, true, 'New password must match');
    console.log('✅ Verified new password matches.');

    // Verify login query matches with new password
    const loginUserRes = await query(
      `SELECT u.*, ap.id as agent_profile_id, ap.agent_code, ap.status as agent_status
       FROM users u
       JOIN agent_profiles ap ON u.id = ap.user_id
       WHERE u.phone = $1 AND u.role IN ('agent', 'admin')`,
      [phone]
    );
    const loginUser = loginUserRes.rows[0];
    const loginHash = loginUser.pin_hash || loginUser.password_hash;
    const loginMatch = await bcrypt.compare(newPass, loginHash);
    assert.strictEqual(loginMatch, true, 'Agent login with new password must succeed');
    console.log('🎉 Agent login simulation with new password SUCCEEDED 100%!');

  } finally {
    if (userId) {
      await query(`DELETE FROM users WHERE id = $1`, [userId]);
      console.log('🧹 Cleaned up test user.');
    }
  }
}

test().then(() => process.exit(0)).catch(e => { console.error('❌ Test failed:', e); process.exit(1); });
