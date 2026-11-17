import React from 'react';

interface PWASuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenApp?: () => void;
}

export const PWASuccessModal: React.FC<PWASuccessModalProps> = ({
  isOpen,
  onClose,
  onOpenApp
}) => {
  if (!isOpen) return null;

  const handleLaunch = () => {
    onClose();
    if (onOpenApp) {
      onOpenApp();
    } else {
      // In web, navigate to standalone entry point
      window.location.hash = '#/agent-portal';
      window.location.reload();
    }
  };

  return (
    <div
      className="pwa-success-modal-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.82)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box',
        animation: 'pwaFadeIn 0.25s ease-out',
      }}
    >
      <div
        className="pwa-success-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '420px',
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
        {/* Top Gold & Emerald Accent Bar */}
        <div
          style={{
            height: '5px',
            width: '100%',
            background: 'linear-gradient(90deg, #10b981 0%, #f59e0b 50%, #10b981 100%)',
          }}
        />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
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

        <div style={{ padding: '28px 24px 24px 24px', textAlign: 'center' }}>
          {/* Animated Crown + Success Check Badge */}
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: '18px' }}>
            <div
              style={{
                width: '74px',
                height: '74px',
                borderRadius: '20px',
                backgroundColor: '#0f172a',
                border: '2px solid #f59e0b',
                boxShadow: '0 8px 24px rgba(245, 158, 11, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                margin: '0 auto',
              }}
            >
              <img
                src="/icons/icon-192.png"
                alt="Sonic Agent"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            {/* Green Floating Checkmark */}
            <div
              style={{
                position: 'absolute',
                bottom: '-4px',
                right: '-4px',
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                backgroundColor: '#10b981',
                color: '#ffffff',
                border: '2px solid #ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: '900',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.4)',
              }}
            >
              ✓
            </div>
          </div>

          <h3
            style={{
              margin: '0 0 6px 0',
              fontSize: '20px',
              fontWeight: '900',
              color: '#0f172a',
              letterSpacing: '-0.3px',
            }}
          >
            🎉 Sonic Agent በተሳካ ሁኔታ ተጭኗል!
          </h3>

          <div
            style={{
              fontSize: '13px',
              fontWeight: '700',
              color: '#10b981',
              marginBottom: '14px',
            }}
          >
            Sonic Agent App Installed Successfully!
          </div>

          <p
            style={{
              margin: '0 0 18px 0',
              fontSize: '13.5px',
              color: '#475569',
              lineHeight: 1.5,
            }}
          >
            አፕሊኬሽኑ በስልክዎ መነሻ ስክሪን ላይ ተቀምጧል። ከዚህ በኋላ ያለ ብሮውዘር አድራሻ ባር ልክ እንደ ኔቲቭ አፕ በቀጥታ መጠቀም ይችላሉ።
          </p>

          {/* Quick Tip Box */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '12px 14px',
              marginBottom: '20px',
              textAlign: 'left',
            }}
          >
            <span style={{ fontSize: '22px' }}>📱</span>
            <div style={{ fontSize: '12.5px', color: '#334155', lineHeight: 1.4 }}>
              <strong>ቀጣይ እርምጃ:</strong> በስልክዎ መነሻ ስክሪን ላይ የሚገኘውን የ <strong>Sonic Agent</strong> አዶ በመጫን በቀጥታ ይክፈቱት።
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              type="button"
              onClick={handleLaunch}
              style={{
                width: '100%',
                padding: '14px 18px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                color: '#ffffff',
                border: 'none',
                fontSize: '14px',
                fontWeight: '800',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(220, 38, 38, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <span>🚀 መተግበሪያውን ክፈት / Open App</span>
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
              ተረድቻለሁ • ዝጋ / Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
