import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';

export const AccountSuspendedModal: React.FC = () => {
  const { suspensionNotice, dismissSuspensionNotice, logout, checkSuspensionStatus } = useAuth();
  const { switchPage } = useApp();
  const [isChecking, setIsChecking] = useState(false);
  const [checkFeedback, setCheckFeedback] = useState<string | null>(null);

  // Active 1.5-second heartbeat poll while modal is visible
  // Guarantees sub-second auto-dismiss without requiring an app reload
  useEffect(() => {
    if (!suspensionNotice) return;
    const interval = setInterval(async () => {
      try {
        const isActive = await checkSuspensionStatus();
        if (isActive) {
          console.log('⚡ [AccountSuspendedModal] Heartbeat detected active status — auto-dismissing modal!');
        }
      } catch {}
    }, 1500);

    return () => clearInterval(interval);
  }, [suspensionNotice, checkSuspensionStatus]);

  if (!suspensionNotice) return null;

  const handleManualCheck = async () => {
    setIsChecking(true);
    setCheckFeedback(null);
    try {
      const isActive = await checkSuspensionStatus();
      if (!isActive) {
        setCheckFeedback('Account is still suspended by compliance.');
        setTimeout(() => setCheckFeedback(null), 3000);
      }
    } finally {
      setTimeout(() => setIsChecking(false), 400);
    }
  };

  const handleContactSupport = () => {
    if (typeof window !== 'undefined') {
      const tg = (window as any)?.Telegram?.WebApp;
      if (tg?.openTelegramLink) {
        tg.openTelegramLink('https://t.me/SonicGameSupport');
      } else {
        window.open('https://t.me/SonicGameSupport', '_blank');
      }
    }
  };

  const handleCloseAndExit = () => {
    dismissSuspensionNotice();
    logout();
    switchPage('landing');
  };

  return (
    <div
      className="fresh-victory-modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        backgroundColor: 'rgba(15, 23, 42, 0.88)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
    >
      <div
        className="account-suspended-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '420px',
          width: '100%',
          padding: '32px 26px',
          textAlign: 'center',
          borderRadius: '24px',
          background: '#ffffff',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.5)',
          border: '1px solid #fee2e2',
          animation: 'modalSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Danger Lock Icon */}
        <div
          style={{
            width: '68px',
            height: '68px',
            borderRadius: '50%',
            backgroundColor: '#fef2f2',
            border: '2px solid #fecaca',
            color: '#dc2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '30px',
            margin: '0 auto 20px',
            boxShadow: '0 8px 16px -4px rgba(239, 68, 68, 0.2)'
          }}
        >
          <i className="fa-solid fa-user-lock"></i>
        </div>

        {/* Title */}
        <h2
          style={{
            fontSize: '22px',
            fontWeight: 800,
            color: '#0f172a',
            marginBottom: '6px',
            letterSpacing: '-0.3px'
          }}
        >
          Account Suspended
        </h2>
        <p
          style={{
            fontSize: '13.5px',
            color: '#dc2626',
            fontWeight: 700,
            marginBottom: '14px'
          }}
        >
          መለያዎ በጊዜያዊነት ታግዷል
        </p>

        {/* Compliance Explanation */}
        <p
          style={{
            fontSize: '13.5px',
            color: '#475569',
            lineHeight: 1.55,
            marginBottom: '18px'
          }}
        >
          Suspending blocks play, deposits, and withdrawals. The action and reason are permanently recorded in the security audit log.
        </p>

        {/* Reason Box */}
        <div
          style={{
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '12px 14px',
            marginBottom: '24px',
            textAlign: 'left'
          }}
        >
          <div
            style={{
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.6px',
              color: '#64748b',
              fontWeight: 700,
              marginBottom: '4px'
            }}
          >
            Reason for suspension:
          </div>
          <div
            style={{
              fontSize: '14px',
              color: '#1e293b',
              fontWeight: 600,
              wordBreak: 'break-word'
            }}
          >
            {suspensionNotice.reason || 'Account under compliance review'}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Instant Re-check / Refresh Status Button */}
          <button
            type="button"
            onClick={handleManualCheck}
            disabled={isChecking}
            style={{
              width: '100%',
              padding: '13px 18px',
              backgroundColor: '#10b981',
              color: '#ffffff',
              border: 'none',
              borderRadius: '14px',
              fontWeight: 700,
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: isChecking ? 'not-allowed' : 'pointer',
              opacity: isChecking ? 0.75 : 1,
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
              transition: 'all 0.15s ease'
            }}
          >
            <i className={`fa-solid fa-arrows-rotate ${isChecking ? 'fa-spin' : ''}`} style={{ fontSize: '16px' }}></i>
            {isChecking ? 'Checking status... / በማጣራት ላይ...' : 'Check Status / ሁኔታን አረጋግጥ'}
          </button>

          {checkFeedback && (
            <div style={{ fontSize: '12px', color: '#ef4444', fontWeight: 600 }}>
              {checkFeedback}
            </div>
          )}

          <button
            type="button"
            onClick={handleContactSupport}
            style={{
              width: '100%',
              padding: '13px 18px',
              backgroundColor: '#0088cc',
              color: '#ffffff',
              border: 'none',
              borderRadius: '14px',
              fontWeight: 700,
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0, 136, 204, 0.3)',
              transition: 'all 0.15s ease'
            }}
          >
            <i className="fa-brands fa-telegram" style={{ fontSize: '18px' }}></i>
            Contact Support on Telegram
          </button>

          <button
            type="button"
            onClick={handleCloseAndExit}
            style={{
              width: '100%',
              padding: '11px 18px',
              backgroundColor: '#f1f5f9',
              color: '#475569',
              border: 'none',
              borderRadius: '14px',
              fontWeight: 600,
              fontSize: '13.5px',
              cursor: 'pointer'
            }}
          >
            Exit / ውጣ
          </button>
        </div>
      </div>
    </div>
  );
};

