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
        background: 'radial-gradient(ellipse at 50% 20%, #ffffff 0%, #fff9f9 45%, #fff1f2 80%, #ffe4e6 100%)',
        color: '#0f172a',
        padding: '24px',
        textAlign: 'center',
        fontFamily: "'Inter', sans-serif"
      }}
    >
      {/* Brand Logo with Soft Rose & Gold Ambient Glow */}
      <div
        style={{
          transform: 'scale(1.25)',
          marginBottom: '32px',
          filter: 'drop-shadow(0 10px 25px rgba(225, 29, 72, 0.2))'
        }}
      >
        <SonicLogo size="lg" theme="light" />
      </div>

      {/* Brand Subtitle Pill */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          background: '#ffffff',
          border: '1.5px solid #fecdd3',
          backdropFilter: 'blur(10px)',
          padding: '6px 16px',
          borderRadius: '999px',
          fontSize: '12px',
          fontWeight: 850,
          color: '#e11d48',
          marginBottom: '36px',
          boxShadow: '0 4px 16px rgba(225, 29, 72, 0.1)'
        }}
      >
        <span>🇪🇹</span>
        <span>{lang === 'am' ? 'የቀጥታ 75-ኳስ ቢንጎ' : 'Live 75-Ball Bingo'}</span>
      </div>

      {/* Modern High-End Circular Spinner - Sonic Red & Gold */}
      <div
        style={{
          width: '38px',
          height: '38px',
          borderRadius: '50%',
          border: '3px solid #fecdd3',
          borderTopColor: '#e11d48',
          borderRightColor: '#f59e0b',
          animation: 'sonicSpin 0.85s linear infinite',
          marginBottom: '18px',
          boxShadow: '0 0 18px rgba(225, 29, 72, 0.25)'
        }}
      />

      {/* Friendly Status Label */}
      <div
        style={{
          fontSize: '13.5px',
          fontWeight: 700,
          color: '#475569',
          letterSpacing: '0.2px'
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
