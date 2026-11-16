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
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !user?.id) return false;
    return localStorage.getItem(`sonic_phone_prompt_dismissed_${user.id}`) === 'true';
  });

  // If not authenticated, or no user, or user already has a valid phone, or dismissed once, do not render
  if (!isAuthenticated || !user) return null;
  if (user.phone && user.phone.trim().length >= 9) return null;
  if (isDismissed) return null;

  const handleDismiss = () => {
    if (user?.id) {
      localStorage.setItem(`sonic_phone_prompt_dismissed_${user.id}`, 'true');
    }
    setIsDismissed(true);
  };

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
        handleDismiss();
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
        handleDismiss();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update phone');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenBot = () => {
    telegramService.openTelegramLink('https://t.me/SonicGameOfficialBot?start=link_phone');
    handleDismiss();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
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
          borderRadius: '28px',
          width: '100%',
          maxWidth: '400px',
          padding: '28px 22px 20px',
          textAlign: 'center',
          boxShadow: '0 25px 60px -15px rgba(225, 29, 72, 0.3)',
          border: '1.5px solid rgba(254, 205, 211, 0.8)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative'
        }}
      >
        {/* Top-Right Dismiss 'X' Button */}
        <button
          type="button"
          onClick={handleDismiss}
          title="Dismiss"
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

        {/* Shield Icon Badge - Sonic Red Theme */}
        <div
          style={{
            width: '68px',
            height: '68px',
            borderRadius: '22px',
            background: 'linear-gradient(135deg, #e11d48 0%, #dc2626 50%, #b91c1c 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontSize: '30px',
            boxShadow: '0 10px 25px rgba(225, 29, 72, 0.45)',
            marginBottom: '16px',
            border: '2px solid rgba(255, 255, 255, 0.4)'
          }}
        >
          <i className="fa-solid fa-shield-halved"></i>
        </div>

        {/* Title */}
        <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', margin: '0 0 8px 0', letterSpacing: '-0.3px' }}>
          {lang === 'am' ? '📱 ስልክ ቁጥርዎን ያረጋግጡ' : '📱 Phone Verification'}
        </h2>

        {/* Subtitle */}
        <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.55, margin: '0 0 16px 0' }}>
          {lang === 'am'
            ? 'ወደ ሶኒክ ቢንጎ ለመግባት፣ 50 Birr ቦነስዎን ለመጠቀም እና ፈጣን ወጪ ክፍያ ለማረጋገጥ ስልክ ቁጥርዎን ያጋሩ።'
            : 'To unlock your 50 ETB Welcome Bonus and enable instant Telebirr withdrawals, please verify your phone number.'}
        </p>

        {/* Bonus Pill - Sonic Red Accent */}
        <div
          style={{
            background: '#fff1f2',
            border: '1.5px solid #fecdd3',
            borderRadius: '14px',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '18px',
            width: '100%'
          }}
        >
          <span style={{ fontSize: '22px' }}>🎁</span>
          <div style={{ textAlign: 'left' }}>
            <strong style={{ fontSize: '13.5px', color: '#9f1239', display: 'block', fontWeight: 800 }}>
              {lang === 'am' ? '50 Birr የመመዝገቢያ ቦነስ' : '50 ETB Signup Gift'}
            </strong>
            <span style={{ fontSize: '11.5px', color: '#be123c', fontWeight: 600 }}>
              {lang === 'am' ? 'ስልክዎን ሲያረጋግጡ ወዲያውኑ ገቢ ይደረጋል' : 'Credited upon phone verification'}
            </span>
          </div>
        </div>

        {/* Action 1: Telegram Native Contact Sharing (Primary - Sonic Red) */}
        <button
          type="button"
          onClick={handleTelegramContactShare}
          disabled={isSubmitting}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: '14px',
            border: 'none',
            background: 'linear-gradient(135deg, #e11d48 0%, #dc2626 50%, #b91c1c 100%)',
            color: '#ffffff',
            fontSize: '15px',
            fontWeight: 800,
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            boxShadow: '0 8px 24px rgba(225, 29, 72, 0.45)',
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
            marginBottom: '8px'
          }}
        >
          <i className="fa-solid fa-robot" style={{ color: '#64748b' }}></i>
          <span>{lang === 'am' ? 'በቦቱ በኩል ቁጥርዎን ያጋሩ' : 'Verify via Telegram Bot'}</span>
        </button>

        {/* Action 3: Toggle Manual Input */}
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
              cursor: 'pointer',
              padding: '4px'
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
                background: 'linear-gradient(135deg, #e11d48 0%, #dc2626 100%)',
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

        {/* 🌟 Remind Me Later (Dismiss / Skip) Button */}
        <button
          type="button"
          onClick={handleDismiss}
          style={{
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            fontSize: '12.5px',
            fontWeight: 700,
            cursor: 'pointer',
            padding: '8px 12px',
            marginTop: '8px',
            borderRadius: '8px',
            transition: 'color 0.15s ease'
          }}
        >
          {lang === 'am' ? 'ቆይተው ያረጋግጡ (አሁን ዝለል)' : 'Remind Me Later (Skip for now)'}
        </button>
      </div>
    </div>
  );
};
