import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { telegramService } from '../../services/telegramService';
import { validateEthiopianPhone } from '../../services/ethiopianPhoneValidator';

interface TelegramRegisterModalProps {
  isOpen: boolean;
  bonusAmount: number;
  isLoading: boolean;
  onConfirm: (phone?: string) => void;
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

  const [phoneInput, setPhoneInput] = useState(() => {
    if (typeof window === 'undefined') return '';
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const p = urlParams.get('phone');
      if (p) {
        let clean = p.replace(/^\+?251/, '0').replace(/\s+/g, '');
        if (!clean.startsWith('0')) clean = '0' + clean;
        return clean;
      }
    } catch {}
    return '';
  });
  const [phoneError, setPhoneError] = useState('');

  if (!isOpen) return null;

  const urlTgId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tg_id') : null;
  const effectiveId = telegramUser?.id || urlTgId;

  const displayName = telegramUser
    ? `${telegramUser.first_name || ''} ${telegramUser.last_name || ''}`.trim() || `@${telegramUser.username}`
    : 'Sonic Player';

  const displayHandle = telegramUser?.username
    ? `@${telegramUser.username}`
    : (effectiveId ? `ID: ${effectiveId}` : (phoneInput ? `Phone: ${phoneInput}` : 'Sonic Player'));

  const handleOneTapContact = async () => {
    try {
      setPhoneError('');
      const raw = await telegramService.requestTelegramPhone();
      if (raw) {
        let clean = raw.replace(/^\+?251/, '0').replace(/\s+/g, '');
        if (!clean.startsWith('0')) clean = '0' + clean;
        setPhoneInput(clean);
      }
    } catch (e) {
      console.warn('One tap contact error:', e);
    }
  };

  const handleConfirmClick = () => {
    // Phone is mandatory to access and register!
    const validation = validateEthiopianPhone(phoneInput);
    if (!validation.isValid) {
      setPhoneError(
        lang === 'am'
          ? '⚠️ መለያ ለመፍጠር ትክክለኛ የኢትዮጵያ ስልክ ቁጥር ማስገባት ግዴታ ነው (09... ወይም 07...)'
          : '⚠️ Phone number is required to create an account (09... or 07...)'
      );
      telegramService.triggerHaptic('error');
      return;
    }

    setPhoneError('');
    telegramService.triggerHaptic('success');
    onConfirm(validation.nationalNumber);
  };

  return (
    <div className="otp-modal-overlay" style={{ zIndex: 99999 }}>
      {/* Dark backdrop */}
      <div className="otp-modal-backdrop" onClick={onClose}></div>

      {/* Main Exact Card - Sonic Red Theme */}
      <div
        className="exact-ref-modal-card"
        style={{
          position: 'relative',
          zIndex: 10,
          background: '#ffffff',
          borderRadius: '32px',
          width: '100%',
          maxWidth: '390px',
          padding: '24px 20px 20px',
          boxShadow: '0 25px 60px -15px rgba(225, 29, 72, 0.35)',
          textAlign: 'center',
          boxSizing: 'border-box',
          animation: 'modalSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          border: '1.5px solid rgba(254, 205, 211, 0.7)'
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

        {/* 1. Mascot / Crown Badge */}
        <div style={{ position: 'relative', display: 'inline-block', margin: '4px auto 10px auto' }}>
          <div
            style={{
              width: '76px',
              height: '76px',
              borderRadius: '24px',
              background: 'linear-gradient(135deg, #e11d48 0%, #dc2626 50%, #b91c1c 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '34px',
              color: '#ffffff',
              boxShadow: '0 10px 25px rgba(225, 29, 72, 0.45)',
              border: '2px solid rgba(255, 255, 255, 0.4)'
            }}
          >
            👑
          </div>
        </div>

        {/* 2. Dual-Tone Title: Create Your Sonic Account */}
        <h2
          style={{
            fontSize: '22px',
            fontWeight: '900',
            color: '#0f172a',
            margin: '0 0 4px 0',
            letterSpacing: '-0.4px',
            lineHeight: 1.2
          }}
        >
          {lang === 'am' ? (
            <>የእርስዎን <span style={{ color: '#dc2626' }}>ሶኒክ</span> መለያ ይፍጠሩ</>
          ) : (
            <>Create Your <span style={{ color: '#dc2626' }}>Sonic</span> Account</>
          )}
        </h2>

        {/* Subtitle */}
        <p
          style={{
            fontSize: '12.5px',
            color: '#64748b',
            margin: '0 0 14px 0',
            lineHeight: 1.35
          }}
        >
          {lang === 'am'
            ? 'ወደ ጨዋታው ለመግባት ስልክ ቁጥርዎን ያረጋግጡ ⚡'
            : 'Verify phone number to access games & claim bonus ⚡'}
        </p>

        {/* 3. 50 ETB Bonus Card - Sonic Red Theme */}
        <div
          style={{
            background: '#fff1f2',
            border: '1.5px solid #fecdd3',
            borderRadius: '18px',
            padding: '12px 14px',
            marginBottom: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            textAlign: 'left'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: '#ffffff',
                border: '1px solid #fecdd3',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                flexShrink: 0
              }}
            >
              🎁
            </div>

            <div>
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: '800',
                  color: '#9f1239',
                  letterSpacing: '0.6px',
                  textTransform: 'uppercase'
                }}
              >
                {lang === 'am' ? 'የነፃ መመዝገቢያ ቦነስ' : 'FREE SIGN UP BONUS'}
              </div>

              <div
                style={{
                  fontSize: '24px',
                  fontWeight: '900',
                  color: '#be123c',
                  lineHeight: '1.1',
                  margin: '1px 0'
                }}
              >
                +{bonusAmount}.00{' '}
                <span style={{ fontSize: '13px', fontWeight: '800' }}>ETB</span>
              </div>

              <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '600' }}>
                {lang === 'am' ? 'በራስ-ሰር ወደ ቦርሳዎ ገቢ ይሆናል' : 'Auto credited to your wallet'}
              </div>
            </div>
          </div>

          <span style={{ fontSize: '32px' }}>💰</span>
        </div>

        {/* 4. Telegram Profile Pill */}
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '8px 12px',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            textAlign: 'left'
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: '#2AABEE',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontSize: '15px',
              flexShrink: 0
            }}
          >
            <i className="fa-brands fa-telegram"></i>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: '13px',
                fontWeight: '800',
                color: '#0f172a',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {displayName}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>
              {displayHandle}
            </div>
          </div>
        </div>

        {/* 5. 📱 Mandatory Phone Number Input Field */}
        <div style={{ marginBottom: '14px', textAlign: 'left' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <label style={{ fontSize: '11.5px', fontWeight: 800, color: '#0f172a' }}>
              {lang === 'am' ? 'ስልክ ቁጥር (ግዴታ) *' : 'Phone Number (Required) *'}
            </label>
            <button
              type="button"
              onClick={handleOneTapContact}
              style={{
                background: 'none',
                border: 'none',
                color: '#2563eb',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <i className="fa-brands fa-telegram"></i>
              {lang === 'am' ? 'በቴሌግራም ሙላ' : 'Auto-fill'}
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              border: phoneError ? '1.5px solid #ef4444' : '1.5px solid #cbd5e1',
              borderRadius: '12px',
              padding: '8px 12px',
              background: '#ffffff'
            }}
          >
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#64748b', marginRight: '6px' }}>
              +251
            </span>
            <input
              type="tel"
              value={phoneInput.replace(/^\+?251|^0/, '')}
              onChange={e => {
                setPhoneError('');
                setPhoneInput('0' + e.target.value.replace(/\D/g, ''));
              }}
              placeholder="9XXXXXXXX / 7XXXXXXXX"
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '13.5px',
                fontWeight: 700,
                color: '#0f172a',
                width: '100%'
              }}
              required
            />
          </div>

          {phoneError && (
            <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600, marginTop: '4px' }}>
              {phoneError}
            </div>
          )}
        </div>

        {/* 6. Sonic Crimson Red Action CTA Button */}
        <button
          type="button"
          onClick={handleConfirmClick}
          disabled={isLoading}
          style={{
            width: '100%',
            background: 'linear-gradient(135deg, #e11d48 0%, #dc2626 50%, #b91c1c 100%)',
            color: '#ffffff',
            fontSize: '14px',
            fontWeight: '900',
            border: 'none',
            borderRadius: '999px',
            padding: '14px 18px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: '0 8px 24px rgba(225, 29, 72, 0.45)',
            textTransform: 'uppercase',
            letterSpacing: '0.4px',
            transition: 'all 0.15s ease'
          }}
        >
          {isLoading ? (
            <span>
              <i className="fa-solid fa-spinner fa-spin"></i>{' '}
              {lang === 'am' ? 'በመመዝገብ ላይ...' : 'Registering...'}
            </span>
          ) : (
            <span>
              🚀 {lang === 'am' ? `መለያ ፍጠርና ${bonusAmount} ብር ተቀበል` : `REGISTER & CLAIM ${bonusAmount} ETB`}
            </span>
          )}
        </button>

        {/* 7. Exact 3-Column Trust Bar */}
        <div
          style={{
            marginTop: '14px',
            paddingTop: '10px',
            borderTop: '1px solid #f1f5f9',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '6px',
            textAlign: 'left'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '5px' }}>
            <span style={{ color: '#dc2626', fontSize: '12px', marginTop: '1px' }}>
              <i className="fa-solid fa-circle-check"></i>
            </span>
            <div>
              <div style={{ fontSize: '10px', fontWeight: '800', color: '#0f172a' }}>
                {lang === 'am' ? '100% ነፃ' : '100% Free'}
              </div>
              <div style={{ fontSize: '8.5px', color: '#64748b' }}>
                {lang === 'am' ? 'ምንም ክፍያ የለም' : 'No fees'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '5px', borderLeft: '1px solid #f1f5f9', paddingLeft: '5px' }}>
            <span style={{ color: '#f59e0b', fontSize: '12px', marginTop: '1px' }}>
              <i className="fa-solid fa-bolt"></i>
            </span>
            <div>
              <div style={{ fontSize: '10px', fontWeight: '800', color: '#0f172a' }}>
                {lang === 'am' ? 'ፈጣን ክፍያ' : 'Instant Cash'}
              </div>
              <div style={{ fontSize: '8.5px', color: '#64748b' }}>
                {lang === 'am' ? 'በቴሌብር' : 'Telebirr'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '5px', borderLeft: '1px solid #f1f5f9', paddingLeft: '5px' }}>
            <span style={{ color: '#dc2626', fontSize: '12px', marginTop: '1px' }}>
              <i className="fa-solid fa-shield-halved"></i>
            </span>
            <div>
              <div style={{ fontSize: '10px', fontWeight: '800', color: '#0f172a' }}>
                {lang === 'am' ? 'የተጠበቀ' : 'Secure'}
              </div>
              <div style={{ fontSize: '8.5px', color: '#64748b' }}>
                {lang === 'am' ? '100% ህጋዊ' : 'Protected'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
