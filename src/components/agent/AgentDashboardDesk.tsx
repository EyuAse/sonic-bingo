import React, { useState, useEffect, useMemo } from 'react';
import { AgentDeskTab } from './AgentSidebar.tsx';
import { apiClient } from '../../services/apiClient.ts';
import '../../styles/agent-dashboard-enqu.css';

interface AgentDashboardDeskProps {
  profile: any;
  metrics: any;
  onNavigateTab: (tab: AgentDeskTab) => void;
  onRefresh: () => void;
  isLoading: boolean;
  showToast?: (msg: string) => void;
  openMobile?: () => void;
}

export const AgentDashboardDesk: React.FC<AgentDashboardDeskProps> = ({
  profile,
  metrics,
  onNavigateTab,
  onRefresh,
  isLoading,
  showToast,
  openMobile
}) => {
  // Real Analytics State directly from Neon Database
  const [analytics, setAnalytics] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  // Timeframe Tab for Deposit Activity Chart ('daily' | 'weekly' | 'monthly')
  const [activeChartTab, setActiveChartTab] = useState<'daily' | 'weekly' | 'monthly'>('weekly');

  // Modals state: null | 'rch' (Request recharge)
  const [activeModal, setActiveModal] = useState<'rch' | null>(null);

  // Clipboard copy feedback
  const [copiedLink, setCopiedLink] = useState(false);

  // Recharge Modal Form State
  const [rchAmount, setRchAmount] = useState<number | string>(5000);
  const [rchMethod, setRchMethod] = useState<'Telebirr' | 'CBE' | 'M-Pesa'>('Telebirr');
  const [rchTxCode, setRchTxCode] = useState('');
  const [rchSubmitting, setRchSubmitting] = useState(false);
  const [rchError, setRchError] = useState<string | null>(null);

  // =========================================================================
  // 1. DATA FETCHING: 100% REAL NEON POSTGRESQL ANALYTICS
  // =========================================================================
  const fetchDashboardData = async () => {
    try {
      setLoadingAnalytics(true);
      setAnalyticsError(null);
      const res = await apiClient.agent.getDashboardAnalytics();
      if (res && res.success) {
        setAnalytics(res);
      } else {
        setAnalyticsError('Could not load analytics from database.');
      }
    } catch (err: any) {
      console.error('Error fetching agent dashboard analytics:', err);
      setAnalyticsError(err?.message || 'Database connection error.');
    } finally {
      setLoadingAnalytics(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // =========================================================================
  // 2. FORMATTING HELPERS
  // =========================================================================
  const formatETB = (val: number | string | undefined | null): string => {
    const num = Number(val || 0);
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  };

  const formatShortETB = (val: number): string => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
    return val.toString();
  };

  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const getInitials = (name?: string): string => {
    if (!name) return 'AG';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  // Derive agent name, wallet, kpis from analytics (or fallback to profile/props safely)
  const agentName = analytics?.agent?.name || profile?.fullName || profile?.name || 'Agent';
  const firstName = agentName.split(' ')[0];
  const agentCode = analytics?.agent?.code || profile?.agentCode || 'AGT';
  const walletBalance = Number(analytics?.wallet?.balance ?? profile?.walletBalance ?? profile?.wallet_balance ?? 0);
  const lowThreshold = Number(analytics?.wallet?.lowThreshold ?? profile?.lowBalanceThreshold ?? 5000);
  const isLowBalance = Boolean(analytics?.wallet?.isLowBalance ?? (walletBalance <= lowThreshold));

  const openingBalance = Number(analytics?.wallet?.openingBalanceToday ?? 0);
  const depositsTodayCount = Number(analytics?.kpis?.depositsTodayCount ?? 0);
  const depositsTodayVol = Number(analytics?.kpis?.depositsTodayVolume ?? 0);
  const commission30d = Number(analytics?.kpis?.commission30Days ?? 0);
  const pendingRechargeComm = Number(analytics?.kpis?.pendingRechargeCommission ?? 0);
  const totalPlayers = Number(analytics?.kpis?.totalPlayers ?? 0);
  const newPlayers30d = Number(analytics?.kpis?.newPlayersLast30Days ?? 0);
  const pendingWithdrawals = Number(analytics?.kpis?.pendingWithdrawalsCount ?? 0);
  const pendingDepositRequests = Number(analytics?.kpis?.pendingDepositRequestsCount ?? 0);

  // Meter scale computation
  const maxMeterScale = Math.max(15000, walletBalance * 1.35, lowThreshold * 2);
  const meterFillPercent = Math.min(100, Math.max(0, (walletBalance / maxMeterScale) * 100));
  const meterPinPercent = Math.min(100, Math.max(0, (lowThreshold / maxMeterScale) * 100));

  // Referral Link
  const referralLink = analytics?.agent?.referralLink ||
    `https://t.me/SonicGameOfficialBot?start=agent_${agentCode}`;

  const handleCopyReferral = () => {
    navigator.clipboard.writeText(referralLink);
    setCopiedLink(true);
    if (showToast) {
      showToast('📋 Real referral link copied to clipboard!');
    }
    setTimeout(() => setCopiedLink(false), 2400);
  };

  // =========================================================================
  // 3. CHART METRICS CALCULATION (DYNAMIC Y-AXIS & BAR HEIGHTS)
  // =========================================================================
  const chartBars = useMemo(() => {
    if (!analytics?.charts) return [];
    const series = analytics.charts[activeChartTab] || [];
    return series;
  }, [analytics, activeChartTab]);

  const chartMaxVolume = useMemo(() => {
    if (!chartBars || chartBars.length === 0) return 2800;
    const maxVal = Math.max(...chartBars.map((b: any) => Number(b.volume || 0)));
    if (maxVal <= 0) return 2800;
    // Round up nicely to nearest 500 or 1000
    return Math.ceil((maxVal * 1.15) / 500) * 500;
  }, [chartBars]);

  // Generate 4 gridline ticks
  const gridTicks = useMemo(() => {
    return [
      { label: formatShortETB(chartMaxVolume), topPercent: 0 },
      { label: formatShortETB(Math.round(chartMaxVolume * 0.75)), topPercent: 25 },
      { label: formatShortETB(Math.round(chartMaxVolume * 0.5)), topPercent: 50 },
      { label: formatShortETB(Math.round(chartMaxVolume * 0.25)), topPercent: 75 },
      { label: '0', topPercent: 100 }
    ];
  }, [chartMaxVolume]);

  // Target Circle Progress Math
  const overallTargetPercent = Math.min(100, Math.max(0, Number(analytics?.targets?.overallPercent || 0)));
  const ringCircumference = 2 * Math.PI * 44; // 276.46
  const ringStrokeOffset = ringCircumference - (ringCircumference * (overallTargetPercent / 100));

  // Alerts
  const alertsList = analytics?.alerts || [];
  const unreadAlertsCount = alertsList.filter((a: any) => a.unread).length;

  // Recent deposits
  const recentDeposits = analytics?.recentDeposits || [];

  // =========================================================================
  // 4. MODAL ACTION HANDLERS
  // =========================================================================
  const handleOpenRechargeModal = () => {
    setRchError(null);
    setRchAmount(5000);
    setRchMethod('Telebirr');
    setRchTxCode('');
    setActiveModal('rch');
  };

  const handleCloseModal = () => {
    setActiveModal(null);
    setRchError(null);
  };

  // Submit Recharge Request
  const handleSubmitRecharge = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(rchAmount);
    if (!amt || amt < 500) {
      setRchError('Minimum wallet recharge is ETB 500.');
      return;
    }
    if (!rchTxCode.trim()) {
      setRchError('Please enter the payment confirmation transaction code / reference.');
      return;
    }

    try {
      setRchSubmitting(true);
      setRchError(null);
      const res = await apiClient.agent.requestRecharge({
        amount: amt,
        paymentMethod: rchMethod,
        transactionCode: rchTxCode.trim()
      });

      if (res && res.success) {
        if (showToast) showToast(`🚀 Recharge request for ETB ${formatETB(amt)} submitted for admin review!`);
        handleCloseModal();
        fetchDashboardData();
        onRefresh();
      } else {
        setRchError(res?.message || 'Failed to submit recharge request.');
      }
    } catch (err: any) {
      setRchError(err?.message || 'Error submitting recharge request.');
    } finally {
      setRchSubmitting(false);
    }
  };

  // =========================================================================
  // 5. RENDER MAIN LUXURY ENQU VIEW
  // =========================================================================
  return (
    <div className="enqu-agent-dashboard-root">
      {/* -------------------------------------------------------------------
          1. TOPBAR & DYNAMIC GREETING
          ------------------------------------------------------------------- */}
      <header className="enqu-topbar">
        {openMobile && (
          <button
            type="button"
            className="enqu-menu-btn"
            onClick={openMobile}
            title="Open navigation menu"
            aria-label="Open navigation menu"
          >
            ☰
          </button>
        )}
        <div>
          <h1>{getGreeting()}, {firstName}</h1>
          <div className="sub">Here is how your wallet, players and targets look today.</div>
        </div>

        <div className="sp" />

        {/* Live Wallet Chip */}
        <div className="enqu-chip" title="Current Agent Wallet Balance">
          <small>Wallet</small>
          <span>ETB {formatETB(walletBalance)}</span>
          {isLowBalance && (
            <span className="enqu-pill wn" style={{ padding: '2px 7px', fontSize: '11px', marginLeft: '2px' }}>
              Low
            </span>
          )}
        </div>

        {/* Notifications Bell */}
        <button
          type="button"
          className="enqu-bell-btn"
          aria-label="Alerts"
          onClick={() => {
            const alertsSection = document.getElementById('enqu-alerts-container');
            if (alertsSection) alertsSection.scrollIntoView({ behavior: 'smooth' });
          }}
          title={unreadAlertsCount > 0 ? `${unreadAlertsCount} unread alerts` : 'No unread alerts'}
        >
          <svg viewBox="0 0 24 24">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {unreadAlertsCount > 0 && <i>{unreadAlertsCount}</i>}
        </button>

        {/* User Initials Avatar */}
        <div className="enqu-av g" title={`${agentName} (${agentCode})`}>
          {getInitials(agentName)}
        </div>
      </header>

      {/* -------------------------------------------------------------------
          2. CONDITIONAL LOW BALANCE ALERT BANNER
          ------------------------------------------------------------------- */}
      {isLowBalance && (
        <section className="enqu-alert" role="alert">
          <div className="t">
            Low wallet balance · ETB {formatETB(walletBalance)} remaining
            <small>
              Your balance is below ETB {formatETB(lowThreshold)}. Players will experience failed cash-in deposits if float runs out.
            </small>
          </div>
          <button
            type="button"
            className="gold"
            onClick={handleOpenRechargeModal}
          >
            Top up now
          </button>
        </section>
      )}

      {/* -------------------------------------------------------------------
          3. HERO WALLET BALANCE CARD (OBSIDIAN & GOLD METALLIC GRADIENT)
          ------------------------------------------------------------------- */}
      <section className="enqu-hero">
        <div>
          <div className="enqu-k-l">AGENT WALLET BALANCE</div>
          <div className="enqu-big">
            <small>ETB</small>
            {formatETB(walletBalance)}
          </div>

          {/* Dynamic Balance Meter Bar */}
          <div className="enqu-meter" title={`Balance: ETB ${formatETB(walletBalance)}`}>
            <i style={{ width: `${meterFillPercent}%` }} />
            <b
              style={{ left: `${meterPinPercent}%` }}
              title={`Alert threshold at ETB ${formatETB(lowThreshold)}`}
            />
          </div>

          <div className="enqu-mrow">
            <span>Low-balance alert at ETB {formatETB(lowThreshold)}</span>
            <span className={`enqu-pill ${isLowBalance ? 'wn' : 'ok'}`}>
              {isLowBalance ? 'Low Float' : 'Healthy'}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="enqu-hero-btns">
            <button
              type="button"
              className="gold"
              onClick={handleOpenRechargeModal}
            >
              Request recharge
            </button>
          </div>
        </div>

        {/* Frosted Translucent Summary Pills */}
        <div className="enqu-mini">
          <div>
            <span>Opening balance today</span>
            <b>ETB {formatETB(openingBalance)}</b>
          </div>
          <div>
            <span>Deposits made today</span>
            <b>{depositsTodayCount} · ETB {formatETB(depositsTodayVol)}</b>
          </div>
          <div>
            <span>Referral Bonus, last 30 days</span>
            <b>ETB {formatETB(commission30d)}</b>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------------
          4. 4-METRIC STATS GRID
          ------------------------------------------------------------------- */}
      <div className="enqu-grid enqu-g4">
        {/* Stat 1: Deposits Today */}
        <div className="enqu-card enqu-stat">
          <div className="ic enqu-ic">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 4v12m0 0 5-5m-5 5-5-5M4 20h16" />
            </svg>
          </div>
          <div className="l">Deposits today</div>
          <div className="v">ETB {formatETB(depositsTodayVol)}</div>
          <div className="t">{depositsTodayCount} deposits recorded</div>
        </div>

        {/* Stat 2: Players */}
        <div className="enqu-card enqu-stat">
          <div className="ic enqu-ic">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div className="l">Players</div>
          <div className="v">{totalPlayers}</div>
          <div className="t">+{newPlayers30d} joined in the last 30 days</div>
        </div>

        {/* Stat 3: Pending Withdrawals */}
        <div className="enqu-card enqu-stat">
          <div className="ic enqu-ic">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 20V8m0 0 5 5m-5-5-5 5M4 4h16" />
            </svg>
          </div>
          <div className="l">Pending withdrawals</div>
          <div className="v">{pendingWithdrawals}</div>
          <div className="t">
            {pendingWithdrawals > 0 ? 'Waiting for admin staff' : 'All requests settled'}
          </div>
        </div>

        {/* Stat 4: Referral Bonus (30 days) */}
        <div className="enqu-card enqu-stat">
          <div className="ic enqu-ic">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="19" y1="5" x2="5" y2="19" />
              <circle cx="6.5" cy="6.5" r="2.5" />
              <circle cx="17.5" cy="17.5" r="2.5" />
            </svg>
          </div>
          <div className="l">Referral Bonus (30 days)</div>
          <div className="v">ETB {formatETB(commission30d)}</div>
          <div className="t">
            {pendingRechargeComm > 0
              ? `ETB ${formatETB(pendingRechargeComm)} pending on open recharges`
              : 'All referral bonuses credited'}
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------
          5. TWO-COLUMN LAYOUT (1.6fr Left : 1.0fr Right)
          ------------------------------------------------------------------- */}
      <div className="enqu-grid enqu-g2">
        {/* =================================================================
            LEFT COLUMN: DEPOSIT ACTIVITY CHART & RECENT DEPOSITS TABLE
            ================================================================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
          {/* Card: Deposit Activity Chart */}
          <section className="enqu-card">
            <h3>
              <span>Deposit activity</span>
              <div className="r">
                <div className="enqu-tabs" role="tablist">
                  <button
                    type="button"
                    className={activeChartTab === 'daily' ? 'on' : ''}
                    onClick={() => setActiveChartTab('daily')}
                  >
                    Daily
                  </button>
                  <button
                    type="button"
                    className={activeChartTab === 'weekly' ? 'on' : ''}
                    onClick={() => setActiveChartTab('weekly')}
                  >
                    Weekly
                  </button>
                  <button
                    type="button"
                    className={activeChartTab === 'monthly' ? 'on' : ''}
                    onClick={() => setActiveChartTab('monthly')}
                  >
                    Monthly
                  </button>
                </div>
              </div>
            </h3>

            {/* SVG/CSS Bar Chart with Dashed Gridlines & Striped Bars */}
            <div className="enqu-jch">
              {/* Gridlines */}
              <div className="enqu-jgl">
                {gridTicks.map((tick, idx) => (
                  <React.Fragment key={idx}>
                    <i style={{ top: `${tick.topPercent}%` }} />
                    <span style={{ top: `${tick.topPercent}%` }}>{tick.label}</span>
                  </React.Fragment>
                ))}
              </div>

              {/* Dynamic Bar Columns */}
              <div className="enqu-jbars">
                {chartBars.length === 0 ? (
                  <div className="enqu-empty" style={{ width: '100%' }}>
                    No deposit activity recorded for this period.
                  </div>
                ) : (
                  chartBars.map((bar: any, idx: number) => {
                    const vol = Number(bar.volume || 0);
                    const heightPercent = chartMaxVolume > 0
                      ? Math.min(100, Math.max(2, (vol / chartMaxVolume) * 100))
                      : 2;

                    return (
                      <div
                        key={idx}
                        className={`enqu-jcol ${bar.isCurrent ? 'h' : ''}`}
                        title={`${bar.timeRange || bar.fullDate || bar.label}: ETB ${formatETB(vol)}`}
                      >
                        <i style={{ height: `${heightPercent}%` }} />
                        <span className="enqu-jl">{bar.label}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>

          {/* Card: Recent Deposits Table */}
          <section className="enqu-card">
            <h3>
              <span>Recent deposits</span>
              <div className="r">
                <button
                  type="button"
                  style={{ fontSize: '12px', padding: '5px 11px', background: 'transparent' }}
                  onClick={() => onNavigateTab('deposit_requests')}
                >
                  View all →
                </button>
              </div>
            </h3>

            <div className="enqu-table-wrap">
              <table className="enqu-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Method</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {recentDeposits.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <div className="enqu-empty">
                          No deposit requests processed today. Incoming player requests appear in your Deposits desk for approval.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    recentDeposits.map((dep: any) => {
                      const isConfirmed = dep.status === 'approved' || dep.status === 'completed';
                      const isPending = dep.status === 'pending';
                      const isRejected = dep.status === 'rejected';

                      return (
                        <tr key={dep.id}>
                          <td>
                            <div style={{ fontWeight: 700, color: 'var(--ag-ink)' }}>
                              {dep.playerName || 'Player'}
                            </div>
                            <small>{dep.playerPhone || dep.reference || '—'}</small>
                          </td>
                          <td>
                            <span style={{ fontWeight: 600 }}>{dep.method || 'Cash'}</span>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 800 }}>
                            ETB {formatETB(dep.amount)}
                          </td>
                          <td>
                            <span
                              className={`enqu-pill ${
                                isConfirmed ? 'ok' : isPending ? 'wn' : isRejected ? 'bd' : 'gr'
                              }`}
                            >
                              {isConfirmed ? 'Confirmed' : isPending ? 'Pending' : isRejected ? 'Rejected' : dep.status}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', color: 'var(--ag-mute)', fontSize: '12.5px' }}>
                            {dep.createdAt ? new Date(dep.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* =================================================================
            RIGHT COLUMN: TARGETS GAUGE, REFERRAL LINK, LATEST ALERTS
            ================================================================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
          {/* Card: Targets, Last 30 Days */}
          <section className="enqu-card">
            <h3>
              <span>Targets, last 30 days</span>
              <div className="r">
                <span className="enqu-pill gr" style={{ fontSize: '11px', padding: '3px 8px' }}>
                  Rank #{analytics?.targets?.rank || 1} of {analytics?.targets?.totalAgents || 1}
                </span>
              </div>
            </h3>

            {/* Circular SVG Ring Gauge */}
            <div className="enqu-ring">
              <svg width="120" height="120" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                {/* Background Track */}
                <circle
                  cx="50"
                  cy="50"
                  r="44"
                  fill="none"
                  stroke="var(--ag-chip)"
                  strokeWidth="8"
                />
                {/* Progress Circle */}
                <circle
                  cx="50"
                  cy="50"
                  r="44"
                  fill="none"
                  stroke="url(#enquGoldGrad)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringStrokeOffset}
                  style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                />
                <defs>
                  <linearGradient id="enquGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--ag-gold2)" />
                    <stop offset="100%" stopColor="var(--ag-gold)" />
                  </linearGradient>
                </defs>
              </svg>

              <div className="c">
                <b>{overallTargetPercent}%</b>
                <small>overall</small>
              </div>
            </div>

            {/* 4 Target Progress Rows */}
            <div style={{ marginTop: '16px' }}>
              {(analytics?.targets?.items || [
                { label: 'Players registered', current: totalPlayers, target: 10, text: `${totalPlayers} / 10` },
                { label: 'Deposit volume', current: depositsTodayVol, target: 35000, text: `ETB ${formatETB(depositsTodayVol)} / 35k` },
                { label: 'Transactions', current: depositsTodayCount, target: 90, text: `${depositsTodayCount} / 90` },
                { label: 'Referral bonus earned', current: commission30d, target: 1500, text: `ETB ${formatETB(commission30d)} / 1,500` }
              ]).map((tg: any, idx: number) => {
                const pct = tg.target > 0 ? Math.min(100, Math.round((tg.current / tg.target) * 100)) : 0;
                return (
                  <div key={idx} className="enqu-tg-row">
                    <div className="rw">
                      <span>{tg.label}</span>
                      <span>{tg.text}</span>
                    </div>
                    <div className="enqu-pb f">
                      <i style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              className="k"
              style={{ width: '100%', marginTop: '18px', padding: '11px' }}
              onClick={() => onNavigateTab('commission')}
            >
              View performance
            </button>
          </section>

          {/* Card: 100% Real Telegram Referral Link */}
          <section className="enqu-card">
            <h3>
              <span>Your referral link</span>
            </h3>

            <div className="enqu-ref-box">
              <span title={referralLink}>{referralLink}</span>
              <button
                type="button"
                className="gold"
                onClick={handleCopyReferral}
              >
                {copiedLink ? 'Copied!' : 'Copy'}
              </button>
            </div>

            <div style={{ fontSize: '12.5px', color: 'var(--ag-mute)', lineHeight: '1.45', marginTop: '12px', fontWeight: 600 }}>
              🎁 <strong>ተጫዋቾች በቦት በቀጥታ ይመዘገባሉ</strong> — አዲስ ተጫዋቾች በቴሌግራም ሲገቡ የ 50 ብር ነፃ ቦነስ ያገኛሉ፣ ለእርስዎም ከመጀመሪያ ተቀማጭ 10% ኮሚሽን ይቆጠራል!
            </div>
          </section>

          {/* Card: Dynamic Alerts Feed */}
          <section className="enqu-card" id="enqu-alerts-container">
            <h3>
              <span>Latest alerts</span>
              <div className="r">
                <span style={{ fontSize: '12px' }}>{alertsList.length} updates</span>
              </div>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {alertsList.length === 0 ? (
                <div className="enqu-empty" style={{ padding: '20px 0' }}>
                  No active alerts. All systems healthy.
                </div>
              ) : (
                alertsList.map((alt: any) => (
                  <div
                    key={alt.id}
                    className={`enqu-nt ${alt.kind || 'm'} ${alt.unread ? 'un' : ''}`}
                  >
                    <div className="ni">
                      {alt.kind === 'w' ? '⚠️' : alt.kind === 'p' ? '💵' : 'ℹ️'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <b>{alt.title}</b>
                      <p>{alt.body}</p>
                    </div>
                    <time>{alt.time}</time>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>

      {/* -------------------------------------------------------------------
          6. PRODUCTION MODAL: REQUEST WALLET RECHARGE
          ------------------------------------------------------------------- */}
      {activeModal === 'rch' && (
        <div className="enqu-modalbg" onClick={handleCloseModal}>
          <div className="enqu-modal" onClick={(e) => e.stopPropagation()}>
            <div className="enqu-mh">
              <h3>Request wallet recharge</h3>
              <button type="button" onClick={handleCloseModal}>✕</button>
            </div>

            <p style={{ color: 'var(--ag-mute)', fontSize: '13px', margin: '4px 0 16px', fontWeight: 600 }}>
              Top up your agent float. Receive an instant <strong>upfront float bonus</strong> upon admin verification.
            </p>

            <form onSubmit={handleSubmitRecharge}>
              {/* Quick Amount Chips */}
              <label>Recharge Amount (ETB)</label>
              <div className="enqu-seg" style={{ marginBottom: '8px' }}>
                {[5000, 10000, 20000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    className={Number(rchAmount) === amt ? 'on' : ''}
                    onClick={() => setRchAmount(amt)}
                  >
                    ETB {formatETB(amt)}
                  </button>
                ))}
              </div>

              <input
                type="number"
                min="500"
                max="100000"
                step="500"
                value={rchAmount}
                onChange={(e) => setRchAmount(e.target.value)}
                required
              />

              {/* Payment Rail */}
              <label>Payment Method (Transferred to Platform)</label>
              <div className="enqu-seg">
                <button
                  type="button"
                  className={rchMethod === 'Telebirr' ? 'on' : ''}
                  onClick={() => setRchMethod('Telebirr')}
                >
                  Telebirr
                </button>
                <button
                  type="button"
                  className={rchMethod === 'CBE' ? 'on' : ''}
                  onClick={() => setRchMethod('CBE')}
                >
                  CBE Bank
                </button>
                <button
                  type="button"
                  className={rchMethod === 'M-Pesa' ? 'on' : ''}
                  onClick={() => setRchMethod('M-Pesa')}
                >
                  M-Pesa
                </button>
              </div>

              {/* Transaction Code */}
              <label>Payment Transaction Code / Reference</label>
              <input
                type="text"
                placeholder="e.g. FT26081294829 or Telebirr Trans ID"
                value={rchTxCode}
                onChange={(e) => setRchTxCode(e.target.value)}
                required
              />

              {/* Live Upfront Float Bonus Note */}
              {(() => {
                const amt = Number(rchAmount || 0);
                const comm = Math.round(amt * 0.05);
                const totalCredit = amt + comm;
                return (
                  <div className="enqu-note2">
                    <div>Recharge amount: <b>ETB {formatETB(amt)}</b></div>
                    <div>Upfront float bonus (5%): <b style={{ color: 'var(--ag-g)' }}>+ETB {formatETB(comm)}</b></div>
                    <div style={{ marginTop: '4px', borderTop: '1px solid var(--ag-line)', paddingTop: '4px' }}>
                      Total credited to wallet: <b>ETB {formatETB(totalCredit)}</b>
                    </div>
                  </div>
                );
              })()}

              {rchError && <div className="enqu-err">{rchError}</div>}

              <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
                <button
                  type="button"
                  style={{ flex: 1, padding: '12px' }}
                  onClick={handleCloseModal}
                  disabled={rchSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="gold"
                  style={{ flex: 2, padding: '12px' }}
                  disabled={rchSubmitting}
                >
                  {rchSubmitting ? 'Submitting...' : 'Submit recharge request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------
          8. FOOTER NOTE
          ------------------------------------------------------------------- */}
      <footer className="enqu-foot">
        Lomi Bingo Agent System · Real-time Neon PostgreSQL · 100% Secure Float Settlement
      </footer>
    </div>
  );
};
