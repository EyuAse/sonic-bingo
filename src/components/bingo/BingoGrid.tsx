import React, { useState, useEffect } from 'react';
import { useBingo, BingoCell } from '../../context/BingoContext.tsx';
import { useLanguage } from '../../context/LanguageContext.tsx';

// ── Column headers with distinct standard bingo colors ─────
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
  isGridItem?: boolean;
  onCardClick?: () => void;
}> = ({
  cells, cardIndex, cartelaId, label,
  isWinningCard, winningLine, autoPlay, onDaub,
  isSingleCard, isPreview, onOpenPicker,
  toGo, isGridItem, onCardClick
}) => {
  const { lang } = useLanguage();

  // ── Unselected Cartela Placeholder (When user hasn't chosen cartelas yet) ──
  if (isPreview && (!cartelaId || cartelaId === 0 || !cells || cells.length === 0)) {
    return (
      <div
        className={`new-cartela-card empty-cartela-placeholder ${isSingleCard ? 'single-card' : ''} ${isGridItem ? 'grid-item-card' : ''}`}
        onClick={onCardClick || onOpenPicker}
        title="Tap to choose your cartela from 600 available boards"
      >
        <div className="empty-cartela-inner">
          <div className="empty-cartela-top">
            <span className="empty-cartela-badge">{lang === 'am' ? `ካርቴላ #${cardIndex + 1}` : `CARTELA #${cardIndex + 1}`}</span>
            <span className="empty-cartela-status">{lang === 'am' ? 'አልተመረጠም' : 'NOT SELECTED'}</span>
          </div>
          <div className="empty-cartela-icon-wrap">
            <span className="empty-cartela-icon">🎟️</span>
          </div>
          <div className="empty-cartela-title">
            {lang === 'am' ? 'ካርቴላ ለመምረጥ ይንኩ' : 'Tap to Choose Board'}
          </div>
          <div className="empty-cartela-sub">
            {lang === 'am' ? 'ከ600 ካርቴላዎች ውስጥ ይምረጡ' : 'Pick your number from 600 cartelas'}
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
            <span>{lang === 'am' ? 'ካርቴላ ይምረጡ' : 'Select Cartela'}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`new-cartela-card ${isSingleCard ? 'single-card' : ''} ${isGridItem ? 'grid-item-card' : ''} ${toGo === 1 ? 'card-has-1-togo' : ''}`}
      onClick={isGridItem && onCardClick ? onCardClick : undefined}
    >
      {/* ── Card Header Bar: Cartela #202 + To Go Badge ── */}
      <div className="new-card-header">
        <div
          className="new-card-header-left"
          onClick={isPreview && onOpenPicker ? onOpenPicker : undefined}
          style={{ cursor: isPreview ? 'pointer' : 'default' }}
          title={isPreview ? "Click to pick from 600 cartelas" : undefined}
        >
          <span className="new-card-header-label">{label}</span>
          {isPreview && <span className="new-card-preview-badge">PREVIEW</span>}
        </div>

        <div className="new-card-header-right">
          {/* Real-Time To Go Status during live game */}
          {!isPreview && typeof toGo === 'number' && (
            toGo === 0 ? (
              <span className="card-togo-pill togo-win">🏆 BINGO</span>
            ) : toGo === 1 ? (
              <span className="card-togo-pill togo-1">🔥 1 TO GO</span>
            ) : toGo === 2 ? (
              <span className="card-togo-pill togo-2">⚡ 2 TO GO</span>
            ) : null
          )}

          {isPreview && onOpenPicker && (
            <button
              type="button"
              className="btn-card-preview-shuffle"
              onClick={e => {
                e.stopPropagation();
                onOpenPicker();
              }}
              title="Choose from 600 cartelas"
            >
              🎟️ Pick
            </button>
          )}

          {isGridItem && (
            <span className="grid-item-zoom-hint" title="Click to zoom in">
              🔍 Zoom
            </span>
          )}
        </div>
      </div>

      {/* ── Card Body: B I N G O letters + 5×5 grid ── */}
      <div className="new-card-body">
        {/* B I N G O column header row */}
        <div className="new-bingo-col-headers">
          {CARD_COLUMNS.map(c => (
            <div key={c.letter} className={`new-bingo-col-hdr ${c.colClass}`}>
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
                  !autoPlay && !cell.marked ? 'interactive-tap' : '',
                ].filter(Boolean).join(' ')}
                onClick={(e) => {
                  if (isGridItem && onCardClick) {
                    // In grid view, click zooms into focused card mode
                    onCardClick();
                  } else if (!autoPlay) {
                    e.stopPropagation();
                    onDaub(cardIndex, cell.index);
                  }
                }}
              >
                {cell.isFree ? (
                  /* FREE center cell with golden star */
                  <div className="new-free-content">
                    <span className="new-free-star">⭐</span>
                  </div>
                ) : (
                  /* Number cell (green background if daubed, white if normal) */
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
export const BingoGrid: React.FC = () => {
  const {
    cartela1Data,
    cartela2Data,
    cartela3Data,
    cartela4Data,
    totalPlayableCards,
    selectedCartelaIds,
    handleManualDaub,
    winResult,
    autoPlay,
    roundPhase,
    hasTicket,
    openCartelaPicker,
  } = useBingo();

  // Tab state: 0, 1, 2, 3 for single card focus; -1 for 4-grid view
  const [activeTab, setActiveTab] = useState<number>(0);

  // Keep active tab valid if totalPlayableCards decreases
  useEffect(() => {
    if (activeTab >= totalPlayableCards) {
      setActiveTab(0);
    }
  }, [totalPlayableCards, activeTab]);

  const isSingleCardTotal = totalPlayableCards === 1;

  const currentCards = [
    {
      data: cartela1Data,
      id: selectedCartelaIds[0] || 0,
      cardIndex: 0,
      label: selectedCartelaIds[0] ? `Cartela #${selectedCartelaIds[0]}` : 'Cartela #1 (Unselected)',
    },
    {
      data: cartela2Data,
      id: selectedCartelaIds[1] || 0,
      cardIndex: 1,
      label: selectedCartelaIds[1] ? `Cartela #${selectedCartelaIds[1]}` : 'Cartela #2 (Unselected)',
    },
    {
      data: cartela3Data,
      id: selectedCartelaIds[2] || 0,
      cardIndex: 2,
      label: selectedCartelaIds[2] ? `Cartela #${selectedCartelaIds[2]}` : 'Cartela #3 (Unselected)',
    },
    {
      data: cartela4Data,
      id: selectedCartelaIds[3] || 0,
      cardIndex: 3,
      label: selectedCartelaIds[3] ? `Cartela #${selectedCartelaIds[3]}` : 'Cartela #4 (Unselected)',
    },
  ].slice(0, totalPlayableCards);

  // Calculate To-Go for each card
  const cardsWithToGo = currentCards.map(c => ({
    ...c,
    toGo: calculateCardToGo(c.data)
  }));

  // Auto-switch notice: If user is on a card and another card reaches 1-To-Go
  const anyCardHas1ToGo = cardsWithToGo.some(c => c.toGo === 1);

  return (
    <div className="bingo-cartelas-container">
      {/* Multi-Card Navigation Tabs (Shown whenever player has 2, 3, or 4 cards) */}
      {!isSingleCardTotal && (
        <div className="cartela-tabs-header-bar">
          <div className="cartela-tabs-scroll-row">
            {cardsWithToGo.map((card, idx) => {
              const isActive = activeTab === idx;
              return (
                <button
                  key={card.cardIndex}
                  type="button"
                  className={`cartela-nav-tab-pill ${isActive ? 'tab-active' : ''} ${card.toGo === 1 ? 'tab-alert-1-togo' : ''}`}
                  onClick={() => setActiveTab(idx)}
                >
                  <span className="tab-pill-label">Card #{idx + 1}</span>
                  {card.id > 0 && <span className="tab-pill-cartela-num">#{card.id}</span>}
                  {roundPhase === 'playing' && (
                    card.toGo === 0 ? (
                      <span className="tab-pill-badge badge-win">🏆</span>
                    ) : card.toGo === 1 ? (
                      <span className="tab-pill-badge badge-1togo">🔥 1</span>
                    ) : card.toGo === 2 ? (
                      <span className="tab-pill-badge badge-2togo">⚡ 2</span>
                    ) : null
                  )}
                </button>
              );
            })}

            {/* Grid / All View toggle button */}
            <button
              type="button"
              className={`cartela-nav-tab-pill tab-grid-toggle ${activeTab === -1 ? 'tab-active' : ''}`}
              onClick={() => setActiveTab(-1)}
              title="View all cards side-by-side"
            >
              <span>⊞ {totalPlayableCards === 4 ? '4-Grid' : 'All'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ── CARD DISPLAY AREA ── */}
      {/* Mode A: Focused Single Card (activeTab >= 0 or isSingleCardTotal) */}
      {(isSingleCardTotal || activeTab >= 0) && (
        <div className="compact-cartelas-stack single-cartela">
          {cardsWithToGo[activeTab >= 0 && activeTab < cardsWithToGo.length ? activeTab : 0] && (
            <NewCard5x5
              key={cardsWithToGo[activeTab >= 0 && activeTab < cardsWithToGo.length ? activeTab : 0].cardIndex}
              cells={cardsWithToGo[activeTab >= 0 && activeTab < cardsWithToGo.length ? activeTab : 0].data}
              cardIndex={cardsWithToGo[activeTab >= 0 && activeTab < cardsWithToGo.length ? activeTab : 0].cardIndex}
              cartelaId={cardsWithToGo[activeTab >= 0 && activeTab < cardsWithToGo.length ? activeTab : 0].id}
              label={cardsWithToGo[activeTab >= 0 && activeTab < cardsWithToGo.length ? activeTab : 0].label}
              isWinningCard={roundPhase !== 'lobby' && winResult !== null && winResult.winningCartelaNumber === cardsWithToGo[activeTab >= 0 && activeTab < cardsWithToGo.length ? activeTab : 0].id}
              winningLine={Array.isArray(winResult?.winningLine) ? winResult.winningLine : []}
              autoPlay={autoPlay}
              onDaub={handleManualDaub}
              isSingleCard={true}
              isPreview={roundPhase === 'lobby' && !hasTicket}
              onOpenPicker={openCartelaPicker}
              toGo={cardsWithToGo[activeTab >= 0 && activeTab < cardsWithToGo.length ? activeTab : 0].toGo}
            />
          )}
        </div>
      )}

      {/* Mode B: All Cards Grid View (activeTab === -1) */}
      {!isSingleCardTotal && activeTab === -1 && (
        <div className={`cartelas-multi-grid count-${totalPlayableCards}`}>
          {cardsWithToGo.map(card => (
            <NewCard5x5
              key={card.cardIndex}
              cells={card.data}
              cardIndex={card.cardIndex}
              cartelaId={card.id}
              label={card.id ? `C#${card.id}` : `Card #${card.cardIndex + 1}`}
              isWinningCard={roundPhase !== 'lobby' && winResult !== null && winResult.winningCartelaNumber === card.id}
              winningLine={Array.isArray(winResult?.winningLine) ? winResult.winningLine : []}
              autoPlay={autoPlay}
              onDaub={handleManualDaub}
              isSingleCard={false}
              isGridItem={true}
              onCardClick={() => setActiveTab(card.cardIndex)}
              isPreview={roundPhase === 'lobby' && !hasTicket}
              onOpenPicker={openCartelaPicker}
              toGo={card.toGo}
            />
          ))}
        </div>
      )}
    </div>
  );
};
