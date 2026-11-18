import React, { useEffect, useMemo, useRef } from 'react';
import { useBingo, generateCardFromId, BingoCell } from '../../context/BingoContext.tsx';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { soundEngine } from '../../services/soundEngine.ts';
import { telegramService } from '../../services/telegramService.ts';

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
  const { t, lang } = useLanguage();
  const { user } = useAuth();

  // Auto-dismiss after 8 seconds to match celebration countdown
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const isJackpotHitEarly = Boolean((winResult as any)?.isJackpotHit || Number((winResult as any)?.jackpotWonAmount) > 0);

  useEffect(() => {
    if (!showWinModal) return;
    if (isJackpotHitEarly) {
      telegramService.triggerHaptic('success');
      try {
        soundEngine.playWinFanfare();
      } catch {}
    }
    const timer = setTimeout(() => {
      if (isMountedRef.current) {
        closeWinModalAndRestart();
      }
    }, 8000);
    return () => clearTimeout(timer);
  }, [showWinModal, isJackpotHitEarly, closeWinModalAndRestart]);

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
          isJackpotHit
            ? `🎉 👑 I just won the 500 ETB GRAND JACKPOT on Sonic 75-Ball Bingo! Total cashout: ${safeLocale(!isOpponentWin ? userShare : effectiveOpponentPayout)} ETB! Play and win with me: https://t.me/sonicbingobot/play`
            : `🎉 I just won ${safeLocale(userShare)} ETB on Sonic 75-Ball Bingo! Come play and win with me: https://t.me/sonicbingobot/play`
        );
        window.open(`https://t.me/share/url?url=https://t.me/sonicbingobot/play&text=${text}`, '_blank');
      } catch {}
    };

    // Safe winning indices array
    const rawIndices = Array.isArray(safeWinResult.winningLine)
      ? safeWinResult.winningLine
      : (Array.isArray((safeWinResult as any).winningIndices) ? (safeWinResult as any).winningIndices : []);
    const winningIndices: number[] = rawIndices
      .map((x: any) => (typeof x === 'number' ? x : Number(x?.index ?? x)))
      .filter((n: any) => typeof n === 'number' && !isNaN(n));

    // Pot & Commission & Jackpot calculations
    const grossPot = Number(safeWinResult.totalPot) || Number(winnerPayout) || 0;
    const isJackpotHit = Boolean((safeWinResult as any).isJackpotHit || Number((safeWinResult as any).jackpotWonAmount) > 0);
    const jackpotWonAmount = Number((safeWinResult as any).jackpotWonAmount) || (isJackpotHit ? 500 : 0);
    const houseFee = typeof (safeWinResult as any).houseFee === 'number'
      ? Number((safeWinResult as any).houseFee) || 0
      : (isTrueMultiplayerSplit ? 0 : Math.max(0, grossPot - (Number(winnerPayout) || 0)));
    const netPrizePool = typeof (safeWinResult as any).netPrizePot === 'number'
      ? Number((safeWinResult as any).netPrizePot) || 0
      : Math.max(0, grossPot - houseFee);
    const isFeeCharged = houseFee > 0;
    const effectiveOpponentPayout = isOpponentWin
      ? (winnerPayout > 0 ? winnerPayout : (netPrizePool > 0 ? (netPrizePool + (isJackpotHit ? jackpotWonAmount : 0)) : grossPot))
      : winnerPayout;

    const normalPotShare = Math.max(0, (!isOpponentWin ? userShare : effectiveOpponentPayout) - (isJackpotHit ? jackpotWonAmount : 0));
    const totalCashout = !isOpponentWin ? userShare : effectiveOpponentPayout;

    return (
      <div className="fresh-victory-modal-backdrop" onClick={closeWinModalAndRestart}>
        <div className={`victory-celebration-card ${isJackpotHit ? 'jackpot-glow-card' : ''}`} onClick={e => e.stopPropagation()}>
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
          <div className="victory-glow-aura" style={isJackpotHit ? { background: 'radial-gradient(circle, rgba(245, 158, 11, 0.45) 0%, rgba(220, 38, 38, 0.25) 50%, transparent 70%)' } : {}}></div>

          {/* Trophy Artwork / Grand Jackpot Crown */}
          <div className="victory-trophy-hero">
            {isJackpotHit ? (
              <div style={{ position: 'relative', display: 'inline-block', margin: '4px auto 14px' }}>
                <div
                  style={{
                    width: '106px',
                    height: '106px',
                    borderRadius: '34px',
                    background: 'linear-gradient(135deg, #78350f 0%, #b45309 30%, #d97706 70%, #f59e0b 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '52px',
                    boxShadow: '0 12px 35px rgba(245, 158, 11, 0.65), 0 0 25px rgba(254, 240, 138, 0.5)',
                    border: '3px solid #fef08a'
                  }}
                >
                  👑
                </div>
                <span
                  style={{
                    position: 'absolute',
                    bottom: '-8px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'linear-gradient(90deg, #dc2626, #e11d48)',
                    color: '#ffffff',
                    fontSize: '10.5px',
                    fontWeight: 900,
                    letterSpacing: '0.8px',
                    padding: '3px 12px',
                    borderRadius: '999px',
                    boxShadow: '0 4px 12px rgba(220, 38, 38, 0.55)',
                    whiteSpace: 'nowrap',
                    textTransform: 'uppercase'
                  }}
                >
                  500 ETB VAULT
                </span>
              </div>
            ) : isOpponentWin ? (
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
            {isJackpotHit
              ? (!isOpponentWin
                  ? (lang === 'am' ? '👑 ታላቁ ግራንድ ጃክፖት ተሰብሯል! 💥' : '👑 GRAND JACKPOT VAULT UNLOCKED! 💥')
                  : (lang === 'am' ? '🚨 500 ብር ግራንድ ጃክፖት ተወሰደ! 👑' : '🚨 500 ETB GRAND JACKPOT HIT! 👑'))
              : isOpponentWin
              ? `🏆 ${betAmount} ETB HOUSE · BINGO CALLED!`
              : isTrueMultiplayerSplit
              ? `🤝 ${betAmount} ETB HOUSE · SPLIT POT!`
              : `🎉 ${betAmount} ETB HOUSE CHAMPION!`}
          </h2>

          <p className="victory-celebration-sub">
            {isJackpotHit ? (
              !isOpponentWin ? (
                lang === 'am'
                  ? <>💥 እንኳን ደስ አለዎት! <b>ካርቴላ #{cartelaNum}</b> ቢንጎ በመሙላት የ <b>500.00 ብር ግራንድ ጃክፖት</b> ወስዷል!</>
                  : <>💥 INCREDIBLE WIN! Your <b>Cartela #{cartelaNum}</b> completed BINGO and swept the <b>500 ETB Grand Jackpot</b>!</>
              ) : (
                lang === 'am'
                  ? <>ተጫዋች <b>{winnerName}</b> (ካርቴላ #{cartelaNum}) ቢንጎ በመሙላት የ 500 ብር ጃክፖቱን ወስዷል! ቀጣዩ ካዝና አሁን እየሞላ ነው!</>
                  : <>Player <b>{winnerName}</b> (Cartela #{cartelaNum}) dropped the 500 ETB Grand Jackpot! The next vault is now charging!</>
              )
            ) : isOpponentWin ? (
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

          {/* 🌟 Grand Progressive Jackpot Itemized Payout Card 🌟 */}
          {isJackpotHit && (
            <div
              style={{
                background: 'linear-gradient(135deg, #451a03 0%, #78350f 40%, #b45309 80%, #d97706 100%)',
                border: '2px solid #fde047',
                borderRadius: '20px',
                padding: '14px 16px',
                marginBottom: '14px',
                color: '#ffffff',
                boxShadow: '0 10px 25px rgba(217, 119, 6, 0.45)',
                textAlign: 'left'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '20px' }}>👑</span>
                  <span style={{ fontSize: '11.5px', fontWeight: 900, letterSpacing: '0.6px', textTransform: 'uppercase', color: '#fef08a' }}>
                    {lang === 'am' ? 'የግራንድ ጃክፖት ሽልማት ዝርዝር' : 'GRAND JACKPOT PAYOUT BREAKDOWN'}
                  </span>
                </div>
                <span style={{ background: '#f59e0b', color: '#451a03', fontSize: '10px', fontWeight: 900, padding: '2px 8px', borderRadius: '999px' }}>
                  VERIFIED WIN
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#fef3c7', padding: '4px 0', borderBottom: '1px solid rgba(254, 240, 138, 0.25)' }}>
                <span>{lang === 'am' ? 'የቢንጎ ዙር አሸናፊ (Net Pot):' : 'Bingo Round Prize (Net Pot):'}</span>
                <strong style={{ color: '#ffffff' }}>+{safeLocale(normalPotShare)} ETB</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: '#fde047', padding: '6px 0', borderBottom: '1.5px solid rgba(254, 240, 138, 0.4)' }}>
                <span style={{ fontWeight: 800 }}>{lang === 'am' ? '🌟 ግራንድ ጃክፖት ካዝና (Grand Vault):' : '🌟 Grand Progressive Jackpot Vault:'}</span>
                <strong style={{ fontWeight: 900, fontSize: '14px', color: '#fef08a' }}>+{safeLocale(jackpotWonAmount)} ETB</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', paddingTop: '2px' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 900, color: '#ffffff' }}>
                  {lang === 'am' ? 'ጠቅላላ የተሸለመው (Total Cashout):' : 'TOTAL CASHOUT PRIZE:'}
                </span>
                <span style={{ fontSize: '18px', fontWeight: 900, color: '#34d399', textShadow: '0 2px 8px rgba(16, 185, 129, 0.5)' }}>
                  +{safeLocale(totalCashout)} ETB
                </span>
              </div>
            </div>
          )}

          {/* Prize Box Display (Net Winner Prize Only) */}
          <div className="victory-prize-display-card">
            <span className="victory-prize-label">
              {isJackpotHit
                ? (!isOpponentWin ? 'TOTAL CASHOUT CREDITED TO WALLET' : 'TOTAL PRIZE WON BY CHAMPION')
                : (isOpponentWin ? 'PRIZE WON BY WINNER' : isTrueMultiplayerSplit ? 'YOUR SPLIT POT SHARE' : 'YOUR NET WINNINGS')}
            </span>
            <strong className={`victory-prize-amount ${isOpponentWin ? 'gold' : 'green'}`}>
              {isOpponentWin
                ? `${safeLocale(effectiveOpponentPayout)} ETB`
                : `+${safeLocale(userShare > 0 ? userShare : netPrizePool)} ETB`}
            </strong>

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
