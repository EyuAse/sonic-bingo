import React from 'react';

interface LomiLogoProps {
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

export const LomiLogo: React.FC<LomiLogoProps> = ({ size = 'md', onClick }) => {
  return (
    <div
      className={`lomi-brand-logo lomi-logo-${size}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className="lomi-logo-main">
        <span className="lomi-char">L</span>
        <span className="lomi-lemon-wrapper">
          <svg className="lemon-svg" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Lemon Leaves */}
            <path
              d="M19 10C17 6 13 4 10 5C11 9 13 11 17 12L19 10Z"
              fill="#22c55e"
            />
            <path
              d="M21 10C24 6 28 5 31 7C29 10 27 12 23 12L21 10Z"
              fill="#16a34a"
            />
            {/* Lemon Body */}
            <ellipse
              cx="20"
              cy="23"
              rx="14"
              ry="12"
              fill="url(#lemon-grad)"
            />
            <ellipse
              cx="20"
              cy="23"
              rx="13.5"
              ry="11.5"
              stroke="#ca8a04"
              strokeWidth="0.8"
            />
            {/* Lemon Tip */}
            <path
              d="M6 23C5 23 4 23.5 4 24C4 24.5 5 25 6 25L7 24L6 23Z"
              fill="#facc15"
            />
            <path
              d="M34 23C35 23 36 23.5 36 24C36 24.5 35 25 34 25L33 24L34 23Z"
              fill="#facc15"
            />
            {/* Highlight */}
            <ellipse
              cx="16"
              cy="18"
              rx="6"
              ry="3"
              transform="rotate(-20 16 18)"
              fill="white"
              fillOpacity="0.4"
            />
            <defs>
              <radialGradient
                id="lemon-grad"
                cx="0"
                cy="0"
                r="1"
                gradientUnits="userSpaceOnUse"
                gradientTransform="translate(16 19) rotate(45) scale(16 14)"
              >
                <stop stopColor="#fef08a" />
                <stop offset="0.6" stopColor="#facc15" />
                <stop offset="1" stopColor="#eab308" />
              </radialGradient>
            </defs>
          </svg>
        </span>
        <span className="lomi-char">M</span>
        <span className="lomi-char">I</span>
      </div>
      <div className="lomi-logo-sub">
        <span>•</span>
        <span>B</span>
        <span>I</span>
        <span>N</span>
        <span>G</span>
        <span>O</span>
        <span>•</span>
      </div>
    </div>
  );
};
