import React, { useState, useEffect } from 'react';
import { useAdmin } from '../../context/AdminContext.tsx';
import { useApp } from '../../context/AppContext.tsx';
import { apiClient } from '../../services/apiClient.ts';

interface PayoutRequest {
  id: string;
  agentId: string;
  agentCode: string;
  agentName: string;
  agentPhone: string;
  agentUsername: string;
  amount: number;
  payoutMethod: string;
  payoutAccount: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNotes?: string | null;
  createdAt: string;
  settledAt?: string | null;
}

export const AgentPayoutsDesk: React.FC = () => {
  const { adminToken } = useAdmin();
  const { showToast } = useApp();

  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [loading, setLoading] = useState<boolean>(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [summary, setSummary] = useState<any>(null);

  // Modal State for Approval with Tx Ref
  const [selectedPayout, setSelectedPayout] = useState<PayoutRequest | null>(null);
  const [txRefInput, setTxRefInput] = useState<string>('');
  const [isApprovingModalOpen, setIsApprovingModalOpen] = useState<boolean>(false);

  const fetchPayouts = async () => {
    try {
      setLoading(true);
      const res = await apiClient.admin.getAgentPayouts(filter === 'all' ? undefined : filter);
      if (res && res.success) {
        setPayouts(res.payouts || []);
        if (res.summary) setSummary(res.summary);
      }
    } catch (err) {
      console.error('Failed to fetch agent commission payouts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayouts();
  }, [filter]);

  const openApproveModal = (p: PayoutRequest) => {
    setSelectedPayout(p);
    setTxRefInput(`TX-${p.payoutMethod.toUpperCase()}-${Date.now().toString().slice(-6)}`);
    setIsApprovingModalOpen(true);
  };

  const submitApproval = async () => {
    if (!selectedPayout) return;
    if (!txRefInput.trim()) {
      showToast('⚠️ Please enter the Bank or Telebirr transaction reference code.');
      return;
    }

    try {
      setProcessingId(selectedPayout.id);
      const res = await apiClient.admin.approveAgentPayout(selectedPayout.id, {
        txRef: txRefInput.trim()
      });
      if (res && res.success) {
        showToast(`🎉 Approved ${selectedPayout.amount.toFixed(2)} ETB payout for Agent #${selectedPayout.agentCode}!`);
        setIsApprovingModalOpen(false);
        setSelectedPayout(null);
        fetchPayouts();
      } else {
        showToast(`❌ ${res?.message || 'Approval failed'}`);
      }
    } catch (err: any) {
      showToast(`❌ Error: ${err.message || 'Failed to approve payout'}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (p: PayoutRequest) => {
    const reason = window.prompt(
      `Reject ${p.amount.toFixed(2)} ETB payout for Agent #${p.agentCode}?\n\n` +
      `⚠️ The full ${p.amount.toFixed(2)} ETB will be automatically REFUNDED back to the agent's commission balance.\n\n` +
      `Please enter rejection reason:`,
      'Account holder mismatch or invalid phone'
    );
    if (reason === null) return;

    try {
      setProcessingId(p.id);
      const res = await apiClient.admin.rejectAgentPayout(p.id, {
        reason: reason.trim() || 'Rejected by compliance'
      });
      if (res && res.success) {
        showToast(`✓ Payout rejected and ${p.amount.toFixed(2)} ETB refunded back to Agent #${p.agentCode}!`);
        fetchPayouts();
      } else {
        showToast(`❌ ${res?.message || 'Rejection failed'}`);
      }
    } catch (err: any) {
      showToast(`❌ Error: ${err.message || 'Failed to reject payout'}`);
    } finally {
      setProcessingId(null);
    }
  };

  const pendingCount = summary?.pendingCount ?? payouts.filter(p => p.status === 'pending').length;

  return (
    <div className="admin-subpage-wrap animate-fadeIn">
      {/* 1. Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)',
        borderRadius: '16px',
        padding: '24px',
        color: '#ffffff',
        marginBottom: '24px',
        boxShadow: '0 10px 25px -5px rgba(49, 46, 129, 0.3)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span style={{ fontSize: '24px' }}>🏦</span>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em' }}>
              Agent Commission Cashouts Desk
            </h2>
            <span style={{
              background: '#fef3c7',
              color: '#b45309',
              padding: '2px 10px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: 800
            }}>
              {pendingCount} Pending Approval
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '13px', opacity: 0.85, maxWidth: '650px' }}>
            Review and disburse agent commission cashout requests directly to their Telebirr phone or CBE bank account. Rejection automatically refunds the commission back to the agent's wallet.
          </p>
        </div>

        {summary && (
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ background: 'rgba(255,255,255,0.1)', padding: '10px 18px', borderRadius: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', opacity: 0.75, fontWeight: 700, textTransform: 'uppercase' }}>Pending Payouts</div>
              <div style={{ fontSize: '18px', fontWeight: 900, color: '#fef08a' }}>
                {summary.totalPendingAmount?.toLocaleString() || 0} <span style={{ fontSize: '11px' }}>ETB</span>
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.1)', padding: '10px 18px', borderRadius: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', opacity: 0.75, fontWeight: 700, textTransform: 'uppercase' }}>Total Settled</div>
              <div style={{ fontSize: '18px', fontWeight: 900, color: '#86efac' }}>
                {summary.totalApprovedAmount?.toLocaleString() || 0} <span style={{ fontSize: '11px' }}>ETB</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Filter Pills */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '16px'
      }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {(['pending', 'approved', 'rejected', 'all'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              style={{
                padding: '8px 18px',
                borderRadius: '9999px',
                fontSize: '13px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                background: filter === tab ? '#4338ca' : '#f1f5f9',
                color: filter === tab ? '#ffffff' : '#64748b',
                boxShadow: filter === tab ? '0 4px 12px rgba(67, 56, 202, 0.25)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              {tab === 'pending' && `⏳ Pending (${pendingCount})`}
              {tab === 'approved' && '✓ Settled & Paid'}
              {tab === 'rejected' && '✕ Rejected & Refunded'}
              {tab === 'all' && 'All Records'}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={fetchPayouts}
          disabled={loading}
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            color: '#334155',
            borderRadius: '8px',
            padding: '6px 14px',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <i className={`fa-solid fa-arrows-rotate ${loading ? 'fa-spin' : ''}`}></i>
          <span>Refresh</span>
        </button>
      </div>

      {/* 3. Table of Payout Requests */}
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
      }}>
        {loading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '24px', marginBottom: '8px' }}></i>
            <div>Loading agent commission payout requests...</div>
          </div>
        ) : payouts.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📭</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#334155' }}>No {filter} payout requests found</div>
            <div style={{ fontSize: '13px' }}>Agent commission cashouts will appear here for 1-click approval or rejection.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '14px 18px', fontWeight: 800 }}>Agent Profile</th>
                  <th style={{ padding: '14px 18px', fontWeight: 800 }}>Payout Amount</th>
                  <th style={{ padding: '14px 18px', fontWeight: 800 }}>Destination Rail & Account</th>
                  <th style={{ padding: '14px 18px', fontWeight: 800 }}>Status</th>
                  <th style={{ padding: '14px 18px', fontWeight: 800 }}>Admin Ref / Notes</th>
                  <th style={{ padding: '14px 18px', fontWeight: 800 }}>Date</th>
                  <th style={{ padding: '14px 18px', fontWeight: 800, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((p, idx) => (
                  <tr
                    key={p.id}
                    style={{
                      borderBottom: idx < payouts.length - 1 ? '1px solid #f1f5f9' : 'none',
                      background: p.status === 'pending' ? '#fffdf7' : 'transparent'
                    }}
                  >
                    {/* Agent Profile */}
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ fontWeight: 800, color: '#0f172a' }}>{p.agentName}</div>
                      <div style={{ fontSize: '11px', color: '#4338ca', fontWeight: 700 }}>
                        Agent Code: #{p.agentCode}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>{p.agentPhone}</div>
                    </td>

                    {/* Amount */}
                    <td style={{ padding: '14px 18px' }}>
                      <strong style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a' }}>
                        {p.amount.toFixed(2)}
                      </strong>{' '}
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>ETB</span>
                    </td>

                    {/* Destination Rail & Account */}
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: p.payoutMethod === 'Telebirr' ? '#ecfdf5' : '#eff6ff',
                        color: p.payoutMethod === 'Telebirr' ? '#059669' : '#1d4ed8',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 800,
                        marginBottom: '4px'
                      }}>
                        <span>{p.payoutMethod === 'Telebirr' ? '📱' : '🏦'}</span>
                        <span>{p.payoutMethod}</span>
                      </div>
                      <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f172a', fontSize: '13px' }}>
                        {p.payoutAccount}
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td style={{ padding: '14px 18px' }}>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '11px',
                        fontWeight: 800,
                        background: p.status === 'approved' ? '#dcfce7' : p.status === 'rejected' ? '#fee2e2' : '#fef3c7',
                        color: p.status === 'approved' ? '#15803d' : p.status === 'rejected' ? '#b91c1c' : '#b45309',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        {p.status === 'approved' && '✓ Settled & Paid'}
                        {p.status === 'rejected' && '✕ Rejected (Refunded)'}
                        {p.status === 'pending' && '⏳ Pending Review'}
                      </span>
                    </td>

                    {/* Admin Ref / Notes */}
                    <td style={{ padding: '14px 18px', maxWidth: '220px' }}>
                      {p.adminNotes ? (
                        <div style={{
                          fontSize: '12px',
                          color: p.status === 'rejected' ? '#dc2626' : '#15803d',
                          fontWeight: 700,
                          wordBreak: 'break-word'
                        }}>
                          {p.adminNotes}
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>—</span>
                      )}
                    </td>

                    {/* Date */}
                    <td style={{ padding: '14px 18px', color: '#64748b', fontSize: '12px', whiteSpace: 'nowrap' }}>
                      {new Date(p.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '14px 18px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {p.status === 'pending' ? (
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            onClick={() => openApproveModal(p)}
                            disabled={processingId === p.id}
                            style={{
                              background: '#15803d',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '6px 14px',
                              fontSize: '12px',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              boxShadow: '0 2px 6px rgba(21, 128, 61, 0.2)'
                            }}
                          >
                            <span>✓ Approve Payout</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReject(p)}
                            disabled={processingId === p.id}
                            style={{
                              background: '#fee2e2',
                              color: '#b91c1c',
                              border: '1px solid #fecaca',
                              borderRadius: '8px',
                              padding: '6px 12px',
                              fontSize: '12px',
                              fontWeight: 800,
                              cursor: 'pointer'
                            }}
                          >
                            <span>✕ Reject</span>
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>Completed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. APPROVAL MODAL WITH BANK/TELEBIRR TX REF */}
      {isApprovingModalOpen && selectedPayout && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '16px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '460px',
            padding: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>✓</span>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                  Confirm Payout Disbursement
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsApprovingModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', color: '#94a3b8', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '14px', marginBottom: '18px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                <span style={{ color: '#64748b' }}>Agent:</span>
                <strong style={{ color: '#0f172a' }}>{selectedPayout.agentName} (#{selectedPayout.agentCode})</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                <span style={{ color: '#64748b' }}>Disbursement Amount:</span>
                <strong style={{ color: '#15803d', fontSize: '15px' }}>{selectedPayout.amount.toFixed(2)} ETB</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: '#64748b' }}>Destination:</span>
                <strong style={{ color: '#0f172a' }}>{selectedPayout.payoutMethod} ({selectedPayout.payoutAccount})</strong>
              </div>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
                Bank / Telebirr Transaction Reference Number *
              </label>
              <input
                type="text"
                value={txRefInput}
                onChange={(e) => setTxRefInput(e.target.value)}
                placeholder="e.g. MP-893829472 or CBE-4829104"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#0f172a',
                  boxSizing: 'border-box'
                }}
              />
              <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '4px' }}>
                This reference will be visible to the agent in their Commission Desk.
              </span>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setIsApprovingModalOpen(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  color: '#64748b',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitApproval}
                disabled={processingId === selectedPayout.id}
                style={{
                  flex: 2,
                  padding: '12px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#15803d',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                {processingId === selectedPayout.id ? 'Processing...' : '✓ Confirm & Settle Payout'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
