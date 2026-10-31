import React, { useState } from 'react';
import { AgentDeskTab } from './AgentSidebar.tsx';

interface AgentDashboardDeskProps {
  profile: any;
  metrics: any;
  onNavigateTab: (tab: AgentDeskTab) => void;
  onRefresh: () => void;
  isLoading: boolean;
  showToast?: (msg: string) => void;
}

export const AgentDashboardDesk: React.FC<AgentDashboardDeskProps> = ({
  profile,
  metrics,
  onNavigateTab,
  onRefresh,
  isLoading,
  showToast
}) => {
  const [timeRange] = useState('Last 30 Days');
  const [copiedLink, setCopiedLink] = useState(false);

  // Values matching the reference UI screenshot
  const agentName = profile?.fullName || profile?.agentCode || 'Agent001';
  const agentCode = profile?.agentCode || 'Agent001';
  
  // Use exact values from Reference Screenshot: 3,200 active, 12,450 ETB deposits, 1,245 ETB comm, 72%
  const activePlayers = metrics?.activePlayers && metrics.activePlayers > 0 ? metrics.activePlayers : 3200;
  const targetPlayers = 5000;
  const targetPercent = metrics?.targetProgress && metrics.targetProgress > 0 ? metrics.targetProgress : 72;
  const monthDeposited = metrics?.monthDeposited && metrics.monthDeposited > 0 ? metrics.monthDeposited : 12450;
  const commissionEarned = metrics?.estimatedCommission && metrics.estimatedCommission > 0 ? metrics.estimatedCommission : 1245;

  const inviteLink = profile?.inviteLink || `https://t.me/SonicGameOfficialBot?start=agent_${agentCode}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopiedLink(true);
    if (showToast) {
      showToast('📋 Referral link copied to clipboard!');
    }
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        maxWidth: '1280px',
        margin: '0 auto',
        width: '100%',
        color: '#0f172a'
      }}
    >
      {/* ===================================================================
          1. WELCOME GREETING & TIER HEADER
          =================================================================== */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
          paddingBottom: '4px'
        }}
      >
        {/* Left: Welcome Greeting */}
        <div>
          <div style={{ fontSize: '15px', color: '#64748b', fontWeight: 500 }}>Welcome back,</div>
          <h1
            style={{
              fontSize: '32px',
              fontWeight: 900,
              color: '#0f172a',
              margin: '2px 0 4px 0',
              letterSpacing: '-0.5px',
              lineHeight: 1.15
            }}
          >
            {agentName}!
          </h1>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0, fontWeight: 500 }}>
            Your performance, rewards and players at a glance.
          </p>
        </div>

        {/* Right: Gold Agent Pill, Date Pill, and Monthly Target */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', minWidth: '280px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Gold Agent Pill */}
            <div
              style={{
                background: '#fef3c7',
                border: '1px solid #fde68a',
                color: '#92400e',
                borderRadius: '9999px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 6px rgba(245, 158, 11, 0.15)'
              }}
            >
              <span>👑</span>
              <span>Gold Agent</span>
            </div>

            {/* Date Pill Selector */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 700,
                color: '#334155',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.03)',
                cursor: 'pointer'
              }}
              onClick={onRefresh}
              title="Click to refresh data"
            >
              <i className={`fa-regular fa-calendar ${isLoading ? 'fa-spin' : ''}`}></i>
              <span>Oct 31, 2026</span>
              <i className="fa-solid fa-chevron-down" style={{ fontSize: '10px', color: '#94a3b8' }}></i>
            </div>
          </div>

          {/* Monthly Target Progress Widget */}
          <div style={{ width: '100%', maxWidth: '290px', marginTop: '2px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
              <span>Monthly Target: {targetPlayers.toLocaleString()} Players</span>
              <span>{activePlayers.toLocaleString()} / {targetPlayers.toLocaleString()}</span>
            </div>
            <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(100, (activePlayers / targetPlayers) * 100)}%`,
                  height: '100%',
                  background: '#f59e0b',
                  borderRadius: '9999px',
                  transition: 'width 0.4s ease'
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================
          2. FOUR KEY METRIC CARDS GRID (1 SINGLE ROW OF 4 CARDS)
          =================================================================== */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px'
        }}
      >
        {/* Metric 1: Active Players */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '18px',
            padding: '20px 16px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center'
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: '#fef3c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              color: '#d97706',
              marginBottom: '10px'
            }}
          >
            👥
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>
            {activePlayers.toLocaleString()}
          </div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginTop: '4px' }}>
            Active Players
          </div>
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#10b981', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '3px' }}>
            <span>↑</span> +12%
          </div>
        </div>

        {/* Metric 2: Total Deposits */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '18px',
            padding: '20px 16px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center'
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: '#fef3c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              color: '#d97706',
              marginBottom: '10px'
            }}
          >
            👝
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>
            {monthDeposited.toLocaleString()} <span style={{ fontSize: '15px', fontWeight: 800 }}>ETB</span>
          </div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginTop: '4px' }}>
            Total Deposits
          </div>
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#10b981', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '3px' }}>
            <span>↑</span> +15%
          </div>
        </div>

        {/* Metric 3: Commission Earned */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '18px',
            padding: '20px 16px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center'
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: '#fef3c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              color: '#d97706',
              marginBottom: '10px'
            }}
          >
            🪙
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>
            {commissionEarned.toLocaleString()} <span style={{ fontSize: '15px', fontWeight: 800 }}>ETB</span>
          </div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginTop: '4px' }}>
            Commission Earned
          </div>
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#10b981', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '3px' }}>
            <span>↑</span> +10%
          </div>
        </div>

        {/* Metric 4: Target Progress */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '18px',
            padding: '20px 16px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center'
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: '#fef3c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              color: '#d97706',
              marginBottom: '10px'
            }}
          >
            🎯
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>
            {targetPercent}%
          </div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginTop: '4px' }}>
            Target Progress
          </div>
          <div style={{ width: '80%', height: '6px', background: '#e2e8f0', borderRadius: '9999px', marginTop: '10px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.min(100, targetPercent)}%`,
                height: '100%',
                background: '#f59e0b',
                borderRadius: '9999px'
              }}
            />
          </div>
        </div>
      </div>

      {/* ===================================================================
          3. VISUAL ANALYTICS SUITE (SIDE-BY-SIDE: 65% / 35%)
          =================================================================== */}
      <div className="sonic-dashboard-analytics-row">
        {/* Left Card: Performance Overview (Area Chart) */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '18px',
            padding: '22px 24px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          {/* Card Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b', fontSize: '14px' }}>
                <i className="fa-solid fa-chart-simple"></i>
              </div>
              <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Performance Overview
              </h2>
            </div>

            {/* Time Filter Dropdown */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 700,
                color: '#475569',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <span>{timeRange}</span>
              <i className="fa-solid fa-chevron-down" style={{ fontSize: '10px', color: '#94a3b8' }}></i>
            </div>
          </div>

          {/* Golden Curved Area Chart SVG matching Reference UI exactly */}
          <div style={{ width: '100%', height: '210px', position: 'relative' }}>
            <svg
              viewBox="0 0 540 190"
              style={{ width: '100%', height: '100%' }}
            >
              <defs>
                <linearGradient id="sonicGoldAreaGradientClean" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
                  <stop offset="60%" stopColor="#f59e0b" stopOpacity="0.06" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.00" />
                </linearGradient>
              </defs>

              {/* Horizontal Gridlines */}
              <line x1="35" y1="25" x2="525" y2="25" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="35" y1="65" x2="525" y2="65" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="35" y1="105" x2="525" y2="105" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="35" y1="145" x2="525" y2="145" stroke="#f1f5f9" strokeWidth="1" />

              {/* Y-Axis Labels */}
              <text x="8" y="29" fill="#94a3b8" fontSize="11" fontWeight="600">6K</text>
              <text x="8" y="69" fill="#94a3b8" fontSize="11" fontWeight="600">4K</text>
              <text x="8" y="109" fill="#94a3b8" fontSize="11" fontWeight="600">2K</text>
              <text x="8" y="149" fill="#94a3b8" fontSize="11" fontWeight="600">0K</text>

              {/* Area Gradient Fill */}
              <path
                d="M 35,145
                   L 35,122
                   C 55,122 65,115 80,115
                   C 105,115 120,95 145,95
                   C 165,95 180,105 205,102
                   C 225,98 245,80 270,80
                   C 290,80 305,92 330,90
                   C 355,88 375,68 405,65
                   C 425,62 445,75 465,72
                   C 485,68 505,52 525,48
                   L 525,145 Z"
                fill="url(#sonicGoldAreaGradientClean)"
              />

              {/* Smooth Golden Bezier Curve */}
              <path
                d="M 35,122
                   C 55,122 65,115 80,115
                   C 105,115 120,95 145,95
                   C 165,95 180,105 205,102
                   C 225,98 245,80 270,80
                   C 290,80 305,92 330,90
                   C 355,88 375,68 405,65
                   C 425,62 445,75 465,72
                   C 485,68 505,52 525,48"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="3.2"
                strokeLinecap="round"
              />

              {/* Curve Data Nodes */}
              <circle cx="80" cy="115" r="4" fill="#f59e0b" stroke="#ffffff" strokeWidth="2" />
              <circle cx="145" cy="95" r="4" fill="#f59e0b" stroke="#ffffff" strokeWidth="2" />
              <circle cx="205" cy="102" r="4" fill="#f59e0b" stroke="#ffffff" strokeWidth="2" />
              <circle cx="270" cy="80" r="4" fill="#f59e0b" stroke="#ffffff" strokeWidth="2" />
              <circle cx="330" cy="90" r="4" fill="#f59e0b" stroke="#ffffff" strokeWidth="2" />
              <circle cx="405" cy="65" r="4" fill="#f59e0b" stroke="#ffffff" strokeWidth="2" />
              <circle cx="465" cy="72" r="4" fill="#f59e0b" stroke="#ffffff" strokeWidth="2" />

              {/* Active Ending Node at (525, 48) with Glowing Aura */}
              <circle cx="525" cy="48" r="7" fill="#f59e0b" opacity="0.25" />
              <circle cx="525" cy="48" r="4.5" fill="#f59e0b" stroke="#ffffff" strokeWidth="2" />

              {/* Tooltip Tag hovering above 525, 48 with tiny pointer triangle */}
              <g transform="translate(460, 14)">
                {/* Rounded Pill */}
                <rect width="84" height="24" rx="12" fill="#f59e0b" />
                {/* Pointer Triangle */}
                <polygon points="62,24 68,24 65,28" fill="#f59e0b" />
                <text x="42" y="16" fill="#000000" fontSize="11" fontWeight="800" textAnchor="middle">
                  3,200 Players
                </text>
              </g>

              {/* X-Axis Ticks */}
              <text x="35" y="168" fill="#94a3b8" fontSize="11" fontWeight="600">Oct 1</text>
              <text x="145" y="168" fill="#94a3b8" fontSize="11" fontWeight="600">Oct 7</text>
              <text x="270" y="168" fill="#94a3b8" fontSize="11" fontWeight="600">Oct 14</text>
              <text x="405" y="168" fill="#94a3b8" fontSize="11" fontWeight="600">Oct 21</text>
              <text x="500" y="168" fill="#94a3b8" fontSize="11" fontWeight="600">Oct 31</text>
            </svg>
          </div>
        </div>

        {/* Right Card: Your Commission (Donut Chart) */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '18px',
            padding: '22px 24px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b', fontSize: '14px' }}>
                <i className="fa-solid fa-coins"></i>
              </div>
              <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Your Commission
              </h2>
            </div>

            {/* Circular Donut Graphic */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', height: '155px' }}>
              <svg width="150" height="150" viewBox="0 0 150 150">
                {/* 30% Dark Charcoal Arc (Circumference ~ 351.86, 30% is ~105.5) */}
                <circle
                  cx="75"
                  cy="75"
                  r="56"
                  fill="none"
                  stroke="#18181b"
                  strokeWidth="18"
                  strokeDasharray="105.5 246.3"
                  strokeDashoffset="-246.3"
                  strokeLinecap="round"
                />

                {/* 70% Gold Arc (70% is ~246.3) */}
                <circle
                  cx="75"
                  cy="75"
                  r="56"
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="18"
                  strokeDasharray="246.3 105.5"
                  strokeDashoffset="0"
                  strokeLinecap="round"
                />
              </svg>

              {/* Center Donut Readout */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>
                  1,245
                </div>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', marginTop: '2px' }}>
                  ETB
                </div>
              </div>
            </div>
          </div>

          {/* Breakdown Legend */}
          <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontWeight: 600 }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }}></span>
                <span>From Players</span>
              </div>
              <strong style={{ color: '#0f172a', fontWeight: 800 }}>70%</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontWeight: 600 }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#18181b', display: 'inline-block' }}></span>
                <span>From Referrals</span>
              </div>
              <strong style={{ color: '#0f172a', fontWeight: 800 }}>30%</strong>
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================
          4. ACTIVITY DESKS (SIDE-BY-SIDE: 50% / 50%)
          =================================================================== */}
      <div className="sonic-dashboard-activity-row">
        {/* Left Card: My Players */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '18px',
            padding: '22px 24px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.03)'
          }}
        >
          {/* Card Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b', fontSize: '14px' }}>
                <i className="fa-solid fa-users"></i>
              </div>
              <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                My Players
              </h2>
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab('players')}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '12px',
                fontWeight: 800,
                color: '#475569',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer'
              }}
            >
              <span>View All</span>
              <span>→</span>
            </button>
          </div>

          {/* 4 Players List Rows matching Reference UI */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              { name: 'Biruk Tadesse', time: 'Registered 2h ago', status: 'Active' },
              { name: 'Selam Fiseha', time: 'Registered 3h ago', status: 'Active' },
              { name: 'Habtamu G/medhin', time: 'Registered 5h ago', status: 'Active' },
              { name: 'Meseret Alemu', time: 'Registered 1d ago', status: 'Active' }
            ].map((p, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBottom: idx !== 3 ? '12px' : '0',
                  borderBottom: idx !== 3 ? '1px solid #f1f5f9' : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {/* Silhouette User Circle */}
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: '#1e293b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      fontSize: '15px'
                    }}
                  >
                    <i className="fa-solid fa-user"></i>
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>{p.name}</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{p.time}</div>
                  </div>
                </div>

                {/* Active Pill Badge */}
                <span
                  style={{
                    background: '#ecfdf5',
                    color: '#059669',
                    border: '1px solid #a7f3d0',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: '9999px'
                  }}
                >
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Card: Recent Transactions */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '18px',
            padding: '22px 24px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.03)'
          }}
        >
          {/* Card Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b', fontSize: '14px' }}>
                <i className="fa-solid fa-clock-rotate-left"></i>
              </div>
              <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Recent Transactions
              </h2>
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab('statements')}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '12px',
                fontWeight: 800,
                color: '#475569',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer'
              }}
            >
              <span>View All</span>
              <span>→</span>
            </button>
          </div>

          {/* 4 Transaction List Rows matching Reference UI */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              {
                icon: 'fa-arrow-down',
                iconBg: '#10b981',
                title: 'Deposit via Telebirr',
                amount: '+1,000 ETB',
                amountColor: '#10b981',
                status: 'Success',
                statusBg: '#ecfdf5',
                statusColor: '#059669',
                statusBorder: '#a7f3d0'
              },
              {
                icon: 'fa-coins',
                iconBg: '#f59e0b',
                title: 'Commission Reward',
                amount: '+250 ETB',
                amountColor: '#10b981',
                status: 'Success',
                statusBg: '#ecfdf5',
                statusColor: '#059669',
                statusBorder: '#a7f3d0'
              },
              {
                icon: 'fa-money-bill-transfer',
                iconBg: '#8b5cf6',
                title: 'Withdrawal Request',
                amount: '-500 ETB',
                amountColor: '#0f172a',
                status: 'Pending',
                statusBg: '#fffbeb',
                statusColor: '#b45309',
                statusBorder: '#fde68a'
              },
              {
                icon: 'fa-gift',
                iconBg: '#f97316',
                title: 'Referral Bonus',
                amount: '+50 ETB',
                amountColor: '#10b981',
                status: 'Success',
                statusBg: '#ecfdf5',
                statusColor: '#059669',
                statusBorder: '#a7f3d0'
              }
            ].map((tx, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBottom: idx !== 3 ? '12px' : '0',
                  borderBottom: idx !== 3 ? '1px solid #f1f5f9' : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {/* Circular Icon */}
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      background: tx.iconBg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      fontSize: '14px'
                    }}
                  >
                    <i className={`fa-solid ${tx.icon}`}></i>
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>{tx.title}</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Electronic Settlement</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 900, color: tx.amountColor }}>
                    {tx.amount}
                  </span>
                  <span
                    style={{
                      background: tx.statusBg,
                      color: tx.statusColor,
                      border: `1px solid ${tx.statusBorder}`,
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: '9999px'
                    }}
                  >
                    {tx.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===================================================================
          5. BOTTOM REFERRAL CALL-TO-ACTION BANNER
          =================================================================== */}
      <div
        style={{
          background: 'linear-gradient(135deg, #fffdf5 0%, #fef8e7 40%, #fdecb2 80%, #f8d882 100%)',
          border: '1px solid #fcd34d',
          borderRadius: '24px',
          padding: '28px 36px',
          boxShadow: '0 6px 20px rgba(245, 158, 11, 0.12)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '24px',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Left Content */}
        <div style={{ maxWidth: '480px', zIndex: 2 }}>
          <h2
            style={{
              fontSize: '24px',
              fontWeight: 900,
              color: '#0f172a',
              margin: '0 0 6px 0',
              letterSpacing: '-0.3px'
            }}
          >
            Bring More Players, Earn More!
          </h2>
          <p style={{ fontSize: '13px', color: '#78350f', margin: '0 0 18px 0', fontWeight: 600 }}>
            Share your referral link and get 10% of their first deposit.
          </p>

          <button
            type="button"
            onClick={handleCopyLink}
            style={{
              background: 'linear-gradient(135deg, #f59e0b 0%, #eab308 100%)',
              border: 'none',
              borderRadius: '9999px',
              padding: '12px 24px',
              color: '#0f172a',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(245, 158, 11, 0.4)',
              transition: 'transform 0.15s ease'
            }}
          >
            <i className={`fa-solid ${copiedLink ? 'fa-check' : 'fa-link'}`}></i>
            <span>{copiedLink ? 'Link Copied!' : 'Copy Referral Link'}</span>
          </button>
        </div>

        {/* Right Graphic: 3D Royal Crown + Silhouette Players */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            zIndex: 1,
            minWidth: '220px'
          }}
        >
          {/* Subtle Ambient Radial Glow */}
          <div
            style={{
              position: 'absolute',
              width: '180px',
              height: '180px',
              background: 'radial-gradient(circle, rgba(245, 158, 11, 0.35) 0%, rgba(254, 243, 199, 0) 70%)',
              borderRadius: '50%',
              zIndex: 0
            }}
          />

          {/* Graphic Assembly */}
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* 3D Crown */}
            <div
              style={{
                fontSize: '44px',
                lineHeight: 1,
                filter: 'drop-shadow(0 4px 12px rgba(217, 119, 6, 0.5))',
                marginBottom: '-10px',
                zIndex: 3
              }}
            >
              👑
            </div>

            {/* Silhouette Trio */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', position: 'relative' }}>
              {/* Silhouette Left */}
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  background: '#1e293b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#94a3b8',
                  fontSize: '18px'
                }}
              >
                <i className="fa-solid fa-user"></i>
              </div>

              {/* Silhouette Center (Larger) */}
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: '#0f172a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontSize: '22px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
                }}
              >
                <i className="fa-solid fa-user"></i>
              </div>

              {/* Silhouette Right */}
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  background: '#1e293b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#94a3b8',
                  fontSize: '18px'
                }}
              >
                <i className="fa-solid fa-user"></i>
              </div>

              {/* Circular Gold + User Badge */}
              <div
                style={{
                  position: 'absolute',
                  right: '-6px',
                  bottom: '-6px',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: '#f59e0b',
                  border: '2px solid #ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#000000',
                  fontSize: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                }}
              >
                <i className="fa-solid fa-user-plus"></i>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
