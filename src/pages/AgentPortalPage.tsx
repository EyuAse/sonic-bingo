import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { apiClient } from '../services/apiClient.ts';

// Luxury Sonic Theme & Component Suite
import '../styles/agent.css';
import { AgentSidebar, AgentDeskTab } from '../components/agent/AgentSidebar.tsx';
import { AgentHeader } from '../components/agent/AgentHeader.tsx';
import { AgentDashboardDesk } from '../components/agent/AgentDashboardDesk.tsx';
import { AgentCashInDesk } from '../components/agent/AgentCashInDesk.tsx';
import { AgentCashOutDesk } from '../components/agent/AgentCashOutDesk.tsx';
import { AgentRechargeDesk } from '../components/agent/AgentRechargeDesk.tsx';
import { AgentPlayersDesk } from '../components/agent/AgentPlayersDesk.tsx';
import { AgentStatementDesk } from '../components/agent/AgentStatementDesk.tsx';
import { AgentProfileDesk } from '../components/agent/AgentProfileDesk.tsx';

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

  // Navigation & Layout State
  const [activeTab, setActiveTab] = useState<AgentDeskTab>('overview');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

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
      const [profileRes, perfRes] = await Promise.all([
        apiClient.agent.getProfile(),
        apiClient.agent.getPerformance()
      ]);

      if (profileRes.success && profileRes.profile) {
        setProfile(profileRes.profile as any);
        setIsAgentLoggedIn(true);
      }
      if (perfRes.success && perfRes.metrics) {
        setMetrics(perfRes.metrics);
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
    setIsAgentLoggedIn(false);
    setProfile(null);
    setMetrics(null);
    showToast('🚪 Logged out of Sonic Agent Terminal');
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
    <div className="sonic-agent-layout-wrapper">
      {/* A. Collapsible Responsive Sidebar */}
      <AgentSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        isMobileOpen={isMobileOpen}
        closeMobile={() => setIsMobileOpen(false)}
        agentProfile={profile}
        onLogout={handleLogout}
      />

      {/* B. Main Viewport */}
      <div className={`sonic-agent-main-viewport ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
        {/* Sticky Header */}
        <AgentHeader
          activeTab={activeTab}
          agentProfile={profile}
          openMobile={() => setIsMobileOpen(true)}
          onPlayBingo={() => switchPage('games')}
          onLogout={handleLogout}
        />

        {/* Page Content Container */}
        <main className="sonic-agent-page-content">
          {/* Desk 1: Overview & Float */}
          {activeTab === 'overview' && (
            <AgentDashboardDesk
              profile={profile}
              metrics={metrics}
              onNavigateTab={setActiveTab}
              onRefresh={loadAgentData}
              isLoading={loading}
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

          {/* Desk 3: Cash-Out Voucher Counter */}
          {activeTab === 'cash_out' && (
            <AgentCashOutDesk
              onPayoutSuccess={loadAgentData}
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
            />
          )}
        </main>
      </div>
    </div>
  );
};

export default AgentPortalPage;
