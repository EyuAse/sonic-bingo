import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { checkDbConnection, query } from './db.ts';

import authRouter from './routes/auth.ts';
import walletRouter from './routes/wallet.ts';
import adminRouter from './routes/admin.ts';
import agentRouter from './routes/agent.ts';
import telegramBotRouter from './routes/telegramBot.ts';
import { setupGameSockets } from './sockets/gameSocket.ts';
import { gameEngine } from './game/BingoGameEngine.ts';
import { telegramBotService } from './services/telegramBotService.ts';

import rateLimit from 'express-rate-limit';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { initSocketIO, io } from './io.ts';
export { io };

const app = express();
const server = http.createServer(app);

// Trust Render's reverse proxy so rate limiting tracks real client IPs
app.set('trust proxy', 1);

const PORT = process.env.PORT || 5000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

// Socket.IO Server Configuration with Mobile-Resilient Keep-Alive (15s timeout prevents cellular drops)
initSocketIO(server, CORS_ORIGIN);

// Setup Multiplayer Game Socket Handlers
setupGameSockets(io);

// Security & Body Parsers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// In-Memory Health Check Cache (Phase 3 Optimization: 30-second TTL)
// Drops repetitive uptime ping queries from ~5,760/day -> ~2,880/day, saving ~120 MB / 2 days of Neon bandwidth.
let cachedDbHealth: { connected: boolean; latencyMs: number; error?: string; timestamp: number } | null = null;
const HEALTH_CACHE_TTL_MS = 30000; // 30 seconds

// Health Check Endpoint
app.get('/api/health', async (_req, res) => {
  const now = Date.now();
  let dbHealth: { connected: boolean; latencyMs: number; error?: string };

  if (cachedDbHealth && (now - cachedDbHealth.timestamp) < HEALTH_CACHE_TTL_MS) {
    dbHealth = cachedDbHealth;
  } else {
    const freshHealth = await checkDbConnection();
    dbHealth = freshHealth;
    if (freshHealth.connected) {
      cachedDbHealth = { ...freshHealth, timestamp: now };
    } else {
      // Invalidate cache immediately on connection error so recovery is instant
      cachedDbHealth = null;
    }
  }

  res.status(dbHealth.connected ? 200 : 503).json({
    status: dbHealth.connected ? 'healthy' : 'degraded',
    service: 'Sonic Bingo Production API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    database: {
      provider: 'Neon PostgreSQL (Serverless Pooler)',
      connected: dbHealth.connected,
      latencyMs: dbHealth.latencyMs,
      error: dbHealth.error
    }
  });
});

// Maintenance Mode Guard (Can be toggled via MAINTENANCE_MODE=true in Render)
app.use((req, res, next) => {
  if (process.env.MAINTENANCE_MODE !== 'true') {
    return next();
  }

  // Bypass for Admin Desk, Health Check, and Telegram Inbound Webhooks
  if (
    req.path.startsWith('/api/health') ||
    req.path.startsWith('/api/admin') ||
    req.path.startsWith('/admin') ||
    req.path.startsWith('/api/telegram-webhook') ||
    req.path.startsWith('/api/telegram/webhook') ||
    req.path.startsWith('/telegram-webhook')
  ) {
    return next();
  }

  // API Requests: Return 503 Maintenance JSON
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
    return res.status(503).json({
      success: false,
      maintenance: true,
      error: 'ሶኒክ ቢንጎ በጊዜያዊ ጥገና ላይ ነው። ጨዋታዎች ለጊዜው ቆመዋል (Sonic Bingo is under scheduled maintenance).'
    });
  }

  // Browser / Telegram Webview Requests: Serve public/maintenance.html
  const maintenanceFile = path.join(__dirname, '..', 'public', 'maintenance.html');
  if (fs.existsSync(maintenanceFile)) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    return res.sendFile(maintenanceFile);
  }

  return res.status(503).send('Sonic Bingo is under scheduled maintenance. We will be back soon.');
});

// Network Health & Diagnostics Endpoint (Open for Admin and Client Status)
app.get('/api/network-health', (_req, res) => {
  res.json({
    success: true,
    metrics: gameEngine.getNetworkMetrics()
  });
});

// Rooms List Endpoint
app.get('/api/rooms', (_req, res) => {
  res.json({
    success: true,
    rooms: gameEngine.getAllRooms()
  });
});

// Progressive Jackpots Endpoint (Public & Client State)
app.get('/api/jackpots', async (_req, res) => {
  try {
    const dbRes = await query(`
      SELECT jp.room_id, jp.balance, jp.seed_amount, jp.last_won_amount, jp.last_won_at, jp.updated_at,
             gr.name as room_name, gr.stake_amount
      FROM jackpot_pool jp
      LEFT JOIN game_rooms gr ON jp.room_id = gr.id
      ORDER BY jp.room_id
    `);

    const jackpots = dbRes.rows.map(row => {
      const liveRoom = gameEngine.getRoom(row.room_id);
      return {
        roomId: row.room_id,
        roomName: row.room_name || liveRoom?.name || row.room_id,
        stakeAmount: liveRoom?.stakeAmount || parseFloat(row.stake_amount || '10'),
        balance: liveRoom?.jackpotPoolBalance !== undefined ? liveRoom.jackpotPoolBalance : parseFloat(row.balance || '0'),
        seedAmount: parseFloat(row.seed_amount || '0'),
        lastWonAmount: parseFloat(row.last_won_amount || '0'),
        lastWonAt: row.last_won_at,
        updatedAt: row.updated_at
      };
    });

    res.json({
      success: true,
      jackpots
    });
  } catch (err: any) {
    console.error('⚠️ [API] Failed to fetch jackpots:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch jackpot data' });
  }
});

// Dual-Engine HTTP Fallback State Sync for Low-Network / Disconnected Devices
app.get('/api/rooms/:id/sync', (req, res) => {
  const room = gameEngine.getRoom(req.params.id);
  if (!room) {
    return res.status(404).json({ success: false, error: 'Room not found' });
  }

  const userId = req.query.userId as string | undefined;
  let userTickets = null;
  let isPreBuy = false;

  if (userId) {
    if (room.tickets.has(userId)) {
      userTickets = room.tickets.get(userId);
    } else if (room.nextRoundTickets && room.nextRoundTickets.has(userId)) {
      userTickets = room.nextRoundTickets.get(userId);
      isPreBuy = true;
    }
  }

  // Compute occupied cartela IDs (same as broadcastRoomState) so HTTP polling matches socket payloads
  const occupiedCartelaIds: number[] = [];
  room.tickets.forEach(list => list.forEach(t => occupiedCartelaIds.push(t.cartelaId)));
  if (room.nextRoundTickets) {
    room.nextRoundTickets.forEach(list => list.forEach(t => occupiedCartelaIds.push(t.cartelaId)));
  }
  if (room.opponentCards && room.opponentCards.length > 0) {
    room.opponentCards.forEach(o => occupiedCartelaIds.push(o.cartelaId));
  }

  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.json({
    success: true,
    roomId: room.id,
    phase: room.phase,
    mode: room.mode || (gameEngine.getRealCartelaCount(room) >= 2 ? 'active' : 'spectating'),
    roundNumber: room.roundNumber,
    lobbyCountdown: room.lobbyCountdown,
    winnerCountdown: room.winnerCountdown,
    stakeAmount: room.stakeAmount,
    totalPot: room.totalPot,
    winnerPayout: room.winnerPayout,
    houseFee: room.houseFee || 0,
    jackpotFee: room.jackpotFee || 0,
    jackpotPool: room.jackpotPoolBalance || 0,
    playersCount: gameEngine.getRoomPlayersCount(room),
    drawnNumbers: room.drawnNumbers,
    totalDrawn: room.drawnNumbers.length,
    currentCall: room.currentCall,
    winResult: room.winResult,
    userTickets,
    isPreBuy,
    waitingForPlayers: room.waitingForPlayers || false,
    waitingForOtherHouses: room.waitingForOtherHouses || false,
    realPlayerCount: gameEngine.getRealCartelaCount(room),
    activeUsersCount: Math.max(room.activeUsers.size, room.activeSockets.size),
    occupiedCartelaIds,
    stakeRoomsSummary: gameEngine.getStakeRoomsSummary(),
    serverTime: Date.now()
  });
});

// Emergency Unstick & Reset Endpoint
app.post('/api/rooms/reset', (req, res) => {
  const roomId = req.query.roomId as string | undefined;
  gameEngine.forceResetRoomToLobby(roomId);
  res.json({ success: true, message: 'Rooms reset to synchronized lobby.' });
});

// Rate Limiters for DoS and Brute-Force Hardening
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // Telegram Mini Apps auto-auth on every open; 30 was too aggressive
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: 'Too many authentication attempts. Please try again in 15 minutes.' }
});

const walletLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 120, // Account for fallback polling during socket disconnection
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please slow down.' }
});

// Mount Routes with Rate Limiting
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/wallet', walletLimiter, walletRouter);
app.use('/api/agent', agentRouter);
app.use('/api/admin', adminRouter);
app.use('/api/admin/telegram', telegramBotRouter);
app.use('/api/telegram', telegramBotRouter);

// Public Inbound Telegram Webhook aliases (accepts /api/telegram-webhook, /api/telegram/webhook, /telegram-webhook)
app.post(['/api/telegram-webhook', '/api/telegram/webhook', '/telegram-webhook'], async (req, res) => {
  try {
    await telegramBotService.handleWebhookUpdate(req.body);
    return res.status(200).send('OK');
  } catch (err) {
    console.warn('Telegram webhook warning:', err);
    return res.status(200).send('OK');
  }
});

// Production Edge Shield: Offload all static frontend & asset traffic to Cloudflare CDN to preserve 0 MB Render bandwidth
const distPath = path.join(__dirname, '../dist');
const cloudflareFrontendUrl = (process.env.CLOUDFLARE_FRONTEND_URL || '').replace(/\/+$/, '');

if (cloudflareFrontendUrl) {
  app.use((req, res, next) => {
    if (
      req.path.startsWith('/api') ||
      req.path.startsWith('/socket.io') ||
      req.path.startsWith('/telegram-webhook')
    ) {
      return next();
    }
    if (req.method === 'GET' || req.method === 'HEAD') {
      const targetUrl = `${cloudflareFrontendUrl}${req.url}`;
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.redirect(301, targetUrl);
    }
    next();
  });
} else if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (
      req.path.startsWith('/api') ||
      req.path.startsWith('/socket.io') ||
      req.path.startsWith('/telegram-webhook')
    ) {
      return next();
    }
    if (req.method === 'GET' || req.method === 'HEAD') {
      return res.sendFile(path.join(distPath, 'index.html'));
    }
    next();
  });
}

// Global Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('❌ [Unhandled Express Error]:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

// Start Server
if (process.env.NODE_ENV !== 'test') {
  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`ℹ️ [Sonic Bingo Server] Port ${PORT} is already in use by primary instance.`);
    } else {
      console.error('❌ [Server Error]:', err);
    }
  });

  server.listen(PORT, () => {
    console.log(`🚀 [Sonic Bingo Server] Running on http://localhost:${PORT}`);
    console.log(`📊 [Neon PostgreSQL] Connection Pool Active`);
    console.log(`🎮 [Bingo Engine] 4 Game Rooms Initialized`);
    query(`
      CREATE TABLE IF NOT EXISTS agent_cashout_vouchers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        voucher_code VARCHAR(20) UNIQUE NOT NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 50 AND amount <= 5000),
        status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'redeemed', 'cancelled', 'expired')),
        redeemed_by_agent_id UUID REFERENCES agent_profiles(id),
        redeemed_at TIMESTAMPTZ,
        agent_commission_earned NUMERIC(12, 2) DEFAULT 0.00,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMPTZ DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours')
      );
      CREATE INDEX IF NOT EXISTS idx_vouchers_code ON agent_cashout_vouchers(voucher_code);
      CREATE INDEX IF NOT EXISTS idx_vouchers_user ON agent_cashout_vouchers(user_id);
      CREATE INDEX IF NOT EXISTS idx_vouchers_status ON agent_cashout_vouchers(status);
      ALTER TABLE agent_profiles ADD COLUMN IF NOT EXISTS cashout_commission_rate NUMERIC(5, 2) DEFAULT 1.50;
    `).catch(err => console.warn('⚠️ [DB Schema] Agent vouchers auto-migration deferred:', err.message || err));
    telegramBotService.healBroadcastSequence().catch(err => {
      console.warn('⚠️ [TelegramBotService] Sequence auto-sync deferred:', err.message || err);
    });
    telegramBotService.setMyCommands().catch(err => {
      console.warn('⚠️ [TelegramBotService] Auto-sync bot commands deferred:', err.message || err);
    });
    telegramBotService.setChatMenuButton('web_app').catch(err => {
      console.warn('⚠️ [TelegramBotService] Auto-sync chat menu button deferred:', err.message || err);
    });
    telegramBotService.setWebhook().catch(err => {
      console.warn('⚠️ [TelegramBotService] Auto-sync webhook deferred:', err.message || err);
    });
  });
}

export { app, server };
