import React, { useState, useEffect } from 'react';
import { apiClient } from '../../services/apiClient.ts';
import { TelebirrLogo, CBELogo, MpesaLogo } from '../wallet/PaymentLogos.tsx';

interface AgentProfileDeskProps {
  profile: any;
  showToast: (msg: string) => void;
  onRefreshProfile?: () => void;
  onNavigateTab?: (tab: any) => void;
}

export const AgentProfileDesk: React.FC<AgentProfileDeskProps> = ({
  profile,
  showToast,
  onRefreshProfile,
  onNavigateTab
}) => {
  // Security PIN State
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isUpdatingPin, setIsUpdatingPin] = useState(false);

  // Password Visibility Toggles
  const [showCurrentPin, setShowCurrentPin] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);

  // Dynamic Payment Rails State (Real DB Configured Accounts)
  const [paymentAccounts, setPaymentAccounts] = useState({
    telebirr: { accountNumber: '', accountName: '', isActive: true },
    cbe: { accountNumber: '', accountName: '', isActive: true },
    mpesa: { accountNumber: '', accountName: '', isActive: false }
  });
  const [supportedRails, setSupportedRails] = useState<string[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState<boolean>(true);
  const [isSavingAccounts, setIsSavingAccounts] = useState<boolean>(false);

  // Load configured payment accounts on mount
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        setIsLoadingAccounts(true);
        const res = await apiClient.agent.getPaymentAccounts();
        if (res.success && res.accounts) {
          setPaymentAccounts(res.accounts);
          setSupportedRails(res.supportedRails || []);
        }
      } catch (err: any) {
        console.warn('Failed to load payment accounts:', err);
      } finally {
        setIsLoadingAccounts(false);
      }
    };

    fetchAccounts();
  }, []);

  const handleSaveAccounts = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check at least one active
    const hasActive =
      (paymentAccounts.telebirr.isActive && paymentAccounts.telebirr.accountNumber.trim()) ||
      (paymentAccounts.cbe.isActive && paymentAccounts.cbe.accountNumber.trim()) ||
      (paymentAccounts.mpesa.isActive && paymentAccounts.mpesa.accountNumber.trim());

    if (!hasActive) {
      showToast('⚠️ You must have at least one active payment rail (Telebirr, CBE, or M-Pesa) configured.');
      return;
    }

    try {
      setIsSavingAccounts(true);
      const res = await apiClient.agent.updatePaymentAccounts(paymentAccounts);
      if (res.success) {
        showToast('✅ Official payment accounts saved and live!');
        setPaymentAccounts(res.accounts);
        setSupportedRails(res.supportedRails);
        if (onRefreshProfile) onRefreshProfile();
      } else {
        showToast(`❌ ${res.error || 'Failed to update accounts'}`);
      }
    } catch (err: any) {
      console.error('Update payment accounts error:', err);
      showToast(`❌ ${err.message || 'Failed to save payment accounts'}`);
    } finally {
      setIsSavingAccounts(false);
    }
  };

  // Referral Deep Link & QR
  const inviteLink = profile?.inviteLink || (profile?.agentCode ? `https://t.me/SonicGameOfficialBot?start=agent_${profile.agentCode}` : '');
  const qrUrl = inviteLink
    ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=12&data=${encodeURIComponent(inviteLink)}`
    : '';

  const handleCopyLink = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    showToast('📋 Agency referral link copied to clipboard!');
  };

  const handleCopyCode = () => {
    const code = profile?.agentCode || 'AGT-CODE';
    navigator.clipboard.writeText(code);
    showToast(`📋 Agent code ${code} copied!`);
  };

  const handleCopyPhone = () => {
    const phone = profile?.phone || '';
    if (!phone) return;
    navigator.clipboard.writeText(phone);
    showToast(`📋 Phone number ${phone} copied!`);
  };

  // Real PIN Update Handler
  const handlePinUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedNew = newPin.trim();
    const trimmedConfirm = confirmPin.trim();
    const trimmedCurrent = currentPin.trim();

    if (!trimmedCurrent) {
      showToast('❌ Please enter your current PIN or agent code');
      return;
    }
    if (!trimmedNew || trimmedNew.length < 4 || trimmedNew.length > 8) {
      showToast('❌ New PIN must be between 4 and 8 digits');
      return;
    }
    if (trimmedNew !== trimmedConfirm) {
      showToast('❌ New PIN and confirmation do not match');
      return;
    }

    try {
      setIsUpdatingPin(true);
      const res = await apiClient.agent.updatePin({
        currentPin: trimmedCurrent,
        newPin: trimmedNew
      });

      if (res.success) {
        showToast(`🔐 ${res.message || 'Security PIN updated successfully!'}`);
        setCurrentPin('');
        setNewPin('');
        setConfirmPin('');
        if (onRefreshProfile) onRefreshProfile();
      } else {
        showToast(`❌ ${res.error || 'Failed to update PIN'}`);
      }
    } catch (err: any) {
      console.error('Failed to update PIN:', err);
      showToast(`❌ ${err.message || 'Failed to update security PIN'}`);
    } finally {
      setIsUpdatingPin(false);
    }
  };

  const walletBalance = Number(profile?.walletBalance || 0);
  const lowThreshold = Number(profile?.lowBalanceThreshold || 1000);
  const isLowFloat = walletBalance <= lowThreshold;

  return (
    <div className="sonic-desk-container" style={{ maxWidth: '1240px', margin: '0 auto' }}>
      
      {/* ====================================================================
          1. FINTECH HERO IDENTITY CARD
          Separates Agent Code from Phone Number, with Glowing Badges & Live Float
          ==================================================================== */}
      <div
        className="sonic-white-card"
        style={{
          background: 'linear-gradient(180deg, #ffffff 0%, #fafafa 100%)',
          border: '1px solid #e2e8f0',
          borderRadius: '20px',
          padding: '24px 28px',
          marginBottom: '20px',
          boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.04)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
          
          {/* Left: Agent Profile Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div
              style={{
                width: '68px',
                height: '68px',
                borderRadius: '18px',
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '32px',
                boxShadow: '0 8px 20px rgba(245, 158, 11, 0.35)',
                color: '#ffffff',
                border: '2px solid rgba(255, 255, 255, 0.6)',
                flexShrink: 0
              }}
            >
              👑
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-0.4px' }}>
                  {profile?.fullName || 'Sonic Authorized Agent'}
                </h1>

                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '3px 10px',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: 800,
                    letterSpacing: '0.4px',
                    background: '#ecfdf5',
                    color: '#065f46',
                    border: '1px solid #a7f3d0'
                  }}
                >
                  <span
                    style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      background: '#10b981',
                      boxShadow: '0 0 6px rgba(16, 185, 129, 0.6)'
                    }}
                  />
                  AUTHORIZED AGENT
                </span>
              </div>

              {/* Badges Row - Cleanly Separated */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
                {/* Agent Code Badge */}
                <button
                  type="button"
                  onClick={handleCopyCode}
                  title="Click to copy Agent Code"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: '8px',
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    color: '#b45309',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <i className="fa-solid fa-id-badge" style={{ fontSize: '11px' }}></i>
                  <span>{profile?.agentCode || 'AGT-CODE'}</span>
                  <i className="fa-regular fa-copy" style={{ fontSize: '10px', opacity: 0.7 }}></i>
                </button>

                {/* Phone Badge */}
                <button
                  type="button"
                  onClick={handleCopyPhone}
                  title="Click to copy phone number"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    color: '#475569',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  <i className="fa-solid fa-phone" style={{ fontSize: '11px', color: '#64748b' }}></i>
                  <span>{profile?.phone || 'No phone set'}</span>
                </button>

                {/* VIP Partner Tier Badge */}
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '4px 10px',
                    borderRadius: '8px',
                    background: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    color: '#334155',
                    fontSize: '11px',
                    fontWeight: 800
                  }}
                >
                  <i className="fa-solid fa-star" style={{ color: '#f59e0b', fontSize: '10px' }}></i>
                  VIP Tier 1 Cashier
                </span>
              </div>
            </div>
          </div>

          {/* Right: Working Float Balance Liquidity Card */}
          <div
            style={{
              background: '#ffffff',
              border: isLowFloat ? '1px solid #fca5a5' : '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '14px 20px',
              minWidth: '240px',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.03)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Operational Working Float
              </span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  padding: '2px 6px',
                  borderRadius: '6px',
                  background: isLowFloat ? '#fee2e2' : '#ecfdf5',
                  color: isLowFloat ? '#dc2626' : '#059669'
                }}
              >
                {isLowFloat ? '⚠️ Low Reserve' : '🟢 Healthy'}
              </span>
            </div>

            <div style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px' }}>
              {walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
              <span style={{ fontSize: '14px', color: '#94a3b8', fontWeight: 700 }}>ETB</span>
            </div>

            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('recharge')}
                style={{
                  marginTop: '4px',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontWeight: 800,
                  color: '#0284c7',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px',
                  transition: 'all 0.15s ease'
                }}
              >
                <i className="fa-solid fa-bolt"></i> Replenish Float
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ====================================================================
          2. TWO-COLUMN GRID: ONBOARDING QR & SECURITY PIN TERMINAL
          ==================================================================== */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        
        {/* CARD A: AGENCY REFERRAL & ONBOARDING QR */}
        <div
          className="sonic-white-card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            borderRadius: '20px',
            border: '1px solid #e2e8f0',
            padding: '24px',
            boxShadow: '0 4px 18px rgba(0, 0, 0, 0.03)'
          }}
        >
          <div>
            {/* Card Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '10px',
                    background: '#fef3c7',
                    color: '#d97706',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px'
                  }}
                >
                  <i className="fa-solid fa-qrcode"></i>
                </span>
                <h2 style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                  Agency Referral & QR Code
                </h2>
              </div>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '3px 8px',
                  borderRadius: '8px',
                  background: '#fef3c7',
                  color: '#b45309'
                }}
              >
                +20 ETB Player Bonus
              </span>
            </div>

            <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.5, margin: '0 0 18px 0' }}>
              Display this official QR code at your shop counter. When players scan, they are instantly registered to your agency and receive a <strong>20 ETB bonus</strong>! You earn lifetime commissions on all tickets.
            </p>

            {/* High-Res QR Code Frame */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '18px' }}>
              <div
                style={{
                  padding: '16px',
                  background: '#ffffff',
                  borderRadius: '20px',
                  border: '2px solid #f1f5f9',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.06)',
                  textAlign: 'center'
                }}
              >
                {qrUrl ? (
                  <img
                    src={qrUrl}
                    alt="Agent Counter Referral QR Code"
                    style={{ width: '190px', height: '190px', display: 'block', borderRadius: '10px' }}
                  />
                ) : (
                  <div style={{ width: '190px', height: '190px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                    Generating QR...
                  </div>
                )}
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', marginTop: '10px', letterSpacing: '0.3px' }}>
                  📱 SCAN WITH TELEGRAM CAMERA
                </div>
              </div>
            </div>

            {/* Referral Link Box */}
            <div
              style={{
                background: '#f8fafc',
                padding: '12px 14px',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                marginBottom: '18px'
              }}
            >
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>
                Telegram Deep Link:
              </div>
              <div
                style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  fontSize: '12px',
                  color: '#0f172a',
                  wordBreak: 'break-all',
                  fontWeight: 700,
                  lineHeight: 1.4
                }}
              >
                {inviteLink || 'Generating referral link...'}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="sonic-btn-gold"
              style={{ flex: 1, minWidth: '160px', padding: '12px 16px', fontSize: '13px' }}
              onClick={handleCopyLink}
            >
              <i className="fa-regular fa-copy"></i> Copy Deep Link
            </button>

            <a
              href={qrUrl}
              download={`Sonic_Agency_${profile?.agentCode || 'Counter_QR'}.png`}
              target="_blank"
              rel="noreferrer"
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '12px',
                padding: '12px 18px',
                fontSize: '13px',
                fontWeight: 800,
                color: '#334155',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                transition: 'all 0.15s ease'
              }}
            >
              <i className="fa-solid fa-download"></i> Save QR Poster
            </a>
          </div>
        </div>

        {/* CARD B: AGENT TERMINAL SECURITY PIN */}
        <div
          className="sonic-white-card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            borderRadius: '20px',
            border: '1px solid #e2e8f0',
            padding: '24px',
            boxShadow: '0 4px 18px rgba(0, 0, 0, 0.03)'
          }}
        >
          <div>
            {/* Card Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '10px',
                    background: '#e0f2fe',
                    color: '#0284c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px'
                  }}
                >
                  <i className="fa-solid fa-shield-halved"></i>
                </span>
                <h2 style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                  Terminal Security PIN
                </h2>
              </div>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '3px 8px',
                  borderRadius: '8px',
                  background: '#e0f2fe',
                  color: '#0369a1'
                }}
              >
                Bcrypt Encrypted
              </span>
            </div>

            <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.5, margin: '0 0 18px 0' }}>
              Protect your cash-in float by setting a secure 4-digit PIN for session authorization and cash-out counter payouts.
            </p>

            {/* Real PIN Update Form */}
            <form onSubmit={handlePinUpdate}>
              {/* Field 1: Current PIN */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
                  Current PIN or Agent Code
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showCurrentPin ? 'text' : 'password'}
                    className="sonic-input-field"
                    placeholder="Enter current PIN or agent code"
                    value={currentPin}
                    onChange={e => setCurrentPin(e.target.value)}
                    required
                    style={{ paddingRight: '42px', fontSize: '14px', letterSpacing: showCurrentPin ? 'normal' : '2px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPin(!showCurrentPin)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    <i className={showCurrentPin ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'}></i>
                  </button>
                </div>
              </div>

              {/* Field 2: New 4-Digit PIN */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
                  New 4-Digit Security PIN
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showNewPin ? 'text' : 'password'}
                    maxLength={8}
                    className="sonic-input-field"
                    placeholder="e.g. 5892"
                    value={newPin}
                    onChange={e => setNewPin(e.target.value)}
                    required
                    style={{ paddingRight: '42px', fontSize: '14px', letterSpacing: showNewPin ? 'normal' : '2px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPin(!showNewPin)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    <i className={showNewPin ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'}></i>
                  </button>
                </div>
              </div>

              {/* Field 3: Confirm PIN */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
                  Confirm New PIN
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showConfirmPin ? 'text' : 'password'}
                    maxLength={8}
                    className="sonic-input-field"
                    placeholder="Re-enter new PIN"
                    value={confirmPin}
                    onChange={e => setConfirmPin(e.target.value)}
                    required
                    style={{ paddingRight: '42px', fontSize: '14px', letterSpacing: showConfirmPin ? 'normal' : '2px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPin(!showConfirmPin)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    <i className={showConfirmPin ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'}></i>
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="sonic-btn-gold"
                style={{ width: '100%', padding: '13px', fontSize: '13px' }}
                disabled={isUpdatingPin}
              >
                {isUpdatingPin ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i> Updating Security PIN...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-lock"></i> Update Terminal PIN
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Security Notice */}
          <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#64748b' }}>
            <i className="fa-solid fa-circle-check" style={{ color: '#10b981' }}></i>
            <span>PIN is salted & hashed via bcrypt. Admins cannot view your PIN.</span>
          </div>
        </div>
      </div>

      {/* ====================================================================
          3. CONFIGURED PAYMENT RAILS & RECEIVING ACCOUNTS (NO HARDCODING)
          ==================================================================== */}
      <div
        className="sonic-white-card"
        style={{
          borderRadius: '20px',
          border: '1px solid #e2e8f0',
          padding: '24px',
          marginBottom: '24px',
          boxShadow: '0 4px 18px rgba(0, 0, 0, 0.03)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '10px',
                background: '#fef3c7',
                color: '#d97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px'
              }}
            >
              <i className="fa-solid fa-building-columns"></i>
            </span>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                Receiving & Cashout Payment Rails
              </h2>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Configure your official mobile & bank accounts for player deposits and counter cashouts.
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {supportedRails.length > 0 ? (
              supportedRails.map(rail => (
                <span
                  key={rail}
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '3px 8px',
                    borderRadius: '8px',
                    background: '#ecfdf5',
                    color: '#059669',
                    border: '1px solid #a7f3d0'
                  }}
                >
                  🟢 {rail}
                </span>
              ))
            ) : (
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#dc2626' }}>
                ⚠️ No Active Rails
              </span>
            )}
          </div>
        </div>

        <form onSubmit={handleSaveAccounts}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            
            {/* 1. Telebirr Account Card */}
            <div
              style={{
                background: paymentAccounts.telebirr.isActive ? '#ffffff' : '#f8fafc',
                border: paymentAccounts.telebirr.isActive ? '1.5px solid #0284c7' : '1px solid #e2e8f0',
                borderRadius: '16px',
                padding: '18px',
                boxShadow: paymentAccounts.telebirr.isActive ? '0 4px 14px rgba(2, 132, 199, 0.08)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <TelebirrLogo size={24} />
                  <div>
                    <strong style={{ fontSize: '14px', color: '#0f172a' }}>Telebirr Mobile Wallet</strong>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Fast track mobile deposits</div>
                  </div>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 800 }}>
                  <input
                    type="checkbox"
                    checked={paymentAccounts.telebirr.isActive}
                    onChange={e =>
                      setPaymentAccounts(prev => ({
                        ...prev,
                        telebirr: { ...prev.telebirr, isActive: e.target.checked }
                      }))
                    }
                    style={{ width: '16px', height: '16px', accentColor: '#0284c7', cursor: 'pointer' }}
                  />
                  <span style={{ color: paymentAccounts.telebirr.isActive ? '#0284c7' : '#94a3b8' }}>
                    {paymentAccounts.telebirr.isActive ? 'Active' : 'Off'}
                  </span>
                </label>
              </div>

              <div style={{ opacity: paymentAccounts.telebirr.isActive ? 1 : 0.6 }}>
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#475569', marginBottom: '4px' }}>
                    Telebirr Phone Number
                  </label>
                  <input
                    type="text"
                    className="sonic-input-field"
                    placeholder="e.g. 09 52 01 38 63"
                    value={paymentAccounts.telebirr.accountNumber}
                    disabled={!paymentAccounts.telebirr.isActive}
                    onChange={e =>
                      setPaymentAccounts(prev => ({
                        ...prev,
                        telebirr: { ...prev.telebirr, accountNumber: e.target.value }
                      }))
                    }
                    style={{ padding: '8px 12px', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#475569', marginBottom: '4px' }}>
                    Registered Account Holder Name
                  </label>
                  <input
                    type="text"
                    className="sonic-input-field"
                    placeholder="e.g. Abduurehim Sheycho"
                    value={paymentAccounts.telebirr.accountName}
                    disabled={!paymentAccounts.telebirr.isActive}
                    onChange={e =>
                      setPaymentAccounts(prev => ({
                        ...prev,
                        telebirr: { ...prev.telebirr, accountName: e.target.value }
                      }))
                    }
                    style={{ padding: '8px 12px', fontSize: '13px' }}
                  />
                </div>
              </div>
            </div>

            {/* 2. CBE Bank Account Card */}
            <div
              style={{
                background: paymentAccounts.cbe.isActive ? '#ffffff' : '#f8fafc',
                border: paymentAccounts.cbe.isActive ? '1.5px solid #8b5cf6' : '1px solid #e2e8f0',
                borderRadius: '16px',
                padding: '18px',
                boxShadow: paymentAccounts.cbe.isActive ? '0 4px 14px rgba(139, 92, 246, 0.08)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <CBELogo size={24} />
                  <div>
                    <strong style={{ fontSize: '14px', color: '#0f172a' }}>Commercial Bank of Ethiopia</strong>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Direct CBE bank transfer</div>
                  </div>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 800 }}>
                  <input
                    type="checkbox"
                    checked={paymentAccounts.cbe.isActive}
                    onChange={e =>
                      setPaymentAccounts(prev => ({
                        ...prev,
                        cbe: { ...prev.cbe, isActive: e.target.checked }
                      }))
                    }
                    style={{ width: '16px', height: '16px', accentColor: '#8b5cf6', cursor: 'pointer' }}
                  />
                  <span style={{ color: paymentAccounts.cbe.isActive ? '#8b5cf6' : '#94a3b8' }}>
                    {paymentAccounts.cbe.isActive ? 'Active' : 'Off'}
                  </span>
                </label>
              </div>

              <div style={{ opacity: paymentAccounts.cbe.isActive ? 1 : 0.6 }}>
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#475569', marginBottom: '4px' }}>
                    13-Digit CBE Account Number
                  </label>
                  <input
                    type="text"
                    className="sonic-input-field"
                    placeholder="e.g. 1000 4582 9104 8"
                    value={paymentAccounts.cbe.accountNumber}
                    disabled={!paymentAccounts.cbe.isActive}
                    onChange={e =>
                      setPaymentAccounts(prev => ({
                        ...prev,
                        cbe: { ...prev.cbe, accountNumber: e.target.value }
                      }))
                    }
                    style={{ padding: '8px 12px', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#475569', marginBottom: '4px' }}>
                    Bank Account Holder Full Name
                  </label>
                  <input
                    type="text"
                    className="sonic-input-field"
                    placeholder="e.g. Sonic Gaming Operations"
                    value={paymentAccounts.cbe.accountName}
                    disabled={!paymentAccounts.cbe.isActive}
                    onChange={e =>
                      setPaymentAccounts(prev => ({
                        ...prev,
                        cbe: { ...prev.cbe, accountName: e.target.value }
                      }))
                    }
                    style={{ padding: '8px 12px', fontSize: '13px' }}
                  />
                </div>
              </div>
            </div>

            {/* 3. Safaricom M-Pesa Card */}
            <div
              style={{
                background: paymentAccounts.mpesa.isActive ? '#ffffff' : '#f8fafc',
                border: paymentAccounts.mpesa.isActive ? '1.5px solid #10b981' : '1px solid #e2e8f0',
                borderRadius: '16px',
                padding: '18px',
                boxShadow: paymentAccounts.mpesa.isActive ? '0 4px 14px rgba(16, 185, 129, 0.08)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <MpesaLogo size={24} />
                  <div>
                    <strong style={{ fontSize: '14px', color: '#0f172a' }}>Safaricom M-Pesa</strong>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Instant mobile settlement</div>
                  </div>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 800 }}>
                  <input
                    type="checkbox"
                    checked={paymentAccounts.mpesa.isActive}
                    onChange={e =>
                      setPaymentAccounts(prev => ({
                        ...prev,
                        mpesa: { ...prev.mpesa, isActive: e.target.checked }
                      }))
                    }
                    style={{ width: '16px', height: '16px', accentColor: '#10b981', cursor: 'pointer' }}
                  />
                  <span style={{ color: paymentAccounts.mpesa.isActive ? '#10b981' : '#94a3b8' }}>
                    {paymentAccounts.mpesa.isActive ? 'Active' : 'Off'}
                  </span>
                </label>
              </div>

              <div style={{ opacity: paymentAccounts.mpesa.isActive ? 1 : 0.6 }}>
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#475569', marginBottom: '4px' }}>
                    M-Pesa Phone Number
                  </label>
                  <input
                    type="text"
                    className="sonic-input-field"
                    placeholder="e.g. 07 12 34 56 78"
                    value={paymentAccounts.mpesa.accountNumber}
                    disabled={!paymentAccounts.mpesa.isActive}
                    onChange={e =>
                      setPaymentAccounts(prev => ({
                        ...prev,
                        mpesa: { ...prev.mpesa, accountNumber: e.target.value }
                      }))
                    }
                    style={{ padding: '8px 12px', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#475569', marginBottom: '4px' }}>
                    M-Pesa Account Holder Name
                  </label>
                  <input
                    type="text"
                    className="sonic-input-field"
                    placeholder="e.g. Sonic Safaricom Payout"
                    value={paymentAccounts.mpesa.accountName}
                    disabled={!paymentAccounts.mpesa.isActive}
                    onChange={e =>
                      setPaymentAccounts(prev => ({
                        ...prev,
                        mpesa: { ...prev.mpesa, accountName: e.target.value }
                      }))
                    }
                    style={{ padding: '8px 12px', fontSize: '13px' }}
                  />
                </div>
              </div>
            </div>

          </div>

          {/* Action Row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              💡 <strong>Counter Tip:</strong> Players will only be presented with the payment options you have enabled above.
            </div>

            <button
              type="submit"
              className="sonic-btn-gold"
              style={{ width: 'auto', minWidth: '220px', padding: '12px 24px', fontSize: '13px' }}
              disabled={isSavingAccounts || isLoadingAccounts}
            >
              {isSavingAccounts ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i> Saving Payment Accounts...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-floppy-disk"></i> Save & Update Payment Rails
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* ====================================================================
          4. AGENCY PARAMETERS & COMMISSION STRUCTURE (FINTECH CARDS)
          ==================================================================== */}
      <div
        className="sonic-white-card"
        style={{
          borderRadius: '20px',
          border: '1px solid #e2e8f0',
          padding: '24px',
          marginBottom: '24px',
          boxShadow: '0 4px 18px rgba(0, 0, 0, 0.03)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '10px',
                background: '#ecfdf5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px'
              }}
            >
              <i className="fa-solid fa-chart-pie"></i>
            </span>
            <h2 style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a', margin: 0 }}>
              Agency Parameters & Commission Ledger
            </h2>
          </div>
          <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b' }}>
            Authoritative Settlement Rates
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          {/* Card 1: Cashier Deposit Fee */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>
                Player Cash-In Fee
              </span>
              <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '6px', background: '#fef3c7', color: '#b45309' }}>
                Instant
              </span>
            </div>
            <div style={{ fontSize: '22px', fontWeight: 900, color: '#d97706' }}>
              +{profile?.commissionRate || 5}.0%
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.4 }}>
              Credited instantly to your commission wallet for every counter deposit.
            </div>
          </div>

          {/* Card 2: Voucher Cashout Fee */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>
                Voucher Cash-Out Fee
              </span>
              <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '6px', background: '#ecfdf5', color: '#059669' }}>
                Instant
              </span>
            </div>
            <div style={{ fontSize: '22px', fontWeight: 900, color: '#059669' }}>
              +2.0%
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.4 }}>
              Instant counter incentive for verifying vouchers and handing out physical cash.
            </div>
          </div>

          {/* Card 3: Low Float Alert Buffer */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>
                Low Float Alert
              </span>
              <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '6px', background: '#fee2e2', color: '#dc2626' }}>
                Warning Buffer
              </span>
            </div>
            <div style={{ fontSize: '22px', fontWeight: 900, color: '#dc2626' }}>
              {(profile?.lowBalanceThreshold || 1000).toLocaleString()} <span style={{ fontSize: '13px', color: '#94a3b8' }}>ETB</span>
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.4 }}>
              Terminal warning flags when liquidity drops below this safety buffer.
            </div>
          </div>

          {/* Card 4: Target Monthly Volume */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>
                Target Volume
              </span>
              <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '6px', background: '#e0f2fe', color: '#0284c7' }}>
                Monthly
              </span>
            </div>
            <div style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a' }}>
              {(profile?.targetMonthly || 50000).toLocaleString()} <span style={{ fontSize: '13px', color: '#94a3b8' }}>ETB</span>
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.4 }}>
              Achieving target volume unlocks VIP tier status and higher commissions.
            </div>
          </div>
        </div>
      </div>

      {/* ====================================================================
          4. OPERATIONAL STANDARDS & COMPLIANCE BANNER
          ==================================================================== */}
      <div
        className="sonic-white-card"
        style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '20px',
          padding: '24px 28px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
          
          {/* Rules List */}
          <div style={{ flex: 1, minWidth: '300px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <span style={{ fontSize: '18px' }}>🛡️</span>
              <h2 style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                Sonic Bingo Agency Compliance & Operational Rules
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ fontWeight: 900, color: '#0284c7' }}>1.</span>
                <span>
                  <strong>SMS & Cash Verification First:</strong> Always verify incoming Telebirr/CBE SMS or receive physical cash in hand before executing player cash-in.
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ fontWeight: 900, color: '#059669' }}>2.</span>
                <span>
                  <strong>Authoritative Voucher Code Settlement:</strong> Only disburse cash after verifying the 8-character withdrawal voucher code in your terminal.
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ fontWeight: 900, color: '#d97706' }}>3.</span>
                <span>
                  <strong>Peak Liquidity Buffer:</strong> Maintain at least 1,000 ETB float during peak hours (03:00 PM – 11:00 PM EAT) to prevent transaction pauses.
                </span>
              </div>
            </div>
          </div>

          {/* Support Desk Action Button */}
          <div>
            <a
              href="https://t.me/SonicSupport"
              target="_blank"
              rel="noreferrer"
              style={{
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: '#ffffff',
                padding: '12px 22px',
                borderRadius: '12px',
                fontSize: '13px',
                fontWeight: 800,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
                transition: 'all 0.15s ease'
              }}
            >
              <i className="fa-brands fa-telegram" style={{ fontSize: '16px' }}></i>
              <span>Contact Admin Desk</span>
            </a>
          </div>
        </div>
      </div>

    </div>
  );
};
