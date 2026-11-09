import { query, pool } from '../db.ts';

async function verify() {
  console.log('🧪 Verifying Admin Jackpot Overview & Continuous Rollover...');

  // 1. Query jackpot_pool in Neon DB
  const res = await query("SELECT * FROM jackpot_pool WHERE room_id = 'room-10'");
  const r10 = res.rows[0];
  console.log('📊 Room 10 DB Record:', {
    balance: r10.balance,
    seed_amount: r10.seed_amount,
    last_won_amount: r10.last_won_amount,
    updated_at: r10.updated_at
  });

  const balance = parseFloat(r10.balance);
  const target = parseFloat(r10.seed_amount || '500');

  if (target !== 500) {
    throw new Error(`Expected target 500 ETB, got ${target}`);
  }
  console.log(`✅ Target is correctly ${target} ETB (NOT 0 ETB)!`);

  // 2. Test simulating 1 round jackpot fee increment (+4.80 ETB on 200 ETB pot)
  const roundFee = 4.80;
  console.log(`🔄 Simulating round completion rollover (+${roundFee} ETB fee)...`);

  const rolloverRes = await query(`
    UPDATE jackpot_pool 
    SET balance = balance + $1, updated_at = NOW() 
    WHERE room_id = 'room-10' 
    RETURNING balance
  `, [roundFee]);

  const newBal = parseFloat(rolloverRes.rows[0].balance);
  console.log(`✅ New Jackpot Pool Balance: ${newBal} ETB (increased from ${balance} ETB)!`);

  if (newBal !== balance + roundFee) {
    throw new Error(`Expected balance ${balance + roundFee}, got ${newBal}`);
  }

  // 3. Verify Admin calculation logic
  const isTargetReached = newBal >= target;
  const toReachTarget = Math.max(0, target - newBal);
  console.log(`📈 Admin Display State:`, {
    balance: `${newBal.toFixed(1)} ETB`,
    target: `${target.toFixed(1)} ETB`,
    status: isTargetReached ? 'Target Reached' : 'Accumulating',
    toReachTarget: `${toReachTarget.toFixed(1)} ETB`
  });

  if (isTargetReached) {
    throw new Error('Should not be Target Reached yet while balance < 500');
  }
  console.log('✅ Admin Display State is strictly "Accumulating" with accurate distance to 500 ETB target!');

  await pool.end();
  process.exit(0);
}

verify().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});

