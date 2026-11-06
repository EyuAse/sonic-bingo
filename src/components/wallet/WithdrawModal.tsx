import React, { useState, useEffect } from 'react';
import { useWallet } from '../../context/WalletContext.tsx';
import { useApp } from '../../context/AppContext.tsx';
import { useAdmin } from '../../context/AdminContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { TelebirrLogo, CBELogo } from './PaymentLogos.tsx';
import { apiClient } from '../../services/apiClient.ts';

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WithdrawModal: React.FC<WithdrawModalProps> = ({ isOpen, onClose }) => {
  const { balance, refreshBalance } = useWallet();
  const { showToast, switchPage } = useApp();
  const { refreshAdminData } = useAdmin();
  const { user, updateProfile } = useAuth();
  const { t, lang } = useLanguage();

  const [selectedMethod, setSelectedMethod] = useState<'Telebirr' | 'CBE'>('Telebirr');
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
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submittedRef, setSubmittedRef] = useState<string>('');

  // 🛡️ Live Anti-Fraud Withdrawal Eligibility State (5 Completed Games + Max 3/day)
  const [eligibility, setEligibility] = useState<{
    eligible: boolean;
    completedGames: number;
    requiredGames: number;
    todayWithdrawals: number;
    maxDailyWithdrawals: number;
    reason?: string;
  } | null>(null);
  const [isLoadingEligibility, setIsLoadingEligibility] = useState<boolean>(true);

  // Fetch real-time eligibility whenever modal is opened
  useEffect(() => {
    if (isOpen) {
      setIsLoadingEligibility(true);
      apiClient.wallet.getWithdrawalEligibility()
        .then(res => {
          if (res.success) {
            setEligibility(res);
          }
        })
        .catch(err => {
          console.error('Failed to fetch withdrawal eligibility:', err);
        })
        .finally(() => {
          setIsLoadingEligibility(false);
        });
    }
  }, [isOpen]);

  // Auto-fill from user's attached accounts or profile when method changes
  useEffect(() => {
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

  if (!isOpen) return null;

  const quickAmounts = [50, 100, 200, 500, 1000, 2000];

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (amount < 50) {
      showToast(lang === 'am' ? '⚠️ ዝቅተኛ የማውጣት መጠን 50 ብር ነው።' : '⚠️ Minimum withdrawal amount is 50 ETB.');
      return;
    }

    if (amount > 2000) {
      showToast(lang === 'am' ? '⚠️ ከፍተኛ የማውጣት መጠን በአንድ ግብይት 2,000 ብር ነው።' : '⚠️ Maximum withdrawal limit is 2,000 ETB per transaction.');
      return;
    }

    if (eligibility && !eligibility.eligible) {
      showToast(`⚠️ ${eligibility.reason || (lang === 'am' ? 'የማውጣት መስፈርቱን አላሟሉም' : 'Withdrawal requirements not met')}`);
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
        paymentMethod: selectedMethod,
        accountPhone: accountNumber.trim(),
        accountName: accountHolder.trim() || user?.fullName || 'Player'
      });

      const assignedRef = res.withdrawal?.id
        ? `WD-${selectedMethod.toUpperCase()}-${res.withdrawal.id.slice(0, 8)}`
        : `WD-${selectedMethod.toUpperCase()}-${Date.now().toString().slice(-6)}`;

      setSubmittedRef(assignedRef);
      setIsSubmitted(true);

      // Auto-save newly entered account to attached accounts
      if (accountNumber && accountNumber.trim().length >= 8) {
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

      await refreshBalance();
      await refreshAdminData();
      showToast(lang === 'am' ? `💸 የ${amount} ብር የወጪ ጥያቄ ተልኳል!` : `💸 Withdrawal request of ${amount} ETB submitted!`);
    } catch (err: any) {
      showToast(`❌ ${err.message || 'Withdrawal failed'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    setIsSubmitted(false);
    onClose();
  };

  const handleViewHistory = () => {
    handleResetAndClose();
    switchPage('wallet');
  };

  return (
    <div className="custom-modal-backdrop" onClick={handleResetAndClose}>
      <div className="fresh-payment-modal-card" onClick={e => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="payment-modal-header">
          <div className="payment-modal-title-group">
            <div className="modal-title-icon red">
              <i className="fa-solid fa-arrow-up-from-bracket"></i>
            </div>
            <div className="modal-title-texts">
              <h3 className="modal-heading">
                {isSubmitted
                  ? (lang === 'am' ? 'የወጪ ጥያቄ ተልኳል' : 'Withdrawal Submitted')
                  : (lang === 'am' ? 'ገንዘብ አውጣ' : 'Withdraw Funds')}
              </h3>
              <span className="modal-subheading">
                {lang === 'am' ? 'በቴሌብር ወይም በንግድ ባንክ ፈጣን ክፍያ' : 'Fast settlement to Telebirr or CBE Bank'}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="btn-modal-close"
            onClick={handleResetAndClose}
            title="Close"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {isSubmitted ? (
          /* Success Confirmation View */
          <div className="payment-success-content">
            <div className="success-icon-circle green">
              <i className="fa-solid fa-check"></i>
            </div>

            <h3 className="success-main-title">
              {lang === 'am' ? 'የክፍያ ጥያቄ ተቀብለናል!' : 'Payout Request Submitted!'}
            </h3>
            <p className="success-subtext">
              {lang === 'am' ? (
                <>የ<strong>{amount.toFixed(2)} ብር</strong> ወደ <strong>{selectedMethod} ({accountNumber})</strong> የማውጣት ጥያቄዎ በ24/7 ካሳችን ተቀብሏል።</>
              ) : (
                <>Your cashout of <strong>{amount.toFixed(2)} ETB</strong> to <strong>{selectedMethod} ({accountNumber})</strong> has been received by our 24/7 cashier desk.</>
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
                onClick={handleViewHistory}
              >
                <span>{lang === 'am' ? 'በወጪ ታሪክ እይ' : 'View in Withdrawal History'}</span>
                <i className="fa-solid fa-arrow-right"></i>
              </button>

              <button
                type="button"
                className="btn-payment-action-outline"
                onClick={handleResetAndClose}
              >
                <span>{t('common.done')}</span>
              </button>
            </div>
          </div>
        ) : (
          /* Withdrawal Form */
          <form className="payment-modal-form" onSubmit={handleWithdrawSubmit}>
            {/* Available Balance Banner */}
            <div className="withdraw-balance-banner">
              <div className="balance-banner-left">
                <span className="balance-banner-lbl">{lang === 'am' ? 'ሊወጣ የሚችል ቀሪ ሂሳብ' : 'Withdrawable Balance'}</span>
                <strong className="balance-banner-val">{balance.toFixed(2)} ETB</strong>
              </div>
              <div className="balance-banner-limits">
                <span>{lang === 'am' ? 'ዝቅተኛ፡ 50 ብር' : 'Min: 50 ETB'}</span>
                <span>{lang === 'am' ? 'ከፍተኛ፡ 2,000 ብር' : 'Max: 2,000 ETB'}</span>
              </div>
            </div>

            {/* 🛡️ Responsible Gaming & Anti-Fraud Compliance Card */}
            {eligibility && (
              <div
                style={{
                  background: eligibility.eligible ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                  border: `1px solid ${eligibility.eligible ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.35)'}`,
                  borderRadius: '14px',
                  padding: '12px 14px',
                  marginBottom: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>{eligibility.eligible ? '🛡️' : '🔒'}</span>
                    <strong style={{ fontSize: '13px', color: eligibility.eligible ? '#059669' : '#d97706' }}>
                      {eligibility.eligible
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
                      background: eligibility.eligible ? '#10b981' : '#f59e0b',
                      color: '#fff'
                    }}
                  >
                    {eligibility.eligible ? (lang === 'am' ? 'ተፈቅዷል' : 'ELIGIBLE') : (lang === 'am' ? 'የተቆለፈ' : 'LOCKED')}
                  </span>
                </div>

                {/* Progress Indicators */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11.5px' }}>
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.7)',
                      padding: '6px 8px',
                      borderRadius: '8px',
                      border: '1px solid rgba(0,0,0,0.05)'
                    }}
                  >
                    <div style={{ color: 'var(--mute)', marginBottom: '2px' }}>
                      {lang === 'am' ? 'የተጠናቀቁ ጨዋታዎች' : 'Completed Games'}
                    </div>
                    <strong style={{ color: eligibility.completedGames >= 5 ? '#059669' : '#d97706', fontSize: '12.5px' }}>
                      {eligibility.completedGames} / 5 {eligibility.completedGames >= 5 ? '✓' : ''}
                    </strong>
                  </div>

                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.7)',
                      padding: '6px 8px',
                      borderRadius: '8px',
                      border: '1px solid rgba(0,0,0,0.05)'
                    }}
                  >
                    <div style={{ color: 'var(--mute)', marginBottom: '2px' }}>
                      {lang === 'am' ? 'የዛሬ ወጪዎች' : "Today's Withdrawals"}
                    </div>
                    <strong style={{ color: eligibility.todayWithdrawals < 3 ? '#059669' : '#dc2626', fontSize: '12.5px' }}>
                      {eligibility.todayWithdrawals} / 3 {eligibility.todayWithdrawals < 3 ? '✓' : ''}
                    </strong>
                  </div>
                </div>

                {!eligibility.eligible && (
                  <p style={{ margin: 0, fontSize: '11px', color: '#b45309', lineHeight: 1.4 }}>
                    {eligibility.completedGames < 5
                      ? (lang === 'am'
                          ? `⚠️ ገንዘብ ለማውጣት ቢያንስ 5 ጨዋታዎችን ማጠናቀቅ አለብዎት (ያጠናቀቁት፡ ${eligibility.completedGames}/5 ጨዋታ)።`
                          : `⚠️ You must complete at least 5 games before requesting a withdrawal (Completed: ${eligibility.completedGames}/5 games).`)
                      : (lang === 'am'
                          ? '⚠️ የቀን ገደብ ደርሷል፡ በቀን ቢበዛ 3 ጊዜ ብቻ ማውጣት ይቻላል። እባክዎ ነገ እንደገና ይሞክሩ።'
                          : '⚠️ Maximum 3 withdrawals allowed per day. Please try again tomorrow.')}
                  </p>
                )}
              </div>
            )}

            {/* 1. Payment Method Selection */}
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
                    <TelebirrLogo size={24} />
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
                    <CBELogo size={24} />
                  </div>
                  <div className="method-text-col">
                    <strong className="method-name">CBE Bank</strong>
                    <span className="method-badge-fast">{lang === 'am' ? 'የኢትዮጵያ ንግድ ባንክ' : 'Commercial Bank of Ethiopia'}</span>
                  </div>
                  <div className="method-radio-circ">
                    {selectedMethod === 'CBE' && <div className="radio-dot"></div>}
                  </div>
                </button>
              </div>
            </div>

            {/* 2. Amount Selection */}
            <div className="form-section-block">
              <div className="section-label-row">
                <label className="form-section-label">
                  <span className="step-num">2</span> {lang === 'am' ? 'የማውጫ መጠን' : 'Withdrawal Amount'}
                </label>
                <button
                  type="button"
                  className="btn-max-amount"
                  onClick={() => setAmount(Math.min(balance, 2000))}
                >
                  {lang === 'am' ? 'ሁሉንም (እስከ 2,000)' : 'Max (Up to 2,000)'}
                </button>
              </div>

              {/* Preset Chips */}
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

              {/* Numeric Input */}
              <div className="amount-numeric-input-wrap">
                <span className="currency-tag">ETB</span>
                <input
                  type="number"
                  min="50"
                  max="2000"
                  value={amount || ''}
                  onChange={e => setAmount(Number(e.target.value))}
                  placeholder={lang === 'am' ? 'መጠን ያስገቡ (50 - 2,000)' : 'Enter amount (50 - 2,000)'}
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
              disabled={
                amount > balance ||
                amount < 50 ||
                amount > 2000 ||
                (eligibility !== null && !eligibility.eligible) ||
                isSubmitting ||
                isLoadingEligibility
              }
              style={{
                opacity: (eligibility !== null && !eligibility.eligible) ? 0.6 : 1,
                cursor: (eligibility !== null && !eligibility.eligible) ? 'not-allowed' : 'pointer'
              }}
            >
              <i className="fa-solid fa-arrow-up-from-bracket"></i>
              <span>
                {eligibility && !eligibility.eligible
                  ? (lang === 'am' ? '🔒 የማውጣት መስፈርት አልተሟላም' : '🔒 Withdrawal Criteria Locked')
                  : (lang === 'am' ? `አሁን ${amount > 0 ? `${amount} ብር` : ''} አውጣ` : `Withdraw ${amount > 0 ? `${amount} ETB` : ''} Now`)}
              </span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
