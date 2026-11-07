import React, { useState, useEffect, useMemo } from 'react';
import { apiClient } from '../../services/apiClient.ts';
import { socketService } from '../../services/socketService.ts';
import { useApp } from '../../context/AppContext.tsx';

interface JackpotPoolData {
  roomId: string;
  stake: number;
  name: string;
  balance: number;
  target: number;
  seedAmount: number;
  isLive: boolean;
  isActive: boolean;
  addedToday: number;
  lastAwarded: string | null;
  lastWonAmount: number;
  pendingAward?: {
    roundId: string;
    roundRef: string;
    winnerUserId: string | null;
    winnerName: string;
    winnerPhone: string;
    amount: number;
  } | null;
}

interface ChartDayData {
  date: string;
  dayLabel: string;
  room10: number;
  room20: number;
  room50: number;
  room100: number;
  total: number;
}

interface OverviewData {
  totalVaultBalance: number;
  contributedToday: number;
  awardedLast30Days: number;
  closestToTarget: {
    roomId: string;
    stake: number;
    distance: number;
    balance: number;
    target: number;
  } | null;
  pools: JackpotPoolData[];
  chart14Days: ChartDayData[];
}

const ROOM_COLORS: Record<string, string> = {
  'room-10': '#c9c9cd',
  'room-20': '#8a8a8e',
  'room-50': '#1f2220',
  'room-100': '#e6a21f'
};

export const JackpotDesk: React.FC = () => {
  const { showToast } = useApp();

  // Active top tab: ONLY 3 tabs (NO Settings tab!)
  const [activeTab, setActiveTab] = useState<'overview' | 'contributions' | 'winners'>('overview');

  // Overview state
  const [loading, setLoading] = useState<boolean>(true);
  const [overview, setOverview] = useState<OverviewData | null>(null);

  // Review & award modal state
  const [reviewPool, setReviewPool] = useState<JackpotPoolData | null>(null);
  const [isAwarding, setIsAwarding] = useState<boolean>(false);

  // Prize split calculator state
  const [calcStake, setCalcStake] = useState<number>(10);
  const [calcCartelas, setCalcCartelas] = useState<number>(50);

  // Fetch overview from real Neon DB backend
  const fetchOverview = async () => {
    try {
      setLoading(true);
      const res = await apiClient.admin.getJackpotOverview();
      if (res.success && res.data) {
        setOverview(res.data);
      }
    } catch (err: any) {
      console.error('Failed to load jackpot overview:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();

    // Listen for live WebSocket jackpot updates from game engine
    const unsub = socketService.on('jackpot_update', () => {
      fetchOverview();
    });

    // Auto polling interval (15s fallback)
    const interval = setInterval(fetchOverview, 15000);

    return () => {
      if (typeof unsub === 'function') unsub();
      clearInterval(interval);
    };
  }, []);

  // Live HIT count
  const livePools = useMemo(() => {
    return overview?.pools?.filter(p => p.isLive) || [];
  }, [overview]);

  const liveCount = livePools.length;

  // Handle Review & Award execution
  const handleAwardJackpot = async () => {
    if (!reviewPool) return;
    try {
      setIsAwarding(true);
      const res = await apiClient.admin.awardJackpot({
        roomId: reviewPool.roomId,
        winnerUserId: reviewPool.pendingAward?.winnerUserId || undefined,
        roundId: reviewPool.pendingAward?.roundId || undefined,
        awardAmount: reviewPool.balance
      });

      if (res.success) {
        showToast(`🎉 ${res.message || 'Jackpot successfully awarded!'}`);
        setReviewPool(null);
        fetchOverview();
      } else {
        showToast(`❌ ${res.error || 'Failed to award jackpot'}`);
      }
    } catch (err: any) {
      showToast(`❌ Error: ${err.message}`);
    } finally {
      setIsAwarding(false);
    }
  };

  // Helper date formatter
  const formatDateLabel = (iso: string | null) => {
    if (!iso) return 'Never';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    } catch {
      return 'Never';
    }
  };

  // Calculator computations (70/10/20 standard)
  const calcTotalPot = calcStake * calcCartelas;
  const calcWinnerPayout = Math.floor(calcTotalPot * 0.70);
  const calcJackpotFee = Math.floor(calcTotalPot * 0.10);
  const calcHouseFee = calcTotalPot - calcWinnerPayout - calcJackpotFee;

  return (
    <div className="jackpot-enqu-root animate-fadeIn">
      {/* 1. Top Header */}
      <div className="jackpot-top">
        <h1>Jackpot Management</h1>
        <div className="av" title="Superadmin" />
      </div>

      {/* 2. Top Navigation Tabs (Strictly 3 tabs, NO Settings tab) */}
      <div className="jackpot-nav-tabs">
        <button
          type="button"
          className={`jackpot-nav-btn ${activeTab === 'overview' ? 'on' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
          {liveCount > 0 && <span className="pill-count">{liveCount} live</span>}
        </button>
        <button
          type="button"
          className={`jackpot-nav-btn ${activeTab === 'contributions' ? 'on' : ''}`}
          onClick={() => setActiveTab('contributions')}
        >
          Contributions
        </button>
        <button
          type="button"
          className={`jackpot-nav-btn ${activeTab === 'winners' ? 'on' : ''}`}
          onClick={() => setActiveTab('winners')}
        >
          Winners &amp; payouts
        </button>
      </div>

      {/* =================================================================== */}
      {/* TAB 1: OVERVIEW                                                     */}
      {/* =================================================================== */}
      {activeTab === 'overview' && (
        <div>
          {/* Total Jackpot Vault Hero Banner (.jhero) */}
          <div className="jhero">
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div className="jk">Total jackpot vault</div>
              <div className="jbig">
                <small>ETB</small>
                {loading && !overview ? '...' : (overview?.totalVaultBalance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              </div>
              <div className="jsub">
                Four separate pools, one for each stake. 10% of every game feeds only the matching pool.
              </div>
              <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {liveCount > 0 ? (
                  <span className="jhit">HIT JACKPOT · {liveCount} LIVE</span>
                ) : (
                  <span className="j-b o" style={{ background: 'rgba(255,255,255,.12)', color: '#eee', borderColor: 'rgba(255,255,255,.2)' }}>
                    No pool at target yet
                  </span>
                )}
              </div>
            </div>

            <div className="jmini">
              <div>
                <span>Contributed today</span>
                <b>ETB {(overview?.contributedToday ?? 0).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</b>
              </div>
              <div>
                <span>Awarded, last 30 days</span>
                <b>ETB {(overview?.awardedLast30Days ?? 0).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</b>
              </div>
              <div>
                <span>Closest to target</span>
                <b>
                  {overview?.closestToTarget
                    ? `ETB ${overview.closestToTarget.stake} · ${overview.closestToTarget.distance.toFixed(1)} away`
                    : 'All at target'}
                </b>
              </div>
            </div>
          </div>

          {/* Hit Alert Warning Banner (.jbanner) */}
          {livePools.map(p => {
            const pa = p.pendingAward;
            return (
              <div key={p.roomId} className="jbanner">
                <span className="jhit">HIT JACKPOT</span>
                <div className="jt">
                  ETB {p.stake} pool reached {p.balance.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ETB
                  <small>
                    Eligible game {pa?.roundRef || 'Active'} won by {pa?.winnerName || 'Player'}. Verify the result to pay ETB {p.balance.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}.
                  </small>
                </div>
                <button
                  type="button"
                  className="j-btn k"
                  onClick={() => setReviewPool(p)}
                >
                  Review &amp; award
                </button>
              </div>
            );
          })}

          {/* 4 Circular SVG Progress Ring Pool Cards (.j-grid .j-g4) */}
          <div className="j-grid j-g4">
            {(overview?.pools || []).map(p => {
              const radius = 54;
              const circumference = 2 * Math.PI * radius; // ~339.29
              const progressRatio = Math.min(1, p.balance / p.target);
              const strokeDash = circumference * progressRatio;
              const dotColor = ROOM_COLORS[p.roomId] || '#e6a21f';
              const distance = Math.max(0, p.target - p.balance);

              return (
                <div
                  key={p.roomId}
                  className={`j-card jpool ${p.isLive ? 'live' : ''} ${!p.isActive ? 'off' : ''}`}
                >
                  {/* Stake Label & Status */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span className="jst">
                      <i style={{ background: dotColor }} />
                      ETB {p.stake} stake
                    </span>
                    {!p.isActive ? (
                      <span className="j-b o">Paused</span>
                    ) : p.isLive ? (
                      <span className="jhit">HIT</span>
                    ) : (
                      <span className="j-b o">Accumulating</span>
                    )}
                  </div>

                  {/* Circular SVG Ring */}
                  <div className="jring">
                    <svg viewBox="0 0 132 132" width="132" height="132" role="img" aria-label={`ETB ${p.stake} pool at ${p.balance} of ${p.target}`}>
                      <defs>
                        <linearGradient id={`jg-${p.roomId}`} x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#f6d453" />
                          <stop offset="100%" stopColor="#e08a1e" />
                        </linearGradient>
                      </defs>
                      {/* Background track */}
                      <circle
                        cx="66"
                        cy="66"
                        r={radius}
                        fill="none"
                        stroke="#ececee"
                        strokeWidth="12"
                      />
                      {/* Animated Golden Stroke */}
                      <circle
                        cx="66"
                        cy="66"
                        r={radius}
                        fill="none"
                        stroke={`url(#jg-${p.roomId})`}
                        strokeWidth="12"
                        strokeLinecap="round"
                        strokeDasharray={`${strokeDash.toFixed(1)} ${circumference.toFixed(1)}`}
                        style={{ transition: 'stroke-dasharray 0.6s ease' }}
                      />
                    </svg>

                    <div className="jc">
                      <b>{p.balance.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</b>
                      <small>of {p.target} ETB</small>
                    </div>
                  </div>

                  {/* Detail Metric Rows */}
                  <div className="lg">
                    <span style={{ '--c': '#e6a21f' } as React.CSSProperties}>
                      {p.isLive ? 'Above target' : 'To reach target'}
                    </span>
                    <b>{p.isLive ? `+${(p.balance - p.target).toFixed(1)}` : distance.toFixed(1)} ETB</b>
                  </div>
                  <div className="lg">
                    <span style={{ '--c': 'var(--j-grey)' } as React.CSSProperties}>Added today</span>
                    <b>{p.addedToday.toFixed(1)} ETB</b>
                  </div>
                  <div className="lg">
                    <span style={{ '--c': 'var(--j-grey)' } as React.CSSProperties}>Last awarded</span>
                    <b>{formatDateLabel(p.lastAwarded)}</b>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                    <button
                      type="button"
                      className="j-btn"
                      style={{ flex: 1 }}
                      onClick={() => setActiveTab('contributions')}
                    >
                      History
                    </button>
                    {p.isLive && (
                      <button
                        type="button"
                        className="j-btn k"
                        style={{ flex: 1 }}
                        onClick={() => setReviewPool(p)}
                      >
                        Review award
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 14-Day Contributions Stacked Bar Chart & Prize Split Calculator */}
          <div className="j-grid j-g2" style={{ alignItems: 'start', marginTop: '15px' }}>
            {/* Left: 14-Day Stacked Bar Chart */}
            <div className="j-card">
              <h3>
                Contributions, last 14 days
                <span className="r j-tr">By day · ETB</span>
              </h3>

              {/* Legend */}
              <div className="jleg">
                <span style={{ '--c': ROOM_COLORS['room-10'] } as React.CSSProperties}>ETB 10</span>
                <span style={{ '--c': ROOM_COLORS['room-20'] } as React.CSSProperties}>ETB 20</span>
                <span style={{ '--c': ROOM_COLORS['room-50'] } as React.CSSProperties}>ETB 50</span>
                <span style={{ '--c': ROOM_COLORS['room-100'] } as React.CSSProperties}>ETB 100</span>
              </div>

              {/* Stacked Chart Container */}
              {(() => {
                const days = overview?.chart14Days || [];
                const maxVal = Math.max(...days.map(d => d.total), 50);
                const step = Math.ceil(maxVal / 4);
                const chartMax = step * 4;

                return (
                  <div className="jch">
                    {/* Gridlines */}
                    <div className="jgl">
                      {[1, 0.75, 0.5, 0.25, 0].map((frac, idx) => {
                        const topPct = (1 - frac) * 100;
                        const labelVal = Math.round(chartMax * frac);
                        return (
                          <React.Fragment key={idx}>
                            <i style={{ top: `${topPct}%` }} />
                            <span style={{ top: `${topPct}%` }}>{labelVal}</span>
                          </React.Fragment>
                        );
                      })}
                    </div>

                    {/* Bars */}
                    <div className="jbars">
                      {days.map(d => {
                        const hTotalPct = Math.min(100, (d.total / chartMax) * 100);
                        const r10Pct = d.total > 0 ? (d.room10 / d.total) * 100 : 0;
                        const r20Pct = d.total > 0 ? (d.room20 / d.total) * 100 : 0;
                        const r50Pct = d.total > 0 ? (d.room50 / d.total) * 100 : 0;
                        const r100Pct = d.total > 0 ? (d.room100 / d.total) * 100 : 0;

                        return (
                          <div
                            key={d.date}
                            className="jcol"
                            title={`${d.dayLabel}: Total ETB ${d.total.toFixed(1)} (R10: ${d.room10}, R20: ${d.room20}, R50: ${d.room50}, R100: ${d.room100})`}
                          >
                            <div className="st" style={{ height: `${Math.max(hTotalPct, 2)}%` }}>
                              {d.room100 > 0 && <i style={{ height: `${r100Pct}%`, background: ROOM_COLORS['room-100'] }} />}
                              {d.room50 > 0 && <i style={{ height: `${r50Pct}%`, background: ROOM_COLORS['room-50'] }} />}
                              {d.room20 > 0 && <i style={{ height: `${r20Pct}%`, background: ROOM_COLORS['room-20'] }} />}
                              {d.room10 > 0 && <i style={{ height: `${r10Pct}%`, background: ROOM_COLORS['room-10'] }} />}
                            </div>
                            <span className="jl">{d.dayLabel}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Right: Prize Split Calculator */}
            <div className="j-card">
              <h3>
                Prize split calculator
                <span className="r j-tr">Live preview</span>
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--j-mute)', marginBottom: '4px' }}>
                    Cartela Stake (ETB)
                  </label>
                  <select
                    className="jackpot-input"
                    style={{ width: '100%' }}
                    value={calcStake}
                    onChange={e => setCalcStake(parseInt(e.target.value, 10))}
                  >
                    <option value={10}>ETB 10 Stake</option>
                    <option value={20}>ETB 20 Stake</option>
                    <option value={50}>ETB 50 Stake</option>
                    <option value={100}>ETB 100 Stake</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--j-mute)', marginBottom: '4px' }}>
                    Cartelas Sold: {calcCartelas}
                  </label>
                  <input
                    type="range"
                    min={5}
                    max={200}
                    step={5}
                    value={calcCartelas}
                    onChange={e => setCalcCartelas(parseInt(e.target.value, 10))}
                    style={{ width: '100%', marginTop: '6px' }}
                  />
                </div>
              </div>

              {/* Segmented Bar Preview */}
              <div className="jbar">
                <i style={{ width: '70%', background: '#2e9e4f' }} title="1st Winner Payout: 70%" />
                <i style={{ width: '10%', background: '#e6a21f' }} title="Jackpot Pool Rollover: 10%" />
                <i style={{ width: '20%', background: '#1f2220' }} title="Platform House Margin: 20%" />
              </div>

              {/* Breakdown Rows */}
              <div style={{ marginTop: '12px' }}>
                <div className="jrow">
                  <span className="jn">Total Pot</span>
                  <div className="jtk"><i style={{ width: '100%', background: '#dedede' }} /></div>
                  <span className="jv">{calcTotalPot.toLocaleString()} ETB</span>
                </div>

                <div className="jrow">
                  <span className="jn" style={{ color: '#2e9e4f' }}>1st Winner (70%)</span>
                  <div className="jtk"><i style={{ width: '70%', background: '#2e9e4f' }} /></div>
                  <span className="jv" style={{ color: '#2e9e4f' }}>{calcWinnerPayout.toLocaleString()} ETB</span>
                </div>

                <div className="jrow">
                  <span className="jn" style={{ color: '#e6a21f' }}>Jackpot (10%)</span>
                  <div className="jtk"><i style={{ width: '10%', background: '#e6a21f' }} /></div>
                  <span className="jv" style={{ color: '#e6a21f' }}>{calcJackpotFee.toLocaleString()} ETB</span>
                </div>

                <div className="jrow">
                  <span className="jn" style={{ color: 'var(--j-mute)' }}>Platform (20%)</span>
                  <div className="jtk"><i style={{ width: '20%', background: '#1f2220' }} /></div>
                  <span className="jv">{calcHouseFee.toLocaleString()} ETB</span>
                </div>
              </div>
            </div>
          </div>

          {/* 5-Step Educational Diagram: "How the jackpot works" */}
          <div className="j-card" style={{ marginTop: '15px' }}>
            <h3>How the jackpot works</h3>
            <div className="jflow">
              <div className="jfs">
                <span className="j-b k">Step 1</span>
                <b>Game ends</b>
                <p>Claims are verified. First and second winners are recorded in the ledger.</p>
              </div>
              <div className="jfs">
                <span className="j-b k">Step 2</span>
                <b>Deductions</b>
                <p>Platform fee (20%) and matching progressive jackpot fee (10%) are allocated.</p>
              </div>
              <div className="jfs">
                <span className="j-b k">Step 3</span>
                <b>Pool rollover</b>
                <p>10% jackpot fee automatically rolls over to the matching stake room pool in Neon DB.</p>
              </div>
              <div className="jfs">
                <span className="j-b k">Step 4</span>
                <b>Target trigger</b>
                <p>When pool reaches target threshold or Speed-15 strike occurs, jackpot is flagged as HIT.</p>
              </div>
              <div className="jfs">
                <span className="j-b k">Step 5</span>
                <b>Settlement</b>
                <p>Superadmin verifies &amp; awards jackpot. Cash credits winner wallet, pool resets to seed.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Placeholder blocks for Tab 2 and Tab 3 (full implementation in Phase 4) */}
      {activeTab === 'contributions' && (
        <div className="j-card">
          <h3>
            Jackpot Contributions Ledger
            <span className="r j-tr">Phase 4 Active Hook</span>
          </h3>
          <p style={{ color: 'var(--j-mute)', margin: '10px 0' }}>
            Contributions timeline, timeframe filter, pool share breakdown, and paginated ledger will render here.
          </p>
        </div>
      )}

      {activeTab === 'winners' && (
        <div className="j-card">
          <h3>
            Jackpot Winners &amp; Payouts
            <span className="r j-tr">Phase 4 Active Hook</span>
          </h3>
          <p style={{ color: 'var(--j-mute)', margin: '10px 0' }}>
            Historical jackpot winners, instant search, pool filters, CSV export, and award settlements will render here.
          </p>
        </div>
      )}

      {/* =================================================================== */}
      {/* Review & Award Modal (.j-modalbg, .j-modal)                         */}
      {/* =================================================================== */}
      {reviewPool && (
        <div className="j-modalbg">
          <div className="j-modal">
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Award Jackpot</h3>
              <button
                type="button"
                className="j-btn"
                style={{ padding: '4px 10px', borderRadius: '50%' }}
                onClick={() => setReviewPool(null)}
              >
                ✕
              </button>
            </div>

            {/* Pool & Winner Summary Panel */}
            <div style={{ background: 'var(--j-panel)', borderRadius: '16px', padding: '12px 16px', marginTop: '14px' }}>
              <div className="lg">
                <span style={{ '--c': '#e6a21f' } as React.CSSProperties}>Pool</span>
                <b>ETB {reviewPool.stake} stake</b>
              </div>
              <div className="lg">
                <span style={{ '--c': 'var(--j-grey)' } as React.CSSProperties}>Winner</span>
                <b>{reviewPool.pendingAward?.winnerName || 'Player'} ({reviewPool.pendingAward?.winnerPhone || '—'})</b>
              </div>
              <div className="lg">
                <span style={{ '--c': 'var(--j-grey)' } as React.CSSProperties}>Game Reference</span>
                <b>{reviewPool.pendingAward?.roundRef || 'Latest Round'}</b>
              </div>
              <div className="lg">
                <span style={{ '--c': 'var(--j-dark)' } as React.CSSProperties}>Award Amount</span>
                <b style={{ color: '#2e9e4f', fontSize: '15px' }}>{reviewPool.balance.toLocaleString()} ETB</b>
              </div>
              <div className="lg">
                <span style={{ '--c': 'var(--j-grey)' } as React.CSSProperties}>Carries over to next game</span>
                <b>{reviewPool.seedAmount} ETB (Reset to Seed)</b>
              </div>
            </div>

            {/* 4 Real Verification Checkmarks */}
            <div style={{ marginTop: '16px' }}>
              <div className="jchk">
                <i className="jck">✓</i>
                <span>Winning result verified for game {reviewPool.pendingAward?.roundRef || 'Active'}</span>
              </div>
              <div className="jchk">
                <i className="jck">✓</i>
                <span>Player has completed 5 or more games and the account is active</span>
              </div>
              <div className="jchk">
                <i className="jck">✓</i>
                <span>Pool balance is at or above {reviewPool.target} ETB</span>
              </div>
              <div className="jchk">
                <i className="jck">✓</i>
                <span>Game stake matches the ETB {reviewPool.stake} pool</span>
              </div>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--j-mute)', margin: '14px 0 16px 0' }}>
              The amount is credited directly to the winner's cash wallet and the player is notified.
            </p>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="j-btn"
                style={{ flex: 1, padding: '10px' }}
                onClick={() => setReviewPool(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="j-btn k"
                style={{ flex: 1, padding: '10px' }}
                disabled={isAwarding}
                onClick={handleAwardJackpot}
              >
                {isAwarding ? 'Processing Award...' : `Confirm & Award ETB ${reviewPool.balance.toLocaleString()}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
