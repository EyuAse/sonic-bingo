import React from 'react';

interface IOSPWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  platform?: 'ios' | 'android' | 'auto';
}

export const IOSPWAInstallModal: React.FC<IOSPWAInstallModalProps> = ({
  isOpen,
  onClose,
  platform = 'auto',
}) => {
  if (!isOpen) return null;

  // Determine target platform
  const isTargetIOS =
    platform === 'ios' ||
    (platform === 'auto' &&
      typeof window !== 'undefined' &&
      (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)));

  return (
    <div
      className="pwa-install-modal-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.78)',
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
        className="pwa-install-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '430px',
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(245, 158, 11, 0.25)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          animation: 'pwaSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Top Gold Accent Bar */}
        <div
          style={{
            height: '4px',
            width: '100%',
            background: 'linear-gradient(90deg, #dc2626 0%, #f59e0b 50%, #dc2626 100%)',
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
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            backgroundColor: '#f1f5f9',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#64748b',
            fontSize: '18px',
            fontWeight: 'bold',
            transition: 'background-color 0.2s',
          }}
        >
          ✕
        </button>

        <div style={{ padding: '24px 22px 20px 22px' }}>
          {/* Header with App Icon */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
            <div
              style={{
                width: '58px',
                height: '58px',
                borderRadius: '16px',
                backgroundColor: '#0f172a',
                border: '2px solid #f59e0b',
                boxShadow: '0 6px 16px rgba(245, 158, 11, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              <img
                src="/icons/icon-192.png"
                alt="Sonic Agent"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: '18px',
                  fontWeight: '800',
                  color: '#0f172a',
                  lineHeight: 1.25,
                }}
              >
                {isTargetIOS ? 'Sonic Agent ን በ iPhone ይጫኑ' : 'Sonic Agent ን በስልክዎ ይጫኑ'}
              </h3>
              <p
                style={{
                  margin: '4px 0 0 0',
                  fontSize: '12px',
                  color: '#dc2626',
                  fontWeight: '700',
                  letterSpacing: '0.3px',
                }}
              >
                {isTargetIOS ? 'Install on iPhone (Safari)' : 'Install on Android (Chrome)'}
              </p>
            </div>
          </div>

          <p
            style={{
              margin: '0 0 16px 0',
              fontSize: '13px',
              color: '#475569',
              lineHeight: 1.45,
            }}
          >
            አፕሊኬሽኑን በቀጥታ በስልክዎ መነሻ ስክሪን ላይ በመጫን ያለ ብሮውዘር ባር ልክ እንደ ኔቲቭ አፕ በቀጥታ ይጠቀሙ።
          </p>

          {/* Step-by-Step Visual Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
            {isTargetIOS ? (
              // iOS Safari 3-Steps
              <>
                {/* Step 1 */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '14px',
                    padding: '12px 14px',
                  }}
                >
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      backgroundColor: '#e0f2fe',
                      color: '#0284c7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                      <polyline points="16 6 12 2 8 6" />
                      <line x1="12" y1="2" x2="12" y2="15" />
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
                      1. የ Safari <strong>Share</strong> (⎋) ምልክትን ይጫኑ
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                      Tap the <strong>Share</strong> button at the bottom of Safari.
                    </div>
                  </div>
                </div>

                {/* Step 2 */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '14px',
                    padding: '12px 14px',
                  }}
                >
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      backgroundColor: '#fef3c7',
                      color: '#d97706',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="4" />
                      <line x1="12" y1="8" x2="12" y2="16" />
                      <line x1="8" y1="12" x2="16" y2="12" />
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
                      2. <strong>'Add to Home Screen'</strong> የሚለውን ይምረጡ
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                      Scroll down and tap <strong>'Add to Home Screen'</strong> (ወደ መነሻ ስክሪን ጨምር).
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '14px',
                    padding: '12px 14px',
                  }}
                >
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      backgroundColor: '#fee2e2',
                      color: '#dc2626',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
                      3. ከላይ በቀኝ <strong>'Add'</strong> (አክል) የሚለውን ይጫኑ
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                      Tap <strong>'Add'</strong> in the top right corner. Done!
                    </div>
                  </div>
                </div>
              </>
            ) : (
              // Android Chrome 3-Steps
              <>
                {/* Step 1 */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '14px',
                    padding: '12px 14px',
                  }}
                >
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      backgroundColor: '#e0f2fe',
                      color: '#0284c7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                      <circle cx="12" cy="5" r="2" />
                      <circle cx="12" cy="12" r="2" />
                      <circle cx="12" cy="19" r="2" />
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
                      1. የ Chrome ሜኑ <strong>(⋮)</strong> ምልክትን ይጫኑ
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                      Tap the three dots <strong>(⋮)</strong> at the top right of Chrome.
                    </div>
                  </div>
                </div>

                {/* Step 2 */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '14px',
                    padding: '12px 14px',
                  }}
                >
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      backgroundColor: '#fef3c7',
                      color: '#d97706',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
                      2. <strong>'Install app'</strong> ወይም <strong>'Add to Home screen'</strong> ይምረጡ
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                      Select <strong>'Install app'</strong> (ወደ መነሻ ስክሪን ጨምር).
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '14px',
                    padding: '12px 14px',
                  }}
                >
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      backgroundColor: '#fee2e2',
                      color: '#dc2626',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
                      3. <strong>'Install'</strong> (ጫን) የሚለውን ያረጋግጡ
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                      Tap <strong>'Install'</strong> to complete setup.
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Pointer Cue */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '8px 12px',
              backgroundColor: '#fffbeb',
              borderRadius: '10px',
              border: '1px dashed #f59e0b',
              marginBottom: '16px',
              fontSize: '12px',
              color: '#92400e',
              fontWeight: '600',
            }}
          >
            <span style={{ fontSize: '15px' }}>{isTargetIOS ? '👇' : '👆'}</span>
            <span>
              {isTargetIOS
                ? 'የ Safari ታችኛው ባር ላይ የሚገኘውን ምልክት ይጫኑ'
                : 'የ Chrome የላይኛው ቀኝ ሜኑ (⋮) ላይ የሚገኘውን ይጫኑ'}
            </span>
          </div>

          {/* Got it Dismiss Button */}
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '100%',
              padding: '13px 16px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
              color: '#ffffff',
              border: 'none',
              fontSize: '14px',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(220, 38, 38, 0.35)',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
          >
            ተረድቻለሁ • ገባኝ / Got It
          </button>
        </div>
      </div>

      <style>{`
        @keyframes pwaFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes pwaSlideUp {
          from { transform: translateY(30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};
