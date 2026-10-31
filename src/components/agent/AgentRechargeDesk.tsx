import React, { useState, useEffect } from 'react';
import { apiClient } from '../../services/apiClient.ts';
import { TelebirrLogo, CBELogo, MpesaLogo } from '../wallet/PaymentLogos.tsx';
import { TELEBIRR_RECEIVERS, CBE_BIRR_RECEIVER } from '../../config/paymentReceivers.ts';

interface AgentRechargeDeskProps {
  onRechargeSubmitted: () => void;
  showToast: (msg: string) => void;
}

export const AgentRechargeDesk: React.FC<AgentRechargeDeskProps> = ({
  onRechargeSubmitted,
  showToast
}) => {
  const [amount, setAmount] = useState<number>(5000);
  const [paymentMethod, setPaymentMethod] = useState<'Telebirr' | 'CBE' | 'CBEBirr' | 'M-Pesa'>('Telebirr');
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
      console.error('Error fetching recharge history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`📋 Copied ${label}: ${text}`);
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
        paymentMethod: paymentMethod === 'CBEBirr' ? 'CBE' : paymentMethod,
        transactionCode: transactionCode.trim().toUpperCase()
      });

      if (res.success) {
        showToast('🎉 Recharge request submitted! Operations team will verify and credit your float.');
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

  const quickAmounts = [1000, 2000, 5000, 10000, 20000, 50000];

  // Official Sonic deposit accounts configuration
  const officialAccounts = [
    {
      id: 'telebirr',
      rail: 'Telebirr',
      name: TELEBIRR_RECEIVERS[0]?.accountName || 'Abduurehim Sheycho',
      number: TELEBIRR_RECEIVERS[0]?.accountNumber || '0952013863',
      formatted: TELEBIRR_RECEIVERS[0]?.formattedNumber || '09 52 01 38 63',
      title: 'TELEBIRR SUPER AGENT',
      badge: '⚡ Instant Fast Track',
      color: '#0284c7',
      bg: 'rgba(2, 132, 199, 0.05)',
      border: 'rgba(2, 132, 199, 0.25)',
      logo: <TelebirrLogo size={28} />
    },
    {
      id: 'cbe',
      rail: 'CBE',
      name: 'Sonic Gaming Operations',
      number: '1000458291048',
      formatted: '1000 4582 9104 8',
      title: 'COMMERCIAL BANK OF ETHIOPIA',
      badge: '🏦 Direct Bank Transfer',
      color: '#b45309',
      bg: 'rgba(245, 158, 11, 0.05)',
      border: 'rgba(245, 158, 11, 0.25)',
      logo: <CBELogo size={28} />
    },
    {
      id: 'cbebirr',
      rail: 'CBEBirr',
      name: CBE_BIRR_RECEIVER.accountName || 'Yenegeta Atalay',
      number: CBE_BIRR_RECEIVER.accountNumber || '0998983344',
      formatted: CBE_BIRR_RECEIVER.formattedNumber || '09 98 98 33 44',
      title: 'CBE BIRR MOBILE WALLET',
      badge: '📱 Mobile Banking',
      color: '#9333ea',
      bg: 'rgba(147, 51, 234, 0.05)',
      border: 'rgba(147, 51, 234, 0.25)',
      logo: <CBELogo size={28} />
    }
  ];

  return (
    <div className="sonic-agent-desk-container" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* 1. Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          borderRadius: '18px',
          padding: '24px',
          color: '#ffffff',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.15)'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '26px' }}>🔄</span>
            <h2 style={{ fontSize: '22px', fontWeight: 900, margin: 0, letterSpacing: '-0.3px' }}>
              Request Float Replenishment
            </h2>
          </div>
          <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#94a3b8', lineHeight: 1.5 }}>
            Top up your operational working float via official Telebirr or CBE accounts. Funds are verified and credited with <strong>0% fee</strong>.
          </p>
        </div>

        <div
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '12px',
            padding: '10px 18px',
            textAlign: 'right'
          }}
        >
          <div style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 800, textTransform: 'uppercase' }}>
            Minimum Recharge
          </div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: '#ffffff' }}>
            1,000 <span style={{ fontSize: '13px', color: '#94a3b8' }}>ETB</span>
          </div>
        </div>
      </div>

      {/* 2. Main 2-Column Checkout Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px', marginBottom: '28px' }}>
        {/* LEFT COLUMN: INTERACTIVE CHECKOUT WIZARD */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '18px',
            border: '1px solid #e2e8f0',
            padding: '24px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.04)'
          }}
        >
          <form onSubmit={handleSubmitRecharge}>
            {/* Step 1: Select Payment Rail with Real Logos */}
            <div style={{ marginBottom: '22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <label style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#0f172a', color: '#ffffff', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>1</span>
                  <span>Select Payment Method</span>
                </label>
                <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 700 }}>🟢 Verified Direct Rails</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                {/* Rail 1: Telebirr */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('Telebirr')}
                  style={{
                    padding: '12px',
                    borderRadius: '12px',
                    border: paymentMethod === 'Telebirr' ? '2px solid #0284c7' : '1px solid #e2e8f0',
                    background: paymentMethod === 'Telebirr' ? 'rgba(2, 132, 199, 0.08)' : '#f8fafc',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    textAlign: 'left',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <TelebirrLogo size={26} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a' }}>Telebirr</div>
                    <div style={{ fontSize: '10px', color: '#0284c7', fontWeight: 700 }}>Super Agent</div>
                  </div>
                </button>

                {/* Rail 2: CBE Bank */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CBE')}
                  style={{
                    padding: '12px',
                    borderRadius: '12px',
                    border: paymentMethod === 'CBE' ? '2px solid #b45309' : '1px solid #e2e8f0',
                    background: paymentMethod === 'CBE' ? 'rgba(245, 158, 11, 0.08)' : '#f8fafc',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    textAlign: 'left',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <CBELogo size={26} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a' }}>CBE Bank</div>
                    <div style={{ fontSize: '10px', color: '#b45309', fontWeight: 700 }}>Commercial Bank</div>
                  </div>
                </button>

                {/* Rail 3: CBE Birr */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CBEBirr')}
                  style={{
                    padding: '12px',
                    borderRadius: '12px',
                    border: paymentMethod === 'CBEBirr' ? '2px solid #9333ea' : '1px solid #e2e8f0',
                    background: paymentMethod === 'CBEBirr' ? 'rgba(147, 51, 234, 0.08)' : '#f8fafc',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    textAlign: 'left',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <CBELogo size={26} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a' }}>CBE Birr</div>
                    <div style={{ fontSize: '10px', color: '#9333ea', fontWeight: 700 }}>Mobile Wallet</div>
                  </div>
                </button>

                {/* Rail 4: M-Pesa */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('M-Pesa')}
                  style={{
                    padding: '12px',
                    borderRadius: '12px',
                    border: paymentMethod === 'M-Pesa' ? '2px solid #dc2626' : '1px solid #e2e8f0',
                    background: paymentMethod === 'M-Pesa' ? 'rgba(220, 38, 38, 0.08)' : '#f8fafc',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    textAlign: 'left',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <MpesaLogo size={26} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a' }}>M-Pesa</div>
                    <div style={{ fontSize: '10px', color: '#dc2626', fontWeight: 700 }}>Safaricom</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Step 2: Choose Recharge Amount */}
            <div style={{ marginBottom: '22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#0f172a', color: '#ffffff', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>2</span>
                  <span>Recharge Amount (ETB)</span>
                </label>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Min: 1,000 ETB</span>
              </div>

              {/* Quick Preset Pills */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                {quickAmounts.map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setAmount(val)}
                    style={{
                      padding: '7px 12px',
                      borderRadius: '8px',
                      border: amount === val ? '1px solid #f59e0b' : '1px solid #e2e8f0',
                      background: amount === val ? '#fffbeb' : '#ffffff',
                      color: amount === val ? '#b45309' : '#475569',
                      fontWeight: 800,
                      fontSize: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {val.toLocaleString()} ETB
                  </button>
                ))}
              </div>

              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontWeight: 800, color: '#94a3b8', fontSize: '14px' }}>
                  ETB
                </span>
                <input
                  type="number"
                  min="1000"
                  step="500"
                  value={amount || ''}
                  onChange={e => setAmount(Number(e.target.value))}
                  required
                  style={{
                    width: '100%',
                    padding: '12px 14px 12px 52px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '18px',
                    fontWeight: 900,
                    color: '#0f172a',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Step 3: Transaction Reference Code */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#0f172a', color: '#ffffff', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>3</span>
                  <span>SMS Confirmation Code (Tx Ref) *</span>
                </div>
                <span style={{ fontSize: '11px', color: '#64748b' }}>From your transfer SMS</span>
              </label>

              <input
                type="text"
                placeholder="e.g. FT240987123 or TX-TB-998877"
                value={transactionCode}
                onChange={e => setTransactionCode(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  fontWeight: 800,
                  fontFamily: 'monospace',
                  color: '#0f172a',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || amount < 1000}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: '#000000',
                fontWeight: 900,
                fontSize: '15px',
                border: 'none',
                cursor: isSubmitting || amount < 1000 ? 'not-allowed' : 'pointer',
                opacity: isSubmitting || amount < 1000 ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 16px rgba(245, 158, 11, 0.3)'
              }}
            >
              <i className={`fa-solid ${isSubmitting ? 'fa-spinner fa-spin' : 'fa-bolt'}`}></i>
              <span>{isSubmitting ? 'Submitting Request...' : `Submit ${amount.toLocaleString()} ETB Recharge Request`}</span>
            </button>
          </form>
        </div>

        {/* RIGHT COLUMN: OFFICIAL SONIC DEPOSIT ACCOUNTS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              background: '#ffffff',
              borderRadius: '18px',
              border: '1px solid #e2e8f0',
              padding: '20px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.04)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 900, textTransform: 'uppercase', color: '#0f172a', margin: 0, letterSpacing: '0.05em' }}>
                Official Sonic Accounts
              </h3>
              <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 800 }}>
                🛡️ 100% Escrow Protected
              </span>
            </div>

            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 14px 0', lineHeight: 1.5 }}>
              Transfer your recharge funds to any of the verified official accounts below using your personal mobile app:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {officialAccounts.map(acc => {
                const isSelected = paymentMethod === acc.rail || (paymentMethod === 'CBE' && acc.id === 'cbe');
                return (
                  <div
                    key={acc.id}
                    style={{
                      background: isSelected ? acc.bg : '#f8fafc',
                      border: isSelected ? `2px solid ${acc.color}` : '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '14px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {acc.logo}
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: 800, color: acc.color }}>
                            {acc.title}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            {acc.name}
                          </div>
                        </div>
                      </div>

                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: '10px',
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          color: '#475569'
                        }}
                      >
                        {acc.badge}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '15px', color: '#0f172a' }}>
                        {acc.formatted}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(acc.number, acc.title)}
                        style={{
                          background: '#f1f5f9',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          padding: '4px 10px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          color: '#1e293b'
                        }}
                      >
                        <i className="fa-regular fa-copy"></i>
                        <span>Copy</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Guidance Box */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px dashed #cbd5e1',
              borderRadius: '14px',
              padding: '14px 16px',
              fontSize: '12px',
              color: '#64748b',
              lineHeight: 1.5
            }}
          >
            <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>
              💡 Quick Processing Tips:
            </div>
            • Transfers are audited automatically within 1 to 5 minutes.<br />
            • Always verify that the account name matches before confirming in your banking app.<br />
            • Your float will be credited instantly once the transaction reference is confirmed.
          </div>
        </div>
      </div>

      {/* 3. Live Recent Recharge Requests Table */}
      <div style={{ background: '#ffffff', borderRadius: '18px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 900, color: '#0f172a' }}>
              Recent Recharge Requests
            </h3>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Track the live approval status of your working float replenishments
            </span>
          </div>

          <button
            type="button"
            onClick={fetchHistory}
            style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <i className={`fa-solid fa-rotate ${isLoadingHistory ? 'fa-spin' : ''}`}></i>
            <span>Refresh</span>
          </button>
        </div>

        {recharges.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📦</div>
            <div style={{ fontWeight: 700, color: '#475569' }}>No Recharge Requests Recorded</div>
            <div style={{ fontSize: '12px', marginTop: '4px' }}>
              Submit your first float replenishment request above.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                  <th style={{ padding: '12px 20px', fontWeight: 700 }}>Status</th>
                  <th style={{ padding: '12px 20px', fontWeight: 700 }}>Amount</th>
                  <th style={{ padding: '12px 20px', fontWeight: 700 }}>Payment Rail</th>
                  <th style={{ padding: '12px 20px', fontWeight: 700 }}>Transaction Code</th>
                  <th style={{ padding: '12px 20px', fontWeight: 700 }}>Submitted At</th>
                </tr>
              </thead>
              <tbody>
                {recharges.map((r, i) => (
                  <tr
                    key={r.id}
                    style={{
                      borderBottom: i < recharges.length - 1 ? '1px solid #f1f5f9' : 'none'
                    }}
                  >
                    <td style={{ padding: '12px 20px' }}>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 800,
                          background:
                            r.status === 'approved' ? '#ecfdf5' :
                            r.status === 'rejected' ? '#fef2f2' : '#fffbeb',
                          color:
                            r.status === 'approved' ? '#047857' :
                            r.status === 'rejected' ? '#b91c1c' : '#b45309'
                        }}
                      >
                        {r.status === 'approved' ? '✓ Credited' : r.status === 'rejected' ? '✕ Rejected' : '⏳ Pending'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 20px', fontWeight: 900, color: '#0f172a' }}>
                      {Number(r.amount).toLocaleString()} ETB
                    </td>
                    <td style={{ padding: '12px 20px', fontWeight: 700, color: '#475569' }}>
                      {r.payment_method}
                    </td>
                    <td style={{ padding: '12px 20px', fontFamily: 'monospace', color: '#0f172a' }}>
                      {r.transaction_code}
                    </td>
                    <td style={{ padding: '12px 20px', color: '#94a3b8', fontSize: '12px' }}>
                      {new Date(r.created_at).toLocaleString()}
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
