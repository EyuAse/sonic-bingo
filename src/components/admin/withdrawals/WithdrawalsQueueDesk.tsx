import React, { useState } from 'react';
import { apiClient } from '../../../services/apiClient.ts';

interface QueueItem {
  id: string | number;
  displayId: string;
  userId: string;
  userDisplayId: string;
  name: string;
  phone: string;
  amount: number;
  method: string;
  accountPhone: string;
  accountName: string;
  nameMismatch: boolean;
  status: string;
  createdAt: string;
  waitingMinutes: number;
  waitingDuration: string;
  isLongWaiting: boolean;
  checks: Array<{
    id: string;
    label: string;
    ok: boolean;
    passText: string;
    failText: string;
    isBlocker?: boolean;
  }>;
  failedChecksCount: number;
  isApprovalBlocked: boolean;
  playerActivity: {
    status: string;
    isKycVerified: boolean;
    walletBalance: number;
    totalDeposited: number;
    totalWithdrawn: number;
    totalStaked: number;
    joinedDate: string;
  };
  recentWithdrawals: Array<{
    id: string;
    amount: number;
    method: string;
    status: string;
    date: string;
  }>;
}

interface WithdrawalsQueueDeskProps {
  queue: QueueItem[];
  kpis: {
    pendingCount: number;
    pendingAmount: number;
    longestWaitingMinutes: number;
    longestWaitingPlayer: string;
    approvedTodayCount: number;
    approvedTodayAmount: number;
    rejectedTodayCount: number;
    rejectedTodayAmount: number;
    needsAttentionCount: number;
    highValueCount: number;
  };
  onActionCompleted: () => void;
  showToast: (msg: string) => void;
}

export const WithdrawalsQueueDesk: React.FC<WithdrawalsQueueDeskProps> = ({
  queue,
  kpis,
  onActionCompleted,
  showToast
}) => {
  const [subFilter, setSubFilter] = useState<'all' | 'flag' | 'high'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState('All');
  const [selectedId, setSelectedId] = useState<string | number>(() => queue[0]?.id || '');

  const handleSelectQueueItem = (id: string | number) => {
    setSelectedId(id);
    if (typeof window !== 'undefined' && window.innerWidth <= 980) {
      setTimeout(() => {
        const el = document.getElementById('withdrawal-inspector-card');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 50);
    }
  };

  // Modals state
  const [activeModal, setActiveModal] = useState<'approve' | 'reject' | null>(null);
  const [modalItem, setModalItem] = useState<QueueItem | null>(null);
  const [payoutRef, setPayoutRef] = useState('');
  const [warningsAck, setWarningsAck] = useState(false);
  const [rejectReason, setRejectReason] = useState('Account name mismatch');
  const [adminNote, setAdminNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const REJECT_REASONS = [
    'Account name mismatch',
    'Suspected duplicate account',
    'Failed identity check',
    'Deposit turnover not met',
    'Invalid payout number',
    'Account under investigation',
    'Other'
  ];

  // Filtered Queue
  const filteredQueue = queue.filter(item => {
    // 1. Sub filter
    if (subFilter === 'flag' && item.failedChecksCount === 0) return false;
    if (subFilter === 'high' && item.amount < 2000) return false;

    // 2. Method filter
    if (methodFilter !== 'All' && item.method.toLowerCase() !== methodFilter.toLowerCase()) {
      return false;
    }

    // 3. Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const combined = `${item.displayId} ${item.name} ${item.userDisplayId} ${item.accountPhone} ${item.accountName}`.toLowerCase();
      if (!combined.includes(q)) return false;
    }

    return true;
  });

  // Selected Item
  const activeItem = queue.find(q => String(q.id) === String(selectedId)) || filteredQueue[0] || queue[0] || null;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(w => w[0] || '')
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const formatETB = (val: number) => {
    return Number(val || 0).toLocaleString('en-US');
  };

  const handleOpenApprove = (item: QueueItem) => {
    setModalItem(item);
    setPayoutRef('');
    setWarningsAck(item.failedChecksCount === 0);
    setActiveModal('approve');
  };

  const handleOpenReject = (item: QueueItem) => {
    setModalItem(item);
    setRejectReason('Account name mismatch');
    setAdminNote('');
    setActiveModal('reject');
  };

  const handleCloseModal = () => {
    setActiveModal(null);
    setModalItem(null);
  };

  const handleConfirmApprove = async () => {
    if (!modalItem) return;
    try {
      setSubmitting(true);
      const res = await apiClient.withdrawalsAdmin.approve(
        modalItem.id,
        payoutRef.trim() || undefined,
        undefined
      );
      if (res.success) {
        showToast(`✅ ${formatETB(modalItem.amount)} ETB approved for ${modalItem.name}!`);
        handleCloseModal();
        onActionCompleted();
      }
    } catch (err: any) {
      showToast(`❌ ${err.message || 'Approval failed'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!modalItem) return;
    try {
      setSubmitting(true);
      const res = await apiClient.withdrawalsAdmin.reject(
        modalItem.id,
        rejectReason,
        adminNote.trim() || undefined
      );
      if (res.success) {
        showToast(`❌ Request rejected. ${formatETB(modalItem.amount)} ETB returned to ${modalItem.name}`);
        handleCloseModal();
        onActionCompleted();
      }
    } catch (err: any) {
      showToast(`❌ ${err.message || 'Rejection failed'}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* Top Explanatory Note */}
      <div className="w-note">
        Approve to release funds to the player Telebirr, M-Pesa or CBE account. Reject to return the held amount to the player wallet. Limit 5,000 ETB per request. Every decision is saved in the history.
      </div>

      {/* 4 Top KPI Cards */}
      <div className="w-grid w-g4">
        {/* Card 1: Pending Requests (Dark Gradient Card) */}
        <div className="w-card d">
          <div className="w-lab">Pending Requests</div>
          <div className="w-val">{kpis.pendingCount}</div>
          <div className="w-tr">ETB {formatETB(kpis.pendingAmount)} awaiting decision</div>
        </div>

        {/* Card 2: Longest Waiting */}
        <div className="w-card">
          <div className="w-lab">Longest Waiting</div>
          <div className="w-val">
            {kpis.longestWaitingMinutes > 0
              ? `${Math.floor(kpis.longestWaitingMinutes / 60)}h ${kpis.longestWaitingMinutes % 60}m`
              : '0 min'}
          </div>
          <div className="w-tr" style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            {kpis.longestWaitingPlayer}
          </div>
        </div>

        {/* Card 3: Approved Today */}
        <div className="w-card">
          <div className="w-lab">Approved Today</div>
          <div className="w-val">ETB {formatETB(kpis.approvedTodayAmount)}</div>
          <div className="w-tr">{kpis.approvedTodayCount} payouts</div>
        </div>

        {/* Card 4: Rejected Today */}
        <div className="w-card">
          <div className="w-lab">Rejected Today</div>
          <div className="w-val">ETB {formatETB(kpis.rejectedTodayAmount)}</div>
          <div className="w-tr">{kpis.rejectedTodayCount} requests</div>
        </div>
      </div>

      {/* 1.7fr / 1fr Split Layout: Approval Queue + Sticky Inspector */}
      <div className="w-grid w-g2" style={{ alignItems: 'start' }}>
        {/* Left Side: Approval Queue Card */}
        <div className="w-card">
          <h3>
            Approval Queue
            <span className="r w-tr">Oldest first</span>
          </h3>

          {/* Sub Filter Ribbon */}
          <div className="w-tabs" style={{ marginBottom: '12px' }}>
            <button
              type="button"
              className={subFilter === 'all' ? 'on' : ''}
              style={{ background: subFilter === 'all' ? 'var(--grey)' : 'var(--chip)' }}
              onClick={() => setSubFilter('all')}
            >
              All pending ({queue.length})
            </button>
            <button
              type="button"
              className={subFilter === 'flag' ? 'on' : ''}
              style={{ background: subFilter === 'flag' ? 'var(--grey)' : 'var(--chip)' }}
              onClick={() => setSubFilter('flag')}
            >
              Needs attention ({kpis.needsAttentionCount})
            </button>
            <button
              type="button"
              className={subFilter === 'high' ? 'on' : ''}
              style={{ background: subFilter === 'high' ? 'var(--grey)' : 'var(--chip)' }}
              onClick={() => setSubFilter('high')}
            >
              High value ({kpis.highValueCount})
            </button>
          </div>

          {/* Search + Method Filter Row */}
          <div className="w-search-method-row">
            <input
              type="text"
              placeholder="Search request, player, ID or number"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-search-input"
            />
            <select
              value={methodFilter}
              onChange={e => setMethodFilter(e.target.value)}
              className="w-method-select"
            >
              <option value="All">All methods</option>
              <option value="Telebirr">Telebirr</option>
              <option value="M-Pesa">M-Pesa</option>
              <option value="CBE">CBE</option>
            </select>
          </div>

          {/* Queue Table */}
          <div className="w-wrap">
            <table className="w-table">
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Player</th>
                  <th>Method</th>
                  <th>Amount</th>
                  <th>Waiting</th>
                </tr>
              </thead>
              <tbody>
                {filteredQueue.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '36px 10px', color: 'var(--mute)' }}>
                      {queue.length === 0
                        ? 'All caught up. No pending withdrawals.'
                        : 'No requests match these filters.'}
                    </td>
                  </tr>
                ) : (
                  filteredQueue.map(item => {
                    const isSelected = activeItem?.id === item.id;
                    const hasWarnings = item.failedChecksCount > 0;
                    return (
                      <tr
                        key={item.id}
                        className={`wr ${isSelected ? 'sel' : ''}`}
                        onClick={() => handleSelectQueueItem(item.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>
                          <button
                            type="button"
                            className="w-btn"
                            style={{ background: 'none', padding: 0, fontSize: '14px', fontWeight: 700 }}
                            onClick={() => handleSelectQueueItem(item.id)}
                          >
                            {item.displayId}
                          </button>
                          <div className="w-tr">
                            {new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{' '}
                            {new Date(item.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', flexWrap: 'nowrap' }}>
                            <span className="w-av2">{getInitials(item.name)}</span>
                            <div>
                              <div>{item.name}</div>
                              <div className="w-tr">{item.userDisplayId}</div>
                            </div>
                          </div>
                        </td>
                        <td>{item.method}</td>
                        <td style={{ fontWeight: 700 }}>{formatETB(item.amount)} ETB</td>
                        <td>
                          <span className={item.waitingMinutes >= 180 ? 'w-dn' : ''}>
                            {item.waitingDuration}
                          </span>
                          {hasWarnings && (
                            <span
                              className="w-badge w"
                              style={{ padding: '2px 9px', fontSize: '11px', marginLeft: '6px' }}
                            >
                              Review
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Side: Sticky Inspector (.w-det) */}
        <div id="withdrawal-inspector-card" className="w-det">
          {activeItem ? (
            <div className="w-card">
              {/* Header & Status */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'nowrap' }}>
                <div>
                  <div className="w-tr">Withdrawal request</div>
                  <div style={{ fontSize: '17px', fontWeight: 800 }}>{activeItem.displayId}</div>
                </div>
                <span className="w-badge am">{activeItem.status}</span>
              </div>

              {/* Big Amount */}
              <div className="w-amt">
                {formatETB(activeItem.amount)}
                <small>ETB</small>
              </div>
              <div className="w-tr">
                {activeItem.method} &bull; requested{' '}
                {new Date(activeItem.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{' '}
                {new Date(activeItem.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '14px' }}>
                <button
                  type="button"
                  className="w-btn k w-btn-action"
                  disabled={activeItem.isApprovalBlocked}
                  onClick={() => handleOpenApprove(activeItem)}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="w-btn w-btn-action"
                  onClick={() => handleOpenReject(activeItem)}
                >
                  Reject
                </button>
              </div>

              {activeItem.isApprovalBlocked && (
                <div className="w-tr w-dn" style={{ marginTop: '8px', fontWeight: 600 }}>
                  Approval is blocked while the player account is suspended. Reject this request or reactivate the player first.
                </div>
              )}

              {/* Payout Details */}
              <div className="w-sec">
                <h4>Payout details</h4>
                <div className="w-lg">
                  <span style={{ color: 'var(--mute)' }}>Player</span>
                  <b>{activeItem.name} <span className="w-tr">{activeItem.userDisplayId}</span></b>
                </div>
                <div className="w-lg">
                  <span style={{ color: 'var(--mute)' }}>Pay to</span>
                  <b>{activeItem.method}</b>
                </div>
                <div className="w-lg">
                  <span style={{ color: 'var(--mute)' }}>
                    {activeItem.method === 'CBE' ? 'Account number' : 'Phone number'}
                  </span>
                  <b>
                    <code style={{ background: 'var(--chip)', padding: '2px 8px', borderRadius: '8px', fontSize: '13px' }}>
                      {activeItem.accountPhone}
                    </code>
                  </b>
                </div>
                <div className="w-lg">
                  <span style={{ color: 'var(--mute)' }}>Account name</span>
                  <b>
                    {activeItem.accountName}
                    {activeItem.nameMismatch && (
                      <span className="w-badge w" style={{ padding: '2px 9px', fontSize: '11px', marginLeft: '6px' }}>
                        Mismatch
                      </span>
                    )}
                  </b>
                </div>
              </div>

              {/* Automated Checks */}
              <div className="w-sec">
                <h4>Checks</h4>
                {activeItem.checks && activeItem.checks.map(check => (
                  <div key={check.id} className="w-chk">
                    <i className={`w-ck ${check.ok ? 'ok' : 'bad'}`}>
                      {check.ok ? '✓' : '✕'}
                    </i>
                    <span className={check.ok ? '' : 'w-dn'}>
                      {check.ok
                        ? (check.passText || (check as any).title || 'Check passed')
                        : (check.failText || (check as any).failureText || 'Check failed')}
                    </span>
                  </div>
                ))}
              </div>

              {/* Player Activity */}
              <div className="w-sec">
                <h4>Player activity</h4>
                <div className="w-lg">
                  <span style={{ color: 'var(--mute)' }}>Wallet balance</span>
                  <b>{formatETB(activeItem.playerActivity?.walletBalance)} ETB</b>
                </div>
                <div className="w-lg">
                  <span style={{ color: 'var(--mute)' }}>Total deposited</span>
                  <b>{formatETB(activeItem.playerActivity?.totalDeposited)} ETB</b>
                </div>
                <div className="w-lg">
                  <span style={{ color: 'var(--mute)' }}>Total withdrawn</span>
                  <b>{formatETB(activeItem.playerActivity?.totalWithdrawn)} ETB</b>
                </div>
                <div className="w-lg">
                  <span style={{ color: 'var(--mute)' }}>Member since</span>
                  <b>{activeItem.playerActivity?.joinedDate || (activeItem.playerActivity as any)?.memberSince || 'Recent'}</b>
                </div>
              </div>

              {/* Recent Withdrawals */}
              <div className="w-sec">
                <h4>Recent withdrawals</h4>
                {activeItem.recentWithdrawals && activeItem.recentWithdrawals.length > 0 ? (
                  activeItem.recentWithdrawals.map(rw => (
                    <div key={rw.id} className="w-row">
                      <span>{rw.date} &bull; {rw.method}</span>
                      <span style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {formatETB(rw.amount)} ETB
                        <span className={`w-badge ${rw.status === 'approved' ? 'ok' : 'w'}`} style={{ padding: '2px 8px', fontSize: '11px' }}>
                          {rw.status}
                        </span>
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="w-tr" style={{ marginTop: '8px' }}>
                    First withdrawal from this player.
                  </div>
                )}
              </div>

              {/* Timeline */}
              <div className="w-sec">
                <h4>Timeline</h4>
                <div className="w-tl">
                  <div>
                    <b>
                      {new Date(activeItem.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{' '}
                      {new Date(activeItem.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                    </b>
                    Player requested {formatETB(activeItem.amount)} ETB to {activeItem.method}. Amount held from wallet.
                  </div>
                  <div>
                    <b>Now</b>
                    Waiting for admin decision ({activeItem.waitingDuration})
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="w-card" style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--mute)' }}>
              Select a request from the queue to see full details.
            </div>
          )}
        </div>
      </div>

      {/* APPROVE MODAL */}
      {activeModal === 'approve' && modalItem && (
        <div className="w-modal-bg">
          <div className="w-modal">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Approve withdrawal</h3>
              <button
                type="button"
                className="w-btn"
                style={{ padding: '4px 10px', borderRadius: '50%' }}
                onClick={handleCloseModal}
              >
                ✕
              </button>
            </div>

            {/* Request Summary Card */}
            <div className="w-card" style={{ background: 'var(--panel)', padding: '12px 14px' }}>
              <div className="w-lg"><span style={{ color: 'var(--mute)' }}>Player</span><b>{modalItem.name}</b></div>
              <div className="w-lg"><span style={{ color: 'var(--mute)' }}>Amount</span><b style={{ color: 'var(--ink)' }}>{formatETB(modalItem.amount)} ETB</b></div>
              <div className="w-lg"><span style={{ color: 'var(--mute)' }}>Pay to</span><b>{modalItem.method} &bull; {modalItem.accountPhone}</b></div>
              <div className="w-lg"><span style={{ color: 'var(--mute)' }}>Account name</span><b>{modalItem.accountName}</b></div>
            </div>

            {/* Warnings Alert Box */}
            {modalItem.failedChecksCount > 0 && (
              <div className="w-note" style={{ margin: '14px 0 0', boxShadow: 'inset 3px 0 0 var(--r)' }}>
                <b style={{ color: 'var(--r)' }}>
                  {modalItem.failedChecksCount} warning{modalItem.failedChecksCount > 1 ? 's' : ''} detected
                </b>
                {modalItem.checks.filter(c => !c.ok).map(c => (
                  <div key={c.id} style={{ marginTop: '4px', fontSize: '12.5px', color: 'var(--ink)' }}>
                    &bull; {c.failText}
                  </div>
                ))}
              </div>
            )}

            {/* Warnings Acknowledgement Checkbox */}
            {modalItem.failedChecksCount > 0 && (
              <label style={{ display: 'flex', gap: '8px', alignItems: 'center', margin: '14px 0 0', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={warningsAck}
                  onChange={e => setWarningsAck(e.target.checked)}
                />
                <span>I reviewed the warnings and want to proceed with approval</span>
              </label>
            )}

            {/* Payout Reference Input */}
            <div style={{ marginTop: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--mute)', fontWeight: 600, marginBottom: '6px' }}>
                Payout reference (optional)
              </label>
              <input
                type="text"
                placeholder={`Transaction ID / Ref from ${modalItem.method}`}
                value={payoutRef}
                onChange={e => setPayoutRef(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--chip)',
                  border: 0,
                  borderRadius: '12px',
                  padding: '10px 12px',
                  fontWeight: 600,
                  color: 'var(--ink)'
                }}
              />
              <div className="w-tr" style={{ marginTop: '8px' }}>
                Approving marks the request as settled and sends an instant Telegram confirmation DM to the player.
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button
                type="button"
                className="w-btn"
                onClick={handleCloseModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className="w-btn k"
                disabled={submitting || (modalItem.failedChecksCount > 0 && !warningsAck)}
                onClick={handleConfirmApprove}
                style={{ padding: '8px 18px', fontSize: '13.5px' }}
              >
                {submitting ? 'Approving...' : `Approve & pay ${formatETB(modalItem.amount)} ETB`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {activeModal === 'reject' && modalItem && (
        <div className="w-modal-bg">
          <div className="w-modal">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Reject withdrawal</h3>
              <button
                type="button"
                className="w-btn"
                style={{ padding: '4px 10px', borderRadius: '50%' }}
                onClick={handleCloseModal}
              >
                ✕
              </button>
            </div>

            {/* Request Summary Card */}
            <div className="w-card" style={{ background: 'var(--panel)', padding: '12px 14px' }}>
              <div className="w-lg"><span style={{ color: 'var(--mute)' }}>Player</span><b>{modalItem.name}</b></div>
              <div className="w-lg"><span style={{ color: 'var(--mute)' }}>Amount</span><b style={{ color: 'var(--ink)' }}>{formatETB(modalItem.amount)} ETB</b></div>
              <div className="w-lg"><span style={{ color: 'var(--mute)' }}>Pay to</span><b>{modalItem.method} &bull; {modalItem.accountPhone}</b></div>
              <div className="w-lg"><span style={{ color: 'var(--mute)' }}>Account name</span><b>{modalItem.accountName}</b></div>
            </div>

            <div className="w-tr" style={{ marginTop: '12px', color: 'var(--ink)', fontWeight: 600 }}>
              The held amount ({formatETB(modalItem.amount)} ETB) returns immediately to the player wallet and the player receives an instant Telegram notification.
            </div>

            {/* Standard Reason Dropdown */}
            <div style={{ marginTop: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--mute)', fontWeight: 600, marginBottom: '6px' }}>
                Reason
              </label>
              <select
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--chip)',
                  border: 0,
                  borderRadius: '12px',
                  padding: '10px 12px',
                  fontWeight: 600,
                  color: 'var(--ink)'
                }}
              >
                {REJECT_REASONS.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {/* Internal Admin Note */}
            <div style={{ marginTop: '12px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--mute)', fontWeight: 600, marginBottom: '6px' }}>
                Admin note (optional, visible to admins only)
              </label>
              <textarea
                value={adminNote}
                onChange={e => setAdminNote(e.target.value)}
                placeholder="Internal audit notes..."
                style={{
                  width: '100%',
                  background: 'var(--chip)',
                  border: 0,
                  borderRadius: '12px',
                  padding: '10px 12px',
                  fontWeight: 600,
                  color: 'var(--ink)',
                  minHeight: '75px',
                  resize: 'vertical'
                }}
              />
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button
                type="button"
                className="w-btn"
                onClick={handleCloseModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className="w-btn k"
                disabled={submitting}
                onClick={handleConfirmReject}
                style={{ padding: '8px 18px', fontSize: '13.5px', background: 'var(--r)' }}
              >
                {submitting ? 'Rejecting...' : 'Reject request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

