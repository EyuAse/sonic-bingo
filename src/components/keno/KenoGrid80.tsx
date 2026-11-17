import React from 'react';
import { useKeno } from '../../context/KenoContext.tsx';

export const KenoGrid80: React.FC = () => {
  const {
    selectedNumbers,
    toggleNumber,
    drawnBalls,
    hotNumbers,
    coldNumbers,
    phase
  } = useKeno();

  const isDrawn = (n: number) => drawnBalls.includes(n);
  const isSelected = (n: number) => selectedNumbers.has(n);
  const isHit = (n: number) => isSelected(n) && isDrawn(n);
  const isHot = (n: number) => hotNumbers.includes(n);
  const isCold = (n: number) => coldNumbers.includes(n);

  return (
    <div className="keno-grid-container">
      <div className="keno-grid-80">
        {Array.from({ length: 80 }, (_, i) => i + 1).map((num) => {
          const hit = isHit(num);
          const sel = isSelected(num);
          const drawn = isDrawn(num);
          const hot = isHot(num);
          const cold = isCold(num);

          let cellClass = 'keno-cell';
          if (hit) cellClass += ' hit';
          else if (sel) cellClass += ' selected';
          else if (drawn) cellClass += ' drawn';

          if (phase !== 'betting') {
            cellClass += ' disabled';
          }

          return (
            <button
              key={num}
              type="button"
              className={cellClass}
              onClick={() => toggleNumber(num)}
              disabled={phase !== 'betting'}
              aria-label={`Keno ball ${num}`}
            >
              {num}
              {hot && !sel && !drawn && <span className="keno-badge hot">🔥</span>}
              {cold && !sel && !drawn && <span className="keno-badge cold">❄️</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
};

