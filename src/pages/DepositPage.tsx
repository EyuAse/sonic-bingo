import React, { useState, useEffect } from 'react';
import { useWallet } from '../context/WalletContext.tsx';
import { useApp } from '../context/AppContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useLanguage } from '../context/LanguageContext.tsx';
import { TelebirrLogo, CBELogo, MpesaLogo } from '../components/wallet/PaymentLogos.tsx';
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
  const quickAmounts = [50, 100, 200, 500, 1000, 5000];

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



  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`📋 ${t('common.copied')}: ${label}`);
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

                {/* 3. Step 1: Header Row */}
                <div className="sonic-step-header-row">
                  <div className="sonic-step-badge-pill">
                    <span className="sonic-step-number-circle">1</span>
                    <span className="sonic-step-label-text">Select Certified Agent</span>
                  </div>
                  <div className="sonic-online-agents-pill">
                    <span className="sonic-pulse-dot"></span>
                    <span>{activeAgents.length > 0 ? `${activeAgents.length} Agents Online` : '2 Agents Online'}</span>
                  </div>
                </div>

                {/* 4. Agents List: Light Card for unselected, Obsidian Luxury Card for selected */}
                <div className="sonic-agents-stack">
                  {activeAgents.length === 0 ? (
                    <div className="sonic-agent-light-card" style={{ justifyContent: 'center', textAlign: 'center', color: '#64748b' }}>
                      <span>Loading active certified agents...</span>
                    </div>
                  ) : (
                    activeAgents.map(ag => {
                      const isSelected = selectedAgent?.agentCode === ag.agentCode;
                      if (isSelected) {
                        return (
                          <div
                            key={ag.agentCode}
                            className="sonic-agent-obsidian-card"
                            onClick={() => handleSelectDepositAgent(ag)}
                          >
                            <div className="sonic-agent-card-left">
                              <SonicCrownLogo size={36} />
                              <div className="sonic-agent-card-details">
                                <span className="sonic-agent-name-obsidian">Sonic Agent #{ag.agentCode}</span>
                                <span className="sonic-agent-rails-obsidian">
                                  {ag.telebirrPhone ? `Telebirr: ${ag.telebirrPhone}` : ''}
                                </span>
                                <span className="sonic-agent-rails-obsidian">
                                  {ag.cbeAccount ? `CBE Birr: ${ag.cbeAccount}` : ''}
                                </span>
                              </div>
                            </div>

                            <div className="sonic-agent-card-right">
                              <span className="sonic-status-pill-emerald">
                                <span className="sonic-pulse-dot" style={{ width: 6, height: 6 }}></span>
                                Online
                              </span>
                              <div className="sonic-amber-circle-chevron">
                                ›
                              </div>
                            </div>

                            <LiquidGoldCornerSwoosh opacity={0.95} />
                          </div>
                        );
                      }

                      return (
                        <div
                          key={ag.agentCode}
                          className="sonic-agent-light-card"
                          onClick={() => handleSelectDepositAgent(ag)}
                        >
                          <div className="sonic-agent-card-left">
                            <SonicCrownLogo size={34} />
                            <div className="sonic-agent-card-details">
                              <span className="sonic-agent-name-light">Sonic Agent #{ag.agentCode}</span>
                              <span className="sonic-agent-rails-light">
                                {ag.telebirrPhone ? `Telebirr: ${ag.telebirrPhone}` : ''}
                              </span>
                              <span className="sonic-agent-rails-light">
                                {ag.cbeAccount ? `CBE Birr: ${ag.cbeAccount}` : ''}
                              </span>
                            </div>
                          </div>

                          <div className="sonic-agent-card-right">
                            <span className="sonic-status-pill-green">
                              <span className="sonic-pulse-dot" style={{ width: 6, height: 6 }}></span>
                              Online
                            </span>
                            <GoldenCheckCircle size={24} />
                          </div>
                        </div>
                      );
                    })
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
                    {[50, 100, 200, 500, 1000, 5000].map(amt => (
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
                      max="100000"
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

                {/* 7. Step 3: Transfer Payment to Agent */}
                <div className="sonic-step-badge-pill" style={{ alignSelf: 'flex-start' }}>
                  <span className="sonic-step-number-circle">3</span>
                  <span className="sonic-step-label-text">Transfer Payment to Agent</span>
                </div>

                <div className="sonic-rails-selector-grid">
                  {/* Telebirr Tab */}
                  <div
                    className={agentPaymentRail === 'Telebirr' ? 'sonic-rail-obsidian-tab' : 'sonic-rail-light-tab'}
                    onClick={() => setAgentPaymentRail('Telebirr')}
                  >
                    {agentPaymentRail === 'Telebirr' ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <TelebirrLogo size={22} />
                          <span className="sonic-rail-title-white">Telebirr</span>
                        </div>
                        <span style={{ color: '#f59e0b', fontSize: '16px', fontWeight: 900 }}>›</span>
                      </>
                    ) : (
                      <>
                        <TelebirrLogo size={24} />
                        <div>
                          <div className="sonic-rail-title-dark">Telebirr</div>
                          <div className="sonic-rail-sub-muted">
                            ({selectedAgent?.telebirrPhone || '0982624574'})
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* CBE Bank / Birr Tab */}
                  <div
                    className={agentPaymentRail === 'CBE' ? 'sonic-rail-obsidian-tab' : 'sonic-rail-light-tab'}
                    onClick={() => setAgentPaymentRail('CBE')}
                  >
                    {agentPaymentRail === 'CBE' ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <GoldBankColumnsIcon size={22} />
                          <span className="sonic-rail-title-white">CBE Bank / Birr</span>
                        </div>
                        <span style={{ color: '#f59e0b', fontSize: '16px', fontWeight: 900 }}>›</span>
                      </>
                    ) : (
                      <>
                        <CBELogo size={24} />
                        <div>
                          <div className="sonic-rail-title-dark">CBE Bank / Birr</div>
                          <div className="sonic-rail-sub-muted">
                            ({selectedAgent?.cbeAccount ? selectedAgent.cbeAccount.slice(0, 10) + '...' : '1000...'})
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* 8. Bottom Quick Copy Bar */}
                <div className="sonic-account-copy-bar">
                  <div className="sonic-copy-bar-left">
                    <div className="sonic-copy-link-circle">
                      <i className="fa-solid fa-link"></i>
                    </div>
                    <span className="sonic-copy-account-text">
                      Sonic Agent #{selectedAgent?.agentCode || 'AGT-6054'} • {agentPaymentRail === 'CBE' ? 'CBE Birr' : 'Telebirr'}
                    </span>
                  </div>

                  <div className="sonic-copy-divider"></div>

                  <button
                    type="button"
                    className="sonic-gold-copy-btn"
                    onClick={() => {
                      const targetAccount = agentPaymentRail === 'Telebirr'
                        ? (selectedAgent?.telebirrPhone || '0982624574')
                        : agentPaymentRail === 'CBE'
                        ? (selectedAgent?.cbeAccount || '1000458291048')
                        : (selectedAgent?.mpesaPhone || '0712345678');
                      handleCopy(targetAccount, `${agentPaymentRail} Account`);
                    }}
                  >
                    <i className="fa-regular fa-copy"></i>
                    <span>Copy</span>
                  </button>
                </div>

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
                    disabled={isSubmittingAgentDeposit || !selectedAgent}
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
                /* CASE B: 100% HARMONIZED LUXURY AGENT WITHDRAWAL FORM */
                <form onSubmit={handleWithdrawViaAgent} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Step 1: Header Row */}
                  <div className="sonic-step-header-row">
                    <div className="sonic-step-badge-pill">
                      <span className="sonic-step-number-circle">1</span>
                      <span className="sonic-step-label-text">
                        {lang === 'am' ? 'ክፍያ የሚፈጽምልዎ ኤጀንት ይምረጡ' : 'Select Certified Agent'}
                      </span>
                    </div>
                    <div className="sonic-online-agents-pill">
                      <span className="sonic-pulse-dot"></span>
                      <span>{activeAgents.length > 0 ? `${activeAgents.length} Agents Online` : '2 Agents Online'}</span>
                    </div>
                  </div>

                  {/* Agents Stack: Obsidian Luxury Card for Selected, Light Card for Unselected */}
                  <div className="sonic-agents-stack">
                    {activeAgents.length === 0 ? (
                      <div className="sonic-agent-light-card" style={{ justifyContent: 'center', textAlign: 'center', color: '#64748b' }}>
                        <span>Loading active certified agents...</span>
                      </div>
                    ) : (
                      activeAgents.map(ag => {
                        const isSelected = selectedWithdrawAgent?.agentCode === ag.agentCode;
                        if (isSelected) {
                          return (
                            <div
                              key={ag.agentCode}
                              className="sonic-agent-obsidian-card"
                              onClick={() => handleSelectWithdrawAgent(ag)}
                            >
                              <div className="sonic-obsidian-left">
                                <SonicCrownLogo size={36} />
                                <div className="sonic-obsidian-info">
                                  <h4>👑 {ag.displayName || `Sonic Agent #${ag.agentCode}`}</h4>
                                  <p>Telebirr: {ag.telebirrPhone || '—'}</p>
                                  <p>CBE Birr: {ag.cbeAccount || '—'}</p>
                                </div>
                              </div>
                              <div className="sonic-obsidian-right">
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                                  <span className="sonic-obsidian-online-badge">
                                    <span className="sonic-obsidian-green-dot"></span> Online
                                  </span>
                                  <span style={{ fontSize: '10px', color: '#38bdf8', fontWeight: 800 }}>
                                    ⚡ ~{ag.avgApprovalMinutes || 2}m
                                  </span>
                                </div>
                                <i className="fa-solid fa-chevron-right sonic-obsidian-chevron"></i>
                              </div>
                              <LiquidGoldCornerSwoosh />
                            </div>
                          );
                        }

                        return (
                          <div
                            key={ag.agentCode}
                            className="sonic-agent-light-card"
                            onClick={() => handleSelectWithdrawAgent(ag)}
                          >
                            <div className="sonic-agent-light-left">
                              <SonicCrownLogo size={36} />
                              <div className="sonic-agent-light-info">
                                <h4>Sonic Agent #{ag.agentCode}</h4>
                                <p>Telebirr: {ag.telebirrPhone || '—'}</p>
                                <p>CBE Birr: {ag.cbeAccount || '—'}</p>
                              </div>
                            </div>
                            <div className="sonic-agent-light-right">
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                                <span className="sonic-light-online-badge">
                                  <span className="sonic-light-green-dot"></span> Online
                                </span>
                                <span style={{ fontSize: '10px', color: '#0284c7', fontWeight: 700 }}>
                                  ⚡ ~{ag.avgApprovalMinutes || 2}m
                                </span>
                              </div>
                              <GoldenCheckCircle size={24} />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Step 2: Withdrawal Amount Card (Harmonized with Deposit Shell) */}
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
                        {lang === 'am' ? 'ዝቅተኛ፡ 50 ብር' : 'Min: 50 ETB'}
                      </span>
                    </div>

                    {/* 3x2 Quick Chips Grid */}
                    <div className="sonic-amount-chips-grid">
                      {[50, 100, 200, 500, 1000].map(amt => (
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
                        className={`sonic-amount-chip-btn ${withdrawAmount === Math.min(5000, Math.floor(balance)) && balance >= 50 ? 'active' : ''}`}
                        onClick={() => setWithdrawAmount(Math.min(5000, Math.floor(balance)))}
                        style={{ fontWeight: 900 }}
                      >
                        {lang === 'am' ? 'ሁሉንም (Max)' : '★ Max Balance'}
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
                        max={5000}
                        required
                      />
                      <div className="sonic-input-gold-swoosh"></div>
                    </div>
                  </div>

                  {/* Golden Escrow & Net Payout Guarantee Card */}
                  <div className="sonic-reward-box-card">
                    <div className="sonic-reward-left">
                      <GoldenEscrowShieldIcon size={38} />
                      <div className="sonic-reward-info">
                        <h4>
                          {lang === 'am'
                            ? `የተጣራ ክፍያ፡ ${withdrawAmount || 0} ብር (100% ነፃ)`
                            : `Net Payout: ${withdrawAmount || 0} ETB (0% Player Fee)`}
                        </h4>
                        <p>
                          {lang === 'am'
                            ? '🛡️ ገንዘብዎ በደህና Escrow ውስጥ ይቆያል፤ ኤጀንቱ እስኪልክ ድረስ ሙሉ ጥበቃ አለው።'
                            : '🛡️ Funds held safely in atomic escrow until confirmed. 1-click instant refund.'}
                        </p>
                      </div>
                    </div>
                    <i className="fa-solid fa-chevron-right sonic-gold-chevron"></i>
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

                  {/* Rails Selector Grid */}
                  <div className="sonic-rails-grid">
                    {/* Telebirr Tab */}
                    <div
                      className={`sonic-rail-btn ${withdrawMethod === 'Telebirr' ? 'active-light-rail' : ''}`}
                      onClick={() => setWithdrawMethod('Telebirr')}
                    >
                      <TelebirrLogo size={28} />
                      <div className="sonic-rail-text">
                        <span className="sonic-rail-title">Telebirr</span>
                        <span className="sonic-rail-sub">Instant</span>
                      </div>
                    </div>

                    {/* CBE Bank Tab */}
                    <div
                      className={`sonic-rail-btn ${withdrawMethod === 'CBE' ? 'active-obsidian-rail' : ''}`}
                      onClick={() => setWithdrawMethod('CBE')}
                    >
                      <div className="sonic-cbe-rail-left">
                        <GoldBankColumnsIcon size={24} />
                        <span className="sonic-cbe-title">CBE Bank / Birr</span>
                      </div>
                      <i className="fa-solid fa-chevron-right sonic-obsidian-chevron"></i>
                    </div>

                    {/* M-Pesa Tab */}
                    <div
                      className={`sonic-rail-btn ${withdrawMethod === 'M-Pesa' ? 'active-light-rail' : ''}`}
                      onClick={() => setWithdrawMethod('M-Pesa')}
                    >
                      <MpesaLogo size={28} />
                      <div className="sonic-rail-text">
                        <span className="sonic-rail-title">M-Pesa</span>
                        <span className="sonic-rail-sub">Instant</span>
                      </div>
                    </div>
                  </div>

                  {/* Saved Accounts Fast-Fill Chips */}
                  {user?.attachedAccounts && user.attachedAccounts.length > 0 && (
                    <div>
                      <span className="sonic-input-tiny-label">
                        {lang === 'am' ? 'የተቀመጡ ሂሳቦች (ለመምረጥ ይጫኑ)' : 'Saved Accounts (1-Tap Fast Fill)'}
                      </span>
                      <div className="sonic-saved-accounts-wrap">
                        {user.attachedAccounts.map(acc => {
                          const isAccActive = withdrawAccount === acc.accountNumber;
                          return (
                            <button
                              key={acc.id}
                              type="button"
                              className={`sonic-saved-account-chip ${isAccActive ? 'active' : ''}`}
                              onClick={() => {
                                setWithdrawAccount(acc.accountNumber);
                                if (acc.name) setWithdrawAccountName(acc.name);
                                if (acc.type === 'Telebirr' || acc.type === 'CBE') {
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
                          : withdrawMethod === 'CBE'
                          ? (lang === 'am' ? 'ገንዘቡ የሚላክበት የኢትዮጵያ ንግድ ባንክ ሂሳብ ቁጥር' : 'Receiving CBE Bank Account Number (1000...)')
                          : (lang === 'am' ? 'ገንዘቡ የሚላክበት የሳፋሪኮም ኤም-ፔሳ ስልክ ቁጥር' : 'Receiving Safaricom M-Pesa Phone Number (07...)')}
                      </label>
                      <div className="sonic-proof-field-wrap">
                        <i className={withdrawMethod === 'CBE' ? 'fa-solid fa-building-columns' : 'fa-solid fa-mobile-screen'}></i>
                        <input
                          type="text"
                          value={withdrawAccount}
                          onChange={e => setWithdrawAccount(e.target.value)}
                          className="sonic-proof-text-input"
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
                      disabled={isSubmittingWithdraw || withdrawAmount < 50 || withdrawAmount > balance || !selectedWithdrawAgent}
                      style={{ marginTop: '12px' }}
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
                              ? `አሁን ${withdrawAmount > 0 ? `${withdrawAmount} ብር` : ''} በኤጀንት #${selectedWithdrawAgent?.agentCode || ''} ማውጣት ጠይቅ`
                              : `Request ${withdrawAmount > 0 ? `${withdrawAmount} ETB` : ''} Payout via Agent #${selectedWithdrawAgent?.agentCode || ''}`}
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
