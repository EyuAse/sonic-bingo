import React from 'react';

export type AgentDeskTab =
  | 'overview'
  | 'cash_in'
  | 'cash_out'
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
  onLogout: () => void;
}

export const AgentSidebar: React.FC<AgentSidebarProps> = ({
  activeTab,
  setActiveTab,
  isCollapsed,
  setIsCollapsed,
  isMobileOpen,
  closeMobile,
  agentProfile,
  onLogout
}) => {
  const navItems: Array<{
    id: AgentDeskTab;
    label: string;
    icon: string;
    badge?: string;
  }> = [
    { id: 'overview', label: 'Dashboard & Float', icon: 'fa-solid fa-chart-pie' },
    { id: 'cash_in', label: 'Player Cash-In', icon: 'fa-solid fa-bolt', badge: '+1.5x Coins' },
    { id: 'cash_out', label: 'Cash-Out Counter', icon: 'fa-solid fa-money-bill-transfer', badge: '1.5% Comm' },
    { id: 'recharge', label: 'Float Recharge', icon: 'fa-solid fa-arrow-rotate-right' },
    { id: 'players', label: 'Referred Players', icon: 'fa-solid fa-users' },
    { id: 'statements', label: 'Statement Ledger', icon: 'fa-solid fa-receipt' },
    { id: 'profile', label: 'Agency Settings & QR', icon: 'fa-solid fa-qrcode' },
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

      {/* Main Collapsible Sidebar */}
      <aside className={`sonic-agent-sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}>
        {/* Brand Top Header */}
        <div className="sonic-sidebar-brand-box">
          <div className="sonic-brand-row">
            <span className="sonic-crown-icon" title="Sonic Bingo">👑</span>
            {!isCollapsed && (
              <div className="sonic-brand-text-block">
                <span className="sonic-brand-title">
                  Sonic <span className="gold-accent">Bingo</span>
                </span>
                <span className="sonic-brand-subtitle">Agent Terminal</span>
              </div>
            )}
          </div>

          {/* Desktop Toggle Button */}
          <button
            type="button"
            className="sonic-sidebar-toggle-btn"
            onClick={() => setIsCollapsed(prev => !prev)}
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            <i className={`fa-solid ${isCollapsed ? 'fa-chevron-right' : 'fa-chevron-left'}`}></i>
          </button>
        </div>

        {/* Navigation List */}
        <nav className="sonic-sidebar-nav">
          {navItems.map(item => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`sonic-nav-item-btn ${isActive ? 'active' : ''}`}
                onClick={() => handleTabClick(item.id)}
                title={isCollapsed ? item.label : undefined}
              >
                <i className={`${item.icon} sonic-nav-item-icon`}></i>
                {!isCollapsed && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    {item.badge && <span className="sonic-nav-badge-pill">{item.badge}</span>}
                  </>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer with Live Float Summary */}
        {!isCollapsed && (
          <div className="sonic-sidebar-footer">
            <div className="sonic-sidebar-float-pill">
              <div className="sonic-float-label">Float Liquidity</div>
              <div className="sonic-float-val">
                {agentProfile ? Number(agentProfile.walletBalance).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'} ETB
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Code: <strong>{agentProfile?.agentCode || 'AGENT'}</strong></span>
                <button
                  type="button"
                  onClick={onLogout}
                  style={{ background: 'none', border: 'none', color: '#ef4444', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};

