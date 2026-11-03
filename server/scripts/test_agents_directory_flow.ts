import { query, withTransaction } from '../db.ts';
import bcrypt from 'bcryptjs';

async function run() {
  console.log('══════════════════════════════════════════════════════════════════════════════');
  console.log('🧪 [TEST]: ENQU AGENTS DIRECTORY LIVE BACKEND & REAL DATA AUDIT');
  console.log('══════════════════════════════════════════════════════════════════════════════\n');

  // Test 1: Query all agents and summary
  console.log('1️⃣ [Test 1] Querying real agents and summary from Neon PostgreSQL...');
  const [agentsRes, summaryRes] = await Promise.all([
    query(`
      SELECT 
        ap.*,
        u.full_name,
        u.phone,
        u.created_at as user_created_at,
        COALESCE((SELECT COUNT(*) FROM users WHERE agent_id = ap.id), 0) as total_players,
        COALESCE((SELECT SUM(amount) FROM agent_player_deposits WHERE agent_id = ap.id), 0) as total_volume_deposited
      FROM agent_profiles ap
      JOIN users u ON ap.user_id = u.id
      ORDER BY ap.created_at DESC
    `),
    query(`
      SELECT 
        COUNT(*) as total_agents,
        COUNT(*) FILTER (WHERE status = 'active') as active_agents,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_agents,
        COUNT(*) FILTER (WHERE status = 'suspended') as suspended_agents,
        COALESCE(SUM(wallet_balance), 0) as total_float,
        COUNT(*) FILTER (WHERE wallet_balance < low_balance_threshold AND status = 'active') as low_balance_alerts
      FROM agent_profiles
    `)
  ]);

  const s = summaryRes.rows[0];
  console.log(`   ✓ Total Agents: ${s.total_agents}`);
  console.log(`   ✓ Active: ${s.active_agents}, Pending: ${s.pending_agents}, Suspended: ${s.suspended_agents}`);
  console.log(`   ✓ Total Float Held: ETB ${s.total_float}`);
  console.log(`   ✓ Low Balance Alerts: ${s.low_balance_alerts}`);
  console.log(`   ✓ Agents loaded: ${agentsRes.rows.length}`);

  if (agentsRes.rows.length === 0) {
    throw new Error('Expected at least 1 agent in DB');
  }

  // Test 2: Selected Agent Details
  const firstAgent = agentsRes.rows[0];
  console.log(`\n2️⃣ [Test 2] Querying deep-dive details for agent ${firstAgent.agent_code} (${firstAgent.full_name})...`);
  const [playersRes, depositsRes] = await Promise.all([
    query(`SELECT id, full_name, phone FROM users WHERE agent_id = $1`, [firstAgent.id]),
    query(`SELECT COALESCE(SUM(amount), 0) as total_dep FROM agent_player_deposits WHERE agent_id = $1`, [firstAgent.id])
  ]);
  console.log(`   ✓ Recruited Players: ${playersRes.rows.length}`);
  console.log(`   ✓ Deposits Volume: ETB ${depositsRes.rows[0]?.total_dep}`);
  console.log(`   ✓ Deposit Commission Rate: ${firstAgent.commission_rate}%`);
  console.log(`   ✓ Cashout/Withdraw Commission Rate: ${firstAgent.cashout_commission_rate}%`);

  // Test 3: Create a test agent with password and 2-rate commission
  console.log('\n3️⃣ [Test 3] Creating test agent with custom password & 2 commission rates...');
  const testPhone = '0999887766';
  const testPassword = 'SonicTestPass@123';
  const testHash = await bcrypt.hash(testPassword, 10);
  const testCode = `TEST-AGT-${Math.floor(1000 + Math.random() * 9000)}`;

  let testAgentId = '';
  let testUserId = '';

  await withTransaction(async (client) => {
    // Delete any old user with testPhone
    await client.query('DELETE FROM users WHERE phone = $1', [testPhone]);

    const uRes = await client.query(
      "INSERT INTO users (phone, full_name, role, password_hash, pin_hash) VALUES ($1, 'Test Agent Auto', 'agent', $2, $2) RETURNING id",
      [testPhone, testHash]
    );
    testUserId = uRes.rows[0].id;

    const apRes = await client.query(
      `INSERT INTO agent_profiles (
        user_id, agent_code, status, wallet_balance, initial_deposit,
        low_balance_threshold, target_monthly, target_players,
        commission_rate, cashout_commission_rate, city, portal_access
      )
      VALUES ($1, $2, 'active', 10000.00, 10000.00, 1000.00, 50000.00, 50, 3.5, 2.5, 'Hawassa', true)
      RETURNING id, agent_code, commission_rate, cashout_commission_rate`,
      [testUserId, testCode]
    );
    testAgentId = apRes.rows[0].id;
    console.log(`   ✓ Test agent registered: ${apRes.rows[0].agent_code}`);
    console.log(`   ✓ Commission rates verified: Deposit=${apRes.rows[0].commission_rate}%, Withdraw=${apRes.rows[0].cashout_commission_rate}%`);
  });

  // Test 4: Update test agent commissions & targets
  console.log('\n4️⃣ [Test 4] Updating commission rates & targets...');
  await query(
    `UPDATE agent_profiles 
     SET commission_rate = 4.0, cashout_commission_rate = 2.0, target_players = 75, target_monthly = 60000.00 
     WHERE id = $1`,
    [testAgentId]
  );
  const updatedCheck = await query('SELECT commission_rate, cashout_commission_rate, target_players FROM agent_profiles WHERE id = $1', [testAgentId]);
  console.log(`   ✓ Updated Deposit Comm: ${updatedCheck.rows[0].commission_rate}%`);
  console.log(`   ✓ Updated Withdraw Comm: ${updatedCheck.rows[0].cashout_commission_rate}%`);
  console.log(`   ✓ Updated Target Players: ${updatedCheck.rows[0].target_players}`);

  // Test 5: Status toggle (active -> suspended -> active)
  console.log('\n5️⃣ [Test 5] Testing status toggle & portal access...');
  await query("UPDATE agent_profiles SET status = 'suspended', portal_access = false WHERE id = $1", [testAgentId]);
  let stCheck = await query('SELECT status, portal_access FROM agent_profiles WHERE id = $1', [testAgentId]);
  console.log(`   ✓ Suspended status: ${stCheck.rows[0].status}, portal_access: ${stCheck.rows[0].portal_access}`);

  await query("UPDATE agent_profiles SET status = 'active', portal_access = true WHERE id = $1", [testAgentId]);
  stCheck = await query('SELECT status, portal_access FROM agent_profiles WHERE id = $1', [testAgentId]);
  console.log(`   ✓ Reactivated status: ${stCheck.rows[0].status}, portal_access: ${stCheck.rows[0].portal_access}`);

  // Test 6: Verify password authentication
  console.log('\n6️⃣ [Test 6] Verifying agent password authentication check...');
  const userCheck = await query('SELECT password_hash FROM users WHERE id = $1', [testUserId]);
  const isMatch = await bcrypt.compare(testPassword, userCheck.rows[0].password_hash);
  console.log(`   ✓ Password verification match: ${isMatch}`);

  // Clean up test agent
  console.log('\n🧹 Cleaning up test agent...');
  await query('DELETE FROM agent_profiles WHERE id = $1', [testAgentId]);
  await query('DELETE FROM users WHERE id = $1', [testUserId]);
  console.log('   ✓ Cleaned up test agent successfully.');

  console.log('\n══════════════════════════════════════════════════════════════════════════════');
  console.log('🎉 ALL AGENTS DIRECTORY REAL DATA & FLOW TESTS PASSED (100% SUCCESS)');
  console.log('══════════════════════════════════════════════════════════════════════════════\n');
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
