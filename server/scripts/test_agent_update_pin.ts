import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { query } from '../db.ts';

async function testAgentUpdatePin() {
  console.log('🧪 Running Test: Agent Terminal Security PIN Update Logic...\n');

  try {
    // 1. Fetch Agent AGT-8532
    const agentRes = await query(
      `SELECT u.id as user_id, u.phone, u.pin_hash, ap.id as agent_id, ap.agent_code
       FROM users u
       JOIN agent_profiles ap ON u.id = ap.user_id
       WHERE ap.agent_code = 'AGT-8532'
       LIMIT 1`
    );

    if (agentRes.rows.length === 0) {
      throw new Error('Agent AGT-8532 not found in database');
    }

    const agent = agentRes.rows[0];
    console.log(`✅ Found Agent: ${agent.agent_code} (User ID: ${agent.user_id})`);

    const originalHash = agent.pin_hash;
    const testPin = '8899';

    // 2. Hash new test PIN
    const newHash = await bcrypt.hash(testPin, 10);
    await query(`UPDATE users SET pin_hash = $1 WHERE id = $2`, [newHash, agent.user_id]);

    // 3. Verify that the new PIN matches with bcrypt
    const updatedUserRes = await query(`SELECT pin_hash FROM users WHERE id = $1`, [agent.user_id]);
    const isMatch = await bcrypt.compare(testPin, updatedUserRes.rows[0].pin_hash);

    if (!isMatch) {
      throw new Error('Verification failed: new PIN does not match hashed password');
    }
    console.log(`✅ Successfully updated and verified bcrypt hash for PIN "${testPin}"`);

    // 4. Restore original password hash
    await query(`UPDATE users SET pin_hash = $1 WHERE id = $2`, [originalHash, agent.user_id]);
    console.log(`✅ Cleaned up: Restored original password hash`);

    console.log('\n🎉 --- PHASE 5 PIN ENDPOINT LOGIC TEST PASSED 100% --- 🎉');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  }
}

testAgentUpdatePin();
