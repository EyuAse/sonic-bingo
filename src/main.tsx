import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.tsx';
import { AppProvider } from './context/AppContext.tsx';
import { LanguageProvider } from './context/LanguageContext.tsx';
import { WalletProvider } from './context/WalletContext.tsx';
import { BingoProvider } from './context/BingoContext.tsx';
import { AdminProvider } from './context/AdminContext.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import { ErrorBoundary } from './components/common/ErrorBoundary.tsx';
import './services/versionService.ts';

// FontAwesome Local Bundle
import '@fortawesome/fontawesome-free/css/all.min.css';

// Stylesheets
import './styles/index.css';
import './styles/header.css';
import './styles/games.css';
import './styles/wallet.css';
import './styles/navigation.css';
import './styles/bingo.css';
import './styles/landing.css';
import './styles/admin.css';
import './styles/admin-jackpot.css';
import './styles/admin-cartelas.css';
import './styles/admin-bot-engine.css';
import './styles/admin-official-accounts.css';
import './styles/agent-dashboard-enqu.css';
import './styles/recharge-requests-enqu.css';
import './styles/deposit-requests-enqu.css';
import './styles/players-enqu.css';
import './styles/auth.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary componentName="ApplicationRoot">
      <LanguageProvider>
        <AdminProvider>
          <AuthProvider>
            <AppProvider>
              <WalletProvider>
                <BingoProvider>
                  <App />
                </BingoProvider>
              </WalletProvider>
            </AppProvider>
          </AuthProvider>
        </AdminProvider>
      </LanguageProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
