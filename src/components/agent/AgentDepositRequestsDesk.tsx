import React, { useState, useEffect, useMemo, useRef } from 'react';
import { apiClient } from '../../services/apiClient.ts';
import { socketService } from '../../services/socketService.ts';
import '../../styles/deposit-requests-enqu.css';

interface DepositRequestItem {
  id: string;
  amount: number;
  paymentMethod: string;
  playerPhone: string;
  playerName?: string;
  playerUsername?: string;
  transactionCode: string;
  screenshotUrl?: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  createdAt: string;
  resolvedAt?: string;
}

interface DepositSummary {
  walletBalance: number;
  lowBalanceThreshold: number;
  pendingSum: number;
  pendingCount: number;
  oldestWaitingMinutes: number;
  walletAfterAllPending: number;
  acceptedTodaySum: number;
  acceptedTodayCount: number;
  rejectedTodayCount: number;
  rejectedTodaySum: number;
}

interface HistoryBucketItem {
  index: number;
  label: string;
  shortLabel: string;
  acceptedVolume: number;
  acceptedCount: number;
  rejectedCount: number;
  totalRequests: number;
  acceptanceRate: number;
  rows: DepositRequestItem[];
}

interface AgentDepositRequestsDeskProps {
  agentProfile: any;
  onActionCompleted: () => void;
  showToast: (msg: string) => void;
  openMobile?: () => void;
}

export const AgentDepositRequestsDesk: React.FC<AgentDepositRequestsDeskProps> = ({
  agentProfile,
  onActionCompleted,
  showToast,
  openMobile
}) => {
  // 1. View Navigation: 'req' (Requests) vs 'hist' (History)
  const [view, setView] = useState<'req' | 'hist'>('req');

  // 2. Requests View Tab Filter: 'Pending' | 'Accepted' | 'Rejected' | 'All'
  const [tab, setTab] = useState<'Pending' | 'Accepted' | 'Rejected' | 'All'>('Pending');
  const [searchQuery, setSearchQuery] = useState('');

  // 3. Requests Data State
  const [requests, setRequests] = useState<DepositRequestItem[]>([]);
  const [summary, setSummary] = useState<DepositSummary>({
    walletBalance: parseFloat(agentProfile?.walletBalance || agentProfile?.wallet_balance || '0'),
    lowBalanceThreshold: parseFloat(agentProfile?.lowBalanceThreshold || agentProfile?.low_balance_threshold || '5000'),
    pendingSum: 0,
    pendingCount: 0,
    oldestWaitingMinutes: 0,
    walletAfterAllPending: parseFloat(agentProfile?.walletBalance || agentProfile?.wallet_balance || '0'),
    acceptedTodaySum: 0,
    acceptedTodayCount: 0,
    rejectedTodayCount: 0,
    rejectedTodaySum: 0
  });
  const [loadingRequests, setLoadingRequests] = useState(true);

  // 4. History View State
  const [historyPeriod, setHistoryPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [historyBuckets, setHistoryBuckets] = useState<HistoryBucketItem[]>([]);
  const [selectedBucketIndex, setSelectedBucketIndex] = useState<number>(0);
  const [historySummary, setHistorySummary] = useState<any>({
    acceptedVolume: 0,
    acceptedCount: 0,
    rejectedCount: 0,
    totalRequests: 0,
    acceptanceRate: 0
  });
  const [loadingHistory, setLoadingHistory] = useState(false);

  // 5. Modals State
  const [acceptModalItem, setAcceptModalItem] = useState<DepositRequestItem | null>(null);
  const [rejectModalItem, setRejectModalItem] = useState<DepositRequestItem | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('Reference not found');
  const [rejectNote, setRejectNote] = useState<string>('');
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // 6. Screenshot Lightbox
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  // 7. Toast notification in-desk state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  const showInternalToast = (msg: string) => {
    setToastMessage(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  // Preset rejection reasons from reference design
  const PRESET_REASONS = [
    'Reference not found',
    'Amount does not match',
    'Payment not received',
    'Duplicate request',
    'Other'
  ];

  // Helper number formatters
  const formatBirr = (val: number | string) => {
    const n = typeof val === 'number' ? val : parseFloat(val || '0');
    return isNaN(n) ? '0' : n.toLocaleString('en-US');
  };

  // Initials generator (e.g. "Abel Tadesse" -> "AT")
  const getInitials = (name?: string, phone?: string) => {
    if (name && name.trim()) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return name.slice(0, 2).toUpperCase();
    }
    if (phone) return phone.slice(-2);
    return 'PL';
  };

  // Time ago formatter
  const formatTimeAgo = (dateStr: string) => {
    if (!dateStr) return 'just now';
    const diffMin = Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000));
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours} h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} d ago`;
  };

  // Minutes ago integer
  const getElapsedMinutes = (dateStr: string) => {
    if (!dateStr) return 0;
    return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000));
  };

  // Copy Reference Code with instant feedback
  const handleCopyRef = async (code: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
        showInternalToast('Reference copied');
      } else {
        showInternalToast('Copy is not available here');
      }
    } catch (_) {
      showInternalToast('Copy is not available here');
    }
  };

  // =========================================================================
  // 1. DATA FETCHING: REQUESTS & SUMMARY
  // =========================================================================
  const fetchRequests = async () => {
    try {
      setLoadingRequests(true);
      const res = await apiClient.agent.getDepositRequests(
        tab === 'Pending' ? 'pending' : tab === 'Accepted' ? 'approved' : tab === 'Rejected' ? 'rejected' : 'all',
        'all',
        searchQuery
      );

      if (res && res.success) {
        setRequests(res.requests || []);
        if (res.summary) {
          setSummary(res.summary);
        }
      }
    } catch (err: any) {
      console.warn('Failed to load deposit requests:', err.message);
      showToast(`❌ ${err.message || 'Failed to load deposit requests'}`);
    } finally {
      setLoadingRequests(false);
    }
  };

  // =========================================================================
  // 2. DATA FETCHING: HISTORY
  // =========================================================================
  const fetchHistory = async (period = historyPeriod) => {
    try {
      setLoadingHistory(true);
      const res = await apiClient.agent.getDepositHistory(period);
      if (res && res.success) {
        setHistoryBuckets(res.buckets || []);
        if (res.summary) setHistorySummary(res.summary);
        setSelectedBucketIndex(0);
      }
    } catch (err: any) {
      console.warn('Failed to load deposit history:', err.message);
      showToast(`❌ ${err.message || 'Failed to load deposit history'}`);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Initial load & when tab/search changes
  useEffect(() => {
    if (view === 'req') {
      fetchRequests();
    } else {
      fetchHistory(historyPeriod);
    }
  }, [view, tab, searchQuery, historyPeriod]);

  // Sync wallet balance when profile changes
  useEffect(() => {
    if (agentProfile?.walletBalance !== undefined || agentProfile?.wallet_balance !== undefined) {
      const bal = parseFloat(agentProfile?.walletBalance ?? agentProfile?.wallet_balance ?? 0);
      setSummary(prev => ({
        ...prev,
        walletBalance: bal,
        walletAfterAllPending: bal - prev.pendingSum
      }));
    }
  }, [agentProfile?.walletBalance, agentProfile?.wallet_balance]);

  // =========================================================================
  // 3. WEBSOCKET REAL-TIME SYNC
  // =========================================================================
  useEffect(() => {
    const unsubReqCreated = socketService.on('agent_deposit_request_created', (data: any) => {
      showToast(`📥 New Deposit Request: ETB ${data?.amount || ''} from ${data?.playerName || 'Player'}`);
      showInternalToast('New deposit request received');
      fetchRequests();
      onActionCompleted();
    });

    const unsubReqStatus = socketService.on('agent_deposit_request_status_changed', () => {
      fetchRequests();
      if (view === 'hist') fetchHistory();
      onActionCompleted();
    });

    const unsubWallet = socketService.on('wallet_updated', (data: any) => {
      if (data?.newBalance !== undefined) {
        const bal = parseFloat(data.newBalance);
        setSummary(prev => ({
          ...prev,
          walletBalance: bal,
          walletAfterAllPending: bal - prev.pendingSum
        }));
      }
    });

    return () => {
      unsubReqCreated();
      unsubReqStatus();
      unsubWallet();
    };
  }, [view, tab, searchQuery, historyPeriod]);

  // =========================================================================
  // 4. APPROVE DEPOSIT ACTION
  // =========================================================================
  const handleConfirmAccept = async () => {
    if (!acceptModalItem) return;
    try {
      setIsProcessing(true);
      const res = await apiClient.agent.approveDepositRequest(acceptModalItem.id);
      if (res && res.success) {
        showInternalToast(`ETB ${formatBirr(acceptModalItem.amount)} credited to ${acceptModalItem.playerName || 'Player'}`);
        showToast(`🎉 Approved: ETB ${formatBirr(acceptModalItem.amount)} credited!`);
        setAcceptModalItem(null);
        await fetchRequests();
        onActionCompleted();
      }
    } catch (err: any) {
      showToast(`❌ ${err.message || 'Approval failed'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // =========================================================================
  // 5. REJECT DEPOSIT ACTION
  // =========================================================================
  const handleConfirmReject = async () => {
    if (!rejectModalItem) return;
    if (!rejectReason) {
      setRejectError('Pick a reason so the player knows what to fix.');
      return;
    }

    try {
      setIsProcessing(true);
      const finalReason = rejectReason === 'Other'
        ? (rejectNote.trim() ? `Other: ${rejectNote.trim()}` : 'Other')
        : (rejectNote.trim() ? `${rejectReason}: ${rejectNote.trim()}` : rejectReason);

      const res = await apiClient.agent.rejectDepositRequest(rejectModalItem.id, finalReason);
      if (res && res.success) {
        showInternalToast('Deposit rejected. Player notified');
        showToast('❌ Deposit request rejected');
        setRejectModalItem(null);
        setRejectNote('');
        setRejectError(null);
        await fetchRequests();
        onActionCompleted();
      }
    } catch (err: any) {
      showToast(`❌ ${err.message || 'Rejection failed'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Keyboard shortcut ESC for modal dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (acceptModalItem) setAcceptModalItem(null);
        if (rejectModalItem) setRejectModalItem(null);
        if (lightboxImg) setLightboxImg(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [acceptModalItem, rejectModalItem, lightboxImg]);

  // Active History Bucket
  const activeBucket = useMemo(() => {
    if (!historyBuckets.length) return null;
    return historyBuckets[selectedBucketIndex] || historyBuckets[0];
  }, [historyBuckets, selectedBucketIndex]);

  // Max volume in history for bar scaling
  const maxVolume = useMemo(() => {
    if (!historyBuckets.length) return 1;
    const max = Math.max(...historyBuckets.map(b => b.acceptedVolume));
    return max > 0 ? max : 1;
  }, [historyBuckets]);

  // Filter requests client-side for ultra-fast typing feel
  const displayedRequests = useMemo(() => {
    return requests.filter(r => {
      // Tab filter
      if (tab === 'Pending' && r.status !== 'pending') return false;
      if (tab === 'Accepted' && r.status !== 'approved') return false;
      if (tab === 'Rejected' && r.status !== 'rejected') return false;

      // Query filter
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        (r.playerName && r.playerName.toLowerCase().includes(q)) ||
        (r.playerPhone && r.playerPhone.toLowerCase().includes(q)) ||
        (r.transactionCode && r.transactionCode.toLowerCase().includes(q)) ||
        r.id.toLowerCase().includes(q)
      );
    });
  }, [requests, tab, searchQuery]);

  const isLowWallet = summary.walletBalance <= summary.lowBalanceThreshold;

  // Render
  return (
    <div className="deposit-requests-enqu-root">
      {/* Top Main View Switcher: Requests vs History */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        {openMobile && (
          <button
            type="button"
            className="enqu-menu-btn"
            onClick={openMobile}
            title="Open navigation menu"
            aria-label="Open navigation menu"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        )}
        <div className="tabs" style={{ marginBottom: 0 }}>
          <button
            className={view === 'req' ? 'on' : ''}
            onClick={() => setView('req')}
          >
            Requests
            {summary.pendingCount > 0 && <span className="n">{summary.pendingCount}</span>}
          </button>
          <button
            className={view === 'hist' ? 'on' : ''}
            onClick={() => {
              setView('hist');
              setSelectedBucketIndex(0);
            }}
          >
            History
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* VIEW 1: REQUESTS VIEW                                               */}
      {/* =================================================================== */}
      {view === 'req' && (
        <>
          {/* Header Bar */}
          <div className="top">
            <div>
              <h1>Deposit requests</h1>
              <div className="sub">
                Players pay you, then ask the app to credit their balance. You accept or reject.
              </div>
            </div>
            <span className="sp" />
            <span className="chip">
              <small>Wallet</small>
              ETB {formatBirr(summary.walletBalance)}
              {isLowWallet && <span className="pill wn" style={{ marginLeft: 6 }}>Low</span>}
            </span>
          </div>

          {/* Hero Specular Obsidian Banner */}
          <div className="hero">
            <div>
              <div className="kl">Awaiting your review</div>
              <div className="big">
                <small>ETB</small>
                {formatBirr(summary.pendingSum)}
              </div>
              <p>
                {summary.pendingCount} request{summary.pendingCount === 1 ? '' : 's'} from players. Accepting credits the player and takes the amount from your wallet. Rejecting costs you nothing.
              </p>
            </div>
            <div className="mini">
              <div>
                <span>Oldest waiting</span>
                <b>
                  {summary.pendingCount > 0
                    ? summary.oldestWaitingMinutes < 60
                      ? `${summary.oldestWaitingMinutes} min`
                      : `${Math.floor(summary.oldestWaitingMinutes / 60)} h ${summary.oldestWaitingMinutes % 60} min`
                    : 'None'}
                </b>
              </div>
              <div>
                <span>Wallet after all pending</span>
                <b>ETB {formatBirr(summary.walletAfterAllPending)}</b>
              </div>
              <div>
                <span>Low-balance alert</span>
                <b>ETB {formatBirr(summary.lowBalanceThreshold)}</b>
              </div>
            </div>
          </div>

          {/* 3 Stat Cards Grid */}
          <div className="stats">
            <div className="card stat">
              <div className="l">Accepted today</div>
              <div className="v">ETB {formatBirr(summary.acceptedTodaySum)}</div>
              <div className="t">
                {summary.acceptedTodayCount} deposit{summary.acceptedTodayCount === 1 ? '' : 's'}
              </div>
            </div>
            <div className="card stat">
              <div className="l">Rejected today</div>
              <div className="v">{summary.rejectedTodayCount}</div>
              <div className="t">ETB {formatBirr(summary.rejectedTodaySum)} not credited</div>
            </div>
            <div className="card stat">
              <div className="l">Pending</div>
              <div className="v">{summary.pendingCount}</div>
              <div className="t">Players are waiting</div>
            </div>
          </div>

          {/* Toolbar: Segmented Filters + Search Bar */}
          <div className="bar">
            <div className="tabs">
              {(['Pending', 'Accepted', 'Rejected', 'All'] as const).map(t => (
                <button
                  key={t}
                  className={tab === t ? 'on' : ''}
                  onClick={() => setTab(t)}
                >
                  {t}
                  {t === 'Pending' && summary.pendingCount > 0 && (
                    <span className="n">{summary.pendingCount}</span>
                  )}
                </button>
              ))}
            </div>
            <input
              className="search"
              placeholder="Search name, phone or reference"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              aria-label="Search deposits"
            />
          </div>

          {/* Requests List */}
          <div className="list">
            {displayedRequests.length > 0 ? (
              displayedRequests.map(r => {
                const isPending = r.status === 'pending';
                const isApproved = r.status === 'approved';
                const isRejected = r.status === 'rejected';
                const elapsedMin = getElapsedMinutes(r.createdAt);
                const isOld = isPending && elapsedMin >= 30;
                const shortId = `D-${r.id.slice(0, 4).toUpperCase()}`;

                return (
                  <div
                    key={r.id}
                    className={`req ${isOld ? 'old' : ''}`}
                    id={r.id}
                  >
                    {/* Column 1: Player Profile */}
                    <div className="pc">
                      <span className="av">
                        {getInitials(r.playerName, r.playerPhone)}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <b>{r.playerName || 'Player'}</b>
                        <small>
                          {r.playerPhone || 'No phone'} · {shortId}
                        </small>
                      </div>
                    </div>

                    {/* Column 2: Amount & Method */}
                    <div>
                      <div className="amt">ETB {formatBirr(r.amount)}</div>
                      <span className="sm">
                        {r.paymentMethod || 'Telebirr'} · {formatTimeAgo(r.createdAt)}
                      </span>
                    </div>

                    {/* Column 3: Status Badge & Reference Copy */}
                    <div>
                      {isPending ? (
                        isOld ? (
                          <span className="pill wn">Waiting {elapsedMin} min</span>
                        ) : (
                          <span className="pill wn">Pending</span>
                        )
                      ) : isApproved ? (
                        <span className="pill ok">Accepted</span>
                      ) : (
                        <span className="pill bd">Rejected</span>
                      )}

                      {r.rejectionReason && (
                        <span className="sm" style={{ display: 'inline', marginLeft: 6 }}>
                          {r.rejectionReason}
                        </span>
                      )}

                      <div className="ref">
                        <span>{r.transactionCode || '—'}</span>
                        <button
                          type="button"
                          onClick={() => handleCopyRef(r.transactionCode)}
                        >
                          Copy
                        </button>
                      </div>
                    </div>

                    {/* Column 4: Accept / Reject Action Buttons */}
                    <div className="acts">
                      {isPending && (
                        <>
                          <button
                            type="button"
                            className="rej"
                            onClick={() => {
                              setRejectModalItem(r);
                              setRejectReason('Reference not found');
                              setRejectNote('');
                              setRejectError(null);
                            }}
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            className="acc"
                            onClick={() => setAcceptModalItem(r)}
                          >
                            Accept
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="empty">
                <b>{tab === 'Pending' && !searchQuery ? 'All caught up' : 'Nothing found'}</b>
                {tab === 'Pending' && !searchQuery
                  ? 'No deposit requests are waiting.'
                  : 'Try another tab or search.'}
              </div>
            )}
          </div>
        </>
      )}

      {/* =================================================================== */}
      {/* VIEW 2: HISTORY VIEW                                                */}
      {/* =================================================================== */}
      {view === 'hist' && (
        <>
          {/* Header Bar */}
          <div className="top">
            <div>
              <h1>Deposit history</h1>
              <div className="sub">
                Every deposit you accepted or rejected, by day, week or month.
              </div>
            </div>
            <span className="sp" />
            <span className="chip">
              <small>Wallet</small>
              ETB {formatBirr(summary.walletBalance)}
            </span>
          </div>

          {/* Period Selector Bar */}
          <div className="bar">
            <div className="tabs">
              {(['daily', 'weekly', 'monthly'] as const).map(p => (
                <button
                  key={p}
                  className={historyPeriod === p ? 'on' : ''}
                  onClick={() => {
                    setHistoryPeriod(p);
                    fetchHistory(p);
                  }}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
            <span className="sm" style={{ marginLeft: 'auto' }}>
              Selected: <b>{activeBucket?.label || 'Today'}</b>
            </span>
          </div>

          {/* 4-Stat Cards Grid for History */}
          <div className="stats s4">
            <div className="card stat">
              <div className="l">Accepted volume</div>
              <div className="v">ETB {formatBirr(activeBucket?.acceptedVolume || 0)}</div>
              <div className="t">Credited to players</div>
            </div>
            <div className="card stat">
              <div className="l">Accepted</div>
              <div className="v">{activeBucket?.acceptedCount || 0}</div>
              <div className="t">deposits</div>
            </div>
            <div className="card stat">
              <div className="l">Rejected</div>
              <div className="v">{activeBucket?.rejectedCount || 0}</div>
              <div className="t">not credited</div>
            </div>
            <div className="card stat">
              <div className="l">Acceptance rate</div>
              <div className="v">{activeBucket?.acceptanceRate || 0}%</div>
              <div className="t">of {activeBucket?.totalRequests || 0} requests</div>
            </div>
          </div>

          {/* Interactive Volume Bar Chart Card */}
          <div className="card" style={{ marginBottom: 16 }}>
            <h3>
              Accepted volume
              <span className="r">Tap a bar to see its deposits</span>
            </h3>
            <div className="ch">
              {historyBuckets
                .slice()
                .reverse()
                .map(b => {
                  const isSelected = b.index === selectedBucketIndex;
                  const pct = Math.max(4, Math.round((b.acceptedVolume / maxVolume) * 100));

                  return (
                    <div
                      key={b.index}
                      className={`cb ${isSelected ? 'on' : ''}`}
                      role="button"
                      tabIndex={0}
                      title={`${b.label}: ETB ${formatBirr(b.acceptedVolume)} (${b.acceptedCount} accepted, ${b.rejectedCount} rejected)`}
                      onClick={() => setSelectedBucketIndex(b.index)}
                    >
                      <i style={{ height: `${pct}%` }} />
                      <span>{b.shortLabel}</span>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Deposits Table for Selected Bucket */}
          <div className="card">
            <h3>
              Deposits · {activeBucket?.label || 'Selected period'}
              <span className="r">
                {activeBucket?.rows?.length || 0} request{(activeBucket?.rows?.length || 0) === 1 ? '' : 's'}
              </span>
            </h3>

            {activeBucket && activeBucket.rows && activeBucket.rows.length > 0 ? (
              <div className="wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>Method</th>
                      <th>Amount</th>
                      <th>Reference</th>
                      <th>Status</th>
                      <th>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeBucket.rows.map(row => {
                      const dateObj = new Date(row.createdAt);
                      const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      const dateStr = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });
                      const isApproved = row.status === 'approved';

                      return (
                        <tr key={row.id}>
                          <td>
                            <div className="pc">
                              <span
                                className="av"
                                style={{ width: 30, height: 30, fontSize: 11 }}
                              >
                                {getInitials(row.playerName, row.playerPhone)}
                              </span>
                              {row.playerName || 'Player'}
                            </div>
                          </td>
                          <td>{row.paymentMethod || 'Telebirr'}</td>
                          <td>ETB {formatBirr(row.amount)}</td>
                          <td>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                              {row.transactionCode || '—'}
                            </span>
                          </td>
                          <td>
                            <span className={`pill ${isApproved ? 'ok' : 'bd'}`}>
                              {isApproved ? 'Accepted' : 'Rejected'}
                            </span>
                          </td>
                          <td>
                            {dateStr} {timeStr}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty" style={{ border: 0 }}>
                <b>No deposits</b>
                Nothing was recorded in this period.
              </div>
            )}
          </div>
        </>
      )}

      {/* =================================================================== */}
      {/* MODAL 1: ACCEPT DEPOSIT CONFIRMATION DIALOG                         */}
      {/* =================================================================== */}
      {acceptModalItem && (
        <div className="mbg" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="mh">
              <h3>Accept deposit</h3>
              <button
                type="button"
                onClick={() => setAcceptModalItem(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="note">
              Check that {acceptModalItem.paymentMethod || 'Telebirr'} shows{' '}
              <b>ETB {formatBirr(acceptModalItem.amount)}</b> from{' '}
              {acceptModalItem.playerName || 'Player'} with reference{' '}
              <b>{acceptModalItem.transactionCode}</b> before you accept.
            </div>

            <div className="sum">
              <div className="lg">
                <span>Player credited</span>
                ETB {formatBirr(acceptModalItem.amount)}
              </div>
              <div className="lg">
                <span>Wallet now</span>
                ETB {formatBirr(summary.walletBalance)}
              </div>
              <div className="lg t">
                <span>Wallet after</span>
                <b>ETB {formatBirr(summary.walletBalance - acceptModalItem.amount)}</b>
              </div>
            </div>

            {/* Solvency Warning Badges */}
            {acceptModalItem.amount > summary.walletBalance ? (
              <div className="warn">
                Your wallet is too low for this deposit. Request a recharge first.
              </div>
            ) : summary.walletBalance - acceptModalItem.amount <= summary.lowBalanceThreshold ? (
              <div className="warn">
                This will bring your wallet to the low-balance level.
              </div>
            ) : null}

            <div className="mf">
              <button
                type="button"
                onClick={() => setAcceptModalItem(null)}
                disabled={isProcessing}
              >
                Cancel
              </button>
              <button
                type="button"
                className="dk"
                onClick={handleConfirmAccept}
                disabled={isProcessing || acceptModalItem.amount > summary.walletBalance}
              >
                {isProcessing ? 'Crediting...' : 'Confirm and accept'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 2: REJECT DEPOSIT DIALOG                                      */}
      {/* =================================================================== */}
      {rejectModalItem && (
        <div className="mbg" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="mh">
              <h3>Reject deposit</h3>
              <button
                type="button"
                onClick={() => setRejectModalItem(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="note">
              {rejectModalItem.playerName || 'Player'} requested{' '}
              <b>ETB {formatBirr(rejectModalItem.amount)}</b>. Your wallet will not be charged. The player sees the reason you pick.
            </div>

            <label style={{ marginTop: 14 }}>Reason</label>
            <div className="rs">
              {PRESET_REASONS.map(w => (
                <button
                  key={w}
                  type="button"
                  className={rejectReason === w ? 'on' : ''}
                  onClick={() => {
                    setRejectReason(w);
                    setRejectError(null);
                  }}
                >
                  {w}
                </button>
              ))}
            </div>

            <label>Note to player (optional)</label>
            <textarea
              placeholder="Add a short explanation"
              value={rejectNote}
              onChange={e => setRejectNote(e.target.value)}
            />

            {rejectError && <div className="warn">{rejectError}</div>}

            <div className="mf">
              <button
                type="button"
                onClick={() => setRejectModalItem(null)}
                disabled={isProcessing}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rd"
                onClick={handleConfirmReject}
                disabled={isProcessing}
              >
                {isProcessing ? 'Rejecting...' : 'Reject deposit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating In-Desk Toast */}
      {toastMessage && (
        <div className="toast" role="status">
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default AgentDepositRequestsDesk;
