import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { telegramService } from '../../services/telegramService';

interface TelegramRegisterModalProps {
  isOpen: boolean;
  bonusAmount: number;
  isLoading: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export const TelegramRegisterModal: React.FC<TelegramRegisterModalProps> = ({
  isOpen,
  bonusAmount,
  isLoading,
  onConfirm,
  onClose
}) => {
  const { lang } = useLanguage();
  const { telegramUser } = useAuth();

  if (!isOpen) return null;

  const displayName = telegramUser
    ? `${telegramUser.first_name || ''} ${telegramUser.last_name || ''}`.trim() || `@${telegramUser.username}`
    : 'Telegram Player';

  const displayHandle = telegramUser?.username
    ? `@${telegramUser.username}`
    : `ID: ${telegramUser?.id || 'Telegram User'}`;

  const handleConfirmClick = () => {
    telegramService.triggerHaptic('success');
    onConfirm();
  };

  return (
    <div className="otp-modal-overlay" style={{ zIndex: 99999 }}>
      {/* Dark backdrop */}
      <div className="otp-modal-backdrop" onClick={onClose}></div>

      {/* Main Exact White Card */}
      <div
        className="exact-ref-modal-card"
        style={{
          position: 'relative',
          zIndex: 10,
          background: '#ffffff',
          borderRadius: '32px',
          width: '100%',
          maxWidth: '380px',
          padding: '24px 18px 18px 18px',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.35)',
          textAlign: 'center',
          boxSizing: 'border-box',
          animation: 'modalSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Top-Right Circular Close Button */}
        <button
          type="button"
          onClick={onClose}
          title="Close"
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: '#f1f5f9',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#64748b',
            cursor: 'pointer',
            fontSize: '14px',
            transition: 'all 0.15s ease'
          }}
        >
          <i className="fa-solid fa-xmark"></i>
        </button>

        {/* 1. Mascot: 3D Crowned Lemon Transparent Badge & Sparkles */}
        <div style={{ position: 'relative', display: 'inline-block', margin: '4px auto 10px auto' }}>
          {/* Left Sparkle Star */}
          <span
            style={{
              position: 'absolute',
              left: '-24px',
              top: '28px',
              color: '#facc15',
              fontSize: '16px',
              fontWeight: '900'
            }}
          >
            ✦
          </span>

          {/* 3D Crowned Lemon Transparent PNG */}
          <div
            style={{
              width: '82px',
              height: '82px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto',
              filter: 'drop-shadow(0 8px 16px rgba(234, 179, 8, 0.35))'
            }}
          >
            <img
              src="/assets/images/lomi_crowned_lemon_badge.png"
              alt="Lomi Crowned Lemon"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>

          {/* Right Sparkle Star */}
          <span
            style={{
              position: 'absolute',
              right: '-24px',
              top: '32px',
              color: '#facc15',
              fontSize: '14px',
              fontWeight: '900'
            }}
          >
            ✦
          </span>
        </div>

        {/* 2. Dual-Tone Title: Create Your Lomi Account */}
        <h2
          style={{
            fontSize: '23px',
            fontWeight: '900',
            color: '#0f172a',
            margin: '0 0 4px 0',
            letterSpacing: '-0.4px',
            lineHeight: 1.2
          }}
        >
          {lang === 'am' ? (
            <>የእርስዎን <span style={{ color: '#16a34a' }}>ሎሚ</span> መለያ ይፍጠሩ</>
          ) : (
            <>Create Your <span style={{ color: '#16a34a' }}>Lomi</span> Account</>
          )}
        </h2>

        {/* Subtitle */}
        <p
          style={{
            fontSize: '12px',
            color: '#64748b',
            margin: '0 0 16px 0',
            lineHeight: 1.35
          }}
        >
          {lang === 'am'
            ? 'በቴሌግራም በአንድ ንክኪ ይመዝገቡ • ምንም ፎርም አያስፈልግም ⚡'
            : 'Instant 1-click registration via Telegram • No forms needed ⚡'}
        </p>

        {/* 3. Exact Creamy Free Sign Up Bonus Card */}
        <div
          style={{
            background: '#fefce8',
            border: '1.5px solid #fef08a',
            borderRadius: '20px',
            padding: '12px 14px',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden',
            textAlign: 'left'
          }}
        >
          {/* Left: Gift Icon + Texts */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', zIndex: 2 }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: '#ffffff',
                border: '1px solid #fef08a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
                flexShrink: 0
              }}
            >
              🎁
            </div>

            <div>
              <div
                style={{
                  fontSize: '10.5px',
                  fontWeight: '800',
                  color: '#15803d',
                  letterSpacing: '0.6px',
                  textTransform: 'uppercase'
                }}
              >
                {lang === 'am' ? 'የነፃ መመዝገቢያ ቦነስ' : 'FREE SIGN UP BONUS'}
              </div>

              <div
                style={{
                  fontSize: '26px',
                  fontWeight: '900',
                  color: '#14532d',
                  lineHeight: '1.1',
                  margin: '1px 0'
                }}
              >
                +{bonusAmount}.00{' '}
                <span style={{ fontSize: '13px', fontWeight: '800' }}>ETB</span>
              </div>

              <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '500' }}>
                {lang === 'am' ? 'በራስ-ሰር ወደ ቦርሳዎ ገቢ ይሆናል' : 'Automatically credited to your wallet'}
              </div>
            </div>
          </div>

          {/* Right: 3D Stack of Gold Coins Image (Transparent PNG) */}
          <div
            style={{
              width: '72px',
              height: '72px',
              flexShrink: 0,
              zIndex: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              filter: 'drop-shadow(0 6px 12px rgba(202, 138, 4, 0.3))'
            }}
          >
            <img
              src="/assets/images/lomi_etb_coins_reward.png"
              alt="ETB Gold Coins Stack"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
        </div>

        {/* 4. Telegram Profile Pill */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '10px 14px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            textAlign: 'left',
            boxShadow: '0 1px 4px rgba(0, 0, 0, 0.03)'
          }}
        >
          {/* Telegram Circular Icon */}
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: '#2AABEE',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontSize: '17px',
              flexShrink: 0
            }}
          >
            <i className="fa-brands fa-telegram"></i>
          </div>

          {/* Name & ID/Verified */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: '13.5px',
                fontWeight: '800',
                color: '#0f172a',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {displayName}
            </div>
            <div
              style={{
                fontSize: '11px',
                color: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginTop: '1px'
              }}
            >
              <span style={{ fontWeight: '600' }}>{displayHandle}</span>
              <span style={{ color: '#cbd5e1' }}>|</span>
              <span
                style={{
                  background: '#dcfce7',
                  color: '#15803d',
                  padding: '1px 6px',
                  borderRadius: '999px',
                  fontSize: '9.5px',
                  fontWeight: '800',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px'
                }}
              >
                <i className="fa-solid fa-check" style={{ fontSize: '8px' }}></i>{' '}
                {lang === 'am' ? 'የተረጋገጠ' : 'Verified'}
              </span>
            </div>
          </div>
        </div>

        {/* 5. Lush Green Action CTA Button */}
        <button
          type="button"
          onClick={handleConfirmClick}
          disabled={isLoading}
          style={{
            width: '100%',
            background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 50%, #15803d 100%)',
            color: '#ffffff',
            fontSize: '14.5px',
            fontWeight: '900',
            border: 'none',
            borderRadius: '999px',
            padding: '14px 18px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: '0 8px 24px rgba(22, 163, 74, 0.4)',
            textTransform: 'uppercase',
            letterSpacing: '0.4px',
            transition: 'all 0.15s ease'
          }}
        >
          {isLoading ? (
            <span>
              <i className="fa-solid fa-spinner fa-spin"></i>{' '}
              {lang === 'am' ? 'በመፍጠር ላይ...' : 'Creating Account...'}
            </span>
          ) : (
            <span>
              ⚡ {lang === 'am' ? 'መለያ ፍጠርና 10 ብር ተቀበል 🚀' : 'CREATE ACCOUNT & CLAIM +10 ETB 🚀'}
            </span>
          )}
        </button>

        {/* 6. Exact 3-Column Trust Bar */}
        <div
          style={{
            marginTop: '16px',
            paddingTop: '12px',
            borderTop: '1px solid #f1f5f9',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '6px',
            textAlign: 'left'
          }}
        >
          {/* Column 1 */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
            <span style={{ color: '#16a34a', fontSize: '13px', marginTop: '1px' }}>
              <i className="fa-solid fa-circle-check"></i>
            </span>
            <div>
              <div style={{ fontSize: '10.5px', fontWeight: '800', color: '#0f172a' }}>
                {lang === 'am' ? '100% ነፃ' : '100% Free'}
              </div>
              <div style={{ fontSize: '9px', color: '#64748b' }}>
                {lang === 'am' ? 'ምንም ድብቅ ክፍያ የለም' : 'No hidden fees'}
              </div>
            </div>
          </div>

          {/* Column 2 */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', borderLeft: '1px solid #f1f5f9', paddingLeft: '6px' }}>
            <span style={{ color: '#eab308', fontSize: '13px', marginTop: '1px' }}>
              <i className="fa-solid fa-bolt"></i>
            </span>
            <div>
              <div style={{ fontSize: '10.5px', fontWeight: '800', color: '#0f172a' }}>
                {lang === 'am' ? 'ፈጣን ክፍያ' : 'Instant Payouts'}
              </div>
              <div style={{ fontSize: '9px', color: '#64748b' }}>
                {lang === 'am' ? 'በሰከንዶች በቴሌብር' : 'Telebirr in seconds'}
              </div>
            </div>
          </div>

          {/* Column 3 */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', borderLeft: '1px solid #f1f5f9', paddingLeft: '6px' }}>
            <span style={{ color: '#7c3aed', fontSize: '13px', marginTop: '1px' }}>
              <i className="fa-solid fa-lock"></i>
            </span>
            <div>
              <div style={{ fontSize: '10.5px', fontWeight: '800', color: '#0f172a' }}>
                {lang === 'am' ? 'ደህንነቱ የተጠበቀ' : 'Secure & Safe'}
              </div>
              <div style={{ fontSize: '9px', color: '#64748b' }}>
                {lang === 'am' ? 'መረጃዎ የተጠበቀ ነው' : 'Your data is protected'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
