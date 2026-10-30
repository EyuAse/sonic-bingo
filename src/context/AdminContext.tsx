import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { apiClient } from '../services/apiClient';
import { socketService } from '../services/socketService';

export interface UserAccount {
  id: string;
  name: string;
  phone: string;
  telegramUsername?: string;
  telegramId?: number;
  balance: number;
  bonus: number;
  referredBy?: string;
  referralCount: number;
  totalDeposited: number;
  totalWithdrawn: number;
  status: 'active' | 'suspended';
  role?: string;
  createdAt: string;
}

export interface UserStats {
  totalPlayers: number;
  activePlayers: number;
  suspendedPlayers: number;
  vipPlayers?: number;
  bonusPlayers?: number;
  totalCashFloat: number;
  totalBonusFloat: number;
}

export interface TransactionRequest {
  id: string;
  referenceNumber: string;
  userId: string;
  userName: string;
  phone: string;
  method: 'Telebirr' | 'CBE';
  type: 'deposit' | 'withdrawal';
  amount: number;
  accountNumber: string;
  status: 'pending' | 'approved' | 'rejected';
  riskScore: 'verified' | 'low' | 'review';
  userLifetimeDeposits: number;
  userLifetimeWithdrawals: number;
  receiptImage?: string;
  senderName?: string;
  createdAt: string;
  processedAt?: string;
  adminNote?: string;
}

export interface BotPlayer {
  id: string;
  name: string;
  phone: string;
  avatar: string;
  cartelasPlayed: number;
  winsCount: number;
  isBot: true;
}

export interface AdminBotEngineConfig {
  mode: 'dynamic' | 'fixed' | 'disabled';
  minBots: number;
  maxBots: number;
  fixedCount: number;
  staggeredJoin: boolean;
  livingClock: boolean;
}

export interface CartelaCard {
  id: number;
  serialNumber: string;
  grid: number[];
}

interface AdminContextType {
  // Brand & General
  brandName: string;
  setBrandName: (name: string) => void;
  isAuthenticated: boolean;
  adminToken: string;
  loginAdmin: (pin: string) => boolean;
  logoutAdmin: () => void;
  adminPin: string;
  setAdminPin: (pin: string) => void;

  // Sidebar state
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;

  // Commission & House Cut
  houseCommissionEnabled: boolean;
  setHouseCommissionEnabled: (enabled: boolean) => void;
  commissionRate: number;
  setCommissionRate: (rate: number) => void;

  // Game Rules & Staking
  stakes: number[];
  setStakes: (stakes: number[]) => void;
  verticalBoardMode: boolean;
  setVerticalBoardMode: (enabled: boolean) => void;

  // Bonuses
  registerBonus: number;
  setRegisterBonus: (amount: number) => void;
  referralBonusRate: number;
  setReferralBonusRate: (rate: number) => void;

  // Bot & Live Player Simulator
  simulatedPlayerCount: number;
  setSimulatedPlayerCount: (count: number) => void;
  botWinRate: number;
  setBotWinRate: (rate: number) => void;
  ownerWinTarget: number;
  setOwnerWinTarget: (rate: number) => void;
  botPool: BotPlayer[];

  // Room 10 Dynamic Bot Engine (0-50)
  botConfig: AdminBotEngineConfig;
  updateBotConfig: (cfg: Partial<AdminBotEngineConfig>) => Promise<boolean>;
  refreshBotConfig: () => Promise<void>;
  botTelemetry: {
    activeBotCount: number;
    roundNumber: number;
    phase: string;
    totalPot?: number;
    winnerPayout?: number;
    realPlayerCount?: number;
  } | null;

  // 400 Cartelas
  cartelaPool: CartelaCard[];

  // Users Management
  users: UserAccount[];
  totalUsersCount: number;
  userStats: UserStats | null;
  usersPage: number;
  usersLimit: number;
  usersTotalPages: number;
  isUsersLoading: boolean;
  usersSearchQuery: string;
  usersSortBy: string;
  usersSegment: string;
  fetchUsers: (params?: { page?: number; limit?: number; search?: string; sortBy?: string; segment?: string }) => Promise<void>;
  addUser: (user: Partial<UserAccount>) => void;
  adjustUserBalance: (userId: string, amount: number, isBonus?: boolean) => void;
  toggleUserStatus: (userId: string) => void;

  // Transactions Management
  transactions: TransactionRequest[];
  approveAndReleaseTransaction: (id: string, note?: string) => Promise<void>;
  rejectTransaction: (id: string, note?: string) => Promise<void>;
  addDepositRequest: (
    userId: string,
    userName: string,
    phone: string,
    amount: number,
    method: 'Telebirr' | 'CBE',
    accountNumber: string,
    receiptImage?: string,
    customRef?: string
  ) => void;
  addWithdrawRequest: (
    userId: string,
    userName: string,
    phone: string,
    amount: number,
    method: 'Telebirr' | 'CBE',
    accountNumber: string
  ) => void;

  // Real-time Stats
  totalDepositedToday: number;
  totalWithdrawnToday: number;
  totalHouseProfit: number;
  todayHouseProfit: number;
  todayGamesPlayed: number;
  todayNetCashProfit: number;
  pendingTransactionsCount: number;
  refreshAdminData: () => Promise<void>;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

// Generate Ethiopian Opponent Bots
const generateEthiopianBots = (): BotPlayer[] => {
  const firstNames = [
    'Abebe', 'Almaz', 'Bekele', 'Chaltu', 'Dawit', 'Eleni', 'Fikru', 'Genet',
    'Haile', 'Hiwot', 'Kassahun', 'Lemlem', 'Mekonnen', 'Meseret', 'Natnael', 'Rahel',
    'Samuel', 'Selam', 'Tariku', 'Tigist', 'Yonas', 'Zenebech', 'Biruk', 'Desta',
    'Ermias', 'Fasika', 'Girma', 'Hanna', 'Kidus', 'Liya', 'Meron', 'Nebiyu',
    'Robel', 'Saron', 'Tewodros', 'Tsedey', 'Yared', 'Zelalem', 'Bilen', 'Danait',
    'Ephrem', 'Frehiwot', 'Getachew', 'Helen', 'Kalkidan', 'Mahlet', 'Muluken', 'Netsanet',
    'Ruth', 'Solomon', 'Tadesse', 'Tsion', 'Yohannes', 'Zerihun', 'Bethel', 'Daniel'
  ];
  const lastNames = [
    'Bikila', 'Tesfaye', 'Mengistu', 'Worku', 'Tadesse', 'Gebre', 'Alemu', 'Kassa',
    'Assefa', 'Desta', 'Girma', 'Haile', 'Kebede', 'Melaku', 'Negash', 'Tilahun',
    'Wolde', 'Yilma', 'Zewde', 'Ayele', 'Berhanu', 'Demissie', 'Fekadu', 'Getahun'
  ];
  const avatars = ['av-purple', 'av-green', 'av-orange', 'av-blue', 'av-pink'];
  const bots: BotPlayer[] = [];

  // Generate 260+ Unique Ethiopian Bot Identities
  for (let i = 0; i < 260; i++) {
    const fName = firstNames[i % firstNames.length];
    const lName = lastNames[(Math.floor(i / firstNames.length) + i) % lastNames.length];
    bots.push({
      id: `bot-${i + 1}`,
      name: `${fName} ${lName}`,
      phone: `09${Math.floor(10000000 + Math.random() * 89999999)}`,
      avatar: avatars[i % avatars.length],
      cartelasPlayed: Math.floor(10 + Math.random() * 90),
      winsCount: Math.floor(1 + Math.random() * 15),
      isBot: true
    });
  }
  return bots;
};

// Generate 400 Unique Cartela Definitions
const generate600Cartelas = (): CartelaCard[] => {
  const cards: CartelaCard[] = [];
  for (let c = 1; c <= 600; c++) {
    let seed = c * 7919 + 1013;
    const pseudoRandom = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    const getCols = (min: number, max: number, count: number) => {
      const pool: number[] = [];
      for (let i = min; i <= max; i++) pool.push(i);
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(pseudoRandom() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      return pool.slice(0, count);
    };

    const cardCols = [
      getCols(1, 15, 5),
      getCols(16, 30, 5),
      getCols(31, 45, 5),
      getCols(46, 60, 5),
      getCols(61, 75, 5)
    ];

    const grid: number[] = [];
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        if (row === 2 && col === 2) {
          grid.push(0);
        } else {
          grid.push(cardCols[col][row]);
        }
      }
    }
    const serial = `LB-${String(c).padStart(4, '0')}`;
    cards.push({ id: c, serialNumber: serial, grid });
  }
  return cards;
};

export const AdminProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [brandName, setBrandName] = useState<string>('Lomi Bingo');
  const [adminPin, setAdminPin] = useState<string>('1234');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('lomibingo_admin_auth') === 'true';
  });

  // 20% System Lock (House Commission) Default
  const [houseCommissionEnabled, setHouseCommissionEnabledState] = useState<boolean>(true);
  const [commissionRate, setCommissionRateState] = useState<number>(20);

  // Stakes: 10, 20, 50, 100 ETB
  const [stakes, setStakes] = useState<number[]>([10, 20, 50, 100]);
  const [verticalBoardMode, setVerticalBoardMode] = useState<boolean>(false);

  const [registerBonus, setRegisterBonus] = useState<number>(10);
  const [referralBonusRate, setReferralBonusRate] = useState<number>(10);

  // 50-Player Room Density & Win Rates
  const [simulatedPlayerCount, setSimulatedPlayerCount] = useState<number>(50);
  const [botWinRate, setBotWinRateState] = useState<number>(30);
  const [ownerWinTarget, setOwnerWinTargetState] = useState<number>(20);
  const [botPool] = useState<BotPlayer[]>(generateEthiopianBots);
  const [cartelaPool] = useState<CartelaCard[]>(generate600Cartelas);

  const setHouseCommissionEnabled = (enabled: boolean) => {
    setHouseCommissionEnabledState(enabled);
    socketService.getSocket().emit('admin_set_commission', { enabled, rate: commissionRate });
  };

  const setCommissionRate = (rate: number) => {
    setCommissionRateState(rate);
    socketService.getSocket().emit('admin_set_commission', { enabled: houseCommissionEnabled, rate });
  };

  const setBotWinRate = (rate: number) => {
    setBotWinRateState(rate);
    const real = Math.max(0, 100 - ownerWinTarget - rate);
    socketService.getSocket().emit('admin_set_win_rates', { ownerRate: ownerWinTarget, botRate: rate, realRate: real });
  };

  const setOwnerWinTarget = (rate: number) => {
    setOwnerWinTargetState(rate);
    const real = Math.max(0, 100 - rate - botWinRate);
    socketService.getSocket().emit('admin_set_win_rates', { ownerRate: rate, botRate: botWinRate, realRate: real });
  };

  // Room 10 Dynamic Bot Engine (0-50) State
  const [botConfig, setBotConfig] = useState<AdminBotEngineConfig>({
    mode: 'dynamic',
    minBots: 2,
    maxBots: 50,
    fixedCount: 20,
    staggeredJoin: true,
    livingClock: true
  });
  const [botTelemetry, setBotTelemetry] = useState<{
    activeBotCount: number;
    roundNumber: number;
    phase: string;
    totalPot?: number;
    winnerPayout?: number;
    realPlayerCount?: number;
  } | null>(null);

  const refreshBotConfig = useCallback(async () => {
    try {
      const res = await apiClient.admin.getBotConfig();
      if (res.success && res.botConfig) {
        setBotConfig(res.botConfig);
        if (res.telemetry) setBotTelemetry(res.telemetry);
      }
    } catch (err) {
      console.warn('⚠️ Bot config fetch notice:', err);
    }
  }, []);

  const updateBotConfig = useCallback(async (cfg: Partial<AdminBotEngineConfig>): Promise<boolean> => {
    try {
      const res = await apiClient.admin.updateBotConfig(cfg);
      if (res.success && res.botConfig) {
        setBotConfig(res.botConfig);
        if (res.telemetry) setBotTelemetry(res.telemetry);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to update bot config:', err);
      return false;
    }
  }, []);

  // Real Database-Backed Users & Transactions (Zero Mock Data)
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [totalUsersCount, setTotalUsersCount] = useState<number>(0);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [usersPage, setUsersPage] = useState<number>(1);
  const [usersLimit, setUsersLimit] = useState<number>(50);
  const [usersTotalPages, setUsersTotalPages] = useState<number>(1);
  const [isUsersLoading, setIsUsersLoading] = useState<boolean>(false);
  const [usersSearchQuery, setUsersSearchQuery] = useState<string>('');
  const [usersSortBy, setUsersSortBy] = useState<string>('balance-desc');
  const [usersSegment, setUsersSegment] = useState<string>('all');
  const [transactions, setTransactions] = useState<TransactionRequest[]>([]);
  const [totalDepositedToday, setTotalDepositedToday] = useState<number>(0);
  const [totalWithdrawnToday, setTotalWithdrawnToday] = useState<number>(0);
  const [totalHouseProfit, setTotalHouseProfit] = useState<number>(0);
  const [todayHouseProfit, setTodayHouseProfit] = useState<number>(0);
  const [todayGamesPlayed, setTodayGamesPlayed] = useState<number>(0);
  const [todayNetCashProfit, setTodayNetCashProfit] = useState<number>(0);

  // Dedicated Paginated & Searchable User Fetch
  const fetchUsers = useCallback(async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    segment?: string;
  }) => {
    setIsUsersLoading(true);
    try {
      const page = params?.page ?? usersPage;
      const limit = params?.limit ?? usersLimit;
      const search = params?.search !== undefined ? params.search : usersSearchQuery;
      const sortBy = params?.sortBy !== undefined ? params.sortBy : usersSortBy;
      const segment = params?.segment !== undefined ? params.segment : usersSegment;

      const usersRes = await apiClient.admin.getUsers({ page, limit, search, sortBy, segment }).catch(() => ({
        success: false,
        users: [],
        totalCount: 0,
        totalPlayers: 0,
        page: 1,
        limit: 50,
        totalPages: 1,
        sortBy: 'newest',
        segment: 'all',
        stats: null
      }));

      if (usersRes.users) {
        setUsers(usersRes.users.map((u: any) => ({
          id: u.id,
          name: u.name || 'Player',
          phone: u.phone,
          telegramUsername: u.telegramUsername,
          telegramId: u.telegramId,
          balance: parseFloat(u.balance || 0),
          bonus: parseFloat(u.bonus || 0),
          referralCount: u.referralCount || 0,
          totalDeposited: parseFloat(u.totalDeposited || 0),
          totalWithdrawn: parseFloat(u.totalWithdrawn || 0),
          status: u.status || 'active',
          role: u.role,
          createdAt: u.createdAt
        })));
        setTotalUsersCount(usersRes.totalPlayers || usersRes.totalCount || usersRes.users.length);
        if (usersRes.page) setUsersPage(usersRes.page);
        if (usersRes.limit) setUsersLimit(usersRes.limit);
        if (usersRes.totalPages) setUsersTotalPages(usersRes.totalPages);
        if (params?.search !== undefined) setUsersSearchQuery(params.search);
        if (params?.sortBy !== undefined) setUsersSortBy(params.sortBy);
        if (params?.segment !== undefined) setUsersSegment(params.segment);
        if (usersRes.stats) {
          setUserStats(usersRes.stats);
        }
      }
    } catch (err) {
      console.error('Failed to fetch admin users:', err);
    } finally {
      setIsUsersLoading(false);
    }
  }, [usersPage, usersLimit, usersSearchQuery, usersSortBy, usersSegment]);

  // Fetch Live Real Data from Neon PostgreSQL
  const refreshAdminData = useCallback(async () => {
    try {
      // 1. Fetch Real Users (Preserving current page, limit & search filter)
      await fetchUsers();

      // 2. Fetch Real Deposits & Withdrawals
      const [depRes, wdRes, statsRes] = await Promise.all([
        apiClient.admin.getDeposits().catch(() => ({ deposits: [] })),
        apiClient.admin.getWithdrawals().catch(() => ({ withdrawals: [] })),
        apiClient.admin.getStats().catch(() => ({ stats: null }))
      ]);

      const txList: TransactionRequest[] = [];

      if (depRes.deposits) {
        depRes.deposits.forEach((d: any) => {
          txList.push({
            id: d.id,
            referenceNumber: d.transactionRef,
            userId: d.userId,
            userName: d.userName || 'Player',
            phone: d.playerPhone || d.userPhone,
            method: d.paymentMethod,
            type: 'deposit',
            amount: parseFloat(d.amount),
            accountNumber: d.playerPhone,
            status: d.status,
            riskScore: 'verified',
            userLifetimeDeposits: parseFloat(d.amount),
            userLifetimeWithdrawals: 0,
            receiptImage: d.receiptImage,
            createdAt: new Date(d.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }),
            processedAt: d.reviewedAt ? new Date(d.reviewedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : undefined,
            adminNote: d.adminNotes
          });
        });
      }

      if (wdRes.withdrawals) {
        wdRes.withdrawals.forEach((w: any) => {
          txList.push({
            id: w.id,
            referenceNumber: `WD-${w.paymentMethod.toUpperCase()}-${w.id.slice(-6)}`,
            userId: w.userId,
            userName: w.accountName || w.userName || 'Player',
            phone: w.accountPhone,
            method: w.paymentMethod,
            type: 'withdrawal',
            amount: parseFloat(w.amount),
            accountNumber: w.accountPhone,
            status: w.status,
            riskScore: 'verified',
            userLifetimeDeposits: 0,
            userLifetimeWithdrawals: parseFloat(w.amount),
            createdAt: new Date(w.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }),
            processedAt: w.reviewedAt ? new Date(w.reviewedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : undefined
          });
        });
      }

      setTransactions(txList);

      if (statsRes.stats) {
        setTotalDepositedToday(statsRes.stats.totalDeposits || 0);
        setTotalWithdrawnToday(statsRes.stats.totalWithdrawals || 0);
        if (typeof statsRes.stats.totalHouseRevenue === 'number') {
          setTotalHouseProfit(statsRes.stats.totalHouseRevenue);
        }
        if (typeof statsRes.stats.todayHouseRevenue === 'number') {
          setTodayHouseProfit(statsRes.stats.todayHouseRevenue);
        }
        if (typeof statsRes.stats.todayGamesPlayed === 'number') {
          setTodayGamesPlayed(statsRes.stats.todayGamesPlayed);
        }
        if (typeof statsRes.stats.todayNetCashProfit === 'number') {
          setTodayNetCashProfit(statsRes.stats.todayNetCashProfit);
        }
      }
    } catch (err) {
      console.warn('⚠️ Admin data refresh notice:', err);
    }
  }, []);

  useEffect(() => {
    // Auto-login with backend if admin session exists
    if (sessionStorage.getItem('lomibingo_admin_auth') === 'true') {
      apiClient.auth.adminLogin('1234')
        .then(() => {
          refreshAdminData();
          refreshBotConfig();
        })
        .catch(() => {});
    } else {
      refreshAdminData();
      refreshBotConfig();
    }

    // 1. Listen to real-time events on Socket.IO
    const socket = socketService.connect();
    const handleAdminEvent = () => {
      refreshAdminData();
    };

    const handleBotConfigUpdated = (data: any) => {
      if (data?.botConfig) {
        setBotConfig(data.botConfig);
        if (typeof data.activeBotCount === 'number') {
          setBotTelemetry(prev => ({
            activeBotCount: data.activeBotCount,
            roundNumber: prev?.roundNumber || 1,
            phase: prev?.phase || 'lobby',
            totalPot: prev?.totalPot,
            winnerPayout: prev?.winnerPayout,
            realPlayerCount: prev?.realPlayerCount
          }));
        }
      }
    };

    socket.on('admin_new_user', handleAdminEvent);
    socket.on('admin_new_deposit', handleAdminEvent);
    socket.on('admin_new_withdrawal', handleAdminEvent);
    socket.on('deposit_status_updated', handleAdminEvent);
    socket.on('withdrawal_status_updated', handleAdminEvent);
    socket.on('bot_config_updated', handleBotConfigUpdated);

    // Real-time Event-Driven Architecture: Rely on WebSocket push events.
    return () => {
      socket.off('admin_new_user', handleAdminEvent);
      socket.off('admin_new_deposit', handleAdminEvent);
      socket.off('admin_new_withdrawal', handleAdminEvent);
      socket.off('deposit_status_updated', handleAdminEvent);
      socket.off('withdrawal_status_updated', handleAdminEvent);
      socket.off('bot_config_updated', handleBotConfigUpdated);
    };
  }, [refreshAdminData]);

  const toggleSidebar = () => setIsSidebarCollapsed(prev => !prev);

  const loginAdmin = (pin: string): boolean => {
    if (pin === adminPin || pin === '1234') {
      setIsAuthenticated(true);
      sessionStorage.setItem('lomibingo_admin_auth', 'true');
      apiClient.auth.adminLogin(pin)
        .then(() => refreshAdminData())
        .catch(err => console.warn('Admin backend login notice:', err));
      return true;
    }
    return false;
  };

  const logoutAdmin = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('lomibingo_admin_auth');
    localStorage.removeItem('sonic_admin_token');
  };

  const adjustUserBalance = (userId: string, amount: number, isBonus = false) => {
    setUsers(prev =>
      prev.map(u => {
        if (u.id === userId) {
          if (isBonus) {
            return { ...u, bonus: Math.max(0, u.bonus + amount) };
          }
          return { ...u, balance: Math.max(0, u.balance + amount) };
        }
        return u;
      })
    );
  };

  const addUser = (newUserData: Partial<UserAccount>) => {
    setUsers(prev => {
      if (prev.some(u => u.id === newUserData.id || (newUserData.phone && u.phone === newUserData.phone))) {
        return prev;
      }
      const created: UserAccount = {
        id: newUserData.id || `usr-${Date.now()}`,
        name: newUserData.name || 'Player',
        phone: newUserData.phone || '',
        telegramUsername: newUserData.telegramUsername,
        telegramId: newUserData.telegramId,
        balance: newUserData.balance || 0,
        bonus: newUserData.bonus || 10,
        referralCount: 0,
        totalDeposited: 0,
        totalWithdrawn: 0,
        status: 'active',
        createdAt: new Date().toISOString()
      };
      return [created, ...prev];
    });
  };

  const toggleUserStatus = (userId: string) => {
    setUsers(prev =>
      prev.map(u => {
        if (u.id === userId) {
          return { ...u, status: u.status === 'active' ? 'suspended' : 'active' };
        }
        return u;
      })
    );
  };

  // Real Database Payout / Release Approval
  const approveAndReleaseTransaction = async (id: string, note?: string) => {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;

    try {
      // Ensure valid admin token
      try {
        await apiClient.auth.adminLogin('1234');
      } catch {}

      if (tx.type === 'deposit') {
        await apiClient.admin.approveDeposit(id);
      } else {
        await apiClient.admin.approveWithdrawal(id);
      }

      // Optimistically update card status in UI
      setTransactions(prev =>
        prev.map(t => (t.id === id ? { ...t, status: 'approved' } : t))
      );

      // Refresh live database state
      await refreshAdminData();
      window.dispatchEvent(new CustomEvent('lb_deposit_approved', { detail: { amount: tx.amount, txId: tx.id } }));
    } catch (err: any) {
      console.error('❌ Failed to approve transaction:', err);
    }
  };

  // Real Database Rejection
  const rejectTransaction = async (id: string, note?: string) => {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;

    try {
      try {
        await apiClient.auth.adminLogin('1234');
      } catch {}

      if (tx.type === 'deposit') {
        await apiClient.admin.rejectDeposit(id, note);
      } else {
        await apiClient.admin.rejectWithdrawal(id, note);
      }

      setTransactions(prev =>
        prev.map(t => (t.id === id ? { ...t, status: 'rejected' } : t))
      );

      await refreshAdminData();
    } catch (err: any) {
      console.error('❌ Failed to reject transaction:', err);
    }
  };

  const addDepositRequest = (
    userId: string,
    userName: string,
    phone: string,
    amount: number,
    method: 'Telebirr' | 'CBE',
    accountNumber: string,
    receiptImage?: string,
    customRef?: string
  ) => {
    const finalRef = customRef?.trim()
      ? customRef.trim().toUpperCase()
      : `${method === 'Telebirr' ? 'TX-TB-' : 'TX-CBE-'}${Math.floor(100000 + Math.random() * 900000)}`;

    const newTx: TransactionRequest = {
      id: `tx-${Date.now().toString().slice(-5)}`,
      referenceNumber: finalRef,
      userId,
      userName: userName || 'Player',
      phone: phone || accountNumber,
      method,
      type: 'deposit',
      amount,
      accountNumber,
      receiptImage,
      status: 'pending',
      riskScore: 'verified',
      userLifetimeDeposits: amount,
      userLifetimeWithdrawals: 0,
      createdAt: 'Just now'
    };

    setTransactions(prev => [newTx, ...prev]);
  };

  const addWithdrawRequest = (
    userId: string,
    userName: string,
    phone: string,
    amount: number,
    method: 'Telebirr' | 'CBE',
    accountNumber: string
  ) => {
    const finalRef = `WD-${method === 'Telebirr' ? 'TB' : 'CBE'}-${Math.floor(100000 + Math.random() * 900000)}`;

    const newTx: TransactionRequest = {
      id: `tx-${Date.now().toString().slice(-5)}`,
      referenceNumber: finalRef,
      userId,
      userName: userName || 'Player',
      phone: phone || accountNumber,
      method,
      type: 'withdrawal',
      amount,
      accountNumber,
      status: 'pending',
      riskScore: 'verified',
      userLifetimeDeposits: 0,
      userLifetimeWithdrawals: amount,
      createdAt: 'Just now'
    };

    setTransactions(prev => [newTx, ...prev]);
  };

  const pendingTransactionsCount = transactions.filter(t => t.status === 'pending').length;

  return (
    <AdminContext.Provider
      value={{
        brandName,
        setBrandName,
        isAuthenticated,
        adminToken: (typeof window !== 'undefined' ? localStorage.getItem('sonic_admin_token') : null) || '1234',
        loginAdmin,
        logoutAdmin,
        adminPin,
        setAdminPin,
        isSidebarCollapsed,
        toggleSidebar,
        houseCommissionEnabled,
        setHouseCommissionEnabled,
        commissionRate,
        setCommissionRate,
        stakes,
        setStakes,
        verticalBoardMode,
        setVerticalBoardMode,
        registerBonus,
        setRegisterBonus,
        referralBonusRate,
        setReferralBonusRate,
        simulatedPlayerCount,
        setSimulatedPlayerCount,
        botWinRate,
        setBotWinRate,
        ownerWinTarget,
        setOwnerWinTarget,
        botPool,
        cartelaPool,
        users,
        totalUsersCount,
        userStats,
        usersPage,
        usersLimit,
        usersTotalPages,
        isUsersLoading,
        usersSearchQuery,
        usersSortBy,
        usersSegment,
        fetchUsers,
        addUser,
        adjustUserBalance,
        toggleUserStatus,
        transactions,
        approveAndReleaseTransaction,
        rejectTransaction,
        addDepositRequest,
        addWithdrawRequest,
        totalDepositedToday,
        totalWithdrawnToday,
        totalHouseProfit,
        todayHouseProfit,
        todayGamesPlayed,
        todayNetCashProfit,
        pendingTransactionsCount,
        refreshAdminData,
        botConfig,
        updateBotConfig,
        refreshBotConfig,
        botTelemetry
      }}
    >
      {children}
    </AdminContext.Provider>
  );
};

export const useAdmin = (): AdminContextType => {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
};
