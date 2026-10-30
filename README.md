# sonic-bingo

> High-performance, real-time Telegram Mini-App Bingo Casino platform.

---

## 📖 Handover & Architectural Blueprint

Refer to **[AGENTS.md](AGENTS.md)** and **[SONIC_BINGO_RENDER_AND_TELEGRAM_PLAN.md](SONIC_BINGO_RENDER_AND_TELEGRAM_PLAN.md)** for complete architectural specifications, zero-cost edge offloading, multi-room mechanics, Ethiopian bot schedules, and deployment guides.

---

## 🌐 Hybrid Architecture Overview ($0.00/Month Zero-Cost Scaling)

1. **Cloudflare Edge CDN**: Serves 100% of the static frontend React bundle and **75 Amharic voice caller audio files** with unlimited unmetered bandwidth at **$0.00/month**.
2. **Render Node.js Backend**: Dedicated strictly to lightweight live WebSockets (`ws`) and REST APIs (< 1.2 GB/mo, safely inside the free 5 GB limit).
3. **Neon Serverless PostgreSQL**: Secure, pooled database transactions (< 400 MB/mo).

---

## 🚀 Quick Setup & Deployment

```bash
# 1. Clone repository
git clone https://github.com/EyuAse/sonic-bingo.git
cd sonic-bingo

# 2. Install dependencies
npm install

# 3. Configure environment (.env)
# Set your Neon DATABASE_URL, TELEGRAM_BOT_TOKEN, JWT_SECRET

# 4. Run database migrations
npm run db:migrate

# 5. Run test suites
npx tsc --noEmit
npx tsx server/scripts/test_night_zero_bot_waiting.ts
npx tsx server/scripts/test_room10_hourly_schedule.ts

# 6. Start development server
npm run dev
```

---

## 🏛️ Git Remote
- **Primary**: `https://github.com/EyuAse/sonic-bingo.git` (`origin`)
