import { query, pool } from '../db.ts';

async function check() {
  const users = await query(`
    SELECT id, full_name, phone, telegram_id, telegram_username, status, suspend_reason, suspended_at 
    FROM users 
    WHERE phone LIKE '%983624574%' OR full_name ILIKE '%Eyu Ase%'
  `);
  console.log('User status in DB:', JSON.stringify(users.rows, null, 2));

  for (const u of users.rows) {
    const logs = await query(`
      SELECT * FROM player_audit_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5
    `, [u.id]);
    console.log(`Audit logs for ${u.full_name} (${u.id}):`, JSON.stringify(logs.rows, null, 2));
  }

  await pool.end();
}

check();
