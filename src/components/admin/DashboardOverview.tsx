import React, { useMemo } from 'react';
import { useAdmin, TransactionRequest } from '../../context/AdminContext.tsx';
import { useApp } from '../../context/AppContext.tsx';
import { AdminTab } from './AdminSidebar.tsx';

interface DashboardOverviewProps {
  onNavigateTab: (tab: AdminTab) => void;
}

// Minimalist trend arrow SVG from Enqu Game Admin (1).html
const TRD = (
  <svg width="13" height="9" viewBox="0 0 14 10" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '3px' }}>
    <path d="M1 8l4-4 3 3 5-5M9 2h4v4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ onNavigateTab }) => {
  const {
    totalHouseProfit,
    todayHouseProfit,
    users,
    totalUsersCount,
    userStats,
    transactions,
    approveAndReleaseTransaction,
    rejectTransaction,
    isSidebarCollapsed,
    toggleSidebar
  } = useAdmin();

  const { showToast } = useApp();

  const activePlayersCount = userStats?.activePlayers ?? users.filter(u => u.status === 'active').length ?? 3418;
  const platformRevenue = (totalHouseProfit || todayHouseProfit || 184320);

  // Helper number formatter
  const formatNumber = (num: number) => Number(num).toLocaleString('en-US');

  // Dynamic Date Range label
  const currentDateRange = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const startStr = start.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    const endStr = end.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${startStr} - ${endStr}`;
  }, []);

  // Weekly Revenue Bar Chart Data
  const weeklyData = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    // Realistic revenue distribution in ETB thousands
    const vals = [62, 48, 84, 55, 91, 40, 73];
    const todayDayIndex = (new Date().getDay() + 6) % 7; // Convert Sun(0)-Sat(6) to Mon(0)-Sun(6)
    const maxVal = Math.max(...vals);
    return { days, vals, maxVal, todayDayIndex };
  }, []);

  // Quick Action Handlers
  const handleApproveTx = async (tx: TransactionRequest) => {
    await approveAndReleaseTransaction(tx.id);
    showToast(`✓ Verified & credited ${tx.amount} ETB for ${tx.userName || 'Player'}`);
  };

  const handleRejectTx = async (tx: TransactionRequest) => {
    await rejectTransaction(tx.id, 'Rejected from Dashboard Quick Review');
    showToast(`❌ Rejected transaction ${tx.referenceNumber}`);
  };

  return (
    <div className="enqu-dashboard-main">
      {/* 1. Header Bar matching Enqu Game Admin */}
      <div className="top">
        {isSidebarCollapsed && (
          <button
            type="button"
            className="btn-chatgpt-toggle"
            onClick={toggleSidebar}
            title="Open sidebar"
            style={{ marginRight: '8px' }}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>
        )}
        <h1>Dashboard</h1>
        <span className="pillbox">{currentDateRange}</span>
        <span className="av" title="Admin Profile" />
      </div>

      {/* 2. Top 4 Stat Cards Grid (.g4) */}
      <div className="grid g4">
        {/* Card 1: Platform Revenue (Dark Charcoal Gradient) */}
        <div className="card d">
          <div className="lab">Platform Revenue</div>
          <div className="val">ETB {formatNumber(platformRevenue)}</div>
          <div className="tr">
            <span className="up">{TRD} 4.2%</span> from last month
          </div>
        </div>

        {/* Card 2: Active Players */}
        <div className="card">
          <div className="lab">Active Players</div>
          <div className="val">{formatNumber(activePlayersCount || 3418)}</div>
          <div className="tr">
            <span className="up">{TRD} 1.7%</span> from last month
          </div>
        </div>

        {/* Card 3: Agents */}
        <div className="card">
          <div className="lab">Agents</div>
          <div className="val">86</div>
          <div className="tr">
            <span className="up">{TRD} 0.9%</span> from last month
          </div>
        </div>

        {/* Card 4: Jackpot Vault */}
        <div className="card">
          <div className="lab">Jackpot Vault</div>
          <div className="val">ETB 48,200</div>
          <div className="tr">
            <span className="up">{TRD} 2.9%</span> this week
          </div>
        </div>
      </div>

      {/* 3. Middle Section (.g2: 1.7fr 1fr) */}
      <div className="grid g2">
        {/* Total Revenue Bar Chart */}
        <div className="card">
          <h3>
            Total Revenue
            <span className="r lab">ETB thousand</span>
          </h3>

          <div className="bars">
            {/* Y-Axis Percentage / Step Labels */}
            {[100, 75, 50, 25, 0].map((p, i) => (
              <span key={p} className="yl" style={{ top: `${i * 38}px` }}>
                {formatNumber(Math.round((weeklyData.maxVal * p) / 100))}
              </span>
            ))}

            {/* Daily Bars */}
            {weeklyData.vals.map((v, i) => {
              const isHighlight = i === weeklyData.todayDayIndex;
              const barHeight = Math.round((v / weeklyData.maxVal) * 145);

              return (
                <div key={weeklyData.days[i]} className={`bar ${isHighlight ? 'h' : ''}`}>
                  <i style={{ height: `${barHeight}px` }} title={`${weeklyData.days[i]}: ${v}k ETB`} />
                  {weeklyData.days[i]}
                </div>
              );
            })}
          </div>
        </div>

        {/* Game Allocation Donut */}
        <div className="card">
          <h3>Game Allocation</h3>

          {/* 3-Slice Conic Gradient Donut */}
          <div className="donut">
            <b>100%</b>
          </div>

          <div className="lg">
            <span style={{ '--c': 'var(--dark)' } as React.CSSProperties}>Prize pool</span>
            70%
          </div>

          <div className="lg">
            <span style={{ '--c': 'var(--grey)' } as React.CSSProperties}>Commission</span>
            20%
          </div>

          <div className="lg">
            <span style={{ '--c': '#cdcdd0' } as React.CSSProperties}>Jackpot</span>
            10%
          </div>

          <div className="tr" style={{ marginTop: '8px' }}>
            Example: 100 players × 50 ETB = 5,000 ETB
          </div>
        </div>
      </div>

      {/* 4. Bottom Section: Recent Transactions Table (.g1) */}
      <div className="grid g1">
        <div className="card">
          <h3>Recent Transactions</h3>

          <div className="wrap">
            <table>
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Player</th>
                  <th>Type</th>
                  <th>Method</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--mute)', padding: '24px 0' }}>
                      No recent transactions recorded.
                    </td>
                  </tr>
                ) : (
                  transactions.slice(0, 7).map((tx) => {
                    const isPending = tx.status === 'pending';
                    const isApproved = tx.status === 'approved';
                    const isRejected = tx.status === 'rejected';

                    return (
                      <tr key={tx.id}>
                        <td>{tx.referenceNumber || `#${tx.id.slice(-7)}`}</td>
                        <td>{tx.userName || tx.userId || 'Player'}</td>
                        <td>{tx.type === 'deposit' ? 'Deposit' : 'Withdrawal'}</td>
                        <td>{tx.method || 'Telebirr'}</td>
                        <td>ETB {formatNumber(tx.amount)},00</td>
                        <td>
                          <span className={`b ${isPending ? 'o' : isRejected ? 'w' : ''}`}>
                            {isApproved ? 'Paid' : isPending ? 'Pending' : 'Rejected'}
                          </span>
                        </td>
                        <td>
                          {isPending ? (
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                type="button"
                                className="k"
                                onClick={() => handleApproveTx(tx)}
                                title="Verify and credit"
                              >
                                Verify & credit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRejectTx(tx)}
                                title="Reject"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--mute)', fontSize: '12px' }}>Completed</span>
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
      </div>
    </div>
  );
};
