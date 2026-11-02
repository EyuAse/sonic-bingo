import React, { useState, useEffect, useRef } from 'react';
import { apiClient } from '../../services/apiClient.ts';
import { TelebirrLogo, CBELogo, MpesaLogo } from '../wallet/PaymentLogos.tsx';
import { socketService } from '../../services/socketService.ts';
import { compressImage, formatFileSize, CompressedImageResult } from '../../utils/imageCompressor.ts';

interface AgentRechargeDeskProps {
  onRechargeSubmitted: () => void;
  showToast: (msg: string) => void;
}

export const AgentRechargeDesk: React.FC<AgentRechargeDeskProps> = ({
  onRechargeSubmitted,
  showToast
}) => {
  const [amount, setAmount] = useState<number>(5000);
  const [paymentMethod, setPaymentMethod] = useState<'Telebirr' | 'CBE' | 'M-Pesa'>('Telebirr');
  const [transactionCode, setTransactionCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recharges, setRecharges] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Receipt Screenshot Attachment State (Client-Side Compressed)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [compressionStats, setCompressionStats] = useState<CompressedImageResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [viewingReceiptModal, setViewingReceiptModal] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchHistory = async () => {
    try {
      setIsLoadingHistory(true);
      const res = await apiClient.agent.getRecharges();
      if (res.success && res.recharges) {
        setRecharges(res.recharges);
      }
    } catch (err) {
      console.error('Error fetching recharge history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Live Official Accounts State from Neon DB (Zero hardcoding)
  const [officialAccounts, setOfficialAccounts] = useState<any[]>([]);
  const [isLoadingOfficialAccounts, setIsLoadingOfficialAccounts] = useState<boolean>(true);

  const fetchOfficialAccounts = async () => {
    try {
      setIsLoadingOfficialAccounts(true);
      const res = await apiClient.agent.getOfficialAccounts();
      if (res.success && res.accounts) {
        setOfficialAccounts(res.accounts);
      }
    } catch (err) {
      console.warn('Error fetching live official accounts:', err);
    } finally {
      setIsLoadingOfficialAccounts(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    fetchOfficialAccounts();
    const interval = setInterval(fetchHistory, 15000);
    const unsub = socketService.on('official_accounts_updated', () => {
      fetchOfficialAccounts();
    });
    return () => {
      clearInterval(interval);
      unsub();
    };
  }, []);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`📋 Copied ${label}: ${text}`);
  };

  const handleProcessFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('⚠️ Please upload an image file (PNG, JPG, or WEBP).');
      return;
    }
    try {
      const result = await compressImage(file, 1200, 0.75);
      setReceiptPreview(result.base64);
      setCompressionStats(result);
      showToast(`📸 Receipt compressed: ${formatFileSize(result.originalSize)} ➔ ${formatFileSize(result.compressedSize)} (${result.savingsPercent}% saved)`);
    } catch (err: any) {
      showToast(`❌ Failed to process image: ${err.message || 'Unknown error'}`);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleProcessFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleProcessFile(file);
  };

  const handleRemoveReceipt = () => {
    setReceiptPreview(null);
    setCompressionStats(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmitRecharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount < 1000) {
      showToast('⚠️ Minimum float recharge is 1,000 ETB.');
      return;
    }
    if (!transactionCode.trim()) {
      showToast('⚠️ Please enter your transaction reference code.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await apiClient.agent.requestRecharge({
        amount,
        paymentMethod,
        transactionCode: transactionCode.trim().toUpperCase(),
        receiptImage: receiptPreview || undefined
      });

      if (res.success) {
        showToast('🎉 Recharge request submitted! Operations team will verify and credit your float.');
        setTransactionCode('');
        setReceiptPreview(null);
        setCompressionStats(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        fetchHistory();
        onRechargeSubmitted();
      }
    } catch (err: any) {
      showToast(`❌ ${err.message || 'Failed to submit recharge'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const quickAmounts = [1000, 2000, 5000, 10000, 20000, 50000];

  const formatAccountNumber = (num: string) => {
    const clean = (num || '').replace(/\s+/g, '');
    if (clean.length === 10 && (clean.startsWith('09') || clean.startsWith('07'))) {
      return `${clean.slice(0, 2)} ${clean.slice(2, 4)} ${clean.slice(4, 6)} ${clean.slice(6, 8)} ${clean.slice(8)}`;
    }
    if (clean.length === 13) {
      return `${clean.slice(0, 4)} ${clean.slice(4, 8)} ${clean.slice(8, 12)} ${clean.slice(12)}`;
    }
    return num;
  };

  const getRailStyle = (provider: string) => {
    const norm = (provider || '').toLowerCase();
    if (norm.includes('telebirr')) {
      return {
        color: '#0284c7',
        bg: 'rgba(2, 132, 199, 0.05)',
        border: 'rgba(2, 132, 199, 0.25)',
        logo: <TelebirrLogo size={28} />
      };
    }
    if (norm.includes('cbe') || norm.includes('commercial')) {
      return {
        color: '#b45309',
        bg: 'rgba(245, 158, 11, 0.05)',
        border: 'rgba(245, 158, 11, 0.25)',
        logo: <CBELogo size={28} />
      };
    }
    return {
      color: '#e11d48',
      bg: 'rgba(225, 29, 72, 0.05)',
      border: 'rgba(225, 29, 72, 0.25)',
      logo: <MpesaLogo size={28} />
    };
  };

  return (
    <div className="sonic-agent-desk-container" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* 1. Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          borderRadius: '18px',
          padding: '24px',
          color: '#ffffff',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.15)'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '26px' }}>🔄</span>
            <h2 style={{ fontSize: '22px', fontWeight: 900, margin: 0, letterSpacing: '-0.3px' }}>
              Request Float Replenishment
            </h2>
          </div>
          <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#94a3b8', lineHeight: 1.5 }}>
            Top up your operational working float via official Telebirr or CBE accounts. Funds are verified and credited with <strong>0% fee</strong>.
          </p>
        </div>

        <div
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '12px',
            padding: '10px 18px',
            textAlign: 'right'
          }}
        >
          <div style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 800, textTransform: 'uppercase' }}>
            Minimum Recharge
          </div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: '#ffffff' }}>
            1,000 <span style={{ fontSize: '13px', color: '#94a3b8' }}>ETB</span>
          </div>
        </div>
      </div>

      {/* 2. Main 2-Column Checkout Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px', marginBottom: '28px' }}>
        {/* LEFT COLUMN: INTERACTIVE CHECKOUT WIZARD */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '18px',
            border: '1px solid #e2e8f0',
            padding: '24px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.04)'
          }}
        >
          <form onSubmit={handleSubmitRecharge}>
            {/* Step 1: Select Payment Rail with Real Logos */}
            <div style={{ marginBottom: '22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <label style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#0f172a', color: '#ffffff', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>1</span>
                  <span>Select Payment Method</span>
                </label>
                <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 700 }}>🟢 Verified Direct Rails</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {/* Rail 1: Telebirr */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('Telebirr')}
                  style={{
                    padding: '12px 10px',
                    borderRadius: '12px',
                    border: paymentMethod === 'Telebirr' ? '2px solid #0284c7' : '1px solid #e2e8f0',
                    background: paymentMethod === 'Telebirr' ? 'rgba(2, 132, 199, 0.08)' : '#f8fafc',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    textAlign: 'left',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <TelebirrLogo size={26} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a' }}>Telebirr</div>
                    <div style={{ fontSize: '10px', color: '#0284c7', fontWeight: 700 }}>Super Agent</div>
                  </div>
                </button>

                {/* Rail 2: CBE Bank */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CBE')}
                  style={{
                    padding: '12px 10px',
                    borderRadius: '12px',
                    border: paymentMethod === 'CBE' ? '2px solid #b45309' : '1px solid #e2e8f0',
                    background: paymentMethod === 'CBE' ? 'rgba(245, 158, 11, 0.08)' : '#f8fafc',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    textAlign: 'left',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <CBELogo size={26} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a' }}>CBE Bank</div>
                    <div style={{ fontSize: '10px', color: '#b45309', fontWeight: 700 }}>Commercial Bank</div>
                  </div>
                </button>

                {/* Rail 3: Safaricom M-Pesa */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('M-Pesa')}
                  style={{
                    padding: '12px 10px',
                    borderRadius: '12px',
                    border: paymentMethod === 'M-Pesa' ? '2px solid #e11d48' : '1px solid #e2e8f0',
                    background: paymentMethod === 'M-Pesa' ? 'rgba(225, 29, 72, 0.08)' : '#f8fafc',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    textAlign: 'left',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <MpesaLogo size={26} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a' }}>M-Pesa</div>
                    <div style={{ fontSize: '10px', color: '#e11d48', fontWeight: 700 }}>Safaricom</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Step 2: Choose Recharge Amount */}
            <div style={{ marginBottom: '22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#0f172a', color: '#ffffff', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>2</span>
                  <span>Recharge Amount (ETB)</span>
                </label>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Min: 1,000 ETB</span>
              </div>

              {/* Quick Preset Pills */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                {quickAmounts.map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setAmount(val)}
                    style={{
                      padding: '7px 12px',
                      borderRadius: '8px',
                      border: amount === val ? '1px solid #f59e0b' : '1px solid #e2e8f0',
                      background: amount === val ? '#fffbeb' : '#ffffff',
                      color: amount === val ? '#b45309' : '#475569',
                      fontWeight: 800,
                      fontSize: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {val.toLocaleString()} ETB
                  </button>
                ))}
              </div>

              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontWeight: 800, color: '#94a3b8', fontSize: '14px' }}>
                  ETB
                </span>
                <input
                  type="number"
                  min="1000"
                  step="500"
                  value={amount || ''}
                  onChange={e => setAmount(Number(e.target.value))}
                  required
                  style={{
                    width: '100%',
                    padding: '12px 14px 12px 52px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '18px',
                    fontWeight: 900,
                    color: '#0f172a',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Step 3: Transaction Reference Code */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#0f172a', color: '#ffffff', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>3</span>
                  <span>SMS Confirmation Code (Tx Ref) *</span>
                </div>
                <span style={{ fontSize: '11px', color: '#64748b' }}>From your transfer SMS</span>
              </label>

              <input
                type="text"
                placeholder="e.g. FT240987123 or TX-TB-998877"
                value={transactionCode}
                onChange={e => setTransactionCode(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  fontWeight: 800,
                  fontFamily: 'monospace',
                  color: '#0f172a',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Step 4: Receipt Screenshot (Compressed with 98%+ Bandwidth Optimization) */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#0f172a', color: '#ffffff', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>4</span>
                  <span>Attach Transfer Receipt Screenshot</span>
                </label>
                <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 700 }}>
                  ⚡ Auto-Compressed (Zero Bandwidth)
                </span>
              </div>

              {!receiptPreview ? (
                /* Dropzone */
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: isDragging ? '2px dashed #f59e0b' : '2px dashed #cbd5e1',
                    borderRadius: '12px',
                    padding: '20px',
                    textAlign: 'center',
                    background: isDragging ? '#fffbeb' : '#f8fafc',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />
                  <div style={{ fontSize: '28px', marginBottom: '6px', color: '#94a3b8' }}>
                    <i className="fa-solid fa-cloud-arrow-up"></i>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                    Click or drag & drop transfer receipt screenshot
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                    Supports PNG, JPG, WEBP • Automatically downscaled & optimized for instant upload
                  </div>
                </div>
              ) : (
                /* Uploaded Preview Card */
                <div
                  style={{
                    border: '1.5px solid #10b981',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    background: '#f0fdf4',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img
                      src={receiptPreview}
                      alt="Receipt preview"
                      style={{
                        width: '52px',
                        height: '52px',
                        objectFit: 'cover',
                        borderRadius: '8px',
                        border: '1px solid #bbf7d0',
                        cursor: 'pointer'
                      }}
                      onClick={() => setViewingReceiptModal(receiptPreview)}
                      title="Click to zoom preview"
                    />
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: '#065f46', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>✓ Receipt Attached & Compressed</span>
                        {compressionStats && (
                          <span style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', padding: '1px 6px', borderRadius: '9999px', fontSize: '10px' }}>
                            -{compressionStats.savingsPercent}% saved
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: '#166534', marginTop: '2px' }}>
                        {compressionStats
                          ? `${formatFileSize(compressionStats.originalSize)} ➔ ${formatFileSize(compressionStats.compressedSize)} (${compressionStats.width}×${compressionStats.height}px)`
                          : 'Optimized Image'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => setViewingReceiptModal(receiptPreview)}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #bbf7d0',
                        color: '#065f46',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      <i className="fa-solid fa-magnifying-glass-plus"></i> View
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveReceipt}
                      style={{
                        background: '#fee2e2',
                        border: '1px solid #fca5a5',
                        color: '#b91c1c',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      <i className="fa-solid fa-trash-can"></i> Remove
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || amount < 1000}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: '#000000',
                fontWeight: 900,
                fontSize: '15px',
                border: 'none',
                cursor: isSubmitting || amount < 1000 ? 'not-allowed' : 'pointer',
                opacity: isSubmitting || amount < 1000 ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 16px rgba(245, 158, 11, 0.3)'
              }}
            >
              <i className={`fa-solid ${isSubmitting ? 'fa-spinner fa-spin' : 'fa-bolt'}`}></i>
              <span>{isSubmitting ? 'Submitting Request...' : `Submit ${amount.toLocaleString()} ETB Recharge Request`}</span>
            </button>
          </form>
        </div>

        {/* RIGHT COLUMN: OFFICIAL SONIC DEPOSIT ACCOUNTS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              background: '#ffffff',
              borderRadius: '18px',
              border: '1px solid #e2e8f0',
              padding: '20px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.04)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 900, textTransform: 'uppercase', color: '#0f172a', margin: 0, letterSpacing: '0.05em' }}>
                Official Sonic Accounts
              </h3>
              <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 800 }}>
                🛡️ 100% Escrow Protected
              </span>
            </div>

            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 14px 0', lineHeight: 1.5 }}>
              Transfer your recharge funds to any of the verified official accounts below using your personal mobile app:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {isLoadingOfficialAccounts && officialAccounts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '13px' }}>
                  <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>
                  Loading official platform accounts...
                </div>
              ) : officialAccounts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1', color: '#64748b', fontSize: '13px' }}>
                  No active accounts configured by Admin. Please contact Admin Desk.
                </div>
              ) : (
                officialAccounts.map(acc => {
                  const style = getRailStyle(acc.provider);
                  const isSelected = paymentMethod.toLowerCase() === (acc.provider || '').toLowerCase();
                  const formattedNum = formatAccountNumber(acc.account_number);
                  const title = acc.account_title || `${(acc.provider || '').toUpperCase()} OFFICIAL`;
                  const holderName = acc.account_name;
                  const badge = acc.badge || '⚡ Instant Fast Track';

                  return (
                    <div
                      key={acc.id}
                      style={{
                        background: isSelected ? style.bg : '#f8fafc',
                        border: isSelected ? `2px solid ${style.color}` : '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '14px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {style.logo}
                          <div>
                            <div style={{ fontSize: '11px', fontWeight: 800, color: style.color }}>
                              {title}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                              {holderName}
                            </div>
                          </div>
                        </div>

                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '10px',
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            color: '#475569'
                          }}
                        >
                          {badge}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '15px', color: '#0f172a' }}>
                          {formattedNum}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(acc.account_number, title)}
                          style={{
                            background: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '4px 10px',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: '#1e293b'
                          }}
                        >
                          <i className="fa-regular fa-copy"></i>
                          <span>Copy</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Quick Guidance Box */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px dashed #cbd5e1',
              borderRadius: '14px',
              padding: '14px 16px',
              fontSize: '12px',
              color: '#64748b',
              lineHeight: 1.5
            }}
          >
            <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>
              💡 Quick Processing Tips:
            </div>
            • Transfers are audited automatically within 1 to 5 minutes.<br />
            • Always verify that the account name matches before confirming in your banking app.<br />
            • Your float will be credited instantly once the transaction reference is confirmed.
          </div>
        </div>
      </div>

      {/* 3. Live Recent Recharge Requests Table */}
      <div style={{ background: '#ffffff', borderRadius: '18px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 900, color: '#0f172a' }}>
              Recent Recharge Requests
            </h3>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Track the live approval status of your working float replenishments
            </span>
          </div>

          <button
            type="button"
            onClick={fetchHistory}
            style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <i className={`fa-solid fa-rotate ${isLoadingHistory ? 'fa-spin' : ''}`}></i>
            <span>Refresh</span>
          </button>
        </div>

        {recharges.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📦</div>
            <div style={{ fontWeight: 700, color: '#475569' }}>No Recharge Requests Recorded</div>
            <div style={{ fontSize: '12px', marginTop: '4px' }}>
              Submit your first float replenishment request above.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                  <th style={{ padding: '12px 20px', fontWeight: 700 }}>Status</th>
                  <th style={{ padding: '12px 20px', fontWeight: 700 }}>Amount</th>
                  <th style={{ padding: '12px 20px', fontWeight: 700 }}>Payment Rail</th>
                  <th style={{ padding: '12px 20px', fontWeight: 700 }}>Transaction Code</th>
                  <th style={{ padding: '12px 20px', fontWeight: 700 }}>Receipt Screenshot</th>
                  <th style={{ padding: '12px 20px', fontWeight: 700 }}>Submitted At</th>
                </tr>
              </thead>
              <tbody>
                {recharges.map((r, i) => (
                  <tr
                    key={r.id}
                    style={{
                      borderBottom: i < recharges.length - 1 ? '1px solid #f1f5f9' : 'none'
                    }}
                  >
                    <td style={{ padding: '12px 20px' }}>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 800,
                          background:
                            r.status === 'approved' ? '#ecfdf5' :
                            r.status === 'rejected' ? '#fef2f2' : '#fffbeb',
                          color:
                            r.status === 'approved' ? '#047857' :
                            r.status === 'rejected' ? '#b91c1c' : '#b45309'
                        }}
                      >
                        {r.status === 'approved' ? '✓ Credited' : r.status === 'rejected' ? '✕ Rejected' : '⏳ Pending'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 20px', fontWeight: 900, color: '#0f172a' }}>
                      {Number(r.amount).toLocaleString()} ETB
                    </td>
                    <td style={{ padding: '12px 20px', fontWeight: 700, color: '#475569' }}>
                      {r.payment_method}
                    </td>
                    <td style={{ padding: '12px 20px', fontFamily: 'monospace', color: '#0f172a' }}>
                      {r.transaction_code}
                    </td>
                    <td style={{ padding: '12px 20px' }}>
                      {r.receipt_image ? (
                        <button
                          type="button"
                          onClick={() => setViewingReceiptModal(r.receipt_image)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            color: '#1d4ed8',
                            padding: '4px 10px',
                            borderRadius: '8px',
                            fontSize: '11px',
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                          title="Click to view transfer receipt screenshot"
                        >
                          <i className="fa-solid fa-image"></i>
                          <span>View Receipt</span>
                        </button>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 20px', color: '#94a3b8', fontSize: '12px' }}>
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Lightbox Modal for Full-Size Receipt */}
      {viewingReceiptModal && (
        <div
          onClick={() => setViewingReceiptModal(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(4px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              padding: '24px',
              maxWidth: '560px',
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
              position: 'relative'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>🧾</span>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: '#0f172a' }}>
                  Transfer Receipt Screenshot
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingReceiptModal(null)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#475569',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', background: '#0f172a', borderRadius: '12px', padding: '10px' }}>
              <img
                src={viewingReceiptModal}
                alt="Full receipt screenshot"
                style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain', borderRadius: '8px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                🔒 Verified Escrow Settlement Record
              </span>
              <button
                type="button"
                onClick={() => setViewingReceiptModal(null)}
                style={{
                  background: '#0f172a',
                  color: '#ffffff',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
