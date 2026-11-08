import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { getApiBase, LIVE_BACKEND_ORIGIN } from '../../config/env.ts';
import { getAdminAuthHeader } from '../../services/apiClient.ts';

// Helper to format currency numbers with commas
const fmt = (n: number | string) => Number(n || 0).toLocaleString('en-US');

// Helper to get 2-letter initials from bot name
const ini = (name: string) => {
  if (!name) return 'BT';
  const clean = name.replace(/[^\w\s]/gi, '').trim();
  if (!clean) return name.slice(0, 2).toUpperCase();
  return clean
    .split(' ')
    .filter(Boolean)
    .map(w => w[0] || '')
    .slice(0, 2)
    .join('')
    .toUpperCase();
};

export interface BotPlayerAccount {
  id: string;
  botCode: string;
  name: string;
  phone: string;
  gender: 'female' | 'male';
  status: string;
  isSeated: boolean;
  activeCartelaId?: number | null;
  activeRoundNumber?: number | null;
  totalWins: number;
  totalWonAmount: number;
  source: string;
  joinedAt: string;
  lastActive: string;
}

interface BotStats {
  totalBots: number;
  activeInRoom: number;
  scheduleRange: string;
  scheduleWindowLabel: string;
  scheduleWindowAmharic: string;
  isSleepMode: boolean;
  targetBots: number;
  femaleCount: number;
  maleCount: number;
  totalBotWins: number;
  totalBotWonAmount: number;
}

export const BotsSimulatorDesk: React.FC = () => {
  const { showToast } = useApp();

  // Real Data State (0 Mock Data)
  const [stats, setStats] = useState<BotStats>({
    totalBots: 200,
    activeInRoom: 0,
    scheduleRange: '0 - 50 Bots',
    scheduleWindowLabel: 'Living Clock Syncing',
    scheduleWindowAmharic: 'የሰዓት ሰንጠረዥ በመጫን ላይ...',
    isSleepMode: false,
    targetBots: 0,
    femaleCount: 62,
    maleCount: 138,
    totalBotWins: 0,
    totalBotWonAmount: 0
  });

  const [bots, setBots] = useState<BotPlayerAccount[]>([]);
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'all' | 'active' | 'top-winners' | 'female' | 'male'>('all');
  const [page, setPage] = useState<number>(1);
  const limit = 25;

  // Real API Fetch Helper
  const apiFetch = async (endpoint: string, options: RequestInit = {}): Promise<Response> => {
    const adminAuth = await getAdminAuthHeader();
    const headers = {
      ...adminAuth,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };
    const opts: RequestInit = { ...options, headers };

    try {
      const res = await fetch(`${getApiBase()}${endpoint}`, opts);
      if (res.ok || res.status !== 404) return res;
    } catch {}

    return fetch(`${LIVE_BACKEND_ORIGIN}/api${endpoint}`, opts);
  };

  // Fetch Real Bot Roster & Telemetry
  const loadBotPlayers = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        search: searchQuery.trim(),
        filter: filterMode
      });

      const res = await apiFetch(`/admin/bot-players?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setStats(data.stats);
          setBots(data.bots || []);

          // Auto-select first bot if current selection is not in list
          if (data.bots && data.bots.length > 0) {
            if (!selectedBotId || !data.bots.some((b: BotPlayerAccount) => b.id === selectedBotId)) {
              setSelectedBotId(data.bots[0].id);
            }
          } else {
            setSelectedBotId(null);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load real bot players:', e);
      showToast('⚠️ Could not sync live bot telemetry');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, filterMode, selectedBotId]);

  useEffect(() => {
    loadBotPlayers();
  }, [searchQuery, filterMode]);

  // Selected Bot details
  const selectedBot = bots.find(b => b.id === selectedBotId) || bots[0] || null;

  // Client-side pagination for the filtered list
  const totalCount = bots.length;
  const totalPages = Math.ceil(totalCount / limit) || 1;
  const paginatedBots = bots.slice((page - 1) * limit, page * limit);

  return (
    <div className="enqu-dashboard-main">
      {/* 1. Header Row */}
      <div className="top" style={{ marginBottom: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: 'var(--ink)' }}>
            🤖 Bot Player Accounts Desk
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '13.5px', color: 'var(--mute)' }}>
            200 authentic Ethiopian bot profiles in Room 10, real-time lobby occupancy, win telemetry, and demographic distribution.
          </p>
        </div>

        <div className="row" style={{ gap: '10px' }}>
          <button
            type="button"
            className="enqu-btn-secondary"
            onClick={() => {
              loadBotPlayers();
              showToast('🔄 Bot roster and live room telemetry refreshed');
            }}
            title="Refresh Live Bot Roster"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh Roster</span>
          </button>
        </div>
      </div>

      {/* 2. Top 4 Live KPI Cards (Matching Player Accounts Enqu Design) */}
      <div className="grid g4" style={{ marginBottom: '16px' }}>
        {/* Card 1: Total Standby Roster */}
        <div className="card d">
          <div className="lab">Total Standby Pool</div>
          <div className="val">{fmt(stats.totalBots)}</div>
          <div className="tr">
            <span className="up" style={{ color: '#3fbf62', fontWeight: 700 }}>
              100% Authentic Roster
            </span>
            <span>Cultural Ethiopian Names</span>
          </div>
        </div>

        {/* Card 2: Active in Room 10 */}
        <div className="card">
          <div className="lab">Active in Room 10 Now</div>
          <div className="val" style={{ color: stats.activeInRoom > 0 ? '#2e9e4f' : 'var(--ink)' }}>
            {fmt(stats.activeInRoom)} Bots
          </div>
          <div className="tr" style={{ color: stats.activeInRoom > 0 ? '#2e9e4f' : 'var(--mute)', fontWeight: 600 }}>
            {stats.activeInRoom > 0 ? '🟢 Live Seated in Lobby' : '⚪ Waiting for Round'}
          </div>
        </div>

        {/* Card 3: Hourly Schedule Window */}
        <div className="card">
          <div className="lab">Hourly Target Range (EAT)</div>
          <div className="val" style={{ fontSize: '20px' }}>{stats.scheduleRange}</div>
          <div className="tr" style={{ color: stats.isSleepMode ? '#ef4444' : '#2e9e4f', fontWeight: 600 }}>
            {stats.scheduleWindowLabel}
          </div>
        </div>

        {/* Card 4: Real Cumulative Bot Wins */}
        <div className="card">
          <div className="lab">Real Bot Rounds Won</div>
          <div className="val" style={{ color: '#f59e0b' }}>
            {fmt(stats.totalBotWins)} <span style={{ fontSize: '13px', color: 'var(--mute)' }}>Wins</span>
          </div>
          <div className="tr">
            <span style={{ fontWeight: 600, color: 'var(--ink)' }}>
              ETB {fmt(stats.totalBotWonAmount)} Paid
            </span>
            <span>Neon DB Ledger</span>
          </div>
        </div>
      </div>

      {/* 3. Filter Ribbon Card (Search + Segment Pills) */}
      <div className="card filter-ribbon-card" style={{ marginBottom: '16px', padding: '12px 16px' }}>
        <div className="row" style={{ justifyContent: 'space-between', width: '100%', gap: '12px', flexWrap: 'wrap' }}>
          <div className="row" style={{ gap: '10px', flex: '1 1 300px' }}>
            {/* Search Input */}
            <input
              type="text"
              placeholder="Search by bot name, phone prefix (0911...), or ID..."
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="enqu-panel-input"
              style={{ minWidth: '260px', flex: 1 }}
            />

            {/* Segment Filter Tabs */}
            <span className="tabs" style={{ margin: 0, display: 'inline-flex', flexWrap: 'wrap' }}>
              {[
                { id: 'all', label: `All Bots (${stats.totalBots})` },
                { id: 'active', label: `Active (${stats.activeInRoom})` },
                { id: 'top-winners', label: 'Winners' },
                { id: 'female', label: `Female (${stats.femaleCount})` },
                { id: 'male', label: `Male (${stats.maleCount})` }
              ].map(tab => (
                <a
                  key={tab.id}
                  className={filterMode === tab.id ? 'on' : ''}
                  onClick={() => {
                    setFilterMode(tab.id as any);
                    setPage(1);
                  }}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  {tab.label}
                </a>
              ))}
            </span>
          </div>

          <div className="row" style={{ gap: '10px' }}>
            <span className="tr" style={{ fontSize: '13px', color: 'var(--mute)' }}>
              Demographics: <strong>{stats.femaleCount} Female</strong> / <strong>{stats.maleCount} Male</strong>
            </span>
          </div>
        </div>
      </div>

      {/* 4. Main Two-Column Master-Detail Layout */}
      <div className="grid g2" style={{ alignItems: 'start' }}>
        {/* Left Column: Interactive Bots Master Table */}
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <div className="wrap" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table className="enqu-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '12px 14px' }}>Code</th>
                  <th style={{ textAlign: 'left', padding: '12px 14px' }}>Bot Identity & Phone</th>
                  <th style={{ textAlign: 'center', padding: '12px 14px' }}>Gender</th>
                  <th style={{ textAlign: 'center', padding: '12px 14px' }}>Room 10 Status</th>
                  <th style={{ textAlign: 'right', padding: '12px 14px' }}>Wins</th>
                  <th style={{ textAlign: 'right', padding: '12px 14px' }}>Won (ETB)</th>
                  <th style={{ textAlign: 'center', padding: '12px 14px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--mute)' }}>
                      🔄 Fetching live bot roster and engine telemetry...
                    </td>
                  </tr>
                ) : paginatedBots.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--mute)' }}>
                      No bot accounts match your current filter criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedBots.map(b => {
                    const isSelected = selectedBotId === b.id;

                    return (
                      <tr
                        key={b.id}
                        onClick={() => setSelectedBotId(b.id)}
                        className={isSelected ? 'sel' : ''}
                        style={{
                          cursor: 'pointer',
                          background: isSelected ? 'var(--chip)' : undefined,
                          transition: 'background 0.12s ease'
                        }}
                      >
                        {/* Bot Code */}
                        <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontSize: '12.5px', color: 'var(--mute)' }}>
                          {b.botCode}
                        </td>

                        {/* Identity & Phone */}
                        <td style={{ padding: '12px 14px' }}>
                          <div className="row" style={{ flexWrap: 'nowrap', gap: '10px', alignItems: 'center' }}>
                            <span
                              className="av2"
                              style={{
                                width: '34px',
                                height: '34px',
                                borderRadius: '50%',
                                background: b.gender === 'female' ? '#fdf2f8' : '#eff6ff',
                                color: b.gender === 'female' ? '#db2777' : '#2563eb',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '12px',
                                flexShrink: 0
                              }}
                            >
                              {ini(b.name)}
                            </span>
                            <div>
                              <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: '14px' }}>
                                {b.name}
                              </div>
                              <div className="tr" style={{ fontSize: '12px', color: 'var(--mute)' }}>
                                {b.phone}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Gender Badge */}
                        <td style={{ textAlign: 'center', padding: '12px 14px' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '10px',
                              background: b.gender === 'female' ? '#fce7f3' : '#dbeafe',
                              color: b.gender === 'female' ? '#9d174d' : '#1e40af'
                            }}
                          >
                            {b.gender === 'female' ? 'Female' : 'Male'}
                          </span>
                        </td>

                        {/* Room 10 Status */}
                        <td style={{ textAlign: 'center', padding: '12px 14px' }}>
                          {b.isSeated ? (
                            <span
                              className="b ok"
                              style={{
                                fontSize: '11.5px',
                                padding: '3px 8px',
                                borderRadius: '12px',
                                background: '#ecfdf5',
                                color: '#065f46',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                              Seated (Card #{b.activeCartelaId || '—'})
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: '11.5px',
                                padding: '3px 8px',
                                borderRadius: '12px',
                                background: '#f1f5f9',
                                color: '#64748b',
                                fontWeight: 600
                              }}
                            >
                              Standby Pool
                            </span>
                          )}
                        </td>

                        {/* Wins */}
                        <td style={{ textAlign: 'right', padding: '12px 14px', fontWeight: 700, color: b.totalWins > 0 ? '#d97706' : 'var(--ink)' }}>
                          {b.totalWins}
                        </td>

                        {/* Won (ETB) */}
                        <td style={{ textAlign: 'right', padding: '12px 14px', fontWeight: 600, color: b.totalWonAmount > 0 ? '#16a34a' : 'var(--mute)' }}>
                          {b.totalWonAmount > 0 ? `ETB ${fmt(b.totalWonAmount)}` : '0.00'}
                        </td>

                        {/* Action */}
                        <td style={{ textAlign: 'center', padding: '12px 14px' }}>
                          <button
                            type="button"
                            className="enqu-btn-secondary"
                            onClick={e => {
                              e.stopPropagation();
                              setSelectedBotId(b.id);
                            }}
                            style={{ padding: '3px 10px', fontSize: '12px' }}
                          >
                            Dossier
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Row */}
          <div className="row" style={{ justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid var(--line)' }}>
            <span className="tr" style={{ fontSize: '13px', color: 'var(--mute)' }}>
              Showing {Math.min((page - 1) * limit + 1, totalCount)} to {Math.min(page * limit, totalCount)} of {totalCount} authentic bots
            </span>

            <div className="row" style={{ gap: '6px' }}>
              <button
                type="button"
                className="enqu-btn-secondary"
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                style={{ padding: '4px 10px', fontSize: '12px', opacity: page <= 1 ? 0.5 : 1 }}
              >
                Previous
              </button>
              <button
                type="button"
                className="enqu-btn-secondary"
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                style={{ padding: '4px 10px', fontSize: '12px', opacity: page >= totalPages ? 0.5 : 1 }}
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Bot Player Dossier Panel (Mirroring Player Accounts UI) */}
        {selectedBot ? (
          <div className="card" style={{ padding: '18px 20px', position: 'sticky', top: '16px' }}>
            {/* Header: Avatar, Name & Code */}
            <div className="row" style={{ flexWrap: 'nowrap', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
              <span
                className="av2 big"
                style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '50%',
                  background: selectedBot.gender === 'female' ? '#fdf2f8' : '#eff6ff',
                  color: selectedBot.gender === 'female' ? '#db2777' : '#2563eb',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '18px',
                  flexShrink: 0
                }}
              >
                {ini(selectedBot.name)}
              </span>

              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--ink)' }}>
                  {selectedBot.name}
                </h3>
                <div className="tr" style={{ fontSize: '13px', color: 'var(--mute)' }}>
                  {selectedBot.botCode} • {selectedBot.phone}
                </div>
              </div>

              <span
                style={{
                  fontSize: '11.5px',
                  padding: '3px 10px',
                  borderRadius: '12px',
                  fontWeight: 700,
                  background: selectedBot.isSeated ? '#ecfdf5' : '#f1f5f9',
                  color: selectedBot.isSeated ? '#065f46' : '#64748b'
                }}
              >
                {selectedBot.status}
              </span>
            </div>

            {/* Quick Metrics Grid (2x2) */}
            <div className="two" style={{ gap: '10px', marginBottom: '16px' }}>
              <div className="card" style={{ background: 'var(--panel)', padding: '12px 14px' }}>
                <div className="lab" style={{ fontSize: '11.5px', color: 'var(--mute)' }}>Cumulative Wins</div>
                <div className="val" style={{ margin: '4px 0', fontSize: '20px', fontWeight: 800, color: '#f59e0b' }}>
                  {selectedBot.totalWins}
                </div>
                <div className="tr" style={{ fontSize: '11px', color: 'var(--mute)' }}>Neon DB Rounds</div>
              </div>

              <div className="card" style={{ background: 'var(--panel)', padding: '12px 14px' }}>
                <div className="lab" style={{ fontSize: '11.5px', color: 'var(--mute)' }}>Total Won Amount</div>
                <div className="val" style={{ margin: '4px 0', fontSize: '20px', fontWeight: 800, color: '#2e9e4f' }}>
                  ETB {fmt(selectedBot.totalWonAmount)}
                </div>
                <div className="tr" style={{ fontSize: '11px', color: 'var(--mute)' }}>Net Player Payout</div>
              </div>

              <div className="card" style={{ background: 'var(--panel)', padding: '12px 14px' }}>
                <div className="lab" style={{ fontSize: '11.5px', color: 'var(--mute)' }}>Active Cartela</div>
                <div className="val" style={{ margin: '4px 0', fontSize: '20px', fontWeight: 800, color: 'var(--ink)' }}>
                  {selectedBot.activeCartelaId ? `#${selectedBot.activeCartelaId}` : '—'}
                </div>
                <div className="tr" style={{ fontSize: '11px', color: 'var(--mute)' }}>Room 10 Assignment</div>
              </div>

              <div className="card" style={{ background: 'var(--panel)', padding: '12px 14px' }}>
                <div className="lab" style={{ fontSize: '11.5px', color: 'var(--mute)' }}>Current Round</div>
                <div className="val" style={{ margin: '4px 0', fontSize: '20px', fontWeight: 800, color: 'var(--ink)' }}>
                  {selectedBot.activeRoundNumber ? `R-${selectedBot.activeRoundNumber}` : 'Standby'}
                </div>
                <div className="tr" style={{ fontSize: '11px', color: 'var(--mute)' }}>Engine Status</div>
              </div>
            </div>

            {/* Profile Dossier Key-Value Rows */}
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: '14px' }}>
              <h4 style={{ margin: '0 0 10px', fontSize: '13.5px', fontWeight: 700, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Bot Profile & Demographics
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--mute)' }}>System ID</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--ink)' }}>{selectedBot.id}</span>
                </div>

                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--mute)' }}>Demographic Gender</span>
                  <span style={{ fontWeight: 700, color: selectedBot.gender === 'female' ? '#db2777' : '#2563eb' }}>
                    {selectedBot.gender === 'female' ? 'Female 🌸' : 'Male ⚡'}
                  </span>
                </div>

                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--mute)' }}>Telecom Prefix</span>
                  <span style={{ fontWeight: 600, color: 'var(--ink)' }}>
                    {selectedBot.phone.startsWith('09') ? 'Ethio Telecom (09xx)' : 'Safaricom (07xx)'}
                  </span>
                </div>

                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--mute)' }}>Designated Arena</span>
                  <span style={{ fontWeight: 600, color: 'var(--ink)' }}>Room 10 (10 Birr Human+Bot Arena)</span>
                </div>

                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--mute)' }}>Multi-Room Isolation</span>
                  <span style={{ fontWeight: 700, color: '#10b981' }}>Rooms 20, 50, 100 Strictly Human Only</span>
                </div>

                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--mute)' }}>Database Footprint</span>
                  <span style={{ fontWeight: 600, color: 'var(--ink)' }}>Zero-DB in Lobby (In-Memory Roster)</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="card" style={{ display: 'grid', placeItems: 'center', minHeight: '300px', color: 'var(--mute)' }}>
            Select a bot profile to view their live dossier.
          </div>
        )}
      </div>
    </div>
  );
};
