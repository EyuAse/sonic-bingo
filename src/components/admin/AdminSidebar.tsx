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
    users,
    totalUsersCount
  } = useAdmin();

  const { showToast } = useApp();

  const pendingCount = (transactions || []).filter(t => t.status === 'pending').length;

  const handleSelectTab = (tab: AdminTab) => {
    setActiveTab(tab);
    closeMobileSidebar();
  };

  const navItems: Array<{
    id: AdminTab;
    label: string;
    icon: string;
    badge?: React.ReactNode;
  }> = [
    {
      id: 'overview',
      label: 'Dashboard',
      icon: 'fa-solid fa-house'
    },
    {
      id: 'cashier',
      label: 'P2P Cashier',
      icon: 'fa-solid fa-shield-halved',
      badge: pendingCount > 0 ? (
        <span className="obsidian-nav-badge red-urgent-badge">{pendingCount}</span>
      ) : undefined
    },
    {
      id: 'cashflow',
      label: 'Cash Flow & Revenue',
      icon: 'fa-solid fa-scale-balanced'
    },
    {
      id: 'users',
      label: 'Player Accounts',
      icon: 'fa-solid fa-user-group',
      badge: <span className="obsidian-nav-badge">{totalUsersCount || users.length}</span>
    },
    {
      id: 'bots',
      label: 'Bot Player Accounts',
      icon: 'fa-solid fa-robot',
      badge: <span className="obsidian-nav-badge">200</span>
    },
    {
      id: 'bot-engine',
      label: 'Bot Engine (0-50)',
      icon: 'fa-solid fa-sliders',
      badge: <span className="obsidian-nav-badge green-badge">Room 10</span>
    },
    {
      id: 'cartelas',
      label: '600 Cartelas',
      icon: 'fa-solid fa-layer-group',
      badge: <span className="obsidian-nav-badge">600</span>
    },
    {
      id: 'telegram-bot',
      label: 'Telegram Bot & Ads',
      icon: 'fa-brands fa-telegram',
      badge: <span className="obsidian-nav-badge blue-badge">📢 Ads</span>
    },
    {
      id: 'agents',
      label: 'Agents Directory',
      icon: 'fa-solid fa-handshake',
      badge: <span className="obsidian-nav-badge green-badge">Portal</span>
    },
    {
      id: 'agent-recharges',
      label: 'Agent Recharges',
      icon: 'fa-solid fa-bolt',
      badge: <span className="obsidian-nav-badge yellow-badge">Float</span>
    },
    {
      id: 'agent-payouts',
      label: 'Agent Payouts',
      icon: 'fa-solid fa-money-bill-transfer',
      badge: <span className="obsidian-nav-badge green-badge">Cashout</span>
    },
    {
      id: 'official-accounts',
      label: 'Official Accounts',
      icon: 'fa-solid fa-building-columns',
      badge: <span className="obsidian-nav-badge blue-badge">Rails</span>
    },
    {
      id: 'jackpots',
      label: 'Progressive Jackpots',
      icon: 'fa-solid fa-trophy',
      badge: <span className="obsidian-nav-badge yellow-badge">Vault</span>
    },
    {
      id: 'coins',
      label: 'Coins & Rewards',
      icon: 'fa-solid fa-coins',
      badge: <span className="obsidian-nav-badge yellow-badge">1.5x</span>
    }
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div className="admin-sidebar-backdrop" onClick={closeMobileSidebar} />
      )}

      {/* Main Sticky Sidebar (Luxury Obsidian Dark Theme matching Agent Sidebar) */}
      <aside
        className={`admin-sidebar-obsidian ${isSidebarCollapsed ? 'collapsed' : ''} ${
          isMobileOpen ? 'mobile-open' : ''
        }`}
      >
        {/* 1. Brand Logo Header */}
        <div className="sidebar-obsidian-brand-box">
          <div className="sidebar-obsidian-brand-content">
            {/* Luminous 3D Royal Crown */}
            <span className="sidebar-obsidian-crown">👑</span>

            {!isSidebarCollapsed && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span className="sidebar-obsidian-title-sonic">Sonic</span>
                <span className="sidebar-obsidian-title-bingo">Bingo</span>
                <span className="sidebar-obsidian-subdots">• ADMIN PANEL •</span>
              </div>
            )}
          </div>

          {/* Collapse/Expand Toggle Button */}
          <button
            type="button"
            className="sidebar-obsidian-toggle-btn"
            onClick={toggleSidebar}
            title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            <i
              className={`fa-solid ${
                isSidebarCollapsed ? 'fa-chevron-right' : 'fa-chevron-left'
              }`}
            />
          </button>
        </div>

        {/* 2. Admin Panel Status Badges */}
        {!isSidebarCollapsed && (
          <div className="sidebar-obsidian-status-wrap">
            <div className="sidebar-obsidian-admin-tag">
              <i className="fa-solid fa-crown gold-crown" />
              <span>ADMIN PANEL</span>
            </div>

            <div className="sidebar-obsidian-uptime-tag">
              <div className="pulse-green-dot-obsidian" />
              <span className="uptime-title-obsidian">Engine V3 Live</span>
              <span className="uptime-pill-obsidian">99.9% Uptime</span>
            </div>
          </div>
        )}

        {/* 3. Navigation Menu Items */}
        <nav className="sidebar-obsidian-nav-menu">
          {navItems.map((item, index) => {
            const isActive = activeTab === item.id;

            return (
              <button
                key={`${item.id}-${index}`}
                type="button"
                className={`obsidian-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => handleSelectTab(item.id)}
                title={isSidebarCollapsed ? item.label : undefined}
              >
                <div className="obsidian-nav-icon">
                  <i className={item.icon} />
                </div>

                {!isSidebarCollapsed && (
                  <>
                    <span className="obsidian-nav-text">{item.label}</span>
                    {item.badge}
                  </>
                )}

                {/* Collapsed dot indicators for urgent items */}
                {isSidebarCollapsed && item.id === 'cashier' && pendingCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '6px',
                      right: '10px',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: '#ef4444',
                      boxShadow: '0 0 6px #ef4444'
                    }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* 4. Bottom 3D Golden Sonic Control Card */}
        {!isSidebarCollapsed && (
          <div
            className="sidebar-obsidian-feature-card"
            onClick={() => showToast('🎉 Sonic Bingo Live Engine Operational')}
            style={{ cursor: 'pointer' }}
          >
            <div className="obsidian-card-glow" />

            <div className="obsidian-card-inner">
              <div style={{ fontSize: '20px', marginBottom: '2px' }}>👑</div>
              <div style={{ fontSize: '13px', fontWeight: 900, color: '#ffffff', lineHeight: 1.2 }}>
                Grow Together
              </div>
              <div style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 700 }}>
                with Sonic
              </div>

              {/* 3D Bingo Ball Graphic with Glowing Halo */}
              <div style={{ margin: '10px auto 6px auto', display: 'flex', justifyContent: 'center' }}>
                <div
                  style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle at 35% 35%, #fef08a 0%, #f59e0b 50%, #b45309 100%)',
                    boxShadow: '0 6px 18px rgba(245, 158, 11, 0.6), inset 0 2px 4px rgba(255, 255, 255, 0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid rgba(255, 255, 255, 0.4)'
                  }}
                >
                  <span style={{ fontSize: '22px', fontWeight: 900, color: '#000000', fontFamily: 'sans-serif' }}>
                    B
                  </span>
                </div>
              </div>

              {/* Gold Swirl Ribbon Arc */}
              <div
                style={{
                  height: '3px',
                  background: 'linear-gradient(90deg, transparent, #f59e0b, transparent)',
                  borderRadius: '2px',
                  marginTop: '8px'
                }}
              />
            </div>
          </div>
        )}

        {/* 5. Bottom Logout Action */}
        <div className="sidebar-obsidian-footer-logout">
          <button
            type="button"
            className="btn-obsidian-logout"
            onClick={() => {
              logoutAdmin();
              showToast('👋 Logged out from Admin Portal');
            }}
            title="Logout of Admin"
          >
            <i className="fa-solid fa-arrow-right-from-bracket" />
            {!isSidebarCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
};
