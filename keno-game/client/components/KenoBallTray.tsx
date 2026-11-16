import React from 'react';
import { useKeno } from '../context/KenoContext.tsx';

export const KenoBallTray: React.FC = () => {
  const {
    phase,
    roundNumber,
    drawnBalls,
    currentDrawnBall,
    selectedNumbers,
    lastWinAmount
  } = useKeno();

  const isSelected = (n: number) => selectedNumbers.has(n);

  return (
    <div className={`keno-stage ${phase === 'drawing' ? 'drawing' : ''}`}>
      {phase === 'betting' && (
        <div className="keno-stage-banner">
          <div>
            <div style={{ fontSize: '11px', color: 'var(--keno-mut)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              ROUND #{roundNumber}
            </div>
            <div style={{ fontSize: '16px', fontWeight: 900, color: '#fff', marginTop: '2px' }}>
              PICK 1 – 10 SPOTS
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '11px', color: 'var(--keno-y)', fontWeight: 700 }}>
              TOP JACKPOT
            </span>
            <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--keno-y)' }}>
              10,000×
            </div>
          </div>
        </div>
      )}

      {(phase === 'drawing' || phase === 'settlement') && (
        <div className="keno-draw-view">
          <div className="keno-big-ball-container">
            <span className="keno-draw-counter">
              {String(drawnBalls.length).padStart(2, '0')} / 20
            </span>

            {phase === 'settlement' && lastWinAmount > 0 ? (
              <div className="win-stage-banner">
                <div className="win-stage-title">YOU WIN</div>
                <div className="win-stage-val">
                  {lastWinAmount % 1 === 0 ? lastWinAmount : lastWinAmount.toFixed(2)}
                </div>
              </div>
            ) : phase === 'settlement' ? (
              <div className="win-stage-banner">
                <div className="win-stage-title" style={{ fontSize: '22px', letterSpacing: '2px' }}>TRY AGAIN</div>
              </div>
            ) : (
              <div
                className={`keno-ball-big ${
                  currentDrawnBall && isSelected(currentDrawnBall) ? 'hit' : ''
                }`}
              >
                <span className="keno-ball-num">
                  {currentDrawnBall !== null ? currentDrawnBall : '–'}
                </span>
              </div>
            )}
          </div>

          {/* 20-Ball Live Collection Tray: First 10 called in Row 2, Last 10 called in Row 1 */}
          <div className="keno-tray-grid">
            {Array.from({ length: 20 }, (_, idx) => {
              const ballIndex = idx < 10 ? 10 + idx : idx - 10;
              const ballNum = drawnBalls[ballIndex];
              const isFilled = ballNum !== undefined;
              const hit = isFilled && isSelected(ballNum);

              return (
                <div
                  key={idx}
                  className={`keno-tray-slot ${isFilled ? 'filled' : ''} ${
                    hit ? 'hit' : ''
                  }`}
                >
                  <span className={isFilled ? 'keno-ball-num' : ''}>
                    {isFilled ? ballNum : idx + 1}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

