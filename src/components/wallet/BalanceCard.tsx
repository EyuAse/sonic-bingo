import React, { useState } from 'react';
import { useWallet } from '../../context/WalletContext.tsx';
import { useApp } from '../../context/AppContext.tsx';
import { useLanguage } from '../../context/LanguageContext.tsx';

export const BalanceCard: React.FC = () => {
  const { balance, bonus, coins, redeemCoins } = useWallet();
  const { switchPage, showToast } = useApp();
  const { t, lang } = useLanguage();
  const [isRedeeming, setIsRedeeming] = useState<boolean>(false);

  const totalPlayable = balance + bonus;

  const handleRedeem = async () => {
    if (coins < 1000) {
      showToast(lang === 'am' ? '⚠️ ኮይኖችን ለመቀየር ቢያንስ 1,000 ኮይኖች ያስፈልጋሉ።' : '⚠️ At least 1,000 coins are required to redeem.');
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
    <>
      {/* 2-Column Balance Overview Card */}
      <div className="fresh-balance-overview-card">
        {/* Column 1: Real Cash Balance */}
        <div className="balance-overview-col">
          <div className="overview-icon-circ yellow">
            <i className="fa-solid fa-wallet"></i>
          </div>
          <div className="overview-col-text">
            <span className="overview-col-lbl">{t('wallet.totalBalance')}</span>
            <strong className="overview-col-val">{balance.toFixed(2)} ETB</strong>
          </div>
        </div>

        {bonus > 0 && (
          <>
            <div className="overview-col-divider"></div>

            {/* Column 2: Welcome Bonus Balance */}
            <div className="balance-overview-col">
              <div className="overview-icon-circ green">
                <i className="fa-solid fa-gift"></i>
              </div>
              <div className="overview-col-text">
                <span className="overview-col-lbl">{t('wallet.bonusBalance')}</span>
                <strong className="overview-col-val" style={{ color: '#22c55e' }}>{bonus.toFixed(2)} ETB</strong>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Playable Summary Bar if Bonus is active */}
      {bonus > 0 && (
        <div
          style={{
            margin: '-6px 16px 12px',
            padding: '8px 14px',
            background: 'rgba(34, 197, 94, 0.08)',
            border: '1px solid rgba(34, 197, 94, 0.2)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px'
          }}
        >
          <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <i className="fa-solid fa-circle-check" style={{ color: '#22c55e' }}></i>
            {lang === 'am' ? 'ለመጫወት ዝግጁ የሆነ ጠቅላላ ቀሪ ሂሳብ' : 'Total Playable Balance'}
          </span>
          <strong style={{ color: '#ffffff', fontWeight: 800 }}>{totalPlayable.toFixed(2)} ETB</strong>
        </div>
      )}

      {/* Sonic Coin Loyalty & Rewards Banner (1.5x on deposits, 1,000 Coins = 10 ETB) */}
      <div
        style={{
          margin: '0 16px 12px',
          padding: '10px 14px',
          background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.12), rgba(245, 158, 11, 0.06))',
          border: '1px solid rgba(234, 179, 8, 0.3)',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '34px',
            height: '34px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #facc15, #eab308)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            boxShadow: '0 2px 6px rgba(234, 179, 8, 0.4)'
          }}>
            🪙
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <strong style={{ color: '#ffffff', fontSize: '13px' }}>{coins.toLocaleString()} Coins</strong>
              <span style={{
                background: '#ca8a04',
                color: '#ffffff',
                fontSize: '9px',
                fontWeight: 800,
                padding: '1px 5px',
                borderRadius: '6px'
              }}>1.5x</span>
            </div>
            <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>
              {lang === 'am' ? '1,000 ኮይኖች = 10 ብር ቦነስ' : '1,000 Coins = 10 ETB Bonus'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRedeem}
          disabled={coins < 1000 || isRedeeming}
          style={{
            padding: '6px 12px',
            borderRadius: '8px',
            background: coins >= 1000 ? '#eab308' : 'rgba(255, 255, 255, 0.1)',
            color: coins >= 1000 ? '#000000' : '#64748b',
            border: 'none',
            fontSize: '11px',
            fontWeight: 800,
            cursor: coins >= 1000 && !isRedeeming ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap'
          }}
          title={coins >= 1000 ? 'Exchange 1,000 coins for 10 ETB bonus' : 'Requires at least 1,000 coins'}
        >
          {isRedeeming ? '...' : (lang === 'am' ? 'ለውጥ' : 'Redeem')}
        </button>
      </div>

      {/* 2 Quick Action Buttons: Withdraw & Deposit Now -> Dedicated Pages */}
      <div className="fresh-wallet-action-row">
        <button
          type="button"
          className="btn-wallet-action-white"
          id="withdraw-btn"
          onClick={() => switchPage('withdraw')}
        >
          <i className="fa-solid fa-arrow-up-from-bracket"></i>
          <span>{t('wallet.withdrawBtn')}</span>
        </button>

        <button
          type="button"
          className="btn-wallet-action-gold"
          id="deposit-btn"
          onClick={() => switchPage('deposit')}
        >
          <i className="fa-solid fa-arrow-down"></i>
          <span>{t('wallet.depositNowBtn')}</span>
        </button>
      </div>
    </>
  );
};
