import dotenv from 'dotenv';
import { query } from '../db.ts';

dotenv.config();

async function cleanMockPlayers() {
  console.log('🧹 Cleaning mock test players from Neon DB...');

  const phones = ['0911882201', '0922773302', '0933664403', '0944555504'];
  const names = ['Biruk Tadesse', 'Selam Fiseha', 'Habtamu G/medhin', 'Meseret Alemu'];

  // Find their user IDs
  const userRes = await query(`
    SELECT id, full_name, phone 
    FROM users 
    WHERE phone = ANY($1) OR full_name = ANY($2)
  `, [phones, names]);

  console.log(`Found ${userRes.rows.length} mock users in database:`, userRes.rows);

  if (userRes.rows.length > 0) {
    const userIds = userRes.rows.map(r => r.id);

    // 1. Delete agent deposits
    const depDel = await query(`DELETE FROM agent_player_deposits WHERE player_user_id = ANY($1)`, [userIds]);
    console.log(`Deleted ${depDel.rowCount} mock agent deposits.`);

    // 2. Delete test vouchers if any
    const vouchDel = await query(`DELETE FROM agent_cashout_vouchers WHERE user_id = ANY($1)`, [userIds]);
    console.log(`Deleted ${vouchDel.rowCount} mock cashout vouchers.`);

    // 3. Delete any test transactions
    try {
      const txDel = await query(`DELETE FROM wallet_transactions WHERE user_id = ANY($1)`, [userIds]);
      console.log(`Deleted ${txDel.rowCount} mock wallet transactions.`);
    } catch (e) {
      console.log('wallet_transactions cleanup skipped:', e);
    }

    // 4. Delete deposit requests if any
    try {
      const depReqDel = await query(`DELETE FROM agent_deposit_requests WHERE player_id = ANY($1)`, [userIds]);
      console.log(`Deleted ${depReqDel.rowCount} mock deposit requests.`);
    } catch (e) {
      console.log('agent_deposit_requests cleanup skipped:', e);
    }

    // 5. Delete coin wallets if any
    try {
      const cwDel = await query(`DELETE FROM coin_wallets WHERE user_id = ANY($1)`, [userIds]);
      console.log(`Deleted ${cwDel.rowCount} mock coin wallets.`);
    } catch (e) {
      console.log('coin_wallets cleanup skipped:', e);
    }

    // 6. Delete wallets
    const walDel = await query(`DELETE FROM wallets WHERE user_id = ANY($1)`, [userIds]);
    console.log(`Deleted ${walDel.rowCount} mock wallets.`);

    // 7. Delete users
    const usrDel = await query(`DELETE FROM users WHERE id = ANY($1)`, [userIds]);
    console.log(`Deleted ${usrDel.rowCount} mock users.`);
  }

  console.log('✅ Mock players cleanup completed successfully!');
  process.exit(0);
}

cleanMockPlayers().catch(err => {
  console.error('❌ Error during cleanup:', err);
  process.exit(1);
});

