import React, { useState, useEffect, useMemo, useRef } from 'react';
import { apiClient } from '../../services/apiClient.ts';
import '../../styles/players-enqu.css';

interface PlayerItem {
  id: string;
  fullName: string;
  phone: string;
  username?: string;
  hasDeposited: boolean;
  balance: number;
  createdAt: string;
  joinDaysAgo: number;
  deposits: Array<{
    id: string;
    amount: number;
    paymentMethod: string;
    referenceCode: string;
    createdAt: string;
  }>;
  depositCount: number;
  totalDeposited: number;
  totalDepositedByAgent: number;
  firstDeposit?: {
    id: string;
    amount: number;
    paymentMethod: string;
    referenceCode: string;
    createdAt: string;
  } | null;
  lastDeposit?: {
    id: string;
    amount: number;
    paymentMethod: string;
    referenceCode: string;
    createdAt: string;
  } | null;
  bonusEarned: number;
  status: 'active' | 'inactive' | 'new' | 'awaiting_deposit';
}

interface PlayersSummary {
  totalPlayers: number;
  newPlayersLast30Days: number;
  activePlayers: number;
  inactivePlayers: number;
  waitingFirstDepositCount: number;
  depositsLast30DaysVolume: number;
  referralBonusEarned: number;
  bonusEarnedLast30Days: number;
  firstDepositsCount: number;
  conversion: {
    registered: number;
    madeFirstDeposit: number;
    activeNow: number;
  };
}

interface Period5Day {
  periodIndex: number;
  label: string;
  count: number;
}

interface AgentPlayersDeskProps {
  agentProfile?: any;
  onQuickDeposit?: (player: any) => void;
  showToast?: (msg: string) => void;
  openMobile?: () => void;
}

export const AgentPlayersDesk: React.FC<AgentPlayersDeskProps> = ({
  agentProfile,
  onQuickDeposit,
  showToast,
  openMobile
}) => {
  const [players, setPlayers] = useState<PlayerItem[]>([]);
  const [summary, setSummary] = useState<PlayersSummary>({
    totalPlayers: 0,
    newPlayersLast30Days: 0,
    activePlayers: 0,
    inactivePlayers: 0,
    waitingFirstDepositCount: 0,
    depositsLast30DaysVolume: 0,
    referralBonusEarned: 0,
    bonusEarnedLast30Days: 0,
    firstDepositsCount: 0,
    conversion: {
      registered: 0,
      madeFirstDeposit: 0,
      activeNow: 0
    }
  });
  const [periods5Day, setPeriods5Day] = useState<Period5Day[]>([]);
  const [referralLink, setReferralLink] = useState<string>(
    agentProfile?.inviteLink ||
    (agentProfile?.agent_code ? `https://t.me/SonicGameOfficialBot?start=agent_${agentProfile.agent_code}` : '')
  );
  const [commissionRate, setCommissionRate] = useState<number>(
    parseFloat(agentProfile?.commission_rate || agentProfile?.commissionRate || '10.0')
  );

  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'All' | 'Active' | 'Inactive' | 'No deposit yet'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'new' | 'dep' | 'bon'>('new');
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerItem | null>(null);

  // In-desk floating toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  const showInternalToast = (msg: string) => {
    setToastMessage(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  const formatBirr = (val: number | string) => {
    const n = typeof val === 'number' ? val : parseFloat(val || '0');
    return isNaN(n) ? '0' : n.toLocaleString('en-US');
  };

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

  const formatDateLabel = (dateStr?: string) => {
    if (!dateStr) return '—';
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const d = new Date(dateStr);
    return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  };

  const formatRelativeDays = (dateStr?: string) => {
    if (!dateStr) return '—';
    const diffDays = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 30) return `${diffDays} days ago`;
    return formatDateLabel(dateStr);
  };

  // =========================================================================
  // 1. DATA FETCHING: PLAYERS ROSTER
  // =========================================================================
  const fetchPlayersData = async () => {
    try {
      setLoading(true);
      const res = await apiClient.agent.getPlayers();
      if (res && res.success) {
        if (res.players) setPlayers(res.players as any);
        if (res.summary) setSummary(res.summary);
        if (res.periods5Day) setPeriods5Day(res.periods5Day);
        if (res.referralLink) setReferralLink(res.referralLink);
        if (res.commissionRate) setCommissionRate(res.commissionRate);
      }
    } catch (err: any) {
      console.warn('Failed to load players roster:', err.message);
      if (showToast) showToast(`❌ ${err.message || 'Failed to load players'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayersData();
  }, []);

  // Sync referral link from agentProfile if available
  useEffect(() => {
    if (agentProfile?.inviteLink) setReferralLink(agentProfile.inviteLink);
    if (agentProfile?.agent_code && !agentProfile?.inviteLink) {
      setReferralLink(`https://t.me/SonicGameOfficialBot?start=agent_${agentProfile.agent_code}`);
    }
    if (agentProfile?.commission_rate || agentProfile?.commissionRate) {
      setCommissionRate(parseFloat(agentProfile.commission_rate || agentProfile.commissionRate || '10.0'));
    }
  }, [agentProfile]);

  // =========================================================================
  // 2. REFERRAL LINK ACTIONS
  // =========================================================================
  const handleCopyLink = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(referralLink);
        showInternalToast('Link copied');
      } else {
        showInternalToast('Copy is not available here');
      }
    } catch (_) {
      showInternalToast('Copy is not available here');
    }
  };

  const handleShareTelegram = () => {
    const text = `🎉 ተጫወቱ እና አሸንፉ በ Enqu Game / Sonic Bingo! በዚህ ሊንክ ይመዝገቡ እና የ 50 ብር የነፃ መመዝገቢያ ቦነስ ያግኙ:`;
    const url = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(text)}`;
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  };

  const handleCopyInviteMessage = async () => {
    const message = `👋 ሰላም! በ Enqu Game (Sonic Bingo) ቴሌግራም ሚኒ-አፕ በቀላሉ እየተጫወቱ ያሸንፉ!\n\n🎁 በዚህ ሊንክ ሲመዘገቡ የ 50 ብር የነፃ ቦነስ ያገኛሉ:\n👉 ${referralLink}\n\nአሁኑኑ ይጀምሩ!`;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(message);
        showInternalToast('Invite message copied');
      } else {
        showInternalToast('Copy is not available here');
      }
    } catch (_) {
      showInternalToast('Copy is not available here');
    }
  };

  // Keyboard shortcut ESC for modal dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedPlayer) {
        setSelectedPlayer(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPlayer]);

  // Max count for 5-day period bars
  const maxPeriodCount = useMemo(() => {
    if (!periods5Day.length) return 1;
    const max = Math.max(...periods5Day.map(p => p.count));
    return max > 0 ? max : 1;
  }, [periods5Day]);

  // Conversion Funnel Percentages
  const firstDepositPct = useMemo(() => {
    if (summary.totalPlayers <= 0) return 0;
    return Math.round((summary.conversion.madeFirstDeposit / summary.totalPlayers) * 100);
  }, [summary.totalPlayers, summary.conversion.madeFirstDeposit]);

  const activeNowPct = useMemo(() => {
    if (summary.totalPlayers <= 0) return 0;
    return Math.round((summary.conversion.activeNow / summary.totalPlayers) * 100);
  }, [summary.totalPlayers, summary.conversion.activeNow]);

  // Filter & Sort Players
  const displayedPlayers = useMemo(() => {
    return players
      .filter(p => {
        // Tab filter
        if (tab === 'Active' && p.status !== 'active') return false;
        if (tab === 'Inactive' && p.status !== 'inactive') return false;
        if (tab === 'No deposit yet' && p.depositCount > 0) return false;

        // Search filter
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        return (
          p.fullName.toLowerCase().includes(q) ||
          p.phone.includes(q) ||
          (p.username && p.username.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        if (sortBy === 'dep') {
          return b.totalDeposited - a.totalDeposited;
        }
        if (sortBy === 'bon') {
          return b.bonusEarned - a.bonusEarned;
        }
        // 'new' -> Newest first
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [players, tab, searchQuery, sortBy]);

  // Pill badge helper
  const renderStatusPill = (p: PlayerItem) => {
    if (p.status === 'active') {
      return <span className="pill ok">Active</span>;
    }
    if (p.status === 'inactive') {
      return <span className="pill gr">Inactive</span>;
    }
    if (p.status === 'new') {
      return <span className="pill nw">New</span>;
    }
    return <span className="pill wn">Awaiting 1st deposit</span>;
  };

  return (
    <div className="players-enqu-root">
      {/* Header Bar - STRICTLY NO "Register player" button per explicit instructions */}
      <div className="top">
        {openMobile && (
          <button
            type="button"
            className="enqu-menu-btn"
            onClick={openMobile}
            title="Open navigation menu"
            aria-label="Open navigation menu"
            style={{ marginRight: 10 }}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        )}
        <div>
          <h1>My players</h1>
          <div className="sub">
            People who joined through your link or whom you registered.
          </div>
        </div>
        <span className="sp" />
      </div>

      {/* Hero Specular Obsidian Banner */}
      <div className="hero">
        <div>
          <div className="kl">Your referral link</div>
          <h2>
            Earn <em>{commissionRate}%</em> of every new player’s first deposit
          </h2>
          <p>
            Share your link. When a player signs up and makes a first deposit, your bonus is added to your wallet. New players also get a 50 Birr welcome bonus.
          </p>

          <div className="link">
            <span>{referralLink || 'Generating your unique agency invite link...'}</span>
            <button
              type="button"
              className="k"
              onClick={handleCopyLink}
            >
              Copy
            </button>
          </div>

          <div className="btns">
            <button
              type="button"
              className="ghost"
              onClick={handleShareTelegram}
            >
              Share on Telegram
            </button>
            <button
              type="button"
              className="ghost"
              onClick={handleCopyInviteMessage}
            >
              Copy invite message
            </button>
          </div>
        </div>

        <div className="mini">
          <div>
            <span>Joined, last 30 days</span>
            <b>+{summary.newPlayersLast30Days} players</b>
          </div>
          <div>
            <span>Bonus earned, last 30 days</span>
            <b>ETB {formatBirr(summary.bonusEarnedLast30Days)}</b>
          </div>
          <div>
            <span>Waiting for first deposit</span>
            <b>{summary.waitingFirstDepositCount} players</b>
          </div>
        </div>
      </div>

      {/* 4 Stat Cards Grid */}
      <div className="grid g4">
        <div className="card stat">
          <div className="l">Total players</div>
          <div className="v">{summary.totalPlayers}</div>
          <div className="t">
            <span className="up">+{summary.newPlayersLast30Days}</span> in the last 30 days
          </div>
        </div>

        <div className="card stat">
          <div className="l">Active players</div>
          <div className="v">{summary.activePlayers}</div>
          <div className="t">Deposited in the last 14 days</div>
        </div>

        <div className="card stat">
          <div className="l">Their deposits, 30 days</div>
          <div className="v">ETB {formatBirr(summary.depositsLast30DaysVolume)}</div>
          <div className="t">Across all your players</div>
        </div>

        <div className="card stat">
          <div className="l">Referral bonus earned</div>
          <div className="v">ETB {formatBirr(summary.referralBonusEarned)}</div>
          <div className="t">
            {commissionRate}% of {summary.firstDepositsCount} first deposits
          </div>
        </div>
      </div>

      {/* Middle 2-Column Section: 5-Day Registration Chart & Conversion Funnel */}
      <div className="grid g2">
        {/* Left: New players column chart */}
        <div className="card">
          <h3>
            New players
            <span className="r">Last 30 days, 5-day periods</span>
          </h3>
          <div className="ch">
            {periods5Day.map((p, idx) => {
              const pct = Math.max(4, Math.round((p.count / maxPeriodCount) * 82));
              return (
                <div key={idx} className="cb">
                  <b>{p.count}</b>
                  <i style={{ height: `${pct}%` }} />
                  <span>{p.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Conversion Funnel */}
        <div className="card">
          <h3>Conversion</h3>

          <div className="fn">
            <div className="rw">
              <span>Registered</span>
              <span>{summary.conversion.registered} · 100%</span>
            </div>
            <div className="pb">
              <i style={{ width: '100%' }} />
            </div>
          </div>

          <div className="fn">
            <div className="rw">
              <span>Made a first deposit</span>
              <span>
                {summary.conversion.madeFirstDeposit} · {firstDepositPct}%
              </span>
            </div>
            <div className="pb f">
              <i style={{ width: `${firstDepositPct}%` }} />
            </div>
          </div>

          <div className="fn">
            <div className="rw">
              <span>Active now</span>
              <span>
                {summary.conversion.activeNow} · {activeNowPct}%
              </span>
            </div>
            <div className="pb">
              <i style={{ width: `${activeNowPct}%` }} />
            </div>
          </div>

          <div className="sm" style={{ marginTop: 14, lineHeight: 1.5 }}>
            {summary.waitingFirstDepositCount} player
            {summary.waitingFirstDepositCount === 1 ? '' : 's'} have not deposited yet. A nudge from you can earn another bonus.
          </div>
        </div>
      </div>

      {/* Toolbar: Segmented Filters, Search & Sort */}
      <div className="bar">
        <div className="tabs">
          {[
            { id: 'All', label: 'All', count: summary.totalPlayers },
            { id: 'Active', label: 'Active', count: summary.activePlayers },
            { id: 'Inactive', label: 'Inactive', count: summary.inactivePlayers },
            { id: 'No deposit yet', label: 'No deposit yet', count: summary.waitingFirstDepositCount }
          ].map(t => (
            <button
              key={t.id}
              type="button"
              className={tab === t.id ? 'on' : ''}
              onClick={() => setTab(t.id as any)}
            >
              {t.label}
              <span className="n">{t.count}</span>
            </button>
          ))}
        </div>

        <input
          className="search"
          placeholder="Search name or phone"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          aria-label="Search players"
        />

        <select
          className="sort"
          value={sortBy}
          onChange={e => setSortBy(e.target.value as any)}
          aria-label="Sort players"
        >
          <option value="new">Newest first</option>
          <option value="dep">Most deposited</option>
          <option value="bon">Highest bonus</option>
        </select>
      </div>

      {/* Players Data Table */}
      <div className="card" style={{ padding: '8px 14px' }}>
        {displayedPlayers.length > 0 ? (
          <div className="wrap">
            <table>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Joined</th>
                  <th>Status</th>
                  <th className="r">Deposits</th>
                  <th className="r">First deposit</th>
                  <th className="r">Your {commissionRate}% bonus</th>
                  <th>Last deposit</th>
                </tr>
              </thead>
              <tbody>
                {displayedPlayers.map(p => {
                  const shortPhone = p.phone || 'No phone';

                  return (
                    <tr
                      key={p.id}
                      tabIndex={0}
                      onClick={() => setSelectedPlayer(p)}
                    >
                      {/* Column 1: Player Profile */}
                      <td>
                        <div className="pc">
                          <span className={`av ${p.totalDeposited > 1000 ? 'gd' : ''}`}>
                            {getInitials(p.fullName, p.phone)}
                          </span>
                          <div>
                            <b>{p.fullName}</b>
                            <small>{shortPhone}</small>
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Joined Date */}
                      <td>
                        {formatDateLabel(p.createdAt)}
                        <small>Referral link</small>
                      </td>

                      {/* Column 3: Status Badge */}
                      <td>{renderStatusPill(p)}</td>

                      {/* Column 4: Total Deposits */}
                      <td className="r">
                        {p.depositCount}
                        <small>ETB {formatBirr(p.totalDeposited)}</small>
                      </td>

                      {/* Column 5: First Deposit */}
                      <td className="r">
                        {p.firstDeposit ? `ETB ${formatBirr(p.firstDeposit.amount)}` : '—'}
                      </td>

                      {/* Column 6: Referral Bonus */}
                      <td className="r">
                        {p.firstDeposit ? (
                          <span className="bonus">+ETB {formatBirr(p.bonusEarned)}</span>
                        ) : (
                          <span className="sm">Waiting</span>
                        )}
                      </td>

                      {/* Column 7: Last Deposit */}
                      <td>
                        {p.lastDeposit ? formatRelativeDays(p.lastDeposit.createdAt) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">
            {tab === 'All' && !searchQuery
              ? 'No players have joined yet. Share your referral link above!'
              : 'No players match your search filter.'}
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* PLAYER DETAIL MODAL DIALOG                                          */}
      {/* =================================================================== */}
      {selectedPlayer && (
        <div className="mbg" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="mh">
              <span />
              <button
                type="button"
                onClick={() => setSelectedPlayer(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Profile Header */}
            <div className="ph">
              <span className="av lg gd">
                {getInitials(selectedPlayer.fullName, selectedPlayer.phone)}
              </span>
              <div>
                <h3>{selectedPlayer.fullName}</h3>
                <div className="sm">
                  {selectedPlayer.phone} · P-{selectedPlayer.id.slice(0, 4).toUpperCase()}
                </div>
                <div style={{ marginTop: 6 }}>
                  {renderStatusPill(selectedPlayer)}
                </div>
              </div>
            </div>

            {/* 3 Metric Tiles */}
            <div className="k3">
              <div>
                <small>Total deposited</small>
                <b>ETB {formatBirr(selectedPlayer.totalDeposited)}</b>
              </div>
              <div>
                <small>Deposits</small>
                <b>{selectedPlayer.depositCount}</b>
              </div>
              <div>
                <small>Your bonus</small>
                <b className="bonus">+ETB {formatBirr(selectedPlayer.bonusEarned)}</b>
              </div>
            </div>

            {/* Timeline */}
            <div className="tl">
              <div>
                Registered · {formatDateLabel(selectedPlayer.createdAt)}
                <small style={{ display: 'block' }}>Referral link</small>
              </div>

              {selectedPlayer.firstDeposit ? (
                <div>
                  First deposit · ETB {formatBirr(selectedPlayer.firstDeposit.amount)}
                  <small style={{ display: 'block' }}>
                    {formatDateLabel(selectedPlayer.firstDeposit.createdAt)} · You earned{' '}
                    <span className="bonus">+ETB {formatBirr(selectedPlayer.bonusEarned)}</span>
                  </small>
                </div>
              ) : (
                <div>
                  Waiting for first deposit
                  <small style={{ display: 'block' }}>
                    Your {commissionRate}% bonus starts once they make their first deposit
                  </small>
                </div>
              )}

              {selectedPlayer.deposits.length > 1 && selectedPlayer.lastDeposit && (
                <div>
                  Latest deposit · ETB {formatBirr(selectedPlayer.lastDeposit.amount)}
                  <small style={{ display: 'block' }}>
                    {formatRelativeDays(selectedPlayer.lastDeposit.createdAt)}
                  </small>
                </div>
              )}
            </div>

            {/* Deposit History Breakdown */}
            {selectedPlayer.deposits.length > 0 && (
              <>
                <h3 style={{ fontSize: 15, margin: '18px 0 6px', fontWeight: 800 }}>
                  Deposit history
                </h3>
                <div>
                  {selectedPlayer.deposits
                    .slice()
                    .reverse()
                    .map((d, i) => (
                      <div
                        key={d.id || i}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '9px 0',
                          borderTop: '1px solid var(--plr-line)',
                          fontWeight: 700,
                          fontSize: 13.5
                        }}
                      >
                        <span>
                          {formatDateLabel(d.createdAt)}
                          <small style={{ display: 'block', color: 'var(--plr-mute)' }}>
                            {d.paymentMethod} · {d.referenceCode}
                          </small>
                        </span>
                        <span>ETB {formatBirr(d.amount)}</span>
                      </div>
                    ))}
                </div>
              </>
            )}

            <div className="note">
              For privacy you see activity and your bonus, not this player’s wallet or balance.
            </div>

            <div className="mf">
              <button
                type="button"
                className="k"
                onClick={() => setSelectedPlayer(null)}
              >
                Done
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

export default AgentPlayersDesk;
