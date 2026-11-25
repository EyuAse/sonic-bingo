import React, { useState, useEffect, useCallback } from 'react';
import { useAdmin } from '../../context/AdminContext.tsx';
import { useApp } from '../../context/AppContext.tsx';
import { apiClient } from '../../services/apiClient.ts';

interface KenoAdminDeskProps {
  view: 'dashboard' | 'ledger';
  onNavigateView?: (tab: 'keno-dashboard' | 'keno-ledger') => void;
}

type PeriodType = 'today' | 'yesterday' | 'week' | 'month' | 'all';

const fmtETB = (n: number) =>
  Number(n || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

const fmtInt = (n: number) => Number(n || 0).toLocaleString('en-US');

const fmtTime = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

export const KenoAdminDesk: React.FC<KenoAdminDeskProps> = ({ view, onNavigateView }) => {
  const { isSidebarCollapsed, toggleSidebar } = useAdmin();
  const { showToast } = useApp();

  // Dashboard State
  const [period, setPeriod] = useState<PeriodType>('today');
  const [isLoadingOverview, setIsLoadingOverview] = useState(true);
  const [isTogglingPause, setIsTogglingPause] = useState(false);
  const [snapshot, setSnapshot] = useState<any>(null);
  const [kpis, setKpis] = useState<any>(null);
  const [recentRounds, setRecentRounds] = useState<any[]>([]);

  // Ledger State
  const [ledgerTab, setLedgerTab] = useState<'rounds' | 'tickets'>('tickets');
  const [searchQuery, setSearchQuery] = useState('');
  const [ticketStatusFilter, setTicketStatusFilter] = useState<'all' | 'won' | 'lost' | 'active'>('all');
  const [ticketFundingFilter, setTicketFundingFilter] = useState<'all' | 'cash' | 'bonus'>('all');
  const [roundsPage, setRoundsPage] = useState(1);
  const [roundsTotalPages, setRoundsTotalPages] = useState(1);
  const [roundsList, setRoundsList] = useState<any[]>([]);
  const [isLoadingRounds, setIsLoadingRounds] = useState(false);

  const [ticketsPage, setTicketsPage] = useState(1);
  const [ticketsTotalPages, setTicketsTotalPages] = useState(1);
  const [ticketsList, setTicketsList] = useState<any[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);

  const loadOverview = useCallback(async () => {
    try {
      setIsLoadingOverview(true);
      const res = await apiClient.admin.getKenoOverview(period);
      if (res && res.success) {
        setSnapshot(res.snapshot);
        setKpis(res.kpis);
        setRecentRounds(res.recentRounds || []);
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to load Keno dashboard');
    } finally {
      setIsLoadingOverview(false);
    }
  }, [period, showToast]);

  const loadRounds = useCallback(async () => {
    try {
      setIsLoadingRounds(true);
      const res = await apiClient.admin.getKenoRounds({
        page: roundsPage,
        limit: 15,
        search: searchQuery.trim() || undefined
      });
      if (res && res.success) {
        setRoundsList(res.rounds || []);
        setRoundsTotalPages(res.totalPages || 1);
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to load Keno rounds');
    } finally {
      setIsLoadingRounds(false);
    }
  }, [roundsPage, searchQuery, showToast]);

  const loadTickets = useCallback(async () => {
    try {
      setIsLoadingTickets(true);
      const res = await apiClient.admin.getKenoTickets({
        page: ticketsPage,
        limit: 20,
        status: ticketStatusFilter,
        funding: ticketFundingFilter,
        search: searchQuery.trim() || undefined
      });
      if (res && res.success) {
        setTicketsList(res.tickets || []);
        setTicketsTotalPages(res.totalPages || 1);
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to load Keno tickets');
    } finally {
      setIsLoadingTickets(false);
    }
  }, [ticketsPage, ticketStatusFilter, ticketFundingFilter, searchQuery, showToast]);

  useEffect(() => {
    if (view === 'dashboard') {
      loadOverview();
      const timer = setInterval(loadOverview, 12000);
      return () => clearInterval(timer);
    }
  }, [view, loadOverview]);

  useEffect(() => {
    if (view === 'ledger') {
      if (ledgerTab === 'rounds') loadRounds();
      else loadTickets();
    }
  }, [view, ledgerTab, loadRounds, loadTickets]);

  const handleTogglePause = async () => {
    if (isTogglingPause) return;
    try {
      setIsTogglingPause(true);
      const targetPaused = !(snapshot?.isMaintenancePaused);
      const res = await apiClient.admin.toggleKenoPause(targetPaused);
      if (res && res.success) {
        setSnapshot(res.snapshot);
        showToast(
          targetPaused
            ? '⏸️ Fast Keno paused for maintenance. New tickets blocked cleanly.'
            : '▶️ Fast Keno resumed and accepting tickets.'
        );
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to toggle Keno pause state');
    } finally {
      setIsTogglingPause(false);
    }
  };

  const netPL = Number(kpis?.netProfitLoss || 0);
  const isProfit = netPL >= 0;

  return (
    <div className="enqu-dashboard-main">
      {/* Header Row matching Enqu Game Admin */}
      <div className="top" style={{ flexWrap: 'wrap', gap: '10px' }}>
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
        <h1>{view === 'dashboard' ? 'Keno Dashboard' : 'Keno Rounds & Tickets'}</h1>

        <span className="pillbox">
          {snapshot?.isMaintenancePaused
            ? '⏸️ Maintenance Paused'
            : snapshot?.isIdlePaused
              ? `💤 Standby · Round #${snapshot?.roundNumber ?? '—'}`
              : `🟢 Live · Round #${snapshot?.roundNumber ?? '—'} (${String(snapshot?.phase || 'betting').toUpperCase()})`}
        </span>

        {view === 'dashboard' && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div className="tabs" style={{ margin: 0 }}>
              {(
                [
                  ['today', 'Today'],
                  ['yesterday', 'Yesterday'],
                  ['week', '7D'],
                  ['month', '30D'],
                  ['all', 'All']
                ] as Array<[PeriodType, string]>
              ).map(([pKey, pLabel]) => (
                <button
                  key={pKey}
                  type="button"
                  className={period === pKey ? 'on' : ''}
                  onClick={() => setPeriod(pKey)}
                >
                  {pLabel}
                </button>
              ))}
            </div>

            <button
              type="button"
              className={snapshot?.isMaintenancePaused ? 'k' : 'enqu-btn-secondary'}
              style={{ padding: '7px 14px', fontSize: '12.5px' }}
              disabled={isTogglingPause}
              onClick={handleTogglePause}
            >
              {isTogglingPause
                ? 'Updating...'
                : snapshot?.isMaintenancePaused
                  ? 'Resume Keno'
                  : 'Pause Keno'}
            </button>
          </div>
        )}

        {view === 'ledger' && onNavigateView && (
          <button
            type="button"
            className="enqu-btn-secondary"
            style={{ marginLeft: 'auto', padding: '7px 14px', fontSize: '12.5px' }}
            onClick={() => onNavigateView('keno-dashboard')}
          >
            ← Keno Dashboard
          </button>
        )}
      </div>

      {view === 'dashboard' ? (
        <>
          {/* 4 Industry-Standard Keno Financial & Player KPIs */}
          <div className="grid g4">
            {/* Card 1: House Net Profit / Loss */}
            <div className="card d">
              <div className="lab">House Net Profit / Loss</div>
              <div
                className="val"
                style={{ color: isProfit ? '#4ade80' : '#f87171' }}
              >
                {isProfit ? '+' : '-'}ETB {fmtETB(Math.abs(netPL))}
              </div>
              <div className="tr">
                <span className={isProfit ? 'up' : 'dn'}>
                  {isProfit ? 'Profit' : 'Loss'} ({Number(kpis?.holdPercent || 0).toFixed(1)}% hold)
                </span>
              </div>
            </div>

            {/* Card 2: Unique Players & Tickets */}
            <div className="card">
              <div className="lab">Players Who Played</div>
              <div className="val">{fmtInt(kpis?.uniquePlayersCount || 0)}</div>
              <div className="tr">
                <span className="up">{fmtInt(kpis?.ticketsCount || 0)} tickets</span>
                {' · '}
                {fmtInt(kpis?.wonTicketsCount || 0)}W / {fmtInt(kpis?.lostTicketsCount || 0)}L
              </div>
            </div>

            {/* Card 3: Total Turnover (Cash vs Bonus Split) */}
            <div className="card">
              <div className="lab">Total Wagered (Turnover)</div>
              <div className="val">ETB {fmtETB(kpis?.totalTurnover || 0)}</div>
              <div className="tr">
                Cash: ETB {fmtETB(kpis?.cashTurnover || 0)} · Bonus: ETB {fmtETB(kpis?.bonusTurnover || 0)}
              </div>
            </div>

            {/* Card 4: Player Payouts & Actual RTP */}
            <div className="card">
              <div className="lab">Player Payouts</div>
              <div className="val">ETB {fmtETB(kpis?.totalPayouts || 0)}</div>
              <div className="tr">
                Actual RTP: <b>{Number(kpis?.actualRtpPercent || 0).toFixed(1)}%</b> · {fmtInt(kpis?.roundsSettled || 0)} rounds
              </div>
            </div>
          </div>

          {/* Live Engine Telemetry Strip + Recent Rounds Profit/Loss */}
          <div className="card" style={{ marginTop: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0 }}>Recent Settled Rounds (Profit &amp; Loss)</h3>
                <div className="tr" style={{ marginTop: '3px' }}>
                  Live Table: <b>{fmtInt(snapshot?.activeTicketsCount || 0)}</b> bets (ETB {fmtETB(snapshot?.activeStakedTotal || 0)}) ·{' '}
                  <b>{fmtInt(snapshot?.watchersCount || 0)}</b> watching ·{' '}
                  Bonus tickets in period: <b>{fmtInt(kpis?.bonusTicketsCount || 0)}</b>
                </div>
              </div>
              {onNavigateView && (
                <button
                  type="button"
                  className="enqu-btn-secondary"
                  style={{ padding: '7px 14px', fontSize: '12.5px' }}
                  onClick={() => onNavigateView('keno-ledger')}
                >
                  Open Full Rounds &amp; Tickets →
                </button>
              )}
            </div>

            <div className="wrap">
              <table>
                <thead>
                  <tr>
                    <th>Round</th>
                    <th>Players</th>
                    <th>Tickets</th>
                    <th>Total Wagered</th>
                    <th>Player Payout</th>
                    <th>House Profit / Loss</th>
                    <th>Settled At</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingOverview && recentRounds.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '18px', color: 'var(--mute)' }}>
                        Loading Keno analytics...
                      </td>
                    </tr>
                  ) : recentRounds.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '18px', color: 'var(--mute)' }}>
                        No settled Keno rounds in this period yet.
                      </td>
                    </tr>
                  ) : (
                    recentRounds.map(r => {
                      const pl = Number(r.profitLoss || 0);
                      return (
                        <tr key={r.roundNumber}>
                          <td><b>#{r.roundNumber}</b></td>
                          <td>{fmtInt(r.uniquePlayers)}</td>
                          <td>{fmtInt(r.ticketsCount)}</td>
                          <td>ETB {fmtETB(r.totalWagered)}</td>
                          <td>ETB {fmtETB(r.totalPayout)}</td>
                          <td style={{ fontWeight: 700, color: pl >= 0 ? '#16a34a' : '#dc2626' }}>
                            {pl >= 0 ? '+' : '-'}ETB {fmtETB(Math.abs(pl))}
                          </td>
                          <td style={{ fontSize: '12px', color: 'var(--mute)' }}>{fmtTime(r.settledAt)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* LEDGER VIEW: Switchable Rounds & Tickets Audit Tables */
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
            <div className="tabs" style={{ margin: 0 }}>
              <button
                type="button"
                className={ledgerTab === 'tickets' ? 'on' : ''}
                onClick={() => setLedgerTab('tickets')}
              >
                Player Tickets Audit
              </button>
              <button
                type="button"
                className={ledgerTab === 'rounds' ? 'on' : ''}
                onClick={() => setLedgerTab('rounds')}
              >
                Rounds Ledger
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <input
                type="text"
                className="enqu-panel-input"
                style={{ width: '210px', padding: '7px 11px' }}
                placeholder={ledgerTab === 'rounds' ? 'Search Round # or Hash...' : 'Search Round #, Name, Phone...'}
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setRoundsPage(1);
                  setTicketsPage(1);
                }}
              />

              {ledgerTab === 'tickets' && (
                <>
                  <select
                    className="enqu-panel-input"
                    style={{ width: 'auto', padding: '7px 10px' }}
                    value={ticketStatusFilter}
                    onChange={e => {
                      setTicketStatusFilter(e.target.value as any);
                      setTicketsPage(1);
                    }}
                  >
                    <option value="all">All Results</option>
                    <option value="won">Won</option>
                    <option value="lost">Lost</option>
                    <option value="active">Active</option>
                  </select>

                  <select
                    className="enqu-panel-input"
                    style={{ width: 'auto', padding: '7px 10px' }}
                    value={ticketFundingFilter}
                    onChange={e => {
                      setTicketFundingFilter(e.target.value as any);
                      setTicketsPage(1);
                    }}
                  >
                    <option value="all">Cash &amp; Bonus</option>
                    <option value="cash">Cash Only</option>
                    <option value="bonus">Bonus Only</option>
                  </select>
                </>
              )}
            </div>
          </div>

          {ledgerTab === 'tickets' ? (
            <>
              <div className="wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Round</th>
                      <th>Player</th>
                      <th>Funding</th>
                      <th>Picks / Hits</th>
                      <th>Stake</th>
                      <th>Payout</th>
                      <th>Status</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingTickets ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: '18px', color: 'var(--mute)' }}>
                          Loading tickets...
                        </td>
                      </tr>
                    ) : ticketsList.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: '18px', color: 'var(--mute)' }}>
                          No Keno tickets matched your filter.
                        </td>
                      </tr>
                    ) : (
                      ticketsList.map(t => (
                        <tr key={t.id}>
                          <td><b>#{t.roundNumber}</b></td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{t.playerName}</div>
                            {t.playerPhone && (
                              <div style={{ fontSize: '11.5px', color: 'var(--mute)' }}>{t.playerPhone}</div>
                            )}
                          </td>
                          <td>
                            <span
                              className="b"
                              style={{
                                fontSize: '11px',
                                background: t.isBonus ? '#fef3c7' : '#e0f2fe',
                                color: t.isBonus ? '#92400e' : '#0369a1'
                              }}
                            >
                              {t.isBonus ? 'BONUS' : 'CASH'}
                            </span>
                          </td>
                          <td style={{ fontSize: '12.5px' }}>
                            {t.spotCount} picks · {t.hitCount} hits
                            {t.multiplier > 0 ? ` (${t.multiplier}x)` : ''}
                          </td>
                          <td>ETB {fmtETB(t.betAmount)}</td>
                          <td style={{ fontWeight: 700, color: t.payoutAmount > 0 ? '#16a34a' : 'inherit' }}>
                            ETB {fmtETB(t.payoutAmount)}
                          </td>
                          <td>
                            <span className={t.status === 'won' ? 'b ok' : 'b'} style={{ fontSize: '11px' }}>
                              {String(t.status || '').toUpperCase()}
                            </span>
                          </td>
                          <td style={{ fontSize: '12px', color: 'var(--mute)' }}>{fmtTime(t.createdAt)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', fontSize: '12.5px' }}>
                <span style={{ color: 'var(--mute)' }}>Page {ticketsPage} of {ticketsTotalPages}</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="enqu-btn-secondary"
                    style={{ padding: '6px 12px' }}
                    disabled={ticketsPage <= 1}
                    onClick={() => setTicketsPage(p => Math.max(1, p - 1))}
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    className="enqu-btn-secondary"
                    style={{ padding: '6px 12px' }}
                    disabled={ticketsPage >= ticketsTotalPages}
                    onClick={() => setTicketsPage(p => Math.min(ticketsTotalPages, p + 1))}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Round</th>
                      <th>Status</th>
                      <th>Players</th>
                      <th>Tickets</th>
                      <th>Wagered</th>
                      <th>Payout</th>
                      <th>Profit / Loss</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingRounds ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: '18px', color: 'var(--mute)' }}>
                          Loading rounds...
                        </td>
                      </tr>
                    ) : roundsList.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: '18px', color: 'var(--mute)' }}>
                          No Keno rounds found.
                        </td>
                      </tr>
                    ) : (
                      roundsList.map(r => {
                        const pl = Number(r.profitLoss || 0);
                        return (
                          <tr key={r.id || r.roundNumber}>
                            <td><b>#{r.roundNumber}</b></td>
                            <td>
                              <span className={r.status === 'settled' ? 'b ok' : 'b'} style={{ fontSize: '11px' }}>
                                {String(r.status || '').toUpperCase()}
                              </span>
                            </td>
                            <td>{fmtInt(r.uniquePlayers)}</td>
                            <td>{fmtInt(r.ticketsCount)}</td>
                            <td>ETB {fmtETB(r.totalWagered)}</td>
                            <td>ETB {fmtETB(r.totalPayout)}</td>
                            <td style={{ fontWeight: 700, color: pl >= 0 ? '#16a34a' : '#dc2626' }}>
                              {pl >= 0 ? '+' : '-'}ETB {fmtETB(Math.abs(pl))}
                            </td>
                            <td style={{ fontSize: '12px', color: 'var(--mute)' }}>
                              {fmtTime(r.settledAt || r.startedAt)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', fontSize: '12.5px' }}>
                <span style={{ color: 'var(--mute)' }}>Page {roundsPage} of {roundsTotalPages}</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="enqu-btn-secondary"
                    style={{ padding: '6px 12px' }}
                    disabled={roundsPage <= 1}
                    onClick={() => setRoundsPage(p => Math.max(1, p - 1))}
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    className="enqu-btn-secondary"
                    style={{ padding: '6px 12px' }}
                    disabled={roundsPage >= roundsTotalPages}
                    onClick={() => setRoundsPage(p => Math.min(roundsTotalPages, p + 1))}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
