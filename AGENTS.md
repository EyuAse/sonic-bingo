# 🤖 AI Assistant & Developer Project Handover Guide

> **Welcome!** If you are an AI assistant (Antigravity, Cursor, Claude Code, Copilot, etc.) or a new software engineer resuming work on this repository on another PC, **read this document first**. It provides the complete architectural blueprint, operating rules, and non-negotiable constraints of the **Lomi Bingo (Betika Bingo Mini-App)** project.

---

## 📌 1. Project Overview & Tech Stack

**Lomi Bingo** is a high-performance, real-time Telegram Mini-App Bingo Casino platform supporting thousands of concurrent players with live WebSockets, dynamic standby bots, multi-stake rooms, and instant Telebirr/Chapa mobile payment integrations.

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS & Vanilla CSS, Lucide Icons, Telegram WebApp SDK (`window.Telegram.WebApp`).
- **Edge CDN (Frontend)**: **Cloudflare Pages / Workers** (Serves static bundle, Amharic voice caller audio, assets).
- **Backend**: Node.js, Express, Native WebSockets (`ws`), TypeScript (Hosted on **Render**).
- **Database**: Neon Serverless PostgreSQL (`@neondatabase/serverless`).
- **Hosting / Deployment URLs**:
  - Cloudflare Frontend: `https://sonic-bingo.asoeyo029.workers.dev/`
  - Render Live Backend: `https://sonic-bingo-enod.onrender.com`
  - GitHub Primary: `https://github.com/EyuAse/Bingo-Mini-app.git` (Remote: `origin` / `new-origin`)
  - GitHub Mirror: `https://github.com/tycons9/Bingo-Mini-app.git` (Remote: `tycons-origin`)

---

## 🌐 2. The Cloudflare + Render + Neon Hybrid Architecture ($0.00/Month Zero-Cost Scaling)

### ❓ Why Do We Use Cloudflare? (The Bandwidth Offload Strategy)

Render provides a generous free tier for compute, but **strictly caps free outgoing bandwidth at 5.00 GB/month**. 

In a rich casino game like Lomi Bingo:
1. Every player who opens the Telegram Mini-App downloads the React bundle, stylesheet, fonts, logos, and **75 individual Amharic voice audio files (`Audio/` ball caller MP3s)**.
2. Serving all static media directly from Render burns **30 GB to 50+ GB of bandwidth per month**, instantly blowing past Render's 5 GB limit and crashing the server or incurring overages.

### 💡 The Solution: Cloudflare Edge CDN Offloading
We decoupled the **Heavy Static Assets** from the **Live WebSocket Game Engine**:

- **Cloudflare Pages / Workers** serves **100% of static files** (HTML, JS, CSS, fonts, Amharic audio files, icons).
  - Cloudflare provides **unlimited, unmetered bandwidth for $0.00/month**.
- **Render** runs *only* the Node.js Express API and live WebSocket server (`ws`).
  - WebSocket game ticks and JSON state packets are microscopic in size (~0.8 GB to 1.2 GB/month total), keeping Render safely inside its free 5.0 GB limit forever.
- **Neon Serverless PostgreSQL** handles ACID ledger updates and player balances via connection pooler (< 400 MB/month).

### 📊 Monthly Bandwidth & Cost Breakdown

| Infrastructure Layer | Role | Expected Bandwidth | Monthly Cost |
| :--- | :--- | :---: | :---: |
| **Cloudflare CDN** | Frontend bundle, Amharic audio MP3s, images | 30 – 50 GB | **$0.00 (Unlimited Free)** |
| **Render Web Service** | Real-time WebSockets (`wss://`) & REST API | ~0.8 – 1.2 GB | **$0.00 (Under 5 GB Free limit)** |
| **Neon PostgreSQL** | Player wallets, transactions, game history | ~200 – 400 MB | **$0.00 (Under 5 GB Free limit)** |
| **Total Platform Cost** | **Zero-cost, enterprise-grade scalability** | — | **$0.00 / month (100% FREE)** |

---

### 🔄 End-to-End System Flow Diagram

```mermaid
flowchart TD
    subgraph Telegram["📱 Telegram Client"]
        User["Player taps @LomiBingobot Menu Button"]
    end

    subgraph Cloudflare["🌐 Cloudflare Pages / Edge CDN (100% Free Unlimited)"]
        CF_Edge["Cloudflare Global CDN"]
        Bundle["Vite React Bundle (dist/)"]
        Audio["75 Amharic Voice Audio MP3s"]
        Assets["Logos, Icons, Sound FX"]
    end

    subgraph Render["⚡ Render Node.js Backend (< 1.2 GB / 5.0 GB)"]
        WSS["WebSocket Server (BingoGameEngine.ts)"]
        API["Express REST API (/api/*)"]
        BotLoop["Autonomous Hourly Bot Controller"]
    end

    subgraph Neon["🐘 Neon Serverless PostgreSQL (< 400 MB / 5.0 GB)"]
        DB["PostgreSQL Pooler (AWS us-east-2)"]
        Tables["users, games, tickets, transactions"]
    end

    User -->|"1. Opens WebApp (Loads 30+ GB Assets for $0.00)"| CF_Edge
    CF_Edge --> Bundle
    CF_Edge --> Audio
    CF_Edge --> Assets

    User -->|"2. Connects live game WebSockets (Microscopic JSON ticks)"| WSS
    User -->|"3. Deposits / Withdrawals / Auth"| API

    WSS --> BotLoop
    WSS -->|"4. Settles completed rounds & payouts"| DB
    API -->|"5. Reads / Updates player balance"| DB
```

---

## 🏛️ 3. Core Architecture & Multi-Room Mechanics

The platform operates **4 distinct stake rooms**:

| Room ID | Stake (ETB) | Bots Allowed? | Player Minimum | Autonomy / Countdown Behavior |
| :--- | :---: | :---: | :---: | :--- |
| **`room-10`** | **10 ETB** | **YES** (Scheduled 0–50 bots) | Dynamic (see schedule below) | Autonomous continuous casino clock during daytime/evening; Night fallback to $\ge 2$ players when bots = 0. |
| **`room-20`** | **20 ETB** | **STRICTLY NO (0 bots)** | Strictly $\ge 2$ real players | Human vs Human P2P only. Countdown pauses at 45s until 2 real players buy tickets. |
| **`room-50`** | **50 ETB** | **STRICTLY NO (0 bots)** | Strictly $\ge 2$ real players | Human vs Human P2P only. Strictly requires $\ge 2$ real players. |
| **`room-100`**| **100 ETB**| **STRICTLY NO (0 bots)** | Strictly $\ge 2$ real players | Human vs Human VIP P2P. Strictly requires $\ge 2$ real players. |

> [!CAUTION]
> **MULTI-ROOM ISOLATION FIREWALL**:
> Under NO circumstances should bots ever be seeded into Rooms 20, 50, or 100. Those rooms must remain 100% real human-only P2P.

---

## 🕒 4. Room 10 Bot Hourly Schedule (Ethiopian Clock / East Africa Time UTC+3)

Room 10 uses realistic Ethiopian player profiles (`ethiopianBotRoster.ts`) with a live Markovian drift algorithm matching Ethiopian daily life patterns:

| Ethiopian Time Window | Gregorian Time (EAT UTC+3) | Bot Range | Autonomy & Matchmaking Rules |
| :--- | :---: | :---: | :--- |
| **ከ ሌሊቱ 7:00 – እስከ ንጋቱ 12:00** | **01:00 AM – 06:00 AM** | **0 bots** *(Sleep Mode)* | 🛑 **Zero phantom rounds!** Autonomy disables. Room stays in **"ተጫዋቾችን በመጠበቅ ላይ... / Waiting for players..."** at 45s. Must have **$\ge 2$ real players** to start a game. |
| **ከ ንጋቱ 12:00 – እስከ ጠዋቱ 2:00** | **06:00 AM – 08:00 AM** | **10 – 15 bots** | 🌅 Morning warmup. Autonomy active. Bots seed lobby. |
| **ከ ጠዋቱ 2:00 – እስከ 5:00** | **08:00 AM – 11:00 AM** | **15 – 20 bots** | 📈 Morning work traffic. |
| **ከ 5:00 – እስከ 7:00** | **11:00 AM – 01:00 PM** | **20 – 30 bots** | 🍲 Lunchtime rush. |
| **ከ 7:00 በኋላ – እስከ 9:00** | **01:00 PM – 03:00 PM** | **35 – 40 bots** | ☕ Afternoon crowd. |
| **ከ 9:00 በኋላ – እስከ ምሽቱ 5:00** | **03:00 PM – 11:00 PM** | **40 – 50 bots** | 🚀 **Prime-time peak gaming**. Room pot reaches 400–500 ETB. |
| **ከ ምሽቱ 5:00 በኋላ – እስከ ሌሊቱ 7:00**| **11:00 PM – 01:00 AM** | **20 – 25 bots** | 🌙 Late night wind-down taper. |

### Hard Constraints:
1. **Never exceed 50 bots**: Hard maximum cap across all 1,440 minutes of the day is 50 bots.
2. **Smooth Markovian Drift**: Round-to-round target bot variation must not step by more than $\pm 5$ bots.
3. **Zero DB Traffic in Lobby**: Standby bots in the lobby exist strictly in memory. They write zero rows to PostgreSQL until/unless a round completes.

---

## 🎯 5. Bingo Math & Game Rules (Strictly Preserved)

1. **Card Matrix**: Standard 75-ball bingo, 5x5 card with columns B (1–15), I (16–30), N (31–45 with free center), G (46–60), O (61–75).
2. **Winning Patterns**: 13 supported patterns (Full House, Horizontal Lines, Vertical Lines, Diagonals, 4 Corners, Post Stamp, Small Center Square, etc.).
3. **Finish Window**: Ball drawer generates a sequence that finishes in **15 to 25 balls**. Never alter this finish range without explicit user approval.
4. **Pot & Commission Math**:
   - Total Pot = $\sum (\text{Cartela Stakes})$.
   - Platform House Fee = $20\%$ of Total Pot.
   - Round Winner Payout (`derash`) = $80\%$ of Total Pot.
   - In Rooms 20, 50, 100 with $\le 5$ cartelas, platform fee is $0\%$ to incentivize early human matches.
5. **Anti-Churn Fairness Engine**:
   - Tracks consecutive losses for active real players and dynamically adjusts cartela placement so players do not churn.
   - Registration bonus balances are protected with fair win probability caps.

---

## 🗄️ 6. Key File Locations

```text
lomi-bingo/
├── server/
│   ├── index.ts                     # Express server & WebSocket initialization
│   ├── db.ts                        # Neon PostgreSQL connection pool & queries
│   ├── game/
│   │   ├── BingoGameEngine.ts       # ⭐️ Core game loop, lobby timer, ball caller, room management
│   │   ├── ethiopianBotRoster.ts    # ⭐️ 24-hour Ethiopian schedule, bot names, Markovian drift
│   │   └── cartelaGenerator.ts      # 75-ball bingo card generation & pattern detection
│   ├── routes/
│   │   ├── admin.ts                 # Admin dashboard endpoints (search, pagination, segments)
│   │   └── api.ts                   # Player auth, deposits, withdrawals, game history
│   └── scripts/                     # Automated test suites & verification scripts
│       ├── test_night_zero_bot_waiting.ts     # Verifies night 0-bot waiting at 45s
│       ├── test_room10_hourly_schedule.ts     # Verifies 24h schedule & bounds
│       ├── test_phase3_dynamic_probability.ts # Verifies pot & win probability math
│       ├── test_house_commission_audit.ts     # Verifies Neon DB ledger invariants
│       └── sync_webapp_url.ts                 # Syncs Cloudflare URL with Telegram Bot & Webhooks
├── src/                             # React 18 Frontend
│   ├── App.tsx                      # Mini-App root with Telegram viewport setup
│   ├── context/
│   │   ├── GameContext.tsx          # Real-time WebSocket state management
│   │   └── AdminContext.tsx         # Admin state, sorting, filters, and actions
│   └── components/                  # Bingo board, cartela grid, lobby countdown, audio
├── CLOUDFLARE_RENDER_NEON_HYBRID_PLAN.md # $0.00/mo hybrid architecture guide
├── NIGHT_ZERO_BOT_WAITING_FOR_PLAYERS_PLAN.md # Night zero-bot waiting specification
├── BOT_HOURLY_SCHEDULE_IMPLEMENTATION_PLAN.md # Ethiopian hourly bot schedule plan
├── .env                             # Environment variables & secrets (DATABASE_URL, BOT_TOKEN, etc.)
└── package.json                     # Scripts & dependencies
```

---

## 💻 7. How to Set Up on a New Machine

### Step 1: Clone Repository
```bash
git clone https://github.com/EyuAse/Bingo-Mini-app.git
cd Bingo-Mini-app
```

### Step 2: Configure Git Remotes
Ensure both remotes exist so updates can be pushed to both accounts:
```bash
git remote set-url origin https://github.com/EyuAse/Bingo-Mini-app.git
git remote add tycons-origin https://github.com/tycons9/Bingo-Mini-app.git
```

### Step 3: Install Dependencies
```bash
npm install
```

### Step 4: Environment Variables (`.env`)
Ensure a `.env` file exists in the project root containing:
```env
PORT=3000
DATABASE_URL=postgresql://neondb_owner:...@ep-billowing-math-...pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
TELEGRAM_BOT_TOKEN=...
ADMIN_USERNAME=...
ADMIN_PASSWORD=...
JWT_SECRET=...
NODE_ENV=production
```

### Step 5: Run Verification Test Suites
Before making any changes, run the tests to confirm system health:
```bash
# 1. Verify TypeScript types
npx tsc --noEmit

# 2. Verify Night Zero-Bot "Waiting for Players" Guard
npx tsx server/scripts/test_night_zero_bot_waiting.ts

# 3. Verify 24-Hour Ethiopian Hourly Schedule Bounds
npx tsx server/scripts/test_room10_hourly_schedule.ts

# 4. Verify Pot Math & Dynamic Win Probability
npx tsx server/scripts/test_phase3_dynamic_probability.ts
```

### Step 6: Start Local Development
```bash
# Concurrently starts Vite frontend and Express WebSocket backend
npm run dev
```

### Step 7: Build for Production
```bash
npm run build
```

### Step 8: Push Changes
Always push to both remotes:
```bash
git push origin main
git push tycons-origin main
```

---

## ⚠️ 8. Golden Rules for Any AI Assistant Working Here

1. 🚫 **NEVER break Multi-Room Isolation**: Rooms 20, 50, and 100 must **NEVER** have bots. Only Room 10 has bots.
2. 🚫 **NEVER run empty rounds at night**: Between 01:00 AM and 06:00 AM (0 bots), Room 10 must pause at 45s and display **"Waiting for players"** until $\ge 2$ real players buy tickets.
3. 🚫 **NEVER alter 15–25 ball win sequence**: Ball calling logic and 13 winning patterns must remain intact.
4. 🚫 **NEVER alter the 80/20 pot distribution**: 80% to winner, 20% to house.
5. 🛡️ **Preserve Cloudflare Offloading**: Never direct heavy asset traffic to Render. Keep static assets on Cloudflare Pages/CDN to preserve $0.00/month hosting.
6. 🛡️ **Always test before committing**: Run `npx tsc --noEmit` and the automated test scripts in `server/scripts/`.
