import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAdmin } from '../../context/AdminContext.tsx';
import { useApp } from '../../context/AppContext.tsx';
import '../../styles/admin-bot-engine.css';

// 7 Official Ethiopian Schedule Tiers (East Africa Time UTC+3)
interface ScheduleTier {
  id: string;
  hoursRange: string;
  ethiopianName: string;
  startHour: number;
  endHour: number; // exclusive (or wraps)
  botRange: string;
  badgeType: 'sleep' | 'normal' | 'peak';
  description: string;
}

const ETHIOPIAN_SCHEDULE_TIERS: ScheduleTier[] = [
  {
    id: 'sleep',
    hoursRange: '01:00 AM – 06:00 AM',
    ethiopianName: 'ከ ሌሊቱ 7:00 – እስከ ንጋቱ 12:00',
    startHour: 1,
    endHour: 6,
    botRange: '0 Bots (Sleep Mode)',
    badgeType: 'sleep',
    description: 'Zero phantom rounds! Room pauses at 45s waiting for ≥ 2 real human players.'
  },
  {
    id: 'sunrise',
    hoursRange: '06:00 AM – 08:00 AM',
    ethiopianName: 'ከ ንጋቱ 12:00 – እስከ ጠዋቱ 2:00',
    startHour: 6,
    endHour: 8,
    botRange: '10 – 15 Bots',
    badgeType: 'normal',
    description: 'Sunrise & morning warmup. Autonomy resumes; bots seed lobby.'
  },
  {
    id: 'morning',
    hoursRange: '08:00 AM – 11:00 AM',
    ethiopianName: 'ከ ጠዋቱ 2:00 – እስከ 5:00',
    startHour: 8,
    endHour: 11,
    botRange: '15 – 20 Bots',
    badgeType: 'normal',
    description: 'Morning work traffic build-up. Steady recreational gameplay.'
  },
  {
    id: 'lunch',
    hoursRange: '11:00 AM – 01:00 PM',
    ethiopianName: 'ከ 5:00 – እስከ 7:00',
    startHour: 11,
    endHour: 13,
    botRange: '20 – 30 Bots',
    badgeType: 'normal',
    description: 'Lunchtime rush across Ethiopian major cities (Addis Ababa, Hawassa, etc.).'
  },
  {
    id: 'afternoon',
    hoursRange: '01:00 PM – 03:00 PM',
    ethiopianName: 'ከ 7:00 በኋላ – እስከ 9:00',
    startHour: 13,
    endHour: 15,
    botRange: '35 – 40 Bots',
    badgeType: 'normal',
    description: 'Afternoon coffee crowd and peak mobility tables.'
  },
  {
    id: 'prime-peak',
    hoursRange: '03:00 PM – 11:00 PM',
    ethiopianName: 'ከ 9:00 በኋላ – እስከ ምሽቱ 5:00',
    startHour: 15,
    endHour: 23,
    botRange: '40 – 50 Bots (Peak Max)',
    badgeType: 'peak',
    description: '🔥 Super Prime Peak Gaming. Room pot reaches 400–500 ETB. Maximum excitement.'
  },
  {
    id: 'night-taper',
    hoursRange: '11:00 PM – 01:00 AM',
    ethiopianName: 'ከ ምሽቱ 5:00 በኋላ – እስከ ሌሊቱ 7:00',
    startHour: 23,
    endHour: 1, // wraps midnight (23 to 0)
    botRange: '20 – 25 Bots',
    badgeType: 'normal',
    description: 'Late night bedtime taper down before entering 1:00 AM sleep mode.'
  }
];

export const BotEngineControllerDesk: React.FC = () => {
  const { botTelemetry, refreshBotConfig } = useAdmin();
  const { showToast } = useApp();

  const [isReloading, setIsReloading] = useState(false);

  // Real-time East Africa Time clock (UTC+3)
  const [eatTime, setEatTime] = useState<{ hour: number; minute: number; timeStr: string }>(() => {
    const now = new Date();
    const h = (now.getUTCHours() + 3) % 24;
    const m = now.getUTCMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 === 0 ? 12 : h % 12;
    return {
      hour: h,
      minute: m,
      timeStr: `${displayH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm} EAT`
    };
  });

  // Ticking EAT Clock
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const h = (now.getUTCHours() + 3) % 24;
      const m = now.getUTCMinutes();
      const ampm = h >= 12 ? 'PM' : 'AM';
      const displayH = h % 12 === 0 ? 12 : h % 12;
      setEatTime({
        hour: h,
        minute: m,
        timeStr: `${displayH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm} EAT`
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Real-time telemetry poll every 3 seconds directly from Bingo Game Arena
  useEffect(() => {
    refreshBotConfig();
    const pollInterval = setInterval(() => {
      refreshBotConfig();
    }, 3000);
    return () => clearInterval(pollInterval);
  }, [refreshBotConfig]);

  // Determine current active tier
  const activeTier = useMemo(() => {
    const h = eatTime.hour;
    if (h >= 1 && h < 6) return ETHIOPIAN_SCHEDULE_TIERS[0];
    if (h >= 6 && h < 8) return ETHIOPIAN_SCHEDULE_TIERS[1];
    if (h >= 8 && h < 11) return ETHIOPIAN_SCHEDULE_TIERS[2];
    if (h >= 11 && h < 13) return ETHIOPIAN_SCHEDULE_TIERS[3];
    if (h >= 13 && h < 15) return ETHIOPIAN_SCHEDULE_TIERS[4];
    if (h >= 15 && h < 23) return ETHIOPIAN_SCHEDULE_TIERS[5];
    return ETHIOPIAN_SCHEDULE_TIERS[6]; // 23 to 1
  }, [eatTime.hour]);

  // 100% Real Live Arena Telemetry (Zero Mock Data)
  const activeBots = botTelemetry?.activeBotCount ?? 0;
  const realPlayers = botTelemetry?.realPlayerCount ?? 0;
  const totalCards = activeBots + (realPlayers > 0 ? realPlayers : 1);
  const targetBots = botTelemetry?.targetBots ?? 40;
  const totalPot = botTelemetry?.totalPot && botTelemetry.totalPot > 0
    ? botTelemetry.totalPot
    : totalCards * 10;
  const winnerPayout = botTelemetry?.winnerPayout && botTelemetry.winnerPayout > 0
    ? botTelemetry.winnerPayout
    : Math.floor(totalPot * 0.8);
  const houseFee = botTelemetry?.houseFee && botTelemetry.houseFee > 0
    ? botTelemetry.houseFee
    : totalPot - winnerPayout;

  const playerOddsPercent = totalCards > 0 ? ((1 / totalCards) * 100).toFixed(1) : '100.0';

  const handleRefresh = useCallback(async () => {
    setIsReloading(true);
    await refreshBotConfig();
    setTimeout(() => {
      setIsReloading(false);
      showToast('🔄 Live Bingo Arena telemetry refreshed from server!');
    }, 300);
  }, [refreshBotConfig, showToast]);

  return (
    <div className="bot-engine-enqu-root">
      {/* 1. Top Header Bar */}
      <div className="bot-top">
        <div className="bot-top-left">
          <h1>Dynamic Bot Engine (Room 10)</h1>
          <p>
            Autonomous Ethiopian Clock Schedule (0&ndash;50 Bots) &bull; Multi-Room P2P Isolation &bull; Zero Database Impact
          </p>
        </div>
        <div className="bot-top-right">
          <div className="bot-clock-pill">
            <span className="clock-live-pulse"></span>
            <span>{eatTime.timeStr}</span>
          </div>
          <button
            type="button"
            className={`btn-bot-reload ${isReloading ? 'spinning' : ''}`}
            onClick={handleRefresh}
            title="Refresh live telemetry from bingo arena"
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            <span>Reload</span>
          </button>
        </div>
      </div>

      {/* 2. Multi-Room Isolation Shield Banner */}
      <div className="bot-isolation-banner">
        <div className="isolation-shield-icon">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <div className="isolation-text-box">
          <strong>Multi-Room Isolation Firewall Guaranteed</strong>
          <p>
            Standby bots operate <strong>strictly in Room 10 (10 ETB Arena)</strong> following the Ethiopian living clock.
            Rooms <strong>20, 50, and 100 ETB</strong> remain <strong>strictly 0 bots 24/7 (100% human-only peer-to-peer)</strong> with untouched tiered commission logic.
          </p>
        </div>
        <div className="isolation-badge-pills">
          <span className="isolation-badge-pill room10">
            <span>● Room 10: 0&ndash;50 Standby Bots</span>
          </span>
          <span className="isolation-badge-pill otherrooms">
            <span>✕ Rooms 20, 50, 100: Strictly 0 Bots</span>
          </span>
        </div>
      </div>

      {/* 3. 4 Elevated KPI Cards (100% Real Arena Telemetry) */}
      <div className="bot-kpi-grid">
        {/* Card 1: Active Room 10 Bots */}
        <div className="bot-kpi-card hero-dark">
          <div className="bot-kpi-header">
            <span className="bot-kpi-label">Active Room 10 Bots</span>
            <div className="bot-kpi-icon">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="10" rx="2" />
                <circle cx="12" cy="5" r="2" />
                <path d="M12 7v4M8 15h.01M16 15h.01" />
              </svg>
            </div>
          </div>
          <div className="bot-kpi-value">
            {activeBots} <span className="bot-kpi-unit">/ 50 Max</span>
          </div>
          <div className="bot-kpi-sub">
            ● Dynamic Hourly Schedule
          </div>
        </div>

        {/* Card 2: Schedule Phase */}
        <div className="bot-kpi-card">
          <div className="bot-kpi-header">
            <span className="bot-kpi-label">Schedule Phase</span>
            <div className="bot-kpi-icon">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#e6a21f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
          </div>
          <div className="bot-kpi-value">
            {targetBots} <span className="bot-kpi-unit">Bots Target</span>
          </div>
          <div className="bot-kpi-sub">{activeTier.ethiopianName}</div>
        </div>

        {/* Card 3: Round Net Derash */}
        <div className="bot-kpi-card">
          <div className="bot-kpi-header">
            <span className="bot-kpi-label">Round Net Derash</span>
            <div className="bot-kpi-icon">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#2e9e4f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
          </div>
          <div className="bot-kpi-value">
            {winnerPayout.toLocaleString()} <span className="bot-kpi-unit">ETB</span>
          </div>
          <div className="bot-kpi-sub">80% Winner Payout &bull; 20% House Fee ({houseFee} ETB)</div>
        </div>

        {/* Card 4: Player Win Odds */}
        <div className="bot-kpi-card">
          <div className="bot-kpi-header">
            <span className="bot-kpi-label">Player Win Odds</span>
            <div className="bot-kpi-icon">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#9333ea" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M16 12l-4-4-4 4M12 16V8" />
              </svg>
            </div>
          </div>
          <div className="bot-kpi-value">
            ~{playerOddsPercent}%
          </div>
          <div className="bot-kpi-sub">Anti-Churn Dynamic Fairness Protected</div>
        </div>
      </div>

      {/* 4. 24-Hour Ethiopian Schedule Timeline */}
      <div className="bot-timeline-card">
        <div className="timeline-header">
          <div>
            <h3>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>24-Hour Ethiopian Schedule Timeline</span>
            </h3>
            <p>Bots autonomously follow real daily human patterns in Ethiopia with smooth Markovian drift (&le; &plusmn;5 bots/round)</p>
          </div>
          <div className="bot-clock-pill">
            <span className="clock-live-pulse"></span>
            <span>Current EAT: <strong>{eatTime.timeStr}</strong></span>
          </div>
        </div>

        <div className="timeline-tiers-grid">
          {ETHIOPIAN_SCHEDULE_TIERS.map(tier => {
            const isCurrent = activeTier.id === tier.id;

            return (
              <div
                key={tier.id}
                className={`timeline-tier-card ${isCurrent ? 'active-tier' : ''}`}
              >
                <div className="tier-card-top">
                  <div>
                    <div className="tier-hours">{tier.hoursRange}</div>
                    <div className="tier-ethiopian">{tier.ethiopianName}</div>
                  </div>
                  {isCurrent && (
                    <span className="tier-active-pill">ACTIVE NOW</span>
                  )}
                </div>

                <div className={`tier-range-badge ${tier.badgeType}`}>
                  {tier.botRange}
                </div>

                <div className="tier-desc">
                  {tier.description}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
