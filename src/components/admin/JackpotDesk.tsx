import React, { useState, useEffect, useMemo } from 'react';
import { apiClient } from '../../services/apiClient.ts';
import { socketService } from '../../services/socketService.ts';
import { useApp } from '../../context/AppContext.tsx';
import { getApiBase } from '../../config/env.ts';

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

interface ContributionItem {
  id: string;
  roundRef: string;
  roomId: string;
  stake: number;
  totalPot: number;
  jackpotFee: number;
  winnerPayout: number;
  winnerNames: string;
  date: string;
}

interface ContributionsData {
  kpis: {
    totalContributions: number;
    gamesCount: number;
    largestContribution: number;
    avgContribution: number;
    trendPercent: number;
    trendLabel: string;
  };
  poolBreakdown: Array<{
    roomId: string;
    stake: number;
    name: string;
    amount: number;
    sharePercent: number;
  }>;
  dailyVolume: Array<{
    date: string;
    amount: number;
  }>;
  pagination: {
    page: number;
    limit: number;
    totalRows: number;
    totalPages: number;
  };
  items: ContributionItem[];
}

interface WinnerItem {
  id: string;
  roundRef: string;
  roomId: string;
  stake: number;
  userId: string;
  winnerName: string;
  winnerPhone: string;
  telegramUsername: string | null;
  amount: number;
  ballsCount: number;
  date: string;
  status: string;
}

interface WinnersData {
  kpis: {
    totalAwarded: number;
    jackpotsPaid: number;
    largestPayout: number;
    awaitingAwardCount: number;
    awaitingAwardAmount: number;
  };
  pagination: {
    page: number;
    limit: number;
    totalRows: number;
    totalPages: number;
  };
  items: WinnerItem[];
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

  // Prize split calculator state
  const [calcStake, setCalcStake] = useState<number>(10);
  const [calcCartelas, setCalcCartelas] = useState<number>(50);

  // TAB 2: Contributions state
  const todayStr = new Date().toISOString().split('T')[0];
  const defaultFromStr = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const [conPeriod, setConPeriod] = useState<string>('month');
  const [conFrom, setConFrom] = useState<string>(defaultFromStr);
  const [conTo, setConTo] = useState<string>(todayStr);
  const [conRoomId, setConRoomId] = useState<string>('all');
  const [conPage, setConPage] = useState<number>(1);
  const [conData, setConData] = useState<ContributionsData | null>(null);
  const [conLoading, setConLoading] = useState<boolean>(false);

  // TAB 3: Winners & payouts state
  const [winRoomId, setWinRoomId] = useState<string>('all');
  const [winSearch, setWinSearch] = useState<string>('');
  const [winPage, setWinPage] = useState<number>(1);
  const [winData, setWinData] = useState<WinnersData | null>(null);
  const [winLoading, setWinLoading] = useState<boolean>(false);

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

  // Fetch contributions ledger
  const fetchContributions = async () => {
    try {
      setConLoading(true);
      const res = await apiClient.admin.getJackpotContributions({
        period: conPeriod,
        from: conPeriod === 'custom' ? conFrom : undefined,
        to: conPeriod === 'custom' ? conTo : undefined,
        roomId: conRoomId,
        page: conPage,
        limit: 25
      });
      if (res.success && res.data) {
        setConData(res.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch contributions:', err);
    } finally {
      setConLoading(false);
    }
  };

  // Fetch winners ledger
  const fetchWinners = async () => {
    try {
      setWinLoading(true);
      const res = await apiClient.admin.getJackpotWinners({
        roomId: winRoomId,
        query: winSearch,
        page: winPage,
        limit: 25
      });
      if (res.success && res.data) {
        setWinData(res.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch winners:', err);
    } finally {
      setWinLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();

    // Listen for live WebSocket jackpot updates from game engine
    const unsub = socketService.on('jackpot_update', () => {
      fetchOverview();
      if (activeTab === 'contributions') fetchContributions();
      if (activeTab === 'winners') fetchWinners();
    });

    const interval = setInterval(() => {
      fetchOverview();
      if (activeTab === 'contributions') fetchContributions();
      if (activeTab === 'winners') fetchWinners();
    }, 15000);

    return () => {
      if (typeof unsub === 'function') unsub();
      clearInterval(interval);
    };
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'contributions') {
      fetchContributions();
    }
  }, [activeTab, conPeriod, conFrom, conTo, conRoomId, conPage]);

  useEffect(() => {
    if (activeTab === 'winners') {
      fetchWinners();
    }
  }, [activeTab, winRoomId, winSearch, winPage]);

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

  // Direct CSV Downloader Helper
  const handleDownloadCSV = (type: 'contributions' | 'winners') => {
    const adminToken = localStorage.getItem('sonic_admin_token') || sessionStorage.getItem('sonic_admin_token');
    const apiBase = getApiBase();
    let url = '';
    let filename = '';

    if (type === 'contributions') {
      const q = new URLSearchParams({
        period: conPeriod,
        roomId: conRoomId,
        exportCsv: 'true'
      });
      if (conPeriod === 'custom') {
        q.set('from', conFrom);
        q.set('to', conTo);
      }
      url = `${apiBase}/admin/jackpots/contributions?${q.toString()}`;
      filename = `jackpot-contributions-${conPeriod}.csv`;
    } else {
      const q = new URLSearchParams({
        roomId: winRoomId,
        exportCsv: 'true'
      });
      if (winSearch) q.set('query', winSearch);
      url = `${apiBase}/admin/jackpots/winners?${q.toString()}`;
      filename = `jackpot-winners-payouts.csv`;
    }

    fetch(url, {
      headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : {}
    })
      .then(res => res.blob())
      .then(blob => {
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        showToast(`📥 Exported ${filename} successfully`);
      })
      .catch(err => {
        showToast(`❌ Export failed: ${err.message}`);
      });
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
        </button>
        <button
          type="button"
          className={`jackpot-nav-btn ${activeTab === 'contributions' ? 'on' : ''}`}
          onClick={() => {
            setActiveTab('contributions');
            setConPage(1);
          }}
        >
          Contributions
        </button>
        <button
          type="button"
          className={`jackpot-nav-btn ${activeTab === 'winners' ? 'on' : ''}`}
          onClick={() => {
            setActiveTab('winners');
            setWinPage(1);
          }}
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
                <span className="j-b o" style={{ background: 'rgba(255,255,255,.12)', color: '#eee', borderColor: 'rgba(255,255,255,.2)', padding: '5px 12px' }}>
                  🎰 4 Active Progressive Pools
                </span>
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
                  className={`j-card jpool ${!p.isActive ? 'off' : ''}`}
                >
                  {/* Stake Label & Status */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span className="jst">
                      <i style={{ background: dotColor }} />
                      ETB {p.stake} stake
                    </span>
                    {!p.isActive ? (
                      <span className="j-b o">Paused</span>
                    ) : p.balance >= p.target ? (
                      <span className="j-b o" style={{ color: '#047857', background: '#ecfdf5', borderColor: '#a7f3d0' }}>
                        Target Reached
                      </span>
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
                      <circle
                        cx="66"
                        cy="66"
                        r={radius}
                        fill="none"
                        stroke="#ececee"
                        strokeWidth="12"
                      />
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
                      {p.balance >= p.target ? 'Above target' : 'To reach target'}
                    </span>
                    <b>{p.balance >= p.target ? `+${(p.balance - p.target).toFixed(1)}` : distance.toFixed(1)} ETB</b>
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
                  <div style={{ marginTop: '14px' }}>
                    <button
                      type="button"
                      className="j-btn"
                      style={{ width: '100%', justifyContent: 'center' }}
                      onClick={() => {
                        setConRoomId(p.roomId);
                        setActiveTab('contributions');
                      }}
                    >
                      History
                    </button>
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

              <div className="jleg">
                <span style={{ '--c': ROOM_COLORS['room-10'] } as React.CSSProperties}>ETB 10</span>
                <span style={{ '--c': ROOM_COLORS['room-20'] } as React.CSSProperties}>ETB 20</span>
                <span style={{ '--c': ROOM_COLORS['room-50'] } as React.CSSProperties}>ETB 50</span>
                <span style={{ '--c': ROOM_COLORS['room-100'] } as React.CSSProperties}>ETB 100</span>
              </div>

              {(() => {
                const days = overview?.chart14Days || [];
                const maxVal = Math.max(...days.map(d => d.total), 50);
                const step = Math.ceil(maxVal / 4);
                const chartMax = step * 4;

                return (
                  <div className="jch">
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

      {/* =================================================================== */}
      {/* TAB 2: CONTRIBUTIONS                                                */}
      {/* =================================================================== */}
      {activeTab === 'contributions' && (
        <div>
          {/* Filter Ribbon Card */}
          <div className="j-card" style={{ marginBottom: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <div className="jackpot-nav-tabs" style={{ margin: 0, padding: '3px' }}>
                  {[
                    ['day', 'Daily'],
                    ['week', 'Weekly'],
                    ['month', 'Monthly'],
                    ['all', 'All time']
                  ].map(([pKey, pLabel]) => (
                    <button
                      key={pKey}
                      type="button"
                      className={`jackpot-nav-btn ${conPeriod === pKey ? 'on' : ''}`}
                      style={{ padding: '5px 12px', fontSize: '13px' }}
                      onClick={() => {
                        setConPeriod(pKey);
                        setConPage(1);
                      }}
                    >
                      {pLabel}
                    </button>
                  ))}
                </div>

                {/* Pool Filter Pills */}
                <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
                  {[
                    ['all', 'All pools'],
                    ['room-10', 'ETB 10'],
                    ['room-20', 'ETB 20'],
                    ['room-50', 'ETB 50'],
                    ['room-100', 'ETB 100']
                  ].map(([rId, rLabel]) => (
                    <button
                      key={rId}
                      type="button"
                      className={`j-btn ${conRoomId === rId ? 'k' : ''}`}
                      style={{ padding: '4px 10px', fontSize: '12px' }}
                      onClick={() => {
                        setConRoomId(rId);
                        setConPage(1);
                      }}
                    >
                      {rLabel}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Date Pickers */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="date"
                  className="jackpot-input"
                  value={conFrom}
                  max={todayStr}
                  onChange={e => {
                    setConFrom(e.target.value);
                    setConPeriod('custom');
                    setConPage(1);
                  }}
                  aria-label="From date"
                />
                <span style={{ fontSize: '12px', color: 'var(--j-mute)' }}>to</span>
                <input
                  type="date"
                  className="jackpot-input"
                  value={conTo}
                  max={todayStr}
                  onChange={e => {
                    setConTo(e.target.value);
                    setConPeriod('custom');
                    setConPage(1);
                  }}
                  aria-label="To date"
                />
                <button
                  type="button"
                  className="j-btn k"
                  onClick={() => handleDownloadCSV('contributions')}
                  title="Export matching contribution rows as CSV"
                >
                  <i className="fa-solid fa-download" /> Export CSV
                </button>
              </div>
            </div>
          </div>

          {/* 4 KPI Cards Strip */}
          <div className="j-grid j-g4">
            <div className="j-card d">
              <div className="j-lab">Total contributions</div>
              <div className="j-val">ETB {(conData?.kpis.totalContributions ?? 0).toLocaleString()}</div>
              <div className="j-tr">
                <span className={(conData?.kpis.trendPercent ?? 0) >= 0 ? 'j-up' : 'j-dn'}>
                  {(conData?.kpis.trendPercent ?? 0) >= 0 ? '↑' : '↓'} {Math.abs(conData?.kpis.trendPercent ?? 0)}%
                </span>{' '}
                {conData?.kpis.trendLabel || 'vs previous period'}
              </div>
            </div>

            <div className="j-card">
              <div className="j-lab">Games contributing</div>
              <div className="j-val">{conData?.kpis.gamesCount ?? 0}</div>
              <div className="j-tr">Across {conRoomId === 'all' ? '4 pools' : conRoomId}</div>
            </div>

            <div className="j-card">
              <div className="j-lab">Largest contribution</div>
              <div className="j-val">ETB {(conData?.kpis.largestContribution ?? 0).toLocaleString()}</div>
              <div className="j-tr">Single game jackpot fee</div>
            </div>

            <div className="j-card">
              <div className="j-lab">Average per game</div>
              <div className="j-val">ETB {(conData?.kpis.avgContribution ?? 0).toFixed(1)}</div>
              <div className="j-tr">Per completed round</div>
            </div>
          </div>

          {/* Two-Column Analytics: Left Volume Chart, Right Breakdown by Pool */}
          <div className="j-grid j-g2" style={{ alignItems: 'start' }}>
            {/* Daily Volume Bar Chart */}
            <div className="j-card">
              <h3>
                Contribution volume timeline
                <span className="r j-tr">By date · ETB</span>
              </h3>
              {(() => {
                const vol = conData?.dailyVolume || [];
                const maxAmt = Math.max(...vol.map(v => v.amount), 50);

                if (vol.length === 0) {
                  return <div className="jempty">No contributions recorded for this timeframe.</div>;
                }

                return (
                  <div className="jch" style={{ height: '180px' }}>
                    <div className="jgl">
                      {[1, 0.5, 0].map((frac, idx) => (
                        <React.Fragment key={idx}>
                          <i style={{ top: `${(1 - frac) * 100}%` }} />
                          <span style={{ top: `${(1 - frac) * 100}%` }}>{Math.round(maxAmt * frac)}</span>
                        </React.Fragment>
                      ))}
                    </div>
                    <div className="jbars">
                      {vol.map(v => {
                        const hPct = Math.min(100, (v.amount / maxAmt) * 100);
                        const dayLabel = v.date.split('-').slice(1).join('/');
                        return (
                          <div key={v.date} className="jcol" title={`${v.date}: ETB ${v.amount.toFixed(1)}`}>
                            <div className="st" style={{ height: `${Math.max(hPct, 3)}%`, background: '#e6a21f' }} />
                            <span className="jl">{dayLabel}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Breakdown by Pool */}
            <div className="j-card">
              <h3>Share by pool</h3>
              {(conData?.poolBreakdown || []).map(b => (
                <div key={b.roomId} className="jrow" style={{ margin: '14px 0' }}>
                  <span className="jn" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i style={{ width: '8px', height: '8px', borderRadius: '50%', background: ROOM_COLORS[b.roomId] }} />
                    {b.name}
                  </span>
                  <div className="jtk">
                    <i style={{ width: `${b.sharePercent}%`, background: ROOM_COLORS[b.roomId] }} />
                  </div>
                  <span className="jv">{b.amount.toLocaleString()} ETB ({b.sharePercent}%)</span>
                </div>
              ))}
            </div>
          </div>

          {/* Contributions Audit Ledger Table */}
          <div className="j-card" style={{ marginTop: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0 }}>Contribution history ledger</h3>
              <span className="j-tr">
                Showing {conData?.items.length ?? 0} of {conData?.pagination.totalRows ?? 0} records
              </span>
            </div>

            {conLoading ? (
              <div className="jempty">Loading contributions ledger from database...</div>
            ) : (conData?.items || []).length === 0 ? (
              <div className="jempty">No contribution transactions found for the selected filter.</div>
            ) : (
              <div className="j-wrap">
                <table className="jackpot-table">
                  <thead>
                    <tr>
                      <th>Date / Time</th>
                      <th>Round Reference</th>
                      <th>Stake Room</th>
                      <th>Total Pot</th>
                      <th>Jackpot Fee (10%)</th>
                      <th>Winner Payout</th>
                      <th>Winner(s)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(conData?.items || []).map(item => (
                      <tr key={item.id} className="jr">
                        <td style={{ color: 'var(--j-mute)', fontSize: '12.5px' }}>
                          {new Date(item.date).toLocaleString()}
                        </td>
                        <td>
                          <span className="j-b k" style={{ fontSize: '11.5px', padding: '2px 8px' }}>
                            {item.roundRef}
                          </span>
                        </td>
                        <td>
                          <span className="jst" style={{ fontSize: '13px' }}>
                            <i style={{ background: ROOM_COLORS[item.roomId] || '#888' }} />
                            ETB {item.stake} stake
                          </span>
                        </td>
                        <td>{item.totalPot.toLocaleString()} ETB</td>
                        <td style={{ color: '#e6a21f', fontWeight: 800 }}>
                          +{item.jackpotFee.toLocaleString()} ETB
                        </td>
                        <td style={{ color: '#2e9e4f' }}>
                          {item.winnerPayout.toLocaleString()} ETB
                        </td>
                        <td style={{ color: 'var(--j-ink)' }}>{item.winnerNames}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {conData && conData.pagination.totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--j-line)' }}>
                <span className="j-tr">
                  Page {conData.pagination.page} of {conData.pagination.totalPages}
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    className="j-btn"
                    disabled={conData.pagination.page <= 1}
                    onClick={() => setConPage(p => Math.max(1, p - 1))}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="j-btn"
                    disabled={conData.pagination.page >= conData.pagination.totalPages}
                    onClick={() => setConPage(p => p + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: WINNERS & PAYOUTS                                            */}
      {/* =================================================================== */}
      {activeTab === 'winners' && (
        <div>
          {/* 4 KPI Cards Strip */}
          <div className="j-grid j-g4">
            <div className="j-card d">
              <div className="j-lab">Total awarded</div>
              <div className="j-val">ETB {(winData?.kpis.totalAwarded ?? 0).toLocaleString()}</div>
              <div className="j-tr">Since platform inception</div>
            </div>

            <div className="j-card">
              <div className="j-lab">Jackpots paid</div>
              <div className="j-val">{winData?.kpis.jackpotsPaid ?? 0}</div>
              <div className="j-tr">Across 4 stake pools</div>
            </div>

            <div className="j-card">
              <div className="j-lab">Largest payout</div>
              <div className="j-val">ETB {(winData?.kpis.largestPayout ?? 0).toLocaleString()}</div>
              <div className="j-tr">Single jackpot strike</div>
            </div>

            <div className="j-card">
              <div className="j-lab">Awaiting award</div>
              <div className="j-val">{winData?.kpis.awaitingAwardCount ?? 0}</div>
              <div className="j-tr">
                {(winData?.kpis.awaitingAwardAmount ?? 0) > 0
                  ? `ETB ${(winData?.kpis.awaitingAwardAmount ?? 0).toLocaleString()} ready`
                  : 'Nothing pending'}
              </div>
            </div>
          </div>

          {/* Table Container Card */}
          <div className="j-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
              <h3 style={{ margin: 0 }}>
                Jackpot winners &amp; payouts
              </h3>
              <button
                type="button"
                className="j-btn k"
                onClick={() => handleDownloadCSV('winners')}
              >
                <i className="fa-solid fa-download" /> Export CSV
              </button>
            </div>

            {/* Filter Tabs & Search Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[
                  ['all', 'All pools'],
                  ['room-10', 'ETB 10'],
                  ['room-20', 'ETB 20'],
                  ['room-50', 'ETB 50'],
                  ['room-100', 'ETB 100']
                ].map(([rId, rLabel]) => (
                  <button
                    key={rId}
                    type="button"
                    className={`j-btn ${winRoomId === rId ? 'k' : ''}`}
                    onClick={() => {
                      setWinRoomId(rId);
                      setWinPage(1);
                    }}
                  >
                    {rLabel}
                  </button>
                ))}
              </div>

              <div style={{ flex: 1, maxWidth: '320px', minWidth: '180px' }}>
                <input
                  type="text"
                  className="jackpot-input"
                  style={{ width: '100%' }}
                  placeholder="Search winner name, phone, or round ref..."
                  value={winSearch}
                  onChange={e => {
                    setWinSearch(e.target.value);
                    setWinPage(1);
                  }}
                />
              </div>
            </div>

            {/* Winners Table */}
            {winLoading ? (
              <div className="jempty">Loading winners ledger from database...</div>
            ) : (winData?.items || []).length === 0 ? (
              <div className="jempty">No jackpot payouts found matching the filter criteria.</div>
            ) : (
              <div className="j-wrap">
                <table className="jackpot-table">
                  <thead>
                    <tr>
                      <th>Date / Game Ref</th>
                      <th>Pool / Stake</th>
                      <th>Winner</th>
                      <th>Jackpot Prize</th>
                      <th>Strike Condition</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(winData?.items || []).map(w => (
                      <tr key={w.id} className="jr">
                        <td>
                          <div style={{ fontWeight: 700 }}>{w.roundRef}</div>
                          <small style={{ color: 'var(--j-mute)', fontSize: '11px' }}>
                            {new Date(w.date).toLocaleString()}
                          </small>
                        </td>
                        <td>
                          <span className="jst" style={{ fontSize: '13px' }}>
                            <i style={{ background: ROOM_COLORS[w.roomId] || '#888' }} />
                            ETB {w.stake} stake
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700 }}>{w.winnerName}</div>
                          <small style={{ color: 'var(--j-mute)', fontSize: '12px' }}>
                            {w.winnerPhone} {w.telegramUsername && `(${w.telegramUsername})`}
                          </small>
                        </td>
                        <td style={{ color: '#2e9e4f', fontWeight: 800, fontSize: '14.5px' }}>
                          ETB {w.amount.toLocaleString()}
                        </td>
                        <td>
                          <span className="j-b o" style={{ color: '#b91c1c', borderColor: '#fca5a5', background: '#fef2f2', fontSize: '11.5px' }}>
                            ⚡ {w.ballsCount} Balls Strike
                          </span>
                        </td>
                        <td>
                          <span className="j-b" style={{ background: '#2e9e4f', fontSize: '11.5px' }}>
                            {w.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {winData && winData.pagination.totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--j-line)' }}>
                <span className="j-tr">
                  Page {winData.pagination.page} of {winData.pagination.totalPages} ({winData.pagination.totalRows} total)
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    className="j-btn"
                    disabled={winData.pagination.page <= 1}
                    onClick={() => setWinPage(p => Math.max(1, p - 1))}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="j-btn"
                    disabled={winData.pagination.page >= winData.pagination.totalPages}
                    onClick={() => setWinPage(p => p + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
