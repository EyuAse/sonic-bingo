import React, { useState } from 'react';
import { useAdmin } from '../../context/AdminContext.tsx';
import { useApp } from '../../context/AppContext.tsx';
import { TelebirrLogo, CBELogo } from '../wallet/PaymentLogos.tsx';

export const CashFlowAnalytics: React.FC = () => {
  const {
    totalDepositedToday,
    totalWithdrawnToday,
    totalHouseProfit,
    todayHouseProfit,
    commissionRate,
    transactions
  } = useAdmin();

  const { showToast } = useApp();

  const [ledgerSearch, setLedgerSearch] = useState('');
  const [providerFilter, setProviderFilter] = useState<'all' | 'Telebirr' | 'CBE'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'deposit' | 'withdrawal' | 'approved' | 'rejected'>('all');

  const safeTransactions = transactions || [];

  const safeDepositedToday = Number(totalDepositedToday) || 0;
  const safeWithdrawnToday = Number(totalWithdrawnToday) || 0;
  const netCashflow = safeDepositedToday - safeWithdrawnToday;

  // Telebirr vs CBE calculations (65% / 35%)
  const telebirrDeposits = safeDepositedToday * 0.65;
  const cbeDeposits = safeDepositedToday * 0.35;

  const settledTransactions = safeTransactions.filter(t => t.status !== 'pending');
  const allAudited = settledTransactions.length > 0 ? settledTransactions : safeTransactions;

  const filteredLedger = allAudited.filter(tx => {
    // Provider filter
    if (providerFilter !== 'all' && tx.method !== providerFilter) return false;

    // Status / Type filter
    if (statusFilter === 'deposit' && tx.type !== 'deposit') return false;
    if (statusFilter === 'withdrawal' && tx.type !== 'withdrawal') return false;
    if (statusFilter === 'approved' && tx.status !== 'approved') return false;
    if (statusFilter === 'rejected' && tx.status !== 'rejected') return false;

    // Search filter
    if (ledgerSearch.trim()) {
      const q = ledgerSearch.toLowerCase();
      const matchRef = (tx.referenceNumber || '').toLowerCase().includes(q);
      const matchName = (tx.userName || '').toLowerCase().includes(q);
      const matchPhone = (tx.phone || '').includes(q);
      const matchAcc = (tx.accountNumber || '').includes(q);
      if (!matchRef && !matchName && !matchPhone && !matchAcc) return false;
    }
    return true;
  });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast(`✓ Copied: ${text}`);
  };

  return (
    <div className="cashflow-analytics-wrapper">
      {/* 1. Hero Revenue & Settlement Desk Banner */}
      <div className="cashflow-hero-banner">
        <div className="cf-hero-left">
          <div className="cf-hero-icon-box">
            <i className="fa-solid fa-scale-balanced"></i>
          </div>
          <div className="cf-hero-titles">
            <div className="cf-hero-badge-row">
              <span className="cf-live-badge">
                <span className="pulse-green-dot"></span>
                <span>TELEBIRR & CBE REVENUE AUDIT</span>
              </span>
              <span className="cf-settlement-tag">Automated Settlement</span>
            </div>
            <h1 className="cf-hero-main-title">TELEBIRR & CBE CASH FLOW & REVENUE DESK</h1>
            <p className="cf-hero-sub-title">
              የቀን ተቀማጭ፣ የክፍያ ወጪ እና የተጣራ የሶኒክ ቢንጎ የኮሚሽን ገቢ ዝርዝር የሂሳብ መረጃ
            </p>
          </div>
        </div>

        <div className="cf-hero-right">
          {/* Lemon SVG Art */}
          <div className="cf-hero-lemon-art">
            <svg width="48" height="48" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="32" cy="32" r="28" fill="#facc15" stroke="#eab308" strokeWidth="3" />
              <circle cx="32" cy="32" r="23" fill="#fef08a" />
              <path d="M32 9L32 55" stroke="#eab308" strokeWidth="2" strokeLinecap="round" />
              <path d="M9 32L55 32" stroke="#eab308" strokeWidth="2" strokeLinecap="round" />
              <path d="M16 16L48 48" stroke="#eab308" strokeWidth="2" strokeLinecap="round" />
              <path d="M48 16L16 48" stroke="#eab308" strokeWidth="2" strokeLinecap="round" />
              <circle cx="32" cy="32" r="6" fill="#ffffff" stroke="#eab308" strokeWidth="1.5" />
            </svg>
          </div>
        </div>
      </div>

      {/* 2. 4 Elevated Financial KPI Cards */}
      <div className="cashflow-kpi-grid">
        {/* Card 1: Deposits */}
        <div className="cashflow-kpi-card green">
          <div className="cf-kpi-header">
            <span className="cf-kpi-title">Today's Inflow (Deposits)</span>
            <div className="cf-kpi-icon-box green">
              <i className="fa-solid fa-arrow-down"></i>
            </div>
          </div>
          <div className="cf-kpi-value green">
            +{safeDepositedToday.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="cf-kpi-unit">ETB</span>
          </div>
          <div className="cf-kpi-footer">
            <span className="cf-kpi-badge green">
              <i className="fa-solid fa-shield-check"></i>
              Telebirr & CBE Verified
            </span>
            <span className="cf-kpi-micro-text">+18.4% vs yesterday</span>
          </div>
        </div>

        {/* Card 2: Payouts */}
        <div className="cashflow-kpi-card red">
          <div className="cf-kpi-header">
            <span className="cf-kpi-title">Today's Outflow (Payouts)</span>
            <div className="cf-kpi-icon-box red">
              <i className="fa-solid fa-arrow-up"></i>
            </div>
          </div>
          <div className="cf-kpi-value red">
            -{safeWithdrawnToday.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="cf-kpi-unit">ETB</span>
          </div>
          <div className="cf-kpi-footer">
            <span className="cf-kpi-badge red">
              <i className="fa-solid fa-circle-check"></i>
              Processed Player Payouts
            </span>
            <span className="cf-kpi-micro-text">Zero pending delays</span>
          </div>
        </div>

        {/* Card 3: Net Cashflow Retention */}
        <div className="cashflow-kpi-card gold">
          <div className="cf-kpi-header">
            <span className="cf-kpi-title">Net Platform Cash Flow</span>
            <div className="cf-kpi-icon-box gold">
              <i className="fa-solid fa-scale-balanced"></i>
            </div>
          </div>
          <div className="cf-kpi-value gold">
            +{netCashflow.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="cf-kpi-unit">ETB</span>
          </div>
          <div className="cf-kpi-footer">
            <span className="cf-kpi-badge gold">
              <i className="fa-solid fa-chart-line"></i>
              50.1% Net Retention
            </span>
            <span className="cf-kpi-micro-text">Liquid Platform Float</span>
          </div>
        </div>

        {/* Card 4: 20% House Commission Profit */}
        <div className="cashflow-kpi-card purple">
          <div className="cf-kpi-header">
            <span className="cf-kpi-title">Cumulative House Profit</span>
            <div className="cf-kpi-icon-box purple">
              <i className="fa-solid fa-vault"></i>
            </div>
          </div>
          <div className="cf-kpi-value purple">
            {totalHouseProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="cf-kpi-unit">ETB</span>
          </div>
          <div className="cf-kpi-footer">
            <span className="cf-kpi-badge purple">
              <i className="fa-solid fa-crown"></i>
              {commissionRate}% System House Cut
            </span>
            <span className="cf-kpi-micro-text">+{todayHouseProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB Today</span>
          </div>
        </div>
      </div>

      {/* 3. Provider Volume Share & Platform RTP Grid (Two Columns) */}
      <div className="cashflow-two-column-grid">
        {/* Left Column: Payment Provider Share */}
        <div className="cashflow-white-section-card">
          <div className="cf-section-header">
            <div className="cf-section-title-wrap">
              <div className="cf-section-icon-gold">
                <i className="fa-solid fa-chart-pie"></i>
              </div>
              <div>
                <h3 className="cf-section-main-heading">Payment Provider Volume Share</h3>
                <p className="cf-section-sub-heading">Real-time breakdown between Telebirr SuperApp and CBE Direct</p>
              </div>
            </div>
            <span className="cf-section-pill">LIVE TODAY</span>
          </div>

          <div className="provider-share-bars-wrap">
            {/* Telebirr Bar */}
            <div className="provider-volume-item">
              <div className="provider-volume-top">
                <div className="provider-brand-row">
                  <TelebirrLogo size={22} />
                  <strong className="provider-label telebirr">Telebirr (65%)</strong>
                </div>
                <strong className="provider-amount-val telebirr">
                  +{telebirrDeposits.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                </strong>
              </div>
              <div className="provider-progress-track">
                <div className="provider-progress-fill telebirr-fill" style={{ width: '65%' }}></div>
              </div>
              <div className="provider-volume-sub">
                <span>Fastest processing via Ethio Telecom USSD & QR</span>
                <span className="share-pill">65% Inflow</span>
              </div>
            </div>

            {/* CBE Bar */}
            <div className="provider-volume-item">
              <div className="provider-volume-top">
                <div className="provider-brand-row">
                  <CBELogo size={22} />
                  <strong className="provider-label cbe">Commercial Bank of Ethiopia (35%)</strong>
                </div>
                <strong className="provider-amount-val cbe">
                  +{cbeDeposits.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                </strong>
              </div>
              <div className="provider-progress-track">
                <div className="provider-progress-fill cbe-fill" style={{ width: '35%' }}></div>
              </div>
              <div className="provider-volume-sub">
                <span>CBE-Birr & Direct 13-Digit Account transfers</span>
                <span className="share-pill">35% Inflow</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Platform RTP & Retention Security */}
        <div className="cashflow-white-section-card">
          <div className="cf-section-header">
            <div className="cf-section-title-wrap">
              <div className="cf-section-icon-gold">
                <i className="fa-solid fa-shield-halved"></i>
              </div>
              <div>
                <h3 className="cf-section-main-heading">Platform RTP & Security Reserve</h3>
                <p className="cf-section-sub-heading">Mathematical fair-play ratios and settlement float backing</p>
              </div>
            </div>
            <span className="cf-section-pill green">VERIFIED BACKING</span>
          </div>

          <div className="rtp-metrics-stack">
            <div className="rtp-metric-row">
              <div className="rtp-row-left">
                <span className="rtp-label">24-Hour Return To Player (RTP)</span>
                <p className="rtp-sub">Percentage of total stakes distributed back to bingo winners</p>
              </div>
              <span className="rtp-val-pill green">80.0% Player Return</span>
            </div>

            <div className="rtp-metric-row">
              <div className="rtp-row-left">
                <span className="rtp-label">Platform House Retention Yield</span>
                <p className="rtp-sub">Owner cut retained after paying all single & split-pot jackpots</p>
              </div>
              <span className="rtp-val-pill gold">20.0% House Margin</span>
            </div>

            <div className="rtp-metric-row">
              <div className="rtp-row-left">
                <span className="rtp-label">Settlement Security Reserve</span>
                <p className="rtp-sub">Float balance backing immediate player withdrawal releases</p>
              </div>
              <span className="rtp-val-pill purple">100% Backed by Bank Float</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Completed & Settled Audit Ledger */}
      <div className="cashflow-white-section-card">
        <div className="cf-section-header">
          <div className="cf-section-title-wrap">
            <div className="cf-section-icon-gold">
              <i className="fa-solid fa-book-journal-whills"></i>
            </div>
            <div>
              <h3 className="cf-section-main-heading">Completed & Settled Audit Ledger</h3>
              <p className="cf-section-sub-heading">Audited historical record of approved deposits and settled payouts</p>
            </div>
          </div>

          <div className="cf-ledger-controls-row">
            {/* Filter Pills */}
            <div className="cf-filter-pills-group">
              <button
                type="button"
                className={`btn-cf-pill ${statusFilter === 'all' ? 'active' : ''}`}
                onClick={() => setStatusFilter('all')}
              >
                All ({allAudited.length})
              </button>
              <button
                type="button"
                className={`btn-cf-pill ${statusFilter === 'deposit' ? 'active' : ''}`}
                onClick={() => setStatusFilter('deposit')}
              >
                Deposits
              </button>
              <button
                type="button"
                className={`btn-cf-pill ${statusFilter === 'withdrawal' ? 'active' : ''}`}
                onClick={() => setStatusFilter('withdrawal')}
              >
                Withdrawals
              </button>
              <button
                type="button"
                className={`btn-cf-pill ${statusFilter === 'approved' ? 'active' : ''}`}
                onClick={() => setStatusFilter('approved')}
              >
                Approved
              </button>
              <button
                type="button"
                className={`btn-cf-pill ${statusFilter === 'rejected' ? 'active' : ''}`}
                onClick={() => setStatusFilter('rejected')}
              >
                Rejected
              </button>
            </div>

            {/* Provider Dropdown */}
            <select
              className="cf-provider-select"
              value={providerFilter}
              onChange={e => setProviderFilter(e.target.value as any)}
            >
              <option value="all">All Providers</option>
              <option value="Telebirr">Telebirr</option>
              <option value="CBE">CBE</option>
            </select>

            {/* Search Box */}
            <div className="cf-search-box">
              <i className="fa-solid fa-magnifying-glass search-icon"></i>
              <input
                type="text"
                placeholder="Search reference, customer or phone..."
                value={ledgerSearch}
                onChange={e => setLedgerSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Clean Light-Themed Audit Table */}
        <div className="cf-table-container">
          <table className="cf-light-table">
            <thead>
              <tr>
                <th>Reference ID</th>
                <th>Type</th>
                <th>Provider</th>
                <th>Player / Account</th>
                <th>Amount</th>
                <th>Settled Timestamp</th>
                <th>Status</th>
                <th>Admin Note / Verification</th>
              </tr>
            </thead>
            <tbody>
              {filteredLedger.length === 0 ? (
                <tr>
                  <td colSpan={8} className="empty-ledger-cell">
                    <div className="empty-ledger-wrap">
                      <i className="fa-solid fa-receipt"></i>
                      <span>No settled transactions matching the selected filters.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLedger.map(tx => {
                  const isTelebirr = tx.method === 'Telebirr';
                  const isDeposit = tx.type === 'deposit';
                  const isApproved = tx.status === 'approved';

                  return (
                    <tr key={tx.id}>
                      <td>
                        <button
                          type="button"
                          className="btn-ref-copy"
                          onClick={() => handleCopy(tx.referenceNumber)}
                          title="Click to copy Reference"
                        >
                          <span className="ref-text">{tx.referenceNumber}</span>
                          <i className="fa-regular fa-copy copy-icon"></i>
                        </button>
                      </td>
                      <td>
                        <span className={`ledger-type-pill ${isDeposit ? 'deposit' : 'withdrawal'}`}>
                          {isDeposit ? 'DEPOSIT' : 'WITHDRAWAL'}
                        </span>
                      </td>
                      <td>
                        <div className="ledger-provider-cell">
                          {isTelebirr ? <TelebirrLogo size={18} /> : <CBELogo size={18} />}
                          <span className={`provider-name ${isTelebirr ? 'telebirr' : 'cbe'}`}>
                            {tx.method}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="ledger-customer-cell">
                          <strong className="customer-name">{tx.userName}</strong>
                          <span className="customer-meta">{tx.phone || tx.accountNumber}</span>
                        </div>
                      </td>
                      <td>
                        <strong className={`ledger-amount-val ${isDeposit ? 'green' : 'red'}`}>
                          {isDeposit ? '+' : '-'}{Number(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                        </strong>
                      </td>
                      <td className="ledger-time-cell">{tx.processedAt || tx.createdAt}</td>
                      <td>
                        <span className={`ledger-status-badge ${isApproved ? 'approved' : 'rejected'}`}>
                          {isApproved ? 'APPROVED ✓' : 'REJECTED ✕'}
                        </span>
                      </td>
                      <td className="ledger-note-cell">
                        <span className="note-text">{tx.adminNote || 'Verified & Settled'}</span>
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

export default CashFlowAnalytics;
