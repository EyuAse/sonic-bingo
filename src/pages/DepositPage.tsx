import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { useAdmin } from '../context/AdminContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useLanguage } from '../context/LanguageContext.tsx';
import { TelebirrLogo, CBELogo } from '../components/wallet/PaymentLogos.tsx';
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

export const DepositPage: React.FC = () => {
  const { switchPage, showToast } = useApp();
  const { addDepositRequest } = useAdmin();
  const { user, updateProfile } = useAuth();
  const { t, lang } = useLanguage();

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

  // Active Authorized Agents for In-Person / Online Deposit (Strict Agent Code Anonymity)
  const [activeAgents, setActiveAgents] = useState<Array<{
    id: string;
    agentCode: string;
    displayName: string;
    phone: string;
    telebirrPhone: string;
    cbeAccount: string;
    mpesaPhone: string | null;
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
    cbeAccount: string;
    mpesaPhone: string | null;
    isOnline: boolean;
    avgApprovalMinutes: number;
  } | null>(null);
  const [agentDepositAmount, setAgentDepositAmount] = useState<number>(100);
  const [agentPaymentRail, setAgentPaymentRail] = useState<'Telebirr' | 'CBE'>('Telebirr');
  const [agentSenderPhone, setAgentSenderPhone] = useState<string>(() => user?.phone || user?.nationalPhone || '');
  const [agentTxRef, setAgentTxRef] = useState<string>('');
  const [agentReceiptImage, setAgentReceiptImage] = useState<string | null>(null);
  const [isSubmittingAgentDeposit, setIsSubmittingAgentDeposit] = useState<boolean>(false);
  const [activeAgentRequest, setActiveAgentRequest] = useState<any | null>(null);

  // Load active agents & existing pending requests when Agent tab is active
  const loadAgentData = async () => {
    try {
      const [agentsRes, myReqsRes] = await Promise.all([
        apiClient.wallet.getActiveAgents(),
        apiClient.wallet.getMyAgentDeposits()
      ]);

      if (agentsRes.success && agentsRes.agents) {
        setActiveAgents(agentsRes.agents);
        if (agentsRes.agents.length > 0 && !selectedAgent) {
          setSelectedAgent(agentsRes.agents[0]);
        }
      }

      if (myReqsRes.success && myReqsRes.requests && myReqsRes.requests.length > 0) {
        const pending = myReqsRes.requests.find(r => r.status === 'pending');
        if (pending) {
          setActiveAgentRequest(pending);
        }
      }
    } catch (err) {
      console.warn('Failed to load agent deposit data:', err);
    }
  };

  useEffect(() => {
    if (selectedMethod === 'Agent') {
      loadAgentData();
    }
  }, [selectedMethod]);

  // Real-time WebSocket listener for instant approval/rejection
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
      // Trigger global balance sync
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
      unsubBalance();
    };
  }, [user?.id, lang]);

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
          {lang === 'am' ? 'ገንዘብ አስገባ' : 'Deposit Funds'}
        </h1>
      </div>

      <div className="subpage-scroll-content">
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
                              return (
                                <div
                                  key={a.agentCode}
                                  onClick={() => setSelectedAgent(a)}
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

                                  {/* Payment Rails */}
                                  <div style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <span>Telebirr:</span>
                                      <span style={{ fontFamily: 'monospace', color: '#f1f5f9', fontWeight: 700 }}>
                                        {a.telebirrPhone || a.phone}
                                      </span>
                                    </div>
                                    {a.cbeAccount && (
                                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>CBE Birr:</span>
                                        <span style={{ fontFamily: 'monospace', color: '#f1f5f9', fontWeight: 700 }}>
                                          {a.cbeAccount}
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

                          {/* Rail Toggle: Telebirr or CBE */}
                          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                            <button
                              type="button"
                              onClick={() => setAgentPaymentRail('Telebirr')}
                              style={{
                                flex: 1,
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: agentPaymentRail === 'Telebirr' ? '1px solid #38bdf8' : '1px solid #334155',
                                background: agentPaymentRail === 'Telebirr' ? 'rgba(56, 189, 248, 0.15)' : '#0f172a',
                                color: agentPaymentRail === 'Telebirr' ? '#38bdf8' : '#94a3b8',
                                fontWeight: 800,
                                fontSize: '12px',
                                cursor: 'pointer'
                              }}
                            >
                              Telebirr ({selectedAgent.telebirrPhone || selectedAgent.phone})
                            </button>
                            {selectedAgent.cbeAccount && (
                              <button
                                type="button"
                                onClick={() => setAgentPaymentRail('CBE')}
                                style={{
                                  flex: 1,
                                  padding: '8px 12px',
                                  borderRadius: '8px',
                                  border: agentPaymentRail === 'CBE' ? '1px solid #eab308' : '1px solid #334155',
                                  background: agentPaymentRail === 'CBE' ? 'rgba(234, 179, 8, 0.15)' : '#0f172a',
                                  color: agentPaymentRail === 'CBE' ? '#eab308' : '#94a3b8',
                                  fontWeight: 800,
                                  fontSize: '12px',
                                  cursor: 'pointer'
                                }}
                              >
                                CBE Bank / Birr
                              </button>
                            )}
                          </div>

                          <div className="deposit-receiver-callout">
                            <div className="receiver-top-row">
                              <span className="receiver-provider-tag">
                                👑 Sonic Agent #{selectedAgent.agentCode} • {agentPaymentRail}
                              </span>
                              <button
                                type="button"
                                className="btn-copy-receiver"
                                onClick={() =>
                                  handleCopy(
                                    agentPaymentRail === 'Telebirr'
                                      ? selectedAgent.telebirrPhone || selectedAgent.phone
                                      : selectedAgent.cbeAccount,
                                    `${agentPaymentRail} Number`
                                  )
                                }
                              >
                                <i className="fa-regular fa-copy"></i> {t('common.copy')}
                              </button>
                            </div>

                            <div className="receiver-number-display">
                              <span className="receiver-number-val">
                                {agentPaymentRail === 'Telebirr'
                                  ? selectedAgent.telebirrPhone || selectedAgent.phone
                                  : selectedAgent.cbeAccount}
                              </span>
                            </div>

                            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
                              {lang === 'am'
                                ? `እባክዎ በትክክል ${agentDepositAmount} ብር ወደዚህ ቁጥር በቴሌብር ይላኩ።`
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
      </div>
    </div>
  );
};
