import React, { useState } from 'react';
import { useWallet } from '../../context/WalletContext.tsx';
import { useApp } from '../../context/AppContext.tsx';
import { useLanguage } from '../../context/LanguageContext.tsx';

export const BalanceCard: React.FC = () => {
  const { balance, coins, redeemCoins } = useWallet();
  const { switchPage, showToast } = useApp();
  const { t, lang } = useLanguage();
  const [isRedeeming, setIsRedeeming] = useState<boolean>(false);

  const handleRedeem = async () => {
    if (coins < 1000) {
      showToast(
        lang === 'am'
          ? '⚠️ ኮይኖችን ለመቀየር ቢያንስ 1,000 ኮይኖች ያስፈልጋሉ።'
          : '⚠️ At least 1,000 coins are required to redeem.'
      );
      return;
    }
    setIsRedeeming(true);
    try {
      const res = await redeemCoins();
      if (res.success) {
        showToast(`🎉 ${res.message}`);
      } else {
        showToast(`❌ ${res.message}`);
      }
    } finally {
      setIsRedeeming(false);
    }
  };

  return (
    <div className="wallet-overview-cards-stack">
      {/* 1. Single-Focus "Total Balance" White Rounded Card */}
      <div className="fresh-total-balance-card">
        <div className="total-balance-obsidian-squircle" aria-hidden="true">
          <i className="fa-solid fa-wallet"></i>
        </div>
        <div className="total-balance-meta-group">
          <span className="total-balance-label">
            {lang === 'am' ? 'ጠቅላላ ቀሪ ሂሳብ' : 'Total Balance'}
          </span>
          <strong className="total-balance-value">
            {balance.toFixed(2)} ETB
          </strong>
        </div>
      </div>

      {/* 2. Sonic Coins Loyalty & Rewards Banner (1.5x on deposits, 1,000 Coins = 10 ETB) */}
      <div className="fresh-coins-loyalty-banner">
        <div className="coins-banner-left-group">
          {/* Stacked 3D Gold Coins Graphic */}
          <div className="stacked-gold-coins-icon" aria-hidden="true">
            <span className="stacked-coin c1">🪙</span>
            <span className="stacked-coin c2">🪙</span>
          </div>

          <div className="coins-banner-text">
            <div className="coins-amount-row">
              <strong className="coins-count-bold">
                {coins.toLocaleString()} {lang === 'am' ? 'ኮይኖች' : 'Coins'}
              </strong>
              <span className="coins-multiplier-pill">1.5x</span>
            </div>
            <p className="coins-rate-sub">
              {lang === 'am' ? '1,000 ኮይኖች = 20 ብር ቦነስ' : '1,000 Coins = 20 ETB Bonus'}
            </p>
          </div>
        </div>

        <div className="coins-banner-divider" aria-hidden="true"></div>

        {/* Redeem Action */}
        <button
          type="button"
          className="btn-coins-redeem-action"
          onClick={handleRedeem}
          disabled={isRedeeming}
          title={coins >= 1000 ? 'Exchange 1,000 coins for 20 ETB bonus' : 'Requires at least 1,000 coins'}
        >
          <span>{isRedeeming ? '...' : (lang === 'am' ? 'ቀይር' : 'Redeem')}</span>
          <i className="fa-solid fa-chevron-right"></i>
        </button>
      </div>

      {/* 3. Quick Action Row: Withdraw (White) & Deposit Now (Pitch-Black Obsidian + Gold Border) */}
      <div className="fresh-wallet-action-row">
        <button
          type="button"
          className="btn-wallet-action-white"
          id="withdraw-btn"
          onClick={() => switchPage('withdraw')}
          aria-label="Withdraw Funds"
        >
          <i className="fa-solid fa-arrow-up-from-bracket"></i>
          <span>{t('wallet.withdrawBtn') || 'Withdraw'}</span>
        </button>

        <button
          type="button"
          className="btn-wallet-action-obsidian-gold"
          id="deposit-btn"
          onClick={() => switchPage('deposit')}
          aria-label="Deposit Funds Now"
        >
          <i className="fa-solid fa-arrow-down"></i>
          <span>{t('wallet.depositNowBtn') || 'Deposit Now'}</span>
        </button>
      </div>
    </div>
  );
};
