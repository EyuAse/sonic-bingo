import React, { useState, useEffect } from 'react';
import { useAdmin } from '../../context/AdminContext.tsx';
import { useApp } from '../../context/AppContext.tsx';
import { apiClient } from '../../services/apiClient.ts';

interface JackpotPoolItem {
  room_id: string;
  name?: string;
  room_name?: string;
  stake_amount?: number;
  balance: number | string;
  seed_amount: number | string;
  last_won_amount?: number | string;
  last_won_at?: string;
  liveBalance?: number;
}

interface JackpotWinnerItem {
  id: string;
  room_id: string;
  room_name?: string;
  winner_name: string;
  winner_phone: string;
  amount: number | string;
  balls_count: number;
  won_at: string;
}

export const JackpotDesk: React.FC = () => {
  const { adminToken } = useAdmin();
  const { showToast } = useApp();

  const [pools, setPools] = useState<JackpotPoolItem[]>([]);
  const [winners, setWinners] = useState<JackpotWinnerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPool, setSelectedPool] = useState<JackpotPoolItem | null>(null);
  const [editBalance, setEditBalance] = useState('');
  const [editSeed, setEditSeed] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchJackpotData = async () => {
    try {
      setLoading(true);
      const res = await apiClient.admin.getJackpots();
      if (res.success) {
        setPools(res.pools || []);
        setWinners(res.winners || []);
      }
    } catch (err) {
      console.error('Failed to fetch jackpot data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJackpotData();
    const interval = setInterval(fetchJackpotData, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenAdjust = (p: JackpotPoolItem) => {
    setSelectedPool(p);
    setEditBalance(String((p.liveBalance ?? p.balance) || 0));
    setEditSeed(String(p.seed_amount));
  };

  const handleSaveAdjust = async () => {
    if (!selectedPool) return;
    const balNum = parseFloat(editBalance);
    const seedNum = parseFloat(editSeed);

    if (isNaN(balNum) || isNaN(seedNum) || balNum < 0 || seedNum < 0) {
      showToast('❌ Please enter valid non-negative numbers');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await apiClient.admin.adjustJackpot({
        roomId: selectedPool.room_id,
        balance: balNum,
        seedAmount: seedNum
      });
      if (res.success) {
        showToast(`🎉 ${selectedPool.room_id} Jackpot adjusted successfully!`);
        setSelectedPool(null);
        fetchJackpotData();
      } else {
        showToast(`❌ ${res.error || 'Adjustment failed'}`);
      }
    } catch (err: any) {
      showToast(`❌ Error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalVaultBalance = pools.reduce((acc, p) => acc + parseFloat(String((p.liveBalance ?? p.balance) || 0)), 0);
  const totalPaidOut = winners.reduce((acc, w) => acc + parseFloat(String(w.amount || 0)), 0);

  return (
    <div className="admin-subpage-wrap animate-fadeIn">
      {/* 1. Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)',
        borderRadius: '16px',
        padding: '24px',
        color: '#ffffff',
        marginBottom: '24px',
        boxShadow: '0 10px 25px -5px rgba(49, 46, 129, 0.3)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span style={{ fontSize: '1.75rem' }}>🎰</span>
            <h2 style={{ fontSize: '1.375rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
              Progressive Jackpot Engine Desk
            </h2>
          </div>
          <p style={{ margin: 0, color: '#c7d2fe', fontSize: '0.875rem' }}>
            የቀጥታ ፕሮግረሲቭ ጃክፖት ካዝናዎች፣ የ10% መዋጮ ድልድል እና የጃክፖት አሸናፊዎች መዝገብ
          </p>
        </div>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '10px 18px', borderRadius: '12px', backdropFilter: 'blur(8px)' }}>
            <div style={{ fontSize: '0.75rem', color: '#a5b4fc', textTransform: 'uppercase', fontWeight: 700 }}>Total Jackpot Vault</div>
            <div style={{ fontSize: '1.375rem', fontWeight: 800, color: '#facc15' }}>
              {totalVaultBalance.toLocaleString()} ETB
            </div>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '10px 18px', borderRadius: '12px', backdropFilter: 'blur(8px)' }}>
            <div style={{ fontSize: '0.75rem', color: '#a5b4fc', textTransform: 'uppercase', fontWeight: 700 }}>Jackpots Paid Out</div>
            <div style={{ fontSize: '1.375rem', fontWeight: 800, color: '#34d399' }}>
              {totalPaidOut.toLocaleString()} ETB
            </div>
          </div>
        </div>
      </div>

      {/* 2. Room Pools Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '16px',
        marginBottom: '28px'
      }}>
        {pools.map(p => {
          const bal = parseFloat(String((p.liveBalance ?? p.balance) || 0));
          const seed = parseFloat(String(p.seed_amount || 0));
          const lastWon = parseFloat(String(p.last_won_amount || 0));
          const isBoosted = bal > seed;

          return (
            <div
              key={p.room_id}
              style={{
                backgroundColor: '#ffffff',
                border: isBoosted ? '2px solid #818cf8' : '1px solid #e2e8f0',
                borderRadius: '16px',
                padding: '20px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.04)',
                position: 'relative'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6366f1', textTransform: 'uppercase' }}>
                    {p.room_id.toUpperCase()}
                  </div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 800, margin: '2px 0 0 0', color: '#0f172a' }}>
                    {p.room_name || p.room_id}
                  </h3>
                </div>
                <span style={{
                  backgroundColor: '#eef2ff',
                  color: '#4338ca',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  fontSize: '0.75rem',
                  fontWeight: 700
                }}>
                  {p.stake_amount || (p.room_id === 'room-10' ? 10 : p.room_id === 'room-20' ? 20 : p.room_id === 'room-50' ? 50 : 100)} ETB Stake
                </span>
              </div>

              {/* Current Pool Display */}
              <div style={{
                background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                padding: '14px',
                borderRadius: '12px',
                marginBottom: '14px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '0.6875rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Live Jackpot Balance
                </div>
                <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#4f46e5', margin: '4px 0' }}>
                  {bal.toLocaleString()} <span style={{ fontSize: '1rem', fontWeight: 700 }}>ETB</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: isBoosted ? '#059669' : '#64748b', fontWeight: 600 }}>
                  {isBoosted ? `🔥 +${(bal - seed).toLocaleString()} ETB Accumulated` : `🌱 Baseline Seed Active`}
                </div>
              </div>

              {/* Pool Details */}
              <div style={{ fontSize: '0.8125rem', color: '#475569', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span>Baseline Seed:</span>
                  <strong style={{ color: '#0f172a' }}>{seed.toLocaleString()} ETB</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span>Last Won Amount:</span>
                  <strong style={{ color: lastWon > 0 ? '#059669' : '#94a3b8' }}>
                    {lastWon > 0 ? `${lastWon.toLocaleString()} ETB` : 'None yet'}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span>Win Trigger:</span>
                  <strong style={{ color: '#dc2626' }}>≤ 15 Balls (Speed 15)</strong>
                </div>
              </div>

              {/* Adjust Button */}
              <button
                type="button"
                onClick={() => handleOpenAdjust(p)}
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '0.8125rem',
                  color: '#334155',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                <i className="fa-solid fa-sliders"></i>
                Adjust Pool / Seed
              </button>
            </div>
          );
        })}
      </div>

      {/* 3. Historical Jackpot Winners Table */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.04)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
              🏆 Recent Progressive Jackpot Winners
            </h3>
            <p style={{ margin: '2px 0 0 0', color: '#64748b', fontSize: '0.8125rem' }}>
              Real players who completed a winning bingo pattern in ≤ 15 balls drawn (Speed 15 Golden Strike)
            </p>
          </div>
          <button
            type="button"
            onClick={fetchJackpotData}
            style={{
              padding: '8px 14px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: '#334155'
            }}
          >
            <i className="fa-solid fa-rotate-right" style={{ marginRight: '6px' }}></i> Refresh
          </button>
        </div>

        {winners.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
            <i className="fa-solid fa-trophy" style={{ fontSize: '2.5rem', marginBottom: '12px', color: '#cbd5e1' }}></i>
            <p style={{ margin: 0, fontWeight: 600 }}>No progressive jackpots have been hit yet.</p>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8125rem' }}>
              When a real player wins on Ball 15 (Speed 15 Golden Strike), the payout is recorded here automatically.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 12px' }}>Winner Name</th>
                  <th style={{ padding: '10px 12px' }}>Phone</th>
                  <th style={{ padding: '10px 12px' }}>Room</th>
                  <th style={{ padding: '10px 12px' }}>Jackpot Prize</th>
                  <th style={{ padding: '10px 12px' }}>Balls Drawn</th>
                  <th style={{ padding: '10px 12px' }}>Date Won</th>
                </tr>
              </thead>
              <tbody>
                {winners.map(w => (
                  <tr key={w.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px', fontWeight: 700, color: '#0f172a' }}>{w.winner_name}</td>
                    <td style={{ padding: '12px', color: '#475569' }}>{w.winner_phone}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ backgroundColor: '#eef2ff', color: '#4338ca', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700 }}>
                        {w.room_name || w.room_id}
                      </span>
                    </td>
                    <td style={{ padding: '12px', fontWeight: 800, color: '#059669' }}>
                      {parseFloat(String(w.amount)).toLocaleString()} ETB
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 800 }}>
                        ⚡ {w.balls_count} Balls
                      </span>
                    </td>
                    <td style={{ padding: '12px', color: '#64748b', fontSize: '0.8125rem' }}>
                      {new Date(w.won_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Adjust Modal */}
      {selectedPool && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            padding: '28px',
            width: '90%',
            maxWidth: '440px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 8px 0', color: '#0f172a' }}>
              Adjust Jackpot: {selectedPool.room_name || selectedPool.room_id}
            </h3>
            <p style={{ margin: '0 0 20px 0', color: '#64748b', fontSize: '0.875rem' }}>
              Update the active pool balance or default baseline seed for this room.
            </p>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#334155' }}>
                  Active Pool Balance (ETB)
                </label>
                <button
                  type="button"
                  onClick={() => setEditBalance(editSeed)}
                  style={{
                    background: '#eef2ff',
                    color: '#4f46e5',
                    border: '1px solid #c7d2fe',
                    borderRadius: '6px',
                    padding: '2px 8px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  ⚡ Set Equal to Seed
                </button>
              </div>
              <input
                type="number"
                value={editBalance}
                onChange={e => setEditBalance(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Baseline Seed Amount (ETB)
              </label>
              <input
                type="number"
                value={editSeed}
                onChange={e => setEditSeed(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  boxSizing: 'border-box'
                }}
              />
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                The pool automatically resets to this amount when a player hits the jackpot.
              </span>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setSelectedPool(null)}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  fontWeight: 700,
                  color: '#475569',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSaveAdjust}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#4f46e5',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 700,
                  color: '#ffffff',
                  cursor: 'pointer'
                }}
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
