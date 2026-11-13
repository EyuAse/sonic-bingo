import { query } from '../db.ts';

async function check() {
  console.log('--- RECENT SMS LOGS ---');
  const sms = await query(`
    SELECT id, sender, transaction_ref, amount, payer_phone, recipient_name, status, received_at, message_body 
    FROM telebirr_sms_logs 
    ORDER BY received_at DESC 
    LIMIT 5
  `);
  console.log(JSON.stringify(sms.rows, null, 2));

  console.log('--- RECENT AGENT DEPOSIT REQUESTS ---');
  const deps = await query(`
    SELECT id, player_id, amount, player_phone, transaction_code, status, rejection_reason, created_at 
    FROM agent_deposit_requests 
    ORDER BY created_at DESC 
    LIMIT 5
  `);
  console.log(JSON.stringify(deps.rows, null, 2));
  process.exit(0);
}

check().catch((e) => {
  console.error(e);
  process.exit(1);
});

