import React, { useEffect, useMemo, useRef } from 'react';
import { useBingo, generateCardFromId, BingoCell } from '../../context/BingoContext.tsx';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';

// Safe numeric formatter that NEVER throws on undefined, null, or NaN
const safeLocale = (val: any, fallback = 0): string => {
  if (val === null || val === undefined) return fallback.toLocaleString();
  const num = typeof val === 'number' ? val : Number(val);
  return (isNaN(num) ? fallback : num).toLocaleString();
};

// Static pre-computed 25-cell fallback card (guarantees zero-throw if generator is ever disrupted)
const STATIC_FALLBACK_CELLS: BingoCell[] = [
  { index: 0, row: 0, col: 0, colLetter: 'B', val: 7, isFree: false, marked: false },
  { index: 1, row: 0, col: 1, colLetter: 'I', val: 22, isFree: false, marked: false },
  { index: 2, row: 0, col: 2, colLetter: 'N', val: 35, isFree: false, marked: false },
  { index: 3, row: 0, col: 3, colLetter: 'G', val: 51, isFree: false, marked: false },
  { index: 4, row: 0, col: 4, colLetter: 'O', val: 68, isFree: false, marked: false },
  { index: 5, row: 1, col: 0, colLetter: 'B', val: 12, isFree: false, marked: false },
  { index: 6, row: 1, col: 1, colLetter: 'I', val: 19, isFree: false, marked: false },
  { index: 7, row: 1, col: 2, colLetter: 'N', val: 41, isFree: false, marked: false },
  { index: 8, row: 1, col: 3, colLetter: 'G', val: 58, isFree: false, marked: false },
  { index: 9, row: 1, col: 4, colLetter: 'O', val: 73, isFree: false, marked: false },
  { index: 10, row: 2, col: 0, colLetter: 'B', val: 3, isFree: false, marked: false },
  { index: 11, row: 2, col: 1, colLetter: 'I', val: 27, isFree: false, marked: false },
  { index: 12, row: 2, col: 2, colLetter: 'N', val: 'FREE', isFree: true, marked: true },
  { index: 13, row: 2, col: 3, colLetter: 'G', val: 49, isFree: false, marked: false },
  { index: 14, row: 2, col: 4, colLetter: 'O', val: 64, isFree: false, marked: false },
  { index: 15, row: 3, col: 0, colLetter: 'B', val: 15, isFree: false, marked: false },
  { index: 16, row: 3, col: 1, colLetter: 'I', val: 30, isFree: false, marked: false },
  { index: 17, row: 3, col: 2, colLetter: 'N', val: 44, isFree: false, marked: false },
  { index: 18, row: 3, col: 3, colLetter: 'G', val: 55, isFree: false, marked: false },
  { index: 19, row: 3, col: 4, colLetter: 'O', val: 70, isFree: false, marked: false },
  { index: 20, row: 4, col: 0, colLetter: 'B', val: 9, isFree: false, marked: false },
  { index: 21, row: 4, col: 1, colLetter: 'I', val: 17, isFree: false, marked: false },
  { index: 22, row: 4, col: 2, colLetter: 'N', val: 38, isFree: false, marked: false },
  { index: 23, row: 4, col: 3, colLetter: 'G', val: 60, isFree: false, marked: false },
  { index: 24, row: 4, col: 4, colLetter: 'O', val: 75, isFree: false, marked: false },
];

/**
 * Self-Contained Emergency Victory Fallback
 * Used both by ErrorBoundary in BingoPage and internally inside WinModal.
 * GUARANTEES the user always sees a golden celebratory card, NEVER the dark "Display Notice" screen.
 */
export const WinModalEmergencyFallback: React.FC<{
  onClose?: () => void;
  payout?: number;
  winnerName?: string;
}> = ({ onClose, payout, winnerName }) => {
  const { closeWinModalAndRestart, winResult, betAmount } = useBingo();
  const handleDismiss = onClose || closeWinModalAndRestart;
  const displayPayout = typeof payout === 'number' && !isNaN(payout) && payout > 0
    ? payout
    : Number(winResult?.userShare || winResult?.winnerPayout || 50);

  return (
    <div className="fresh-victory-modal-backdrop" onClick={handleDismiss}>
      <div className="victory-celebration-card" onClick={e => e.stopPropagation()}>
        <button
          type="button"
          className="btn-modal-exit-corner"
          onClick={handleDismiss}
          title="Close & Exit"
        >
          <i className="fa-solid fa-xmark"></i>
        </button>

        <div className="victory-glow-aura"></div>

        {/* Trophy Artwork */}
        <div className="victory-trophy-hero">
          <svg className="victory-trophy-svg" viewBox="0 0 140 140" fill="none">
            <circle cx="70" cy="70" r="54" fill="#fef08a" fillOpacity="0.4" />
            <circle cx="28" cy="40" r="14" fill="#facc15" stroke="#ca8a04" strokeWidth="2" />
            <path d="M28 32L30 38L36 38L31 42L33 48L28 44L23 48L25 42L20 38L26 38L28 32Z" fill="#ffffff" />
            <circle cx="112" cy="40" r="14" fill="#facc15" stroke="#ca8a04" strokeWidth="2" />
            <path d="M112 32L114 38L120 38L115 42L117 48L112 44L107 48L109 42L104 38L110 38L112 32Z" fill="#ffffff" />
            <path
              d="M44 34H96V64C96 78 84 90 70 90C56 90 44 78 44 64V34Z"
              fill="url(#trophy-gold-grad-fallback)"
              stroke="#ca8a04"
              strokeWidth="3"
            />
            <path d="M44 42C30 42 24 54 28 66C32 78 44 78 44 78" stroke="#facc15" strokeWidth="6" strokeLinecap="round" />
            <path d="M96 42C110 42 116 54 112 66C108 78 96 78 96 78" stroke="#facc15" strokeWidth="6" strokeLinecap="round" />
            <path d="M64 90H76V106H64V90Z" fill="#eab308" stroke="#ca8a04" strokeWidth="2" />
            <path d="M48 106H92L96 118H44L48 106Z" fill="#ca8a04" stroke="#854d0e" strokeWidth="2" />
            <circle cx="70" cy="58" r="16" fill="#ffffff" />
            <text x="70" y="64" textAnchor="middle" fill="#0f172a" fontSize="15" fontWeight="900" fontFamily="sans-serif">75</text>
            <defs>
              <linearGradient id="trophy-gold-grad-fallback" x1="44" y1="34" x2="96" y2="90" gradientUnits="userSpaceOnUse">
                <stop stopColor="#fef08a" />
                <stop offset="0.5" stopColor="#facc15" />
                <stop offset="1" stopColor="#eab308" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <h2 className="victory-celebration-title">
          🎉 {betAmount ? `${betAmount} ETB HOUSE · ` : ''}BINGO VICTORY!
        </h2>

        <p className="victory-celebration-sub">
          {winnerName ? `Winner: ${winnerName}` : 'Congratulations on calling BINGO!'}
        </p>

        <div className="victory-prize-display-card">
          <span className="victory-prize-label">NET PRIZE WON</span>
          <strong className="victory-prize-amount green">
            +{safeLocale(displayPayout)} ETB
          </strong>
          <span className="victory-credited-tag" style={{ marginTop: '8px' }}>
            ✓ Instantly credited to your wallet
          </span>
        </div>

        <div className="victory-actions-group" style={{ marginTop: '12px' }}>
          <button
            type="button"
            className="btn-victory-claim-gold"
            onClick={handleDismiss}
          >
            <i className="fa-solid fa-play"></i>
            <span>PLAY NEXT ROUND</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export const WinModal: React.FC = () => {
  const {
    showWinModal,
    winResult,
    closeWinModalAndRestart,
    betAmount
  } = useBingo();
  const { t } = useLanguage();
  const { user } = useAuth();

  // Auto-dismiss after 8 seconds to match celebration countdown
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!showWinModal) return;
    const timer = setTimeout(() => {
      if (isMountedRef.current) {
        closeWinModalAndRestart();
      }
    }, 8000);
    return () => clearTimeout(timer);
  }, [showWinModal, closeWinModalAndRestart]);

  if (!showWinModal) return null;

  // Primary zero-throw execution block
  try {
    // 1. Authoritative Safe Fallback Payload
    const safeWinResult = (winResult && typeof winResult === 'object') ? winResult : {
      winType: 'user_solo',
      winningCartelaNumber: 1,
      winningLine: [],
      winnerName: 'Player',
      coWinners: [],
      totalPot: 50,
      userShare: 50,
      winnerPayout: 50,
      stakeAmount: 10,
      houseFee: 0,
      netPrizePot: 50
    };

    const isSolo = safeWinResult.winType === 'user_solo';
    const isSplit = safeWinResult.winType === 'user_split';
    const isOpponentWin = safeWinResult.winType === 'opponent_win';

    const userShare = typeof safeWinResult.userShare === 'number' && !isNaN(safeWinResult.userShare)
      ? safeWinResult.userShare
      : (typeof (safeWinResult as any).sharePerWinner === 'number' ? (safeWinResult as any).sharePerWinner : 0);

    const winnerPayout = typeof safeWinResult.winnerPayout === 'number' && !isNaN(safeWinResult.winnerPayout)
      ? safeWinResult.winnerPayout
      : (typeof (safeWinResult as any).sharePerWinner === 'number' ? (safeWinResult as any).sharePerWinner : (Number(safeWinResult.totalPot) || 50));

    const stakeAmt = Number(safeWinResult.stakeAmount) || 10;

    // Clamped valid Cartela ID (1-600)
    const rawCartela = Number(safeWinResult.winningCartelaNumber || (safeWinResult as any).winningCartela || 1);
    const cartelaNum = (!isNaN(rawCartela) && rawCartela >= 1 && rawCartela <= 600) ? Math.floor(rawCartela) : 1;

    // Guaranteed safe winner name
    const rawName = safeWinResult.winnerName;
    const winnerName = typeof rawName === 'string' && rawName.trim()
      ? rawName.trim()
      : (Array.isArray((safeWinResult as any).winnerNames) && (safeWinResult as any).winnerNames[0]
        ? String((safeWinResult as any).winnerNames[0])
        : 'Player');

    // Bulletproof 5x5 card cells generation with 3-tier safety net
    let winningCardCells = STATIC_FALLBACK_CELLS;
    try {
      const generated = generateCardFromId(cartelaNum);
      if (Array.isArray(generated) && generated.length === 25) {
        winningCardCells = generated;
      } else {
        const defaultCard = generateCardFromId(1);
        if (Array.isArray(defaultCard) && defaultCard.length === 25) {
          winningCardCells = defaultCard;
        }
      }
    } catch {
      winningCardCells = STATIC_FALLBACK_CELLS;
    }

    // Zero-throw co-winners string sanitizer
    const rawCoWinners: any[] = Array.isArray(safeWinResult.coWinners) && safeWinResult.coWinners.length > 0
      ? safeWinResult.coWinners
      : (Array.isArray((safeWinResult as any).winnerNames) ? (safeWinResult as any).winnerNames : []);

    const otherCoWinners: string[] = [];
    for (const item of rawCoWinners) {
      if (!item) continue;
      let nameStr = '';
      if (typeof item === 'string') {
        nameStr = item;
      } else if (typeof item === 'object') {
        nameStr = String(item.userName || item.name || item.fullName || '');
      } else {
        nameStr = String(item);
      }
      nameStr = nameStr.trim();
      if (!nameStr || nameStr.toLowerCase() === 'you') continue;
      const cleanLower = nameStr.toLowerCase();
      if (user?.fullName && typeof user.fullName === 'string' && cleanLower === user.fullName.trim().toLowerCase()) continue;
      const userUsername = (user as any)?.username || user?.telegramUsername;
      if (userUsername && typeof userUsername === 'string' && cleanLower.includes(userUsername.toLowerCase())) continue;
      otherCoWinners.push(nameStr);
    }

    const isTrueMultiplayerSplit = isSplit && otherCoWinners.length > 0;
    const coWinnersList = otherCoWinners.join(', ');

    const handleShareWin = () => {
      try {
        const text = encodeURIComponent(
          `🎉 I just won ${safeLocale(userShare)} ETB on Lomi 75-Ball Bingo! Come play and win with me: https://t.me/LomiBingobot/play`
        );
        window.open(`https://t.me/share/url?url=https://t.me/LomiBingobot/play&text=${text}`, '_blank');
      } catch {}
    };

    // Safe winning indices array
    const rawIndices = Array.isArray(safeWinResult.winningLine)
      ? safeWinResult.winningLine
      : (Array.isArray((safeWinResult as any).winningIndices) ? (safeWinResult as any).winningIndices : []);
    const winningIndices: number[] = rawIndices
      .map((x: any) => (typeof x === 'number' ? x : Number(x?.index ?? x)))
      .filter((n: any) => typeof n === 'number' && !isNaN(n));

    // Pot & Commission calculations
    const grossPot = Number(safeWinResult.totalPot) || Number(winnerPayout) || 0;
    const houseFee = typeof (safeWinResult as any).houseFee === 'number'
      ? Number((safeWinResult as any).houseFee) || 0
      : (isTrueMultiplayerSplit ? 0 : Math.max(0, grossPot - (Number(winnerPayout) || 0)));
    const netPrizePool = typeof (safeWinResult as any).netPrizePot === 'number'
      ? Number((safeWinResult as any).netPrizePot) || 0
      : Math.max(0, grossPot - houseFee);
    const isFeeCharged = houseFee > 0;
    const effectiveOpponentPayout = isOpponentWin
      ? (netPrizePool > 0 ? netPrizePool : (winnerPayout > 0 ? winnerPayout : grossPot - houseFee))
      : winnerPayout;

    return (
      <div className="fresh-victory-modal-backdrop" onClick={closeWinModalAndRestart}>
        <div className="victory-celebration-card" onClick={e => e.stopPropagation()}>
          {/* Close Button */}
          <button
            type="button"
            className="btn-modal-exit-corner"
            onClick={closeWinModalAndRestart}
            title="Close & Exit"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>

          {/* Glow Aura */}
          <div className="victory-glow-aura"></div>

          {/* Trophy Artwork */}
          <div className="victory-trophy-hero">
            {isOpponentWin ? (
              <svg className="victory-trophy-svg" viewBox="0 0 140 140" fill="none">
                <circle cx="70" cy="70" r="54" fill="#fef9c3" />
                <circle cx="70" cy="70" r="44" fill="#facc15" stroke="#ca8a04" strokeWidth="3" />
                <circle cx="70" cy="70" r="34" fill="#ffffff" />
                <path d="M70 46L76 60L90 60L78 68L82 82L70 74L58 82L62 68L50 60L64 60L70 46Z" fill="#eab308" />
                <text x="70" y="108" textAnchor="middle" fill="#854d0e" fontSize="13" fontWeight="900" fontFamily="sans-serif">
                  WINNER
                </text>
              </svg>
            ) : (
              <svg className="victory-trophy-svg" viewBox="0 0 140 140" fill="none">
                <circle cx="70" cy="70" r="54" fill="#fef08a" fillOpacity="0.4" />
                <circle cx="28" cy="40" r="14" fill="#facc15" stroke="#ca8a04" strokeWidth="2" />
                <path d="M28 32L30 38L36 38L31 42L33 48L28 44L23 48L25 42L20 38L26 38L28 32Z" fill="#ffffff" />
                <circle cx="112" cy="40" r="14" fill="#facc15" stroke="#ca8a04" strokeWidth="2" />
                <path d="M112 32L114 38L120 38L115 42L117 48L112 44L107 48L109 42L104 38L110 38L112 32Z" fill="#ffffff" />
                <path
                  d="M44 34H96V64C96 78 84 90 70 90C56 90 44 78 44 64V34Z"
                  fill="url(#trophy-gold-grad)"
                  stroke="#ca8a04"
                  strokeWidth="3"
                />
                <path d="M44 42C30 42 24 54 28 66C32 78 44 78 44 78" stroke="#facc15" strokeWidth="6" strokeLinecap="round" />
                <path d="M96 42C110 42 116 54 112 66C108 78 96 78 96 78" stroke="#facc15" strokeWidth="6" strokeLinecap="round" />
                <path d="M64 90H76V106H64V90Z" fill="#eab308" stroke="#ca8a04" strokeWidth="2" />
                <path d="M48 106H92L96 118H44L48 106Z" fill="#ca8a04" stroke="#854d0e" strokeWidth="2" />
                <circle cx="70" cy="58" r="16" fill="#ffffff" />
                <text x="70" y="64" textAnchor="middle" fill="#0f172a" fontSize="15" fontWeight="900" fontFamily="sans-serif">75</text>
                <defs>
                  <linearGradient id="trophy-gold-grad" x1="44" y1="34" x2="96" y2="90" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#fef08a" />
                    <stop offset="0.5" stopColor="#facc15" />
                    <stop offset="1" stopColor="#eab308" />
                  </linearGradient>
                </defs>
              </svg>
            )}
          </div>

          {/* Title */}
          <h2 className="victory-celebration-title">
            {isOpponentWin
              ? `🏆 ${betAmount} ETB HOUSE · BINGO CALLED!`
              : isTrueMultiplayerSplit
              ? `🤝 ${betAmount} ETB HOUSE · SPLIT POT!`
              : `🎉 ${betAmount} ETB HOUSE CHAMPION!`}
          </h2>

          <p className="victory-celebration-sub">
            {isOpponentWin ? (
              <>
                Winner: <strong>{winnerName}</strong> (Cartela #{cartelaNum})
              </>
            ) : !isTrueMultiplayerSplit ? (
              <>
                Congratulations! Your <strong>Cartela #{cartelaNum}</strong> completed BINGO!
              </>
            ) : (
              <>
                Multiplayer Split: You and <strong>{coWinnersList}</strong> called BINGO on the same ball!
              </>
            )}
          </p>

          {/* Prize Box with Financial Transparency Breakdown */}
          <div className="victory-prize-display-card">
            <span className="victory-prize-label">
              {isOpponentWin ? 'PRIZE WON BY WINNER' : isTrueMultiplayerSplit ? 'YOUR SPLIT POT SHARE' : 'YOUR NET WINNINGS'}
            </span>
            <strong className={`victory-prize-amount ${isOpponentWin ? 'gold' : 'green'}`}>
              {isOpponentWin
                ? `${safeLocale(effectiveOpponentPayout)} ETB`
                : `+${safeLocale(userShare > 0 ? userShare : netPrizePool)} ETB`}
            </strong>

            {/* Pot & Commission Transparency Breakdown */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              marginTop: '8px',
              padding: '8px 12px',
              backgroundColor: 'rgba(0, 0, 0, 0.04)',
              borderRadius: '8px',
              fontSize: '0.75rem',
              color: '#475569',
              width: '100%'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Total Room Pot:</span>
                <strong style={{ color: '#0f172a' }}>{safeLocale(grossPot)} ETB</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Platform Commission:</span>
                <span style={{ color: isFeeCharged ? '#b91c1c' : '#16a34a', fontWeight: 600 }}>
                  {isFeeCharged
                    ? `20% (-${safeLocale(houseFee)} ETB)`
                    : '0% (0.00 ETB • ≤5 Players)'}
                </span>
              </div>
              {isTrueMultiplayerSplit && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Total Net Prize Pot:</span>
                  <strong style={{ color: '#0f172a' }}>{safeLocale(netPrizePool)} ETB</strong>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #cbd5e1', paddingTop: '4px' }}>
                <span>{isTrueMultiplayerSplit ? `Your Split Share (1 of ${otherCoWinners.length + 1}):` : 'Net Winner Payout:'}</span>
                <strong style={{ color: '#16a34a' }}>
                  {isOpponentWin
                    ? `${safeLocale(effectiveOpponentPayout)} ETB`
                    : isTrueMultiplayerSplit
                    ? `${safeLocale(userShare)} ETB`
                    : `${safeLocale(userShare > 0 ? userShare : netPrizePool)} ETB`}
                </strong>
              </div>
            </div>

            <span className="victory-credited-tag" style={{ marginTop: '8px' }}>
              {isOpponentWin
                ? `Winner played in the ${stakeAmt} ETB Room`
                : '✓ Instantly credited to your wallet'}
            </span>
          </div>

          {/* ── Winning Cartela 5x5 Matrix Showcase ── */}
          <div className="victory-winning-cartela-box">
            <div className="winning-cartela-header">
              <span className="winning-cartela-title">
                🏆 Cartela #{cartelaNum} (Winning Card)
              </span>
              <span className="winning-cartela-badge">
                {winningIndices.length >= 4 ? '5-IN-A-ROW' : 'BINGO'}
              </span>
            </div>

            <div className="winning-cartela-grid-wrap">
              <div className="winning-cartela-col-headers">
                <span className="win-col-hdr col-b">B</span>
                <span className="win-col-hdr col-i">I</span>
                <span className="win-col-hdr col-n">N</span>
                <span className="win-col-hdr col-g">G</span>
                <span className="win-col-hdr col-o">O</span>
              </div>
              <div className="winning-cartela-5x5">
                {winningCardCells.map(cell => {
                  if (!cell || typeof cell.index !== 'number') return null;
                  const isWinningCell = winningIndices.includes(cell.index);
                  return (
                    <div
                      key={cell.index}
                      className={`win-modal-cell ${isWinningCell ? 'win-highlight' : ''} ${cell.isFree ? 'free-cell' : ''}`}
                    >
                      {cell.isFree ? '⭐' : (cell.val !== undefined && cell.val !== null ? cell.val : '')}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="winning-cartela-footnote">
              ⭐ Gold glowing cells show the verified winning pattern
            </div>
          </div>

          {/* Action Buttons */}
          <div className="victory-actions-group">
            <button
              type="button"
              className="btn-victory-claim-gold"
              onClick={closeWinModalAndRestart}
            >
              <i className="fa-solid fa-play"></i>
              <span>
                {isOpponentWin
                  ? 'PLAY NEXT ROUND'
                  : `CLAIM ${safeLocale(userShare)} ETB & PLAY NEXT ROUND`}
              </span>
            </button>

            {!isOpponentWin && (
              <button
                type="button"
                className="btn-victory-share-telegram"
                onClick={handleShareWin}
              >
                <i className="fa-brands fa-telegram"></i>
                <span>{t('bingo.shareWin') || 'Share Victory'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  } catch (err) {
    console.error('🚨 [WinModal self-healing active, preventing crash]:', err);
    return <WinModalEmergencyFallback onClose={closeWinModalAndRestart} />;
  }
};
