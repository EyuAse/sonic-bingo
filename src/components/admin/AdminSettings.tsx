import React, { useState } from 'react';
import { useAdmin } from '../../context/AdminContext.tsx';
import { useApp } from '../../context/AppContext.tsx';

export const AdminSettings: React.FC = () => {
  const {
    brandName,
    setBrandName,
    adminPin,
    setAdminPin,
    houseCommissionEnabled,
    setHouseCommissionEnabled,
    commissionRate,
    setCommissionRate,
    stakes,
    verticalBoardMode,
    setVerticalBoardMode,
    registerBonus,
    setRegisterBonus,
    referralBonusRate,
    setReferralBonusRate,
    ownerWinTarget,
    setOwnerWinTarget,
    botWinRate,
    setBotWinRate
  } = useAdmin();

  const { showToast } = useApp();

  const [editBrand, setEditBrand] = useState(brandName || 'Lomi Bingo');
  const [newPin, setNewPin] = useState(adminPin || '1234');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPinChange, setShowPinChange] = useState(false);

  const realPlayerWinRate = Math.max(0, 100 - ownerWinTarget - botWinRate);

  const handleSaveBrand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editBrand.trim()) {
      showToast('⚠️ Brand name cannot be empty');
      return;
    }
    setBrandName(editBrand.trim());
    showToast(`✓ Brand Name updated to "${editBrand.trim()}"`);
  };

  const handleSavePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.length < 4) {
      showToast('⚠️ PIN must be at least 4 digits');
      return;
    }
    if (newPin !== confirmPin) {
      showToast('⚠️ PIN confirmation does not match');
      return;
    }
    setAdminPin(newPin);
    setShowPinChange(false);
    setConfirmPin('');
    showToast('✓ Admin Security PIN updated successfully');
  };

  return (
    <div className="settings-desk-container">
      {/* 1. Hero Settings Banner */}
      <div className="settings-hero-banner">
        <div className="settings-hero-left">
          <div className="settings-hero-icon-box">
            <i className="fa-solid fa-gear"></i>
          </div>
          <div className="settings-hero-titles">
            <div className="settings-hero-badge-row">
              <span className="settings-live-badge">
                <span className="pulse-green-dot"></span>
                <span>SYSTEM CONFIGURATION DESK</span>
              </span>
              <span className="settings-uptime-tag">Engine V3 Active</span>
            </div>
            <h1 className="settings-hero-main-title">PLATFORM SYSTEM & COMMISSION SETTINGS</h1>
            <p className="settings-hero-sub-title">
              የኮሚሽን ተመን፣ የጨዋታ ህጎች፣ የቦነስ ማበረታቻዎች እና የአስተዳዳሪ ደህንነት መቆጣጠሪያ ማዕከል
            </p>
          </div>
        </div>

        <div className="settings-hero-right">
          {/* Lemon SVG Artwork */}
          <div className="settings-hero-lemon-art">
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

          <div className="settings-hero-status-pill">
            <i className="fa-solid fa-circle-check"></i>
            <span>All Services Synced</span>
          </div>
        </div>
      </div>

      {/* 2. Main Settings Grid (2 Columns) */}
      <div className="settings-cards-grid">
        {/* Card 1: House Commission & Profit Retention */}
        <div className="settings-white-card">
          <div className="settings-card-header">
            <div className="settings-card-title-wrap">
              <div className="settings-icon-gold">
                <i className="fa-solid fa-percent"></i>
              </div>
              <div>
                <h3 className="settings-card-main-title">House Commission & Margin Engine</h3>
                <p className="settings-card-sub-title">Automated round pot deductions and owner profit margin</p>
              </div>
            </div>
            <span className="settings-card-tag gold">{commissionRate}% System Cut</span>
          </div>

          <div className="settings-controls-stack">
            {/* Control 1: House Commission Toggle */}
            <div className="settings-control-row">
              <div className="control-left-meta">
                <div className="control-title-row">
                  <strong className="control-title">Enable System Lock (House Commission Cut)</strong>
                  <span className={`control-status-pill ${houseCommissionEnabled ? 'active' : 'inactive'}`}>
                    {houseCommissionEnabled ? 'ACTIVE' : 'PAUSED'}
                  </span>
                </div>
                <p className="control-desc">
                  Automatically reserve a commission percentage from each round's prize pool before winner payout (Default: 20%).
                </p>
              </div>
              <label className="dash-toggle-switch">
                <input
                  type="checkbox"
                  checked={houseCommissionEnabled}
                  onChange={e => {
                    setHouseCommissionEnabled(e.target.checked);
                    showToast(`System Lock ${e.target.checked ? 'Enabled' : 'Paused'}`);
                  }}
                />
                <span className="dash-toggle-slider"></span>
              </label>
            </div>

            {/* Control 2: Commission Rate Slider */}
            <div className="settings-control-row">
              <div className="control-left-meta">
                <div className="control-title-row">
                  <strong className="control-title">System Lock Percentage Rate</strong>
                  <span className="control-val-pill gold">{commissionRate}% Cut</span>
                </div>
                <p className="control-desc">
                  Adjust platform profit percentage cut per 75-ball game round (Default: 20%).
                </p>
              </div>
              <div className="settings-slider-box">
                <input
                  type="range"
                  min="1"
                  max="30"
                  step="1"
                  value={commissionRate}
                  className="dash-range-slider"
                  onChange={e => setCommissionRate(parseInt(e.target.value, 10))}
                />
                <div className="slider-presets-row">
                  <span className="preset-label">Presets:</span>
                  {[5, 10, 15, 20, 25].map(rate => (
                    <button
                      key={rate}
                      type="button"
                      className={`btn-dash-preset-chip ${commissionRate === rate ? 'active' : ''}`}
                      onClick={() => setCommissionRate(rate)}
                    >
                      {rate}%
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Control 3: Owner Win Target Rate */}
            <div className="settings-control-row">
              <div className="control-left-meta">
                <div className="control-title-row">
                  <strong className="control-title">Owner Target Winning Rate (RTP)</strong>
                  <span className="control-val-pill purple">{ownerWinTarget}% House Edge</span>
                </div>
                <p className="control-desc">
                  Target house mathematical retention rate over extended 24-hour simulation periods.
                </p>
              </div>
              <div className="settings-slider-box">
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
                      onClick={() => setOwnerWinTarget(val)}
                    >
                      {val}%
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Control 4: Fake Bot Win Share Rate */}
            <div className="settings-control-row">
              <div className="control-left-meta">
                <div className="control-title-row">
                  <strong className="control-title">Fake Bot Win Percentage Rate</strong>
                  <span className="control-val-pill blue">{botWinRate}% Bot Win Rate</span>
                </div>
                <p className="control-desc">
                  Percentage of rounds won by simulated Ethiopian bots to keep player excitement high (Default: 30%).
                </p>
              </div>
              <div className="settings-slider-box">
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
                  {[15, 20, 30, 40, 50].map(val => (
                    <button
                      key={val}
                      type="button"
                      className={`btn-dash-preset-chip ${botWinRate === val ? 'active' : ''}`}
                      onClick={() => setBotWinRate(val)}
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
                <span className="tri-tier-title">🎮 Tri-Tier Round Outcome Distribution</span>
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

        {/* Card 2: Game Staking & Layout Rules */}
        <div className="settings-white-card">
          <div className="settings-card-header">
            <div className="settings-card-title-wrap">
              <div className="settings-icon-gold">
                <i className="fa-solid fa-gamepad"></i>
              </div>
              <div>
                <h3 className="settings-card-main-title">75-Ball Arena Rules & Board Layout</h3>
                <p className="settings-card-sub-title">Card bonus promotions, board orientation, and stake chips</p>
              </div>
            </div>
            <span className="settings-card-tag green">600 Cartela Pool</span>
          </div>

          <div className="settings-controls-stack">

            {/* Control 2: Vertical Board Mode */}
            <div className="settings-control-row">
              <div className="control-left-meta">
                <div className="control-title-row">
                  <strong className="control-title">Vertical Playing Board Layout</strong>
                  <span className={`control-status-pill ${verticalBoardMode ? 'active' : 'inactive'}`}>
                    {verticalBoardMode ? 'VERTICAL' : 'STANDARD'}
                  </span>
                </div>
                <p className="control-desc">
                  Optimizes master 75-ball numbered board vertically for enhanced mobile cartela visibility.
                </p>
              </div>
              <label className="dash-toggle-switch">
                <input
                  type="checkbox"
                  checked={verticalBoardMode}
                  onChange={e => {
                    setVerticalBoardMode(e.target.checked);
                    showToast(`Vertical Board Layout ${e.target.checked ? 'Enabled' : 'Standard'}`);
                  }}
                />
                <span className="dash-toggle-slider"></span>
              </label>
            </div>

            {/* Control 3: Active Stakes Chip Bar */}
            <div className="settings-control-row">
              <div className="control-left-meta">
                <strong className="control-title">Active Betting Stake Chips</strong>
                <p className="control-desc">
                  Default stake values available on player cartela purchasing desk.
                </p>
              </div>
              <div className="stakes-chips-display">
                {stakes.map(stk => (
                  <span key={stk} className="stake-chip-badge">
                    {stk} ETB
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Incentives & Bonus Rewards */}
        <div className="settings-white-card">
          <div className="settings-card-header">
            <div className="settings-card-title-wrap">
              <div className="settings-icon-gold">
                <i className="fa-solid fa-gift"></i>
              </div>
              <div>
                <h3 className="settings-card-main-title">Player Acquisition & Bonus Engine</h3>
                <p className="settings-card-sub-title">Registration rewards and referral first deposit commission</p>
              </div>
            </div>
            <span className="settings-card-tag purple">Instant Rewards</span>
          </div>

          <div className="settings-controls-stack">
            {/* Registration Welcome Bonus */}
            <div className="settings-control-row">
              <div className="control-left-meta">
                <div className="control-title-row">
                  <strong className="control-title">New Player Signup Bonus</strong>
                  <span className="control-val-pill green">{registerBonus} ETB Free</span>
                </div>
                <p className="control-desc">
                  Instant playable bonus credited to new accounts without requiring an initial deposit.
                </p>
              </div>
              <div className="settings-slider-box">
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="5"
                  value={registerBonus}
                  className="dash-range-slider"
                  onChange={e => setRegisterBonus(parseInt(e.target.value, 10))}
                />
                <div className="slider-presets-row">
                  <span className="preset-label">Presets:</span>
                  {[0, 5, 10, 20, 50].map(val => (
                    <button
                      key={val}
                      type="button"
                      className={`btn-dash-preset-chip ${registerBonus === val ? 'active' : ''}`}
                      onClick={() => setRegisterBonus(val)}
                    >
                      {val} ETB
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Referral First Deposit Commission */}
            <div className="settings-control-row">
              <div className="control-left-meta">
                <div className="control-title-row">
                  <strong className="control-title">Referral 1st Deposit Bonus Rate</strong>
                  <span className="control-val-pill gold">{referralBonusRate}% Bonus</span>
                </div>
                <p className="control-desc">
                  Percentage of referee's first deposit credited to referrer as a play-only bonus wallet balance.
                </p>
              </div>
              <div className="settings-slider-box">
                <input
                  type="range"
                  min="5"
                  max="30"
                  step="5"
                  value={referralBonusRate}
                  className="dash-range-slider"
                  onChange={e => setReferralBonusRate(parseInt(e.target.value, 10))}
                />
                <div className="slider-presets-row">
                  <span className="preset-label">Presets:</span>
                  {[5, 10, 15, 20, 25].map(val => (
                    <button
                      key={val}
                      type="button"
                      className={`btn-dash-preset-chip ${referralBonusRate === val ? 'active' : ''}`}
                      onClick={() => setReferralBonusRate(val)}
                    >
                      {val}%
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: Platform Security & Brand Credentials */}
        <div className="settings-white-card">
          <div className="settings-card-header">
            <div className="settings-card-title-wrap">
              <div className="settings-icon-gold">
                <i className="fa-solid fa-shield-check"></i>
              </div>
              <div>
                <h3 className="settings-card-main-title">Platform Identity & Security</h3>
                <p className="settings-card-sub-title">Brand identity title and admin portal access PIN</p>
              </div>
            </div>
            <span className="settings-card-tag">Super Admin</span>
          </div>

          <div className="settings-controls-stack">
            {/* Brand Title Form */}
            <form onSubmit={handleSaveBrand} className="settings-inline-form">
              <div className="form-info-wrap">
                <strong className="control-title">Application Brand Title</strong>
                <p className="control-desc">Title displayed on headers, SMS tickets, and transaction receipts.</p>
              </div>
              <div className="form-input-action-row">
                <input
                  type="text"
                  value={editBrand}
                  onChange={e => setEditBrand(e.target.value)}
                  className="settings-text-input"
                  placeholder="e.g. Lomi Bingo"
                />
                <button type="submit" className="btn-settings-save">
                  Save
                </button>
              </div>
            </form>

            {/* Admin PIN Update */}
            <div className="settings-control-row">
              <div className="control-left-meta">
                <div className="control-title-row">
                  <strong className="control-title">Admin Access PIN</strong>
                  <span className="control-val-pill purple">•••• (Encrypted)</span>
                </div>
                <p className="control-desc">
                  Security PIN required to unlock and access the administration console.
                </p>
              </div>

              {!showPinChange ? (
                <button
                  type="button"
                  className="btn-settings-outline"
                  onClick={() => setShowPinChange(true)}
                >
                  <i className="fa-solid fa-key"></i>
                  <span>Change PIN</span>
                </button>
              ) : (
                <form onSubmit={handleSavePin} className="pin-change-form">
                  <div className="pin-inputs-row">
                    <input
                      type="password"
                      placeholder="New 4-digit PIN"
                      value={newPin}
                      maxLength={6}
                      onChange={e => setNewPin(e.target.value)}
                      className="settings-text-input pin"
                    />
                    <input
                      type="password"
                      placeholder="Confirm PIN"
                      value={confirmPin}
                      maxLength={6}
                      onChange={e => setConfirmPin(e.target.value)}
                      className="settings-text-input pin"
                    />
                  </div>
                  <div className="pin-buttons-row">
                    <button type="submit" className="btn-settings-save">
                      Update
                    </button>
                    <button
                      type="button"
                      className="btn-settings-cancel"
                      onClick={() => setShowPinChange(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
