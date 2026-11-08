import React, { useState, useEffect } from 'react';
import { useApp } from './context/AppContext.tsx';
import { useAuth } from './context/AuthContext.tsx';
import { useAdmin } from './context/AdminContext.tsx';
import { useWallet } from './context/WalletContext.tsx';
import { TopHeader } from './components/common/TopHeader.tsx';
import { BalanceBar } from './components/common/BalanceBar.tsx';
import { BottomNav } from './components/common/BottomNav.tsx';
import { Toast } from './components/common/Toast.tsx';
import { NewPlayerWelcomeModal } from './components/auth/NewPlayerWelcomeModal.tsx';
import { ConcurrentSessionModal } from './components/auth/ConcurrentSessionModal.tsx';
import { AccountSuspendedModal } from './components/common/AccountSuspendedModal.tsx';

// Pages
import { LandingPage } from './pages/LandingPage.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { SignupPage } from './pages/SignupPage.tsx';
import { GamesPage } from './pages/GamesPage.tsx';
import { WalletPage } from './pages/WalletPage.tsx';
import { DepositPage } from './pages/DepositPage.tsx';
import { WithdrawPage } from './pages/WithdrawPage.tsx';
import { HistoryPage } from './pages/HistoryPage.tsx';
import { ProfilePage } from './pages/ProfilePage.tsx';
import { BingoPage } from './pages/BingoPage.tsx';
import { AffiliatePage } from './pages/AffiliatePage.tsx';
import { telegramService } from './services/telegramService.ts';
import { AccountInfoPage } from './pages/AccountInfoPage.tsx';
import { HelpCenterPage } from './pages/HelpCenterPage.tsx';
import { AboutSonicPage } from './pages/AboutSonicPage.tsx';
import { AdminPage } from './pages/AdminPage.tsx';
import { AgentPortalPage } from './pages/AgentPortalPage.tsx';
import { WithdrawalsAdminPage } from './pages/WithdrawalsAdminPage.tsx';
import { AppSplashScreen } from './components/common/AppSplashScreen.tsx';

export const App: React.FC = () => {
  const { currentPage, switchPage } = useApp();
  const { user, isAuthenticated, isLoading, isFirstTimeTelegramUser, dismissFirstTimeModal, concurrentSessionNotice } = useAuth();
  const { addUser, registerBonus } = useAdmin();
  const { addBonus } = useWallet();

  // Seamless routing: If user is authenticated in Telegram, jump straight into games!
  useEffect(() => {
    if (isAuthenticated && (currentPage === 'landing' || currentPage === 'login' || currentPage === 'signup')) {
      const isAgentHash = typeof window !== 'undefined' && (
        (window.location.hash || '').toLowerCase().includes('agent') ||
        (window.location.pathname || '').toLowerCase().includes('agent') ||
        localStorage.getItem('sonic_active_portal') === 'agent'
      );
      if (isAgentHash) {
        switchPage('agent');
        return;
      }
      switchPage('games');
    }
  }, [isAuthenticated, currentPage, switchPage]);

  // Evict to landing page immediately if concurrent session alert is triggered or unauthenticated on protected page
  useEffect(() => {
    if (concurrentSessionNotice && currentPage !== 'landing' && currentPage !== 'login') {
      switchPage('landing');
    } else if (!isAuthenticated && (currentPage === 'bingo' || currentPage === 'wallet' || currentPage === 'deposit' || currentPage === 'withdraw')) {
      switchPage('landing');
    }
  }, [concurrentSessionNotice, isAuthenticated, currentPage, switchPage]);

  // Handle first-time Telegram registration notification
  useEffect(() => {
    if (isFirstTimeTelegramUser && user) {
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
    }
  }, [isFirstTimeTelegramUser, user, addUser, registerBonus]);

  // If on Admin portal route, render full-screen bypassing 480px app-container
  if (currentPage === 'admin') {
    return (
      <div className="admin-fullscreen-root">
        <AdminPage />
        <Toast />
      </div>
    );
  }

  // If on Dedicated Player Withdrawals Admin portal route, render full-screen
  if (currentPage === 'withdrawals') {
    return (
      <div className="admin-fullscreen-root">
        <WithdrawalsAdminPage />
        <Toast />
      </div>
    );
  }

  // If on Agent portal route, render full-screen bypassing 480px app-container
  if (currentPage === 'agent') {
    return (
      <div className="agent-fullscreen-root" style={{ backgroundColor: '#f4f6f8', minHeight: '100vh', width: '100%', color: '#0f172a' }}>
        <AgentPortalPage />
        <Toast />
      </div>
    );
  }

  // Phase 2: Show sleek splash screen while initial auth resolves (prevents flash of onboarding)
  if (isLoading && !user) {
    return <AppSplashScreen />;
  }

  const isStandalonePage =
    currentPage === 'landing' ||
    currentPage === 'login' ||
    currentPage === 'signup';

  const isSubpage =
    currentPage === 'account-info' ||
    currentPage === 'help' ||
    currentPage === 'about' ||
    currentPage === 'deposit' ||
    currentPage === 'withdraw';

  const isDedicatedGamePage = currentPage === 'bingo';
  const isDesktop = telegramService.isDesktopPlatform();

  return (
    <div className={`app-container${isDedicatedGamePage ? ' dedicated-game-view' : ''}${isDesktop ? ' is-desktop-platform' : ''}`}>
      {/* Top Header for all main game & user views */}
      {!isStandalonePage && !isSubpage && !isDedicatedGamePage && <TopHeader />}

      {/* Balance Bar for all main game & user views */}
      {!isStandalonePage && !isSubpage && !isDedicatedGamePage && <BalanceBar />}

      {/* Active Page View */}
      {currentPage === 'landing' && <LandingPage />}
      {currentPage === 'login' && <LoginPage />}
      {currentPage === 'signup' && <SignupPage />}
      {currentPage === 'games' && <GamesPage />}
      {currentPage === 'wallet' && <WalletPage />}
      {currentPage === 'deposit' && <DepositPage />}
      {currentPage === 'withdraw' && <WithdrawPage />}
      {currentPage === 'history' && <HistoryPage />}
      {currentPage === 'profile' && <ProfilePage />}
      {currentPage === 'bingo' && <BingoPage />}
      {currentPage === 'affiliate' && <AffiliatePage />}
      {currentPage === 'account-info' && <AccountInfoPage />}
      {currentPage === 'help' && <HelpCenterPage />}
      {currentPage === 'about' && <AboutSonicPage />}

      {/* Bottom Navigation */}
      {!isStandalonePage && !isDedicatedGamePage && <BottomNav />}

      {/* Phase 1: First-time registration celebration modal */}
      <NewPlayerWelcomeModal
        isOpen={isFirstTimeTelegramUser}
        user={user}
        bonusAmount={registerBonus}
        onClose={dismissFirstTimeModal}
      />

      {/* Single-device enforcement notice */}
      <ConcurrentSessionModal />

      {/* Real-time Account Suspension Notice */}
      <AccountSuspendedModal />

      {/* Global Toast */}
      <Toast />
    </div>
  );
};
