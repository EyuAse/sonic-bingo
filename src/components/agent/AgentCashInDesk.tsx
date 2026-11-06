import React, { useState, useEffect } from 'react';
import { apiClient } from '../../services/apiClient.ts';
import { TelebirrLogo, CBELogo, MpesaLogo } from '../wallet/PaymentLogos.tsx';

interface AgentCashInDeskProps {
  agentProfile: any;
  onDepositSuccess: () => void;
  showToast: (msg: string) => void;
  initialPlayer?: any;
}

export const AgentCashInDesk: React.FC<AgentCashInDeskProps> = ({
  agentProfile,
  onDepositSuccess,
  showToast,
  initialPlayer
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<any | null>(initialPlayer || null);
  const [amount, setAmount] = useState<number>(100);
  const [paymentMethod, setPaymentMethod] = useState<'Telebirr' | 'CBE' | 'M-Pesa' | 'Cash'>('Telebirr');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<any | null>(null);

  // Past OTC Cash-Ins History State
  const [recentCashIns, setRecentCashIns] = useState<any[]>([]);
  const [isLoadingRecent, setIsLoadingRecent] = useState<boolean>(false);

  const fetchRecentCashIns = async () => {
    try {
      setIsLoadingRecent(true);
      const res = await apiClient.agent.getTransactions();
      if (res.success && Array.isArray(res.transactions)) {
        const cashIns = res.transactions.filter((t: any) => t.type === 'cash_in');
        setRecentCashIns(cashIns.slice(0, 8));
      }
    } catch (err) {
      console.warn('Failed to load recent cash-ins:', err);
    } finally {
      setIsLoadingRecent(false);
    }
  };

  useEffect(() => {
    fetchRecentCashIns();
    const interval = setInterval(fetchRecentCashIns, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (initialPlayer) {
      setSelectedPlayer(initialPlayer);
      setSearchQuery(`${initialPlayer.fullName} (${initialPlayer.phone})`);
    }
  }, [initialPlayer]);

  // Debounced search for players
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.trim().length >= 2 && !selectedPlayer) {
        try {
          const res = await apiClient.agent.searchPlayer(searchQuery.trim());
          if (res.success && res.players) {
            setSearchResults(res.players);
          }
        } catch (err) {
          console.error(err);
        }
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedPlayer]);

  const handleSelectPlayer = (player: any) => {
    setSelectedPlayer(player);
    const identifier = player.username ? `@${player.username}` : (player.phone || 'Telegram User');
    setSearchQuery(`${player.fullName} (${identifier})`);
    setSearchResults([]);
  };

  const handleClearSelected = () => {
    setSelectedPlayer(null);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleProcessDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlayer) {
      showToast('⚠️ Please search and select a player first.');
      return;
    }
    if (amount < 50 || amount > 1500) {
      showToast('⚠️ Deposit amount must be between 50 and 1,500 ETB.');
      return;
    }

    const floatBal = agentProfile ? Number(agentProfile.walletBalance) : 0;
    if (amount > floatBal) {
      showToast(`❌ Insufficient agent float (${floatBal.toFixed(2)} ETB). Please recharge your float.`);
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await apiClient.agent.depositForPlayer({
        playerId: selectedPlayer.id,
        playerPhone: selectedPlayer.phone || '',
        username: selectedPlayer.username || '',
        amount,
        paymentMethod
      });

      if (res.success) {
        setReceipt({
          refCode: res.referenceCode,
          playerName: res.playerName,
          playerPhone: res.playerPhone,
          amount: res.amount,
          commissionEarned: res.amount * 0.05,
          coinsAwarded: Math.round(res.amount * 1.5),
          newFloat: res.newAgentBalance,
          date: new Date().toLocaleTimeString()
        });

        showToast(`🎉 Successfully credited ${amount} ETB to ${selectedPlayer.fullName}! (+${(amount * 0.05).toFixed(2)} ETB commission earned)`);
        onDepositSuccess();
        fetchRecentCashIns();
        handleClearSelected();
      }
    } catch (err: any) {
      showToast(`❌ ${err.message || 'Deposit failed'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const quickAmounts = [50, 100, 200, 500, 1000, 1500];

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Player Cash-In Terminal Card */}
      <div className="sonic-contrast-card">
        <div className="sonic-contrast-card-header">
          <h3>
            <span>📥</span>
            <span>Player Cash-In Terminal</span>
          </h3>
          <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 800 }}>
            ⚡ Instant 0-Second Execution
          </span>
        </div>

        <div className="sonic-contrast-card-body">
          <form onSubmit={handleProcessDeposit}>
            {/* 1. Player Search Input */}
            <div style={{ marginBottom: '16px', position: 'relative' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
                Search Player (Username, Phone Number, or Name)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="sonic-input-field"
                  placeholder="Type @username, 09..., or player name"
                  value={searchQuery}
                  onChange={e => {
                    setSearchQuery(e.target.value);
                    if (selectedPlayer) setSelectedPlayer(null);
                  }}
                  required
                />
                {selectedPlayer && (
                  <button
                    type="button"
                    onClick={handleClearSelected}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: '#fee2e2',
                      border: 'none',
                      color: '#b91c1c',
                      borderRadius: '50%',
                      width: '22px',
                      height: '22px',
                      cursor: 'pointer',
                      fontSize: '11px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Change player"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Autocomplete Dropdown */}
              {searchResults.length > 0 && !selectedPlayer && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  zIndex: 20,
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                  maxHeight: '220px',
                  overflowY: 'auto',
                  marginTop: '4px'
                }}>
                  {searchResults.map(p => (
                    <div
                      key={p.id}
                      onClick={() => handleSelectPlayer(p)}
                      style={{
                        padding: '10px 14px',
                        borderBottom: '1px solid #f1f5f9',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#ffffff')}
                    >
                      <div>
                        <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '13px' }}>{p.fullName}</div>
                        <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                          {p.username ? `@${p.username}` : ''}
                          {p.username && p.phone ? ' • ' : ''}
                          {p.phone || (!p.username ? 'Telegram Account' : '')}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '11px', color: '#059669', fontWeight: 800 }}>Verified ✓</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Player Card */}
            {selectedPlayer && (
              <div style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '12px',
                padding: '12px 14px',
                marginBottom: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: '#059669' }}>
                    ✓ Confirmed Target Player
                  </span>
                  <div style={{ fontSize: '14px', fontWeight: 900, color: '#0f172a' }}>{selectedPlayer.fullName}</div>
                  <div style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace' }}>
                    {selectedPlayer.username ? `@${selectedPlayer.username}` : ''}
                    {selectedPlayer.username && selectedPlayer.phone ? ' • ' : ''}
                    {selectedPlayer.phone || (!selectedPlayer.username ? 'Telegram Account' : '')}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', color: '#059669', fontWeight: 800 }}>Account Status</div>
                  <div style={{ fontSize: '13px', fontWeight: 900, color: '#047857' }}>🟢 Verified Player</div>
                </div>
              </div>
            )}

            {/* 2. Amount Selection */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>
                  Deposit Amount (ETB)
                </label>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Min: 50 ETB</span>
              </div>

              <input
                type="number"
                min="50"
                step="10"
                className="sonic-input-field"
                style={{ fontSize: '18px', fontWeight: 900, color: '#b45309', marginTop: '6px' }}
                value={amount || ''}
                onChange={e => setAmount(Number(e.target.value))}
                required
              />

              <div className="sonic-chips-row">
                {quickAmounts.map(chip => (
                  <button
                    key={chip}
                    type="button"
                    className={`sonic-chip-btn ${amount === chip ? 'selected' : ''}`}
                    onClick={() => setAmount(chip)}
                  >
                    +{chip}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Payment Method Collected (Branded Rails) */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '8px' }}>
                Payment Method Collected From Player
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                {/* 1. Telebirr */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('Telebirr')}
                  style={{
                    padding: '10px 6px',
                    borderRadius: '10px',
                    border: paymentMethod === 'Telebirr' ? '2px solid #0284c7' : '1px solid #e2e8f0',
                    background: paymentMethod === 'Telebirr' ? 'rgba(2, 132, 199, 0.08)' : '#ffffff',
                    color: paymentMethod === 'Telebirr' ? '#0284c7' : '#475569',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <TelebirrLogo size={18} />
                  <span>Telebirr</span>
                </button>

                {/* 2. CBE Bank */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CBE')}
                  style={{
                    padding: '10px 6px',
                    borderRadius: '10px',
                    border: paymentMethod === 'CBE' ? '2px solid #b45309' : '1px solid #e2e8f0',
                    background: paymentMethod === 'CBE' ? 'rgba(245, 158, 11, 0.08)' : '#ffffff',
                    color: paymentMethod === 'CBE' ? '#b45309' : '#475569',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <CBELogo size={18} />
                  <span>CBE Bank</span>
                </button>

                {/* 3. Safaricom M-Pesa */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('M-Pesa')}
                  style={{
                    padding: '10px 6px',
                    borderRadius: '10px',
                    border: paymentMethod === 'M-Pesa' ? '2px solid #e11d48' : '1px solid #e2e8f0',
                    background: paymentMethod === 'M-Pesa' ? 'rgba(225, 29, 72, 0.08)' : '#ffffff',
                    color: paymentMethod === 'M-Pesa' ? '#e11d48' : '#475569',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <MpesaLogo size={18} />
                  <span>M-Pesa</span>
                </button>

                {/* 4. Physical Cash */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('Cash')}
                  style={{
                    padding: '10px 6px',
                    borderRadius: '10px',
                    border: paymentMethod === 'Cash' ? '2px solid #16a34a' : '1px solid #e2e8f0',
                    background: paymentMethod === 'Cash' ? 'rgba(22, 163, 74, 0.08)' : '#ffffff',
                    color: paymentMethod === 'Cash' ? '#15803d' : '#475569',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <i className="fa-solid fa-money-bill-1-wave" style={{ color: '#16a34a' }}></i>
                  <span>Cash</span>
                </button>
              </div>
            </div>

            {/* 4. Reward Callout & Settlement Breakdown */}
            <div style={{
              background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              borderRadius: '12px',
              padding: '14px 16px',
              fontSize: '12px',
              marginBottom: '20px',
              lineHeight: 1.7
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#451a03' }}>
                <span>Deducted from Agent Float:</span>
                <strong style={{ color: '#b91c1c' }}>-{amount.toFixed(2)} ETB</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#451a03' }}>
                <span>Credited to Player Wallet:</span>
                <strong style={{ color: '#047857' }}>+{amount.toFixed(2)} ETB</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(245, 158, 11, 0.25)', paddingTop: '6px', marginTop: '6px' }}>
                <span style={{ fontWeight: 800, color: '#047857' }}>🪙 Your Cashier Fee (+5%):</span>
                <strong style={{ color: '#047857', fontWeight: 900 }}>+{(amount * 0.05).toFixed(2)} ETB (Instant Credit)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 800, color: '#b45309' }}>🎁 Player Loyalty Coins (1.5x):</span>
                <strong style={{ color: '#b45309', fontWeight: 900 }}>+{Math.round(amount * 1.5)} Coins</strong>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="sonic-btn-gold"
              disabled={isSubmitting || !selectedPlayer || amount < 50}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                fontWeight: 900,
                fontSize: '14px'
              }}
            >
              <i className={`fa-solid ${isSubmitting ? 'fa-spinner fa-spin' : 'fa-bolt'}`}></i>
              <span>{isSubmitting ? 'Processing Deposit...' : `⚡ Credit ${amount} ETB to Player`}</span>
            </button>
          </form>
        </div>
      </div>

      {/* 2. Recent Direct Cash-In Transactions History Table */}
      <div style={{ background: '#ffffff', borderRadius: '18px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 900, color: '#0f172a' }}>
              Recent Direct Cash-In Transactions
            </h3>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Real-time audit log of over-the-counter player wallet credits
            </span>
          </div>

          <button
            type="button"
            onClick={fetchRecentCashIns}
            style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <i className={`fa-solid fa-rotate ${isLoadingRecent ? 'fa-spin' : ''}`}></i>
            <span>Refresh</span>
          </button>
        </div>

        {recentCashIns.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
            <div style={{ fontSize: '28px', marginBottom: '6px' }}>📥</div>
            <div style={{ fontWeight: 700, color: '#475569' }}>No Direct Cash-Ins Recorded Yet</div>
            <div style={{ fontSize: '12px', marginTop: '4px' }}>
              Player wallet deposits processed at your counter will appear here immediately.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                  <th style={{ padding: '12px 20px', fontWeight: 700 }}>Player</th>
                  <th style={{ padding: '12px 20px', fontWeight: 700 }}>Amount Credited</th>
                  <th style={{ padding: '12px 20px', fontWeight: 700 }}>Your Commission</th>
                  <th style={{ padding: '12px 20px', fontWeight: 700 }}>Method</th>
                  <th style={{ padding: '12px 20px', fontWeight: 700 }}>Ref Code</th>
                  <th style={{ padding: '12px 20px', fontWeight: 700 }}>Time</th>
                </tr>
              </thead>
              <tbody>
                {recentCashIns.map((tx, idx) => (
                  <tr
                    key={tx.id || idx}
                    style={{
                      borderBottom: idx < recentCashIns.length - 1 ? '1px solid #f1f5f9' : 'none'
                    }}
                  >
                    <td style={{ padding: '12px 20px' }}>
                      <div style={{ fontWeight: 800, color: '#0f172a' }}>{tx.player_name || 'Player'}</div>
                      <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                        {tx.player_phone || '—'}
                      </div>
                    </td>
                    <td style={{ padding: '12px 20px', fontWeight: 900, color: '#047857' }}>
                      +{Number(tx.amount).toFixed(2)} ETB
                    </td>
                    <td style={{ padding: '12px 20px' }}>
                      <span
                        style={{
                          background: '#ecfdf5',
                          border: '1px solid #a7f3d0',
                          color: '#065f46',
                          padding: '3px 8px',
                          borderRadius: '9999px',
                          fontSize: '11px',
                          fontWeight: 800
                        }}
                      >
                        +{Number(tx.agent_commission_earned || tx.amount * 0.05).toFixed(2)} ETB (5%)
                      </span>
                    </td>
                    <td style={{ padding: '12px 20px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '3px 8px',
                          borderRadius: '8px',
                          fontSize: '11px',
                          fontWeight: 700,
                          background:
                            tx.payment_method === 'Telebirr' ? 'rgba(2, 132, 199, 0.08)' :
                            tx.payment_method === 'CBE' ? 'rgba(245, 158, 11, 0.08)' :
                            tx.payment_method === 'M-Pesa' ? 'rgba(225, 29, 72, 0.08)' : '#f1f5f9',
                          color:
                            tx.payment_method === 'Telebirr' ? '#0284c7' :
                            tx.payment_method === 'CBE' ? '#b45309' :
                            tx.payment_method === 'M-Pesa' ? '#e11d48' : '#475569'
                        }}
                      >
                        {tx.payment_method === 'Telebirr' && <TelebirrLogo size={14} />}
                        {tx.payment_method === 'CBE' && <CBELogo size={14} />}
                        {tx.payment_method === 'M-Pesa' && <MpesaLogo size={14} />}
                        {tx.payment_method === 'Cash' && <i className="fa-solid fa-money-bill-1-wave" style={{ color: '#16a34a' }}></i>}
                        <span>{tx.payment_method}</span>
                      </span>
                    </td>
                    <td style={{ padding: '12px 20px', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>
                      {tx.transaction_code || '—'}
                    </td>
                    <td style={{ padding: '12px 20px', color: '#94a3b8', fontSize: '12px' }}>
                      {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Digital Receipt Modal */}
      {receipt && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '2px solid #f59e0b',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
            maxWidth: '420px',
            width: '100%',
            padding: '24px',
            textAlign: 'center'
          }}>
            <span style={{ fontSize: '36px' }}>👑</span>
            <h3 style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', margin: '6px 0 2px 0' }}>
              SONIC BINGO CASH-IN RECEIPT
            </h3>
            <div style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace', marginBottom: '14px' }}>
              {receipt.refCode}
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px', fontSize: '13px', textAlign: 'left', marginBottom: '16px', lineHeight: 1.8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Player:</span>
                <strong style={{ color: '#0f172a' }}>{receipt.playerName}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Phone:</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{receipt.playerPhone}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '4px' }}>
                <span style={{ color: '#64748b' }}>Amount Credited:</span>
                <strong style={{ color: '#047857', fontSize: '15px' }}>+{receipt.amount.toFixed(2)} ETB</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Your Commission (+5%):</span>
                <strong style={{ color: '#047857' }}>+{receipt.commissionEarned.toFixed(2)} ETB</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Loyalty Coins:</span>
                <strong style={{ color: '#b45309' }}>+{receipt.coinsAwarded} 🪙</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '4px' }}>
                <span style={{ color: '#64748b' }}>New Agent Float:</span>
                <strong style={{ color: '#b45309' }}>{receipt.newFloat.toFixed(2)} ETB</strong>
              </div>
            </div>

            <button
              type="button"
              className="sonic-btn-gold"
              onClick={() => setReceipt(null)}
            >
              Done & Close Receipt
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
