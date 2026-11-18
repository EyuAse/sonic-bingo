import { query } from '../db.ts';

async function setJackpot480() {
  try {
    console.log('🔄 Checking existing jackpot_pool table...');
    const cur = await query('SELECT room_id, balance FROM jackpot_pool');
    console.log('Current pools in DB:', cur.rows);

    console.log('🚀 Updating room-10 jackpot pool to 480.00 ETB...');
    await query(`
      INSERT INTO jackpot_pool (room_id, balance, updated_at)
      VALUES ('room-10', 480.00, NOW())
      ON CONFLICT (room_id) 
      DO UPDATE SET balance = 480.00, updated_at = NOW();
    `);

    // Also update any aliases if present
    await query(`
      UPDATE jackpot_pool 
      SET balance = 480.00, updated_at = NOW() 
      WHERE room_id IN ('arena', 'default', 'room-10');
    `);

    const updated = await query('SELECT room_id, balance FROM jackpot_pool');
    console.log('✅ Updated pools in DB:', updated.rows);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error setting jackpot:', err);
    process.exit(1);
  }
}

setJackpot480();

