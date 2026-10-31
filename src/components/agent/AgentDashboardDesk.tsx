import React, { useState, useEffect } from 'react';
import { AgentDeskTab } from './AgentSidebar.tsx';
import { apiClient } from '../../services/apiClient.ts';

interface AgentDashboardDeskProps {
  profile: any;
  metrics: any;
  onNavigateTab: (tab: AgentDeskTab) => void;
  onRefresh: () => void;
  isLoading: boolean;
  showToast?: (msg: string) => void;
}

export const AgentDashboardDesk: React.FC<AgentDashboardDeskProps> = ({
  profile,
  metrics,
  onNavigateTab,
  onRefresh,
  isLoading,
  showToast
}) => {
  const [copiedLink, setCopiedLink] = useState(false);

  // Real feeds state
  const [realPlayers, setRealPlayers] = useState<any[]>([]);
  const [realTransactions, setRealTransactions] = useState<any[]>([]);
  const [loadingFeeds, setLoadingFeeds] = useState(false);

  // Fetch real database records for players and transactions
  const fetchFeeds = async () => {
    try {
      setLoadingFeeds(true);
      const [pRes, tRes] = await Promise.all([
        apiClient.agent.getPlayers(),
        apiClient.agent.getTransactions()
      ]);
      if (pRes.success && pRes.players) {
        setRealPlayers(pRes.players);
      }
      if (tRes.success && tRes.transactions) {
        setRealTransactions(tRes.transactions);
      }
    } catch (err) {
      console.warn('Dashboard feeds error:', err);
    } finally {
      setLoadingFeeds(false);
    }
  };

  useEffect(() => {
    fetchFeeds();
  }, []);

  // Format relative timestamp helper (e.g. "2h ago", "1d ago")
  const formatRelativeTime = (dateStr: string): string => {
    if (!dateStr) return 'Recently';
    const now = new Date().getTime();
    const past = new Date(dateStr).getTime();
    const diffSec = Math.floor((now - past) / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Real values from database props
  const agentName = profile?.fullName || profile?.agentCode || 'Agent';
  const agentCode = profile?.agentCode || 'AGT-CODE';
  
  const activePlayers = Number(metrics?.activePlayers || 0);
  const totalPlayers = Number(metrics?.totalPlayers || realPlayers.length || 0);
  const targetPlayers = metrics?.targetMonthly ? Math.round(Number(metrics.targetMonthly) / 10) : 5000;
  const monthDeposited = Number(metrics?.monthDeposited || 0);
  const commissionEarned = Number(metrics?.estimatedCommission || 0);
  const targetPercent = Number(metrics?.targetProgress || 0);

  const inviteLink = profile?.inviteLink || `https://t.me/SonicGameOfficialBot?start=agent_${agentCode}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopiedLink(true);
    if (showToast) {
      showToast('📋 Referral link copied to clipboard!');
    }
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        width: '100%',
        boxSizing: 'border-box',
        color: '#0f172a'
      }}
    >
      {/* ===================================================================
          1. WELCOME GREETING & TIER HEADER
          =================================================================== */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        {/* Left: Welcome Greeting */}
        <div>
          <div style={{ fontSize: '15px', color: '#64748b', fontWeight: 500 }}>Welcome back,</div>
          <h1
            style={{
              fontSize: '32px',
              fontWeight: 900,
              color: '#0f172a',
              margin: '2px 0 4px 0',
              letterSpacing: '-0.5px',
              lineHeight: 1.15
            }}
          >
            {agentName}!
          </h1>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0, fontWeight: 500 }}>
            Your performance, rewards and players at a glance.
          </p>
        </div>

        {/* Right: Gold Agent Pill, Date Pill, and Monthly Target */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', minWidth: '280px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Gold Agent Pill */}
            <div
              style={{
                background: '#fef3c7',
                border: '1px solid #fde68a',
                color: '#92400e',
                borderRadius: '9999px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 6px rgba(245, 158, 11, 0.15)'
              }}
            >
              <span>👑</span>
              <span>Gold Agent</span>
            </div>

            {/* Date Pill Selector */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 700,
                color: '#334155',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.03)',
                cursor: 'pointer'
              }}
              onClick={() => {
                onRefresh();
                fetchFeeds();
              }}
              title="Click to refresh live database metrics"
            >
              <i className={`fa-regular fa-calendar ${isLoading || loadingFeeds ? 'fa-spin' : ''}`}></i>
              <span>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              <i className="fa-solid fa-chevron-down" style={{ fontSize: '10px', color: '#94a3b8' }}></i>
            </div>
          </div>

          {/* Monthly Target Progress Widget */}
          <div style={{ width: '100%', maxWidth: '290px', marginTop: '2px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
              <span>Monthly Target: {targetPlayers.toLocaleString()} Players</span>
              <span>{activePlayers.toLocaleString()} / {targetPlayers.toLocaleString()}</span>
            </div>
            <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(100, (activePlayers / targetPlayers) * 100)}%`,
                  height: '100%',
                  background: '#f59e0b',
                  borderRadius: '9999px',
                  transition: 'width 0.4s ease'
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================
          1.5. LIVE FLOAT BALANCE & LIQUIDITY HERO CARD
          =================================================================== */}
      {(() => {
        const walletBalance = Number(profile?.walletBalance ?? profile?.wallet_balance ?? 0);
        const lowThreshold = Number(profile?.lowBalanceThreshold ?? 1000);
        const isLowBalance = walletBalance < lowThreshold;

        return (
          <div
            style={{
              background: isLowBalance
                ? 'linear-gradient(135deg, #fff1f2 0%, #fee2e2 100%)'
                : 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
              border: isLowBalance ? '1.5px solid #f87171' : '1.5px solid #86efac',
              borderRadius: '18px',
              padding: '18px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.03)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '14px',
                  background: isLowBalance ? '#fee2e2' : '#dcfce7',
                  color: isLowBalance ? '#dc2626' : '#16a34a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px'
                }}
              >
                {isLowBalance ? '⚠️' : '💼'}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Available Float Liquidity
                  </span>
                  <span
                    style={{
                      background: isLowBalance ? '#fef2f2' : '#ffffff',
                      color: isLowBalance ? '#b91c1c' : '#15803d',
                      border: isLowBalance ? '1px solid #fca5a5' : '1px solid #bbf7d0',
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      fontSize: '11px',
                      fontWeight: 800
                    }}
                  >
                    {isLowBalance ? '⚠️ Low Float Warning (< 1,000 ETB)' : '🟢 Healthy Liquidity'}
                  </span>
                </div>
                <div style={{ fontSize: '26px', fontWeight: 900, color: isLowBalance ? '#dc2626' : '#0f172a', lineHeight: 1.2 }}>
                  {walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                  Agent Code: <strong style={{ color: '#0f172a' }}>{agentCode}</strong> • Warning Threshold: {lowThreshold.toLocaleString()} ETB
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => onNavigateTab('deposit_requests')}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#0f172a',
                  padding: '10px 16px',
                  borderRadius: '12px',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.04)'
                }}
              >
                <i className="fa-solid fa-inbox" style={{ color: '#f59e0b' }}></i>
                <span>Deposit Requests</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('recharge')}
                style={{
                  background: isLowBalance ? '#dc2626' : '#f59e0b',
                  border: 'none',
                  color: '#ffffff',
                  padding: '10px 18px',
                  borderRadius: '12px',
                  fontSize: '13px',
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: isLowBalance ? '0 4px 12px rgba(220, 38, 38, 0.3)' : '0 4px 12px rgba(245, 158, 11, 0.3)'
                }}
              >
                <i className="fa-solid fa-bolt"></i>
                <span>Recharge Float</span>
              </button>
            </div>
          </div>
        );
      })()}

      {/* ===================================================================
          2. FOUR KEY METRIC CARDS GRID (1 SINGLE ROW OF 4 CARDS)
          =================================================================== */}
      <div className="sonic-dashboard-metric-cards-row">
        {/* Metric 1: Active Players */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '18px',
            padding: '20px 16px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center'
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: '#fef3c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              color: '#d97706',
              marginBottom: '10px'
            }}
          >
            👥
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>
            {activePlayers.toLocaleString()}
          </div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginTop: '4px' }}>
            Active Players
          </div>
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#10b981', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '3px' }}>
            <span>↑</span> +{totalPlayers > 0 ? Math.round((activePlayers / totalPlayers) * 100) : 12}%
          </div>
        </div>

        {/* Metric 2: Total Deposits */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '18px',
            padding: '20px 16px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center'
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: '#fef3c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              color: '#d97706',
              marginBottom: '10px'
            }}
          >
            👝
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>
            {monthDeposited.toLocaleString()} <span style={{ fontSize: '15px', fontWeight: 800 }}>ETB</span>
          </div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginTop: '4px' }}>
            Total Deposits
          </div>
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#10b981', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '3px' }}>
            <span>↑</span> +15%
          </div>
        </div>

        {/* Metric 3: Commission Earned (Clickable shortcut to Commission Desk) */}
        <div
          onClick={() => onNavigateTab('cash_out')}
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '18px',
            padding: '20px 16px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          title="Click to open Commission Wallet Desk"
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: '#fef3c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              color: '#d97706',
              marginBottom: '10px'
            }}
          >
            🪙
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>
            {commissionEarned.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style={{ fontSize: '15px', fontWeight: 800 }}>ETB</span>
          </div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginTop: '4px' }}>
            Commission Earned
          </div>
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#2563eb', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px', background: '#eff6ff', padding: '2px 8px', borderRadius: '9999px' }}>
            <span>Manage Desk</span> <i className="fa-solid fa-arrow-right" style={{ fontSize: '9px' }}></i>
          </div>
        </div>

        {/* Metric 4: Target Progress */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '18px',
            padding: '20px 16px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center'
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: '#fef3c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              color: '#d97706',
              marginBottom: '10px'
            }}
          >
            🎯
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>
            {targetPercent}%
          </div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginTop: '4px' }}>
            Target Progress
          </div>
          <div style={{ width: '80%', height: '6px', background: '#e2e8f0', borderRadius: '9999px', marginTop: '10px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.min(100, targetPercent)}%`,
                height: '100%',
                background: '#f59e0b',
                borderRadius: '9999px'
              }}
            />
          </div>
        </div>
      </div>

      {/* ===================================================================
          3. ACTIVITY DESKS (SIDE-BY-SIDE: 50% / 50%)
          =================================================================== */}
      <div className="sonic-dashboard-activity-row">
        {/* Left Card: My Players */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '18px',
            padding: '22px 24px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.03)'
          }}
        >
          {/* Card Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b', fontSize: '14px' }}>
                <i className="fa-solid fa-users"></i>
              </div>
              <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                My Players ({realPlayers.length})
              </h2>
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab('players')}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '12px',
                fontWeight: 800,
                color: '#475569',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer'
              }}
            >
              <span>View All</span>
              <span>→</span>
            </button>
          </div>

          {/* Real Players List Rows (Slice top 4) */}
          {realPlayers.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
              <i className="fa-solid fa-user-plus" style={{ fontSize: '24px', marginBottom: '8px', display: 'block', color: '#cbd5e1' }}></i>
              No referred players registered yet.
              <div style={{ marginTop: '6px', fontSize: '11px', color: '#64748b' }}>
                Share your agency referral link to onboard your first player!
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {realPlayers.slice(0, 4).map((p, idx) => (
                <div
                  key={p.id || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingBottom: idx !== Math.min(3, realPlayers.length - 1) ? '12px' : '0',
                    borderBottom: idx !== Math.min(3, realPlayers.length - 1) ? '1px solid #f1f5f9' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* Silhouette User Circle */}
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: '#1e293b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        fontSize: '15px'
                      }}
                    >
                      <i className="fa-solid fa-user"></i>
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>{p.fullName || 'Registered Player'}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                        Registered {formatRelativeTime(p.createdAt)}
                      </div>
                    </div>
                  </div>

                  {/* Active / Pending Status Pill */}
                  <span
                    style={{
                      background: p.hasDeposited ? '#ecfdf5' : '#fffbeb',
                      color: p.hasDeposited ? '#059669' : '#b45309',
                      border: p.hasDeposited ? '1px solid #a7f3d0' : '1px solid #fde68a',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: '9999px'
                    }}
                  >
                    {p.hasDeposited ? 'Active' : 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Card: Recent Transactions */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '18px',
            padding: '22px 24px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.03)'
          }}
        >
          {/* Card Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b', fontSize: '14px' }}>
                <i className="fa-solid fa-clock-rotate-left"></i>
              </div>
              <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Recent Transactions ({realTransactions.length})
              </h2>
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab('statements')}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '12px',
                fontWeight: 800,
                color: '#475569',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer'
              }}
            >
              <span>View All</span>
              <span>→</span>
            </button>
          </div>

          {/* Real Transactions List Rows (Slice top 4) */}
          {realTransactions.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
              <i className="fa-solid fa-receipt" style={{ fontSize: '24px', marginBottom: '8px', display: 'block', color: '#cbd5e1' }}></i>
              No recent transaction activity recorded.
              <div style={{ marginTop: '6px', fontSize: '11px', color: '#64748b' }}>
                Credit player wallets or redeem cash-out vouchers to generate records!
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {realTransactions.slice(0, 4).map((tx, idx) => {
                const isCashIn = tx.type === 'cash_in';
                const isCashOut = tx.type === 'cash_out';
                const title = isCashIn
                  ? `Deposit via ${tx.payment_method || 'Telebirr'}`
                  : isCashOut
                  ? 'Withdrawal Payout'
                  : 'Float Recharge';
                const icon = isCashIn ? 'fa-arrow-down' : isCashOut ? 'fa-money-bill-transfer' : 'fa-arrow-rotate-right';
                const iconBg = isCashIn ? '#10b981' : isCashOut ? '#8b5cf6' : '#f59e0b';
                const amountText = isCashIn ? `+${Number(tx.amount).toLocaleString()} ETB` : `-${Number(tx.amount).toLocaleString()} ETB`;
                const amountColor = isCashIn ? '#10b981' : '#0f172a';

                return (
                  <div
                    key={tx.id || idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingBottom: idx !== Math.min(3, realTransactions.length - 1) ? '12px' : '0',
                      borderBottom: idx !== Math.min(3, realTransactions.length - 1) ? '1px solid #f1f5f9' : 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {/* Circular Icon */}
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '50%',
                          background: iconBg,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ffffff',
                          fontSize: '14px'
                        }}
                      >
                        <i className={`fa-solid ${icon}`}></i>
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>{title}</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                          {tx.reference_code || formatRelativeTime(tx.created_at)}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 900, color: amountColor }}>
                        {amountText}
                      </span>
                      <span
                        style={{
                          background: '#ecfdf5',
                          color: '#059669',
                          border: '1px solid #a7f3d0',
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 10px',
                          borderRadius: '9999px'
                        }}
                      >
                        Success
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ===================================================================
          5. BOTTOM REFERRAL CALL-TO-ACTION BANNER
          =================================================================== */}
      <div
        style={{
          background: 'linear-gradient(135deg, #fffdf5 0%, #fef8e7 40%, #fdecb2 80%, #f8d882 100%)',
          border: '1px solid #fcd34d',
          borderRadius: '24px',
          padding: '28px 36px',
          boxShadow: '0 6px 20px rgba(245, 158, 11, 0.12)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '24px',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Left Content */}
        <div style={{ maxWidth: '480px', zIndex: 2 }}>
          <h2
            style={{
              fontSize: '24px',
              fontWeight: 900,
              color: '#0f172a',
              margin: '0 0 6px 0',
              letterSpacing: '-0.3px'
            }}
          >
            Bring More Players, Earn More!
          </h2>
          <p style={{ fontSize: '13px', color: '#78350f', margin: '0 0 18px 0', fontWeight: 600 }}>
            Share your referral link and get 10% of their first deposit.
          </p>

          <button
            type="button"
            onClick={handleCopyLink}
            style={{
              background: 'linear-gradient(135deg, #f59e0b 0%, #eab308 100%)',
              border: 'none',
              borderRadius: '9999px',
              padding: '12px 24px',
              color: '#0f172a',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(245, 158, 11, 0.4)',
              transition: 'transform 0.15s ease'
            }}
          >
            <i className={`fa-solid ${copiedLink ? 'fa-check' : 'fa-link'}`}></i>
            <span>{copiedLink ? 'Link Copied!' : 'Copy Referral Link'}</span>
          </button>
        </div>

        {/* Right Graphic: 3D Royal Crown + Silhouette Players */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            zIndex: 1,
            minWidth: '220px'
          }}
        >
          {/* Subtle Ambient Radial Glow */}
          <div
            style={{
              position: 'absolute',
              width: '180px',
              height: '180px',
              background: 'radial-gradient(circle, rgba(245, 158, 11, 0.35) 0%, rgba(254, 243, 199, 0) 70%)',
              borderRadius: '50%',
              zIndex: 0
            }}
          />

          {/* Graphic Assembly */}
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* 3D Crown */}
            <div
              style={{
                fontSize: '44px',
                lineHeight: 1,
                filter: 'drop-shadow(0 4px 12px rgba(217, 119, 6, 0.5))',
                marginBottom: '-10px',
                zIndex: 3
              }}
            >
              👑
            </div>

            {/* Silhouette Trio */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', position: 'relative' }}>
              {/* Silhouette Left */}
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  background: '#1e293b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#94a3b8',
                  fontSize: '18px'
                }}
              >
                <i className="fa-solid fa-user"></i>
              </div>

              {/* Silhouette Center (Larger) */}
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: '#0f172a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontSize: '22px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
                }}
              >
                <i className="fa-solid fa-user"></i>
              </div>

              {/* Silhouette Right */}
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  background: '#1e293b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#94a3b8',
                  fontSize: '18px'
                }}
              >
                <i className="fa-solid fa-user"></i>
              </div>

              {/* Circular Gold + User Badge */}
              <div
                style={{
                  position: 'absolute',
                  right: '-6px',
                  bottom: '-6px',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: '#f59e0b',
                  border: '2px solid #ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#000000',
                  fontSize: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                }}
              >
                <i className="fa-solid fa-user-plus"></i>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
