import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';
import { useAdmin } from '../context/AdminContext';
import { useWallet } from '../context/WalletContext';
import { useAuth } from '../context/AuthContext';
import { LanguageDropdown } from '../components/common/LanguageDropdown';
import { TrustFooter } from '../components/landing/TrustFooter';
import { EthiopianPhoneInput } from '../components/auth/EthiopianPhoneInput';
import { OtpVerificationModal } from '../components/auth/OtpVerificationModal';
import { TelegramLoginBanner } from '../components/auth/TelegramLoginBanner';
import { validateEthiopianPhone } from '../services/ethiopianPhoneValidator';

export const SignupPage: React.FC = () => {
  const { switchPage, showToast } = useApp();
  const { t, lang } = useLanguage();
  const { addUser, registerBonus } = useAdmin();
  const { addBonus } = useWallet();
  const { sendOtp, verifyOtp, register } = useAuth();

  const [phone, setPhone] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [referralCode, setReferralCode] = useState<string>('');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [agreeTerms, setAgreeTerms] = useState<boolean>(true);

  // OTP Verification States
  const [isOtpModalOpen, setIsOtpModalOpen] = useState<boolean>(false);
  const [isPhoneVerified, setIsPhoneVerified] = useState<boolean>(false);
  const [verifiedOtpCode, setVerifiedOtpCode] = useState<string>('');
  const [devOtpCode, setDevOtpCode] = useState<string | undefined>(undefined);
  const [isSendingOtp, setIsSendingOtp] = useState<boolean>(false);
  const [isRegistering, setIsRegistering] = useState<boolean>(false);

  const phoneValidation = validateEthiopianPhone(phone);

  const handleRequestOtp = async () => {
    if (!phoneValidation.isValid) {
      showToast(
        phoneValidation.errorMessage ||
          (lang === 'am' ? '⚠️ ትክክለኛ የኢትዮጵያ ስልክ ቁጥር ያስገቡ።' : '⚠️ Please enter a valid Ethiopian phone number.')
      );
      return;
    }

    setIsSendingOtp(true);
    try {
      const response = await sendOtp(phone);
      setDevOtpCode(response.devCode);
      setIsOtpModalOpen(true);
      showToast(`📩 ${response.message}`);
    } catch (err: any) {
      showToast(`⚠️ ${err?.message || 'Failed to send SMS code.'}`);
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = (code: string): boolean => {
    const result = verifyOtp(phone, code);
    if (result.valid) {
      setIsPhoneVerified(true);
      setVerifiedOtpCode(code);
      setTimeout(() => {
        setIsOtpModalOpen(false);
      }, 700);
      showToast(
        lang === 'am'
          ? '✅ ስልክ ቁጥርዎ በተሳካ ሁኔታ ተረጋግጧል! አሁን ሙሉ ስምዎንና ፒን ያስገቡ።'
          : '✅ Phone verified! Please enter your name & PIN below to finish.'
      );
      return true;
    } else {
      showToast(`⚠️ ${result.message}`);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phoneValidation.isValid) {
      showToast('⚠️ Please enter a valid Ethiopian phone number.');
      return;
    }

    // If phone is not verified yet, trigger OTP modal first
    if (!isPhoneVerified) {
      await handleRequestOtp();
      return;
    }

    if (!fullName || fullName.trim().length < 2) {
      showToast(lang === 'am' ? '⚠️ እባክዎ ሙሉ ስምዎን ያስገቡ።' : '⚠️ Please enter your full name.');
      return;
    }

    if (!pin || pin.length < 4 || pin.length > 8) {
      showToast(lang === 'am' ? '⚠️ ሚስጥር ቁጥር ከ4 እስከ 8 አሃዝ መሆን አለበት።' : '⚠️ PIN must be between 4 and 8 digits.');
      return;
    }

    if (pin !== confirmPin) {
      showToast(lang === 'am' ? '⚠️ የተሰጡት ሚስጥር ቁጥሮች አይመሳሰሉም።' : '⚠️ PIN numbers do not match.');
      return;
    }

    if (!agreeTerms) {
      showToast(lang === 'am' ? '⚠️ እባክዎ የአገልግሎት ውሎችን ይቀበሉ።' : '⚠️ Please agree to the Terms & Conditions.');
      return;
    }

    setIsRegistering(true);
    try {
      const newUser = await register({
        phone: phoneValidation.canonicalNumber,
        fullName: fullName.trim(),
        pin: pin.trim(),
        referralCode: referralCode.trim() || undefined,
        otpCode: verifiedOtpCode
      });

      // Register in Admin context
      addUser({
        name: newUser.fullName,
        phone: newUser.formattedPhone,
        balance: 0,
        bonus: registerBonus,
        referralCount: referralCode.trim() ? 1 : 0,
        totalDeposited: 0,
        totalWithdrawn: 0,
        status: 'active'
      });

      showToast(
        `🎉 ${lang === 'am'
          ? `እንኳን ደህና መጡ ${newUser.fullName}! የ${registerBonus} ብር ነፃ ቦነስ ተጨምሯል!`
          : `Welcome ${newUser.fullName}! +${registerBonus} ETB Free Registration Bonus Credited!`}`
      );

      switchPage('games');
    } catch (err: any) {
      showToast(`⚠️ ${err?.message || 'Registration failed.'}`);
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="page active page-auth-fresh" id="page-signup">
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
            id="signup-back-btn"
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
              {t('auth.signupTitle')} <span className="title-lemon">🍋</span>
            </h1>
            <p className="auth-card-sub">{t('auth.signupSub')}</p>

            {/* 1-Click Telegram Login */}
            <TelegramLoginBanner />

            <form className="auth-fresh-form" onSubmit={handleSubmit}>
              {/* Field 1: Ethiopian Phone Number */}
              <div className="auth-input-group">
                <div className="label-with-action-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="auth-input-label" style={{ margin: 0 }}>
                    {t('auth.phoneNumber')}
                  </label>
                  {isPhoneVerified ? (
                    <span className="verified-dot-tag" style={{ background: '#dcfce7', color: '#15803d', fontSize: '11px', padding: '2px 8px', borderRadius: '999px', fontWeight: '700' }}>
                      <i className="fa-solid fa-circle-check"></i> {t('auth.phoneVerified')}
                    </span>
                  ) : phoneValidation.isValid ? (
                    <button
                      type="button"
                      className="btn-send-otp-inline"
                      onClick={handleRequestOtp}
                      disabled={isSendingOtp}
                      style={{ background: 'none', border: 'none', color: '#ca8a04', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}
                    >
                      {isSendingOtp ? (
                        <span><i className="fa-solid fa-spinner fa-spin"></i> {lang === 'am' ? 'በመላክ ላይ...' : 'Sending...'}</span>
                      ) : (
                        <span><i className="fa-solid fa-paper-plane"></i> {lang === 'am' ? 'ኮድ ላክ (SMS)' : 'Verify SMS'}</span>
                      )}
                    </button>
                  ) : null}
                </div>

                <EthiopianPhoneInput
                  value={phone}
                  onChange={val => {
                    setPhone(val);
                    if (isPhoneVerified) setIsPhoneVerified(false);
                  }}
                  disabled={isPhoneVerified}
                  autoFocus
                />
              </div>

              {/* Field 2: Full Name */}
              <div className="auth-input-group">
                <label className="auth-input-label">{t('auth.fullName')}</label>
                <div className="auth-input-pill">
                  <div className="input-icon-wrap blue">
                    <i className="fa-solid fa-user"></i>
                  </div>
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder={t('auth.fullNamePlaceholder')}
                    required
                  />
                </div>
              </div>

              {/* Field 3: Create PIN */}
              <div className="auth-input-group">
                <label className="auth-input-label">{t('auth.password')}</label>
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

              {/* Field 4: Confirm PIN */}
              <div className="auth-input-group">
                <label className="auth-input-label">{t('auth.confirmPassword')}</label>
                <div className="auth-input-pill">
                  <div className="input-icon-wrap gold">
                    <i className="fa-solid fa-check-double"></i>
                  </div>
                  <input
                    type={showPin ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={8}
                    value={confirmPin}
                    onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                    placeholder={t('auth.confirmPlaceholder')}
                    required
                  />
                </div>
              </div>

              {/* Field 5: Referral Code (Optional) */}
              <div className="auth-input-group">
                <label className="auth-input-label">
                  {lang === 'am' ? 'የመጋበዣ ኮድ (አስገዳጅ አይደለም)' : 'Referral Code (Optional)'}
                </label>
                <div className="auth-input-pill">
                  <div className="input-icon-wrap green">
                    <i className="fa-solid fa-gift"></i>
                  </div>
                  <input
                    type="text"
                    value={referralCode}
                    onChange={e => setReferralCode(e.target.value)}
                    placeholder="e.g. SONIC-7842"
                  />
                </div>
              </div>

              {/* Terms & SSL Secured */}
              <div className="auth-meta-row">
                <label className="remember-checkbox-label">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={e => setAgreeTerms(e.target.checked)}
                  />
                  <span className="custom-check-box">
                    <i className="fa-solid fa-check"></i>
                  </span>
                  <span className="remember-text">{t('auth.agreeTerms')}</span>
                </label>

                <div className="ssl-badge">
                  <i className="fa-solid fa-shield-halved"></i>
                  <span>AfroMessage SSL</span>
                </div>
              </div>

              {/* Action Button */}
              <button
                type="submit"
                className="btn-auth-golden-cta"
                id="signup-submit-btn"
                disabled={isSendingOtp || isRegistering}
              >
                {isRegistering ? (
                  <span>
                    <i className="fa-solid fa-spinner fa-spin"></i>{' '}
                    {lang === 'am' ? 'በመመዝገብ ላይ...' : 'Creating Account...'}
                  </span>
                ) : !isPhoneVerified ? (
                  <span>
                    <i className="fa-solid fa-shield-halved"></i>{' '}
                    {lang === 'am' ? 'ስልክ ቁጥር አረጋግጥና ተመዝገብ' : 'Verify Phone & Create Account'}
                  </span>
                ) : (
                  <span>
                    <span>{t('auth.signupBtn')}</span>
                    <i className="fa-solid fa-arrow-right"></i>
                  </span>
                )}
              </button>
            </form>

            {/* Switch to Login */}
            <div className="auth-switch-link-row">
              <span>{t('auth.haveAccount')} </span>
              <button
                type="button"
                className="btn-switch-auth"
                onClick={() => switchPage('login')}
              >
                {t('auth.loginNow')}
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Trust Footer */}
        <TrustFooter />
      </div>

      {/* OTP Verification Modal */}
      <OtpVerificationModal
        isOpen={isOtpModalOpen}
        phone={phone}
        devCode={devOtpCode}
        onVerify={handleVerifyOtp}
        onResend={handleRequestOtp}
        onClose={() => setIsOtpModalOpen(false)}
      />
    </div>
  );
};
