import dotenv from 'dotenv';
dotenv.config();

import { query } from '../db.ts';

async function testRecentGames() {
  console.log('===============================================================');
  console.log('🧪 TESTING GET /api/wallet/recent-games DB QUERY & LOGIC');
  console.log('===============================================================\n');

  try {
    // 1. Query raw recent completed games from game_rounds
    console.log('1️⃣ Querying recent completed rounds from game_rounds...');
    const resAll = await query(`
      SELECT 
        gr.id,
        gr.room_id,
        gr.round_number,
        gr.phase,
        gr.drawn_numbers,
        gr.total_pot,
        gr.platform_fee,
        gr.winner_payout,
        gr.winner_user_ids,
        gr.winner_cartelas,
        gr.winner_names,
        gr.started_at,
        gr.ended_at,
        gr.created_at,
        COALESCE(rm.name, gr.room_id) as room_name,
        COALESCE(rm.stake_amount, 
          CASE 
            WHEN gr.room_id = 'room-10' THEN 10
            WHEN gr.room_id = 'room-20' THEN 20
            WHEN gr.room_id = 'room-50' THEN 50
            WHEN gr.room_id = 'room-100' THEN 100
            ELSE 10 
          END
        ) as room_stake,
        (SELECT COUNT(*) FROM game_tickets gt WHERE gt.round_id = gr.id) as total_tickets
      FROM game_rounds gr
      LEFT JOIN game_rooms rm ON gr.room_id = rm.id
      WHERE gr.phase = 'ended'
      ORDER BY gr.ended_at DESC NULLS LAST, gr.created_at DESC
      LIMIT 10;
    `);

    console.log(`   ✓ Found ${resAll.rows.length} completed rounds in Neon DB.`);
    if (resAll.rows.length > 0) {
      const sample = resAll.rows[0];
      const drawn = Array.isArray(sample.drawn_numbers) ? sample.drawn_numbers : [];
      console.log('   ✓ Sample Round #', sample.round_number);
      console.log('     • Room ID:       ', sample.room_id, `(${sample.room_stake} ETB)`);
      console.log('     • Total Pot:     ', sample.total_pot, 'ETB');
      console.log('     • Winner Payout: ', sample.winner_payout, 'ETB');
      console.log('     • Winner Name(s):', sample.winner_names);
      console.log('     • Balls Drawn:   ', drawn.length, 'balls');
      console.log('     • Total Tickets: ', sample.total_tickets);
    }

    // 2. Test stake room filtering
    console.log('\n2️⃣ Testing Stake Room Filtering...');
    for (const rid of ['room-10', 'room-20', 'room-50', 'room-100']) {
      const resRoom = await query(
        `SELECT COUNT(*) as count FROM game_rounds WHERE phase = 'ended' AND room_id = $1`,
        [rid]
      );
      console.log(`   ✓ ${rid}: ${resRoom.rows[0].count} completed rounds.`);
    }

    // 3. Test game number search
    if (resAll.rows.length > 0) {
      const targetRoundNum = resAll.rows[0].round_number;
      console.log(`\n3️⃣ Testing Game Number Search for #${targetRoundNum}...`);
      const searchRes = await query(
        `SELECT id, round_number, room_id FROM game_rounds WHERE phase = 'ended' AND round_number = $1`,
        [targetRoundNum]
      );
      console.log(`   ✓ Exact match found: Round #${searchRes.rows[0].round_number} (${searchRes.rows[0].room_id})`);
    }

    console.log('\n===============================================================');
    console.log('🎉 ALL RECENT GAMES DB VERIFICATIONS PASSED SUCCESSFULLY!');
    console.log('===============================================================');
    process.exit(0);
  } catch (err: any) {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  }
}

testRecentGames();
