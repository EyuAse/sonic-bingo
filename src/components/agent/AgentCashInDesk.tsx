import React, { useState, useEffect } from 'react';
import { apiClient } from '../../services/apiClient.ts';

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
  const [paymentMethod, setPaymentMethod] = useState<'Telebirr' | 'M-Pesa' | 'Cash'>('Telebirr');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<any | null>(null);

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
    setSearchQuery(`${player.fullName} (${player.phone})`);
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
    if (amount < 50) {
      showToast('⚠️ Minimum deposit is 50 ETB.');
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
        playerPhone: selectedPlayer.phone,
        amount,
        paymentMethod
      });

      if (res.success) {
        setReceipt({
          refCode: res.referenceCode,
          playerName: res.playerName,
          playerPhone: res.playerPhone,
          amount: res.amount,
          coinsAwarded: Math.round(res.amount * 1.5),
          newFloat: res.newAgentBalance,
          date: new Date().toLocaleTimeString()
        });

        showToast(`🎉 Successfully credited ${amount} ETB to ${selectedPlayer.fullName}!`);
        onDepositSuccess();
        handleClearSelected();
      }
    } catch (err: any) {
      showToast(`❌ ${err.message || 'Deposit failed'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const quickAmounts = [50, 100, 200, 500, 1000, 2000];

  return (
    <div className="max-w-xl mx-auto">
      <div className="sonic-contrast-card">
        <div className="sonic-contrast-card-header">
          <h3>
            <span>📥</span>
            <span>Player Cash-In Terminal</span>
          </h3>
          <span style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 800 }}>
            Instant Float Settlement
          </span>
        </div>

        <div className="sonic-contrast-card-body">
          <form onSubmit={handleProcessDeposit}>
            {/* 1. Player Search Input */}
            <div style={{ marginBottom: '16px', position: 'relative' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
                Search Player (Phone Number or Name)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="sonic-input-field"
                  placeholder="Type 09... or player full name"
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
                        <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>{p.phone}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>Balance: </span>
                        <strong style={{ fontSize: '13px', color: '#047857' }}>{p.balance.toFixed(2)} ETB</strong>
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
                  <div style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace' }}>{selectedPlayer.phone}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Current Balance</div>
                  <div style={{ fontSize: '15px', fontWeight: 900, color: '#047857' }}>{selectedPlayer.balance.toFixed(2)} ETB</div>
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

            {/* 3. Payment Method Collected */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
                Payment Method Collected From Player
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['Telebirr', 'M-Pesa', 'Cash'] as const).map(method => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    style={{
                      padding: '10px 8px',
                      borderRadius: '8px',
                      border: paymentMethod === method ? '2px solid #f59e0b' : '1px solid #e2e8f0',
                      background: paymentMethod === method ? '#fffbeb' : '#ffffff',
                      color: paymentMethod === method ? '#b45309' : '#475569',
                      fontSize: '12px',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    {method === 'Telebirr' && '📱 Telebirr'}
                    {method === 'M-Pesa' && '📲 M-Pesa'}
                    {method === 'Cash' && '💵 Physical Cash'}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Reward Callout & Settlement Breakdown */}
            <div style={{
              background: '#fffbeb',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '10px',
              padding: '12px 14px',
              fontSize: '12px',
              marginBottom: '20px',
              lineHeight: 1.6
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#451a03' }}>
                <span>Deducted from Agent Float:</span>
                <strong style={{ color: '#b91c1c' }}>-{amount.toFixed(2)} ETB</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#451a03' }}>
                <span>Credited to Player Wallet:</span>
                <strong style={{ color: '#047857' }}>+{amount.toFixed(2)} ETB</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(245, 158, 11, 0.2)', paddingTop: '4px', marginTop: '4px' }}>
                <span style={{ fontWeight: 800, color: '#b45309' }}>🪙 Player Loyalty Coins (1.5x):</span>
                <strong style={{ color: '#b45309', fontWeight: 900 }}>+{Math.round(amount * 1.5)} Coins</strong>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="sonic-btn-gold"
              disabled={isSubmitting || !selectedPlayer || amount < 50}
            >
              <i className={`fa-solid ${isSubmitting ? 'fa-spinner fa-spin' : 'fa-bolt'}`}></i>
              <span>{isSubmitting ? 'Processing Deposit...' : `⚡ Credit ${amount} ETB to Player`}</span>
            </button>
          </form>
        </div>
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
