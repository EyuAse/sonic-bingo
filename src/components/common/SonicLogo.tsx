import React from 'react';

interface SonicLogoProps {
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  showSubdots?: boolean;
}

export const SonicLogo: React.FC<SonicLogoProps> = ({
  size = 'md',
  onClick,
  showSubdots = true
}) => {
  // Sizing definitions
  const dimensions = {
    sm: { crown: '24px', crownFont: '14px', sonic: '14px', bingo: '14px', dots: '7px', gap: '4px' },
    md: { crown: '38px', crownFont: '22px', sonic: '19px', bingo: '19px', dots: '8.5px', gap: '6px' },
    lg: { crown: '56px', crownFont: '32px', sonic: '26px', bingo: '26px', dots: '10px', gap: '8px' }
  }[size];

  return (
    <div
      className={`sonic-brand-logo sonic-logo-${size}`}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none'
      }}
    >
      {/* 1. Royal 3D Crown Coin Badge */}
      <div
        className="sonic-crown-coin"
        style={{
          width: dimensions.crown,
          height: dimensions.crown,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 30%, #fef08a 0%, #f59e0b 55%, #b45309 100%)',
          boxShadow: '0 0 25px rgba(245, 158, 11, 0.55), inset 0 2px 4px rgba(255, 255, 255, 0.75)',
          border: '2px solid rgba(254, 240, 138, 0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: dimensions.crownFont,
          marginBottom: dimensions.gap,
          filter: 'drop-shadow(0 4px 10px rgba(0, 0, 0, 0.35))'
        }}
      >
        👑
      </div>

      {/* 2. Brand Name Row: SONIC | BINGO */}
      <div
        className="sonic-logo-typography"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: dimensions.gap,
          lineHeight: 1
        }}
      >
        <span
          style={{
            fontSize: dimensions.sonic,
            fontWeight: 950,
            fontFamily: "'Outfit', 'Inter', sans-serif",
            letterSpacing: '2.5px',
            color: '#38bdf8',
            textShadow: '0 0 14px rgba(56, 189, 248, 0.65)'
          }}
        >
          SONIC
        </span>
        <span
          style={{
            color: 'rgba(255, 255, 255, 0.35)',
            fontSize: dimensions.sonic,
            fontWeight: 400
          }}
        >
          |
        </span>
        <span
          style={{
            fontSize: dimensions.bingo,
            fontWeight: 950,
            fontFamily: "'Outfit', 'Inter', sans-serif",
            letterSpacing: '2px',
            color: '#facc15',
            textShadow: '0 0 14px rgba(250, 204, 21, 0.65)'
          }}
        >
          BINGO
        </span>
      </div>

      {/* 3. Subtitle dots */}
      {showSubdots && (
        <div
          className="sonic-subdots"
          style={{
            fontSize: dimensions.dots,
            fontWeight: 800,
            letterSpacing: '4px',
            color: 'rgba(255, 255, 255, 0.55)',
            textTransform: 'uppercase',
            marginTop: '4px'
          }}
        >
          • B I N G O •
        </div>
      )}
    </div>
  );
};

export default SonicLogo;
