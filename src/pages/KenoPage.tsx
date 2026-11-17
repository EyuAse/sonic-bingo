/**
 * src/pages/KenoPage.tsx
 * Production Fast Keno Page View for Sonic Bingo Mini-App
 * Features Back-to-Lobby Navigation • Real Wallet Sync • Provably Fair Verification
 */

import React from 'react';
import { KenoProvider, useKeno } from '../context/KenoContext.tsx';
import { KenoBallTray } from '../components/keno/KenoBallTray.tsx';
import { KenoGrid80 } from '../components/keno/KenoGrid80.tsx';
import { KenoBetSlip } from '../components/keno/KenoBetSlip.tsx';
import { KenoOddsPaytable } from '../components/keno/KenoOddsPaytable.tsx';
import { KenoRulesModal } from '../components/keno/KenoRulesModal.tsx';
import { KenoVictoryModal } from '../components/keno/KenoVictoryModal.tsx';
import '../styles/keno.css';

interface KenoPageProps {
  onBackToLobby?: () => void;
}

const KenoGameView: React.FC<KenoPageProps> = ({ onBackToLobby }) => {
  const {
    balance,
    userId,
    phase,
    timeRemaining,
    openRulesModal
  } = useKeno();

  const isUrgent = phase === 'betting' && timeRemaining <= 3;

  return (
    <div className="keno-app-container">
      {/* ── Top Return & Brand Bar ── */}
      <header className="keno-header">
        {onBackToLobby && (
          <button
            type="button"
            className="keno-back-btn"
            onClick={onBackToLobby}
            title="Return to Bingo Lobby"
            aria-label="Return to Bingo Lobby"
            style={{
              background: '#262f2e',
              border: '1px solid #1d4a3b',
              color: '#3ddc97',
              borderRadius: '10px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexShrink: 0,
              transition: 'transform 0.15s, background 0.15s'
            }}
          >
            <span>⬅️</span>
            <span>ሎቢ / Lobby</span>
          </button>
        )}

        <div className="keno-logo" onClick={() => openRulesModal('rules')}>
          <span className="t1">FAST</span>
          <span className="t2">
            KENO<i></i>
          </span>
        </div>

        <div className="keno-pill" style={{ marginLeft: 'auto' }}>
          <span className="bal">
            {balance.toFixed(2)} <sup>ETB</sup>
          </span>
          <span className="user-id">
            <svg
              viewBox="0 0 24 24"
              width="13"
              height="13"
              fill="none"
              stroke="#7d8c89"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            {userId ? userId.slice(0, 8) : 'Player'}
          </span>
        </div>

        <button
          type="button"
          className="keno-menu-btn"
          onClick={() => openRulesModal('rules')}
          aria-label="Open Game Rules & Fairness"
          title="Game Rules & Cryptographic Fairness"
        >
          <i></i>
          <i></i>
          <i></i>
        </button>
      </header>

      {/* ── Timer Pill ── */}
      <div className={`keno-timer-pill ${isUrgent ? 'urgent' : ''}`}>
        {phase === 'betting'
          ? `00 : ${String(Math.max(0, timeRemaining)).padStart(2, '0')}`
          : phase === 'drawing'
          ? 'DRAWING BALLS'
          : 'SETTLING'}
      </div>

      {/* ── Ball Tray & Reveal Stage ── */}
      <KenoBallTray />

      {/* ── 80-Ball Interactive Selection Grid ── */}
      <KenoGrid80 />

      {/* ── Bet Slip & Quick Picks ── */}
      <KenoBetSlip />

      {/* ── Dynamic Odds & Possible Win Paytable ── */}
      <KenoOddsPaytable />

      {/* ── Rules & Provably Fair Modal ── */}
      <KenoRulesModal />

      {/* ── Victory Celebration Modal ── */}
      <KenoVictoryModal />
    </div>
  );
};

export const KenoPage: React.FC<KenoPageProps> = ({ onBackToLobby }) => {
  return (
    <KenoProvider>
      <KenoGameView onBackToLobby={onBackToLobby} />
    </KenoProvider>
  );
};

export default KenoPage;
