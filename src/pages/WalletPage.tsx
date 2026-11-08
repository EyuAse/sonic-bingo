import React, { useState } from 'react';
import { BalanceCard } from '../components/wallet/BalanceCard.tsx';
import { TransactionHistory } from '../components/wallet/TransactionHistory.tsx';
import { WalletMenu } from '../components/wallet/WalletMenu.tsx';
import { BetHistoryView } from '../components/wallet/BetHistoryView.tsx';

export const WalletPage: React.FC = () => {
  const [activeHistoryTab, setActiveHistoryTab] = useState<'deposits' | 'withdrawals' | 'bets' | null>(null);

  return (
    <div className="page active" id="page-wallet" style={{ paddingBottom: '100px' }}>
      {activeHistoryTab === 'bets' ? (
        /* Dedicated Game & Bet History View */
        <BetHistoryView onBack={() => setActiveHistoryTab(null)} />
      ) : activeHistoryTab !== null ? (
        /* Dedicated Transaction History View (Opened on Click) */
        <TransactionHistory
          initialTab={activeHistoryTab}
          onBack={() => setActiveHistoryTab(null)}
        />
      ) : (
        /* Clean Main Wallet Overview */
        <>
          <BalanceCard />
          <WalletMenu onOpenHistory={tab => setActiveHistoryTab(tab)} />
        </>
      )}
    </div>
  );
};
