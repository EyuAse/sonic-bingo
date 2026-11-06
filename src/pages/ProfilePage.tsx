import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { ProfileHeader } from '../components/wallet/ProfileHeader';
import { EthiopiaFlag, UKFlag } from '../components/common/FlagIcons';
import { GameInstructionsModal } from '../components/profile/GameInstructionsModal';

export const ProfilePage: React.FC = () => {
  const { switchPage, showToast } = useApp();
  const { lang, toggleLang, t } = useLanguage();
  const { logout } = useAuth();
  const [isInstructionsOpen, setIsInstructionsOpen] = useState<boolean>(false);

  const handleLogout = () => {
    logout();
    showToast(lang === 'am' ? '👋 በተሳካ ሁኔታ ወጥተዋል።' : '👋 You have been logged out.');
    switchPage('landing');
  };

  return (
    <div className="page active page-profile-fresh" id="page-profile">
      {/* 1. User Profile Banner Card */}
      <ProfileHeader onEditClick={() => switchPage('account-info')} />

      <div className="profile-settings-content-scroll">
        {/* ============================================================
            CATEGORY 1: GENERAL SETTINGS
            ============================================================ */}
        <div className="profile-category-group">
          <span className="category-section-title">{t('profile.generalSettings')}</span>

          <div className="profile-settings-card">
            {/* Account Information -> Dedicated Page */}
            <div
              className="settings-row-item"
              onClick={() => switchPage('account-info')}
            >
              <div className="settings-row-icon-circ">
                <i className="fa-solid fa-user-gear"></i>
              </div>
              <div className="settings-row-text-col">
                <strong className="settings-row-title">{t('profile.accountInfo')}</strong>
                <span className="settings-row-sub">{t('profile.accountInfoSub')}</span>
              </div>
              <i className="fa-solid fa-chevron-right settings-chevron"></i>
            </div>

            {/* Game Instructions -> Opens Bilingual Modal */}
            <div
              className="settings-row-item"
              onClick={() => setIsInstructionsOpen(true)}
              style={{ cursor: 'pointer' }}
            >
              <div className="settings-row-icon-circ" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#d97706' }}>
                <i className="fa-solid fa-book-open-reader"></i>
              </div>
              <div className="settings-row-text-col">
                <strong className="settings-row-title">
                  {lang === 'am' ? 'የጨዋታ መመሪያዎች' : 'Game Instructions'}
                </strong>
                <span className="settings-row-sub">
                  {lang === 'am' ? 'ምዝገባ፣ ተቀማጭ፣ ወጪ እና አጨዋወት' : 'Registration, deposits, withdrawals & rules'}
                </span>
              </div>
              <i className="fa-solid fa-chevron-right settings-chevron"></i>
            </div>
          </div>
        </div>

        {/* ============================================================
            CATEGORY 2: PREFERENCES
            ============================================================ */}
        <div className="profile-category-group">
          <span className="category-section-title">{t('profile.preferences')}</span>

          <div className="profile-settings-card">
            {/* Language */}
            <div className="settings-row-item" onClick={toggleLang}>
              <div className="settings-row-icon-circ">
                <i className="fa-solid fa-globe"></i>
              </div>
              <div className="settings-row-text-col">
                <strong className="settings-row-title">{t('profile.language')}</strong>
                <span className="settings-row-sub">
                  {lang === 'am' ? 'የመተግበሪያውን ቋንቋ ይቀይሩ' : 'Choose your preferred language'}
                </span>
              </div>
              <div className="settings-lang-pill-wrap">
                <span className="lang-preview-pill">
                  <span className="pill-flag-box" style={{ display: 'inline-flex', alignItems: 'center' }}>
                    {lang === 'am' ? <EthiopiaFlag width={22} height={15} /> : <UKFlag width={22} height={15} />}
                  </span>
                  <span style={{ fontWeight: 800 }}>{lang === 'am' ? 'አማርኛ' : 'English'}</span>
                </span>
                <i className="fa-solid fa-chevron-right settings-chevron"></i>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================
            CATEGORY 3: SUPPORT & ABOUT
            ============================================================ */}
        <div className="profile-category-group">
          <span className="category-section-title">{t('profile.supportAbout')}</span>

          <div className="profile-settings-card">
            {/* Help Center -> Dedicated Page */}
            <div
              className="settings-row-item"
              onClick={() => switchPage('help')}
            >
              <div className="settings-row-icon-circ">
                <i className="fa-regular fa-circle-question"></i>
              </div>
              <div className="settings-row-text-col">
                <strong className="settings-row-title">{t('profile.helpCenter')}</strong>
                <span className="settings-row-sub">{t('profile.helpCenterSub')}</span>
              </div>
              <i className="fa-solid fa-chevron-right settings-chevron"></i>
            </div>

            {/* About Sonic Bingo -> Dedicated Page */}
            <div
              className="settings-row-item"
              onClick={() => switchPage('about')}
            >
              <div className="settings-row-icon-circ">
                <i className="fa-solid fa-shield-halved"></i>
              </div>
              <div className="settings-row-text-col">
                <strong className="settings-row-title">{t('profile.aboutSonic') || t('profile.aboutLomi')}</strong>
                <span className="settings-row-sub">{t('profile.aboutSonicSub') || t('profile.aboutLomiSub')}</span>
              </div>
              <i className="fa-solid fa-chevron-right settings-chevron"></i>
            </div>
          </div>
        </div>

        {/* ============================================================
            CATEGORY 4: LOGOUT
            ============================================================ */}
        <div className="profile-category-group">
          <div className="profile-settings-card">
            <div className="settings-row-item logout-row" onClick={handleLogout}>
              <div className="settings-row-icon-circ logout">
                <i className="fa-solid fa-arrow-right-from-bracket"></i>
              </div>
              <div className="settings-row-text-col">
                <strong className="settings-row-title text-danger">{t('profile.logout')}</strong>
                <span className="settings-row-sub">{t('profile.logoutSub')}</span>
              </div>
              <i className="fa-solid fa-chevron-right settings-chevron"></i>
            </div>
          </div>
        </div>
      </div>

      {/* Game Instructions Modal */}
      <GameInstructionsModal
        isOpen={isInstructionsOpen}
        onClose={() => setIsInstructionsOpen(false)}
      />
    </div>
  );
};
