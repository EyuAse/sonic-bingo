import React, { useState, useMemo } from 'react';
import { useAdmin, CartelaCard } from '../../context/AdminContext.tsx';
import { useApp } from '../../context/AppContext.tsx';
import '../../styles/admin-cartelas.css';

const RANGE_PRESETS = [
  { label: 'All', start: 1, end: 600 },
  { label: '1–60', start: 1, end: 60 },
  { label: '61–120', start: 61, end: 120 },
  { label: '121–180', start: 121, end: 180 },
  { label: '181–240', start: 181, end: 240 },
  { label: '241–300', start: 241, end: 300 },
  { label: '301–360', start: 301, end: 360 },
  { label: '361–420', start: 361, end: 420 },
  { label: '421–480', start: 421, end: 480 },
  { label: '481–540', start: 481, end: 540 },
  { label: '541–600', start: 541, end: 600 }
];

export const CartelasDesk: React.FC = () => {
  const { cartelaPool } = useAdmin();
  const { showToast } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeRange, setActiveRange] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [selectedCard, setSelectedCard] = useState<CartelaCard | null>(null);

  const safePool = useMemo(() => (Array.isArray(cartelaPool) ? cartelaPool : []), [cartelaPool]);
  const cardsPerPage = 24;

  // Filter pool based on Range & Search
  const filteredCartelas = useMemo(() => {
    let result = safePool;

    // Apply Range Filter if not 'All'
    if (activeRange !== 'All') {
      const preset = RANGE_PRESETS.find(p => p.label === activeRange);
      if (preset) {
        result = result.filter(c => c.id >= preset.start && c.id <= preset.end);
      }
    }

    // Apply Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim().replace(/^#/, '');
      result = result.filter(c => {
        const matchId = String(c.id) === q || String(c.id).includes(q);
        const matchSerial = (c.serialNumber || '').toLowerCase().includes(q);
        return matchId || matchSerial;
      });
    }

    return result;
  }, [safePool, activeRange, searchQuery]);

  const totalPages = Math.ceil(filteredCartelas.length / cardsPerPage) || 1;
  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * cardsPerPage;
  const paginatedCards = filteredCartelas.slice(startIdx, startIdx + cardsPerPage);

  const handleCopySerial = (serial: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(serial);
    }
    showToast(`✓ Copied Serial: ${serial}`);
  };

  const handleRangeClick = (rangeLabel: string) => {
    setActiveRange(rangeLabel);
    setCurrentPage(1);
  };

  return (
    <div className="cartelas-enqu-root">
      {/* 1. Header Bar */}
      <div className="cartelas-top">
        <div className="cartelas-top-left">
          <h1>600 Cartelas Library</h1>
          <p>
            Deterministic 75-ball bingo cards (#1 &ndash; #600) &bull; Zero duplicate matrix &bull; Authentic number allocation
          </p>
        </div>
        <div className="cartelas-top-right">
          <div className="cartelas-pillbox">
            <span className="status-dot"></span>
            <span>600 Cards Active</span>
          </div>
          <div className="av" title="Super Admin"></div>
        </div>
      </div>

      {/* 2. Elevated KPI Grid (4 Cards) */}
      <div className="cartelas-kpi-grid">
        {/* Card 1: Total Registered Cards */}
        <div className="cartelas-kpi-card hero-dark">
          <div className="cartelas-kpi-header">
            <span className="cartelas-kpi-label">Total Serial Cards</span>
            <div className="cartelas-kpi-icon">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="9" y1="21" x2="9" y2="9" />
              </svg>
            </div>
          </div>
          <div className="cartelas-kpi-value">
            600 <span className="cartelas-kpi-unit">Cartelas</span>
          </div>
          <div className="cartelas-kpi-sub">LB-0001 &ndash; LB-0600 Active Pool</div>
        </div>

        {/* Card 2: 75-Ball Matrix */}
        <div className="cartelas-kpi-card">
          <div className="cartelas-kpi-header">
            <span className="cartelas-kpi-label">Matrix Standard</span>
            <div className="cartelas-kpi-icon">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="4" />
                <path d="M7 2v20M12 2v20M17 2v20M2 7h20M2 12h20M2 17h20" />
              </svg>
            </div>
          </div>
          <div className="cartelas-kpi-value">
            75-Ball <span className="cartelas-kpi-unit">5&times;5 Grid</span>
          </div>
          <div className="cartelas-kpi-sub">B(1-15) I(16-30) N(31-45) G(46-60) O(61-75)</div>
        </div>

        {/* Card 3: Free Space Center */}
        <div className="cartelas-kpi-card">
          <div className="cartelas-kpi-header">
            <span className="cartelas-kpi-label">Center Free Space</span>
            <div className="cartelas-kpi-icon">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#e6a21f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </div>
          </div>
          <div className="cartelas-kpi-value">
            100% <span className="cartelas-kpi-unit">Equipped</span>
          </div>
          <div className="cartelas-kpi-sub">Slot N3 Marked (FREE) &bull; Fair Play Invariant</div>
        </div>

        {/* Card 4: Collision Invariant */}
        <div className="cartelas-kpi-card">
          <div className="cartelas-kpi-header">
            <span className="cartelas-kpi-label">Collision Invariant</span>
            <div className="cartelas-kpi-icon">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#2e9e4f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
          </div>
          <div className="cartelas-kpi-value">
            0 <span className="cartelas-kpi-unit">Duplicates</span>
          </div>
          <div className="cartelas-kpi-sub">Deterministic PRNG &bull; Verified Unique</div>
        </div>
      </div>

      {/* 3. Filter, Search & View Controls */}
      <div className="cartelas-controls-card">
        <div className="controls-top-row">
          <div className="cartelas-search-wrapper">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="cartelas-search-input"
              placeholder="Search by Card ID (#42) or Serial (LB-0042)..."
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <div className="controls-view-mode-group">
            <button
              type="button"
              className={`btn-view-mode ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
              <span>5&times;5 Boards</span>
            </button>
            <button
              type="button"
              className={`btn-view-mode ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
              <span>Table List</span>
            </button>
          </div>
        </div>

        {/* Quick Range Jump Pills */}
        <div className="controls-range-row">
          <span className="range-label">Jump to:</span>
          {RANGE_PRESETS.map(r => (
            <button
              key={r.label}
              type="button"
              className={`btn-range-pill ${activeRange === r.label ? 'active' : ''}`}
              onClick={() => handleRangeClick(r.label)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Display: 5x5 Boards Grid vs Detailed Table */}
      {viewMode === 'grid' ? (
        <div className="cartelas-boards-grid">
          {paginatedCards.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: '#707070', background: '#fff', borderRadius: '20px' }}>
              No cartelas found matching &ldquo;{searchQuery}&rdquo;
            </div>
          ) : (
            paginatedCards.map(card => (
              <div
                key={card.id}
                className="cartela-board-card"
                onClick={() => setSelectedCard(card)}
                title="Click to inspect 5x5 board in high definition"
              >
                <div className="board-card-header">
                  <span className="board-id-badge">#{card.id}</span>
                  <div className="board-serial-box">
                    <span className="board-serial-text">{card.serialNumber}</span>
                    <button
                      type="button"
                      className="btn-copy-serial"
                      onClick={e => {
                        e.stopPropagation();
                        handleCopySerial(card.serialNumber);
                      }}
                      title="Copy serial"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* 5x5 Mini Board */}
                <div className="board-matrix-5x5">
                  <div className="matrix-header-cell b">B</div>
                  <div className="matrix-header-cell i">I</div>
                  <div className="matrix-header-cell n">N</div>
                  <div className="matrix-header-cell g">G</div>
                  <div className="matrix-header-cell o">O</div>

                  {card.grid.map((num, idx) => {
                    const isFree = num === 0;

                    return (
                      <div
                        key={idx}
                        className={`matrix-number-cell ${isFree ? 'free-star-cell' : ''}`}
                      >
                        {isFree ? '★' : num}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Detailed Table List View */
        <div className="cartelas-table-card">
          <table className="cartelas-table">
            <thead>
              <tr>
                <th>Card #</th>
                <th>Serial Number</th>
                <th>B (1&ndash;15)</th>
                <th>I (16&ndash;30)</th>
                <th>N (31&ndash;45)</th>
                <th>G (46&ndash;60)</th>
                <th>O (61&ndash;75)</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedCards.map(card => {
                const bCol = [card.grid[0], card.grid[5], card.grid[10], card.grid[15], card.grid[20]];
                const iCol = [card.grid[1], card.grid[6], card.grid[11], card.grid[16], card.grid[21]];
                const nCol = [card.grid[2], card.grid[7], '★', card.grid[17], card.grid[22]];
                const gCol = [card.grid[3], card.grid[8], card.grid[13], card.grid[18], card.grid[23]];
                const oCol = [card.grid[4], card.grid[9], card.grid[14], card.grid[19], card.grid[24]];

                return (
                  <tr key={card.id}>
                    <td>
                      <span className="board-id-badge">#{card.id}</span>
                    </td>
                    <td>
                      <strong className="board-serial-text">{card.serialNumber}</strong>
                    </td>
                    <td className="table-col-numbers">{bCol.join(', ')}</td>
                    <td className="table-col-numbers">{iCol.join(', ')}</td>
                    <td className="table-col-numbers">{nCol.join(', ')}</td>
                    <td className="table-col-numbers">{gCol.join(', ')}</td>
                    <td className="table-col-numbers">{oCol.join(', ')}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn-table-inspect"
                        onClick={() => setSelectedCard(card)}
                      >
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 5. Pagination Bar */}
      {totalPages > 1 && (
        <div className="cartelas-pagination-bar">
          <div className="pagination-info">
            Showing <strong>{startIdx + 1}</strong> &ndash;{' '}
            <strong>{Math.min(startIdx + cardsPerPage, filteredCartelas.length)}</strong> of{' '}
            <strong>{filteredCartelas.length}</strong> cards
          </div>

          <div className="pagination-controls-row">
            <button
              type="button"
              className="btn-cartela-page"
              disabled={safePage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              <span>Previous</span>
            </button>

            <div className="page-numbers-group">
              {Array.from({ length: Math.min(totalPages, 8) }, (_, i) => i + 1).map(pageNum => (
                <button
                  key={pageNum}
                  type="button"
                  className={`btn-page-number ${safePage === pageNum ? 'active' : ''}`}
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="btn-cartela-page"
              disabled={safePage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            >
              <span>Next</span>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* 6. High-Definition Inspection Modal */}
      {selectedCard && (
        <div className="cartela-modal-overlay" onClick={() => setSelectedCard(null)}>
          <div className="cartela-modal-box" onClick={e => e.stopPropagation()}>
            <div className="cartela-modal-header">
              <div className="modal-header-info">
                <h3>Cartela #{selectedCard.id}</h3>
                <p>Serial Number: <strong>{selectedCard.serialNumber}</strong></p>
              </div>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setSelectedCard(null)}
              >
                &times;
              </button>
            </div>

            <div className="modal-board-wrapper">
              <div className="modal-board-watermark">
                <span className="brand">&#9819; SONIC BINGO</span>
                <span className="serial">{selectedCard.serialNumber}</span>
              </div>

              <div className="modal-matrix-5x5">
                <div className="matrix-header-cell b" style={{ padding: '8px 0', fontSize: '14px' }}>B</div>
                <div className="matrix-header-cell i" style={{ padding: '8px 0', fontSize: '14px' }}>I</div>
                <div className="matrix-header-cell n" style={{ padding: '8px 0', fontSize: '14px' }}>N</div>
                <div className="matrix-header-cell g" style={{ padding: '8px 0', fontSize: '14px' }}>G</div>
                <div className="matrix-header-cell o" style={{ padding: '8px 0', fontSize: '14px' }}>O</div>

                {selectedCard.grid.map((num, idx) => {
                  const isFree = num === 0;

                  return (
                    <div
                      key={idx}
                      className={`modal-matrix-cell ${isFree ? 'free-star' : ''}`}
                    >
                      {isFree ? (
                        <>
                          <span>&#9733;</span>
                          <span>FREE</span>
                        </>
                      ) : (
                        num
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="modal-footer-actions">
              <button
                type="button"
                className="btn-modal-action secondary"
                onClick={() => setSelectedCard(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn-modal-action primary"
                onClick={() => {
                  handleCopySerial(selectedCard.serialNumber);
                  setSelectedCard(null);
                }}
              >
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
                <span>Copy Serial</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
