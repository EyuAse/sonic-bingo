import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { LanguageDropdown } from '../components/common/LanguageDropdown';
import { TrustFooter } from '../components/landing/TrustFooter';
import { EthiopianPhoneInput } from '../components/auth/EthiopianPhoneInput';
import { ForgotPinModal } from '../components/auth/ForgotPinModal';
import { TelegramLoginBanner } from '../components/auth/TelegramLoginBanner';
import { validateEthiopianPhone } from '../services/ethiopianPhoneValidator';

export const LoginPage: React.FC = () => {
  const { switchPage, showToast } = useApp();
  const { t, lang } = useLanguage();
  const { login } = useAuth();

  const [phone, setPhone] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState<boolean>(false);

  const phoneValidation = validateEthiopianPhone(phone);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phoneValidation.isValid) {
      showToast(
        phoneValidation.errorMessage ||
          (lang === 'am' ? '⚠️ ትክክለኛ የኢትዮጵያ ስልክ ቁጥር ያስገቡ።' : '⚠️ Please enter a valid Ethiopian phone number.')
      );
      return;
    }

    if (!pin) {
      showToast(lang === 'am' ? '⚠️ እባክዎ ሚስጥር ቁጥር ያስገቡ።' : '⚠️ Please enter your PIN.');
      return;
    }

    setIsLoading(true);
    try {
      const user = await login({
        phone: phoneValidation.canonicalNumber,
        pin: pin.trim(),
        rememberMe
      });

      showToast(
        lang === 'am'
          ? `እንኳን ደህና መጡ፣ ${user.fullName || 'ተጫዋች'}!`
          : `Welcome back, ${user.fullName || 'Player'}!`
      );
      switchPage('games');
    } catch (err: any) {
      showToast(`⚠️ ${err?.message || 'Login failed. Please check credentials.'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectDemoUser = (demoPhone: string, demoPin: string) => {
    setPhone(demoPhone);
    setPin(demoPin);
    showToast(`👤 Loaded demo credentials: ${demoPhone}`);
  };

  return (
    <div className="page active page-auth-fresh" id="page-login">
      {/* Background Floating Lemon Slices */}
      <div className="bg-floating-lemon-slice lemon-auth-left"></div>
      <div className="bg-floating-lemon-slice lemon-auth-right"></div>
      <div className="bg-floating-leaf leaf-auth-top"></div>
      <div className="bg-floating-leaf leaf-auth-bottom"></div>

      <div className="auth-fresh-container">
        {/* 1. Top Navigation Bar */}
        <div className="auth-fresh-topbar">
          <button
            type="button"
            className="btn-auth-back-square"
            id="login-back-btn"
            onClick={() => switchPage('landing')}
            title="Back"
          >
            <i className="fa-solid fa-chevron-left"></i>
          </button>

          <LanguageDropdown />
        </div>

        {/* 2. 3D Header Graphic */}
        <div className="auth-header-artwork-wrap">
          <img
            src="/assets/images/auth-header-75.jpg"
            alt="Bingo Cartelas and Balls"
            className="auth-header-art-img"
          />
        </div>

        {/* 3. Main White Auth Card */}
        <div className="auth-card-relative-shell">
          <div className="flanking-ball-ornament ball-left-yellow">
            <span className="ball-num">3</span>
          </div>

          <div className="flanking-ball-ornament ball-right-green">
            <span className="ball-num">9</span>
          </div>

          <div className="auth-fresh-card">
            <h1 className="auth-card-title">
              {t('auth.loginTitle')} <span className="title-lemon">👑</span>
            </h1>
            <p className="auth-card-sub">{t('auth.loginSub')}</p>

            {/* 1-Click Telegram Login */}
            <TelegramLoginBanner />

            <form className="auth-fresh-form" onSubmit={handleSubmit}>
              {/* Field 1: Ethiopian Phone Number */}
              <div className="auth-input-group">
                <label className="auth-input-label">{t('auth.phoneNumber')}</label>
                <EthiopianPhoneInput
                  value={phone}
                  onChange={setPhone}
                  autoFocus
                />
              </div>

              {/* Field 2: PIN */}
              <div className="auth-input-group">
                <div className="label-with-action-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="auth-input-label" style={{ margin: 0 }}>
                    {t('auth.password')}
                  </label>
                  <button
                    type="button"
                    className="btn-forgot-pin"
                    onClick={() => setIsForgotModalOpen(true)}
                    style={{ background: 'none', border: 'none', color: '#ca8a04', fontWeight: '700', fontSize: '11.5px', cursor: 'pointer' }}
                  >
                    {t('auth.forgotPin')}
                  </button>
                </div>

                <div className="auth-input-pill">
                  <div className="input-icon-wrap gold">
                    <i className="fa-solid fa-lock"></i>
                  </div>
                  <input
                    type={showPin ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={8}
                    value={pin}
                    onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                    placeholder={t('auth.passwordPlaceholder')}
                    required
                  />
                  <button
                    type="button"
                    className="btn-eye-toggle"
                    onClick={() => setShowPin(prev => !prev)}
                  >
                    <i className={`fa-solid ${showPin ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
              </div>

              {/* Remember Me & SSL Secured */}
              <div className="auth-meta-row">
                <label className="remember-checkbox-label">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                  />
                  <span className="custom-check-box">
                    <i className="fa-solid fa-check"></i>
                  </span>
                  <span className="remember-text">
                    {lang === 'am' ? 'አስታውሰኝ' : 'Remember me'}
                  </span>
                </label>

                <div className="ssl-badge">
                  <i className="fa-solid fa-shield-halved"></i>
                  <span>SSL Secured</span>
                </div>
              </div>

              {/* Action Button: Login ➔ */}
              <button
                type="submit"
                className="btn-auth-golden-cta"
                id="login-submit-btn"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span>
                    <i className="fa-solid fa-spinner fa-spin"></i>{' '}
                    {lang === 'am' ? 'በመግባት ላይ...' : 'Logging in...'}
                  </span>
                ) : (
                  <span>
                    <span>{t('auth.loginBtn')}</span>
                    <i className="fa-solid fa-arrow-right"></i>
                  </span>
                )}
              </button>
            </form>

            {/* Quick Test Demo Accounts Helper */}
            <div className="demo-accounts-strip">
              <div className="demo-accounts-title">
                <i className="fa-solid fa-flask-vial"></i> {t('auth.demoAccounts')}
              </div>
              <div className="demo-pills-row">
                <button
                  type="button"
                  className="btn-demo-pill"
                  onClick={() => handleSelectDemoUser('0983624574', '1234')}
                >
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></span>
                  <span>0983 624 574 (EthioTel)</span>
                </button>
                <button
                  type="button"
                  className="btn-demo-pill"
                  onClick={() => handleSelectDemoUser('0712345678', '4321')}
                >
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }}></span>
                  <span>0712 345 678 (Safaricom)</span>
                </button>
              </div>
            </div>

            {/* Switch to Sign Up */}
            <div className="auth-switch-link-row">
              <span>{t('auth.noAccount')} </span>
              <button
                type="button"
                className="btn-switch-auth"
                onClick={() => switchPage('signup')}
              >
                {t('auth.registerNow')}
              </button>
            </div>
          </div>
        </div>

        {/* 4. Bottom 3-Pillar Trust Footer */}
        <TrustFooter />
      </div>

      {/* Forgot PIN Modal */}
      <ForgotPinModal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
        onSuccess={() => {
          setIsForgotModalOpen(false);
          showToast(
            lang === 'am'
              ? '✅ ሚስጥር ቁጥርዎ በተሳካ ሁኔታ ተቀይሯል! አሁን መግባት ይችላሉ።'
              : '✅ Security PIN updated successfully! You can now log in.'
          );
        }}
      />
    </div>
  );
};
