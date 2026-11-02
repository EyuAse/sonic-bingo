import React, { useState, useEffect } from 'react';
import { LandingNavbar } from '../components/landing/LandingNavbar.tsx';
import { BlumOnboardingCarousel } from '../components/landing/BlumOnboardingCarousel.tsx';
import { TrustFooter } from '../components/landing/TrustFooter.tsx';
import { useApp } from '../context/AppContext.tsx';
import { useLanguage } from '../context/LanguageContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useAdmin } from '../context/AdminContext.tsx';
import { useWallet } from '../context/WalletContext.tsx';
import { TelegramRegisterModal } from '../components/auth/TelegramRegisterModal.tsx';
import { NewPlayerWelcomeModal } from '../components/auth/NewPlayerWelcomeModal.tsx';
import { User } from '../types/auth.ts';

export const LandingPage: React.FC = () => {
  const { switchPage, showToast } = useApp();
  const { t, lang } = useLanguage();
  const { loginWithTelegram, telegramUser, user } = useAuth();
  const { addUser, registerBonus } = useAdmin();
  const { addBonus } = useWallet();

  const [isLoading, setIsLoading] = useState(false);
  const [createdUser, setCreatedUser] = useState<User | null>(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [isExistingAccount, setIsExistingAccount] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const storedUser = localStorage.getItem('sonic_user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        if (parsed && (parsed.id || parsed.telegramId)) {
          return true;
        }
      }
    } catch {}
    return false;
  });

  // Dynamically verify existing account state from auth context or local cache
  useEffect(() => {
    if (user && (user.telegramId || user.id)) {
      setIsExistingAccount(true);
      return;
    }

    if (typeof window !== 'undefined') {
      try {
        const storedUser = localStorage.getItem('sonic_user');
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          if (parsed && (parsed.id || parsed.telegramId)) {
            setIsExistingAccount(true);
            return;
          }
        }
      } catch {}

      // Check if user previously logged out from Telegram on this device
      const tgId = telegramUser?.id || (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user?.id;
      if (tgId && localStorage.getItem(`sonic_explicit_logout_${tgId}`) === 'true') {
        setIsExistingAccount(true);
        return;
      }
    }

    setIsExistingAccount(false);
  }, [user, telegramUser]);

  // When new user taps "Claim 20 ETB Bonus" on Slide 3 -> Open clean registration modal
  const handleOpenRegisterModal = () => {
    setShowRegisterModal(true);
  };

  // When user confirms registration inside TelegramRegisterModal
  const handleConfirmRegistration = async () => {
    setIsLoading(true);
    try {
      const activeTg = telegramUser || (typeof window !== 'undefined' ? (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user : undefined);
      const { user, isNewUser } = await loginWithTelegram(activeTg || undefined);

      setShowRegisterModal(false);

      if (isNewUser) {
        addUser({
          name: user.fullName,
          phone: user.formattedPhone,
          balance: 0,
          bonus: registerBonus,
          referralCount: 0,
          totalDeposited: 0,
          totalWithdrawn: 0,
          status: 'active'
        });
        setCreatedUser(user);
        setShowWelcomeModal(true);
        setIsExistingAccount(true);
      } else {
        showToast(
          lang === 'am'
            ? `እንኳን ደህና መጡ፣ ${user.fullName}!`
            : `Welcome back, ${user.fullName}!`
        );
        switchPage('games');
      }
    } catch (err: any) {
      showToast(`⚠️ ${err?.message || 'Registration failed.'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // When existing user clicks "Sign in as [Name]"
  const handleExistingUserLogin = async () => {
    setIsLoading(true);
    try {
      const activeTg = telegramUser || (typeof window !== 'undefined' ? (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user : undefined);
      const { user } = await loginWithTelegram(activeTg || undefined);
      showToast(
        lang === 'am'
          ? `እንኳን ደህና መጡ፣ ${user.fullName}!`
          : `Welcome back, ${user.fullName}!`
      );
      switchPage('games');
    } catch (err: any) {
      showToast(`⚠️ ${err?.message || 'Login failed.'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const activeTgUser = telegramUser || (typeof window !== 'undefined' ? (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user : null);
  const displayName = activeTgUser
    ? `${activeTgUser.first_name || ''} ${activeTgUser.last_name || ''}`.trim() || `@${activeTgUser.username}`
    : (user?.fullName || 'Telegram Player');

  return (
    <div className="page active page-landing-fresh vip-casino-theme" id="page-landing">
      {/* 1. Brand Logo & Language Switcher at Top */}
      <LandingNavbar />

      {/* VIP Luxury Gold Light Atmosphere */}
      <div className="bg-vip-gold-glow top-left-glow"></div>
      <div className="bg-vip-gold-glow center-right-glow"></div>

      {/* 2. Main Content Area: Onboarding Carousel for New Users VS Iconic Hero for Existing Users */}
      <main className="landing-fresh-hero-container">
        {!isExistingAccount ? (
          /* A. NEW USERS: Interactive 3-Slide Onboarding (Strictly Step-by-Step, No premature account creation) */
          <div style={{ padding: '0 4px' }}>
            <BlumOnboardingCarousel
              onClaimBonus={handleOpenRegisterModal}
              isLoading={isLoading}
              onSkip={handleOpenRegisterModal}
            />
          </div>
        ) : (
          /* B. EXISTING USERS: Iconic 3D VIP Casino Layout matching Reference Image 2 */
          <>
            {/* Pretitle */}
            <p className="hero-fresh-pretitle">{t('landing.pretitle')}</p>

            {/* Main Title: Play Bingo with 3D Crown on top of Play */}
            <div className="hero-title-crowned-wrap">
              <span className="hero-vip-title-crown">👑</span>
              <h1 className="hero-fresh-title">{t('landing.title')}</h1>
            </div>

            {/* Tagline */}
            <p className="hero-fresh-tagline">{t('landing.tagline')}</p>

            {/* Promo 20 ETB Welcome Bonus Box (Matching Reference Image 2) */}
            <div className="hero-vip-bonus-card">
              <div className="vip-bonus-gift-box">
                <img
                  src="/assets/images/sonic-gift-box-3d.jpg"
                  alt="3D Gold Gift Box"
                  className="vip-gift-img"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                    if (e.currentTarget.parentElement) {
                      e.currentTarget.parentElement.innerHTML = '<span style="font-size: 2.4rem;">🎁</span>';
                    }
                  }}
                />
              </div>
              <div className="vip-bonus-text-content">
                <span className="vip-promo-lbl">{lang === 'am' ? 'የነፃ መመዝገቢያ ስጦታ' : 'FREE SIGN UP BONUS'}</span>
                <div className="vip-bonus-huge">+20.00 ETB</div>
                <div className="vip-bonus-divider">
                  <span className="vip-divider-line"></span>
                  <span className="vip-divider-text">{lang === 'am' ? 'ቦነስ' : 'BONUS'}</span>
                  <span className="vip-divider-line"></span>
                </div>
              </div>
            </div>

            {/* Under-Bonus Free Cartela Subtext */}
            <div className="hero-vip-cartela-sub">
              <span className="vip-ticket-emoji">🎟️</span>
              <span>{lang === 'am' ? '+ 1 ነፃ ካርቴላ • 0 ተቀማጭ ያስፈልጋል' : '+ 1 Free Cartela • 0 Deposit Needed'}</span>
            </div>

            {/* Glowing 24k Gold 1-Click Action Button */}
            <button
              type="button"
              className="btn-hero-vip-cta"
              id="landing-continue-btn"
              onClick={handleExistingUserLogin}
              disabled={isLoading}
            >
              <i className="fa-solid fa-user vip-btn-user-icon"></i>
              <span className="vip-btn-label">
                {isLoading
                  ? (lang === 'am' ? 'በመግባት ላይ...' : 'Connecting...')
                  : (lang === 'am' ? `እንደ ${displayName} ግባ` : `Sign in as ${displayName}`)}
              </span>
              <i className="fa-solid fa-chevron-right vip-btn-chevron-icon"></i>
            </button>

            {/* 3. Hero 3D Artwork Card (Crowned 75-Ball on Gold Podium & Cartelas) */}
            <div className="hero-fresh-artwork-card vip-artwork-card">
              <img
                src="/assets/images/sonic-hero-75-vip.jpg"
                alt="75-Ball Sonic Bingo VIP 3D Podium"
                className="hero-artwork-img"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/assets/images/fast-bingo-exact-hero.jpg';
                }}
              />
            </div>

            {/* 4. Exact 4-Pillar Dark Obsidian Glass Trust Footer */}
            <TrustFooter />
          </>
        )}
      </main>

      {/* 1. Pure Telegram Registration Confirmation Modal */}
      <TelegramRegisterModal
        isOpen={showRegisterModal}
        bonusAmount={registerBonus}
        isLoading={isLoading}
        onConfirm={handleConfirmRegistration}
        onClose={() => setShowRegisterModal(false)}
      />

      {/* 2. Hamster Kombat Style Level 1 Welcome Card Modal */}
      <NewPlayerWelcomeModal
        isOpen={showWelcomeModal}
        user={createdUser}
        bonusAmount={registerBonus}
        onClose={() => {
          setShowWelcomeModal(false);
          switchPage('games');
        }}
      />
    </div>
  );
};
