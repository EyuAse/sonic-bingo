import React, { useState, useEffect } from 'react';
import { useAdmin } from '../../context/AdminContext.tsx';
import { useApp } from '../../context/AppContext.tsx';

export const BotEngineControllerDesk: React.FC = () => {
  const { refreshBotConfig, botTelemetry } = useAdmin();
  const { showToast } = useApp();

  // Real-time East Africa Time clock
  const [currentEatTime, setCurrentEatTime] = useState<{ hour: number; minute: number; timeStr: string }>(() => {
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

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const h = (now.getUTCHours() + 3) % 24;
      const m = now.getUTCMinutes();
      const ampm = h >= 12 ? 'PM' : 'AM';
      const displayH = h % 12 === 0 ? 12 : h % 12;
      setCurrentEatTime({
        hour: h,
        minute: m,
        timeStr: `${displayH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm} EAT`
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Determine which schedule tier is currently active in Ethiopia
  const getActiveScheduleWindow = (h: number, m: number) => {
    if (h >= 1 && h < 6) {
      return {
        id: 'sleep',
        label: '01:00 AM – 06:00 AM',
        ethiopian: 'ማታ 7:00 – 12:00',
        range: 'STRICTLY 0 BOTS',
        status: 'Night Sleep Mode (Zero Bots)',
        color: '#94a3b8'
      };
    }
    if (h >= 6 && h < 12) {
      return {
        id: 'morning',
        label: '06:00 AM – 12:00 PM',
        ethiopian: 'ጧት 12:00 – ከሰዓት 6:00',
        range: '2 – 10 Bots',
        status: 'Morning Casual Activity',
        color: '#38bdf8'
      };
    }
    if (h >= 12 && h < 16) {
      return {
        id: 'afternoon',
        label: '12:00 PM – 04:00 PM',
        ethiopian: 'ከሰዓት 6:00 – 10:00',
        range: '8 – 20 Bots',
        status: 'Afternoon Casual Tables',
        color: '#38bdf8'
      };
    }
    if (h >= 16 && (h < 18 || (h === 18 && m < 30))) {
      return {
        id: 'rush',
        label: '04:00 PM – 06:30 PM',
        ethiopian: 'ከሰዓት 10:00 – ምሽት 12:30',
        range: '15 – 30 Bots',
        status: 'Evening Rush Commute',
        color: '#f59e0b'
      };
    }
    if ((h === 18 && m >= 30) || (h >= 19 && h < 21)) {
      return {
        id: 'dinner',
        label: '06:30 PM – 09:00 PM',
        ethiopian: 'ምሽት 12:30 – ማታ 3:00',
        range: '25 – 42 Bots',
        status: 'Dinner & Relaxation Surge',
        color: '#f59e0b'
      };
    }
    if (h >= 21 && h < 23) {
      return {
        id: 'superpeak',
        label: '09:00 PM – 11:00 PM',
        ethiopian: 'ማታ 3:00 – 5:00',
        range: '35 – 50 Bots (MAX 50)',
        status: '🔥 Super Prime Peak Night',
        color: '#10b981'
      };
    }
    return {
      id: 'taper',
      label: '11:00 PM – 12:59 AM',
      ethiopian: 'ማታ 5:00 – 6:59',
      range: '2 – 15 Bots (Tapering)',
      status: 'Late Night Winding Down',
      color: '#a855f7'
    };
  };

  const activeWindow = getActiveScheduleWindow(currentEatTime.hour, currentEatTime.minute);

  // Derived effective bot count for preview calculations
  const effectiveBotPreview = botTelemetry?.activeBotCount ?? 40;
  const totalCardsPreview = 1 + effectiveBotPreview;
  const realWinRatePercent = totalCardsPreview > 0 ? ((1 / totalCardsPreview) * 100).toFixed(1) : '100.0';
  const grossPotPreview = totalCardsPreview * 10;
  const netDerashPreview = Math.floor(grossPotPreview * 0.8);
  const houseRakePreview = grossPotPreview - netDerashPreview;

  const handleReload = () => {
    refreshBotConfig();
    showToast('🔄 Bot Engine telemetry refreshed from server!');
  };

  return (
    <div className="bot-engine-desk bot-engine-desk-container" style={{ padding: '1.25rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* ── Strict Isolation Notice Banner ── */}
      <div
        className="bot-isolation-banner"
        style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(6, 95, 70, 0.22))',
          border: '1px solid rgba(16, 185, 129, 0.35)',
          borderRadius: '12px',
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ fontSize: '1.8rem', color: '#10b981' }}>🛡️</div>
        <div>
          <strong style={{ color: '#10b981', fontSize: '0.95rem', display: 'block', marginBottom: '0.2rem' }}>
            Multi-Room Isolation Architecture Guaranteed
          </strong>
          <span style={{ color: '#d1fae5', fontSize: '0.85rem', lineHeight: '1.4' }}>
            Standby bots operate <strong>strictly in Room 10 (10 ETB Arena)</strong>. Rooms 20, 50, and 100 ETB remain
            <strong> 100% human-only peer-to-peer (strictly 0 bots 24/7)</strong> with untouched tiered commission logic.
          </span>
        </div>
      </div>

      {/* ── Top Overview: Live Telemetry Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1rem' }}>
          <div style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Active Room 10 Bots
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.25rem' }}>
            {botTelemetry?.activeBotCount ?? effectiveBotPreview}
            <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 500, marginLeft: '0.35rem' }}>/ 50 Max</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '0.25rem' }}>
            ● Dynamic Ethiopian Roster Active
          </div>
        </div>

        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1rem' }}>
          <div style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Current Round & Phase
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f59e0b', marginTop: '0.25rem' }}>
            #{botTelemetry?.roundNumber ?? 1}
            <span style={{ fontSize: '0.9rem', color: '#fbbf24', fontWeight: 600, marginLeft: '0.5rem', textTransform: 'uppercase' }}>
              ({botTelemetry?.phase ?? 'lobby'})
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
            Live Clock: ⚡ Continuous Autonomous Loop
          </div>
        </div>

        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1rem' }}>
          <div style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Estimated Net Derash
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#10b981', marginTop: '0.25rem' }}>
            {netDerashPreview.toLocaleString()} ETB
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
            Platform Fee: {houseRakePreview.toLocaleString()} ETB (+20%)
          </div>
        </div>

        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1rem' }}>
          <div style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Real Player Win Probability
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ec4899', marginTop: '0.25rem' }}>
            ~{realWinRatePercent}%
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
            1 ticket vs {effectiveBotPreview} bot tickets
          </div>
        </div>
      </div>

      {/* ── Automated Ethiopian Time-of-Day Schedule Status Card ── */}
      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <i className="fa-solid fa-clock" style={{ color: '#38bdf8' }}></i>
              Automated Ethiopian Time-of-Day Bot Engine (Active)
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>
              Room 10 bots autonomously follow the natural daily rhythm of Ethiopian Telegram users:
            </p>
          </div>
          <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '0.5rem 1rem', textAlign: 'right' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase' }}>Current Server EAT Time</div>
            <strong style={{ color: '#38bdf8', fontSize: '1.1rem' }}>{currentEatTime.timeStr}</strong>
          </div>
        </div>

        {/* Current Active Window Highlight Banner */}
        <div
          style={{
            background: 'rgba(56, 189, 248, 0.08)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '10px',
            padding: '1rem 1.25rem',
            marginBottom: '1.25rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}
        >
          <div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Current Active Hourly Phase
            </span>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: activeWindow.color, marginTop: '0.15rem' }}>
              {activeWindow.status}
            </div>
            <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
              {activeWindow.label} ({activeWindow.ethiopian})
            </span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', display: 'block' }}>
              Target Bot Capacity
            </span>
            <strong style={{ fontSize: '1.2rem', color: '#f8fafc' }}>{activeWindow.range}</strong>
          </div>
        </div>

        {/* Full 24-Hour Schedule Breakdown Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', color: '#e2e8f0' }}>
            <thead>
              <tr style={{ background: '#0f172a', borderBottom: '1px solid #334155', color: '#94a3b8', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem 1rem' }}>Time Window (Western / Ethiopian)</th>
                <th style={{ padding: '0.75rem 1rem' }}>Phase</th>
                <th style={{ padding: '0.75rem 1rem' }}>Bot Range</th>
                <th style={{ padding: '0.75rem 1rem' }}>Behavior & Experience</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #334155', background: activeWindow.id === 'sleep' ? 'rgba(56, 189, 248, 0.08)' : 'transparent' }}>
                <td style={{ padding: '0.75rem 1rem' }}>
                  <strong>01:00 AM – 06:00 AM</strong>
                  <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>ማታ 7:00 – 12:00</span>
                </td>
                <td style={{ padding: '0.75rem 1rem', color: '#94a3b8' }}>Night Sleep Mode</td>
                <td style={{ padding: '0.75rem 1rem' }}>
                  <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 700 }}>
                    STRICTLY 0 BOTS
                  </span>
                </td>
                <td style={{ padding: '0.75rem 1rem', color: '#94a3b8' }}>Complete sleep mode while players sleep. Pure human P2P.</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #334155', background: activeWindow.id === 'morning' ? 'rgba(56, 189, 248, 0.08)' : 'transparent' }}>
                <td style={{ padding: '0.75rem 1rem' }}>
                  <strong>06:00 AM – 12:00 PM</strong>
                  <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>ጧት 12:00 – ከሰዓት 6:00</span>
                </td>
                <td style={{ padding: '0.75rem 1rem', color: '#38bdf8' }}>Morning Casual</td>
                <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#38bdf8' }}>2 – 10 Bots</td>
                <td style={{ padding: '0.75rem 1rem', color: '#cbd5e1' }}>Light morning commute activity; small quick rounds.</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #334155', background: activeWindow.id === 'afternoon' ? 'rgba(56, 189, 248, 0.08)' : 'transparent' }}>
                <td style={{ padding: '0.75rem 1rem' }}>
                  <strong>12:00 PM – 04:00 PM</strong>
                  <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>ከሰዓት 6:00 – 10:00</span>
                </td>
                <td style={{ padding: '0.75rem 1rem', color: '#38bdf8' }}>Afternoon Casual</td>
                <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#38bdf8' }}>8 – 20 Bots</td>
                <td style={{ padding: '0.75rem 1rem', color: '#cbd5e1' }}>Lunchtime & afternoon tables ($B \le 20$).</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #334155', background: activeWindow.id === 'rush' ? 'rgba(56, 189, 248, 0.08)' : 'transparent' }}>
                <td style={{ padding: '0.75rem 1rem' }}>
                  <strong>04:00 PM – 06:30 PM</strong>
                  <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>ከሰዓት 10:00 – ምሽት 12:30</span>
                </td>
                <td style={{ padding: '0.75rem 1rem', color: '#f59e0b' }}>Evening Rush Commute</td>
                <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#f59e0b' }}>15 – 30 Bots</td>
                <td style={{ padding: '0.75rem 1rem', color: '#cbd5e1' }}>Work ends, Telegram rush starts, crowd builds up ($B \in [15, 30]$).</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #334155', background: activeWindow.id === 'dinner' ? 'rgba(56, 189, 248, 0.08)' : 'transparent' }}>
                <td style={{ padding: '0.75rem 1rem' }}>
                  <strong>06:30 PM – 09:00 PM</strong>
                  <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>ምሽት 12:30 – ማታ 3:00</span>
                </td>
                <td style={{ padding: '0.75rem 1rem', color: '#f59e0b' }}>Dinner & Relaxation</td>
                <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#f59e0b' }}>25 – 42 Bots</td>
                <td style={{ padding: '0.75rem 1rem', color: '#cbd5e1' }}>Family & dinner relaxation; high energy lobby ($B \in [25, 42]$).</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #334155', background: activeWindow.id === 'superpeak' ? 'rgba(16, 185, 129, 0.12)' : 'transparent' }}>
                <td style={{ padding: '0.75rem 1rem' }}>
                  <strong style={{ color: '#10b981' }}>09:00 PM – 11:00 PM</strong>
                  <span style={{ color: '#10b981', fontSize: '0.75rem', display: 'block' }}>ማታ 3:00 – 5:00 (SUPER PEAK)</span>
                </td>
                <td style={{ padding: '0.75rem 1rem', color: '#10b981', fontWeight: 700 }}>🔥 Super Prime Peak</td>
                <td style={{ padding: '0.75rem 1rem' }}>
                  <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 800 }}>
                    35 – 50 Bots (MAX 50)
                  </span>
                </td>
                <td style={{ padding: '0.75rem 1rem', color: '#d1fae5' }}>Maximum crowd! Top gaming hour in Ethiopia.</td>
              </tr>
              <tr style={{ background: activeWindow.id === 'taper' ? 'rgba(56, 189, 248, 0.08)' : 'transparent' }}>
                <td style={{ padding: '0.75rem 1rem' }}>
                  <strong>11:00 PM – 12:59 AM</strong>
                  <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>ማታ 5:00 – 6:59</span>
                </td>
                <td style={{ padding: '0.75rem 1rem', color: '#a855f7' }}>Late Night Taper</td>
                <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#a855f7' }}>2 – 15 Bots</td>
                <td style={{ padding: '0.75rem 1rem', color: '#cbd5e1' }}>Smooth taper down ($15 \rightarrow 8 \rightarrow 2$) before 12:59 AM cutoff.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Action Buttons ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
        <button
          type="button"
          onClick={handleReload}
          style={{
            padding: '0.75rem 1.75rem',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #334155, #1e293b)',
            border: '1px solid #475569',
            color: '#f8fafc',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <i className="fa-solid fa-arrows-rotate"></i>
          Reload Telemetry from Server
        </button>
      </div>
    </div>
  );
};
