import React, { useState, useEffect } from 'react';
import { apiClient } from '../../services/apiClient.ts';

interface AgentRechargeDeskProps {
  onRechargeSubmitted: () => void;
  showToast: (msg: string) => void;
}

export const AgentRechargeDesk: React.FC<AgentRechargeDeskProps> = ({
  onRechargeSubmitted,
  showToast
}) => {
  const [amount, setAmount] = useState<number>(5000);
  const [paymentMethod, setPaymentMethod] = useState<'Telebirr' | 'CBE' | 'M-Pesa'>('Telebirr');
  const [transactionCode, setTransactionCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recharges, setRecharges] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const fetchHistory = async () => {
    try {
      setIsLoadingHistory(true);
      const res = await apiClient.agent.getRecharges();
      if (res.success && res.recharges) {
        setRecharges(res.recharges);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`📋 Copied: ${label}`);
  };

  const handleSubmitRecharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount < 1000) {
      showToast('⚠️ Minimum float recharge is 1,000 ETB.');
      return;
    }
    if (!transactionCode.trim()) {
      showToast('⚠️ Please enter your transaction reference code.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await apiClient.agent.requestRecharge({
        amount,
        paymentMethod,
        transactionCode: transactionCode.trim()
      });

      if (res.success) {
        showToast('🎉 Recharge request submitted! Admin will verify and credit your float.');
        setTransactionCode('');
        fetchHistory();
        onRechargeSubmitted();
      }
    } catch (err: any) {
      showToast(`❌ ${err.message || 'Failed to submit recharge'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const quickAmounts = [1000, 2000, 5000, 10000, 20000];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 1. Recharge Submission Form */}
      <div className="sonic-contrast-card" style={{ margin: 0 }}>
        <div className="sonic-contrast-card-header">
          <h3>
            <span>🔄</span>
            <span>Request Float Replenishment</span>
          </h3>
          <span style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 800 }}>
            Min: 1,000 ETB
          </span>
        </div>

        <div className="sonic-contrast-card-body">
          <form onSubmit={handleSubmitRecharge}>
            <p style={{ fontSize: '12px', color: '#64748b', marginTop: 0, marginBottom: '16px', lineHeight: 1.5 }}>
              Transfer the desired float amount to our official Sonic accounts on the right, then enter your transaction reference below.
            </p>

            {/* Amount */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>
                  Recharge Amount (ETB)
                </label>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Min: 1,000 ETB</span>
              </div>

              <input
                type="number"
                min="1000"
                step="500"
                className="sonic-input-field"
                style={{ fontSize: '18px', fontWeight: 900, color: '#b45309', marginTop: '6px' }}
                value={amount || ''}
                onChange={e => setAmount(Number(e.target.value))}
                required
              />

              <div className="sonic-chips-row">
                {quickAmounts.map(chip => (
                  <button
                    key={chip}
                    type="button"
                    className={`sonic-chip-btn ${amount === chip ? 'selected' : ''}`}
                    onClick={() => setAmount(chip)}
                  >
                    {chip.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment Provider Selection */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
                Payment Method Used
              </label>
              <select
                className="sonic-input-field"
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value as any)}
              >
                <option value="Telebirr">Telebirr Super Agent</option>
                <option value="CBE">CBE Commercial Bank / CBE Birr</option>
                <option value="M-Pesa">M-Pesa Mobile</option>
              </select>
            </div>

            {/* Transaction Ref Code */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
                Transaction Reference / Confirmation Code
              </label>
              <input
                type="text"
                className="sonic-input-field font-mono"
                placeholder="e.g. 7839482710 or FT24..."
                value={transactionCode}
                onChange={e => setTransactionCode(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="sonic-btn-gold"
              disabled={isSubmitting || amount < 1000}
            >
              <i className={`fa-solid ${isSubmitting ? 'fa-spinner fa-spin' : 'fa-rocket'}`}></i>
              <span>{isSubmitting ? 'Submitting...' : `Submit ${amount.toLocaleString()} ETB Recharge Request`}</span>
            </button>
          </form>
        </div>
      </div>

      {/* 2. Official Accounts & Recharge History */}
      <div className="space-y-6">
        {/* Official Sonic Deposit Accounts */}
        <div className="sonic-white-card" style={{ margin: 0 }}>
          <h3 style={{ fontSize: '13px', fontWeight: 900, textTransform: 'uppercase', color: '#0f172a', margin: '0 0 12px 0' }}>
            Official Sonic Deposit Accounts
          </h3>

          <div className="space-y-3">
            {/* Telebirr Account */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '12px 14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#f59e0b' }}>📱 TELEBIRR SUPER AGENT</span>
                <div style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a', fontFamily: 'monospace', marginTop: '2px' }}>
                  0911 00 22 33
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Sonic Bingo Operations</div>
              </div>
              <button
                type="button"
                onClick={() => handleCopy('0911002233', 'Telebirr Account')}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <i className="fa-regular fa-copy"></i> Copy
              </button>
            </div>

            {/* CBE Account */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '12px 14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#3b82f6' }}>🏦 COMMERCIAL BANK OF ETHIOPIA (CBE)</span>
                <div style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a', fontFamily: 'monospace', marginTop: '2px' }}>
                  1000 2345 6789 0
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Sonic Gaming Technology</div>
              </div>
              <button
                type="button"
                onClick={() => handleCopy('1000234567890', 'CBE Account')}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <i className="fa-regular fa-copy"></i> Copy
              </button>
            </div>
          </div>
        </div>

        {/* Recent Recharge Requests Table */}
        <div className="sonic-white-card" style={{ margin: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 900, textTransform: 'uppercase', color: '#0f172a', margin: 0 }}>
              Recent Recharge Requests
            </h3>
            <button
              type="button"
              onClick={fetchHistory}
              style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
            >
              Refresh
            </button>
          </div>

          {recharges.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: '12px' }}>
              No recent recharge requests recorded.
            </div>
          ) : (
            <div style={{ maxHeight: '220px', overflowY: 'auto' }} className="space-y-2">
              {recharges.map(r => (
                <div
                  key={r.id}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '12px'
                  }}
                >
                  <div>
                    <strong style={{ color: '#0f172a', fontSize: '13px' }}>
                      {Number(r.amount).toLocaleString()} ETB
                    </strong>
                    <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                      {r.payment_method} • {r.transaction_code}
                    </div>
                  </div>

                  <span
                    style={{
                      padding: '3px 8px',
                      borderRadius: '12px',
                      fontSize: '10px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      background:
                        r.status === 'approved' ? '#ecfdf5' :
                        r.status === 'rejected' ? '#fef2f2' : '#fffbeb',
                      color:
                        r.status === 'approved' ? '#047857' :
                        r.status === 'rejected' ? '#b91c1c' : '#b45309'
                    }}
                  >
                    {r.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
