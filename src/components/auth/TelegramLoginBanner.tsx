import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';
import { useAdmin } from '../../context/AdminContext';
import { useWallet } from '../../context/WalletContext';
import { telegramService } from '../../services/telegramService';
import { authService } from '../../services/authService';
import { NewPlayerWelcomeModal } from './NewPlayerWelcomeModal';
import { User } from '../../types/auth';

interface TelegramLoginBannerProps {
  onSuccess?: () => void;
}

export const TelegramLoginBanner: React.FC<TelegramLoginBannerProps> = ({ onSuccess }) => {
  const { loginWithTelegram, telegramUser, isInsideTelegram } = useAuth();
  const { switchPage, showToast } = useApp();
  const { lang } = useLanguage();
  const { addUser, registerBonus } = useAdmin();
  const { addBonus } = useWallet();
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isExistingAccount, setIsExistingAccount] = useState<boolean>(false);
  const [newlyCreatedUser, setNewlyCreatedUser] = useState<User | null>(null);
  const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState<boolean>(false);

  // Check if account already exists
  useEffect(() => {
    if (telegramUser?.id) {
      const existing = authService.checkTelegramUserExists(telegramUser.id, telegramUser.username);
      setIsExistingAccount(!!existing);
    } else {
      const fallbackTg = authService.checkTelegramUserExists(8839201, 'eyu_ase');
      setIsExistingAccount(!!fallbackTg);
    }
  }, [telegramUser]);

  const handleTelegramAuth = async () => {
    setIsConnecting(true);
    try {
      // Direct seamless Telegram authentication with ZERO popups/warnings
      const { user, isNewUser } = await loginWithTelegram(telegramUser || undefined);

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
        setNewlyCreatedUser(user);
        setIsWelcomeModalOpen(true);
        setIsExistingAccount(true);
      } else {
        showToast(
          lang === 'am'
            ? `እንኳን ደህና መጡ፣ ${user.fullName}!`
            : `Welcome back, ${user.fullName}!`
        );
        if (onSuccess) {
          onSuccess();
        } else {
          switchPage('games');
        }
      }
    } catch (err: any) {
      showToast(`⚠️ ${err?.message || 'Telegram connection failed.'}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const displayName = telegramUser
    ? `${telegramUser.first_name || ''} ${telegramUser.last_name || ''}`.trim() || `@${telegramUser.username}`
    : 'Telegram Player';

  return (
    <>
      <div className="tg-one-click-container">
        <button
          type="button"
          className={`btn-tg-one-click-cta ${!isExistingAccount ? 'is-new-register' : ''}`}
          onClick={handleTelegramAuth}
          disabled={isConnecting}
          title={isExistingAccount ? 'Log in with Telegram' : 'Register with Telegram & Get Bonus'}
        >
          <div className="tg-btn-left-icon">
            {isConnecting ? (
              <i className="fa-solid fa-spinner fa-spin"></i>
            ) : !isExistingAccount ? (
              <i className="fa-solid fa-gift"></i>
            ) : (
              <i className="fa-brands fa-telegram"></i>
            )}
          </div>
          <div className="tg-btn-text-wrap">
            <span className="tg-btn-main-txt">
              {isConnecting
                ? lang === 'am'
                  ? 'በመገናኘት ላይ...'
                  : 'Connecting to Telegram...'
                : !isExistingAccount
                ? lang === 'am'
                  ? '🎁 በቴሌግራም ተመዝገብ (+20 ETB)'
                  : '🎁 Register via Telegram (+20 ETB)'
                : isInsideTelegram && telegramUser
                ? lang === 'am'
                  ? `እንደ ${displayName} ግባ ⚡`
                  : `Log in as ${displayName} ⚡`
                : lang === 'am'
                ? '⚡ በቴሌግራም ፈጣን መግቢያ'
                : '⚡ Continue with Telegram'}
            </span>
            <span className="tg-btn-user-sub">
              {!isExistingAccount
                ? lang === 'am'
                  ? 'አዲስ መለያ ይፍጠሩ እና 20 ብር ነፃ ቦነስ ያግኙ'
                  : 'Instant registration • +20 ETB Free Welcome Bonus'
                : isInsideTelegram
                ? lang === 'am'
                  ? 'የተረጋገጠ መለያዎን ይቀጥሉ'
                  : 'Existing verified account • 1-Click Access'
                : lang === 'am'
                ? 'ያለ የይለፍ ቃል ወዲያውኑ ይግቡ'
                : '1-Click instant login'}
            </span>
          </div>
          <div className="tg-btn-free-badge">
            <span>{!isExistingAccount ? '+20 ETB' : 'LOGIN'}</span>
          </div>
        </button>

        <div className="tg-or-divider">
          <span className="tg-divider-line"></span>
          <span className="tg-divider-text">
            {lang === 'am' ? 'ወይም በስልክ ቁጥር' : 'OR WITH PHONE'}
          </span>
          <span className="tg-divider-line"></span>
        </div>
      </div>

      {/* First-time registration celebration popup */}
      <NewPlayerWelcomeModal
        isOpen={isWelcomeModalOpen}
        user={newlyCreatedUser}
        bonusAmount={registerBonus}
        onClose={() => {
          setIsWelcomeModalOpen(false);
          if (onSuccess) onSuccess();
        }}
      />
    </>
  );
};
