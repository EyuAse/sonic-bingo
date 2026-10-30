import React from 'react';
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
}> = ({
  cells, cardIndex, cartelaId, label,
  isWinningCard, winningLine, autoPlay, onDaub,
  isSingleCard, isPreview, onOpenPicker
}) => {
  const { lang } = useLanguage();

  // ── Unselected Cartela Placeholder (When user hasn't chosen cartelas yet) ──
  if (isPreview && (!cartelaId || cartelaId === 0 || !cells || cells.length === 0)) {
    return (
      <div
        className={`new-cartela-card empty-cartela-placeholder ${isSingleCard ? 'single-card' : ''}`}
        onClick={onOpenPicker}
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
    <div className={`new-cartela-card ${isSingleCard ? 'single-card' : ''}`}>
      {/* ── Card Header Bar: Cartela #202 (Single-line, no overlap) ── */}
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
                onClick={() => !autoPlay && onDaub(cardIndex, cell.index)}
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

  const isSingleCard = totalPlayableCards === 1;

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

  return (
    <div className={`compact-cartelas-stack ${isSingleCard ? 'single-cartela' : 'dual-cartela'}`}>
      {currentCards.map(card => (
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
          isSingleCard={isSingleCard}
          isPreview={roundPhase === 'lobby' && !hasTicket}
          onOpenPicker={openCartelaPicker}
        />
      ))}
    </div>
  );
};
