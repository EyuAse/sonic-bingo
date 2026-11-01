import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { useAdmin } from '../../context/AdminContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { apiClient } from '../../services/apiClient.ts';

interface WalletMenuProps {
  onOpenHistory?: (type: 'deposits' | 'withdrawals' | 'bets') => void;
  gamesCount?: number;
}

export const WalletMenu: React.FC<WalletMenuProps> = ({ onOpenHistory, gamesCount }) => {
  const { t, lang } = useLanguage();
  const { transactions } = useAdmin();
  const { user } = useAuth();
  const [liveGamesCount, setLiveGamesCount] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (gamesCount !== undefined) {
      setLiveGamesCount(gamesCount);
      return;
    }
    let isMounted = true;
    apiClient.wallet.getGameHistory()
      .then((res: any) => {
        if (isMounted && res && res.summary) {
          setLiveGamesCount(res.summary.totalGames);
        }
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, [gamesCount]);

  const effectiveGamesCount = gamesCount !== undefined ? gamesCount : (liveGamesCount !== null ? liveGamesCount : 1);

  return (
    <div className="fresh-wallet-menu-cards-stack">
      {/* Card 1: Deposit History */}
      <div
        className="wallet-luxury-menu-card"
        onClick={() => onOpenHistory?.('deposits')}
        role="button"
        tabIndex={0}
        aria-label="Deposit History"
      >
        <div className="menu-card-squircle-icon emerald">
          <i className="fa-solid fa-arrow-down"></i>
        </div>

        <div className="menu-card-text-group">
          <strong className="menu-card-title">
            {t('wallet.depositHistory') || 'Deposit History'}
          </strong>
          <span className="menu-card-subtitle">
            {lang === 'am'
              ? 'የቴሌብር እና ንግድ ባንክ ተቀማጭዎን ይከታተሉ'
              : 'Track your Telstair & CBE deposits'}
          </span>
        </div>

        <div className="menu-card-action-right">
          <i className="fa-solid fa-chevron-right menu-chevron"></i>
        </div>
      </div>

      {/* Card 2: Withdrawal History */}
      <div
        className="wallet-luxury-menu-card"
        onClick={() => onOpenHistory?.('withdrawals')}
        role="button"
        tabIndex={0}
        aria-label="Withdrawal History"
      >
        <div className="menu-card-squircle-icon red">
          <i className="fa-solid fa-arrow-up-from-bracket"></i>
        </div>

        <div className="menu-card-text-group">
          <strong className="menu-card-title">
            {t('wallet.withdrawalHistory') || 'Withdrawal History'}
          </strong>
          <span className="menu-card-subtitle">
            {lang === 'am'
              ? 'የገንዘብ ወጪዎችዎን እና ክፍያዎችን ይከታተሉ'
              : 'Track your payouts & cashouts'}
          </span>
        </div>

        <div className="menu-card-action-right">
          <i className="fa-solid fa-chevron-right menu-chevron"></i>
        </div>
      </div>

      {/* Card 3: Game & Bet History */}
      <div
        className="wallet-luxury-menu-card"
        onClick={() => onOpenHistory?.('bets')}
        role="button"
        tabIndex={0}
        aria-label="Game & Bet History"
      >
        <div className="menu-card-squircle-icon orange">
          <i className="fa-solid fa-gamepad"></i>
        </div>

        <div className="menu-card-text-group">
          <strong className="menu-card-title">
            {t('wallet.betHistory') || 'Game & Bet History'}
          </strong>
          <span className="menu-card-subtitle">
            {lang === 'am'
              ? 'የቢንጎ ድሎችን፣ ሽንፈቶችን እና ትርፎችን ይከታተሉ'
              : 'Track your bingo wins, losses & profits'}
          </span>
        </div>

        <div className="menu-card-action-right">
          <span className="menu-count-pill-amber">
            {effectiveGamesCount > 0 ? effectiveGamesCount : 1}
          </span>
          <i className="fa-solid fa-chevron-right menu-chevron"></i>
        </div>
      </div>
    </div>
  );
};
