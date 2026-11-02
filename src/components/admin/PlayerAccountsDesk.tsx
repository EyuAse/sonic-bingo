import React, { useState, useEffect } from 'react';
import { useAdmin, UserAccount } from '../../context/AdminContext.tsx';
import { useApp } from '../../context/AppContext.tsx';

export const PlayerAccountsDesk: React.FC = () => {
  const {
    users,
    totalUsersCount,
    userStats,
    usersPage,
    usersLimit,
    usersTotalPages,
    isUsersLoading,
    usersSearchQuery,
    usersSortBy,
    usersSegment,
    fetchUsers,
    adjustUserBalance,
    toggleUserStatus,
    registerBonus
  } = useAdmin();

  const { showToast } = useApp();

  // Search state (synced with usersSearchQuery)
  const [searchInput, setSearchInput] = useState(usersSearchQuery || '');

  // Modal states
  const [adjustTargetUser, setAdjustTargetUser] = useState<UserAccount | null>(null);
  const [dossierUser, setDossierUser] = useState<UserAccount | null>(null);

  // Adjust Balance Form state
  const [adjustType, setAdjustType] = useState<'add-cash' | 'add-bonus' | 'deduct-cash'>('add-cash');
  const [adjustAmount, setAdjustAmount] = useState('100');
  const [adjustReason, setAdjustReason] = useState('Manual Cashier Credit');

  // Debounced server-side database search across all 1,305+ users (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== usersSearchQuery) {
        fetchUsers({ page: 1, limit: usersLimit, search: searchInput.trim(), sortBy: usersSortBy, segment: usersSegment });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, usersLimit, usersSearchQuery, usersSortBy, usersSegment, fetchUsers]);

  const handleClearSearch = () => {
    setSearchInput('');
    fetchUsers({ page: 1, limit: usersLimit, search: '', sortBy: usersSortBy, segment: usersSegment });
  };

  const handleSegmentChange = (newSegment: 'all' | 'active' | 'suspended' | 'vip' | 'bonus') => {
    fetchUsers({ page: 1, limit: usersLimit, search: searchInput.trim(), sortBy: usersSortBy, segment: newSegment });
  };

  const handleSortChange = (newSort: string) => {
    fetchUsers({ page: 1, limit: usersLimit, search: searchInput.trim(), sortBy: newSort, segment: usersSegment });
  };

  // Platform-wide calculations from Neon DB stats
  const displayUsers = users.filter(u => u.role !== 'admin');
  const totalPlayers = userStats?.totalPlayers ?? totalUsersCount;
  const currentViewTotal = totalUsersCount;
  const activePlayers = userStats?.activePlayers ?? 0;
  const suspendedPlayers = userStats?.suspendedPlayers ?? 0;
  const totalCashFloat = userStats?.totalCashFloat ?? 0;
  const totalBonusFloat = userStats?.totalBonusFloat ?? 0;
  const vipPlayersCount = userStats?.vipPlayers ?? 0;
  const bonusPlayersCount = userStats?.bonusPlayers ?? 0;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast(`✓ Copied: ${text}`);
  };

  const handleExecuteAdjustBalance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTargetUser) return;
    const amt = parseFloat(adjustAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast('⚠️ Please specify a valid amount');
      return;
    }

    if (adjustType === 'add-cash') {
      adjustUserBalance(adjustTargetUser.id, amt, false);
      showToast(`✓ Credited +${amt.toFixed(2)} ETB Real Cash to ${adjustTargetUser.name}`);
    } else if (adjustType === 'add-bonus') {
      adjustUserBalance(adjustTargetUser.id, amt, true);
      showToast(`✓ Granted +${amt.toFixed(2)} ETB Promo Bonus to ${adjustTargetUser.name}`);
    } else if (adjustType === 'deduct-cash') {
      adjustUserBalance(adjustTargetUser.id, -amt, false);
      showToast(`✓ Deducted -${amt.toFixed(2)} ETB from ${adjustTargetUser.name}`);
    }

    setAdjustTargetUser(null);
    setAdjustAmount('100');
  };

  return (
    <div className="player-desk-container">
      {/* 1. Hero Player Directory Banner */}
      <div className="player-hero-banner">
        <div className="player-hero-left">
          <div className="player-hero-icon-box">
            <i className="fa-solid fa-users"></i>
          </div>
          <div className="player-hero-titles">
            <div className="player-hero-badge-row">
              <span className="player-live-badge">
                <span className="pulse-green-dot"></span>
                <span>LIVE PLAYER DIRECTORY</span>
              </span>
              <span className="player-uptime-tag">Verified Accounts</span>
            </div>
            <h1 className="player-hero-main-title">SONIC BINGO PLAYER ACCOUNTS & WALLETS DIRECTORY</h1>
            <p className="player-hero-sub-title">
              የተመዘገቡ ተጫዋቾችን፣ የዋሌት ቀሪ ሂሳብን፣ ቦነስን እና እንቅስቃሴዎችን በአንድ ማዕከል ይቆጣጠሩ
            </p>
          </div>
        </div>

        <div className="player-hero-right">
          {/* Lemon SVG Art */}
          <div className="player-hero-lemon-art">
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
        </div>
      </div>

      {/* 2. 4 Elevated Player KPI Cards */}
      <div className="player-kpi-grid">
        {/* Card 1: Total Registered */}
        <div className="player-kpi-card blue">
          <div className="pkpi-header">
            <span className="pkpi-title">Registered Accounts</span>
            <div className="pkpi-icon-box blue">
              <i className="fa-solid fa-address-book"></i>
            </div>
          </div>
          <div className="pkpi-value blue">{totalPlayers} <span className="pkpi-unit">Players</span></div>
          <div className="pkpi-footer">
            <span className="pkpi-badge green">
              <i className="fa-solid fa-check"></i>
              {activePlayers} Active
            </span>
            {suspendedPlayers > 0 && (
              <span className="pkpi-badge red">{suspendedPlayers} Suspended</span>
            )}
          </div>
        </div>

        {/* Card 2: Total Real Money Float */}
        <div className="player-kpi-card green">
          <div className="pkpi-header">
            <span className="pkpi-title">Player Real Cash Float</span>
            <div className="pkpi-icon-box green">
              <i className="fa-solid fa-wallet"></i>
            </div>
          </div>
          <div className="pkpi-value green">
            {totalCashFloat.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="pkpi-unit">ETB</span>
          </div>
          <div className="pkpi-footer">
            <span className="pkpi-badge green">Withdrawable Funds</span>
            <span className="pkpi-micro-text">Backing 100% liquid</span>
          </div>
        </div>

        {/* Card 3: Promo Bonus Float */}
        <div className="player-kpi-card purple">
          <div className="pkpi-header">
            <span className="pkpi-title">Promo Bonus Pool</span>
            <div className="pkpi-icon-box purple">
              <i className="fa-solid fa-gift"></i>
            </div>
          </div>
          <div className="pkpi-value purple">
            {totalBonusFloat.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="pkpi-unit">ETB</span>
          </div>
          <div className="pkpi-footer">
            <span className="pkpi-badge purple">{registerBonus} ETB / Signup</span>
            <span className="pkpi-micro-text">Play-only balance</span>
          </div>
        </div>

        {/* Card 4: VIP High-Rollers */}
        <div className="player-kpi-card gold">
          <div className="pkpi-header">
            <span className="pkpi-title">VIP & High-Rollers</span>
            <div className="pkpi-icon-box gold">
              <i className="fa-solid fa-crown"></i>
            </div>
          </div>
          <div className="pkpi-value gold">{vipPlayersCount} <span className="pkpi-unit">VIPs</span></div>
          <div className="pkpi-footer">
            <span className="pkpi-badge gold">&gt;1,000 ETB Deposits</span>
            <span className="pkpi-micro-text">100% Verified</span>
          </div>
        </div>
      </div>

      {/* 3. Advanced Player Directory & Table Card */}
      <div className="player-white-section-card">
        {/* Controls Bar */}
        <div className="player-section-header">
          <div className="player-section-title-wrap">
            <div className="player-section-icon-gold">
              <i className="fa-solid fa-user-gear"></i>
            </div>
            <div>
              <h3 className="player-section-main-heading">Player Accounts Management</h3>
              <p className="player-section-sub-heading">Real-time balances, bonus incentives, and security actions</p>
            </div>
          </div>

          <div className="player-controls-row">
            {/* Filter Pills */}
            <div className="player-filter-pills-group">
              <button
                type="button"
                className={`btn-player-pill ${usersSegment === 'all' ? 'active' : ''}`}
                onClick={() => handleSegmentChange('all')}
              >
                All ({totalPlayers})
              </button>
              <button
                type="button"
                className={`btn-player-pill ${usersSegment === 'active' ? 'active' : ''}`}
                onClick={() => handleSegmentChange('active')}
              >
                Active ({activePlayers})
              </button>
              <button
                type="button"
                className={`btn-player-pill ${usersSegment === 'vip' ? 'active' : ''}`}
                onClick={() => handleSegmentChange('vip')}
              >
                VIP High-Rollers ({vipPlayersCount})
              </button>
              <button
                type="button"
                className={`btn-player-pill ${usersSegment === 'bonus' ? 'active' : ''}`}
                onClick={() => handleSegmentChange('bonus')}
              >
                With Bonus ({bonusPlayersCount})
              </button>
              {suspendedPlayers > 0 && (
                <button
                  type="button"
                  className={`btn-player-pill ${usersSegment === 'suspended' ? 'active' : ''}`}
                  onClick={() => handleSegmentChange('suspended')}
                >
                  Suspended ({suspendedPlayers})
                </button>
              )}
            </div>

            {/* Page Size Selector */}
            <select
              className="player-page-size-select"
              value={usersLimit}
              onChange={e => {
                const newLimit = parseInt(e.target.value, 10);
                fetchUsers({ page: 1, limit: newLimit, search: searchInput.trim(), sortBy: usersSortBy, segment: usersSegment });
              }}
              title="Items per page"
            >
              <option value="25">25 per page</option>
              <option value="50">50 per page</option>
              <option value="100">100 per page</option>
              <option value="250">250 per page</option>
            </select>

            {/* Sort Selector */}
            <select
              className="player-sort-select"
              value={usersSortBy}
              onChange={e => handleSortChange(e.target.value)}
            >
              <option value="balance-desc">Highest Cash Balance</option>
              <option value="deposit-desc">Highest Lifetime Deposits</option>
              <option value="referrals-desc">Most Referrals</option>
              <option value="newest">Newest Account</option>
            </select>

            {/* Search Input (Searches across full Neon DB) */}
            <div className="player-search-box">
              {isUsersLoading ? (
                <i className="fa-solid fa-spinner fa-spin search-icon"></i>
              ) : (
                <i className="fa-solid fa-magnifying-glass search-icon"></i>
              )}
              <input
                type="text"
                placeholder="Search player name, phone, @username, ID..."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
              />
              {searchInput && (
                <button
                  type="button"
                  className="player-search-clear-btn"
                  onClick={handleClearSearch}
                  title="Clear Search"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Player Accounts Table */}
        <div className="player-table-container">
          <table className="player-light-table">
            <thead>
              <tr>
                <th>Player Identity</th>
                <th>Real Cash Balance</th>
                <th>Promo Bonus</th>
                <th>Lifetime Flow (In / Out)</th>
                <th>Referrals</th>
                <th>Status</th>
                <th>Action Toolbar</th>
              </tr>
            </thead>
            <tbody>
              {displayUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-player-cell">
                    <div className="empty-player-wrap">
                      <i className="fa-solid fa-user-slash"></i>
                      <span>No player accounts matching the selected criteria.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                displayUsers.map(user => {
                  const isVip = (user.totalDeposited || 0) >= 1000;
                  const isActive = user.status === 'active';
                  const totalIn = user.totalDeposited || 0;
                  const totalOut = user.totalWithdrawn || 0;
                  const flowRatio = totalIn > 0 ? Math.min(100, Math.round((totalIn / (totalIn + totalOut || 1)) * 100)) : 50;

                  return (
                    <tr key={user.id} className={!isActive ? 'row-suspended' : ''}>
                      <td>
                        <div className="player-identity-cell">
                          <div className="player-avatar-box">
                            <span className="avatar-initial">{user.name.charAt(0).toUpperCase()}</span>
                            {isVip && <span className="vip-crown-icon" title="VIP High-Roller">👑</span>}
                            <span className={`status-dot ${isActive ? 'online' : 'suspended'}`}></span>
                          </div>
                          <div className="player-name-wrap">
                            <strong className="player-full-name">{user.name}</strong>
                            <span className="player-joined-tag">Joined {user.createdAt}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <strong className="player-balance-cash">
                          {user.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                        </strong>
                      </td>
                      <td>
                        <span className="player-balance-bonus">
                          {user.bonus.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                        </span>
                      </td>
                      <td>
                        <div className="flow-ratio-container">
                          <div className="flow-text-row">
                            <span className="flow-in">+{totalIn} In</span>
                            <span className="flow-out">-{totalOut} Out</span>
                          </div>
                          <div className="flow-progress-track">
                            <div className="flow-progress-fill" style={{ width: `${flowRatio}%` }}></div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="referral-count-pill">
                          <i className="fa-solid fa-users"></i>
                          <span>{user.referralCount || 0}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`player-status-badge ${isActive ? 'active' : 'suspended'}`}>
                          {isActive ? 'ACTIVE ✓' : 'SUSPENDED ✕'}
                        </span>
                      </td>
                      <td>
                        <div className="player-action-toolbar">
                          <button
                            type="button"
                            className="btn-action-adjust"
                            onClick={() => setAdjustTargetUser(user)}
                            title="Adjust Real or Bonus Wallet"
                          >
                            <i className="fa-solid fa-coins"></i>
                            <span>Adjust</span>
                          </button>
                          <button
                            type="button"
                            className={`btn-action-suspend ${isActive ? 'suspend' : 'activate'}`}
                            onClick={() => {
                              toggleUserStatus(user.id);
                              showToast(`✓ Account "${user.name}" is now ${isActive ? 'Suspended' : 'Activated'}`);
                            }}
                            title={isActive ? 'Suspend Account' : 'Activate Account'}
                          >
                            <i className={`fa-solid ${isActive ? 'fa-ban' : 'fa-check'}`}></i>
                          </button>
                          <button
                            type="button"
                            className="btn-action-dossier"
                            onClick={() => setDossierUser(user)}
                            title="Inspect Player 360 Dossier"
                          >
                            <i className="fa-solid fa-eye"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="player-pagination-bar">
          <div className="pagination-info">
            {isUsersLoading ? (
              <span className="pagination-loading">
                <i className="fa-solid fa-spinner fa-spin"></i> Loading players from Neon DB...
              </span>
            ) : (
              <span>
                Showing <strong>{currentViewTotal === 0 ? 0 : (usersPage - 1) * usersLimit + 1}</strong> – <strong>{Math.min(usersPage * usersLimit, currentViewTotal)}</strong> of <strong>{currentViewTotal.toLocaleString()}</strong> Players
                {searchInput.trim() && (
                  <span className="search-filter-tag"> (Database Search Match)</span>
                )}
                {usersSegment !== 'all' && (
                  <span className="search-filter-tag"> (Segment: {usersSegment.toUpperCase()})</span>
                )}
              </span>
            )}
          </div>

          <div className="pagination-controls">
            <button
              type="button"
              className="btn-pagination"
              disabled={usersPage <= 1 || isUsersLoading}
              onClick={() => fetchUsers({ page: 1, limit: usersLimit, search: searchInput.trim(), sortBy: usersSortBy, segment: usersSegment })}
              title="First Page"
            >
              <i className="fa-solid fa-angles-left"></i> First
            </button>
            <button
              type="button"
              className="btn-pagination"
              disabled={usersPage <= 1 || isUsersLoading}
              onClick={() => fetchUsers({ page: usersPage - 1, limit: usersLimit, search: searchInput.trim(), sortBy: usersSortBy, segment: usersSegment })}
              title="Previous Page"
            >
              <i className="fa-solid fa-chevron-left"></i> Prev
            </button>

            <span className="pagination-page-indicator">
              Page <strong>{usersPage}</strong> of <strong>{usersTotalPages || 1}</strong>
            </span>

            <button
              type="button"
              className="btn-pagination"
              disabled={usersPage >= usersTotalPages || isUsersLoading}
              onClick={() => fetchUsers({ page: usersPage + 1, limit: usersLimit, search: searchInput.trim(), sortBy: usersSortBy, segment: usersSegment })}
              title="Next Page"
            >
              Next <i className="fa-solid fa-chevron-right"></i>
            </button>
            <button
              type="button"
              className="btn-pagination"
              disabled={usersPage >= usersTotalPages || isUsersLoading}
              onClick={() => fetchUsers({ page: usersTotalPages, limit: usersLimit, search: searchInput.trim(), sortBy: usersSortBy, segment: usersSegment })}
              title="Last Page"
            >
              Last <i className="fa-solid fa-angles-right"></i>
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================
          MODAL 2: ADJUST WALLET BALANCE
          ============================================================ */}
      {adjustTargetUser && (
        <div className="modal-overlay-light" onClick={() => setAdjustTargetUser(null)}>
          <div className="modal-box-light" onClick={e => e.stopPropagation()}>
            <div className="modal-header-light">
              <div className="modal-title-row">
                <div className="modal-icon-gold">
                  <i className="fa-solid fa-coins"></i>
                </div>
                <div>
                  <h3 className="modal-heading">Adjust Player Wallet Balance</h3>
                  <p className="modal-sub">Account: <strong>{adjustTargetUser.name}</strong></p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setAdjustTargetUser(null)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleExecuteAdjustBalance} className="modal-form-body">
              {/* Current Balances Preview */}
              <div className="current-balances-strip">
                <div className="strip-cell">
                  <span className="strip-label">Real Cash Balance:</span>
                  <strong className="strip-val green">{adjustTargetUser.balance.toFixed(2)} ETB</strong>
                </div>
                <div className="strip-cell">
                  <span className="strip-label">Promo Bonus Wallet:</span>
                  <strong className="strip-val purple">{adjustTargetUser.bonus.toFixed(2)} ETB</strong>
                </div>
              </div>

              {/* Adjustment Mode */}
              <div className="modal-form-group">
                <label className="modal-label">Adjustment Type</label>
                <div className="adjust-mode-toggle-group">
                  <button
                    type="button"
                    className={`btn-mode-toggle ${adjustType === 'add-cash' ? 'active-green' : ''}`}
                    onClick={() => setAdjustType('add-cash')}
                  >
                    + Add Real Cash
                  </button>
                  <button
                    type="button"
                    className={`btn-mode-toggle ${adjustType === 'add-bonus' ? 'active-purple' : ''}`}
                    onClick={() => setAdjustType('add-bonus')}
                  >
                    + Grant Bonus
                  </button>
                  <button
                    type="button"
                    className={`btn-mode-toggle ${adjustType === 'deduct-cash' ? 'active-red' : ''}`}
                    onClick={() => setAdjustType('deduct-cash')}
                  >
                    - Deduct Cash
                  </button>
                </div>
              </div>

              {/* Amount */}
              <div className="modal-form-group">
                <label className="modal-label">Amount (ETB) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="10"
                  value={adjustAmount}
                  onChange={e => setAdjustAmount(e.target.value)}
                  className="modal-input large-amount"
                />
              </div>

              {/* Reason */}
              <div className="modal-form-group">
                <label className="modal-label">Audit Note / Reason</label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={e => setAdjustReason(e.target.value)}
                  className="modal-input"
                  placeholder="e.g. VIP Deposit Credit or Promo Reward"
                />
              </div>

              <div className="modal-actions-row">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setAdjustTargetUser(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-modal-submit">
                  <i className="fa-solid fa-check"></i>
                  <span>Confirm Adjustment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL 3: PLAYER 360 DOSSIER
          ============================================================ */}
      {dossierUser && (
        <div className="modal-overlay-light" onClick={() => setDossierUser(null)}>
          <div className="modal-box-light wide-dossier" onClick={e => e.stopPropagation()}>
            <div className="modal-header-light">
              <div className="modal-title-row">
                <div className="modal-icon-gold">
                  <i className="fa-solid fa-id-card"></i>
                </div>
                <div>
                  <h3 className="modal-heading">Player 360 Profile Dossier</h3>
                  <p className="modal-sub">Comprehensive player gaming history and financial audit</p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setDossierUser(null)}
              >
                ✕
              </button>
            </div>

            <div className="dossier-body">
              {/* Top Profile Summary Bar */}
              <div className="dossier-profile-card">
                <div className="dossier-avatar-large">
                  <span>{dossierUser.name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="dossier-info-main">
                  <div className="dossier-name-row">
                    <h2 className="dossier-player-name">{dossierUser.name}</h2>
                    <span className={`player-status-badge ${dossierUser.status}`}>
                      {dossierUser.status.toUpperCase()}
                    </span>
                    {(dossierUser.totalDeposited || 0) >= 1000 && (
                      <span className="pkpi-badge gold">👑 VIP High-Roller</span>
                    )}
                  </div>
                  <div className="dossier-meta-chips">
                    <span>🆔 {dossierUser.id}</span>
                    <span>📅 Joined {dossierUser.createdAt}</span>
                    {dossierUser.referredBy && <span>🤝 Referred by {dossierUser.referredBy}</span>}
                  </div>
                </div>
              </div>

              {/* 3 Metrics Cards */}
              <div className="dossier-metrics-grid">
                <div className="dossier-stat-tile green">
                  <span className="stat-label">Real Cash Balance</span>
                  <strong className="stat-value green">{dossierUser.balance.toFixed(2)} ETB</strong>
                  <span className="stat-sub">Available withdrawable funds</span>
                </div>
                <div className="dossier-stat-tile purple">
                  <span className="stat-label">Promo Bonus Wallet</span>
                  <strong className="stat-value purple">{dossierUser.bonus.toFixed(2)} ETB</strong>
                  <span className="stat-sub">Play-only balance</span>
                </div>
                <div className="dossier-stat-tile gold">
                  <span className="stat-label">Lifetime Deposited</span>
                  <strong className="stat-value gold">+{dossierUser.totalDeposited.toFixed(2)} ETB</strong>
                  <span className="stat-sub">Withdrawn: -{dossierUser.totalWithdrawn.toFixed(2)} ETB</span>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="dossier-footer-actions">
                <button
                  type="button"
                  className="btn-dossier-adjust"
                  onClick={() => {
                    const target = dossierUser;
                    setDossierUser(null);
                    setAdjustTargetUser(target);
                  }}
                >
                  <i className="fa-solid fa-coins"></i>
                  <span>Adjust Balance</span>
                </button>
                <button
                  type="button"
                  className="btn-dossier-status"
                  onClick={() => {
                    toggleUserStatus(dossierUser.id);
                    setDossierUser({
                      ...dossierUser,
                      status: dossierUser.status === 'active' ? 'suspended' : 'active'
                    });
                    showToast(`✓ Account "${dossierUser.name}" status updated`);
                  }}
                >
                  <i className="fa-solid fa-shield-halved"></i>
                  <span>{dossierUser.status === 'active' ? 'Suspend Account' : 'Reactivate Account'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayerAccountsDesk;
