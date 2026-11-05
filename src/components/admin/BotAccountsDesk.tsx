import React, { useState, useEffect } from 'react';
import { apiClient } from '../../services/apiClient.ts';
import { useApp } from '../../context/AppContext.tsx';

interface BotUser {
  id: string;
  name: string;
  phone: string;
  balance: number;
  bonus: number;
  status: string;
  totalWins: number;
  totalWonAmount: number;
  createdAt: string;
}

export const BotAccountsDesk: React.FC = () => {
  const { showToast } = useApp();
  const [bots, setBots] = useState<BotUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'low-balance' | 'winners'>('all');
  const [replenishing, setReplenishing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  const fetchBots = async () => {
    try {
      setLoading(true);
      const res = await apiClient.admin.getBotUsers();
      if (res.success && Array.isArray(res.bots)) {
        setBots(res.bots);
      }
    } catch (err: any) {
      console.error('Error fetching bot accounts:', err);
      showToast('⚠️ Failed to load bot accounts from Neon DB');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBots();
  }, []);

  const handleReplenish = async () => {
    try {
      setReplenishing(true);
      const res = await apiClient.admin.replenishBotUsers();
      if (res.success) {
        showToast('✓ ' + (res.message || 'Low bot balances replenished to 500 ETB!'));
        await fetchBots();
      }
    } catch (err: any) {
      showToast('❌ Failed to replenish bot accounts');
    } finally {
      setReplenishing(false);
    }
  };

  // KPI Calculations
  const totalBots = bots.length;
  const totalFloat = bots.reduce((sum, b) => sum + (b.balance || 0), 0);
  const totalWins = bots.reduce((sum, b) => sum + (b.totalWins || 0), 0);
  const totalWonCash = bots.reduce((sum, b) => sum + (b.totalWonAmount || 0), 0);
  const lowBalanceBots = bots.filter(b => b.balance < 50).length;

  // Filter Logic
  const filteredBots = bots.filter(b => {
    if (filterMode === 'low-balance' && b.balance >= 50) return false;
    if (filterMode === 'winners' && b.totalWins === 0) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (b.name || '').toLowerCase().includes(q);
      const matchPhone = (b.phone || '').includes(q);
      if (!matchName && !matchPhone) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredBots.length / pageSize) || 1;
  const displayedBots = filteredBots.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="bots-desk-container" style={{ padding: '0 4px' }}>
      {/* 1. Hero Banner */}
      <div className="bots-hero-banner" style={{ border: '1.5px solid #e2e8f0', borderRadius: '20px', padding: '24px', marginBottom: '20px' }}>
        <div className="bots-hero-left">
          <div className="bots-hero-icon-box" style={{ background: '#f0fdf4', color: '#16a34a' }}>
            <i className="fa-solid fa-users-gear"></i>
          </div>
          <div className="bots-hero-titles">
            <div className="bots-hero-badge-row">
              <span className="bots-live-badge" style={{ background: '#dcfce7', color: '#15803d' }}>
                <span className="pulse-green-dot"></span>
                <span>200 NEON POSTGRESQL BOT ACCOUNTS ACTIVE</span>
              </span>
              <span className="bots-uptime-tag" style={{ background: '#f1f5f9', color: '#475569' }}>
                Unlimited House Backed
              </span>
            </div>
            <h1 className="bots-hero-main-title" style={{ fontSize: '1.5rem', fontWeight: '900', margin: '6px 0' }}>
              BOT PLAYER ACCOUNTS & WALLETS DESK
            </h1>
            <p className="bots-hero-sub-title" style={{ color: '#64748b', fontSize: '0.875rem', margin: 0 }}>
              እውነተኛ የውሂብ ጎታ ያላቸው 200 የቦቶች ዋሌቶች፣ ራስ-ሰር ተወራራጅነት እና የቀጥታ አሸናፊነት መዝገብ
            </p>
          </div>
        </div>

        <div className="bots-hero-right" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn-action-pill green"
            onClick={handleReplenish}
            disabled={replenishing}
            style={{
              padding: '10px 18px',
              fontSize: '0.85rem',
              fontWeight: '800',
              borderRadius: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: '#16a34a',
              color: '#ffffff',
              border: 'none',
              boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)'
            }}
          >
            <i className={`fa-solid ${replenishing ? 'fa-spinner fa-spin' : 'fa-arrows-rotate'}`}></i>
            <span>{replenishing ? 'Replenishing...' : 'AUTO-REPLENISH (< 50 ETB)'}</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Cards */}
      <div className="bots-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        <div className="bots-kpi-card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.8rem', fontWeight: '700' }}>
            <span>Total Active Bots</span>
            <i className="fa-solid fa-robot" style={{ color: '#3b82f6' }}></i>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: '900', color: '#0f172a', margin: '8px 0' }}>
            {totalBots} <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600' }}>Accounts</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: '700' }}>
            ✓ 100% Seeded in Neon DB
          </div>
        </div>

        <div className="bots-kpi-card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.8rem', fontWeight: '700' }}>
            <span>House Float in Wallets</span>
            <i className="fa-solid fa-wallet" style={{ color: '#16a34a' }}></i>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: '900', color: '#16a34a', margin: '8px 0' }}>
            {totalFloat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600' }}>ETB</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '700' }}>
            {lowBalanceBots > 0 ? `⚠️ ${lowBalanceBots} bots below 50 ETB` : '✓ All balances healthy'}
          </div>
        </div>

        <div className="bots-kpi-card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.8rem', fontWeight: '700' }}>
            <span>Total Wins Logged</span>
            <i className="fa-solid fa-trophy" style={{ color: '#eab308' }}></i>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: '900', color: '#854d0e', margin: '8px 0' }}>
            {totalWins} <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600' }}>Wins</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '700' }}>
            Recorded in wallet_transactions
          </div>
        </div>

        <div className="bots-kpi-card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.8rem', fontWeight: '700' }}>
            <span>Won Payouts Deposited</span>
            <i className="fa-solid fa-coins" style={{ color: '#f59e0b' }}></i>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: '900', color: '#d97706', margin: '8px 0' }}>
            {totalWonCash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600' }}>ETB</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: '700' }}>
            45x Multiplier Real Credits
          </div>
        </div>
      </div>

      {/* 3. Search and Filters Bar */}
      <div className="bots-search-filter-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div className="bots-controls-filter-row" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', width: '100%', maxWidth: '100%' }}>
          <div className="bots-search-box" style={{ position: 'relative', width: '280px', maxWidth: '100%' }}>
            <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}></i>
            <input
              type="text"
              placeholder="Search by bot name or phone..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                fontSize: '0.875rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div className="tabs" style={{ display: 'flex', gap: '6px', margin: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <button
              type="button"
              onClick={() => { setFilterMode('all'); setCurrentPage(1); }}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: '700',
                cursor: 'pointer',
                border: 'none',
                background: filterMode === 'all' ? '#0f172a' : '#f1f5f9',
                color: filterMode === 'all' ? '#ffffff' : '#64748b'
              }}
            >
              All ({bots.length})
            </button>
            <button
              type="button"
              onClick={() => { setFilterMode('low-balance'); setCurrentPage(1); }}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: '700',
                cursor: 'pointer',
                border: 'none',
                background: filterMode === 'low-balance' ? '#ef4444' : '#f1f5f9',
                color: filterMode === 'low-balance' ? '#ffffff' : '#64748b'
              }}
            >
              Low Balance (&lt; 50 ETB)
            </button>
            <button
              type="button"
              onClick={() => { setFilterMode('winners'); setCurrentPage(1); }}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: '700',
                cursor: 'pointer',
                border: 'none',
                background: filterMode === 'winners' ? '#eab308' : '#f1f5f9',
                color: filterMode === 'winners' ? '#ffffff' : '#64748b'
              }}
            >
              Winners (Wins &gt; 0)
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchBots}
          style={{
            padding: '8px 14px',
            borderRadius: '10px',
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            color: '#475569',
            fontSize: '0.85rem',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <i className="fa-solid fa-rotate-right"></i>
          <span>Refresh</span>
        </button>
      </div>

      {/* 4. High-Density Accounts Table */}
      <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '1.5rem', marginBottom: '8px', display: 'block' }}></i>
            Loading 200 Bot Player Accounts from Neon PostgreSQL...
          </div>
        ) : displayedBots.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
            No bot accounts match your filter criteria.
          </div>
        ) : (
          <div className="wrap" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', minWidth: '680px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', color: '#475569', fontWeight: '800' }}>
                  <th style={{ padding: '12px 16px' }}>#</th>
                  <th style={{ padding: '12px 16px' }}>Bot Identity & Name</th>
                  <th style={{ padding: '12px 16px' }}>Phone Number</th>
                  <th style={{ padding: '12px 16px' }}>Real Wallet Balance</th>
                  <th style={{ padding: '12px 16px' }}>Bonus</th>
                  <th style={{ padding: '12px 16px' }}>Total Wins</th>
                  <th style={{ padding: '12px 16px' }}>Total Won (ETB)</th>
                  <th style={{ padding: '12px 16px' }}>Account Type</th>
                </tr>
              </thead>
              <tbody>
                {displayedBots.map((b, idx) => {
                  const globalIdx = (currentPage - 1) * pageSize + idx + 1;
                  return (
                    <tr
                      key={b.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: idx % 2 === 0 ? '#ffffff' : '#fafafa',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      <td style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: '700' }}>
                        {globalIdx}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#e0e7ff', color: '#4338ca', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '0.78rem' }}>
                            {b.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <strong style={{ color: '#0f172a', display: 'block', fontSize: '0.875rem' }}>{b.name}</strong>
                            <span style={{ color: '#94a3b8', fontSize: '0.72rem', fontFamily: 'monospace' }}>{b.id.slice(0, 16)}...</span>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#334155' }}>
                        {b.phone}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontWeight: '800', color: b.balance < 50 ? '#dc2626' : '#16a34a' }}>
                          {b.balance.toFixed(2)} ETB
                        </span>
                        {b.balance < 50 && (
                          <span style={{ marginLeft: '6px', fontSize: '0.68rem', background: '#fee2e2', color: '#991b1b', padding: '1px 5px', borderRadius: '4px', fontWeight: '800' }}>
                            LOW
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#64748b' }}>
                        {b.bonus.toFixed(2)} ETB
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          background: b.totalWins > 0 ? '#fef9c3' : '#f1f5f9',
                          color: b.totalWins > 0 ? '#854d0e' : '#64748b',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontWeight: '800',
                          fontSize: '0.8rem'
                        }}>
                          {b.totalWins} {b.totalWins === 1 ? 'Win' : 'Wins'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: '800', color: b.totalWonAmount > 0 ? '#d97706' : '#94a3b8' }}>
                        {b.totalWonAmount > 0 ? `+${b.totalWonAmount.toLocaleString()}.00 ETB` : '0.00 ETB'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '800' }}>
                          🤖 House Bot
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.825rem', color: '#64748b' }}>
          <div>
            Showing <strong>{(currentPage - 1) * pageSize + 1}</strong> to <strong>{Math.min(currentPage * pageSize, filteredBots.length)}</strong> of <strong>{filteredBots.length}</strong> bots
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: currentPage <= 1 ? '#f8fafc' : '#ffffff',
                color: currentPage <= 1 ? '#94a3b8' : '#0f172a',
                cursor: currentPage <= 1 ? 'not-allowed' : 'pointer'
              }}
            >
              Previous
            </button>
            <span style={{ padding: '6px 12px', fontWeight: '700' }}>
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: currentPage >= totalPages ? '#f8fafc' : '#ffffff',
                color: currentPage >= totalPages ? '#94a3b8' : '#0f172a',
                cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer'
              }}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
