import React, { useState, useEffect, useRef, useMemo } from 'react';
import { apiClient } from '../../services/apiClient.ts';
import { socketService } from '../../services/socketService.ts';
import { compressImage, CompressedImageResult } from '../../utils/imageCompressor.ts';
import '../../styles/recharge-requests-enqu.css';

interface AgentRechargeDeskProps {
  agentProfile?: any;
  onRechargeSubmitted?: () => void;
  showToast?: (msg: string) => void;
  openMobile?: () => void;
}

export const AgentRechargeDesk: React.FC<AgentRechargeDeskProps> = ({
  agentProfile,
  onRechargeSubmitted,
  showToast,
  openMobile
}) => {
  // Form State
  const [amount, setAmount] = useState<number | string>(10000);
  const [paymentMethod, setPaymentMethod] = useState<'Telebirr' | 'CBE' | 'M-Pesa'>('Telebirr');
  const [transactionCode, setTransactionCode] = useState('');
  const [noteToAdmin, setNoteToAdmin] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Receipt Screenshot State
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // History & Live Data State
  const [recharges, setRecharges] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>({
    totalApprovedAmount: 0,
    totalApprovedCount: 0,
    totalPendingAmount: 0,
    totalPendingCount: 0,
    totalRejectedAmount: 0,
    totalRejectedCount: 0,
    allTimeAmount: 0,
    allTimeCount: 0
  });
  const [walletData, setWalletData] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'Approved' | 'Rejected'>('All');
  const [isLoading, setIsLoading] = useState(true);

  // Live Official Receiving Accounts State (Synced with Admin Portal)
  const [officialAccounts, setOfficialAccounts] = useState<any[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [showAllAccounts, setShowAllAccounts] = useState(false);

  // Ref to form card for "+ New request" jump action
  const formCardRef = useRef<HTMLDivElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);

  // =========================================================================
  // 1. DATA FETCHING: RECHARGES & OFFICIAL ACCOUNTS
  // =========================================================================
  const fetchRecharges = async () => {
    try {
      setIsLoading(true);
      const res = await apiClient.agent.getRecharges('all', statusFilter === 'All' ? 'all' : statusFilter.toLowerCase());
      if (res && res.success) {
        setRecharges(res.recharges || []);
        if (res.analytics) setAnalytics(res.analytics);
        if (res.wallet) setWalletData(res.wallet);
      }
    } catch (err) {
      console.error('Error fetching recharge history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchOfficialAccounts = async () => {
    try {
      setLoadingAccounts(true);
      const res = await apiClient.agent.getOfficialAccounts();
      if (res && res.success && Array.isArray(res.accounts)) {
        setOfficialAccounts(res.accounts);
      }
    } catch (err) {
      console.warn('Error fetching official payment accounts:', err);
    } finally {
      setLoadingAccounts(false);
    }
  };

  useEffect(() => {
    fetchRecharges();
    fetchOfficialAccounts();

    // Auto-polling backup every 20 seconds
    const interval = setInterval(fetchRecharges, 20000);

    // Real-time WebSocket Listeners
    const unsubAccounts = socketService.on('official_accounts_updated', () => {
      fetchOfficialAccounts();
    });
    const unsubRecharges = socketService.on('agent_recharge_status_changed', () => {
      fetchRecharges();
    });

    return () => {
      clearInterval(interval);
      unsubAccounts();
      unsubRecharges();
    };
  }, [statusFilter]);

  // =========================================================================
  // 2. COMPUTED METRICS & HERO SCALE
  // =========================================================================
  const formatBirr = (val: number | string | null | undefined): string => {
    const num = Math.round(Number(val || 0));
    return num.toLocaleString('en-US');
  };

  // Derive wallet numbers (walletData from API or fallback to agentProfile safely)
  const currentBalance = Number(walletData?.balance ?? agentProfile?.walletBalance ?? agentProfile?.wallet_balance ?? 0);
  const lowThreshold = Number(walletData?.lowThreshold ?? agentProfile?.lowBalanceThreshold ?? 5000);
  const isLowBalance = Boolean(walletData?.isLowBalance ?? (currentBalance <= lowThreshold));
  const commissionRate = Number(walletData?.commissionRate ?? agentProfile?.commissionRate ?? 4);
  const openingBalance = Number(walletData?.openingBalanceToday ?? currentBalance);
  const pendingRequestsCount = Number(analytics?.totalPendingCount ?? 0);

  // Total Recharged = sum of all approved amounts + 4% bonus commission
  const approvedVolume = Number(analytics?.totalApprovedAmount ?? 0);
  const totalRechargedBirr = approvedVolume + Math.round(approvedVolume * (commissionRate / 100));

  // Dynamic Scale for Balance Meter
  const maxScale = Math.max(15000, currentBalance * 1.35, lowThreshold * 2);
  const fillPercent = Math.min(100, Math.max(0, (currentBalance / maxScale) * 100));
  const pinPercent = Math.min(100, Math.max(0, (lowThreshold / maxScale) * 100));

  // Active Official Account for Selected Payment Method
  const activeOfficialAccount = useMemo(() => {
    if (!officialAccounts || officialAccounts.length === 0) return null;
    const match = officialAccounts.find(
      (a: any) => a.provider?.toLowerCase() === paymentMethod.toLowerCase()
    );
    return match || officialAccounts[0];
  }, [officialAccounts, paymentMethod]);

  // Credit Preview Calculation
  const numAmount = Number(amount) || 0;
  const commissionAmount = Math.round(numAmount * (commissionRate / 100));
  const totalWalletCredit = numAmount + commissionAmount;

  // Clipboard Copy Action
  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (showToast) showToast(`📋 Copied ${label}: ${text}`);
  };

  // Jump to New Request Form
  const handleJumpToForm = () => {
    if (formCardRef.current) {
      formCardRef.current.scrollIntoView({ behavior: 'smooth' });
    }
    if (amountInputRef.current) {
      amountInputRef.current.focus();
    }
  };

  // Screenshot Upload Handler
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      if (showToast) showToast('⚠️ Please upload a valid image file (JPG, PNG, or WEBP).');
      return;
    }

    try {
      setIsCompressing(true);
      const compressed: CompressedImageResult = await compressImage(file, 1200, 0.75);
      setReceiptImage(compressed.base64);
      if (showToast) showToast('📷 Payment receipt attached successfully.');
    } catch (err) {
      console.error('Receipt compression error:', err);
      if (showToast) showToast('❌ Failed to process screenshot. Please try again.');
    } finally {
      setIsCompressing(false);
    }
  };

  // Submit Recharge Request
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const amt = Number(amount);
    if (!Number.isInteger(amt) || amt < 1000 || amt > 100000) {
      setFormError('Enter an amount between 1,000 and 100,000 Birr.');
      return;
    }

    const cleanRef = transactionCode.trim().toUpperCase();
    if (cleanRef.length < 6) {
      setFormError('Enter the payment reference (at least 6 characters).');
      return;
    }

    // Check if duplicate reference exists in current list
    if (recharges.some((r: any) => r.transaction_code?.toUpperCase() === cleanRef)) {
      setFormError('This reference code was already submitted. Each reference can be credited once.');
      return;
    }

    // Check if agent already has an open pending request
    if (recharges.some((r: any) => r.status?.toLowerCase() === 'pending')) {
      setFormError('You already have a pending recharge request. Please wait for admin review.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await apiClient.agent.requestRecharge({
        amount: amt,
        paymentMethod,
        transactionCode: cleanRef,
        receiptImage: receiptImage || undefined,
        note: noteToAdmin.trim() || undefined
      } as any);

      if (res && res.success) {
        if (showToast) showToast('✅ Request sent. Waiting for admin review');
        setTransactionCode('');
        setNoteToAdmin('');
        setReceiptImage(null);
        setFormError(null);
        fetchRecharges();
        if (onRechargeSubmitted) onRechargeSubmitted();
      } else {
        setFormError((res as any)?.error || res?.message || 'Failed to submit recharge request.');
      }
    } catch (err: any) {
      console.error('Recharge submission error:', err);
      setFormError(err?.message || 'Network error submitting request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered Table Rows
  const filteredRecharges = useMemo(() => {
    if (statusFilter === 'All') return recharges;
    return recharges.filter((r: any) => r.status?.toLowerCase() === statusFilter.toLowerCase());
  }, [recharges, statusFilter]);

  // =========================================================================
  // 3. RENDER MAIN ENQU VIEW
  // =========================================================================
  return (
    <div className="recharge-desk-root">
      {/* -------------------------------------------------------------------
          1. TOPBAR & TITLE
          ------------------------------------------------------------------- */}
      <div className="top">
        {openMobile && (
          <button
            type="button"
            className="enqu-menu-btn"
            onClick={openMobile}
            title="Open menu"
            style={{ marginRight: '8px' }}
          >
            ☰
          </button>
        )}
        <div>
          <h1>Recharge Requests</h1>
          <p>Top up your agent wallet. Admin reviews and credits it after verifying your payment.</p>
        </div>
        <div className="sp" />
        <button
          type="button"
          className="gold"
          onClick={handleJumpToForm}
          id="jump"
        >
          + New request
        </button>
      </div>

      {/* -------------------------------------------------------------------
          2. HERO CURRENT WALLET BALANCE (OBSIDIAN & GOLD SPECULAR RADIAL GRADIENT)
          ------------------------------------------------------------------- */}
      <section className="hero" aria-label="Wallet">
        <div>
          <div className="kl">Current wallet balance</div>
          <div className="big">
            <small>ETB</small>
            <span id="bal">{formatBirr(currentBalance)}</span>
          </div>

          {/* Dynamic Meter Bar */}
          <div className="meter" title={`Balance: ETB ${formatBirr(currentBalance)}`}>
            <i style={{ width: `${fillPercent}%` }} />
            <b
              style={{ left: `${pinPercent}%` }}
              title={`Low-balance warning threshold: ETB ${formatBirr(lowThreshold)}`}
            />
          </div>

          <div className="mrow">
            <span>0</span>
            <span>Low-balance warning · {formatBirr(lowThreshold)}</span>
            <span id="topv">{formatBirr(maxScale)}</span>
          </div>
        </div>

        {/* 2x2 Translucent Hero Stats Grid */}
        <div className="stats">
          <div className="stat">
            <span className="kl">Opening balance</span>
            <b>{formatBirr(openingBalance)} Birr</b>
          </div>
          <div className="stat">
            <span className="kl">Your commission</span>
            <b id="rate">{commissionRate}%</b>
          </div>
          <div className="stat">
            <span className="kl">Pending requests</span>
            <b id="pend">{pendingRequestsCount}</b>
          </div>
          <div className="stat">
            <span className="kl">Total recharged</span>
            <b id="tot">{formatBirr(totalRechargedBirr)} Birr</b>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------------
          3. CONDITIONAL LOW-BALANCE WARNING ALERT BANNER
          ------------------------------------------------------------------- */}
      {isLowBalance && (
        <div className="alert" id="low" role="alert">
          <i>!</i>
          <span>
            Your wallet has reached the {formatBirr(lowThreshold)} Birr warning level. Request a recharge to keep accepting player deposits.
          </span>
        </div>
      )}

      {/* -------------------------------------------------------------------
          4. LIVE OFFICIAL PLATFORM RECEIVING ACCOUNTS (CONNECTED TO ADMIN PORTAL)
          ------------------------------------------------------------------- */}
      <section className="official-accounts-section">
        <div className="official-accounts-header">
          <div className="official-accounts-title">
            <span>⚡</span>
            <span>Official Platform Receiving Accounts (የክፍያ መቀበያ ሂሳቦች)</span>
          </div>
          <button
            type="button"
            style={{ fontSize: '12px', padding: '5px 12px', background: 'var(--rch-chip)' }}
            onClick={() => setShowAllAccounts(!showAllAccounts)}
          >
            {showAllAccounts ? 'Show primary only ▲' : `View all (${officialAccounts.length}) accounts ▼`}
          </button>
        </div>

        <p style={{ color: 'var(--rch-mute)', fontSize: '12.5px', marginBottom: '12px', fontWeight: 600 }}>
          Transfer your recharge funds to one of these verified official accounts before submitting your request.
        </p>

        {loadingAccounts ? (
          <div style={{ padding: '16px', textAlign: 'center', color: 'var(--rch-mute)', fontWeight: 600 }}>
            Loading live verified receiving accounts...
          </div>
        ) : officialAccounts.length === 0 ? (
          <div style={{ padding: '16px', textAlign: 'center', color: 'var(--rch-r)', fontWeight: 700 }}>
            No active official platform receiving accounts configured by admin. Please contact support.
          </div>
        ) : (
          <div className="official-accounts-grid">
            {(showAllAccounts ? officialAccounts : [activeOfficialAccount || officialAccounts[0]]).map((acc: any) => {
              const isTelebirr = acc.provider?.toLowerCase() === 'telebirr';
              const isCBE = acc.provider?.toLowerCase() === 'cbe';
              const isMpesa = acc.provider?.toLowerCase() === 'm-pesa';

              return (
                <div
                  key={acc.id}
                  className={`official-acc-card ${acc.is_primary ? 'primary' : ''}`}
                >
                  <div className="official-acc-top">
                    <span style={{ fontWeight: 800, fontSize: '13px', color: 'var(--rch-ink)' }}>
                      {isTelebirr ? '🔵 Telebirr' : isCBE ? '🟣 CBE Bank' : isMpesa ? '🟢 M-Pesa' : acc.provider}
                    </span>
                    <span className="official-badge">
                      {acc.badge || (acc.is_primary ? '⚡ Primary Official Account' : 'Verified')}
                    </span>
                  </div>

                  <div style={{ fontSize: '12px', color: 'var(--rch-mute)', fontWeight: 700, textTransform: 'uppercase' }}>
                    {acc.account_title || `${acc.provider} Receiving Account`}
                  </div>

                  <div className="official-num-row">
                    <span className="official-num">{acc.account_number}</span>
                    <button
                      type="button"
                      className="gold"
                      style={{ padding: '4px 10px', fontSize: '11.5px', borderRadius: '10px' }}
                      onClick={() => handleCopy(acc.account_number, `${acc.provider} Account`)}
                    >
                      Copy
                    </button>
                  </div>

                  <div className="official-holder">
                    Account Name: <strong>{acc.account_name}</strong>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* -------------------------------------------------------------------
          5. TWO-COLUMN LAYOUT (FORM 1.35fr : PREVIEW 1.0fr)
          ------------------------------------------------------------------- */}
      <div className="grid">
        {/* =================================================================
            LEFT COLUMN: NEW RECHARGE REQUEST FORM
            ================================================================= */}
        <div className="card" id="formcard" ref={formCardRef}>
          <h3>New recharge request</h3>
          <div className="sub">Pay the admin first, then submit the amount and your payment reference.</div>

          <form onSubmit={handleSubmit}>
            {/* Recharge Amount */}
            <label htmlFor="amt">Recharge amount (Birr)</label>
            <input
              id="amt"
              ref={amountInputRef}
              type="number"
              inputMode="numeric"
              min="1000"
              max="100000"
              step="500"
              placeholder="e.g. 10000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />

            {/* Quick Amount Chips */}
            <div className="quick" id="quick">
              {[5000, 10000, 20000, 30000].map((v) => (
                <button
                  key={v}
                  type="button"
                  className={Number(amount) === v ? 'on' : ''}
                  onClick={() => setAmount(v)}
                >
                  {formatBirr(v)}
                </button>
              ))}
            </div>

            {/* Payment Method Segmented Buttons */}
            <label>Payment method</label>
            <div className="seg" id="seg">
              <button
                type="button"
                className={paymentMethod === 'Telebirr' ? 'on' : ''}
                onClick={() => setPaymentMethod('Telebirr')}
              >
                <em style={{ background: '#1b8fd6' }}>T</em>
                Telebirr
              </button>

              <button
                type="button"
                className={paymentMethod === 'CBE' ? 'on' : ''}
                onClick={() => setPaymentMethod('CBE')}
              >
                <em style={{ background: '#9a268e' }}>C</em>
                CBE Bank
              </button>

              <button
                type="button"
                className={paymentMethod === 'M-Pesa' ? 'on' : ''}
                onClick={() => setPaymentMethod('M-Pesa')}
              >
                <em style={{ background: '#2e9e4f' }}>M</em>
                M-Pesa
              </button>
            </div>

            {/* Selected Official Account Quick Note */}
            {activeOfficialAccount && (
              <div
                style={{
                  background: 'var(--rch-chip)',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  marginTop: '12px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px'
                }}
              >
                <div>
                  Transfer to: <strong>{activeOfficialAccount.account_number}</strong> ({activeOfficialAccount.account_name})
                </div>
                <button
                  type="button"
                  style={{ padding: '3px 8px', fontSize: '11px', borderRadius: '8px' }}
                  onClick={() => handleCopy(activeOfficialAccount.account_number, `${activeOfficialAccount.provider} Account`)}
                >
                  Copy
                </button>
              </div>
            )}

            {/* Transaction Reference Input */}
            <label htmlFor="ref">Transaction reference</label>
            <input
              id="ref"
              placeholder="e.g. TB7K4M2P9Q"
              autoComplete="off"
              style={{ textTransform: 'uppercase' }}
              value={transactionCode}
              onChange={(e) => setTransactionCode(e.target.value.toUpperCase())}
              required
            />

            {/* Note to Admin */}
            <label htmlFor="note">Note to admin (optional)</label>
            <input
              id="note"
              placeholder="Anything the admin should know"
              value={noteToAdmin}
              onChange={(e) => setNoteToAdmin(e.target.value)}
            />

            {/* Optional Receipt Screenshot Upload */}
            <label>Payment receipt screenshot (optional)</label>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />

            {receiptImage ? (
              <div className="receipt-preview-wrap">
                <img
                  src={receiptImage}
                  alt="Receipt Preview"
                  className="receipt-preview-img"
                />
                <button
                  type="button"
                  className="receipt-remove-btn"
                  onClick={() => setReceiptImage(null)}
                  title="Remove screenshot"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div
                className="receipt-dropzone"
                onClick={() => fileInputRef.current?.click()}
              >
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--rch-ink)' }}>
                  {isCompressing ? 'Compressing receipt...' : '📎 Click to attach receipt screenshot'}
                </div>
                <small style={{ color: 'var(--rch-mute)', fontSize: '11.5px' }}>
                  PNG, JPG or WEBP (auto-compressed under 800 KB)
                </small>
              </div>
            )}

            {/* Error Message Box */}
            <div className="err" id="err" role="alert">
              {formError || ''}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="gold"
              id="send"
              style={{ width: '100%', padding: '14px', fontSize: '15px', marginTop: '6px' }}
              disabled={isSubmitting || isCompressing}
            >
              {isSubmitting ? 'Submitting request...' : 'Submit request'}
            </button>
          </form>
        </div>

        {/* =================================================================
            RIGHT COLUMN: CREDIT PREVIEW & HOW IT WORKS
            ================================================================= */}
        <div>
          <div className="card sum">
            <h3>Credit preview</h3>
            <div className="sub">Commission is applied by the system when admin approves.</div>

            <div style={{ marginTop: '8px' }}>
              <div className="row">
                <span>Wallet top-up</span>
                <b id="s1">{formatBirr(numAmount)} Birr</b>
              </div>
              <div className="row">
                <span>
                  Commission <em className="tag" id="s0">{commissionRate}%</em>
                </span>
                <b className="pos" id="s2">+{formatBirr(commissionAmount)} Birr</b>
              </div>
              <div className="row t">
                <span>Total wallet credit</span>
                <b id="s3">{formatBirr(totalWalletCredit)} Birr</b>
              </div>
            </div>

            <hr style={{ border: 0, borderTop: '1px solid var(--rch-line)', margin: '18px 0 6px' }} />

            <h3 style={{ fontSize: '15px' }}>How it works</h3>
            <ol className="steps">
              <li className="d">
                <i>1</i>
                <div>
                  You request a recharge
                  <small>Amount and payment reference</small>
                </div>
              </li>
              <li>
                <i>2</i>
                <div>Admin reviews the request</div>
              </li>
              <li>
                <i>3</i>
                <div>Admin verifies your payment</div>
              </li>
              <li>
                <i>4</i>
                <div>Commission is applied</div>
              </li>
              <li>
                <i>5</i>
                <div>
                  Wallet credited
                  <small>Balance and transaction recorded</small>
                </div>
              </li>
            </ol>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------
          6. REQUEST HISTORY TABLE
          ------------------------------------------------------------------- */}
      <div className="card">
        <h3>Request history</h3>

        {/* Filter Tabs */}
        <div className="tabs" id="tabs">
          {(['All', 'Pending', 'Approved', 'Rejected'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              className={statusFilter === tab ? 'on' : ''}
              onClick={() => setStatusFilter(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Table View */}
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Request</th>
                <th>Date</th>
                <th>Method</th>
                <th>Reference</th>
                <th>Amount</th>
                <th>Commission</th>
                <th>Total credit</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="rows">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="empty">
                    Loading recharge requests...
                  </td>
                </tr>
              ) : filteredRecharges.length === 0 ? (
                <tr>
                  <td colSpan={8} className="empty">
                    No requests here yet.
                  </td>
                </tr>
              ) : (
                filteredRecharges.map((r: any) => {
                  const amt = Number(r.amount || 0);
                  const comm = Math.round(amt * (commissionRate / 100));
                  const totCredit = amt + comm;
                  const st = r.status?.charAt(0).toUpperCase() + r.status?.slice(1).toLowerCase();
                  const isApp = r.status?.toLowerCase() === 'approved';
                  const isPend = r.status?.toLowerCase() === 'pending';
                  const isRej = r.status?.toLowerCase() === 'rejected';

                  const dateFormatted = r.created_at
                    ? new Date(r.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: '2-digit',
                        year: 'numeric'
                      })
                    : '—';

                  const reqId = r.id ? `RC-${r.id.slice(0, 6).toUpperCase()}` : 'RC';

                  return (
                    <tr key={r.id}>
                      <td>
                        <strong>{reqId}</strong>
                      </td>
                      <td>
                        {dateFormatted}
                        <small>{r.created_at ? new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</small>
                      </td>
                      <td>{r.payment_method || 'Telebirr'}</td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                          {r.transaction_code || '—'}
                        </span>
                      </td>
                      <td>{formatBirr(amt)} Birr</td>
                      <td>{isRej ? '—' : `+${formatBirr(comm)} Birr`}</td>
                      <td>{isRej ? '—' : `${formatBirr(totCredit)} Birr`}</td>
                      <td>
                        <span
                          className={`pill ${isApp ? 'ok' : isPend ? 'wn' : 'bd'}`}
                        >
                          {st}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
