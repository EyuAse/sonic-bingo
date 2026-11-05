import React, { useState, useEffect } from 'react';
import { useAdmin } from '../../context/AdminContext.tsx';
import { useApp } from '../../context/AppContext.tsx';
import { apiClient } from '../../services/apiClient.ts';

interface RechargeRequest {
  id: string;
  agent_id: string;
  agent_code: string;
  agent_name: string;
  agent_phone: string;
  current_agent_balance: number | string;
  amount: number | string;
  payment_method: string;
  transaction_code: string;
  receipt_image?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export const AgentRechargesDesk: React.FC = () => {
  const { adminToken } = useAdmin();
  const { showToast } = useApp();

  const [recharges, setRecharges] = useState<RechargeRequest[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchRecharges = async () => {
    try {
      setLoading(true);
      const data = await apiClient.admin.getAgentRecharges(filter === 'all' ? undefined : filter);
      if (data && data.success) {
        setRecharges(data.recharges || []);
      }
    } catch (err) {
      console.error('Failed to fetch agent recharges:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecharges();
  }, [filter]);

  const handleApprove = async (id: string, agentCode: string, amount: number | string) => {
    try {
      setProcessingId(id);
      const data = await apiClient.admin.creditAgentRecharge(id);
      if (data && data.success) {
        showToast(`🎉 Approved ${amount} ETB recharge for agent ${agentCode}!`);
        fetchRecharges();
      } else {
        showToast('❌ Approval failed');
      }
    } catch (err: any) {
      showToast(`❌ Error: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    const reason = window.prompt('Please enter rejection reason:');
    if (reason === null) return;

    try {
      setProcessingId(id);
      const data = await apiClient.admin.rejectAgentRecharge(id, reason || 'Payment not verified');
      if (data && data.success) {
        showToast('Recharge request rejected');
        fetchRecharges();
      } else {
        showToast('❌ Rejection failed');
      }
    } catch (err: any) {
      showToast(`❌ Error: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const pendingCount = recharges.filter(r => r.status === 'pending').length;

  return (
    <div className="admin-subpage-wrap animate-fadeIn">
      {/* 1. Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0f766e 0%, #0d9488 50%, #14b8a6 100%)',
        borderRadius: '16px',
        padding: '24px',
        color: '#ffffff',
        marginBottom: '24px',
        boxShadow: '0 10px 25px -5px rgba(13, 148, 136, 0.3)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span style={{ fontSize: '1.75rem' }}>⚡</span>
            <h2 style={{ fontSize: '1.375rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
              Agent Float Recharge Approvals
            </h2>
          </div>
          <p style={{ margin: 0, color: '#ccfbf1', fontSize: '0.875rem' }}>
            የወኪሎች የቴሌብር፣ ኤም-ፔሳ እና የኢትዮጵያ ንግድ ባንክ የዋሌት መሙያ ጥያቄዎችን ማጽደቂያ
          </p>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '8px', backgroundColor: 'rgba(0, 0, 0, 0.2)', padding: '4px', borderRadius: '12px' }}>
          {(['pending', 'approved', 'rejected', 'all'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: filter === tab ? '#ffffff' : 'transparent',
                color: filter === tab ? '#0f766e' : '#ffffff',
                fontWeight: 700,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                textTransform: 'capitalize'
              }}
            >
              {tab === 'pending' ? `Pending (${pendingCount})` : tab}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Recharges Table */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.04)'
      }}>
        {recharges.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
            <i className="fa-solid fa-receipt" style={{ fontSize: '2.5rem', marginBottom: '12px', color: '#cbd5e1' }}></i>
            <p style={{ margin: 0, fontWeight: 600 }}>No {filter} recharge requests found.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 12px' }}>Agent</th>
                  <th style={{ padding: '10px 12px' }}>Recharge Amount</th>
                  <th style={{ padding: '10px 12px' }}>Payment Method</th>
                  <th style={{ padding: '10px 12px' }}>Transaction Code</th>
                  <th style={{ padding: '10px 12px' }}>Current Float</th>
                  <th style={{ padding: '10px 12px' }}>Submitted At</th>
                  <th style={{ padding: '10px 12px' }}>Status / Action</th>
                </tr>
              </thead>
              <tbody>
                {recharges.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 800, color: '#0f172a' }}>{r.agent_code}</div>
                      <div style={{ color: '#475569', fontSize: '0.75rem' }}>{r.agent_name} ({r.agent_phone})</div>
                    </td>
                    <td style={{ padding: '12px', fontWeight: 900, color: '#059669', fontSize: '1rem' }}>
                      +{parseFloat(String(r.amount)).toLocaleString()} ETB
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        backgroundColor: r.payment_method === 'M-Pesa' ? '#f0fdf4' : '#eff6ff',
                        color: r.payment_method === 'M-Pesa' ? '#15803d' : '#1d4ed8',
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '0.75rem',
                        fontWeight: 700
                      }}>
                        {r.payment_method}
                      </span>
                    </td>
                    <td style={{ padding: '12px', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>
                      {r.transaction_code}
                    </td>
                    <td style={{ padding: '12px', color: '#64748b' }}>
                      {parseFloat(String(r.current_agent_balance || 0)).toLocaleString()} ETB
                    </td>
                    <td style={{ padding: '12px', color: '#64748b', fontSize: '0.8125rem' }}>
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px' }}>
                      {r.status === 'pending' ? (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            disabled={processingId === r.id}
                            onClick={() => handleApprove(r.id, r.agent_code, r.amount)}
                            style={{
                              padding: '6px 14px',
                              backgroundColor: '#10b981',
                              border: 'none',
                              borderRadius: '8px',
                              color: '#ffffff',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              cursor: 'pointer'
                            }}
                          >
                            <i className="fa-solid fa-check"></i> Approve
                          </button>
                          <button
                            type="button"
                            disabled={processingId === r.id}
                            onClick={() => handleReject(r.id)}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#fee2e2',
                              border: 'none',
                              borderRadius: '8px',
                              color: '#b91c1c',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              cursor: 'pointer'
                            }}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span style={{
                          backgroundColor: r.status === 'approved' ? '#ecfdf5' : '#fef2f2',
                          color: r.status === 'approved' ? '#047857' : '#b91c1c',
                          padding: '3px 10px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          textTransform: 'capitalize'
                        }}>
                          {r.status}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

