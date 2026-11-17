import React from 'react';

interface AgentLoginInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInstall: () => void;
  isInstalling?: boolean;
}

export const AgentLoginInstallModal: React.FC<AgentLoginInstallModalProps> = ({
  isOpen,
  onClose,
  onInstall,
  isInstalling = false,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="pwa-login-install-modal-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 99998,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box',
        animation: 'pwaFadeIn 0.25s ease-out',
      }}
    >
      <div
        className="pwa-login-install-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '410px',
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(245, 158, 11, 0.3)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          animation: 'pwaSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Top Gold & Crimson Accent Bar */}
        <div
          style={{
            height: '5px',
            width: '100%',
            background: 'linear-gradient(90deg, #dc2626 0%, #f59e0b 50%, #dc2626 100%)',
          }}
        />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss modal"
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: '#f1f5f9',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#64748b',
            fontSize: '16px',
            fontWeight: 'bold',
          }}
        >
          ✕
        </button>

        <div style={{ padding: '26px 22px 20px 22px', textAlign: 'center' }}>
          {/* Sonic Crown App Icon Badge */}
          <div
            style={{
              width: '68px',
              height: '68px',
              borderRadius: '20px',
              backgroundColor: '#0f172a',
              border: '2px solid #f59e0b',
              boxShadow: '0 8px 24px rgba(245, 158, 11, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              margin: '0 auto 16px auto',
            }}
          >
            <img
              src="/icons/icon-192.png"
              alt="Sonic Agent"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>

          <h3
            style={{
              margin: '0 0 6px 0',
              fontSize: '19px',
              fontWeight: '900',
              color: '#0f172a',
              letterSpacing: '-0.3px',
            }}
          >
            Sonic Agent መተግበሪያውን ይጫኑ
          </h3>

          <div
            style={{
              fontSize: '12.5px',
              fontWeight: '700',
              color: '#dc2626',
              marginBottom: '16px',
            }}
          >
            Install Sonic Agent Terminal (PWA)
          </div>

          <p
            style={{
              margin: '0 0 16px 0',
              fontSize: '13px',
              color: '#475569',
              lineHeight: 1.45,
            }}
          >
            ለፈጣን ካሽየር እና የክፍያ አገልግሎት ያለ ብሮውዘር አድራሻ ባር በቀጥታ ከስልክዎ መነሻ ስክሪን ይጠቀሙ።
          </p>

          {/* 3 Quick Benefit Bullets */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '12px 14px',
              marginBottom: '20px',
              textAlign: 'left',
              fontSize: '12px',
              color: '#334155',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#10b981', fontWeight: 900 }}>⚡</span>
              <span><strong>ሙሉ ስክሪን:</strong> ያለ ብሮውዘር ባር ልክ እንደ ኔቲቭ አፕ በቀጥታ ይከፈታል</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#f59e0b', fontWeight: 900 }}>🔒</span>
              <span><strong>ቀላል አገባብ:</strong> ፈጣን የካሽየር ፍሎት እና የክፍያ ማረጋገጫ</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#0284c7', fontWeight: 900 }}>📱</span>
              <span><strong>ቀጥተኛ መዳረሻ:</strong> በስልክዎ መነሻ ስክሪን ላይ ይቀመጣል</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              type="button"
              onClick={onInstall}
              disabled={isInstalling}
              style={{
                width: '100%',
                padding: '14px 18px',
                borderRadius: '14px',
                background: isInstalling
                  ? '#94a3b8'
                  : 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                color: '#ffffff',
                border: 'none',
                fontSize: '14px',
                fontWeight: '800',
                cursor: isInstalling ? 'default' : 'pointer',
                boxShadow: isInstalling ? 'none' : '0 4px 14px rgba(220, 38, 38, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {isInstalling ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i>
                  <span>በመጫን ላይ ነው... / Installing...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-mobile-screen-button" style={{ color: '#fef08a' }}></i>
                  <span>📱 አሁን ጫን / Install App Now</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                width: '100%',
                padding: '11px 18px',
                borderRadius: '14px',
                background: 'transparent',
                color: '#64748b',
                border: '1px solid #e2e8f0',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
              }}
            >
              ቆይተው • በኋላ / Maybe Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
