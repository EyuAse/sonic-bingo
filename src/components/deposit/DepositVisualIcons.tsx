import React from 'react';

/**
 * 👑 Sonic Crown Logo
 * High-definition 5-point royal gold crown with metallic gradients,
 * jewel insets, and glowing specular highlights.
 */
export const SonicCrownLogo: React.FC<{ size?: number; className?: string; style?: React.CSSProperties }> = ({
  size = 36,
  className = '',
  style
}) => (
  <svg
    width={size}
    height={Math.round(size * 0.78)}
    viewBox="0 0 100 78"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ display: 'inline-block', verticalAlign: 'middle', filter: 'drop-shadow(0 2px 6px rgba(217, 119, 6, 0.45))', ...style }}
  >
    <defs>
      <linearGradient id="sonicGoldGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFF2A3" />
        <stop offset="25%" stopColor="#F59E0B" />
        <stop offset="50%" stopColor="#FDE047" />
        <stop offset="75%" stopColor="#D97706" />
        <stop offset="100%" stopColor="#78350F" />
      </linearGradient>
      <linearGradient id="sonicGoldGrad2" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#B45309" />
        <stop offset="40%" stopColor="#FBBF24" />
        <stop offset="70%" stopColor="#FEF08A" />
        <stop offset="100%" stopColor="#D97706" />
      </linearGradient>
      <linearGradient id="sonicGoldBase" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#B45309" />
        <stop offset="20%" stopColor="#FDE047" />
        <stop offset="50%" stopColor="#FFFBEB" />
        <stop offset="80%" stopColor="#F59E0B" />
        <stop offset="100%" stopColor="#78350F" />
      </linearGradient>
      <radialGradient id="jewelGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="60%" stopColor="#FDE047" />
        <stop offset="100%" stopColor="#D97706" />
      </radialGradient>
      <filter id="softCrownGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="2" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>

    {/* Crown Base Band */}
    <path
      d="M12 56 Q50 64 88 56 L85 68 Q50 75 15 68 Z"
      fill="url(#sonicGoldBase)"
      stroke="#78350F"
      strokeWidth="1"
    />

    {/* Base Band Jewels */}
    <circle cx="25" cy="62" r="3" fill="#EF4444" stroke="#78350F" strokeWidth="0.8" />
    <circle cx="50" cy="64.5" r="4" fill="url(#jewelGlow)" stroke="#78350F" strokeWidth="0.8" />
    <circle cx="75" cy="62" r="3" fill="#3B82F6" stroke="#78350F" strokeWidth="0.8" />

    {/* Main Crown Body with 5 Peaks */}
    <path
      d="M12 56 
         L6 26 Q14 28 24 38 
         L35 20 Q42 28 50 12 
         Q58 28 65 20 
         L76 38 Q86 28 94 26 
         L88 56 
         Q50 64 12 56 Z"
      fill="url(#sonicGoldGrad1)"
      stroke="#78350F"
      strokeWidth="1.2"
      filter="url(#softCrownGlow)"
    />

    {/* Inner Depth Facets */}
    <path
      d="M50 12 L43 45 Q50 49 57 45 Z"
      fill="url(#sonicGoldGrad2)"
      opacity="0.85"
    />
    <path
      d="M6 26 L24 38 L27 52 Q20 50 12 56 Z"
      fill="url(#sonicGoldGrad2)"
      opacity="0.6"
    />
    <path
      d="M94 26 L76 38 L73 52 Q80 50 88 56 Z"
      fill="url(#sonicGoldGrad2)"
      opacity="0.6"
    />

    {/* Top Peak Diamond Pearls */}
    <circle cx="6" cy="24" r="4" fill="url(#jewelGlow)" stroke="#78350F" strokeWidth="0.8" />
    <circle cx="35" cy="18" r="4.5" fill="url(#jewelGlow)" stroke="#78350F" strokeWidth="0.8" />
    <circle cx="50" cy="10" r="6" fill="url(#jewelGlow)" stroke="#78350F" strokeWidth="1" />
    <circle cx="65" cy="18" r="4.5" fill="url(#jewelGlow)" stroke="#78350F" strokeWidth="0.8" />
    <circle cx="94" cy="24" r="4" fill="url(#jewelGlow)" stroke="#78350F" strokeWidth="0.8" />

    {/* Center Pearl Star Glint */}
    <path
      d="M50 7 L51.5 10 L54.5 10 L52 11.5 L53 14 L50 12.5 L47 14 L48 11.5 L45.5 10 L48.5 10 Z"
      fill="#FFFFFF"
      opacity="0.9"
    />
  </svg>
);

/**
 * 🪙 3D Gold Coins Stack Icon
 * Rich stacked gold coins for the Deposit Amount card header.
 */
export const GoldCoinsStackIcon: React.FC<{ size?: number; className?: string }> = ({ size = 32, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ filter: 'drop-shadow(0 2px 5px rgba(217, 119, 6, 0.4))' }}
  >
    <defs>
      <linearGradient id="coinGradRim" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFF2A3" />
        <stop offset="40%" stopColor="#F59E0B" />
        <stop offset="100%" stopColor="#B45309" />
      </linearGradient>
      <linearGradient id="coinGradFace" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FEF08A" />
        <stop offset="60%" stopColor="#FBBF24" />
        <stop offset="100%" stopColor="#D97706" />
      </linearGradient>
      <linearGradient id="coinEdge" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#D97706" />
        <stop offset="50%" stopColor="#F59E0B" />
        <stop offset="100%" stopColor="#78350F" />
      </linearGradient>
    </defs>

    {/* Bottom Coin (Coin 3) */}
    <path d="M12 40 C12 45 21 49 32 49 C43 49 52 45 52 40 L52 46 C52 51 43 55 32 55 C21 55 12 51 12 46 Z" fill="url(#coinEdge)" />
    <ellipse cx="32" cy="40" rx="20" ry="7" fill="url(#coinGradFace)" stroke="#B45309" strokeWidth="1" />

    {/* Middle Coin (Coin 2) */}
    <path d="M10 30 C10 35 19 39 30 39 C41 39 50 35 50 30 L50 36 C50 41 41 45 30 45 C19 45 10 41 10 36 Z" fill="url(#coinEdge)" />
    <ellipse cx="30" cy="30" rx="20" ry="7" fill="url(#coinGradFace)" stroke="#B45309" strokeWidth="1" />

    {/* Top Coin (Coin 1) */}
    <path d="M14 20 C14 25 24 29 36 29 C48 29 58 25 58 20 L58 26 C58 31 48 35 36 35 C24 35 14 31 14 26 Z" fill="url(#coinEdge)" />
    <ellipse cx="36" cy="20" rx="22" ry="8" fill="url(#coinGradFace)" stroke="#B45309" strokeWidth="1" />
    <ellipse cx="36" cy="20" rx="17" ry="5.5" fill="none" stroke="#FDE047" strokeWidth="1.2" strokeDasharray="3 2" />
    <text x="36" y="23" textAnchor="middle" fill="#78350F" fontSize="10" fontWeight="900" fontFamily="sans-serif">ETB</text>
  </svg>
);

/**
 * 👤 Crowned Agent Avatar Icon
 * Rounded golden card badge with black user silhouette wearing a small gold crown.
 */
export const AgentAvatarIcon: React.FC<{ size?: number; className?: string }> = ({ size = 46, className = '' }) => (
  <div
    className={className}
    style={{
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: '14px',
      background: 'linear-gradient(135deg, #FFFBEB 0%, #FDE047 30%, #F59E0B 70%, #D97706 100%)',
      boxShadow: '0 3px 10px rgba(217, 119, 6, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.8)',
      border: '1px solid #FCD34D',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      flexShrink: 0
    }}
  >
    <svg width={Math.round(size * 0.65)} height={Math.round(size * 0.65)} viewBox="0 0 36 36" fill="none">
      {/* Crown on Avatar Head */}
      <path
        d="M13 10 L11 5 L14.5 7 L18 3 L21.5 7 L25 5 L23 10 Z"
        fill="#FEF08A"
        stroke="#78350F"
        strokeWidth="0.8"
      />
      {/* Head */}
      <circle cx="18" cy="14" r="5" fill="#0F172A" />
      {/* Shoulders / Body */}
      <path
        d="M9 29 C9 23 13 21 18 21 C23 21 27 23 27 29 C27 30 25 31 18 31 C11 31 9 30 9 29 Z"
        fill="#0F172A"
      />
      {/* Small Gold Chest Crown Brooch */}
      <path d="M16 26 L18 24 L20 26 L19 28 L17 28 Z" fill="#FBBF24" />
    </svg>
  </div>
);

/**
 * 🔘 3D Golden Radio Jewel Button
 * Luminous concentric golden radio button indicator.
 */
export const GoldenRadioJewel: React.FC<{ checked?: boolean; size?: number }> = ({ checked = true, size = 26 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 28 28"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ filter: 'drop-shadow(0 2px 4px rgba(217, 119, 6, 0.35))' }}
  >
    <defs>
      <radialGradient id="jewelOuterRing" cx="50%" cy="50%" r="50%">
        <stop offset="70%" stopColor="#FFFBEB" />
        <stop offset="90%" stopColor="#FDE047" />
        <stop offset="100%" stopColor="#D97706" />
      </radialGradient>
      <radialGradient id="jewelCenterGlow" cx="40%" cy="40%" r="60%">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="40%" stopColor="#FDE047" />
        <stop offset="80%" stopColor="#F59E0B" />
        <stop offset="100%" stopColor="#B45309" />
      </radialGradient>
    </defs>
    {/* Outer Gold Rim */}
    <circle cx="14" cy="14" r="13" fill="url(#jewelOuterRing)" stroke="#D97706" strokeWidth="1.5" />
    {/* Inner White Gap */}
    <circle cx="14" cy="14" r="9" fill="#FFFDF5" stroke="#FDE047" strokeWidth="0.8" />
    {/* Center Gold Jewel (Active) */}
    {checked && (
      <circle cx="14" cy="14" r="5.5" fill="url(#jewelCenterGlow)" stroke="#B45309" strokeWidth="0.8" />
    )}
  </svg>
);

/**
 * 🎁 Golden Gift Box Icon
 * For the "+150 Sonic Coins" loyalty incentive card.
 */
export const GoldenGiftBoxIcon: React.FC<{ size?: number; className?: string }> = ({ size = 32, className = '' }) => (
  <div
    className={className}
    style={{
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: '10px',
      background: 'linear-gradient(135deg, #FEF08A 0%, #F59E0B 100%)',
      boxShadow: '0 2px 6px rgba(217, 119, 6, 0.3)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }}
  >
    <svg width={Math.round(size * 0.65)} height={Math.round(size * 0.65)} viewBox="0 0 24 24" fill="none">
      {/* Box Lid */}
      <rect x="3" y="7" width="18" height="4" rx="1.5" fill="#0F172A" />
      {/* Box Body */}
      <rect x="4.5" y="11" width="15" height="10" rx="1.5" fill="#0F172A" />
      {/* Vertical Ribbon */}
      <rect x="10.5" y="7" width="3" height="14" fill="#FDE047" />
      {/* Ribbon Bow */}
      <path
        d="M12 7 C10 4 6 5 8 7 C10 8 12 7 12 7 Z M12 7 C14 4 18 5 16 7 C14 8 12 7 12 7 Z"
        fill="#FDE047"
        stroke="#B45309"
        strokeWidth="0.6"
      />
    </svg>
  </div>
);

/**
 * 🏛️ 3D Gold Bank Columns Icon
 * Classical bank building icon for CBE Bank / Birr payment rail tab.
 */
export const GoldBankColumnsIcon: React.FC<{ size?: number; className?: string }> = ({ size = 22, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ filter: 'drop-shadow(0 1px 3px rgba(245, 158, 11, 0.4))' }}
  >
    <defs>
      <linearGradient id="bankGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFF2A3" />
        <stop offset="50%" stopColor="#F59E0B" />
        <stop offset="100%" stopColor="#D97706" />
      </linearGradient>
    </defs>
    {/* Triangular Pediment Roof */}
    <path d="M16 4 L4 11 L28 11 Z" fill="url(#bankGoldGrad)" stroke="#B45309" strokeWidth="0.8" />
    {/* Architrave */}
    <rect x="5" y="11" width="22" height="2" fill="#FEF08A" />
    {/* Columns (3) */}
    <rect x="7" y="13" width="3.5" height="11" rx="1" fill="url(#bankGoldGrad)" />
    <rect x="14.25" y="13" width="3.5" height="11" rx="1" fill="url(#bankGoldGrad)" />
    <rect x="21.5" y="13" width="3.5" height="11" rx="1" fill="url(#bankGoldGrad)" />
    {/* Base Steps */}
    <rect x="4" y="24" width="24" height="2" rx="0.5" fill="#FEF08A" />
    <rect x="2" y="26" width="28" height="2.5" rx="1" fill="url(#bankGoldGrad)" stroke="#B45309" strokeWidth="0.6" />
  </svg>
);

/**
 * 🌊 Liquid Metallic Gold Corner Swoosh
 * Luxury metallic gold decorative sweep rendered on the bottom right of obsidian cards.
 */
export const LiquidGoldCornerSwoosh: React.FC<{ className?: string; opacity?: number }> = ({
  className = '',
  opacity = 0.95
}) => (
  <div
    className={className}
    style={{
      position: 'absolute',
      right: 0,
      bottom: 0,
      width: '120px',
      height: '65px',
      pointerEvents: 'none',
      overflow: 'hidden',
      borderBottomRightRadius: 'inherit',
      opacity
    }}
  >
    <svg width="120" height="65" viewBox="0 0 120 65" fill="none">
      <defs>
        <linearGradient id="liquidGold1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F59E0B" stopOpacity="0" />
          <stop offset="35%" stopColor="#B45309" stopOpacity="0.4" />
          <stop offset="65%" stopColor="#FDE047" stopOpacity="0.95" />
          <stop offset="85%" stopColor="#F59E0B" stopOpacity="1" />
          <stop offset="100%" stopColor="#78350F" stopOpacity="1" />
        </linearGradient>
        <linearGradient id="liquidGoldEdge" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#F59E0B" stopOpacity="0" />
          <stop offset="60%" stopColor="#FFF2A3" stopOpacity="1" />
          <stop offset="100%" stopColor="#FBBF24" stopOpacity="0.8" />
        </linearGradient>
      </defs>
      {/* Outer Ribbon */}
      <path
        d="M0 65 C40 60 70 45 120 0 L120 65 Z"
        fill="url(#liquidGold1)"
      />
      {/* Upper Glowing Highlight Edge */}
      <path
        d="M0 65 C40 60 70 45 120 0"
        stroke="url(#liquidGoldEdge)"
        strokeWidth="2"
      />
      {/* Secondary Ribbon Wave */}
      <path
        d="M30 65 C60 58 85 45 120 20 L120 65 Z"
        fill="#FDE047"
        opacity="0.25"
      />
    </svg>
  </div>
);

/**
 * ✓ Golden Checkmark Circle Badge
 * Displayed on unselected/light agent cards.
 */
export const GoldenCheckCircle: React.FC<{ size?: number }> = ({ size = 26 }) => (
  <div
    style={{
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #FEF08A 0%, #FBBF24 50%, #F59E0B 100%)',
      boxShadow: '0 2px 6px rgba(245, 158, 11, 0.4)',
      border: '1px solid #D97706',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#0F172A',
      fontWeight: 900,
      fontSize: `${Math.round(size * 0.55)}px`,
      flexShrink: 0
    }}
  >
    ✓
  </div>
);
