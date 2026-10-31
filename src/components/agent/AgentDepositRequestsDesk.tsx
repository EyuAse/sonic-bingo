import React, { useState, useEffect } from 'react';
import { apiClient } from '../../services/apiClient.ts';
import { socketService } from '../../services/socketService.ts';

interface DepositRequestItem {
  id: string;
  amount: number;
  paymentMethod: string;
  playerPhone: string;
  playerName?: string;
  transactionCode: string;
  screenshotUrl?: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  createdAt: string;
  resolvedAt?: string;
}

interface AgentDepositRequestsDeskProps {
  agentProfile: any;
  onActionCompleted: () => void;
  showToast: (msg: string) => void;
}

export const AgentDepositRequestsDesk: React.FC<AgentDepositRequestsDeskProps> = ({
  agentProfile,
  onActionCompleted,
  showToast
}) => {
  const [requests, setRequests] = useState<DepositRequestItem[]>([]);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Modal State for Approval Confirmation
  const [approvingItem, setApprovingItem] = useState<DepositRequestItem | null>(null);
  const [isProcessingApproval, setIsProcessingApproval] = useState<boolean>(false);

  // Modal State for Rejection
  const [rejectingItem, setRejectingItem] = useState<DepositRequestItem | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('SMS Transaction ID not found in Telebirr');
  const [customRejectNote, setCustomRejectNote] = useState<string>('');
  const [isProcessingRejection, setIsProcessingRejection] = useState<boolean>(false);

  // Lightbox Modal for Receipt Screenshot
  const [activeReceiptUrl, setActiveReceiptUrl] = useState<string | null>(null);

  // 1. Fetch Requests from Backend
  const loadRequests = async (status = statusFilter) => {
    try {
      setLoading(true);
      const res = await apiClient.agent.getDepositRequests(status === 'all' ? undefined : status);
      if (res.success) {
        setRequests(res.requests);
        setPendingCount(res.pendingCount);
      }
    } catch (err: any) {
      console.warn('Failed to load deposit requests:', err);
      showToast(`❌ ${err.message || 'Failed to load deposit requests'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests(statusFilter);
  }, [statusFilter]);

  // 2. Real-Time WebSocket Alerts for Incoming Requests
  useEffect(() => {
    if (!agentProfile?.id) return;

    // Listen for new requests directed to this agent
    const unsubNewReq = socketService.on(`agent_${agentProfile.id}_new_request`, (data: any) => {
      showToast(`📥 New Deposit Request: +${data.amount} ETB from ${data.playerPhone}`);
      loadRequests(statusFilter);
      onActionCompleted();
    });

    const unsubGlobalReq = socketService.on('agent_new_deposit_request', (data: any) => {
      if (data?.agentId === agentProfile.id) {
        loadRequests(statusFilter);
      }
    });

    return () => {
      unsubNewReq();
      unsubGlobalReq();
    };
  }, [agentProfile?.id, statusFilter]);

  // 3. Handle Approval
  const handleConfirmApproval = async () => {
    if (!approvingItem) return;

    try {
      setIsProcessingApproval(true);
      const res = await apiClient.agent.approveDepositRequest(approvingItem.id);
      if (res.success) {
        showToast(`🎉 Approved: +${approvingItem.amount} ETB credited! Commission: +${res.details.commissionEarned.toFixed(2)} ETB`);
        setApprovingItem(null);
        loadRequests(statusFilter);
        onActionCompleted();
      }
    } catch (err: any) {
      showToast(`❌ ${err.message || 'Approval failed'}`);
    } finally {
      setIsProcessingApproval(false);
    }
  };

  // 4. Handle Rejection
  const handleConfirmRejection = async () => {
    if (!rejectingItem) return;

    try {
      setIsProcessingRejection(true);
      const finalReason = rejectReason === 'Other' ? (customRejectNote.trim() || 'Payment not verified') : rejectReason;
      const res = await apiClient.agent.rejectDepositRequest(rejectingItem.id, finalReason);
      if (res.success) {
        showToast('❌ Deposit request rejected');
        setRejectingItem(null);
        loadRequests(statusFilter);
        onActionCompleted();
      }
    } catch (err: any) {
      showToast(`❌ ${err.message || 'Rejection failed'}`);
    } finally {
      setIsProcessingRejection(false);
    }
  };

  // Filter by search query
  const filteredRequests = requests.filter(r => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      r.transactionCode.toLowerCase().includes(q) ||
      r.playerPhone.toLowerCase().includes(q) ||
      (r.playerName && r.playerName.toLowerCase().includes(q))
    );
  });

  return (
    <div style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }} className="space-y-6">
      {/* 1. Header Banner & Quick Metrics */}
      <div
        className="sonic-white-card"
        style={{
          padding: '24px',
          borderRadius: '16px',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>📥</span>
            <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', margin: 0 }}>
              Player Deposit Requests Queue
            </h2>
            {pendingCount > 0 && (
              <span
                style={{
                  background: '#ef4444',
                  color: '#ffffff',
                  padding: '2px 10px',
                  borderRadius: '9999px',
                  fontSize: '12px',
                  fontWeight: 900
                }}
              >
                {pendingCount} Pending
              </span>
            )}
          </div>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
            Review incoming mobile transfers, verify SMS receipts on your phone, and approve to credit player wallets.
          </p>
        </div>

        {/* Live Float Liquidity Indicator */}
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}
        >
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
              Your Available Float
            </div>
            <div style={{ fontSize: '18px', fontWeight: 900, color: '#059669' }}>
              {Number(agentProfile?.walletBalance || agentProfile?.wallet_balance || 0).toLocaleString()} ETB
            </div>
          </div>
          <button
            type="button"
            onClick={() => loadRequests()}
            className="sonic-ghost-btn"
            style={{ padding: '8px 12px', fontSize: '12px' }}
            title="Refresh List"
          >
            <i className={`fa-solid fa-rotate ${loading ? 'fa-spin' : ''}`}></i>
          </button>
        </div>
      </div>

      {/* 2. Filter Tabs & Search Controls */}
      <div
        className="sonic-white-card"
        style={{
          padding: '16px 20px',
          borderRadius: '16px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}
      >
        {/* Status Pill Tabs */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { id: 'pending', label: 'Pending', count: pendingCount, icon: 'fa-solid fa-clock' },
            { id: 'approved', label: 'Approved', icon: 'fa-solid fa-circle-check' },
            { id: 'rejected', label: 'Rejected', icon: 'fa-solid fa-circle-xmark' },
            { id: 'all', label: 'All Requests', icon: 'fa-solid fa-list' }
          ].map(tab => {
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id as any)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  borderRadius: '10px',
                  border: isActive ? '1px solid #f59e0b' : '1px solid #e2e8f0',
                  background: isActive ? '#fef3c7' : '#ffffff',
                  color: isActive ? '#92400e' : '#64748b',
                  fontSize: '13px',
                  fontWeight: isActive ? 800 : 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <i className={tab.icon}></i>
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    style={{
                      background: isActive ? '#d97706' : '#ef4444',
                      color: '#ffffff',
                      borderRadius: '9999px',
                      padding: '1px 6px',
                      fontSize: '10px',
                      fontWeight: 900
                    }}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative', minWidth: '240px' }}>
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
            placeholder="Search phone or SMS code..."
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

      {/* 3. Requests Table / Cards */}
      <div
        className="sonic-white-card"
        style={{
          borderRadius: '16px',
          overflow: 'hidden',
          padding: 0
        }}
      >
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '28px', color: '#f59e0b' }}></i>
            <p style={{ marginTop: '12px', fontSize: '14px', fontWeight: 700 }}>Loading deposit requests...</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
            <i className="fa-solid fa-inbox" style={{ fontSize: '36px', color: '#cbd5e1', marginBottom: '12px' }}></i>
            <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#334155' }}>
              No {statusFilter !== 'all' ? statusFilter : ''} deposit requests found
            </h4>
            <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>
              When players submit deposits targeting your agent code, they will appear here in real-time.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <th style={{ padding: '14px 18px' }}>Player Details</th>
                  <th style={{ padding: '14px 18px' }}>Amount</th>
                  <th style={{ padding: '14px 18px' }}>Payment Rail</th>
                  <th style={{ padding: '14px 18px' }}>SMS Transaction Code</th>
                  <th style={{ padding: '14px 18px' }}>Receipt Proof</th>
                  <th style={{ padding: '14px 18px' }}>Submitted Time</th>
                  <th style={{ padding: '14px 18px' }}>Status</th>
                  <th style={{ padding: '14px 18px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map(item => {
                  const isPending = item.status === 'pending';
                  return (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: isPending ? '#fffbeb' : '#ffffff',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      {/* Player Phone & Name */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 800, color: '#0f172a' }}>
                          {item.playerPhone}
                        </div>
                        {item.playerName && (
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            {item.playerName}
                          </div>
                        )}
                      </td>

                      {/* Requested Amount */}
                      <td style={{ padding: '14px 18px' }}>
                        <strong style={{ fontSize: '15px', color: '#059669', fontWeight: 900 }}>
                          +{item.amount.toLocaleString()} ETB
                        </strong>
                        <div style={{ fontSize: '10px', color: '#f59e0b', fontWeight: 700 }}>
                          🪙 +{Math.round(item.amount * 1.5)} Coins
                        </div>
                      </td>

                      {/* Payment Rail */}
                      <td style={{ padding: '14px 18px' }}>
                        <span
                          style={{
                            background: item.paymentMethod === 'Telebirr' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                            color: item.paymentMethod === 'Telebirr' ? '#0284c7' : '#b45309',
                            border: '1px solid transparent',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 800
                          }}
                        >
                          {item.paymentMethod}
                        </span>
                      </td>

                      {/* Transaction Code */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 900, color: '#0f172a', background: '#f1f5f9', padding: '3px 8px', borderRadius: '6px' }}>
                            {item.transactionCode}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(item.transactionCode);
                              showToast(`📋 Copied: ${item.transactionCode}`);
                            }}
                            title="Copy SMS Code"
                            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                          >
                            <i className="fa-regular fa-copy"></i>
                          </button>
                        </div>
                      </td>

                      {/* Receipt Screenshot */}
                      <td style={{ padding: '14px 18px' }}>
                        {item.screenshotUrl ? (
                          <button
                            type="button"
                            onClick={() => setActiveReceiptUrl(item.screenshotUrl!)}
                            style={{
                              background: '#f8fafc',
                              border: '1px solid #cbd5e1',
                              borderRadius: '8px',
                              padding: '4px 8px',
                              fontSize: '11px',
                              fontWeight: 700,
                              color: '#3b82f6',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <i className="fa-solid fa-image"></i> View Receipt
                          </button>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>None attached</span>
                        )}
                      </td>

                      {/* Created At */}
                      <td style={{ padding: '14px 18px', color: '#64748b', fontSize: '12px' }}>
                        {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                          {new Date(item.createdAt).toLocaleDateString()}
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 18px' }}>
                        {item.status === 'pending' ? (
                          <span style={{ background: '#fef3c7', color: '#92400e', padding: '3px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: 800 }}>
                            ⏳ Pending
                          </span>
                        ) : item.status === 'approved' ? (
                          <span style={{ background: '#d1fae5', color: '#065f46', padding: '3px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: 800 }}>
                            ✅ Approved
                          </span>
                        ) : (
                          <span style={{ background: '#fee2e2', color: '#991b1b', padding: '3px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: 800 }} title={item.rejectionReason}>
                            ❌ Rejected
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        {isPending ? (
                          <div style={{ display: 'inline-flex', gap: '8px' }}>
                            <button
                              type="button"
                              onClick={() => setApprovingItem(item)}
                              style={{
                                background: '#10b981',
                                border: 'none',
                                color: '#ffffff',
                                padding: '6px 12px',
                                borderRadius: '8px',
                                fontSize: '12px',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)'
                              }}
                            >
                              <i className="fa-solid fa-check"></i> Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRejectingItem(item);
                                setRejectReason('SMS Transaction ID not found in Telebirr');
                              }}
                              style={{
                                background: '#f8fafc',
                                border: '1px solid #ef4444',
                                color: '#ef4444',
                                padding: '6px 10px',
                                borderRadius: '8px',
                                fontSize: '12px',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              <i className="fa-solid fa-xmark"></i> Reject
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                            {item.status === 'approved' ? 'Settled' : 'Closed'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: APPROVAL CONFIRMATION */}
      {approvingItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px'
          }}
        >
          <div
            className="sonic-white-card"
            style={{
              maxWidth: '460px',
              width: '100%',
              borderRadius: '20px',
              padding: '28px',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: '#d1fae5',
                  color: '#059669',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '26px',
                  marginBottom: '10px'
                }}
              >
                <i className="fa-solid fa-wallet"></i>
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                Confirm Player Deposit Approval
              </h3>
              <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                Please confirm that you have received the mobile transfer on your phone.
              </p>
            </div>

            {/* Financial Ledger Breakdown */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '20px',
                fontSize: '13px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#64748b' }}>Player Phone:</span>
                <strong style={{ color: '#0f172a' }}>{approvingItem.playerPhone}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#64748b' }}>SMS Transaction Code:</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 900, color: '#0284c7' }}>
                  {approvingItem.transactionCode}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#64748b' }}>Deposit to Credit Player:</span>
                <strong style={{ color: '#059669', fontSize: '15px' }}>
                  +{approvingItem.amount.toFixed(2)} ETB
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#64748b' }}>Charged from Your Float:</span>
                <strong style={{ color: '#dc2626' }}>
                  -{approvingItem.amount.toFixed(2)} ETB
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid #e2e8f0' }}>
                <span style={{ color: '#64748b' }}>Your Commission (+5%):</span>
                <strong style={{ color: '#d97706', fontSize: '14px' }}>
                  +{(approvingItem.amount * 0.05).toFixed(2)} ETB
                </strong>
              </div>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setApprovingItem(null)}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#64748b',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
                disabled={isProcessingApproval}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmApproval}
                style={{
                  flex: 2,
                  padding: '12px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#10b981',
                  color: '#ffffff',
                  fontWeight: 900,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
                disabled={isProcessingApproval}
              >
                {isProcessingApproval ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i> Processing...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-check"></i> Confirm & Credit Player
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: REJECTION MODAL */}
      {rejectingItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px'
          }}
        >
          <div
            className="sonic-white-card"
            style={{
              maxWidth: '440px',
              width: '100%',
              borderRadius: '20px',
              padding: '28px'
            }}
          >
            <h3 style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', margin: '0 0 8px 0' }}>
              Reject Deposit Request
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 16px 0' }}>
              Please select why you cannot verify this transfer. The player will be notified immediately.
            </p>

            {/* Radio Reasons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {[
                'SMS Transaction ID not found in Telebirr',
                'Payment amount does not match',
                'Duplicate submission / already credited',
                'Other'
              ].map(reason => (
                <label
                  key={reason}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: rejectReason === reason ? '#fee2e2' : '#f8fafc',
                    border: rejectReason === reason ? '1px solid #ef4444' : '1px solid #e2e8f0',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: '#0f172a'
                  }}
                >
                  <input
                    type="radio"
                    name="rejectReason"
                    value={reason}
                    checked={rejectReason === reason}
                    onChange={() => setRejectReason(reason)}
                  />
                  <span>{reason}</span>
                </label>
              ))}
            </div>

            {rejectReason === 'Other' && (
              <div style={{ marginBottom: '16px' }}>
                <input
                  type="text"
                  placeholder="Enter specific rejection reason..."
                  value={customRejectNote}
                  onChange={e => setCustomRejectNote(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            )}

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setRejectingItem(null)}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#64748b',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
                disabled={isProcessingRejection}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRejection}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#ef4444',
                  color: '#ffffff',
                  fontWeight: 900,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
                disabled={isProcessingRejection}
              >
                {isProcessingRejection ? 'Rejecting...' : 'Reject Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: RECEIPT LIGHTBOX */}
      {activeReceiptUrl && (
        <div
          onClick={() => setActiveReceiptUrl(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 120,
            padding: '20px'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '90vw',
              maxHeight: '90vh',
              background: '#ffffff',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
              position: 'relative'
            }}
          >
            <div style={{ padding: '12px 18px', background: '#0f172a', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '13px' }}>Player Receipt Screenshot</strong>
              <button
                type="button"
                onClick={() => setActiveReceiptUrl(null)}
                style={{ background: 'none', border: 'none', color: '#ffffff', fontSize: '16px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: '16px', textAlign: 'center', maxHeight: '75vh', overflow: 'auto' }}>
              <img src={activeReceiptUrl} alt="Receipt Screenshot" style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: '8px' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentDepositRequestsDesk;

