import React from 'react';
import { useAdmin } from '../../context/AdminContext.tsx';
import { useApp } from '../../context/AppContext.tsx';

export type AdminTab =
  | 'overview'
  | 'cashier'
  | 'cashflow'
  | 'users'
  | 'bots'
  | 'bot-engine'
  | 'cartelas'
  | 'telegram-bot'
  | 'agents'
  | 'agent-recharges'
  | 'agent-payouts'
  | 'official-accounts'
  | 'jackpots'
  | 'coins';

interface AdminSidebarProps {
  activeTab: AdminTab;
  setActiveTab: (tab: AdminTab) => void;
  isMobileOpen: boolean;
  closeMobileSidebar: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  activeTab,
  setActiveTab,
  isMobileOpen,
  closeMobileSidebar
}) => {
  const {
    isSidebarCollapsed,
    toggleSidebar,
    logoutAdmin,
    transactions,
    simulatedPlayerCount,
    users,
    totalUsersCount
  } = useAdmin();

  const { showToast } = useApp();

  const pendingCount = (transactions || []).filter(t => t.status === 'pending').length;

  const handleSelectTab = (tab: AdminTab) => {
    setActiveTab(tab);
    closeMobileSidebar();
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div className="admin-sidebar-backdrop" onClick={closeMobileSidebar}></div>
      )}

      <aside
        className={`admin-sidebar-light ${isSidebarCollapsed ? 'collapsed' : ''} ${
          isMobileOpen ? 'mobile-open' : ''
        }`}
      >
        {/* 1. Brand Logo Header */}
        <div className="sidebar-light-brand-box">
          <div className="sidebar-light-logo-wrap">
            <div className="sonic-admin-logo-artwork" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: isSidebarCollapsed ? '28px' : '32px',
                  height: isSidebarCollapsed ? '28px' : '32px',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle at 35% 30%, #fef08a 0%, #f59e0b 55%, #b45309 100%)',
                  boxShadow: '0 0 12px rgba(245, 158, 11, 0.45), inset 0 1px 2px rgba(255, 255, 255, 0.7)',
                  border: '1.5px solid rgba(254, 240, 138, 0.9)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: isSidebarCollapsed ? '15px' : '17px',
                  flexShrink: 0
                }}
              >
                👑
              </div>
              {!isSidebarCollapsed && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '1.15rem', fontWeight: 950, letterSpacing: '1.5px', color: '#0284c7' }}>SONIC</span>
                    <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>|</span>
                    <span style={{ fontSize: '1.15rem', fontWeight: 950, letterSpacing: '1px', color: '#d97706' }}>BINGO</span>
                  </div>
                  <span style={{ fontSize: '0.5625rem', fontWeight: 900, letterSpacing: '2.5px', color: '#64748b', textTransform: 'uppercase', marginTop: '2px' }}>
                    • B I N G O •
                  </span>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            className="sidebar-collapse-btn-light"
            onClick={toggleSidebar}
            title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            <i
              className={`fa-solid ${
                isSidebarCollapsed ? 'fa-chevron-right' : 'fa-chevron-left'
              }`}
            ></i>
          </button>
        </div>

        {/* 2. Admin Panel Pill & Engine Uptime Pill */}
        {!isSidebarCollapsed && (
          <div className="sidebar-status-pills-wrap">
            <div className="admin-panel-tag">
              <i className="fa-solid fa-crown gold-crown"></i>
              <span>ADMIN PANEL</span>
            </div>

            <div className="engine-uptime-tag">
              <div className="pulse-green-dot"></div>
              <span className="uptime-title">Engine V3 Live</span>
              <span className="uptime-pill">99.9% Uptime</span>
            </div>
          </div>
        )}

        {/* 3. Streamlined Navigation Menu Items */}
        <nav className="sidebar-light-nav-menu">
          {/* 1. Dashboard */}
          <button
            type="button"
            className={`light-nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => handleSelectTab('overview')}
            title="Dashboard"
          >
            <div className="light-nav-icon">
              <i className="fa-solid fa-house"></i>
            </div>
            {!isSidebarCollapsed && <span className="light-nav-text">Dashboard</span>}
          </button>

          {/* 2. P2P Cashier Surveillance */}
          <button
            type="button"
            className={`light-nav-item ${activeTab === 'cashier' ? 'active' : ''}`}
            onClick={() => handleSelectTab('cashier')}
            title="P2P Cashier Surveillance"
          >
            <div className="light-nav-icon">
              <i className="fa-solid fa-shield-halved"></i>
            </div>
            {!isSidebarCollapsed && (
              <>
                <span className="light-nav-text">P2P Cashier</span>
                {pendingCount > 0 && (
                  <span className="light-nav-badge yellow-badge">{pendingCount}</span>
                )}
              </>
            )}
          </button>

          {/* 3. Cash Flow & Revenue */}
          <button
            type="button"
            className={`light-nav-item ${activeTab === 'cashflow' ? 'active' : ''}`}
            onClick={() => handleSelectTab('cashflow')}
            title="Cash Flow & Revenue"
          >
            <div className="light-nav-icon">
              <i className="fa-solid fa-scale-balanced"></i>
            </div>
            {!isSidebarCollapsed && <span className="light-nav-text">Cash Flow & Revenue</span>}
          </button>

          {/* 4. Player Accounts */}
          <button
            type="button"
            className={`light-nav-item ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => handleSelectTab('users')}
            title="Player Accounts"
          >
            <div className="light-nav-icon">
              <i className="fa-solid fa-user-group"></i>
            </div>
            {!isSidebarCollapsed && (
              <>
                <span className="light-nav-text">Player Accounts</span>
                <span className="light-nav-badge">{totalUsersCount || users.length}</span>
              </>
            )}
          </button>

          {/* 5. Bot Player Accounts */}
          <button
            type="button"
            className={`light-nav-item ${activeTab === 'bots' ? 'active' : ''}`}
            onClick={() => handleSelectTab('bots')}
            title="Bot Player Accounts"
          >
            <div className="light-nav-icon">
              <i className="fa-solid fa-robot"></i>
            </div>
            {!isSidebarCollapsed && (
              <>
                <span className="light-nav-text">Bot Player Accounts</span>
                <span className="light-nav-badge">200</span>
              </>
            )}
          </button>

          {/* 5b. Bot Engine (0-50 Control Desk) */}
          <button
            type="button"
            className={`light-nav-item ${activeTab === 'bot-engine' ? 'active' : ''}`}
            onClick={() => handleSelectTab('bot-engine')}
            title="Bot Engine (0-50)"
          >
            <div className="light-nav-icon">
              <i className="fa-solid fa-sliders"></i>
            </div>
            {!isSidebarCollapsed && (
              <>
                <span className="light-nav-text">Bot Engine (0-50)</span>
                <span className="light-nav-badge green-badge">Room 10</span>
              </>
            )}
          </button>

          {/* 6. 600 Cartelas */}
          <button
            type="button"
            className={`light-nav-item ${activeTab === 'cartelas' ? 'active' : ''}`}
            onClick={() => handleSelectTab('cartelas')}
            title="600 Cartelas"
          >
            <div className="light-nav-icon">
              <i className="fa-solid fa-layer-group"></i>
            </div>
            {!isSidebarCollapsed && (
              <>
                <span className="light-nav-text">600 Cartelas</span>
                <span className="light-nav-badge">600</span>
              </>
            )}
          </button>

          {/* 7. Telegram Bot & Ads Broadcast Center */}
          <button
            type="button"
            className={`light-nav-item ${activeTab === 'telegram-bot' ? 'active' : ''}`}
            onClick={() => handleSelectTab('telegram-bot')}
            title="Telegram Bot & Ads Broadcast Center"
          >
            <div className="light-nav-icon">
              <i className="fa-brands fa-telegram" style={{ color: '#0284c7' }}></i>
            </div>
            {!isSidebarCollapsed && (
              <>
                <span className="light-nav-text">Telegram Bot & Ads</span>
                <span className="light-nav-badge" style={{ background: '#e0f2fe', color: '#0369a1' }}>📢 Ads</span>
              </>
            )}
          </button>

          {/* 8. Agents Directory */}
          <button
            type="button"
            className={`light-nav-item ${activeTab === 'agents' ? 'active' : ''}`}
            onClick={() => handleSelectTab('agents')}
            title="Agents Directory"
          >
            <div className="light-nav-icon">
              <i className="fa-solid fa-handshake" style={{ color: '#059669' }}></i>
            </div>
            {!isSidebarCollapsed && (
              <>
                <span className="light-nav-text">Agents Directory</span>
                <span className="light-nav-badge green-badge">Portal</span>
              </>
            )}
          </button>

          {/* 9. Agent Float Recharges */}
          <button
            type="button"
            className={`light-nav-item ${activeTab === 'agent-recharges' ? 'active' : ''}`}
            onClick={() => handleSelectTab('agent-recharges')}
            title="Agent Float Recharges"
          >
            <div className="light-nav-icon">
              <i className="fa-solid fa-bolt" style={{ color: '#d97706' }}></i>
            </div>
            {!isSidebarCollapsed && (
              <>
                <span className="light-nav-text">Agent Recharges</span>
                <span className="light-nav-badge yellow-badge">Float</span>
              </>
            )}
          </button>

          {/* 9b. Agent Commission Cashouts */}
          <button
            type="button"
            className={`light-nav-item ${activeTab === 'agent-payouts' ? 'active' : ''}`}
            onClick={() => handleSelectTab('agent-payouts')}
            title="Agent Commission Cashouts"
          >
            <div className="light-nav-icon">
              <i className="fa-solid fa-money-bill-transfer" style={{ color: '#10b981' }}></i>
            </div>
            {!isSidebarCollapsed && (
              <>
                <span className="light-nav-text">Agent Payouts</span>
                <span className="light-nav-badge green-badge">Cashout</span>
              </>
            )}
          </button>

          {/* 10. Official Platform Receiving Accounts */}
          <button
            type="button"
            className={`light-nav-item ${activeTab === 'official-accounts' ? 'active' : ''}`}
            onClick={() => handleSelectTab('official-accounts')}
            title="Official Receiving Accounts (Telebirr, CBE, M-Pesa)"
          >
            <div className="light-nav-icon">
              <i className="fa-solid fa-building-columns" style={{ color: '#0284c7' }}></i>
            </div>
            {!isSidebarCollapsed && (
              <>
                <span className="light-nav-text">Official Accounts</span>
                <span className="light-nav-badge" style={{ background: '#e0f2fe', color: '#0284c7' }}>Rails</span>
              </>
            )}
          </button>

          {/* 10. Progressive Jackpots */}
          <button
            type="button"
            className={`light-nav-item ${activeTab === 'jackpots' ? 'active' : ''}`}
            onClick={() => handleSelectTab('jackpots')}
            title="Progressive Jackpots"
          >
            <div className="light-nav-icon">
              <i className="fa-solid fa-trophy" style={{ color: '#f59e0b' }}></i>
            </div>
            {!isSidebarCollapsed && (
              <>
                <span className="light-nav-text">Progressive Jackpots</span>
                <span className="light-nav-badge" style={{ background: '#fef3c7', color: '#b45309' }}>Vault</span>
              </>
            )}
          </button>

          {/* 11. Coins & Loyalty Rewards */}
          <button
            type="button"
            className={`light-nav-item ${activeTab === 'coins' ? 'active' : ''}`}
            onClick={() => handleSelectTab('coins')}
            title="Coins & Rewards Engine"
          >
            <div className="light-nav-icon">
              <i className="fa-solid fa-coins" style={{ color: '#eab308' }}></i>
            </div>
            {!isSidebarCollapsed && (
              <>
                <span className="light-nav-text">Coins & Rewards</span>
                <span className="light-nav-badge" style={{ background: '#fef08a', color: '#854d0e' }}>1.5x</span>
              </>
            )}
          </button>
        </nav>

        {/* 4. Bottom Promo Card with Lemon Graphic */}
        {!isSidebarCollapsed && (
          <div className="sidebar-light-promo-card">
            <div className="promo-card-left">
              <div className="promo-gift-row">
                <span className="promo-gift-icon">🎁</span>
                <span className="promo-perc-gold">200%</span>
              </div>
              <p className="promo-amharic-txt">የአዲስ ደንበኛ ቦነስ?</p>
            </div>

            <button
              type="button"
              className="btn-promo-circle-arrow"
              onClick={() => showToast('🎉 200% Welcome Deposit Bonus Active')}
              title="Bonus details"
            >
              <i className="fa-solid fa-chevron-right"></i>
            </button>

            {/* Sliced Lemon Artwork Decoration */}
            <div className="promo-lemon-slice-art">
              <svg viewBox="0 0 60 60" width="46" height="46" fill="none">
                <circle cx="30" cy="30" r="26" fill="#facc15" stroke="#eab308" strokeWidth="2.5" />
                <circle cx="30" cy="30" r="21" fill="#fef08a" />
                {/* Segments */}
                <path d="M30 30L30 10A20 20 0 0 1 45 17Z" fill="#fde047" stroke="#eab308" strokeWidth="1" />
                <path d="M30 30L45 17A20 20 0 0 1 50 30Z" fill="#fde047" stroke="#eab308" strokeWidth="1" />
                <path d="M30 30L50 30A20 20 0 0 1 45 43Z" fill="#fde047" stroke="#eab308" strokeWidth="1" />
                <path d="M30 30L45 43A20 20 0 0 1 30 50Z" fill="#fde047" stroke="#eab308" strokeWidth="1" />
                <path d="M30 30L30 50A20 20 0 0 1 15 43Z" fill="#fde047" stroke="#eab308" strokeWidth="1" />
                <path d="M30 30L15 43A20 20 0 0 1 10 30Z" fill="#fde047" stroke="#eab308" strokeWidth="1" />
                <path d="M30 30L10 30A20 20 0 0 1 15 17Z" fill="#fde047" stroke="#eab308" strokeWidth="1" />
                <path d="M30 30L15 17A20 20 0 0 1 30 10Z" fill="#fde047" stroke="#eab308" strokeWidth="1" />
                <circle cx="30" cy="30" r="4" fill="#ffffff" />
              </svg>
            </div>
          </div>
        )}

        {/* 5. Bottom Logout Action */}
        <div className="sidebar-light-footer-logout">
          <button
            type="button"
            className="btn-light-logout"
            onClick={() => {
              logoutAdmin();
              showToast('👋 Logged out from Admin Portal');
            }}
            title="Logout of Admin"
          >
            <i className="fa-solid fa-right-from-bracket"></i>
            {!isSidebarCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
};
