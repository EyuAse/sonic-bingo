/**
 * Lomi Bingo Centralized API Client (Connected to Neon PostgreSQL Backend)
 */

import { getApiBase, getBackendOrigin } from '../config/env.ts';

const API_BASE = getApiBase();

function getAuthHeader(): Record<string, string> {
  const token = typeof window !== 'undefined'
    ? localStorage.getItem('sonic_auth_token')
    : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 401 && typeof window !== 'undefined') {
    localStorage.removeItem('sonic_admin_token');
  }
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}. Please ensure backend is running.`);
    }
    throw new Error('Connecting to server. Please retry in a moment.');
  }
  const data = await res.json();
  if (!res.ok || data.success === false) {
    throw new Error(data.error || `HTTP ${res.status}: Request failed`);
  }
  return data as T;
}

async function fetchWithRetry(url: string, options?: RequestInit, retries = 3, delayMs = 1200): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.status === 401 && typeof window !== 'undefined') {
        localStorage.removeItem('sonic_admin_token');
      }
      // Never retry rate-limited responses — retrying makes it worse
      if (res.status === 429) return res;
      return res;
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  return fetch(url, options);
}

export async function getAdminAuthHeader(): Promise<Record<string, string>> {
  if (typeof window === 'undefined') return {};
  let token = localStorage.getItem('sonic_admin_token');
  if (!token) {
    try {
      const res = await fetch(`${API_BASE}/auth/admin-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: '1234' })
      });
      const data = await res.json();
      if (data.token) {
        token = data.token;
        localStorage.setItem('sonic_admin_token', data.token);
      }
    } catch {}
  }
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function getAgentAuthHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('sonic_agent_token') || localStorage.getItem('sonic_auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const apiClient = {
  // 1. Authentication Endpoints
  auth: {
    async adminLogin(pin: string) {
      const res = await fetchWithRetry(`${API_BASE}/auth/admin-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });

      const data = await handleResponse<{
        success: boolean;
        token: string;
        user: any;
        wallet?: { balance: number; bonus: number; lockedBalance: number };
      }>(res);

      if (data.token) {
        localStorage.setItem('sonic_admin_token', data.token);
      }

      return data;
    },

    async loginWithTelegram(tgUser: any, customPhone?: string, referralCode?: string) {
      const payload = {
        telegramId: tgUser.id,
        username: tgUser.username,
        firstName: tgUser.first_name,
        lastName: tgUser.last_name,
        photoUrl: tgUser.photo_url,
        phone: customPhone,
        referralCode
      };

      const res = await fetchWithRetry(`${API_BASE}/auth/telegram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await handleResponse<{
        success: boolean;
        token: string;
        user: any;
        wallet: { balance: number; bonus: number; lockedBalance: number };
        isNewUser: boolean;
      }>(res);

      if (data.token) {
        localStorage.setItem('sonic_auth_token', data.token);
      }

      return data;
    },

    async register(payload: { phone: string; pin: string; fullName?: string; carrier?: string; referralCode?: string }) {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await handleResponse<{
        success: boolean;
        token: string;
        user: any;
        wallet: { balance: number; bonus: number; lockedBalance: number };
      }>(res);

      if (data.token) {
        localStorage.setItem('sonic_auth_token', data.token);
      }

      return data;
    },

    async checkTelegramExists(telegramId: number | string): Promise<boolean> {
      try {
        const res = await fetch(`${API_BASE}/auth/check-telegram/${telegramId}`);
        const data = await handleResponse<{ success: boolean; exists: boolean }>(res);
        return !!data.exists;
      } catch {
        return false;
      }
    },

    async loginWithPin(phone: string, pin: string) {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pin })
      });

      const data = await handleResponse<{
        success: boolean;
        token: string;
        user: any;
        wallet: { balance: number; bonus: number; lockedBalance: number };
      }>(res);

      if (data.token) {
        localStorage.setItem('sonic_auth_token', data.token);
      }

      return data;
    },

    async getMe() {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { ...getAuthHeader() }
      });
      return handleResponse<{
        success: boolean;
        user: any;
        wallet: { balance: number; bonus: number; lockedBalance: number };
      }>(res);
    },

    async updateProfile(payload: {
      phone?: string;
      fullName?: string;
      telegramUsername?: string;
      attachedAccounts?: any[];
    }) {
      const res = await fetch(`${API_BASE}/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify(payload)
      });
      return handleResponse<{
        success: boolean;
        message: string;
        user: any;
        wallet: { balance: number; bonus: number; lockedBalance: number };
      }>(res);
    }
  },

  // 2. Wallet Endpoints
  wallet: {
    async getBalance() {
      const res = await fetch(`${API_BASE}/wallet/balance`, {
        headers: { ...getAuthHeader() }
      });
      return handleResponse<{
        success: boolean;
        balance: number;
        bonus: number;
        lockedBalance: number;
        currency: string;
      }>(res);
    },

    async deposit(payload: {
      amount: number;
      paymentMethod: 'Telebirr' | 'CBE';
      playerPhone: string;
      transactionRef?: string;
      receiptImage?: string;
    }) {
      const res = await fetch(`${API_BASE}/wallet/deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify(payload)
      });
      return handleResponse<{
        success: boolean;
        message: string;
        deposit: any;
      }>(res);
    },

    async withdraw(payload: {
      amount: number;
      paymentMethod: 'Telebirr' | 'CBE';
      accountPhone: string;
      accountName?: string;
    }) {
      const res = await fetch(`${API_BASE}/wallet/withdraw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify(payload)
      });
      return handleResponse<{
        success: boolean;
        message: string;
        newBalance: number;
        withdrawal: any;
      }>(res);
    },

    async getTransactions() {
      const res = await fetch(`${API_BASE}/wallet/transactions`, {
        headers: { ...getAuthHeader() }
      });
      const data = await handleResponse<{
        success: boolean;
        transactions: any[];
      }>(res);
      if (data && Array.isArray(data.transactions)) {
        data.transactions = data.transactions.map((tx: any) => ({
          ...tx,
          receiptImage: tx.receiptImage && tx.receiptImage.startsWith('/')
            ? `${getBackendOrigin()}${tx.receiptImage}`
            : tx.receiptImage
        }));
      }
      return data;
    },

    async getReferrals() {
      const res = await fetch(`${API_BASE}/wallet/referrals`, {
        headers: { ...getAuthHeader() }
      });
      return handleResponse<{
        success: boolean;
        referralCode: string;
        referralLink: string;
        totalInvited: number;
        totalEarned: number;
        friends: Array<{
          id: string;
          name: string;
          avatar: string;
          isPremium: boolean;
          joinedAt: string;
          depositAmount: number;
          bonusEarned: number;
          status: 'paid' | 'pending_deposit';
        }>;
      }>(res);
    },

    async getGameHistory() {
      const res = await fetch(`${API_BASE}/wallet/game-history`, {
        headers: { ...getAuthHeader() }
      });
      return handleResponse<{
        success: boolean;
        summary: {
          totalGames: number;
          totalWins: number;
          totalLosses: number;
          winRate: number;
          totalStaked: number;
          totalWon: number;
          netProfit: number;
        };
        rounds: Array<{
          roundId: string;
          roomId: string;
          roomName: string;
          roundNumber: number;
          phase: string;
          totalPot: number;
          winnerPayout: number;
          winnerNames: string[];
          winnerCartelas: number[];
          winnerUserIds: string[];
          drawnNumbers: number[];
          endedAt: string | null;
          betTime: string;
          totalStake: number;
          isWinner: boolean;
          userWonAmount: number;
          netPnl: number;
          tickets: Array<{
            id: string;
            cartelaId: number;
            cardMatrix: any;
            betAmount: number;
            isWinner: boolean;
            status: string;
          }>;
        }>;
      }>(res);
    },

    // Agent Cash-Out Voucher (Player Counter Payout)
    async createAgentVoucher(amount: number) {
      const res = await fetch(`${API_BASE}/wallet/agent-voucher/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ amount })
      });
      return handleResponse<{
        success: boolean;
        message: string;
        voucher: {
          id: string;
          voucherCode: string;
          amount: number;
          status: string;
          createdAt: string;
          expiresAt: string;
        };
        newBalance: number;
      }>(res);
    },

    async cancelAgentVoucher(voucherId?: string) {
      const res = await fetch(`${API_BASE}/wallet/agent-voucher/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ voucherId })
      });
      return handleResponse<{
        success: boolean;
        message: string;
        newBalance: number;
      }>(res);
    },

    async getActiveAgentVoucher() {
      const res = await fetch(`${API_BASE}/wallet/agent-voucher/active`, {
        headers: { ...getAuthHeader() }
      });
      return handleResponse<{
        success: boolean;
        hasActiveVoucher: boolean;
        voucher: {
          id: string;
          voucherCode: string;
          amount: number;
          status: string;
          createdAt: string;
          expiresAt: string;
        } | null;
      }>(res);
    },

    async getActiveAgents() {
      const res = await fetch(`${API_BASE}/wallet/agents/active`);
      return handleResponse<{
        success: boolean;
        agents: Array<{
          agentCode: string;
          fullName: string;
          phone: string;
        }>;
      }>(res);
    }
  },

  // 3. Admin Endpoints (Guaranteed Admin Bearer Token)
  admin: {
    async getUsers(params?: {
      page?: number;
      limit?: number | 'all';
      search?: string;
      sortBy?: string;
      segment?: string;
    }) {
      const adminHeaders = await getAdminAuthHeader();
      const query = new URLSearchParams();
      if (params?.page) query.set('page', String(params.page));
      if (params?.limit) query.set('limit', String(params.limit));
      if (params?.search) query.set('search', params.search);
      if (params?.sortBy) query.set('sortBy', params.sortBy);
      if (params?.segment) query.set('segment', params.segment);
      const qs = query.toString() ? `?${query.toString()}` : '';
      const res = await fetch(`${API_BASE}/admin/users${qs}`, {
        headers: { ...adminHeaders }
      });
      return handleResponse<{
        success: boolean;
        users: any[];
        totalCount: number;
        totalPlayers?: number;
        page?: number;
        limit?: number;
        totalPages?: number;
        sortBy?: string;
        segment?: string;
        stats?: {
          totalPlayers: number;
          activePlayers: number;
          suspendedPlayers: number;
          vipPlayers?: number;
          bonusPlayers?: number;
          totalCashFloat: number;
          totalBonusFloat: number;
        };
      }>(res);
    },

    async getDeposits() {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/deposits`, {
        headers: { ...adminHeaders }
      });
      const data = await handleResponse<{ success: boolean; deposits: any[] }>(res);
      if (data && Array.isArray(data.deposits)) {
        data.deposits = data.deposits.map((d: any) => ({
          ...d,
          receiptImage: d.receiptImage && d.receiptImage.startsWith('/')
            ? `${getBackendOrigin()}${d.receiptImage}`
            : d.receiptImage
        }));
      }
      return data;
    },

    async approveDeposit(id: string) {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/deposits/${id}/approve`, {
        method: 'POST',
        headers: { ...adminHeaders }
      });
      return handleResponse<{ success: boolean; message: string; newBalance: number }>(res);
    },

    async rejectDeposit(id: string, reason?: string) {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/deposits/${id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...adminHeaders
        },
        body: JSON.stringify({ reason })
      });
      return handleResponse<{ success: boolean; message: string }>(res);
    },

    async getWithdrawals() {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/withdrawals`, {
        headers: { ...adminHeaders }
      });
      return handleResponse<{ success: boolean; withdrawals: any[] }>(res);
    },

    async approveWithdrawal(id: string) {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/withdrawals/${id}/approve`, {
        method: 'POST',
        headers: { ...adminHeaders }
      });
      return handleResponse<{ success: boolean; message: string }>(res);
    },

    async rejectWithdrawal(id: string, reason?: string) {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/withdrawals/${id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...adminHeaders
        },
        body: JSON.stringify({ reason })
      });
      return handleResponse<{ success: boolean; message: string }>(res);
    },

    async getStats() {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/stats`, {
        headers: { ...adminHeaders }
      });
      return handleResponse<{
        success: boolean;
        stats: {
          totalPlayers: number;
          totalDeposits: number;
          totalWithdrawals: number;
          totalGamesPlayed: number;
          todayGamesPlayed: number;
          totalHouseRevenue: number;
          todayHouseRevenue: number;
          todayNetCashProfit: number;
          defaultCommissionRate: number;
        };
      }>(res);
    },

    async getBotUsers() {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/bot-users`, {
        headers: { ...adminHeaders }
      });
      return handleResponse<{ success: boolean; bots: any[]; count: number }>(res);
    },

    async replenishBotUsers() {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/bot-users/replenish`, {
        method: 'POST',
        headers: { ...adminHeaders }
      });
      return handleResponse<{ success: boolean; message: string }>(res);
    },

    async getDatabaseHealth() {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/database-health`, {
        headers: { ...adminHeaders }
      });
      return handleResponse<{ success: boolean; stats: any }>(res);
    },

    async downloadDatabaseBackup() {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/database-backup`, {
        headers: { ...adminHeaders }
      });
      if (!res.ok) {
        throw new Error(`Failed to generate backup: HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `neon-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      return { success: true };
    },

    async pruneDatabaseStorage() {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/database-prune`, {
        method: 'POST',
        headers: { ...adminHeaders }
      });
      return handleResponse<{ success: boolean; message: string; prunedCount: number; stats: any }>(res);
    },

    async getBotConfig() {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/bot-config`, {
        headers: { ...adminHeaders }
      });
      return handleResponse<{ success: boolean; botConfig: any; telemetry: any }>(res);
    },

    async updateBotConfig(cfg: any) {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/bot-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...adminHeaders },
        body: JSON.stringify(cfg)
      });
      return handleResponse<{ success: boolean; botConfig: any; telemetry: any }>(res);
    },

    // Progressive Jackpots
    async getJackpots() {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/jackpots`, {
        headers: { ...adminHeaders }
      });
      return handleResponse<{ success: boolean; pools: any[]; winners: any[] }>(res);
    },

    async adjustJackpot(payload: { roomId: string; balance?: number; seedAmount?: number }) {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/jackpots/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...adminHeaders },
        body: JSON.stringify(payload)
      });
      return handleResponse<{ success: boolean; pool?: any; message?: string; error?: string }>(res);
    },

    // Coins & Loyalty Rewards
    async getCoins() {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/coins`, {
        headers: { ...adminHeaders }
      });
      return handleResponse<{ success: boolean; stats: any; topHolders?: any[]; holders?: any[]; recentTransactions: any[] }>(res);
    },

    async adjustCoins(payload: { userId: string; amount: number; reason?: string; description?: string }) {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/coins/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...adminHeaders },
        body: JSON.stringify({
          userId: payload.userId,
          amount: payload.amount,
          reason: payload.reason || payload.description || 'Admin manual adjustment'
        })
      });
      return handleResponse<{ success: boolean; newBalance?: number; balance?: number; message?: string; error?: string }>(res);
    },

    // Decentralized Agents
    async getAgents() {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/agents`, {
        headers: { ...adminHeaders }
      });
      return handleResponse<{ success: boolean; agents: any[] }>(res);
    },

    async createAgent(payload: {
      fullName: string;
      phone: string;
      initialDeposit?: number;
      targetMonthly?: number;
      commissionRate?: number;
      customCode?: string;
      initialFloat?: number;
      agentCode?: string;
    }) {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/agents/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...adminHeaders },
        body: JSON.stringify({
          fullName: payload.fullName,
          phone: payload.phone,
          initialDeposit: payload.initialDeposit ?? payload.initialFloat ?? 10000,
          targetMonthly: payload.targetMonthly ?? 50000,
          commissionRate: payload.commissionRate ?? 5,
          customCode: payload.customCode || payload.agentCode || undefined
        })
      });
      return handleResponse<{ success: boolean; agent?: any; message?: string; error?: string }>(res);
    },

    async setAgentStatus(id: string, status: 'active' | 'suspended') {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/agents/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...adminHeaders },
        body: JSON.stringify({ status })
      });
      return handleResponse<{ success: boolean; agent?: any; message?: string; error?: string }>(res);
    },

    // Agent Float Recharges
    async getAgentRecharges(status?: string) {
      const adminHeaders = await getAdminAuthHeader();
      const qs = status ? `?status=${encodeURIComponent(status)}` : '';
      const res = await fetch(`${API_BASE}/admin/agents/recharges${qs}`, {
        headers: { ...adminHeaders }
      });
      return handleResponse<{ success: boolean; recharges: any[] }>(res);
    },

    async approveAgentRecharge(id: string) {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/agents/recharges/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...adminHeaders }
      });
      return handleResponse<{ success: boolean; message?: string; error?: string }>(res);
    },

    async rejectAgentRecharge(id: string, adminNotes?: string) {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/agents/recharges/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...adminHeaders },
        body: JSON.stringify({ adminNotes: adminNotes || 'Rejected by admin' })
      });
      return handleResponse<{ success: boolean; message?: string; error?: string }>(res);
    },

    // Network Health
    async getNetworkHealth() {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/network-health`, {
        headers: { ...adminHeaders }
      });
      return handleResponse<{ success: boolean; metrics: any }>(res);
    }
  },

  // 4. Agent Portal Endpoints (Decentralized Cash-In / Cash-Out Agent Suite)
  agent: {
    async login(payload: { phone: string; password?: string; agentCode?: string }) {
      const res = await fetch(`${API_BASE}/agent/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return handleResponse<{
        success: boolean;
        token: string;
        agent: {
          id: string;
          userId: string;
          fullName: string;
          phone: string;
          agentCode: string;
          walletBalance: number;
          lowBalanceThreshold: number;
          targetMonthly: number;
          commissionRate: number;
          refLink: string;
        };
      }>(res);
    },

    async getProfile() {
      const res = await fetch(`${API_BASE}/agent/profile`, {
        headers: { ...getAgentAuthHeader() }
      });
      return handleResponse<{
        success: boolean;
        profile: {
          id: string;
          agentCode: string;
          fullName: string;
          phone: string;
          walletBalance: number;
          initialDeposit: number;
          lowBalanceThreshold: number;
          isLowBalance: boolean;
          targetMonthly: number;
          commissionRate: number;
          status: string;
          inviteLink: string;
        };
      }>(res);
    },

    async getPerformance() {
      const res = await fetch(`${API_BASE}/agent/performance`, {
        headers: { ...getAgentAuthHeader() }
      });
      return handleResponse<{
        success: boolean;
        agentCode: string;
        walletBalance: number;
        lowBalanceThreshold: number;
        isLowBalance: boolean;
        metrics: {
          totalPlayers: number;
          activePlayers: number;
          todayDeposited: number;
          monthDeposited: number;
          totalDepositedAllTime: number;
          targetMonthly: number;
          targetProgress: number;
          commissionRate: number;
          estimatedCommission: number;
          commissionBreakdown?: {
            depositCommission: number;
            voucherCommission: number;
            totalCommission: number;
            fromPlayersPercent: number;
            fromReferralsPercent: number;
          };
          dailyTrend?: Array<{
            dayNum: number;
            label: string;
            count: number;
            volume: number;
          }>;
        };
        recentDeposits: any[];
      }>(res);
    },

    async searchPlayer(query: string) {
      const res = await fetch(`${API_BASE}/agent/search-player?q=${encodeURIComponent(query)}`, {
        headers: { ...getAgentAuthHeader() }
      });
      return handleResponse<{
        success: boolean;
        players: Array<{
          id: string;
          fullName: string;
          phone: string;
          username: string;
          balance: number;
        }>;
      }>(res);
    },

    async depositForPlayer(payload: {
      playerPhone: string;
      amount: number;
      paymentMethod?: string;
    }) {
      const res = await fetch(`${API_BASE}/agent/deposit-for-player`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAgentAuthHeader() },
        body: JSON.stringify(payload)
      });
      return handleResponse<{
        success: boolean;
        message: string;
        referenceCode: string;
        playerName: string;
        playerPhone: string;
        amount: number;
        newAgentBalance: number;
        isLowBalance: boolean;
        warning: string | null;
      }>(res);
    },

    async verifyCashoutVoucher(voucherCode: string) {
      const res = await fetch(`${API_BASE}/agent/cashout/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAgentAuthHeader() },
        body: JSON.stringify({ voucherCode })
      });
      return handleResponse<{
        success: boolean;
        voucher: {
          id: string;
          voucherCode: string;
          amount: number;
          playerName: string;
          playerPhone: string;
          status: string;
          createdAt: string;
          expiresAt: string;
        };
      }>(res);
    },

    async redeemCashoutVoucher(voucherCode: string) {
      const res = await fetch(`${API_BASE}/agent/cashout/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAgentAuthHeader() },
        body: JSON.stringify({ voucherCode })
      });
      return handleResponse<{
        success: boolean;
        message: string;
        referenceCode: string;
        voucherCode: string;
        payoutAmount: number;
        commissionEarned: number;
        newAgentBalance: number;
        playerName: string;
        playerPhone: string;
      }>(res);
    },

    async requestRecharge(payload: {
      amount: number;
      paymentMethod: string;
      transactionCode: string;
      receiptImage?: string;
    }) {
      const res = await fetch(`${API_BASE}/agent/recharge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAgentAuthHeader() },
        body: JSON.stringify(payload)
      });
      return handleResponse<{
        success: boolean;
        message: string;
        request: any;
      }>(res);
    },

    async getRecharges() {
      const res = await fetch(`${API_BASE}/agent/recharges`, {
        headers: { ...getAgentAuthHeader() }
      });
      return handleResponse<{
        success: boolean;
        recharges: any[];
      }>(res);
    },

    async getPlayers() {
      const res = await fetch(`${API_BASE}/agent/players`, {
        headers: { ...getAgentAuthHeader() }
      });
      return handleResponse<{
        success: boolean;
        players: Array<{
          id: string;
          fullName: string;
          phone: string;
          username: string;
          hasDeposited: boolean;
          balance: number;
          totalDepositedByAgent: number;
          createdAt: string;
        }>;
      }>(res);
    },

    async getTransactions() {
      const res = await fetch(`${API_BASE}/agent/transactions`, {
        headers: { ...getAgentAuthHeader() }
      });
      return handleResponse<{
        success: boolean;
        transactions: Array<{
          id: string;
          type: 'cash_in' | 'cash_out';
          amount: number;
          payment_method: string;
          reference_code: string;
          agent_balance_after?: number;
          agent_commission_earned?: number;
          player_name: string;
          player_phone: string;
          created_at: string;
        }>;
      }>(res);
    }
  }
};
