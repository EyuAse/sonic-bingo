import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { apiClient } from '../services/apiClient';
import { socketService } from '../services/socketService';
import { useAuth } from './AuthContext.tsx';

interface WalletContextType {
  balance: number;
  bonus: number;
  coins: number;
  isBalanceVisible: boolean;
  toggleBalanceVisibility: () => void;
  addBalance: (amount: number) => void;
  deductBalance: (amount: number) => boolean;
  addBonus: (amount: number) => void;
  deductBonus: (amount: number) => boolean;
  redeemCoins: () => Promise<{ success: boolean; message: string; coins?: number; bonusAdded?: number }>;
  refreshBalance: () => Promise<void>;
  isRefreshing: boolean;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  // Purge any legacy mock storage on initial run
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('betika_user_balance');
      localStorage.removeItem('betika_user_bonus');
    }
  }, []);

  const [balance, setBalance] = useState<number>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('sonic_live_balance') : null;
    return saved ? parseFloat(saved) : 0.0;
  });

  const [bonus, setBonus] = useState<number>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('sonic_live_bonus') : null;
    return saved ? parseFloat(saved) : 0.0;
  });

  const [coins, setCoins] = useState<number>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('sonic_live_coins') : null;
    return saved ? parseInt(saved, 10) : 0;
  });

  const [isBalanceVisible, setIsBalanceVisible] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Sync strictly to live cache
  useEffect(() => {
    localStorage.setItem('sonic_live_balance', balance.toFixed(2));
  }, [balance]);

  useEffect(() => {
    localStorage.setItem('sonic_live_bonus', bonus.toFixed(2));
  }, [bonus]);

  useEffect(() => {
    localStorage.setItem('sonic_live_coins', String(coins));
  }, [coins]);

  // Fetch Live Real Balance directly from Neon PostgreSQL
  const fetchLiveBalance = useCallback(async () => {
    try {
      const data = await apiClient.wallet.getBalance();
      if (data && typeof data.balance === 'number') {
        setBalance(data.balance);
        setBonus(data.bonus);
        if (typeof (data as any).coins === 'number') {
          setCoins((data as any).coins);
        }
      }
    } catch {
      // Offline fallback
    }
  }, []);

  useEffect(() => {
    fetchLiveBalance();
  }, [fetchLiveBalance]);

  // Real-time WebSocket Balance Updates & Admin Cashier Approvals
  useEffect(() => {
    const handleDepositApproved = (e: any) => {
      if (e.detail && typeof e.detail.amount === 'number') {
        setBalance(prev => prev + e.detail.amount);
      }
    };

    const handleWalletUpdated = (e: any) => {
      if (e.detail) {
        if (typeof e.detail.balance === 'number') setBalance(e.detail.balance);
        if (typeof e.detail.bonus === 'number') setBonus(e.detail.bonus);
      }
    };

    const handleStorage = () => {
      const saved = localStorage.getItem('sonic_live_balance');
      const savedBonus = localStorage.getItem('sonic_live_bonus');
      if (saved) setBalance(parseFloat(saved));
      if (savedBonus) setBonus(parseFloat(savedBonus));
    };

    window.addEventListener('lb_deposit_approved' as any, handleDepositApproved);
    window.addEventListener('lb_wallet_updated' as any, handleWalletUpdated);
    window.addEventListener('storage', handleStorage);

    const socket = socketService.connect();
    const handleBalanceEvent = (data: any) => {
      // If event is scoped to a specific userId, verify match against active user or stored session
      const currentId = user?.id || (() => {
        try {
          const s = localStorage.getItem('sonic_user');
          return s ? JSON.parse(s)?.id : null;
        } catch { return null; }
      })();

      if (data && currentId) {
        const matchesId = data.userId && String(data.userId).toLowerCase() === String(currentId).toLowerCase();
        const matchesTg = data.telegramId && user?.telegramId && String(data.telegramId) === String(user.telegramId);
        if (data.userId && !matchesId && !matchesTg) {
          return;
        }
      }
      console.log('⚡ [Live Real Balance Event Received]:', data);
      
      const rawNewBal = data?.newBalance ?? data?.balance;
      const parsedNewBal = rawNewBal !== undefined && rawNewBal !== null ? parseFloat(rawNewBal) : null;
      const parsedAmount = data?.amount !== undefined && data?.amount !== null ? parseFloat(data.amount) : null;
      const parsedBonus = data?.bonus !== undefined && data?.bonus !== null ? parseFloat(data.bonus) : null;

      if (parsedNewBal !== null && !isNaN(parsedNewBal)) {
        setBalance(parsedNewBal);
        localStorage.setItem('sonic_live_balance', parsedNewBal.toFixed(2));
        window.dispatchEvent(new CustomEvent('lb_wallet_updated', { detail: { balance: parsedNewBal } }));
      } else if (parsedAmount !== null && !isNaN(parsedAmount)) {
        setBalance(prev => {
          const next = prev + parsedAmount;
          localStorage.setItem('sonic_live_balance', next.toFixed(2));
          window.dispatchEvent(new CustomEvent('lb_wallet_updated', { detail: { balance: next } }));
          return next;
        });
      }

      if (parsedBonus !== null && !isNaN(parsedBonus)) {
        setBonus(parsedBonus);
        localStorage.setItem('sonic_live_bonus', parsedBonus.toFixed(2));
      }

      // Always follow up with authoritative DB fetch
      fetchLiveBalance();
    };

    // Use persistent socketService.on listeners (preserves callbacks across reconnects)
    const unsubGlobalBalance = socketService.on('user_balance_updated', handleBalanceEvent);
    const unsubDepStatus = socketService.on('deposit_status_updated', () => fetchLiveBalance());
    const unsubWithStatus = socketService.on('withdrawal_status_updated', () => fetchLiveBalance());

    let unsubUserBalance: (() => void) | null = null;
    let unsubUserTgBalance: (() => void) | null = null;
    let unsubUserDepositApproved: (() => void) | null = null;
    let unsubUserWithdrawalApproved: (() => void) | null = null;
    let unsubUserWithdrawalRejected: (() => void) | null = null;

    if (user?.id) {
      socketService.setAuthenticatedUser(user.id, user.fullName);
      unsubUserBalance = socketService.on(`user_${user.id}_balance`, handleBalanceEvent);
      if (user.telegramId) {
        unsubUserTgBalance = socketService.on(`user_${user.telegramId}_balance`, handleBalanceEvent);
      }
      unsubUserDepositApproved = socketService.on(`user_${user.id}_deposit_approved`, (data: any) => {
        console.log('⚡ [WalletContext] User Deposit Approved Push:', data);
        if (typeof data?.newBalance === 'number') {
          setBalance(data.newBalance);
          localStorage.setItem('sonic_live_balance', data.newBalance.toFixed(2));
        } else if (typeof data?.amount === 'number') {
          setBalance(prev => prev + data.amount);
        }
        fetchLiveBalance();
      });
      unsubUserWithdrawalApproved = socketService.on(`user_${user.id}_withdrawal_approved`, (data: any) => {
        console.log('⚡ [WalletContext] User Withdrawal Approved Push:', data);
        fetchLiveBalance();
      });
      unsubUserWithdrawalRejected = socketService.on(`user_${user.id}_withdrawal_rejected`, (data: any) => {
        console.log('⚡ [WalletContext] User Withdrawal Rejected Push:', data);
        if (typeof data?.newBalance === 'number') {
          setBalance(data.newBalance);
          localStorage.setItem('sonic_live_balance', data.newBalance.toFixed(2));
        } else if (typeof data?.amount === 'number') {
          setBalance(prev => prev + data.amount);
        }
        fetchLiveBalance();
      });
    }

    // Real-Time Active Balance Sync Architecture
    // 8-second background poll guarantees 100% authoritative balance sync across all tabs/devices
    const pollInterval = setInterval(() => {
      fetchLiveBalance();
    }, 8000);

    // Instant refresh when user returns to foreground/app
    const unsubResume = socketService.onForegroundResume(() => {
      fetchLiveBalance();
    });

    return () => {
      clearInterval(pollInterval);
      unsubResume();
      window.removeEventListener('lb_deposit_approved' as any, handleDepositApproved);
      window.removeEventListener('lb_wallet_updated' as any, handleWalletUpdated);
      window.removeEventListener('storage', handleStorage);
      unsubGlobalBalance();
      unsubDepStatus();
      unsubWithStatus();
      if (unsubUserBalance) unsubUserBalance();
      if (unsubUserTgBalance) unsubUserTgBalance();
      if (unsubUserDepositApproved) unsubUserDepositApproved();
      if (unsubUserWithdrawalApproved) unsubUserWithdrawalApproved();
      if (unsubUserWithdrawalRejected) unsubUserWithdrawalRejected();
    };
  }, [user, fetchLiveBalance]);

  const toggleBalanceVisibility = () => {
    setIsBalanceVisible(prev => !prev);
  };

  const addBalance = (amount: number) => {
    setBalance(prev => prev + amount);
  };

  const deductBalance = (amount: number): boolean => {
    if (balance >= amount) {
      setBalance(prev => prev - amount);
      return true;
    }
    return false;
  };

  const addBonus = (amount: number) => {
    setBonus(prev => prev + amount);
  };

  const deductBonus = (amount: number): boolean => {
    if (bonus >= amount) {
      setBonus(prev => prev - amount);
      return true;
    }
    return false;
  };

  const refreshBalance = async () => {
    setIsRefreshing(true);
    await fetchLiveBalance();
    setTimeout(() => {
      setIsRefreshing(false);
    }, 400);
  };

  const redeemCoins = async (): Promise<{ success: boolean; message: string; coins?: number; bonusAdded?: number }> => {
    try {
      const token = localStorage.getItem('sonic_auth_token') || localStorage.getItem('auth_token');
      const res = await fetch('/api/wallet/redeem-coins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      const data = await res.json();
      if (data && data.success) {
        if (typeof data.coins === 'number') setCoins(data.coins);
        if (typeof data.bonus === 'number') setBonus(data.bonus);
        else if (typeof data.bonusAdded === 'number') setBonus(prev => prev + data.bonusAdded);
        return {
          success: true,
          message: data.message || 'Successfully redeemed 1,000 coins for 20 ETB bonus!',
          coins: data.coins,
          bonusAdded: data.bonusAdded
        };
      }
      return { success: false, message: data?.error || 'Failed to redeem coins' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error while redeeming coins' };
    }
  };

  return (
    <WalletContext.Provider
      value={{
        balance,
        bonus,
        coins,
        isBalanceVisible,
        toggleBalanceVisibility,
        addBalance,
        deductBalance,
        addBonus,
        deductBonus,
        redeemCoins,
        refreshBalance,
        isRefreshing
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = (): WalletContextType => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};
