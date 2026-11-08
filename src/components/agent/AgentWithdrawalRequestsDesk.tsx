import React, { useState, useEffect } from 'react';
import { apiClient } from '../../services/apiClient.ts';
import { TelebirrLogo, CBELogo, MpesaLogo } from '../wallet/PaymentLogos.tsx';

interface AnalyticsWindow {
  amount: number;
  count: number;
  commission: number;
}

interface WithdrawalAnalytics {
  today: AnalyticsWindow;
  week: AnalyticsWindow;
  month: AnalyticsWindow;
  allTime: AnalyticsWindow;
}

interface AgentWithdrawalRequestsDeskProps {
  agentProfile: any;
  onActionCompleted: () => void;
  showToast: (msg: string) => void;
}

export const AgentWithdrawalRequestsDesk: React.FC<AgentWithdrawalRequestsDeskProps> = ({
  agentProfile,
  onActionCompleted,
  showToast
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'pending' | 'history'>('pending');
  const [timeframe, setTimeframe] = useState<'today' | 'week' | 'month' | 'all'>('today');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [requests, setRequests] = useState<any[]>([]);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Authoritative SQL Analytics State
  const [analytics, setAnalytics] = useState<WithdrawalAnalytics>({
    today: { amount: 0, count: 0, commission: 0 },
    week: { amount: 0, count: 0, commission: 0 },
    month: { amount: 0, count: 0, commission: 0 },
    allTime: { amount: 0, count: 0, commission: 0 }
  });

  // Approval Modal State
  const [selectedApproveReq, setSelectedApproveReq] = useState<any | null>(null);
  const [agentTxRef, setAgentTxRef] = useState<string>('');
  const [isApproving, setIsApproving] = useState<boolean>(false);

  // Rejection Modal State
  const [selectedRejectReq, setSelectedRejectReq] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('Invalid phone or account number');
  const [customRejectReason, setCustomRejectReason] = useState<string>('');
  const [isRejecting, setIsRejecting] = useState<boolean>(false);

  const fetchWithdrawals = async (tf = timeframe) => {
    try {
      setIsLoading(true);
      const res = await apiClient.agent.getWithdrawalRequests(tf === 'all' ? undefined : tf);
      if (res.success && res.requests) {
        setRequests(res.requests);
        setPendingCount(res.pendingCount || 0);
        if (res.analytics) {
          setAnalytics(res.analytics);
        }
      }
    } catch (err: any) {
      console.warn('Failed to fetch withdrawal requests:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWithdrawals(timeframe);
    const interval = setInterval(() => fetchWithdrawals(timeframe), 12000);
    return () => clearInterval(interval);
  }, [timeframe]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`📋 Copied: ${label}`);
  };

  const handleConfirmApproval = async () => {
    if (!selectedApproveReq) return;
    if (!agentTxRef.trim()) {
      showToast('⚠️ Please enter the SMS confirmation / Transaction Ref code.');
      return;
    }

    try {
      setIsApproving(true);
      const res = await apiClient.agent.approveWithdrawalRequest(
        selectedApproveReq.id,
        agentTxRef.trim().toUpperCase()
      );
      if (res.success) {
        showToast(`🎉 Payout approved! Float replenished +${(selectedApproveReq.amount * 1.02).toFixed(2)} ETB (+2% fee earned)`);
        setSelectedApproveReq(null);
        setAgentTxRef('');
        fetchWithdrawals(timeframe);
        onActionCompleted();
      }
    } catch (err: any) {
      showToast(`❌ ${err.message || 'Failed to approve withdrawal'}`);
    } finally {
      setIsApproving(false);
    }
  };

  const handleConfirmRejection = async () => {
    if (!selectedRejectReq) return;
    const finalReason = rejectReason === 'Other' ? customRejectReason.trim() : rejectReason;
    if (!finalReason) {
      showToast('⚠️ Please specify a rejection reason.');
      return;
    }

    try {
      setIsRejecting(true);
      const res = await apiClient.agent.rejectWithdrawalRequest(selectedRejectReq.id, finalReason);
      if (res.success) {
        showToast('ℹ️ Request rejected and player funds refunded to wallet.');
        setSelectedRejectReq(null);
        setCustomRejectReason('');
        fetchWithdrawals(timeframe);
        onActionCompleted();
      }
    } catch (err: any) {
      showToast(`❌ ${err.message || 'Failed to reject withdrawal'}`);
    } finally {
      setIsRejecting(false);
    }
  };

  // Filter requests based on active tab & search query
  const displayedRequests = requests
    .filter(r => (activeSubTab === 'pending' ? r.status === 'pending' : r.status !== 'pending'))
    .filter(r => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        (r.payoutAccount && r.payoutAccount.toLowerCase().includes(q)) ||
        (r.playerPhone && r.playerPhone.toLowerCase().includes(q)) ||
        (r.playerName && r.playerName.toLowerCase().includes(q)) ||
        (r.payoutAccountName && r.payoutAccountName.toLowerCase().includes(q)) ||
        (r.agentTxRef && r.agentTxRef.toLowerCase().includes(q))
      );
    });

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const historyRequests = requests.filter(r => r.status !== 'pending');

  return (
    <div style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }} className="space-y-5">
      {/* 1. Header Banner & Live Float Status */}
      <div
        className="sonic-white-card"
        style={{
          padding: '22px 24px',
          borderRadius: '16px',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          border: '1px solid #e2e8f0'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>📤</span>
            <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', margin: 0 }}>
              Withdrawal Cashier Desk
            </h2>
            {pendingCount > 0 && (
              <span
                style={{
                  background: '#f59e0b',
                  color: '#000000',
                  padding: '2px 10px',
                  borderRadius: '9999px',
                  fontSize: '12px',
                  fontWeight: 900,
                  boxShadow: '0 2px 6px rgba(245, 158, 11, 0.3)'
                }}
              >
                {pendingCount} Pending
              </span>
            )}
          </div>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
            Pay cash or transfer via mobile banking. Receive 100% float reimbursement + <strong>2% Cashier Fee</strong> directly to your float!
          </p>
        </div>

        {/* Float Status Pill */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '12px',
            padding: '10px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
          }}
        >
          <div>
            <div style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Your Working Float
            </div>
            <div style={{ fontSize: '18px', fontWeight: 900, color: '#059669' }}>
              {Number(agentProfile?.walletBalance || agentProfile?.wallet_balance || 0).toLocaleString()} ETB
            </div>
          </div>
          <button
            type="button"
            onClick={() => fetchWithdrawals(timeframe)}
            className="sonic-ghost-btn"
            style={{ padding: '8px 12px', fontSize: '12px', borderRadius: '8px' }}
            title="Refresh Queue"
          >
            <i className={`fa-solid fa-rotate ${isLoading ? 'fa-spin' : ''}`}></i>
          </button>
        </div>
      </div>

      {/* 2. Top KPI Analytics Ribbon (Today / Week / Month Aggregates) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '12px'
        }}
      >
        {/* Card 1: Today's Payouts */}
        <div
          className="sonic-white-card"
          style={{
            padding: '16px',
            borderRadius: '14px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
              Today's Payouts
            </span>
            <span style={{ fontSize: '15px' }}>💸</span>
          </div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a' }}>
            {analytics.today.amount.toLocaleString()} <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>ETB</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '11px' }}>
            <span style={{ color: '#059669', fontWeight: 700 }}>
              +{analytics.today.commission.toFixed(2)} ETB (+2%)
            </span>
            <span style={{ color: '#64748b' }}>{analytics.today.count} paid</span>
          </div>
        </div>

        {/* Card 2: This Week's Payouts */}
        <div
          className="sonic-white-card"
          style={{
            padding: '16px',
            borderRadius: '14px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
              This Week's Payouts
            </span>
            <span style={{ fontSize: '15px' }}>📅</span>
          </div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a' }}>
            {analytics.week.amount.toLocaleString()} <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>ETB</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '11px' }}>
            <span style={{ color: '#059669', fontWeight: 700 }}>
              +{analytics.week.commission.toFixed(2)} ETB (+2%)
            </span>
            <span style={{ color: '#64748b' }}>{analytics.week.count} paid</span>
          </div>
        </div>

        {/* Card 3: This Month's Payouts */}
        <div
          className="sonic-white-card"
          style={{
            padding: '16px',
            borderRadius: '14px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
              This Month's Payouts
            </span>
            <span style={{ fontSize: '15px' }}>🗓️</span>
          </div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a' }}>
            {analytics.month.amount.toLocaleString()} <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>ETB</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '11px' }}>
            <span style={{ color: '#059669', fontWeight: 700 }}>
              +{analytics.month.commission.toFixed(2)} ETB (+2%)
            </span>
            <span style={{ color: '#64748b' }}>{analytics.month.count} paid</span>
          </div>
        </div>

        {/* Card 4: Cashout Incentive (+2% Fee) */}
        <div
          className="sonic-white-card"
          style={{
            padding: '16px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
            border: '1px solid #86efac',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#166534', textTransform: 'uppercase' }}>
              Cashout Fee Earned
            </span>
            <span style={{ fontSize: '15px' }}>🪙</span>
          </div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: '#15803d' }}>
            +{analytics.allTime.commission.toLocaleString()} <span style={{ fontSize: '12px', fontWeight: 700 }}>ETB</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '11px', color: '#166534' }}>
            <span>All-Time 2% Payout Bonus</span>
            <span style={{ fontWeight: 800 }}>{analytics.allTime.count} settled</span>
          </div>
        </div>
      </div>

      {/* 3. Sub-Navigation Tabs & Timeframe Toolbar */}
      <div
        className="sonic-white-card"
        style={{
          padding: '14px 18px',
          borderRadius: '16px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}
      >
        {/* Left: Sub-Navigation */}
        <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '10px', gap: '4px' }}>
          <button
            type="button"
            onClick={() => setActiveSubTab('pending')}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '8px',
              background: activeSubTab === 'pending' ? '#ffffff' : 'transparent',
              color: activeSubTab === 'pending' ? '#0f172a' : '#64748b',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: activeSubTab === 'pending' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <span>📤 Pending Payouts</span>
            {pendingRequests.length > 0 && (
              <span
                style={{
                  background: '#f59e0b',
                  color: '#000000',
                  borderRadius: '9999px',
                  padding: '1px 6px',
                  fontSize: '10px',
                  fontWeight: 900
                }}
              >
                {pendingRequests.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('history')}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '8px',
              background: activeSubTab === 'history' ? '#ffffff' : 'transparent',
              color: activeSubTab === 'history' ? '#0f172a' : '#64748b',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: activeSubTab === 'history' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <span>🗄️ Settled History</span>
          </button>
        </div>

        {/* Right: Timeframe Category Filter */}
        {activeSubTab === 'history' && (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>Timeframe:</span>
            {[
              { id: 'today', label: 'Today' },
              { id: 'week', label: 'This Week' },
              { id: 'month', label: 'This Month' },
              { id: 'all', label: 'All Time' }
            ].map(tf => {
              const isSelected = timeframe === tf.id;
              return (
                <button
                  key={tf.id}
                  type="button"
                  onClick={() => setTimeframe(tf.id as any)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: isSelected ? 800 : 600,
                    border: isSelected ? '1px solid #3b82f6' : '1px solid #e2e8f0',
                    background: isSelected ? '#eff6ff' : '#ffffff',
                    color: isSelected ? '#1d4ed8' : '#64748b',
                    cursor: 'pointer'
                  }}
                >
                  {tf.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Search Input */}
        <div style={{ position: 'relative', minWidth: '220px' }}>
          <i
            className="fa-solid fa-magnifying-glass"
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#94a3b8',
              fontSize: '12px'
            }}
          ></i>
          <input
            type="text"
            placeholder="Search account, phone, or ref..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 32px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              fontSize: '13px',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>
      </div>

      {/* 4. Main Body: PENDING CARDS OR HISTORY TABLE */}
      {activeSubTab === 'pending' ? (
        displayedRequests.length === 0 ? (
          <div
            className="sonic-white-card"
            style={{
              padding: '60px 24px',
              textAlign: 'center',
              border: '1px dashed #cbd5e1',
              borderRadius: '16px',
              color: '#64748b'
            }}
          >
            <div style={{ fontSize: '42px', marginBottom: '12px' }}>☕</div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0' }}>
              All Caught Up!
            </h3>
            <p style={{ margin: 0, fontSize: '13px' }}>
              No pending withdrawal payout requests waiting right now.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
            {displayedRequests.map(req => {
              const commissionVal = Number(req.amount) * 0.02;
              const totalFloatCredit = Number(req.amount) + commissionVal;

              return (
                <div
                  key={req.id}
                  className="sonic-white-card"
                  style={{
                    borderRadius: '16px',
                    border: '1px solid #e2e8f0',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    {/* Top Row: User & Date */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '15px', color: '#0f172a' }}>
                          {req.playerName || req.username || `Player #${req.playerId?.slice(0, 6)}`}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                          <span>📱 {req.playerPhone || 'N/A'}</span>
                          <span style={{ color: '#10b981', fontWeight: 700 }}>🟢 Verified ✓</span>
                        </div>
                      </div>
                      <span
                        style={{
                          background: '#fef3c7',
                          color: '#b45309',
                          padding: '4px 10px',
                          borderRadius: '20px',
                          fontSize: '11px',
                          fontWeight: 800
                        }}
                      >
                        ⏳ Pending
                      </span>
                    </div>

                    {/* Payout Destination Box */}
                    <div
                      style={{
                        background: '#f8fafc',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        padding: '14px',
                        marginBottom: '14px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '12px' }}>
                        <span style={{ color: '#64748b' }}>Transfer Rail:</span>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {req.payoutMethod === 'Telebirr' && <TelebirrLogo size={16} />}
                          {req.payoutMethod === 'CBE' && <CBELogo size={16} />}
                          {req.payoutMethod === 'M-Pesa' && <MpesaLogo size={16} />}
                          <span style={{ fontWeight: 800, color: '#0284c7' }}>
                            {req.payoutMethod === 'CBE' ? 'CBE Bank' : req.payoutMethod || 'Telebirr'}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '12px' }}>
                        <span style={{ color: '#64748b' }}>Payout Account:</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(req.payoutAccount, 'Account Number')}
                          style={{
                            background: '#e0f2fe',
                            border: '1px solid #bae6fd',
                            padding: '3px 8px',
                            borderRadius: '8px',
                            fontWeight: 800,
                            fontFamily: 'monospace',
                            color: '#0369a1',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <span>{req.payoutAccount}</span>
                          <i className="fa-solid fa-copy" style={{ fontSize: '10px' }}></i>
                        </button>
                      </div>

                      {req.payoutAccountName && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                          <span style={{ color: '#64748b' }}>Account Name:</span>
                          <span style={{ fontWeight: 700, color: '#1e293b' }}>{req.payoutAccountName}</span>
                        </div>
                      )}
                    </div>

                    {/* Financial Breakdown Callout */}
                    <div
                      style={{
                        background: '#ecfdf5',
                        borderRadius: '12px',
                        border: '1px solid #a7f3d0',
                        padding: '14px',
                        marginBottom: '16px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                        <span style={{ color: '#065f46', fontWeight: 600 }}>1. Cash Paid to Player:</span>
                        <span style={{ fontWeight: 900, color: '#b91c1c' }}>-{Number(req.amount).toFixed(2)} ETB</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                        <span style={{ color: '#065f46', fontWeight: 600 }}>2. Float Reimbursed:</span>
                        <span style={{ fontWeight: 800, color: '#047857' }}>+{Number(req.amount).toFixed(2)} ETB</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                        <span style={{ color: '#065f46', fontWeight: 600 }}>3. Cashier Fee (+2%):</span>
                        <span style={{ fontWeight: 900, color: '#059669' }}>+{commissionVal.toFixed(2)} ETB</span>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          paddingTop: '8px',
                          borderTop: '1px solid #a7f3d0',
                          fontSize: '13px'
                        }}
                      >
                        <span style={{ color: '#064e3b', fontWeight: 800 }}>Total Float Replenished:</span>
                        <span style={{ fontWeight: 900, color: '#047857', fontSize: '14px' }}>
                          +{totalFloatCredit.toFixed(2)} ETB
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedApproveReq(req);
                        setAgentTxRef('');
                      }}
                      style={{
                        flex: 1,
                        padding: '11px',
                        borderRadius: '10px',
                        background: '#10b981',
                        color: '#ffffff',
                        fontWeight: 800,
                        fontSize: '13px',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
                      }}
                    >
                      <i className="fa-solid fa-check"></i>
                      <span>Confirm Sent</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRejectReq(req);
                        setRejectReason('Invalid phone or account number');
                        setCustomRejectReason('');
                      }}
                      style={{
                        padding: '11px 16px',
                        borderRadius: '10px',
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        color: '#dc2626',
                        fontWeight: 700,
                        fontSize: '13px',
                        cursor: 'pointer'
                      }}
                    >
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* HISTORY TAB */
        displayedRequests.length === 0 ? (
          <div
            className="sonic-white-card"
            style={{
              padding: '60px 24px',
              textAlign: 'center',
              border: '1px dashed #cbd5e1',
              borderRadius: '16px',
              color: '#64748b'
            }}
          >
            <div style={{ fontSize: '42px', marginBottom: '12px' }}>📜</div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0' }}>
              No History Records
            </h3>
            <p style={{ margin: 0, fontSize: '13px' }}>
              No settled or rejected payouts found for this timeframe.
            </p>
          </div>
        ) : (
          <div className="sonic-white-card" style={{ borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', padding: 0 }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    <th style={{ padding: '14px 18px', fontWeight: 700 }}>Status</th>
                    <th style={{ padding: '14px 18px', fontWeight: 700 }}>Player</th>
                    <th style={{ padding: '14px 18px', fontWeight: 700 }}>Payout Amount</th>
                    <th style={{ padding: '14px 18px', fontWeight: 700 }}>Cashier Fee (+2%)</th>
                    <th style={{ padding: '14px 18px', fontWeight: 700 }}>Destination Rail & Account</th>
                    <th style={{ padding: '14px 18px', fontWeight: 700 }}>Bank / SMS Tx Ref</th>
                    <th style={{ padding: '14px 18px', fontWeight: 700 }}>Date & Time</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedRequests.map((req, i) => (
                    <tr
                      key={req.id}
                      style={{
                        borderBottom: i < displayedRequests.length - 1 ? '1px solid #f1f5f9' : 'none',
                        background: '#ffffff'
                      }}
                    >
                      <td style={{ padding: '14px 18px' }}>
                        <span
                          style={{
                            padding: '4px 10px',
                            borderRadius: '20px',
                            fontSize: '11px',
                            fontWeight: 800,
                            background: (req.status === 'approved' || req.status === 'completed') ? '#dcfce7' : '#fee2e2',
                            color: (req.status === 'approved' || req.status === 'completed') ? '#15803d' : '#b91c1c'
                          }}
                        >
                          {(req.status === 'approved' || req.status === 'completed') ? '✓ Paid & Settled' : '✕ Rejected'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 18px', fontWeight: 700, color: '#0f172a' }}>
                        <div>{req.playerName || req.username || `Player #${req.playerId?.slice(0, 6)}`}</div>
                        {req.playerPhone && <div style={{ fontSize: '11px', color: '#64748b' }}>{req.playerPhone}</div>}
                      </td>
                      <td style={{ padding: '14px 18px', fontWeight: 900, color: '#0f172a', fontSize: '15px' }}>
                        {Number(req.amount).toFixed(2)} ETB
                      </td>
                      <td style={{ padding: '14px 18px', fontWeight: 800, color: '#059669' }}>
                        {(req.status === 'approved' || req.status === 'completed') ? `+${(Number(req.amount) * 0.02).toFixed(2)} ETB` : '—'}
                      </td>
                      <td style={{ padding: '14px 18px', color: '#475569' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {req.payoutMethod === 'Telebirr' && <TelebirrLogo size={14} />}
                          {req.payoutMethod === 'CBE' && <CBELogo size={14} />}
                          {req.payoutMethod === 'M-Pesa' && <MpesaLogo size={14} />}
                          <span style={{ fontWeight: 700 }}>
                            {req.payoutMethod === 'CBE' ? 'CBE Bank' : req.payoutMethod}: {req.payoutAccount}
                          </span>
                        </div>
                        {req.payoutAccountName && (
                          <div style={{ fontSize: '11px', color: '#64748b' }}>({req.payoutAccountName})</div>
                        )}
                      </td>
                      <td style={{ padding: '14px 18px', fontFamily: 'monospace', fontWeight: 700, color: '#0284c7' }}>
                        {req.agentTxRef || req.rejectionReason || '—'}
                      </td>
                      <td style={{ padding: '14px 18px', color: '#94a3b8', fontSize: '12px' }}>
                        {new Date(req.updatedAt || req.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* MODAL 1: CONFIRM APPROVAL / RECORD TRANSACTION CODE */}
      {selectedApproveReq && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
            backdropFilter: 'blur(4px)'
          }}
        >
          <div
            className="sonic-white-card"
            style={{
              borderRadius: '20px',
              padding: '24px',
              width: '100%',
              maxWidth: '440px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '18px' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: '#dcfce7',
                  color: '#15803d',
                  fontSize: '26px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px'
                }}
              >
                ✓
              </div>
              <h3 style={{ fontSize: '19px', fontWeight: 900, color: '#0f172a', margin: '0 0 6px 0' }}>
                Confirm Mobile Payout Sent
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                Enter the mobile banking transaction confirmation code received after transferring money to the player.
              </p>
            </div>

            {/* Transfer Recap */}
            <div
              style={{
                background: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                padding: '14px',
                marginBottom: '18px',
                fontSize: '13px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#64748b' }}>Player:</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>{selectedApproveReq.playerName || selectedApproveReq.username}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#64748b' }}>Destination:</span>
                <span style={{ fontWeight: 800, color: '#0284c7' }}>
                  {selectedApproveReq.payoutMethod === 'CBE' ? 'CBE Bank' : selectedApproveReq.payoutMethod}: {selectedApproveReq.payoutAccount}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#64748b' }}>Cash Sent:</span>
                <span style={{ fontWeight: 900, color: '#b91c1c' }}>-{Number(selectedApproveReq.amount).toFixed(2)} ETB</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px solid #e2e8f0' }}>
                <span style={{ color: '#047857', fontWeight: 700 }}>Your Float Reimbursed (+2%):</span>
                <span style={{ fontWeight: 900, color: '#047857' }}>
                  +{(Number(selectedApproveReq.amount) * 1.02).toFixed(2)} ETB
                </span>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                SMS Transaction Reference (Tx Ref) *
              </label>
              <input
                type="text"
                value={agentTxRef}
                onChange={e => setAgentTxRef(e.target.value)}
                placeholder="e.g. FT240987123 or TX-TB-998877"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  fontWeight: 700,
                  fontFamily: 'monospace'
                }}
                autoFocus
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setSelectedApproveReq(null)}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '10px',
                  background: '#f1f5f9',
                  border: 'none',
                  color: '#475569',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmApproval}
                disabled={isApproving || !agentTxRef.trim()}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '10px',
                  background: '#10b981',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer',
                  opacity: isApproving || !agentTxRef.trim() ? 0.6 : 1
                }}
              >
                {isApproving ? 'Verifying...' : 'Confirm & Replenish'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CONFIRM REJECTION */}
      {selectedRejectReq && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
            backdropFilter: 'blur(4px)'
          }}
        >
          <div
            className="sonic-white-card"
            style={{
              borderRadius: '20px',
              padding: '24px',
              width: '100%',
              maxWidth: '440px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '18px' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: '#fee2e2',
                  color: '#dc2626',
                  fontSize: '26px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px'
                }}
              >
                ✕
              </div>
              <h3 style={{ fontSize: '19px', fontWeight: 900, color: '#0f172a', margin: '0 0 6px 0' }}>
                Reject Withdrawal Request
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                Player escrow will be refunded back to their gaming wallet immediately.
              </p>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>
                Select Reason:
              </label>
              {[
                'Invalid phone or account number',
                'Name does not match destination account',
                'Bank transfer network error / timed out',
                'Other'
              ].map(reason => (
                <label
                  key={reason}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    marginBottom: '6px',
                    background: rejectReason === reason ? '#f8fafc' : 'transparent',
                    border: rejectReason === reason ? '1px solid #cbd5e1' : '1px solid transparent',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: rejectReason === reason ? 700 : 500
                  }}
                >
                  <input
                    type="radio"
                    name="rejectReason"
                    checked={rejectReason === reason}
                    onChange={() => setRejectReason(reason)}
                  />
                  <span>{reason}</span>
                </label>
              ))}

              {rejectReason === 'Other' && (
                <input
                  type="text"
                  value={customRejectReason}
                  onChange={e => setCustomRejectReason(e.target.value)}
                  placeholder="Explain why you are rejecting this request..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    marginTop: '8px'
                  }}
                />
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setSelectedRejectReq(null)}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '10px',
                  background: '#f1f5f9',
                  border: 'none',
                  color: '#475569',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleConfirmRejection}
                disabled={isRejecting}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '10px',
                  background: '#dc2626',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                {isRejecting ? 'Rejecting...' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentWithdrawalRequestsDesk;
