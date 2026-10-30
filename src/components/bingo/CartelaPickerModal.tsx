import React, { useState, useMemo } from 'react';
import { useBingo, generateCardFromId } from '../../context/BingoContext.tsx';
import { useApp } from '../../context/AppContext.tsx';
import { useLanguage } from '../../context/LanguageContext.tsx';

const CARD_RANGES = [
  { label: '1 - 100', min: 1, max: 100 },
  { label: '101 - 200', min: 101, max: 200 },
  { label: '201 - 300', min: 201, max: 300 },
  { label: '301 - 400', min: 301, max: 400 },
  { label: '401 - 500', min: 401, max: 500 },
  { label: '501 - 600', min: 501, max: 600 },
  { label: 'All 600', min: 1, max: 600 }
];

export const CartelaPickerModal: React.FC = () => {
  const {
    isCartelaPickerOpen,
    closeCartelaPicker,
    selectedCartelaIds,
    toggleCartelaSelection,
    occupiedCartelaIds,
    cardQuantity,
    betAmount,
    buyTicket,
    hasTicket
  } = useBingo();
  const { showToast } = useApp();
  const { lang } = useLanguage();

  const [activeRangeIdx, setActiveRangeIdx] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [previewCartelaId, setPreviewCartelaId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const activeRange = CARD_RANGES[activeRangeIdx] || CARD_RANGES[0];

  // Active selected cartelas according to cardQuantity
  const activeSelected = useMemo(() => {
    return selectedCartelaIds.slice(0, cardQuantity);
  }, [selectedCartelaIds, cardQuantity]);

  // Preview cells for inspected cartela (defaults to first selected)
  const currentPreviewId = previewCartelaId || activeSelected[0] || 1;
  const previewCells = useMemo(() => {
    return generateCardFromId(currentPreviewId);
  }, [currentPreviewId]);

  if (!isCartelaPickerOpen) return null;

  // Filter 1 to 600 numbers by range and search
  const visibleNumbers = Array.from({ length: 600 }, (_, i) => i + 1).filter(num => {
    if (searchTerm) {
      return String(num).includes(searchTerm);
    }
    return num >= activeRange.min && num <= activeRange.max;
  });

  const boardsText = `${activeSelected.length}/${cardQuantity}`;
  const roundDisplay = `${betAmount} ETB`;

  return (
    <div className="cartela-picker-overlay" onClick={closeCartelaPicker}>
      <div className="cartela-picker-modal-card brand-theme" onClick={e => e.stopPropagation()}>

        {/* ── Top Bar (Matches Screenshot: Boards: 0/2 | 10 №1 | ✕) ── */}
        <div className="afro-picker-topbar">
          <div className="afro-boards-counter-wrap">
            <span className="afro-boards-label">
              {lang === 'am' ? 'ካርቴላዎች' : 'Boards'}:
            </span>
            <span className="afro-boards-count">{boardsText}</span>
          </div>

          <div className="afro-stake-round-badge">
            <span className="stake-coin">🪙</span>
            <span className="stake-txt">{roundDisplay}</span>
          </div>

          <button
            type="button"
            className="btn-afro-modal-close"
            onClick={closeCartelaPicker}
            title="Close Cartela Selector"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* ── Subtitle / Instructions ── */}
        <div className="afro-picker-hint-bar">
          <span>
            {lang === 'am'
              ? `የሚፈልጉትን ${cardQuantity} ካርቴላ ቁጥሮች ይምረጡ`
              : `Tap numbers to select your ${cardQuantity} ${cardQuantity === 1 ? 'Cartela' : 'Cartelas'}`}
          </span>
          <div className="afro-active-chips">
            {activeSelected.map((id, idx) => (
              <span key={id} className="afro-chip-pill">
                #{id} {idx === 0 ? '(Card 1)' : idx === 1 ? '(Card 2)' : idx === 2 ? '(Card 3)' : '(Card 4)'}
              </span>
            ))}
          </div>
        </div>

        {/* ── Scrollable Modal Body (Contains controls, 9-col grid, and card preview) ── */}
        <div className="afro-picker-modal-scrollable-body">
          {/* ── Range Filter Tabs & Search Row (Strictly No Shuffle Button) ── */}
          <div className="afro-picker-controls-row">
          <div className="afro-range-tabs">
            {CARD_RANGES.map((range, idx) => (
              <button
                key={range.label}
                type="button"
                className={`btn-afro-range-tab ${activeRangeIdx === idx && !searchTerm ? 'active' : ''}`}
                onClick={() => {
                  setActiveRangeIdx(idx);
                  setSearchTerm('');
                }}
              >
                {range.label}
              </button>
            ))}
          </div>

          <div className="afro-search-wrap">
            <i className="fa-solid fa-magnifying-glass search-ico"></i>
            <input
              type="number"
              min="1"
              max="600"
              placeholder="Search #..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="afro-search-input"
            />
            {searchTerm && (
              <button
                type="button"
                className="btn-clear-search"
                onClick={() => setSearchTerm('')}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* ── 9-Column Number Pill Grid (Reference Screenshot Structure, Brand Colors) ── */}
        <div className="afro-9col-scroll-area">
          <div className="afro-9col-grid">
            {visibleNumbers.map(num => {
              const isSelected = activeSelected.includes(num);
              const isTaken = occupiedCartelaIds.includes(num);
              const isPreviewed = currentPreviewId === num;

              let cellClass = 'afro-num-pill';
              if (isSelected) cellClass += ' selected';
              else if (isTaken) cellClass += ' taken';
              else if (isPreviewed) cellClass += ' preview-focus';

              return (
                <button
                  key={num}
                  type="button"
                  className={cellClass}
                  onClick={() => {
                    if (!isTaken) {
                      setPreviewCartelaId(num);
                      toggleCartelaSelection(num);
                    }
                  }}
                  onMouseEnter={() => setPreviewCartelaId(num)}
                  disabled={isTaken}
                  title={isTaken ? `Cartela #${num} is already taken in this arena` : `Click to select Cartela #${num}`}
                >
                  <span className="pill-num">{num}</span>
                  {isSelected && <span className="pill-check">✓</span>}
                  {isTaken && <span className="pill-lock">🔒</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Collapsible Live 5x5 Card Inspection Preview ── */}
        <div className="afro-card-preview-drawer">
          <div className="preview-drawer-hdr">
            <span className="preview-title">
              👀 {lang === 'am' ? 'የካርቴላ ይዘት' : 'Card Preview'}: <strong>Cartela #{currentPreviewId}</strong>
            </span>
            <span className="preview-indicator">
              {activeSelected.includes(currentPreviewId) ? '✓ Selected' : 'Tap number to select'}
            </span>
          </div>

          <div className="mini-cartela-5x5-grid">
            <div className="mini-col-headers">
              <span className="col-hdr col-b">B</span>
              <span className="col-hdr col-i">I</span>
              <span className="col-hdr col-n">N</span>
              <span className="col-hdr col-g">G</span>
              <span className="col-hdr col-o">O</span>
            </div>
            <div className="mini-cells-matrix">
              {previewCells.map(cell => (
                <div
                  key={cell.index}
                  className={`mini-cell ${cell.isFree ? 'free' : ''}`}
                >
                  {cell.isFree ? '⭐' : cell.val}
                </div>
              ))}
            </div>
          </div>
        </div>
        </div>

        {/* ── Footer Bar: Confirm & Buy / Play ── */}
        <div className="afro-picker-footer">
          <div className="afro-footer-info">
            <span className="footer-playing-lbl">{lang === 'am' ? 'የተመረጡ:' : 'Ready:'}</span>
            <strong className="footer-playing-nums">
              #{activeSelected.join(' · #')}
            </strong>
          </div>

          <button
            type="button"
            className="btn-afro-confirm-action"
            onClick={async () => {
              if (activeSelected.length < cardQuantity) {
                showToast(
                  lang === 'am'
                    ? `እባክዎ ${cardQuantity} ካርቴላ ይምረጡ!`
                    : `Please select ${cardQuantity} cartela${cardQuantity > 1 ? 's' : ''} first!`
                );
                return;
              }
              closeCartelaPicker();
              if (!hasTicket) {
                setIsSubmitting(true);
                try {
                  await buyTicket();
                } finally {
                  setIsSubmitting(false);
                }
              }
            }}
            disabled={isSubmitting}
          >
            <i className="fa-solid fa-circle-check"></i>
            <span>
              {hasTicket
                ? (lang === 'am' ? `ምርጫ አረጋግጥ (${boardsText})` : `Confirm Cartelas (${boardsText})`)
                : (lang === 'am'
                    ? `ካርቴላ ይግዙ · ${cardQuantity * betAmount} ብር (${boardsText})`
                    : `Confirm & Buy Ticket · ${cardQuantity * betAmount} ETB (${boardsText})`)}
            </span>
          </button>
        </div>

      </div>
    </div>
  );
};
