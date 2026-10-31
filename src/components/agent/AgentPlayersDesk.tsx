import React, { useState, useEffect } from 'react';
import { apiClient } from '../../services/apiClient.ts';

interface AgentPlayersDeskProps {
  onQuickDeposit: (player: any) => void;
  showToast: (msg: string) => void;
}

export const AgentPlayersDesk: React.FC<AgentPlayersDeskProps> = ({
  onQuickDeposit,
  showToast
}) => {
  const [players, setPlayers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'new'>('all');
  const [isLoading, setIsLoading] = useState(false);

  const fetchPlayers = async () => {
    try {
      setIsLoading(true);
      const res = await apiClient.agent.getPlayers();
      if (res.success && res.players) {
        setPlayers(res.players);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayers();
  }, []);

  const filteredPlayers = players.filter(p => {
    const matchesSearch =
      p.fullName.toLowerCase().includes(search.toLowerCase()) ||
      p.phone.includes(search) ||
      (p.username && p.username.toLowerCase().includes(search.toLowerCase()));

    if (!matchesSearch) return false;
    if (filter === 'active') return p.hasDeposited;
    if (filter === 'new') return !p.hasDeposited;
    return true;
  });

  return (
    <div className="sonic-white-card" style={{ margin: 0 }}>
      {/* Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: 900, textTransform: 'uppercase', color: '#0f172a', margin: 0 }}>
            Referred Players Roster ({players.length})
          </h3>
          <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
            Players registered directly through your agency referral link.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchPlayers}
          disabled={isLoading}
          style={{
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            padding: '6px 14px',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          <i className={`fa-solid fa-rotate-right ${isLoading ? 'fa-spin' : ''}`}></i> Refresh
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <input
          type="text"
          className="sonic-input-field"
          style={{ flex: 1, minWidth: '220px', padding: '10px 14px' }}
          placeholder="Filter by phone or name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <div style={{ display: 'flex', gap: '4px' }}>
          {(['all', 'active', 'new'] as const).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: filter === f ? '1px solid #f59e0b' : '1px solid #e2e8f0',
                background: filter === f ? '#fffbeb' : '#ffffff',
                color: filter === f ? '#b45309' : '#64748b',
                fontWeight: 700,
                fontSize: '12px',
                textTransform: 'capitalize',
                cursor: 'pointer'
              }}
            >
              {f === 'all' ? 'All Players' : f === 'active' ? 'Active Deposited' : 'Pending First Deposit'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filteredPlayers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8', fontSize: '13px' }}>
          No matching players found. Share your referral link to onboard new players!
        </div>
      ) : (
        <div className="sonic-table-shell">
          <table className="sonic-clean-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Phone</th>
                <th>Active Balance</th>
                <th>Total via Agency</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlayers.map(p => (
                <tr key={p.id}>
                  <td>
                    <strong style={{ color: '#0f172a' }}>{p.fullName}</strong>
                    {p.username && <div style={{ fontSize: '11px', color: '#64748b' }}>@{p.username}</div>}
                  </td>
                  <td style={{ fontFamily: 'monospace' }}>{p.phone}</td>
                  <td>
                    <strong style={{ color: '#047857' }}>{p.balance.toFixed(2)} ETB</strong>
                  </td>
                  <td style={{ color: '#b45309', fontWeight: 700 }}>
                    {p.totalDepositedByAgent.toFixed(2)} ETB
                  </td>
                  <td>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '10px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      background: p.hasDeposited ? '#ecfdf5' : '#fffbeb',
                      color: p.hasDeposited ? '#047857' : '#b45309'
                    }}>
                      {p.hasDeposited ? 'Active' : 'Unfunded'}
                    </span>
                  </td>
                  <td style={{ fontSize: '12px', color: '#64748b' }}>
                    {new Date(p.createdAt).toLocaleDateString()}
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => onQuickDeposit(p)}
                      style={{
                        background: '#fef3c7',
                        border: '1px solid #fde68a',
                        color: '#b45309',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      + Deposit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
