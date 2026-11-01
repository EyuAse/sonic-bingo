import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useApp } from '../../context/AppContext';
import { User } from '../../types/auth';
import { telegramService } from '../../services/telegramService';

interface NewPlayerWelcomeModalProps {
  isOpen: boolean;
  user: User | null;
  bonusAmount: number;
  onClose: () => void;
}

export const NewPlayerWelcomeModal: React.FC<NewPlayerWelcomeModalProps> = ({
  isOpen,
  user,
  bonusAmount,
  onClose
}) => {
  const { lang } = useLanguage();
  const { switchPage } = useApp();

  if (!isOpen || !user) return null;

  const handleStartPlaying = () => {
    telegramService.triggerHaptic('success');
    onClose();
    switchPage('games');
  };

  // Sanitize player name to prevent font fallback / broken glyphs [?]
  const rawName = user.fullName || (user.telegramUsername ? `@${user.telegramUsername}` : 'Sonic Player');
  const cleanDisplayName = rawName
    .replace(/[\u0000-\u001F\u007F-\u009F\uFFFD\uFFFE\uFFFF]/g, '')
    .trim() || 'Sonic Player';

  const displayUsername = user.telegramUsername ? `@${user.telegramUsername}` : 'Verified Player';
  const effectiveBonus = bonusAmount > 0 ? bonusAmount : 20;

  return (
    <div className="otp-modal-overlay">
      <div className="otp-modal-backdrop" onClick={onClose}></div>
      <div
        className="otp-modal-card sonic-welcome-modal-card"
        style={{
          maxWidth: '390px',
          width: '92%',
          background: '#ffffff',
          color: '#0f172a',
          borderRadius: '28px',
          padding: '28px 22px 24px',
          border: '1px solid #f1f5f9',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.2), 0 0 25px rgba(234, 179, 8, 0.15)',
          textAlign: 'center',
          position: 'relative'
        }}
      >
        {/* Close Button */}
        <button
          type="button"
          className="btn-otp-modal-close"
          onClick={onClose}
          title="Close"
          style={{
            position: 'absolute',
            top: '14px',
            right: '14px',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            color: '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '14px'
          }}
          aria-label="Close Welcome Modal"
        >
          <i className="fa-solid fa-xmark"></i>
        </button>

        {/* Royal 3D Crown Emblem with Golden Halo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '14px' }}>
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, #fffdf0 0%, #fef9c3 60%, #fef08a 100%)',
              border: '2px solid #facc15',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 6px 18px rgba(234, 179, 8, 0.35)',
              fontSize: '2.5rem',
              lineHeight: 1
            }}
          >
            👑
          </div>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 900,
              color: '#ca8a04',
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              marginTop: '6px',
              fontFamily: 'Outfit, sans-serif'
            }}
          >
            SONIC BINGO
          </span>
        </div>

        {/* Level 1 Badge */}
        <div
          style={{
            display: 'inline-block',
            background: '#fef9c3',
            border: '1px solid #fde047',
            borderRadius: '999px',
            padding: '3px 12px',
            fontSize: '11px',
            fontWeight: 800,
            color: '#854d0e',
            letterSpacing: '0.8px',
            textTransform: 'uppercase',
            marginBottom: '10px'
          }}
        >
          ⭐ LVL 1 • {lang === 'am' ? 'ጀማሪ ተጫዋች' : 'ROOKIE BINGO MASTER'}
        </div>

        {/* Player Greeting */}
        <h3
          style={{
            fontSize: '22px',
            fontWeight: 900,
            margin: '0 0 4px 0',
            letterSpacing: '-0.3px',
            color: '#0f172a',
            fontFamily: 'Outfit, sans-serif'
          }}
        >
          {lang === 'am' ? `እንኳን ደህና መጡ፣ ${cleanDisplayName}!` : `Welcome, ${cleanDisplayName}!`}
        </h3>

        <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px 0', fontWeight: 500 }}>
          {displayUsername} •{' '}
          <span style={{ color: '#16a34a', fontWeight: 700 }}>
            🟢 {lang === 'am' ? 'መለያዎ ተረጋግጧል' : 'Account Verified'}
          </span>
        </p>

        {/* +20.00 ETB Welcome Bonus Reward Box */}
        <div
          style={{
            background: 'linear-gradient(135deg, #fffdf8 0%, #fefce8 60%, #fef08a 100%)',
            border: '1.5px solid #eab308',
            borderRadius: '20px',
            padding: '16px 14px',
            marginBottom: '18px',
            boxShadow: '0 4px 16px rgba(234, 179, 8, 0.15)'
          }}
        >
          <div
            style={{
              fontSize: '11px',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              color: '#854d0e'
            }}
          >
            🎁 {lang === 'am' ? 'የመጀመሪያ መመዝገቢያ ቦነስ' : 'FREE SIGN UP BONUS'}
          </div>

          <div
            style={{
              fontSize: '34px',
              fontWeight: 950,
              color: '#0f172a',
              margin: '4px 0',
              letterSpacing: '-0.5px',
              fontFamily: 'Outfit, sans-serif'
            }}
          >
            +{effectiveBonus}.00{' '}
            <span style={{ fontSize: '18px', fontWeight: 800, color: '#eab308' }}>ETB</span>
          </div>

          <div style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>
            {lang === 'am'
              ? 'ወደ ቦርሳዎ ገቢ ተደርጓል • አሁኑኑ መጫወት ይችላሉ!'
              : 'Added to your wallet • Ready for live games!'}
          </div>
        </div>

        {/* Big CTA Action Button (Pitch-Black Obsidian) */}
        <button
          type="button"
          onClick={handleStartPlaying}
          style={{
            width: '100%',
            background: '#0f172a',
            color: '#ffffff',
            fontSize: '15px',
            fontWeight: 900,
            border: 'none',
            borderRadius: '999px',
            padding: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: '0 6px 20px rgba(15, 23, 42, 0.35)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            transition: 'all 0.15s ease'
          }}
        >
          <i className="fa-solid fa-play"></i>{' '}
          {lang === 'am' ? 'አሁኑኑ ጨዋታ ጀምር 🚀' : 'TAP TO PLAY LIVE BINGO 🚀'}
        </button>
      </div>
    </div>
  );
};
