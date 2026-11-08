import { query, pool } from '../db.ts';

async function resetRoom10Jackpot() {
  console.log('🔄 Resetting Progressive Jackpot for Room 10 to 0.00 ETB in Neon PostgreSQL...');

  const updateRes = await query(`
    UPDATE jackpot_pool 
    SET balance = 0.00, 
        seed_amount = 0.00, 
        updated_at = NOW() 
    WHERE room_id = 'room-10'
    RETURNING *;
  `);

  console.log('✅ Updated Room 10 Jackpot Pool:');
  console.table(updateRes.rows);

  // Check all rooms in jackpot_pool
  const allRes = await query('SELECT room_id, balance, seed_amount, updated_at FROM jackpot_pool ORDER BY room_id');
  console.log('📋 All Jackpot Pools in Neon DB:');
  console.table(allRes.rows);

  await pool.end();
  process.exit(0);
}

resetRoom10Jackpot().catch(err => {
  console.error('❌ Failed to reset jackpot:', err);
  process.exit(1);
});
