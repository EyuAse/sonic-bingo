import React from 'react';
import { useAdmin, TransactionRequest } from '../../context/AdminContext.tsx';
import { useApp } from '../../context/AppContext.tsx';
import { AdminTab } from './AdminSidebar.tsx';
import { TelebirrLogo, CBELogo } from '../wallet/PaymentLogos.tsx';

interface DashboardOverviewProps {
  onNavigateTab: (tab: AdminTab) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ onNavigateTab }) => {
  const {
    totalHouseProfit,
    todayHouseProfit,
    todayGamesPlayed,
    houseCommissionEnabled,
    setHouseCommissionEnabled,
    commissionRate,
    simulatedPlayerCount,
    setSimulatedPlayerCount,
    botWinRate,
    users,
    totalUsersCount,
    userStats,
    transactions,
    approveAndReleaseTransaction,
    rejectTransaction
  } = useAdmin();

  const { switchPage, showToast } = useApp();

  const pendingTransactions = transactions.filter(t => t.status === 'pending');
  const playersOnly = users.filter(u => u.role !== 'admin');
  const activeUsersCount = userStats?.activePlayers ?? playersOnly.filter(u => u.status === 'active').length;

  // Real Dynamic Financial Cash Flow Barometer Calculations
  const todayDeposits = transactions
    .filter(t => t.type === 'deposit' && t.status === 'approved')
    .reduce((acc, t) => acc + (t.amount || 0), 0);

  const todayWithdrawals = transactions
    .filter(t => t.type === 'withdrawal' && t.status === 'approved')
    .reduce((acc, t) => acc + (t.amount || 0), 0);

  const netCashFlow = todayDeposits - todayWithdrawals;
  const retentionPercent = todayDeposits > 0
    ? ((netCashFlow / todayDeposits) * 100).toFixed(1)
    : '0.0';

  const handleApproveTx = (tx: TransactionRequest) => {
    approveAndReleaseTransaction(tx.id);
    showToast(`✓ Approved ${tx.amount} ETB for ${tx.userName}`);
  };

  const handleRejectTx = (tx: TransactionRequest) => {
    rejectTransaction(tx.id, 'Rejected from Dashboard Quick Review');
    showToast(`❌ Rejected transaction ${tx.referenceNumber}`);
  };

  return (
    <div className="dashboard-overview-container">
      {/* 1. Hero Command Center Banner */}
      <div className="dashboard-hero-banner">
        <div className="dash-hero-left">
          <div className="dash-hero-icon-box">
            <i className="fa-solid fa-gauge-high"></i>
          </div>
          <div className="dash-hero-titles">
            <div className="dash-hero-badge-row">
              <span className="dash-live-badge">
                <span className="pulse-green-dot"></span>
                <span>ENGINE V3 RUNNING</span>
              </span>
              <span className="dash-uptime-tag">99.9% Uptime</span>
            </div>
            <h1 className="dash-hero-main-title">SONIC BINGO PLATFORM OPERATIONS DESK</h1>
            <p className="dash-hero-sub-title">
              የሶኒክ ቢንጎ የቀጥታ ጨዋታዎችን፣ የኮሚሽን ትርፍን እና የክፍያዎችን ፍሰት በአንድ ማዕከል ይቆጣጠሩ
            </p>
          </div>
        </div>

        <div className="dash-hero-right">
          {/* Lemon SVG Art */}
          <div className="dash-hero-lemon-art">
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

          <div className="dash-hero-action-buttons">
            <button
              type="button"
              className="btn-dash-hero-bot-engine"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '0.875rem',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
                transition: 'all 0.2s ease'
              }}
              onClick={() => onNavigateTab('bot-engine')}
            >
              <i className="fa-solid fa-sliders"></i>
              <span>🎚️ Bot Engine (0-50 Bots) ➔</span>
            </button>

            <button
              type="button"
              className="btn-dash-hero-cashier"
              onClick={() => onNavigateTab('cashier')}
            >
              <i className="fa-solid fa-receipt"></i>
              <span>Cashier Queue ({pendingTransactions.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Hero Metric KPI Cards */}
      <div className="dashboard-kpi-grid">
        {/* Card: Room 10 Bot Engine Controls */}
        <div
          className="dashboard-kpi-card purple"
          style={{ cursor: 'pointer', border: '1px solid rgba(139, 92, 246, 0.3)' }}
          onClick={() => onNavigateTab('bot-engine')}
        >
          <div className="kpi-card-header">
            <span className="kpi-card-title">Room 10 Bot Engine</span>
            <div className="kpi-card-icon-box purple" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
              <i className="fa-solid fa-sliders"></i>
            </div>
          </div>
          <div className="kpi-card-value purple" style={{ color: '#6d28d9' }}>
            0 – 50 <span className="kpi-unit">Bots & Toggles</span>
          </div>
          <div className="kpi-card-footer">
            <span className="kpi-badge green">
              <i className="fa-solid fa-bolt"></i>
              Living Casino & Sliders
            </span>
            <button
              type="button"
              className="kpi-card-link-btn"
              onClick={(e) => {
                e.stopPropagation();
                onNavigateTab('bot-engine');
              }}
            >
              Configure ➔
            </button>
          </div>
        </div>
        {/* Card 1: House Profit */}
        <div className="dashboard-kpi-card gold">
          <div className="kpi-card-header">
            <span className="kpi-card-title">House Commission Profit</span>
            <div className="kpi-card-icon-box gold">
              <i className="fa-solid fa-vault"></i>
            </div>
          </div>
          <div className="kpi-card-value gold">
            {todayHouseProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="kpi-unit">ETB Today</span>
          </div>
          <div className="kpi-card-footer">
            <span className="kpi-badge gold">
              <i className="fa-solid fa-coins"></i>
              Total: {totalHouseProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
            </span>
            <span className="kpi-micro-text">
              {todayGamesPlayed > 0 ? `${todayGamesPlayed} rounds today (${commissionRate}% Cut)` : `${commissionRate}% Cut Active`}
            </span>
          </div>
        </div>

        {/* Card 2: Registered Accounts */}
        <div className="dashboard-kpi-card green">
          <div className="kpi-card-header">
            <span className="kpi-card-title">Registered Accounts</span>
            <div className="kpi-card-icon-box green">
              <i className="fa-solid fa-address-card"></i>
            </div>
          </div>
          <div className="kpi-card-value green">
            {(totalUsersCount || users.length)} <span className="kpi-unit">Accounts</span>
          </div>
          <div className="kpi-card-footer">
            <span className="kpi-badge green">
              <i className="fa-solid fa-gift"></i>
              10 ETB Welcome Bonus
            </span>
            <span className="kpi-micro-text">{activeUsersCount} Active today</span>
          </div>
        </div>

        {/* Card 4: Pending Cashier Settlements */}
        <div className="dashboard-kpi-card blue">
          <div className="kpi-card-header">
            <span className="kpi-card-title">Pending Cashier Queue</span>
            <div className="kpi-card-icon-box blue">
              <i className="fa-solid fa-cash-register"></i>
            </div>
          </div>
          <div className="kpi-card-value blue">
            {pendingTransactions.length} <span className="kpi-unit">Orders</span>
          </div>
          <div className="kpi-card-footer">
            <span className={`kpi-badge ${pendingTransactions.length > 0 ? 'red' : 'green'}`}>
              <i className={`fa-solid ${pendingTransactions.length > 0 ? 'fa-clock' : 'fa-check'}`}></i>
              {pendingTransactions.length > 0 ? `${pendingTransactions.length} Needs Action` : 'All Settled'}
            </span>
            <button
              type="button"
              className="kpi-card-link-btn"
              onClick={() => onNavigateTab('cashier')}
            >
              Open Desk ➔
            </button>
          </div>
        </div>
      </div>

      {/* 3. Live Bingo Arena Monitor & Cash Flow Barometer */}
      <div className="dashboard-two-column-grid">
        {/* Left Column: 75-Ball Arena Monitor */}
        <div className="dashboard-white-section-card">
          <div className="section-card-header-row">
            <div className="section-title-wrap">
              <div className="section-icon-gold">
                <i className="fa-solid fa-tower-broadcast"></i>
              </div>
              <div>
                <h3 className="section-main-heading">Live Bingo Arena Monitor</h3>
                <p className="section-sub-heading">Real-time parameters of active 75-ball betting games</p>
              </div>
            </div>
            <span className="section-status-tag green">75-BALL LIVE</span>
          </div>

          <div className="arena-monitor-grid">
            <div className="arena-spec-tile">
              <span className="spec-label">Stakes Range</span>
              <strong className="spec-value">10, 20, 50, 100 ETB</strong>
            </div>
            <div className="arena-spec-tile">
              <span className="spec-label">Total Cartela Pool</span>
              <strong className="spec-value gold">600 Serial Cards</strong>
            </div>
            <div className="arena-spec-tile">
              <span className="spec-label">Multi-Winner Rule</span>
              <strong className="spec-value green">Split Pot Shared</strong>
            </div>
            <div className="arena-spec-tile">
              <span className="spec-label">Max Cartelas</span>
              <strong className="spec-value purple">4 Cards Max</strong>
            </div>
          </div>
        </div>

        {/* Right Column: Today's Financial Cash Flow Barometer */}
        <div className="dashboard-white-section-card">
          <div className="section-card-header-row">
            <div className="section-title-wrap">
              <div className="section-icon-gold">
                <i className="fa-solid fa-scale-balanced"></i>
              </div>
              <div>
                <h3 className="section-main-heading">Financial Cash Flow Barometer</h3>
                <p className="section-sub-heading">Daily Telebirr & CBE banking turnover and retention</p>
              </div>
            </div>
            <span className="section-status-tag">DAILY SETTLEMENT</span>
          </div>

          <div className="cashflow-barometer-grid">
            <div className="barometer-cell green">
              <span className="baro-label">Today's Inflow (Deposits)</span>
              <strong className="baro-amount green">+{todayDeposits.toFixed(2)} ETB</strong>
              <span className="baro-sub">Telebirr & CBE verified</span>
            </div>
            <div className="barometer-cell red">
              <span className="baro-label">Today's Outflow (Payouts)</span>
              <strong className="baro-amount red">-{todayWithdrawals.toFixed(2)} ETB</strong>
              <span className="baro-sub">Processed player withdrawals</span>
            </div>
            <div className="barometer-cell gold">
              <span className="baro-label">Net Inflow (Platform Balance)</span>
              <strong className="baro-amount gold">{netCashFlow >= 0 ? '+' : ''}{netCashFlow.toFixed(2)} ETB</strong>
              <span className="baro-sub">+{retentionPercent}% Net Retention</span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Quick Cashier Pending Queue Mini-Desk */}
      <div className="dashboard-white-section-card">
        <div className="section-card-header-row">
          <div className="section-title-wrap">
            <div className="section-icon-gold">
              <i className="fa-solid fa-cash-register"></i>
            </div>
            <div>
              <h3 className="section-main-heading">Cashier Queue Quick Review</h3>
              <p className="section-sub-heading">Recent pending deposits and withdrawals awaiting supervisor approval</p>
            </div>
          </div>
          <button
            type="button"
            className="btn-dash-view-all-cashier"
            onClick={() => onNavigateTab('cashier')}
          >
            <span>Open Cashier Desk ({transactions.length} Total)</span>
            <i className="fa-solid fa-arrow-right"></i>
          </button>
        </div>

        {pendingTransactions.length === 0 ? (
          <div className="dash-empty-queue-box">
            <i className="fa-solid fa-circle-check green"></i>
            <div>
              <strong className="empty-title">All Settlements Cleared!</strong>
              <p className="empty-sub">No pending Telebirr or CBE requests awaiting cashier verification.</p>
            </div>
          </div>
        ) : (
          <div className="dash-mini-tx-grid">
            {pendingTransactions.slice(0, 3).map(tx => {
              const isTelebirr = tx.method === 'Telebirr';
              const isDeposit = tx.type === 'deposit';

              return (
                <div key={tx.id} className="dash-mini-tx-card">
                  <div className="mini-card-top-row">
                    <div className="mini-card-provider">
                      {isTelebirr ? <TelebirrLogo size={20} /> : <CBELogo size={20} />}
                      <span className={`provider-name ${isTelebirr ? 'telebirr' : 'cbe'}`}>{tx.method}</span>
                    </div>
                    <span className={`mini-type-pill ${isDeposit ? 'deposit' : 'withdrawal'}`}>
                      {isDeposit ? 'DEPOSIT' : 'WITHDRAWAL'}
                    </span>
                  </div>

                  <div className="mini-card-center-row">
                    <div className="mini-card-info-stack">
                      <strong className="mini-tx-user">{tx.userName}</strong>
                      <span className="mini-tx-ref">{tx.referenceNumber}</span>
                    </div>
                    <strong className={`mini-tx-amount ${isDeposit ? 'green' : 'gold'}`}>
                      {isDeposit ? `+${tx.amount.toFixed(2)}` : `${tx.amount.toFixed(2)}`} ETB
                    </strong>
                  </div>

                  <div className="mini-card-actions-row">
                    <button
                      type="button"
                      className="btn-mini-approve-green"
                      onClick={() => handleApproveTx(tx)}
                    >
                      <i className="fa-solid fa-bolt"></i>
                      <span>Approve</span>
                    </button>
                    <button
                      type="button"
                      className="btn-mini-reject-red"
                      onClick={() => handleRejectTx(tx)}
                    >
                      <i className="fa-solid fa-xmark"></i>
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardOverview;
