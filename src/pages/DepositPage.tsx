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
  GoldenCheckCircle
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
                    border: (activeWithdrawalRequest.status === 'completed' || activeWithdrawalRequest.status === 'approved')
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
                    ) : (activeWithdrawalRequest.status === 'completed' || activeWithdrawalRequest.status === 'approved') ? (
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
                    {(activeWithdrawalRequest.status === 'completed' || activeWithdrawalRequest.status === 'approved')
                      ? (lang === 'am' ? 'ገንዘቡ በተሳካ ሁኔታ ተላልፏል!' : 'Withdrawal Paid Successfully!')
                      : activeWithdrawalRequest.status === 'rejected'
                      ? (lang === 'am' ? 'የማውጣት ጥያቄው አልተሳካም' : 'Withdrawal Request Rejected')
                      : (lang === 'am' ? 'ኤጀንቱ ክፍያውን በሞባይል እየላኩ ነው...' : 'Agent is Processing Mobile Payout...')}
                  </h3>
                  <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 20px 0', lineHeight: 1.5 }}>
                    {(activeWithdrawalRequest.status === 'completed' || activeWithdrawalRequest.status === 'approved')
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
                  {(activeWithdrawalRequest.status === 'completed' || activeWithdrawalRequest.status === 'approved') ? (
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
