import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { useApp } from '../../context/AppContext.tsx';
import { telegramService } from '../../services/telegramService.ts';
import { validateEthiopianPhone } from '../../services/ethiopianPhoneValidator.ts';
import { apiClient } from '../../services/apiClient.ts';

export const MandatoryPhoneVerificationModal: React.FC = () => {
  const { user, isAuthenticated, updateProfile } = useAuth();
  const { lang } = useLanguage();
  const { showToast } = useApp();

  const [manualPhone, setManualPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);

  // If not authenticated, or no user, or user already has a valid phone, do not render gate
  if (!isAuthenticated || !user) return null;
  if (user.phone && user.phone.trim().length >= 9) return null;

  const handleTelegramContactShare = async () => {
    try {
      setIsSubmitting(true);
      const rawPhone = await telegramService.requestTelegramPhone();
      if (!rawPhone) {
        showToast(
          lang === 'am'
            ? '⚠️ ስልክ ቁጥርዎን ማጋራት አልተሳካም። እባክዎ በቦቱ በኩል ያረጋግጡ።'
            : '⚠️ Phone sharing cancelled or not supported. Please verify via bot.'
        );
        setIsSubmitting(false);
        return;
      }

      // Normalize phone
      let clean = rawPhone.replace(/^\+?251/, '0').replace(/\s+/g, '');
      if (!clean.startsWith('0')) clean = '0' + clean;

      // Update backend & local user state
      const res = await apiClient.auth.updateProfile({ phone: clean });
      if (res && res.user) {
        await updateProfile({
          phone: clean,
          nationalPhone: clean,
          formattedPhone: clean,
          isPhoneVerified: true
        });
        showToast(
          lang === 'am'
            ? '✅ ስልክ ቁጥርዎ በተሳካ ሁኔታ ተረጋግጧል! 50 ETB ቦነስ ተሰጥቷል።'
            : '✅ Phone number verified successfully! 50 ETB Bonus active.'
        );
      }
    } catch (err: any) {
      console.error('Failed to verify via Telegram Contact:', err);
      showToast(err.message || 'Verification error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateEthiopianPhone(manualPhone);
    if (!validation.isValid) {
      showToast(validation.errorMessage || '⚠️ Please enter a valid Ethiopian phone number (09... or 07...).');
      return;
    }

    try {
      setIsSubmitting(true);
      const clean = validation.nationalNumber;
      const res = await apiClient.auth.updateProfile({ phone: clean });
      if (res && res.user) {
        await updateProfile({
          phone: clean,
          nationalPhone: clean,
          formattedPhone: validation.formattedDisplay,
          carrier: validation.carrier || undefined,
          isPhoneVerified: true
        });
        showToast(
          lang === 'am'
            ? '✅ ስልክ ቁጥርዎ በተሳካ ሁኔታ ተረጋግጧል!'
            : '✅ Phone number verified successfully!'
        );
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update phone');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenBot = () => {
    telegramService.openTelegramLink('https://t.me/SonicGameOfficialBot?start=link_phone');
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.88)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.25s ease'
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '420px',
          padding: '28px 24px',
          textAlign: 'center',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          border: '1px solid rgba(226, 232, 240, 0.8)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}
      >
        {/* Shield Icon Badge */}
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontSize: '28px',
            boxShadow: '0 10px 25px rgba(16, 185, 129, 0.4)',
            marginBottom: '16px'
          }}
        >
          <i className="fa-solid fa-shield-halved"></i>
        </div>

        {/* Title */}
        <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', margin: '0 0 8px 0', letterSpacing: '-0.3px' }}>
          {lang === 'am' ? '📱 ስልክ ቁጥርዎን ያረጋግጡ' : '📱 Phone Verification Required'}
        </h2>

        {/* Subtitle */}
        <p style={{ fontSize: '13.5px', color: '#64748b', lineHeight: 1.55, margin: '0 0 20px 0' }}>
          {lang === 'am'
            ? 'ወደ ሶኒክ ቢንጎ ለመግባት፣ 50 Birr ቦነስዎን ለመጠቀም እና ፈጣን ወጪ ክፍያ ለማረጋገጥ እውነተኛ ስልክ ቁጥርዎን ማረጋገጥ አለብዎት።'
            : 'To enter Sonic Bingo, claim your 50 ETB Welcome Bonus, and enable instant payouts, please verify your mobile number.'}
        </p>

        {/* Bonus Pill */}
        <div
          style={{
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            borderRadius: '12px',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '20px',
            width: '100%'
          }}
        >
          <span style={{ fontSize: '20px' }}>🎁</span>
          <div style={{ textAlign: 'left' }}>
            <strong style={{ fontSize: '13px', color: '#065f46', display: 'block' }}>
              {lang === 'am' ? '50 Birr የመመዝገቢያ ቦነስ' : '50 ETB Signup Gift'}
            </strong>
            <span style={{ fontSize: '11.5px', color: '#047857' }}>
              {lang === 'am' ? 'ስልክዎን እንዳረጋገጡ ወዲያውኑ ገቢ ይደረጋል' : 'Credited instantly upon phone verification'}
            </span>
          </div>
        </div>

        {/* Action 1: Telegram Native Contact Sharing (Primary) */}
        <button
          type="button"
          onClick={handleTelegramContactShare}
          disabled={isSubmitting}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: '14px',
            border: 'none',
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
            color: '#ffffff',
            fontSize: '15px',
            fontWeight: 800,
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            boxShadow: '0 8px 20px rgba(37, 99, 235, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            marginBottom: '10px',
            transition: 'all 0.15s ease'
          }}
        >
          <i className="fa-brands fa-telegram" style={{ fontSize: '18px' }}></i>
          <span>
            {isSubmitting
              ? (lang === 'am' ? 'በማረጋገጥ ላይ...' : 'Verifying...')
              : (lang === 'am' ? 'በቴሌግራም አረጋግጥ (One-Tap)' : 'Verify with Telegram Contact')}
          </span>
        </button>

        {/* Action 2: Bot Redirect Button */}
        <button
          type="button"
          onClick={handleOpenBot}
          disabled={isSubmitting}
          style={{
            width: '100%',
            padding: '11px',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            background: '#f8fafc',
            color: '#334155',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginBottom: '12px'
          }}
        >
          <i className="fa-solid fa-robot" style={{ color: '#64748b' }}></i>
          <span>{lang === 'am' ? 'በቦቱ በኩል ቁጥርዎን ያጋሩ' : 'Verify via Telegram Bot'}</span>
        </button>

        {/* Toggle Manual Input for Browser or Desktop users */}
        <div style={{ marginTop: '4px', width: '100%' }}>
          {!showManualInput ? (
            <button
              type="button"
              onClick={() => setShowManualInput(true)}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                fontSize: '12px',
                fontWeight: 600,
                textDecoration: 'underline',
                cursor: 'pointer'
              }}
            >
              {lang === 'am' ? 'ወይም ቁጥርዎን በእጅ ያስገቡ' : 'Or enter phone number manually'}
            </button>
          ) : (
            <form onSubmit={handleManualSubmit} style={{ marginTop: '8px', width: '100%' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '12px',
                  padding: '6px 12px',
                  background: '#f8fafc',
                  marginBottom: '10px'
                }}
              >
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#475569', marginRight: '6px' }}>
                  +251
                </span>
                <input
                  type="tel"
                  value={manualPhone}
                  onChange={e => setManualPhone(e.target.value)}
                  placeholder="9XXXXXXXX / 7XXXXXXXX"
                  style={{
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    fontSize: '14px',
                    fontWeight: 700,
                    color: '#0f172a',
                    width: '100%'
                  }}
                  autoFocus
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#10b981',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer'
                }}
              >
                {lang === 'am' ? 'አረጋግጥና አስቀምጥ' : 'Verify & Save'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
