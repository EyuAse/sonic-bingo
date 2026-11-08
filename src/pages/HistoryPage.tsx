import React from 'react';
import { useApp } from '../context/AppContext.tsx';
import { BetHistoryView } from '../components/wallet/BetHistoryView.tsx';

export const HistoryPage: React.FC = () => {
  const { switchPage } = useApp();

  return (
    <div className="page active" id="page-history" style={{ paddingBottom: '90px', minHeight: '100vh', background: '#0a0e17' }}>
      <BetHistoryView onBack={() => switchPage('games')} />
    </div>
  );
};

export default HistoryPage;
