import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { apiClient } from '../services/apiClient.ts';
import { socketService } from '../services/socketService.ts';

// Stylesheets
import '../styles/admin.css';
import '../styles/withdrawals_admin.css';

// Components
import { WithdrawalsPINModal } from '../components/admin/withdrawals/WithdrawalsPINModal.tsx';
import WithdrawalsSidebar, { type WithdrawalsDeskTab } from '../components/admin/withdrawals/WithdrawalsSidebar.tsx';
import { WithdrawalsQueueDesk } from '../components/admin/withdrawals/WithdrawalsQueueDesk.tsx';
import { WithdrawalsHistoryDesk } from '../components/admin/withdrawals/WithdrawalsHistoryDesk.tsx';
import { WithdrawalsSettingsDesk } from '../components/admin/withdrawals/WithdrawalsSettingsDesk.tsx';

export const WithdrawalsAdminPage: React.FC = () => {
  const { switchPage, showToast } = useApp();

  const [activeTab, setActiveTab] = useState<WithdrawalsDeskTab>('queue');
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sonic_withdrawals_sidebar_collapsed') === 'true';
    }
    return false;
  });
  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false);

  const [token, setToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return (
        sessionStorage.getItem('sonic_withdrawals_token') ||
        localStorage.getItem('sonic_withdrawals_token') ||
        localStorage.getItem('sonic_admin_token')
      );
    }
    return null;
  });

  const [adminUser, setAdminUser] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Queue and KPI data
  const [queue, setQueue] = useState<any[]>([]);
  const [kpis, setKpis] = useState({
    pendingCount: 0,
    pendingAmount: 0,
    longestWaitingMinutes: 0,
    longestWaitingPlayer: 'Queue is clear',
    approvedTodayCount: 0,
    approvedTodayAmount: 0,
    rejectedTodayCount: 0,
    rejectedTodayAmount: 0,
    needsAttentionCount: 0,
    highValueCount: 0
  });

  const handleToggleCollapse = (val: boolean) => {
    setIsCollapsed(val);
    try {
      localStorage.setItem('sonic_withdrawals_sidebar_collapsed', String(val));
    } catch (e) {}
  };

  const loadQueueData = async () => {
    if (!token) return;
    try {
      setIsRefreshing(true);
      const res = await apiClient.withdrawalsAdmin.getQueue();
      if (res.success) {
        setQueue(res.queue || []);
        if (res.kpis) {
          setKpis(res.kpis);
        }
      }
    } catch (err: any) {
      console.warn('Queue fetch note:', err.message);
      if (err.message && (err.message.includes('401') || err.message.includes('token'))) {
        handleLogout();
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadQueueData();
    } else {
      setLoading(false);
    }
  }, [token]);

  // Real-time WebSocket Listeners for Instant Live Queue Updates
  useEffect(() => {
    if (!token) return;

    const unsubNewWithdrawal = socketService.on('admin_new_withdrawal', (data: any) => {
      showToast(`📥 New Withdrawal Request: ${data.amount} ETB to ${data.method}`);
      loadQueueData();
    });

    const unsubStatusUpdated = socketService.on('withdrawal_status_updated', () => {
      loadQueueData();
    });

    return () => {
      unsubNewWithdrawal();
      unsubStatusUpdated();
    };
  }, [token]);

  const handleLoginSuccess = (newToken: string, admin: any) => {
    setToken(newToken);
    setAdminUser(admin);
    showToast('🔓 Withdrawals Desk Unlocked');
  };

  const handleLogout = () => {
    sessionStorage.removeItem('sonic_withdrawals_token');
    localStorage.removeItem('sonic_withdrawals_token');
    setToken(null);
    setAdminUser(null);
    showToast('🔒 Withdrawals Desk Locked');
  };

  // If not authenticated, prompt for PIN
  if (!token) {
    return (
      <div className="withdrawals-fullscreen-root" style={{ display: 'grid', placeItems: 'center' }}>
        <WithdrawalsPINModal
          onSuccess={handleLoginSuccess}
          onCancel={() => switchPage('landing')}
        />
      </div>
    );
  }

  return (
    <div className={`admin-layout-shell ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* 1. SuperAdmin Matched Collapsible Sidebar (.enqu-sidebar) */}
      <WithdrawalsSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isCollapsed={isCollapsed}
        setIsCollapsed={handleToggleCollapse}
        isMobileOpen={isMobileOpen}
        closeMobileSidebar={() => setIsMobileOpen(false)}
        pendingCount={kpis.pendingCount}
        onLogout={handleLogout}
      />

      {/* 2. Admin Content Viewport */}
      <div className={`admin-main-viewport ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
        {/* Universal Sleek Mobile Topbar (Shown on mobile screens <= 980px) */}
        <header className="admin-mobile-global-topbar">
          <div className="admin-mobile-topbar-left">
            <button
              type="button"
              className="admin-mobile-hamburger-btn"
              onClick={() => setIsMobileOpen(true)}
              aria-label="Open Navigation Drawer"
            >
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div className="admin-mobile-brand-group">
              <span className="admin-mobile-brand-title">Sonic Bingo</span>
              <span className="admin-mobile-desk-badge">
                {activeTab === 'queue' && `⚡ Requests (${kpis.pendingCount})`}
                {activeTab === 'history' && '📜 Payout History'}
                {activeTab === 'settings' && '⚙️ Settings'}
              </span>
            </div>
          </div>

          <div className="admin-mobile-topbar-right">
            <div className="admin-mobile-lang-chip" title="Ethiopian Amharic">
              <span style={{ fontSize: '13px' }}>🇪🇹</span>
              <span>አማ</span>
            </div>
            <div
              className="admin-mobile-profile-avatar"
              title={adminUser?.name || 'Withdrawal Officer'}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #1c1e1d, #2a2d2b)',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: 800,
                display: 'grid',
                placeItems: 'center',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
              }}
            >
              WO
            </div>
          </div>
        </header>

        {/* Scrollable Viewport Content Area */}
        <div
          className="admin-content-scroller"
          style={{
            overflowY: 'auto',
            flex: 1,
            padding: '22px 24px',
            background: 'var(--panel, #e8e6e9)',
            minHeight: 0
          }}
        >
          {/* Top Title & Tab Pill Navigation with Full Mobile Responsiveness */}
          <div className="withdrawals-top-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {isCollapsed && (
                <button
                  type="button"
                  className="btn-chatgpt-toggle hide-on-mobile"
                  onClick={() => handleToggleCollapse(false)}
                  title="Open sidebar"
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    width: '36px',
                    height: '36px',
                    display: 'grid',
                    placeItems: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <line x1="9" y1="3" x2="9" y2="21" />
                  </svg>
                </button>
              )}
              <h1 className="withdrawals-page-heading">
                {activeTab === 'settings' ? 'Cashier Settings' : 'Withdrawals'}
              </h1>
            </div>

            <div className="withdrawals-controls-row">
              <div className="withdrawals-nav-pill-group">
                <button
                  type="button"
                  className={`withdrawals-nav-pill-btn ${activeTab === 'queue' ? 'active' : ''}`}
                  onClick={() => setActiveTab('queue')}
                >
                  <span>Requests Queue</span>
                  {kpis.pendingCount > 0 && (
                    <span className="pill-badge urgent">{kpis.pendingCount}</span>
                  )}
                </button>
                <button
                  type="button"
                  className={`withdrawals-nav-pill-btn ${activeTab === 'history' ? 'active' : ''}`}
                  onClick={() => setActiveTab('history')}
                >
                  <span>Payout History</span>
                  <span className="pill-badge">Audit</span>
                </button>
                <button
                  type="button"
                  className={`withdrawals-nav-pill-btn ${activeTab === 'settings' ? 'active' : ''}`}
                  onClick={() => setActiveTab('settings')}
                >
                  <span>Settings & Security</span>
                  <span className="pill-badge">Config</span>
                </button>
              </div>

              <button
                type="button"
                className="w-refresh-btn"
                onClick={loadQueueData}
                title="Refresh Queue"
              >
                <span style={{ display: 'inline-block', transform: isRefreshing ? 'rotate(180deg)' : 'none', transition: 'transform 0.4s ease' }}>
                  🔄
                </span>
                <span className="refresh-label">Refresh</span>
              </button>
            </div>
          </div>

          {/* Tab Views */}
          {activeTab === 'queue' && (
            <WithdrawalsQueueDesk
              queue={queue}
              kpis={kpis}
              onActionCompleted={loadQueueData}
              showToast={showToast}
            />
          )}

          {activeTab === 'history' && (
            <WithdrawalsHistoryDesk
              showToast={showToast}
            />
          )}

          {activeTab === 'settings' && (
            <WithdrawalsSettingsDesk
              showToast={showToast}
              onPinChanged={() => {
                showToast('Security PIN changed. Please re-authenticate.');
                handleLogout();
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default WithdrawalsAdminPage;
