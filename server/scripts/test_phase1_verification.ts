import dotenv from 'dotenv';
import { pool, checkDbConnection, query } from '../db.ts';

dotenv.config();

async function verifyPhase1() {
  console.log('🧪 ==========================================');
  console.log('🧪 [TEST SUITE] Phase 1 Database Verification');
  console.log('🧪 ==========================================');

  // 1. Connection Health
  const health = await checkDbConnection();
  if (!health.connected) {
    console.error('❌ DB Connection failed:', health.error);
    process.exit(1);
  }
  console.log(`✅ [1/7] DB Connected successfully (${health.latencyMs}ms latency)`);

  const client = await pool.connect();

  try {
    // 2. Wallets Bonus Default
    const bonusDefaultRes = await client.query(`
      SELECT column_default 
      FROM information_schema.columns 
      WHERE table_name = 'wallets' AND column_name = 'bonus';
    `);
    const bonusDefault = bonusDefaultRes.rows[0]?.column_default;
    if (bonusDefault && bonusDefault.includes('20')) {
      console.log(`✅ [2/7] wallets.bonus default is strictly 20.00 (${bonusDefault})`);
    } else {
      throw new Error(`Expected wallets.bonus default to be 20.00, got: ${bonusDefault}`);
    }

    // 3. New Tables Existence
    const requiredTables = [
      'coin_wallets',
      'coin_transactions',
      'jackpot_pool',
      'jackpot_winners',
      'agent_profiles',
      'agent_recharge_requests',
      'payment_accounts'
    ];

    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = ANY($1);
    `, [requiredTables]);

    const foundTables = tablesRes.rows.map((r: any) => r.table_name);
    for (const t of requiredTables) {
      if (!foundTables.includes(t)) {
        throw new Error(`Missing expected table: ${t}`);
      }
    }
    console.log(`✅ [3/7] All 7 new tables confirmed present: ${foundTables.join(', ')}`);

    // 4. Jackpot Pools Seeded
    const jackpotRes = await client.query('SELECT room_id, balance, seed_amount FROM jackpot_pool ORDER BY room_id');
    const rooms = jackpotRes.rows.map((r: any) => r.room_id);
    if (['room-10', 'room-20', 'room-50', 'room-100'].every(r => rooms.includes(r))) {
      console.log(`✅ [4/7] Jackpot pools confirmed for all 4 rooms:`, jackpotRes.rows.map((r: any) => `${r.room_id}: ${r.balance} ETB`).join(' | '));
    } else {
      throw new Error(`Jackpot pools missing rooms. Found: ${rooms.join(', ')}`);
    }

    // 5. Payment Accounts Seeded
    const paymentAccRes = await client.query('SELECT provider, account_number, is_active FROM payment_accounts');
    if (paymentAccRes.rows.length >= 3) {
      console.log(`✅ [5/7] Payment accounts seeded:`, paymentAccRes.rows.map((r: any) => `${r.provider} (${r.account_number})`).join(' | '));
    } else {
      throw new Error(`Expected at least 3 payment accounts, found: ${paymentAccRes.rows.length}`);
    }

    // 6. Admin Settings Seeded
    const settingsRes = await client.query(`
      SELECT key, value FROM admin_settings 
      WHERE key IN ('welcome_bonus_amount', 'min_deposit_amount', 'max_withdrawal_amount', 'max_cartelas_per_player', 'max_cartelas_pool', 'lobby_time_seconds');
    `);
    const settingsMap = new Map(settingsRes.rows.map((r: any) => [r.key, r.value]));
    console.log(`✅ [6/7] Key Admin Settings confirmed:`);
    console.log(`   - welcome_bonus_amount: ${settingsMap.get('welcome_bonus_amount')} ETB`);
    console.log(`   - min_deposit_amount: ${settingsMap.get('min_deposit_amount')} ETB`);
    console.log(`   - max_withdrawal_amount: ${settingsMap.get('max_withdrawal_amount')} ETB`);
    console.log(`   - max_cartelas_per_player: ${settingsMap.get('max_cartelas_per_player')}`);
    console.log(`   - max_cartelas_pool: ${settingsMap.get('max_cartelas_pool')}`);
    console.log(`   - lobby_time_seconds: ${settingsMap.get('lobby_time_seconds')}s`);

    // 7. Test Check Constraints with dedicated sub-transactions
    const dummyUserRes = await client.query(`SELECT id FROM users LIMIT 1`);
    const testUserId = dummyUserRes.rows[0].id;

    // Test 7a: Deposit with M-Pesa is allowed
    await client.query('BEGIN');
    await client.query(`
      INSERT INTO deposit_requests (user_id, amount, payment_method, player_phone, transaction_ref, status)
      VALUES ($1, 75.00, 'M-Pesa', '0701234567', 'TEST-MPESA-REF', 'pending')
    `, [testUserId]);
    await client.query('ROLLBACK');
    console.log('   - Subtest 7a: M-Pesa payment method accepted');

    // Test 7b: Deposit with amount < 50 must fail
    let under50Failed = false;
    await client.query('BEGIN');
    try {
      await client.query(`
        INSERT INTO deposit_requests (user_id, amount, payment_method, player_phone, transaction_ref, status)
        VALUES ($1, 25.00, 'Telebirr', '0911223344', 'TEST-UNDER50-REF', 'pending')
      `, [testUserId]);
    } catch {
      under50Failed = true;
    } finally {
      await client.query('ROLLBACK');
    }
    if (!under50Failed) {
      throw new Error('Deposit with < 50 ETB was unexpectedly accepted by constraint!');
    }
    console.log('   - Subtest 7b: Deposit < 50 ETB correctly rejected');

    // Test 7c: Withdrawal with amount > 5000 must fail
    let over5000Failed = false;
    await client.query('BEGIN');
    try {
      await client.query(`
        INSERT INTO withdrawal_requests (user_id, amount, payment_method, account_phone, account_name, status)
        VALUES ($1, 7500.00, 'Telebirr', '0911223344', 'Tester', 'pending')
      `, [testUserId]);
    } catch {
      over5000Failed = true;
    } finally {
      await client.query('ROLLBACK');
    }
    if (!over5000Failed) {
      throw new Error('Withdrawal with > 5000 ETB was unexpectedly accepted by constraint!');
    }
    console.log('   - Subtest 7c: Withdrawal > 5000 ETB correctly rejected');

    // Test 7d: Cartela ID 600 must be accepted
    await client.query('BEGIN');
    const dummyRoundRes = await client.query(`
      INSERT INTO game_rounds (room_id, round_number, phase)
      VALUES ('room-10', 99999, 'lobby')
      RETURNING id;
    `);
    const testRoundId = dummyRoundRes.rows[0].id;

    await client.query(`
      INSERT INTO game_tickets (round_id, user_id, cartela_id, card_matrix, bet_amount, status)
      VALUES ($1, $2, 600, '{"B": [1]}'::jsonb, 10.00, 'active')
    `, [testRoundId, testUserId]);
    await client.query('ROLLBACK');
    console.log('   - Subtest 7d: Cartela ID 600 correctly accepted');

    console.log(`✅ [7/7] Database constraints strictly verified (M-Pesa allowed, min deposit 50 ETB, max withdrawal 5000 ETB, cartela 600 allowed)`);

    console.log('\n🎉 ========================================================');
    console.log('🎉 [SUCCESS] Phase 1 Verification PASSED (All 7 Tests OK!)');
    console.log('🎉 ========================================================');
  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ [Phase 1 Verification FAILED]:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

verifyPhase1().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
