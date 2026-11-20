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
      const rawHash = (window.location.hash || '').toLowerCase();
      const path = (window.location.pathname || '').toLowerCase();
      const search = (window.location.search || '').toLowerCase();
      const savedPortal = localStorage.getItem('sonic_active_portal');

      // Detect if running inside Telegram Mini App
      const isTelegram =
        search.includes('tg_id') ||
        search.includes('tgwebappdata') ||
        rawHash.includes('tgwebappdata') ||
        !!(window as any)?.Telegram?.WebApp?.initData;

      // Extract explicit routing hash (disregard Telegram authentication hash)
      const isTgDataHash = rawHash.startsWith('#tgwebappdata');
      const routeHash = isTgDataHash ? '' : rawHash;

      // 1. Strict route-prefix matching (NEVER use loose .includes() which catches Telegram user names!)
      const isAgentRoute =
        routeHash.startsWith('#/agent') ||
        path.startsWith('/agent');

      const isWithdrawalsRoute =
        routeHash.startsWith('#/withdrawals') ||
        path.startsWith('/withdrawals');

      const isAdminRoute =
        routeHash.startsWith('#/sonic-admin') ||
        routeHash === '#/admin' ||
        routeHash.startsWith('#/lomibingo-admin-vbingo') ||
        path === '/sonic-admin' ||
        path === '/admin';

      // 2. Standalone PWA launch guard
      // If launched from installed PWA home screen icon, lock directly to 'agent'
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://');

      if (isAgentRoute) {
        return 'agent';
      }
      if (isWithdrawalsRoute) {
        return 'withdrawals';
      }
      if (isAdminRoute && !isTelegram) {
        return 'admin';
      }

      if (isStandalone && (savedPortal === 'agent' || !routeHash || routeHash === '#' || routeHash === '#/')) {
        return 'agent';
      }

      // 3. Telegram users ALWAYS start at player arena (landing / games)
      if (isTelegram) {
        localStorage.removeItem('sonic_active_portal');
        return 'landing';
      }

      // 4. Saved portal fallback ONLY when URL has no explicit routing hash (Admin is NEVER a bare fallback!)
      if (!routeHash || routeHash === '#' || routeHash === '#/') {
        if (savedPortal === 'agent') return 'agent';
        if (savedPortal === 'withdrawals') return 'withdrawals';
      }
    }
    return 'landing';
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastTimeout, setToastTimeout] = useState<number | null>(null);

  // URL Hash routing listener for private routes
  React.useEffect(() => {
    const handleHashChange = () => {
      const rawHash = (window.location.hash || '').toLowerCase();
      const path = (window.location.pathname || '').toLowerCase();

      // Disregard Telegram WebApp authentication hash
      if (rawHash.startsWith('#tgwebappdata')) return;

      // 1. Explicit Hash/Path routing ALWAYS has highest priority!
      if (rawHash.startsWith('#/agent') || path.startsWith('/agent')) {
        setCurrentPage('agent');
        localStorage.setItem('sonic_active_portal', 'agent');
      } else if (rawHash.startsWith('#/withdrawals') || path.startsWith('/withdrawals')) {
        setCurrentPage('withdrawals');
        localStorage.setItem('sonic_active_portal', 'withdrawals');
      } else if (
        rawHash.startsWith('#/sonic-admin') ||
        rawHash === '#/admin' ||
        rawHash.startsWith('#/lomibingo-admin-vbingo') ||
        path === '/sonic-admin' ||
        path === '/admin'
      ) {
        setCurrentPage('admin');
        localStorage.setItem('sonic_active_portal', 'admin');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const switchPage = (page: PageId) => {
    setCurrentPage(page);
    if (page === 'admin') {
      window.location.hash = '/sonic-admin';
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
