import React, { useState, useEffect } from 'react';
import { useWallet } from '../context/WalletContext.tsx';
import { useApp } from '../context/AppContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useLanguage } from '../context/LanguageContext.tsx';
import { TelebirrLogo, MpesaLogo } from '../components/wallet/PaymentLogos.tsx';
import { LanguageDropdown } from '../components/common/LanguageDropdown.tsx';
import { TransactionHistory } from '../components/wallet/TransactionHistory.tsx';
import { apiClient } from '../services/apiClient.ts';
import { socketService } from '../services/socketService.ts';
import { extractTransactionIdFromMessage } from '../utils/extractSmsTxId.ts';
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
  const [showTxHistory, setShowTxHistory] = useState<boolean>(false);
  const [isWithdrawDropdownOpen, setIsWithdrawDropdownOpen] = useState<boolean>(false);
  const [isDepositDropdownOpen, setIsDepositDropdownOpen] = useState<boolean>(false);
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
    telegramUsername?: string | null;
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
    telegramUsername?: string | null;
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
    telegramUsername?: string | null;
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

  // Switch Deposit Payment Rail dynamically and load a matching agent if current agent lacks the chosen rail
  const handleSwitchDepositRail = async (rail: 'Telebirr' | 'M-Pesa') => {
    setAgentPaymentRail(rail);
    setIsDepositDropdownOpen(false);
    setAgentLoadError(null);

    const hasRailOnCurrent = rail === 'Telebirr'
      ? Boolean(selectedAgent?.telebirrPhone)
      : Boolean(selectedAgent?.mpesaPhone);

    if (hasRailOnCurrent) {
      return;
    }

    setIsLoadingAgents(true);
    try {
      const assignedRes = await apiClient.wallet.getAssignedAgent(undefined, undefined, rail);
      if (assignedRes && assignedRes.success && assignedRes.agent) {
        const ag = assignedRes.agent;
        setSelectedAgent(ag);
        setTotalOnlineAgents(assignedRes.totalOnlineAgents || 1);
        sessionStorage.setItem('sonic_assigned_agent_id', ag.id);
      } else {
        setSelectedAgent(null);
        setAgentLoadError(
          lang === 'am'
            ? `በአሁኑ ሰዓት ${rail === 'M-Pesa' ? 'ኤም-ፔሳ' : 'ቴሌብር'} የሚቀበል ንቁ ኤጀንት የለም።`
            : `No online certified agents currently accept ${rail === 'M-Pesa' ? 'Safaricom M-Pesa' : 'Telebirr'}. Please try another payment method.`
        );
      }
    } catch (err) {
      console.warn('Failed to switch agent for rail:', rail, err);
      setAgentLoadError(lang === 'am' ? 'ኤጀንት መቀየር አልተቻለም' : `Failed to find an agent supporting ${rail}.`);
    } finally {
      setIsLoadingAgents(false);
    }
  };

  // Load single assigned agent via fair damped weighted lottery with session persistence
  const loadAgentData = async (excludeAgentId?: string, preferredRail?: 'Telebirr' | 'M-Pesa') => {
    setIsLoadingAgents(true);
    setAgentLoadError(null);

    // 1. Request assigned agent with isolated fallback to active agents list on transient failure
    try {
      const preferredId = !excludeAgentId ? (sessionStorage.getItem('sonic_assigned_agent_id') || undefined) : undefined;
      let assignedRes: any = null;
      let assignedErrored = false;

      try {
        assignedRes = await apiClient.wallet.getAssignedAgent(excludeAgentId, preferredId, preferredRail);
      } catch (err) {
        assignedErrored = true;
        console.warn('Assigned agent lookup failed, trying active agents fallback:', err);
      }

      if (assignedRes && assignedRes.success && assignedRes.agent) {
        const ag = assignedRes.agent;
        setTotalOnlineAgents(assignedRes.totalOnlineAgents || 1);
        sessionStorage.setItem('sonic_assigned_agent_id', ag.id);
        setActiveAgents([ag as any]);
        handleSelectDepositAgent(ag);
        handleSelectWithdrawAgent(ag);
      } else {
        // Fallback to active agents list if assigned returned empty OR threw an error
        const agentsRes = await apiClient.wallet.getActiveAgents();
        const matchingAgents = preferredRail && agentsRes?.agents
          ? agentsRes.agents.filter((a: any) => (a.supportedRails || []).includes(preferredRail))
          : agentsRes?.agents || [];

        if (agentsRes && agentsRes.success && matchingAgents.length > 0) {
          setActiveAgents(matchingAgents);
          setTotalOnlineAgents(matchingAgents.length);
          sessionStorage.setItem('sonic_assigned_agent_id', matchingAgents[0].id);
          handleSelectDepositAgent(matchingAgents[0]);
          handleSelectWithdrawAgent(matchingAgents[0]);
        } else if (assignedErrored && (!agentsRes || !agentsRes.success)) {
          throw new Error('Failed to load active agents');
        } else {
          setSelectedAgent(null);
          setAgentLoadError(
            preferredRail
              ? (lang === 'am' ? `በአሁኑ ሰዓት ${preferredRail} የሚቀበል ንቁ ኤጀንት የለም` : `No online agents currently accept ${preferredRail}.`)
              : (lang === 'am' ? 'በአሁኑ ሰዓት ንቁ ኤጀንት የለም' : 'No certified agents currently available')
          );
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

  // Lightweight check for pending deposit & withdrawal status updates during heartbeat
  const refreshPendingRequests = async () => {
    try {
      const [myReqsRes, myWithRes] = await Promise.allSettled([
        apiClient.wallet.getMyAgentDeposits(),
        apiClient.wallet.getMyWithdrawals().catch(() => apiClient.wallet.getMyAgentWithdrawals())
      ]);

      if (myReqsRes.status === 'fulfilled' && myReqsRes.value?.success && myReqsRes.value?.requests) {
        const matchingReq = myReqsRes.value.requests.find((r: any) => 
          (activeAgentRequest && r.id === activeAgentRequest.id) || r.status === 'pending'
        );
        if (matchingReq) {
          if (matchingReq.status !== activeAgentRequest?.status) {
            setActiveAgentRequest(matchingReq);
            if (matchingReq.status === 'approved' || matchingReq.status === 'rejected') {
              sessionStorage.removeItem('sonic_assigned_agent_id');
            }
          }
        }
      }

      if (myWithRes.status === 'fulfilled' && myWithRes.value?.success && myWithRes.value?.requests) {
        const matchingWith = myWithRes.value.requests.find((r: any) => 
          (activeWithdrawalRequest && r.id === activeWithdrawalRequest.id) || r.status === 'pending'
        );
        if (matchingWith) {
          setActiveWithdrawalRequest(matchingWith);
        }
      }
    } catch (err) {
      console.warn('Pending requests refresh error:', err);
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

  // 🔄 Handle Dismissal of Approved Deposit -> Reset & Rotate to Fresh Cashier
  const handleDismissApprovedDeposit = async () => {
    const previousAgentId = activeAgentRequest?.agentCode || selectedAgent?.id || selectedAgent?.agentCode;
    setActiveAgentRequest(null);
    setAgentTxRef('');
    setAgentReceiptImage(null);
    sessionStorage.removeItem('sonic_assigned_agent_id');
    showToast(lang === 'am' ? '🔄 አዲስ ተረኛ ካሺየር እየተመደበ ነው...' : '🔄 Assigning next certified cashier...');
    await loadAgentData(previousAgentId);
  };

  // 🔄 Handle Dismissal of Rejected Deposit -> Reset & Rotate to Different Cashier
  const handleDismissRejectedDeposit = async () => {
    const rejectedAgentId = activeAgentRequest?.agentCode || selectedAgent?.id || selectedAgent?.agentCode;
    setActiveAgentRequest(null);
    setAgentTxRef('');
    setAgentReceiptImage(null);
    sessionStorage.removeItem('sonic_assigned_agent_id');
    showToast(lang === 'am' ? '🔄 ወደ ሌላ ተረኛ ካሺየር እየተቀየረ ነው...' : '🔄 Switching to another certified cashier...');
    await loadAgentData(rejectedAgentId);
  };

  // 🔄 Handle Dismissal of Pending Deposit
  const handleDismissPendingDeposit = async () => {
    setActiveAgentRequest(null);
    setAgentTxRef('');
    setAgentReceiptImage(null);
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
      refreshPendingRequests();
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
      sessionStorage.removeItem('sonic_assigned_agent_id');
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
      sessionStorage.removeItem('sonic_assigned_agent_id');
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

    // Smart extraction: identify ONLY the Transaction ID from pasted confirmation SMS (ignoring links)
    const extractedTxId = extractTransactionIdFromMessage(agentTxRef);
    if (!extractedTxId) {
      showToast(
        lang === 'am'
          ? '⚠️ ከመልእክቱ ውስጥ የግብይት መለያ ቁጥር ማግኘት አልተቻለም። እባክዎ የማረጋገጫ ኤስኤምኤስ ወይም መለያ ቁጥሩን ያስገቡ።'
          : '⚠️ Could not detect a Transaction ID from the message. Please paste the full confirmation SMS or enter the ID.'
      );
      return;
    }
    const cleanCode = extractedTxId;

    try {
      setIsSubmittingAgentDeposit(true);
      const res = await apiClient.wallet.depositViaAgent({
        agentId: selectedAgent.id,
        agentCode: selectedAgent.agentCode,
        amount: agentDepositAmount,
        paymentMethod: agentPaymentRail,
        playerPhone: agentSenderPhone.trim() || user?.phone || user?.nationalPhone || '',
        transactionCode: cleanCode,
        screenshotUrl: agentReceiptImage || undefined
      });

      if (res.success) {
        showToast(`✅ ${res.message}`);
        sessionStorage.removeItem('sonic_assigned_agent_id');
        setActiveAgentRequest({
          id: res.requestId,
          amount: agentDepositAmount,
          paymentMethod: agentPaymentRail,
          transactionCode: cleanCode.toUpperCase(),
          status: (res as any).status === 'approved' ? 'approved' : 'pending',
          agentCode: res.agentCode,
          agentDisplayName: res.agentDisplayName,
          agentTelegramUsername: res.agentTelegramUsername || selectedAgent.telegramUsername || null,
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

  if (showTxHistory) {
    return (
      <div className="sonic-deposit-canvas" id="page-deposit">
        <div className="sonic-deposit-container" style={{ padding: '8px 12px' }}>
          <TransactionHistory
            initialTab="withdrawals"
            onBack={() => setShowTxHistory(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="sonic-deposit-canvas" id="page-deposit">
      <div className="sonic-deposit-container">
        {/* 1. Exact Reference Top Nav Header */}
        <div className="sonic-deposit-header-clean">
          <button
            type="button"
            className="sonic-withdraw-back-circle"
            onClick={() => switchPage('wallet')}
            title="Back to Wallet"
          >
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          {activeTab === 'withdraw' ? (
            <div className="sonic-withdraw-title-stack">
              <h2 className="sonic-withdraw-main-title">Withdraw</h2>
              <span className="sonic-withdraw-sub-title">Withdraw your winnings</span>
            </div>
          ) : (
            <h2 className="sonic-deposit-title-clean">Deposit</h2>
          )}
          <div className="sonic-deposit-header-right">
            {activeTab === 'withdraw' ? (
              <button
                type="button"
                className="sonic-withdraw-history-pill"
                onClick={() => setShowTxHistory(true)}
                title="View Withdraw History"
              >
                <i className="fa-solid fa-clock-rotate-left"></i>
                <span>Transaction History</span>
              </button>
            ) : (
              <button
                type="button"
                className="sonic-deposit-switch-tab-btn"
                onClick={() => setActiveTab('withdraw')}
                title="Switch to Withdraw"
              >
                <span>Withdraw</span>
                <i className="fa-solid fa-arrow-right" style={{ fontSize: '11px', marginLeft: '4px' }}></i>
              </button>
            )}
          </div>
        </div>

        {activeTab === 'deposit' && (
          <>
            {/* CASE A: ACTIVE / PENDING / APPROVED / REJECTED REQUEST TRACKER (Light UI matching Image 2 & Image 3) */}
            {activeAgentRequest ? (
              <div
                className={`sonic-waiting-card ${
                  activeAgentRequest.status === 'approved'
                    ? 'approved'
                    : activeAgentRequest.status === 'rejected'
                    ? 'rejected'
                    : 'pending'
                }`}
              >
                {/* Status Icon & Header (Image 2) */}
                <div className="sonic-waiting-header">
                  {activeAgentRequest.status === 'approved' ? (
                    <div className="sonic-waiting-icon-circle approved">
                      <i className="fa-solid fa-check"></i>
                    </div>
                  ) : activeAgentRequest.status === 'rejected' ? (
                    <div className="sonic-waiting-icon-circle rejected">
                      <i className="fa-solid fa-xmark"></i>
                    </div>
                  ) : (
                    <div className="sonic-waiting-icon-circle pending">
                      <i className="fa-solid fa-tower-broadcast"></i>
                    </div>
                  )}

                  <h3 className="sonic-waiting-title">
                    {activeAgentRequest.status === 'approved'
                      ? (lang === 'am' ? 'ተቀማጭዎ በተሳካ ሁኔታ ተረጋግጧል!' : 'Deposit Confirmed & Credited!')
                      : activeAgentRequest.status === 'rejected'
                      ? (lang === 'am' ? 'ተቀማጭዎ አልተሳካም' : 'Deposit Rejected')
                      : (lang === 'am' ? 'ኤጀንቱ ክፍያዎን በማረጋገጥ ላይ ነው...' : 'Sonic Agent is Verifying Payment...')}
                  </h3>
                  <p className="sonic-waiting-subtitle">
                    {activeAgentRequest.status === 'approved'
                      ? (lang === 'am' ? 'ገንዘቡ ወደ ዋሌትዎ ገብቷል። መልካም ዕድል በጨዋታው!' : 'Funds have been credited to your wallet balance. Good luck!')
                      : activeAgentRequest.status === 'rejected'
                      ? (activeAgentRequest.rejectionReason || (lang === 'am' ? 'እባክዎ የግብይት መለያውን ወይም የላኩትን መጠን ትክክለኛነት ያረጋግጡ።' : 'Please check transaction ID or transfer amount.'))
                      : (lang === 'am' ? 'ኤጀንቱ የእርስዎን የኤስኤምኤስ ማጣቀሻ በማዛመድ ላይ ነው። እባክዎ ትንሽ ይጠብቁ' : 'The agent is matching your SMS reference.\nPlease wait a moment')}
                  </p>
                </div>

                {/* Details Breakdown */}
                <div className="sonic-waiting-summary-box">
                  <div className="sonic-waiting-summary-row">
                    <span className="label">{lang === 'am' ? 'ኤጀንት' : 'Sonic Agent'}:</span>
                    <strong className="val">{activeAgentRequest.agentDisplayName || `Sonic Agent #${activeAgentRequest.agentCode || ''}`}</strong>
                  </div>
                  <div className="sonic-waiting-summary-row">
                    <span className="label">{lang === 'am' ? 'የተላከ መጠን' : 'Amount'}:</span>
                    <strong className="val amount">{activeAgentRequest.amount} ETB</strong>
                  </div>
                  <div className="sonic-waiting-summary-row">
                    <span className="label">{lang === 'am' ? 'የግብይት መለያ (Tx ID)' : 'Tx Reference'}:</span>
                    <strong className="val mono">{activeAgentRequest.transactionCode}</strong>
                  </div>
                  {activeAgentRequest.coinsAwarded && (
                    <div className="sonic-waiting-summary-row coins">
                      <span className="label">{lang === 'am' ? 'የተሰጠ ቦነስ' : 'Sonic Coins'}:</span>
                      <strong className="val gold">+{activeAgentRequest.coinsAwarded} 🪙</strong>
                    </div>
                  )}
                </div>

                {/* Chat with Agent Block (Image 3 Exact Match) */}
                {activeAgentRequest.status === 'pending' && (
                  <div className="sonic-waiting-chat-block">
                    <button
                      type="button"
                      className="sonic-waiting-chat-agent-btn"
                      onClick={() => {
                        const rawTg = activeAgentRequest.agentTelegramUsername || selectedAgent?.telegramUsername || 'Sonicbingo_support';
                        const cleanTg = String(rawTg).replace(/^@/, '');
                        const chatUrl = `https://t.me/${cleanTg}`;
                        if (window.Telegram?.WebApp?.openTelegramLink) {
                          window.Telegram.WebApp.openTelegramLink(chatUrl);
                        } else {
                          window.open(chatUrl, '_blank');
                        }
                      }}
                    >
                      <i className="fa-solid fa-paper-plane sonic-waiting-chat-icon"></i>
                      <span>
                        {lang === 'am'
                          ? `ከኤጀንት # ${activeAgentRequest.agentCode || ''} ጋር ያውሩ`
                          : `Chat with Agent # ${activeAgentRequest.agentCode || ''}`}
                      </span>
                    </button>
                    <p className="sonic-waiting-chat-helper">
                      {lang === 'am'
                        ? 'ስለ ተቀማጭ ክፍያው ኤጀንቱን ያነጋግሩ።\nገንዘብ ሲያስገቡ ማንኛውም መዘግየት ወይም ስህተት ካጋጠመዎት ያሳውቁ።'
                        : 'Please speak to the agent regarding to the deposit.\nIf you encounter any delays or errors while making a deposit.'}
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="sonic-waiting-actions">
                  {activeAgentRequest.status === 'approved' ? (
                    <button
                      type="button"
                      className="sonic-waiting-done-btn"
                      onClick={handleDismissApprovedDeposit}
                    >
                      {lang === 'am' ? 'ጨርሻለሁ (ወደ አዲስ ካሺየር)' : 'Done / Return to Cashier'}
                    </button>
                  ) : activeAgentRequest.status === 'rejected' ? (
                    <button
                      type="button"
                      className="sonic-exact-payout-btn"
                      onClick={handleDismissRejectedDeposit}
                    >
                      <i className="fa-solid fa-rotate"></i>
                      <span>{lang === 'am' ? 'በሌላ ኤጀንት እንደገና ይሞክሩ' : 'Try Again with Another Agent'}</span>
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="sonic-exact-payout-btn"
                        onClick={() => refreshPendingRequests()}
                      >
                        <i className="fa-solid fa-rotate"></i>
                        <span>{lang === 'am' ? 'ሁኔታውን ያድሱ' : 'Refresh Status'}</span>
                      </button>
                      <button
                        type="button"
                        className="sonic-waiting-cancel-link"
                        onClick={handleDismissPendingDeposit}
                      >
                        {lang === 'am' ? 'ይቅር / አዲስ ፎርም ክፈት' : 'Cancel / Open New Form'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              /* CASE B: EXACT 100% REFERENCE CLONE INTERACTIVE DEPOSIT FORM */
              <form onSubmit={handleAgentDepositSubmit} className="sonic-deposit-clean-shell" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* Field 1: Deposit Amount (Image 1 Exact Match) */}
                <div className="sonic-exact-section-group">
                  <div className="sonic-exact-section-header">
                    <div className="sonic-deposit-red-icon-badge">
                      <i className="fa-solid fa-wallet"></i>
                    </div>
                    <span className="sonic-exact-header-title">
                      {lang === 'am' ? 'የማስገቢያ መጠን' : 'Deposit Amount'}
                    </span>
                  </div>
                  <div className="sonic-exact-amount-box-white">
                    <span className="sonic-exact-currency-prefix">ETB</span>
                    <input
                      type="number"
                      min="50"
                      max="1500"
                      value={agentDepositAmount || ''}
                      onChange={e => setAgentDepositAmount(Number(e.target.value))}
                      className="sonic-exact-amount-field"
                      placeholder="100"
                      required
                    />
                  </div>
                </div>

                {/* Field 2: Payment Method (Visible Interactive Dropdown matching Withdraw Page) */}
                <div className="sonic-exact-section-group">
                  <div className="sonic-exact-section-header">
                    <div className="sonic-deposit-red-icon-badge">
                      <i className="fa-solid fa-credit-card"></i>
                    </div>
                    <span className="sonic-exact-header-title">
                      {lang === 'am' ? 'የክፍያ ዘዴ' : 'Payment Method'}
                    </span>
                  </div>
                  <div className="sonic-exact-deposit-method-card">
                    <div
                      className="sonic-exact-method-top-row"
                      onClick={() => setIsDepositDropdownOpen(!isDepositDropdownOpen)}
                      title="Click to select payment method (Telebirr / Safaricom M-Pesa)"
                    >
                      <div className="sonic-exact-method-left">
                        {agentPaymentRail === 'Telebirr' ? <TelebirrLogo size={24} /> : <MpesaLogo size={24} />}
                        <span className="sonic-exact-method-name">
                          {agentPaymentRail === 'Telebirr' ? 'Telebirr' : 'Safaricom M-Pesa'}
                        </span>
                      </div>
                      <div className="sonic-exact-method-right">
                        <span className="sonic-exact-change-tag">
                          {lang === 'am' ? 'ቀይር' : 'Change'}
                        </span>
                        <div className="sonic-exact-method-check">
                          <i className="fa-solid fa-check"></i>
                        </div>
                        <i className={`fa-solid fa-chevron-down sonic-exact-chevron ${isDepositDropdownOpen ? 'open' : ''}`}></i>
                      </div>
                    </div>

                    {isDepositDropdownOpen && (
                      <div className="sonic-exact-dropdown-list">
                        <div
                          className={`sonic-exact-dropdown-item ${agentPaymentRail === 'Telebirr' ? 'active' : ''}`}
                          onClick={() => handleSwitchDepositRail('Telebirr')}
                        >
                          <div className="sonic-exact-item-left">
                            <TelebirrLogo size={22} />
                            <span className="sonic-exact-item-title">Telebirr</span>
                          </div>
                          {agentPaymentRail === 'Telebirr' ? (
                            <div className="sonic-exact-item-check"><i className="fa-solid fa-check"></i></div>
                          ) : (
                            <div className="sonic-exact-item-radio"></div>
                          )}
                        </div>

                        <div
                          className={`sonic-exact-dropdown-item ${agentPaymentRail === 'M-Pesa' ? 'active' : ''}`}
                          onClick={() => handleSwitchDepositRail('M-Pesa')}
                        >
                          <div className="sonic-exact-item-left">
                            <MpesaLogo size={22} />
                            <span className="sonic-exact-item-title">Safaricom M-Pesa</span>
                          </div>
                          {agentPaymentRail === 'M-Pesa' ? (
                            <div className="sonic-exact-item-check"><i className="fa-solid fa-check"></i></div>
                          ) : (
                            <div className="sonic-exact-item-radio"></div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Field 3: Compact Recipient Account Card with Agent Online Badge (Image 1 Exact Match) */}
                {isLoadingAgents ? (
                  <div className="sonic-clean-account-card" style={{ justifyContent: 'center', textAlign: 'center', padding: '16px 12px' }}>
                    <i className="fa-solid fa-circle-notch fa-spin" style={{ color: '#dc2626', fontSize: '18px', marginRight: '8px' }}></i>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>
                      {lang === 'am' ? 'ተረኛ ኤጀንት በመመደብ ላይ...' : `Assigning online ${agentPaymentRail} agent...`}
                    </span>
                  </div>
                ) : !selectedAgent ? (
                  <div className="sonic-clean-account-card" style={{ textAlign: 'center', padding: '14px 12px' }}>
                    <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
                      {agentLoadError || (lang === 'am' ? 'በአሁኑ ሰዓት ንቁ ኤጀንት የለም' : 'No certified agents currently online.')}
                    </span>
                    <button
                      type="button"
                      onClick={() => loadAgentData(undefined, agentPaymentRail)}
                      style={{ marginTop: '6px', padding: '4px 12px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      {lang === 'am' ? 'እንደገና ሞክር' : 'Retry'}
                    </button>
                  </div>
                ) : (() => {
                  const currentAccount = agentPaymentRail === 'Telebirr'
                    ? (selectedAgent.telebirrPhone || (selectedAgent.supportedRails?.includes('Telebirr') ? selectedAgent.phone : '') || '')
                    : (selectedAgent.mpesaPhone || '');

                  const currentName = agentPaymentRail === 'Telebirr'
                    ? (selectedAgent.telebirrName || selectedAgent.displayName || 'Sonic Agent')
                    : (selectedAgent.mpesaName || selectedAgent.displayName || 'Sonic Agent');

                  return (
                    <div className="sonic-exact-agent-card">
                      {/* Top section: Avatar + Divider + Info */}
                      <div className="sonic-exact-agent-main">
                        <div className="sonic-exact-agent-avatar-ring">
                          <i className="fa-solid fa-user-tie sonic-exact-agent-avatar-icon"></i>
                        </div>
                        <div className="sonic-exact-agent-v-divider"></div>
                        <div className="sonic-exact-agent-details">
                          <div className="sonic-exact-agent-title-row">
                            <span className="sonic-exact-agent-name-code">
                              SONIC AGENT | <span className="code">#{selectedAgent.agentCode || 'AGT-3457'}</span>
                            </span>
                            <span className="sonic-exact-agent-online-pill">
                              <span className="dot"></span>
                              Online
                            </span>
                          </div>

                          <div className="sonic-exact-agent-phone-row">
                            <span className="label">Send to:</span>
                            <span className="number">{currentAccount}</span>
                            <button
                              type="button"
                              className="sonic-exact-copy-icon-btn"
                              onClick={() => handleCopy(currentAccount, `${agentPaymentRail} Phone`)}
                              title="Copy Phone Number"
                            >
                              <i className={copiedText === currentAccount ? "fa-solid fa-check" : "fa-regular fa-copy"}></i>
                            </button>
                          </div>

                          <div className="sonic-exact-agent-name-row">
                            <span className="label">{agentPaymentRail} Account Name:</span>
                            <span className="val">{currentName}</span>
                          </div>
                        </div>
                      </div>

                      {/* Bottom Banner: Send Money, then paste your confirmation SMS below */}
                      <div className="sonic-exact-agent-disclaimer">
                        <i className="fa-solid fa-circle-exclamation sonic-exact-disclaimer-icon"></i>
                        <span>Send Money, then paste your confirmation SMS below.</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Field 4: Confirmation SMS Card (Image 1 Exact Match) */}
                <div className="sonic-exact-section-group">
                  <div className="sonic-exact-section-header">
                    <div className="sonic-deposit-red-icon-badge">
                      <i className="fa-solid fa-comment-dots"></i>
                    </div>
                    <span className="sonic-exact-header-title">
                      {lang === 'am' ? 'የማረጋገጫ መልእክት ይለጥፉ' : 'Paste your confirmation SMS'}
                    </span>
                  </div>
                  <span className="sonic-exact-sms-subtext">
                    {lang === 'am' ? 'የማረጋገጫ ኤስኤምኤስ ወይም የግብይት ቁጥር' : 'Confirmation SMS or Transaction Number'}
                  </span>
                  <div className="sonic-exact-sms-box">
                    <textarea
                      className="sonic-exact-sms-textarea"
                      rows={2}
                      value={agentTxRef}
                      onChange={e => setAgentTxRef(e.target.value)}
                      placeholder="Paste the whole confirmation SMS here- or Just the Transaction Number, we'll find it."
                      required
                    />
                  </div>
                  {agentTxRef.trim().length > 0 && (() => {
                    const detectedTxId = extractTransactionIdFromMessage(agentTxRef);
                    if (detectedTxId) {
                      return (
                        <div className="sonic-sms-detected-pill">
                          <i className="fa-solid fa-circle-check"></i>
                          <span>
                            {lang === 'am' ? 'የተገኘው መለያ ቁጥር፡' : 'Detected ID:'}{' '}
                            <strong>{detectedTxId}</strong>
                          </span>
                        </div>
                      );
                    }
                    if (agentTxRef.trim().length >= 12) {
                      return (
                        <div className="sonic-sms-warning-pill">
                          <i className="fa-solid fa-triangle-exclamation"></i>
                          <span>
                            {lang === 'am'
                              ? 'የግብይት መለያ ቁጥር አልተገኘም — የማረጋገጫ ኤስኤምኤስ መልእክቱን (ሊንክ ሳይሆን) ይለጥፉ።'
                              : 'No Transaction ID found yet — paste the confirmation SMS message (not just a link).'}
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>

                {/* Field 5: Submit Deposit Button (Image 1 Exact Match) */}
                <button
                  type="submit"
                  className="sonic-exact-payout-btn"
                  disabled={isSubmittingAgentDeposit || !selectedAgent || (!selectedAgent.supportedRails || selectedAgent.supportedRails.length === 0)}
                >
                  {isSubmittingAgentDeposit ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>
                      <span>{lang === 'am' ? 'በማስገባት ላይ...' : 'Submitting Deposit...'}</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-paper-plane sonic-exact-payout-icon"></i>
                      <span>{lang === 'am' ? 'ገንዘቡን አስገባ' : 'Submit Deposit'}</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </>
        )}

      {/* TAB 2: WITHDRAW FUNDS VIA DECENTRALIZED AGENT */}
          {activeTab === 'withdraw' && (
            <div className="sonic-deposit-clean-shell" style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {/* Card 1: Luxury Crimson Hero Card (Image Exact Match) */}
              <div className="sonic-crimson-hero-card">
                <div className="sonic-crimson-top-row">
                  <div className="sonic-crimson-left-group">
                    <div className="sonic-crimson-wallet-icon">
                      <i className="fa-solid fa-wallet"></i>
                    </div>
                    <div className="sonic-crimson-balance-stack">
                      <span className="sonic-crimson-balance-label">Withdrawable Balance</span>
                      <div className="sonic-crimson-balance-val">
                        {balance.toFixed(2)} <span className="sonic-crimson-balance-curr">ETB</span>
                      </div>
                    </div>
                  </div>
                  <div className="sonic-crimson-live-desk">
                    <span className="sonic-crimson-live-dot"></span>
                    <span>Live Desk</span>
                  </div>
                </div>

                <div className="sonic-crimson-divider"></div>

                <div className="sonic-crimson-bottom-row">
                  <div className="sonic-crimson-cashier-info">
                    <span className="sonic-crimson-cashier-title">Payout Cashier</span>
                    <span className="sonic-crimson-cashier-sub">Direct Payout to Telebirr & Safaricom M-Pesa</span>
                  </div>
                  <div className="sonic-crimson-cashier-meta">
                    <span className="sonic-crimson-fee-tag">0% Fee Free</span>
                    <span className="sonic-crimson-limit-tag">Max 2,000 ETB</span>
                  </div>
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
                      onClick={() => {
                        setActiveWithdrawalRequest(null);
                        sessionStorage.removeItem('sonic_assigned_agent_id');
                        loadAgentData();
                      }}
                    >
                      <i className="fa-solid fa-circle-check"></i>
                      <span>{lang === 'am' ? 'ጨርሻለሁ (ወደ መነሻ)' : 'Done / Return to Cashier'}</span>
                    </button>
                  ) : activeWithdrawalRequest.status === 'rejected' ? (
                    <button
                      type="button"
                      className="sonic-primary-gold-submit-btn"
                      onClick={() => {
                        setActiveWithdrawalRequest(null);
                        sessionStorage.removeItem('sonic_assigned_agent_id');
                        loadAgentData();
                      }}
                      style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', color: '#ffffff' }}
                    >
                      <span>{lang === 'am' ? 'ይቅር / አዲስ ጥያቄ አቅርብ' : 'Dismiss / Submit New Request'}</span>
                    </button>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <button
                        type="button"
                        onClick={() => refreshPendingRequests()}
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
                <form onSubmit={handleWithdrawSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {/* Card 2: Withdrawal Criteria (Image Exact Match) */}
                  <div className="sonic-criteria-exact-card">
                    <div className="sonic-criteria-top-row">
                      <div className="sonic-criteria-title-group">
                        <i className="fa-solid fa-circle-check sonic-criteria-check-icon"></i>
                        <span className="sonic-criteria-title-text">
                          {lang === 'am' ? 'የማውጣት መስፈርቶች' : 'Withdrawal Criteria'}
                        </span>
                      </div>
                      <span className={`sonic-criteria-eligible-pill ${withdrawalEligibility && !withdrawalEligibility.eligible ? 'locked' : ''}`}>
                        {withdrawalEligibility && !withdrawalEligibility.eligible ? 'LOCKED' : 'ELIGIBLE'}
                      </span>
                    </div>

                    <div className="sonic-criteria-data-grid">
                      <div className="sonic-criteria-stat-item">
                        <i className="fa-solid fa-trophy sonic-criteria-trophy-icon"></i>
                        <div className="sonic-criteria-stat-stack">
                          <span className="sonic-criteria-stat-label">
                            {lang === 'am' ? 'የተጠናቀቁ ጨዋታዎች' : 'Completed Games'}
                          </span>
                          <span className="sonic-criteria-stat-val-green">
                            {withdrawalEligibility?.completedGames ?? 23}/5
                          </span>
                        </div>
                      </div>

                      <div className="sonic-criteria-v-divider"></div>

                      <div className="sonic-criteria-stat-item">
                        <i className="fa-regular fa-calendar-days sonic-criteria-calendar-icon"></i>
                        <div className="sonic-criteria-stat-stack">
                          <span className="sonic-criteria-stat-label">
                            {lang === 'am' ? 'የዛሬ ወጪዎች' : "Today's Withdrawal"}
                          </span>
                          <span className="sonic-criteria-stat-val-dark">
                            {withdrawalEligibility?.todayWithdrawals ?? 0}/5
                          </span>
                        </div>
                      </div>
                    </div>

                    {withdrawalEligibility && !withdrawalEligibility.eligible && (
                      <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#f59e0b', lineHeight: 1.35 }}>
                        {withdrawalEligibility.completedGames < 5
                          ? (lang === 'am'
                              ? `⚠️ ገንዘብ ለማውጣት ቢያንስ 5 ጨዋታዎችን ማጠናቀቅ አለብዎት (${withdrawalEligibility.completedGames}/5)።`
                              : `⚠️ You must complete at least 5 games before withdrawing (${withdrawalEligibility.completedGames}/5 games).`)
                          : (lang === 'am'
                              ? '⚠️ የቀን ገደብ ደርሷል (ቢበዛ 5 ጊዜ)።'
                              : '⚠️ Maximum withdrawals reached for today.')}
                      </p>
                    )}
                  </div>

                  {/* Section 3: Payment Method Card (Exact Image Match) */}
                  <div className="sonic-exact-section-group">
                    <div className="sonic-exact-section-header">
                      <i className="fa-solid fa-credit-card sonic-exact-header-icon"></i>
                      <span className="sonic-exact-header-title">
                        {lang === 'am' ? 'የክፍያ ዘዴ' : 'Payment Method'}
                      </span>
                    </div>
                    <div className="sonic-exact-method-card">
                      <div
                        className="sonic-exact-method-top-row"
                        onClick={() => setIsWithdrawDropdownOpen(!isWithdrawDropdownOpen)}
                        title="Click to select payment method (Telebirr / Safaricom M-Pesa)"
                      >
                        <div className="sonic-exact-method-left">
                          {withdrawMethod === 'Telebirr' ? <TelebirrLogo size={24} /> : <MpesaLogo size={24} />}
                          <span className="sonic-exact-method-name">
                            {withdrawMethod === 'Telebirr' ? 'Telebirr' : 'Safaricom M-Pesa'}
                          </span>
                        </div>
                        <div className="sonic-exact-method-right">
                          <span className="sonic-exact-change-tag">
                            {lang === 'am' ? 'ቀይር' : 'Change'}
                          </span>
                          <div className="sonic-exact-method-check">
                            <i className="fa-solid fa-check"></i>
                          </div>
                          <i className={`fa-solid fa-chevron-down sonic-exact-chevron ${isWithdrawDropdownOpen ? 'open' : ''}`}></i>
                        </div>
                      </div>

                      {/* Expandable Dropdown Rail Options */}
                      {isWithdrawDropdownOpen && (
                        <div className="sonic-exact-dropdown-list">
                          <div
                            className={`sonic-exact-dropdown-item ${withdrawMethod === 'Telebirr' ? 'active' : ''}`}
                            onClick={() => {
                              setWithdrawMethod('Telebirr');
                              setIsWithdrawDropdownOpen(false);
                            }}
                          >
                            <div className="sonic-exact-item-left">
                              <TelebirrLogo size={22} />
                              <span className="sonic-exact-item-title">Telebirr</span>
                            </div>
                            {withdrawMethod === 'Telebirr' ? (
                              <div className="sonic-exact-item-check"><i className="fa-solid fa-check"></i></div>
                            ) : (
                              <div className="sonic-exact-item-radio"></div>
                            )}
                          </div>

                          <div
                            className={`sonic-exact-dropdown-item ${withdrawMethod === 'M-Pesa' ? 'active' : ''}`}
                            onClick={() => {
                              setWithdrawMethod('M-Pesa');
                              setIsWithdrawDropdownOpen(false);
                            }}
                          >
                            <div className="sonic-exact-item-left">
                              <MpesaLogo size={22} />
                              <span className="sonic-exact-item-title">Safaricom M-Pesa</span>
                            </div>
                            {withdrawMethod === 'M-Pesa' ? (
                              <div className="sonic-exact-item-check"><i className="fa-solid fa-check"></i></div>
                            ) : (
                              <div className="sonic-exact-item-radio"></div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="sonic-exact-method-input-row">
                        <i className="fa-solid fa-phone sonic-exact-phone-icon"></i>
                        <input
                          type="tel"
                          value={withdrawAccount}
                          onChange={e => setWithdrawAccount(e.target.value)}
                          placeholder={withdrawMethod === 'Telebirr' ? "0983624574" : "0712345678"}
                          className="sonic-exact-phone-field"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section 4: Account Holder (Exact Image Match) */}
                  <div className="sonic-exact-section-group">
                    <div className="sonic-exact-section-header">
                      <i className="fa-solid fa-user sonic-exact-header-icon"></i>
                      <span className="sonic-exact-header-title">
                        {lang === 'am' ? 'የሂሳብ ባለቤቱ ስም' : 'Account Holder'}
                      </span>
                    </div>
                    <div className="sonic-exact-input-container">
                      <i className="fa-solid fa-user sonic-exact-input-leading-icon"></i>
                      <input
                        type="text"
                        value={withdrawAccountName}
                        onChange={e => setWithdrawAccountName(e.target.value)}
                        placeholder="KIYA"
                        className="sonic-exact-text-field"
                        required
                      />
                    </div>
                  </div>

                  {/* Section 5: Withdrawal Amount (Exact Image Match) */}
                  <div className="sonic-exact-section-group">
                    <div className="sonic-exact-section-header">
                      <i className="fa-solid fa-coins sonic-exact-header-icon"></i>
                      <span className="sonic-exact-header-title">
                        {lang === 'am' ? 'የማውጣት መጠን' : 'Withdrawal Amount'}
                      </span>
                    </div>
                    <div className="sonic-exact-input-container">
                      <div className="sonic-exact-amount-leading">
                        <span className="sonic-exact-coin-badge">🪙</span>
                        <span className="sonic-exact-currency-prefix">ETB</span>
                      </div>
                      <input
                        type="number"
                        value={withdrawAmount || ''}
                        onChange={e => setWithdrawAmount(Number(e.target.value))}
                        placeholder="200"
                        min={50}
                        max={2000}
                        className="sonic-exact-amount-field"
                        required
                      />
                    </div>

                    {/* 4 Quick Amount Chips */}
                    <div className="sonic-exact-chips-row">
                      {[100, 200, 500, 1000].map(amt => (
                        <button
                          key={amt}
                          type="button"
                          className={`sonic-exact-chip-btn ${withdrawAmount === amt ? 'active' : ''}`}
                          onClick={() => setWithdrawAmount(amt)}
                        >
                          {amt === 1000 ? '1,000' : amt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Action Button 1: Request Payout (Exact Image Match) */}
                  <button
                    type="submit"
                    className="sonic-exact-payout-btn"
                    disabled={
                      isSubmittingWithdraw ||
                      withdrawAmount < 50 ||
                      withdrawAmount > 2000 ||
                      withdrawAmount > balance ||
                      (withdrawalEligibility !== null && !withdrawalEligibility.eligible)
                    }
                  >
                    {isSubmittingWithdraw ? (
                      <>
                        <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>
                        <span>{lang === 'am' ? 'በመላክ ላይ...' : 'Submitting Payout Request...'}</span>
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-paper-plane sonic-exact-payout-icon"></i>
                        <span>
                          {lang === 'am'
                            ? `የ${withdrawAmount > 0 ? withdrawAmount : 200} ብር ወጪ ይጠይቁ`
                            : `Request ${withdrawAmount > 0 ? withdrawAmount : 200} ETB Payout`}
                        </span>
                      </>
                    )}
                  </button>

                  {/* Action Button 2: Need Support (Strictly routes to @Sonicbingo_support) */}
                  <button
                    type="button"
                    className="sonic-exact-support-btn"
                    onClick={() => {
                      const supportUrl = 'https://t.me/Sonicbingo_support';
                      if (window.Telegram?.WebApp?.openTelegramLink) {
                        window.Telegram.WebApp.openTelegramLink(supportUrl);
                      } else {
                        window.open(supportUrl, '_blank');
                      }
                    }}
                  >
                    <i className="fa-solid fa-headset sonic-exact-support-icon"></i>
                    <span>{lang === 'am' ? 'እርዳታ ይፈልጋሉ (Support)' : 'Need Support'}</span>
                  </button>
                </form>
              )}
            </div>
          )}
      </div>
    </div>
  );
};
