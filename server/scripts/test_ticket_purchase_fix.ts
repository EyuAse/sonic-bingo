import { gameEngine } from '../game/BingoGameEngine.ts';
import { query } from '../db.ts';

async function main() {
  console.log('========================================================');
  console.log('🧪 VERIFYING HANDLEBUY_TICKET FIX (NO ISPREBUY ERROR)');
  console.log('========================================================\n');

  const engine = gameEngine;
  const room = engine.getRoom('room-10');
  if (!room) {
    throw new Error('Room 10 not found');
  }

  // Force room into lobby phase for testing
  room.phase = 'lobby';
  room.lobbyCountdown = 40;

  // Fetch or create a test user wallet
  const userRes = await query('SELECT id, full_name FROM users WHERE is_bot = false LIMIT 1');
  if (userRes.rows.length === 0) {
    throw new Error('No user found');
  }
  const testUser = userRes.rows[0];

  // Ensure user has at least 50 ETB in wallet
  await query('UPDATE wallets SET balance = GREATEST(balance, 50.00) WHERE user_id = $1', [testUser.id]);

  console.log(`Testing ticket purchase for user: ${testUser.full_name} (${testUser.id})...`);
  const result = await engine.handleBuyTicket(
    testUser.id,
    testUser.full_name,
    'room-10',
    [105], // Cartela #105
    'mock-socket-test-123',
    10,
    true
  );

  console.log('Purchase result:', result);

  if (!result.success) {
    throw new Error(`Ticket purchase failed with error: ${result.error}`);
  }

  if (result.preBoughtForNextRound !== false) {
    throw new Error(`Expected preBoughtForNextRound to be false, got: ${result.preBoughtForNextRound}`);
  }

  if (!result.tickets || result.tickets.length === 0) {
    throw new Error('Expected tickets array to be returned');
  }

  console.log('\n🎉 PASS: handleBuyTicket returned success: true with preBoughtForNextRound: false!');
  console.log(`Assigned Cartela ID: ${result.tickets[0].cartelaId}`);
  console.log('Zero runtime ReferenceErrors thrown!');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
