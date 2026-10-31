import React, { useState } from 'react';
import { useAdmin, BotPlayer } from '../../context/AdminContext.tsx';
import { useApp } from '../../context/AppContext.tsx';

export const BotsSimulatorDesk: React.FC = () => {
  const {
    simulatedPlayerCount,
    setSimulatedPlayerCount,
    botWinRate,
    setBotWinRate,
    ownerWinTarget,
    setOwnerWinTarget,
    botPool
  } = useAdmin();

  const { showToast } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'top-winners' | 'high-activity'>('all');

  const safeBotPool = Array.isArray(botPool) ? botPool : [];

  // Calculations
  const totalBots = safeBotPool.length;
  const totalBotWins = safeBotPool.reduce((acc, b) => acc + (b.winsCount || 0), 0);
  const topWinningBots = safeBotPool.filter(b => (b.winsCount || 0) >= 5);
  const realPlayerWinRate = Math.max(0, 100 - ownerWinTarget - botWinRate);

  const filteredBots = safeBotPool.filter(bot => {
    if (filterMode === 'top-winners' && (bot.winsCount || 0) < 5) return false;
    if (filterMode === 'high-activity' && (bot.cartelasPlayed || 0) < 15) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (bot.name || '').toLowerCase().includes(q);
      const matchPhone = (bot.phone || '').includes(q);
      if (!matchName && !matchPhone) return false;
    }
    return true;
  });

  return (
    <div className="bots-desk-container">
      {/* 1. Hero Crowd Simulation Banner */}
      <div className="bots-hero-banner">
        <div className="bots-hero-left">
          <div className="bots-hero-icon-box">
            <i className="fa-solid fa-robot"></i>
          </div>
          <div className="bots-hero-titles">
            <div className="bots-hero-badge-row">
              <span className="bots-live-badge">
                <span className="pulse-green-dot"></span>
                <span>260+ DYNAMIC BOT IDENTITIES ACTIVE</span>
              </span>
              <span className="bots-uptime-tag">30% Win Allocation</span>
            </div>
            <h1 className="bots-hero-main-title">200+ SMART BOTS & CROWD DENSITY ENGINE</h1>
            <p className="bots-hero-sub-title">
              የቀጥታ ተጫዋቾች ቁጥር ማስመሰያ፣ የቦቶች አሸናፊነት ተመን እና የጨዋታ ድባብ መቆጣጠሪያ
            </p>
          </div>
        </div>

        <div className="bots-hero-right">
          {/* Lemon SVG Art */}
          <div className="bots-hero-lemon-art">
            <svg width="48" height="48" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="32" cy="32" r="28" fill="#facc15" stroke="#eab308" strokeWidth="3" />
              <circle cx="32" cy="32" r="23" fill="#fef08a" />
              <path d="M32 9L32 55" stroke="#eab308" strokeWidth="2" strokeLinecap="round" />
              <path d="M9 32L55 32" stroke="#eab308" strokeWidth="2" strokeLinecap="round" />
              <path d="M16 16L48 48" stroke="#eab308" strokeWidth="2" strokeLinecap="round" />
              <path d="M48 16L16 48" stroke="#eab308" strokeWidth="2" strokeLinecap="round" />
              <circle cx="32" cy="32" r="6" fill="#ffffff" stroke="#eab308" strokeWidth="1.5" />
            </svg>
          </div>

          <div className="bots-status-chip">
            <i className="fa-solid fa-gamepad"></i>
            <span>Room Density: {simulatedPlayerCount} Online</span>
          </div>
        </div>
      </div>

      {/* 2. 4 Elevated Bot KPI Cards */}
      <div className="bots-kpi-grid">
        {/* Card 1: Active Live Players */}
        <div className="bots-kpi-card gold">
          <div className="bkpi-header">
            <span className="bkpi-title">Room Live Players</span>
            <div className="bkpi-icon-box gold">
              <i className="fa-solid fa-users-viewfinder"></i>
            </div>
          </div>
          <div className="bkpi-value gold">{simulatedPlayerCount} <span className="bkpi-unit">Players</span></div>
          <div className="bkpi-footer">
            <span className="bkpi-badge gold">Dynamic Live Counter</span>
            <span className="bkpi-micro-text">20–450 Range</span>
          </div>
        </div>

        {/* Card 2: Bot Win Share Rate */}
        <div className="bots-kpi-card purple">
          <div className="bkpi-header">
            <span className="bkpi-title">Bot Target Win Rate</span>
            <div className="bkpi-icon-box purple">
              <i className="fa-solid fa-trophy"></i>
            </div>
          </div>
          <div className="bkpi-value purple">{botWinRate}% <span className="bkpi-unit">Share</span></div>
          <div className="bkpi-footer">
            <span className="bkpi-badge purple">Maintains Excitement</span>
            <span className="bkpi-micro-text">30% Optimal</span>
          </div>
        </div>

        {/* Card 3: Total Bot Trophies */}
        <div className="bots-kpi-card green">
          <div className="bkpi-header">
            <span className="bkpi-title">Bot Victory Trophies</span>
            <div className="bkpi-icon-box green">
              <i className="fa-solid fa-award"></i>
            </div>
          </div>
          <div className="bkpi-value green">{totalBotWins} <span className="bkpi-unit">Wins</span></div>
          <div className="bkpi-footer">
            <span className="bkpi-badge green">{topWinningBots.length} Top Winners</span>
            <span className="bkpi-micro-text">Realistic Distribution</span>
          </div>
        </div>

        {/* Card 4: Unique Bot Identities */}
        <div className="bots-kpi-card blue">
          <div className="bkpi-header">
            <span className="bkpi-title">Unique Bot Identities</span>
            <div className="bkpi-icon-box blue">
              <i className="fa-solid fa-robot"></i>
            </div>
          </div>
          <div className="bkpi-value blue">{totalBots} <span className="bkpi-unit">Ethiopian Roster</span></div>
          <div className="bkpi-footer">
            <span className="bkpi-badge green">100% Online Active</span>
            <span className="bkpi-micro-text">No Duplicate Fathers</span>
          </div>
        </div>
      </div>

      {/* 3. Live Operational Control Center (White Card) */}
      <div className="bots-white-section-card">
        <div className="bots-section-header">
          <div className="bots-section-title-wrap">
            <div className="bots-section-icon-gold">
              <i className="fa-solid fa-sliders"></i>
            </div>
            <div>
              <h3 className="bots-section-main-heading">Live Crowd Density & Win Distribution Controls</h3>
              <p className="bots-section-sub-heading">Real-time room size adjustment and simulated fair-play distribution</p>
            </div>
          </div>
          <span className="bots-section-pill">LIVE CONTROLLER</span>
        </div>

        <div className="bots-controls-stack">
          {/* Slider 1: Simulated Player Count */}
          <div className="bots-control-cell">
            <div className="bcell-left-meta">
              <div className="bcell-title-row">
                <strong className="bcell-title">Simulated Live Player Size (Room Density)</strong>
                <span className="bcell-val-pill gold">{simulatedPlayerCount} Players</span>
              </div>
              <p className="bcell-desc">
                Dynamically increase or decrease room player counter anytime to make the platform feel bustling.
              </p>
            </div>
            <div className="bcell-slider-interactive">
              <input
                type="range"
                min="20"
                max="450"
                step="5"
                value={simulatedPlayerCount}
                className="dash-range-slider"
                onChange={e => {
                  setSimulatedPlayerCount(parseInt(e.target.value, 10));
                }}
              />
              <div className="slider-presets-row">
                <span className="preset-label">Presets:</span>
                {[50, 100, 200, 350, 500, 600].map(val => (
                  <button
                    key={val}
                    type="button"
                    className={`btn-dash-preset-chip ${simulatedPlayerCount === val ? 'active' : ''}`}
                    onClick={() => {
                      setSimulatedPlayerCount(val);
                      showToast(`✓ Room size set to ${val} live players`);
                    }}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Slider 2: Fake Bot Win Rate */}
          <div className="bots-control-cell">
            <div className="bcell-left-meta">
              <div className="bcell-title-row">
                <strong className="bcell-title">Fake Bot Win Percentage Rate</strong>
                <span className="bcell-val-pill purple">{botWinRate}% Win Target</span>
              </div>
              <p className="bcell-desc">
                Percentage of simulated bot players winning pots (30% default) to build trust and high room energy.
              </p>
            </div>
            <div className="bcell-slider-interactive">
              <input
                type="range"
                min="5"
                max="60"
                step="5"
                value={botWinRate}
                className="dash-range-slider"
                onChange={e => setBotWinRate(parseInt(e.target.value, 10))}
              />
              <div className="slider-presets-row">
                <span className="preset-label">Presets:</span>
                {[15, 20, 30, 40, 50].map(rate => (
                  <button
                    key={rate}
                    type="button"
                    className={`btn-dash-preset-chip ${botWinRate === rate ? 'active' : ''}`}
                    onClick={() => {
                      setBotWinRate(rate);
                      showToast(`✓ Bot win share set to ${rate}%`);
                    }}
                  >
                    {rate}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Slider 3: Owner Target Win Rate (RTP) */}
          <div className="bots-control-cell">
            <div className="bcell-left-meta">
              <div className="bcell-title-row">
                <strong className="bcell-title">Owner Target Winning Margin (RTP)</strong>
                <span className="bcell-val-pill green">{ownerWinTarget}% House Margin</span>
              </div>
              <p className="bcell-desc">
                Platform target mathematical retention edge (20% default).
              </p>
            </div>
            <div className="bcell-slider-interactive">
              <input
                type="range"
                min="5"
                max="40"
                step="1"
                value={ownerWinTarget}
                className="dash-range-slider"
                onChange={e => setOwnerWinTarget(parseInt(e.target.value, 10))}
              />
              <div className="slider-presets-row">
                <span className="preset-label">Presets:</span>
                {[10, 15, 20, 25, 30].map(val => (
                  <button
                    key={val}
                    type="button"
                    className={`btn-dash-preset-chip ${ownerWinTarget === val ? 'active' : ''}`}
                    onClick={() => {
                      setOwnerWinTarget(val);
                      showToast(`✓ Owner target margin set to ${val}%`);
                    }}
                  >
                    {val}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Tri-Tier Win Allocation Breakdown Box */}
          <div className="tri-tier-breakdown-box">
            <div className="tri-tier-header">
              <span className="tri-tier-title">🎮 Tri-Tier Dynamic Outcome Routing</span>
              <span className="tri-tier-sum">Total: 100%</span>
            </div>
            <div className="tri-tier-bar">
              <div className="tri-tier-segment owner" style={{ width: `${ownerWinTarget}%` }}>
                <span>Owner: {ownerWinTarget}%</span>
              </div>
              <div className="tri-tier-segment bot" style={{ width: `${botWinRate}%` }}>
                <span>Bots: {botWinRate}%</span>
              </div>
              <div className="tri-tier-segment real" style={{ width: `${realPlayerWinRate}%` }}>
                <span>Real: {realPlayerWinRate}%</span>
              </div>
            </div>
            <div className="tri-tier-legend">
              <span className="legend-item"><span className="dot purple"></span> Owner/House: {ownerWinTarget}%</span>
              <span className="legend-item"><span className="dot blue"></span> 200+ Bots: {botWinRate}%</span>
              <span className="legend-item"><span className="dot green"></span> Real Players: {realPlayerWinRate}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. 260+ Bot Roster Directory (White Card & Clean Table) */}
      <div className="bots-white-section-card">
        <div className="bots-section-header">
          <div className="bots-section-title-wrap">
            <div className="bots-section-icon-gold">
              <i className="fa-solid fa-address-book"></i>
            </div>
            <div>
              <h3 className="bots-section-main-heading">260+ Active Ethiopian Bot Roster</h3>
              <p className="bots-section-sub-heading">Simulated player roster with realistic gaming handles and Ethiopian mobile numbers</p>
            </div>
          </div>

          <div className="bots-roster-controls">
            {/* Filter Pills */}
            <div className="bots-filter-pills-group">
              <button
                type="button"
                className={`btn-bots-pill ${filterMode === 'all' ? 'active' : ''}`}
                onClick={() => setFilterMode('all')}
              >
                All Bots ({totalBots})
              </button>
              <button
                type="button"
                className={`btn-bots-pill ${filterMode === 'top-winners' ? 'active' : ''}`}
                onClick={() => setFilterMode('top-winners')}
              >
                Top Winners (🏆 &ge;5)
              </button>
              <button
                type="button"
                className={`btn-bots-pill ${filterMode === 'high-activity' ? 'active' : ''}`}
                onClick={() => setFilterMode('high-activity')}
              >
                High Activity (&ge;15 Games)
              </button>
            </div>

            {/* Search Input */}
            <div className="bots-search-box">
              <i className="fa-solid fa-magnifying-glass search-icon"></i>
              <input
                type="text"
                placeholder="Search bot handle or phone..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Clean Light-Themed Bots Table */}
        <div className="bots-table-container">
          <table className="bots-light-table">
            <thead>
              <tr>
                <th>Bot Identity</th>
                <th>Handle / Name</th>
                <th>Ethiopian Phone</th>
                <th>Cartelas Played</th>
                <th>Round Wins 🏆</th>
                <th>Simulation Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredBots.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-bots-cell">
                    <div className="empty-bots-wrap">
                      <i className="fa-solid fa-robot"></i>
                      <span>No bots found matching "{searchQuery}".</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredBots.slice(0, 100).map(bot => (
                  <tr key={bot.id}>
                    <td>
                      <div className="bot-avatar-bubble">
                        <span className="bot-avatar-emoji">{bot.avatar}</span>
                      </div>
                    </td>
                    <td>
                      <strong className="bot-name-text">{bot.name}</strong>
                    </td>
                    <td>
                      <span className="bot-phone-text">{bot.phone}</span>
                    </td>
                    <td>
                      <span className="bot-cartelas-badge">{bot.cartelasPlayed} Played</span>
                    </td>
                    <td>
                      <strong className="bot-wins-gold">
                        {bot.winsCount} 🏆
                      </strong>
                    </td>
                    <td>
                      <span className="bot-status-pill online">
                        <span className="status-dot online"></span>
                        ONLINE SIMULATED
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
