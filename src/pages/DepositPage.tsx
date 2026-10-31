import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { useAdmin } from '../context/AdminContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useLanguage } from '../context/LanguageContext.tsx';
import { TelebirrLogo, CBELogo } from '../components/wallet/PaymentLogos.tsx';
import { LanguageDropdown } from '../components/common/LanguageDropdown.tsx';
import { apiClient } from '../services/apiClient.ts';
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

  // Active Authorized Agents for In-Person Deposit
  const [activeAgents, setActiveAgents] = useState<Array<{ agentCode: string; fullName: string; phone: string }>>([]);

  useEffect(() => {
    if (selectedMethod === 'Agent') {
      apiClient.wallet.getActiveAgents().then(res => {
        if (res.success && res.agents) {
          setActiveAgents(res.agents);
        }
      }).catch(err => console.warn(err));
    }
  }, [selectedMethod]);

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

              {/* 2. AGENT DEPOSIT GUIDE VIEW */}
              {selectedMethod === 'Agent' ? (
                <div style={{ marginTop: '16px' }} className="space-y-4">
                  {/* Your Phone Callout */}
                  <div style={{ background: '#0f172a', border: '2px solid #f59e0b', borderRadius: '16px', padding: '18px', textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      {lang === 'am' ? 'ለኤጀንቱ የሚሰጡት ስልክ ቁጥር' : 'PHONE NUMBER TO GIVE TO AGENT'}
                    </div>
                    <div style={{ fontSize: '26px', fontWeight: 900, fontFamily: 'monospace', color: '#f8fafc', margin: '10px 0' }}>
                      {user?.phone || user?.nationalPhone || '09...'}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(user?.phone || user?.nationalPhone || '', 'Phone Number')}
                      style={{ background: '#334155', color: '#fbbf24', border: 'none', padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      <i className="fa-regular fa-copy" style={{ marginRight: '6px' }}></i>
                      {lang === 'am' ? 'ስልክ ቁጥር ኮፒ አድርግ' : 'Copy Phone Number'}
                    </button>
                  </div>

                  {/* 1.5x Loyalty Reward Banner */}
                  <div style={{ background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(16, 185, 129, 0.15))', border: '1px solid #f59e0b', borderRadius: '12px', padding: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '24px' }}>🪙</span>
                    <div style={{ fontSize: '12px', color: '#f1f5f9' }}>
                      <strong style={{ color: '#fbbf24', display: 'block' }}>
                        {lang === 'am' ? '+1.5 እጥፍ የሎያሊቲ ሳንቲሞች ሽልማት!' : '+1.5x Loyalty Coins on Agent Deposits!'}
                      </strong>
                      <span>
                        {lang === 'am' ? 'ለምሳሌ 100 ብር ሲያስገቡ 150 ሳንቲሞች በቅጽበት ይሸለማሉ!' : 'For example, deposit 100 ETB and get 150 Coins instantly!'}
                      </span>
                    </div>
                  </div>

                  {/* Step by Step Instructions */}
                  <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '14px', fontSize: '12px', color: '#cbd5e1', lineHeight: '1.6' }}>
                    <div style={{ fontWeight: 800, color: '#fbbf24', marginBottom: '8px' }}>
                      {lang === 'am' ? 'የተቀማጭ ቅደም ተከተል፡' : 'How to Deposit via Agent:'}
                    </div>
                    <ol style={{ paddingLeft: '18px', margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <li>{lang === 'am' ? 'በአካባቢዎ የሚገኝ ፈቃድ ያለው የሶኒክ ቢንጎ ኤጀንት ያነጋግሩ።' : 'Contact or visit any certified Sonic Bingo Agent.'}</li>
                      <li>{lang === 'am' ? 'የሚፈልጉትን መጠን (ከ 50 ብር ጀምሮ) በጥሬ ገንዘብ ወይም በቴሌብር ይክፈሉ።' : 'Pay the desired amount (min 50 ETB) in cash or Telebirr/M-Pesa.'}</li>
                      <li>{lang === 'am' ? 'የተመዘገቡበትን ስልክ ቁጥር ለኤጀንቱ ይስጡ።' : 'Provide your registered phone number to the agent.'}</li>
                      <li>{lang === 'am' ? 'ኤጀንቱ በ10 ሰከንድ ውስጥ አካውንትዎን ይሞላል!' : 'The agent instantly credits your account in 10 seconds!'}</li>
                    </ol>
                  </div>

                  {/* Active Agents Roster */}
                  {activeAgents.length > 0 && (
                    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '14px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', marginBottom: '10px' }}>
                        {lang === 'am' ? 'የተረጋገጡ የሎሚ ኤጀንቶች' : 'Certified Active Agents'}
                      </div>
                      <div className="space-y-2">
                        {activeAgents.map(a => (
                          <div key={a.agentCode} style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '13px', color: '#f8fafc' }}>{a.fullName}</div>
                              <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>{a.phone} ({a.agentCode})</div>
                            </div>
                            <a
                              href={`tel:${a.phone}`}
                              style={{ background: '#10b981', color: '#0f172a', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 800, textDecoration: 'none' }}
                            >
                              📞 Call
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => switchPage('games')}
                    className="btn-submit-payment-gold"
                  >
                    <span>{lang === 'am' ? 'ወደ ጨዋታ ተመለስ' : 'Return to Games'}</span>
                  </button>
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
