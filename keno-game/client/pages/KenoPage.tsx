import React from 'react';
import { KenoProvider, useKeno } from '../context/KenoContext.tsx';
import { KenoBallTray } from '../components/KenoBallTray.tsx';
import { KenoGrid80 } from '../components/KenoGrid80.tsx';
import { KenoBetSlip } from '../components/KenoBetSlip.tsx';
import { KenoOddsPaytable } from '../components/KenoOddsPaytable.tsx';
import { KenoRulesModal } from '../components/KenoRulesModal.tsx';
import '../styles/keno.css';

const KenoGameView: React.FC = () => {
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
      {/* ── Top Header ── */}
      <header className="keno-header">
        <div className="keno-logo" onClick={() => openRulesModal('rules')}>
          <span className="t1">FAST</span>
          <span className="t2">
            KENO<i></i>
          </span>
        </div>

        <div className="keno-pill">
          <span className="bal">
            {balance.toFixed(2)} <sup>ETB</sup>
          </span>
          <span className="user-id">
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="#7d8c89"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            {userId}
          </span>
        </div>

        <button
          type="button"
          className="keno-menu-btn"
          onClick={() => openRulesModal('rules')}
          aria-label="Open Game Rules & Fairness"
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
          ? 'DRAWING'
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

      {/* ── Rules & Fairness Modal ── */}
      <KenoRulesModal />
    </div>
  );
};

export const KenoPage: React.FC<{ socketUrl?: string; userId?: string }> = ({
  socketUrl,
  userId
}) => {
  return (
    <KenoProvider socketUrl={socketUrl} userId={userId}>
      <KenoGameView />
    </KenoProvider>
  );
};

export default KenoPage;

