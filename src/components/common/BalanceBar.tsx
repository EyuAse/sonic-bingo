import React from 'react';
import { useWallet } from '../../context/WalletContext.tsx';
import { useApp } from '../../context/AppContext.tsx';
import { useLanguage } from '../../context/LanguageContext.tsx';

export const BalanceBar: React.FC = () => {
  const { balance, bonus, isBalanceVisible, toggleBalanceVisibility } = useWallet();
  const { switchPage } = useApp();
  const { t } = useLanguage();

  const totalPlayable = balance + bonus;

  return (
    <div className="lobby-balance-bar-wrapper">
      <div className="lobby-fresh-balance-bar">
        {/* Left: Obsidian Squircle with Rich Metallic Golden Wallet Icon */}
        <div className="balance-wallet-obsidian-squircle" aria-hidden="true">
          <i className="fa-solid fa-wallet"></i>
        </div>

        {/* Center: Total Playable Amount, Eye Toggle & Bonus Badge */}
        <div className="balance-amount-center">
          <div className="balance-val-group">
            <span className="balance-val-text">
              {isBalanceVisible ? `${totalPlayable.toFixed(2)} ETB` : '•••••• ETB'}
            </span>
            {isBalanceVisible && bonus > 0 && (
              <span
                className="balance-bonus-badge"
                title={`Playable: ${totalPlayable.toFixed(2)} ETB (Cash: ${balance.toFixed(2)} ETB + Bonus: ${bonus.toFixed(2)} ETB)`}
              >
                <i className="fa-solid fa-gift"></i>
                {bonus.toFixed(0)} BONUS
              </span>
            )}
          </div>
          <button
            type="button"
            className="btn-balance-eye-toggle"
            onClick={toggleBalanceVisibility}
            title={isBalanceVisible ? 'Hide Balance' : 'Show Balance'}
            aria-label={isBalanceVisible ? 'Hide Balance' : 'Show Balance'}
          >
            <i className={`fa-regular ${isBalanceVisible ? 'fa-eye-slash' : 'fa-eye'}`}></i>
          </button>
        </div>

        {/* Right: Pitch-Black Obsidian Pill Button -> Navigates to Deposit */}
        <button
          type="button"
          className="btn-obsidian-deposit"
          id="header-deposit"
          onClick={() => switchPage('deposit')}
          aria-label="Deposit Funds"
        >
          <i className="fa-solid fa-circle-plus"></i>
          <span>{t('common.deposit') || 'Deposit'}</span>
        </button>
      </div>
    </div>
  );
};
