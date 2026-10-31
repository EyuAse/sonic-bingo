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
  }> = [
    { id: 'overview', label: 'Dashboard', icon: 'fa-solid fa-table-cells-large' },
    { id: 'players', label: 'My Players', icon: 'fa-solid fa-users' },
    { id: 'cash_in', label: 'Wallet', icon: 'fa-solid fa-wallet' },
    { id: 'cash_out', label: 'Commission', icon: 'fa-solid fa-percent' },
    { id: 'recharge', label: 'Targets', icon: 'fa-solid fa-bullseye' },
    { id: 'statements', label: 'Transactions', icon: 'fa-solid fa-clock-rotate-left' },
    { id: 'profile', label: 'Referrals', icon: 'fa-solid fa-user-plus' },
    { id: 'profile', label: 'Support', icon: 'fa-solid fa-headset' },
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

      {/* Main Collapsible Sidebar (Dark Luxury Theme matching Reference UI) */}
      <aside
        className={`sonic-agent-sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}
        style={{
          background: '#0a0d14',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '4px 0 24px rgba(0, 0, 0, 0.4)'
        }}
      >
        {/* Brand Top Header */}
        <div
          className="sonic-sidebar-brand-box"
          style={{
            padding: '24px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'space-between'
          }}
        >
          <div className="sonic-brand-row" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '28px', lineHeight: 1, filter: 'drop-shadow(0 2px 8px rgba(245, 158, 11, 0.4))' }}>
              👑
            </span>
            {!isCollapsed && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span
                  style={{
                    fontSize: '20px',
                    fontWeight: 900,
                    color: '#ffffff',
                    letterSpacing: '-0.3px',
                    lineHeight: 1.1
                  }}
                >
                  Sonic <span style={{ color: '#f59e0b' }}>Bingo</span>
                </span>
              </div>
            )}
          </div>

          {/* Desktop Toggle Button */}
          <button
            type="button"
            className="sonic-sidebar-toggle-btn"
            onClick={() => setIsCollapsed(prev => !prev)}
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#94a3b8'
            }}
          >
            <i className={`fa-solid ${isCollapsed ? 'fa-chevron-right' : 'fa-chevron-left'}`}></i>
          </button>
        </div>

        {/* Navigation List */}
        <nav
          className="sonic-sidebar-nav"
          style={{
            padding: '16px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            flex: 1,
            overflowY: 'auto'
          }}
        >
          {navItems.map((item, index) => {
            // Determine active state: if activeTab === item.id (deduplicating profile sub-items)
            const isActive =
              item.id === activeTab &&
              (item.id !== 'profile' || item.label === 'Referrals');

            return (
              <button
                key={`${item.id}-${item.label}-${index}`}
                type="button"
                onClick={() => handleTabClick(item.id)}
                title={isCollapsed ? item.label : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: 'none',
                  background: isActive ? '#f59e0b' : 'transparent',
                  color: isActive ? '#000000' : '#94a3b8',
                  fontWeight: isActive ? 900 : 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  width: '100%',
                  textAlign: 'left',
                  boxShadow: isActive ? '0 4px 14px rgba(245, 158, 11, 0.35)' : 'none'
                }}
              >
                <i
                  className={`${item.icon}`}
                  style={{
                    fontSize: '16px',
                    width: '20px',
                    textAlign: 'center',
                    color: isActive ? '#000000' : '#94a3b8'
                  }}
                ></i>
                {!isCollapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Bottom Card: "Grow Together with Sonic" 3D Golden Card */}
        {!isCollapsed && (
          <div style={{ padding: '0 12px 16px 12px' }}>
            <div
              style={{
                background: 'linear-gradient(180deg, #131722 0%, #0b0e14 100%)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '16px',
                padding: '16px',
                position: 'relative',
                overflow: 'hidden',
                textAlign: 'center',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)'
              }}
            >
              {/* Gold Ambient Radial Glow */}
              <div
                style={{
                  position: 'absolute',
                  top: '-20px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '120px',
                  height: '80px',
                  background: 'radial-gradient(circle, rgba(245, 158, 11, 0.35) 0%, transparent 70%)',
                  zIndex: 0
                }}
              />

              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ fontSize: '20px', marginBottom: '2px' }}>👑</div>
                <div style={{ fontSize: '13px', fontWeight: 900, color: '#ffffff', lineHeight: 1.2 }}>
                  Grow Together
                </div>
                <div style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 700 }}>
                  with Sonic
                </div>

                {/* 3D Bingo Ball Graphic */}
                <div style={{ margin: '12px auto 6px auto', display: 'flex', justifyContent: 'center' }}>
                  <div
                    style={{
                      width: '54px',
                      height: '54px',
                      borderRadius: '50%',
                      background: 'radial-gradient(circle at 35% 35%, #fef08a 0%, #f59e0b 50%, #b45309 100%)',
                      boxShadow: '0 6px 16px rgba(245, 158, 11, 0.5), inset 0 2px 4px rgba(255, 255, 255, 0.6)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '2px solid rgba(255, 255, 255, 0.3)'
                    }}
                  >
                    <span style={{ fontSize: '22px', fontWeight: 900, color: '#000000', fontFamily: 'sans-serif' }}>
                      B
                    </span>
                  </div>
                </div>

                {/* Gold Swirl Ribbon Arc */}
                <div style={{ height: '4px', background: 'linear-gradient(90deg, transparent, #f59e0b, transparent)', borderRadius: '2px', marginTop: '8px' }} />
              </div>
            </div>
          </div>
        )}

        {/* Sidebar Footer Logout Button */}
        <div
          style={{
            padding: isCollapsed ? '16px 8px' : '16px 20px',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
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
              color: '#94a3b8',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: 0,
              transition: 'color 0.15s ease'
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
            onMouseLeave={e => (e.currentTarget.style.color = '#94a3b8')}
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
