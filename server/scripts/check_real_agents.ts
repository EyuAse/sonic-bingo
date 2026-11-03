import { query, pool } from '../db.ts';

async function checkAgents() {
  try {
    const agents = await query(`
      SELECT 
        ap.id,
        ap.agent_code,
        ap.status,
        ap.wallet_balance,
        ap.city,
        ap.telebirr_phone,
        ap.mpesa_phone,
        ap.cbe_account,
        u.full_name,
        u.phone,
        u.telegram_username
      FROM agent_profiles ap
      LEFT JOIN users u ON ap.user_id = u.id
      ORDER BY ap.created_at ASC
    `);
    console.log('Real agents:', JSON.stringify(agents.rows, null, 2));

    const recharges = await query(`
      SELECT 
        arr.id,
        arr.amount,
        arr.payment_method,
        arr.transaction_code,
        arr.status,
        arr.created_at,
        arr.receipt_image IS NOT NULL as has_receipt,
        ap.agent_code,
        u.full_name as agent_name,
        ap.wallet_balance
      FROM agent_recharge_requests arr
      JOIN agent_profiles ap ON arr.agent_id = ap.id
      JOIN users u ON ap.user_id = u.id
      ORDER BY arr.created_at DESC
    `);
    console.log('Real recharges with agents:', JSON.stringify(recharges.rows, null, 2));
  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

checkAgents();

