import React, { useState, useEffect } from 'react';
import { useWallet } from '../context/WalletContext.tsx';
import { useApp } from '../context/AppContext.tsx';
import { useAdmin } from '../context/AdminContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useLanguage } from '../context/LanguageContext.tsx';
import { TelebirrLogo, CBELogo, MpesaLogo } from '../components/wallet/PaymentLogos.tsx';
import { LanguageDropdown } from '../components/common/LanguageDropdown.tsx';
import { apiClient } from '../services/apiClient.ts';
import { socketService } from '../services/socketService.ts';
import {
  CBE_BIRR_RECEIVER,
  getCurrentTelebirrReceiver,
  rotateTelebirrReceiver,
  toggleTelebirrReceiver,
  PaymentReceiver
} from '../config/paymentReceivers.ts';

export interface DepositPageProps {
  initialTab?: 'deposit' | 'withdraw';
}

export const DepositPage: React.FC<DepositPageProps> = ({ initialTab = 'deposit' }) => {
  const { balance } = useWallet();
  const { switchPage, showToast } = useApp();
  const { addDepositRequest } = useAdmin();
  const { user, updateProfile } = useAuth();
  const { t, lang } = useLanguage();

  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>(initialTab);
  const [selectedMethod, setSelectedMethod] = useState<'Telebirr' | 'CBE' | 'Agent'>('Telebirr');
  const [telebirrReceiver, setTelebirrReceiver] = useState<PaymentReceiver>(() => getCurrentTelebirrReceiver());
  const [amount, setAmount] = useState<number>(100);
  const [playerPhone, setPlayerPhone] = useState<string>(() => {
    const attached = user?.attachedAccounts || [];
    const def = attached.find(a => a.type === 'Telebirr' && a.isDefault) || attached.find(a => a.type === 'Telebirr');
    return def?.accountNumber || user?.nationalPhone || user?.phone || '';
  });
  const [transactionRef, setTransactionRef] = useState<string>('');
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [submittedRef, setSubmittedRef] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Active Authorized Agents for In-Person / Online Deposit & Cashout (Dynamic Multi-Rail)
  const [activeAgents, setActiveAgents] = useState<Array<{
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
  }>>([]);

  // Interactive Agent Deposit Flow State
  const [selectedAgent, setSelectedAgent] = useState<{
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
  } | null>(null);
  const [agentDepositAmount, setAgentDepositAmount] = useState<number>(100);
  const [agentPaymentRail, setAgentPaymentRail] = useState<'Telebirr' | 'CBE' | 'M-Pesa'>('Telebirr');
  const [agentSenderPhone, setAgentSenderPhone] = useState<string>(() => user?.phone || user?.nationalPhone || '');
  const [agentTxRef, setAgentTxRef] = useState<string>('');
  const [agentReceiptImage, setAgentReceiptImage] = useState<string | null>(null);
  const [isSubmittingAgentDeposit, setIsSubmittingAgentDeposit] = useState<boolean>(false);
  const [activeAgentRequest, setActiveAgentRequest] = useState<any | null>(null);

  // --- Unified Agent Withdrawal State (P2P Decentralized Cashier) ---
  const [withdrawAmount, setWithdrawAmount] = useState<number>(200);
  const [withdrawMethod, setWithdrawMethod] = useState<'Telebirr' | 'CBE' | 'M-Pesa'>('Telebirr');
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
  } | null>(null);
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState<boolean>(false);
  const [activeWithdrawalRequest, setActiveWithdrawalRequest] = useState<any | null>(null);

  // Dynamic selection handlers ensuring rail compatibility
  const handleSelectDepositAgent = (ag: any) => {
    setSelectedAgent(ag);
    const supported: string[] = ag.supportedRails && ag.supportedRails.length > 0
      ? ag.supportedRails
      : [
          ...(ag.telebirrPhone ? ['Telebirr'] : []),
          ...(ag.cbeAccount ? ['CBE'] : []),
          ...(ag.mpesaPhone ? ['M-Pesa'] : [])
        ];
    if (!supported.includes(agentPaymentRail)) {
      setAgentPaymentRail((supported[0] as 'Telebirr' | 'CBE' | 'M-Pesa') || 'Telebirr');
    }
  };

  const handleSelectWithdrawAgent = (ag: any) => {
    setSelectedWithdrawAgent(ag);
    const supported: string[] = ag.supportedRails && ag.supportedRails.length > 0
      ? ag.supportedRails
      : [
          ...(ag.telebirrPhone ? ['Telebirr'] : []),
          ...(ag.cbeAccount ? ['CBE'] : []),
          ...(ag.mpesaPhone ? ['M-Pesa'] : [])
        ];
    if (!supported.includes(withdrawMethod)) {
      setWithdrawMethod((supported[0] as 'Telebirr' | 'CBE' | 'M-Pesa') || 'Telebirr');
    }
  };

  // Load active agents & existing pending requests for both Deposit & Withdrawal
  const loadAgentData = async () => {
    try {
      const [agentsRes, myReqsRes, myWithRes] = await Promise.all([
        apiClient.wallet.getActiveAgents(),
        apiClient.wallet.getMyAgentDeposits(),
        apiClient.wallet.getMyAgentWithdrawals()
      ]);

      if (agentsRes.success && agentsRes.agents) {
        setActiveAgents(agentsRes.agents);
        if (agentsRes.agents.length > 0 && !selectedAgent) {
          handleSelectDepositAgent(agentsRes.agents[0]);
        }
        if (agentsRes.agents.length > 0 && !selectedWithdrawAgent) {
          handleSelectWithdrawAgent(agentsRes.agents[0]);
        }
      }

      if (myReqsRes.success && myReqsRes.requests && myReqsRes.requests.length > 0) {
        const pending = myReqsRes.requests.find(r => r.status === 'pending');
        if (pending) {
          setActiveAgentRequest(pending);
        }
      }

      if (myWithRes.success && myWithRes.requests && myWithRes.requests.length > 0) {
        const pendingWith = myWithRes.requests.find(r => r.status === 'pending');
        if (pendingWith) {
          setActiveWithdrawalRequest(pendingWith);
        }
      }
    } catch (err) {
      console.warn('Failed to load agent cashier data:', err);
    }
  };

  useEffect(() => {
    loadAgentData();
  }, []);

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
      apiClient.wallet.getBalance().then(res => {
        if (res.success) {
          window.dispatchEvent(new CustomEvent('lb_wallet_updated', { detail: res }));
        }
      }).catch(err => console.warn(err));
    });

    const unsubWithRejected = socketService.on(`user_${user.id}_withdrawal_rejected`, (data: any) => {
      showToast(`❌ ${lang === 'am' ? 'የማውጣት ጥያቄ አልተሳካም' : 'Withdrawal Rejected'}: ${data.reason}`);
      setActiveWithdrawalRequest(null);
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

  // Auto-fill from user's attached accounts or profile when method changes
  useEffect(() => {
    if (selectedMethod === 'Agent') return;
    const attached = user?.attachedAccounts || [];
    const matching = attached.find(a => a.type === selectedMethod && a.isDefault) ||
                     attached.find(a => a.type === selectedMethod);
    if (matching) {
      setPlayerPhone(matching.accountNumber);
    } else if (selectedMethod === 'Telebirr' && (user?.nationalPhone || user?.phone)) {
      setPlayerPhone(user.nationalPhone || user.phone);
    }
  }, [selectedMethod, user?.attachedAccounts, user?.nationalPhone, user?.phone]);

  const matchingAttachedAccounts = (user?.attachedAccounts || []).filter(a => a.type === selectedMethod);

  // Active Receiver Details (CBE Birr or Alternating Telebirr)
  const activeReceiver = selectedMethod === 'Telebirr' ? telebirrReceiver : CBE_BIRR_RECEIVER;
  const activeReceiverNumber = activeReceiver.accountNumber;
  const receiverName = activeReceiver.accountName;
  const receiverServiceName = activeReceiver.serviceName;
  const quickAmounts = [50, 100, 200, 500, 1000, 5000];

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`📋 ${t('common.copied')}: ${label}`);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          const compressed = canvas.toDataURL('image/jpeg', 0.6);
          setReceiptImage(compressed);
          showToast(lang === 'am' ? '📸 ደረሰኝ ተያይዟል' : '📸 Receipt screenshot attached');
        };
        img.src = rawResult;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (amount < 50) {
      showToast(lang === 'am' ? '⚠️ ዝቅተኛ የተቀማጭ መጠን 50 ብር ነው።' : '⚠️ Minimum deposit amount is 50 ETB.');
      return;
    }

    if (!playerPhone || playerPhone.trim().length < 9) {
      showToast(lang === 'am' ? '⚠️ እባክዎ ትክክለኛ ስልክ ቁጥር ያስገቡ።' : '⚠️ Please enter a valid phone number.');
      return;
    }

    setIsSubmitting(true);
    try {
      const cleanRef = transactionRef?.trim() || `TX-${selectedMethod === 'Telebirr' ? 'TB' : 'CBE'}-${Math.floor(100000 + Math.random() * 900000)}`;

      const res = await apiClient.wallet.deposit({
        amount,
        paymentMethod: selectedMethod as 'Telebirr' | 'CBE',
        playerPhone: playerPhone.trim(),
        transactionRef: cleanRef,
        receiptImage: receiptImage || undefined
      });

      if (!res.success) {
        showToast(`❌ ${(res as any).error || (res as any).message || (lang === 'am' ? 'የተቀማጭ ጥያቄ አልተሳካም' : 'Deposit request failed')}`);
        return;
      }

      addDepositRequest(
        user?.id || 'usr-me',
        user?.fullName || 'Player',
        playerPhone.trim(),
        amount,
        selectedMethod as any,
        cleanRef,
        receiptImage || undefined
      );

      setSubmittedRef(cleanRef);
      setIsSubmitted(true);

      if (playerPhone && playerPhone.trim().length >= 9 && (selectedMethod === 'Telebirr' || selectedMethod === 'CBE')) {
        const clean = playerPhone.trim();
        const attached = user?.attachedAccounts || [];
        if (!attached.some(a => a.accountNumber === clean)) {
          const newAcc = {
            id: `acc-${Date.now()}`,
            type: selectedMethod,
            name: `${user?.fullName || 'Player'} (${selectedMethod})`,
            accountNumber: clean,
            isDefault: attached.length === 0,
            isVerified: true
          };
          updateProfile({ attachedAccounts: [...attached, newAcc] });
        }
      }

      if (selectedMethod === 'Telebirr') {
        const next = rotateTelebirrReceiver();
        setTelebirrReceiver(next);
      }
      showToast(lang === 'am' ? `✅ የ${amount} ብር ተቀማጭ ጥያቄ ተልኳል!` : `✅ Deposit request of ${amount} ETB submitted!`);
    } catch (err: any) {
      console.warn('Backend deposit error:', err);
      showToast(`❌ ${err.message || (lang === 'am' ? 'የተቀማጭ ጥያቄ አልተሳካም' : 'Deposit request failed')}`);
    } finally {
      setIsSubmitting(false);
    }
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
    if (agentDepositAmount < 50) {
      showToast(lang === 'am' ? '⚠️ ዝቅተኛ የተቀማጭ መጠን 50 ብር ነው' : '⚠️ Minimum deposit is 50 ETB');
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

  const handleWithdrawViaAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWithdrawAgent) {
      showToast(lang === 'am' ? '⚠️ እባክዎ ክፍያ የሚፈጽምልዎ ኤጀንት ይምረጡ' : '⚠️ Please select an active online agent');
      return;
    }
    if (withdrawAmount < 50) {
      showToast(lang === 'am' ? '⚠️ ዝቅተኛ የማውጣት መጠን 50 ብር ነው' : '⚠️ Minimum withdrawal is 50 ETB');
      return;
    }
    if (withdrawAmount > 5000) {
      showToast(lang === 'am' ? '⚠️ ከፍተኛ የማውጣት መጠን 5,000 ብር ነው' : '⚠️ Maximum withdrawal is 5,000 ETB');
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
      const res = await apiClient.wallet.withdrawViaAgent({
        agentId: selectedWithdrawAgent.id,
        amount: withdrawAmount,
        payoutMethod: withdrawMethod,
        payoutAccount: withdrawAccount.trim(),
        payoutAccountName: withdrawAccountName.trim()
      });

      if (res.success && res.request) {
        setActiveWithdrawalRequest(res.request);
        showToast(lang === 'am' ? '✅ የማውጣት ጥያቄ ተልኳል!' : '✅ Withdrawal request submitted to agent!');
      }
    } catch (err: any) {
      showToast(`❌ ${err.message || 'Withdrawal request failed'}`);
    } finally {
      setIsSubmittingWithdraw(false);
    }
  };

  const handleCancelWithdrawal = async (reqId: string) => {
    try {
      const res = await apiClient.wallet.cancelAgentWithdrawal(reqId);
      if (res.success) {
        setActiveWithdrawalRequest(null);
        showToast(lang === 'am' ? '✅ ጥያቄው ተሰርዟል! ገንዘቡ ተመልሷል' : '✅ Request cancelled! Escrow refunded to balance');
      }
    } catch (err: any) {
      showToast(`❌ ${err.message || 'Failed to cancel'}`);
    }
  };

  return (
    <div className="page active page-subpage-fresh" id="page-deposit">
      {/* Clean Inline Page Navigation Header */}
      <div className="subpage-inline-nav-row">
        <button
          type="button"
          className="btn-subpage-back-pill"
          onClick={() => switchPage('wallet')}
          title="Back to Wallet"
        >
          <i className="fa-solid fa-arrow-left"></i>
          <span>{lang === 'am' ? 'ወደ ዋሌት' : 'Back to Wallet'}</span>
        </button>

        <h1 className="subpage-main-heading">
          {activeTab === 'deposit'
            ? (lang === 'am' ? 'ገንዘብ አስገባ (ካሺየር)' : 'Deposit Funds')
            : (lang === 'am' ? 'ገንዘብ አውጣ (ካሺየር)' : 'Withdraw via Agent')}
        </h1>
      </div>

      <div className="subpage-scroll-content">
        {/* Top Segmented Cashier Navigation: Deposit vs Withdraw */}
        <div style={{
          display: 'flex',
          background: '#e2e8f0',
          borderRadius: '14px',
          padding: '4px',
          marginBottom: '16px',
          maxWidth: '480px',
          marginLeft: 'auto',
          marginRight: 'auto',
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.06)'
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('deposit')}
            style={{
              flex: 1,
              padding: '11px 16px',
              border: 'none',
              borderRadius: '10px',
              background: activeTab === 'deposit' ? '#ffffff' : 'transparent',
              color: activeTab === 'deposit' ? '#047857' : '#64748b',
              fontWeight: 800,
              fontSize: '13px',
              boxShadow: activeTab === 'deposit' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
          >
            <span>📥</span>
            <span>{lang === 'am' ? 'ገንዘብ አስገባ' : 'Deposit Funds'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('withdraw')}
            style={{
              flex: 1,
              padding: '11px 16px',
              border: 'none',
              borderRadius: '10px',
              background: activeTab === 'withdraw' ? '#ffffff' : 'transparent',
              color: activeTab === 'withdraw' ? '#b45309' : '#64748b',
              fontWeight: 800,
              fontSize: '13px',
              boxShadow: activeTab === 'withdraw' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
          >
            <span>📤</span>
            <span>{lang === 'am' ? 'ገንዘብ አውጣ' : 'Withdraw via Agent'}</span>
          </button>
        </div>

        {activeTab === 'deposit' && (
          <div className="fresh-cashier-card-shell">
          {isSubmitted ? (
            /* Success Confirmation View */
            <div className="payment-success-content">
              <div className="success-icon-circle green">
                <i className="fa-solid fa-check"></i>
              </div>

              <h3 className="success-main-title">
                {lang === 'am' ? 'የተቀማጭ ጥያቄ ደርሶናል!' : 'Deposit Request Received!'}
              </h3>
              <p className="success-subtext">
                {lang === 'am' ? (
                  <>የ<strong>{amount.toFixed(2)} ብር</strong> በ<strong>{selectedMethod}</strong> ተቀማጭ ጥያቄዎ በካሳችን እየተረጋገጠ ነው።</>
                ) : (
                  <>Your deposit of <strong>{amount.toFixed(2)} ETB</strong> via <strong>{selectedMethod}</strong> is being verified by our automated cashier desk.</>
                )}
              </p>

              <div className="success-ref-box">
                <span className="ref-box-lbl">{lang === 'am' ? 'የግብይት መለያ ቁጥር' : 'TRANSACTION ID'}</span>
                <strong className="ref-box-val">{submittedRef}</strong>
                <button
                  type="button"
                  className="btn-copy-ref-success"
                  onClick={() => handleCopy(submittedRef, 'Transaction ID')}
                >
                  <i className="fa-regular fa-copy"></i> {t('common.copy')}
                </button>
              </div>

              <div className="success-eta-tag">
                <i className="fa-solid fa-bolt gold"></i>
                <span>{lang === 'am' ? 'አማካይ የማረጋገጫ ጊዜ፡ ' : 'Average verification time: '}<strong>~30 {lang === 'am' ? 'ሰከንዶች' : 'seconds'}</strong></span>
              </div>

              <div className="success-actions-row">
                <button
                  type="button"
                  className="btn-payment-action-gold"
                  onClick={() => switchPage('wallet')}
                >
                  <span>{lang === 'am' ? 'በተቀማጭ ታሪክ እይ' : 'View in Deposit History'}</span>
                  <i className="fa-solid fa-arrow-right"></i>
                </button>

                <button
                  type="button"
                  className="btn-payment-action-outline"
                  onClick={() => switchPage('games')}
                >
                  <span>{lang === 'am' ? 'ወደ ጨዋታ ተመለስ' : 'Return to Games'}</span>
                </button>
              </div>
            </div>
          ) : (
            /* Deposit Form */
            <div className="payment-modal-form">
              {/* 1. Payment Method Selection */}
              <div className="form-section-block">
                <label className="form-section-label">
                  <span className="step-num">1</span> {lang === 'am' ? 'የመክፈያ መንገድ ይምረጡ' : 'Choose Payment Method'}
                </label>

                <div className="payment-method-selector-grid">
                  <button
                    type="button"
                    className={`btn-payment-method-card ${selectedMethod === 'Telebirr' ? 'active' : ''}`}
                    onClick={() => setSelectedMethod('Telebirr')}
                  >
                    <div className="method-logo-wrap">
                      <TelebirrLogo size={26} />
                    </div>
                    <div className="method-text-col">
                      <strong className="method-name">Telebirr</strong>
                      <span className="method-badge-fast">{lang === 'am' ? '⚡ ፈጣን' : '⚡ Instant'}</span>
                    </div>
                    <div className="method-radio-circ">
                      {selectedMethod === 'Telebirr' && <div className="radio-dot"></div>}
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`btn-payment-method-card ${selectedMethod === 'CBE' ? 'active' : ''}`}
                    onClick={() => setSelectedMethod('CBE')}
                  >
                    <div className="method-logo-wrap">
                      <CBELogo size={26} />
                    </div>
                    <div className="method-text-col">
                      <strong className="method-name">CBE Bank</strong>
                      <span className="method-badge-fast">CBE Birr / Bank</span>
                    </div>
                    <div className="method-radio-circ">
                      {selectedMethod === 'CBE' && <div className="radio-dot"></div>}
                    </div>
                  </button>

                  {/* 3rd Method: Via Local Agent */}
                  <button
                    type="button"
                    className={`btn-payment-method-card ${selectedMethod === 'Agent' ? 'active' : ''}`}
                    onClick={() => setSelectedMethod('Agent')}
                  >
                    <div className="method-logo-wrap" style={{ background: '#f59e0b', color: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}>
                      <i className="fa-solid fa-user-tie" style={{ fontSize: '18px' }}></i>
                    </div>
                    <div className="method-text-col">
                      <strong className="method-name">{lang === 'am' ? 'በኤጀንት በኩል' : 'Via Local Agent'}</strong>
                      <span className="method-badge-fast" style={{ color: '#fbbf24' }}>
                        {lang === 'am' ? 'በጥሬ ገንዘብ / ቴሌብር' : 'Cash / Telebirr Instant'}
                      </span>
                    </div>
                    <div className="method-radio-circ">
                      {selectedMethod === 'Agent' && <div className="radio-dot"></div>}
                    </div>
                  </button>
                </div>
              </div>

              {/* 2. INTERACTIVE DECENTRALIZED AGENT DEPOSIT VIEW */}
              {selectedMethod === 'Agent' ? (
                <div style={{ marginTop: '16px' }} className="space-y-4">
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
                        overflow: 'hidden'
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
                              background: 'rgba(16, 185, 129, 0.15)',
                              border: '2px solid #10b981',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '32px'
                            }}
                          >
                            ✅
                          </div>
                        ) : activeAgentRequest.status === 'rejected' ? (
                          <div
                            style={{
                              width: '70px',
                              height: '70px',
                              margin: '0 auto 12px',
                              borderRadius: '50%',
                              background: 'rgba(239, 68, 68, 0.15)',
                              border: '2px solid #ef4444',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '32px'
                            }}
                          >
                            ❌
                          </div>
                        ) : (
                          <div
                            style={{
                              width: '70px',
                              height: '70px',
                              margin: '0 auto 12px',
                              borderRadius: '50%',
                              background: 'rgba(245, 158, 11, 0.15)',
                              border: '2px solid #f59e0b',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '32px',
                              animation: 'pulse 2s infinite'
                            }}
                          >
                            ⏳
                          </div>
                        )}

                        <h3
                          style={{
                            fontSize: '20px',
                            fontWeight: 900,
                            color: activeAgentRequest.status === 'approved'
                              ? '#10b981'
                              : activeAgentRequest.status === 'rejected'
                              ? '#ef4444'
                              : '#fbbf24',
                            margin: 0
                          }}
                        >
                          {activeAgentRequest.status === 'approved'
                            ? (lang === 'am' ? 'ተቀማጭዎ ጸድቆ ገቢ ሆኗል!' : 'Deposit Verified & Credited!')
                            : activeAgentRequest.status === 'rejected'
                            ? (lang === 'am' ? 'ተቀማጭዎ አልጸደቀም' : 'Deposit Request Rejected')
                            : (lang === 'am' ? 'የኤጀንቱን ማረጋገጫ በመጠበቅ ላይ...' : 'Awaiting Agent Approval...')}
                        </h3>
                        <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0 0' }}>
                          {activeAgentRequest.status === 'approved'
                            ? (lang === 'am' ? 'ገንዘቡ ወዲያውኑ ወደ ዋሌትዎ ገቢ ተደርጓል።' : 'Funds have been credited directly to your gaming wallet.')
                            : activeAgentRequest.status === 'rejected'
                            ? (activeAgentRequest.rejectionReason || (lang === 'am' ? 'ክፍያው በኤጀንቱ አልተረጋገጠም።' : 'Payment could not be verified by the agent.'))
                            : (lang === 'am' ? 'ኤጀንቱ በሞባይል ተርሚናላቸው የኤስኤምኤስ ክፍያውን እያረጋገጡ ነው።' : 'The agent is checking the SMS receipt on their mobile terminal.')}
                        </p>
                      </div>

                      {/* Transaction Summary Card */}
                      <div
                        style={{
                          background: '#1e293b',
                          border: '1px solid #334155',
                          borderRadius: '14px',
                          padding: '16px',
                          marginBottom: '20px',
                          textAlign: 'left'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                          <span style={{ color: '#94a3b8' }}>{lang === 'am' ? 'የተመረጠው ኤጀንት፡' : 'Selected Agent:'}</span>
                          <span style={{ fontWeight: 800, color: '#f8fafc' }}>
                            👑 {activeAgentRequest.agentDisplayName || `Sonic Agent #${activeAgentRequest.agentCode || 'AGT'}`}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                          <span style={{ color: '#94a3b8' }}>{lang === 'am' ? 'የተቀማጭ መጠን፡' : 'Deposit Amount:'}</span>
                          <span style={{ fontWeight: 900, color: '#10b981', fontSize: '15px' }}>
                            +{activeAgentRequest.amount} ETB
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                          <span style={{ color: '#94a3b8' }}>{lang === 'am' ? 'የግብይት መለያ (SMS Code)፡' : 'Transaction Code:'}</span>
                          <span style={{ fontWeight: 800, fontFamily: 'monospace', color: '#fbbf24' }}>
                            {activeAgentRequest.transactionCode}
                          </span>
                        </div>
                        {activeAgentRequest.status === 'approved' && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid #334155', fontSize: '13px' }}>
                            <span style={{ color: '#94a3b8' }}>{lang === 'am' ? 'የተሸለሙት ሳንቲሞች፡' : 'Loyalty Coins Earned:'}</span>
                            <span style={{ fontWeight: 900, color: '#fbbf24' }}>
                              🪙 +{activeAgentRequest.coinsAwarded || Math.round(activeAgentRequest.amount * 1.5)} Coins
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {activeAgentRequest.status === 'approved' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => switchPage('games')}
                              className="btn-submit-payment-gold"
                              style={{ width: '100%', padding: '14px', fontSize: '15px' }}
                            >
                              <span>🎮 {lang === 'am' ? 'ወደ ቢንጎ ጨዋታ ይሂዱ' : 'Play Sonic Bingo Now'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveAgentRequest(null)}
                              style={{
                                background: 'transparent',
                                border: '1px solid #475569',
                                color: '#94a3b8',
                                padding: '10px',
                                borderRadius: '10px',
                                fontSize: '13px',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              {lang === 'am' ? 'አዲስ ተቀማጭ ያድርጉ' : 'Make Another Deposit'}
                            </button>
                          </>
                        ) : activeAgentRequest.status === 'rejected' ? (
                          <button
                            type="button"
                            onClick={() => setActiveAgentRequest(null)}
                            className="btn-submit-payment-gold"
                            style={{ width: '100%', padding: '14px', fontSize: '14px' }}
                          >
                            <span>🔄 {lang === 'am' ? 'እንደገና ይሞክሩ' : 'Try Again / Submit New Request'}</span>
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
                    /* CASE B: INTERACTIVE AGENT DEPOSIT FORM */
                    <form onSubmit={handleAgentDepositSubmit} className="space-y-4">
                      {/* Step 1: Agent Selection Grid (Strict Anonymity) */}
                      <div className="form-section-block">
                        <div className="section-label-row">
                          <label className="form-section-label">
                            <span className="step-num">1</span> {lang === 'am' ? 'የተረጋገጠ ኤጀንት ይምረጡ' : 'Select Certified Agent'}
                          </label>
                          <span className="min-limit-sub" style={{ color: '#10b981', fontWeight: 800 }}>
                            🟢 {activeAgents.length} {lang === 'am' ? 'ኤጀንቶች በመስመር ላይ' : 'Agents Online'}
                          </span>
                        </div>

                        {activeAgents.length === 0 ? (
                          <div style={{ background: '#1e293b', border: '1px dashed #475569', borderRadius: '12px', padding: '18px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                            {lang === 'am' ? 'በአሁኑ ሰዓት በመስመር ላይ የሚገኝ ኤጀንት የለም። እባክዎ ከላይ በቀጥታ ቴሌብር ይጠቀሙ።' : 'No agents currently online. Please use Direct Telebirr / CBE above.'}
                          </div>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
                            {activeAgents.map(a => {
                              const isSelected = selectedAgent?.agentCode === a.agentCode;
                              const rails = a.supportedRails && a.supportedRails.length > 0
                                ? a.supportedRails
                                : [
                                    ...(a.telebirrPhone ? ['Telebirr'] : []),
                                    ...(a.cbeAccount ? ['CBE'] : []),
                                    ...(a.mpesaPhone ? ['M-Pesa'] : [])
                                  ];
                              return (
                                <div
                                  key={a.agentCode}
                                  onClick={() => handleSelectDepositAgent(a)}
                                  style={{
                                    background: isSelected ? 'rgba(245, 158, 11, 0.08)' : '#0f172a',
                                    border: isSelected ? '2px solid #f59e0b' : '1px solid #334155',
                                    borderRadius: '14px',
                                    padding: '14px',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                    position: 'relative'
                                  }}
                                >
                                  {/* Top Row: Unique Code + Online Badge */}
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span style={{ fontSize: '18px' }}>👑</span>
                                      <strong style={{ fontSize: '14px', color: '#f8fafc', fontWeight: 800 }}>
                                        Sonic Agent #{a.agentCode}
                                      </strong>
                                    </div>
                                    <span
                                      style={{
                                        background: 'rgba(16, 185, 129, 0.15)',
                                        color: '#10b981',
                                        border: '1px solid rgba(16, 185, 129, 0.3)',
                                        padding: '2px 8px',
                                        borderRadius: '9999px',
                                        fontSize: '10px',
                                        fontWeight: 800
                                      }}
                                    >
                                      🟢 Online
                                    </span>
                                  </div>

                                  {/* Active Rails Mini Badges */}
                                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                                    {rails.map(r => (
                                      <span
                                        key={r}
                                        style={{
                                          fontSize: '10px',
                                          fontWeight: 700,
                                          padding: '2px 6px',
                                          borderRadius: '6px',
                                          background: r === 'Telebirr' ? 'rgba(56, 189, 248, 0.15)' : r === 'CBE' ? 'rgba(234, 179, 8, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                          color: r === 'Telebirr' ? '#38bdf8' : r === 'CBE' ? '#eab308' : '#10b981',
                                          border: `1px solid ${r === 'Telebirr' ? 'rgba(56, 189, 248, 0.3)' : r === 'CBE' ? 'rgba(234, 179, 8, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
                                        }}
                                      >
                                        {r === 'Telebirr' ? '📱 Telebirr' : r === 'CBE' ? '🏦 CBE Bank' : '🟢 M-Pesa'}
                                      </span>
                                    ))}
                                  </div>

                                  {/* Payment Rails Details */}
                                  <div style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {a.telebirrPhone && (
                                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Telebirr:</span>
                                        <span style={{ fontFamily: 'monospace', color: '#f1f5f9', fontWeight: 700 }}>
                                          {a.telebirrPhone} {a.telebirrName ? `(${a.telebirrName})` : ''}
                                        </span>
                                      </div>
                                    )}
                                    {a.cbeAccount && (
                                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>CBE Bank:</span>
                                        <span style={{ fontFamily: 'monospace', color: '#f1f5f9', fontWeight: 700 }}>
                                          {a.cbeAccount} {a.cbeName ? `(${a.cbeName})` : ''}
                                        </span>
                                      </div>
                                    )}
                                    {a.mpesaPhone && (
                                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>M-Pesa:</span>
                                        <span style={{ fontFamily: 'monospace', color: '#f1f5f9', fontWeight: 700 }}>
                                          {a.mpesaPhone} {a.mpesaName ? `(${a.mpesaName})` : ''}
                                        </span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Selected Checkmark */}
                                  {isSelected && (
                                    <div
                                      style={{
                                        position: 'absolute',
                                        top: '10px',
                                        right: '10px',
                                        width: '18px',
                                        height: '18px',
                                        borderRadius: '50%',
                                        background: '#f59e0b',
                                        color: '#000000',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '11px',
                                        fontWeight: 900
                                      }}
                                    >
                                      ✓
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Step 2: Amount Selection & 1.5x Coins Preview */}
                      <div className="form-section-block">
                        <div className="section-label-row">
                          <label className="form-section-label">
                            <span className="step-num">2</span> {lang === 'am' ? 'የተቀማጭ መጠን' : 'Deposit Amount'}
                          </label>
                          <span className="min-limit-sub">{lang === 'am' ? 'ዝቅተኛ፡ 50 ብር' : 'Min: 50 ETB'}</span>
                        </div>

                        <div className="amount-preset-chips-grid">
                          {quickAmounts.map(chip => (
                            <button
                              key={chip}
                              type="button"
                              className={`btn-amount-chip ${agentDepositAmount === chip ? 'active' : ''}`}
                              onClick={() => setAgentDepositAmount(chip)}
                            >
                              {chip} ETB
                            </button>
                          ))}
                        </div>

                        <div className="amount-numeric-input-wrap">
                          <span className="currency-tag">ETB</span>
                          <input
                            type="number"
                            min="50"
                            max="100000"
                            value={agentDepositAmount || ''}
                            onChange={e => setAgentDepositAmount(Number(e.target.value))}
                            placeholder={lang === 'am' ? 'መጠን ያስገቡ' : 'Enter amount'}
                            required
                          />
                        </div>

                        {/* 1.5x Coin Reward Banner */}
                        <div
                          style={{
                            marginTop: '10px',
                            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(16, 185, 129, 0.15))',
                            border: '1px solid #f59e0b',
                            borderRadius: '12px',
                            padding: '10px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px'
                          }}
                        >
                          <span style={{ fontSize: '20px' }}>🪙</span>
                          <span style={{ fontSize: '12px', color: '#f1f5f9' }}>
                            <strong style={{ color: '#fbbf24' }}>
                              +{Math.round((agentDepositAmount || 0) * 1.5)} {lang === 'am' ? 'የሎያሊቲ ሳንቲሞች' : 'Sonic Coins'}
                            </strong>{' '}
                            {lang === 'am' ? 'በቅጽበት ይሸለማሉ!' : 'will be awarded on verification!'}
                          </span>
                        </div>
                      </div>

                      {/* Step 3: Payment Instructions to Selected Agent */}
                      {selectedAgent && (
                        <div className="form-section-block">
                          <label className="form-section-label">
                            <span className="step-num">3</span> {lang === 'am' ? 'ክፍያውን ለኤጀንቱ ይላኩ' : 'Transfer Payment to Agent'}
                          </label>

                          {/* Dynamic Rails for Selected Agent: Telebirr, CBE Bank, M-Pesa */}
                          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                            {Boolean(selectedAgent.telebirrPhone || selectedAgent.supportedRails?.includes('Telebirr')) && (
                              <button
                                type="button"
                                onClick={() => setAgentPaymentRail('Telebirr')}
                                style={{
                                  flex: 1,
                                  padding: '9px 12px',
                                  borderRadius: '10px',
                                  border: agentPaymentRail === 'Telebirr' ? '2px solid #38bdf8' : '1px solid #334155',
                                  background: agentPaymentRail === 'Telebirr' ? 'rgba(56, 189, 248, 0.15)' : '#0f172a',
                                  color: agentPaymentRail === 'Telebirr' ? '#38bdf8' : '#94a3b8',
                                  fontWeight: 800,
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '6px'
                                }}
                              >
                                <TelebirrLogo size={18} />
                                <span>Telebirr</span>
                              </button>
                            )}

                            {Boolean(selectedAgent.cbeAccount || selectedAgent.supportedRails?.includes('CBE')) && (
                              <button
                                type="button"
                                onClick={() => setAgentPaymentRail('CBE')}
                                style={{
                                  flex: 1,
                                  padding: '9px 12px',
                                  borderRadius: '10px',
                                  border: agentPaymentRail === 'CBE' ? '2px solid #eab308' : '1px solid #334155',
                                  background: agentPaymentRail === 'CBE' ? 'rgba(234, 179, 8, 0.15)' : '#0f172a',
                                  color: agentPaymentRail === 'CBE' ? '#eab308' : '#94a3b8',
                                  fontWeight: 800,
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '6px'
                                }}
                              >
                                <CBELogo size={18} />
                                <span>CBE Bank</span>
                              </button>
                            )}

                            {Boolean(selectedAgent.mpesaPhone || selectedAgent.supportedRails?.includes('M-Pesa')) && (
                              <button
                                type="button"
                                onClick={() => setAgentPaymentRail('M-Pesa')}
                                style={{
                                  flex: 1,
                                  padding: '9px 12px',
                                  borderRadius: '10px',
                                  border: agentPaymentRail === 'M-Pesa' ? '2px solid #10b981' : '1px solid #334155',
                                  background: agentPaymentRail === 'M-Pesa' ? 'rgba(16, 185, 129, 0.15)' : '#0f172a',
                                  color: agentPaymentRail === 'M-Pesa' ? '#10b981' : '#94a3b8',
                                  fontWeight: 800,
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '6px'
                                }}
                              >
                                <MpesaLogo size={18} />
                                <span>M-Pesa</span>
                              </button>
                            )}
                          </div>

                          <div className="deposit-receiver-callout">
                            <div className="receiver-top-row">
                              <span className="receiver-provider-tag">
                                👑 Sonic Agent #{selectedAgent.agentCode} • {agentPaymentRail === 'CBE' ? 'CBE Bank' : agentPaymentRail}
                              </span>
                              <button
                                type="button"
                                className="btn-copy-receiver"
                                onClick={() => {
                                  const num = agentPaymentRail === 'Telebirr'
                                    ? (selectedAgent.telebirrPhone || selectedAgent.phone)
                                    : agentPaymentRail === 'CBE'
                                    ? selectedAgent.cbeAccount
                                    : (selectedAgent.mpesaPhone || selectedAgent.phone);
                                  handleCopy(num, `${agentPaymentRail} Number`);
                                }}
                              >
                                <i className="fa-regular fa-copy"></i> {t('common.copy')}
                              </button>
                            </div>

                            <div className="receiver-number-display">
                              <span className="receiver-number-val">
                                {agentPaymentRail === 'Telebirr'
                                  ? (selectedAgent.telebirrPhone || selectedAgent.phone)
                                  : agentPaymentRail === 'CBE'
                                  ? selectedAgent.cbeAccount
                                  : (selectedAgent.mpesaPhone || selectedAgent.phone)}
                              </span>
                            </div>

                            {/* Display Registered Account Holder Name */}
                            {Boolean(
                              (agentPaymentRail === 'Telebirr' && selectedAgent.telebirrName) ||
                              (agentPaymentRail === 'CBE' && selectedAgent.cbeName) ||
                              (agentPaymentRail === 'M-Pesa' && selectedAgent.mpesaName)
                            ) && (
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  marginTop: '8px',
                                  padding: '6px 10px',
                                  borderRadius: '8px',
                                  background: 'rgba(255, 255, 255, 0.05)',
                                  border: '1px solid rgba(255, 255, 255, 0.1)',
                                  fontSize: '12px'
                                }}
                              >
                                <span style={{ color: '#cbd5e1' }}>
                                  👤 {lang === 'am' ? 'የተመዘገበ ስም' : 'Registered Name'}:{' '}
                                  <strong style={{ color: '#fbbf24' }}>
                                    {agentPaymentRail === 'Telebirr'
                                      ? selectedAgent.telebirrName
                                      : agentPaymentRail === 'CBE'
                                      ? selectedAgent.cbeName
                                      : selectedAgent.mpesaName}
                                  </strong>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const name = agentPaymentRail === 'Telebirr'
                                      ? selectedAgent.telebirrName
                                      : agentPaymentRail === 'CBE'
                                      ? selectedAgent.cbeName
                                      : selectedAgent.mpesaName;
                                    if (name) handleCopy(name, 'Account Name');
                                  }}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#38bdf8',
                                    fontSize: '11px',
                                    cursor: 'pointer',
                                    fontWeight: 700
                                  }}
                                >
                                  <i className="fa-regular fa-copy"></i> {t('common.copy')}
                                </button>
                              </div>
                            )}

                            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px' }}>
                              {lang === 'am'
                                ? `እባክዎ በትክክል ${agentDepositAmount} ብር ወደዚህ የተረጋገጠ የኤጀንት ሂሳብ ይላኩ።`
                                : `Please transfer exactly ${agentDepositAmount} ETB to this verified agent account.`}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Step 4: Submit Proof Form */}
                      <div className="form-section-block">
                        <label className="form-section-label">
                          <span className="step-num">4</span> {lang === 'am' ? 'የክፍያ ማረጋገጫ መረጃ' : 'Transaction Proof'}
                        </label>

                        {/* Sending Phone */}
                        <div className="input-field-group">
                          <label className="field-tiny-label">
                            {lang === 'am' ? 'የላኩበት ስልክ ቁጥር' : 'Your Sending Phone Number'}
                          </label>
                          <div className="field-input-box">
                            <i className="fa-solid fa-phone field-icon"></i>
                            <input
                              type="tel"
                              value={agentSenderPhone}
                              onChange={e => setAgentSenderPhone(e.target.value)}
                              placeholder="09..."
                              required
                            />
                          </div>
                        </div>

                        {/* SMS Reference ID */}
                        <div className="input-field-group" style={{ marginTop: '8px' }}>
                          <label className="field-tiny-label">
                            {lang === 'am' ? 'የኤስኤምኤስ ግብይት መለያ (SMS Transaction ID)' : 'SMS Transaction Reference Code (Required)'}
                          </label>
                          <div className="field-input-box">
                            <i className="fa-solid fa-receipt field-icon"></i>
                            <input
                              type="text"
                              value={agentTxRef}
                              onChange={e => setAgentTxRef(e.target.value)}
                              placeholder="e.g. TB-89214302 or FT24..."
                              required
                            />
                          </div>
                        </div>

                        {/* Screenshot Attachment */}
                        <div className="proof-upload-pill" style={{ marginTop: '8px' }}>
                          <input
                            type="file"
                            id="agent-deposit-receipt"
                            accept="image/*"
                            onChange={handleAgentImageUpload}
                            style={{ display: 'none' }}
                          />
                          <label htmlFor="agent-deposit-receipt" className="btn-upload-label">
                            <i className="fa-solid fa-camera"></i>
                            <span>
                              {agentReceiptImage
                                ? (lang === 'am' ? 'ምስሉን ቀይር' : 'Change Screenshot')
                                : (lang === 'am' ? 'የደረሰኝ ምስል አያይዝ (አስገዳጅ አይደለም)' : 'Attach Receipt Screenshot (Optional)')}
                            </span>
                          </label>

                          {agentReceiptImage && (
                            <div className="attached-preview-thumb">
                              <img src={agentReceiptImage} alt="Receipt Preview" />
                              <button
                                type="button"
                                className="btn-remove-thumb"
                                onClick={() => setAgentReceiptImage(null)}
                              >
                                <i className="fa-solid fa-xmark"></i>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Submit Button */}
                      <button
                        type="submit"
                        className="btn-submit-payment-gold"
                        disabled={isSubmittingAgentDeposit || !selectedAgent}
                        style={{ marginTop: '16px', width: '100%' }}
                      >
                        {isSubmittingAgentDeposit ? (
                          <>
                            <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>
                            <span>{lang === 'am' ? 'በመላክ ላይ...' : 'Submitting to Agent...'}</span>
                          </>
                        ) : (
                          <>
                            <i className="fa-solid fa-paper-plane" style={{ marginRight: '8px' }}></i>
                            <span>
                              {lang === 'am'
                                ? `ተቀማጩን ለኤጀንት #${selectedAgent?.agentCode || ''} ላክ`
                                : `Submit Deposit to Sonic Agent #${selectedAgent?.agentCode || ''}`}
                            </span>
                          </>
                        )}
                      </button>
                    </form>
                  )}
                </div>
              ) : (
                /* Standard Telebirr / CBE Deposit Form */
                <form onSubmit={handleDepositSubmit}>
                  {/* 2. Amount Selection */}
                  <div className="form-section-block">
                    <div className="section-label-row">
                      <label className="form-section-label">
                        <span className="step-num">2</span> {lang === 'am' ? 'የተቀማጭ መጠን' : 'Deposit Amount'}
                      </label>
                      <span className="min-limit-sub">{lang === 'am' ? 'ዝቅተኛ፡ 50 ብር' : 'Min: 50 ETB'}</span>
                    </div>

                    <div className="amount-preset-chips-grid">
                      {quickAmounts.map(chip => (
                        <button
                          key={chip}
                          type="button"
                          className={`btn-amount-chip ${amount === chip ? 'active' : ''}`}
                          onClick={() => setAmount(chip)}
                        >
                          {chip} ETB
                        </button>
                      ))}
                    </div>

                    <div className="amount-numeric-input-wrap">
                      <span className="currency-tag">ETB</span>
                      <input
                        type="number"
                        min="50"
                        max="100000"
                        value={amount || ''}
                        onChange={e => setAmount(Number(e.target.value))}
                        placeholder={lang === 'am' ? 'መጠን ያስገቡ' : 'Enter amount'}
                        required
                      />
                    </div>
                  </div>

                  {/* 3. Official Receiver Account Details */}
                  <div className="form-section-block">
                    <label className="form-section-label">
                      <span className="step-num">3</span> {lang === 'am' ? 'ክፍያውን ወደዚህ ይላኩ' : 'Send Payment To'}
                    </label>

                    <div className="deposit-receiver-callout">
                      <div className="receiver-top-row">
                        <span className="receiver-provider-tag">
                          {receiverServiceName} {activeReceiver.badge ? `• ${activeReceiver.badge}` : ''} {lang === 'am' ? 'ይፋዊ አካውንት' : 'Official Account'}
                        </span>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          {selectedMethod === 'Telebirr' && (
                            <button
                              type="button"
                              className="btn-swap-receiver"
                              style={{
                                background: 'rgba(56, 189, 248, 0.15)',
                                border: '1px solid rgba(56, 189, 248, 0.4)',
                                color: '#38bdf8',
                                borderRadius: '6px',
                                padding: '4px 8px',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontWeight: 700
                              }}
                              onClick={() => {
                                const swapped = toggleTelebirrReceiver();
                                setTelebirrReceiver(swapped);
                                showToast(lang === 'am' ? `🔄 ወደ ${swapped.accountName} ተቀይሯል` : `🔄 Swapped to ${swapped.accountName}`);
                              }}
                              title="Swap between Telebirr accounts"
                            >
                              <i className="fa-solid fa-rotate"></i> {lang === 'am' ? 'ቀይር' : 'Swap'}
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn-copy-receiver"
                            onClick={() => handleCopy(activeReceiverNumber, receiverServiceName)}
                          >
                            <i className="fa-regular fa-copy"></i> {t('common.copy')}
                          </button>
                        </div>
                      </div>

                      <div className="receiver-number-display">
                        <span className="receiver-number-val">{activeReceiverNumber}</span>
                      </div>

                      <div className="receiver-meta-sub">
                        <span className="receiver-acc-name">
                          <i className="fa-solid fa-user-check" style={{ marginRight: '4px' }}></i>
                          {receiverName}
                        </span>
                        <span className="receiver-verified-badge">
                          <i className="fa-solid fa-shield-check"></i> {lang === 'am' ? 'የተረጋገጠ' : 'Verified'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 4. Confirmation Details */}
                  <div className="form-section-block">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label className="form-section-label" style={{ margin: 0 }}>
                        <span className="step-num">4</span> {lang === 'am' ? 'የከፈሉበት ስልክ ቁጥር' : 'Your Sender Phone'}
                      </label>
                      {matchingAttachedAccounts.length > 0 && (
                        <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600 }}>
                          <i className="fa-solid fa-circle-check" style={{ marginRight: '3px' }}></i>
                          {lang === 'am' ? 'የተያያዘ አካውንት' : 'Linked Account'}
                        </span>
                      )}
                    </div>

                    {matchingAttachedAccounts.length > 0 && (
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                        {matchingAttachedAccounts.map(acc => (
                          <button
                            key={acc.id}
                            type="button"
                            onClick={() => setPlayerPhone(acc.accountNumber)}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '12px',
                              fontSize: '0.72rem',
                              fontWeight: playerPhone === acc.accountNumber ? 700 : 500,
                              background: playerPhone === acc.accountNumber ? 'rgba(5, 150, 105, 0.12)' : '#f8fafc',
                              border: playerPhone === acc.accountNumber ? '1px solid #10b981' : '1px solid #e2e8f0',
                              color: playerPhone === acc.accountNumber ? '#047857' : '#64748b',
                              cursor: 'pointer'
                            }}
                          >
                            {acc.isDefault ? '⭐ ' : ''}{acc.accountNumber} ({acc.name})
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="input-field-group">
                      <label className="field-tiny-label">
                        {selectedMethod === 'Telebirr'
                          ? (lang === 'am' ? 'የእርስዎ የቴሌብር ስልክ ቁጥር' : 'Your Telebirr Phone Number')
                          : (lang === 'am' ? 'የእርስዎ CBE ስልክ ወይም አካውንት ቁጥር' : 'Your CBE Phone or Account Number')}
                      </label>
                      <div className="field-input-box">
                        <i className="fa-solid fa-phone field-icon"></i>
                        <input
                          type="tel"
                          value={playerPhone}
                          onChange={e => setPlayerPhone(e.target.value)}
                          placeholder={lang === 'am' ? 'ስልክ ቁጥር ያስገቡ (ምሳሌ፡ 09...)' : 'Enter phone number (e.g. 09...)'}
                          required
                        />
                      </div>
                    </div>

                    <div className="input-field-group" style={{ marginTop: '8px' }}>
                      <label className="field-tiny-label">
                        {lang === 'am' ? 'የኤስኤምኤስ ግብይት መለያ ቁጥር' : 'SMS Transaction ID / Reference (Optional)'}
                      </label>
                      <div className="field-input-box">
                        <i className="fa-solid fa-receipt field-icon"></i>
                        <input
                          type="text"
                          value={transactionRef}
                          onChange={e => setTransactionRef(e.target.value)}
                          placeholder="e.g. TX-TB-123456 or FT24..."
                        />
                      </div>
                    </div>

                    {/* Optional Screenshot Attachment */}
                    <div className="proof-upload-pill" style={{ marginTop: '8px' }}>
                      <input
                        type="file"
                        id="dedicated-deposit-receipt"
                        accept="image/*"
                        onChange={handleImageUpload}
                        style={{ display: 'none' }}
                      />
                      <label htmlFor="dedicated-deposit-receipt" className="btn-upload-label">
                        <i className="fa-solid fa-camera"></i>
                        <span>
                          {receiptImage
                            ? (lang === 'am' ? 'ምስሉን ቀይር' : 'Change Screenshot')
                            : (lang === 'am' ? 'የደረሰኝ ምስል አያይዝ (አስገዳጅ አይደለም)' : 'Attach Receipt Screenshot (Optional)')}
                        </span>
                      </label>

                      {receiptImage && (
                        <div className="attached-preview-thumb">
                          <img src={receiptImage} alt="Receipt Preview" />
                          <button
                            type="button"
                            className="btn-remove-thumb"
                            onClick={() => setReceiptImage(null)}
                          >
                            <i className="fa-solid fa-xmark"></i>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button type="submit" className="btn-submit-payment-gold" disabled={isSubmitting}>
                    <i className={`fa-solid ${isSubmitting ? 'fa-spinner fa-spin' : 'fa-bolt'}`}></i>
                    <span>
                      {isSubmitting
                        ? (lang === 'am' ? 'እየተላከ ነው...' : 'Submitting...')
                        : (lang === 'am' ? `አሁን ${amount > 0 ? `${amount} ብር` : ''} አስገባ` : `Deposit ${amount > 0 ? `${amount} ETB` : ''} Now`)}
                    </span>
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: WITHDRAW FUNDS VIA DECENTRALIZED AGENT */}
          {activeTab === 'withdraw' && (
            <div className="fresh-cashier-card-shell">
              {/* Withdrawable Balance Summary Banner */}
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.05) 100%)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '16px',
                  padding: '16px',
                  marginBottom: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#059669', letterSpacing: '0.05em' }}>
                    {lang === 'am' ? 'የሚወጣ ቀሪ ሒሳብ' : 'Withdrawable Balance'}
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a' }}>
                    {balance.toFixed(2)} <span style={{ fontSize: '14px', fontWeight: 700, color: '#64748b' }}>ETB</span>
                  </div>
                </div>
                <div
                  style={{
                    padding: '6px 12px',
                    borderRadius: '20px',
                    background: 'rgba(16, 185, 129, 0.2)',
                    color: '#047857',
                    fontSize: '11px',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <span>🛡️</span>
                  <span>{lang === 'am' ? '0% ክፍያ (100% ነፃ)' : '0% Fee (Free)'}</span>
                </div>
              </div>

              {activeWithdrawalRequest ? (
                /* CASE A: ACTIVE RADAR TRACKER / CONFIRMATION */
                <div
                  style={{
                    textAlign: 'center',
                    padding: '24px 16px',
                    background: '#0f172a',
                    borderRadius: '18px',
                    border: activeWithdrawalRequest.status === 'completed'
                      ? '1px solid #10b981'
                      : activeWithdrawalRequest.status === 'rejected'
                      ? '1px solid #ef4444'
                      : '1px solid #3b82f6',
                    color: '#f8fafc',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.15)'
                  }}
                >
                  {/* Status Indicator Icon */}
                  <div style={{ position: 'relative', width: '70px', height: '70px', margin: '0 auto 16px' }}>
                    {activeWithdrawalRequest.status === 'pending' ? (
                      <div
                        style={{
                          width: '70px',
                          height: '70px',
                          borderRadius: '50%',
                          border: '3px solid #3b82f6',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '28px',
                          animation: 'pulse 1.8s infinite',
                          background: 'rgba(59, 130, 246, 0.15)'
                        }}
                      >
                        📡
                      </div>
                    ) : activeWithdrawalRequest.status === 'completed' ? (
                      <div
                        style={{
                          width: '70px',
                          height: '70px',
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
                    ) : (
                      <div
                        style={{
                          width: '70px',
                          height: '70px',
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
                    )}
                  </div>

                  <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '6px' }}>
                    {activeWithdrawalRequest.status === 'completed'
                      ? (lang === 'am' ? 'ገንዘቡ በተሳካ ሁኔታ ተላልፏል!' : 'Withdrawal Paid Successfully!')
                      : activeWithdrawalRequest.status === 'rejected'
                      ? (lang === 'am' ? 'የማውጣት ጥያቄው አልተሳካም' : 'Withdrawal Request Rejected')
                      : (lang === 'am' ? 'ኤጀንቱ ክፍያውን በሞባይል እየላኩ ነው...' : 'Agent is Processing Mobile Payout...')}
                  </h3>
                  <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 20px 0', lineHeight: 1.5 }}>
                    {activeWithdrawalRequest.status === 'completed'
                      ? (lang === 'am' ? 'ገንዘቡ በቀጥታ ወደ ሂሳብዎ ተላልፏል። እባክዎ የሞባይል ኤስኤምኤስዎን ይመልከቱ።' : 'Funds have been transferred to your account. Check your mobile SMS.')
                      : activeWithdrawalRequest.status === 'rejected'
                      ? (activeWithdrawalRequest.rejectionReason || (lang === 'am' ? 'ጥያቄው ተሰርዟል እና ገንዘብዎ ወደ ዋሌት ተመልሷል።' : 'Request was cancelled and funds have been refunded to your wallet.'))
                      : (lang === 'am' ? 'የተመረጡት ኤጀንት ጥያቄዎን ተቀብለው ክፍያውን በሞባይል ባንኪንግ እየፈጸሙ ነው። እባክዎ ለጥቂት ሰከንዶች ይጠብቁ።' : 'The selected agent is transferring your cash via mobile banking right now. Please wait a moment.')}
                  </p>

                  {/* Receipt Card */}
                  <div
                    style={{
                      background: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '14px',
                      padding: '16px',
                      marginBottom: '20px',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                      <span style={{ color: '#94a3b8' }}>{lang === 'am' ? 'ክፍያ ፈጻሚ ኤጀንት፡' : 'Processing Agent:'}</span>
                      <span style={{ fontWeight: 800, color: '#f8fafc' }}>
                        👑 {activeWithdrawalRequest.agentDisplayName || `Sonic Agent #${activeWithdrawalRequest.agentCode || 'AGT'}`}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                      <span style={{ color: '#94a3b8' }}>{lang === 'am' ? 'የሚላክ መጠን፡' : 'Payout Amount:'}</span>
                      <span style={{ fontWeight: 900, color: '#10b981', fontSize: '16px' }}>
                        {activeWithdrawalRequest.amount} ETB
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                      <span style={{ color: '#94a3b8' }}>{lang === 'am' ? 'የክፍያ መስመር፡' : 'Payout Rail:'}</span>
                      <span style={{ fontWeight: 700, color: '#38bdf8' }}>
                        {activeWithdrawalRequest.payoutMethod || 'Telebirr'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                      <span style={{ color: '#94a3b8' }}>{lang === 'am' ? 'ተቀባይ ሂሳብ፡' : 'Payout Account:'}</span>
                      <span style={{ fontWeight: 800, fontFamily: 'monospace', color: '#fbbf24' }}>
                        {activeWithdrawalRequest.payoutAccount}
                      </span>
                    </div>
                    {activeWithdrawalRequest.agentTxRef && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid #334155', fontSize: '13px' }}>
                        <span style={{ color: '#94a3b8' }}>{lang === 'am' ? 'የኤጀንት ማረጋገጫ (Tx Ref)፡' : 'Agent Reference:'}</span>
                        <span style={{ fontWeight: 800, fontFamily: 'monospace', color: '#10b981' }}>
                          {activeWithdrawalRequest.agentTxRef}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {activeWithdrawalRequest.status === 'completed' ? (
                    <button
                      type="button"
                      onClick={() => setActiveWithdrawalRequest(null)}
                      style={{
                        width: '100%',
                        padding: '14px',
                        borderRadius: '12px',
                        background: '#10b981',
                        color: '#ffffff',
                        fontWeight: 800,
                        fontSize: '14px',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      ✓ {lang === 'am' ? 'ጨርሻለሁ (ወደ መነሻ)' : 'Done / Return to Cashier'}
                    </button>
                  ) : activeWithdrawalRequest.status === 'rejected' ? (
                    <button
                      type="button"
                      onClick={() => setActiveWithdrawalRequest(null)}
                      style={{
                        width: '100%',
                        padding: '14px',
                        borderRadius: '12px',
                        background: '#ef4444',
                        color: '#ffffff',
                        fontWeight: 800,
                        fontSize: '14px',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      {lang === 'am' ? 'ይቅር / አዲስ ጥያቄ አቅርብ' : 'Dismiss / Submit New Request'}
                    </button>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => loadAgentData()}
                        style={{
                          width: '100%',
                          padding: '12px',
                          borderRadius: '10px',
                          background: '#334155',
                          color: '#f8fafc',
                          fontWeight: 700,
                          fontSize: '13px',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                      >
                        <i className="fa-solid fa-rotate"></i>
                        {lang === 'am' ? 'ሁኔታውን ያድሱ' : 'Refresh Status'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCancelWithdrawal(activeWithdrawalRequest.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#f43f5e',
                          fontSize: '12px',
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
                /* CASE B: INTERACTIVE AGENT WITHDRAWAL FORM */
                <form onSubmit={handleWithdrawViaAgent} className="space-y-4">
                  {/* Step 1: Agent Selection Grid */}
                  <div className="form-section-block">
                    <div className="section-label-row">
                      <label className="form-section-label">
                        <span className="step-num">1</span> {lang === 'am' ? 'ክፍያ የሚፈጽምልዎ ኤጀንት ይምረጡ' : 'Select Online Cashier Agent'}
                      </label>
                      <span className="min-limit-sub" style={{ color: '#10b981', fontWeight: 800 }}>
                        🟢 {activeAgents.length} {lang === 'am' ? 'ኤጀንቶች በመስመር ላይ' : 'Agents Online'}
                      </span>
                    </div>

                    {activeAgents.length === 0 ? (
                      <div
                        style={{
                          background: '#1e293b',
                          border: '1px dashed #475569',
                          borderRadius: '12px',
                          padding: '18px',
                          textAlign: 'center',
                          color: '#94a3b8',
                          fontSize: '13px'
                        }}
                      >
                        {lang === 'am' ? 'በአሁኑ ሰዓት በመስመር ላይ የሚገኝ ኤጀንት የለም። እባክዎ ከጥቂት ደቂቃዎች በኋላ ይሞክሩ።' : 'No agents currently online. Please check back shortly.'}
                      </div>
                    ) : (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                          gap: '10px'
                        }}
                      >
                        {activeAgents.map(ag => {
                          const isSelected = selectedWithdrawAgent?.id === ag.id;
                          const rails = ag.supportedRails && ag.supportedRails.length > 0
                            ? ag.supportedRails
                            : [
                                ...(ag.telebirrPhone ? ['Telebirr'] : []),
                                ...(ag.cbeAccount ? ['CBE'] : []),
                                ...(ag.mpesaPhone ? ['M-Pesa'] : [])
                              ];
                          return (
                            <div
                              key={ag.id}
                              onClick={() => handleSelectWithdrawAgent(ag)}
                              style={{
                                border: isSelected ? '2px solid #3b82f6' : '1px solid #cbd5e1',
                                background: isSelected ? 'rgba(59, 130, 246, 0.08)' : '#ffffff',
                                borderRadius: '12px',
                                padding: '12px',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div
                                  style={{
                                    width: '38px',
                                    height: '38px',
                                    borderRadius: '50%',
                                    background: isSelected ? '#3b82f6' : '#e2e8f0',
                                    color: isSelected ? '#ffffff' : '#475569',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 800,
                                    fontSize: '14px'
                                  }}
                                >
                                  {ag.displayName.charAt(0).toUpperCase()}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div
                                    style={{
                                      fontWeight: 800,
                                      fontSize: '13px',
                                      color: '#0f172a',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap'
                                    }}
                                  >
                                    👑 {ag.displayName}
                                  </div>
                                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                                    #{ag.agentCode}
                                  </div>
                                </div>
                              </div>

                              {/* Rail Badges */}
                              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '8px' }}>
                                {rails.map(r => (
                                  <span
                                    key={r}
                                    style={{
                                      fontSize: '10px',
                                      fontWeight: 700,
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      background: r === 'Telebirr' ? 'rgba(56, 189, 248, 0.12)' : r === 'CBE' ? 'rgba(234, 179, 8, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                                      color: r === 'Telebirr' ? '#0284c7' : r === 'CBE' ? '#b45309' : '#059669'
                                    }}
                                  >
                                    {r === 'Telebirr' ? 'Telebirr' : r === 'CBE' ? 'CBE Bank' : 'M-Pesa'}
                                  </span>
                                ))}
                              </div>

                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  marginTop: '8px',
                                  paddingTop: '6px',
                                  borderTop: '1px solid #f1f5f9',
                                  fontSize: '11px'
                                }}
                              >
                                <span style={{ color: '#10b981', fontWeight: 700 }}>🟢 Online</span>
                                <span style={{ color: '#2563eb', fontWeight: 600 }}>⚡ ~{ag.avgApprovalMinutes || 2}m Payout</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Step 2: Withdrawal Amount */}
                  <div className="form-section-block">
                    <div className="section-label-row">
                      <label className="form-section-label">
                        <span className="step-num">2</span> {lang === 'am' ? 'የማውጣት መጠን ይምረጡ' : 'Select Withdrawal Amount'}
                      </label>
                      <span className="min-limit-sub">
                        {lang === 'am' ? 'ዝቅተኛ 50 ብር | ከፍተኛ 5,000 ብር' : 'Min 50 ETB | Max 5,000 ETB'}
                      </span>
                    </div>

                    <div className="amount-quick-grid">
                      {[50, 100, 200, 500, 1000].map(val => (
                        <button
                          key={val}
                          type="button"
                          className={`btn-amount-pill ${withdrawAmount === val ? 'active' : ''}`}
                          onClick={() => setWithdrawAmount(val)}
                        >
                          +{val} {t('common.etb')}
                        </button>
                      ))}
                      <button
                        type="button"
                        className={`btn-amount-pill ${withdrawAmount === Math.min(5000, Math.floor(balance)) && balance >= 50 ? 'active' : ''}`}
                        onClick={() => setWithdrawAmount(Math.min(5000, Math.floor(balance)))}
                        style={{ fontWeight: 800, color: '#b45309' }}
                      >
                        {lang === 'am' ? 'ሁሉንም (Max)' : 'Max Balance'}
                      </button>
                    </div>

                    <div className="custom-input-wrap">
                      <div className="input-with-currency">
                        <span className="currency-prefix">ETB</span>
                        <input
                          type="number"
                          value={withdrawAmount || ''}
                          onChange={e => setWithdrawAmount(Number(e.target.value))}
                          placeholder="50 - 5,000"
                          min="50"
                          max="5000"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Step 3: Destination Account */}
                  <div className="form-section-block">
                    <div className="section-label-row">
                      <label className="form-section-label">
                        <span className="step-num">3</span> {lang === 'am' ? 'የክፍያ መቀበያ መስመር እና ሂሳብ' : 'Destination Payout Rail & Account'}
                      </label>
                    </div>

                    {/* Method Selector Tabs: Telebirr, CBE Bank, M-Pesa */}
                    <div className="method-selector-tabs" style={{ marginBottom: '12px' }}>
                      <button
                        type="button"
                        className={`method-tab-item ${withdrawMethod === 'Telebirr' ? 'active' : ''}`}
                        onClick={() => setWithdrawMethod('Telebirr')}
                        disabled={Boolean(selectedWithdrawAgent && selectedWithdrawAgent.supportedRails && !selectedWithdrawAgent.supportedRails.includes('Telebirr') && !selectedWithdrawAgent.telebirrPhone)}
                        style={{
                          opacity: Boolean(selectedWithdrawAgent && selectedWithdrawAgent.supportedRails && !selectedWithdrawAgent.supportedRails.includes('Telebirr') && !selectedWithdrawAgent.telebirrPhone) ? 0.4 : 1
                        }}
                      >
                        <TelebirrLogo size={20} />
                        <span>Telebirr</span>
                      </button>
                      <button
                        type="button"
                        className={`method-tab-item ${withdrawMethod === 'CBE' ? 'active' : ''}`}
                        onClick={() => setWithdrawMethod('CBE')}
                        disabled={Boolean(selectedWithdrawAgent && selectedWithdrawAgent.supportedRails && !selectedWithdrawAgent.supportedRails.includes('CBE') && !selectedWithdrawAgent.cbeAccount)}
                        style={{
                          opacity: Boolean(selectedWithdrawAgent && selectedWithdrawAgent.supportedRails && !selectedWithdrawAgent.supportedRails.includes('CBE') && !selectedWithdrawAgent.cbeAccount) ? 0.4 : 1
                        }}
                      >
                        <CBELogo size={20} />
                        <span>CBE Bank</span>
                      </button>
                      <button
                        type="button"
                        className={`method-tab-item ${withdrawMethod === 'M-Pesa' ? 'active' : ''}`}
                        onClick={() => setWithdrawMethod('M-Pesa')}
                        disabled={Boolean(selectedWithdrawAgent && selectedWithdrawAgent.supportedRails && !selectedWithdrawAgent.supportedRails.includes('M-Pesa') && !selectedWithdrawAgent.mpesaPhone)}
                        style={{
                          opacity: Boolean(selectedWithdrawAgent && selectedWithdrawAgent.supportedRails && !selectedWithdrawAgent.supportedRails.includes('M-Pesa') && !selectedWithdrawAgent.mpesaPhone) ? 0.4 : 1
                        }}
                      >
                        <MpesaLogo size={20} />
                        <span>M-Pesa</span>
                      </button>
                    </div>

                    {/* Linked accounts shortcuts */}
                    {(user?.attachedAccounts || []).filter(a => a.type === withdrawMethod).length > 0 && (
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                        {(user?.attachedAccounts || [])
                          .filter(a => a.type === withdrawMethod)
                          .map(acc => (
                            <button
                              key={acc.id}
                              type="button"
                              onClick={() => {
                                setWithdrawAccount(acc.accountNumber);
                                if (acc.name) setWithdrawAccountName(acc.name);
                              }}
                              style={{
                                padding: '4px 8px',
                                borderRadius: '12px',
                                fontSize: '0.72rem',
                                fontWeight: withdrawAccount === acc.accountNumber ? 700 : 500,
                                background: withdrawAccount === acc.accountNumber ? 'rgba(59, 130, 246, 0.12)' : '#f8fafc',
                                border: withdrawAccount === acc.accountNumber ? '1px solid #3b82f6' : '1px solid #e2e8f0',
                                color: withdrawAccount === acc.accountNumber ? '#1d4ed8' : '#64748b',
                                cursor: 'pointer'
                              }}
                            >
                              {acc.isDefault ? '⭐ ' : ''}{acc.accountNumber} ({acc.name})
                            </button>
                          ))}
                      </div>
                    )}

                    <div className="input-field-group">
                      <label className="field-tiny-label">
                        {withdrawMethod === 'Telebirr'
                          ? (lang === 'am' ? 'ገንዘቡ የሚላክበት የቴሌብር ስልክ ቁጥር' : 'Receiving Telebirr Phone (09... / 07...)')
                          : withdrawMethod === 'CBE'
                          ? (lang === 'am' ? 'ገንዘቡ የሚላክበት የኢትዮጵያ ንግድ ባንክ ሂሳብ ቁጥር' : 'Receiving CBE Bank Account (1000...)')
                          : (lang === 'am' ? 'ገንዘቡ የሚላክበት የሳፋሪኮም ኤም-ፔሳ ስልክ ቁጥር' : 'Receiving Safaricom M-Pesa Phone (07...)')}
                      </label>
                      <div className="field-input-box">
                        <i className={withdrawMethod === 'CBE' ? 'fa-solid fa-building-columns field-icon' : 'fa-solid fa-mobile-screen field-icon'}></i>
                        <input
                          type="text"
                          value={withdrawAccount}
                          onChange={e => setWithdrawAccount(e.target.value)}
                          placeholder={
                            withdrawMethod === 'Telebirr'
                              ? '09... or 07...'
                              : withdrawMethod === 'CBE'
                              ? '1000...'
                              : '07...'
                          }
                          required
                        />
                      </div>
                    </div>

                    <div className="input-field-group" style={{ marginTop: '8px' }}>
                      <label className="field-tiny-label">
                        {lang === 'am' ? 'የሂሳብ ባለቤቱ ሙሉ ስም' : 'Account Holder Full Name'}
                      </label>
                      <div className="field-input-box">
                        <i className="fa-solid fa-user-check field-icon"></i>
                        <input
                          type="text"
                          value={withdrawAccountName}
                          onChange={e => setWithdrawAccountName(e.target.value)}
                          placeholder="e.g. Abebe Kebede"
                          required
                        />
                      </div>
                    </div>

                    {/* Escrow Guarantee Pill */}
                    <div
                      style={{
                        marginTop: '12px',
                        padding: '10px 14px',
                        borderRadius: '12px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '12px',
                        color: '#64748b'
                      }}
                    >
                      <span style={{ fontSize: '16px' }}>🔒</span>
                      <span>
                        {lang === 'am'
                          ? 'ገንዘብዎ በደህና Escrow ውስጥ ይቆያል፤ ኤጀንቱ ወደ ሂሳብዎ እስኪያስተላልፍ ድረስ ሙሉ ጥበቃ አለው። በማንኛውም ሰዓት ሰርዘው ገንዘቡን መመለስ ይችላሉ።'
                          : 'Your funds are held safely in escrow until the agent verifies the mobile payout. You can cancel at any time for an instant refund.'}
                      </span>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    className="btn-submit-payment-gold"
                    disabled={isSubmittingWithdraw || withdrawAmount < 50 || withdrawAmount > balance}
                    style={{
                      background: 'linear-gradient(135deg, #b45309 0%, #d97706 100%)',
                      boxShadow: '0 4px 15px rgba(217, 119, 6, 0.3)'
                    }}
                  >
                    <i className={`fa-solid ${isSubmittingWithdraw ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`}></i>
                    <span>
                      {isSubmittingWithdraw
                        ? (lang === 'am' ? 'እየተላከ ነው...' : 'Submitting Request...')
                        : (lang === 'am' ? `አሁን ${withdrawAmount > 0 ? `${withdrawAmount} ብር` : ''} ማውጣት ጠይቅ` : `Request ${withdrawAmount > 0 ? `${withdrawAmount} ETB` : ''} Payout Now`)}
                    </span>
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
  );
};
