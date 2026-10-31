import React, { useState, useEffect } from 'react';
import { useWallet } from '../context/WalletContext.tsx';
import { useApp } from '../context/AppContext.tsx';
import { useAdmin } from '../context/AdminContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useLanguage } from '../context/LanguageContext.tsx';
import { TelebirrLogo, CBELogo } from '../components/wallet/PaymentLogos.tsx';
import { LanguageDropdown } from '../components/common/LanguageDropdown.tsx';
import { apiClient } from '../services/apiClient.ts';

export const WithdrawPage: React.FC = () => {
  const { balance, deductBalance, addBalance } = useWallet();
  const { showToast, switchPage } = useApp();
  const { addWithdrawRequest } = useAdmin();
  const { user, updateProfile } = useAuth();
  const { t, lang } = useLanguage();

  const [selectedMethod, setSelectedMethod] = useState<'Telebirr' | 'CBE' | 'AgentVoucher'>('Telebirr');
  const [amount, setAmount] = useState<number>(200);
  const [accountHolder, setAccountHolder] = useState<string>(() => {
    const attached = user?.attachedAccounts || [];
    const match = attached.find(a => a.type === 'Telebirr' && a.isDefault) || attached.find(a => a.type === 'Telebirr');
    return match?.name || user?.fullName || '';
  });
  const [accountNumber, setAccountNumber] = useState<string>(() => {
    const attached = user?.attachedAccounts || [];
    const match = attached.find(a => a.type === 'Telebirr' && a.isDefault) || attached.find(a => a.type === 'Telebirr');
    return match?.accountNumber || user?.nationalPhone || user?.phone || '';
  });
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [submittedRef, setSubmittedRef] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Active Voucher State (Agent Cash-Out)
  const [activeVoucher, setActiveVoucher] = useState<{
    id: string;
    voucherCode: string;
    amount: number;
    status: string;
    expiresAt: string;
  } | null>(null);
  const [isLoadingVoucher, setIsLoadingVoucher] = useState<boolean>(false);

  // Check for active agent voucher on load
  const checkActiveVoucher = async () => {
    try {
      setIsLoadingVoucher(true);
      const res = await apiClient.wallet.getActiveAgentVoucher();
      if (res.success && res.hasActiveVoucher && res.voucher) {
        setActiveVoucher(res.voucher);
      } else {
        setActiveVoucher(null);
      }
    } catch (err) {
      console.warn('Check active voucher:', err);
    } finally {
      setIsLoadingVoucher(false);
    }
  };

  useEffect(() => {
    checkActiveVoucher();
  }, []);

  // Auto-fill from user's attached accounts or profile when method changes
  useEffect(() => {
    if (selectedMethod === 'AgentVoucher') return;
    const attached = user?.attachedAccounts || [];
    const match = attached.find(a => a.type === selectedMethod && a.isDefault) ||
                  attached.find(a => a.type === selectedMethod);
    if (match) {
      setAccountNumber(match.accountNumber);
      if (match.name) setAccountHolder(match.name);
    } else if (selectedMethod === 'Telebirr' && (user?.nationalPhone || user?.phone)) {
      setAccountNumber(user.nationalPhone || user.phone);
      if (user.fullName) setAccountHolder(user.fullName);
    }
  }, [selectedMethod, user?.attachedAccounts, user?.nationalPhone, user?.phone, user?.fullName]);

  const matchingAttachedAccounts = (user?.attachedAccounts || []).filter(a => a.type === selectedMethod);

  const quickAmounts = [100, 200, 500, 1000, 5000];

  // Standard Telebirr / CBE Withdrawal Submit
  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (amount < 50) {
      showToast(lang === 'am' ? '⚠️ ዝቅተኛ የማውጣት መጠን 50 ብር ነው።' : '⚠️ Minimum withdrawal amount is 50 ETB.');
      return;
    }

    if (amount > 5000) {
      showToast(lang === 'am' ? '⚠️ ከፍተኛ የማውጣት መጠን 5,000 ብር ነው።' : '⚠️ Maximum withdrawal limit is 5,000 ETB.');
      return;
    }

    if (amount > balance) {
      showToast(lang === 'am' ? '❌ በቂ ቀሪ ሂሳብ የለም።' : '❌ Insufficient balance for withdrawal.');
      return;
    }

    if (!accountNumber || accountNumber.trim().length < 8) {
      showToast(lang === 'am' ? '⚠️ እባክዎ ትክክለኛ ስልክ ቁጥር ወይም የባንክ አካውንት ያስገቡ።' : '⚠️ Please enter a valid account or phone number.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiClient.wallet.withdraw({
        amount,
        paymentMethod: selectedMethod as 'Telebirr' | 'CBE',
        accountPhone: accountNumber,
        accountName: accountHolder
      });

      if (!res.success) {
        showToast(`❌ ${(res as any).error || (res as any).message || (lang === 'am' ? 'የወጪ ጥያቄ አልተሳካም' : 'Withdrawal request failed')}`);
        return;
      }

      deductBalance(amount);

      const assignedRef = `WD-${selectedMethod === 'Telebirr' ? 'TB' : 'CBE'}-${Math.floor(100000 + Math.random() * 900000)}`;

      addWithdrawRequest(
        user?.id || 'usr-me',
        accountHolder || user?.fullName || 'Player',
        accountNumber,
        amount,
        selectedMethod as any,
        accountNumber
      );

      setSubmittedRef(assignedRef);
      setIsSubmitted(true);

      if (accountNumber && accountNumber.trim().length >= 8 && (selectedMethod === 'Telebirr' || selectedMethod === 'CBE')) {
        const clean = accountNumber.trim();
        const attached = user?.attachedAccounts || [];
        if (!attached.some(a => a.accountNumber === clean)) {
          const newAcc = {
            id: `acc-${Date.now()}`,
            type: selectedMethod,
            name: accountHolder.trim() || `${user?.fullName || 'Player'} (${selectedMethod})`,
            accountNumber: clean,
            isDefault: attached.length === 0,
            isVerified: true
          };
          updateProfile({ attachedAccounts: [...attached, newAcc] });
        }
      }
    } catch (err: any) {
      showToast(`❌ ${err.message || 'Withdrawal failed'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Agent Voucher Creation Handler
  const handleCreateVoucher = async () => {
    if (amount < 50) {
      showToast(lang === 'am' ? '⚠️ ዝቅተኛ የማውጣት መጠን 50 ብር ነው።' : '⚠️ Minimum withdrawal amount is 50 ETB.');
      return;
    }
    if (amount > 5000) {
      showToast(lang === 'am' ? '⚠️ ከፍተኛ የማውጣት መጠን 5,000 ብር ነው።' : '⚠️ Maximum withdrawal limit is 5,000 ETB.');
      return;
    }
    if (amount > balance) {
      showToast(lang === 'am' ? '❌ በቂ ቀሪ ሂሳብ የለም።' : '❌ Insufficient balance for withdrawal.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await apiClient.wallet.createAgentVoucher(amount);
      if (res.success && res.voucher) {
        deductBalance(amount);
        setActiveVoucher(res.voucher);
        showToast(lang === 'am' ? '🎟️ የገንዘብ ማውጫ ቫውቸር በተሳካ ሁኔታ ተፈጥሯል!' : '🎟️ Cash-Out Voucher created successfully!');
      }
    } catch (err: any) {
      showToast(`❌ ${err.message || 'Failed to generate voucher'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Agent Voucher Cancellation Handler
  const handleCancelVoucher = async () => {
    if (!activeVoucher) return;
    try {
      setIsSubmitting(true);
      const res = await apiClient.wallet.cancelAgentVoucher(activeVoucher.id);
      if (res.success) {
        addBalance(activeVoucher.amount);
        setActiveVoucher(null);
        showToast(lang === 'am' ? '✅ ቫውቸሩ ተሰርዟል፤ ገንዘቡ ተመልሷል።' : '✅ Voucher cancelled; funds returned to your balance.');
      }
    } catch (err: any) {
      showToast(`❌ ${err.message || 'Failed to cancel voucher'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page active page-payment-standalone">
      <div className="payment-top-app-bar">
        <button
          type="button"
          className="btn-app-bar-back"
          onClick={() => switchPage('wallet')}
          title="Back to Wallet"
        >
          <i className="fa-solid fa-arrow-left"></i>
        </button>
        <h1 className="app-bar-title">{lang === 'am' ? 'ገንዘብ ማውጣት' : 'Withdraw Funds'}</h1>
        <div className="app-bar-lang-pill">
          <LanguageDropdown />
        </div>
      </div>

      <div className="payment-page-container">
        <div className="payment-main-card">
          {isSubmitted ? (
            /* Success Receipt */
            <div className="payment-success-view">
              <div className="success-icon-circ">
                <i className="fa-solid fa-circle-check"></i>
              </div>
              <h2 className="success-title">{lang === 'am' ? 'የወጪ ጥያቄዎ በተሳካ ሁኔታ ተልኳል!' : 'Withdrawal Request Submitted!'}</h2>
              <p className="success-sub">
                {lang === 'am' ? (
                  <>የ <strong>{amount.toFixed(2)} ብር</strong> ክፍያ ወደ እርስዎ <strong>{selectedMethod}</strong> አካውንት ({accountNumber}) እየተላለፈ ነው።</>
                ) : (
                  <>Your payout of <strong>{amount.toFixed(2)} ETB</strong> is being transferred to your <strong>{selectedMethod}</strong> account ({accountNumber}).</>
                )}
              </p>

              <div className="success-ref-box">
                <span className="ref-box-lbl">{lang === 'am' ? 'የክፍያ መለያ ቁጥር' : 'PAYOUT REFERENCE'}</span>
                <strong className="ref-box-val">{submittedRef}</strong>
              </div>

              <div className="success-eta-tag">
                <i className="fa-solid fa-clock gold"></i>
                <span>{lang === 'am' ? 'የሚገመተው የማጠናቀቂያ ጊዜ፡ ' : 'Estimated processing time: '}<strong>~1 {lang === 'am' ? 'እስከ 3 ደቂቃዎች' : 'to 3 minutes'}</strong></span>
              </div>

              <div className="success-actions-row">
                <button
                  type="button"
                  className="btn-payment-action-gold"
                  onClick={() => switchPage('wallet')}
                >
                  <span>{lang === 'am' ? 'በወጪ ታሪክ እይ' : 'View in Withdrawal History'}</span>
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
            /* Withdrawal Main Interface */
            <div className="payment-modal-form">
              {/* Available Balance Banner */}
              <div className="withdraw-balance-banner">
                <div className="balance-banner-left">
                  <span className="balance-banner-lbl">{lang === 'am' ? 'ሊወጣ የሚችል ቀሪ ሂሳብ' : 'Withdrawable Balance'}</span>
                  <strong className="balance-banner-val">{balance.toFixed(2)} ETB</strong>
                </div>
                <div className="balance-banner-limits">
                  <span>{lang === 'am' ? 'ዝቅተኛ፡ 50 ብር' : 'Min: 50 ETB'}</span>
                  <span>{lang === 'am' ? 'ከፍተኛ፡ 5,000 ብር' : 'Max: 5,000 ETB'}</span>
                </div>
              </div>

              {/* 1. Payment Method Selection (3 Options) */}
              <div className="form-section-block">
                <label className="form-section-label">
                  <span className="step-num">1</span> {lang === 'am' ? 'የመክፈያ መንገድ ይምረጡ' : 'Choose Payout Method'}
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
                      <span className="method-badge-fast">{lang === 'am' ? '⚡ ፈጣን (1-3 ደቂቃ)' : '⚡ Instant (1-3 min)'}</span>
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
                      <span className="method-badge-fast">{lang === 'am' ? 'የኢትዮጵያ ንግድ ባንክ' : 'Commercial Bank of Ethiopia'}</span>
                    </div>
                    <div className="method-radio-circ">
                      {selectedMethod === 'CBE' && <div className="radio-dot"></div>}
                    </div>
                  </button>

                  {/* 3rd Method: Agent Cash Voucher */}
                  <button
                    type="button"
                    className={`btn-payment-method-card ${selectedMethod === 'AgentVoucher' ? 'active' : ''}`}
                    onClick={() => setSelectedMethod('AgentVoucher')}
                  >
                    <div className="method-logo-wrap" style={{ background: '#f59e0b', color: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}>
                      <i className="fa-solid fa-ticket" style={{ fontSize: '18px' }}></i>
                    </div>
                    <div className="method-text-col">
                      <strong className="method-name">{lang === 'am' ? 'የኤጀንት ቫውቸር' : 'Agent Cash Voucher'}</strong>
                      <span className="method-badge-fast" style={{ color: '#fbbf24' }}>
                        {lang === 'am' ? 'በቀጥታ በጥሬ ገንዘብ' : 'In-Person Cash Counter'}
                      </span>
                    </div>
                    <div className="method-radio-circ">
                      {selectedMethod === 'AgentVoucher' && <div className="radio-dot"></div>}
                    </div>
                  </button>
                </div>
              </div>

              {/* 2. IF AGENT VOUCHER IS SELECTED */}
              {selectedMethod === 'AgentVoucher' ? (
                <div className="space-y-4" style={{ marginTop: '16px' }}>
                  {activeVoucher ? (
                    /* Active Voucher Display Card */
                    <div style={{ background: '#0f172a', border: '2px solid #f59e0b', borderRadius: '16px', padding: '20px', textAlign: 'center' }}>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        {lang === 'am' ? 'ንቁ የማውጫ ቫውቸር' : 'ACTIVE CASHOUT VOUCHER'}
                      </div>

                      <div style={{ fontSize: '32px', fontWeight: 900, fontFamily: 'monospace', color: '#f8fafc', margin: '12px 0', letterSpacing: '4px' }}>
                        {activeVoucher.voucherCode}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(activeVoucher.voucherCode);
                          showToast('📋 Voucher code copied!');
                        }}
                        style={{ background: '#334155', color: '#fbbf24', border: 'none', padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', marginBottom: '14px' }}
                      >
                        <i className="fa-regular fa-copy" style={{ marginRight: '6px' }}></i>
                        {lang === 'am' ? 'ኮዱን ኮፒ አድርግ' : 'Copy Voucher Code'}
                      </button>

                      <div style={{ background: '#1e293b', borderRadius: '10px', padding: '12px', margin: '10px 0', fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#94a3b8' }}>{lang === 'am' ? 'የገንዘብ መጠን፡' : 'Payout Amount:'}</span>
                        <strong style={{ color: '#10b981', fontSize: '16px' }}>{activeVoucher.amount.toFixed(2)} ETB</strong>
                      </div>

                      <p style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: '1.5', margin: '12px 0' }}>
                        {lang === 'am'
                          ? 'ይህን ኮድ ለየትኛውም ፈቃድ ላለው የሎሚ/ኤንቁ ኤጀንት በማሳየት ጥሬ ገንዘብዎን በቅጽበት ይቀበሉ።'
                          : 'Present this 6-character voucher code to any certified Enqu Agent counter to collect your physical cash.'}
                      </p>

                      <button
                        type="button"
                        onClick={handleCancelVoucher}
                        disabled={isSubmitting}
                        style={{ width: '100%', background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '10px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', marginTop: '8px' }}
                      >
                        {lang === 'am' ? '❌ ቫውቸሩን ሰርዝ እና ገንዘቡን መልስ' : '❌ Cancel Voucher & Unlock Funds'}
                      </button>
                    </div>
                  ) : (
                    /* Generate Voucher Form */
                    <div>
                      <div className="form-section-block">
                        <div className="section-label-row">
                          <label className="form-section-label">
                            <span className="step-num">2</span> {lang === 'am' ? 'የቫውቸር መጠን ይምረጡ' : 'Select Voucher Amount'}
                          </label>
                          <button
                            type="button"
                            className="btn-max-amount"
                            onClick={() => setAmount(Math.min(balance, 5000))}
                          >
                            {lang === 'am' ? 'ሁሉንም (እስከ 5,000)' : 'Max (Up to 5,000)'}
                          </button>
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
                            max="5000"
                            value={amount || ''}
                            onChange={e => setAmount(Number(e.target.value))}
                            placeholder={lang === 'am' ? 'መጠን ያስገቡ' : 'Enter amount'}
                            required
                          />
                        </div>
                      </div>

                      <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '14px', fontSize: '12px', color: '#94a3b8', lineHeight: '1.6', margin: '14px 0' }}>
                        <div style={{ fontWeight: 800, color: '#fbbf24', marginBottom: '4px' }}>
                          💡 {lang === 'am' ? 'የኤጀንት ካውንተር አሰራር፡' : 'How Agent Cash-Out Works:'}
                        </div>
                        {lang === 'am'
                          ? 'ቫውቸሩን ሲፈጥሩ ገንዘቡ ተይዞ ይቆያል። ለኤጀንቱ ኮዱን ሰጥተው ጥሬ ገንዘብ ሲቀበሉ ይጠናቀቃል። ካልፈለጉ በማንኛውም ሰዓት መሰረዝ ይችላሉ።'
                          : 'Funds are securely locked in escrow. Present the generated code to your local agent to collect cash. You can cancel and release funds at any time.'}
                      </div>

                      <button
                        type="button"
                        onClick={handleCreateVoucher}
                        disabled={amount > balance || amount < 50 || isSubmitting}
                        className="btn-submit-payment-gold"
                      >
                        <i className={`fa-solid ${isSubmitting ? 'fa-spinner fa-spin' : 'fa-ticket'}`}></i>
                        <span>
                          {isSubmitting
                            ? (lang === 'am' ? 'ቫውቸር እየተዘጋጀ ነው...' : 'Generating Voucher...')
                            : (lang === 'am' ? `የ ${amount} ብር ቫውቸር አውጣ` : `Generate ${amount} ETB Cash Voucher`)}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* Standard Telebirr / CBE Form */
                <form onSubmit={handleWithdrawSubmit}>
                  {/* 2. Amount Selection */}
                  <div className="form-section-block">
                    <div className="section-label-row">
                      <label className="form-section-label">
                        <span className="step-num">2</span> {lang === 'am' ? 'የማውጫ መጠን' : 'Withdrawal Amount'}
                      </label>
                      <button
                        type="button"
                        className="btn-max-amount"
                        onClick={() => setAmount(Math.min(balance, 5000))}
                      >
                        {lang === 'am' ? 'ሁሉንም (እስከ 5,000)' : 'Max (Up to 5,000)'}
                      </button>
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
                        max="5000"
                        value={amount || ''}
                        onChange={e => setAmount(Number(e.target.value))}
                        placeholder={lang === 'am' ? 'መጠን ያስገቡ' : 'Enter amount'}
                        required
                      />
                    </div>
                  </div>

                  {/* 3. Destination Account Details */}
                  <div className="form-section-block">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label className="form-section-label" style={{ margin: 0 }}>
                        <span className="step-num">3</span> {lang === 'am' ? 'ገንዘቡ የሚላክበት አካውንት' : 'Payout Destination'}
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
                            onClick={() => {
                              setAccountNumber(acc.accountNumber);
                              if (acc.name) setAccountHolder(acc.name);
                            }}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '12px',
                              fontSize: '0.72rem',
                              fontWeight: accountNumber === acc.accountNumber ? 700 : 500,
                              background: accountNumber === acc.accountNumber ? 'rgba(5, 150, 105, 0.12)' : '#f8fafc',
                              border: accountNumber === acc.accountNumber ? '1px solid #10b981' : '1px solid #e2e8f0',
                              color: accountNumber === acc.accountNumber ? '#047857' : '#64748b',
                              cursor: 'pointer'
                            }}
                          >
                            {acc.isDefault ? '⭐ ' : ''}{acc.accountNumber} ({acc.name})
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="input-field-group">
                      <label className="field-tiny-label">{lang === 'am' ? 'የአካውንት ባለቤት ስም' : 'Account Holder Name'}</label>
                      <div className="field-input-box">
                        <i className="fa-solid fa-user field-icon"></i>
                        <input
                          type="text"
                          value={accountHolder}
                          onChange={e => setAccountHolder(e.target.value)}
                          placeholder={lang === 'am' ? 'ሙሉ ስም' : 'Full Name'}
                          required
                        />
                      </div>
                    </div>

                    <div className="input-field-group" style={{ marginTop: '8px' }}>
                      <label className="field-tiny-label">
                        {selectedMethod === 'Telebirr'
                          ? (lang === 'am' ? 'የቴሌብር ስልክ ቁጥር' : 'Telebirr Phone Number')
                          : (lang === 'am' ? 'የኢትዮጵያ ንግድ ባንክ ሒሳብ ቁጥር' : 'CBE Bank Account Number')}
                      </label>
                      <div className="field-input-box">
                        <i className={`fa-solid ${selectedMethod === 'Telebirr' ? 'fa-mobile-screen' : 'fa-building-columns'} field-icon`}></i>
                        <input
                          type="text"
                          value={accountNumber}
                          onChange={e => setAccountNumber(e.target.value)}
                          placeholder={selectedMethod === 'Telebirr' ? (lang === 'am' ? 'ስልክ ቁጥር (ምሳሌ፡ 09...)' : 'Phone number (e.g. 09...)') : (lang === 'am' ? 'የCBE ሒሳብ ወይም CBE Birr ቁጥር' : 'CBE Account or CBE Birr number')}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    className="btn-submit-payment-gold"
                    disabled={amount > balance || amount < 50 || isSubmitting}
                  >
                    <i className={`fa-solid ${isSubmitting ? 'fa-spinner fa-spin' : 'fa-arrow-up-from-bracket'}`}></i>
                    <span>
                      {isSubmitting
                        ? (lang === 'am' ? 'እየተላከ ነው...' : 'Processing...')
                        : (lang === 'am' ? `አሁን ${amount > 0 ? `${amount} ብር` : ''} አውጣ` : `Withdraw ${amount > 0 ? `${amount} ETB` : ''} Now`)}
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
