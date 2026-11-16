import React, { useState } from 'react';
import { useKeno } from '../context/KenoContext.tsx';
import { ATLAS_V_PAYTABLE } from '../../server/game/kenoMath.ts';

export const KenoBetSlip: React.FC = () => {
  const {
    selectedNumbers,
    quickPick,
    clearSelection,
    stake,
    setStake,
    adjustStake,
    doubleStake,
    placeBet,
    phase,
    balance,
    activeTickets,
    drawnBalls
  } = useKeno();

  const [loading, setLoading] = useState(false);
  const [betError, setBetError] = useState<string | null>(null);
  const [isBetAcceptedFlash, setIsBetAcceptedFlash] = useState(false);

  const handlePlaceBet = async () => {
    setBetError(null);
    setLoading(true);
    const res = await placeBet();
    setLoading(false);
    if (res.success) {
      setIsBetAcceptedFlash(true);
      clearSelection();
      setTimeout(() => {
        setIsBetAcceptedFlash(false);
      }, 1000);
    } else if (res.error) {
      setBetError(res.error);
      setTimeout(() => setBetError(null), 3500);
    }
  };

  const spots = selectedNumbers.size;
  const canBet = phase === 'betting' && spots >= 1 && spots <= 10 && balance >= stake && !loading && !isBetAcceptedFlash;

  return (
    <div className="keno-bet-slip">
      {/* Quick Picks & Actions */}
      <div className="keno-quick-picks">
        <button
          type="button"
          className="keno-pill-btn"
          onClick={() => quickPick(1)}
          disabled={phase !== 'betting'}
        >
          1 Spot
        </button>
        <button
          type="button"
          className="keno-pill-btn"
          onClick={() => quickPick(3)}
          disabled={phase !== 'betting'}
        >
          3 Spots
        </button>
        <button
          type="button"
          className="keno-pill-btn"
          onClick={() => quickPick(5)}
          disabled={phase !== 'betting'}
        >
          5 Spots
        </button>
        <button
          type="button"
          className="keno-pill-btn"
          onClick={() => quickPick(8)}
          disabled={phase !== 'betting'}
        >
          8 Spots
        </button>
        <button
          type="button"
          className="keno-pill-btn"
          onClick={() => quickPick(10)}
          disabled={phase !== 'betting'}
        >
          10 Spots
        </button>
        <button
          type="button"
          className="keno-pill-btn double"
          onClick={doubleStake}
          disabled={phase !== 'betting'}
        >
          2×
        </button>
        <button
          type="button"
          className="keno-pill-btn clear"
          onClick={clearSelection}
          disabled={phase !== 'betting' || spots === 0}
        >
          Clear
        </button>
      </div>

      {/* Stake Stepper */}
      <div className="keno-stake-row">
        <button
          type="button"
          className="keno-step-btn"
          onClick={() => adjustStake(-5)}
          disabled={phase !== 'betting' || stake <= 1}
        >
          −
        </button>
        <div className="keno-stake-display">
          {stake.toFixed(2)} ETB
        </div>
        <button
          type="button"
          className="keno-step-btn"
          onClick={() => adjustStake(5)}
          disabled={phase !== 'betting'}
        >
          +
        </button>
      </div>

      {/* Quick Stake Chips */}
      <div className="keno-quick-chips">
        {[1, 5, 10, 25, 50, 100].map((amt) => (
          <button
            key={amt}
            type="button"
            className="keno-chip-btn"
            onClick={() => setStake(amt)}
            disabled={phase !== 'betting'}
          >
            +{amt}
          </button>
        ))}
      </div>

      {/* Error message */}
      {betError && (
        <div style={{ color: 'var(--keno-r)', fontSize: '12px', textAlign: 'center', marginBottom: '8px' }}>
          {betError}
        </div>
      )}

      {/* Big Action Button (Reference: media_1794429289194_447e89b7.png) */}
      <button
        type="button"
        className={`keno-bet-btn ${isBetAcceptedFlash ? 'accepted' : ''}`}
        onClick={handlePlaceBet}
        disabled={isBetAcceptedFlash || !canBet}
      >
        {isBetAcceptedFlash ? (
          <>
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ffffff"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            BET ACCEPTED
          </>
        ) : loading ? (
          'PLACING...'
        ) : phase !== 'betting' ? (
          'BETTING CLOSED'
        ) : spots === 0 ? (
          'SELECT 1 TO 10 NUMBERS'
        ) : (
          `BET ${stake.toFixed(2)} ETB (${spots} SPOTS)`
        )}
      </button>

      {/* Active User Tickets */}
      {activeTickets.length > 0 && (
        <div className="keno-active-tickets" style={{ marginTop: '12px' }}>
          <div style={{ fontSize: '12px', color: 'var(--keno-mut)', fontWeight: 700 }}>
            YOUR ACTIVE TICKETS ({activeTickets.length})
          </div>
          {activeTickets.map((t) => {
            const hits = t.selectedNumbers.filter((n) => drawnBalls.includes(n));
            const p = ATLAS_V_PAYTABLE[t.spotCount] || {};
            const count = hits.length;
            const mult = p[count] !== undefined ? p[count] : (count === 0 && p[0] !== undefined ? p[0] : 0);
            const isPayout = mult >= 1.0;

            let statusLabel = 'Waiting';
            let statusColor = 'var(--keno-y)';
            if (phase === 'settlement') {
              if (t.winAmount !== undefined && t.winAmount > 0) {
                statusLabel = (t.winAmount % 1 === 0 ? t.winAmount : t.winAmount.toFixed(2)).toString();
                statusColor = 'var(--keno-g)';
              } else {
                statusLabel = '0';
                statusColor = 'var(--keno-mut)';
              }
            }

            const hasHit = count > 0;

            return (
              <div key={t.id} className={`keno-ticket-badge ${hasHit ? 'has-hit' : ''}`}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#3ddc97' }}>
                    {activeTickets.length - idx} My Ticket
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--keno-mut)' }}>
                    Bet {t.betAmount.toFixed(0)} • {t.spotCount} Spots
                  </div>
                  <div className="keno-ticket-numbers" style={{ marginTop: '3px' }}>
                    {t.selectedNumbers.map((num) => {
                      const isHit = drawnBalls.includes(num);
                      return (
                        <span key={num} className={`keno-ticket-num ${isHit ? 'hit' : ''}`}>
                          {num}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '12px', fontWeight: 900, color: statusColor }}>
                    {statusLabel}
                  </div>
                  {t.winAmount !== undefined && t.winAmount > 0 && (
                    <div style={{ fontSize: '13px', fontWeight: 900, color: 'var(--keno-g)' }}>
                      +{t.winAmount.toFixed(2)} ETB 🏆
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

