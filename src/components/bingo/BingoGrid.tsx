import React from 'react';
import { useBingo, BingoCell } from '../../context/BingoContext.tsx';
import { useLanguage } from '../../context/LanguageContext.tsx';

// ── Column headers ─────────────────────────────────────────
const CARD_COLUMNS = [
  { letter: 'B', colClass: 'col-b' },
  { letter: 'I', colClass: 'col-i' },
  { letter: 'N', colClass: 'col-n' },
  { letter: 'G', colClass: 'col-g' },
  { letter: 'O', colClass: 'col-o' },
];

// 13 Winning patterns to calculate "To Go" status
const WIN_PATTERNS: number[][] = [
  // 5 Rows
  [0, 1, 2, 3, 4],
  [5, 6, 7, 8, 9],
  [10, 11, 12, 13, 14],
  [15, 16, 17, 18, 19],
  [20, 21, 22, 23, 24],
  // 5 Columns
  [0, 5, 10, 15, 20],
  [1, 6, 11, 16, 21],
  [2, 7, 12, 17, 22],
  [3, 8, 13, 18, 23],
  [4, 9, 14, 19, 24],
  // 2 Diagonals
  [0, 6, 12, 18, 24],
  [4, 8, 12, 16, 20],
  // 4 Corners
  [0, 4, 20, 24]
];

export const calculateCardToGo = (cells: BingoCell[]): number => {
  if (!cells || cells.length < 25) return 5;
  let minToGo = 5;
  for (const line of WIN_PATTERNS) {
    let uncompleted = 0;
    for (const idx of line) {
      if (!cells[idx]?.marked && !cells[idx]?.isFree) {
        uncompleted++;
      }
    }
    if (uncompleted < minToGo) {
      minToGo = uncompleted;
    }
  }
  return minToGo;
};

const NewCard5x5: React.FC<{
  cells: BingoCell[];
  cardIndex: number;
  cartelaId: number;
  label: string;
  isWinningCard: boolean;
  winningLine: number[];
  autoPlay: boolean;
  onDaub: (cardIdx: number, cellIdx: number) => void;
  isSingleCard?: boolean;
  isPreview?: boolean;
  onOpenPicker?: () => void;
  toGo?: number;
}> = ({
  cells, cardIndex, cartelaId, label,
  isWinningCard, winningLine, autoPlay, onDaub,
  isSingleCard, isPreview, onOpenPicker,
  toGo
}) => {
  const { lang } = useLanguage();

  // ── Unselected Cartela Placeholder ──
  if (isPreview && (!cartelaId || cartelaId === 0 || !cells || cells.length === 0)) {
    return (
      <div
        className={`new-cartela-card empty-cartela-placeholder ${isSingleCard ? 'single-card' : ''}`}
        onClick={onOpenPicker}
        title="Tap to choose your cartela from 600 available boards"
      >
        <div className="empty-cartela-inner">
          <div className="empty-cartela-top">
            <span className="empty-cartela-badge">Cartela #{cardIndex + 1}</span>
            <span className="empty-cartela-status">{lang === 'am' ? 'አልተመረጠም' : 'NOT SELECTED'}</span>
          </div>
          <div className="empty-cartela-icon-wrap">
            <span className="empty-cartela-icon">🎟️</span>
          </div>
          <div className="empty-cartela-title">
            {lang === 'am' ? 'ካርቴላ ለመምረጥ ይንኩ' : 'Tap to Choose'}
          </div>
          <button
            type="button"
            className="btn-empty-cartela-cta"
            onClick={e => {
              e.stopPropagation();
              onOpenPicker?.();
            }}
          >
            <i className="fa-solid fa-plus"></i>
            <span>{lang === 'am' ? 'ይምረጡ' : 'Select'}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`new-cartela-card ${isSingleCard ? 'single-card' : ''} ${toGo === 1 ? 'card-has-1-togo' : ''}`}>
      {/* ── Card Header matching Image: Black with diagonal gold transition, Cartela #, PREVIEW badge, eye icon ── */}
      <div className="new-card-header">
        <div className="new-card-header-left">
          <span className="new-card-header-title">Cartela #{cardIndex + 1}</span>
          {cartelaId > 0 && <span className="new-card-id-sub">#{cartelaId}</span>}
        </div>

        <div className="new-card-header-right">
          {isPreview ? (
            <>
              <span className="new-card-preview-badge">PREVIEW</span>
              <button
                type="button"
                className="btn-card-header-action"
                onClick={e => {
                  e.stopPropagation();
                  onOpenPicker?.();
                }}
                title="Choose from 600 cartelas"
              >
                <i className="fa-solid fa-eye"></i>
              </button>
            </>
          ) : (
            typeof toGo === 'number' && (
              toGo === 0 ? (
                <span className="card-togo-pill togo-win">🏆 BINGO</span>
              ) : toGo === 1 ? (
                <span className="card-togo-pill togo-1">🔥 1 TO GO</span>
              ) : toGo === 2 ? (
                <span className="card-togo-pill togo-2">⚡ 2 TO GO</span>
              ) : null
            )
          )}
        </div>
      </div>

      {/* ── Card Body: Radiant Golden B I N G O Header + 5×5 Matrix ── */}
      <div className="new-card-body">
        {/* B I N G O column header row - Golden Bar across all 5 cols */}
        <div className="new-bingo-col-headers">
          {CARD_COLUMNS.map(c => (
            <div key={c.letter} className="new-bingo-col-hdr">
              {c.letter}
            </div>
          ))}
        </div>

        {/* 5×5 grid cells */}
        <div className="new-cartela-5x5">
          {(Array.isArray(cells) ? cells : []).map(cell => {
            if (!cell || typeof cell.index !== 'number') return null;
            const safeWinningLine = Array.isArray(winningLine) ? winningLine : [];
            const isWinningCell = Boolean(isWinningCard && safeWinningLine.includes(cell.index));
            return (
              <div
                key={`${cardIndex}-${cell.index}`}
                className={[
                  'new-cartela-cell',
                  cell.marked ? 'daubed' : '',
                  cell.isFree ? 'free-cell' : '',
                  isWinningCell ? 'win-glow' : '',
                  !autoPlay && !cell.marked && !cell.isFree ? 'interactive-tap' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => !autoPlay && !cell.isFree && onDaub(cardIndex, cell.index)}
              >
                {cell.isFree ? (
                  /* FREE center cell with golden star */
                  <div className="new-free-content">
                    <span className="new-free-star">⭐</span>
                  </div>
                ) : (
                  /* Number cell (black text normally, white if daubed) */
                  <span className={cell.marked ? 'daubed-number' : 'cell-number'}>
                    {cell.val}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ── Main BingoGrid Export ──────────────────────────────────
export const BingoGrid: React.FC<{ isFullWidth?: boolean }> = ({ isFullWidth = false }) => {
  const {
    cartela1Data,
    cartela2Data,
    cartela3Data,
    cartela4Data,
    totalPlayableCards,
    cardQuantity,
    selectedCartelaIds,
    handleManualDaub,
    winResult,
    autoPlay,
    roundPhase,
    hasTicket,
    openCartelaPicker,
  } = useBingo();

  // Active card count: in lobby before ticket bought, use cardQuantity; once bought/playing, use totalPlayableCards
  const effectiveCount = (hasTicket || roundPhase !== 'lobby') ? totalPlayableCards : cardQuantity;

  const currentCards = [
    {
      data: cartela1Data,
      id: selectedCartelaIds[0] || 0,
      cardIndex: 0,
      label: selectedCartelaIds[0] ? `Cartela #${selectedCartelaIds[0]}` : 'Cartela #1',
    },
    {
      data: cartela2Data,
      id: selectedCartelaIds[1] || 0,
      cardIndex: 1,
      label: selectedCartelaIds[1] ? `Cartela #${selectedCartelaIds[1]}` : 'Cartela #2',
    },
    {
      data: cartela3Data,
      id: selectedCartelaIds[2] || 0,
      cardIndex: 2,
      label: selectedCartelaIds[2] ? `Cartela #${selectedCartelaIds[2]}` : 'Cartela #3',
    },
    {
      data: cartela4Data,
      id: selectedCartelaIds[3] || 0,
      cardIndex: 3,
      label: selectedCartelaIds[3] ? `Cartela #${selectedCartelaIds[3]}` : 'Cartela #4',
    },
  ].slice(0, effectiveCount);

  // Calculate To-Go for each card
  const cardsWithToGo = currentCards.map(c => ({
    ...c,
    toGo: calculateCardToGo(c.data)
  }));

  // 3 or 4 Cartelas: 2x2 Grid taking 100% full width (Matching Image!)
  if (isFullWidth || effectiveCount >= 3) {
    return (
      <div className="bingo-cartelas-2x2-grid">
        {cardsWithToGo.map(card => (
          <NewCard5x5
            key={card.cardIndex}
            cells={card.data}
            cardIndex={card.cardIndex}
            cartelaId={card.id}
            label={card.label}
            isWinningCard={roundPhase !== 'lobby' && winResult !== null && winResult.winningCartelaNumber === card.id}
            winningLine={Array.isArray(winResult?.winningLine) ? winResult.winningLine : []}
            autoPlay={autoPlay}
            onDaub={handleManualDaub}
            isSingleCard={false}
            isPreview={roundPhase === 'lobby' && !hasTicket}
            onOpenPicker={openCartelaPicker}
            toGo={card.toGo}
          />
        ))}
      </div>
    );
  }

  // 1 or 2 Cartelas: Compact vertical stack alongside Left Flashboard 1-75
  return (
    <div className={`compact-cartelas-stack ${effectiveCount === 1 ? 'single-cartela' : 'dual-cartela'}`}>
      {cardsWithToGo.map(card => (
        <NewCard5x5
          key={card.cardIndex}
          cells={card.data}
          cardIndex={card.cardIndex}
          cartelaId={card.id}
          label={card.label}
          isWinningCard={roundPhase !== 'lobby' && winResult !== null && winResult.winningCartelaNumber === card.id}
          winningLine={Array.isArray(winResult?.winningLine) ? winResult.winningLine : []}
          autoPlay={autoPlay}
          onDaub={handleManualDaub}
          isSingleCard={effectiveCount === 1}
          isPreview={roundPhase === 'lobby' && !hasTicket}
          onOpenPicker={openCartelaPicker}
          toGo={card.toGo}
        />
      ))}
    </div>
  );
};
