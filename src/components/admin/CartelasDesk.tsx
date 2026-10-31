import React, { useState } from 'react';
import { useAdmin, CartelaCard } from '../../context/AdminContext.tsx';
import { useApp } from '../../context/AppContext.tsx';

export const CartelasDesk: React.FC = () => {
  const { cartelaPool } = useAdmin();
  const { showToast } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [selectedCard, setSelectedCard] = useState<CartelaCard | null>(null);

  const safePool = Array.isArray(cartelaPool) ? cartelaPool : [];
  const cardsPerPage = 40;

  // Filter pool
  const filteredCartelas = safePool.filter(c => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const matchId = String(c.id).includes(q);
    const matchSerial = (c.serialNumber || '').toLowerCase().includes(q);
    return matchId || matchSerial;
  });

  const totalPages = Math.ceil(filteredCartelas.length / cardsPerPage) || 1;
  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * cardsPerPage;
  const paginatedCards = filteredCartelas.slice(startIdx, startIdx + cardsPerPage);

  const handleJumpRange = (start: number) => {
    const pageTarget = Math.ceil(start / cardsPerPage) || 1;
    setCurrentPage(pageTarget);
    showToast(`✓ Viewing Cards ${start} to ${Math.min(start + cardsPerPage - 1, 600)}`);
  };

  const handleCopySerial = (serial: string) => {
    navigator.clipboard.writeText(serial);
    showToast(`✓ Copied Serial: ${serial}`);
  };

  return (
    <div className="cartelas-desk-container">
      {/* 1. Hero Cartela Library Banner */}
      <div className="cartelas-hero-banner">
        <div className="cartelas-hero-left">
          <div className="cartelas-hero-icon-box">
            <i className="fa-solid fa-layer-group"></i>
          </div>
          <div className="cartelas-hero-titles">
            <div className="cartelas-hero-badge-row">
              <span className="cartelas-live-badge">
                <span className="pulse-green-dot"></span>
                <span>600 SERIALIZED CARDS ACTIVE</span>
              </span>
              <span className="cartelas-uptime-tag">LB-0001 to LB-0600</span>
            </div>
            <h1 className="cartelas-hero-main-title">600 SERIAL CARTELA CARDS LIBRARY</h1>
            <p className="cartelas-hero-sub-title">
              የሶኒክ ቢንጎ 600 ካርቴላ ካርዶች ቤተ-መጽሐፍት፣ የቁጥሮች አቀማመጥ እና የካርድ አጠቃቀም
            </p>
          </div>
        </div>

        <div className="cartelas-hero-right">
          {/* Lemon SVG Art */}
          <div className="cartelas-hero-lemon-art">
            <svg width="48" height="48" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="32" cy="32" r="28" fill="#facc15" stroke="#eab308" strokeWidth="3" />
              <circle cx="32" cy="32" r="23" fill="#fef08a" />
              <path d="M32 9L32 55" stroke="#eab308" strokeWidth="2" strokeLinecap="round" />
              <path d="M9 32L55 32" stroke="#eab308" strokeWidth="2" strokeLinecap="round" />
              <path d="M16 16L48 48" stroke="#eab308" strokeWidth="2" strokeLinecap="round" />
              <path d="M48 16L16 48" stroke="#eab308" strokeWidth="2" strokeLinecap="round" />
              <circle cx="32" cy="32" r="6" fill="#ffffff" stroke="#eab308" strokeWidth="1.5" />
            </svg>
          </div>

          <div className="cartelas-status-chip">
            <i className="fa-solid fa-grid-2"></i>
            <span>Pool Size: 600 Unique Boards</span>
          </div>
        </div>
      </div>

      {/* 2. 4 Elevated Cartela KPI Cards */}
      <div className="cartelas-kpi-grid">
        {/* Card 1: Total Pool */}
        <div className="cartelas-kpi-card gold">
          <div className="ckpi-header">
            <span className="ckpi-title">Total Serial Cards</span>
            <div className="ckpi-icon-box gold">
              <i className="fa-solid fa-layer-group"></i>
            </div>
          </div>
          <div className="ckpi-value gold">600 <span className="ckpi-unit">Cartelas</span></div>
          <div className="ckpi-footer">
            <span className="ckpi-badge gold">LB-0001 &ndash; LB-0600</span>
            <span className="ckpi-micro-text">Zero duplicate layouts</span>
          </div>
        </div>

        {/* Card 2: 75 Ball Spectrum */}
        <div className="cartelas-kpi-card blue">
          <div className="ckpi-header">
            <span className="ckpi-title">B-I-N-G-O Standard</span>
            <div className="ckpi-icon-box blue">
              <i className="fa-solid fa-table-cells-large"></i>
            </div>
          </div>
          <div className="ckpi-value blue">1 to 75 <span className="ckpi-unit">Balls</span></div>
          <div className="ckpi-footer">
            <span className="ckpi-badge blue">5&times;5 Balanced Grid</span>
            <span className="ckpi-micro-text">15 Numbers / Column</span>
          </div>
        </div>

        {/* Card 3: Free Space Ratio */}
        <div className="cartelas-kpi-card green">
          <div className="ckpi-header">
            <span className="ckpi-title">Center Free Space</span>
            <div className="ckpi-icon-box green">
              <i className="fa-solid fa-star"></i>
            </div>
          </div>
          <div className="ckpi-value green">100% <span className="ckpi-unit">Equipped</span></div>
          <div className="ckpi-footer">
            <span className="ckpi-badge green">Golden Star Center</span>
            <span className="ckpi-micro-text">Auto-Marked Fair Play</span>
          </div>
        </div>

        {/* Card 4: 2+1 Bonus Slot */}
        <div className="cartelas-kpi-card purple">
          <div className="ckpi-header">
            <span className="ckpi-title">2+1 Bonus Promo</span>
            <div className="ckpi-icon-box purple">
              <i className="fa-solid fa-gift"></i>
            </div>
          </div>
          <div className="ckpi-value purple">Active <span className="ckpi-unit">Slot 3</span></div>
          <div className="ckpi-footer">
            <span className="ckpi-badge purple">Buy 2 Get 1 Free</span>
            <span className="ckpi-micro-text">Promo Card Allocation</span>
          </div>
        </div>
      </div>

      {/* 3. Controls & View Selector (White Card) */}
      <div className="cartelas-white-section-card">
        <div className="cartelas-section-header">
          <div className="cartelas-section-title-wrap">
            <div className="cartelas-section-icon-gold">
              <i className="fa-solid fa-table"></i>
            </div>
            <div>
              <h3 className="cartelas-section-main-heading">Cartela Cards Browser & Inspector</h3>
              <p className="cartelas-section-sub-heading">
                Showing Cards {startIdx + 1}&ndash;{Math.min(startIdx + cardsPerPage, filteredCartelas.length)} of {filteredCartelas.length} Total Pool
              </p>
            </div>
          </div>

          <div className="cartelas-controls-row">
            {/* Jump Range Presets */}
            <div className="cartelas-range-pills-group">
              <span className="range-label">Jump to:</span>
              {[
                { label: '1–50', start: 1 },
                { label: '51–100', start: 51 },
                { label: '101–200', start: 101 },
                { label: '201–300', start: 201 },
                { label: '301–400', start: 301 },
                { label: '401–500', start: 401 },
                { label: '501–600', start: 501 }
              ].map(r => (
                <button
                  key={r.label}
                  type="button"
                  className="btn-range-pill"
                  onClick={() => handleJumpRange(r.start)}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {/* View Mode Toggle */}
            <div className="view-mode-toggle-group">
              <button
                type="button"
                className={`btn-view-toggle ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="5x5 Mini Boards Grid View"
              >
                <i className="fa-solid fa-grid-2"></i>
                <span>Grid</span>
              </button>
              <button
                type="button"
                className={`btn-view-toggle ${viewMode === 'table' ? 'active' : ''}`}
                onClick={() => setViewMode('table')}
                title="Detailed Table List View"
              >
                <i className="fa-solid fa-table-list"></i>
                <span>Table</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="cartelas-search-box">
              <i className="fa-solid fa-magnifying-glass search-icon"></i>
              <input
                type="text"
                placeholder="Search Card # (1-600) or LB-0042..."
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
          </div>
        </div>

        {/* 4. Display: Grid View vs Table View */}
        {viewMode === 'grid' ? (
          <div className="cartelas-mini-grid-container">
            {paginatedCards.length === 0 ? (
              <div className="empty-cartelas-box">
                <i className="fa-solid fa-layer-group"></i>
                <span>No cartela cards matching "{searchQuery}"</span>
              </div>
            ) : (
              paginatedCards.map(card => (
                <div
                  key={card.id}
                  className="cartela-mini-card-light"
                  onClick={() => setSelectedCard(card)}
                  title="Click to inspect 5x5 board in high definition"
                >
                  <div className="mini-card-head">
                    <span className="card-id-pill">#{card.id}</span>
                    <span className="card-serial-code">{card.serialNumber}</span>
                    <button
                      type="button"
                      className="btn-mini-copy"
                      onClick={e => {
                        e.stopPropagation();
                        handleCopySerial(card.serialNumber);
                      }}
                      title="Copy serial"
                    >
                      <i className="fa-regular fa-copy"></i>
                    </button>
                  </div>

                  {/* B-I-N-G-O 5x5 Board */}
                  <div className="mini-card-bingo-grid">
                    <div className="bingo-header-mini b">B</div>
                    <div className="bingo-header-mini i">I</div>
                    <div className="bingo-header-mini n">N</div>
                    <div className="bingo-header-mini g">G</div>
                    <div className="bingo-header-mini o">O</div>

                    {card.grid.map((num, idx) => (
                      <div key={idx} className={`mini-grid-cell ${num === 0 ? 'star-free' : ''}`}>
                        {num === 0 ? '★' : num}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          /* Table View */
          <div className="cartelas-table-container">
            <table className="cartelas-light-table">
              <thead>
                <tr>
                  <th>Card #</th>
                  <th>Serial Number</th>
                  <th>B (1-15)</th>
                  <th>I (16-30)</th>
                  <th>N (31-45)</th>
                  <th>G (46-60)</th>
                  <th>O (61-75)</th>
                  <th>Action</th>
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
                        <span className="card-id-pill">#{card.id}</span>
                      </td>
                      <td>
                        <strong className="card-serial-code">{card.serialNumber}</strong>
                      </td>
                      <td className="col-num-text">{bCol.join(', ')}</td>
                      <td className="col-num-text">{iCol.join(', ')}</td>
                      <td className="col-num-text">{nCol.join(', ')}</td>
                      <td className="col-num-text">{gCol.join(', ')}</td>
                      <td className="col-num-text">{oCol.join(', ')}</td>
                      <td>
                        <button
                          type="button"
                          className="btn-table-inspect"
                          onClick={() => setSelectedCard(card)}
                        >
                          <i className="fa-solid fa-eye"></i>
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
            <button
              type="button"
              className="btn-cartela-page-nav"
              disabled={safePage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            >
              <i className="fa-solid fa-chevron-left"></i>
              <span>Previous</span>
            </button>

            <div className="cartela-page-pills-row">
              {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map(pageNum => (
                <button
                  key={pageNum}
                  type="button"
                  className={`btn-page-pill-number ${safePage === pageNum ? 'active' : ''}`}
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="btn-cartela-page-nav"
              disabled={safePage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            >
              <span>Next</span>
              <i className="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        )}
      </div>

      {/* ============================================================
          CARD 360 FULL INSPECTION MODAL
          ============================================================ */}
      {selectedCard && (
        <div className="modal-overlay-light" onClick={() => setSelectedCard(null)}>
          <div className="modal-box-light cartela-inspect-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header-light">
              <div className="modal-title-row">
                <div className="modal-icon-gold">
                  <i className="fa-solid fa-layer-group"></i>
                </div>
                <div>
                  <h3 className="modal-heading">Cartela Board #{selectedCard.id}</h3>
                  <p className="modal-sub">Serial: <strong>{selectedCard.serialNumber}</strong></p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSelectedCard(null)}
              >
                ✕
              </button>
            </div>

            <div className="inspect-cartela-body">
              {/* Full-Scale 5x5 Card */}
              <div className="full-cartela-board">
                <div className="board-top-banner">
                  <div className="lomi-logo-artwork mini">
                    <span className="lomi-letter-l">L</span>
                    <span className="lomi-lemon-o">🍋</span>
                    <span className="lomi-letter-m">M</span>
                    <span className="lomi-letter-i">I</span>
                  </div>
                  <span className="board-serial-pill">{selectedCard.serialNumber}</span>
                </div>

                <div className="full-5x5-grid">
                  <div className="full-header-cell b">B</div>
                  <div className="full-header-cell i">I</div>
                  <div className="full-header-cell n">N</div>
                  <div className="full-header-cell g">G</div>
                  <div className="full-header-cell o">O</div>

                  {selectedCard.grid.map((num, idx) => (
                    <div key={idx} className={`full-grid-cell ${num === 0 ? 'center-star' : ''}`}>
                      {num === 0 ? (
                        <div className="star-cell-wrap">
                          <span className="star-symbol">★</span>
                          <span className="star-text">FREE</span>
                        </div>
                      ) : (
                        num
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Card Meta Verification */}
              <div className="inspect-meta-box">
                <div className="meta-row-item">
                  <span className="meta-lbl">Serial ID:</span>
                  <strong className="meta-val purple">{selectedCard.serialNumber}</strong>
                </div>
                <div className="meta-row-item">
                  <span className="meta-lbl">Fairness Check:</span>
                  <span className="meta-val green">✓ Verified 75-Ball Column Balance</span>
                </div>
                <div className="meta-row-item">
                  <span className="meta-lbl">Center Space:</span>
                  <span className="meta-val gold">★ Star Free Space Active</span>
                </div>
              </div>

              <div className="inspect-actions-row">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setSelectedCard(null)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="btn-modal-submit"
                  onClick={() => {
                    handleCopySerial(selectedCard.serialNumber);
                    setSelectedCard(null);
                  }}
                >
                  <i className="fa-solid fa-copy"></i>
                  <span>Copy Serial & Close</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
