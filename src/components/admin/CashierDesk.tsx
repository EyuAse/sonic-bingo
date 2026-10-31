import React, { useState } from 'react';
import { useAdmin, TransactionRequest } from '../../context/AdminContext.tsx';
import { useApp } from '../../context/AppContext.tsx';
import { TelebirrLogo, CBELogo } from '../wallet/PaymentLogos.tsx';

type FilterType =
  | 'pending'
  | 'pending_deposits'
  | 'pending_withdrawals'
  | 'approved'
  | 'rejected'
  | 'all';

export const CashierDesk: React.FC = () => {
  const {
    transactions,
    approveAndReleaseTransaction,
    rejectTransaction
  } = useAdmin();

  const { showToast } = useApp();

  // Filters State
  const [activeFilter, setActiveFilter] = useState<FilterType>('pending');
  const [methodFilter, setMethodFilter] = useState<'all' | 'Telebirr' | 'CBE'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [inspectTx, setInspectTx] = useState<TransactionRequest | null>(null);
  const [rejectTargetTx, setRejectTargetTx] = useState<TransactionRequest | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('Invalid SMS Reference Code (Not found in Telebirr)');
  const [customRejectNote, setCustomRejectNote] = useState<string>('');

  const effectiveTransactions = transactions || [];

  // Counts
  const pendingDepositsCount = effectiveTransactions.filter(
    t => (t.type || 'deposit') === 'deposit' && (t.status || 'pending') === 'pending'
  ).length;

  const pendingWithdrawalsCount = effectiveTransactions.filter(
    t => t.type === 'withdrawal' && (t.status || 'pending') === 'pending'
  ).length;

  const pendingTotalCount = pendingDepositsCount + pendingWithdrawalsCount;

  const pendingTotalAmount = effectiveTransactions
    .filter(t => (t.status || 'pending') === 'pending')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const todayVerifiedAmount = effectiveTransactions
    .filter(t => t.status === 'approved')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const approvedTodayCount = effectiveTransactions.filter(t => t.status === 'approved').length;
  const rejectedTodayCount = effectiveTransactions.filter(t => t.status === 'rejected').length;

  // Filter Logic
  const filteredTxs = effectiveTransactions.filter(tx => {
    // Status filter
    if (activeFilter === 'pending' && tx.status !== 'pending') return false;
    if (activeFilter === 'pending_deposits' && !(tx.type === 'deposit' && tx.status === 'pending')) return false;
    if (activeFilter === 'pending_withdrawals' && !(tx.type === 'withdrawal' && tx.status === 'pending')) return false;
    if (activeFilter === 'approved' && tx.status !== 'approved') return false;
    if (activeFilter === 'rejected' && tx.status !== 'rejected') return false;

    // Method filter
    if (methodFilter !== 'all' && tx.method !== methodFilter) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchRef = (tx.referenceNumber || '').toLowerCase().includes(q);
      const matchName = (tx.userName || '').toLowerCase().includes(q);
      const matchPhone = (tx.phone || '').toLowerCase().includes(q);
      const matchAcc = (tx.accountNumber || '').toLowerCase().includes(q);
      if (!matchRef && !matchName && !matchPhone && !matchAcc) return false;
    }

    return true;
  });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast(`✓ Copied: ${text}`);
  };

  const handleApprove = (tx: TransactionRequest) => {
    approveAndReleaseTransaction(tx.id);
    showToast(`✓ Approved ${tx.amount} ETB for ${tx.userName}`);
  };

  const handleConfirmReject = () => {
    if (!rejectTargetTx) return;
    const finalReason = customRejectNote.trim() || rejectReason;
    rejectTransaction(rejectTargetTx.id, finalReason);
    showToast(`❌ Rejected transaction ${rejectTargetTx.referenceNumber}`);
    setRejectTargetTx(null);
    setCustomRejectNote('');
  };

  return (
    <div className="fresh-cashier-desk-container">
      {/* 1. Hero Desk Banner with Lemon Slice Artwork */}
      <div className="cashier-hero-desk-banner">
        <div className="hero-banner-left">
          <div className="hero-bank-icon-box">
            <svg viewBox="0 0 48 48" width="32" height="32" fill="none">
              <path d="M24 6L6 16V20H42V16L24 6Z" fill="#eab308" stroke="#ca8a04" strokeWidth="2" />
              <rect x="9" y="20" width="5" height="16" fill="#facc15" stroke="#ca8a04" strokeWidth="1.5" />
              <rect x="18" y="20" width="5" height="16" fill="#facc15" stroke="#ca8a04" strokeWidth="1.5" />
              <rect x="26" y="20" width="5" height="16" fill="#facc15" stroke="#ca8a04" strokeWidth="1.5" />
              <rect x="34" y="20" width="5" height="16" fill="#facc15" stroke="#ca8a04" strokeWidth="1.5" />
              <rect x="4" y="36" width="40" height="6" rx="2" fill="#eab308" stroke="#ca8a04" strokeWidth="1.5" />
            </svg>
          </div>
          <div className="hero-banner-titles">
            <h3 className="hero-main-title">TELEBIRR & CBE CASHIER DESK</h3>
            <p className="hero-sub-title">
              Verify SMS references, inspect player receipts, and release wallet balances in 1-click.
            </p>
          </div>
        </div>

        <div className="hero-banner-right">
          {/* Fresh Cut Sliced Lemon Artwork Decoration */}
          <div className="hero-lemon-art">
            <svg viewBox="0 0 80 80" width="60" height="60" fill="none">
              <circle cx="40" cy="40" r="36" fill="#facc15" stroke="#ca8a04" strokeWidth="3" />
              <circle cx="40" cy="40" r="29" fill="#fef08a" />
              <path d="M40 40L40 12A28 28 0 0 1 60 20Z" fill="#fde047" stroke="#ca8a04" strokeWidth="1.5" />
              <path d="M40 40L60 20A28 28 0 0 1 68 40Z" fill="#fde047" stroke="#ca8a04" strokeWidth="1.5" />
              <path d="M40 40L68 40A28 28 0 0 1 60 60Z" fill="#fde047" stroke="#ca8a04" strokeWidth="1.5" />
              <path d="M40 40L60 60A28 28 0 0 1 40 68Z" fill="#fde047" stroke="#ca8a04" strokeWidth="1.5" />
              <path d="M40 40L40 68A28 28 0 0 1 20 60Z" fill="#fde047" stroke="#ca8a04" strokeWidth="1.5" />
              <path d="M40 40L20 60A28 28 0 0 1 12 40Z" fill="#fde047" stroke="#ca8a04" strokeWidth="1.5" />
              <path d="M40 40L12 40A28 28 0 0 1 20 20Z" fill="#fde047" stroke="#ca8a04" strokeWidth="1.5" />
              <path d="M40 40L20 20A28 28 0 0 1 40 12Z" fill="#fde047" stroke="#ca8a04" strokeWidth="1.5" />
              <circle cx="40" cy="40" r="5" fill="#ffffff" />
            </svg>
          </div>
        </div>
      </div>

      {/* 2. Filter Tabs & Search Row */}
      <div className="cashier-filters-search-row">
        {/* Left: Status Pill Tabs */}
        <div className="cashier-status-pills-group">
          <button
            type="button"
            className={`btn-cashier-filter-pill ${activeFilter === 'pending' ? 'active-yellow' : ''}`}
            onClick={() => setActiveFilter('pending')}
          >
            <span>Action Queue</span>
            <span className="pill-count-badge gold">{pendingTotalCount}</span>
          </button>

          <button
            type="button"
            className={`btn-cashier-filter-pill ${activeFilter === 'pending_deposits' ? 'active-yellow' : ''}`}
            onClick={() => setActiveFilter('pending_deposits')}
          >
            <span className="dot-green"></span>
            <span>Deposits</span>
            <span className="pill-count-badge green">{pendingDepositsCount}</span>
          </button>

          <button
            type="button"
            className={`btn-cashier-filter-pill ${activeFilter === 'pending_withdrawals' ? 'active-yellow' : ''}`}
            onClick={() => setActiveFilter('pending_withdrawals')}
          >
            <span className="dot-red"></span>
            <span>Withdrawals</span>
            <span className="pill-count-badge red">{pendingWithdrawalsCount}</span>
          </button>

          <button
            type="button"
            className={`btn-cashier-filter-pill ${activeFilter === 'approved' ? 'active-yellow' : ''}`}
            onClick={() => setActiveFilter('approved')}
          >
            <i className="fa-solid fa-check green-check"></i>
            <span>Approved & Settled</span>
          </button>

          <button
            type="button"
            className={`btn-cashier-filter-pill ${activeFilter === 'rejected' ? 'active-yellow' : ''}`}
            onClick={() => setActiveFilter('rejected')}
          >
            <i className="fa-solid fa-xmark red-x"></i>
            <span>Rejected</span>
          </button>

          <button
            type="button"
            className={`btn-cashier-filter-pill ${activeFilter === 'all' ? 'active-yellow' : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            <span>All ({effectiveTransactions.length})</span>
          </button>
        </div>

        {/* Middle: Method Filter Badges */}
        <div className="cashier-method-chips-group">
          <button
            type="button"
            className={`btn-method-chip ${methodFilter === 'all' ? 'selected' : ''}`}
            onClick={() => setMethodFilter('all')}
          >
            <i className="fa-solid fa-filter"></i>
            <span>All Methods</span>
            <i className="fa-solid fa-chevron-down tiny-chevron"></i>
          </button>

          <button
            type="button"
            className={`btn-method-chip ${methodFilter === 'Telebirr' ? 'selected' : ''}`}
            onClick={() => setMethodFilter(methodFilter === 'Telebirr' ? 'all' : 'Telebirr')}
          >
            <TelebirrLogo size={16} />
            <span>Telebirr</span>
          </button>

          <button
            type="button"
            className={`btn-method-chip ${methodFilter === 'CBE' ? 'selected' : ''}`}
            onClick={() => setMethodFilter(methodFilter === 'CBE' ? 'all' : 'CBE')}
          >
            <CBELogo size={16} />
            <span>CBE</span>
          </button>
        </div>

        {/* Right: Search Box */}
        <div className="cashier-search-box-wrap">
          <i className="fa-solid fa-magnifying-glass search-icon"></i>
          <input
            type="text"
            placeholder="Search reference, player or phone..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="cashier-search-input-field"
          />
        </div>
      </div>

      {/* 3. 3-Column Transaction Cards Grid */}
      {filteredTxs.length === 0 ? (
        <div className="cashier-empty-queue-card">
          <div className="empty-lemon-icon">🍋</div>
          <h4>No Transactions in Current Filter</h4>
          <p>All queue orders have been approved, rejected, or cleared.</p>
        </div>
      ) : (
        <div className="cashier-cards-three-grid">
          {filteredTxs.map(tx => {
            const isDeposit = tx.type === 'deposit';
            const isTelebirr = tx.method === 'Telebirr';
            const isPending = tx.status === 'pending';
            const isApproved = tx.status === 'approved';
            const isRejected = tx.status === 'rejected';

            // Real User Lifetime Deposit from PostgreSQL
            const userLifetimeIn = ((tx.userLifetimeDeposits && tx.userLifetimeDeposits > 0) ? tx.userLifetimeDeposits : tx.amount).toFixed(0);

            return (
              <div key={tx.id} className="cashier-tx-white-card">
                {/* Header Row */}
                <div className="tx-card-header-row">
                  <div className="tx-provider-brand">
                    {isTelebirr ? <TelebirrLogo size={18} /> : <CBELogo size={18} />}
                    <span className={`tx-provider-name ${isTelebirr ? 'telebirr' : 'cbe'}`}>
                      {isTelebirr ? 'Telebirr' : 'CBE Bank'}
                    </span>
                  </div>

                  <div className="tx-type-center-badge">
                    <i className={`fa-solid ${isDeposit ? 'fa-arrow-down-long deposit-blue' : 'fa-arrow-up-long withdraw-red'}`}></i>
                    <strong className="tx-type-text">{isDeposit ? 'DEPOSIT' : 'WITHDRAWAL'}</strong>
                  </div>

                  <span className={`tx-status-pill-top ${isPending ? 'pending' : isApproved ? 'approved' : 'rejected'}`}>
                    {isPending ? 'PENDING' : isApproved ? 'APPROVED' : 'REJECTED'}
                  </span>
                </div>

                {/* Key-Value Details */}
                <div className="tx-card-details-list">
                  {/* Transaction ID */}
                  <div className="tx-detail-row">
                    <span className="tx-detail-label">Transaction ID:</span>
                    <button
                      type="button"
                      className="tx-detail-val-btn purple"
                      onClick={() => handleCopy(tx.referenceNumber)}
                      title="Click to copy Transaction ID"
                    >
                      <span>{tx.referenceNumber}</span>
                      <i className="fa-regular fa-copy copy-icon"></i>
                    </button>
                  </div>

                  {/* Player / Account */}
                  <div className="tx-detail-row">
                    <span className="tx-detail-label">Player / Account:</span>
                    <strong className="tx-detail-val-dark">
                      {tx.userName} ({tx.phone})
                    </strong>
                  </div>

                  {/* Provider Account */}
                  <div className="tx-detail-row">
                    <span className="tx-detail-label">Provider Account:</span>
                    <span className="tx-detail-val-mono">{tx.accountNumber}</span>
                  </div>

                  {/* Request Time */}
                  <div className="tx-detail-row">
                    <span className="tx-detail-label">Request Time:</span>
                    <span className="tx-detail-val-muted">{tx.createdAt}</span>
                  </div>
                </div>

                {/* SMS Reference / Receipt Box */}
                <div className="tx-sms-verification-box">
                  <div className="sms-shield-icon">
                    <i className="fa-solid fa-shield-halved"></i>
                  </div>
                  <div className="sms-verify-text-group" style={{ flex: 1 }}>
                    <strong className="sms-verify-title">SMS & Receipt Verification</strong>
                    <span className="sms-verify-sub">
                      {tx.receiptImage ? '📸 Payment Screenshot Attached' : 'No Screenshot Attached'}
                    </span>
                  </div>
                  {tx.receiptImage && (
                    <button
                      type="button"
                      onClick={() => setInspectTx(tx)}
                      style={{
                        background: 'rgba(234, 179, 8, 0.15)',
                        border: '1px solid rgba(234, 179, 8, 0.4)',
                        borderRadius: '6px',
                        padding: '3px 8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        color: '#facc15',
                        fontSize: '11px',
                        fontWeight: 700
                      }}
                      title="Inspect attached receipt image"
                    >
                      <i className="fa-solid fa-image"></i>
                      <span>View Slip</span>
                    </button>
                  )}
                </div>

                {/* Footer Meta: Verified & Amount */}
                <div className="tx-card-footer-meta-row">
                  <div className="tx-lifetime-verified">
                    <span className="verified-text">VERIFIED</span>
                    <i className="fa-solid fa-circle-check verified-green-icon"></i>
                    <span className="lifetime-in-text">Lifetime In: {userLifetimeIn} ETB</span>
                  </div>

                  <div className="tx-amount-display-box">
                    <span className="amount-tiny-lbl">AMOUNT</span>
                    <strong className={`amount-huge-val ${isDeposit ? 'deposit-green' : 'withdraw-gold'}`}>
                      {isDeposit ? `+${tx.amount.toFixed(2)}` : `${tx.amount.toFixed(2)}`} ETB
                    </strong>
                  </div>
                </div>

                {/* Action Buttons Row */}
                {isPending && (
                  <div className="tx-card-actions-three-row">
                    <button
                      type="button"
                      className="btn-tx-approve-green"
                      onClick={() => handleApprove(tx)}
                    >
                      <i className="fa-solid fa-bolt-lightning"></i>
                      <span>Approve & Release</span>
                    </button>

                    <button
                      type="button"
                      className="btn-tx-fullslip-purple"
                      onClick={() => setInspectTx(tx)}
                    >
                      <i className="fa-solid fa-magnifying-glass"></i>
                      <span>Full Slip</span>
                    </button>

                    <button
                      type="button"
                      className="btn-tx-reject-gray"
                      onClick={() => setRejectTargetTx(tx)}
                    >
                      <span>Reject</span>
                    </button>
                  </div>
                )}

                {!isPending && (
                  <div className="tx-card-resolved-banner">
                    <i className={`fa-solid ${isApproved ? 'fa-circle-check green' : 'fa-circle-xmark red'}`}></i>
                    <span>
                      {isApproved ? 'Settled & Wallet Balance Credited' : 'Order Rejected & Notified'}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Bottom Statistics & Pagination Bar */}
      <div className="cashier-bottom-stats-pagination-bar">
        {/* KPI Summaries */}
        <div className="cashier-bottom-kpis-wrap">
          {/* Total in Queue */}
          <div className="bottom-kpi-item queue-item">
            <div className="kpi-square-icon-gold">
              <i className="fa-solid fa-inbox"></i>
            </div>
            <div className="kpi-text-stack">
              <span className="kpi-micro-lbl">Total in Queue</span>
              <strong className="kpi-bold-val">
                {pendingTotalCount} <span className="sub-lbl">Pending Actions</span>
              </strong>
            </div>
          </div>

          {/* Total Amount Pending */}
          <div className="bottom-kpi-item">
            <span className="kpi-micro-lbl">Total Amount (Pending)</span>
            <strong className="kpi-bold-val gold">{pendingTotalAmount.toFixed(2)} ETB</strong>
          </div>

          {/* Today Verified */}
          <div className="bottom-kpi-item">
            <span className="kpi-micro-lbl">Today Verified</span>
            <strong className="kpi-bold-val green">{todayVerifiedAmount.toFixed(2)} ETB</strong>
          </div>

          {/* Approved Today */}
          <div className="bottom-kpi-item">
            <span className="kpi-micro-lbl">Approved Today</span>
            <strong className="kpi-bold-val dark">{approvedTodayCount}</strong>
          </div>

          {/* Rejected Today */}
          <div className="bottom-kpi-item">
            <span className="kpi-micro-lbl">Rejected Today</span>
            <strong className="kpi-bold-val red">{rejectedTodayCount}</strong>
          </div>
        </div>

        {/* Pagination Controls */}
        <div className="cashier-pagination-controls">
          <button type="button" className="btn-page-arrow" disabled>
            <i className="fa-solid fa-chevron-left"></i>
          </button>
          <button type="button" className="btn-page-num active">
            1
          </button>
          <button type="button" className="btn-page-arrow">
            <i className="fa-solid fa-chevron-right"></i>
          </button>
        </div>
      </div>

      {/* ── Inspection Modal: Full Slip ── */}
      {inspectTx && (
        <div className="cashier-modal-backdrop" onClick={() => setInspectTx(null)}>
          <div className="cashier-slip-modal-card" onClick={e => e.stopPropagation()}>
            <div className="slip-modal-header">
              <div className="slip-header-titles">
                <h3>
                  <i className="fa-solid fa-receipt gold" style={{ marginRight: 8 }}></i>
                  Transaction Full Slip #{inspectTx.referenceNumber}
                </h3>
                <p>Official Verification & Settlement Ledger</p>
              </div>
              <button
                type="button"
                className="btn-modal-close-round"
                onClick={() => setInspectTx(null)}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="slip-modal-body">
              <div className="slip-details-grid">
                <div className="slip-grid-cell">
                  <span className="cell-lbl">Order Type</span>
                  <strong className="cell-val uppercase">{inspectTx.type}</strong>
                </div>
                <div className="slip-grid-cell">
                  <span className="cell-lbl">Payment Provider</span>
                  <strong className="cell-val">{inspectTx.method}</strong>
                </div>
                <div className="slip-grid-cell">
                  <span className="cell-lbl">Customer Name</span>
                  <strong className="cell-val">{inspectTx.userName}</strong>
                </div>
                <div className="slip-grid-cell">
                  <span className="cell-lbl">Customer Phone</span>
                  <strong className="cell-val">{inspectTx.phone}</strong>
                </div>
                <div className="slip-grid-cell">
                  <span className="cell-lbl">Provider Account</span>
                  <strong className="cell-val">{inspectTx.accountNumber}</strong>
                </div>
                <div className="slip-grid-cell">
                  <span className="cell-lbl">Order Amount</span>
                  <strong className="cell-val gold-amt">{inspectTx.amount.toFixed(2)} ETB</strong>
                </div>
              </div>

              {/* SMS Reference Box */}
              <div className="slip-sms-box">
                <span className="sms-box-lbl">Telebirr / CBE SMS Reference:</span>
                <strong className="sms-code-big">{inspectTx.referenceNumber}</strong>
              </div>

              {/* Attached Receipt Image Section */}
              {inspectTx.receiptImage && (
                <div style={{ marginTop: '16px', background: '#0b1120', padding: '14px', borderRadius: '12px', border: '1px solid rgba(234, 179, 8, 0.35)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#facc15', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <i className="fa-solid fa-camera"></i> Attached Payment Receipt Screenshot
                    </span>
                    <a
                      href={inspectTx.receiptImage}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: '12px', color: '#60a5fa', fontWeight: 600, textDecoration: 'underline' }}
                    >
                      Open Full Res ↗
                    </a>
                  </div>
                  <div style={{ maxHeight: '260px', overflowY: 'auto', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center', background: '#000000', padding: '8px' }}>
                    <img
                      src={inspectTx.receiptImage}
                      alt="Payment Receipt Slip"
                      style={{ maxWidth: '100%', maxHeight: '240px', objectFit: 'contain', display: 'inline-block', borderRadius: '6px' }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="slip-modal-footer">
              {inspectTx.status === 'pending' && (
                <>
                  <button
                    type="button"
                    className="btn-slip-approve-gold"
                    onClick={() => {
                      handleApprove(inspectTx);
                      setInspectTx(null);
                    }}
                  >
                    <i className="fa-solid fa-check"></i>
                    <span>Approve & Release Funds</span>
                  </button>
                  <button
                    type="button"
                    className="btn-slip-reject-outline"
                    onClick={() => {
                      setRejectTargetTx(inspectTx);
                      setInspectTx(null);
                    }}
                  >
                    <i className="fa-solid fa-xmark"></i>
                    <span>Reject Order</span>
                  </button>
                </>
              )}
              <button
                type="button"
                className="btn-slip-close-gray"
                onClick={() => setInspectTx(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reject Reason Modal ── */}
      {rejectTargetTx && (
        <div className="cashier-modal-backdrop" onClick={() => setRejectTargetTx(null)}>
          <div className="cashier-reject-modal-card" onClick={e => e.stopPropagation()}>
            <div className="reject-modal-header">
              <h3>
                <i className="fa-solid fa-triangle-exclamation red" style={{ marginRight: 8 }}></i>
                Reject Transaction #{rejectTargetTx.referenceNumber}
              </h3>
              <button
                type="button"
                className="btn-modal-close-round"
                onClick={() => setRejectTargetTx(null)}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="reject-modal-body">
              <p className="reject-prompt-txt">
                Select rejection reason for <strong>{rejectTargetTx.userName}</strong> ({rejectTargetTx.amount} ETB):
              </p>

              <div className="reject-options-list">
                {[
                  'Invalid SMS Reference Code (Not found in Telebirr)',
                  'Incorrect Sender Account or Name Mismatch',
                  'Duplicate SMS Reference (Already Claimed)',
                  'Unverified Screenshot / Altered Receipt',
                  'Withdrawal Account Name Mismatch with Registered KYC'
                ].map(reason => (
                  <label key={reason} className="reject-radio-label">
                    <input
                      type="radio"
                      name="rejectReason"
                      value={reason}
                      checked={rejectReason === reason}
                      onChange={() => setRejectReason(reason)}
                    />
                    <span>{reason}</span>
                  </label>
                ))}
              </div>

              <textarea
                placeholder="Optional custom rejection note sent to user..."
                value={customRejectNote}
                onChange={e => setCustomRejectNote(e.target.value)}
                className="reject-custom-textarea"
                rows={2}
              />
            </div>

            <div className="reject-modal-footer">
              <button
                type="button"
                className="btn-confirm-reject-red"
                onClick={handleConfirmReject}
              >
                Confirm Rejection & Notify Player
              </button>
              <button
                type="button"
                className="btn-slip-close-gray"
                onClick={() => setRejectTargetTx(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
