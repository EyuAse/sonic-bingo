import dotenv from 'dotenv';
import { checkDbConnection, query } from '../db.ts';
import { clearUserStatusCache } from '../middleware/auth.ts';
import { gameEngine } from '../game/BingoGameEngine.ts';

dotenv.config();

export async function runPhase6() {
  console.log('══════════════════════════════════════════════════════════════════════════════');
  console.log('🔄 [PHASE 6] IN-MEMORY ENGINE RESYNC & CACHE FLUSH');
  console.log('══════════════════════════════════════════════════════════════════════════════\n');

  const health = await checkDbConnection();
  if (!health.connected) {
    console.error('❌ Cannot connect to Neon DB:', health.error);
    process.exit(1);
  }
  console.log(`✅ [Connection] Neon PostgreSQL online (${health.latencyMs}ms latency)\n`);

  // 1. Flush User Status Cache
  console.log('1️⃣ Flushing user authentication and suspension status cache...');
  clearUserStatusCache();
  console.log('   ✓ In-memory userStatusCache cleared.');

  // 2. Reload Deposited Users into Game Engine
  console.log('\n2️⃣ Resyncing verified depositors in GameEngine...');
  await gameEngine.loadDepositedUsers();
  console.log(`   ✓ In-memory depositedUsers count: ${gameEngine.getDepositedUserCount()}`);

  // 3. Reload Jackpot Pools into Game Engine
  console.log('\n3️⃣ Resyncing progressive jackpot pools in GameEngine...');
  await gameEngine.loadJackpotPools();

  // 4. Inspect Game Rooms
  console.log('\n4️⃣ Checking Game Engine Stake Rooms State:');
  const roomIds = ['room-10', 'room-20', 'room-50', 'room-100'];
  for (const roomId of roomIds) {
    const r = gameEngine.getRoom(roomId);
    if (!r) {
      console.error(`❌ Room ${roomId} not found in GameEngine!`);
      process.exit(1);
    }
    console.log(`   - ${r.name} (${r.id}):`);
    console.log(`     * Phase:             ${r.phase}`);
    console.log(`     * Active Tickets:    ${r.tickets.size}`);
    console.log(`     * Next Tickets:      ${r.nextRoundTickets?.size || 0}`);
    console.log(`     * Jackpot Pool:      ${r.jackpotPoolBalance} ETB`);
    console.log(`     * Dynamic Bots:      ${r.dynamicBotTarget ?? 'N/A'}`);
    console.log(`     * Standby Opponents: ${r.opponentCards?.length || 0}`);
  }

  console.log('\n══════════════════════════════════════════════════════════════════════════════');
  console.log('🎉 [PHASE 6 SUCCESS] In-memory engine resynced and caches flushed successfully!');
  console.log('══════════════════════════════════════════════════════════════════════════════\n');
}

runPhase6()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Phase 6 Failed:', err);
    process.exit(1);
  });

