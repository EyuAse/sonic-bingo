import React from 'react';
import { SonicLogo } from './SonicLogo';
import { useLanguage } from '../../context/LanguageContext';

export const AppSplashScreen: React.FC = () => {
  const { lang } = useLanguage();

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse at 50% 25%, #0f172a 0%, #090d16 55%, #030508 100%)',
        color: '#f8fafc',
        padding: '24px',
        textAlign: 'center',
        fontFamily: "'Inter', sans-serif"
      }}
    >
      {/* Brand Logo with Soft Gold Ambient Glow */}
      <div
        style={{
          transform: 'scale(1.25)',
          marginBottom: '32px',
          filter: 'drop-shadow(0 12px 30px rgba(245, 158, 11, 0.4))'
        }}
      >
        <SonicLogo size="lg" />
      </div>

      {/* Brand Subtitle Pill */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(255, 255, 255, 0.06)',
          border: '1px solid rgba(250, 204, 21, 0.35)',
          backdropFilter: 'blur(10px)',
          padding: '6px 16px',
          borderRadius: '999px',
          fontSize: '12px',
          fontWeight: 800,
          color: '#fef08a',
          marginBottom: '36px',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
        }}
      >
        <span>🇪🇹</span>
        <span>{lang === 'am' ? 'የቀጥታ 75-ኳስ ቢንጎ' : 'Live 75-Ball Bingo'}</span>
      </div>

      {/* Modern High-End Circular Spinner */}
      <div
        style={{
          width: '38px',
          height: '38px',
          borderRadius: '50%',
          border: '3px solid rgba(255, 255, 255, 0.08)',
          borderTopColor: '#38bdf8',
          borderRightColor: '#facc15',
          animation: 'sonicSpin 0.85s linear infinite',
          marginBottom: '18px',
          boxShadow: '0 0 15px rgba(56, 189, 248, 0.25)'
        }}
      />

      {/* Friendly Status Label */}
      <div
        style={{
          fontSize: '13.5px',
          fontWeight: 700,
          color: '#cbd5e1',
          letterSpacing: '0.3px',
          textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)'
        }}
      >
        {lang === 'am' ? 'እንኳን ወደ ሶኒክ ቢንጎ በደህና መጡ! በመገናኘት ላይ...' : 'Welcome to Sonic Bingo! Connecting...'}
      </div>

      <style>{`
        @keyframes sonicSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default AppSplashScreen;
