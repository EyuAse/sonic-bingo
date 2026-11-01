import React from 'react';

interface SonicLogoProps {
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

export const LomiLogo: React.FC<SonicLogoProps> = ({ size = 'md', onClick }) => {
  return (
    <div
      className={`sonic-brand-logo sonic-logo-${size}`}
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textDecoration: 'none',
        userSelect: 'none'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', lineHeight: 1 }}>
        <span style={{ fontSize: size === 'lg' ? '2.4rem' : size === 'sm' ? '1.2rem' : '1.7rem', filter: 'drop-shadow(0 2px 8px rgba(234, 179, 8, 0.4))' }}>
          👑
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{
            fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif",
            fontWeight: 950,
            fontSize: size === 'lg' ? '2.2rem' : size === 'sm' ? '1.1rem' : '1.55rem',
            color: '#0f172a',
            letterSpacing: '1px'
          }}>
            SONIC
          </span>
          <span style={{
            fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif",
            fontWeight: 950,
            fontSize: size === 'lg' ? '2.2rem' : size === 'sm' ? '1.1rem' : '1.55rem',
            background: 'linear-gradient(135deg, #facc15 0%, #ca8a04 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '1px'
          }}>
            BINGO
          </span>
        </div>
      </div>
      <div style={{
        fontSize: size === 'lg' ? '0.75rem' : size === 'sm' ? '0.55rem' : '0.65rem',
        fontWeight: 800,
        color: '#ca8a04',
        letterSpacing: '3px',
        marginTop: '2px',
        textTransform: 'uppercase'
      }}>
        • ETHIOPIA LIVE ARENA •
      </div>
    </div>
  );
};

export const SonicLogo = LomiLogo;
