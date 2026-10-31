import React from 'react';

export const TelebirrLogo: React.FC<{ size?: number; className?: string }> = ({ size = 32, className = '' }) => (
  <img
    src="/images/telebirr_logo.png"
    alt="Telebirr"
    style={{ height: `${size}px`, width: 'auto', objectFit: 'contain', display: 'block' }}
    className={className}
    onError={(e) => {
      // Fallback SVG if image fails
      const target = e.currentTarget;
      target.style.display = 'none';
    }}
  />
);

export const CBELogo: React.FC<{ size?: number; className?: string }> = ({ size = 32, className = '' }) => (
  <img
    src="/images/cbe_logo.png"
    alt="Commercial Bank of Ethiopia"
    style={{ height: `${size}px`, width: 'auto', objectFit: 'contain', display: 'block' }}
    className={className}
    onError={(e) => {
      const target = e.currentTarget;
      target.style.display = 'none';
    }}
  />
);

export const MpesaLogo: React.FC<{ size?: number; className?: string }> = ({ size = 32, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ display: 'block' }}
  >
    <rect width="100" height="100" rx="20" fill="#E60000" />
    <path d="M22 68V32H35L50 54L65 32H78V68H66V46L52 66H48L34 46V68H22Z" fill="#FFFFFF" />
    <circle cx="82" cy="22" r="6" fill="#00A859" />
  </svg>
);
