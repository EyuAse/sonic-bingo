import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { useAdmin } from '../../context/AdminContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { useWallet } from '../../context/WalletContext.tsx';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { TelebirrLogo, CBELogo } from './PaymentLogos.tsx';
import { apiClient } from '../../services/apiClient.ts';
import {
  CBE_BIRR_RECEIVER,
  getCurrentTelebirrReceiver,
  rotateTelebirrReceiver,
  toggleTelebirrReceiver,
  PaymentReceiver
} from '../../config/paymentReceivers.ts';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DepositModal: React.FC<DepositModalProps> = ({ isOpen, onClose }) => {
  const { showToast, switchPage } = useApp();
  const { refreshAdminData } = useAdmin();
  const { refreshBalance } = useWallet();
  const { user, updateProfile } = useAuth();
  const { t, lang } = useLanguage();

  const [selectedMethod, setSelectedMethod] = useState<'Telebirr' | 'CBE'>('Telebirr');
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
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submittedRef, setSubmittedRef] = useState<string>('');

  // Auto-fill from user's attached accounts or profile when method changes
  useEffect(() => {
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

  if (!isOpen) return null;

  // Active Receiver Details (CBE Birr or Alternating Telebirr)
  const activeReceiver = selectedMethod === 'Telebirr' ? telebirrReceiver : CBE_BIRR_RECEIVER;
  const activeReceiverNumber = activeReceiver.accountNumber;
  const receiverName = activeReceiver.accountName;
  const receiverServiceName = activeReceiver.serviceName;
  const quickAmounts = [50, 100, 200, 500, 1000, 1500];

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
          let width = img.width;
          let height = img.height;
          const maxDim = 1000;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', 0.85);
            setReceiptImage(compressed);
            showToast('📸 Screenshot attached!');
          } else {
            setReceiptImage(rawResult);
            showToast('📸 Screenshot attached!');
          }
        };
        img.src = rawResult;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount < 50 || amount > 1500) {
      showToast(lang === 'am' ? '⚠️ የተቀማጭ መጠን ከ 50 እስከ 1,500 ብር መሆን አለበት።' : '⚠️ Deposit amount must be between 50 and 1,500 ETB.');
      return;
    }

    if (!playerPhone || playerPhone.trim().length < 8) {
      showToast(lang === 'am' ? '⚠️ እባክዎ ትክክለኛ ስልክ ቁጥር ያስገቡ።' : '⚠️ Please enter your valid mobile number.');
      return;
    }

    setIsSubmitting(true);
    try {
      const assignedRef = transactionRef.trim()
        ? transactionRef.trim().toUpperCase()
        : `${selectedMethod === 'Telebirr' ? 'TX-TB-' : 'TX-CBE-'}${Math.floor(100000 + Math.random() * 900000)}`;

      const res = await apiClient.wallet.deposit({
        amount,
        paymentMethod: selectedMethod,
        playerPhone: playerPhone.trim(),
        transactionRef: assignedRef,
        receiptImage: receiptImage || undefined
      });

      const finalRef = res.deposit?.transactionRef || assignedRef;
      setSubmittedRef(finalRef);
      setIsSubmitted(true);

      // Auto-save phone to attached accounts if not already linked
      if (playerPhone && playerPhone.trim().length >= 9) {
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
      await refreshBalance();
      await refreshAdminData();
      showToast(lang === 'am' ? `✅ የ${amount} ብር ተቀማጭ ጥያቄ ተልኳል!` : `✅ Deposit request of ${amount} ETB submitted!`);
    } catch (err: any) {
      showToast(`❌ ${err.message || 'Deposit submission failed'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    setIsSubmitted(false);
    setTransactionRef('');
    setReceiptImage(null);
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
            <div className="modal-title-icon green">
              <i className="fa-solid fa-arrow-down"></i>
            </div>
            <div className="modal-title-texts">
              <h3 className="modal-heading">
                {isSubmitted
                  ? (lang === 'am' ? 'ተቀማጭ ተልኳል' : 'Deposit Submitted')
                  : (lang === 'am' ? 'ገንዘብ አስገባ' : 'Deposit Funds')}
              </h3>
              <span className="modal-subheading">
                {lang === 'am' ? 'ፈጣን አውቶማቲክ ክፍያ' : 'Instant automated cashier credit'}
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
                onClick={handleViewHistory}
              >
                <span>{lang === 'am' ? 'በተቀማጭ ታሪክ እይ' : 'View in Deposit History'}</span>
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
          /* Deposit Form */
          <form className="payment-modal-form" onSubmit={handleDepositSubmit}>
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
                    <TelebirrLogo size={24} />
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
                    <CBELogo size={24} />
                  </div>
                  <div className="method-text-col">
                    <strong className="method-name">CBE Bank</strong>
                    <span className="method-badge-fast">CBE Birr / Bank</span>
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
                  <span className="step-num">2</span> {lang === 'am' ? 'የተቀማጭ መጠን' : 'Deposit Amount'}
                </label>
                <span className="min-limit-sub">{lang === 'am' ? 'ዝቅተኛ፡ 50 • ከፍተኛ፡ 1,500 ብር' : 'Min: 50 • Max: 1,500 ETB'}</span>
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
                  max="1500"
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
                  <span className="receiver-num-bold">{activeReceiver.formattedNumber}</span>
                </div>

                <div className="receiver-name-row">
                  <span className="receiver-name-lbl">{lang === 'am' ? 'የአካውንት ስም፡' : 'Account Name:'}</span>
                  <strong className="receiver-name-val">{receiverName}</strong>
                </div>

                <p className="receiver-note-sub">
                  {lang === 'am'
                    ? `ትክክለኛውን መጠን ከ${receiverServiceName} መተግበሪያዎ ይላኩ፣ ከዚያም የግብይት ቁጥሩን ከታች ያስገቡ።`
                    : `Transfer exact amount from your ${receiverServiceName} app, then enter the SMS reference below.`}
                </p>
              </div>
            </div>

            {/* 4. Verification & Submission */}
            <div className="form-section-block">
              <label className="form-section-label">
                <span className="step-num">4</span> {lang === 'am' ? 'የማረጋገጫ ዝርዝሮች' : 'Verification Details'}
              </label>

              <div className="input-field-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label className="field-tiny-label">
                    {selectedMethod === 'Telebirr'
                      ? (lang === 'am' ? 'የእርስዎ የቴሌብር ቁጥር' : 'Your Telebirr Phone Number')
                      : (lang === 'am' ? 'የእርስዎ የሲቢኢ ቁጥር/ስልክ' : 'Your CBE Account / Phone')}
                  </label>
                  {matchingAttachedAccounts.length > 0 && (
                    <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 600 }}>
                      <i className="fa-solid fa-circle-check" style={{ marginRight: '3px' }}></i>
                      {lang === 'am' ? 'የተያያዘ አካውንት' : 'Linked Account'}
                    </span>
                  )}
                </div>

                {matchingAttachedAccounts.length > 0 && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
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
                        {acc.isDefault ? '⭐ ' : ''}{acc.accountNumber}
                      </button>
                    ))}
                  </div>
                )}

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
                  id="deposit-receipt-file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  style={{ display: 'none' }}
                />
                <label htmlFor="deposit-receipt-file" className="btn-upload-label">
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
            <button type="submit" className="btn-submit-payment-gold">
              <i className="fa-solid fa-bolt"></i>
              <span>{lang === 'am' ? `አሁን ${amount > 0 ? `${amount} ብር` : ''} አስገባ` : `Deposit ${amount > 0 ? `${amount} ETB` : ''} Now`}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
