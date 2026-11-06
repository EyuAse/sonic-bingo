import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { getApiBase, LIVE_BACKEND_ORIGIN } from '../../config/env.ts';
import { getAdminAuthHeader } from '../../services/apiClient.ts';

// Helper to format currency numbers with commas
const fmt = (n: number | string) => Number(n || 0).toLocaleString('en-US');

// Helper to get 2-letter initials
const ini = (name: string) => {
  if (!name) return 'PL';
  return name
    .split(' ')
    .filter(Boolean)
    .map(w => w[0] || '')
    .slice(0, 2)
    .join('')
    .toUpperCase();
};

interface PlayerSummary {
  id: string;
  playerCode: string;
  name: string;
  phone: string;
  telegramUsername?: string;
  status: 'Active' | 'Suspended' | 'Under review';
  wallet: number;
  bonus: number;
  coins: number;
  games: number;
  source: string;
  joinedAt: string;
  lastActive: string;
}

interface PlayerDetails {
  id: string;
  name: string;
  phone: string;
  telegramUsername?: string;
  telegramId?: number;
  status: 'Active' | 'Suspended' | 'Under review';
  city: string;
  source: string;
  referredBy: string;
  referralCode: string;
  referralCount: number;
  joinedAt: string;
  lastActive: string;
  kycStatus: string;
  wallet: number;
  bonus: number;
  coins: number;
  totalDeposits: number;
  totalWithdrawals: number;
  totalStaked: number;
  totalWon: number;
  netResult: number;
  gamesCount: number;
  winsCount: number;
  notes: Array<{ id: string; note: string; createdBy: string; createdAt: string }>;
  txs: Array<[string, string, string, string, string]>;
  gms: Array<[string, string, string, string, string]>;
  logs: Array<{ id: string; t: string; a: string; d: string }>;
}

export const PlayerAccountsDesk: React.FC = () => {
  const { showToast } = useApp();

  // Platform KPIs
  const [stats, setStats] = useState<{
    totalPlayers: number;
    activePlayers: number;
    suspendedPlayers: number;
    reviewPlayers: number;
    needsAttentionCount: number;
    onlineNow: number;
    totalWalletBalance: number;
    totalBonusBalance: number;
  }>({
    totalPlayers: 0,
    activePlayers: 0,
    suspendedPlayers: 0,
    reviewPlayers: 0,
    needsAttentionCount: 0,
    onlineNow: 1,
    totalWalletBalance: 0,
    totalBonusBalance: 0
  });

  // Table & Filter State
  const [players, setPlayers] = useState<PlayerSummary[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [selectedDetails, setSelectedDetails] = useState<PlayerDetails | null>(null);
  const [isLoadingList, setIsLoadingList] = useState<boolean>(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Suspended' | 'Under review'>('All');
  const [sourceFilter, setSourceFilter] = useState<string>('All');
  const [sortFilter, setSortFilter] = useState<'new' | 'bal' | 'act'>('new');
  const [page, setPage] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const limit = 8;

  // Detail Tab
  const [activeTab, setActiveTab] = useState<'ov' | 'tx' | 'gm' | 'lg'>('ov');

  // Internal Note input
  const [newNoteInput, setNewNoteInput] = useState<string>('');
  const [isAddingNote, setIsAddingNote] = useState<boolean>(false);

  // Modals
  const [showSuspendModal, setShowSuspendModal] = useState<boolean>(false);
  const [suspendReason, setSuspendReason] = useState<string>('Suspicious activity');
  const [suspendNote, setSuspendNote] = useState<string>('');
  const [suspendNotify, setSuspendNotify] = useState<boolean>(true);
  const [isSubmittingStatus, setIsSubmittingStatus] = useState<boolean>(false);

  const [showAdjustModal, setShowAdjustModal] = useState<boolean>(false);
  const [adjustWallet, setAdjustWallet] = useState<'wal' | 'bon'>('wal');
  const [adjustType, setAdjustType] = useState<'Credit' | 'Debit'>('Credit');
  const [adjustAmount, setAdjustAmount] = useState<string>('100');
  const [adjustReason, setAdjustReason] = useState<string>('Correction');
  const [adjustNote, setAdjustNote] = useState<string>('');
  const [isSubmittingAdjust, setIsSubmittingAdjust] = useState<boolean>(false);

  // Direct Message Modal
  const [showMessageModal, setShowMessageModal] = useState<boolean>(false);
  const [directMessageText, setDirectMessageText] = useState<string>('');
  const [isSendingMessage, setIsSendingMessage] = useState<boolean>(false);

  // Resilient API Fetch Helper with live backend fallback and Admin Bearer Auth
  const apiFetch = async (endpoint: string, init?: RequestInit): Promise<Response> => {
    const adminHeaders = await getAdminAuthHeader();
    const headers = {
      ...adminHeaders,
      ...(init?.headers || {})
    };
    const options: RequestInit = { ...init, headers };

    try {
      const res = await fetch(`${getApiBase()}${endpoint}`, options);
      if (res.ok || res.status !== 404) {
        return res;
      }
    } catch {}

    return fetch(`${LIVE_BACKEND_ORIGIN}/api${endpoint}`, options);
  };

  // 1. Fetch Stats
  const loadStats = useCallback(async () => {
    try {
      const res = await apiFetch('/admin/players/stats');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.stats) {
          setStats(data.stats);
        }
      }
    } catch (e) {
      console.warn('Failed to load player stats:', e);
    }
  }, []);

  // 2. Fetch Players List
  const loadPlayers = useCallback(async () => {
    try {
      setIsLoadingList(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search: searchQuery.trim(),
        status: statusFilter,
        source: sourceFilter,
        sort: sortFilter
      });

      const res = await apiFetch(`/admin/players?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setPlayers(data.players || []);
          setTotalCount(data.totalCount || 0);

          // Auto-select first player if none selected or selected not in list
          if (data.players && data.players.length > 0) {
            if (!selectedPlayerId || !data.players.some((p: PlayerSummary) => p.id === selectedPlayerId)) {
              setSelectedPlayerId(data.players[0].id);
            }
          } else {
            setSelectedPlayerId(null);
            setSelectedDetails(null);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load players directory:', e);
    } finally {
      setIsLoadingList(false);
    }
  }, [page, searchQuery, statusFilter, sourceFilter, sortFilter, selectedPlayerId]);

  // 3. Fetch Selected Player Deep-Dive Details
  const loadDetails = useCallback(async (playerId: string) => {
    try {
      setIsLoadingDetails(true);
      const res = await apiFetch(`/admin/players/${playerId}/details`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.player) {
          setSelectedDetails(data.player);
        }
      }
    } catch (e) {
      console.warn('Failed to load player dossier:', e);
    } finally {
      setIsLoadingDetails(false);
    }
  }, []);

  // Initialize
  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadPlayers();
  }, [page, searchQuery, statusFilter, sourceFilter, sortFilter]);

  // When selectedPlayerId changes, fetch their deep-dive details
  useEffect(() => {
    if (selectedPlayerId) {
      loadDetails(selectedPlayerId);
    }
  }, [selectedPlayerId, loadDetails]);

  // Handle Status Toggle (Suspend / Activate)
  const handleToggleStatus = async (targetStatus?: 'active' | 'suspended') => {
    if (!selectedDetails) return;
    const nextStatus = targetStatus || (selectedDetails.status === 'Suspended' ? 'active' : 'suspended');

    if (nextStatus === 'suspended' && !showSuspendModal) {
      setShowSuspendModal(true);
      return;
    }

    try {
      setIsSubmittingStatus(true);
      const res = await apiFetch(`/admin/players/${selectedDetails.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: nextStatus,
          reason: suspendReason,
          note: suspendNote,
          notify: suspendNotify
        })
      });

      const data = await res.json();
      if (data.success) {
        showToast(`✓ ${data.message || 'Status updated successfully'}`);
        setShowSuspendModal(false);
        setSuspendNote('');
        loadStats();
        loadPlayers();
        loadDetails(selectedDetails.id);
      } else {
        showToast(`❌ ${data.error || 'Failed to update status'}`);
      }
    } catch {
      showToast('❌ Network error updating player status');
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  // Handle Balance Adjustment
  const handleAdjustBalance = async () => {
    if (!selectedDetails) return;
    const amt = parseFloat(adjustAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast('⚠️ Please enter a valid positive amount');
      return;
    }
    if (!adjustNote.trim()) {
      showToast('⚠️ An explanatory note is required');
      return;
    }

    try {
      setIsSubmittingAdjust(true);
      const res = await apiFetch(`/admin/players/${selectedDetails.id}/adjust-balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: adjustWallet,
          type: adjustType,
          amount: amt,
          reason: adjustReason,
          note: adjustNote.trim()
        })
      });

      const data = await res.json();
      if (data.success) {
        showToast(`✓ ${data.message || 'Balance adjusted successfully'}`);
        setShowAdjustModal(false);
        setAdjustAmount('100');
        setAdjustNote('');
        loadStats();
        loadPlayers();
        loadDetails(selectedDetails.id);
      } else {
        showToast(`❌ ${data.error || 'Failed to adjust balance'}`);
      }
    } catch {
      showToast('❌ Network error executing adjustment');
    } finally {
      setIsSubmittingAdjust(false);
    }
  };

  // Handle Add Internal Note
  const handleAddNote = async () => {
    if (!selectedDetails || !newNoteInput.trim()) return;

    try {
      setIsAddingNote(true);
      const res = await apiFetch(`/admin/players/${selectedDetails.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: newNoteInput.trim() })
      });

      const data = await res.json();
      if (data.success) {
        showToast('✓ Note added successfully');
        setNewNoteInput('');
        loadDetails(selectedDetails.id);
      } else {
        showToast(`❌ ${data.error || 'Failed to add note'}`);
      }
    } catch {
      showToast('❌ Network error adding note');
    } finally {
      setIsAddingNote(false);
    }
  };

  // Handle Send Direct Message
  const handleSendMessage = async () => {
    if (!selectedDetails || !directMessageText.trim()) return;

    try {
      setIsSendingMessage(true);
      const res = await apiFetch(`/admin/players/${selectedDetails.id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: directMessageText.trim() })
      });

      const data = await res.json();
      if (data.success) {
        showToast(`✓ ${data.message || 'Message sent'}`);
        setShowMessageModal(false);
        setDirectMessageText('');
        loadDetails(selectedDetails.id);
      } else {
        showToast(`❌ ${data.error || 'Failed to send message'}`);
      }
    } catch {
      showToast('❌ Network error sending message');
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Handle Export CSV
  const handleExportCSV = () => {
    const params = new URLSearchParams({
      search: searchQuery.trim(),
      status: statusFilter,
      source: sourceFilter
    });
    window.open(`${getApiBase()}/admin/players/export-csv?${params.toString()}`, '_blank');
    showToast('📥 Exporting players CSV...');
  };

  const startRecord = (page - 1) * limit + (players.length > 0 ? 1 : 0);
  const endRecord = Math.min((page - 1) * limit + players.length, totalCount);

  return (
    <div className="enqu-dashboard-main">
      {/* 1. Header matching exact Enqu aesthetic */}
      <div className="top">
        <h1>Player Accounts</h1>
        <div className="row" style={{ gap: '10px' }}>
          <div className="pillbox">
            {new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
          <span className="av" title="Admin Superuser" />
        </div>
      </div>

      {/* 2. Top 4 KPI Stat Cards */}
      <div className="grid g4">
        {/* Card 1: Total Players (Dark Luxury Card) */}
        <div className="card d">
          <div className="lab">Total Players</div>
          <div className="val">{fmt(stats.totalPlayers)}</div>
          <div className="tr">
            <span className="up" style={{ color: '#3fbf62', fontWeight: 700 }}>
              ↗ 1.7%
            </span>{' '}
            this month
          </div>
        </div>

        {/* Card 2: Active Players */}
        <div className="card">
          <div className="lab">Active Players</div>
          <div className="val">{fmt(stats.activePlayers)}</div>
          <div className="tr" style={{ color: '#2e9e4f', fontWeight: 600 }}>
            Online now: {stats.onlineNow}
          </div>
        </div>

        {/* Card 3: Total Wallet Balance */}
        <div className="card">
          <div className="lab">Total Wallet Balance</div>
          <div className="val">ETB {fmt(stats.totalWalletBalance)}</div>
          <div className="tr">
            Bonus wallets: ETB {fmt(stats.totalBonusBalance)}
          </div>
        </div>

        {/* Card 4: Suspended / Review */}
        <div className="card">
          <div className="lab">Suspended / Review</div>
          <div className="val">{stats.needsAttentionCount}</div>
          <div className="tr">
            {stats.needsAttentionCount > 0 ? (
              <span className="dn" style={{ color: '#b0302f', fontWeight: 700 }}>
                Needs attention
              </span>
            ) : (
              <span className="up" style={{ color: '#2e9e4f', fontWeight: 700 }}>
                All healthy
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 3. Filter & Action Ribbon */}
      <div className="card filter-ribbon-card" style={{ marginBottom: '15px' }}>
        <div className="row" style={{ justifyContent: 'space-between', width: '100%' }}>
          <div className="row" style={{ gap: '10px' }}>
            <input
              type="text"
              placeholder="Search name, phone or ID..."
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="enqu-panel-input players-search-input"
              style={{ padding: '9px 12px' }}
            />
            <span className="tabs" style={{ margin: 0 }}>
              {(['All', 'Active', 'Suspended', 'Under review'] as const).map(s => {
                const count =
                  s === 'All' ? stats.totalPlayers :
                  s === 'Active' ? stats.activePlayers :
                  s === 'Suspended' ? stats.suspendedPlayers : stats.reviewPlayers;
                const isSelected = statusFilter === s;
                return (
                  <button
                    key={s}
                    type="button"
                    className={isSelected ? 'on' : ''}
                    onClick={() => {
                      setStatusFilter(s);
                      setPage(1);
                    }}
                  >
                    {s} ({count})
                  </button>
                );
              })}
            </span>
          </div>

          <div className="row player-filter-actions-row" style={{ gap: '10px' }}>
            <select
              value={sourceFilter}
              onChange={e => {
                setSourceFilter(e.target.value);
                setPage(1);
              }}
              className="enqu-panel-input"
              style={{ width: 'auto', padding: '9px 12px', cursor: 'pointer' }}
            >
              <option value="All">All sources</option>
              <option value="Agent">Agent</option>
              <option value="Direct">Direct</option>
              <option value="Referral">Referral</option>
            </select>

            <select
              value={sortFilter}
              onChange={e => {
                setSortFilter(e.target.value as any);
                setPage(1);
              }}
              className="enqu-panel-input"
              style={{ width: 'auto', padding: '9px 12px', cursor: 'pointer' }}
            >
              <option value="new">Newest</option>
              <option value="bal">Highest balance</option>
              <option value="act">Most games</option>
            </select>

            <button
              type="button"
              className="enqu-btn-secondary"
              style={{ padding: '9px 16px', fontSize: '13px' }}
              onClick={handleExportCSV}
            >
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* 4. Main 2-Column Split Layout (.grid.g2 = 1.7fr 1fr) */}
      <div className="grid g2">
        {/* LEFT COLUMN: Players Table */}
        <div className="card">
          <h3>Players</h3>
          <div className="wrap">
            <table>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Status</th>
                  <th>Wallet</th>
                  <th>Bonus</th>
                  <th>Games</th>
                  <th>Last active</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {isLoadingList ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '28px', color: 'var(--mute)' }}>
                      Loading real player directory...
                    </td>
                  </tr>
                ) : players.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '28px', color: 'var(--mute)' }}>
                      No players match your search or filter.
                    </td>
                  </tr>
                ) : (
                  players.map(p => {
                    const isSelected = selectedPlayerId === p.id;
                    const statusClass =
                      p.status === 'Active' ? 'b ok' :
                      p.status === 'Suspended' ? 'b w' : 'b o';

                    return (
                      <tr
                        key={p.id}
                        className={isSelected ? 'sel' : ''}
                        onClick={() => setSelectedPlayerId(p.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>
                          <div className="row" style={{ flexWrap: 'nowrap', gap: '10px' }}>
                            <span className="av2">{ini(p.name)}</span>
                            <div>
                              <button
                                type="button"
                                className="lk"
                                onClick={e => {
                                  e.stopPropagation();
                                  setSelectedPlayerId(p.id);
                                }}
                              >
                                {p.name}
                              </button>
                              <div className="tr" style={{ fontSize: '12px' }}>
                                {p.playerCode} · {p.phone}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={statusClass}>{p.status}</span>
                        </td>
                        <td>{fmt(p.wallet)} ETB</td>
                        <td>{fmt(p.bonus)} ETB</td>
                        <td>{fmt(p.games)}</td>
                        <td>{p.lastActive}</td>
                        <td>
                          <button
                            type="button"
                            className={p.status === 'Suspended' ? 'k' : ''}
                            style={{ padding: '5px 12px', fontSize: '12.5px' }}
                            onClick={e => {
                              e.stopPropagation();
                              setSelectedPlayerId(p.id);
                              if (p.status === 'Suspended') {
                                handleToggleStatus('active');
                              } else {
                                setShowSuspendModal(true);
                              }
                            }}
                          >
                            {p.status === 'Suspended' ? 'Activate' : 'Suspend'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer with Pagination */}
          <div className="row" style={{ justifyContent: 'space-between', marginTop: '14px' }}>
            <span className="tr">
              Showing {startRecord}-{endRecord} of {totalCount}
            </span>
            <span className="row" style={{ gap: '6px' }}>
              <button
                type="button"
                className="enqu-btn-secondary"
                style={{ padding: '6px 14px', fontSize: '12.5px' }}
                disabled={page <= 1 || isLoadingList}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                Prev
              </button>
              <button
                type="button"
                className="enqu-btn-secondary"
                style={{ padding: '6px 14px', fontSize: '12.5px' }}
                disabled={endRecord >= totalCount || isLoadingList}
                onClick={() => setPage(p => p + 1)}
              >
                Next
              </button>
            </span>
          </div>
        </div>

        {/* RIGHT COLUMN: Player Deep-Dive Dossier */}
        {selectedDetails ? (
          <div className="card">
            {/* Player Identity Header */}
            <div className="row" style={{ flexWrap: 'nowrap', gap: '12px' }}>
              <span className="av2 big">{ini(selectedDetails.name)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--ink)' }}>
                  {selectedDetails.name}
                </div>
                <div className="tr" style={{ fontSize: '12.5px' }}>
                  {selectedDetails.id.slice(0, 8)} · {selectedDetails.phone}
                </div>
              </div>
              <span className={selectedDetails.status === 'Active' ? 'b ok' : selectedDetails.status === 'Suspended' ? 'b w' : 'b o'}>
                {selectedDetails.status}
              </span>
            </div>

            {/* 4 Quick Stat Cards (.two grid on var(--panel)) */}
            <div className="two" style={{ marginTop: '14px', gap: '10px' }}>
              <div className="card" style={{ background: 'var(--panel)', padding: '12px 14px' }}>
                <div className="lab">Wallet (withdrawable)</div>
                <div className="val" style={{ margin: '4px 0', fontSize: '20px' }}>
                  {fmt(selectedDetails.wallet)} ETB
                </div>
              </div>
              <div className="card" style={{ background: 'var(--panel)', padding: '12px 14px' }}>
                <div className="lab">Bonus wallet</div>
                <div className="val" style={{ margin: '4px 0', fontSize: '20px' }}>
                  {fmt(selectedDetails.bonus)} ETB
                </div>
                <div className="tr" style={{ fontSize: '11px' }}>
                  Play only, not withdrawable
                </div>
              </div>
              <div className="card" style={{ background: 'var(--panel)', padding: '12px 14px' }}>
                <div className="lab">Coins</div>
                <div className="val" style={{ margin: '4px 0', fontSize: '20px' }}>
                  {fmt(selectedDetails.coins)}
                </div>
                <div className="tr" style={{ fontSize: '11px' }}>
                  1,000 coins = 20 ETB (Bonus)
                </div>
              </div>
              <div className="card" style={{ background: 'var(--panel)', padding: '12px 14px' }}>
                <div className="lab">Net result</div>
                <div className="val" style={{ margin: '4px 0', fontSize: '20px', color: selectedDetails.netResult >= 0 ? '#2e9e4f' : 'var(--ink)' }}>
                  {selectedDetails.netResult >= 0 ? '+' : '-'}ETB {fmt(Math.abs(selectedDetails.netResult))}
                </div>
                <div className="tr" style={{ fontSize: '11px' }}>
                  Won minus staked
                </div>
              </div>
            </div>

            {/* 3 Action Buttons */}
            <div className="row" style={{ margin: '14px 0 12px', gap: '8px' }}>
              <button
                type="button"
                className="k"
                style={{ padding: '8px 16px', fontSize: '13px' }}
                onClick={() => {
                  if (selectedDetails.status === 'Suspended') {
                    handleToggleStatus('active');
                  } else {
                    setShowSuspendModal(true);
                  }
                }}
              >
                {selectedDetails.status === 'Suspended' ? 'Activate' : 'Suspend'}
              </button>
              <button
                type="button"
                className="enqu-btn-secondary"
                style={{ padding: '8px 16px', fontSize: '13px' }}
                onClick={() => setShowAdjustModal(true)}
              >
                Adjust balance
              </button>
              <button
                type="button"
                className="enqu-btn-secondary"
                style={{ padding: '8px 16px', fontSize: '13px' }}
                onClick={() => setShowMessageModal(true)}
              >
                Message
              </button>
            </div>

            {/* 4 Inspection Tabs */}
            <div className="tabs" style={{ marginBottom: '12px', gap: '6px' }}>
              {[
                ['ov', 'Overview'],
                ['tx', 'Transactions'],
                ['gm', 'Games'],
                ['lg', 'Audit log']
              ].map(([tKey, tLabel]) => (
                <button
                  key={tKey}
                  type="button"
                  className={activeTab === tKey ? 'on' : ''}
                  onClick={() => setActiveTab(tKey as any)}
                >
                  {tLabel}
                </button>
              ))}
            </div>

            {/* TAB CONTENT */}
            <div className="wrap">
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'ov' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div className="lg"><span style={{ color: 'var(--mute)' }}>Phone</span><b>{selectedDetails.phone}</b></div>
                  <div className="lg"><span style={{ color: 'var(--mute)' }}>City</span><b>{selectedDetails.city}</b></div>
                  <div className="lg"><span style={{ color: 'var(--mute)' }}>Source</span><b>{selectedDetails.source}</b></div>
                  <div className="lg"><span style={{ color: 'var(--mute)' }}>Referred by</span><b>{selectedDetails.referredBy}</b></div>
                  <div className="lg"><span style={{ color: 'var(--mute)' }}>Referral code / invites</span><b>{selectedDetails.referralCode} / {selectedDetails.referralCount}</b></div>
                  <div className="lg"><span style={{ color: 'var(--mute)' }}>Joined</span><b>{selectedDetails.joinedAt}</b></div>
                  <div className="lg"><span style={{ color: 'var(--mute)' }}>Last active</span><b>{selectedDetails.lastActive}</b></div>
                  <div className="lg"><span style={{ color: 'var(--mute)' }}>Phone verified</span><b>{selectedDetails.kycStatus}</b></div>

                  <div className="sec" style={{ marginTop: '12px', paddingTop: '10px' }} />

                  <div className="lg"><span style={{ color: 'var(--mute)' }}>Total deposits</span><b>ETB {fmt(selectedDetails.totalDeposits)}</b></div>
                  <div className="lg"><span style={{ color: 'var(--mute)' }}>Total withdrawals</span><b>ETB {fmt(selectedDetails.totalWithdrawals)}</b></div>
                  <div className="lg"><span style={{ color: 'var(--mute)' }}>Total staked</span><b>ETB {fmt(selectedDetails.totalStaked)}</b></div>
                  <div className="lg"><span style={{ color: 'var(--mute)' }}>Total won</span><b>ETB {fmt(selectedDetails.totalWon)}</b></div>
                  <div className="lg"><span style={{ color: 'var(--mute)' }}>Games / wins</span><b>{fmt(selectedDetails.gamesCount)} / {selectedDetails.winsCount}</b></div>

                  {/* Internal Notes Section */}
                  <div className="sec" style={{ marginTop: '14px', paddingTop: '10px' }}>
                    <h4 style={{ marginBottom: '8px' }}>Internal notes</h4>
                    <div className="row" style={{ flexWrap: 'nowrap', gap: '8px' }}>
                      <input
                        type="text"
                        placeholder="Add a note..."
                        value={newNoteInput}
                        onChange={e => setNewNoteInput(e.target.value)}
                        className="enqu-panel-input"
                        style={{ padding: '8px 12px', flex: 1 }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleAddNote();
                        }}
                      />
                      <button
                        type="button"
                        className="k"
                        disabled={isAddingNote || !newNoteInput.trim()}
                        onClick={handleAddNote}
                        style={{ padding: '8px 16px' }}
                      >
                        {isAddingNote ? 'Adding...' : 'Add'}
                      </button>
                    </div>

                    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {selectedDetails.notes.length === 0 ? (
                        <div className="tr" style={{ fontSize: '12.5px', color: 'var(--mute)' }}>
                          No notes recorded for this player yet.
                        </div>
                      ) : (
                        selectedDetails.notes.map(n => (
                          <div key={n.id} className="tr" style={{ fontSize: '12.5px', color: 'var(--ink)' }}>
                            <span style={{ color: 'var(--mute)', marginRight: '6px' }}>{n.createdAt} ·</span>
                            {n.note}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: TRANSACTIONS */}
              {activeTab === 'tx' && (
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Wallet</th>
                      <th>Amount (ETB)</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedDetails.txs.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ color: 'var(--mute)', textAlign: 'center', padding: '16px' }}>
                          No transactions found.
                        </td>
                      </tr>
                    ) : (
                      selectedDetails.txs.map((tx, idx) => (
                        <tr key={idx}>
                          <td>{tx[0]}</td>
                          <td>{tx[1]}</td>
                          <td>{tx[2]}</td>
                          <td style={{ color: tx[3].startsWith('+') ? '#2e9e4f' : 'inherit' }}>{tx[3]}</td>
                          <td>
                            <span className="b ok" style={{ fontSize: '11px', padding: '2px 8px' }}>
                              {tx[4]}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

              {/* TAB 3: GAMES */}
              {activeTab === 'gm' && (
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Room</th>
                      <th>Stake</th>
                      <th>Cartelas</th>
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedDetails.gms.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ color: 'var(--mute)', textAlign: 'center', padding: '16px' }}>
                          No games played yet.
                        </td>
                      </tr>
                    ) : (
                      selectedDetails.gms.map((g, idx) => (
                        <tr key={idx}>
                          <td>{g[0]}</td>
                          <td>{g[1]}</td>
                          <td>{g[2]}</td>
                          <td>{g[3]}</td>
                          <td style={{ color: g[4] === 'Won' ? '#2e9e4f' : 'inherit', fontWeight: 700 }}>
                            {g[4]}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

              {/* TAB 4: AUDIT LOG */}
              {activeTab === 'lg' && (
                <table>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Action</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedDetails.logs.length === 0 ? (
                      <tr>
                        <td colSpan={3} style={{ color: 'var(--mute)', textAlign: 'center', padding: '16px' }}>
                          No audit log entries recorded.
                        </td>
                      </tr>
                    ) : (
                      selectedDetails.logs.map(l => (
                        <tr key={l.id}>
                          <td style={{ fontSize: '12px', color: 'var(--mute)' }}>{l.t}</td>
                          <td>
                            <span className="b" style={{ fontSize: '11.5px', background: 'var(--chip)', color: 'var(--ink)' }}>
                              {l.a}
                            </span>
                          </td>
                          <td style={{ whiteSpace: 'normal', fontSize: '12.5px' }}>{l.d}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ) : (
          <div className="card" style={{ display: 'grid', placeItems: 'center', minHeight: '300px', color: 'var(--mute)' }}>
            {isLoadingDetails ? 'Loading player dossier...' : 'Select a player to view details'}
          </div>
        )}
      </div>

      {/* 5. SUSPEND PLAYER MODAL */}
      {showSuspendModal && selectedDetails && (
        <div className="modalbg">
          <div className="modal" style={{ maxWidth: '520px' }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>
                Suspend {selectedDetails.name}
              </h3>
              <button
                type="button"
                onClick={() => setShowSuspendModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--mute)' }}
              >
                ✕
              </button>
            </div>

            <div className="tr" style={{ fontSize: '13px', color: 'var(--mute)', marginBottom: '14px' }}>
              Suspending blocks play, deposits, and withdrawals. The action and reason are permanently recorded in the audit log.
            </div>

            <label className="enqu-form-label">Reason</label>
            <select
              value={suspendReason}
              onChange={e => setSuspendReason(e.target.value)}
              className="enqu-modal-input"
            >
              <option value="Suspicious activity">Suspicious activity</option>
              <option value="Multi-accounting">Multi-accounting</option>
              <option value="Terms of service violation">Terms of service violation</option>
              <option value="Payment dispute / Chargeback">Payment dispute / Chargeback</option>
              <option value="Responsible gaming / User request">Responsible gaming / User request</option>
              <option value="Other / Manual investigation">Other / Manual investigation</option>
            </select>

            <label className="enqu-form-label" style={{ marginTop: '14px' }}>
              Internal note (Optional)
            </label>
            <textarea
              value={suspendNote}
              onChange={e => setSuspendNote(e.target.value)}
              placeholder="Add context or notes for the compliance team..."
              className="enqu-modal-input"
              style={{ minHeight: '80px' }}
            />

            <label className="row" style={{ marginTop: '16px', color: 'var(--ink)', cursor: 'pointer', fontSize: '13.5px' }}>
              <input
                type="checkbox"
                checked={suspendNotify}
                onChange={e => setSuspendNotify(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#1679ad' }}
              />
              <span>Notify player via Telegram Bot</span>
            </label>

            <div className="row" style={{ justifyContent: 'flex-end', marginTop: '22px', gap: '10px' }}>
              <button
                type="button"
                className="enqu-btn-secondary"
                onClick={() => setShowSuspendModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="enqu-btn-primary"
                style={{ background: '#b0302f' }}
                disabled={isSubmittingStatus}
                onClick={() => handleToggleStatus('suspended')}
              >
                {isSubmittingStatus ? 'Suspending...' : 'Suspend player'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. ADJUST BALANCE MODAL */}
      {showAdjustModal && selectedDetails && (
        <div className="modalbg">
          <div className="modal" style={{ maxWidth: '520px' }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>
                Adjust balance: {selectedDetails.name}
              </h3>
              <button
                type="button"
                onClick={() => setShowAdjustModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--mute)' }}
              >
                ✕
              </button>
            </div>

            <div className="tr" style={{ fontSize: '13px', color: 'var(--mute)', marginBottom: '14px' }}>
              Withdrawable: <strong>{fmt(selectedDetails.wallet)} ETB</strong> · Bonus:{' '}
              <strong>{fmt(selectedDetails.bonus)} ETB</strong>
            </div>

            <div className="two" style={{ gap: '12px' }}>
              <div>
                <label className="enqu-form-label">Wallet</label>
                <select
                  value={adjustWallet}
                  onChange={e => setAdjustWallet(e.target.value as any)}
                  className="enqu-modal-input"
                >
                  <option value="wal">Withdrawable</option>
                  <option value="bon">Bonus</option>
                </select>
              </div>
              <div>
                <label className="enqu-form-label">Type</label>
                <select
                  value={adjustType}
                  onChange={e => setAdjustType(e.target.value as any)}
                  className="enqu-modal-input"
                >
                  <option value="Credit">Credit (+)</option>
                  <option value="Debit">Debit (-)</option>
                </select>
              </div>
            </div>

            <label className="enqu-form-label" style={{ marginTop: '12px' }}>
              Amount (ETB)
            </label>
            <input
              type="number"
              min="1"
              value={adjustAmount}
              onChange={e => setAdjustAmount(e.target.value)}
              className="enqu-modal-input"
            />

            <label className="enqu-form-label" style={{ marginTop: '12px' }}>
              Reason
            </label>
            <select
              value={adjustReason}
              onChange={e => setAdjustReason(e.target.value)}
              className="enqu-modal-input"
            >
              <option value="Correction">Correction</option>
              <option value="Goodwill">Goodwill</option>
              <option value="Promotion">Promotion</option>
              <option value="Dispute refund">Dispute refund</option>
            </select>

            <label className="enqu-form-label" style={{ marginTop: '12px' }}>
              Note (Required)
            </label>
            <textarea
              value={adjustNote}
              onChange={e => setAdjustNote(e.target.value)}
              placeholder="Explain reason for this adjustment..."
              className="enqu-modal-input"
              style={{ minHeight: '80px' }}
            />

            <div className="tr" style={{ fontSize: '12px', color: 'var(--mute)', marginTop: '10px' }}>
              Every balance adjustment is written to the immutable ledger and audit log.
            </div>

            <div className="row" style={{ justifyContent: 'flex-end', marginTop: '20px', gap: '10px' }}>
              <button
                type="button"
                className="enqu-btn-secondary"
                onClick={() => setShowAdjustModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="enqu-btn-primary"
                disabled={isSubmittingAdjust || !adjustNote.trim() || !(parseFloat(adjustAmount) > 0)}
                onClick={handleAdjustBalance}
              >
                {isSubmittingAdjust ? 'Applying...' : 'Apply adjustment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. DIRECT TELEGRAM MESSAGE MODAL */}
      {showMessageModal && selectedDetails && (
        <div className="modalbg">
          <div className="modal" style={{ maxWidth: '520px' }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>
                Message {selectedDetails.name} via Telegram
              </h3>
              <button
                type="button"
                onClick={() => setShowMessageModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--mute)' }}
              >
                ✕
              </button>
            </div>

            <div className="tr" style={{ fontSize: '13px', color: 'var(--mute)', marginBottom: '14px' }}>
              Sends an official direct notification from <strong>@SonicGameOfficialBot</strong> to the player&apos;s Telegram client.
            </div>

            {!selectedDetails.telegramId && (
              <div style={{
                background: '#fef3c7',
                border: '1px solid #fde68a',
                color: '#92400e',
                borderRadius: '12px',
                padding: '10px 12px',
                fontSize: '12.5px',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <i className="fa-solid fa-triangle-exclamation"></i>
                <span>This player does not have a linked Telegram account. Direct messages can only be delivered to players who joined via @SonicGameOfficialBot.</span>
              </div>
            )}

            {/* Quick Templates */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mute)', marginBottom: '6px' }}>
                Quick message templates:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {[
                  { label: '👋 Verification Required', text: 'Hello, this is Sonic Bingo Compliance. Please reply to this message with your phone verification details to complete your account review.' },
                  { label: '🎉 Congratulations on Win', text: 'Congratulations on your recent win on Sonic Bingo! Your winnings are now available in your withdrawable wallet. Enjoy!' },
                  { label: '💳 Deposit Support', text: 'Hello! We noticed your recent deposit request. Our team is here to assist if you need any help with your transaction.' },
                  { label: '⚠️ Security Notice', text: 'Hello, please be advised that our compliance team noticed unusual activity on your account. Please confirm your details with support.' }
                ].map((tpl) => (
                  <button
                    key={tpl.label}
                    type="button"
                    onClick={() => setDirectMessageText(tpl.text)}
                    style={{
                      background: 'var(--chip)',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '4px 10px',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      color: 'var(--ink)'
                    }}
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="enqu-form-label">Message Content</label>
            <textarea
              value={directMessageText}
              onChange={e => setDirectMessageText(e.target.value)}
              placeholder="Write message to send to the player..."
              className="enqu-modal-input"
              style={{ minHeight: '110px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
              <span style={{ fontSize: '11px', color: 'var(--mute)' }}>HTML formatting &amp; Telegram Markdown supported</span>
              <span style={{ fontSize: '11.5px', color: 'var(--mute)', fontWeight: 600 }}>{directMessageText.length} chars</span>
            </div>

            <div className="row" style={{ justifyContent: 'flex-end', marginTop: '20px', gap: '10px' }}>
              <button
                type="button"
                className="enqu-btn-secondary"
                onClick={() => setShowMessageModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="enqu-btn-primary"
                disabled={isSendingMessage || !directMessageText.trim() || !selectedDetails.telegramId}
                onClick={handleSendMessage}
              >
                {isSendingMessage ? 'Sending...' : 'Send Telegram Message'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayerAccountsDesk;
