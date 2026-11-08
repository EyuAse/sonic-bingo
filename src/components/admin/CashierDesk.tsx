import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { apiClient } from '../../services/apiClient.ts';
import { TelebirrLogo, CBELogo, MpesaLogo } from '../wallet/PaymentLogos.tsx';
import { socketService } from '../../services/socketService.ts';

// Helper to format currency numbers
const fmt = (n: number | string) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Helper to format integers
const fmtInt = (n: number | string) => Number(n || 0).toLocaleString('en-US');

// Helper to get 2-letter initials from name
const ini = (name: string) => {
  if (!name) return 'PL';
  const clean = name.replace(/[^\w\s]/gi, '').trim();
  if (!clean) return name.slice(0, 2).toUpperCase();
  return clean
    .split(' ')
    .filter(Boolean)
    .map(w => w[0] || '')
    .slice(0, 2)
    .join('')
    .toUpperCase();
};

// Minimalist trend arrow SVG from Enqu Game Admin
const TRD = (
  <svg width="13" height="9" viewBox="0 0 14 10" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '3px' }}>
    <path d="M1 8l4-4 3 3 5-5M9 2h4v4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export interface CashierAuditItem {
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
  const [page, setPage] = useState<number>(1);
  const limit = 25;

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

  // Selected Transaction for Slide-over Slip Dossier
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

  // Pagination
  const totalCount = transactions.length;
  const totalPages = Math.ceil(totalCount / limit) || 1;
  const paginatedTransactions = transactions.slice((page - 1) * limit, page * limit);

  return (
    <div className="enqu-dashboard-main">
      {/* 1. Header Bar matching Enqu Game Admin */}
      <div className="top" style={{ marginBottom: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: 'var(--ink)' }}>
            🛡️ P2P Cashier Surveillance Desk
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '13.5px', color: 'var(--mute)' }}>
            Real-time multi-rail P2P settlement surveillance, cashier commission distribution, and agent float solvency tracking.
          </p>
        </div>

        <div className="row" style={{ gap: '10px' }}>
          <span className="pillbox">
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block', marginRight: '6px' }} />
            Live P2P Stream
          </span>
          <button
            type="button"
            className="enqu-btn-secondary"
            onClick={() => {
              fetchLedger(true);
              showToast('🔄 P2P cashier network ledger refreshed');
            }}
            disabled={isRefreshing}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <svg
              viewBox="0 0 24 24"
              width="15"
              height="15"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }}
            >
              <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>{isRefreshing ? 'Syncing...' : 'Sync Stream'}</span>
          </button>
        </div>
      </div>

      {/* 2. Top 4 Stat Cards Grid (.g4) Matching Dashboard Overview */}
      <div className="grid g4" style={{ marginBottom: '16px' }}>
        {/* Card 1: Today's P2P Deposits (Dark Charcoal Gradient Card) */}
        <div className="card d">
          <div className="lab">Today's P2P Deposits</div>
          <div className="val">ETB {fmt(stats.todayDepositsAmount)}</div>
          <div className="tr">
            <span className="up">{TRD} Live</span> {stats.todayDepositsCount} txns · +5% ({fmt(stats.todayDepositsCommission)} ETB) Comm
          </div>
        </div>

        {/* Card 2: Today's P2P Payouts */}
        <div className="card">
          <div className="lab">Today's P2P Payouts</div>
          <div className="val">ETB {fmt(stats.todayWithdrawalsAmount)}</div>
          <div className="tr">
            <span className="up">{TRD} Settled</span> {stats.todayWithdrawalsCount} txns · +2% ({fmt(stats.todayWithdrawalsFee)} ETB) Fee
          </div>
        </div>

        {/* Card 3: Agent Float in Circulation */}
        <div className="card">
          <div className="lab">Agent Float in Circulation</div>
          <div className="val">ETB {fmt(stats.agentFloatCirculation)}</div>
          <div className="tr">
            <span className="up">{TRD} Float</span> Active working liquidity
          </div>
        </div>

        {/* Card 4: Agent Commissions Distributed */}
        <div className="card">
          <div className="lab">Agent Commissions Paid</div>
          <div className="val">ETB {fmt(stats.totalCommissionDistributed)}</div>
          <div className="tr">
            <span className="up">{TRD} Rewards</span> Network distributed
          </div>
        </div>
      </div>

      {/* 3. Multi-Dimensional Filter Ribbon Card (Search + Segment Tabs + Rail + Timeframe) */}
      <div className="card filter-ribbon-card" style={{ marginBottom: '16px', padding: '14px 16px' }}>
        {/* Row 1: Search & Status Tabs */}
        <div className="row" style={{ justifyContent: 'space-between', width: '100%', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <div className="row" style={{ gap: '10px', flex: '1 1 300px' }}>
            {/* Live Search Input */}
            <input
              type="text"
              placeholder="Search reference, player phone, or agent code..."
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="enqu-panel-input"
              style={{ minWidth: '260px', flex: 1 }}
            />

            {/* Status Segment Tabs */}
            <span className="tabs" style={{ margin: 0, display: 'inline-flex', flexWrap: 'wrap' }}>
              {[
                { id: 'all', label: `All Orders (${transactions.length})` },
                { id: 'pending', label: `Pending (${pendingCount})`, isUrgent: pendingCount > 0 },
                { id: 'approved', label: `Settled (${settledCount})` },
                { id: 'rejected', label: `Rejected (${rejectedCount})` }
              ].map(tab => (
                <a
                  key={tab.id}
                  className={statusFilter === tab.id ? 'on' : ''}
                  onClick={() => {
                    setStatusFilter(tab.id as any);
                    setPage(1);
                  }}
                  style={{
                    cursor: 'pointer',
                    userSelect: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  {tab.isUrgent && (
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }} />
                  )}
                  {tab.label}
                </a>
              ))}
            </span>
          </div>

          {/* Timeframe Selector */}
          <div className="row" style={{ gap: '4px', background: 'var(--panel)', padding: '3px', borderRadius: '10px' }}>
            {(['today', 'week', 'month', 'all'] as const).map(tf => (
              <button
                key={tf}
                type="button"
                onClick={() => {
                  setTimeframe(tf);
                  setPage(1);
                }}
                style={{
                  padding: '5px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: timeframe === tf ? '#ffffff' : 'transparent',
                  color: timeframe === tf ? 'var(--ink)' : 'var(--mute)',
                  boxShadow: timeframe === tf ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  textTransform: 'capitalize'
                }}
              >
                {tf === 'all' ? 'All Time' : tf === 'week' ? 'This Week' : tf === 'month' ? 'This Month' : 'Today'}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Order Type Chips & Payment Rail Chips */}
        <div className="row" style={{ justifyContent: 'space-between', width: '100%', gap: '10px', flexWrap: 'wrap', paddingTop: '10px', borderTop: '1px solid var(--line)' }}>
          {/* Order Type Chips */}
          <div className="row" style={{ gap: '6px' }}>
            <span style={{ fontSize: '12px', color: 'var(--mute)', fontWeight: 700, marginRight: '4px' }}>TYPE:</span>
            {[
              { id: 'all', label: 'All' },
              { id: 'deposit', label: 'Deposits (+5%)', icon: '↓', color: '#10b981' },
              { id: 'withdrawal', label: 'Withdrawals (+2%)', icon: '↑', color: '#2563eb' }
            ].map(tc => (
              <button
                key={tc.id}
                type="button"
                onClick={() => {
                  setTypeFilter(tc.id as any);
                  setPage(1);
                }}
                style={{
                  padding: '4px 10px',
                  borderRadius: '8px',
                  border: typeFilter === tc.id ? '1.5px solid var(--ink)' : '1px solid var(--line)',
                  background: typeFilter === tc.id ? 'var(--ink)' : '#ffffff',
                  color: typeFilter === tc.id ? '#ffffff' : 'var(--ink)',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                {tc.icon && <span style={{ color: typeFilter === tc.id ? '#ffffff' : tc.color, fontWeight: 900 }}>{tc.icon}</span>}
                <span>{tc.label}</span>
              </button>
            ))}
          </div>

          {/* Rail Filter Chips */}
          <div className="row" style={{ gap: '6px' }}>
            <span style={{ fontSize: '12px', color: 'var(--mute)', fontWeight: 700, marginRight: '4px' }}>RAIL:</span>
            {[
              { id: 'all', label: 'All Rails' },
              { id: 'Telebirr', label: 'Telebirr', logo: <TelebirrLogo size={13} /> },
              { id: 'CBE', label: 'CBE Bank', logo: <CBELogo size={13} /> },
              { id: 'M-Pesa', label: 'M-Pesa', logo: <MpesaLogo size={13} /> }
            ].map(rc => (
              <button
                key={rc.id}
                type="button"
                onClick={() => {
                  setRailFilter(rc.id as any);
                  setPage(1);
                }}
                style={{
                  padding: '4px 10px',
                  borderRadius: '8px',
                  border: railFilter === rc.id ? '1.5px solid var(--ink)' : '1px solid var(--line)',
                  background: railFilter === rc.id ? 'var(--ink)' : '#ffffff',
                  color: railFilter === rc.id ? '#ffffff' : 'var(--ink)',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                {rc.logo}
                <span>{rc.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4. High-Density Master Surveillance Table (.card > .wrap > .enqu-table) */}
      <div className="card" style={{ padding: '0', overflow: 'hidden', marginBottom: '20px' }}>
        <div className="wrap" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table className="enqu-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '12px 14px' }}>Date / Time</th>
                <th style={{ textAlign: 'center', padding: '12px 14px' }}>Type</th>
                <th style={{ textAlign: 'left', padding: '12px 14px' }}>Rail</th>
                <th style={{ textAlign: 'left', padding: '12px 14px' }}>SMS Reference</th>
                <th style={{ textAlign: 'left', padding: '12px 14px' }}>Player Details</th>
                <th style={{ textAlign: 'left', padding: '12px 14px' }}>Assigned Agent</th>
                <th style={{ textAlign: 'right', padding: '12px 14px' }}>Order Amount</th>
                <th style={{ textAlign: 'right', padding: '12px 14px' }}>Commission</th>
                <th style={{ textAlign: 'center', padding: '12px 14px' }}>Status</th>
                <th style={{ textAlign: 'center', padding: '12px 14px' }}>Audit</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '36px', color: 'var(--mute)' }}>
                    🔄 Streaming live P2P cashier network ledger from Neon PostgreSQL...
                  </td>
                </tr>
              ) : paginatedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '36px', color: 'var(--mute)' }}>
                    No P2P cashier records found matching the active filters.
                  </td>
                </tr>
              ) : (
                paginatedTransactions.map(tx => {
                  const isDeposit = tx.type === 'deposit';
                  const isPending = tx.status === 'pending';
                  const isApproved = tx.status === 'approved';
                  const isRejected = tx.status === 'rejected' || tx.status === 'cancelled';
                  const formattedTime = new Date(tx.createdAt).toLocaleDateString('en-US', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  return (
                    <tr
                      key={tx.id}
                      onClick={() => setInspectTx(tx)}
                      style={{
                        cursor: 'pointer',
                        transition: 'background 0.12s ease'
                      }}
                    >
                      {/* Date & Time */}
                      <td style={{ padding: '12px 14px', fontSize: '12.5px', color: 'var(--mute)', whiteSpace: 'nowrap' }}>
                        {formattedTime}
                      </td>

                      {/* Type Badge */}
                      <td style={{ textAlign: 'center', padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: '10px',
                            background: isDeposit ? '#ecfdf5' : '#eff6ff',
                            color: isDeposit ? '#065f46' : '#1e40af',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <span>{isDeposit ? '↓' : '↑'}</span>
                          <span>{isDeposit ? 'Deposit' : 'Withdrawal'}</span>
                        </span>
                      </td>

                      {/* Rail Logo & Name */}
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <div className="row" style={{ flexWrap: 'nowrap', gap: '6px', alignItems: 'center' }}>
                          {tx.paymentMethod === 'Telebirr' ? (
                            <TelebirrLogo size={16} />
                          ) : tx.paymentMethod === 'CBE' ? (
                            <CBELogo size={16} />
                          ) : (
                            <MpesaLogo size={16} />
                          )}
                          <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--ink)' }}>
                            {tx.paymentMethod === 'CBE' ? 'CBE Bank' : tx.paymentMethod}
                          </span>
                        </div>
                      </td>

                      {/* SMS Reference Code with Copy Button */}
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            handleCopy(tx.referenceNumber, 'SMS Reference');
                          }}
                          style={{
                            background: 'var(--panel)',
                            border: '1px solid var(--line)',
                            borderRadius: '6px',
                            padding: '2px 8px',
                            fontFamily: 'monospace',
                            fontSize: '12px',
                            fontWeight: 700,
                            color: 'var(--ink)',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                          title="Click to copy Transaction ID"
                        >
                          <span>{tx.referenceNumber}</span>
                          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                          </svg>
                        </button>
                      </td>

                      {/* Player Info */}
                      <td style={{ padding: '12px 14px' }}>
                        <div className="row" style={{ flexWrap: 'nowrap', gap: '8px', alignItems: 'center' }}>
                          <span
                            className="av2"
                            style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '50%',
                              background: '#f1f5f9',
                              color: 'var(--ink)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '11px',
                              flexShrink: 0
                            }}
                          >
                            {ini(tx.userName)}
                          </span>
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: '13.5px' }}>
                              {tx.userName || 'Player'}
                            </div>
                            <div className="tr" style={{ fontSize: '11.5px', color: 'var(--mute)' }}>
                              {tx.playerPhone || tx.userPhone}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Assigned Certified Agent */}
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 700, color: '#b45309', fontSize: '13px' }}>
                          👑 {tx.agentName || 'Certified Agent'}
                        </div>
                        <div className="tr" style={{ fontSize: '11.5px', color: 'var(--mute)' }}>
                          #{tx.agentCode || 'DIRECT'}
                        </div>
                      </td>

                      {/* Order Amount */}
                      <td style={{ textAlign: 'right', padding: '12px 14px', fontWeight: 800, fontSize: '14px', whiteSpace: 'nowrap', color: isDeposit ? '#059669' : '#2563eb' }}>
                        {isDeposit ? `+${fmt(tx.amount)}` : `-${fmt(tx.amount)}`} <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--mute)' }}>ETB</span>
                      </td>

                      {/* Agent Commission */}
                      <td style={{ textAlign: 'right', padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '13px', color: '#16a34a' }}>
                          +{fmt(tx.agentCommission)}
                        </span>
                        <span style={{ fontSize: '10.5px', color: 'var(--mute)', display: 'block' }}>
                          {isDeposit ? '5.0%' : '2.0%'}
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td style={{ textAlign: 'center', padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 9px',
                            borderRadius: '12px',
                            background: isApproved ? '#ecfdf5' : isPending ? '#fef3c7' : '#fee2e2',
                            color: isApproved ? '#065f46' : isPending ? '#b45309' : '#991b1b',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                        >
                          <span
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              background: isApproved ? '#10b981' : isPending ? '#f59e0b' : '#ef4444'
                            }}
                          />
                          {isApproved ? 'Settled' : isPending ? 'Pending' : 'Rejected'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'center', padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="enqu-btn-secondary"
                          onClick={e => {
                            e.stopPropagation();
                            setInspectTx(tx);
                          }}
                          style={{ padding: '3px 10px', fontSize: '12px' }}
                        >
                          {tx.receiptImage ? 'Slip' : 'Audit'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="row" style={{ justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid var(--line)' }}>
          <span className="tr" style={{ fontSize: '13px', color: 'var(--mute)' }}>
            Showing {Math.min((page - 1) * limit + 1, totalCount)} to {Math.min(page * limit, totalCount)} of {totalCount} transactions
          </span>

          <div className="row" style={{ gap: '6px' }}>
            <button
              type="button"
              className="enqu-btn-secondary"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              style={{ padding: '4px 10px', fontSize: '12px', opacity: page <= 1 ? 0.5 : 1 }}
            >
              Previous
            </button>
            <button
              type="button"
              className="enqu-btn-secondary"
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              style={{ padding: '4px 10px', fontSize: '12px', opacity: page >= totalPages ? 0.5 : 1 }}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* 5. Slip Inspection & Audit Lightbox Drawer (When inspectTx is selected) */}
      {inspectTx && (
        <div className="modalbg" onClick={() => setInspectTx(null)}>
          <div
            className="modal"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto' }}
          >
            {/* Header */}
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: '16px', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--ink)' }}>
                  P2P Transaction Audit Dossier
                </h3>
                <div className="tr" style={{ fontSize: '12.5px', color: 'var(--mute)' }}>
                  SMS Ref: <strong style={{ color: 'var(--ink)', fontFamily: 'monospace' }}>{inspectTx.referenceNumber}</strong>
                </div>
              </div>

              <button
                type="button"
                className="enqu-btn-secondary"
                onClick={() => setInspectTx(null)}
                style={{ padding: '4px 10px', fontSize: '14px', fontWeight: 700 }}
              >
                ✕
              </button>
            </div>

            {/* Receipt Image Display if Attached */}
            {inspectTx.receiptImage && (
              <div style={{ marginBottom: '16px', textAlign: 'center', background: '#000000', borderRadius: '12px', padding: '10px' }}>
                <img
                  src={inspectTx.receiptImage}
                  alt="Receipt slip"
                  style={{ maxHeight: '320px', maxWidth: '100%', objectFit: 'contain', borderRadius: '8px' }}
                />
              </div>
            )}

            {/* Quick Metrics Grid */}
            <div className="two" style={{ gap: '10px', marginBottom: '16px' }}>
              <div className="card" style={{ background: 'var(--panel)', padding: '12px 14px' }}>
                <div className="lab" style={{ fontSize: '11.5px', color: 'var(--mute)' }}>Order Amount</div>
                <div className="val" style={{ margin: '4px 0', fontSize: '20px', fontWeight: 800, color: inspectTx.type === 'deposit' ? '#059669' : '#2563eb' }}>
                  ETB {fmt(inspectTx.amount)}
                </div>
                <div className="tr" style={{ fontSize: '11px', color: 'var(--mute)' }}>
                  {inspectTx.type === 'deposit' ? 'Player Deposit' : 'Player Payout'}
                </div>
              </div>

              <div className="card" style={{ background: 'var(--panel)', padding: '12px 14px' }}>
                <div className="lab" style={{ fontSize: '11.5px', color: 'var(--mute)' }}>Agent Commission</div>
                <div className="val" style={{ margin: '4px 0', fontSize: '20px', fontWeight: 800, color: '#16a34a' }}>
                  ETB {fmt(inspectTx.agentCommission)}
                </div>
                <div className="tr" style={{ fontSize: '11px', color: 'var(--mute)' }}>
                  +{inspectTx.type === 'deposit' ? '5.0%' : '2.0%'} Credited
                </div>
              </div>
            </div>

            {/* Audit Checklist Key-Value Pairs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <div className="row" style={{ justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ color: 'var(--mute)' }}>Payment Rail</span>
                <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{inspectTx.paymentMethod}</span>
              </div>

              <div className="row" style={{ justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ color: 'var(--mute)' }}>Player Name & Phone</span>
                <span style={{ fontWeight: 700, color: 'var(--ink)' }}>
                  {inspectTx.userName} ({inspectTx.playerPhone || inspectTx.userPhone})
                </span>
              </div>

              <div className="row" style={{ justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ color: 'var(--mute)' }}>Assigned Certified Agent</span>
                <span style={{ fontWeight: 700, color: '#b45309' }}>
                  👑 {inspectTx.agentName || 'Agent'} (#{inspectTx.agentCode || 'DIRECT'})
                </span>
              </div>

              <div className="row" style={{ justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ color: 'var(--mute)' }}>Created Timestamp</span>
                <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{new Date(inspectTx.createdAt).toLocaleString()}</span>
              </div>

              {inspectTx.resolvedAt && (
                <div className="row" style={{ justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                  <span style={{ color: 'var(--mute)' }}>Resolved Timestamp</span>
                  <span style={{ fontWeight: 600, color: '#059669' }}>{new Date(inspectTx.resolvedAt).toLocaleString()}</span>
                </div>
              )}

              {inspectTx.rejectionReason && (
                <div className="row" style={{ justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                  <span style={{ color: 'var(--mute)' }}>Rejection Reason</span>
                  <span style={{ fontWeight: 700, color: '#dc2626' }}>{inspectTx.rejectionReason}</span>
                </div>
              )}
            </div>

            {/* Actions Footer */}
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: '20px', gap: '10px' }}>
              <button
                type="button"
                className="enqu-btn-secondary"
                onClick={() => handleCopy(inspectTx.referenceNumber, 'SMS Reference')}
              >
                Copy SMS Ref
              </button>
              <button
                type="button"
                className="enqu-btn-secondary"
                onClick={() => setInspectTx(null)}
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
