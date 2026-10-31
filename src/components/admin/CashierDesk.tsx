import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { apiClient } from '../../services/apiClient.ts';
import { TelebirrLogo, CBELogo, MpesaLogo } from '../wallet/PaymentLogos.tsx';
import { socketService } from '../../services/socketService.ts';

interface CashierAuditItem {
  id: string;
  type: 'deposit' | 'withdrawal';
  amount: number;
  paymentMethod: 'Telebirr' | 'CBE' | 'M-Pesa' | string;
  playerPhone: string;
  referenceNumber: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  rejectionReason?: string | null;
  receiptImage?: string | null;
  agentCommission: number;
  createdAt: string;
  resolvedAt?: string | null;
  userId: string;
  userName: string;
  userPhone: string;
  agentId?: string | null;
  agentCode?: string | null;
  agentName?: string | null;
  agentTelebirr?: string | null;
  agentCbe?: string | null;
}

interface CashierStats {
  todayDepositsAmount: number;
  todayDepositsCount: number;
  todayDepositsCommission: number;
  todayWithdrawalsAmount: number;
  todayWithdrawalsCount: number;
  todayWithdrawalsFee: number;
  agentFloatCirculation: number;
  totalCommissionDistributed: number;
}

export const CashierDesk: React.FC = () => {
  const { showToast } = useApp();

  // Filters State
  const [timeframe, setTimeframe] = useState<'today' | 'week' | 'month' | 'all'>('today');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending' | 'rejected'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'deposit' | 'withdrawal'>('all');
  const [railFilter, setRailFilter] = useState<'all' | 'Telebirr' | 'CBE' | 'M-Pesa'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Data & Loading State
  const [transactions, setTransactions] = useState<CashierAuditItem[]>([]);
  const [stats, setStats] = useState<CashierStats>({
    todayDepositsAmount: 0,
    todayDepositsCount: 0,
    todayDepositsCommission: 0,
    todayWithdrawalsAmount: 0,
    todayWithdrawalsCount: 0,
    todayWithdrawalsFee: 0,
    agentFloatCirculation: 0,
    totalCommissionDistributed: 0
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Lightbox Modal for Full Slip Inspection
  const [inspectTx, setInspectTx] = useState<CashierAuditItem | null>(null);

  // Fetch Authoritative Cashier Ledger from Neon DB
  const fetchLedger = useCallback(async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setIsRefreshing(true);
      else setLoading(true);

      const res = await apiClient.admin.getCashierLedger({
        timeframe,
        rail: railFilter !== 'all' ? railFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        type: typeFilter !== 'all' ? typeFilter : undefined,
        search: searchQuery.trim() || undefined
      });

      if (res.success) {
        setTransactions(res.transactions || []);
        if (res.stats) {
          setStats(res.stats);
        }
      }
    } catch (err) {
      console.error('Failed to fetch cashier ledger:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [timeframe, railFilter, statusFilter, typeFilter, searchQuery]);

  // Initial Load & Filter Change
  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  // Real-time WebSocket Listeners
  useEffect(() => {
    const unsubUpdate = socketService.on('agent_request_updated', () => {
      fetchLedger();
    });
    const unsubBalance = socketService.on('user_balance_updated', () => {
      fetchLedger();
    });

    return () => {
      unsubUpdate();
      unsubBalance();
    };
  }, [fetchLedger]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`📋 Copied ${label}: ${text}`);
  };

  // Status Counts
  const pendingCount = transactions.filter(t => t.status === 'pending').length;
  const settledCount = transactions.filter(t => t.status === 'approved').length;
  const rejectedCount = transactions.filter(t => t.status === 'rejected' || t.status === 'cancelled').length;

  return (
    <div className="fresh-cashier-desk-container">
      {/* 1. Hero Desk Banner: P2P Cashier Surveillance */}
      <div className="cashier-hero-desk-banner">
        <div className="hero-banner-left">
          <div className="hero-bank-icon-box" style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', border: '1px solid rgba(234, 179, 8, 0.4)' }}>
            <span style={{ fontSize: '28px', lineHeight: 1 }}>🛡️</span>
          </div>
          <div className="hero-banner-titles">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h3 className="hero-main-title" style={{ margin: 0 }}>P2P CASHIER SURVEILLANCE & NETWORK AUDIT</h3>
              <span style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', color: '#10b981', fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '12px' }}>
                🟢 100% P2P Agent Model
              </span>
            </div>
            <p className="hero-sub-title" style={{ marginTop: '4px' }}>
              Real-time multi-rail P2P settlement surveillance, cashier commission distribution, and agent float solvency tracking.
            </p>
          </div>
        </div>

        <div className="hero-banner-right" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => fetchLedger(true)}
            disabled={isRefreshing}
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              padding: '8px 14px',
              fontSize: '12px',
              fontWeight: 700,
              color: '#334155',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}
          >
            <i className={`fa-solid fa-arrows-rotate ${isRefreshing ? 'fa-spin' : ''}`}></i>
            <span>{isRefreshing ? 'Syncing...' : 'Sync Live Stream'}</span>
          </button>
        </div>
      </div>

      {/* 2. Top Authoritative KPI Ribbon */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '12px',
          marginBottom: '18px'
        }}
      >
        {/* KPI 1: Today's P2P Deposits */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'rgba(16, 185, 129, 0.12)',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px'
            }}
          >
            💳
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Today's P2P Deposits
            </div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a' }}>
              {stats.todayDepositsAmount.toFixed(2)} <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 700 }}>ETB</span>
            </div>
            <div style={{ fontSize: '11px', color: '#059669', fontWeight: 700, marginTop: '2px' }}>
              {stats.todayDepositsCount} txns · +5% ({stats.todayDepositsCommission.toFixed(2)} ETB) Comm
            </div>
          </div>
        </div>

        {/* KPI 2: Today's P2P Payouts */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'rgba(59, 130, 246, 0.12)',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px'
            }}
          >
            💸
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Today's P2P Payouts
            </div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a' }}>
              {stats.todayWithdrawalsAmount.toFixed(2)} <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 700 }}>ETB</span>
            </div>
            <div style={{ fontSize: '11px', color: '#2563eb', fontWeight: 700, marginTop: '2px' }}>
              {stats.todayWithdrawalsCount} txns · +2% ({stats.todayWithdrawalsFee.toFixed(2)} ETB) Fee
            </div>
          </div>
        </div>

        {/* KPI 3: Agent Float in Circulation */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'rgba(234, 179, 8, 0.12)',
              color: '#b45309',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px'
            }}
          >
            💼
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Agent Float In Circulation
            </div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a' }}>
              {stats.agentFloatCirculation.toFixed(2)} <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 700 }}>ETB</span>
            </div>
            <div style={{ fontSize: '11px', color: '#b45309', fontWeight: 700, marginTop: '2px' }}>
              Active Cashier Working Liquidity
            </div>
          </div>
        </div>

        {/* KPI 4: Total Commission Distributed */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'rgba(168, 85, 247, 0.12)',
              color: '#7e22ce',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px'
            }}
          >
            🪙
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Agent Commissions Paid
            </div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a' }}>
              {stats.totalCommissionDistributed.toFixed(2)} <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 700 }}>ETB</span>
            </div>
            <div style={{ fontSize: '11px', color: '#7e22ce', fontWeight: 700, marginTop: '2px' }}>
              All-Time Distributed Network Rewards
            </div>
          </div>
        </div>
      </div>

      {/* 3. Multi-Dimensional Filter & Search Bar */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '14px',
          padding: '14px',
          marginBottom: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
      >
        {/* Row A: Status & Timeframe Pills */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          {/* Status Filter */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`btn-cashier-filter-pill ${statusFilter === 'all' ? 'active-yellow' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              <span>All Status ({transactions.length})</span>
            </button>
            <button
              type="button"
              className={`btn-cashier-filter-pill ${statusFilter === 'approved' ? 'active-yellow' : ''}`}
              onClick={() => setStatusFilter('approved')}
            >
              <i className="fa-solid fa-check green-check"></i>
              <span>Settled ({settledCount})</span>
            </button>
            <button
              type="button"
              className={`btn-cashier-filter-pill ${statusFilter === 'pending' ? 'active-yellow' : ''}`}
              onClick={() => setStatusFilter('pending')}
            >
              <span className="dot-green"></span>
              <span>Pending Agent Action ({pendingCount})</span>
            </button>
            <button
              type="button"
              className={`btn-cashier-filter-pill ${statusFilter === 'rejected' ? 'active-yellow' : ''}`}
              onClick={() => setStatusFilter('rejected')}
            >
              <i className="fa-solid fa-xmark red-x"></i>
              <span>Rejected ({rejectedCount})</span>
            </button>
          </div>

          {/* Timeframe Filter */}
          <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '10px' }}>
            {(['today', 'week', 'month', 'all'] as const).map(tf => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeframe(tf)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '11px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  background: timeframe === tf ? '#ffffff' : 'transparent',
                  color: timeframe === tf ? '#0f172a' : '#64748b',
                  boxShadow: timeframe === tf ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  textTransform: 'capitalize'
                }}
              >
                {tf === 'all' ? 'All Time' : tf === 'week' ? 'This Week' : tf === 'month' ? 'This Month' : 'Today'}
              </button>
            ))}
          </div>
        </div>

        {/* Row B: Method Chips, Type Filter & Search Box */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
          {/* Order Type Chips */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              className={`btn-method-chip ${typeFilter === 'all' ? 'selected' : ''}`}
              onClick={() => setTypeFilter('all')}
            >
              <span>All Types</span>
            </button>
            <button
              type="button"
              className={`btn-method-chip ${typeFilter === 'deposit' ? 'selected' : ''}`}
              onClick={() => setTypeFilter(typeFilter === 'deposit' ? 'all' : 'deposit')}
            >
              <i className="fa-solid fa-arrow-down-long" style={{ color: '#10b981' }}></i>
              <span>Deposits (+5%)</span>
            </button>
            <button
              type="button"
              className={`btn-method-chip ${typeFilter === 'withdrawal' ? 'selected' : ''}`}
              onClick={() => setTypeFilter(typeFilter === 'withdrawal' ? 'all' : 'withdrawal')}
            >
              <i className="fa-solid fa-arrow-up-long" style={{ color: '#2563eb' }}></i>
              <span>Withdrawals (+2%)</span>
            </button>
          </div>

          {/* Rail Filter Chips */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              className={`btn-method-chip ${railFilter === 'all' ? 'selected' : ''}`}
              onClick={() => setRailFilter('all')}
            >
              <span>All Rails</span>
            </button>
            <button
              type="button"
              className={`btn-method-chip ${railFilter === 'Telebirr' ? 'selected' : ''}`}
              onClick={() => setRailFilter(railFilter === 'Telebirr' ? 'all' : 'Telebirr')}
            >
              <TelebirrLogo size={14} />
              <span>Telebirr</span>
            </button>
            <button
              type="button"
              className={`btn-method-chip ${railFilter === 'CBE' ? 'selected' : ''}`}
              onClick={() => setRailFilter(railFilter === 'CBE' ? 'all' : 'CBE')}
            >
              <CBELogo size={14} />
              <span>CBE</span>
            </button>
            <button
              type="button"
              className={`btn-method-chip ${railFilter === 'M-Pesa' ? 'selected' : ''}`}
              onClick={() => setRailFilter(railFilter === 'M-Pesa' ? 'all' : 'M-Pesa')}
            >
              <MpesaLogo size={14} />
              <span>M-Pesa</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="cashier-search-box-wrap" style={{ minWidth: '260px' }}>
            <i className="fa-solid fa-magnifying-glass search-icon"></i>
            <input
              type="text"
              placeholder="Search reference, player, or agent code..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="cashier-search-input-field"
            />
          </div>
        </div>
      </div>

      {/* 4. Surveillance Ledger Cards Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '28px', color: '#f59e0b', marginBottom: '10px' }}></i>
          <p style={{ margin: 0, fontWeight: 700, color: '#64748b' }}>Streaming live P2P cashier network ledger from Neon PostgreSQL...</p>
        </div>
      ) : transactions.length === 0 ? (
        <div className="cashier-empty-queue-card">
          <div className="empty-lemon-icon">🛡️</div>
          <h4>No Transactions in Selected Filter</h4>
          <p>No P2P cashier records found matching the active timeframe and filter criteria.</p>
        </div>
      ) : (
        <div className="cashier-cards-three-grid">
          {transactions.map(tx => {
            const isDeposit = tx.type === 'deposit';
            const isPending = tx.status === 'pending';
            const isApproved = tx.status === 'approved';
            const isRejected = tx.status === 'rejected' || tx.status === 'cancelled';
            const formattedTime = new Date(tx.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });

            return (
              <div key={tx.id} className="cashier-tx-white-card" style={{ border: isPending ? '2px solid rgba(59, 130, 246, 0.5)' : '1px solid #e2e8f0' }}>
                {/* Header Row */}
                <div className="tx-card-header-row">
                  <div className="tx-provider-brand" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {tx.paymentMethod === 'Telebirr' ? (
                      <TelebirrLogo size={18} />
                    ) : tx.paymentMethod === 'CBE' ? (
                      <CBELogo size={18} />
                    ) : (
                      <MpesaLogo size={18} />
                    )}
                    <span className="tx-provider-name" style={{ fontWeight: 800, fontSize: '13px' }}>
                      {tx.paymentMethod === 'CBE' ? 'CBE Bank' : tx.paymentMethod}
                    </span>
                  </div>

                  <div className="tx-type-center-badge">
                    <i className={`fa-solid ${isDeposit ? 'fa-arrow-down-long deposit-blue' : 'fa-arrow-up-long withdraw-red'}`}></i>
                    <strong className="tx-type-text">{isDeposit ? 'DEPOSIT' : 'WITHDRAWAL'}</strong>
                  </div>

                  <span className={`tx-status-pill-top ${isPending ? 'pending' : isApproved ? 'approved' : 'rejected'}`}>
                    {isPending ? 'PENDING AGENT' : isApproved ? 'SETTLED' : isRejected ? 'REJECTED' : tx.status.toUpperCase()}
                  </span>
                </div>

                {/* Key-Value Details */}
                <div className="tx-card-details-list">
                  {/* SMS Reference ID */}
                  <div className="tx-detail-row">
                    <span className="tx-detail-label">SMS Tx Ref:</span>
                    <button
                      type="button"
                      className="tx-detail-val-btn purple"
                      onClick={() => handleCopy(tx.referenceNumber, 'SMS Reference')}
                      title="Click to copy Transaction ID"
                    >
                      <span>{tx.referenceNumber}</span>
                      <i className="fa-regular fa-copy copy-icon"></i>
                    </button>
                  </div>

                  {/* Player Info */}
                  <div className="tx-detail-row">
                    <span className="tx-detail-label">Player:</span>
                    <strong className="tx-detail-val-dark">
                      {tx.userName} ({tx.playerPhone || tx.userPhone})
                    </strong>
                  </div>

                  {/* Assigned Certified Agent */}
                  <div className="tx-detail-row">
                    <span className="tx-detail-label">Assigned Agent:</span>
                    <span style={{ fontWeight: 800, color: '#b45309', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      👑 {tx.agentName || 'Certified Agent'} (#{tx.agentCode || 'DIRECT'})
                    </span>
                  </div>

                  {/* Request Time */}
                  <div className="tx-detail-row">
                    <span className="tx-detail-label">Created Time:</span>
                    <span className="tx-detail-val-muted">{formattedTime}</span>
                  </div>
                </div>

                {/* SMS & Slip Verification Bar */}
                <div className="tx-sms-verification-box">
                  <div className="sms-shield-icon">
                    <i className="fa-solid fa-shield-halved"></i>
                  </div>
                  <div className="sms-verify-text-group" style={{ flex: 1 }}>
                    <strong className="sms-verify-title">
                      {isDeposit ? '+5.0% Cashier Comm' : '+2.0% Cashier Fee'}
                    </strong>
                    <span className="sms-verify-sub" style={{ color: '#059669', fontWeight: 700 }}>
                      +{tx.agentCommission.toFixed(2)} ETB credited to Agent #{tx.agentCode}
                    </span>
                  </div>
                  {tx.receiptImage && (
                    <button
                      type="button"
                      onClick={() => setInspectTx(tx)}
                      style={{
                        background: 'rgba(234, 179, 8, 0.15)',
                        border: '1px solid rgba(234, 179, 8, 0.4)',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        color: '#b45309',
                        fontSize: '11px',
                        fontWeight: 700
                      }}
                      title="Inspect attached receipt image"
                    >
                      <i className="fa-solid fa-image"></i>
                      <span>View Slip</span>
                    </button>
                  )}
                </div>

                {/* Footer Meta: Amount Display */}
                <div className="tx-card-footer-meta-row" style={{ marginTop: '10px' }}>
                  <div className="tx-lifetime-verified">
                    <span className="verified-text">P2P LEDGER</span>
                    <i className="fa-solid fa-circle-check verified-green-icon"></i>
                    <span className="lifetime-in-text">Agent #{tx.agentCode}</span>
                  </div>

                  <div className="tx-amount-display-box">
                    <span className="amount-tiny-lbl">AMOUNT</span>
                    <strong className={`amount-huge-val ${isDeposit ? 'deposit-green' : 'withdraw-gold'}`}>
                      {isDeposit ? `+${tx.amount.toFixed(2)}` : `${tx.amount.toFixed(2)}`} ETB
                    </strong>
                  </div>
                </div>

                {/* Audit Settlement Banner */}
                {isPending ? (
                  <div
                    style={{
                      marginTop: '10px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'rgba(59, 130, 246, 0.08)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      color: '#1d4ed8',
                      fontSize: '11px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <i className="fa-solid fa-spinner fa-spin"></i>
                    <span>Awaiting Agent #{tx.agentCode} mobile transfer & confirmation.</span>
                  </div>
                ) : isApproved ? (
                  <div className="tx-card-resolved-banner" style={{ marginTop: '10px' }}>
                    <i className="fa-solid fa-circle-check green"></i>
                    <span>Settled via Agent #{tx.agentCode} · Balance Credited</span>
                  </div>
                ) : (
                  <div
                    style={{
                      marginTop: '10px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#b91c1c',
                      fontSize: '11px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <i className="fa-solid fa-circle-xmark"></i>
                    <span>Rejected: {tx.rejectionReason || 'Declined by agent'}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Inspection Modal: Full Audit Slip */}
      {inspectTx && (
        <div className="cashier-modal-backdrop" onClick={() => setInspectTx(null)}>
          <div className="cashier-slip-modal-card" onClick={e => e.stopPropagation()}>
            <div className="slip-modal-header">
              <div className="slip-header-titles">
                <h3>
                  <i className="fa-solid fa-receipt gold" style={{ marginRight: 8 }}></i>
                  Audit Slip #{inspectTx.referenceNumber}
                </h3>
                <p>Official P2P Network Verification Record</p>
              </div>
              <button
                type="button"
                className="btn-modal-close-round"
                onClick={() => setInspectTx(null)}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="slip-modal-body">
              <div className="slip-details-grid">
                <div className="slip-grid-cell">
                  <span className="cell-lbl">Order Type</span>
                  <strong className="cell-val uppercase">{inspectTx.type}</strong>
                </div>
                <div className="slip-grid-cell">
                  <span className="cell-lbl">Payment Rail</span>
                  <strong className="cell-val">{inspectTx.paymentMethod}</strong>
                </div>
                <div className="slip-grid-cell">
                  <span className="cell-lbl">Player Name</span>
                  <strong className="cell-val">{inspectTx.userName}</strong>
                </div>
                <div className="slip-grid-cell">
                  <span className="cell-lbl">Player Account / Phone</span>
                  <strong className="cell-val">{inspectTx.playerPhone || inspectTx.userPhone}</strong>
                </div>
                <div className="slip-grid-cell">
                  <span className="cell-lbl">Assigned Cashier Agent</span>
                  <strong className="cell-val gold-amt">👑 {inspectTx.agentName} (#{inspectTx.agentCode})</strong>
                </div>
                <div className="slip-grid-cell">
                  <span className="cell-lbl">Order Amount</span>
                  <strong className="cell-val gold-amt">{inspectTx.amount.toFixed(2)} ETB</strong>
                </div>
              </div>

              {/* SMS Reference Box */}
              <div className="slip-sms-box" style={{ marginTop: '12px' }}>
                <span className="sms-box-lbl">Provider SMS Reference (Tx ID):</span>
                <strong className="sms-code-big">{inspectTx.referenceNumber}</strong>
              </div>

              {/* Attached Screenshot Image */}
              {inspectTx.receiptImage && (
                <div style={{ marginTop: '16px', background: '#0b1120', padding: '14px', borderRadius: '12px', border: '1px solid rgba(234, 179, 8, 0.35)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#facc15', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <i className="fa-solid fa-camera"></i> Attached Payment Receipt Screenshot
                    </span>
                    <a
                      href={inspectTx.receiptImage}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: '12px', color: '#60a5fa', fontWeight: 600, textDecoration: 'underline' }}
                    >
                      Open Full Res ↗
                    </a>
                  </div>
                  <div style={{ maxHeight: '280px', overflowY: 'auto', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center', background: '#000000', padding: '8px' }}>
                    <img
                      src={inspectTx.receiptImage}
                      alt="Payment Receipt Slip"
                      style={{ maxWidth: '100%', maxHeight: '260px', objectFit: 'contain', display: 'inline-block', borderRadius: '6px' }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="slip-modal-footer">
              <button
                type="button"
                className="btn-slip-close-gray"
                onClick={() => setInspectTx(null)}
                style={{ width: '100%' }}
              >
                Close Audit Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CashierDesk;
