import React from 'react';

interface WithdrawalsHeaderProps {
  activeTab: 'req' | 'hist';
  setActiveTab: (tab: 'req' | 'hist') => void;
  pendingCount: number;
  adminName?: string;
  onRefresh: () => void;
  onLogout: () => void;
  onExitToPortal?: () => void;
  isRefreshing?: boolean;
}

export const WithdrawalsHeader: React.FC<WithdrawalsHeaderProps> = ({
  activeTab,
  setActiveTab,
  pendingCount,
  adminName = 'Withdrawal Officer',
  onRefresh,
  onLogout,
  onExitToPortal,
  isRefreshing = false
}) => {
  return (
    <header style={{
      background: 'var(--card)',
      borderBottom: '1px solid var(--line)',
      padding: '14px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 30,
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)'
    }}>
      {/* Left: Brand & Live Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{
          width: '38px',
          height: '38px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #1c1e1d, #2a2d2b)',
          color: '#ffffff',
          display: 'grid',
          placeItems: 'center',
          fontSize: '18px',
          fontWeight: 800
        }}>
          🏦
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.3px', color: 'var(--ink)' }}>
              SONIC BINGO
            </span>
            <span style={{
              background: '#e4f1e8',
              color: '#1f6a37',
              borderRadius: '12px',
              padding: '2px 8px',
              fontSize: '11px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1f6a37' }}></span>
              Live Payouts
            </span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--mute)', fontWeight: 500 }}>
            Central Cashier &bull; {adminName}
          </div>
        </div>
      </div>

      {/* Center: Tabs Switcher */}
      <div className="w-tabs" style={{ margin: 0 }}>
        <button
          type="button"
          className={activeTab === 'req' ? 'on' : ''}
          onClick={() => setActiveTab('req')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <span>Requests</span>
          {pendingCount > 0 && (
            <span style={{
              background: activeTab === 'req' ? 'rgba(255,255,255,0.25)' : 'var(--chip)',
              color: activeTab === 'req' ? '#fff' : 'var(--ink)',
              borderRadius: '10px',
              padding: '1px 7px',
              fontSize: '11px',
              fontWeight: 800
            }}>
              {pendingCount}
            </span>
          )}
        </button>
        <button
          type="button"
          className={activeTab === 'hist' ? 'on' : ''}
          onClick={() => setActiveTab('hist')}
        >
          History
        </button>
      </div>

      {/* Right: Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          type="button"
          className="w-btn"
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Refresh Data"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
        >
          <span style={{ display: 'inline-block', transform: isRefreshing ? 'rotate(180deg)' : 'none', transition: 'transform 0.4s ease' }}>
            🔄
          </span>
          <span className="w-hide-mobile">Refresh</span>
        </button>

        {onExitToPortal && (
          <button
            type="button"
            className="w-btn"
            onClick={onExitToPortal}
            title="Switch Portal"
          >
            Switch Portal
          </button>
        )}

        <button
          type="button"
          className="w-btn"
          onClick={onLogout}
          style={{ color: 'var(--r)' }}
          title="Logout"
        >
          Lock / Exit
        </button>
      </div>
    </header>
  );
};
