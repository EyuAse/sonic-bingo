import React from 'react';

export type AgentDeskTab =
  | 'overview'
  | 'deposit_requests'
  | 'withdrawal_requests'
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
  const navItems: Array<{
    id: AgentDeskTab;
    label: string;
    icon: string;
  }> = [
    { id: 'overview', label: 'Dashboard', icon: 'fa-solid fa-table-cells-large' },
    { id: 'deposit_requests', label: 'Deposit Desk & History', icon: 'fa-solid fa-inbox' },
    { id: 'withdrawal_requests', label: 'Withdrawal Desk & History', icon: 'fa-solid fa-money-bill-transfer' },
    { id: 'players', label: 'My Players', icon: 'fa-solid fa-user-group' },
    { id: 'cash_in', label: 'Direct Cash-In', icon: 'fa-solid fa-bolt' },
    { id: 'cash_out', label: 'Commission Desk', icon: 'fa-solid fa-coins' },
    { id: 'recharge', label: 'Recharge Float', icon: 'fa-solid fa-wallet' },
    { id: 'statements', label: 'Transactions', icon: 'fa-solid fa-clock-rotate-left' },
    { id: 'profile', label: 'Payment Rails & Settings', icon: 'fa-solid fa-gear' },
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

      {/* Main Collapsible Sidebar (Dark Luxury Obsidian Theme 100% Reference Clone) */}
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
          background: '#0a0d14',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '4px 0 24px rgba(0, 0, 0, 0.45)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Brand Top Header: Centered 3D Gold Crown with Stacked Sonic Bingo */}
        <div
          className="sonic-sidebar-brand-box"
          style={{
            padding: isCollapsed ? '20px 8px' : '22px 18px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'space-between',
            position: 'relative'
          }}
        >
          <div
            className="sonic-brand-row"
            style={{
              display: 'flex',
              flexDirection: isCollapsed ? 'row' : 'column',
              alignItems: isCollapsed ? 'center' : 'center',
              width: isCollapsed ? 'auto' : '100%',
              textAlign: 'center'
            }}
          >
            {/* Luminous 3D Crown */}
            <span
              style={{
                fontSize: '28px',
                lineHeight: 1,
                filter: 'drop-shadow(0 2px 10px rgba(245, 158, 11, 0.6))',
                marginBottom: isCollapsed ? 0 : '4px'
              }}
            >
              👑
            </span>

            {!isCollapsed && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span
                  style={{
                    fontSize: '20px',
                    fontWeight: 900,
                    color: '#ffffff',
                    letterSpacing: '-0.3px',
                    lineHeight: 1.1
                  }}
                >
                  Sonic
                </span>
                <span
                  style={{
                    fontSize: '20px',
                    fontWeight: 900,
                    color: '#f59e0b',
                    letterSpacing: '-0.3px',
                    lineHeight: 1.1
                  }}
                >
                  Bingo
                </span>
              </div>
            )}
          </div>

          {/* Desktop Toggle Button */}
          {!isCollapsed && (
            <button
              type="button"
              className="sonic-sidebar-toggle-btn"
              onClick={() => setIsCollapsed(prev => !prev)}
              title="Collapse Sidebar"
              style={{
                position: 'absolute',
                right: '12px',
                top: '16px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#94a3b8',
                borderRadius: '6px',
                padding: '4px 6px',
                cursor: 'pointer',
                fontSize: '11px'
              }}
            >
              <i className="fa-solid fa-chevron-left"></i>
            </button>
          )}
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
            const isActive = item.id === activeTab;

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
                  background: isActive ? 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)' : 'transparent',
                  color: isActive ? '#000000' : '#94a3b8',
                  fontWeight: isActive ? 900 : 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  width: '100%',
                  textAlign: 'left',
                  boxShadow: isActive ? '0 4px 16px rgba(245, 158, 11, 0.4)' : 'none',
                  position: 'relative'
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    e.currentTarget.style.color = '#ffffff';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    e.currentTarget.style.color = '#94a3b8';
                    e.currentTarget.style.background = 'transparent';
                  }
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

                {!isCollapsed && (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1 }}>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
                    {item.id === 'deposit_requests' && pendingRequestsCount > 0 && (
                      <span
                        style={{
                          background: '#ef4444',
                          color: '#ffffff',
                          borderRadius: '9999px',
                          padding: '1px 7px',
                          fontSize: '10px',
                          fontWeight: 900,
                          lineHeight: '14px'
                        }}
                      >
                        {pendingRequestsCount}
                      </span>
                    )}
                    {item.id === 'withdrawal_requests' && pendingWithdrawalsCount > 0 && (
                      <span
                        style={{
                          background: '#f59e0b',
                          color: '#000000',
                          borderRadius: '9999px',
                          padding: '1px 7px',
                          fontSize: '10px',
                          fontWeight: 900,
                          lineHeight: '14px'
                        }}
                      >
                        {pendingWithdrawalsCount}
                      </span>
                    )}
                  </span>
                )}

                {isCollapsed && item.id === 'deposit_requests' && pendingRequestsCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '6px',
                      right: '10px',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: '#ef4444'
                    }}
                  />
                )}
                {isCollapsed && item.id === 'withdrawal_requests' && pendingWithdrawalsCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '6px',
                      right: '10px',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: '#f59e0b'
                    }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Card: "Grow Together with Sonic" 3D Golden Card */}
        {!isCollapsed && (
          <div style={{ padding: '0 12px 14px 12px' }}>
            <div
              style={{
                background: 'linear-gradient(180deg, #131722 0%, #0b0e14 100%)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
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

                {/* 3D Bingo Ball Graphic with Glowing Halo */}
                <div style={{ margin: '12px auto 6px auto', display: 'flex', justifyContent: 'center' }}>
                  <div
                    style={{
                      width: '54px',
                      height: '54px',
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
                <div style={{ height: '3px', background: 'linear-gradient(90deg, transparent, #f59e0b, transparent)', borderRadius: '2px', marginTop: '8px' }} />
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
