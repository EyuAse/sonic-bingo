import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { apiClient } from '../services/apiClient.ts';
import '../styles/agent.css';

type AgentTab = 'overview' | 'cash_in' | 'cash_out' | 'recharge' | 'network';

interface AgentProfile {
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
}

interface AgentPerformance {
  totalPlayers: number;
  activePlayers: number;
  todayDeposited: number;
  monthDeposited: number;
  totalDepositedAllTime: number;
  targetMonthly: number;
  targetProgress: number;
  commissionRate: number;
  estimatedCommission: number;
}

export const AgentPortalPage: React.FC = () => {
  const { switchPage, showToast } = useApp();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<AgentTab>('overview');
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [metrics, setMetrics] = useState<AgentPerformance | null>(null);
  const [loading, setLoading] = useState(true);

  // Agent Login Form State (if not authenticated)
  const [isAgentLoggedIn, setIsAgentLoggedIn] = useState(false);
  const [loginPhone, setLoginPhone] = useState(user?.phone || '');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginCode, setLoginCode] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Cash-In Desk State
  const [playerSearchQuery, setPlayerSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null);
  const [depositAmount, setDepositAmount] = useState<number>(100);
  const [paymentMethod, setPaymentMethod] = useState<'Telebirr' | 'M-Pesa' | 'Cash'>('Telebirr');
  const [isProcessingDeposit, setIsProcessingDeposit] = useState(false);
  const [depositReceipt, setDepositReceipt] = useState<any | null>(null);

  // Cash-Out Desk State
  const [voucherCodeInput, setVoucherCodeInput] = useState('');
  const [verifiedVoucher, setVerifiedVoucher] = useState<any | null>(null);
  const [isVerifyingVoucher, setIsVerifyingVoucher] = useState(false);
  const [isRedeemingVoucher, setIsRedeemingVoucher] = useState(false);
  const [payoutReceipt, setPayoutReceipt] = useState<any | null>(null);

  // Float Recharge Desk State
  const [rechargeAmount, setRechargeAmount] = useState<number>(5000);
  const [rechargeMethod, setRechargeMethod] = useState<'Telebirr' | 'CBE' | 'M-Pesa'>('Telebirr');
  const [rechargeTxCode, setRechargeTxCode] = useState('');
  const [isSubmittingRecharge, setIsSubmittingRecharge] = useState(false);
  const [rechargeHistory, setRechargeHistory] = useState<any[]>([]);

  // Network & Statements State
  const [playersList, setPlayersList] = useState<any[]>([]);
  const [transactionsList, setTransactionsList] = useState<any[]>([]);

  // 1. Initial Load & Authentication Check
  const loadAgentData = async () => {
    try {
      setLoading(true);
      const [profileRes, perfRes] = await Promise.all([
        apiClient.agent.getProfile(),
        apiClient.agent.getPerformance()
      ]);

      if (profileRes.success && profileRes.profile) {
        setProfile(profileRes.profile);
        setIsAgentLoggedIn(true);
      }
      if (perfRes.success && perfRes.metrics) {
        setMetrics(perfRes.metrics);
      }
    } catch (err: any) {
      console.warn('Agent session not active:', err.message);
      setIsAgentLoggedIn(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const existingToken = localStorage.getItem('sonic_agent_token') || localStorage.getItem('sonic_auth_token');
    if (existingToken) {
      loadAgentData();
    } else {
      setLoading(false);
    }
  }, []);

  // 2. Agent Login Handler
  const handleAgentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginPhone.trim()) {
      showToast('❌ Please enter your phone number');
      return;
    }

    try {
      setIsLoggingIn(true);
      const res = await apiClient.agent.login({
        phone: loginPhone.trim(),
        password: loginPassword.trim() || undefined,
        agentCode: loginCode.trim() || undefined
      });

      if (res.success && res.token) {
        localStorage.setItem('sonic_agent_token', res.token);
        showToast(`🎉 Welcome Agent ${res.agent.agentCode}!`);
        setIsAgentLoggedIn(true);
        loadAgentData();
      }
    } catch (err: any) {
      showToast(`❌ ${err.message || 'Login failed'}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  // 3. Debounced Player Search for Cash-In
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (playerSearchQuery.trim().length >= 2) {
        try {
          const res = await apiClient.agent.searchPlayer(playerSearchQuery.trim());
          if (res.success) {
            setSearchResults(res.players);
          }
        } catch (err) {
          console.error('Player search error:', err);
        }
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [playerSearchQuery]);

  // 4. Execute Player Cash-In
  const handleProcessDeposit = async () => {
    if (!selectedPlayer) {
      showToast('❌ Please select a player first');
      return;
    }
    if (depositAmount < 50) {
      showToast('❌ Minimum deposit is 50 ETB');
      return;
    }
    if (profile && profile.walletBalance < depositAmount) {
      showToast(`❌ Insufficient agent float (${profile.walletBalance.toFixed(2)} ETB). Please recharge.`);
      return;
    }

    try {
      setIsProcessingDeposit(true);
      const res = await apiClient.agent.depositForPlayer({
        playerPhone: selectedPlayer.phone,
        amount: depositAmount,
        paymentMethod
      });

      if (res.success) {
        setDepositReceipt({
          refCode: res.referenceCode,
          playerName: res.playerName,
          playerPhone: res.playerPhone,
          amount: res.amount,
          coinsAwarded: Math.round(res.amount * 1.5),
          newFloat: res.newAgentBalance,
          date: new Date().toLocaleTimeString()
        });

        // Update local float
        if (profile) {
          setProfile({ ...profile, walletBalance: res.newAgentBalance });
        }
        showToast(`✅ Successfully credited ${depositAmount} ETB to ${selectedPlayer.fullName}`);
        setSelectedPlayer(null);
        setPlayerSearchQuery('');
        loadAgentData();
      }
    } catch (err: any) {
      showToast(`❌ ${err.message || 'Deposit failed'}`);
    } finally {
      setIsProcessingDeposit(false);
    }
  };

  // 5. Verify Cash-Out Voucher
  const handleVerifyVoucher = async () => {
    if (!voucherCodeInput.trim()) {
      showToast('❌ Please enter a voucher code');
      return;
    }

    try {
      setIsVerifyingVoucher(true);
      const res = await apiClient.agent.verifyCashoutVoucher(voucherCodeInput.trim());
      if (res.success && res.voucher) {
        setVerifiedVoucher(res.voucher);
        showToast('✅ Voucher verified! Ready for counter payout.');
      }
    } catch (err: any) {
      setVerifiedVoucher(null);
      showToast(`❌ ${err.message || 'Invalid voucher code'}`);
    } finally {
      setIsVerifyingVoucher(false);
    }
  };

  // 6. Redeem Cash-Out Voucher & Payout
  const handleRedeemVoucher = async () => {
    if (!verifiedVoucher) return;

    try {
      setIsRedeemingVoucher(true);
      const res = await apiClient.agent.redeemCashoutVoucher(verifiedVoucher.voucherCode);
      if (res.success) {
        setPayoutReceipt({
          refCode: res.referenceCode,
          voucherCode: res.voucherCode,
          playerName: res.playerName,
          playerPhone: res.playerPhone,
          amount: res.payoutAmount,
          commission: res.commissionEarned,
          newFloat: res.newAgentBalance,
          date: new Date().toLocaleTimeString()
        });

        // Update local float
        if (profile) {
          setProfile({ ...profile, walletBalance: res.newAgentBalance });
        }
        showToast(`🎉 Payout confirmed! Received +${res.commissionEarned} ETB commission.`);
        setVerifiedVoucher(null);
        setVoucherCodeInput('');
        loadAgentData();
      }
    } catch (err: any) {
      showToast(`❌ ${err.message || 'Voucher payout failed'}`);
    } finally {
      setIsRedeemingVoucher(false);
    }
  };

  // 7. Request Float Recharge
  const handleSubmitRecharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rechargeTxCode.trim()) {
      showToast('❌ Please enter the transaction reference code');
      return;
    }
    if (rechargeAmount < 1000) {
      showToast('❌ Minimum float recharge is 1,000 ETB');
      return;
    }

    try {
      setIsSubmittingRecharge(true);
      const res = await apiClient.agent.requestRecharge({
        amount: rechargeAmount,
        paymentMethod: rechargeMethod,
        transactionCode: rechargeTxCode.trim()
      });

      if (res.success) {
        showToast('✅ Recharge request submitted! Admin will approve shortly.');
        setRechargeTxCode('');
        fetchRecharges();
      }
    } catch (err: any) {
      showToast(`❌ ${err.message || 'Failed to submit recharge'}`);
    } finally {
      setIsSubmittingRecharge(false);
    }
  };

  // Fetch Recharges
  const fetchRecharges = async () => {
    try {
      const res = await apiClient.agent.getRecharges();
      if (res.success) setRechargeHistory(res.recharges);
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch Network & Statements
  const fetchNetworkData = async () => {
    try {
      const [pRes, tRes] = await Promise.all([
        apiClient.agent.getPlayers(),
        apiClient.agent.getTransactions()
      ]);
      if (pRes.success) setPlayersList(pRes.players);
      if (tRes.success) setTransactionsList(tRes.transactions);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (activeTab === 'recharge') fetchRecharges();
    if (activeTab === 'network') fetchNetworkData();
  }, [activeTab]);

  // If not logged in, render the Agent Auth Screen
  if (!isAgentLoggedIn) {
    return (
      <div className="agent-portal-root flex items-center justify-center p-4">
        <div className="agent-card max-w-md w-full">
          <div className="text-center mb-6">
            <div className="agent-brand-logo mx-auto mb-3">⚡</div>
            <h1 className="text-2xl font-black text-amber-400">ENQU AGENT PORTAL</h1>
            <p className="text-sm text-slate-400 mt-1">Decentralized Cash-In & Cash-Out Network</p>
          </div>

          <form onSubmit={handleAgentLogin}>
            <div className="agent-form-group">
              <label className="agent-form-label">Agent Phone Number</label>
              <input
                type="text"
                className="agent-input"
                placeholder="e.g. 0911223344"
                value={loginPhone}
                onChange={e => setLoginPhone(e.target.value)}
                required
              />
            </div>

            <div className="agent-form-group">
              <label className="agent-form-label">Password / Agent PIN</label>
              <input
                type="password"
                className="agent-input"
                placeholder="Enter PIN (e.g. 1234)"
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
              />
            </div>

            <div className="agent-form-group">
              <label className="agent-form-label">Agent Code (Optional)</label>
              <input
                type="text"
                className="agent-input"
                placeholder="e.g. AGT-1001"
                value={loginCode}
                onChange={e => setLoginCode(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="agent-btn-primary mt-4"
              disabled={isLoggingIn}
            >
              {isLoggingIn ? 'Verifying Credentials...' : '🔑 Access Agent Terminal'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-700 text-center">
            <button
              onClick={() => switchPage('games')}
              className="text-xs text-slate-400 hover:text-amber-400"
            >
              ← Return to Player Gaming App
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isLowFloat = profile ? profile.walletBalance <= profile.lowBalanceThreshold : false;

  return (
    <div className="agent-portal-root">
      {/* 1. Agent Sticky Header */}
      <header className="agent-header">
        <div className="agent-brand">
          <div className="agent-brand-logo">⚡</div>
          <div>
            <div className="agent-brand-title">ENQU AGENT TERMINAL</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="agent-code-badge">{profile?.agentCode || 'AGENT'}</span>
              <span className="text-xs text-slate-400 font-semibold">{profile?.fullName}</span>
            </div>
          </div>
        </div>

        <div className="agent-nav-actions">
          <button
            onClick={() => switchPage('games')}
            className="agent-btn-return"
          >
            🎮 Play Bingo
          </button>
          <button
            onClick={() => {
              localStorage.removeItem('sonic_agent_token');
              setIsAgentLoggedIn(false);
              showToast('Logged out of Agent Portal');
            }}
            className="agent-btn-return bg-red-950/60 text-red-300 hover:bg-red-900/60"
            title="Log out"
          >
            🚪
          </button>
        </div>
      </header>

      <div className="agent-portal-container">
        {/* 2. Low Float Alert Banner */}
        {isLowFloat && (
          <div className="agent-alert-banner">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <div className="font-extrabold text-red-200 text-sm sm:text-base">
                  LOW FLOAT ALERT: {profile?.walletBalance.toFixed(2)} ETB
                </div>
                <div className="text-xs text-red-300">
                  Your platform float is below 1,000 ETB threshold. Submit a recharge request to maintain cash-in capacity.
                </div>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('recharge')}
              className="bg-red-600 hover:bg-red-500 text-white font-bold text-xs px-3 py-2 rounded-lg whitespace-nowrap"
            >
              + Recharge Now
            </button>
          </div>
        )}

        {/* 3. Hero Float Balance Card */}
        <div className="agent-float-hero">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <span>PLATFORM FLOAT WALLET</span>
              <span className={`w-2 h-2 rounded-full ${isLowFloat ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
            </div>
            <div className="agent-float-amount mt-1">
              {profile ? profile.walletBalance.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'} ETB
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Initial Float: {profile?.initialDeposit.toLocaleString()} ETB | Low-Balance Threshold: {profile?.lowBalanceThreshold.toLocaleString()} ETB
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('cash_in')}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-4 py-3 rounded-xl text-sm flex items-center gap-2 shadow-lg"
            >
              📥 Cash-In
            </button>
            <button
              onClick={() => setActiveTab('cash_out')}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-4 py-3 rounded-xl text-sm flex items-center gap-2 shadow-lg"
            >
              📤 Cash-Out
            </button>
          </div>
        </div>

        {/* 4. Tab Navigation */}
        <div className="agent-tabs-nav">
          <button
            className={`agent-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            📊 Overview & KPIs
          </button>
          <button
            className={`agent-tab-btn ${activeTab === 'cash_in' ? 'active' : ''}`}
            onClick={() => setActiveTab('cash_in')}
          >
            📥 Cash-In (Deposit)
          </button>
          <button
            className={`agent-tab-btn ${activeTab === 'cash_out' ? 'active' : ''}`}
            onClick={() => setActiveTab('cash_out')}
          >
            📤 Cash-Out (Voucher)
          </button>
          <button
            className={`agent-tab-btn ${activeTab === 'recharge' ? 'active' : ''}`}
            onClick={() => setActiveTab('recharge')}
          >
            🔄 Float Recharge
          </button>
          <button
            className={`agent-tab-btn ${activeTab === 'network' ? 'active' : ''}`}
            onClick={() => setActiveTab('network')}
          >
            👥 Network & Ledger
          </button>
        </div>

        {/* 5. TAB 1: OVERVIEW & PERFORMANCE */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            {/* KPI 1: Today Volume */}
            <div className="agent-card">
              <div className="text-xs font-bold text-slate-400 uppercase">Today's Volume</div>
              <div className="text-2xl font-black text-amber-400 mt-2">
                {metrics?.todayDeposited.toLocaleString() || '0.00'} ETB
              </div>
              <div className="text-xs text-slate-500 mt-1">Processed today</div>
            </div>

            {/* KPI 2: Month Deposited */}
            <div className="agent-card">
              <div className="text-xs font-bold text-slate-400 uppercase">Month's Volume</div>
              <div className="text-2xl font-black text-emerald-400 mt-2">
                {metrics?.monthDeposited.toLocaleString() || '0.00'} ETB
              </div>
              <div className="text-xs text-slate-500 mt-1">This calendar month</div>
            </div>

            {/* KPI 3: Commission Earned */}
            <div className="agent-card">
              <div className="text-xs font-bold text-slate-400 uppercase">Estimated Commission ({metrics?.commissionRate || 5}%)</div>
              <div className="text-2xl font-black text-yellow-300 mt-2">
                {metrics?.estimatedCommission.toLocaleString() || '0.00'} ETB
              </div>
              <div className="text-xs text-slate-500 mt-1">Based on monthly volume</div>
            </div>

            {/* Monthly Target Progress Card */}
            <div className="agent-card md:col-span-2">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-slate-400 uppercase">Monthly Target Progress</span>
                <span className="text-xs font-extrabold text-amber-400">
                  {metrics?.monthDeposited.toLocaleString()} / {metrics?.targetMonthly.toLocaleString()} ETB ({metrics?.targetProgress || 0}%)
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-700">
                <div
                  className="bg-gradient-to-r from-amber-500 to-emerald-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, metrics?.targetProgress || 0)}%` }}
                ></div>
              </div>
              <p className="text-xs text-slate-400 mt-3">
                Achieve your monthly target to unlock higher commission tiers and bonus incentives.
              </p>
            </div>

            {/* Referral Link Card */}
            <div className="agent-card">
              <div className="text-xs font-bold text-slate-400 uppercase mb-2">Agent Referral Link</div>
              <div className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-amber-300 truncate font-mono">
                {profile?.inviteLink || `https://t.me/SonicGameOfficialBot?start=agent_${profile?.agentCode}`}
              </div>
              <button
                onClick={() => {
                  const link = profile?.inviteLink || `https://t.me/SonicGameOfficialBot?start=agent_${profile?.agentCode}`;
                  navigator.clipboard.writeText(link);
                  showToast('📋 Agent referral link copied!');
                }}
                className="w-full mt-3 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-400/30 rounded-lg py-2 text-xs font-bold"
              >
                Copy Player Invite Link
              </button>
            </div>
          </div>
        )}

        {/* 6. TAB 2: INSTANT CASH-IN (DEPOSIT FOR PLAYER) */}
        {activeTab === 'cash_in' && (
          <div className="agent-card max-w-xl mx-auto">
            <h2 className="text-lg font-black text-amber-400 mb-4 flex items-center gap-2">
              <span>📥</span> Instant Player Cash-In (Deposit)
            </h2>

            {/* Player Search Input */}
            <div className="agent-form-group">
              <label className="agent-form-label">Search Player by Phone or Name</label>
              <input
                type="text"
                className="agent-input"
                placeholder="Type 09... or player name"
                value={playerSearchQuery}
                onChange={e => setPlayerSearchQuery(e.target.value)}
              />

              {/* Search Results Dropdown */}
              {searchResults.length > 0 && !selectedPlayer && (
                <div className="bg-slate-900 border border-slate-700 rounded-lg mt-2 overflow-hidden shadow-2xl">
                  {searchResults.map(p => (
                    <div
                      key={p.id}
                      onClick={() => {
                        setSelectedPlayer(p);
                        setPlayerSearchQuery(`${p.fullName} (${p.phone})`);
                        setSearchResults([]);
                      }}
                      className="p-3 border-b border-slate-800 hover:bg-slate-800 cursor-pointer flex justify-between items-center"
                    >
                      <div>
                        <div className="font-bold text-slate-200 text-sm">{p.fullName}</div>
                        <div className="text-xs text-slate-400 font-mono">{p.phone}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-slate-400">Current Balance</div>
                        <div className="font-extrabold text-amber-400 text-sm">{p.balance.toFixed(2)} ETB</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Player Card */}
            {selectedPlayer && (
              <div className="bg-slate-900/80 border border-amber-500/40 rounded-xl p-3 mb-4 flex items-center justify-between">
                <div>
                  <span className="text-xs text-amber-400 font-bold uppercase">Target Player</span>
                  <div className="font-extrabold text-slate-100">{selectedPlayer.fullName}</div>
                  <div className="text-xs text-slate-400 font-mono">{selectedPlayer.phone}</div>
                </div>
                <button
                  onClick={() => {
                    setSelectedPlayer(null);
                    setPlayerSearchQuery('');
                  }}
                  className="text-xs text-red-400 hover:text-red-300 font-bold"
                >
                  Change
                </button>
              </div>
            )}

            {/* Amount Selection */}
            <div className="agent-form-group">
              <label className="agent-form-label">Deposit Amount (ETB)</label>
              <input
                type="number"
                min="50"
                step="10"
                className="agent-input text-xl font-black text-amber-400"
                value={depositAmount}
                onChange={e => setDepositAmount(parseFloat(e.target.value) || 0)}
              />

              <div className="agent-chips">
                {[50, 100, 200, 500, 1000, 2000].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setDepositAmount(amt)}
                    className={`agent-chip ${depositAmount === amt ? 'selected' : ''}`}
                  >
                    +{amt}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment Method Collected */}
            <div className="agent-form-group">
              <label className="agent-form-label">Payment Method Collected From Player</label>
              <div className="grid grid-cols-3 gap-2">
                {(['Telebirr', 'M-Pesa', 'Cash'] as const).map(method => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`p-3 rounded-lg border text-xs font-bold transition-all ${
                      paymentMethod === method
                        ? 'border-amber-400 bg-amber-400/20 text-amber-300'
                        : 'border-slate-700 bg-slate-900 text-slate-400'
                    }`}
                  >
                    {method === 'Telebirr' && '📱 Telebirr'}
                    {method === 'M-Pesa' && '📲 M-Pesa'}
                    {method === 'Cash' && '💵 Physical Cash'}
                  </button>
                ))}
              </div>
            </div>

            {/* Reward Summary Pill */}
            <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3 text-xs text-slate-300 space-y-1 mb-5">
              <div className="flex justify-between">
                <span>Deducted from Agent Float:</span>
                <span className="font-bold text-amber-400">-{depositAmount.toFixed(2)} ETB</span>
              </div>
              <div className="flex justify-between">
                <span>Credited to Player Cash Wallet:</span>
                <span className="font-bold text-emerald-400">+{depositAmount.toFixed(2)} ETB</span>
              </div>
              <div className="flex justify-between">
                <span>Player Loyalty Coins Earned (1.5x):</span>
                <span className="font-bold text-yellow-300">+{Math.round(depositAmount * 1.5)} 🪙 Coins</span>
              </div>
            </div>

            <button
              onClick={handleProcessDeposit}
              disabled={isProcessingDeposit || !selectedPlayer || depositAmount < 50}
              className="agent-btn-primary"
            >
              {isProcessingDeposit ? 'Processing...' : `⚡ Credit ${depositAmount} ETB to Player`}
            </button>
          </div>
        )}

        {/* 7. TAB 3: CASH-OUT VOUCHER REDEMPTION */}
        {activeTab === 'cash_out' && (
          <div className="agent-card max-w-xl mx-auto">
            <h2 className="text-lg font-black text-emerald-400 mb-4 flex items-center gap-2">
              <span>📤</span> Counter Cash-Out (Voucher Redemption)
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Enter the 6-character voucher code presented by the player to verify and disburse cash.
            </p>

            <div className="agent-form-group">
              <label className="agent-form-label">Player Withdrawal Voucher Code</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. CW-849201"
                  className="agent-input font-mono uppercase tracking-widest text-lg font-extrabold"
                  value={voucherCodeInput}
                  onChange={e => setVoucherCodeInput(e.target.value.toUpperCase())}
                />
                <button
                  onClick={handleVerifyVoucher}
                  disabled={isVerifyingVoucher || !voucherCodeInput.trim()}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 rounded-xl text-sm whitespace-nowrap"
                >
                  {isVerifyingVoucher ? '...' : 'Verify'}
                </button>
              </div>
            </div>

            {/* Verified Voucher Preview Card */}
            {verifiedVoucher && (
              <div className="bg-slate-900 border-2 border-emerald-500 rounded-xl p-4 my-4 space-y-3">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-emerald-400 uppercase">VERIFIED CASH-OUT VOUCHER</span>
                  <span className="font-mono text-xs bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded border border-emerald-800">
                    {verifiedVoucher.voucherCode}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-slate-400">Player Name:</div>
                    <div className="font-bold text-slate-100 text-sm">{verifiedVoucher.playerName}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Player Phone:</div>
                    <div className="font-mono font-bold text-slate-100 text-sm">{verifiedVoucher.playerPhone}</div>
                  </div>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg flex justify-between items-center">
                  <div>
                    <div className="text-xs text-slate-400">Cash to Hand Player:</div>
                    <div className="text-2xl font-black text-emerald-400">{verifiedVoucher.amount.toFixed(2)} ETB</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-amber-400 font-bold">+1.5% Agent Commission:</div>
                    <div className="text-sm font-extrabold text-amber-300">
                      +{(verifiedVoucher.amount * 0.015).toFixed(2)} ETB
                    </div>
                  </div>
                </div>

                <div className="text-xs text-slate-400 italic">
                  💡 By clicking confirm, you certify that you have handed {verifiedVoucher.amount.toFixed(2)} ETB cash to the player.
                  Your platform float will be credited by {(verifiedVoucher.amount * 1.015).toFixed(2)} ETB.
                </div>

                <button
                  onClick={handleRedeemVoucher}
                  disabled={isRedeemingVoucher}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3 rounded-xl text-base shadow-lg"
                >
                  {isRedeemingVoucher ? 'Processing...' : `💵 Confirm Hand Cash & Redeem (${verifiedVoucher.amount} ETB)`}
                </button>
              </div>
            )}
          </div>
        )}

        {/* 8. TAB 4: FLOAT RECHARGE */}
        {activeTab === 'recharge' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Recharge Request Form */}
            <div className="agent-card">
              <h2 className="text-lg font-black text-amber-400 mb-3 flex items-center gap-2">
                <span>🔄</span> Request Float Recharge
              </h2>
              <p className="text-xs text-slate-400 mb-4">
                Transfer funds to Admin accounts below, then submit your transaction reference code to replenish your platform float.
              </p>

              <form onSubmit={handleSubmitRecharge}>
                <div className="agent-form-group">
                  <label className="agent-form-label">Recharge Amount (Min 1,000 ETB)</label>
                  <input
                    type="number"
                    min="1000"
                    step="500"
                    className="agent-input font-bold text-amber-400"
                    value={rechargeAmount}
                    onChange={e => setRechargeAmount(parseFloat(e.target.value) || 0)}
                  />
                  <div className="agent-chips">
                    {[1000, 2000, 5000, 10000, 20000].map(amt => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setRechargeAmount(amt)}
                        className={`agent-chip ${rechargeAmount === amt ? 'selected' : ''}`}
                      >
                        {amt.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="agent-form-group">
                  <label className="agent-form-label">Payment Method</label>
                  <select
                    className="agent-input"
                    value={rechargeMethod}
                    onChange={e => setRechargeMethod(e.target.value as any)}
                  >
                    <option value="Telebirr">Telebirr</option>
                    <option value="CBE">CBE Birr / CBE Bank</option>
                    <option value="M-Pesa">M-Pesa</option>
                  </select>
                </div>

                <div className="agent-form-group">
                  <label className="agent-form-label">Transaction Reference Code</label>
                  <input
                    type="text"
                    className="agent-input font-mono"
                    placeholder="e.g. 7839482710"
                    value={rechargeTxCode}
                    onChange={e => setRechargeTxCode(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingRecharge || rechargeAmount < 1000}
                  className="agent-btn-primary"
                >
                  {isSubmittingRecharge ? 'Submitting...' : '🚀 Submit Float Recharge Request'}
                </button>
              </form>
            </div>

            {/* Admin Bank Details & Recharge History */}
            <div className="space-y-4">
              <div className="agent-card">
                <h3 className="text-sm font-bold text-slate-300 uppercase mb-3">Admin Deposit Accounts</h3>
                <div className="space-y-2 text-xs">
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-700 flex justify-between">
                    <div>
                      <span className="font-bold text-amber-400">Telebirr Super Agent</span>
                      <div className="text-slate-400 font-mono">0911 00 22 33</div>
                    </div>
                    <span className="text-slate-500 font-semibold">Enqu Gaming Platform</span>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-700 flex justify-between">
                    <div>
                      <span className="font-bold text-sky-400">CBE Commercial Bank</span>
                      <div className="text-slate-400 font-mono">1000 2345 6789 0</div>
                    </div>
                    <span className="text-slate-500 font-semibold">Enqu Tech Solutions</span>
                  </div>
                </div>
              </div>

              <div className="agent-card">
                <h3 className="text-sm font-bold text-slate-300 uppercase mb-3">Recent Recharge Requests</h3>
                {rechargeHistory.length === 0 ? (
                  <div className="text-xs text-slate-500 text-center py-4">No recent recharge requests</div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {rechargeHistory.map(r => (
                      <div key={r.id} className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 flex justify-between items-center text-xs">
                        <div>
                          <span className="font-bold text-slate-200">{parseFloat(r.amount).toLocaleString()} ETB</span>
                          <span className="text-slate-500 font-mono ml-2">({r.payment_method})</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                          r.status === 'approved' ? 'bg-emerald-900/60 text-emerald-300' :
                          r.status === 'rejected' ? 'bg-red-900/60 text-red-300' :
                          'bg-amber-900/60 text-amber-300'
                        }`}>
                          {r.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 9. TAB 5: NETWORK & STATEMENTS */}
        {activeTab === 'network' && (
          <div className="space-y-6">
            {/* Referred Players Table */}
            <div className="agent-card">
              <h3 className="text-sm font-bold text-amber-400 uppercase mb-3">
                👥 Registered Players Under Your Agency ({playersList.length})
              </h3>
              {playersList.length === 0 ? (
                <div className="text-xs text-slate-500 text-center py-6">
                  No players registered under your link yet. Share your link to start earning commissions!
                </div>
              ) : (
                <div className="agent-table-wrapper">
                  <table className="agent-table">
                    <thead>
                      <tr>
                        <th>Player Name</th>
                        <th>Phone</th>
                        <th>Active Balance</th>
                        <th>Total Deposited via You</th>
                        <th>Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {playersList.map(p => (
                        <tr key={p.id}>
                          <td className="font-bold text-slate-100">{p.fullName}</td>
                          <td className="font-mono text-slate-400">{p.phone}</td>
                          <td className="font-extrabold text-amber-400">{p.balance.toFixed(2)} ETB</td>
                          <td className="font-bold text-emerald-400">{p.totalDepositedByAgent.toFixed(2)} ETB</td>
                          <td className="text-slate-500 text-xs">{new Date(p.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Unified Transaction Ledger */}
            <div className="agent-card">
              <h3 className="text-sm font-bold text-emerald-400 uppercase mb-3">
                📜 Unified Cash-In & Cash-Out Ledger
              </h3>
              {transactionsList.length === 0 ? (
                <div className="text-xs text-slate-500 text-center py-6">No transactions recorded yet</div>
              ) : (
                <div className="agent-table-wrapper">
                  <table className="agent-table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Player</th>
                        <th>Amount</th>
                        <th>Method / Ref</th>
                        <th>Float Impact</th>
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactionsList.map(tx => (
                        <tr key={tx.id}>
                          <td>
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                              tx.type === 'cash_in'
                                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            }`}>
                              {tx.type === 'cash_in' ? '📥 Cash-In' : '📤 Cash-Out'}
                            </span>
                          </td>
                          <td className="font-semibold text-slate-200">
                            {tx.player_name}
                            <div className="text-[11px] text-slate-500 font-mono">{tx.player_phone}</div>
                          </td>
                          <td className="font-black text-slate-100">
                            {parseFloat(String(tx.amount)).toFixed(2)} ETB
                          </td>
                          <td className="text-slate-400 font-mono text-xs">
                            {tx.reference_code || tx.payment_method}
                          </td>
                          <td className="font-bold text-xs">
                            {tx.type === 'cash_in' ? (
                              <span className="text-amber-400">-{parseFloat(String(tx.amount)).toFixed(2)} ETB</span>
                            ) : (
                              <span className="text-emerald-400">
                                +{(parseFloat(String(tx.amount)) + parseFloat(String(tx.agent_commission_earned || '0'))).toFixed(2)} ETB
                              </span>
                            )}
                          </td>
                          <td className="text-slate-500 text-xs">
                            {new Date(tx.created_at).toLocaleTimeString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 10. MODAL: Cash-In Success Receipt */}
      {depositReceipt && (
        <div className="agent-receipt-overlay">
          <div className="agent-receipt-card">
            <div className="text-3xl mb-2">🎉</div>
            <h3 className="text-lg font-black text-amber-400">CASH-IN RECEIPT</h3>
            <div className="text-xs text-slate-400 font-mono mb-4">{depositReceipt.refCode}</div>

            <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs space-y-2 text-left mb-4">
              <div className="flex justify-between">
                <span className="text-slate-400">Player:</span>
                <span className="font-bold text-slate-100">{depositReceipt.playerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Phone:</span>
                <span className="font-mono text-slate-200">{depositReceipt.playerPhone}</span>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-1">
                <span className="text-slate-400">Amount Credited:</span>
                <span className="font-black text-emerald-400 text-sm">+{depositReceipt.amount.toFixed(2)} ETB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Coins Awarded:</span>
                <span className="font-bold text-yellow-300">+{depositReceipt.coinsAwarded} 🪙 Coins</span>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-1">
                <span className="text-slate-400">New Agent Float:</span>
                <span className="font-bold text-amber-400">{depositReceipt.newFloat.toFixed(2)} ETB</span>
              </div>
            </div>

            <button
              onClick={() => setDepositReceipt(null)}
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-2.5 rounded-lg text-sm"
            >
              Done & Close Receipt
            </button>
          </div>
        </div>
      )}

      {/* 11. MODAL: Cash-Out Success Receipt */}
      {payoutReceipt && (
        <div className="agent-receipt-overlay">
          <div className="agent-receipt-card border-emerald-500">
            <div className="text-3xl mb-2">💵</div>
            <h3 className="text-lg font-black text-emerald-400">CASH-OUT PAYOUT RECEIPT</h3>
            <div className="text-xs text-slate-400 font-mono mb-4">{payoutReceipt.refCode}</div>

            <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs space-y-2 text-left mb-4">
              <div className="flex justify-between">
                <span className="text-slate-400">Voucher Code:</span>
                <span className="font-mono font-bold text-emerald-300">{payoutReceipt.voucherCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Player:</span>
                <span className="font-bold text-slate-100">{payoutReceipt.playerName}</span>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-1">
                <span className="text-slate-400">Cash Paid to Player:</span>
                <span className="font-black text-emerald-400 text-sm">{payoutReceipt.amount.toFixed(2)} ETB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Agent Commission Earned:</span>
                <span className="font-bold text-amber-400">+{payoutReceipt.commission.toFixed(2)} ETB</span>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-1">
                <span className="text-slate-400">New Agent Float:</span>
                <span className="font-bold text-amber-400">{payoutReceipt.newFloat.toFixed(2)} ETB</span>
              </div>
            </div>

            <button
              onClick={() => setPayoutReceipt(null)}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-2.5 rounded-lg text-sm"
            >
              Done & Close Receipt
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
