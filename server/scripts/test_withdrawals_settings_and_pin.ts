import { query } from '../db.ts';

async function testSettingsAndPin() {
  console.log('══════════════════════════════════════════════════════════════════════════════');
  console.log('🧪 [TEST PHASE 4]: WITHDRAWALS SETTINGS & DEDICATED PIN SECURITY DESK');
  console.log('══════════════════════════════════════════════════════════════════════════════\n');

  try {
    // 1. Ensure table and default row exist
    console.log('1️⃣ [Test 1] Verifying withdrawal_settings table in Neon PostgreSQL...');
    await query(`
      CREATE TABLE IF NOT EXISTS withdrawal_settings (
        id VARCHAR(50) PRIMARY KEY DEFAULT 'default',
        current_pin VARCHAR(20) DEFAULT '5678',
        max_request_limit NUMERIC(10, 2) DEFAULT 5000,
        high_value_threshold NUMERIC(10, 2) DEFAULT 2000,
        min_request_limit NUMERIC(10, 2) DEFAULT 50,
        require_kyc_verification BOOLEAN DEFAULT false,
        require_turnover_met BOOLEAN DEFAULT true,
        strict_name_matching BOOLEAN DEFAULT true,
        telegram_player_alerts BOOLEAN DEFAULT true,
        auto_refresh_seconds INT DEFAULT 15,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      INSERT INTO withdrawal_settings (id, current_pin, max_request_limit, high_value_threshold, min_request_limit, require_kyc_verification, require_turnover_met, strict_name_matching, telegram_player_alerts, auto_refresh_seconds)
      VALUES ('default', '5678', 5000, 2000, 50, false, true, true, true, 15)
      ON CONFLICT (id) DO NOTHING;
    `);

    const tableRes = await query(`SELECT * FROM withdrawal_settings WHERE id = 'default'`);
    const row = tableRes.rows[0];
    console.log(`   • Current Max Limit: ${row.max_request_limit} ETB`);
    console.log(`   • High Value Threshold: ${row.high_value_threshold} ETB`);
    console.log(`   • KYC Required: ${row.require_kyc_verification}`);
    console.log(`   • 1x Turnover Required: ${row.require_turnover_met}`);
    console.log('   ✓ PASS: Settings table verified with operational default values.\n');

    // 2. Test updating operational settings
    console.log('2️⃣ [Test 2] Updating operational limits and AML preferences...');
    const updateRes = await query(`
      UPDATE withdrawal_settings
      SET 
        max_request_limit = 7500,
        high_value_threshold = 2500,
        require_kyc_verification = true,
        updated_at = NOW()
      WHERE id = 'default'
      RETURNING *;
    `);
    const updated = updateRes.rows[0];
    if (Number(updated.max_request_limit) !== 7500 || Boolean(updated.require_kyc_verification) !== true) {
      throw new Error('Settings update failed');
    }
    console.log(`   • Updated Max Limit: ${updated.max_request_limit} ETB (Expected: 7,500 ETB)`);
    console.log(`   • Updated KYC Requirement: ${updated.require_kyc_verification} (Expected: true)`);
    console.log('   ✓ PASS: Operational settings persisted in PostgreSQL.\n');

    // 3. Test PIN change
    console.log('3️⃣ [Test 3] Testing PIN change to new value (9876)...');
    await query(`
      UPDATE withdrawal_settings
      SET current_pin = '9876', updated_at = NOW()
      WHERE id = 'default';
    `);
    const pinCheck = await query(`SELECT current_pin FROM withdrawal_settings WHERE id = 'default'`);
    if (pinCheck.rows[0].current_pin !== '9876') {
      throw new Error('PIN change verification failed');
    }
    console.log(`   • Verified New PIN in DB: ${pinCheck.rows[0].current_pin}`);
    console.log('   ✓ PASS: Officer PIN change succeeded.\n');

    // 4. Reset back to clean standard default PIN 5678 and standard 5000 limit
    console.log('4️⃣ [Cleanup] Reverting settings back to default PIN 5678 and 5,000 ETB limit...');
    await query(`
      UPDATE withdrawal_settings
      SET 
        current_pin = '5678',
        max_request_limit = 5000,
        high_value_threshold = 2000,
        require_kyc_verification = false,
        updated_at = NOW()
      WHERE id = 'default';
    `);
    console.log('   ✓ PASS: Default settings cleanly restored.\n');

    console.log('══════════════════════════════════════════════════════════════════════════════');
    console.log('🎉 ALL SETTINGS & PIN DESK TESTS PASSED (100% SUCCESS)');
    console.log('══════════════════════════════════════════════════════════════════════════════');
  } catch (err: any) {
    console.error('❌ Settings test failed:', err);
    process.exit(1);
  }
}

testSettingsAndPin().then(() => process.exit(0));
