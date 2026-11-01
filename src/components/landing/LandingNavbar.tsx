import React from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { LanguageDropdown } from '../common/LanguageDropdown.tsx';

export const LandingNavbar: React.FC = () => {
  const { switchPage } = useApp();

  return (
    <header className="landing-fresh-navbar">
      {/* Left: Royal 3D Crown + Sonic Bingo Brand Logo with Gold Divider */}
      <div className="landing-nav-left" onClick={() => switchPage('landing')} style={{ cursor: 'pointer' }}>
        <div className="sonic-vip-nav-brand">
          <span className="sonic-vip-crown">👑</span>
          <div className="sonic-vip-brand-text">
            <span className="sonic-brand-primary">Sonic</span>
            <span className="sonic-brand-sub">Bingo</span>
          </div>
        </div>
        <div className="sonic-vip-nav-divider"></div>
      </div>

      {/* Right: Language Pill Only (Dark Luxury Pill matching Reference Image) */}
      <div className="landing-nav-right">
        <LanguageDropdown />
      </div>
    </header>
  );
};
