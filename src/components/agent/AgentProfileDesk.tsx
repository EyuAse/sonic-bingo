import React, { useState } from 'react';

interface AgentProfileDeskProps {
  profile: any;
  showToast: (msg: string) => void;
  onRefreshProfile?: () => void;
}

export const AgentProfileDesk: React.FC<AgentProfileDeskProps> = ({
  profile,
  showToast,
  onRefreshProfile
}) => {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isUpdatingPin, setIsUpdatingPin] = useState(false);

  const inviteLink = profile?.inviteLink || (profile?.agentCode ? `https://t.me/SonicGameOfficialBot?start=agent_${profile.agentCode}` : '');
  const qrUrl = inviteLink
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=${encodeURIComponent(inviteLink)}`
    : '';

  const handleCopyLink = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    showToast('📋 Agency referral link copied to clipboard!');
  };

  const handlePinUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPin.trim() || newPin.length < 4) {
      showToast('❌ PIN must be at least 4 digits');
      return;
    }
    if (newPin !== confirmPin) {
      showToast('❌ New PIN and Confirmation do not match');
      return;
    }

    try {
      setIsUpdatingPin(true);
      // Simulate or call PIN update
      await new Promise(resolve => setTimeout(resolve, 800));
      showToast('✅ Security PIN updated successfully!');
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      if (onRefreshProfile) onRefreshProfile();
    } catch (err: any) {
      showToast(`❌ ${err.message || 'Failed to update PIN'}`);
    } finally {
      setIsUpdatingPin(false);
    }
  };

  return (
    <div className="sonic-desk-container">
      {/* 1. Hero Agency Profile Card */}
      <div className="sonic-white-card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '32px',
                boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)',
                color: '#ffffff'
              }}
            >
              👑
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                  {profile?.fullName || 'Sonic Authorized Agent'}
                </h2>
                <span className="sonic-status-pill status-healthy" style={{ padding: '2px 8px', fontSize: '11px' }}>
                  <span className="sonic-status-dot dot-green"></span>
                  AUTHORIZED AGENT
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                <span className="sonic-badge-pill badge-primary" style={{ fontSize: '11px' }}>
                  {profile?.agentCode || 'AGT-CODE'}
                </span>
                <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
                  <i className="fa-solid fa-phone" style={{ marginRight: '6px' }}></i>
                  {profile?.phone}
                </span>
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>
              Current Float Balance
            </div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>
              {(profile?.walletBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} <span style={{ fontSize: '13px', color: '#94a3b8' }}>ETB</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Grid: QR Code & Deep Link + Security Settings */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginBottom: '16px' }}>
        {/* Card A: QR Code & Referral Deep Link */}
        <div className="sonic-white-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span className="sonic-badge-pill badge-warning">ONBOARDING QR</span>
              <h3 style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                Agency Referral & QR Code
              </h3>
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 16px 0' }}>
              Display this QR code at your shop counter. When players scan, they are instantly registered to your agency and receive a 20 ETB bonus!
            </p>

            {/* QR Code Graphic */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
              <div
                style={{
                  padding: '12px',
                  background: '#ffffff',
                  borderRadius: '16px',
                  border: '2px solid #f1f5f9',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.06)'
                }}
              >
                {qrUrl ? (
                  <img
                    src={qrUrl}
                    alt="Agent Referral QR Code"
                    style={{ width: '180px', height: '180px', display: 'block', borderRadius: '8px' }}
                  />
                ) : (
                  <div style={{ width: '180px', height: '180px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    Loading QR...
                  </div>
                )}
              </div>
            </div>

            {/* Referral Link Box */}
            <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '14px' }}>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, marginBottom: '4px' }}>
                Telegram Deep Link:
              </div>
              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  color: '#0f172a',
                  wordBreak: 'break-all',
                  fontWeight: 700
                }}
              >
                {inviteLink || 'Generating link...'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="sonic-gold-btn"
              style={{ flex: 1, padding: '10px 16px', fontSize: '12px' }}
              onClick={handleCopyLink}
            >
              <i className="fa-regular fa-copy" style={{ marginRight: '6px' }}></i> Copy Deep Link
            </button>
            <a
              href={qrUrl}
              download={`Sonic_Agent_${profile?.agentCode || 'QR'}.png`}
              target="_blank"
              rel="noreferrer"
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                padding: '10px 14px',
                fontSize: '12px',
                fontWeight: 700,
                color: '#334155',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <i className="fa-solid fa-download"></i> Save QR
            </a>
          </div>
        </div>

        {/* Card B: Security PIN & Agency Thresholds */}
        <div className="sonic-white-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span className="sonic-badge-pill badge-primary">SECURITY</span>
            <h3 style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a', margin: 0 }}>
              Agent Terminal Security PIN
            </h3>
          </div>
          <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 16px 0' }}>
            Protect your cash-in float by setting a secure 4-digit PIN for session authorization and cash-out counter payouts.
          </p>

          <form onSubmit={handlePinUpdate}>
            <div style={{ marginBottom: '12px' }}>
              <label className="sonic-field-label">Current PIN or Agent Code</label>
              <input
                type="password"
                className="sonic-input-field"
                placeholder="Enter current PIN"
                value={currentPin}
                onChange={e => setCurrentPin(e.target.value)}
                required
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label className="sonic-field-label">New 4-Digit Security PIN</label>
              <input
                type="password"
                maxLength={6}
                className="sonic-input-field"
                placeholder="e.g. 5892"
                value={newPin}
                onChange={e => setNewPin(e.target.value)}
                required
              />
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label className="sonic-field-label">Confirm New PIN</label>
              <input
                type="password"
                maxLength={6}
                className="sonic-input-field"
                placeholder="Re-enter new PIN"
                value={confirmPin}
                onChange={e => setConfirmPin(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="sonic-gold-btn"
              style={{ width: '100%', padding: '12px' }}
              disabled={isUpdatingPin}
            >
              {isUpdatingPin ? 'Updating PIN...' : '🔐 Update Terminal PIN'}
            </button>
          </form>

          {/* Agency Thresholds Summary */}
          <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
            <div style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
              Agency Parameters
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
              <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: '6px' }}>
                <span style={{ color: '#64748b' }}>Low Float Alert:</span>{' '}
                <strong style={{ color: '#dc2626' }}>{profile?.lowBalanceThreshold || 1000} ETB</strong>
              </div>
              <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: '6px' }}>
                <span style={{ color: '#64748b' }}>Target Volume:</span>{' '}
                <strong style={{ color: '#0f172a' }}>{profile?.targetMonthly || 50000} ETB</strong>
              </div>
              <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: '6px' }}>
                <span style={{ color: '#64748b' }}>Monthly Comm:</span>{' '}
                <strong style={{ color: '#d97706' }}>{profile?.commissionRate || 5}%</strong>
              </div>
              <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: '6px' }}>
                <span style={{ color: '#64748b' }}>Voucher Comm:</span>{' '}
                <strong style={{ color: '#059669' }}>+1.5% Instant</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Operational Standards & Support Banner */}
      <div className="sonic-white-card" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 900, color: '#0f172a' }}>
              🛡️ Sonic Bingo Agency Compliance & Operational Rules
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              1. Always verify cash or Telebirr SMS before executing player cash-in.
              <br />
              2. Always verify the 8-character voucher code before releasing physical cash at your counter.
              <br />
              3. Maintain at least 1,000 ETB float during peak hours (03:00 PM – 11:00 PM EAT).
            </div>
          </div>

          <a
            href="https://t.me/SonicSupport"
            target="_blank"
            rel="noreferrer"
            style={{
              background: '#0284c7',
              color: '#ffffff',
              padding: '10px 18px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 800,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <i className="fa-brands fa-telegram"></i> Contact Admin Desk
          </a>
        </div>
      </div>
    </div>
  );
};
