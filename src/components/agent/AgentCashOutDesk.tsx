import React, { useState } from 'react';
import { apiClient } from '../../services/apiClient.ts';

interface AgentCashOutDeskProps {
  onPayoutSuccess: () => void;
  showToast: (msg: string) => void;
}

export const AgentCashOutDesk: React.FC<AgentCashOutDeskProps> = ({
  onPayoutSuccess,
  showToast
}) => {
  const [voucherCode, setVoucherCode] = useState('');
  const [verifiedVoucher, setVerifiedVoucher] = useState<any | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [receipt, setReceipt] = useState<any | null>(null);

  const handleVerifyVoucher = async () => {
    if (!voucherCode.trim()) {
      showToast('⚠️ Please enter a 6-character voucher code.');
      return;
    }

    try {
      setIsVerifying(true);
      const res = await apiClient.agent.verifyCashoutVoucher(voucherCode.trim());
      if (res.success && res.voucher) {
        setVerifiedVoucher(res.voucher);
        showToast('✅ Voucher verified! Ready for counter payout.');
      }
    } catch (err: any) {
      setVerifiedVoucher(null);
      showToast(`❌ ${err.message || 'Invalid voucher code'}`);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleConfirmRedeem = async () => {
    if (!verifiedVoucher) return;

    try {
      setIsRedeeming(true);
      const res = await apiClient.agent.redeemCashoutVoucher(verifiedVoucher.voucherCode);
      if (res.success) {
        setReceipt({
          refCode: res.referenceCode,
          voucherCode: res.voucherCode,
          playerName: res.playerName,
          playerPhone: res.playerPhone,
          amount: res.payoutAmount,
          commission: res.commissionEarned,
          newFloat: res.newAgentBalance,
          date: new Date().toLocaleTimeString()
        });

        showToast(`🎉 Payout confirmed! Received +${res.commissionEarned.toFixed(2)} ETB cashier fee.`);
        setVerifiedVoucher(null);
        setVoucherCodeInput('');
        onPayoutSuccess();
      }
    } catch (err: any) {
      showToast(`❌ ${err.message || 'Voucher payout failed'}`);
    } finally {
      setIsRedeeming(false);
    }
  };

  const setVoucherCodeInput = (val: string) => {
    setVoucherCode(val);
    if (verifiedVoucher) setVerifiedVoucher(null);
  };

  return (
    <div className="max-w-xl mx-auto">
      <div className="sonic-contrast-card">
        <div className="sonic-contrast-card-header">
          <h3>
            <span>📤</span>
            <span>Cash-Out Voucher Counter</span>
          </h3>
          <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 800 }}>
            +1.5% Agent Incentive
          </span>
        </div>

        <div className="sonic-contrast-card-body">
          <p style={{ fontSize: '12px', color: '#64748b', marginTop: 0, marginBottom: '16px', lineHeight: 1.5 }}>
            Enter the 6-character voucher code presented by the player to verify and disburse physical cash or Telebirr.
          </p>

          {/* Voucher Code Input */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
              Player Cash-Out Voucher Code
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="sonic-input-field"
                placeholder="e.g. CW-849201"
                style={{
                  fontFamily: 'monospace',
                  fontSize: '18px',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  letterSpacing: '2px'
                }}
                value={voucherCode}
                onChange={e => setVoucherCodeInput(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && handleVerifyVoucher()}
              />
              <button
                type="button"
                onClick={handleVerifyVoucher}
                disabled={isVerifying || !voucherCode.trim()}
                style={{
                  background: '#047857',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '0 20px',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {isVerifying ? 'Checking...' : 'Verify'}
              </button>
            </div>
          </div>

          {/* Verified Voucher Preview */}
          {verifiedVoucher && (
            <div style={{
              background: '#ecfdf5',
              border: '2px solid #10b981',
              borderRadius: '14px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '11px', fontWeight: 900, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  ✓ VALID CASHOUT VOUCHER
                </span>
                <span style={{
                  background: '#047857',
                  color: '#ffffff',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  fontWeight: 800
                }}>
                  {verifiedVoucher.voucherCode}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs mb-3">
                <div>
                  <span style={{ color: '#64748b' }}>Player Full Name:</span>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>{verifiedVoucher.playerName}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Player Phone Number:</span>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace' }}>{verifiedVoucher.playerPhone}</div>
                </div>
              </div>

              <div style={{
                background: '#ffffff',
                border: '1px solid #a7f3d0',
                borderRadius: '10px',
                padding: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px'
              }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Cash to Hand Player:</span>
                  <div style={{ fontSize: '26px', fontWeight: 900, color: '#047857' }}>
                    {verifiedVoucher.amount.toFixed(2)} ETB
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '11px', color: '#b45309', fontWeight: 800 }}>+1.5% Agent Incentive:</span>
                  <div style={{ fontSize: '16px', fontWeight: 900, color: '#b45309' }}>
                    +{(verifiedVoucher.amount * 0.015).toFixed(2)} ETB
                  </div>
                </div>
              </div>

              <p style={{ fontSize: '11px', color: '#065f46', margin: '0 0 14px 0', lineHeight: 1.5 }}>
                💡 Hand <strong>{verifiedVoucher.amount.toFixed(2)} ETB</strong> physical cash to the player.
                Your platform float will immediately be replenished by <strong>{(verifiedVoucher.amount * 1.015).toFixed(2)} ETB</strong> (including your +1.5% cash-out fee).
              </p>

              <button
                type="button"
                className="sonic-btn-gold"
                onClick={handleConfirmRedeem}
                disabled={isRedeeming}
              >
                <i className={`fa-solid ${isRedeeming ? 'fa-spinner fa-spin' : 'fa-hand-holding-dollar'}`}></i>
                <span>{isRedeeming ? 'Redeeming...' : `Confirm Cash Handout & Redeem (${verifiedVoucher.amount} ETB)`}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Payout Success Receipt Modal */}
      {receipt && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '2px solid #10b981',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
            maxWidth: '420px',
            width: '100%',
            padding: '24px',
            textAlign: 'center'
          }}>
            <span style={{ fontSize: '36px' }}>💵</span>
            <h3 style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', margin: '6px 0 2px 0' }}>
              SONIC BINGO CASHOUT RECEIPT
            </h3>
            <div style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace', marginBottom: '14px' }}>
              {receipt.refCode}
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px', fontSize: '13px', textAlign: 'left', marginBottom: '16px', lineHeight: 1.8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Voucher Code:</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#047857' }}>{receipt.voucherCode}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Player:</span>
                <strong style={{ color: '#0f172a' }}>{receipt.playerName}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '4px' }}>
                <span style={{ color: '#64748b' }}>Cash Paid Out:</span>
                <strong style={{ color: '#047857', fontSize: '15px' }}>{receipt.amount.toFixed(2)} ETB</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Cashier Fee Earned:</span>
                <strong style={{ color: '#b45309' }}>+{receipt.commission.toFixed(2)} ETB</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '4px' }}>
                <span style={{ color: '#64748b' }}>New Float Balance:</span>
                <strong style={{ color: '#047857' }}>{receipt.newFloat.toFixed(2)} ETB</strong>
              </div>
            </div>

            <button
              type="button"
              className="sonic-btn-gold"
              onClick={() => setReceipt(null)}
            >
              Done & Close Receipt
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
