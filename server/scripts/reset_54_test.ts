import { query } from '../db.ts';

async function resetTest() {
  console.log('🔄 Cleaning up stuck pending deposit for DKD54QRAFD...');
  const del = await query(`DELETE FROM agent_deposit_requests WHERE transaction_code = 'DKD54QRAFD'`);
  console.log(`Deleted ${del.rowCount} rows from agent_deposit_requests.`);

  const upd = await query(`
    UPDATE telebirr_sms_logs 
    SET status = 'unmatched', matched_user_id = NULL, matched_deposit_id = NULL, matched_agent_deposit_id = NULL 
    WHERE transaction_ref = 'DKD54QRAFD'
  `);
  console.log(`Reset ${upd.rowCount} rows in telebirr_sms_logs to 'unmatched'.`);
  process.exit(0);
}

resetTest().catch(console.error);
