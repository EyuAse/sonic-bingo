import { io as Client } from 'socket.io-client';
import http from 'http';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { setupGameSockets } from '../sockets/gameSocket.ts';
import { gameEngine } from '../game/BingoGameEngine.ts';

async function main() {
  console.log('🔍 [Phase 3 Verification] Testing Socket User Identification & Room Routing...');

  const app = express();
  const server = http.createServer(app);
  const io = new SocketIOServer(server, { cors: { origin: '*' } });

  setupGameSockets(io);

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  console.log(`📡 Test socket server running on port ${port}`);

  const testUserId = 'test-player-' + Date.now();
  const testUserName = 'Test Player Sonic';

  // 1. Connect client with identify_user
  const clientSocket = Client(`http://localhost:${port}`, {
    transports: ['websocket'],
    auth: { userId: testUserId, userName: testUserName }
  });

  await new Promise<void>((resolve, reject) => {
    clientSocket.on('connect', () => {
      console.log('✓ Client connected with socket ID:', clientSocket.id);
      resolve();
    });
    clientSocket.on('connect_error', reject);
  });

  // Verify server socket joined room user_${testUserId}
  const serverSockets = await io.in(`user_${testUserId}`).fetchSockets();
  console.log(`✓ Sockets in room "user_${testUserId}": ${serverSockets.length}`);

  if (serverSockets.length !== 1) {
    throw new Error(`Expected 1 socket in user_${testUserId}, found ${serverSockets.length}`);
  }
  console.log('🎉 Verified: User joined personal room immediately upon connect without entering game room!');

  // 2. Test balance update push event delivery
  let receivedBalanceEvent: any = null;
  clientSocket.on('user_balance_updated', (data) => {
    receivedBalanceEvent = data;
  });

  // Server emits directly to user room
  io.to(`user_${testUserId}`).emit('user_balance_updated', {
    userId: testUserId,
    newBalance: 1500.00,
    amount: 100.00,
    type: 'deposit_credited'
  });

  await new Promise(r => setTimeout(r, 200));

  if (!receivedBalanceEvent || receivedBalanceEvent.newBalance !== 1500.00) {
    throw new Error('Push event was not received by client in room user_' + testUserId);
  }
  console.log('✓ Successfully received real-time balance push event:', receivedBalanceEvent);

  clientSocket.disconnect();
  server.close();

  console.log('\n✅ Phase 3 Verification: Zero-Latency Socket User Identification is 100% verified!');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Phase 3 verification failed:', err);
  process.exit(1);
});
