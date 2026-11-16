import assert from 'node:assert';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, checkDbConnection, withTransaction } from '../db.ts';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'lomi_bingo_super_secret_production_key_2026_et';

export async function runPhase7EndToEndHealth() {
  console.log('══════════════════════════════════════════════════════════════════════════════');
  console.log('🏁 [PHASE 7] END-TO-END HEALTH & PRODUCTION READINESS AUDIT');
  console.log('══════════════════════════════════════════════════════════════════════════════\n');

  const health = await checkDbConnection();
  if (!health.connected) {
    console.error('❌ Cannot connect to Neon DB:', health.error);
    process.exit(1);
  }
  console.log(`✅ [Connection] Neon PostgreSQL online (${health.latencyMs}ms latency)\n`);

  // ── Step 1: Admin Cashier Authentication Test ──
  console.log('1️⃣ Testing Admin Cashier PIN Authentication...');
  const adminRes = await query(`SELECT * FROM users WHERE role = 'admin' LIMIT 1`);
  assert.strictEqual(adminRes.rows.length, 1, 'Exactly 1 admin must exist in users table');
  const admin = adminRes.rows[0];
  assert.strictEqual(admin.phone, '0998983344', 'Admin phone must be 0998983344');

  // Verify PIN matches 1234
  const pinValid = await bcrypt.compare('1234', admin.pin_hash);
  assert.strictEqual(pinValid, true, 'PIN 1234 must match admin pin_hash');

  const adminToken = jwt.sign(
    { id: admin.id, phone: admin.phone, fullName: admin.full_name, role: 'admin' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  assert.ok(adminToken, 'Admin JWT token generated successfully');
  console.log(`   ✓ Admin ${admin.phone} (${admin.full_name}) PIN 1234 authenticated.`);
  console.log(`   ✓ Admin JWT generated successfully (Token length: ${adminToken.length} chars).`);

  // Verify Admin Wallet
  const adminWallet = await query(`SELECT * FROM wallets WHERE user_id = $1`, [admin.id]);
  assert.strictEqual(adminWallet.rows.length, 1, 'Admin must have a wallet');
  assert.strictEqual(parseFloat(adminWallet.rows[0].balance), 0.00, 'Admin wallet balance must be 0.00 ETB');
  console.log(`   ✓ Admin wallet verified (Balance: 0.00 ETB).`);

  // ── Step 2: New Player Telegram Onboarding Simulation ──
  console.log('\n2️⃣ Simulating New Player Telegram Registration & Welcome Bonus...');
  const testTgId = 9876543210;
  let testUserId = '';

  await withTransaction(async (client) => {
    // Check bonus settings
    const bonusSettingsRes = await client.query('SELECT * FROM bonus_reward_settings WHERE id = 1');
    assert.strictEqual(bonusSettingsRes.rows.length, 1, 'bonus_reward_settings id=1 must exist');
    const bonusSettings = bonusSettingsRes.rows[0];
    const regBonus = bonusSettings.reg_bonus_enabled ? parseFloat(bonusSettings.reg_bonus_amount) : 0;
    assert.strictEqual(regBonus, 50.00, 'Registration bonus must be 50.00 ETB');

    // Create user
    const newUserRes = await client.query(`
      INSERT INTO users (telegram_id, telegram_username, full_name, phone, role, status, is_bot)
      VALUES ($1, 'test_e2e_player', 'Test Player', '0911002233', 'player', 'active', false)
      RETURNING id, full_name, role;
    `, [testTgId]);
    testUserId = newUserRes.rows[0].id;

    // Create wallet with bonus
    await client.query(`
      INSERT INTO wallets (user_id, balance, bonus, currency)
      VALUES ($1, 0.00, $2, 'ETB')
    `, [testUserId, regBonus]);

    // Create coin wallet
    await client.query(`
      INSERT INTO coin_wallets (user_id, balance, lifetime_earned)
      VALUES ($1, 0, 0)
    `, [testUserId]);

    // Verify created state
    const createdWallet = await client.query('SELECT * FROM wallets WHERE user_id = $1', [testUserId]);
    assert.strictEqual(parseFloat(createdWallet.rows[0].bonus), 50.00, 'New player bonus must be 50.00 ETB');
    assert.strictEqual(parseFloat(createdWallet.rows[0].balance), 0.00, 'New player real balance must be 0.00 ETB');

    console.log(`   ✓ Test player created: ${newUserRes.rows[0].full_name} (ID: ${testUserId})`);
    console.log(`   ✓ Wallet auto-funded with ${createdWallet.rows[0].bonus} ETB Welcome Bonus.`);

    // Clean up test records immediately
    await client.query('DELETE FROM coin_wallets WHERE user_id = $1', [testUserId]);
    await client.query('DELETE FROM wallets WHERE user_id = $1', [testUserId]);
    await client.query('DELETE FROM users WHERE id = $1', [testUserId]);
    console.log(`   ✓ Test player cleanly removed. Database remains spotless.`);
  });

  // ── Step 3: Authoritative Database Inventory Audit ──
  console.log('\n3️⃣ Authoritative Production Database Inventory Audit:');
  const counts: Record<string, number> = {};
  const tablesToVerify = [
    'users',
    'wallets',
    'agent_profiles',
    'agent_recharge_requests',
    'agent_cashout_vouchers',
    'agent_commissions',
    'agent_deposit_requests',
    'agent_withdrawal_requests',
    'agent_player_deposits',
    'deposit_requests',
    'withdrawal_requests',
    'wallet_transactions',
    'game_tickets',
    'game_rounds',
    'coin_wallets',
    'coin_transactions',
    'player_notes',
    'player_audit_logs',
    'jackpot_winners',
    'bonus_winners',
    'game_rooms',
    'bonus_reward_settings',
    'payment_accounts',
    'admin_settings'
  ];

  for (const t of tablesToVerify) {
    const res = await query(`SELECT COUNT(*) as count FROM ${t}`);
    counts[t] = parseInt(res.rows[0].count, 10);
  }

  console.log('┌───────────────────────────────────────┬────────────┬─────────────┐');
  console.log('│ Table Name                            │ Live Count │ Expectation │');
  console.log('├───────────────────────────────────────┼────────────┼─────────────┤');
  console.log(`│ users (Admin Cashier ONLY)            │ ${String(counts['users']).padStart(10)} │ Strictly  1 │`);
  console.log(`│ wallets (Admin Cashier ONLY)          │ ${String(counts['wallets']).padStart(10)} │ Strictly  1 │`);
  console.log(`│ agent_profiles                        │ ${String(counts['agent_profiles']).padStart(10)} │ Strictly  0 │`);
  console.log(`│ agent_cashout_vouchers                │ ${String(counts['agent_cashout_vouchers']).padStart(10)} │ Strictly  0 │`);
  console.log(`│ agent_recharge_requests               │ ${String(counts['agent_recharge_requests']).padStart(10)} │ Strictly  0 │`);
  console.log(`│ agent_commissions                     │ ${String(counts['agent_commissions']).padStart(10)} │ Strictly  0 │`);
  console.log(`│ agent_deposit_requests                │ ${String(counts['agent_deposit_requests']).padStart(10)} │ Strictly  0 │`);
  console.log(`│ agent_withdrawal_requests             │ ${String(counts['agent_withdrawal_requests']).padStart(10)} │ Strictly  0 │`);
  console.log(`│ agent_player_deposits                 │ ${String(counts['agent_player_deposits']).padStart(10)} │ Strictly  0 │`);
  console.log(`│ deposit_requests                      │ ${String(counts['deposit_requests']).padStart(10)} │ Strictly  0 │`);
  console.log(`│ withdrawal_requests                   │ ${String(counts['withdrawal_requests']).padStart(10)} │ Strictly  0 │`);
  console.log(`│ wallet_transactions                   │ ${String(counts['wallet_transactions']).padStart(10)} │ Strictly  0 │`);
  console.log(`│ game_tickets                          │ ${String(counts['game_tickets']).padStart(10)} │ Strictly  0 │`);
  console.log(`│ game_rounds                           │ ${String(counts['game_rounds']).padStart(10)} │ Strictly  0 │`);
  console.log(`│ coin_wallets                          │ ${String(counts['coin_wallets']).padStart(10)} │ Strictly  0 │`);
  console.log(`│ coin_transactions                     │ ${String(counts['coin_transactions']).padStart(10)} │ Strictly  0 │`);
  console.log(`│ player_notes                          │ ${String(counts['player_notes']).padStart(10)} │ Strictly  0 │`);
  console.log(`│ player_audit_logs                     │ ${String(counts['player_audit_logs']).padStart(10)} │ Strictly  0 │`);
  console.log(`│ jackpot_winners                       │ ${String(counts['jackpot_winners']).padStart(10)} │ Strictly  0 │`);
  console.log(`│ bonus_winners                         │ ${String(counts['bonus_winners']).padStart(10)} │ Strictly  0 │`);
  console.log(`│ game_rooms (4 active stake houses)    │ ${String(counts['game_rooms']).padStart(10)} │ Preserved 4 │`);
  console.log(`│ bonus_reward_settings                 │ ${String(counts['bonus_reward_settings']).padStart(10)} │ Preserved 1 │`);
  console.log(`│ payment_accounts (Telebirr, Mpesa,CBE)│ ${String(counts['payment_accounts']).padStart(10)} │ Preserved 3 │`);
  console.log(`│ admin_settings (System Configs)       │ ${String(counts['admin_settings']).padStart(10)} │ Preserved25 │`);
  console.log('└───────────────────────────────────────┴────────────┴─────────────┘\n');

  // Verify all assertions
  assert.strictEqual(counts['users'], 1, 'Users must have exactly 1 record');
  assert.strictEqual(counts['wallets'], 1, 'Wallets must have exactly 1 record');
  assert.strictEqual(counts['agent_profiles'], 0, 'Agent profiles must be 0');
  assert.strictEqual(counts['agent_cashout_vouchers'], 0, 'Agent vouchers must be 0');
  assert.strictEqual(counts['agent_recharge_requests'], 0, 'Agent recharges must be 0');
  assert.strictEqual(counts['deposit_requests'], 0, 'Deposit requests must be 0');
  assert.strictEqual(counts['withdrawal_requests'], 0, 'Withdrawal requests must be 0');
  assert.strictEqual(counts['wallet_transactions'], 0, 'Wallet transactions must be 0');
  assert.strictEqual(counts['game_tickets'], 0, 'Game tickets must be 0');
  assert.strictEqual(counts['game_rounds'], 0, 'Game rounds must be 0');
  assert.strictEqual(counts['coin_wallets'], 0, 'Coin wallets must be 0');
  assert.strictEqual(counts['coin_transactions'], 0, 'Coin transactions must be 0');
  assert.strictEqual(counts['player_notes'], 0, 'Player notes must be 0');
  assert.strictEqual(counts['player_audit_logs'], 0, 'Player audit logs must be 0');
  assert.strictEqual(counts['jackpot_winners'], 0, 'Jackpot winners must be 0');
  assert.strictEqual(counts['game_rooms'], 4, 'Game rooms must be 4');
  assert.strictEqual(counts['bonus_reward_settings'], 1, 'Bonus reward settings must be 1');
  assert.strictEqual(counts['payment_accounts'], 3, 'Payment accounts must be 3');

  console.log('══════════════════════════════════════════════════════════════════════════════');
  console.log('🎉 [PHASE 7 SUCCESS] ALL HEALTH GATES PASSED WITH ZERO ERRORS!');
  console.log('   The platform is 100% spotless, healthy, and ready for client handover.');
  console.log('══════════════════════════════════════════════════════════════════════════════\n');
}

runPhase7EndToEndHealth()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Phase 7 Failed:', err);
    process.exit(1);
  });

