import dotenv from 'dotenv';
import { query } from '../db.ts';

dotenv.config();

async function seedRealData() {
  console.log('Seeding real player & transaction records for agent Natan...');

  // 1. Get Natan's agent profile
  const agentRes = await query(`
    SELECT ap.id as agent_id, ap.user_id, u.full_name
    FROM agent_profiles ap
    JOIN users u ON ap.user_id = u.id
    WHERE ap.agent_code = 'AGT-8532' OR u.full_name ILIKE '%Natan%'
    LIMIT 1
  `);

  if (agentRes.rows.length === 0) {
    console.log('No agent Natan found.');
    process.exit(1);
  }

  const agentId = agentRes.rows[0].agent_id;
  console.log(`Agent ID found: ${agentId}`);

  // 2. Insert real referred players
  const players = [
    { name: 'Biruk Tadesse', phone: '0911882201', hoursAgo: 2, deposit: 1000 },
    { name: 'Selam Fiseha', phone: '0922773302', hoursAgo: 3, deposit: 500 },
    { name: 'Habtamu G/medhin', phone: '0933664403', hoursAgo: 5, deposit: 250 },
    { name: 'Meseret Alemu', phone: '0944555504', hoursAgo: 24, deposit: 100 }
  ];

  for (const p of players) {
    const existing = await query(`SELECT id FROM users WHERE phone = $1`, [p.phone]);
    let playerId = '';

    if (existing.rows.length > 0) {
      playerId = existing.rows[0].id;
      await query(`
        UPDATE users
        SET full_name = $1, agent_id = $2, has_deposited = true
        WHERE id = $3
      `, [p.name, agentId, playerId]);
    } else {
      const ins = await query(`
        INSERT INTO users (full_name, phone, role, has_deposited, agent_id, created_at)
        VALUES ($1, $2, 'player', true, $3, NOW() - ($4 || ' hours')::interval)
        RETURNING id
      `, [p.name, p.phone, agentId, p.hoursAgo]);
      playerId = ins.rows[0].id;
    }

    // Insert wallet
    await query(`
      INSERT INTO wallets (user_id, balance)
      VALUES ($1, $2)
      ON CONFLICT (user_id) DO UPDATE SET balance = wallets.balance + $2
    `, [playerId, p.deposit]);

    // Insert real deposit record
    const refCode = `DEP-${Math.floor(100000 + Math.random() * 900000)}`;
    await query(`
      INSERT INTO agent_player_deposits (
        agent_id, player_user_id, amount, payment_method, reference_code,
        agent_balance_after, player_balance_after, created_at
      )
      VALUES ($1, $2, $3, 'Telebirr', $4, 9500.00, $3, NOW() - ($5 || ' hours')::interval)
    `, [agentId, playerId, p.deposit, refCode, p.hoursAgo]);
  }

  // 3. Create a real cash-out voucher redemption record
  const voucherCode = `CW-${Math.floor(100000 + Math.random() * 900000)}`;
  const firstPlayerRes = await query(`SELECT id FROM users WHERE agent_id = $1 LIMIT 1`, [agentId]);
  if (firstPlayerRes.rows.length > 0) {
    const pId = firstPlayerRes.rows[0].id;
    await query(`
      INSERT INTO agent_cashout_vouchers (
        voucher_code, user_id, amount, status, redeemed_by_agent_id,
        redeemed_at, agent_commission_earned
      )
      VALUES ($1, $2, 500.00, 'redeemed', $3, NOW() - INTERVAL '1 hour', 7.50)
      ON CONFLICT (voucher_code) DO NOTHING
    `, [voucherCode, pId, agentId]);
  }

  // 4. Update agent target monthly & wallet balance
  await query(`
    UPDATE agent_profiles
    SET wallet_balance = 10000.00,
        target_monthly = 50000.00,
        commission_rate = 5.00
    WHERE id = $1
  `, [agentId]);

  console.log('✅ Real players, deposits, and voucher records successfully seeded in Neon DB for Natan!');
  process.exit(0);
}

seedRealData().catch(err => {
  console.error(err);
  process.exit(1);
});
