import React from 'react';

export type AgentDeskTab =
  | 'overview'
  | 'deposit_requests'
  | 'withdrawal_requests'
  | 'cash_in'
  | 'cash_out'
  | 'commission'
  | 'recharge'
  | 'players'
  | 'statements'
  | 'profile';

interface AgentSidebarProps {
  activeTab: AgentDeskTab;
  setActiveTab: (tab: AgentDeskTab) => void;
  isCollapsed: boolean;
  setIsCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  isMobileOpen: boolean;
  closeMobile: () => void;
  agentProfile: any;
  pendingRequestsCount?: number;
  pendingWithdrawalsCount?: number;
  onLogout: () => void;
}

export const AgentSidebar: React.FC<AgentSidebarProps> = ({
  activeTab,
  setActiveTab,
  isCollapsed,
  setIsCollapsed,
  isMobileOpen,
  closeMobile,
  pendingRequestsCount = 0,
  pendingWithdrawalsCount = 0,
  onLogout
}) => {
  // Navigation tabs preserving full functional compatibility with Enqu light luxury styling
  const navItems: Array<{
    id: AgentDeskTab;
    label: string;
    icon: string;
    badge?: number;
  }> = [
    { id: 'overview', label: 'Dashboard', icon: 'fa-solid fa-table-cells-large' },
    { id: 'players', label: 'Players', icon: 'fa-solid fa-user-group' },
    { id: 'deposit_requests', label: 'Deposits', icon: 'fa-solid fa-arrow-down-to-bracket', badge: pendingRequestsCount },
    { id: 'cash_out', label: 'Withdrawals', icon: 'fa-solid fa-arrow-up-from-bracket', badge: pendingWithdrawalsCount },
    { id: 'cash_in', label: 'Agent Wallet', icon: 'fa-solid fa-wallet' },
    { id: 'recharge', label: 'Recharge Requests', icon: 'fa-solid fa-plus' },
    { id: 'commission', label: 'Commissions', icon: 'fa-solid fa-percent' },
    { id: 'statements', label: 'Transactions', icon: 'fa-solid fa-bars' },
    { id: 'profile', label: 'Settings', icon: 'fa-solid fa-gear' },
  ];

  const handleTabClick = (tab: AgentDeskTab) => {
    setActiveTab(tab);
    closeMobile();
  };

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      <div
        className={`sonic-mobile-overlay ${isMobileOpen ? 'mobile-open' : ''}`}
        onClick={closeMobile}
      />

      {/* Main Collapsible Sidebar (Enqu Luxury White & Obsidian Theme) */}
      <aside
        className={`sonic-agent-sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}
        style={{
          position: 'sticky',
          top: 0,
          height: '100vh',
          maxHeight: '100vh',
          overflowY: 'auto',
          flexShrink: 0,
          zIndex: 40,
          width: isCollapsed ? '72px' : '260px',
          minWidth: isCollapsed ? '72px' : '260px',
          background: '#ffffff',
          borderRight: '1px solid #e6e6e9',
          boxShadow: '0 0 16px rgba(0, 0, 0, 0.03)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.2s ease, min-width 0.2s ease',
          fontFamily: "'Urbanist', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        }}
      >
        {/* Brand Top Header: Rounded Gold "E" Square + Enqu Game Title */}
        <div
          style={{
            padding: isCollapsed ? '18px 12px' : '20px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'space-between',
            position: 'relative',
            borderBottom: '1px solid #f2f2f4'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              minWidth: 0
            }}
          >
            {/* Rounded Gold "E" Avatar Badge */}
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '14px',
                background: '#e6a21f',
                color: '#1b1b1b',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 800,
                fontSize: '18px',
                flexShrink: 0,
                boxShadow: '0 2px 8px rgba(230, 162, 31, 0.35)'
              }}
            >
              E
            </div>

            {!isCollapsed && (
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '16px',
                    fontWeight: 800,
                    color: '#1b1b1b',
                    lineHeight: 1.2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  Enqu Game
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#6f6f73',
                    lineHeight: 1.2
                  }}
                >
                  Agent Portal
                </div>
              </div>
            )}
          </div>

          {/* Desktop Collapse / Expand Toggle Button */}
          {!isCollapsed && (
            <button
              type="button"
              onClick={() => setIsCollapsed(true)}
              title="Collapse Sidebar"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#6f6f73',
                cursor: 'pointer',
                padding: '6px 8px',
                borderRadius: '8px',
                fontSize: '12px',
                transition: 'background 0.15s'
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f4f4f6')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <i className="fa-solid fa-chevron-left"></i>
            </button>
          )}
        </div>

        {/* Collapsed Expand Quick Button */}
        {isCollapsed && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
            <button
              type="button"
              onClick={() => setIsCollapsed(false)}
              title="Expand Sidebar"
              style={{
                background: '#f4f4f6',
                border: '1px solid #e6e6e9',
                borderRadius: '8px',
                width: '32px',
                height: '32px',
                display: 'grid',
                placeItems: 'center',
                color: '#1b1b1b',
                cursor: 'pointer',
                fontSize: '11px'
              }}
            >
              <i className="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        )}

        {/* Navigation List */}
        <nav
          style={{
            padding: '12px 0',
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
            flex: 1,
            overflowY: 'auto'
          }}
        >
          {navItems.map((item, index) => {
            const isActive =
              item.id === activeTab ||
              (item.id === 'cash_out' && activeTab === 'withdrawal_requests') ||
              (item.id === 'commission' && activeTab === 'cash_out');

            return (
              <button
                key={`${item.id}-${index}`}
                type="button"
                onClick={() => handleTabClick(item.id)}
                title={isCollapsed ? item.label : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: isCollapsed ? '11px 0' : '11px 16px',
                  margin: isCollapsed ? '3px 8px' : '3px 12px',
                  borderRadius: '14px',
                  border: 'none',
                  background: isActive ? '#1f2220' : 'transparent',
                  color: isActive ? '#ffffff' : '#1b1b1b',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'background 0.12s, color 0.12s',
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  position: 'relative'
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    e.currentTarget.style.background = '#f4f4f6';
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <i
                  className={item.icon}
                  style={{
                    fontSize: '15px',
                    width: '20px',
                    textAlign: 'center',
                    color: isActive ? '#ffffff' : '#1b1b1b',
                    flexShrink: 0
                  }}
                />

                {!isCollapsed && (
                  <>
                    <span
                      style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        flex: 1,
                        textAlign: 'left'
                      }}
                    >
                      {item.label}
                    </span>

                    {/* Circular Amber Counter Badge */}
                    {item.badge !== undefined && item.badge > 0 && (
                      <span
                        style={{
                          background: '#e6a21f',
                          color: '#1b1b1b',
                          fontWeight: 800,
                          fontSize: '11px',
                          padding: '1px 8px',
                          borderRadius: '10px',
                          marginLeft: 'auto',
                          lineHeight: '16px'
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </>
                )}

                {/* Collapsed dot badge indicator */}
                {isCollapsed && item.badge !== undefined && item.badge > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '6px',
                      right: '10px',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: '#e6a21f'
                    }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer Logout Button */}
        <div
          style={{
            padding: isCollapsed ? '16px 8px' : '16px 18px',
            borderTop: '1px solid #f2f2f4',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'flex-start'
          }}
        >
          <button
            type="button"
            onClick={onLogout}
            style={{
              background: 'none',
              border: 'none',
              color: '#6f6f73',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '6px 8px',
              borderRadius: '10px',
              transition: 'color 0.15s, background 0.15s',
              width: '100%'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = '#b0302f';
              e.currentTarget.style.background = '#f6dedd';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = '#6f6f73';
              e.currentTarget.style.background = 'none';
            }}
            title="Logout"
          >
            <i className="fa-solid fa-arrow-right-from-bracket" style={{ fontSize: '15px' }}></i>
            {!isCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
};
