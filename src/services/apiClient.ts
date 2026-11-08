/**
 * Sonic Bingo Centralized API Client (Connected to Neon PostgreSQL Backend)
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

export function getWithdrawalsAdminAuthHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = sessionStorage.getItem('sonic_withdrawals_token') || 
                localStorage.getItem('sonic_withdrawals_token') || 
                localStorage.getItem('sonic_admin_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const apiClient = {
  // Public Endpoints
  public: {
    async getBonusConfig() {
      const res = await fetch(`${API_BASE}/public/bonus-config`);
      return handleResponse<{
        success: boolean;
        regBonusEnabled: boolean;
        regBonusAmount: number;
        regBonusExpiresDays: number;
        refBonusEnabled: boolean;
        refBonusPercent: number;
        refMinDeposit: number;
        refMaxCap: number;
        coinEarningEnabled: boolean;
        coinEarningRate: number;
        coinRedemptionCoinsPerBlock: number;
        coinRedemptionRewardEtb: number;
        coinRedemptionMinCoins: number;
        coinCreditTarget: string;
      }>(res);
    }
  },

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

    async checkStatus(userId?: string) {
      const headers = { ...getAuthHeader() };
      const queryParam = userId ? `?userId=${encodeURIComponent(userId)}` : '';
      try {
        const res = await fetch(`${API_BASE}/auth/status${queryParam}`, { headers });
        if (!res.ok) {
          try {
            return await res.json();
          } catch {}
          return { success: false, error: `HTTP ${res.status}` };
        }
        return await res.json();
      } catch (err: any) {
        return { success: false, error: err.message };
      }
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
      paymentMethod: 'Telebirr' | 'CBE' | 'M-Pesa' | string;
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

    async getWithdrawalEligibility() {
      const res = await fetch(`${API_BASE}/wallet/withdrawal-eligibility`, {
        headers: { ...getAuthHeader() }
      });
      return handleResponse<{
        success: boolean;
        eligible: boolean;
        completedGames: number;
        requiredGames: number;
        todayWithdrawals: number;
        maxDailyWithdrawals: number;
        minAmount: number;
        maxAmount: number;
        reason?: string;
      }>(res);
    },

    async getMyWithdrawals() {
      const res = await fetch(`${API_BASE}/wallet/my-withdrawals`, {
        headers: { ...getAuthHeader() }
      });
      return handleResponse<{
        success: boolean;
        requests: any[];
      }>(res);
    },

    async cancelWithdrawal(requestId: string | number) {
      const res = await fetch(`${API_BASE}/wallet/cancel-withdrawal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify({ requestId })
      });
      return handleResponse<{
        success: boolean;
        message: string;
        newBalance: number;
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
          id: string;
          agentCode: string;
          displayName: string;
          phone: string;
          telebirrPhone: string;
          telebirrName?: string;
          cbeAccount: string;
          cbeName?: string;
          mpesaPhone: string | null;
          mpesaName?: string;
          supportedRails?: string[];
          isOnline: boolean;
          avgApprovalMinutes: number;
        }>;
      }>(res);
    },

    async depositViaAgent(payload: {
      agentId?: string;
      agentCode?: string;
      amount: number;
      paymentMethod: string;
      playerPhone: string;
      transactionCode: string;
      screenshotUrl?: string;
    }) {
      const res = await fetch(`${API_BASE}/wallet/deposit-via-agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(payload)
      });
      return handleResponse<{
        success: boolean;
        message: string;
        requestId: string;
        agentCode: string;
        agentDisplayName: string;
        status: string;
        estimatedWaitMinutes: number;
      }>(res);
    },

    async getMyAgentDeposits() {
      const res = await fetch(`${API_BASE}/wallet/my-agent-deposits`, {
        headers: { ...getAuthHeader() }
      });
      return handleResponse<{
        success: boolean;
        requests: Array<{
          id: string;
          amount: number;
          paymentMethod: string;
          transactionCode: string;
          status: 'pending' | 'approved' | 'rejected' | 'cancelled';
          rejectionReason?: string;
          createdAt: string;
          resolvedAt?: string;
          agentCode: string;
          agentDisplayName: string;
        }>;
      }>(res);
    },

    async withdrawViaAgent(payload: {
      agentId: string;
      amount: number;
      payoutMethod: 'Telebirr' | 'CBE' | 'CBEBirr' | 'M-Pesa' | string;
      payoutAccount: string;
      payoutAccountName?: string;
    }) {
      const res = await fetch(`${API_BASE}/wallet/withdraw-via-agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(payload)
      });
      return handleResponse<{
        success: boolean;
        message: string;
        request: {
          id: string;
          amount: number;
          payoutMethod: string;
          payoutAccount: string;
          agentCode: string;
          agentDisplayName: string;
          status: 'pending' | 'approved' | 'rejected' | 'cancelled';
          createdAt: string;
        };
        newBalance: number;
      }>(res);
    },

    async getMyAgentWithdrawals() {
      const res = await fetch(`${API_BASE}/wallet/my-agent-withdrawals`, {
        headers: { ...getAuthHeader() }
      });
      return handleResponse<{
        success: boolean;
        requests: Array<{
          id: string;
          amount: number;
          payoutMethod: string;
          payoutAccount: string;
          payoutAccountName?: string;
          agentTxRef?: string;
          status: 'pending' | 'approved' | 'rejected' | 'cancelled';
          rejectionReason?: string;
          createdAt: string;
          resolvedAt?: string;
          agentCode: string;
          agentDisplayName: string;
        }>;
      }>(res);
    },

    async cancelAgentWithdrawal(requestId: string) {
      const res = await fetch(`${API_BASE}/wallet/cancel-agent-withdrawal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ requestId })
      });
      return handleResponse<{
        success: boolean;
        message: string;
        newBalance: number;
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

    async getCashierLedger(params?: {
      timeframe?: 'today' | 'week' | 'month' | 'all';
      rail?: string;
      status?: string;
      type?: string;
      search?: string;
    }) {
      const adminHeaders = await getAdminAuthHeader();
      const query = new URLSearchParams();
      if (params?.timeframe) query.append('timeframe', params.timeframe);
      if (params?.rail && params.rail !== 'all') query.append('rail', params.rail);
      if (params?.status && params.status !== 'all') query.append('status', params.status);
      if (params?.type && params.type !== 'all') query.append('type', params.type);
      if (params?.search && params.search.trim()) query.append('search', params.search.trim());
      const qStr = query.toString() ? `?${query.toString()}` : '';

      const res = await fetch(`${API_BASE}/admin/cashier-ledger${qStr}`, {
        headers: { ...adminHeaders }
      });
      const data = await handleResponse<{
        success: boolean;
        stats: {
          todayDepositsAmount: number;
          todayDepositsCount: number;
          todayDepositsCommission: number;
          todayWithdrawalsAmount: number;
          todayWithdrawalsCount: number;
          todayWithdrawalsFee: number;
          agentFloatCirculation: number;
          totalCommissionDistributed: number;
        };
        transactions: any[];
      }>(res);

      if (data && Array.isArray(data.transactions)) {
        data.transactions = data.transactions.map((t: any) => ({
          ...t,
          receiptImage: t.receiptImage && t.receiptImage.startsWith('/')
            ? `${getBackendOrigin()}${t.receiptImage}`
            : t.receiptImage
        }));
      }
      return data;
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
          totalAgents?: number;
          totalAgentBalance?: number;
          activeAgentsCount?: number;
          weeklyRevenue?: { day: string; date: string; revenue: number }[];
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
      return handleResponse<{ success: boolean; data?: any; pools?: any[]; winners?: any[] }>(res);
    },

    async getJackpotOverview() {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/jackpots/overview`, {
        headers: { ...adminHeaders }
      });
      return handleResponse<{ success: boolean; data: any }>(res);
    },

    async getJackpotContributions(params: {
      period?: string;
      from?: string;
      to?: string;
      roomId?: string;
      page?: number;
      limit?: number;
    } = {}) {
      const adminHeaders = await getAdminAuthHeader();
      const queryParams = new URLSearchParams();
      if (params.period) queryParams.set('period', params.period);
      if (params.from) queryParams.set('from', params.from);
      if (params.to) queryParams.set('to', params.to);
      if (params.roomId) queryParams.set('roomId', params.roomId);
      if (params.page) queryParams.set('page', String(params.page));
      if (params.limit) queryParams.set('limit', String(params.limit));

      const res = await fetch(`${API_BASE}/admin/jackpots/contributions?${queryParams.toString()}`, {
        headers: { ...adminHeaders }
      });
      return handleResponse<{ success: boolean; data: any }>(res);
    },

    async getJackpotWinners(params: {
      roomId?: string;
      query?: string;
      page?: number;
      limit?: number;
    } = {}) {
      const adminHeaders = await getAdminAuthHeader();
      const queryParams = new URLSearchParams();
      if (params.roomId) queryParams.set('roomId', params.roomId);
      if (params.query) queryParams.set('query', params.query);
      if (params.page) queryParams.set('page', String(params.page));
      if (params.limit) queryParams.set('limit', String(params.limit));

      const res = await fetch(`${API_BASE}/admin/jackpots/winners?${queryParams.toString()}`, {
        headers: { ...adminHeaders }
      });
      return handleResponse<{ success: boolean; data: any }>(res);
    },

    async awardJackpot(payload: {
      roomId: string;
      winnerUserId?: string;
      roundId?: string;
      awardAmount?: number;
      notes?: string;
    }) {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/jackpots/award`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...adminHeaders },
        body: JSON.stringify(payload)
      });
      return handleResponse<{ success: boolean; message: string; data?: any; error?: string }>(res);
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

    // Bonus & Reward Management (Enqu Engine)
    rewards: {
      async getKpis() {
        const adminHeaders = await getAdminAuthHeader();
        const res = await fetch(`${API_BASE}/admin/rewards/kpis`, {
          headers: { ...adminHeaders }
        });
        return handleResponse<{ success: boolean; kpis: any }>(res);
      },
      async getSettings() {
        const adminHeaders = await getAdminAuthHeader();
        const res = await fetch(`${API_BASE}/admin/rewards/settings`, {
          headers: { ...adminHeaders }
        });
        return handleResponse<{ success: boolean; settings: any; auditLogs: any[] }>(res);
      },
      async saveSettings(payload: any) {
        const adminHeaders = await getAdminAuthHeader();
        const res = await fetch(`${API_BASE}/admin/rewards/settings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...adminHeaders },
          body: JSON.stringify(payload)
        });
        return handleResponse<{ success: boolean; message: string }>(res);
      },
      async getBonusWallets(params?: { page?: number; limit?: number; search?: string }) {
        const adminHeaders = await getAdminAuthHeader();
        const q = new URLSearchParams();
        if (params?.page) q.append('page', String(params.page));
        if (params?.limit) q.append('limit', String(params.limit));
        if (params?.search) q.append('search', params.search);
        const res = await fetch(`${API_BASE}/admin/rewards/bonus-wallets?${q.toString()}`, {
          headers: { ...adminHeaders }
        });
        return handleResponse<{ success: boolean; players: any[]; pagination: any }>(res);
      },
      async getTopCoinHolders() {
        const adminHeaders = await getAdminAuthHeader();
        const res = await fetch(`${API_BASE}/admin/rewards/top-coin-holders`, {
          headers: { ...adminHeaders }
        });
        return handleResponse<{ success: boolean; holders: any[] }>(res);
      },
      async getRedemptions() {
        const adminHeaders = await getAdminAuthHeader();
        const res = await fetch(`${API_BASE}/admin/rewards/redemptions`, {
          headers: { ...adminHeaders }
        });
        return handleResponse<{ success: boolean; redemptions: any[] }>(res);
      },
      async approveRedemption(id: string) {
        const adminHeaders = await getAdminAuthHeader();
        const res = await fetch(`${API_BASE}/admin/rewards/redemptions/${id}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...adminHeaders }
        });
        return handleResponse<{ success: boolean; message: string }>(res);
      },
      async rejectRedemption(id: string) {
        const adminHeaders = await getAdminAuthHeader();
        const res = await fetch(`${API_BASE}/admin/rewards/redemptions/${id}/reject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...adminHeaders }
        });
        return handleResponse<{ success: boolean; message: string }>(res);
      },
      async getWinners() {
        const adminHeaders = await getAdminAuthHeader();
        const res = await fetch(`${API_BASE}/admin/rewards/winners`, {
          headers: { ...adminHeaders }
        });
        return handleResponse<{ success: boolean; winners: any[] }>(res);
      },
      async payWinner(id: string) {
        const adminHeaders = await getAdminAuthHeader();
        const res = await fetch(`${API_BASE}/admin/rewards/winners/${id}/pay`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...adminHeaders }
        });
        return handleResponse<{ success: boolean; message: string }>(res);
      },
      async adjust(payload: { target: 'bonus' | 'coins'; type: string; userId: string; amount: number; reason?: string; note?: string }) {
        const adminHeaders = await getAdminAuthHeader();
        const res = await fetch(`${API_BASE}/admin/rewards/adjust`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...adminHeaders },
          body: JSON.stringify(payload)
        });
        return handleResponse<{ success: boolean; message: string; newBalance?: number; bonus?: number }>(res);
      }
    },

    // Decentralized Agents
    async getAgents() {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/agents`, {
        headers: { ...adminHeaders }
      });
      return handleResponse<{ success: boolean; agents: any[]; summary?: any }>(res);
    },

    async createAgent(payload: {
      fullName: string;
      phone: string;
      city?: string;
      initialDeposit?: number;
      targetMonthly?: number;
      targetPlayers?: number;
      commissionRate?: number;
      cashoutCommissionRate?: number;
      customCode?: string;
      initialFloat?: number;
      agentCode?: string;
      password?: string;
    }) {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/agents/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...adminHeaders },
        body: JSON.stringify({
          fullName: payload.fullName,
          phone: payload.phone,
          city: payload.city || 'Addis Ababa',
          initialDeposit: payload.initialDeposit ?? payload.initialFloat ?? 10000,
          targetMonthly: payload.targetMonthly ?? 50000,
          targetPlayers: payload.targetPlayers ?? 50,
          commissionRate: payload.commissionRate ?? 3,
          cashoutCommissionRate: payload.cashoutCommissionRate ?? 2,
          customCode: payload.customCode || payload.agentCode || undefined,
          password: payload.password
        })
      });
      return handleResponse<{ success: boolean; agent?: any; message?: string; error?: string }>(res);
    },

    async getAgentDetails(id: string) {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/agents/${id}/details`, {
        headers: { ...adminHeaders }
      });
      return handleResponse<{ success: boolean; agent: any; stats: any; players: any[]; recentTransactions: any[] }>(res);
    },

    async toggleAgentPortal(id: string, portalAccess: boolean) {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/agents/${id}/portal-toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...adminHeaders },
        body: JSON.stringify({ portalAccess })
      });
      return handleResponse<{ success: boolean; agent?: any; error?: string }>(res);
    },

    async updateAgent(id: string, payload: {
      fullName?: string;
      phone?: string;
      commissionRate?: number;
      targetMonthly?: number;
      lowBalanceThreshold?: number;
      walletBalance?: number;
      password?: string;
      status?: string;
    }) {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/agents/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...adminHeaders },
        body: JSON.stringify(payload)
      });
      return handleResponse<{ success: boolean; agent?: any; message?: string; error?: string }>(res);
    },

    async deleteAgent(id: string) {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/agents/${id}`, {
        method: 'DELETE',
        headers: { ...adminHeaders }
      });
      return handleResponse<{ success: boolean; message?: string; error?: string }>(res);
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
    async getAgentRechargeKPIs() {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/agent-recharges/kpis`, {
        headers: { ...adminHeaders }
      });
      return handleResponse<{
        success: boolean;
        kpis: {
          openRequests: { count: number; awaitingAmount: number };
          creditedToday: { count: number; totalAmount: number };
          lowBalanceAgents: { count: number };
        };
      }>(res);
    },

    async getAgentRechargeFlow() {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/agent-recharges/flow`, {
        headers: { ...adminHeaders }
      });
      return handleResponse<{
        success: boolean;
        flow: { step1: number; step2: number; step3: number; step4: number };
      }>(res);
    },

    async getAgentRechargeRequests(filter = 'Open') {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/agent-recharges/requests?filter=${encodeURIComponent(filter)}`, {
        headers: { ...adminHeaders }
      });
      return handleResponse<{
        success: boolean;
        requests: any[];
      }>(res);
    },

    async startAgentRechargeReview(id: string) {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/agent-recharges/${id}/start-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...adminHeaders }
      });
      return handleResponse<{ success: boolean; status: string; timeline: any[] }>(res);
    },

    async updateAgentRechargeChecklist(id: string, checklist: any, receivedAmount?: number) {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/agent-recharges/${id}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...adminHeaders },
        body: JSON.stringify({ checklist, receivedAmount })
      });
      return handleResponse<{ success: boolean }>(res);
    },

    async creditAgentRecharge(id: string) {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/agent-recharges/${id}/credit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...adminHeaders }
      });
      return handleResponse<{ success: boolean; status: string; message: string; timeline?: any[] }>(res);
    },

    async rejectAgentRecharge(id: string, reason: string, note?: string) {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/agent-recharges/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...adminHeaders },
        body: JSON.stringify({ reason, note })
      });
      return handleResponse<{ success: boolean; status: string; message: string; timeline?: any[] }>(res);
    },

    async getAgentRechargeHistory(params: { period?: string; from?: string; to?: string; search?: string; agent?: string } = {}) {
      const adminHeaders = await getAdminAuthHeader();
      const qs = new URLSearchParams();
      if (params.period) qs.set('period', params.period);
      if (params.from) qs.set('from', params.from);
      if (params.to) qs.set('to', params.to);
      if (params.search) qs.set('search', params.search);
      if (params.agent) qs.set('agent', params.agent);

      const res = await fetch(`${API_BASE}/admin/agent-recharges/history?${qs.toString()}`, {
        headers: { ...adminHeaders }
      });
      return handleResponse<{
        success: boolean;
        stats: {
          totalCredited: number;
          creditedCount: number;
          rejectedCount: number;
          averageRecharge: number;
          largestRecharge: number;
        };
        rows: any[];
      }>(res);
    },

    async getLowBalanceAgents() {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/agent-recharges/low-balance`, {
        headers: { ...adminHeaders }
      });
      return handleResponse<{
        success: boolean;
        agents: any[];
      }>(res);
    },

    async sendLowBalanceReminder(agentId: string) {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/agent-recharges/remind`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...adminHeaders },
        body: JSON.stringify({ agentId })
      });
      return handleResponse<{ success: boolean; message: string }>(res);
    },

    async getAgentRecharges(status?: string) {
      const adminHeaders = await getAdminAuthHeader();
      const qs = status ? `?status=${encodeURIComponent(status)}` : '';
      const res = await fetch(`${API_BASE}/admin/agents/recharges${qs}`, {
        headers: { ...adminHeaders }
      });
      return handleResponse<{ success: boolean; recharges: any[] }>(res);
    },

    // Agent Commission Payouts
    async getAgentPayouts(status?: string) {
      const adminHeaders = await getAdminAuthHeader();
      const qs = status ? `?status=${encodeURIComponent(status)}` : '';
      const res = await fetch(`${API_BASE}/admin/agents/payouts${qs}`, {
        headers: { ...adminHeaders }
      });
      return handleResponse<{
        success: boolean;
        pendingCount: number;
        summary: any;
        payouts: any[];
      }>(res);
    },

    async approveAgentPayout(id: string, data: { txRef?: string; notes?: string }) {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/agents/payouts/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...adminHeaders },
        body: JSON.stringify(data)
      });
      return handleResponse<{ success: boolean; message: string; payout: any }>(res);
    },

    async rejectAgentPayout(id: string, data: { reason?: string }) {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/agents/payouts/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...adminHeaders },
        body: JSON.stringify(data)
      });
      return handleResponse<{ success: boolean; message: string; payout: any }>(res);
    },

    // ----------------------------------------------------
    // ENQU AGENT COMMISSION PAYOUTS DESK (REAL NEON DB API)
    // ----------------------------------------------------
    async getAgentPayoutKPIs() {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/agent-payouts/kpis`, {
        headers: { ...adminHeaders }
      });
      return handleResponse<{
        success: boolean;
        kpis: {
          pendingPayouts: { count: number; heldAmount: number };
          paidThisMonth: { count: number; totalAmount: number };
          convertedToFloat: { count: number; totalAmount: number };
          commissionOwed: { totalOwed: number; available: number; held: number };
        };
      }>(res);
    },

    async getAgentPayoutFlow() {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/agent-payouts/flow`, {
        headers: { ...adminHeaders }
      });
      return handleResponse<{
        success: boolean;
        flow: { step1: number; step2: number; step3: number; step4: number };
      }>(res);
    },

    async getAgentPayoutRequests(filter = 'Open') {
      const adminHeaders = await getAdminAuthHeader();
      const qs = filter ? `?filter=${encodeURIComponent(filter)}` : '';
      const res = await fetch(`${API_BASE}/admin/agent-payouts/requests${qs}`, {
        headers: { ...adminHeaders }
      });
      return handleResponse<{ success: boolean; requests: any[] }>(res);
    },

    async startAgentPayoutReview(id: string) {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/agent-payouts/requests/${id}/start-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...adminHeaders }
      });
      return handleResponse<{ success: boolean; message: string }>(res);
    },

    async updateAgentPayoutChecklist(id: string, checklist: any) {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/agent-payouts/requests/${id}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...adminHeaders },
        body: JSON.stringify({ checklist })
      });
      return handleResponse<{ success: boolean }>(res);
    },

    async approveAgentPayoutEnqu(id: string, payoutTxRef: string, notes?: string) {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/agent-payouts/requests/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...adminHeaders },
        body: JSON.stringify({ payoutTxRef, notes })
      });
      return handleResponse<{ success: boolean; message: string; status: string }>(res);
    },

    async secondApproveAgentPayout(id: string, payoutTxRef: string, notes?: string) {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/agent-payouts/requests/${id}/second-approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...adminHeaders },
        body: JSON.stringify({ payoutTxRef, notes })
      });
      return handleResponse<{ success: boolean; message: string; status: string }>(res);
    },

    async rejectAgentPayoutEnqu(id: string, reason: string, note?: string) {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/agent-payouts/requests/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...adminHeaders },
        body: JSON.stringify({ reason, note })
      });
      return handleResponse<{ success: boolean; message: string; payout: any }>(res);
    },

    async getAgentPayoutHistory(params: {
      period?: string;
      from?: string;
      to?: string;
      search?: string;
      agent?: string;
      status?: string;
    } = {}) {
      const adminHeaders = await getAdminAuthHeader();
      const qs = new URLSearchParams();
      if (params.period) qs.set('period', params.period);
      if (params.from) qs.set('from', params.from);
      if (params.to) qs.set('to', params.to);
      if (params.search) qs.set('search', params.search);
      if (params.agent) qs.set('agent', params.agent);
      if (params.status) qs.set('status', params.status);

      const res = await fetch(`${API_BASE}/admin/agent-payouts/history?${qs.toString()}`, {
        headers: { ...adminHeaders }
      });
      return handleResponse<{
        success: boolean;
        stats: {
          totalPaid: number;
          paidCount: number;
          totalConverted: number;
          convertedCount: number;
          totalRejected: number;
          rejectedCount: number;
          averagePayout: number;
        };
        rows: any[];
      }>(res);
    },

    async getAgentCommissionBalances() {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/agent-payouts/commission-balances`, {
        headers: { ...adminHeaders }
      });
      return handleResponse<{
        success: boolean;
        agents: any[];
      }>(res);
    },

    // Network Health
    async getNetworkHealth() {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/network-health`, {
        headers: { ...adminHeaders }
      });
      return handleResponse<{ success: boolean; metrics: any }>(res);
    },

    // Official Platform Receiving Accounts Management (Enqu Luxury UI)
    async getOfficialAccounts() {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/official-accounts`, {
        headers: { ...adminHeaders }
      });
      return handleResponse<{ success: boolean; stats: any; accounts: any[] }>(res);
    },

    async getOfficialAccountAgents() {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/official-accounts/agents`, {
        headers: { ...adminHeaders }
      });
      return handleResponse<{ success: boolean; agents: Array<{ id: string; name: string; code?: string; city?: string }> }>(res);
    },

    async createOfficialAccount(payload: {
      provider: string;
      accountTitle?: string;
      accountName: string;
      accountNumber: string;
      agentId?: string | null;
      badge?: string;
      dailyLimit?: number;
      maxPerDeposit?: number;
      autoPauseAtDailyLimit?: boolean;
      displayOrder?: number;
    }) {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/official-accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...adminHeaders },
        body: JSON.stringify(payload)
      });
      return handleResponse<{ success: boolean; account: any; message?: string; error?: string }>(res);
    },

    async updateOfficialAccount(id: string, payload: any) {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/official-accounts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...adminHeaders },
        body: JSON.stringify(payload)
      });
      return handleResponse<{ success: boolean; account: any; message?: string; error?: string }>(res);
    },

    async toggleOfficialAccount(id: string) {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/official-accounts/${id}/toggle`, {
        method: 'PATCH',
        headers: { ...adminHeaders }
      });
      return handleResponse<{ success: boolean; account: any; message?: string; error?: string }>(res);
    },

    async toggleOfficialAccountAutoPause(id: string) {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/official-accounts/${id}/auto-pause`, {
        method: 'PATCH',
        headers: { ...adminHeaders }
      });
      return handleResponse<{ success: boolean; account: any; message?: string; error?: string }>(res);
    },

    async verifyOfficialAccount(id: string) {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/official-accounts/${id}/verify`, {
        method: 'PATCH',
        headers: { ...adminHeaders }
      });
      return handleResponse<{ success: boolean; account: any; message?: string; error?: string }>(res);
    },

    async setPrimaryOfficialAccount(id: string) {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/official-accounts/${id}/primary`, {
        method: 'PATCH',
        headers: { ...adminHeaders }
      });
      return handleResponse<{ success: boolean; account: any; message?: string; error?: string }>(res);
    },

    async deactivateOfficialAccount(id: string, reason: string) {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/official-accounts/${id}/deactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...adminHeaders },
        body: JSON.stringify({ reason })
      });
      return handleResponse<{ success: boolean; account: any; message?: string; error?: string }>(res);
    },

    async reactivateOfficialAccount(id: string) {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/official-accounts/${id}/reactivate`, {
        method: 'POST',
        headers: { ...adminHeaders }
      });
      return handleResponse<{ success: boolean; account: any; message?: string; error?: string }>(res);
    },

    async deleteOfficialAccount(id: string) {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/official-accounts/${id}`, {
        method: 'DELETE',
        headers: { ...adminHeaders }
      });
      return handleResponse<{ success: boolean; message?: string; error?: string }>(res);
    },

    // Cashflow Analytics & Executive Treasury Endpoints
    async getCashflowKPIs(params?: { period?: string; from?: string; to?: string }) {
      const q = new URLSearchParams();
      if (params?.period) q.set('period', params.period);
      if (params?.from) q.set('from', params.from);
      if (params?.to) q.set('to', params.to);
      const queryStr = q.toString() ? `?${q.toString()}` : '';
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/cashflow/kpis${queryStr}`, {
        headers: { ...adminHeaders }
      });
      return handleResponse<{
        success: boolean;
        period: { code: string; label: string; startIso: string; endIso: string };
        kpis: any;
      }>(res);
    },

    async getCashflowTrend(params?: { period?: string; from?: string; to?: string }) {
      const q = new URLSearchParams();
      if (params?.period) q.set('period', params.period);
      if (params?.from) q.set('from', params.from);
      if (params?.to) q.set('to', params.to);
      const queryStr = q.toString() ? `?${q.toString()}` : '';
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/cashflow/trend${queryStr}`, {
        headers: { ...adminHeaders }
      });
      return handleResponse<{
        success: boolean;
        buckets: Array<{
          date: string;
          label: string;
          inflow: number;
          outflow: number;
          net: number;
          ggr: number;
          pot: number;
        }>;
      }>(res);
    },

    async getCashflowStream(params?: {
      period?: string;
      from?: string;
      to?: string;
      flow?: string;
      category?: string;
      search?: string;
      page?: number;
      limit?: number;
    }) {
      const q = new URLSearchParams();
      if (params?.period) q.set('period', params.period);
      if (params?.from) q.set('from', params.from);
      if (params?.to) q.set('to', params.to);
      if (params?.flow) q.set('flow', params.flow);
      if (params?.category) q.set('category', params.category);
      if (params?.search) q.set('search', params.search);
      if (params?.page) q.set('page', String(params.page));
      if (params?.limit) q.set('limit', String(params.limit));
      const queryStr = q.toString() ? `?${q.toString()}` : '';
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/cashflow/stream${queryStr}`, {
        headers: { ...adminHeaders }
      });
      return handleResponse<{
        success: boolean;
        transactions: any[];
        pagination: { total: number; page: number; limit: number; totalPages: number };
      }>(res);
    },

    async getCashflowGamingBreakdown(params?: { period?: string; from?: string; to?: string }) {
      const q = new URLSearchParams();
      if (params?.period) q.set('period', params.period);
      if (params?.from) q.set('from', params.from);
      if (params?.to) q.set('to', params.to);
      const queryStr = q.toString() ? `?${q.toString()}` : '';
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/cashflow/gaming-breakdown${queryStr}`, {
        headers: { ...adminHeaders }
      });
      return handleResponse<{
        success: boolean;
        rooms: any[];
      }>(res);
    },

    async getCashflowTreasuryBalance() {
      const adminHeaders = await getAdminAuthHeader();
      const res = await fetch(`${API_BASE}/admin/cashflow/treasury-balance`, {
        headers: { ...adminHeaders }
      });
      return handleResponse<{
        success: boolean;
        balanceSheet: any;
      }>(res);
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

    async getDashboardAnalytics() {
      const res = await fetch(`${API_BASE}/agent/dashboard-analytics`, {
        headers: { ...getAgentAuthHeader() }
      });
      return handleResponse<{
        success: boolean;
        agent: {
          id: string;
          code: string;
          name: string;
          phone: string;
          city: string;
          type: string;
          referralLink: string;
        };
        wallet: {
          balance: number;
          lowThreshold: number;
          isLowBalance: boolean;
          openingBalanceToday: number;
          depositsMadeTodayCount: number;
          depositsMadeTodayVolume: number;
          commissionLast30Days: number;
          commissionRate: number;
        };
        kpis: {
          depositsTodayVolume: number;
          depositsTodayCount: number;
          totalPlayers: number;
          newPlayersLast30Days: number;
          pendingWithdrawalsCount: number;
          pendingDepositRequestsCount: number;
          commission30Days: number;
          pendingRechargeCommission: number;
          pendingRechargeCount: number;
        };
        charts: {
          daily: Array<{
            label: string;
            timeRange: string;
            volume: number;
            isCurrent: boolean;
          }>;
          weekly: Array<{
            dayKey: string;
            label: string;
            fullDate: string;
            volume: number;
            isCurrent: boolean;
          }>;
          monthly: Array<{
            dayKey: string;
            label: string;
            fullDate: string;
            volume: number;
            isCurrent: boolean;
          }>;
        };
        targets: {
          overallPercent: number;
          rank: number;
          totalAgents: number;
          items: Array<{
            label: string;
            current: number;
            target: number;
            text: string;
          }>;
        };
        recentDeposits: Array<{
          id: string;
          playerName: string;
          playerPhone: string;
          method: string;
          amount: number;
          reference: string;
          status: string;
          createdAt: string;
        }>;
        alerts: Array<{
          id: string;
          kind: 'w' | 'p' | 'm';
          title: string;
          body: string;
          time: string;
          unread: boolean;
        }>;
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
          status: string;
        }>;
      }>(res);
    },

    async depositForPlayer(payload: {
      playerId?: string;
      playerPhone?: string;
      username?: string;
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

    async getRecharges(timeframe?: string, status?: string) {
      const params = new URLSearchParams();
      if (timeframe && timeframe !== 'all') params.append('timeframe', timeframe);
      if (status && status !== 'all') params.append('status', status);
      const queryStr = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`${API_BASE}/agent/recharges${queryStr}`, {
        headers: { ...getAgentAuthHeader() }
      });
      return handleResponse<{
        success: boolean;
        wallet?: {
          balance: number;
          lowThreshold: number;
          commissionRate: number;
          openingBalanceToday: number;
          isLowBalance: boolean;
        };
        recharges: any[];
        analytics?: {
          totalApprovedAmount: number;
          totalApprovedCount: number;
          totalPendingAmount: number;
          totalPendingCount: number;
          totalRejectedAmount: number;
          totalRejectedCount: number;
          allTimeAmount: number;
          allTimeCount: number;
        };
      }>(res);
    },

    async getPlayers() {
      const res = await fetch(`${API_BASE}/agent/players`, {
        headers: { ...getAgentAuthHeader() }
      });
      return handleResponse<{
        success: boolean;
        referralLink?: string;
        commissionRate?: number;
        summary?: {
          totalPlayers: number;
          newPlayersLast30Days: number;
          activePlayers: number;
          inactivePlayers: number;
          waitingFirstDepositCount: number;
          depositsLast30DaysVolume: number;
          referralBonusEarned: number;
          bonusEarnedLast30Days: number;
          firstDepositsCount: number;
          conversion: {
            registered: number;
            madeFirstDeposit: number;
            activeNow: number;
          };
        };
        periods5Day?: Array<{
          periodIndex: number;
          label: string;
          count: number;
        }>;
        players: Array<{
          id: string;
          fullName: string;
          phone: string;
          username?: string;
          hasDeposited: boolean;
          balance: number;
          createdAt: string;
          joinDaysAgo: number;
          deposits: Array<{
            id: string;
            amount: number;
            paymentMethod: string;
            referenceCode: string;
            createdAt: string;
          }>;
          depositCount: number;
          totalDeposited: number;
          totalDepositedByAgent: number;
          firstDeposit?: {
            id: string;
            amount: number;
            paymentMethod: string;
            referenceCode: string;
            createdAt: string;
          } | null;
          lastDeposit?: {
            id: string;
            amount: number;
            paymentMethod: string;
            referenceCode: string;
            createdAt: string;
          } | null;
          bonusEarned: number;
          status: 'active' | 'inactive' | 'new' | 'awaiting_deposit';
        }>;
      }>(res);
    },

    async getTransactions() {
      const res = await fetch(`${API_BASE}/agent/transactions`, {
        headers: { ...getAgentAuthHeader() }
      });
      return handleResponse<{
        success: boolean;
        summary?: {
          totalCashIn: number;
          totalCashOut: number;
          totalCommission: number;
        };
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
    },

    // Agent Deposit Requests (Decentralized Player Deposit Flow)
    async getDepositRequests(status?: string, timeframe?: string, q?: string) {
      const params = new URLSearchParams();
      if (status && status !== 'all') params.append('status', status);
      if (timeframe && timeframe !== 'all') params.append('timeframe', timeframe);
      if (q && q.trim()) params.append('q', q.trim());
      const queryStr = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`${API_BASE}/agent/deposit-requests${queryStr}`, {
        headers: { ...getAgentAuthHeader() }
      });
      return handleResponse<{
        success: boolean;
        pendingCount: number;
        summary?: {
          walletBalance: number;
          lowBalanceThreshold: number;
          pendingSum: number;
          pendingCount: number;
          oldestWaitingMinutes: number;
          walletAfterAllPending: number;
          acceptedTodaySum: number;
          acceptedTodayCount: number;
          rejectedTodayCount: number;
          rejectedTodaySum: number;
        };
        analytics?: {
          today: { amount: number; count: number; commission: number };
          week: { amount: number; count: number; commission: number };
          month: { amount: number; count: number; commission: number };
          allTime: { amount: number; count: number; commission: number };
        };
        requests: Array<{
          id: string;
          amount: number;
          paymentMethod: string;
          playerPhone: string;
          playerName?: string;
          playerUsername?: string;
          transactionCode: string;
          screenshotUrl?: string;
          status: 'pending' | 'approved' | 'rejected';
          rejectionReason?: string;
          createdAt: string;
          resolvedAt?: string;
        }>;
      }>(res);
    },

    async getDepositHistory(period: 'daily' | 'weekly' | 'monthly' = 'daily') {
      const res = await fetch(`${API_BASE}/agent/deposit-requests/history?period=${period}`, {
        headers: { ...getAgentAuthHeader() }
      });
      return handleResponse<{
        success: boolean;
        period: 'daily' | 'weekly' | 'monthly';
        walletBalance: number;
        summary: {
          acceptedVolume: number;
          acceptedCount: number;
          rejectedCount: number;
          totalRequests: number;
          acceptanceRate: number;
        };
        buckets: Array<{
          index: number;
          label: string;
          shortLabel: string;
          acceptedVolume: number;
          acceptedCount: number;
          rejectedCount: number;
          totalRequests: number;
          acceptanceRate: number;
          rows: Array<{
            id: string;
            amount: number;
            paymentMethod: string;
            playerPhone: string;
            playerName?: string;
            playerUsername?: string;
            transactionCode: string;
            screenshotUrl?: string;
            status: 'approved' | 'rejected';
            rejectionReason?: string;
            createdAt: string;
            resolvedAt?: string;
          }>;
        }>;
      }>(res);
    },

    async approveDepositRequest(requestId: string) {
      const res = await fetch(`${API_BASE}/agent/deposit-requests/${requestId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAgentAuthHeader() }
      });
      return handleResponse<{
        success: boolean;
        message: string;
        details: {
          depositAmount: number;
          commissionEarned: number;
          newAgentBalance: number;
          coinsAwarded: number;
        };
      }>(res);
    },

    async rejectDepositRequest(requestId: string, reason: string) {
      const res = await fetch(`${API_BASE}/agent/deposit-requests/${requestId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAgentAuthHeader() },
        body: JSON.stringify({ reason })
      });
      return handleResponse<{
        success: boolean;
        message: string;
        rejectionReason: string;
      }>(res);
    },

    async toggleOnlineStatus(isOnline: boolean) {
      const res = await fetch(`${API_BASE}/agent/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAgentAuthHeader() },
        body: JSON.stringify({ isOnline })
      });
      return handleResponse<{
        success: boolean;
        agentCode: string;
        isOnline: boolean;
        message: string;
      }>(res);
    },

    async getWithdrawalRequests(timeframe?: string) {
      const queryStr = timeframe && timeframe !== 'all' ? `?timeframe=${encodeURIComponent(timeframe)}` : '';
      const res = await fetch(`${API_BASE}/agent/withdrawal-requests${queryStr}`, {
        headers: { ...getAgentAuthHeader() }
      });
      return handleResponse<{
        success: boolean;
        pendingCount: number;
        analytics?: {
          today: { amount: number; count: number; commission: number };
          week: { amount: number; count: number; commission: number };
          month: { amount: number; count: number; commission: number };
          allTime: { amount: number; count: number; commission: number };
        };
        requests: Array<{
          id: string;
          amount: number;
          payoutMethod: string;
          payoutAccount: string;
          payoutAccountName?: string;
          agentTxRef?: string;
          agentCommissionEarned: number;
          status: 'pending' | 'approved' | 'rejected' | 'cancelled';
          rejectionReason?: string;
          createdAt: string;
          resolvedAt?: string;
          playerId: string;
          playerName: string;
          playerPhone?: string;
          playerUsername?: string;
        }>;
      }>(res);
    },

    // Agent Configurable Payment Rails
    async getPaymentAccounts() {
      const res = await fetch(`${API_BASE}/agent/payment-accounts`, {
        headers: { ...getAgentAuthHeader() }
      });
      return handleResponse<{
        success: boolean;
        accounts: {
          telebirr: { accountNumber: string; accountName: string; isActive: boolean };
          cbe: { accountNumber: string; accountName: string; isActive: boolean };
          mpesa: { accountNumber: string; accountName: string; isActive: boolean };
        };
        supportedRails: string[];
      }>(res);
    },

    async updatePaymentAccounts(payload: {
      telebirr?: { accountNumber: string; accountName: string; isActive: boolean };
      cbe?: { accountNumber: string; accountName: string; isActive: boolean };
      mpesa?: { accountNumber: string; accountName: string; isActive: boolean };
    }) {
      const res = await fetch(`${API_BASE}/agent/payment-accounts`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAgentAuthHeader() },
        body: JSON.stringify(payload)
      });
      return handleResponse<{
        success: boolean;
        message?: string;
        error?: string;
        accounts: {
          telebirr: { accountNumber: string; accountName: string; isActive: boolean };
          cbe: { accountNumber: string; accountName: string; isActive: boolean };
          mpesa: { accountNumber: string; accountName: string; isActive: boolean };
        };
        supportedRails: string[];
      }>(res);
    },

    async approveWithdrawalRequest(requestId: string, agentTxRef: string) {
      const res = await fetch(`${API_BASE}/agent/withdrawal-requests/${requestId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAgentAuthHeader() },
        body: JSON.stringify({ agentTxRef })
      });
      return handleResponse<{
        success: boolean;
        message: string;
        details: {
          withdrawalAmount: number;
          commissionEarned: number;
          newAgentBalance: number;
          agentTxRef: string;
        };
      }>(res);
    },

    async rejectWithdrawalRequest(requestId: string, reason: string) {
      const res = await fetch(`${API_BASE}/agent/withdrawal-requests/${requestId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAgentAuthHeader() },
        body: JSON.stringify({ reason })
      });
      return handleResponse<{
        success: boolean;
        message: string;
        rejectionReason: string;
      }>(res);
    },

    async getCommissionOverview() {
      const res = await fetch(`${API_BASE}/agent/commission/overview`, {
        headers: { ...getAgentAuthHeader() }
      });
      return handleResponse<{
        success: boolean;
        commissionBalance: number;
        walletBalance: number;
        lifetimeEarned: number;
        commissionRate: number;
        earned30d: number;
        topUpCommission: number;
        referralBonus: number;
        pendingPayoutAmount: number;
        pendingPayoutCount: number;
        paidOutTotal: number;
        recentPayoutRequests: Array<{
          id: string;
          code: string;
          amount: number;
          payoutMethod: string;
          payoutAccount: string;
          accountName: string;
          status: 'Paid' | 'Under review' | 'Rejected' | 'Cancelled';
          payoutTxRef?: string | null;
          createdAt: string;
          settledAt?: string | null;
        }>;
        payoutRequests: Array<{
          id: string;
          code: string;
          amount: number;
          payoutMethod: string;
          payoutAccount: string;
          accountName: string;
          status: 'Paid' | 'Under review' | 'Rejected' | 'Cancelled';
          payoutTxRef?: string | null;
          createdAt: string;
          settledAt?: string | null;
        }>;
        earningsLedger: Array<{
          id: string;
          date: string;
          source: 'Top-up commission' | 'Referral bonus';
          rawSource: string;
          amount: number;
          commissionRate: number;
          commissionEarned: number;
          details: string;
        }>;
        weeklyChart: Array<{
          topUp: number;
          referral: number;
          total: number;
          label: string;
          title: string;
        }>;
        agentName?: string;
        agentPhone?: string;
      }>(res);
    },

    async convertCommissionToFloat(amount?: number) {
      const res = await fetch(`${API_BASE}/agent/commission/convert-to-float`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAgentAuthHeader() },
        body: JSON.stringify({ amount })
      });
      return handleResponse<{
        success: boolean;
        message: string;
        convertedAmount: number;
        newWalletBalance: number;
        newCommissionBalance: number;
      }>(res);
    },

    async requestCommissionCashout(payload: {
      amount: number;
      payoutMethod: 'Telebirr' | 'M-Pesa' | 'Bank transfer' | 'CBE' | 'CBEBirr' | string;
      payoutAccount: string;
      accountName?: string;
      payoutAccountName?: string;
    }) {
      const res = await fetch(`${API_BASE}/agent/commission/request-cashout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAgentAuthHeader() },
        body: JSON.stringify({
          amount: payload.amount,
          payoutMethod: payload.payoutMethod,
          payoutAccount: payload.payoutAccount,
          accountName: payload.accountName || payload.payoutAccountName
        })
      });
      return handleResponse<{
        success: boolean;
        message: string;
        payoutId: string;
        code?: string;
        amount: number;
        newCommissionBalance: number;
      }>(res);
    },

    async cancelCommissionCashout(payoutId: string) {
      const res = await fetch(`${API_BASE}/agent/commission/cancel-cashout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAgentAuthHeader() },
        body: JSON.stringify({ payoutId })
      });
      return handleResponse<{
        success: boolean;
        message: string;
        refundAmount: number;
        newCommissionBalance: number;
      }>(res);
    },

    async updatePin(payload: { currentPin: string; newPin: string }) {
      const res = await fetch(`${API_BASE}/agent/update-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAgentAuthHeader() },
        body: JSON.stringify(payload)
      });
      return handleResponse<{
        success: boolean;
        message?: string;
        error?: string;
      }>(res);
    },

    // Real-Time Official Platform Receiving Accounts (Only Active)
    async getOfficialAccounts() {
      const res = await fetch(`${API_BASE}/agent/official-accounts`, {
        headers: { ...getAgentAuthHeader() }
      });
      return handleResponse<{ success: boolean; accounts: any[] }>(res);
    }
  },

  // Dedicated Player Withdrawals Admin Portal
  withdrawalsAdmin: {
    async login(pin: string) {
      const res = await fetch(`${API_BASE}/withdrawals-admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      return handleResponse<{
        success: boolean;
        token: string;
        admin: { role: string; name: string };
      }>(res);
    },

    async getQueue(params?: { q?: string; method?: string; filter?: string }) {
      const qParams = new URLSearchParams();
      if (params?.q) qParams.set('q', params.q);
      if (params?.method) qParams.set('method', params.method);
      if (params?.filter) qParams.set('filter', params.filter);
      const queryStr = qParams.toString() ? `?${qParams.toString()}` : '';

      const res = await fetch(`${API_BASE}/withdrawals-admin/queue${queryStr}`, {
        headers: { ...getWithdrawalsAdminAuthHeader() }
      });
      return handleResponse<{
        success: boolean;
        queue: any[];
        kpis: {
          pendingCount: number;
          pendingAmount: number;
          longestWaitingMinutes: number;
          longestWaitingPlayer: string;
          approvedTodayCount: number;
          approvedTodayAmount: number;
          rejectedTodayCount: number;
          rejectedTodayAmount: number;
          needsAttentionCount: number;
          highValueCount: number;
        };
      }>(res);
    },

    async getHistory(params?: {
      period?: string;
      from?: string;
      to?: string;
      status?: string;
      method?: string;
      search?: string;
      page?: number;
      limit?: number;
    }) {
      const qParams = new URLSearchParams();
      if (params?.period) qParams.set('period', params.period);
      if (params?.from) qParams.set('from', params.from);
      if (params?.to) qParams.set('to', params.to);
      if (params?.status) qParams.set('status', params.status);
      if (params?.method) qParams.set('method', params.method);
      if (params?.search) qParams.set('search', params.search);
      if (params?.page !== undefined) qParams.set('page', String(params.page));
      if (params?.limit !== undefined) qParams.set('limit', String(params.limit));
      const queryStr = qParams.toString() ? `?${qParams.toString()}` : '';

      const res = await fetch(`${API_BASE}/withdrawals-admin/history${queryStr}`, {
        headers: { ...getWithdrawalsAdminAuthHeader() }
      });
      return handleResponse<{
        success: boolean;
        records: any[];
        total: number;
        page: number;
        limit: number;
        kpis: {
          requestedCount: number;
          requestedAmount: number;
          approvedCount: number;
          approvedAmount: number;
          rejectedCount: number;
          rejectedAmount: number;
          pendingCount: number;
          approvalRate: number;
          avgDecisionMinutes: number;
        };
        buckets: Array<{
          label: string;
          tooltip: string;
          approvedAmount: number;
          rejectedAmount: number;
          count: number;
        }>;
        grouping: string;
      }>(res);
    },

    async approve(id: string | number, payoutReference?: string, notes?: string) {
      const res = await fetch(`${API_BASE}/withdrawals-admin/${id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getWithdrawalsAdminAuthHeader()
        },
        body: JSON.stringify({ payoutReference, notes })
      });
      return handleResponse<{
        success: boolean;
        message: string;
        request: any;
      }>(res);
    },

    async reject(id: string | number, reason: string, adminNote?: string) {
      const res = await fetch(`${API_BASE}/withdrawals-admin/${id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getWithdrawalsAdminAuthHeader()
        },
        body: JSON.stringify({ reason, adminNote })
      });
      return handleResponse<{
        success: boolean;
        message: string;
        request: any;
      }>(res);
    },

    async getSettings() {
      const res = await fetch(`${API_BASE}/withdrawals-admin/settings`, {
        headers: { ...getWithdrawalsAdminAuthHeader() }
      });
      return handleResponse<{
        success: boolean;
        settings: {
          max_request_limit: number;
          high_value_threshold: number;
          min_request_limit: number;
          require_kyc_verification: boolean;
          require_turnover_met: boolean;
          strict_name_matching: boolean;
          telegram_player_alerts: boolean;
          auto_refresh_seconds: number;
          updated_at?: string;
        };
      }>(res);
    },

    async updateSettings(settings: Partial<{
      max_request_limit: number;
      high_value_threshold: number;
      min_request_limit: number;
      require_kyc_verification: boolean;
      require_turnover_met: boolean;
      strict_name_matching: boolean;
      telegram_player_alerts: boolean;
      auto_refresh_seconds: number;
    }>) {
      const res = await fetch(`${API_BASE}/withdrawals-admin/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getWithdrawalsAdminAuthHeader()
        },
        body: JSON.stringify(settings)
      });
      return handleResponse<{
        success: boolean;
        message: string;
        settings: any;
      }>(res);
    },

    async changePin(currentPin: string, newPin: string) {
      const res = await fetch(`${API_BASE}/withdrawals-admin/change-pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getWithdrawalsAdminAuthHeader()
        },
        body: JSON.stringify({ currentPin, newPin })
      });
      return handleResponse<{
        success: boolean;
        message: string;
      }>(res);
    }
  }
};
