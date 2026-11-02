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

  // Cashier Timeframe Analytics State (Live database metrics)
  const [depositAnalytics, setDepositAnalytics] = useState({
    today: { amount: 0, count: 0, commission: 0 },
    week: { amount: 0, count: 0, commission: 0 },
    month: { amount: 0, count: 0, commission: 0 },
    allTime: { amount: 0, count: 0, commission: 0 }
  });
  const [pendingDepositCount, setPendingDepositCount] = useState<number>(0);

  const [withdrawalAnalytics, setWithdrawalAnalytics] = useState({
    today: { amount: 0, count: 0, commission: 0 },
    week: { amount: 0, count: 0, commission: 0 },
    month: { amount: 0, count: 0, commission: 0 },
    allTime: { amount: 0, count: 0, commission: 0 }
  });
  const [pendingWithdrawalCount, setPendingWithdrawalCount] = useState<number>(0);

  // Fetch real database records for players, transactions, deposits & withdrawals
  const fetchFeeds = async () => {
    try {
      setLoadingFeeds(true);
      const [pRes, tRes, depRes, withRes] = await Promise.all([
        apiClient.agent.getPlayers().catch(() => null),
        apiClient.agent.getTransactions().catch(() => null),
        apiClient.agent.getDepositRequests().catch(() => null),
        apiClient.agent.getWithdrawalRequests().catch(() => null)
      ]);
      if (pRes?.success && pRes.players && pRes.players.length > 0) {
        setRealPlayers(pRes.players);
      }
      if (tRes?.success && tRes.transactions && tRes.transactions.length > 0) {
        setRealTransactions(tRes.transactions);
      }
      if (depRes?.success && depRes.analytics) {
        setDepositAnalytics(depRes.analytics);
        if (typeof depRes.pendingCount === 'number') setPendingDepositCount(depRes.pendingCount);
      }
      if (withRes?.success && withRes.analytics) {
        setWithdrawalAnalytics(withRes.analytics);
        if (typeof withRes.pendingCount === 'number') setPendingWithdrawalCount(withRes.pendingCount);
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

  // Format relative timestamp helper
  const formatRelativeTime = (dateStr: string): string => {
    if (!dateStr) return '1d ago';
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
    return '1d ago';
  };

  // Values matching reference UI fallback
  const agentName = profile?.fullName || profile?.agentCode || 'Natan';
  const agentCode = profile?.agentCode || 'AGT-8532';
  
  const rawWalletBalance = profile?.walletBalance ?? profile?.wallet_balance;
  const walletBalance = rawWalletBalance !== undefined && rawWalletBalance !== null ? Number(rawWalletBalance) : 14150.00;
  const lowThreshold = Number(profile?.lowBalanceThreshold ?? 1000);

  const activePlayers = metrics?.activePlayers !== undefined ? Number(metrics.activePlayers) : 2;
  const targetPlayers = 5000;
  const totalDeposits = metrics?.monthDeposited !== undefined ? Number(metrics.monthDeposited) : 750;
  const commissionEarned = metrics?.estimatedCommission !== undefined ? Number(metrics.estimatedCommission) : 32.50;
  const targetPercent = metrics?.targetProgress !== undefined ? Number(metrics.targetProgress) : 2;

  const inviteLink = profile?.inviteLink || `https://t.me/SonicGameOfficialBot?start=agent_${agentCode}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopiedLink(true);
    if (showToast) {
      showToast('📋 Referral link copied to clipboard!');
    }
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Fallback demo players matching reference UI
  const displayPlayers = realPlayers.length > 0 ? realPlayers.slice(0, 4) : [
    { id: '1', fullName: 'Mebi Mety', createdAt: '2026-11-01', hasDeposited: true },
    { id: '2', fullName: 'Eyu Ase', createdAt: '2026-11-01', hasDeposited: true }
  ];

  // Fallback demo transactions matching reference UI
  const displayTransactions = realTransactions.length > 0 ? realTransactions.slice(0, 4) : [
    { id: 't1', type: 'cash_in', amount: 50, payment_method: 'Telebirr', reference_code: 'ID: HD' },
    { id: 't2', type: 'cash_in', amount: 300, payment_method: 'Telebirr', reference_code: 'WWW' },
    { id: 't3', type: 'cash_in', amount: 200, payment_method: 'Telebirr', reference_code: 'BB345' },
    { id: 't4', type: 'cash_in', amount: 100, payment_method: 'Telebirr', reference_code: 'HS45' }
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        width: '100%',
        boxSizing: 'border-box',
        color: '#0f172a'
      }}
    >
      {/* ===================================================================
          1. WELCOME GREETING & TIER HEADER (WITH CROWN WATERMARK)
          =================================================================== */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
          position: 'relative'
        }}
      >
        {/* Left: Welcome Greeting */}
        <div style={{ zIndex: 1 }}>
          <div style={{ fontSize: '15px', color: '#334155', fontWeight: 500 }}>Welcome back,</div>
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

        {/* Center: Crown Watermark */}
        <div
          style={{
            position: 'absolute',
            left: '52%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            zIndex: 0,
            opacity: 0.12
          }}
        >
          <svg width="190" height="90" viewBox="0 0 24 24" fill="#f59e0b">
            <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5m14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" />
          </svg>
        </div>

        {/* Right: Gold Agent Pill, Date Pill, and Monthly Target */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', minWidth: '280px', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Gold Agent Pill */}
            <div
              style={{
                background: '#fef3c7',
                border: '1px solid #fde68a',
                color: '#b45309',
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
                color: '#0f172a',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
                cursor: 'pointer'
              }}
              onClick={() => {
                onRefresh();
                fetchFeeds();
              }}
              title="Click to refresh live database metrics"
            >
              <i className={`fa-regular fa-calendar ${isLoading || loadingFeeds ? 'fa-spin' : ''}`} style={{ color: '#64748b' }}></i>
              <span>Nov 1, 2026</span>
              <i className="fa-solid fa-chevron-down" style={{ fontSize: '9px', color: '#94a3b8' }}></i>
            </div>
          </div>

          {/* Monthly Target Progress Widget */}
          <div style={{ width: '100%', maxWidth: '280px', marginTop: '2px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
              <span>Monthly Target: {targetPlayers.toLocaleString()} Players</span>
              <span style={{ fontWeight: 800, color: '#0f172a' }}>{activePlayers} / {targetPlayers.toLocaleString()}</span>
            </div>
            <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden' }}>
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
          2. HERO AVAILABLE FLOAT LIQUIDITY CARD (EXACT CLONE)
          =================================================================== */}
      <div
        style={{
          background: '#fffdfa',
          border: '1.5px solid #fef3c7',
          borderRadius: '18px',
          padding: '20px 26px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          boxShadow: '0 4px 16px rgba(245, 158, 11, 0.06)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Circular 3D Gold Wallet Icon Halo */}
          <div
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              background: '#fef3c7',
              border: '2px solid #fde68a',
              color: '#d97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.15)'
            }}
          >
            👝
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                AVAILABLE FLOAT LIQUIDITY
              </span>
              <span
                style={{
                  background: '#dcfce7',
                  color: '#16a34a',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  fontSize: '11px',
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span>🟢</span> Healthy
              </span>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 900, color: '#0f172a', lineHeight: 1.2, margin: '2px 0' }}>
              {walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
            </div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              Agent Code: <strong style={{ color: '#0f172a' }}>{agentCode}</strong> • Warning Threshold: {lowThreshold.toLocaleString()} ETB
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => onNavigateTab('deposit_requests')}
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#0f172a',
              padding: '9px 16px',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
            }}
          >
            <span>📥</span>
            <span>Deposit Desk</span>
            {pendingDepositCount > 0 && (
              <span
                style={{
                  background: '#ef4444',
                  color: '#ffffff',
                  borderRadius: '9999px',
                  padding: '1px 6px',
                  fontSize: '10px',
                  fontWeight: 900
                }}
              >
                {pendingDepositCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('withdrawal_requests')}
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#0f172a',
              padding: '9px 16px',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
            }}
          >
            <span>📤</span>
            <span>Withdrawal Desk</span>
            {pendingWithdrawalCount > 0 && (
              <span
                style={{
                  background: '#ef4444',
                  color: '#ffffff',
                  borderRadius: '9999px',
                  padding: '1px 6px',
                  fontSize: '10px',
                  fontWeight: 900
                }}
              >
                {pendingWithdrawalCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('recharge')}
            style={{
              background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
              border: 'none',
              color: '#000000',
              padding: '9px 18px',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.35)'
            }}
          >
            <i className="fa-solid fa-bolt"></i>
            <span>Recharge Float</span>
          </button>
        </div>
      </div>

      {/* ===================================================================
          3. FOUR KEY METRIC CARDS ROW (ICON ON LEFT, WATERMARK ON RIGHT)
          =================================================================== */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: '16px'
        }}
      >
        {/* Card 1: Active Players */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '18px 20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* Icon Halo */}
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: '#fef3c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              flexShrink: 0
            }}
          >
            👥
          </div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>
              {activePlayers.toLocaleString()}
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', marginTop: '2px' }}>
              Active Players
            </div>
            <div style={{ fontSize: '12px', fontWeight: 800, color: '#16a34a', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span>↑</span> +100%
            </div>
          </div>

          {/* Faint Graph Watermark */}
          <div style={{ position: 'absolute', right: '10px', bottom: '6px', opacity: 0.15, pointerEvents: 'none' }}>
            <svg width="60" height="40" viewBox="0 0 60 40" fill="#f59e0b">
              <rect x="5" y="24" width="8" height="16" rx="2" />
              <rect x="18" y="18" width="8" height="22" rx="2" />
              <rect x="31" y="10" width="8" height="30" rx="2" />
              <rect x="44" y="4" width="8" height="36" rx="2" />
            </svg>
          </div>
        </div>

        {/* Card 2: Total Deposits */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '18px 20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* Icon Halo */}
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: '#fef3c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              flexShrink: 0
            }}
          >
            🪙
          </div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>
              {totalDeposits.toLocaleString()} <span style={{ fontSize: '16px', fontWeight: 700 }}>ETB</span>
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', marginTop: '2px' }}>
              Total Deposits
            </div>
            <div style={{ fontSize: '12px', fontWeight: 800, color: '#16a34a', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span>↑</span> +15%
            </div>
          </div>

          {/* Faint Graph Watermark */}
          <div style={{ position: 'absolute', right: '10px', bottom: '6px', opacity: 0.15, pointerEvents: 'none' }}>
            <svg width="60" height="40" viewBox="0 0 60 40" fill="#f59e0b">
              <rect x="5" y="20" width="8" height="20" rx="2" />
              <rect x="18" y="14" width="8" height="26" rx="2" />
              <rect x="31" y="8" width="8" height="32" rx="2" />
              <rect x="44" y="2" width="8" height="38" rx="2" />
            </svg>
          </div>
        </div>

        {/* Card 3: Commission Earned */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '18px 20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* Icon Halo */}
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: '#fef3c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              flexShrink: 0
            }}
          >
            👝
          </div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>
              {commissionEarned.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style={{ fontSize: '16px', fontWeight: 700 }}>ETB</span>
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', marginTop: '2px' }}>
              Commission Earned
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('cash_out')}
              style={{
                marginTop: '4px',
                background: '#fef3c7',
                border: 'none',
                color: '#b45309',
                padding: '3px 10px',
                borderRadius: '9999px',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <span>Manage Desk</span>
              <span>→</span>
            </button>
          </div>

          {/* Faint Graph Watermark */}
          <div style={{ position: 'absolute', right: '10px', bottom: '6px', opacity: 0.15, pointerEvents: 'none' }}>
            <svg width="60" height="40" viewBox="0 0 60 40" fill="#f59e0b">
              <rect x="5" y="26" width="8" height="14" rx="2" />
              <rect x="18" y="20" width="8" height="20" rx="2" />
              <rect x="31" y="12" width="8" height="28" rx="2" />
              <rect x="44" y="6" width="8" height="34" rx="2" />
            </svg>
          </div>
        </div>

        {/* Card 4: Target Progress */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '18px 20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* Icon Halo */}
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: '#fef3c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              flexShrink: 0
            }}
          >
            🎯
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>
              {targetPercent}%
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', marginTop: '2px' }}>
              Target Progress
            </div>
            <div style={{ width: '100%', height: '6px', background: '#f1f5f9', borderRadius: '9999px', marginTop: '6px', overflow: 'hidden' }}>
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

          {/* Faint Graph Watermark */}
          <div style={{ position: 'absolute', right: '10px', bottom: '6px', opacity: 0.15, pointerEvents: 'none' }}>
            <svg width="60" height="40" viewBox="0 0 60 40" fill="#f59e0b">
              <rect x="5" y="24" width="8" height="16" rx="2" />
              <rect x="18" y="16" width="8" height="24" rx="2" />
              <rect x="31" y="10" width="8" height="30" rx="2" />
              <rect x="44" y="4" width="8" height="36" rx="2" />
            </svg>
          </div>
        </div>
      </div>

      {/* ===================================================================
          4. CASHIER DESKS & TIMEFRAME PERFORMANCE HUB (100% CLONE)
          =================================================================== */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
        {/* Full-Width Dark Obsidian Header */}
        <div
          style={{
            background: '#0f172a',
            borderRadius: '14px',
            padding: '14px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '18px' }}>📊</span>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#ffffff' }}>
                Cashier Desks & Timeframe Performance Hub
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '1px' }}>
                Authoritative Neon DB metrics across Today, This Week, and This Month with 1-click desk access.
              </div>
            </div>
          </div>

          {/* Timeframe Dropdown Selector */}
          <div
            style={{
              background: '#1e293b',
              color: '#ffffff',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <span>Last 30 Days</span>
            <i className="fa-solid fa-chevron-down" style={{ fontSize: '9px', color: '#94a3b8' }}></i>
          </div>
        </div>

        {/* Two Rich Interactive Cashier Multi-Rail Desks */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '16px'
          }}
        >
          {/* Desk 1: Deposit Cashier Desk */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '16px'
            }}
          >
            <div>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>📥</span>
                    <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      Deposit Cashier Desk
                    </h3>
                  </div>
                  <div style={{ fontSize: '12px', color: '#16a34a', fontWeight: 700, marginTop: '3px' }}>
                    ↑ {(profile?.commissionRate || 5.0).toFixed(2)}% Instant Cashier Commission
                  </div>
                </div>

                <span
                  style={{
                    background: '#dcfce7',
                    color: '#16a34a',
                    borderRadius: '9999px',
                    padding: '3px 10px',
                    fontSize: '11px',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {pendingDepositCount > 0 ? `⚡ ${pendingDepositCount} Pending` : '✓ All Settled'}
                </span>
              </div>

              {/* 3 Columns: TODAY, THIS WEEK, THIS MONTH (100% Real Live DB Data) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                <div style={{ background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: '10px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: '#dc2626', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>v</span> TODAY
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a', marginTop: '3px' }}>
                    {depositAnalytics.today.amount.toLocaleString()} <span style={{ fontSize: '11px', fontWeight: 700 }}>ETB</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700, marginTop: '2px' }}>
                    +{depositAnalytics.today.commission.toFixed(1)} ETB ({depositAnalytics.today.count})
                  </div>
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: '10px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>★</span> THIS WEEK
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a', marginTop: '3px' }}>
                    {depositAnalytics.week.amount.toLocaleString()} <span style={{ fontSize: '11px', fontWeight: 700 }}>ETB</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700, marginTop: '2px' }}>
                    +{depositAnalytics.week.commission.toFixed(1)} ETB ({depositAnalytics.week.count})
                  </div>
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: '10px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>★</span> THIS MONTH
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a', marginTop: '3px' }}>
                    {depositAnalytics.month.amount.toLocaleString()} <span style={{ fontSize: '11px', fontWeight: 700 }}>ETB</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700, marginTop: '2px' }}>
                    +{depositAnalytics.month.commission.toFixed(1)} ETB ({depositAnalytics.month.count})
                  </div>
                </div>
              </div>
            </div>

            {/* Jump Button */}
            <button
              type="button"
              onClick={() => onNavigateTab('deposit_requests')}
              style={{
                width: '100%',
                background: '#fef3c7',
                border: 'none',
                color: '#92400e',
                borderRadius: '10px',
                padding: '11px',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.15s ease'
              }}
            >
              <span>📥</span>
              <span>Open Deposit Desk & Settled History (Phase 5) →</span>
            </button>
          </div>

          {/* Desk 2: Withdrawal Cashier Desk */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '16px'
            }}
          >
            <div>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>📤</span>
                    <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      Withdrawal Cashier Desk
                    </h3>
                  </div>
                  <div style={{ fontSize: '12px', color: '#7c3aed', fontWeight: 700, marginTop: '3px' }}>
                    + 2.00% Instant Cashout Incentive Fee
                  </div>
                </div>

                <span
                  style={{
                    background: '#dcfce7',
                    color: '#16a34a',
                    borderRadius: '9999px',
                    padding: '3px 10px',
                    fontSize: '11px',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {pendingWithdrawalCount > 0 ? `⚡ ${pendingWithdrawalCount} Pending` : '✓ All Paid Out'}
                </span>
              </div>

              {/* 3 Columns (100% Real Live DB Data) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                <div style={{ background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: '10px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: '#7c3aed', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>v</span> TODAY
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a', marginTop: '3px' }}>
                    {withdrawalAnalytics.today.amount.toLocaleString()} <span style={{ fontSize: '11px', fontWeight: 700 }}>ETB</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 700, marginTop: '2px' }}>
                    +{withdrawalAnalytics.today.commission.toFixed(1)} ETB ({withdrawalAnalytics.today.count})
                  </div>
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: '10px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>★</span> THIS WEEK
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a', marginTop: '3px' }}>
                    {withdrawalAnalytics.week.amount.toLocaleString()} <span style={{ fontSize: '11px', fontWeight: 700 }}>ETB</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 700, marginTop: '2px' }}>
                    +{withdrawalAnalytics.week.commission.toFixed(1)} ETB ({withdrawalAnalytics.week.count})
                  </div>
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: '10px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>★</span> THIS MONTH
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a', marginTop: '3px' }}>
                    {withdrawalAnalytics.month.amount.toLocaleString()} <span style={{ fontSize: '11px', fontWeight: 700 }}>ETB</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 700, marginTop: '2px' }}>
                    +{withdrawalAnalytics.month.commission.toFixed(1)} ETB ({withdrawalAnalytics.month.count})
                  </div>
                </div>
              </div>
            </div>

            {/* Jump Button */}
            <button
              type="button"
              onClick={() => onNavigateTab('withdrawal_requests')}
              style={{
                width: '100%',
                background: '#f5f3ff',
                border: 'none',
                color: '#6d28d9',
                borderRadius: '10px',
                padding: '11px',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.15s ease'
              }}
            >
              <span>📤</span>
              <span>Open Withdrawal Desk & Settled History (Phase 6) →</span>
            </button>
          </div>
        </div>
      </div>

      {/* ===================================================================
          5. TWO-COLUMN FEEDS: MY PLAYERS & RECENT TRANSACTIONS
          =================================================================== */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '16px'
        }}
      >
        {/* Left Column: My Players */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
          }}
        >
          {/* Card Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>👥</span>
              <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                My Players ({displayPlayers.length})
              </h2>
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab('players')}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '12px',
                fontWeight: 700,
                color: '#64748b',
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

          {/* Players Rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {displayPlayers.map((p, idx) => (
              <div
                key={p.id || idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBottom: idx !== displayPlayers.length - 1 ? '10px' : '0',
                  borderBottom: idx !== displayPlayers.length - 1 ? '1px solid #f1f5f9' : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {/* Silhouette User Circle */}
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      background: '#1e293b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      fontSize: '14px'
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

                {/* Active Pill */}
                <span
                  style={{
                    background: '#dcfce7',
                    color: '#16a34a',
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '3px 10px',
                    borderRadius: '9999px'
                  }}
                >
                  Active
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Recent Transactions */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
          }}
        >
          {/* Card Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>📄</span>
              <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Recent Transactions ({displayTransactions.length})
              </h2>
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab('statements')}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '12px',
                fontWeight: 700,
                color: '#64748b',
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

          {/* Transactions Rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {displayTransactions.map((tx, idx) => (
              <div
                key={tx.id || idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBottom: idx !== displayTransactions.length - 1 ? '10px' : '0',
                  borderBottom: idx !== displayTransactions.length - 1 ? '1px solid #f1f5f9' : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {/* Green Down-Arrow Circle */}
                  <div
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '50%',
                      background: '#10b981',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      fontSize: '14px',
                      fontWeight: 800
                    }}
                  >
                    ↓
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                      Deposit via {tx.payment_method || 'Telebirr'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>
                      {tx.reference_code || 'ID: HD'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 900, color: '#16a34a' }}>
                    +{tx.amount} ETB
                  </span>
                  <span
                    style={{
                      background: '#dcfce7',
                      color: '#16a34a',
                      fontSize: '11px',
                      fontWeight: 800,
                      padding: '3px 10px',
                      borderRadius: '9999px'
                    }}
                  >
                    Success
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===================================================================
          6. BOTTOM REFERRAL CALL-TO-ACTION BANNER (100% CLONE)
          =================================================================== */}
      <div
        style={{
          background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 40%, #fde68a 85%, #f59e0b 100%)',
          border: '1px solid #fde68a',
          borderRadius: '20px',
          padding: '24px 32px',
          boxShadow: '0 4px 16px rgba(245, 158, 11, 0.12)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '20px',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', zIndex: 2 }}>
          {/* 3D Gift Box */}
          <div
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '14px',
              background: '#fef3c7',
              border: '2px solid #fde68a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              flexShrink: 0,
              boxShadow: '0 4px 10px rgba(245, 158, 11, 0.2)'
            }}
          >
            🎁
          </div>

          <div>
            <h2
              style={{
                fontSize: '20px',
                fontWeight: 900,
                color: '#0f172a',
                margin: '0 0 4px 0',
                letterSpacing: '-0.3px'
              }}
            >
              Bring More Players, Earn More!
            </h2>
            <p style={{ fontSize: '13px', color: '#475569', margin: 0, fontWeight: 600 }}>
              Share your referral link and get 10% of their first deposit.
            </p>
          </div>

          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopyLink}
            style={{
              background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
              border: 'none',
              borderRadius: '9999px',
              padding: '10px 22px',
              color: '#000000',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.35)',
              marginLeft: '8px'
            }}
          >
            <span>🔗</span>
            <span>{copiedLink ? 'Link Copied!' : 'Copy Referral Link'}</span>
          </button>
        </div>

        {/* Right Graphic: Crowned Player Silhouettes & Golden Swirl */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            position: 'relative',
            zIndex: 1,
            marginRight: '-10px'
          }}
        >
          {/* Luminous Golden Crown above Silhouettes */}
          <div
            style={{
              position: 'absolute',
              top: '-18px',
              left: '40px',
              fontSize: '26px',
              filter: 'drop-shadow(0 2px 6px rgba(245, 158, 11, 0.5))'
            }}
          >
            👑
          </div>

          {/* Three Player Avatar Silhouettes */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontSize: '14px'
              }}
            >
              <i className="fa-solid fa-user"></i>
            </div>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                background: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontSize: '18px',
                border: '2px solid #fbbf24'
              }}
            >
              <i className="fa-solid fa-user"></i>
            </div>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontSize: '14px'
              }}
            >
              <i className="fa-solid fa-user"></i>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
