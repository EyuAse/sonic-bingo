import React, { createContext, useContext, useState, ReactNode } from 'react';

export type PageId =
  | 'landing'
  | 'login'
  | 'signup'
  | 'games'
  | 'wallet'
  | 'deposit'
  | 'withdraw'
  | 'history'
  | 'profile'
  | 'bingo'
  | 'affiliate'
  | 'account-info'
  | 'help'
  | 'about'
  | 'admin'
  | 'agent'
  | 'withdrawals';

interface AppContextType {
  currentPage: PageId;
  switchPage: (page: PageId) => void;
  toastMessage: string | null;
  showToast: (msg: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentPage, setCurrentPage] = useState<PageId>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      const path = window.location.pathname;
      const savedPortal = localStorage.getItem('sonic_active_portal');

      if (hash.includes('lomibingo-Admin-vBingo') || path.includes('lomibingo-Admin-vBingo') || hash.includes('admin')) {
        return 'admin';
      }
      if (
        hash.includes('withdrawals') ||
        path.includes('withdrawals') ||
        savedPortal === 'withdrawals'
      ) {
        return 'withdrawals';
      }
      if (
        hash.includes('agent') ||
        path.includes('agent') ||
        savedPortal === 'agent'
      ) {
        return 'agent';
      }
    }
    return 'landing';
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastTimeout, setToastTimeout] = useState<number | null>(null);

  // URL Hash routing listener for private route
  React.useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      const path = window.location.pathname;
      const savedPortal = localStorage.getItem('sonic_active_portal');

      if (hash.includes('lomibingo-Admin-vBingo') || path.includes('lomibingo-Admin-vBingo') || hash.includes('admin')) {
        setCurrentPage('admin');
      } else if (
        hash.includes('withdrawals') ||
        path.includes('withdrawals') ||
        savedPortal === 'withdrawals'
      ) {
        setCurrentPage('withdrawals');
      } else if (
        hash.includes('agent') ||
        path.includes('agent') ||
        savedPortal === 'agent'
      ) {
        setCurrentPage('agent');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const switchPage = (page: PageId) => {
    setCurrentPage(page);
    if (page === 'admin') {
      window.location.hash = '/lomibingo-Admin-vBingo';
      localStorage.setItem('sonic_active_portal', 'admin');
    } else if (page === 'withdrawals') {
      window.location.hash = '/withdrawals';
      localStorage.setItem('sonic_active_portal', 'withdrawals');
    } else if (page === 'agent') {
      const savedTab = localStorage.getItem('sonic_agent_tab') || 'overview';
      window.location.hash = `/agent-portal?tab=${savedTab}`;
      localStorage.setItem('sonic_active_portal', 'agent');
    } else {
      localStorage.removeItem('sonic_active_portal');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const showToast = (msg: string) => {
    if (toastTimeout) {
      clearTimeout(toastTimeout);
    }
    setToastMessage(msg);
    const timeout = window.setTimeout(() => {
      setToastMessage(null);
    }, 2500);
    setToastTimeout(timeout);
  };

  return (
    <AppContext.Provider value={{ currentPage, switchPage, toastMessage, showToast }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
