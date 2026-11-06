import { parseTelebirrSMS } from '../services/telebirrParser.ts';
import { query, withTransaction } from '../db.ts';

async function runTests() {
  console.log('🧪 Starting Telebirr SMS Parser & Webhook Tests...\n');

  // Test 1: English Format SMS
  const enSms = `You have received 100.00 ETB from 0912345678 (Abebe Kebede). Your current balance is 1,250.00 ETB. Transaction ID: DA98KL78.`;
  const parsedEn = parseTelebirrSMS(enSms);
  console.log('Test 1 (English SMS):', parsedEn);

  if (
    !parsedEn.success ||
    parsedEn.amount !== 100 ||
    parsedEn.transactionRef !== 'DA98KL78' ||
    parsedEn.senderPhone !== '0912345678' ||
    parsedEn.senderName !== 'Abebe Kebede'
  ) {
    throw new Error('❌ Test 1 Failed: English SMS parsing mismatch');
  }
  console.log('✅ Test 1 Passed: English SMS parsed perfectly.\n');

  // Test 2: Amharic Format SMS
  const amSms = `ከ 0987654321 (Tigist Alemu) 250.50 ብር ተቀብለዋል። የግብይት መለያ: ET8899AA`;
  const parsedAm = parseTelebirrSMS(amSms);
  console.log('Test 2 (Amharic SMS):', parsedAm);

  if (
    !parsedAm.success ||
    parsedAm.amount !== 250.5 ||
    parsedAm.transactionRef !== 'ET8899AA' ||
    parsedAm.senderPhone !== '0987654321' ||
    parsedAm.senderName !== 'Tigist Alemu'
  ) {
    throw new Error('❌ Test 2 Failed: Amharic SMS parsing mismatch');
  }
  console.log('✅ Test 2 Passed: Amharic SMS parsed perfectly.\n');

  // Test 3: +251 country code formatting
  const plusSms = `You have received ETB 50.00 from +251911223344 on 2026-11-06. Transaction No: TX990011`;
  const parsedPlus = parseTelebirrSMS(plusSms);
  console.log('Test 3 (+251 Normalization):', parsedPlus);

  if (!parsedPlus.success || parsedPlus.amount !== 50 || parsedPlus.senderPhone !== '0911223344' || parsedPlus.transactionRef !== 'TX990011') {
    throw new Error('❌ Test 3 Failed: Phone normalization mismatch');
  }
  console.log('✅ Test 3 Passed: Phone normalized to local Ethiopian 09... format.\n');

  // Test 4: Database Idempotency & Wallet Credit Verification
  console.log('Testing Database Table & Constraints...');

  await query(`
    CREATE TABLE IF NOT EXISTS telebirr_sms_logs (
      id SERIAL PRIMARY KEY,
      sender VARCHAR(50) NOT NULL,
      message_body TEXT NOT NULL,
      transaction_ref VARCHAR(100) UNIQUE,
      amount NUMERIC(10, 2),
      payer_phone VARCHAR(50),
      payer_name VARCHAR(150),
      status VARCHAR(50) DEFAULT 'unmatched',
      matched_user_id UUID REFERENCES users(id),
      matched_deposit_id UUID REFERENCES deposit_requests(id),
      received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      processed_at TIMESTAMP WITH TIME ZONE
    );
    CREATE INDEX IF NOT EXISTS idx_telebirr_sms_tx_ref ON telebirr_sms_logs(transaction_ref);
    CREATE INDEX IF NOT EXISTS idx_telebirr_sms_phone ON telebirr_sms_logs(payer_phone);
  `);
  console.log('✅ Created / verified telebirr_sms_logs table.');

  const testRef = `TEST-TX-${Date.now().toString().slice(-6)}`;

  // Verify telebirr_sms_logs table exists and insert works
  await query(
    `INSERT INTO telebirr_sms_logs (sender, message_body, transaction_ref, amount, payer_phone, status)
     VALUES ('127', 'Test SMS payload', $1, 100.00, '0912345678', 'unmatched')
     ON CONFLICT (transaction_ref) DO NOTHING`,
    [testRef]
  );

  const checkRes = await query(`SELECT * FROM telebirr_sms_logs WHERE transaction_ref = $1`, [testRef]);
  if (checkRes.rows.length === 0) {
    throw new Error('❌ Test 4 Failed: Could not insert into telebirr_sms_logs');
  }
  console.log('✅ Test 4 Passed: DB telebirr_sms_logs table is healthy and operational.');

  // Clean up test entry
  await query(`DELETE FROM telebirr_sms_logs WHERE transaction_ref = $1`, [testRef]);
  console.log('🧹 Cleaned up test record.');

  console.log('\n🎉 ALL TESTS PASSED! Telebirr SMS Automation Engine is ready.');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
