import React from 'react';
import { useKeno } from '../context/KenoContext.tsx';
import { ATLAS_V_PAYTABLE } from '../../server/game/kenoMath.ts';

export const KenoOddsPaytable: React.FC = () => {
  const { selectedNumbers, stake, openRulesModal } = useKeno();

  const spotCount = selectedNumbers.size || 5; // Default to 5-spot preview if none picked
  const payMap = ATLAS_V_PAYTABLE[spotCount] || {};

  // Sort descending by hits, with 0 hits at the end
  const hitKeys = Object.keys(payMap)
    .map(Number)
    .sort((a, b) => {
      if (a === 0) return 1;
      if (b === 0) return -1;
      return b - a;
    });

  return (
    <div className="keno-paytable-card">
      <div className="keno-paytable-header">
        <span>
          PAYTABLE FOR <strong>{spotCount} SPOTS</strong>
        </span>
        <button
          type="button"
          onClick={() => openRulesModal('rules')}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--keno-g)',
            fontSize: '12px',
            cursor: 'pointer',
            padding: 0
          }}
        >
          View Full Matrix ➔
        </button>
      </div>

      <div className="keno-paytable-grid">
        {hitKeys.map((hits) => {
          const mult = payMap[hits] || 0;
          const possibleWin = mult * stake;
          const isTop = hits === spotCount;
          const isBonus = hits === 0 && mult > 1.0;

          let hitsLabel = `${hits} Hits`;
          if (hits === 0) {
            hitsLabel = isBonus ? `0 Hits (${mult}x Win)` : '0 Hits';
          }

          return (
            <div
              key={hits}
              className={`keno-paytable-row ${isTop ? 'highlight' : ''}`}
            >
              <div className="keno-paytable-hits" style={{ color: isTop ? '#3ddc97' : isBonus ? '#f5c542' : undefined }}>
                {hitsLabel}
              </div>
              <div className="keno-paytable-mult" style={{ color: isTop ? '#3ddc97' : isBonus ? '#f5c542' : undefined }}>
                {mult}×
              </div>
              <div className="keno-paytable-win">
                {possibleWin.toFixed(1)} ETB
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

