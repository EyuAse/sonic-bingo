import React from 'react';

export type WithdrawalsDeskTab = 'queue' | 'history' | 'settings';

interface WithdrawalsSidebarProps {
  activeTab: WithdrawalsDeskTab;
  setActiveTab: (tab: WithdrawalsDeskTab) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  isMobileOpen: boolean;
  closeMobileSidebar: () => void;
  pendingCount: number;
  onLogout: () => void;
}

const IC = {
  queue: 'M12 15V3M7 8l5-5 5 5M4 17v3h16v-3',
  history: 'M4 6h16v12H4zM4 10h16M8 15h3',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z',
  logout: 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9'
};

export const WithdrawalsSidebar: React.FC<WithdrawalsSidebarProps> = ({
  activeTab,
  setActiveTab,
  isCollapsed,
  setIsCollapsed,
  isMobileOpen,
  closeMobileSidebar,
  pendingCount,
  onLogout
}) => {
  const navItems: Array<{
    id: WithdrawalsDeskTab;
    label: string;
    path: string;
    badge?: number | string;
    urgentBadge?: boolean;
    subtitleBadge?: string;
  }> = [
    {
      id: 'queue',
      label: 'Requests Queue',
      path: IC.queue,
      badge: pendingCount > 0 ? pendingCount : undefined,
      urgentBadge: pendingCount > 0
    },
    {
      id: 'history',
      label: 'Payout History',
      path: IC.history,
      subtitleBadge: 'Audit'
    },
    {
      id: 'settings',
      label: 'Settings & Security',
      path: IC.settings,
      subtitleBadge: 'Config'
    }
  ];

  const handleSelectTab = (tab: WithdrawalsDeskTab) => {
    setActiveTab(tab);
    closeMobileSidebar();
  };

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      <div
        className={`admin-mobile-backdrop ${isMobileOpen ? 'active' : ''}`}
        onClick={closeMobileSidebar}
        aria-hidden="true"
      />

      <aside className={`enqu-sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}>
        {/* Header Row: Logo, Desktop Collapse Toggle & Mobile Close */}
        <div className={`sidebar-header-row ${isCollapsed ? 'collapsed' : ''}`}>
          {!isCollapsed ? (
            <div className="logo">Sonic Bingo</div>
          ) : (
            <div className="logo-compact" title="Sonic Bingo">
              SB
            </div>
          )}

          <button
            type="button"
            className="btn-chatgpt-toggle hide-on-mobile"
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? 'Open sidebar' : 'Close sidebar'}
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
                title={isCollapsed ? item.label : undefined}
                style={{ cursor: 'pointer' }}
              >
                <svg viewBox="0 0 24 24">
                  <path d={item.path} />
                </svg>
                <span>{item.label}</span>
                {item.badge != null && (
                  <span
                    className="n"
                    style={item.urgentBadge ? { background: '#b0302f', color: '#ffffff' } : undefined}
                  >
                    {item.badge}
                  </span>
                )}
                {item.subtitleBadge && <span className="s">{item.subtitleBadge}</span>}
                {isCollapsed && item.urgentBadge && (
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
              onClick={() => handleSelectTab('settings')}
              title={isCollapsed ? 'Settings' : undefined}
              style={{ cursor: 'pointer' }}
              className={activeTab === 'settings' ? 'on' : ''}
            >
              <svg viewBox="0 0 24 24">
                <path d={IC.settings} />
              </svg>
              <span>Settings</span>
            </a>
            <a
              onClick={onLogout}
              title={isCollapsed ? 'Log out' : undefined}
              style={{ cursor: 'pointer', color: 'var(--r)' }}
            >
              <svg viewBox="0 0 24 24">
                <path d={IC.logout} />
              </svg>
              <span>Log out</span>
            </a>
          </nav>
        </div>
      </aside>
    </>
  );
};
