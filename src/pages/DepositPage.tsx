import React, { useState, useEffect } from 'react';
import { useWallet } from '../context/WalletContext.tsx';
import { useApp } from '../context/AppContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useLanguage } from '../context/LanguageContext.tsx';
import { TelebirrLogo, MpesaLogo } from '../components/wallet/PaymentLogos.tsx';
import { LanguageDropdown } from '../components/common/LanguageDropdown.tsx';
import { apiClient } from '../services/apiClient.ts';
import { socketService } from '../services/socketService.ts';
import {
  SonicCrownLogo,
  GoldCoinsStackIcon,
  AgentAvatarIcon,
  GoldenRadioJewel,
  GoldenGiftBoxIcon,
  GoldBankColumnsIcon,
  LiquidGoldCornerSwoosh,
  GoldenCheckCircle,
  GoldenEscrowShieldIcon
} from '../components/deposit/DepositVisualIcons.tsx';
import '../styles/deposit_clone.css';

export interface DepositPageProps {
  initialTab?: 'deposit' | 'withdraw';
}

export const DepositPage: React.FC<DepositPageProps> = ({ initialTab = 'deposit' }) => {
  const { balance } = useWallet();
  const { switchPage, showToast } = useApp();
  const { user } = useAuth();
  const { t, lang } = useLanguage();

  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>(initialTab);
  const quickAmounts = [50, 100, 200, 500, 1000, 1500];

  // Active Authorized Agents for In-Person / Online Deposit & Cashout (Dynamic Multi-Rail)
  const [activeAgents, setActiveAgents] = useState<Array<{
    id: string;
    agentCode: string;
    displayName: string;
    phone: string | null;
    telebirrPhone: string | null;
    telebirrName?: string;
    mpesaPhone: string | null;
    mpesaName?: string;
    supportedRails?: string[];
    isOnline: boolean;
    avgApprovalMinutes: number;
  }>>([]);
  const [isLoadingAgents, setIsLoadingAgents] = useState<boolean>(true);
  const [agentLoadError, setAgentLoadError] = useState<string | null>(null);
  const [totalOnlineAgents, setTotalOnlineAgents] = useState<number>(0);
  const [isReRollingAgent, setIsReRollingAgent] = useState<boolean>(false);

  // Interactive Agent Deposit Flow State (Single Assigned Certified Cashier Agent)
  const [selectedAgent, setSelectedAgent] = useState<{
    id: string;
    agentCode: string;
    displayName: string;
    phone: string | null;
    telebirrPhone: string | null;
    telebirrName?: string;
    mpesaPhone: string | null;
    mpesaName?: string;
    supportedRails?: string[];
    isOnline: boolean;
    avgApprovalMinutes: number;
  } | null>(null);
  const [agentDepositAmount, setAgentDepositAmount] = useState<number>(100);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [agentPaymentRail, setAgentPaymentRail] = useState<'Telebirr' | 'M-Pesa'>('Telebirr');
  const [agentSenderPhone, setAgentSenderPhone] = useState<string>(() => user?.phone || user?.nationalPhone || '');
  const [agentTxRef, setAgentTxRef] = useState<string>('');
  const [agentReceiptImage, setAgentReceiptImage] = useState<string | null>(null);
  const [isSubmittingAgentDeposit, setIsSubmittingAgentDeposit] = useState<boolean>(false);
  const [activeAgentRequest, setActiveAgentRequest] = useState<any | null>(null);

  // --- Unified Agent Withdrawal State (P2P Decentralized Cashier) ---
  const [withdrawAmount, setWithdrawAmount] = useState<number>(200);
  const [withdrawMethod, setWithdrawMethod] = useState<'Telebirr' | 'M-Pesa'>('Telebirr');
  const [withdrawAccount, setWithdrawAccount] = useState<string>(() => {
    const attached = user?.attachedAccounts || [];
    const def = attached.find(a => a.type === 'Telebirr' && a.isDefault) || attached.find(a => a.type === 'Telebirr');
    return def?.accountNumber || user?.nationalPhone || user?.phone || '';
  });
  const [withdrawAccountName, setWithdrawAccountName] = useState<string>(() => user?.fullName || '');
  const [selectedWithdrawAgent, setSelectedWithdrawAgent] = useState<{
    id: string;
    agentCode: string;
    displayName: string;
    phone: string | null;
    telebirrPhone: string | null;
    telebirrName?: string;
    mpesaPhone: string | null;
    mpesaName?: string;
    supportedRails?: string[];
    isOnline: boolean;
    avgApprovalMinutes: number;
  } | null>(null);
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState<boolean>(false);
  const [activeWithdrawalRequest, setActiveWithdrawalRequest] = useState<any | null>(null);
  const [withdrawalEligibility, setWithdrawalEligibility] = useState<{
    eligible: boolean;
    completedGames: number;
    requiredGames: number;
    todayWithdrawals: number;
    maxDailyWithdrawals: number;
    reason?: string;
  } | null>(null);

  // Dynamic selection handlers ensuring rail compatibility (Telebirr & M-Pesa only)
  const handleSelectDepositAgent = (ag: any) => {
    setSelectedAgent(ag);
    const supported: string[] = ag.supportedRails && ag.supportedRails.length > 0
      ? ag.supportedRails.filter((r: string) => r !== 'CBE')
      : [
          ...(ag.telebirrPhone ? ['Telebirr'] : []),
          ...(ag.mpesaPhone ? ['M-Pesa'] : [])
        ];
    if (!supported.includes(agentPaymentRail)) {
      setAgentPaymentRail((supported[0] as 'Telebirr' | 'M-Pesa') || 'Telebirr');
    }
  };

  const handleSelectWithdrawAgent = (ag: any) => {
    setSelectedWithdrawAgent(ag);
    const supported: string[] = ag.supportedRails && ag.supportedRails.length > 0
      ? ag.supportedRails.filter((r: string) => r !== 'CBE')
      : [
          ...(ag.telebirrPhone ? ['Telebirr'] : []),
          ...(ag.mpesaPhone ? ['M-Pesa'] : [])
        ];
    if (!supported.includes(withdrawMethod)) {
      setWithdrawMethod((supported[0] as 'Telebirr' | 'M-Pesa') || 'Telebirr');
    }
  };

  // Load single assigned agent via fair damped weighted lottery with session persistence
  const loadAgentData = async (excludeAgentId?: string) => {
    setIsLoadingAgents(true);
    setAgentLoadError(null);

    // 1. Request assigned agent (respects preferred session agent or lottery exclusion)
    try {
      const preferredId = !excludeAgentId ? (sessionStorage.getItem('sonic_assigned_agent_id') || undefined) : undefined;
      const assignedRes = await apiClient.wallet.getAssignedAgent(excludeAgentId, preferredId);
      if (assignedRes && assignedRes.success && assignedRes.agent) {
        const ag = assignedRes.agent;
        setTotalOnlineAgents(assignedRes.totalOnlineAgents || 1);
        sessionStorage.setItem('sonic_assigned_agent_id', ag.id);
        setActiveAgents([ag as any]);
        handleSelectDepositAgent(ag);
        handleSelectWithdrawAgent(ag);
      } else {
        // Fallback to active agents list if assigned endpoint had 0 agents
        const agentsRes = await apiClient.wallet.getActiveAgents();
        if (agentsRes && agentsRes.success && Array.isArray(agentsRes.agents) && agentsRes.agents.length > 0) {
          setActiveAgents(agentsRes.agents);
          setTotalOnlineAgents(agentsRes.agents.length);
          sessionStorage.setItem('sonic_assigned_agent_id', agentsRes.agents[0].id);
          handleSelectDepositAgent(agentsRes.agents[0]);
          handleSelectWithdrawAgent(agentsRes.agents[0]);
        } else {
          setAgentLoadError(lang === 'am' ? 'በአሁኑ ሰዓት ንቁ ኤጀንት የለም' : 'No certified agents currently available');
        }
      }
    } catch (err: any) {
      console.warn('Failed to load assigned agent:', err);
      setAgentLoadError(lang === 'am' ? 'ኤጀንቶችን መጫን አልተቻለም። እንደገና ይሞክሩ።' : 'Failed to load active agents. Tap to retry.');
    } finally {
      setIsLoadingAgents(false);
    }

    // 2. Load pending deposit / withdrawal requests independently (requires auth)
    try {
      const [myReqsRes, myWithRes] = await Promise.allSettled([
        apiClient.wallet.getMyAgentDeposits(),
        apiClient.wallet.getMyWithdrawals().catch(() => apiClient.wallet.getMyAgentWithdrawals())
      ]);

      if (myReqsRes.status === 'fulfilled' && myReqsRes.value?.success && myReqsRes.value?.requests) {
        const pending = myReqsRes.value.requests.find(r => r.status === 'pending');
        if (pending) {
          setActiveAgentRequest(pending);
        }
      }

      if (myWithRes.status === 'fulfilled' && myWithRes.value?.success && myWithRes.value?.requests) {
        const pendingWith = myWithRes.value.requests.find(r => r.status === 'pending');
        if (pendingWith) {
          setActiveWithdrawalRequest(pendingWith);
        }
      }

      // 3. Load live player withdrawal eligibility
      apiClient.wallet.getWithdrawalEligibility().then(res => {
        if (res && res.success) {
          setWithdrawalEligibility(res);
        }
      }).catch(() => {});
    } catch (err) {
      console.warn('Failed to load player pending requests:', err);
    }
  };

  // 🔄 Handle Re-roll / Request Another Certified Agent
  const handleReRollAgent = async () => {
    if (isReRollingAgent || isLoadingAgents) return;
    try {
      setIsReRollingAgent(true);
      const currentId = selectedAgent?.id || selectedAgent?.agentCode;
      const res = await apiClient.wallet.getAssignedAgent(currentId);
      if (res && res.success && res.agent) {
        const newAg = res.agent;
        sessionStorage.setItem('sonic_assigned_agent_id', newAg.id);
        setActiveAgents([newAg as any]);
        handleSelectDepositAgent(newAg);
        handleSelectWithdrawAgent(newAg);
        setTotalOnlineAgents(res.totalOnlineAgents || 1);
        showToast(lang === 'am' ? `🔄 አዲስ ኤጀንት ተመድቧል፡ #${newAg.agentCode}` : `🔄 New agent assigned: #${newAg.agentCode}`);
      } else {
        showToast(lang === 'am' ? 'ሌላ ተረኛ ኤጀንት አልተገኘም' : 'No alternative online agents available');
      }
    } catch (err: any) {
      console.warn('Failed to switch agent:', err);
      showToast(lang === 'am' ? 'ኤጀንት መቀየር አልተሳካም' : 'Failed to switch agent');
    } finally {
      setIsReRollingAgent(false);
    }
  };

  useEffect(() => {
    loadAgentData();
  }, []);

  // Active 3-second heartbeat polling while an agent deposit or withdrawal request is pending
  // Guarantees real-time 0-3 second instant balance & status update without reopening the app
  useEffect(() => {
    const isPending = activeAgentRequest?.status === 'pending' || activeWithdrawalRequest?.status === 'pending';
    if (!isPending) return;

    const interval = setInterval(() => {
      loadAgentData();
      apiClient.wallet.getBalance().then(res => {
        if (res && res.success && typeof res.balance === 'number') {
          window.dispatchEvent(new CustomEvent('lb_wallet_updated', { detail: res }));
        }
      }).catch(() => null);
    }, 3000);

    return () => clearInterval(interval);
  }, [activeAgentRequest?.status, activeWithdrawalRequest?.status]);

  // Real-time WebSocket listener for instant deposit & withdrawal approval/rejection
  useEffect(() => {
    if (!user?.id) return;

    const unsubApproved = socketService.on(`user_${user.id}_deposit_approved`, (data: any) => {
      showToast(`🎉 ${lang === 'am' ? 'ተቀማጭዎ በኤጀንቱ ጸድቋል!' : 'Deposit Approved by Agent!'} +${data.amount} ETB`);
      setActiveAgentRequest({
        id: data.requestId,
        amount: data.amount,
        status: 'approved',
        agentCode: data.agentDisplayName,
        agentDisplayName: data.agentDisplayName,
        transactionCode: data.transactionCode,
        coinsAwarded: data.coinsEarned
      });
      // Immediately reflect new balance without waiting for network
      if (typeof data.newBalance === 'number') {
        window.dispatchEvent(new CustomEvent('lb_wallet_updated', { detail: { balance: data.newBalance } }));
      } else if (typeof data.amount === 'number') {
        window.dispatchEvent(new CustomEvent('lb_deposit_approved', { detail: { amount: data.amount } }));
      }
      apiClient.wallet.getBalance().then(res => {
        if (res.success) {
          window.dispatchEvent(new CustomEvent('lb_wallet_updated', { detail: res }));
        }
      }).catch(err => console.warn(err));
    });

    const unsubRejected = socketService.on(`user_${user.id}_deposit_rejected`, (data: any) => {
      showToast(`❌ ${lang === 'am' ? 'ተቀማጭዎ አልተሳካም' : 'Deposit Rejected'}: ${data.reason}`);
      setActiveAgentRequest((prev: any) => prev ? {
        ...prev,
        status: 'rejected',
        rejectionReason: data.reason
      } : null);
      apiClient.wallet.getBalance().then(res => {
        if (res.success) {
          window.dispatchEvent(new CustomEvent('lb_wallet_updated', { detail: res }));
        }
      }).catch(err => console.warn(err));
    });

    const unsubWithApproved = socketService.on(`user_${user.id}_withdrawal_approved`, (data: any) => {
      showToast(`🎉 ${lang === 'am' ? 'ገንዘብ ማውጣትዎ ተፈጽሟል!' : 'Withdrawal Paid by Agent!'} +${data.amount} ETB`);
      setActiveWithdrawalRequest({
        id: data.requestId,
        amount: data.amount,
        status: 'approved',
        agentTxRef: data.agentTxRef,
        agentDisplayName: data.agentDisplayName
      });
      if (typeof data.newBalance === 'number') {
        window.dispatchEvent(new CustomEvent('lb_wallet_updated', { detail: { balance: data.newBalance } }));
      }
      apiClient.wallet.getBalance().then(res => {
        if (res.success) {
          window.dispatchEvent(new CustomEvent('lb_wallet_updated', { detail: res }));
        }
      }).catch(err => console.warn(err));
    });

    const unsubWithRejected = socketService.on(`user_${user.id}_withdrawal_rejected`, (data: any) => {
      showToast(`❌ ${lang === 'am' ? 'የማውጣት ጥያቄ አልተሳካም' : 'Withdrawal Rejected'}: ${data.reason}`);
      setActiveWithdrawalRequest(null);
      if (typeof data.newBalance === 'number') {
        window.dispatchEvent(new CustomEvent('lb_wallet_updated', { detail: { balance: data.newBalance } }));
      }
      apiClient.wallet.getBalance().then(res => {
        if (res.success) {
          window.dispatchEvent(new CustomEvent('lb_wallet_updated', { detail: res }));
        }
      }).catch(err => console.warn(err));
    });

    const unsubBalance = socketService.on('user_balance_updated', (data: any) => {
      if (data?.userId === user.id) {
        apiClient.wallet.getBalance().then(res => {
          if (res.success) {
            window.dispatchEvent(new CustomEvent('lb_wallet_updated', { detail: res }));
          }
        }).catch(err => console.warn(err));
      }
    });

    return () => {
      unsubApproved();
      unsubRejected();
      unsubWithApproved();
      unsubWithRejected();
      unsubBalance();
    };
  }, [user?.id, lang]);

  // Auto-fill withdrawal account when method changes
  useEffect(() => {
    const attached = user?.attachedAccounts || [];
    const match = attached.find(a => a.type === withdrawMethod && a.isDefault) ||
                  attached.find(a => a.type === withdrawMethod);
    if (match) {
      setWithdrawAccount(match.accountNumber);
      if (match.name) setWithdrawAccountName(match.name);
    } else if (withdrawMethod === 'Telebirr' && (user?.nationalPhone || user?.phone)) {
      setWithdrawAccount(user.nationalPhone || user.phone);
      if (user.fullName) setWithdrawAccountName(user.fullName);
    } else if (withdrawMethod === 'M-Pesa' && (user?.nationalPhone || user?.phone)) {
      if (user?.phone?.startsWith('07') || user?.nationalPhone?.startsWith('07')) {
        setWithdrawAccount(user.nationalPhone || user.phone);
      }
      if (user.fullName) setWithdrawAccountName(user.fullName);
    }
  }, [withdrawMethod, user]);



  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    showToast(`📋 ${t('common.copied') || 'Copied'}: ${label}`);
    setTimeout(() => setCopiedText(null), 3000);
  };

  const handleAgentImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const rawResult = event.target?.result as string;
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              width = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.6);
          setAgentReceiptImage(compressed);
          showToast(lang === 'am' ? '📸 ደረሰኝ ተያይዟል' : '📸 Receipt screenshot attached');
        };
        img.src = rawResult;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAgentDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgent) {
      showToast(lang === 'am' ? '⚠️ እባክዎ ኤጀንት ይምረጡ' : '⚠️ Please select a certified agent');
      return;
    }
    if (agentDepositAmount < 50 || agentDepositAmount > 1500) {
      showToast(lang === 'am' ? '⚠️ የተቀማጭ መጠን ከ 50 እስከ 1,500 ብር መሆን አለበት' : '⚠️ Deposit amount must be between 50 and 1,500 ETB');
      return;
    }
    if (!agentTxRef.trim() || agentTxRef.trim().length < 4) {
      showToast(lang === 'am' ? '⚠️ እባክዎ የግብይት መለያ ቁጥር (SMS Code) ያስገቡ' : '⚠️ Please enter the SMS transaction reference code');
      return;
    }

    try {
      setIsSubmittingAgentDeposit(true);
      const res = await apiClient.wallet.depositViaAgent({
        agentId: selectedAgent.id,
        agentCode: selectedAgent.agentCode,
        amount: agentDepositAmount,
        paymentMethod: agentPaymentRail,
        playerPhone: agentSenderPhone.trim() || user?.phone || user?.nationalPhone || '',
        transactionCode: agentTxRef.trim(),
        screenshotUrl: agentReceiptImage || undefined
      });

      if (res.success) {
        showToast(`✅ ${res.message}`);
        setActiveAgentRequest({
          id: res.requestId,
          amount: agentDepositAmount,
          paymentMethod: agentPaymentRail,
          transactionCode: agentTxRef.trim().toUpperCase(),
          status: 'pending',
          agentCode: res.agentCode,
          agentDisplayName: res.agentDisplayName,
          createdAt: new Date().toISOString()
        });
      }
    } catch (err: any) {
      showToast(`❌ ${err.message || (lang === 'am' ? 'የተቀማጭ ጥያቄ አልተሳካም' : 'Failed to submit deposit request')}`);
    } finally {
      setIsSubmittingAgentDeposit(false);
    }
  };

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (withdrawAmount < 50 || withdrawAmount > 2000) {
      showToast(lang === 'am' ? '⚠️ የማውጣት መጠን በአንድ ግብይት ከ 50 እስከ 2,000 ብር መሆን አለበት' : '⚠️ Withdrawal amount must be between 50 and 2,000 ETB per transaction');
      return;
    }
    if (withdrawalEligibility && !withdrawalEligibility.eligible) {
      showToast(`⚠️ ${withdrawalEligibility.reason || (lang === 'am' ? 'የማውጣት መስፈርቱን አላሟሉም' : 'Withdrawal criteria not met')}`);
      return;
    }
    if (withdrawAmount > balance) {
      showToast(lang === 'am' ? '❌ በቂ ቀሪ ሂሳብ የለም' : '❌ Insufficient balance');
      return;
    }
    if (!withdrawAccount || withdrawAccount.trim().length < 5) {
      showToast(lang === 'am' ? '⚠️ እባክዎ ትክክለኛ የሂሳብ ቁጥር ያስገቡ' : '⚠️ Please enter a valid account number');
      return;
    }

    try {
      setIsSubmittingWithdraw(true);
      const res = await apiClient.wallet.withdraw({
        amount: withdrawAmount,
        paymentMethod: withdrawMethod,
        accountPhone: withdrawAccount.trim(),
        accountName: withdrawAccountName.trim()
      });

      if (res.success && res.withdrawal) {
        setActiveWithdrawalRequest(res.withdrawal);
        showToast(lang === 'am' ? '✅ የማውጣት ጥያቄ ቀርቧል! ካሺየር እስኪያጸድቅ ይጠብቁ' : '✅ Withdrawal submitted! Awaiting cashier approval');
      }
    } catch (err: any) {
      showToast(`❌ ${err.message || 'Withdrawal request failed'}`);
    } finally {
      setIsSubmittingWithdraw(false);
    }
  };

  const handleCancelWithdrawal = async (reqId: string) => {
    try {
      const res = await apiClient.wallet.cancelWithdrawal(reqId).catch(() => apiClient.wallet.cancelAgentWithdrawal(reqId));
      if (res.success) {
        setActiveWithdrawalRequest(null);
        showToast(lang === 'am' ? '✅ ጥያቄው ተሰርዟል! ገንዘቡ ተመልሷል' : '✅ Request cancelled! Escrow refunded to balance');
      }
    } catch (err: any) {
      showToast(`❌ ${err.message || 'Failed to cancel'}`);
    }
  };

  return (
    <div className="sonic-deposit-canvas" id="page-deposit">
      <div className="sonic-deposit-container">
        {/* 1. Exact Reference Top Nav Header */}
        <div className="sonic-top-nav-bar">
          <button
            type="button"
            className="sonic-nav-icon-btn"
            onClick={() => switchPage('wallet')}
            title="Close / Back to Wallet"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>

          <div className="sonic-brand-center-stack">
            <div className="sonic-brand-logo-row">
              <SonicCrownLogo size={34} />
              <span className="sonic-brand-name-text">
                <span>Sonic</span>
                <span className="sonic-brand-bingo-word">Bingo</span>
              </span>
            </div>
            <div className="sonic-brand-underline-glow"></div>
          </div>

          <div className="sonic-nav-right-actions">
            <button
              type="button"
              className="sonic-nav-icon-btn"
              onClick={() => setActiveTab(activeTab === 'deposit' ? 'withdraw' : 'deposit')}
              title="Switch Deposit / Withdraw"
            >
              <i className="fa-solid fa-chevron-down"></i>
            </button>
            <button
              type="button"
              className="sonic-nav-icon-btn"
              onClick={() => showToast('👑 Certified Sonic Agent Network')}
              title="Options"
            >
              <i className="fa-solid fa-ellipsis-vertical"></i>
            </button>
          </div>
        </div>

        {/* Quick Segmented Toggle */}
        <div style={{
          display: 'flex',
          background: '#e2e8f0',
          borderRadius: '14px',
          padding: '3px',
          marginBottom: '4px'
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('deposit')}
            style={{
              flex: 1,
              padding: '8px 12px',
              border: 'none',
              borderRadius: '11px',
              background: activeTab === 'deposit' ? '#ffffff' : 'transparent',
              color: activeTab === 'deposit' ? '#0f172a' : '#64748b',
              fontWeight: 800,
              fontSize: '12.5px',
              boxShadow: activeTab === 'deposit' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            📥 {lang === 'am' ? 'ገንዘብ አስገባ (Deposit)' : 'Deposit via Agent'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('withdraw')}
            style={{
              flex: 1,
              padding: '8px 12px',
              border: 'none',
              borderRadius: '11px',
              background: activeTab === 'withdraw' ? '#ffffff' : 'transparent',
              color: activeTab === 'withdraw' ? '#0f172a' : '#64748b',
              fontWeight: 800,
              fontSize: '12.5px',
              boxShadow: activeTab === 'withdraw' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            📤 {lang === 'am' ? 'ገንዘብ አውጣ (Withdraw)' : 'Withdraw via Agent'}
          </button>
        </div>

        {activeTab === 'deposit' && (
          <>
            {/* CASE A: ACTIVE / PENDING / APPROVED / REJECTED REQUEST TRACKER */}
            {activeAgentRequest ? (
              <div
                style={{
                  background: '#0f172a',
                  border: activeAgentRequest.status === 'approved'
                    ? '2px solid #10b981'
                    : activeAgentRequest.status === 'rejected'
                    ? '2px solid #ef4444'
                    : '2px solid #f59e0b',
                  borderRadius: '20px',
                  padding: '24px 20px',
                  textAlign: 'center',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
                  position: 'relative',
                  overflow: 'hidden',
                  color: '#f8fafc'
                }}
              >
                {/* Status Icon & Header */}
                <div style={{ marginBottom: '16px' }}>
                  {activeAgentRequest.status === 'approved' ? (
                    <div
                      style={{
                        width: '70px',
                        height: '70px',
                        margin: '0 auto 12px',
                        borderRadius: '50%',
                        background: '#10b981',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '32px',
                        color: '#ffffff'
                      }}
                    >
                      ✓
                    </div>
                  ) : activeAgentRequest.status === 'rejected' ? (
                    <div
                      style={{
                        width: '70px',
                        height: '70px',
                        margin: '0 auto 12px',
                        borderRadius: '50%',
                        background: '#ef4444',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '32px',
                        color: '#ffffff'
                      }}
                    >
                      ✕
                    </div>
                  ) : (
                    <div
                      style={{
                        width: '70px',
                        height: '70px',
                        margin: '0 auto 12px',
                        borderRadius: '50%',
                        border: '3px solid #f59e0b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '28px',
                        animation: 'pulse 1.8s infinite',
                        background: 'rgba(245, 158, 11, 0.15)'
                      }}
                    >
                      📡
                    </div>
                  )}

                  <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '6px' }}>
                    {activeAgentRequest.status === 'approved'
                      ? (lang === 'am' ? 'ተቀማጭዎ በተሳካ ሁኔታ ተረጋግጧል!' : 'Deposit Confirmed & Credited!')
                      : activeAgentRequest.status === 'rejected'
                      ? (lang === 'am' ? 'ተቀማጭዎ አልተሳካም' : 'Deposit Rejected')
                      : (lang === 'am' ? 'ኤጀንቱ ክፍያዎን በማረጋገጥ ላይ ነው...' : 'Sonic Agent is Verifying Payment...')}
                  </h3>
                  <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
                    {activeAgentRequest.status === 'approved'
                      ? (lang === 'am' ? 'ገንዘቡ ወደ ዋሌትዎ ገብቷል። መልካም ዕድል በጨዋታው!' : 'Funds have been credited to your wallet balance. Good luck!')
                      : activeAgentRequest.status === 'rejected'
                      ? (activeAgentRequest.rejectionReason || (lang === 'am' ? 'እባክዎ የግብይት መለያውን ወይም የላኩትን መጠን ትክክለኛነት ያረጋግጡ።' : 'Please check transaction ID or transfer amount.'))
                      : (lang === 'am' ? 'የተመረጡት ኤጀንት የቴሌብር/ባንክ ኤስኤምኤስ መልዕክት በማጣራት ላይ ናቸው። ጥቂት ሰከንዶች ይጠብቁ።' : 'The certified agent is matching your SMS reference. Please wait a moment.')}
                  </p>
                </div>

                {/* Details Breakdown */}
                <div
                  style={{
                    background: '#1e293b',
                    borderRadius: '12px',
                    padding: '14px',
                    marginBottom: '16px',
                    fontSize: '13px',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: '#94a3b8' }}>{lang === 'am' ? 'ኤጀንት' : 'Sonic Agent'}:</span>
                    <strong style={{ color: '#f8fafc' }}>👑 {activeAgentRequest.agentDisplayName || `Sonic Agent #${activeAgentRequest.agentCode || ''}`}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: '#94a3b8' }}>{lang === 'am' ? 'የተላከ መጠን' : 'Amount'}:</span>
                    <strong style={{ color: '#10b981', fontSize: '15px' }}>{activeAgentRequest.amount} ETB</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: '#94a3b8' }}>{lang === 'am' ? 'የግብይት መለያ (Tx ID)' : 'Tx Reference'}:</span>
                    <strong style={{ color: '#fbbf24', fontFamily: 'monospace' }}>{activeAgentRequest.transactionCode}</strong>
                  </div>
                  {activeAgentRequest.coinsAwarded && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid #334155' }}>
                      <span style={{ color: '#94a3b8' }}>{lang === 'am' ? 'የተሰጠ ቦነስ' : 'Sonic Coins'}:</span>
                      <strong style={{ color: '#f59e0b' }}>+{activeAgentRequest.coinsAwarded} 🪙</strong>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {activeAgentRequest.status === 'approved' ? (
                    <button
                      type="button"
                      onClick={() => setActiveAgentRequest(null)}
                      style={{
                        background: '#10b981',
                        color: '#ffffff',
                        border: 'none',
                        padding: '12px',
                        borderRadius: '10px',
                        fontSize: '14px',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      {lang === 'am' ? 'ጨርሻለሁ (ወደ መነሻ)' : 'Done / Return to Cashier'}
                    </button>
                  ) : activeAgentRequest.status === 'rejected' ? (
                    <button
                      type="button"
                      onClick={() => setActiveAgentRequest(null)}
                      style={{
                        background: '#ef4444',
                        color: '#ffffff',
                        border: 'none',
                        padding: '12px',
                        borderRadius: '10px',
                        fontSize: '14px',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      🔄 {lang === 'am' ? 'እንደገና ይሞክሩ' : 'Try Again / Submit New Request'}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => loadAgentData()}
                        style={{
                          background: '#334155',
                          border: '1px solid #475569',
                          color: '#f8fafc',
                          padding: '12px',
                          borderRadius: '10px',
                          fontSize: '13px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px'
                        }}
                      >
                        <i className="fa-solid fa-rotate"></i>
                        {lang === 'am' ? 'ሁኔታውን ያድሱ' : 'Refresh Status'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveAgentRequest(null)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#64748b',
                          fontSize: '12px',
                          cursor: 'pointer',
                          marginTop: '4px'
                        }}
                      >
                        {lang === 'am' ? 'ይቅር / አዲስ ፎርም ክፈት' : 'Cancel / Open New Form'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              /* CASE B: EXACT 100% REFERENCE CLONE INTERACTIVE DEPOSIT FORM */
              <form onSubmit={handleAgentDepositSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* 2. Top "Via Local Agent" Banner Card */}
                <div className="sonic-local-agent-banner-card">
                  <div className="sonic-local-agent-left">
                    <AgentAvatarIcon size={46} />
                    <div className="sonic-local-agent-info">
                      <h4>Via Local Agent</h4>
                      <p>Cash / Telebirr Instant</p>
                    </div>
                  </div>
                  <GoldenRadioJewel checked={true} size={26} />
                </div>

                {/* 3. Step 1: Header Row (Single Assigned Certified Cashier) */}
                <div className="sonic-step-header-row">
                  <div className="sonic-step-badge-pill">
                    <span className="sonic-step-number-circle">1</span>
                    <span className="sonic-step-label-text">
                      {lang === 'am' ? 'የተመደበ ህጋዊ ካሺየር' : 'Assigned Certified Cashier'}
                    </span>
                  </div>
                  {totalOnlineAgents > 1 && (
                    <button
                      type="button"
                      onClick={handleReRollAgent}
                      disabled={isReRollingAgent}
                      style={{
                        background: 'rgba(251, 191, 36, 0.12)',
                        border: '1px solid rgba(251, 191, 36, 0.35)',
                        borderRadius: '20px',
                        padding: '5px 12px',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        color: '#fbbf24',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s ease'
                      }}
                      title={lang === 'am' ? 'ሌላ የተረጋገጠ ኤጀንት ይጠይቁ' : 'Request another certified agent'}
                    >
                      <i className={`fa-solid fa-arrows-rotate ${isReRollingAgent ? 'fa-spin' : ''}`} style={{ fontSize: '11px' }}></i>
                      <span>{lang === 'am' ? 'ሌላ ኤጀንት ቀይር' : 'Change Agent'}</span>
                    </button>
                  )}
                </div>

                {/* 4. Single Assigned Certified Cashier Card */}
                <div className="sonic-agents-stack">
                  {isLoadingAgents ? (
                    <div className="sonic-agent-light-card" style={{ justifyContent: 'center', textAlign: 'center', color: '#64748b', padding: '24px 16px' }}>
                      <i className="fa-solid fa-circle-notch fa-spin" style={{ marginRight: '8px', color: '#0088cc', fontSize: '18px' }}></i>
                      <span style={{ fontSize: '13px', fontWeight: 600 }}>
                        {lang === 'am' ? 'ተረኛ ኤጀንት በመመደብ ላይ...' : 'Assigning online certified agent...'}
                      </span>
                    </div>
                  ) : !selectedAgent ? (
                    <div className="sonic-agent-light-card" style={{ flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '20px 16px', gap: '8px' }}>
                      <i className="fa-solid fa-user-clock" style={{ fontSize: '24px', color: '#94a3b8' }}></i>
                      <span style={{ fontSize: '13.5px', color: '#64748b', fontWeight: 600 }}>
                        {agentLoadError || (lang === 'am' ? 'በአሁኑ ሰዓት ንቁ ኤጀንት የለም' : 'No certified agents currently online.')}
                      </span>
                      <button
                        type="button"
                        onClick={() => loadAgentData()}
                        style={{ marginTop: '6px', padding: '6px 14px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', color: '#1e293b' }}
                      >
                        <i className="fa-solid fa-rotate-right" style={{ marginRight: '6px' }}></i> {lang === 'am' ? 'እንደገና ሞክር' : 'Retry'}
                      </button>
                    </div>
                  ) : (
                    <div className="sonic-agent-obsidian-card" style={{ cursor: 'default', position: 'relative', overflow: 'hidden' }}>
                      <div className="sonic-agent-card-left" style={{ gap: '14px' }}>
                        <div style={{ position: 'relative' }}>
                          <SonicCrownLogo size={42} />
                          <span style={{
                            position: 'absolute',
                            bottom: -2,
                            right: -2,
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            background: '#10b981',
                            border: '2px solid #0f1216',
                            boxShadow: '0 0 6px #10b981'
                          }}></span>
                        </div>
                        <div className="sonic-agent-card-details">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="sonic-agent-name-obsidian" style={{ fontSize: '15.5px' }}>
                              Sonic Agent #{selectedAgent.agentCode}
                            </span>
                            <span style={{
                              fontSize: '10px',
                              fontWeight: 800,
                              background: 'rgba(16, 185, 129, 0.2)',
                              color: '#34d399',
                              border: '1px solid rgba(16, 185, 129, 0.4)',
                              borderRadius: '6px',
                              padding: '1px 6px',
                              textTransform: 'uppercase',
                              letterSpacing: '0.4px'
                            }}>
                              {lang === 'am' ? 'የተመደበ' : 'ASSIGNED'}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                            <span style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <i className="fa-solid fa-bolt" style={{ color: '#fbbf24', fontSize: '10px' }}></i>
                              <span>{lang === 'am' ? '~2 ደቂቃ ፈጣን ማረጋገጫ' : '~2 Min Approval'}</span>
                            </span>
                            <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>
                            <span style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <i className="fa-solid fa-shield-halved" style={{ color: '#10b981', fontSize: '10px' }}></i>
                              <span>100% Escrow</span>
                            </span>
                          </div>

                          {/* Rails Tags (Telebirr & M-Pesa only) */}
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                            {(selectedAgent.supportedRails || ['Telebirr']).filter(r => r !== 'CBE').map((r: string) => (
                              <span key={r} style={{
                                fontSize: '10.5px',
                                background: r === 'Telebirr' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                                color: r === 'Telebirr' ? '#38bdf8' : '#4ade80',
                                border: `1px solid ${r === 'Telebirr' ? 'rgba(56, 189, 248, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontWeight: 700
                              }}>
                                {r}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="sonic-agent-card-right">
                        <span className="sonic-status-pill-emerald">
                          <span className="sonic-pulse-dot" style={{ width: 6, height: 6 }}></span>
                          Online
                        </span>
                      </div>

                      {/* Bottom Micro Banner */}
                      <div style={{
                        gridColumn: '1 / -1',
                        width: '100%',
                        marginTop: '10px',
                        paddingTop: '8px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '11px',
                        color: '#94a3b8'
                      }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="sonic-pulse-dot" style={{ width: 5, height: 5, background: '#10b981' }}></span>
                          {lang === 'am'
                            ? `ከ ${totalOnlineAgents} የተረጋገጡ ኤጀንቶች ውስጥ ለእርስዎ የተመደበ`
                            : `1 of ${totalOnlineAgents} verified agents assigned to your session`}
                        </span>
                      </div>

                      <LiquidGoldCornerSwoosh opacity={0.95} />
                    </div>
                  )}
                </div>

                {/* 5. Deposit Amount Card */}
                <div className="sonic-amount-card-shell">
                  <div className="sonic-amount-header-row">
                    <div className="sonic-amount-header-left">
                      <GoldCoinsStackIcon size={32} />
                      <div className="sonic-amount-titles">
                        <h4>Deposit Amount</h4>
                        <p>Choose an amount to deposit</p>
                      </div>
                    </div>
                    <span className="sonic-amount-min-tag">Min: 50 ETB</span>
                  </div>

                  {/* 3x2 Quick Amounts Grid */}
                  <div className="sonic-amount-chips-grid">
                    {[50, 100, 200, 500, 1000, 1500].map(amt => (
                      <button
                        key={amt}
                        type="button"
                        className={`sonic-amount-chip-btn ${agentDepositAmount === amt ? 'active' : ''}`}
                        onClick={() => setAgentDepositAmount(amt)}
                      >
                        {amt} ETB
                      </button>
                    ))}
                  </div>

                  {/* Large Custom Amount Input Box */}
                  <div className="sonic-amount-input-box">
                    <span className="sonic-currency-prefix">ETB</span>
                    <input
                      type="number"
                      min="50"
                      max="1500"
                      value={agentDepositAmount || ''}
                      onChange={e => setAgentDepositAmount(Number(e.target.value))}
                      className="sonic-amount-big-field"
                      placeholder="100"
                      required
                    />
                    <LiquidGoldCornerSwoosh opacity={0.6} />
                  </div>
                </div>

                {/* 6. +150 Sonic Coins Incentive Card */}
                <div className="sonic-coins-reward-card">
                  <div className="sonic-coins-reward-left">
                    <GoldenGiftBoxIcon size={32} />
                    <div className="sonic-coins-reward-titles">
                      <h5>+{Math.round((agentDepositAmount || 0) * 1.5)} Sonic Coins</h5>
                      <p>Will be awarded on successful deposit</p>
                    </div>
                  </div>
                  <span className="sonic-coins-reward-arrow">›</span>
                </div>

                {/* 7. Step 3: Transfer Payment to Agent (100% Real Dynamic Multi-Rail) */}
                <div className="sonic-step-badge-pill" style={{ alignSelf: 'flex-start' }}>
                  <span className="sonic-step-number-circle">3</span>
                  <span className="sonic-step-label-text">
                    {lang === 'am' ? 'ክፍያውን ለኤጀንቱ ያስተላልፉ' : 'Transfer Payment to Agent'}
                  </span>
                </div>

                {/* Check if agent has configured payment rails */}
                {(!selectedAgent?.supportedRails || selectedAgent.supportedRails.filter(r => r !== 'CBE').length === 0) ? (
                  <div className="sonic-agent-unconfigured-alert">
                    <i className="fa-solid fa-triangle-exclamation" style={{ color: '#d97706', fontSize: '22px', flexShrink: 0, marginTop: '2px' }}></i>
                    <div>
                      <strong>{lang === 'am' ? 'ይህ ኤጀንት የክፍያ መቀበያ ሂሳቦችን አላዘጋጀም' : 'Payment Accounts Not Configured'}</strong>
                      <p>
                        {lang === 'am'
                          ? `ኤጀንት #${selectedAgent?.agentCode || ''} ምንም የክፍያ መቀበያ ሂሳብ እስካሁን አላስመዘገበም። እባክዎ ከላይ ያለውን "ሌላ ኤጀንት ቀይር" የሚለውን በመጫን ሌላ ኤጀንት ይምረጡ።`
                          : `Sonic Agent #${selectedAgent?.agentCode || ''} has not set up active payment accounts yet. Please tap "Change Agent" above to switch.`}
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Dynamic Rails Selector: Telebirr & M-Pesa only */}
                    <div 
                      className="sonic-rails-selector-grid"
                      style={{ 
                        gridTemplateColumns: selectedAgent.supportedRails.filter(r => r !== 'CBE').length === 1 ? '1fr' : 'repeat(2, 1fr)' 
                      }}
                    >
                      {selectedAgent.supportedRails.filter(r => r !== 'CBE').map((rail) => {
                        const isRailActive = agentPaymentRail === rail;
                        const railAccount = rail === 'Telebirr' ? selectedAgent.telebirrPhone : selectedAgent.mpesaPhone;
                        return (
                          <div
                            key={rail}
                            className={isRailActive ? 'sonic-rail-obsidian-tab' : 'sonic-rail-light-tab'}
                            onClick={() => setAgentPaymentRail(rail as any)}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                              {rail === 'Telebirr' && <TelebirrLogo size={22} />}
                              {rail === 'M-Pesa' && <MpesaLogo size={22} />}
                              <div style={{ minWidth: 0 }}>
                                <div className={isRailActive ? 'sonic-rail-title-white' : 'sonic-rail-title-dark'}>
                                  {rail}
                                </div>
                                <div className={isRailActive ? 'sonic-rail-sub-gold' : 'sonic-rail-sub-muted'} style={{ fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {railAccount || ''}
                                </div>
                              </div>
                            </div>
                            {isRailActive ? (
                              <span style={{ color: '#f59e0b', fontSize: '16px', fontWeight: 900 }}>✓</span>
                            ) : (
                              <span style={{ color: '#94a3b8', fontSize: '14px' }}>›</span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Verified Agent Payment Details Card */}
                    {(() => {
                      const currentAccount = agentPaymentRail === 'Telebirr'
                        ? selectedAgent.telebirrPhone
                        : selectedAgent.mpesaPhone;

                      const currentName = agentPaymentRail === 'Telebirr'
                        ? (selectedAgent.telebirrName || selectedAgent.displayName)
                        : (selectedAgent.mpesaName || selectedAgent.displayName);

                      if (!currentAccount) return null;

                      return (
                        <div className="sonic-verified-payment-card">
                          <div className="sonic-verified-card-top">
                            <div className="sonic-verified-badge">
                              <i className="fa-solid fa-shield-halved"></i>
                              <span>{lang === 'am' ? 'የተረጋገጠ የኤጀንት ክፍያ መቀበያ' : 'Verified Agent Payment Account'}</span>
                            </div>
                            <span className="sonic-verified-rail-tag">
                              {agentPaymentRail}
                            </span>
                          </div>

                          <div className="sonic-verified-account-row">
                            <div className="sonic-verified-label">
                              {lang === 'am' ? 'የሂሳብ ባለቤት ስም (Account Holder Name)' : 'Account Holder Name'}
                            </div>
                            <div className="sonic-verified-name">
                              {currentName}
                            </div>
                          </div>

                          <div className="sonic-verified-account-box">
                            <div className="sonic-verified-num-wrap">
                              <span className="sonic-verified-num-label">
                                {agentPaymentRail === 'Telebirr' 
                                  ? (lang === 'am' ? 'የቴሌብር ስልክ ቁጥር' : 'Telebirr Phone') 
                                  : (lang === 'am' ? 'የኤም-ፔሳ ስልክ ቁጥር' : 'M-Pesa Phone')}
                              </span>
                              <span className="sonic-verified-number">
                                {currentAccount}
                              </span>
                            </div>
                            <button
                              type="button"
                              className="sonic-gold-copy-btn"
                              onClick={() => handleCopy(currentAccount, `${agentPaymentRail} Account`)}
                            >
                              <i className="fa-regular fa-copy"></i>
                              <span>{copiedText === currentAccount ? (lang === 'am' ? 'ተቀድቷል!' : 'Copied!') : (lang === 'am' ? 'ቅዳ' : 'Copy')}</span>
                            </button>
                          </div>

                          <div className="sonic-verified-instruction-banner">
                            <i className="fa-solid fa-circle-info"></i>
                            <span>
                              {lang === 'am'
                                ? `በትክክል ${agentDepositAmount} ETB ወደ "${currentName}" (${currentAccount}) ይላኩ፤ ከዚያም ከቴሌብር/ኤም-ፔሳ የደረሰዎትን የ SMS ማረጋገጫ ኮድ ከታች ያስገቡ።`
                                : `Transfer exactly ${agentDepositAmount} ETB to "${currentName}" (${currentAccount}), then submit your SMS confirmation reference code below.`}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}

                {/* 9. Step 4: Transaction Proof Form & Submit */}
                <div className="sonic-proof-card-shell">
                  <div className="sonic-step-badge-pill" style={{ alignSelf: 'flex-start', background: 'transparent', border: 'none', padding: 0 }}>
                    <span className="sonic-step-number-circle">4</span>
                    <span className="sonic-step-label-text">
                      {lang === 'am' ? 'የክፍያ ማረጋገጫ (SMS ID)' : 'Submit Transaction Proof'}
                    </span>
                  </div>

                  {/* Sending Phone */}
                  <div className="sonic-proof-input-group">
                    <label className="sonic-proof-label">
                      {lang === 'am' ? 'የላኩበት ስልክ ቁጥር' : 'Your Sending Phone Number'}
                    </label>
                    <div className="sonic-proof-field-wrap">
                      <i className="fa-solid fa-phone"></i>
                      <input
                        type="tel"
                        value={agentSenderPhone}
                        onChange={e => setAgentSenderPhone(e.target.value)}
                        placeholder="09... or 07..."
                        className="sonic-proof-text-input"
                        required
                      />
                    </div>
                  </div>

                  {/* SMS Reference ID */}
                  <div className="sonic-proof-input-group">
                    <label className="sonic-proof-label">
                      {lang === 'am' ? 'የኤስኤምኤስ ግብይት መለያ (SMS Tx ID)' : 'SMS Transaction Reference (Tx Ref)'}
                    </label>
                    <div className="sonic-proof-field-wrap">
                      <i className="fa-solid fa-receipt"></i>
                      <input
                        type="text"
                        value={agentTxRef}
                        onChange={e => setAgentTxRef(e.target.value)}
                        placeholder="e.g. TB-89214302 or FT24..."
                        className="sonic-proof-text-input"
                        required
                      />
                    </div>
                  </div>

                  {/* Screenshot Attachment */}
                  <input
                    type="file"
                    id="sonic-deposit-slip-input"
                    accept="image/*"
                    onChange={handleAgentImageUpload}
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="sonic-deposit-slip-input" className="sonic-upload-slip-btn">
                    <i className="fa-solid fa-camera"></i>
                    <span>
                      {agentReceiptImage
                        ? (lang === 'am' ? '📸 ደረሰኝ ተያይዟል (ለመቀየር ይጫኑ)' : '📸 Receipt Attached (Click to Change)')
                        : (lang === 'am' ? 'የክፍያ ደረሰኝ ስክሪንሾት አያይዝ (አማራጭ)' : 'Attach Receipt Screenshot (Optional)')}
                    </span>
                  </label>

                  {agentReceiptImage && (
                    <div style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '10px', overflow: 'hidden', border: '1px solid #f59e0b' }}>
                      <img src={agentReceiptImage} alt="Slip" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button
                        type="button"
                        onClick={() => setAgentReceiptImage(null)}
                        style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', fontSize: 11 }}
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Submit Deposit Button */}
                  <button
                    type="submit"
                    className="sonic-primary-gold-submit-btn"
                    disabled={isSubmittingAgentDeposit || !selectedAgent || (!selectedAgent.supportedRails || selectedAgent.supportedRails.length === 0)}
                  >
                    {isSubmittingAgentDeposit ? (
                      <>
                        <i className="fa-solid fa-spinner fa-spin"></i>
                        <span>{lang === 'am' ? 'በመላክ ላይ...' : 'Submitting to Agent...'}</span>
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-paper-plane"></i>
                        <span>
                          {lang === 'am'
                            ? `ተቀማጩን ለኤጀንት #${selectedAgent?.agentCode || ''} ላክ`
                            : `Submit Deposit to Sonic Agent #${selectedAgent?.agentCode || ''}`}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </>
        )}

      {/* TAB 2: WITHDRAW FUNDS VIA DECENTRALIZED AGENT */}
          {activeTab === 'withdraw' && (
            <div className="sonic-deposit-form-flow">
              {/* 1. Hero Withdrawable Balance Banner */}
              <div className="sonic-balance-hero-banner">
                <div className="sonic-balance-hero-left">
                  <GoldCoinsStackIcon size={38} />
                  <div className="sonic-balance-hero-text">
                    <span className="sonic-balance-hero-eyebrow">
                      {lang === 'am' ? 'የሚወጣ ቀሪ ሒሳብ' : 'Withdrawable Balance'}
                    </span>
                    <div className="sonic-balance-hero-val">
                      {balance.toFixed(2)}
                      <span className="sonic-balance-hero-curr">ETB</span>
                    </div>
                  </div>
                </div>
                <div className="sonic-fee-free-pill">
                  <i className="fa-solid fa-shield-halved"></i>
                  <span>{lang === 'am' ? '0% ክፍያ (ነፃ)' : '0% Fee (Free)'}</span>
                </div>
              </div>

              {activeWithdrawalRequest ? (
                /* CASE A: OBSIDIAN RADAR HUD FOR LIVE WITHDRAWAL TRACKING */
                <div className={`sonic-radar-hud-card ${
                  (activeWithdrawalRequest.status === 'completed' || activeWithdrawalRequest.status === 'approved')
                    ? 'completed'
                    : activeWithdrawalRequest.status === 'rejected'
                    ? 'rejected'
                    : ''
                }`}>
                  {/* Status Indicator Icon */}
                  <div className="sonic-radar-hud-icon-wrap">
                    {activeWithdrawalRequest.status === 'pending' ? (
                      <div className="sonic-radar-hud-pulse">
                        <i className="fa-solid fa-tower-broadcast"></i>
                      </div>
                    ) : (activeWithdrawalRequest.status === 'completed' || activeWithdrawalRequest.status === 'approved') ? (
                      <div
                        style={{
                          width: '80px',
                          height: '80px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '36px',
                          color: '#ffffff',
                          boxShadow: '0 0 25px rgba(16, 185, 129, 0.5)'
                        }}
                      >
                        ✓
                      </div>
                    ) : (
                      <div
                        style={{
                          width: '80px',
                          height: '80px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '36px',
                          color: '#ffffff',
                          boxShadow: '0 0 25px rgba(239, 68, 68, 0.5)'
                        }}
                      >
                        ✕
                      </div>
                    )}
                  </div>

                  <h3 style={{ fontSize: '18px', fontWeight: 900, marginBottom: '6px', color: '#f8fafc' }}>
                    {(activeWithdrawalRequest.status === 'completed' || activeWithdrawalRequest.status === 'approved')
                      ? (lang === 'am' ? 'ገንዘቡ በተሳካ ሁኔታ ተላልፏል!' : 'Withdrawal Paid Successfully!')
                      : activeWithdrawalRequest.status === 'rejected'
                      ? (lang === 'am' ? 'የማውጣት ጥያቄው አልተሳካም' : 'Withdrawal Request Rejected')
                      : (lang === 'am' ? 'ኤጀንቱ ክፍያውን በሞባይል እየላኩ ነው...' : 'Agent is Processing Mobile Payout...')}
                  </h3>

                  <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 18px 0', lineHeight: 1.5 }}>
                    {(activeWithdrawalRequest.status === 'completed' || activeWithdrawalRequest.status === 'approved')
                      ? (lang === 'am' ? 'ገንዘቡ በቀጥታ ወደ ሂሳብዎ ተላልፏል። እባክዎ የሞባይል ኤስኤምኤስዎን ይመልከቱ።' : 'Funds have been transferred to your account. Check your mobile SMS.')
                      : activeWithdrawalRequest.status === 'rejected'
                      ? (activeWithdrawalRequest.rejectionReason || (lang === 'am' ? 'ጥያቄው ተሰርዟል እና ገንዘብዎ ወደ ዋሌት ተመልሷል።' : 'Request was cancelled and funds have been refunded to your wallet.'))
                      : (lang === 'am' ? 'የተመረጡት ኤጀንት ጥያቄዎን ተቀብለው ክፍያውን በሞባይል ባንኪንግ እየፈጸሙ ነው። እባክዎ ለጥቂት ሰከንዶች ይጠብቁ።' : 'The selected agent is transferring your cash via mobile banking right now. Please wait a moment.')}
                  </p>

                  {/* Luxury Receipt Box */}
                  <div className="sonic-radar-receipt-box">
                    <div className="sonic-radar-receipt-row">
                      <span className="sonic-radar-receipt-label">{lang === 'am' ? 'ክፍያ ፈጻሚ ኤጀንት፡' : 'Processing Agent:'}</span>
                      <span className="sonic-radar-receipt-val" style={{ color: '#fef08a' }}>
                        👑 {activeWithdrawalRequest.agentDisplayName || `Sonic Agent #${activeWithdrawalRequest.agentCode || 'AGT'}`}
                      </span>
                    </div>

                    <div className="sonic-radar-receipt-row">
                      <span className="sonic-radar-receipt-label">{lang === 'am' ? 'የሚላክ መጠን፡' : 'Payout Amount:'}</span>
                      <span className="sonic-radar-receipt-val" style={{ color: '#10b981', fontSize: '16px' }}>
                        {activeWithdrawalRequest.amount} ETB
                      </span>
                    </div>

                    <div className="sonic-radar-receipt-row">
                      <span className="sonic-radar-receipt-label">{lang === 'am' ? 'የክፍያ መስመር፡' : 'Payout Rail:'}</span>
                      <span className="sonic-radar-receipt-val" style={{ color: '#38bdf8' }}>
                        {activeWithdrawalRequest.payoutMethod || 'Telebirr'}
                      </span>
                    </div>

                    <div className="sonic-radar-receipt-row">
                      <span className="sonic-radar-receipt-label">{lang === 'am' ? 'ተቀባይ ሂሳብ፡' : 'Payout Account:'}</span>
                      <span className="sonic-radar-receipt-val" style={{ fontFamily: 'monospace', color: '#fbbf24' }}>
                        {activeWithdrawalRequest.payoutAccount}
                      </span>
                    </div>

                    {activeWithdrawalRequest.agentTxRef && (
                      <div className="sonic-radar-receipt-row" style={{ paddingTop: '8px', borderTop: '1px solid #23314d', marginBottom: 0 }}>
                        <span className="sonic-radar-receipt-label">{lang === 'am' ? 'የኤጀንት ማረጋገጫ (Tx Ref)፡' : 'Agent Reference:'}</span>
                        <span className="sonic-radar-receipt-val" style={{ fontFamily: 'monospace', color: '#10b981' }}>
                          {activeWithdrawalRequest.agentTxRef}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {(activeWithdrawalRequest.status === 'completed' || activeWithdrawalRequest.status === 'approved') ? (
                    <button
                      type="button"
                      className="sonic-primary-gold-submit-btn"
                      onClick={() => setActiveWithdrawalRequest(null)}
                    >
                      <i className="fa-solid fa-circle-check"></i>
                      <span>{lang === 'am' ? 'ጨርሻለሁ (ወደ መነሻ)' : 'Done / Return to Cashier'}</span>
                    </button>
                  ) : activeWithdrawalRequest.status === 'rejected' ? (
                    <button
                      type="button"
                      className="sonic-primary-gold-submit-btn"
                      onClick={() => setActiveWithdrawalRequest(null)}
                      style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', color: '#ffffff' }}
                    >
                      <span>{lang === 'am' ? 'ይቅር / አዲስ ጥያቄ አቅርብ' : 'Dismiss / Submit New Request'}</span>
                    </button>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <button
                        type="button"
                        onClick={() => loadAgentData()}
                        style={{
                          width: '100%',
                          padding: '13px',
                          borderRadius: '14px',
                          background: '#1e293b',
                          border: '1px solid #334155',
                          color: '#f8fafc',
                          fontWeight: 800,
                          fontSize: '13.5px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px'
                        }}
                      >
                        <i className="fa-solid fa-rotate"></i>
                        <span>{lang === 'am' ? 'ሁኔታውን ያድሱ' : 'Refresh Status'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCancelWithdrawal(activeWithdrawalRequest.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#f43f5e',
                          fontSize: '12.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          padding: '8px'
                        }}
                      >
                        {lang === 'am' ? '❌ ጥያቄውን ሰርዝ (ገንዘቡ ወዲያው ይመለሳል)' : '❌ Cancel Request (Instant Refund to Wallet)'}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* CASE B: 100% DIRECT CENTRAL OFFICIAL CASHIER WITHDRAWAL FORM */
                <form onSubmit={handleWithdrawSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Official Central Cashier Desk Banner */}
                  <div style={{
                    background: 'linear-gradient(135deg, #181b20, #0f1216)',
                    borderRadius: '16px',
                    padding: '14px 16px',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.2)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        background: 'rgba(245, 158, 11, 0.15)',
                        border: '1px solid rgba(245, 158, 11, 0.4)',
                        display: 'grid',
                        placeItems: 'center',
                        color: '#fbbf24',
                        fontSize: '16px'
                      }}>
                        <i className="fa-solid fa-building-columns"></i>
                      </div>
                      <div>
                        <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#f8fafc' }}>
                          {lang === 'am' ? 'ኦፊሴላዊ የክፍያ ማዕከል' : 'Official Payout Cashier'}
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '2px' }}>
                          {lang === 'am' ? 'ቀጥታ ክፍያ በቴሌብር ወይም ሳፋሪኮም ኤም-ፔሳ (እስከ 2,000 ብር)' : 'Direct payouts to Telebirr & Safaricom M-Pesa (Max 2,000 ETB)'}
                        </div>
                      </div>
                    </div>
                    <span style={{
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: '#34d399',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: '20px',
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <span className="sonic-pulse-dot" style={{ width: 6, height: 6, background: '#10b981' }}></span>
                      {lang === 'am' ? 'ክፍት ነው' : 'Live Desk'}
                    </span>
                  </div>

                  {/* 🛡️ Responsible Gaming & Anti-Fraud Compliance Card */}
                  {withdrawalEligibility && (
                    <div
                      style={{
                        background: withdrawalEligibility.eligible ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                        border: `1px solid ${withdrawalEligibility.eligible ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.35)'}`,
                        borderRadius: '16px',
                        padding: '12px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '16px' }}>{withdrawalEligibility.eligible ? '🛡️' : '🔒'}</span>
                          <strong style={{ fontSize: '13px', color: withdrawalEligibility.eligible ? '#34d399' : '#fbbf24' }}>
                            {withdrawalEligibility.eligible
                              ? (lang === 'am' ? 'የማውጣት መስፈርቶች ተሟልተዋል' : 'Withdrawal Criteria Verified')
                              : (lang === 'am' ? 'የማውጣት መስፈርት አልተሟላም' : 'Withdrawal Criteria Locked')}
                          </strong>
                        </div>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '8px',
                            background: withdrawalEligibility.eligible ? '#10b981' : '#f59e0b',
                            color: '#fff'
                          }}
                        >
                          {withdrawalEligibility.eligible ? (lang === 'am' ? 'ተፈቅዷል' : 'ELIGIBLE') : (lang === 'am' ? 'የተቆለፈ' : 'LOCKED')}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11.5px' }}>
                        <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '6px 8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ color: '#94a3b8', marginBottom: '2px' }}>{lang === 'am' ? 'የተጠናቀቁ ጨዋታዎች' : 'Completed Games'}</div>
                          <strong style={{ color: withdrawalEligibility.completedGames >= 5 ? '#34d399' : '#fbbf24', fontSize: '12.5px' }}>
                            {withdrawalEligibility.completedGames} / 5 {withdrawalEligibility.completedGames >= 5 ? '✓' : ''}
                          </strong>
                        </div>
                        <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '6px 8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ color: '#94a3b8', marginBottom: '2px' }}>{lang === 'am' ? 'የዛሬ ወጪዎች' : "Today's Withdrawals"}</div>
                          <strong style={{ color: withdrawalEligibility.todayWithdrawals < 3 ? '#34d399' : '#f43f5e', fontSize: '12.5px' }}>
                            {withdrawalEligibility.todayWithdrawals} / 3 {withdrawalEligibility.todayWithdrawals < 3 ? '✓' : ''}
                          </strong>
                        </div>
                      </div>

                      {!withdrawalEligibility.eligible && (
                        <p style={{ margin: 0, fontSize: '11px', color: '#f59e0b', lineHeight: 1.4 }}>
                          {withdrawalEligibility.completedGames < 5
                            ? (lang === 'am'
                                ? `⚠️ ገንዘብ ለማውጣት ቢያንስ 5 ጨዋታዎችን ማጠናቀቅ አለብዎት (ያጠናቀቁት፡ ${withdrawalEligibility.completedGames}/5 ጨዋታ)።`
                                : `⚠️ You must complete at least 5 games before requesting a withdrawal (Completed: ${withdrawalEligibility.completedGames}/5 games).`)
                            : (lang === 'am'
                                ? '⚠️ የቀን ገደብ ደርሷል፡ በቀን ቢበዛ 3 ጊዜ ብቻ ማውጣት ይቻላል። እባክዎ ነገ እንደገና ይሞክሩ።'
                                : '⚠️ Maximum 3 withdrawals allowed per day. Please try again tomorrow.')}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Step 1: Withdrawal Amount Card (Harmonized with Deposit Shell) */}
                  <div className="sonic-amount-card-shell">
                    <div className="sonic-amount-header-row">
                      <div className="sonic-amount-header-left">
                        <GoldCoinsStackIcon size={28} />
                        <div className="sonic-amount-titles">
                          <h4>{lang === 'am' ? 'የማውጣት መጠን' : 'Withdrawal Amount'}</h4>
                          <p>{lang === 'am' ? 'የሚወጣውን መጠን ይምረጡ' : 'Choose an amount to withdraw'}</p>
                        </div>
                      </div>
                      <span className="sonic-amount-min-tag">
                        {lang === 'am' ? 'ዝቅተኛ፡ 50 • ከፍተኛ፡ 2,000 ብር' : 'Min: 50 • Max: 2,000 ETB'}
                      </span>
                    </div>

                    {/* 3x2 Quick Chips Grid */}
                    <div className="sonic-amount-chips-grid">
                      {[50, 100, 200, 500, 1000, 2000].map(amt => (
                        <button
                          key={amt}
                          type="button"
                          className={`sonic-amount-chip-btn ${withdrawAmount === amt ? 'active' : ''}`}
                          onClick={() => setWithdrawAmount(amt)}
                        >
                          {amt} ETB
                        </button>
                      ))}
                      <button
                        type="button"
                        className={`sonic-amount-chip-btn ${withdrawAmount === Math.min(2000, Math.floor(balance)) && balance >= 50 ? 'active' : ''}`}
                        onClick={() => setWithdrawAmount(Math.min(2000, Math.floor(balance)))}
                        style={{ fontWeight: 900 }}
                      >
                        {lang === 'am' ? 'ሁሉንም (እስከ 2,000)' : '★ Max (Up to 2,000)'}
                      </button>
                    </div>

                    {/* Large ETB Currency Input */}
                    <div className="sonic-amount-input-box">
                      <span className="sonic-currency-label">ETB</span>
                      <input
                        type="number"
                        value={withdrawAmount || ''}
                        onChange={e => setWithdrawAmount(Number(e.target.value))}
                        className="sonic-amount-big-field"
                        placeholder="200"
                        min={50}
                        max={2000}
                        required
                      />
                      <div className="sonic-input-gold-swoosh"></div>
                    </div>
                  </div>

                  {/* Golden Escrow & Net Payout Guarantee Card */}
                  <div className="sonic-coins-reward-card">
                    <div className="sonic-coins-reward-left">
                      <GoldenEscrowShieldIcon size={36} />
                      <div className="sonic-coins-reward-titles">
                        <h5>
                          {lang === 'am'
                            ? `የተጣራ ክፍያ፡ ${withdrawAmount || 0} ብር (100% ነፃ)`
                            : `Net Payout: ${withdrawAmount || 0} ETB (0% Player Fee)`}
                        </h5>
                        <p>
                          {lang === 'am'
                            ? '🛡️ ገንዘብዎ በደህና Escrow ውስጥ ይቆያል፤ ኤጀንቱ እስኪልክ ድረስ ሙሉ ጥበቃ አለው።'
                            : '🛡️ Funds held safely in atomic escrow until confirmed. 1-click instant refund.'}
                        </p>
                      </div>
                    </div>
                    <span className="sonic-coins-reward-arrow">›</span>
                  </div>

                  {/* Step 3: Destination Payout Rail & Account */}
                  <div className="sonic-step-header-row">
                    <div className="sonic-step-badge-pill">
                      <span className="sonic-step-number-circle">3</span>
                      <span className="sonic-step-label-text">
                        {lang === 'am' ? 'የክፍያ መቀበያ መስመር እና ሂሳብ' : 'Destination Payout Rail & Account'}
                      </span>
                    </div>
                  </div>

                  {/* Rails Selector Grid (Telebirr & M-Pesa only) */}
                  <div className="sonic-rails-selector-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                    {/* Telebirr Tab */}
                    <div
                      className={withdrawMethod === 'Telebirr' ? 'sonic-rail-obsidian-tab' : 'sonic-rail-light-tab'}
                      onClick={() => setWithdrawMethod('Telebirr')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <TelebirrLogo size={28} />
                        <div>
                          <div className={withdrawMethod === 'Telebirr' ? 'sonic-rail-title-white' : 'sonic-rail-title-dark'}>
                            Telebirr
                          </div>
                          <div className={withdrawMethod === 'Telebirr' ? 'sonic-rail-sub-gold' : 'sonic-rail-sub-muted'}>
                            ⚡ Instant
                          </div>
                        </div>
                      </div>
                      {withdrawMethod === 'Telebirr' ? (
                        <div className="sonic-amber-circle-chevron" style={{ width: 22, height: 22, fontSize: 13 }}>›</div>
                      ) : (
                        <i className="fa-solid fa-chevron-right" style={{ color: '#cbd5e1', fontSize: '11px' }}></i>
                      )}
                    </div>

                    {/* M-Pesa Tab */}
                    <div
                      className={withdrawMethod === 'M-Pesa' ? 'sonic-rail-obsidian-tab' : 'sonic-rail-light-tab'}
                      onClick={() => setWithdrawMethod('M-Pesa')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <MpesaLogo size={28} />
                        <div>
                          <div className={withdrawMethod === 'M-Pesa' ? 'sonic-rail-title-white' : 'sonic-rail-title-dark'}>
                            Safaricom M-Pesa
                          </div>
                          <div className={withdrawMethod === 'M-Pesa' ? 'sonic-rail-sub-gold' : 'sonic-rail-sub-muted'}>
                            ⚡ Instant Mobile
                          </div>
                        </div>
                      </div>
                      {withdrawMethod === 'M-Pesa' ? (
                        <div className="sonic-amber-circle-chevron" style={{ width: 22, height: 22, fontSize: 13 }}>›</div>
                      ) : (
                        <i className="fa-solid fa-chevron-right" style={{ color: '#cbd5e1', fontSize: '11px' }}></i>
                      )}
                    </div>
                  </div>

                  {/* Saved Accounts Fast-Fill Chips */}
                  {user?.attachedAccounts && user.attachedAccounts.length > 0 && (
                    <div>
                      <span className="sonic-input-tiny-label">
                        {lang === 'am' ? 'የተቀመጡ ሂሳቦች (ለመምረጥ ይጫኑ)' : 'Saved Accounts (1-Tap Fast Fill)'}
                      </span>
                      <div className="sonic-saved-accounts-wrap">
                        {user.attachedAccounts.filter(acc => acc.type === 'Telebirr' || acc.type === 'M-Pesa').map(acc => {
                          const isAccActive = withdrawAccount === acc.accountNumber;
                          return (
                            <button
                              key={acc.id}
                              type="button"
                              className={`sonic-saved-account-chip ${isAccActive ? 'active' : ''}`}
                              onClick={() => {
                                setWithdrawAccount(acc.accountNumber);
                                if (acc.name) setWithdrawAccountName(acc.name);
                                if (acc.type === 'Telebirr' || acc.type === 'M-Pesa') {
                                  setWithdrawMethod(acc.type);
                                }
                              }}
                            >
                              <i className="fa-solid fa-bolt"></i>
                              <span>{acc.type}: {acc.accountNumber.slice(0, 4)}***{acc.accountNumber.slice(-3)} ({acc.name})</span>
                              {isAccActive && <span>✓</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Payout Account Fields in Proof Card */}
                  <div className="sonic-proof-card">
                    <div className="sonic-input-field-group">
                      <label className="sonic-input-tiny-label">
                        {withdrawMethod === 'Telebirr'
                          ? (lang === 'am' ? 'ገንዘቡ የሚላክበት የቴሌብር ስልክ ቁጥር' : 'Receiving Telebirr Phone Number (09... / 07...)')
                          : (lang === 'am' ? 'ገንዘቡ የሚላክበት የሳፋሪኮም ኤም-ፔሳ ስልክ ቁጥር' : 'Receiving Safaricom M-Pesa Phone Number (07...)')}
                      </label>
                      <div className="sonic-proof-field-wrap">
                        <i className="fa-solid fa-mobile-screen"></i>
                        <input
                          type="text"
                          value={withdrawAccount}
                          onChange={e => setWithdrawAccount(e.target.value)}
                          className="sonic-proof-text-input"
                          placeholder={withdrawMethod === 'Telebirr' ? '09... or 07...' : '07...'}
                          required
                        />
                      </div>
                    </div>

                    <div className="sonic-input-field-group" style={{ marginTop: '10px' }}>
                      <label className="sonic-input-tiny-label">
                        {lang === 'am' ? 'የሂሳብ ባለቤቱ ሙሉ ስም' : 'Account Holder Full Name'}
                      </label>
                      <div className="sonic-proof-field-wrap">
                        <i className="fa-solid fa-user-check"></i>
                        <input
                          type="text"
                          value={withdrawAccountName}
                          onChange={e => setWithdrawAccountName(e.target.value)}
                          className="sonic-proof-text-input"
                          placeholder="e.g. Abebe Kebede"
                          required
                        />
                      </div>
                    </div>

                    {/* Big Gold Payout Submission Button */}
                    <button
                      type="submit"
                      className="sonic-primary-gold-submit-btn"
                      disabled={
                        isSubmittingWithdraw ||
                        withdrawAmount < 50 ||
                        withdrawAmount > 2000 ||
                        withdrawAmount > balance ||
                        (withdrawalEligibility !== null && !withdrawalEligibility.eligible)
                      }
                      style={{
                        marginTop: '12px',
                        opacity: (withdrawalEligibility !== null && !withdrawalEligibility.eligible) ? 0.6 : 1,
                        cursor: (withdrawalEligibility !== null && !withdrawalEligibility.eligible) ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {isSubmittingWithdraw ? (
                        <>
                          <i className="fa-solid fa-spinner fa-spin"></i>
                          <span>{lang === 'am' ? 'በመላክ ላይ...' : 'Submitting Payout Request...'}</span>
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-bolt"></i>
                          <span>
                            {lang === 'am'
                              ? `አሁን ${withdrawAmount > 0 ? `${withdrawAmount} ብር` : ''} ማውጣት ጠይቅ`
                              : `Request ${withdrawAmount > 0 ? `${withdrawAmount} ETB` : ''} Payout`}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
      </div>
    </div>
  );
};
