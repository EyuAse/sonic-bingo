import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';

export const TrustFooter: React.FC = () => {
  const { lang } = useLanguage();

  return (
    <footer className="landing-fresh-trust-bar vip-dark-trust-bar">
      {/* 1. Fast Play */}
      <div className="trust-pillar-item">
        <span className="pillar-gold-icon">⚡</span>
        <div className="pillar-text-group">
          <strong className="pillar-title">{lang === 'am' ? 'ፈጣን' : 'Fast'}</strong>
          <span className="pillar-sub">{lang === 'am' ? 'ጨዋታ' : 'Play'}</span>
        </div>
      </div>

      <div className="trust-pillar-sep"></div>

      {/* 2. Big Wins */}
      <div className="trust-pillar-item">
        <span className="pillar-gold-icon">🏆</span>
        <div className="pillar-text-group">
          <strong className="pillar-title">{lang === 'am' ? 'ትልቅ' : 'Big'}</strong>
          <span className="pillar-sub">{lang === 'am' ? 'ሽልማቶች' : 'Wins'}</span>
        </div>
      </div>

      <div className="trust-pillar-sep"></div>

      {/* 3. Safe & Secure */}
      <div className="trust-pillar-item">
        <span className="pillar-gold-icon">🛡️</span>
        <div className="pillar-text-group">
          <strong className="pillar-title">{lang === 'am' ? 'ደህንነቱ' : 'Safe &'}</strong>
          <span className="pillar-sub">{lang === 'am' ? 'የተጠበቀ' : 'Secure'}</span>
        </div>
      </div>

      <div className="trust-pillar-sep"></div>

      {/* 4. 24/7 Support */}
      <div className="trust-pillar-item">
        <span className="pillar-gold-icon">🎧</span>
        <div className="pillar-text-group">
          <strong className="pillar-title">24/7</strong>
          <span className="pillar-sub">{lang === 'am' ? 'ድጋፍ' : 'Support'}</span>
        </div>
      </div>
    </footer>
  );
};
