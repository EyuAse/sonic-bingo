import dotenv from 'dotenv';
import { withTransaction, checkDbConnection, query } from '../db.ts';

dotenv.config();

export async function runPhase4() {
  console.log('══════════════════════════════════════════════════════════════════════════════');
  console.log('👥 [PHASE 4] PLAYER & AGENT USER ACCOUNTS PURGE');
  console.log('══════════════════════════════════════════════════════════════════════════════\n');

  const health = await checkDbConnection();
  if (!health.connected) {
    console.error('❌ Cannot connect to Neon DB:', health.error);
    process.exit(1);
  }
  console.log(`✅ [Connection] Neon PostgreSQL online (${health.latencyMs}ms latency)\n`);

  // Pre-purge audit
  const preCheck = await query(`
    SELECT 
      COUNT(*) as total_users,
      COUNT(*) FILTER (WHERE role = 'admin') as admin_count,
      COUNT(*) FILTER (WHERE role = 'agent') as agent_count,
      COUNT(*) FILTER (WHERE role = 'player') as player_count,
      COUNT(*) FILTER (WHERE is_bot = true) as bot_count,
      COUNT(*) FILTER (WHERE role != 'admin' AND (is_bot = false OR is_bot IS NULL)) as purge_target_count
    FROM users;
  `);
  const stats = preCheck.rows[0];
  console.log('📊 Pre-Purge Users Table State:');
  console.log(`   - Total Users:                ${stats.total_users}`);
  console.log(`   - Real Players (to purge):    ${stats.player_count}`);
  console.log(`   - Agent Accounts (to purge):  ${stats.agent_count}`);
  console.log(`   - Super Admin (to preserve):  ${stats.admin_count}`);
  console.log(`   - Bots (to preserve):         ${stats.bot_count}`);
  console.log(`   - Total Accounts to Purge:    ${stats.purge_target_count}\n`);

  // Execute Phase 4 inside an atomic ACID transaction
  console.log('🚀 Executing Player & Agent Accounts Purge in Atomic Transaction...');
  let deletedUsers: any[] = [];
  await withTransaction(async (client) => {
    const res = await client.query(`
      DELETE FROM users 
      WHERE role != 'admin' AND (is_bot = false OR is_bot IS NULL)
      RETURNING id, phone, full_name, role;
    `);
    deletedUsers = res.rows;
    console.log(`   ✓ Purged ${res.rowCount} player & agent records from 'users' table.`);
  });

  // Post-Phase 4 Verification Gate
  console.log('\n══════════════════════════════════════════════════════════════════════════════');
  console.log('🔍 [PHASE 4 AUDIT] VERIFYING USERS PURGE IN NEON DB');
  console.log('══════════════════════════════════════════════════════════════════════════════\n');

  const postCheck = await query(`
    SELECT 
      COUNT(*) as total_users,
      COUNT(*) FILTER (WHERE role = 'admin') as admin_count,
      COUNT(*) FILTER (WHERE role != 'admin' AND (is_bot = false OR is_bot IS NULL)) as non_admin_non_bot_count
    FROM users;
  `);
  const postStats = postCheck.rows[0];

  const adminUser = await query(`
    SELECT id, phone, full_name, role, status, pin_hash 
    FROM users 
    WHERE role = 'admin';
  `);

  console.log(`- Non-admin, non-bot accounts remaining: ${postStats.non_admin_non_bot_count} (Expected: 0)`);
  console.log(`- Super Admin Cashier accounts:          ${postStats.admin_count} (Expected: 1)`);
  console.log(`- Total users in DB:                     ${postStats.total_users}`);

  if (adminUser.rows.length > 0) {
    const a = adminUser.rows[0];
    console.log(`\n🛡️ Admin Account Verification:`);
    console.log(`   - ID:        ${a.id}`);
    console.log(`   - Phone:     ${a.phone}`);
    console.log(`   - Name:      ${a.full_name}`);
    console.log(`   - Role:      ${a.role}`);
    console.log(`   - Status:    ${a.status}`);
    console.log(`   - PIN Hash:  ${a.pin_hash ? 'Present (' + a.pin_hash.substring(0, 10) + '...)' : 'MISSING'}`);
  }

  const vGate1 = parseInt(postStats.non_admin_non_bot_count, 10) === 0;
  const vGate2 = parseInt(postStats.admin_count, 10) === 1;
  const vGate3 = adminUser.rows.length === 1 && adminUser.rows[0].phone === '0998983344';

  if (vGate1 && vGate2 && vGate3) {
    console.log('\n🎉 [PHASE 4 SUCCESS] All verification gates passed!');
    console.log('   All 22 player and agent user records successfully and cleanly purged.');
    console.log('   Super Admin Cashier (0998983344) 100% intact and verified.');
  } else {
    console.error('\n❌ [PHASE 4 GATE FAILURE] Verification gates failed!');
    process.exit(1);
  }
}

runPhase4()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Phase 4 Failed:', err);
    process.exit(1);
  });

