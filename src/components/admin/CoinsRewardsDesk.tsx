import React, { useState, useEffect } from 'react';
import { useAdmin } from '../../context/AdminContext.tsx';
import { useApp } from '../../context/AppContext.tsx';

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

  // Manual Adjust Modal
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustUserId, setAdjustUserId] = useState('');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchCoinData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/coins', {
        headers: {
          'Authorization': `Bearer ${adminToken || localStorage.getItem('sonic_admin_token') || ''}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        setTopHolders(data.topHolders || []);
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
      const res = await fetch('/api/admin/coins/adjust', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken || localStorage.getItem('sonic_admin_token') || ''}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: adjustUserId,
          amount: amountNum,
          reason: adjustReason || 'Admin Manual Adjustment'
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`🎉 Coins adjusted successfully (New Balance: ${data.newBalance})`);
        setShowAdjustModal(false);
        setAdjustUserId('');
        setAdjustAmount('');
        setAdjustReason('');
        fetchCoinData();
      } else {
        showToast(`❌ ${data.error || 'Adjustment failed'}`);
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
          onClick={() => setShowAdjustModal(true)}
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
                    <th style={{ padding: '8px 10px' }}>Type</th>
                    <th style={{ padding: '8px 10px' }}>Amount</th>
                    <th style={{ padding: '8px 10px' }}>After</th>
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
                          padding: '2px 8px',
                          borderRadius: '10px',
                          fontSize: '0.6875rem',
                          fontWeight: 700
                        }}>
                          {tx.type === 'earned_deposit' ? 'Deposit' : tx.type === 'redeemed_bonus' ? 'Redeemed' : 'Admin'}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px', fontWeight: 800, color: tx.amount > 0 ? '#059669' : '#dc2626' }}>
                        {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                      </td>
                      <td style={{ padding: '8px 10px', color: '#475569' }}>
                        {tx.balance_after}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 4. Manual Adjustment Modal */}
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
              maxWidth: '440px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
            }}
          >
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 8px 0', color: '#0f172a' }}>
              Manual Coin Adjustment
            </h3>
            <p style={{ margin: '0 0 20px 0', color: '#64748b', fontSize: '0.875rem' }}>
              Add coins (positive number, e.g. +500) or deduct coins (negative number, e.g. -200) for a player.
            </p>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                User UUID
              </label>
              <input
                type="text"
                required
                placeholder="User UUID (from Players Desk)"
                value={adjustUserId}
                onChange={e => setAdjustUserId(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.875rem', boxSizing: 'border-box' }}
              />
            </div>

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
                placeholder="e.g. Community promotion award"
                value={adjustReason}
                onChange={e => setAdjustReason(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.875rem', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setShowAdjustModal(false)}
                style={{ flex: 1, padding: '12px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '10px', fontWeight: 700, color: '#475569', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                style={{ flex: 1, padding: '12px', backgroundColor: '#d97706', border: 'none', borderRadius: '10px', fontWeight: 700, color: '#ffffff', cursor: 'pointer' }}
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
