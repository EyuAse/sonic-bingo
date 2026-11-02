import React from 'react';
import { useApp } from '../context/AppContext.tsx';
import { useLanguage } from '../context/LanguageContext.tsx';

export const AboutSonicPage: React.FC = () => {
  const { switchPage, showToast } = useApp();
  const { t, lang } = useLanguage();

  return (
    <div className="page active page-subpage-dedicated" id="page-about-sonic">
      {/* Top Back Navigation Bar */}
      <div className="subpage-back-header">
        <button
          type="button"
          className="btn-subpage-back"
          onClick={() => switchPage('profile')}
        >
          <i className="fa-solid fa-chevron-left"></i>
          <span>{t('nav.profile')}</span>
        </button>
        <h2 className="subpage-header-title">{t('about.title')}</h2>
        <div style={{ width: '40px' }}></div>
      </div>

      <div className="subpage-content-scroll">
        {/* Brand Logo & Version Hero */}
        <div className="about-brand-hero-card">
          <div className="about-logo-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <span className="logo-letter" style={{ fontSize: '24px', fontWeight: 900, color: '#38bdf8' }}>SONIC</span>
            <span className="logo-bingo-gold" style={{ fontSize: '24px', fontWeight: 900, color: '#f59e0b' }}>BINGO</span>
          </div>
          <span className="about-app-version">{t('about.version')}</span>
          <span className="about-tagline">{t('about.tagline')}</span>
        </div>

        {/* Licensing & Regulatory Authority */}
        <div className="about-info-group">
          <span className="about-group-title">
            <i className="fa-solid fa-building-columns gold"></i> {t('about.regulatory')}
          </span>

          <div className="about-compliance-card">
            <div className="compliance-row">
              <i className="fa-solid fa-shield-halved compliance-icon green"></i>
              <div>
                <strong className="compliance-title">{t('about.nlaTitle')}</strong>
                <p className="compliance-sub">{t('about.nlaSub')}</p>
              </div>
            </div>

            <div className="compliance-row" style={{ marginTop: '10px' }}>
              <i className="fa-solid fa-dice compliance-icon gold"></i>
              <div>
                <strong className="compliance-title">{t('about.rngTitle')}</strong>
                <p className="compliance-sub">{t('about.rngSub')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Game Engine Specifications */}
        <div className="about-info-group">
          <span className="about-group-title">
            <i className="fa-solid fa-microchip gold"></i> {t('about.specsTitle')}
          </span>

          <div className="engine-specs-grid">
            <div className="spec-card-item">
              <span className="spec-label">
                {lang === 'am' ? 'የጨዋታ አይነት' : 'GAME FORMAT'}
              </span>
              <strong className="spec-val">{t('about.format')}</strong>
            </div>

            <div className="spec-card-item">
              <span className="spec-label">
                {lang === 'am' ? 'የኳስ ፍጥነት' : 'DRAW SPEED'}
              </span>
              <strong className="spec-val">{t('about.speed')}</strong>
            </div>

            <div className="spec-card-item">
              <span className="spec-label">
                {lang === 'am' ? 'የአንባቢ ድምፅ' : 'CALLER AUDIO'}
              </span>
              <strong className="spec-val">{t('about.caller')}</strong>
            </div>

            <div className="spec-card-item">
              <span className="spec-label">
                {lang === 'am' ? 'የክፍያ ስርዓት' : 'SETTLEMENT'}
              </span>
              <strong className="spec-val">{t('about.settlement')}</strong>
            </div>
          </div>
        </div>

        {/* Responsible Gaming (18+) & Terms Links */}
        <div className="about-info-group">
          <div className="responsible-gaming-badge-bar">
            <span className="badge-18-circle">18+</span>
            <div className="badge-18-text">
              <strong>{t('about.responsible')}</strong>
              <p>{t('about.responsibleSub')}</p>
            </div>
          </div>
        </div>

        {/* Legal & Policy Action Links */}
        <div className="about-links-group">
          <button
            type="button"
            className="about-link-row"
            onClick={() => showToast('📜 Terms of Service: Regulated by Ethiopian National Lottery Administration')}
          >
            <span>{t('about.terms')}</span>
            <i className="fa-solid fa-arrow-up-right-from-square"></i>
          </button>
          <button
            type="button"
            className="about-link-row"
            onClick={() => showToast('🛡️ Privacy Policy: Bank-Grade End-to-End Encryption & Zero Data Sharing')}
          >
            <span>{t('about.privacy')}</span>
            <i className="fa-solid fa-arrow-up-right-from-square"></i>
          </button>
        </div>

        {/* Bottom System Signature */}
        <div className="about-bottom-signature">
          <p>© 2026 Sonic Entertainment PLC • All Rights Reserved.</p>
        </div>
      </div>
    </div>
  );
};

export const AboutLomiPage = AboutSonicPage;
export default AboutSonicPage;
