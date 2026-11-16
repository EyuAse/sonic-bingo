import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { walletAdapter } from './db/walletAdapter.ts';
import { ATLAS_V_PAYTABLE, calculateRTP } from './game/kenoMath.ts';
import { ProvablyFairKeno } from './game/provablyFair.ts';
import { KenoGameEngine } from './game/KenoGameEngine.ts';
import { setupKenoSockets } from './sockets/kenoSocket.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

const PORT = 5050; // Dedicated standalone port (completely separate from Sonic Bingo)

app.use(cors());
app.use(express.json());

// Serve static standalone client files
const staticPath = path.resolve(__dirname, '..');
app.use(express.static(staticPath));

// ── Initialize Standalone Keno Game Engine ──
const kenoEngine = KenoGameEngine.getInstance(walletAdapter);

// REST: Health Check
app.get('/api/keno/health', (req, res) => {
  res.json({
    status: 'online',
    game: 'Atlas-V Fast Keno',
    port: PORT,
    environment: 'standalone-isolated',
    currentRound: kenoEngine.currentRoundNumber,
    phase: kenoEngine.currentPhase,
    timeRemaining: kenoEngine.phaseTimeRemaining,
    timestamp: new Date().toISOString()
  });
});

// REST: Current Live State
app.get('/api/keno/state', (req, res) => {
  res.json(kenoEngine.getCurrentState());
});

// REST: Hot / Cold Numbers Statistics
app.get('/api/keno/stats', (req, res) => {
  res.json(kenoEngine.getHotColdStats());
});

// REST: Official Atlas-V Paytable & Theoretical RTP
app.get('/api/keno/paytable', (req, res) => {
  const rtpReport: Record<number, string> = {};
  for (let spots = 1; spots <= 10; spots++) {
    rtpReport[spots] = `${(calculateRTP(spots) * 100).toFixed(2)}%`;
  }

  res.json({
    game: 'Atlas-V Fast Keno (80-Ball)',
    maxMultiplier: '10,000x',
    refundOnZeroHits: [7, 8, 9, 10],
    paytable: ATLAS_V_PAYTABLE,
    theoreticalRTP: rtpReport
  });
});

// REST: Mock Wallet Balance Check
app.get('/api/keno/wallet/:userId', async (req, res) => {
  const userId = req.params.userId || 'demo-user-1';
  const balance = await walletAdapter.getBalance(userId);
  res.json(balance);
});

// REST: Place Ticket Endpoint
app.post('/api/keno/bet', async (req, res) => {
  const { userId = 'demo-user-1', selectedNumbers, betAmount, isBonus = false } = req.body;
  const result = await kenoEngine.placeTicket(userId, selectedNumbers, betAmount, isBonus);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

// Initialize Socket.IO on Port 5050
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Wire Socket Handlers & Engine Event Broadcasters
setupKenoSockets(io, kenoEngine);

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 [Atlas-V Fast Keno Standalone Server]`);
  console.log(`📡 Port: http://localhost:${PORT}`);
  console.log(`🎮 Client: http://localhost:${PORT}/index.html`);
  console.log(`⏱️ Round Engine: ACTIVE (Round #${kenoEngine.currentRoundNumber})`);
  console.log(`🛡️ Isolated Workspace: keno-game/ (Zero DB & Zero Sonic Bingo files touched)`);
  console.log(`======================================================\n`);
});

export { app, server, io, kenoEngine };
