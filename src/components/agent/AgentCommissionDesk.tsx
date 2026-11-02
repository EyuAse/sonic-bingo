import React, { useState, useEffect } from 'react';
import { apiClient } from '../../services/apiClient.ts';
import { socketService } from '../../services/socketService.ts';
import { TelebirrLogo, CBELogo } from '../wallet/PaymentLogos.tsx';

interface AgentCommissionDeskProps {
  agentProfile: any;
  onRefresh: () => void;
  showToast: (msg: string) => void;
}

export const AgentCommissionDesk: React.FC<AgentCommissionDeskProps> = ({
  agentProfile,
  onRefresh,
  showToast
}) => {
  const [overview, setOverview] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Option A: Convert to Float Modal
  const [isConvertModalOpen, setIsConvertModalOpen] = useState<boolean>(false);
  const [convertAmount, setConvertAmount] = useState<number>(100);
  const [isConverting, setIsConverting] = useState<boolean>(false);

  // Option B: Request Bank Payout Modal
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState<boolean>(false);
  const [payoutAmount, setPayoutAmount] = useState<number>(500);
  const [payoutMethod, setPayoutMethod] = useState<'Telebirr' | 'CBE' | 'CBEBirr'>('Telebirr');
  const [payoutAccount, setPayoutAccount] = useState<string>(() => agentProfile?.payoutPhone || agentProfile?.phone || '');
  const [payoutAccountName, setPayoutAccountName] = useState<string>(() => agentProfile?.fullName || '');
  const [isSubmittingPayout, setIsSubmittingPayout] = useState<boolean>(false);

  const fetchOverview = async () => {
    try {
      setIsLoading(true);
      const res = await apiClient.agent.getCommissionOverview();
      if (res.success) {
        setOverview(res);
      }
    } catch (err) {
      console.warn('Failed to load commission overview:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
    const interval = setInterval(fetchOverview, 15000);

    const agentId = agentProfile?.id;
    const unsubApproved = agentId
      ? socketService.on(`agent_${agentId}_payout_approved`, (data: any) => {
          showToast(`🎉 Payout Approved: ${data.amount} ETB via ${data.payoutMethod}! Ref: ${data.adminRef || 'Settled'}`);
          fetchOverview();
          onRefresh();
        })
      : null;

    const unsubRejected = agentId
      ? socketService.on(`agent_${agentId}_payout_rejected`, (data: any) => {
          showToast(`⚠️ Payout Rejected: ${data.reason}. ${data.amount} ETB refunded to your balance.`);
          fetchOverview();
          onRefresh();
        })
      : null;

    const unsubGeneric = socketService.on('agent_payout_status_updated', () => {
      fetchOverview();
    });

    return () => {
      clearInterval(interval);
      if (unsubApproved) unsubApproved();
      if (unsubRejected) unsubRejected();
      if (unsubGeneric) unsubGeneric();
    };
  }, [agentProfile?.id]);

  const currentCommission = overview?.commissionBalance ?? agentProfile?.commissionBalance ?? 0;

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (convertAmount < 50) {
      showToast('⚠️ Minimum conversion is 50 ETB.');
      return;
    }
    if (convertAmount > currentCommission) {
      showToast('❌ Insufficient commission balance.');
      return;
    }

    try {
      setIsConverting(true);
      const res = await apiClient.agent.convertCommissionToFloat(convertAmount);
      if (res.success) {
        showToast(`🎉 Converted ${convertAmount} ETB directly to float! New Float: ${res.newWalletBalance?.toFixed(2) || 'updated'} ETB`);
        setIsConvertModalOpen(false);
        fetchOverview();
        onRefresh();
      }
    } catch (err: any) {
      showToast(`❌ ${err.message || 'Failed to convert commission'}`);
    } finally {
      setIsConverting(false);
    }
  };

  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (payoutAmount < 100) {
      showToast('⚠️ Minimum cashout request is 100 ETB.');
      return;
    }
    if (payoutAmount > currentCommission) {
      showToast('❌ Insufficient commission balance.');
      return;
    }
    if (!payoutAccount.trim()) {
      showToast('⚠️ Please enter receiving account number.');
      return;
    }

    try {
      setIsSubmittingPayout(true);
      const res = await apiClient.agent.requestCommissionCashout({
        amount: payoutAmount,
        payoutMethod,
        payoutAccount: payoutAccount.trim(),
        payoutAccountName: payoutAccountName.trim()
      });
      if (res.success) {
        showToast('✅ Cashout request submitted to Admin!');
        setIsPayoutModalOpen(false);
        fetchOverview();
        onRefresh();
      }
    } catch (err: any) {
      showToast(`❌ ${err.message || 'Failed to request cashout'}`);
    } finally {
      setIsSubmittingPayout(false);
    }
  };

  return (
    <div className="sonic-agent-desk-container" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Top Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)',
          borderRadius: '20px',
          padding: '28px',
          color: '#ffffff',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '20px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.2)'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '28px' }}>🪙</span>
            <h2 style={{ fontSize: '24px', fontWeight: 900, margin: 0, letterSpacing: '-0.3px' }}>
              Commission Wallet Desk
            </h2>
          </div>
          <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#a7f3d0' }}>
            Your 5% cashier deposit fees, 2% withdrawal bonuses, and referral commissions accumulate here safely.
          </p>
        </div>

        {/* Big Balance Callout */}
        <div
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '16px',
            padding: '16px 24px',
            textAlign: 'right',
            minWidth: '220px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#6ee7b7', letterSpacing: '0.05em' }}>
              Available Commission
            </span>
            <button
              type="button"
              onClick={() => {
                fetchOverview();
                onRefresh();
              }}
              disabled={isLoading}
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: 'none',
                color: '#ffffff',
                borderRadius: '6px',
                padding: '3px 8px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="Refresh Commission Balance"
            >
              <i className={`fa-solid fa-arrows-rotate ${isLoading ? 'fa-spin' : ''}`}></i>
              <span>Refresh</span>
            </button>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 900, color: '#fcd34d', margin: '4px 0' }}>
            {Number(currentCommission).toFixed(2)}{' '}
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>ETB</span>
          </div>
          <div style={{ fontSize: '11px', color: '#a7f3d0' }}>
            🔒 Safe & Instant Settlement
          </div>
        </div>
      </div>

      {/* Commission Multi-Rail Breakdown & Live Rates */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '20px 24px',
          marginBottom: '24px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}
      >
        {/* Card 1: Deposit Commission */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px', background: '#f0fdf4', borderRadius: '12px', border: '1px solid #dcfce7' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#dcfce7', color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>
            📥
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Deposit Fee (+5%)
            </div>
            <div style={{ fontSize: '18px', fontWeight: 900, color: '#14532d', margin: '2px 0' }}>
              +{Number(overview?.depositCommission || 0).toFixed(2)} <span style={{ fontSize: '12px', fontWeight: 700 }}>ETB</span>
            </div>
            <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700 }}>
              {overview?.depositCount ?? 0} player cash-ins settled
            </div>
          </div>
        </div>

        {/* Card 2: Withdrawal Bonus */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px', background: '#eff6ff', borderRadius: '12px', border: '1px solid #dbeafe' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#dbeafe', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>
            📤
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Cashout Fee (+2%)
            </div>
            <div style={{ fontSize: '18px', fontWeight: 900, color: '#1e3a8a', margin: '2px 0' }}>
              +{Number(overview?.withdrawalCommission || 0).toFixed(2)} <span style={{ fontSize: '12px', fontWeight: 700 }}>ETB</span>
            </div>
            <div style={{ fontSize: '11px', color: '#2563eb', fontWeight: 700 }}>
              {overview?.withdrawalCount ?? 0} payouts disbursed
            </div>
          </div>
        </div>

        {/* Card 3: Total Lifetime Commission */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px', background: '#fefce8', borderRadius: '12px', border: '1px solid #fef08a' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#fef08a', color: '#a16207', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>
            🪙
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#854d0e', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Lifetime Earned
            </div>
            <div style={{ fontSize: '18px', fontWeight: 900, color: '#713f12', margin: '2px 0' }}>
              {Number(overview?.lifetimeEarned || 0).toFixed(2)} <span style={{ fontSize: '12px', fontWeight: 700 }}>ETB</span>
            </div>
            <div style={{ fontSize: '11px', color: '#ca8a04', fontWeight: 700 }}>
              Combined Inbound + Outbound
            </div>
          </div>
        </div>

        {/* Card 4: Float Conversion Rules */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#e2e8f0', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>
            ⚡
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Conversion & Payout
            </div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: '2px 0' }}>
              Min 50 ETB to Float
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>
              Min 100 ETB for Bank Payout
            </div>
          </div>
        </div>
      </div>

      {/* Two Main Option Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '28px' }}>
        {/* OPTION A: 1-Click Convert to Float */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '18px',
            border: '1px solid #e2e8f0',
            padding: '24px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: '#fef3c7',
                  color: '#b45309',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px'
                }}
              >
                ⚡
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                  Convert to Working Float
                </h3>
                <span style={{ fontSize: '11px', color: '#059669', fontWeight: 700 }}>
                  ✓ Instant 0-Second Execution
                </span>
              </div>
            </div>

            <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.5, margin: '0 0 16px 0' }}>
              Turn your earned commission into float immediately so you can continue approving player deposits and processing games with zero downtime.
            </p>
          </div>

          <div>
            <button
              type="button"
              onClick={() => {
                setConvertAmount(Math.min(500, Math.floor(currentCommission)) || 50);
                setIsConvertModalOpen(true);
              }}
              disabled={currentCommission < 50}
              style={{
                width: '100%',
                padding: '13px',
                borderRadius: '12px',
                background: currentCommission >= 50 ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : '#e2e8f0',
                color: currentCommission >= 50 ? '#000000' : '#94a3b8',
                fontWeight: 800,
                fontSize: '14px',
                border: 'none',
                cursor: currentCommission >= 50 ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: currentCommission >= 50 ? '0 4px 14px rgba(245, 158, 11, 0.3)' : 'none'
              }}
            >
              <span>⚡ Instant Convert to Float</span>
            </button>
            <div style={{ marginTop: '8px', fontSize: '11px', textAlign: 'center', color: currentCommission >= 50 ? '#059669' : '#b45309', fontWeight: 700 }}>
              {currentCommission >= 50
                ? '✓ Ready to convert directly into working float'
                : `⚠️ Min 50 ETB required (${(50 - currentCommission).toFixed(2)} ETB needed)`}
            </div>
          </div>
        </div>

        {/* OPTION B: Request Admin Payout */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '18px',
            border: '1px solid #e2e8f0',
            padding: '24px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: '#e0f2fe',
                  color: '#0369a1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px'
                }}
              >
                🏦
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                  Request Admin Bank Transfer
                </h3>
                <span style={{ fontSize: '11px', color: '#0284c7', fontWeight: 700 }}>
                  ✓ Telebirr or CBE Bank Payout
                </span>
              </div>
            </div>

            <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.5, margin: '0 0 16px 0' }}>
              Request platform headquarters to disburse your commissions directly to your personal Telebirr phone or CBE bank account.
            </p>
          </div>

          <div>
            <button
              type="button"
              onClick={() => {
                setPayoutAmount(Math.min(1000, Math.floor(currentCommission)) || 100);
                setIsPayoutModalOpen(true);
              }}
              disabled={currentCommission < 100}
              style={{
                width: '100%',
                padding: '13px',
                borderRadius: '12px',
                background: currentCommission >= 100 ? '#0284c7' : '#e2e8f0',
                color: currentCommission >= 100 ? '#ffffff' : '#94a3b8',
                fontWeight: 800,
                fontSize: '14px',
                border: 'none',
                cursor: currentCommission >= 100 ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: currentCommission >= 100 ? '0 4px 14px rgba(2, 132, 199, 0.3)' : 'none'
              }}
            >
              <span>🏦 Request Bank Payout</span>
            </button>
            <div style={{ marginTop: '8px', fontSize: '11px', textAlign: 'center', color: currentCommission >= 100 ? '#0284c7' : '#64748b', fontWeight: 700 }}>
              {currentCommission >= 100
                ? '✓ Ready for direct Telebirr or CBE bank disbursement'
                : `⚠️ Min 100 ETB required (${(100 - currentCommission).toFixed(2)} ETB needed)`}
            </div>
          </div>
        </div>
      </div>

      {/* History Table: Recent Cashout Requests */}
      <div style={{ background: '#ffffff', borderRadius: '18px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
            Commission Payout History
          </h3>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            {(overview?.recentPayoutRequests || []).length} records
          </span>
        </div>

        {(overview?.recentPayoutRequests || []).length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
            No admin cash-out requests submitted yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                  <th style={{ padding: '12px 20px', fontWeight: 700 }}>Status</th>
                  <th style={{ padding: '12px 20px', fontWeight: 700 }}>Amount</th>
                  <th style={{ padding: '12px 20px', fontWeight: 700 }}>Payout Rail</th>
                  <th style={{ padding: '12px 20px', fontWeight: 700 }}>Account</th>
                  <th style={{ padding: '12px 20px', fontWeight: 700 }}>Admin Ref</th>
                  <th style={{ padding: '12px 20px', fontWeight: 700 }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {overview.recentPayoutRequests.map((req: any, i: number) => (
                  <tr
                    key={req.id}
                    style={{
                      borderBottom: i < overview.recentPayoutRequests.length - 1 ? '1px solid #f1f5f9' : 'none'
                    }}
                  >
                    <td style={{ padding: '12px 20px' }}>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: '14px',
                          fontSize: '11px',
                          fontWeight: 800,
                          background: req.status === 'approved' ? '#dcfce7' : req.status === 'rejected' ? '#fee2e2' : '#fef3c7',
                          color: req.status === 'approved' ? '#15803d' : req.status === 'rejected' ? '#b91c1c' : '#b45309'
                        }}
                      >
                        {req.status === 'approved' ? '✓ Paid' : req.status === 'rejected' ? '✕ Rejected' : '⏳ Pending'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 20px', fontWeight: 900, color: '#0f172a' }}>
                      {Number(req.amount).toFixed(2)} ETB
                    </td>
                    <td style={{ padding: '12px 20px', color: '#0284c7', fontWeight: 700 }}>
                      {req.payoutMethod}
                    </td>
                    <td style={{ padding: '12px 20px', fontFamily: 'monospace', color: '#475569' }}>
                      {req.payoutAccount}
                    </td>
                    <td style={{ padding: '12px 20px', fontFamily: 'monospace', color: req.status === 'rejected' ? '#dc2626' : '#64748b' }}>
                      {req.adminTxRef || req.adminNotes || '—'}
                    </td>
                    <td style={{ padding: '12px 20px', color: '#94a3b8', fontSize: '12px' }}>
                      {new Date(req.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: CONVERT TO FLOAT */}
      {isConvertModalOpen && (
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
            padding: '16px'
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              padding: '24px',
              width: '100%',
              maxWidth: '420px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '18px' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: '#fef3c7',
                  color: '#b45309',
                  fontSize: '26px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px'
                }}
              >
                ⚡
              </div>
              <h3 style={{ fontSize: '19px', fontWeight: 900, color: '#0f172a', margin: '0 0 6px 0' }}>
                Instant Convert to Float
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                Transfer commissions into float instantly with 0 waiting time.
              </p>
            </div>

            <form onSubmit={handleConvert}>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                  <span style={{ color: '#64748b' }}>Convert Amount (ETB):</span>
                  <span style={{ color: '#059669', fontWeight: 700 }}>
                    Max: {Number(currentCommission).toFixed(2)} ETB
                  </span>
                </div>
                <input
                  type="number"
                  min="50"
                  max={Math.floor(currentCommission)}
                  value={convertAmount || ''}
                  onChange={e => setConvertAmount(Number(e.target.value))}
                  required
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '18px',
                    fontWeight: 900,
                    textAlign: 'center'
                  }}
                />
              </div>

              {/* Quick Pills */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                {[50, 100, 200, 500].filter(val => val <= Math.floor(currentCommission)).map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setConvertAmount(val)}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '8px',
                      background: convertAmount === val ? '#f59e0b' : '#f1f5f9',
                      color: convertAmount === val ? '#000000' : '#475569',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    {val} ETB
                  </button>
                ))}
                {Math.floor(currentCommission) >= 50 && (
                  <button
                    type="button"
                    onClick={() => setConvertAmount(Math.floor(currentCommission))}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '8px',
                      background: convertAmount === Math.floor(currentCommission) ? '#f59e0b' : '#f1f5f9',
                      color: convertAmount === Math.floor(currentCommission) ? '#000000' : '#475569',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    Max ({Math.floor(currentCommission)})
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsConvertModalOpen(false)}
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
                  type="submit"
                  disabled={isConverting || convertAmount < 50 || convertAmount > currentCommission}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '10px',
                    background: '#f59e0b',
                    border: 'none',
                    color: '#000000',
                    fontWeight: 800,
                    fontSize: '13px',
                    cursor: 'pointer',
                    opacity: isConverting ? 0.6 : 1
                  }}
                >
                  {isConverting ? 'Converting...' : 'Confirm Convert'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: REQUEST ADMIN BANK PAYOUT */}
      {isPayoutModalOpen && (
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
            padding: '16px'
          }}
        >
          <div
            style={{
              background: '#ffffff',
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
                  background: '#e0f2fe',
                  color: '#0284c7',
                  fontSize: '26px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px'
                }}
              >
                🏦
              </div>
              <h3 style={{ fontSize: '19px', fontWeight: 900, color: '#0f172a', margin: '0 0 6px 0' }}>
                Request Admin Cashout
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                Platform admin will transfer your commission to your account within 2-4 hours.
              </p>
            </div>

            <form onSubmit={handleRequestPayout} className="space-y-4">
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                  <span style={{ color: '#64748b' }}>Amount (Min 100 ETB):</span>
                  <span style={{ color: '#0284c7', fontWeight: 700 }}>
                    Max: {Number(currentCommission).toFixed(2)} ETB
                  </span>
                </div>
                <input
                  type="number"
                  min="100"
                  max={Math.floor(currentCommission)}
                  value={payoutAmount || ''}
                  onChange={e => setPayoutAmount(Number(e.target.value))}
                  required
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '18px',
                    fontWeight: 900,
                    textAlign: 'center'
                  }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  Payout Method:
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(['Telebirr', 'CBE', 'CBEBirr'] as const).map(method => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPayoutMethod(method)}
                      style={{
                        flex: 1,
                        padding: '10px 8px',
                        borderRadius: '10px',
                        background: payoutMethod === method ? (method === 'Telebirr' ? '#0072ce' : '#d97706') : '#f1f5f9',
                        color: payoutMethod === method ? '#ffffff' : '#475569',
                        border: 'none',
                        fontWeight: 800,
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      {method === 'Telebirr' ? (
                        <TelebirrLogo size={18} />
                      ) : (
                        <CBELogo size={18} />
                      )}
                      <span>{method === 'CBEBirr' ? 'CBE Birr' : method}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  Receiving Phone / Account Number:
                </label>
                <input
                  type="text"
                  value={payoutAccount}
                  onChange={e => setPayoutAccount(e.target.value)}
                  placeholder="e.g. 0911223344 or 1000123456"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  Account Holder Full Name:
                </label>
                <input
                  type="text"
                  value={payoutAccountName}
                  onChange={e => setPayoutAccountName(e.target.value)}
                  placeholder="e.g. Abebe Kebede"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsPayoutModalOpen(false)}
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
                  type="submit"
                  disabled={isSubmittingPayout || payoutAmount < 100 || payoutAmount > currentCommission}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '10px',
                    background: '#0284c7',
                    border: 'none',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '13px',
                    cursor: 'pointer',
                    opacity: isSubmittingPayout ? 0.6 : 1
                  }}
                >
                  {isSubmittingPayout ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
