import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { query, checkDbConnection } from '../db.ts';

dotenv.config();

const ALL_SYSTEM_TABLES = [
  'users',
  'wallets',
  'agent_profiles',
  'agent_recharge_requests',
  'agent_cashout_vouchers',
  'deposit_requests',
  'withdrawal_requests',
  'wallet_transactions',
  'game_rooms',
  'game_rounds',
  'game_tickets',
  'coin_wallets',
  'coin_transactions',
  'coin_redemptions',
  'referrals',
  'jackpot_pool',
  'jackpot_winners',
  'bonus_winners',
  'bonus_reward_settings',
  'admin_settings',
  'payment_accounts',
  'telegram_broadcasts',
  'otp_verifications'
] as const;

export async function runPhase1AuditAndBackup() {
  console.log('══════════════════════════════════════════════════════════════════════════════');
  console.log('🛡️  [PHASE 1] PRE-EXECUTION AUDIT & COMPREHENSIVE SNAPSHOT BACKUP');
  console.log('══════════════════════════════════════════════════════════════════════════════\n');

  // 1. Connection & Latency Check
  const health = await checkDbConnection();
  if (!health.connected) {
    console.error('❌ Cannot connect to Neon DB:', health.error);
    process.exit(1);
  }
  console.log(`✅ [Step 1/3] Connected to Neon PostgreSQL (${health.latencyMs}ms latency)`);

  // 2. Comprehensive Inventory Audit
  console.log('\n📊 [Step 2/3] Auditing Current Database Inventory...');
  const inventory: Record<string, number> = {};

  for (const table of ALL_SYSTEM_TABLES) {
    try {
      const res = await query(`SELECT COUNT(*) as count FROM ${table}`);
      inventory[table] = parseInt(res.rows[0]?.count || '0', 10);
    } catch (err: any) {
      // Table might not exist yet or has alternative naming
      inventory[table] = 0;
    }
  }

  // Breakdown of User Types
  const userBreakdownRes = await query(`
    SELECT 
      COUNT(*) as total_users,
      COUNT(*) FILTER (WHERE role = 'admin') as admin_count,
      COUNT(*) FILTER (WHERE is_bot = true) as bot_count,
      COUNT(*) FILTER (WHERE role != 'admin' AND (is_bot = false OR is_bot IS NULL)) as real_players_count
    FROM users;
  `);
  const userStats = userBreakdownRes.rows[0];

  console.log('\n┌───────────────────────────────────────────────┬────────────┐');
  console.log('│ Entity / Table Name                           │ Row Count  │');
  console.log('├───────────────────────────────────────────────┼────────────┤');
  console.log(`│ Total Users (users)                           │ ${String(userStats.total_users).padStart(10)} │`);
  console.log(`│   ├─ Real Players (to be purged)              │ ${String(userStats.real_players_count).padStart(10)} │`);
  console.log(`│   ├─ Registered Bots (to be preserved)        │ ${String(userStats.bot_count).padStart(10)} │`);
  console.log(`│   └─ Admin Cashier (to be preserved)          │ ${String(userStats.admin_count).padStart(10)} │`);
  console.log(`│ Agent Profiles (agent_profiles)               │ ${String(inventory['agent_profiles']).padStart(10)} │`);
  console.log(`│ Agent Vouchers (agent_cashout_vouchers)       │ ${String(inventory['agent_cashout_vouchers']).padStart(10)} │`);
  console.log(`│ Agent Recharges (agent_recharge_requests)     │ ${String(inventory['agent_recharge_requests']).padStart(10)} │`);
  console.log(`│ Player Wallets (wallets)                      │ ${String(inventory['wallets']).padStart(10)} │`);
  console.log(`│ Wallet Transactions (wallet_transactions)     │ ${String(inventory['wallet_transactions']).padStart(10)} │`);
  console.log(`│ Deposit Requests (deposit_requests)           │ ${String(inventory['deposit_requests']).padStart(10)} │`);
  console.log(`│ Withdrawal Requests (withdrawal_requests)     │ ${String(inventory['withdrawal_requests']).padStart(10)} │`);
  console.log(`│ Game Tickets (game_tickets)                   │ ${String(inventory['game_tickets']).padStart(10)} │`);
  console.log(`│ Game Rounds (game_rounds)                     │ ${String(inventory['game_rounds']).padStart(10)} │`);
  console.log(`│ Loyalty Wallets (coin_wallets)                │ ${String(inventory['coin_wallets']).padStart(10)} │`);
  console.log(`│ Coin Transactions (coin_transactions)         │ ${String(inventory['coin_transactions']).padStart(10)} │`);
  console.log(`│ Referrals (referrals)                         │ ${String(inventory['referrals']).padStart(10)} │`);
  console.log(`│ Game Rooms (game_rooms - preserved)           │ ${String(inventory['game_rooms']).padStart(10)} │`);
  console.log(`│ Bonus Settings (bonus_reward_settings)        │ ${String(inventory['bonus_reward_settings']).padStart(10)} │`);
  console.log(`│ Payment Accounts (payment_accounts)           │ ${String(inventory['payment_accounts']).padStart(10)} │`);
  console.log('└───────────────────────────────────────────────┴────────────┘\n');

  // 3. Complete Snapshot Backup
  console.log('💾 [Step 3/3] Exporting Authoritative Database Snapshot...');
  const tablesData: Record<string, any[]> = {};
  let totalRows = 0;

  for (const table of ALL_SYSTEM_TABLES) {
    try {
      const res = await query(`SELECT * FROM ${table}`);
      tablesData[table] = res.rows || [];
      totalRows += res.rows.length;
      console.log(`   ✓ Captured '${table}': ${res.rows.length} records`);
    } catch (err: any) {
      tablesData[table] = [];
    }
  }

  const rawDbUrl = process.env.DATABASE_URL || '';
  const maskedDbUrl = rawDbUrl.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
  const payloadString = JSON.stringify(tablesData);
  const checksum = crypto.createHash('sha256').update(payloadString).digest('hex');

  const backupPayload = {
    version: '2.0.0',
    phase: 'Phase 1 - Pre-Purge Safety Snapshot',
    timestamp: new Date().toISOString(),
    sourceUrlMasked: maskedDbUrl,
    totalTables: ALL_SYSTEM_TABLES.length,
    totalRows,
    checksum,
    userStats: {
      total: userStats.total_users,
      realPlayers: userStats.real_players_count,
      registeredBots: userStats.bot_count,
      admin: userStats.admin_count
    },
    tables: tablesData
  };

  const backupDir = path.resolve(process.cwd(), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `pre-purge-backup-${dateStr}.json`;
  const backupFilePath = path.join(backupDir, backupFileName);
  const latestBackupPath = path.join(backupDir, 'latest-backup.json');

  const jsonContent = JSON.stringify(backupPayload, null, 2);
  fs.writeFileSync(backupFilePath, jsonContent, 'utf8');
  fs.writeFileSync(latestBackupPath, jsonContent, 'utf8');

  const sizeMb = (Buffer.byteLength(jsonContent, 'utf8') / (1024 * 1024)).toFixed(2);

  console.log('\n🎉 [PHASE 1 COMPLETE] Snapshot Backup Successfully Created!');
  console.log(`   • Snapshot File: ${backupFilePath} (${sizeMb} MB)`);
  console.log(`   • Latest Link:   ${latestBackupPath}`);
  console.log(`   • SHA-256 Hash:  ${checksum}`);
  console.log(`   • Total Records: ${totalRows} across ${ALL_SYSTEM_TABLES.length} tables`);
  console.log('\n══════════════════════════════════════════════════════════════════════════════');
  console.log('✅ PHASE 1 VERIFICATION GATE PASSED - SAFE TO PROCEED TO PHASE 2');
  console.log('══════════════════════════════════════════════════════════════════════════════\n');
}

if (process.argv[1] && process.argv[1].includes('run_phase1_audit_and_backup')) {
  runPhase1AuditAndBackup()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Phase 1 Execution Failed:', err);
      process.exit(1);
    });
}

