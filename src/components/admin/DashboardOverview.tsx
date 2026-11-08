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
    totalAgentsCount,
    totalAgentBalance,
    activeAgentsCount,
    agentsList,
    weeklyRevenueData,
    approveAndReleaseTransaction,
    rejectTransaction,
    isSidebarCollapsed,
    toggleSidebar
  } = useAdmin();

  const { showToast } = useApp();

  const activePlayersCount = userStats?.activePlayers ?? (users.filter(u => u.status === 'active').length || users.length || 0);
  const platformRevenue = totalHouseProfit || todayHouseProfit || 0;

  // Helper number formatter
  const formatNumber = (num: number) => Number(num || 0).toLocaleString('en-US');

  // Dynamic Date Range label
  const currentDateRange = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const startStr = start.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    const endStr = end.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${startStr} - ${endStr}`;
  }, []);

  // Real 7-Day Weekly Revenue Bar Chart Data from Neon PostgreSQL
  const weeklyData = useMemo(() => {
    if (weeklyRevenueData && weeklyRevenueData.length > 0) {
      const days = weeklyRevenueData.map(d => d.day);
      const vals = weeklyRevenueData.map(d => Math.round(d.revenue));
      const maxVal = Math.max(...vals, 100);
      const todayDayIndex = weeklyRevenueData.length - 1; // Current day is the last element
      return { days, vals, maxVal, todayDayIndex };
    }
    // Fallback default days if telemetry still loading
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const vals = [0, 0, 0, 0, 0, 0, 0];
    const todayDayIndex = (new Date().getDay() + 6) % 7;
    return { days, vals, maxVal: 100, todayDayIndex };
  }, [weeklyRevenueData]);

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
            <span className="up">{TRD} Live</span> net platform profit
          </div>
        </div>

        {/* Card 2: Active Players */}
        <div className="card">
          <div className="lab">Active Players</div>
          <div className="val">{formatNumber(activePlayersCount)}</div>
          <div className="tr">
            <span className="up">{TRD} {formatNumber(totalUsersCount || users.length)}</span> registered users
          </div>
        </div>

        {/* Card 3: Total Agents (100% Real from PostgreSQL DB) */}
        <div className="card">
          <div className="lab">Total Agents</div>
          <div className="val">{formatNumber(totalAgentsCount)}</div>
          <div className="tr">
            <span className="up">{TRD} {activeAgentsCount}</span> active on network
          </div>
        </div>

        {/* Card 4: Total Agent Balances (Replacing Jackpot Vault with Real Agent Float) */}
        <div className="card">
          <div className="lab">Agent Balances</div>
          <div className="val">ETB {formatNumber(totalAgentBalance)}</div>
          <div className="tr">
            <span className="up">{TRD} Float</span> circulating cash float
          </div>
        </div>
      </div>

      {/* 3. Middle Section (.g2: 1.7fr 1fr) */}
      <div className="grid g2">
        {/* Total Revenue Bar Chart (Real Daily Data from DB) */}
        <div className="card">
          <h3>
            Total Revenue
            <span className="r lab">ETB (Last 7 Days)</span>
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
              const barHeight = Math.max(8, Math.round((v / weeklyData.maxVal) * 145));

              return (
                <div key={`${weeklyData.days[i]}-${i}`} className={`bar ${isHighlight ? 'h' : ''}`}>
                  <i style={{ height: `${barHeight}px` }} title={`${weeklyData.days[i]}: ETB ${formatNumber(v)}`} />
                  {weeklyData.days[i]}
                </div>
              );
            })}
          </div>
        </div>

        {/* Game Allocation Donut (Sonic Bingo 80/20 Math) */}
        <div className="card">
          <h3>Game Allocation</h3>

          {/* 2-Slice Conic Gradient Donut (80% Prize Pool, 20% House Fee) */}
          <div className="donut" style={{ background: 'conic-gradient(var(--dark) 0 80%, var(--grey) 80% 100%)' }}>
            <b>100%</b>
          </div>

          <div className="lg">
            <span style={{ '--c': 'var(--dark)' } as React.CSSProperties}>Prize Pool (Derash)</span>
            80%
          </div>

          <div className="lg">
            <span style={{ '--c': 'var(--grey)' } as React.CSSProperties}>House Commission</span>
            20%
          </div>

          <div className="tr" style={{ marginTop: '14px' }}>
            Formula: 80% to round winner, 20% platform cut
          </div>
        </div>
      </div>

      {/* 4. Bottom Section 1: Recent Transactions Table (.g1) */}
      <div className="grid g1">
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h3 style={{ margin: 0 }}>Recent Transactions</h3>
            <button
              type="button"
              className="p"
              onClick={() => onNavigateTab('cashier')}
              title="Open P2P Cashier Desk"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <span>Cashier Desk ({transactions.length}) →</span>
            </button>
          </div>

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
                      No recent transactions recorded in database.
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

      {/* 5. Bottom Section 2: Registered Agents & Float Balances Directory (Filling Empty Space) */}
      <div className="grid g1">
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h3 style={{ margin: 0 }}>Registered Agents & Float Balances</h3>
            <button
              type="button"
              className="p"
              onClick={() => onNavigateTab('agents')}
              title="Open full Agents Management Portal"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <span>Manage Agents Directory ({totalAgentsCount})</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="wrap">
            <table>
              <thead>
                <tr>
                  <th>Agent & Code</th>
                  <th>Phone</th>
                  <th>City / Region</th>
                  <th>Referred Players</th>
                  <th>Total Volume Deposited</th>
                  <th>Wallet Float Balance</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {agentsList.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: 'var(--mute)', padding: '24px 0' }}>
                      No agents registered yet. Use the Agents Directory tab to onboard your first P2P agent.
                    </td>
                  </tr>
                ) : (
                  agentsList.slice(0, 6).map((agent: any) => {
                    const isActive = agent.status === 'active';
                    const balance = parseFloat(agent.wallet_balance || '0');
                    const isLow = balance <= (parseFloat(agent.low_balance_threshold) || 5000);

                    return (
                      <tr key={agent.id}>
                        <td>
                          <strong>{agent.full_name || agent.name || 'Agent'}</strong>{' '}
                          <span style={{ fontSize: '11px', color: 'var(--mute)' }}>
                            ({agent.agent_code || 'AGT'})
                          </span>
                        </td>
                        <td>{agent.phone || '—'}</td>
                        <td>{agent.city || 'Addis Ababa'}</td>
                        <td>{formatNumber(agent.total_players || 0)} players</td>
                        <td>ETB {formatNumber(agent.total_volume_deposited || 0)}</td>
                        <td>
                          <strong>ETB {formatNumber(balance)}</strong>
                          {isLow && (
                            <span style={{ marginLeft: '6px', fontSize: '10px', color: 'var(--r)', fontWeight: 700 }}>
                              LOW
                            </span>
                          )}
                        </td>
                        <td>
                          <span className={`b ${isActive ? 'k' : 'w'}`}>
                            {isActive ? 'Active' : 'Suspended'}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => onNavigateTab('agents')}
                            style={{ padding: '4px 10px', fontSize: '11.5px' }}
                          >
                            Details →
                          </button>
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
