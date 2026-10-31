import React, { useState, useEffect } from 'react';
import { useAdmin } from '../../context/AdminContext.tsx';
import { useApp } from '../../context/AppContext.tsx';
import { apiClient } from '../../services/apiClient.ts';

interface CoinStats {
  totalCirculation: number;
  totalEarned: number;
  totalRedeemed: number;
  totalHolders: number;
  earningRate: string;
  redemptionRate: string;
}

interface TopHolder {
  id: string;
  user_id: string;
  user_name: string;
  user_phone: string;
  balance: number;
  lifetime_earned: number;
  lifetime_redeemed: number;
  updated_at: string;
}

interface CoinTx {
  id: string;
  user_id: string;
  user_name: string;
  user_phone: string;
  amount: number;
  type: string;
  balance_after: number;
  description: string;
  created_at: string;
}

export const CoinsRewardsDesk: React.FC = () => {
  const { adminToken } = useAdmin();
  const { showToast } = useApp();

  const [stats, setStats] = useState<CoinStats | null>(null);
  const [topHolders, setTopHolders] = useState<TopHolder[]>([]);
  const [recentTx, setRecentTx] = useState<CoinTx[]>([]);
  const [loading, setLoading] = useState(true);

  // Manual Adjust Modal & Live Player Search
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustUserId, setAdjustUserId] = useState('');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Live Real Player Autocomplete State
  const [playerSearchQuery, setPlayerSearchQuery] = useState('');
  const [playerSearchResults, setPlayerSearchResults] = useState<any[]>([]);
  const [isSearchingPlayers, setIsSearchingPlayers] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null);

  // Debounced search against 100% real PostgreSQL users
  useEffect(() => {
    if (!playerSearchQuery.trim() || playerSearchQuery.trim().length < 2) {
      setPlayerSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingPlayers(true);
      try {
        const res = await apiClient.admin.getUsers({ search: playerSearchQuery.trim(), limit: 8 });
        if (res && res.users) {
          setPlayerSearchResults(res.users);
        }
      } catch (err) {
        console.error('Player search error:', err);
      } finally {
        setIsSearchingPlayers(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [playerSearchQuery]);

  const openAdjustModal = (player?: any) => {
    if (player) {
      setSelectedPlayer(player);
      setAdjustUserId(player.id || player.user_id);
    } else {
      setSelectedPlayer(null);
      setAdjustUserId('');
    }
    setPlayerSearchQuery('');
    setPlayerSearchResults([]);
    setAdjustAmount('');
    setAdjustReason('');
    setShowAdjustModal(true);
  };

  const fetchCoinData = async () => {
    try {
      setLoading(true);
      const data = await apiClient.admin.getCoins();
      if (data && data.success) {
        setStats(data.stats);
        setTopHolders(data.topHolders || data.holders || []);
        setRecentTx(data.recentTransactions || []);
      }
    } catch (err) {
      console.error('Failed to fetch coin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoinData();
  }, []);

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseInt(adjustAmount, 10);
    if (!adjustUserId || isNaN(amountNum) || amountNum === 0) {
      showToast('❌ Please provide a valid User ID and non-zero amount');
      return;
    }

    try {
      setIsSubmitting(true);
      const data = await apiClient.admin.adjustCoins({
        userId: adjustUserId,
        amount: amountNum,
        reason: adjustReason || 'Admin Manual Adjustment'
      });
      if (data && data.success) {
        showToast(`🎉 Coins adjusted successfully (New Balance: ${data.newBalance ?? data.balance ?? 'Updated'})`);
        setShowAdjustModal(false);
        setAdjustUserId('');
        setAdjustAmount('');
        setAdjustReason('');
        fetchCoinData();
      } else {
        showToast(`❌ ${data?.error || 'Adjustment failed'}`);
      }
    } catch (err: any) {
      showToast(`❌ Error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="admin-subpage-wrap animate-fadeIn">
      {/* 1. Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #78350f 0%, #b45309 50%, #d97706 100%)',
        borderRadius: '16px',
        padding: '24px',
        color: '#ffffff',
        marginBottom: '24px',
        boxShadow: '0 10px 25px -5px rgba(180, 83, 9, 0.3)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span style={{ fontSize: '1.75rem' }}>🪙</span>
            <h2 style={{ fontSize: '1.375rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
              Sonic Coins & Rewards Desk
            </h2>
          </div>
          <p style={{ margin: 0, color: '#fef3c7', fontSize: '0.875rem' }}>
            የተጫዋቾች የሳንቲም ክምችት፣ የ1.5x ተቀማጭ ሽልማት እና የ1,000 ሳንቲም = 10 ብር ቅያሬ ማዕከል
          </p>
        </div>

        <button
          type="button"
          onClick={() => openAdjustModal()}
          style={{
            backgroundColor: '#ffffff',
            color: '#b45309',
            padding: '10px 18px',
            borderRadius: '10px',
            border: 'none',
            fontWeight: 800,
            fontSize: '0.875rem',
            cursor: 'pointer',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <i className="fa-solid fa-plus-minus"></i>
          Adjust User Coins
        </button>
      </div>

      {/* 2. Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div style={{ backgroundColor: '#ffffff', padding: '18px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Coins in Circulation</div>
          <div style={{ fontSize: '1.625rem', fontWeight: 900, color: '#d97706', marginTop: '4px' }}>
            {(stats?.totalCirculation ?? 0).toLocaleString()} <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>🪙</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>Across {stats?.totalHolders ?? 0} active wallets</div>
        </div>

        <div style={{ backgroundColor: '#ffffff', padding: '18px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Total Lifetime Earned</div>
          <div style={{ fontSize: '1.625rem', fontWeight: 900, color: '#059669', marginTop: '4px' }}>
            {(stats?.totalEarned ?? 0).toLocaleString()} <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>🪙</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#059669', marginTop: '4px' }}>1.5x per ETB deposited</div>
        </div>

        <div style={{ backgroundColor: '#ffffff', padding: '18px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Total Redeemed for Bonus</div>
          <div style={{ fontSize: '1.625rem', fontWeight: 900, color: '#dc2626', marginTop: '4px' }}>
            {(stats?.totalRedeemed ?? 0).toLocaleString()} <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>🪙</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
            = {((stats?.totalRedeemed ?? 0) / 100).toLocaleString()} ETB Bonus Given
          </div>
        </div>

        <div style={{ backgroundColor: '#fffbeb', padding: '18px', borderRadius: '14px', border: '1px solid #fde68a' }}>
          <div style={{ fontSize: '0.75rem', color: '#92400e', fontWeight: 700, textTransform: 'uppercase' }}>Conversion Rule</div>
          <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#b45309', marginTop: '4px' }}>
            1,000 Coins = 10 ETB
          </div>
          <div style={{ fontSize: '0.75rem', color: '#92400e', marginTop: '4px' }}>
            Eligible for all gameplay stakes
          </div>
        </div>
      </div>

      {/* 3. Top Holders & Recent Transactions Split */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        {/* Top Holders Table */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '1.0625rem', fontWeight: 800, margin: '0 0 14px 0', color: '#0f172a' }}>
            🏆 Top Coin Holders
          </h3>
          {topHolders.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>No coins issued yet.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b', textAlign: 'left', textTransform: 'uppercase', fontSize: '0.6875rem' }}>
                    <th style={{ padding: '8px 10px' }}>Player</th>
                    <th style={{ padding: '8px 10px' }}>Balance</th>
                    <th style={{ padding: '8px 10px' }}>Earned</th>
                    <th style={{ padding: '8px 10px' }}>Redeemed</th>
                  </tr>
                </thead>
                <tbody>
                  {topHolders.map(h => (
                    <tr key={h.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{h.user_name || 'Player'}</div>
                        <div style={{ color: '#64748b', fontSize: '0.75rem' }}>{h.user_phone}</div>
                      </td>
                      <td style={{ padding: '10px', fontWeight: 800, color: '#d97706' }}>
                        {h.balance.toLocaleString()} 🪙
                      </td>
                      <td style={{ padding: '10px', color: '#059669' }}>
                        +{h.lifetime_earned.toLocaleString()}
                      </td>
                      <td style={{ padding: '10px', color: '#64748b' }}>
                        {h.lifetime_redeemed.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Transactions Table */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '1.0625rem', fontWeight: 800, margin: '0 0 14px 0', color: '#0f172a' }}>
            📜 Recent Coin Ledger History
          </h3>
          {recentTx.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>No transactions recorded yet.</p>
          ) : (
            <div style={{ overflowX: 'auto', maxHeight: '420px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b', textAlign: 'left', textTransform: 'uppercase', fontSize: '0.6875rem' }}>
                    <th style={{ padding: '8px 10px' }}>Player</th>
                    <th style={{ padding: '8px 10px' }}>Activity / Reward</th>
                    <th style={{ padding: '8px 10px' }}>Coins (+/-)</th>
                    <th style={{ padding: '8px 10px' }}>Coin Vault After</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTx.map(tx => (
                    <tr key={tx.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 10px' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{tx.user_name}</div>
                        <div style={{ color: '#94a3b8', fontSize: '0.6875rem' }}>{new Date(tx.created_at).toLocaleTimeString()}</div>
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{
                          backgroundColor: tx.type === 'earned_deposit' ? '#ecfdf5' : tx.type === 'redeemed_bonus' ? '#fef2f2' : '#f8fafc',
                          color: tx.type === 'earned_deposit' ? '#047857' : tx.type === 'redeemed_bonus' ? '#b91c1c' : '#475569',
                          padding: '3px 9px',
                          borderRadius: '10px',
                          fontSize: '0.6875rem',
                          fontWeight: 700
                        }}>
                          {tx.type === 'earned_deposit' ? '🪙 +1.5x Deposit Reward' : tx.type === 'redeemed_bonus' ? '🎁 Redeemed for Bonus' : '🛠️ Manual Adjustment'}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px', fontWeight: 800, color: tx.amount > 0 ? '#059669' : '#dc2626' }}>
                        {tx.amount > 0 ? `+${tx.amount} 🪙` : `${tx.amount} 🪙`}
                      </td>
                      <td style={{ padding: '8px 10px', color: '#475569', fontWeight: 700 }}>
                        {tx.balance_after} 🪙
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 4. Manual Adjustment Modal with Live Player Autocomplete */}
      {showAdjustModal && (
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
          <form
            onSubmit={handleAdjustSubmit}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '28px',
              width: '90%',
              maxWidth: '460px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
            }}
          >
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 8px 0', color: '#0f172a' }}>
              Manual Coin Adjustment
            </h3>
            <p style={{ margin: '0 0 16px 0', color: '#64748b', fontSize: '0.875rem' }}>
              Search for a player by name, phone, or username to award or deduct loyalty coins.
            </p>

            {/* Selected Player Card or Search Box */}
            {selectedPlayer ? (
              <div style={{
                padding: '12px 14px',
                borderRadius: '12px',
                background: '#f8fafc',
                border: '1.5px solid #e2e8f0',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    background: '#fef3c7',
                    color: '#b45309',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '0.9rem'
                  }}>
                    {selectedPlayer.name ? selectedPlayer.name.charAt(0).toUpperCase() : 'P'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.875rem' }}>
                      {selectedPlayer.name || 'Player'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      📞 {selectedPlayer.phone || 'No phone'} {selectedPlayer.telegramUsername ? `• @${selectedPlayer.telegramUsername}` : ''}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPlayer(null);
                    setAdjustUserId('');
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#dc2626',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Change Player
                </button>
              </div>
            ) : (
              <div style={{ marginBottom: '16px', position: 'relative' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Search Player (Name, Phone, or Telegram)
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Type name or phone (e.g. 0911...)"
                    value={playerSearchQuery}
                    onChange={e => setPlayerSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 36px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.875rem',
                      boxSizing: 'border-box'
                    }}
                  />
                  <i
                    className="fa-solid fa-magnifying-glass"
                    style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
                  ></i>
                  {isSearchingPlayers && (
                    <i
                      className="fa-solid fa-spinner fa-spin"
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}
                    ></i>
                  )}
                </div>

                {/* Autocomplete Results Dropdown */}
                {playerSearchResults.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '4px',
                    background: '#ffffff',
                    borderRadius: '10px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15)',
                    border: '1px solid #e2e8f0',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    zIndex: 50
                  }}>
                    {playerSearchResults.map(p => (
                      <div
                        key={p.id}
                        onClick={() => {
                          setSelectedPlayer(p);
                          setAdjustUserId(p.id);
                          setPlayerSearchResults([]);
                          setPlayerSearchQuery('');
                        }}
                        style={{
                          padding: '10px 12px',
                          borderBottom: '1px solid #f1f5f9',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.8125rem', color: '#0f172a' }}>{p.name || 'Player'}</div>
                          <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>
                            {p.phone || 'No phone'} {p.telegramUsername ? `• @${p.telegramUsername}` : ''}
                          </div>
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#d97706', background: '#fef3c7', padding: '2px 8px', borderRadius: '8px' }}>
                          Select
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Coin Amount
              </label>
              <input
                type="number"
                required
                placeholder="e.g. 500 or -200"
                value={adjustAmount}
                onChange={e => setAdjustAmount(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.875rem', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Reason / Description
              </label>
              <input
                type="text"
                placeholder="e.g. VIP player appreciation reward"
                value={adjustReason}
                onChange={e => setAdjustReason(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.875rem', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => {
                  setShowAdjustModal(false);
                  setSelectedPlayer(null);
                }}
                style={{ flex: 1, padding: '12px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '10px', fontWeight: 700, color: '#475569', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !adjustUserId}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: adjustUserId ? '#d97706' : '#cbd5e1',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 700,
                  color: '#ffffff',
                  cursor: adjustUserId ? 'pointer' : 'not-allowed'
                }}
              >
                {isSubmitting ? 'Adjusting...' : 'Confirm'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

