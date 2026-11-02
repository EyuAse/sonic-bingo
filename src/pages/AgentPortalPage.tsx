import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { apiClient } from '../services/apiClient.ts';

// Luxury Sonic Theme & Component Suite
import '../styles/agent.css';
import { AgentSidebar, AgentDeskTab } from '../components/agent/AgentSidebar.tsx';
import { AgentHeader } from '../components/agent/AgentHeader.tsx';
import { AgentDashboardDesk } from '../components/agent/AgentDashboardDesk.tsx';
import { AgentDepositRequestsDesk } from '../components/agent/AgentDepositRequestsDesk.tsx';
import { AgentWithdrawalRequestsDesk } from '../components/agent/AgentWithdrawalRequestsDesk.tsx';
import { AgentCashInDesk } from '../components/agent/AgentCashInDesk.tsx';
import { AgentCashOutDesk } from '../components/agent/AgentCashOutDesk.tsx';
import { AgentCommissionDesk } from '../components/agent/AgentCommissionDesk.tsx';
import { AgentRechargeDesk } from '../components/agent/AgentRechargeDesk.tsx';
import { AgentPlayersDesk } from '../components/agent/AgentPlayersDesk.tsx';
import { AgentStatementDesk } from '../components/agent/AgentStatementDesk.tsx';
import { AgentProfileDesk } from '../components/agent/AgentProfileDesk.tsx';
import { socketService } from '../services/socketService.ts';

interface AgentProfile {
  id: string;
  agentCode: string;
  fullName: string;
  phone: string;
  walletBalance: number;
  initialDeposit: number;
  lowBalanceThreshold: number;
  isLowBalance: boolean;
  targetMonthly: number;
  commissionRate: number;
  status: string;
  inviteLink: string;
}

interface AgentPerformance {
  totalPlayers: number;
  activePlayers: number;
  todayDeposited: number;
  monthDeposited: number;
  totalDepositedAllTime: number;
  targetMonthly: number;
  targetProgress: number;
  commissionRate: number;
  estimatedCommission: number;
}

export const AgentPortalPage: React.FC = () => {
  const { switchPage, showToast } = useApp();
  const { user } = useAuth();

  // Navigation & Layout State (with URL hash / param support)
  const getInitialTab = (): AgentDeskTab => {
    if (typeof window !== 'undefined') {
      const validTabs: AgentDeskTab[] = [
        'overview', 'deposit_requests', 'withdrawal_requests',
        'cash_in', 'cash_out', 'recharge', 'players', 'statements', 'profile', 'commission'
      ];

      // 1. Check URL query params: ?tab=commission
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab') as AgentDeskTab;
      if (tabParam && validTabs.includes(tabParam)) return tabParam;

      // 2. Check hash query params: #/agent-portal?tab=commission or #agent?tab=commission
      const rawHash = window.location.hash || '';
      const qIndex = rawHash.indexOf('?');
      if (qIndex !== -1) {
        const hashParams = new URLSearchParams(rawHash.substring(qIndex));
        const hashTab = hashParams.get('tab') as AgentDeskTab;
        if (hashTab && validTabs.includes(hashTab)) return hashTab;
      }

      // 3. Check plain hash: #commission or #deposit_requests
      const cleanHash = rawHash.replace(/^[#/]+/, '').replace(/^agent(-portal)?\/?/, '') as AgentDeskTab;
      if (cleanHash && validTabs.includes(cleanHash)) return cleanHash;

      // 4. Check localStorage saved tab
      const savedTab = localStorage.getItem('sonic_agent_tab') as AgentDeskTab;
      if (savedTab && validTabs.includes(savedTab)) return savedTab;
    }
    return 'overview';
  };

  const [activeTab, setActiveTabState] = useState<AgentDeskTab>(getInitialTab);

  const setActiveTab = (tab: AgentDeskTab) => {
    setActiveTabState(tab);
    if (typeof window !== 'undefined') {
      try {
        window.location.hash = `/agent-portal?tab=${tab}`;
        localStorage.setItem('sonic_active_portal', 'agent');
        localStorage.setItem('sonic_agent_tab', tab);
      } catch (_) {}
    }
  };

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState<number>(0);
  const [pendingWithdrawalsCount, setPendingWithdrawalsCount] = useState<number>(0);

  // Agent Session & Data
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [metrics, setMetrics] = useState<AgentPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAgentLoggedIn, setIsAgentLoggedIn] = useState(false);

  // Quick Action Jump (e.g. from Players Desk -> Cash-In Desk)
  const [prefilledPlayer, setPrefilledPlayer] = useState<any | null>(null);

  // Login Form State (if not authenticated)
  const [loginPhone, setLoginPhone] = useState(user?.phone || '');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginCode, setLoginCode] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // 1. Initial Load & Authentication Check
  const loadAgentData = async () => {
    try {
      setLoading(true);
      const [profileRes, perfRes, reqsRes, withRes] = await Promise.all([
        apiClient.agent.getProfile(),
        apiClient.agent.getPerformance(),
        apiClient.agent.getDepositRequests('pending').catch(() => ({ success: false, pendingCount: 0 })),
        apiClient.agent.getWithdrawalRequests().catch(() => ({ success: false, requests: [] }))
      ]);

      if (profileRes.success && profileRes.profile) {
        setProfile(profileRes.profile as any);
        setIsAgentLoggedIn(true);
        localStorage.setItem('sonic_active_portal', 'agent');
      }
      if (perfRes.success && perfRes.metrics) {
        setMetrics(perfRes.metrics);
      }
      if (reqsRes.success && typeof reqsRes.pendingCount === 'number') {
        setPendingRequestsCount(reqsRes.pendingCount);
      }
      if (withRes.success && withRes.requests) {
        const pendingCount = withRes.requests.filter((r: any) => r.status === 'pending').length;
        setPendingWithdrawalsCount(pendingCount);
      }
    } catch (err: any) {
      console.warn('Agent session not active:', err.message);
      setIsAgentLoggedIn(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const existingToken = localStorage.getItem('sonic_agent_token') || localStorage.getItem('sonic_auth_token');
    if (existingToken) {
      loadAgentData();
    } else {
      setLoading(false);
    }
  }, []);

  // Real-Time Socket Listener for Incoming Player Deposit & Withdrawal Requests
  useEffect(() => {
    if (!profile?.id) return;

    const unsubNewReq = socketService.on(`agent_${profile.id}_new_request`, (data: any) => {
      showToast(`📥 New Deposit Request: +${data.amount} ETB from ${data.playerPhone}`);
      setPendingRequestsCount(prev => prev + 1);
      loadAgentData();
    });

    const unsubNewWithReq = socketService.on(`agent_${profile.id}_new_withdrawal_request`, (data: any) => {
      showToast(`📤 New Withdrawal Request: ${data.amount} ETB to ${data.payoutMethod}`);
      setPendingWithdrawalsCount(prev => prev + 1);
      loadAgentData();
    });

    const unsubGlobalReq = socketService.on('agent_new_deposit_request', (data: any) => {
      if (data?.agentId === profile.id) {
        loadAgentData();
      }
    });

    const unsubReqUpdated = socketService.on(`agent_${profile.id}_request_updated`, () => {
      loadAgentData();
    });

    return () => {
      unsubNewReq();
      unsubNewWithReq();
      unsubGlobalReq();
      unsubReqUpdated();
    };
  }, [profile?.id]);

  // 2. Agent Login Handler
  const handleAgentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginPhone.trim()) {
      showToast('❌ Please enter your phone number');
      return;
    }

    try {
      setIsLoggingIn(true);
      const res = await apiClient.agent.login({
        phone: loginPhone.trim(),
        password: loginPassword.trim() || undefined,
        agentCode: loginCode.trim() || undefined
      });

      if (res.success && res.token) {
        localStorage.setItem('sonic_agent_token', res.token);
        localStorage.setItem('sonic_active_portal', 'agent');
        showToast(`🎉 Welcome Agent ${res.agent.agentCode}!`);
        setIsAgentLoggedIn(true);
        loadAgentData();
      }
    } catch (err: any) {
      showToast(`❌ ${err.message || 'Login failed'}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('sonic_agent_token');
    localStorage.removeItem('sonic_active_portal');
    localStorage.removeItem('sonic_agent_tab');
    setIsAgentLoggedIn(false);
    setProfile(null);
    setMetrics(null);
    showToast('🚪 Logged out of Sonic Agent Terminal');
    switchPage('landing');
  };

  const handleQuickDeposit = (player: any) => {
    setPrefilledPlayer(player);
    setActiveTab('cash_in');
  };

  // 3. Render Login Screen if unauthenticated
  if (!isAgentLoggedIn) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(180deg, #f8fafc 0%, #edf2f7 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          boxSizing: 'border-box'
        }}
      >
        <div
          className="sonic-white-card"
          style={{
            maxWidth: '440px',
            width: '100%',
            padding: '36px 32px',
            borderRadius: '20px',
            boxShadow: '0 20px 40px -15px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)'
          }}
        >
          {/* Logo Brand */}
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '32px',
                boxShadow: '0 6px 18px rgba(245, 158, 11, 0.4)',
                marginBottom: '14px',
                color: '#ffffff'
              }}
            >
              👑
            </div>
            <h1
              style={{
                fontSize: '22px',
                fontWeight: 900,
                color: '#0f172a',
                margin: 0,
                letterSpacing: '-0.5px'
              }}
            >
              Sonic <span style={{ color: '#d97706' }}>Bingo</span> Agent Terminal
            </h1>
            <p style={{ fontSize: '13px', color: '#64748b', marginTop: '6px', margin: 0 }}>
              Authorized Cash-In & Cash-Out Network Portal
            </p>
          </div>

          <form onSubmit={handleAgentLogin}>
            <div style={{ marginBottom: '14px' }}>
              <label className="sonic-field-label">Agent Phone Number</label>
              <input
                type="text"
                className="sonic-input-field"
                placeholder="e.g. 0911223344"
                value={loginPhone}
                onChange={e => setLoginPhone(e.target.value)}
                required
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label className="sonic-field-label">PIN / Password</label>
              <input
                type="password"
                className="sonic-input-field"
                placeholder="Enter 4-digit PIN (default: 1234)"
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
              />
            </div>

            <div style={{ marginBottom: '22px' }}>
              <label className="sonic-field-label">Agent Code (Optional)</label>
              <input
                type="text"
                className="sonic-input-field"
                placeholder="e.g. AGT-1001"
                value={loginCode}
                onChange={e => setLoginCode(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="sonic-gold-btn"
              style={{ width: '100%', padding: '14px', fontSize: '14px' }}
              disabled={isLoggingIn}
            >
              {isLoggingIn ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>
                  Authenticating...
                </>
              ) : (
                '🔑 Access Agent Terminal'
              )}
            </button>
          </form>

          <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #e2e8f0', textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => switchPage('games')}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <i className="fa-solid fa-arrow-left"></i> Return to Sonic Bingo Player App
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. Authenticated Agent Terminal Layout
  return (
    <div className="sonic-agent-layout-wrapper" style={{ backgroundColor: '#f4f6f8', minHeight: '100vh', width: '100%', display: 'flex', flexDirection: 'row', alignItems: 'flex-start' }}>
      {/* A. Collapsible Responsive Sidebar */}
      <AgentSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        isMobileOpen={isMobileOpen}
        closeMobile={() => setIsMobileOpen(false)}
        agentProfile={profile}
        pendingRequestsCount={pendingRequestsCount}
        pendingWithdrawalsCount={pendingWithdrawalsCount}
        onLogout={handleLogout}
      />

      {/* B. Main Viewport */}
      <div
        className={`sonic-agent-main-viewport ${isCollapsed ? 'sidebar-collapsed' : ''}`}
        style={{ backgroundColor: '#f4f6f8', minHeight: '100vh' }}
      >
        {/* Sticky Header */}
        <AgentHeader
          activeTab={activeTab}
          agentProfile={profile}
          pendingCount={pendingRequestsCount}
          pendingWithdrawalsCount={pendingWithdrawalsCount}
          openMobile={() => setIsMobileOpen(true)}
          onPlayBingo={() => switchPage('games')}
          onLogout={handleLogout}
          onNavigateTab={setActiveTab}
        />

        {/* Page Content Container */}
        <main className="sonic-agent-page-content" style={{ backgroundColor: '#f4f6f8' }}>
          {/* Desk 1: Overview & Float */}
          {activeTab === 'overview' && (
            <AgentDashboardDesk
              profile={profile}
              metrics={metrics}
              onNavigateTab={setActiveTab}
              onRefresh={loadAgentData}
              isLoading={loading}
              showToast={showToast}
            />
          )}

          {/* Desk: Player Deposit Requests Queue */}
          {activeTab === 'deposit_requests' && (
            <AgentDepositRequestsDesk
              agentProfile={profile}
              onActionCompleted={loadAgentData}
              showToast={showToast}
            />
          )}

          {/* Desk: Player Withdrawal Requests Queue */}
          {activeTab === 'withdrawal_requests' && (
            <AgentWithdrawalRequestsDesk
              agentProfile={profile}
              onActionCompleted={loadAgentData}
              showToast={showToast}
            />
          )}

          {/* Desk 2: Player Cash-In */}
          {activeTab === 'cash_in' && (
            <AgentCashInDesk
              agentProfile={profile}
              onDepositSuccess={loadAgentData}
              showToast={showToast}
              initialPlayer={prefilledPlayer}
            />
          )}

          {/* Desk 3: Commission Wallet */}
          {(activeTab === 'cash_out' || activeTab === 'commission') && (
            <AgentCommissionDesk
              agentProfile={profile}
              onRefresh={loadAgentData}
              showToast={showToast}
            />
          )}

          {/* Desk 4: Float Recharge */}
          {activeTab === 'recharge' && (
            <AgentRechargeDesk
              onRechargeSubmitted={loadAgentData}
              showToast={showToast}
            />
          )}

          {/* Desk 5: Referred Players Roster */}
          {activeTab === 'players' && (
            <AgentPlayersDesk
              onQuickDeposit={handleQuickDeposit}
              showToast={showToast}
            />
          )}

          {/* Desk 6: Statement Ledger */}
          {activeTab === 'statements' && (
            <AgentStatementDesk
              showToast={showToast}
            />
          )}

          {/* Desk 7: Agency Profile & QR Deep Link */}
          {activeTab === 'profile' && (
            <AgentProfileDesk
              profile={profile}
              showToast={showToast}
              onRefreshProfile={loadAgentData}
              onNavigateTab={setActiveTab}
            />
          )}
        </main>
      </div>
    </div>
  );
};

export default AgentPortalPage;
