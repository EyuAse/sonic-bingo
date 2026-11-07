import React from 'react';
import { useAdmin } from '../../context/AdminContext.tsx';
import { useApp } from '../../context/AppContext.tsx';

export type AdminTab =
  | 'overview'
  | 'cashflow'
  | 'cashier'
  | 'users'
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

// Exact Minimalist SVG Stroke Icons from Enqu Game Admin (1).html
const IC = {
  dash: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  cf: 'M3 3v18h18M7 16l4-4 4 4 6-6M17 6h4v4',
  p2p: 'M4 8h14l-3-3M20 16H6l3 3',
  pl: 'M12 4a4 4 0 100 8 4 4 0 000-8zM4 20c0-4 4-6 8-6s8 2 8 6',
  bot: 'M6 8h12v10H6zM12 4v4M9 13h.01M15 13h.01',
  eng: 'M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v3M12 19v3M2 12h3M19 12h3',
  room: 'M3 5h18v14H3zM3 10h18M9 5v14',
  tg: 'M21 4L3 11l6 2 2 6 3-4 4 3z',
  ads: 'M3 10v4h4l6 4V6L7 10zM17 9a4 4 0 010 6',
  ag: 'M3 7h18v13H3zM8 7V4h8v3',
  rc: 'M12 3v18M7 8h7a3 3 0 010 6H8',
  po: 'M4 6h16v12H4zM4 10h16M8 15h3',
  of: 'M4 10l8-6 8 6M6 10v8M10 10v8M14 10v8M18 10v8M3 20h18',
  jp: 'M12 3l3 6 6 1-4.5 4.5L18 21l-6-3-6 3 1.5-6.5L3 10l6-1z',
  co: 'M12 3a9 9 0 100 18 9 9 0 000-18zM9 12h6M12 9v6',
  set: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z',
  out: 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9'
};

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

  const { showToast, switchPage } = useApp();

  const pendingCount = (transactions || []).filter(t => t.status === 'pending').length;

  const handleSelectTab = (tab: AdminTab) => {
    setActiveTab(tab);
    closeMobileSidebar();
  };

  const navItems: Array<{
    id: AdminTab;
    label: string;
    path: string;
    n?: string | number;
    s?: string;
    urgentBadge?: boolean;
  }> = [
    { id: 'overview', label: 'Dashboard', path: IC.dash },
    { id: 'cashflow', label: 'Cashflow & Treasury', path: IC.cf, s: 'Live' },
    {
      id: 'cashier',
      label: 'P2P Cashier',
      path: IC.p2p,
      n: pendingCount > 0 ? pendingCount : undefined,
      urgentBadge: pendingCount > 0
    },
    { id: 'users', label: 'Player Accounts', path: IC.pl, n: totalUsersCount || users.length || 7 },
    { id: 'bot-engine', label: 'Bot Engine', path: IC.eng, s: '0-50' },
    { id: 'cartelas', label: '600 Cartelas', path: IC.room, s: 'Cards' },
    { id: 'telegram-bot', label: 'Telegram Bot & Ads', path: IC.tg },
    { id: 'agents', label: 'Agents Directory', path: IC.ag, s: 'Portal' },
    { id: 'agent-recharges', label: 'Agent Recharges', path: IC.rc, s: 'Float' },
    { id: 'agent-payouts', label: 'Agent Payouts', path: IC.po, s: 'Cashout' },
    { id: 'official-accounts', label: 'Official Accounts', path: IC.of, s: 'Rails' },
    { id: 'jackpots', label: 'Progressive Jackpots', path: IC.jp, s: 'Vault' },
    { id: 'coins', label: 'Bonus & Rewards', path: IC.co, s: 'Live' }
  ];

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      <div
        className={`admin-mobile-backdrop ${isMobileOpen ? 'active' : ''}`}
        onClick={closeMobileSidebar}
        aria-hidden="true"
      />

      <aside className={`enqu-sidebar ${isSidebarCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}>
        {/* Header Row: Logo, Desktop Collapse Toggle Button & Mobile Drawer Close Button */}
        <div className={`sidebar-header-row ${isSidebarCollapsed ? 'collapsed' : ''}`}>
          {!isSidebarCollapsed ? (
            <div className="logo">Sonic Bingo</div>
          ) : (
            <div className="logo-compact" title="Sonic Bingo">
              SB
            </div>
          )}
          <button
            type="button"
            className="btn-chatgpt-toggle hide-on-mobile"
            onClick={toggleSidebar}
            title={isSidebarCollapsed ? 'Open sidebar' : 'Close sidebar'}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>

          {/* Mobile Drawer Dismiss Button */}
          <button
            type="button"
            className="btn-mobile-drawer-close"
            onClick={closeMobileSidebar}
            title="Close navigation"
            aria-label="Close navigation"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

      {/* Main Navigation List */}
      <nav className="enqu-nav">
        {navItems.map(item => {
          const isActive = activeTab === item.id;
          return (
            <a
              key={item.id}
              className={isActive ? 'on' : ''}
              onClick={() => handleSelectTab(item.id)}
              title={isSidebarCollapsed ? item.label : undefined}
            >
              <svg viewBox="0 0 24 24">
                <path d={item.path} />
              </svg>
              <span>{item.label}</span>
              {item.n != null && (
                <span
                  className="n"
                  style={item.urgentBadge ? { background: '#b0302f', color: '#ffffff' } : undefined}
                >
                  {item.n}
                </span>
              )}
              {item.s && <span className="s">{item.s}</span>}
              {isSidebarCollapsed && item.urgentBadge && (
                <span className="collapsed-urgent-dot" />
              )}
            </a>
          );
        })}
      </nav>

      {/* Exact Footer Actions */}
      <div className="foot nav">
        <nav>
          <a
            onClick={() => switchPage('withdrawals')}
            title={isSidebarCollapsed ? 'Withdrawals Desk' : undefined}
            style={{ cursor: 'pointer' }}
          >
            <svg viewBox="0 0 24 24">
              <path d="M12 15V3M7 8l5-5 5 5M4 17v3h16v-3" />
            </svg>
            <span>Withdrawals Desk</span>
            <span className="s" style={{ background: '#1c1e1d', color: '#fff' }}>Desk</span>
          </a>
          <a
            onClick={() => showToast('⚙️ System Settings & Security')}
            title={isSidebarCollapsed ? 'Settings' : undefined}
          >
            <svg viewBox="0 0 24 24">
              <path d={IC.set} />
            </svg>
            <span>Settings</span>
          </a>
          <a
            onClick={() => {
              logoutAdmin();
              showToast('👋 Logged out from Admin Portal');
            }}
            title={isSidebarCollapsed ? 'Log out' : undefined}
          >
            <svg viewBox="0 0 24 24">
              <path d={IC.out} />
            </svg>
            <span>Log out</span>
          </a>
        </nav>
      </div>
    </aside>
    </>
  );
};
