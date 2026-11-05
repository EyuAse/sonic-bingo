import React, { useState, useEffect } from 'react';
import { apiClient } from '../../../services/apiClient.ts';

interface HistoryRecord {
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
  status: string;
  createdAt: string;
  reviewedAt: string | null;
  reviewedByName: string | null;
  payoutReference: string | null;
  rejectionReason: string | null;
  adminNote: string | null;
  decisionMinutes: number | null;
  decisionDuration: string;
  playerActivity: {
    status: string;
    walletBalance: number;
    totalDeposited: number;
    totalWithdrawn: number;
    joinedDate: string;
  };
}

interface VolumeBucket {
  label: string;
  tooltip: string;
  approvedAmount: number;
  rejectedAmount: number;
  count: number;
}

interface WithdrawalsHistoryDeskProps {
  showToast: (msg: string) => void;
}

export const WithdrawalsHistoryDesk: React.FC<WithdrawalsHistoryDeskProps> = ({ showToast }) => {
  const [period, setPeriod] = useState<string>('week');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [methodFilter, setMethodFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(0);
  const [limit] = useState<number>(10);

  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedRecord, setSelectedRecord] = useState<HistoryRecord | null>(null);

  const [kpis, setKpis] = useState({
    requestedCount: 0,
    requestedAmount: 0,
    approvedCount: 0,
    approvedAmount: 0,
    rejectedCount: 0,
    rejectedAmount: 0,
    pendingCount: 0,
    approvalRate: 0,
    avgDecisionMinutes: 0
  });

  const [buckets, setBuckets] = useState<VolumeBucket[]>([]);
  const [grouping, setGrouping] = useState<string>('By day');

  const loadHistory = async () => {
    try {
      setLoading(true);
      const res = await apiClient.withdrawalsAdmin.getHistory({
        period,
        from: fromDate || undefined,
        to: toDate || undefined,
        status: statusFilter,
        method: methodFilter,
        search: searchQuery.trim() || undefined,
        page,
        limit
      });

      if (res.success) {
        setRecords(res.records || []);
        setTotal(res.total || 0);
        if (res.kpis) setKpis(res.kpis);
        if (res.buckets) setBuckets(res.buckets);
        if (res.grouping) setGrouping(res.grouping);

        // Auto select first record if none selected or not in current page
        if (res.records && res.records.length > 0) {
          if (!selectedRecord || !res.records.some(r => r.id === selectedRecord.id)) {
            setSelectedRecord(res.records[0]);
          }
        } else {
          setSelectedRecord(null);
        }
      }
    } catch (err: any) {
      showToast(`❌ ${err.message || 'Failed to load history'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [period, statusFilter, methodFilter, page]);

  const handlePeriodChange = (p: string) => {
    setPeriod(p);
    setFromDate('');
    setToDate('');
    setPage(0);
  };

  const handleApplyCustomDates = () => {
    if (!fromDate && !toDate) {
      showToast('⚠️ Pick a start or end date');
      return;
    }
    if (fromDate && toDate && fromDate > toDate) {
      showToast('⚠️ Start date must be before end date');
      return;
    }
    setPeriod('custom');
    setPage(0);
    loadHistory();
  };

  const handleExportCSV = () => {
    if (records.length === 0) {
      showToast('⚠️ No records to export');
      return;
    }

    try {
      const headers = [
        'Request ID',
        'Date',
        'Time',
        'Player ID',
        'Player',
        'Method',
        'Pay to',
        'Account name',
        'Amount (ETB)',
        'Status',
        'Decided by',
        'Reference or reason'
      ];

      const escapeCSV = (v: any) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;

      const rows = records.map(r => {
        const d = new Date(r.createdAt);
        return [
          r.displayId,
          d.toISOString().slice(0, 10),
          d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
          r.userDisplayId,
          r.name,
          r.method,
          r.accountPhone,
          r.accountName,
          r.amount,
          r.status,
          r.reviewedByName || '',
          r.payoutReference || r.rejectionReason || ''
        ].map(escapeCSV).join(',');
      });

      const csvContent = [headers.map(escapeCSV).join(','), ...rows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `enqu-withdrawals-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast(`📥 Exported ${records.length} records as CSV`);
    } catch (err: any) {
      showToast('❌ Export failed');
    }
  };

  const formatETB = (val: number) => {
    return Number(val || 0).toLocaleString('en-US');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(w => w[0] || '')
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  // Compute Volume Chart Max Value
  const maxBucketVal = Math.max(
    ...buckets.map(b => (b.approvedAmount || 0) + (b.rejectedAmount || 0)),
    1
  );
  const u = Math.pow(10, Math.max(1, Math.floor(Math.log10(maxBucketVal / 4))));
  const normMax = Math.ceil(maxBucketVal / (4 * u)) * 4 * u;

  return (
    <div>
      {/* Top Filter Card */}
      <div className="w-card" style={{ marginBottom: '15px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          {/* Period Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div className="w-tabs" style={{ margin: 0 }}>
              {[
                ['day', 'Daily'],
                ['week', 'Weekly'],
                ['month', 'Monthly'],
                ['all', 'All time']
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={period === key ? 'on' : ''}
                  style={{ background: period === key ? 'var(--grey)' : 'var(--chip)' }}
                  onClick={() => handlePeriodChange(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="w-tr" style={{ fontWeight: 600 }}>
              {period === 'day'
                ? 'Today'
                : period === 'week'
                ? 'Past 7 days'
                : period === 'month'
                ? 'Past 30 days'
                : period === 'custom'
                ? `Custom: ${fromDate || '...'} to ${toDate || '...'}`
                : 'All recorded time'}
            </span>
          </div>

          {/* Date Pickers + Export */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              aria-label="From date"
              style={{
                background: 'var(--chip)',
                border: 0,
                borderRadius: '12px',
                padding: '8px 10px',
                fontWeight: 600,
                fontSize: '13px'
              }}
            />
            <span className="w-tr">to</span>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              aria-label="To date"
              style={{
                background: 'var(--chip)',
                border: 0,
                borderRadius: '12px',
                padding: '8px 10px',
                fontWeight: 600,
                fontSize: '13px'
              }}
            />
            <button
              type="button"
              className="w-btn"
              onClick={handleApplyCustomDates}
            >
              Apply
            </button>
            <button
              type="button"
              className="w-btn k"
              onClick={handleExportCSV}
            >
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* 4 Historical KPI Cards */}
      <div className="w-grid w-g4">
        <div className="w-card d">
          <div className="w-lab">Requested</div>
          <div className="w-val">ETB {formatETB(kpis.requestedAmount)}</div>
          <div className="w-tr">{kpis.requestedCount} requests</div>
        </div>
        <div className="w-card">
          <div className="w-lab">Approved</div>
          <div className="w-val">ETB {formatETB(kpis.approvedAmount)}</div>
          <div className="w-tr">{kpis.approvedCount} payouts &bull; {kpis.approvalRate}% approval</div>
        </div>
        <div className="w-card">
          <div className="w-lab">Rejected</div>
          <div className="w-val">ETB {formatETB(kpis.rejectedAmount)}</div>
          <div className="w-tr">{kpis.rejectedCount} requests</div>
        </div>
        <div className="w-card">
          <div className="w-lab">Avg. Decision Time</div>
          <div className="w-val">
            {kpis.avgDecisionMinutes > 0
              ? `${Math.floor(kpis.avgDecisionMinutes / 60)}h ${kpis.avgDecisionMinutes % 60}m`
              : '-'}
          </div>
          <div className="w-tr">{kpis.pendingCount} still pending</div>
        </div>
      </div>

      {/* 1.7fr / 1fr Layout: Volume Chart & History Table + Sticky Inspector */}
      <div className="w-grid w-g2" style={{ alignItems: 'start' }}>
        <div>
          {/* Volume Chart Card */}
          <div className="w-card" style={{ marginBottom: '15px' }}>
            <h3>
              Withdrawal Volume
              <span className="r w-lg-legend">
                <span style={{ ['--c' as any]: 'var(--dark)' }}>Approved</span>
                <span style={{ ['--c' as any]: '#cdcdd0' }}>Rejected</span>
              </span>
            </h3>
            <div className="w-tr" style={{ margin: '-6px 0 10px' }}>
              {grouping} &bull; ETB
            </div>

            {/* Stacked Bar Chart */}
            <div className="w-ch">
              {/* Y Gridlines */}
              <div className="w-gl">
                {[0, 1, 2, 3, 4].map(k => (
                  <React.Fragment key={k}>
                    <i style={{ top: `${100 - k * 25}%` }} />
                    <span style={{ top: `${100 - k * 25}%` }}>
                      {normMax * k / 4 >= 1000
                        ? `${(normMax * k / 4 / 1000).toFixed(0)}k`
                        : `${normMax * k / 4}`}
                    </span>
                  </React.Fragment>
                ))}
              </div>

              {/* Bar Columns */}
              <div className="w-bars">
                {buckets.map((b, i) => {
                  const totalAmt = (b.approvedAmount || 0) + (b.rejectedAmount || 0);
                  const heightPercent = normMax > 0 ? (totalAmt / normMax) * 100 : 0;
                  return (
                    <div
                      key={i}
                      className="w-col"
                      title={`${b.tooltip} · ${b.count} requests · Approved ETB ${formatETB(b.approvedAmount)} · Rejected ETB ${formatETB(b.rejectedAmount)}`}
                    >
                      <div className="st" style={{ height: `${Math.min(100, heightPercent)}%` }}>
                        <i className="r" style={{ flex: `${b.rejectedAmount} 1 0%` }} />
                        <i className="a" style={{ flex: `${b.approvedAmount} 1 0%` }} />
                      </div>
                      <span className="wl">{b.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* History Table Card */}
          <div className="w-card">
            <h3>
              Withdrawal History
              <span className="r w-tr">{total} records</span>
            </h3>

            {/* Status Tabs */}
            <div className="w-tabs" style={{ marginBottom: '12px' }}>
              {['All', 'Approved', 'Rejected', 'Pending'].map(st => (
                <button
                  key={st}
                  type="button"
                  className={statusFilter === st ? 'on' : ''}
                  style={{ background: statusFilter === st ? 'var(--grey)' : 'var(--chip)' }}
                  onClick={() => { setStatusFilter(st); setPage(0); }}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Search + Method Filter Row */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '12px' }}>
              <input
                type="text"
                placeholder="Search request, player, number or reference"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { setPage(0); loadHistory(); } }}
                style={{
                  flex: 1,
                  minWidth: '160px',
                  background: 'var(--chip)',
                  border: 0,
                  borderRadius: '12px',
                  padding: '9px 12px',
                  fontWeight: 600,
                  color: 'var(--ink)'
                }}
              />
              <select
                value={methodFilter}
                onChange={e => { setMethodFilter(e.target.value); setPage(0); }}
                style={{
                  width: 'auto',
                  background: 'var(--chip)',
                  border: 0,
                  borderRadius: '12px',
                  padding: '9px 12px',
                  fontWeight: 600,
                  color: 'var(--ink)'
                }}
              >
                <option value="All">All methods</option>
                <option value="Telebirr">Telebirr</option>
                <option value="M-Pesa">M-Pesa</option>
                <option value="CBE">CBE</option>
              </select>
            </div>

            {/* Table */}
            <div className="w-wrap">
              <table className="w-table">
                <thead>
                  <tr>
                    <th>Request</th>
                    <th>Player</th>
                    <th>Method</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {records.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '36px 10px', color: 'var(--mute)' }}>
                        {loading ? 'Loading records...' : 'No withdrawals match these filters.'}
                      </td>
                    </tr>
                  ) : (
                    records.map(record => {
                      const isSelected = selectedRecord?.id === record.id;
                      const statusClass =
                        record.status === 'approved' ? 'ok' : record.status === 'pending' ? 'am' : 'w';
                      return (
                        <tr
                          key={record.id}
                          className={`wr ${isSelected ? 'sel' : ''}`}
                          onClick={() => setSelectedRecord(record)}
                        >
                          <td>
                            <button
                              type="button"
                              className="w-btn"
                              style={{ background: 'none', padding: 0, fontSize: '14px', fontWeight: 700 }}
                              onClick={() => setSelectedRecord(record)}
                            >
                              {record.displayId}
                            </button>
                            <div className="w-tr">
                              {new Date(record.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{' '}
                              {new Date(record.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', flexWrap: 'nowrap' }}>
                              <span className="w-av2">{getInitials(record.name)}</span>
                              <div>
                                <div>{record.name}</div>
                                <div className="w-tr">{record.userDisplayId}</div>
                              </div>
                            </div>
                          </td>
                          <td>{record.method}</td>
                          <td style={{ fontWeight: 700 }}>{formatETB(record.amount)} ETB</td>
                          <td>
                            <span className={`w-badge ${statusClass}`}>
                              {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
              <span className="w-tr">
                Showing {total > 0 ? page * limit + 1 : 0} - {Math.min(total, (page + 1) * limit)} of {total}
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className="w-btn"
                  disabled={page <= 0}
                  onClick={() => setPage(prev => Math.max(0, prev - 1))}
                >
                  Prev
                </button>
                <button
                  type="button"
                  className="w-btn"
                  disabled={(page + 1) * limit >= total}
                  onClick={() => setPage(prev => prev + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sticky Inspector (.w-det) */}
        <div className="w-det">
          {selectedRecord ? (
            <div className="w-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'nowrap' }}>
                <div>
                  <div className="w-tr">Withdrawal request</div>
                  <div style={{ fontSize: '17px', fontWeight: 800 }}>{selectedRecord.displayId}</div>
                </div>
                <span className={`w-badge ${selectedRecord.status === 'approved' ? 'ok' : selectedRecord.status === 'pending' ? 'am' : 'w'}`}>
                  {selectedRecord.status.charAt(0).toUpperCase() + selectedRecord.status.slice(1)}
                </span>
              </div>

              <div className="w-amt">
                {formatETB(selectedRecord.amount)}
                <small>ETB</small>
              </div>
              <div className="w-tr">
                {selectedRecord.method} &bull; requested{' '}
                {new Date(selectedRecord.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{' '}
                {new Date(selectedRecord.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
              </div>

              {/* Decision Section */}
              <div className="w-sec">
                <h4>Decision</h4>
                <div className="w-lg">
                  <span style={{ color: 'var(--mute)' }}>Decided by</span>
                  <b>{selectedRecord.reviewedByName || 'Admin'}</b>
                </div>
                <div className="w-lg">
                  <span style={{ color: 'var(--mute)' }}>Decision time</span>
                  <b>{selectedRecord.decisionDuration}</b>
                </div>
                {selectedRecord.status === 'approved' ? (
                  <div className="w-lg">
                    <span style={{ color: 'var(--mute)' }}>Payout reference</span>
                    <b>
                      {selectedRecord.payoutReference ? (
                        <code style={{ background: 'var(--chip)', padding: '2px 8px', borderRadius: '8px' }}>
                          {selectedRecord.payoutReference}
                        </code>
                      ) : (
                        'None added'
                      )}
                    </b>
                  </div>
                ) : selectedRecord.status === 'rejected' ? (
                  <>
                    <div className="w-lg">
                      <span style={{ color: 'var(--mute)' }}>Reason</span>
                      <b style={{ color: 'var(--r)' }}>{selectedRecord.rejectionReason || 'Declined'}</b>
                    </div>
                    <div className="w-lg">
                      <span style={{ color: 'var(--mute)' }}>Refund</span>
                      <b style={{ color: 'var(--g)' }}>Returned to wallet</b>
                    </div>
                  </>
                ) : null}
              </div>

              {/* Payout Details */}
              <div className="w-sec">
                <h4>Payout details</h4>
                <div className="w-lg">
                  <span style={{ color: 'var(--mute)' }}>Player</span>
                  <b>{selectedRecord.name} <span className="w-tr">{selectedRecord.userDisplayId}</span></b>
                </div>
                <div className="w-lg">
                  <span style={{ color: 'var(--mute)' }}>Pay to</span>
                  <b>{selectedRecord.method}</b>
                </div>
                <div className="w-lg">
                  <span style={{ color: 'var(--mute)' }}>
                    {selectedRecord.method === 'CBE' ? 'Account number' : 'Phone number'}
                  </span>
                  <b>
                    <code style={{ background: 'var(--chip)', padding: '2px 8px', borderRadius: '8px' }}>
                      {selectedRecord.accountPhone}
                    </code>
                  </b>
                </div>
                <div className="w-lg">
                  <span style={{ color: 'var(--mute)' }}>Account name</span>
                  <b>{selectedRecord.accountName}</b>
                </div>
              </div>

              {/* Player Activity */}
              {selectedRecord.playerActivity && (
                <div className="w-sec">
                  <h4>Player activity</h4>
                  <div className="w-lg">
                    <span style={{ color: 'var(--mute)' }}>Wallet balance</span>
                    <b>{formatETB(selectedRecord.playerActivity.walletBalance)} ETB</b>
                  </div>
                  <div className="w-lg">
                    <span style={{ color: 'var(--mute)' }}>Total deposited</span>
                    <b>{formatETB(selectedRecord.playerActivity.totalDeposited)} ETB</b>
                  </div>
                  <div className="w-lg">
                    <span style={{ color: 'var(--mute)' }}>Total withdrawn</span>
                    <b>{formatETB(selectedRecord.playerActivity.totalWithdrawn)} ETB</b>
                  </div>
                  <div className="w-lg">
                    <span style={{ color: 'var(--mute)' }}>Member since</span>
                    <b>{selectedRecord.playerActivity.joinedDate}</b>
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div className="w-sec">
                <h4>Timeline</h4>
                <div className="w-tl">
                  <div>
                    <b>
                      {new Date(selectedRecord.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{' '}
                      {new Date(selectedRecord.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                    </b>
                    Player requested {formatETB(selectedRecord.amount)} ETB to {selectedRecord.method}. Amount held from wallet.
                  </div>
                  {selectedRecord.reviewedAt && (
                    <div>
                      <b>
                        {new Date(selectedRecord.reviewedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{' '}
                        {new Date(selectedRecord.reviewedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                      </b>
                      {selectedRecord.status === 'approved'
                        ? `Approved by ${selectedRecord.reviewedByName || 'Admin'}. Paid to ${selectedRecord.method} ${selectedRecord.accountPhone}${selectedRecord.payoutReference ? `. Reference: ${selectedRecord.payoutReference}` : ''}. Player notified.`
                        : `Rejected by ${selectedRecord.reviewedByName || 'Admin'}: ${selectedRecord.rejectionReason || 'Declined'}. ${formatETB(selectedRecord.amount)} ETB returned to wallet. Player notified.`}
                    </div>
                  )}
                  {selectedRecord.adminNote && (
                    <div>
                      <b>Admin note</b>
                      {selectedRecord.adminNote}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="w-card" style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--mute)' }}>
              Select a record to see full decision details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
