import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
  useCallback,
  useMemo
} from 'react';
import { soundEngine } from '../services/soundEngine.ts';
import { socketService } from '../services/socketService.ts';
import { telegramService } from '../services/telegramService.ts';
import { getApiBase } from '../config/env.ts';
import { useWallet } from './WalletContext.tsx';
import { useAuth } from './AuthContext.tsx';
import { useApp } from './AppContext.tsx';
import { useAdmin } from './AdminContext.tsx';
import { useLanguage } from './LanguageContext.tsx';

export interface BingoCell {
  index: number;
  row: number;
  col: number;
  colLetter: string;
  val: number | 'FREE';
  isFree: boolean;
  marked: boolean;
}

export interface CalledBall {
  num: number;
  col: string;
}

export interface Opponent {
  name: string;
  avatar: string;
  initials: string;
  cards: number;
  marksNeeded: number;
  status: string;
  cartelaNumber?: number;
}

export interface WinResult {
  winType: 'user_solo' | 'user_split' | 'opponent_win';
  winningCartelaNumber: number;
  winningLine: number[];
  winnerName: string;
  coWinners: string[];
  totalPot: number;
  userShare: number;
  winnerPayout?: number;
  stakeAmount?: number;
  houseFee?: number;
  netPrizePot?: number;
}

export type RoundPhase = 'lobby' | 'locked' | 'playing' | 'winner';

interface BingoContextType {
  // Lifecycle & Phase
  roundPhase: RoundPhase;
  lobbyCountdown: number;
  winnerCountdown: number;

  // Betting & Tickets
  betAmount: number;
  setBetAmount: (amt: number) => void;
  jackpotPool: number;
  cardQuantity: number;
  setCardQuantity: (qty: number) => void;
  hasTicket: boolean;
  hasPreBoughtNext: boolean;
  buyTicket: () => void;
  preBuyNextRound: () => void;
  stakeRoomsSummary: Record<number, number>;

  // 600 Cartelas Pool & Selection
  selectedCartelaIds: number[];
  setSelectedCartelaIds: (ids: number[]) => void;
  hasSelectedCartelas: boolean;
  hasWinningPattern: boolean;
  hasSleptPattern: boolean;
  occupiedCartelaIds: number[];
  isCartelaPickerOpen: boolean;
  openCartelaPicker: () => void;
  closeCartelaPicker: () => void;
  chooseCartelaId: (slotIdx: number, newId: number) => void;
  toggleCartelaSelection: (cartelaId: number) => void;

  // Active Game State
  gameActive: boolean;
  cartela1Data: BingoCell[];
  cartela2Data: BingoCell[];
  cartela3Data: BingoCell[];
  cartela4Data: BingoCell[];
  totalPlayableCards: number;
  activeCartelaIndex: number;
  setActiveCartelaIndex: (idx: number) => void;
  currentCall: CalledBall | null;
  previousCall: CalledBall | null;
  calledNumbers: number[];
  autoPlay: boolean;
  isAutoModeLocked: boolean;
  toggleAutoPlay: () => void;
  playersCount: number;
  prizePool: number;
  totalPot: number;
  opponents: Opponent[];
  canWin: boolean;
  winResult: WinResult | null;
  showWinModal: boolean;
  spherePop: boolean;
  isVerticalBoard: boolean;
  toggleVerticalBoard: () => void;
  showMasterBoard: boolean;
  toggleMasterBoard: () => void;
  isMuted: boolean;
  toggleMute: () => void;

  // Lobby State & Join Feed
  roomMode: 'active' | 'spectating';
  waitingForPlayers: boolean;
  waitingForOtherHouses: boolean;
  realPlayerCount: number;
  activeUsersCount: number;
  joinFeed: Array<{ id: number; userName: string; countdownStarted: boolean }>;

  // Actions
  claimInProgress: boolean;
  startLobbyCountdown: () => void;
  handleManualDaub: (cartelaIdx: number, cellIdx: number) => void;
  claimBingo: () => void;
  closeWinModalAndRestart: () => void;
  stopGame: () => void;
  shuffleCartela: (cardIdx?: number) => void;
  shuffleAllCartelas: (count?: number) => void;
  selectSpecificCartela: (cardIdx: number, cartelaId: number) => void;

  // Network Resilience & Disconnect Protection
  networkStatus: 'connected' | 'reconnecting' | 'polling' | 'disconnected' | 'degraded';
  networkLatency: number;
  offlineWinsNotice: any[];
  dismissOfflineWin: (winId: string) => void;
  triggerManualSync: () => Promise<void>;
  isSyncing: boolean;
  cancelLobbyTicket: () => Promise<boolean>;

  // Insufficient Balance Modal
  showInsufficientBalanceModal: boolean;
  setShowInsufficientBalanceModal: (show: boolean) => void;
  insufficientBalanceDetails: { required: number; balance: number; shortfall: number } | null;
}

const BingoContext = createContext<BingoContextType | undefined>(undefined);

// Generate 75-Ball 5x5 Matrix from Cartela ID (deterministic)
export const generateCardFromId = (cartelaId: number): BingoCell[] => {
  let seed = cartelaId * 7919 + 1013;
  const pseudoRandom = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  const getUniqueRandoms = (min: number, max: number, count: number): number[] => {
    const pool: number[] = [];
    for (let i = min; i <= max; i++) pool.push(i);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(pseudoRandom() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count);
  };

  const bNums = getUniqueRandoms(1, 15, 5);
  const iNums = getUniqueRandoms(16, 30, 5);
  const nNums = getUniqueRandoms(31, 45, 4); // 4 + FREE
  const gNums = getUniqueRandoms(46, 60, 5);
  const oNums = getUniqueRandoms(61, 75, 5);

  const cells: BingoCell[] = [];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const idx = row * 5 + col;
      let val: number | 'FREE';
      let colLetter: string;
      let isFree = false;

      if (col === 0) { val = bNums[row]; colLetter = 'B'; }
      else if (col === 1) { val = iNums[row]; colLetter = 'I'; }
      else if (col === 2) {
        if (row === 2) { val = 'FREE'; colLetter = 'N'; isFree = true; }
        else { val = nNums[row > 2 ? row - 1 : row]; colLetter = 'N'; }
      }
      else if (col === 3) { val = gNums[row]; colLetter = 'G'; }
      else { val = oNums[row]; colLetter = 'O'; }

      cells.push({
        index: idx,
        row,
        col,
        colLetter,
        val,
        isFree,
        marked: isFree
      });
    }
  }
  return cells;
};

// Winning patterns (Standard 75-Ball)
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

const checkWinningPatterns = (cells: BingoCell[]): number[] | null => {
  for (const line of WIN_PATTERNS) {
    if (line.every(idx => cells[idx]?.marked)) return line;
  }
  return null;
};

// Check if a card has a winning pattern specifically completed by/containing any of the eligible called balls
const getActiveWinningPatternOnBall = (
  cells: BingoCell[],
  eligibleBallNums: (number | null | undefined)[] | number | null
): number[] | null => {
  const numsArray = Array.isArray(eligibleBallNums) ? eligibleBallNums : [eligibleBallNums];
  const validNums = numsArray.filter((n): n is number => typeof n === 'number' && n > 0);
  if (validNums.length === 0) return null;

  for (const line of WIN_PATTERNS) {
    if (line.every(idx => cells[idx]?.marked)) {
      const containsEligible = line.some(idx => {
        const cell = cells[idx];
        return !cell?.isFree && typeof cell?.val === 'number' && validNums.includes(cell.val);
      });
      if (containsEligible) return line;
    }
  }
  return null;
};

const fetchRoomSyncWithTimeout = async (roomId: string, timeoutMs = 6000, userId?: string): Promise<any | null> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const apiBase = getApiBase();
    const url = userId
      ? `${apiBase}/rooms/${roomId}/sync?userId=${encodeURIComponent(userId)}`
      : `${apiBase}/rooms/${roomId}/sync`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const data = await res.json();
    return data && data.success ? data : null;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
};

export const BingoProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { deductBalance, addBalance, refreshBalance, balance, bonus } = useWallet();
  const { user } = useAuth();
  const { currentPage, showToast } = useApp();
  const { lang } = useLanguage();
  const {
    commissionRate,
    simulatedPlayerCount,
    botPool
  } = useAdmin();

  // Round Lifecycle Phase
  const [roundPhase, setRoundPhase] = useState<RoundPhase>('lobby');
  const [lobbyCountdown, setLobbyCountdown] = useState<number>(40);
  const [winnerCountdown, setWinnerCountdown] = useState<number>(8);
  const [waitingForPlayers, setWaitingForPlayers] = useState<boolean>(true);
  const [waitingForOtherHouses, setWaitingForOtherHouses] = useState<boolean>(false);
  const [roomMode, setRoomMode] = useState<'active' | 'spectating'>('active');
  const [realPlayerCount, setRealPlayerCount] = useState<number>(0);
  const [activeUsersCount, setActiveUsersCount] = useState<number>(0);
  const [joinFeed, setJoinFeed] = useState<Array<{ id: number; userName: string; countdownStarted: boolean }>>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Betting state (Stakes: 10, 20, 50, 100 Birr)
  const [betAmount, setBetAmountState] = useState<number>(10);
  const [jackpotPool, setJackpotPool] = useState<number>(0);
  const [stakeRoomsSummary, setStakeRoomsSummary] = useState<Record<number, number>>({ 10: 0, 20: 0, 50: 0, 100: 0 });
  const [cardQuantity, setCardQuantityState] = useState<number>(1);
  const [hasTicket, setHasTicket] = useState<boolean>(false);
  const [hasPreBoughtNext, setHasPreBoughtNext] = useState<boolean>(false);

  // 600 Cartelas Pool Selection (User Assigned — starts unselected)
  const [selectedCartelaIds, setSelectedCartelaIds] = useState<number[]>([]);
  const [isCartelaPickerOpen, setIsCartelaPickerOpen] = useState<boolean>(false);
  const [occupiedCartelaIds, setOccupiedCartelaIds] = useState<number[]>([]);

  const setCardQuantity = (qty: number) => {
    setCardQuantityState(Math.max(1, Math.min(4, qty)));
  };

  const totalPlayableCards = cardQuantity;
  const hasSelectedCartelas = selectedCartelaIds.filter(id => id > 0).length >= cardQuantity;

  // Active Cartelas (Safe deterministic generation from chosen IDs)
  const [cartela1Data, setCartela1Data] = useState<BingoCell[]>(() =>
    selectedCartelaIds[0] ? generateCardFromId(selectedCartelaIds[0]) : []
  );
  const [cartela2Data, setCartela2Data] = useState<BingoCell[]>(() =>
    selectedCartelaIds[1] ? generateCardFromId(selectedCartelaIds[1]) : []
  );
  const [cartela3Data, setCartela3Data] = useState<BingoCell[]>(() =>
    selectedCartelaIds[2] ? generateCardFromId(selectedCartelaIds[2]) : []
  );
  const [cartela4Data, setCartela4Data] = useState<BingoCell[]>(() =>
    selectedCartelaIds[3] ? generateCardFromId(selectedCartelaIds[3]) : []
  );
  const [activeCartelaIndex, setActiveCartelaIndex] = useState<number>(0);

  // Game Engine State
  const [gameActive, setGameActive] = useState<boolean>(false);
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [currentCall, setCurrentCall] = useState<CalledBall | null>(null);
  const [previousCall, setPreviousCall] = useState<CalledBall | null>(null);

  // Auto-Play Engine (Persisted in localStorage so background app switches & reloads never reset to Auto)
  const AUTOPLAY_STORAGE_KEY = 'betika_bingo_autoplay_mode';
  const [autoPlay, setAutoPlay] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(AUTOPLAY_STORAGE_KEY);
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });
  const autoPlayRef = useRef<boolean>(autoPlay);
  autoPlayRef.current = autoPlay;
  const isAutoModeLocked = roundPhase === 'playing' || roundPhase === 'locked';

  // Room State
  const [playersCount, setPlayersCount] = useState<number>(0);
  const [prizePool, setPrizePool] = useState<number>(0);
  const [totalPot, setTotalPot] = useState<number>(0);
  const [opponents, setOpponents] = useState<Opponent[]>([]);
  const [canWin, setCanWin] = useState<boolean>(false);
  const [winResult, setWinResult] = useState<WinResult | null>(null);
  const [showWinModal, setShowWinModal] = useState<boolean>(false);
  const [claimInProgress, setClaimInProgress] = useState<boolean>(false);
  const isClaimingRef = useRef<boolean>(false);
  const lastDaubClickTimeRef = useRef<{ [key: string]: number }>({});

  // Reactive Winning Pattern Detection for Manual Mode BINGO Claim Button:
  // In manual play: a pattern is active for claim STRICTLY on the active ball that completed it.
  // As soon as the next number is called without claiming, that pattern expires (slept bingo), and the user must complete a new pattern.
  const { hasWinningPattern, hasSleptPattern } = useMemo(() => {
    if (roundPhase !== 'playing') {
      return { hasWinningPattern: false, hasSleptPattern: false };
    }

    if (autoPlay) {
      const win1 = cartela1Data.length > 0 ? checkWinningPatterns(cartela1Data) : null;
      const win2 = totalPlayableCards >= 2 && cartela2Data.length > 0 ? checkWinningPatterns(cartela2Data) : null;
      const win3 = totalPlayableCards >= 3 && cartela3Data.length > 0 ? checkWinningPatterns(cartela3Data) : null;
      const win4 = totalPlayableCards >= 4 && cartela4Data.length > 0 ? checkWinningPatterns(cartela4Data) : null;
      return { hasWinningPattern: !!(win1 || win2 || win3 || win4), hasSleptPattern: false };
    }

    // Manual Mode: Check if any completed pattern contains the current active ball
    const eligibleBalls = typeof currentCall?.num === 'number' && currentCall.num > 0 ? [currentCall.num] : [];
    const active1 = cartela1Data.length > 0 && eligibleBalls.length > 0 ? getActiveWinningPatternOnBall(cartela1Data, eligibleBalls) : null;
    const active2 = totalPlayableCards >= 2 && cartela2Data.length > 0 && eligibleBalls.length > 0 ? getActiveWinningPatternOnBall(cartela2Data, eligibleBalls) : null;
    const active3 = totalPlayableCards >= 3 && cartela3Data.length > 0 && eligibleBalls.length > 0 ? getActiveWinningPatternOnBall(cartela3Data, eligibleBalls) : null;
    const active4 = totalPlayableCards >= 4 && cartela4Data.length > 0 && eligibleBalls.length > 0 ? getActiveWinningPatternOnBall(cartela4Data, eligibleBalls) : null;
    const hasActive = !!(active1 || active2 || active3 || active4);

    if (hasActive) {
      return { hasWinningPattern: true, hasSleptPattern: false };
    }

    // If not active on eligible balls, check if player has any completed pattern from older balls (slept/missed)
    const all1 = cartela1Data.length > 0 ? checkWinningPatterns(cartela1Data) : null;
    const all2 = totalPlayableCards >= 2 && cartela2Data.length > 0 ? checkWinningPatterns(cartela2Data) : null;
    const all3 = totalPlayableCards >= 3 && cartela3Data.length > 0 ? checkWinningPatterns(cartela3Data) : null;
    const all4 = totalPlayableCards >= 4 && cartela4Data.length > 0 ? checkWinningPatterns(cartela4Data) : null;
    const hasSlept = !!(all1 || all2 || all3 || all4);

    return { hasWinningPattern: false, hasSleptPattern: hasSlept };
  }, [roundPhase, autoPlay, currentCall?.num, cartela1Data, cartela2Data, cartela3Data, cartela4Data, totalPlayableCards]);
  const winModalDismissedForRoundRef = useRef<number | null>(null);
  const activeWinModalRoundRef = useRef<number | null>(null);
  const lastLiveWinRoundRef = useRef<number | null>(null);
  const [spherePop, setSpherePop] = useState<boolean>(false);
  const [isVerticalBoard, setIsVerticalBoard] = useState<boolean>(true);
  const [showMasterBoard, setShowMasterBoard] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(() => soundEngine.getMuted());

  // Low-Network & Disconnect Protection States
  const [networkStatus, setNetworkStatus] = useState<'connected' | 'reconnecting' | 'polling' | 'disconnected' | 'degraded'>('connected');
  const [networkLatency, setNetworkLatency] = useState<number>(24);
  const [offlineWinsNotice, setOfflineWinsNotice] = useState<any[]>([]);

  const dismissOfflineWin = useCallback((winId: string) => {
    socketService.acknowledgeOfflineWin(winId);
    setOfflineWinsNotice(prev => prev.filter(w => w.id !== winId));
  }, []);

  // Insufficient Balance Modal State
  const [showInsufficientBalanceModal, setShowInsufficientBalanceModal] = useState<boolean>(false);
  const [insufficientBalanceDetails, setInsufficientBalanceDetails] = useState<{
    required: number;
    balance: number;
    shortfall: number;
  } | null>(null);

  // Dedicated Stake Room Architecture: room-10, room-20, room-50, room-100
  const getActiveRoomId = useCallback(() => `room-${betAmount}`, [betAmount]);

  // Safe Stake Switcher: If player changes stake while waiting in lobby, seamlessly transfer ticket with net difference adjusted
  const setBetAmount = async (newStake: number) => {
    if (newStake === betAmount) return;

    if (roundPhase === 'playing' && hasTicket) {
      showToast('⚠️ Active round in progress! Switch rooms when round ends.');
      return;
    }

    if (roundPhase === 'lobby' && hasTicket) {
      if (userRef.current?.id) {
        try {
          const oldRoomId = `room-${betAmount}`;
          const newRoomId = `room-${newStake}`;
          // Attempt seamless ticket transfer between stake rooms
          const transferRes = await socketService.transferTicketLobby(oldRoomId, newRoomId, userRef.current.id);
          if (transferRes.success) {
            setHasTicket(true);
            if (transferRes.tickets && transferRes.tickets.length > 0) {
              const newIds = transferRes.tickets.map((t: any) => t.cartelaId);
              setSelectedCartelaIds([
                newIds[0] || selectedCartelaIdsRef.current[0],
                newIds[1] || selectedCartelaIdsRef.current[1],
                newIds[2] || selectedCartelaIdsRef.current[2]
              ]);
            }
            const diff = transferRes.refundedOrCharged || 0;
            if (diff > 0) {
              showToast(`💸 Switched to ${newStake} ETB Room (+${diff.toFixed(0)} ETB refunded)`);
            } else if (diff < 0) {
              showToast(`🎯 Switched to ${newStake} ETB Room (${Math.abs(diff).toFixed(0)} ETB stake adjusted)`);
            } else {
              showToast(`🎯 Switched to ${newStake} ETB Room`);
            }
            setBetAmountState(newStake);
            refreshBalanceRef.current();
            return;
          } else {
            console.warn('Ticket transfer failed, falling back to cancel & refund:', transferRes.error);
            const cancelRes = await socketService.cancelTicketLobby(oldRoomId, userRef.current.id);
            if (cancelRes.success) {
              showToast(`💸 ${cancelRes.refunded || (betAmount * cardQuantity)} ETB refunded from ${betAmount} ETB lobby!`);
            }
            setHasTicket(false);
            setHasPreBoughtNext(false);
            try {
              localStorage.removeItem('betika_bingo_active_ticket');
            } catch {}
            refreshBalanceRef.current();
          }
        } catch (err) {
          console.warn('Error transferring lobby ticket on stake switch:', err);
          setHasTicket(false);
        }
      } else {
        const oldCost = betAmount * cardQuantity;
        const newCost = newStake * cardQuantity;
        const diff = oldCost - newCost;
        if (diff > 0) {
          addBalanceRef.current(diff);
          showToast(`💸 Switched to ${newStake} ETB Room (+${diff} ETB refunded)`);
          setHasTicket(true);
        } else if (balance + bonus >= Math.abs(diff)) {
          deductBalance(Math.abs(diff));
          showToast(`🎯 Switched to ${newStake} ETB Room (${Math.abs(diff)} ETB stake adjusted)`);
          setHasTicket(true);
        } else {
          addBalanceRef.current(oldCost);
          setHasTicket(false);
          showToast(`⚠️ Insufficient balance for ${newStake} ETB. ${oldCost} ETB refunded.`);
        }
        refreshBalanceRef.current();
      }
    }

    // If switching rooms with a pre-bought ticket, cancel & refund from old room first
    if (hasPreBoughtNext && userRef.current?.id) {
      try {
        const oldRoomId = `room-${betAmount}`;
        await socketService.cancelTicketLobby(oldRoomId, userRef.current.id);
        setHasPreBoughtNext(false);
      } catch (err) {
        console.warn('Error cancelling pre-bought ticket on room switch:', err);
      }
    }

    setBetAmountState(newStake);
    showToast(`🎯 Switched to ${newStake} ETB Room`);
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundEngine.setMuted(next);
    showToast(next ? '🔇 Audio Muted' : '🔊 Audio Unmuted');
  };

  // Pre-warm and cache all 75 balls (B, I, N, G, O) voice files into memory & bind universal unlock listener
  useEffect(() => {
    soundEngine.preloadVoicePack('ALL', 75);

    const handleInteractionUnlock = () => {
      soundEngine.unlockAudio();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('touchstart', handleInteractionUnlock, { once: true, passive: true });
      window.addEventListener('touchend', handleInteractionUnlock, { once: true, passive: true });
      window.addEventListener('click', handleInteractionUnlock, { once: true, passive: true });
      window.addEventListener('keydown', handleInteractionUnlock, { once: true, passive: true });
    }
  }, []);

  // Keep Cartelas synchronized when IDs change (safe when unselected)
  useEffect(() => {
    if (roundPhase === 'lobby' || !hasTicket) {
      setCartela1Data(selectedCartelaIds[0] ? generateCardFromId(selectedCartelaIds[0]) : []);
      setCartela2Data(selectedCartelaIds[1] ? generateCardFromId(selectedCartelaIds[1]) : []);
      setCartela3Data(selectedCartelaIds[2] ? generateCardFromId(selectedCartelaIds[2]) : []);
      setCartela4Data(selectedCartelaIds[3] ? generateCardFromId(selectedCartelaIds[3]) : []);
    }
  }, [selectedCartelaIds, roundPhase, hasTicket]);

  // canWin detection
  useEffect(() => {
    const check = (cells: BingoCell[]) => {
      for (const line of WIN_PATTERNS) {
        if (line.filter(idx => cells[idx]?.marked).length >= line.length - 1) return true;
      }
      return false;
    };
    const c1Win = check(cartela1Data);
    const c2Win = totalPlayableCards >= 2 && check(cartela2Data);
    const c3Win = totalPlayableCards >= 3 && check(cartela3Data);
    const c4Win = totalPlayableCards >= 4 && check(cartela4Data);
    setCanWin(c1Win || c2Win || c3Win || c4Win);
  }, [cartela1Data, cartela2Data, cartela3Data, cartela4Data, totalPlayableCards]);

  // Auto-daub helper when a number is called
  const applyDrawnNumber = useCallback((num: number, col: string) => {
    setCurrentCall(prev => {
      if (prev && prev.num !== num) {
        setPreviousCall(prev);
      }
      return { num, col };
    });
    setSpherePop(true);
    setTimeout(() => setSpherePop(false), 300);

    // Voice-Only: Real human recorded voice announcement (zero synthetic pops/chimes)
    soundEngine.speakBall(col, num).catch(() => {});
    setCalledNumbers(prev => (prev.includes(num) ? prev : [...prev, num]));

    const daubCard = (prev: BingoCell[]) => {
      const matchIdx = prev.findIndex(c => c.val === num);
      if (matchIdx !== -1 && !prev[matchIdx].marked) {
        const next = [...prev];
        next[matchIdx] = { ...next[matchIdx], marked: true };
        return next;
      }
      return prev;
    };

    // Auto-daub cards only when Auto-Play is active; in Manual mode, user taps their card
    if (autoPlayRef.current) {
      setCartela1Data(prev => daubCard(prev));
      setCartela2Data(prev => daubCard(prev));
      setCartela3Data(prev => daubCard(prev));
      setCartela4Data(prev => daubCard(prev));
    }
  }, []);

  // Instant State Catch-Up Protocol: Daub all drawn numbers within 100ms
  const fastForwardCatchUp = useCallback((drawnNums: number[]) => {
    if (!drawnNums || drawnNums.length === 0) return;
    setCalledNumbers(drawnNums);

    const lastNum = drawnNums[drawnNums.length - 1];
    const colLetter = lastNum <= 15 ? 'B' : lastNum <= 30 ? 'I' : lastNum <= 45 ? 'N' : lastNum <= 60 ? 'G' : 'O';
    setCurrentCall({ num: lastNum, col: colLetter });

    if (drawnNums.length >= 2) {
      const prevNum = drawnNums[drawnNums.length - 2];
      const prevColLetter = prevNum <= 15 ? 'B' : prevNum <= 30 ? 'I' : prevNum <= 45 ? 'N' : prevNum <= 60 ? 'G' : 'O';
      setPreviousCall({ num: prevNum, col: prevColLetter });
    } else {
      setPreviousCall(null);
    }

    if (!autoPlayRef.current) {
      // In manual mode, fast-forward catchup updates called numbers & current call ONLY. Cards are NEVER auto-daubed!
      return;
    }

    const markMatching = (cells: BingoCell[]) => {
      return cells.map(c => {
        if (!c.marked && !c.isFree && drawnNums.includes(c.val as number)) {
          return { ...c, marked: true };
        }
        return c;
      });
    };

    setCartela1Data(prev => markMatching(prev));
    setCartela2Data(prev => markMatching(prev));
    setCartela3Data(prev => markMatching(prev));
    setCartela4Data(prev => markMatching(prev));
  }, []);

  const roundPhaseRef = useRef(roundPhase);
  roundPhaseRef.current = roundPhase;

  const hasPreBoughtNextRef = useRef<boolean>(false);
  hasPreBoughtNextRef.current = hasPreBoughtNext;

  const userRef = useRef(user);
  userRef.current = user;

  const selectedCartelaIdsRef = useRef(selectedCartelaIds);
  selectedCartelaIdsRef.current = selectedCartelaIds;

  const addBalanceRef = useRef(addBalance);
  addBalanceRef.current = addBalance;

  const refreshBalanceRef = useRef(refreshBalance);
  refreshBalanceRef.current = refreshBalance;

  const applyDrawnNumberRef = useRef(applyDrawnNumber);
  applyDrawnNumberRef.current = applyDrawnNumber;

  const fastForwardCatchUpRef = useRef(fastForwardCatchUp);
  fastForwardCatchUpRef.current = fastForwardCatchUp;

  const calledNumbersRef = useRef<number[]>([]);
  calledNumbersRef.current = calledNumbers;

  const cartela1DataRef = useRef<BingoCell[]>([]);
  const cartela2DataRef = useRef<BingoCell[]>([]);
  const cartela3DataRef = useRef<BingoCell[]>([]);
  cartela1DataRef.current = cartela1Data;
  cartela2DataRef.current = cartela2Data;
  cartela3DataRef.current = cartela3Data;
  const cartela4DataRef = useRef<BingoCell[]>([]);
  cartela4DataRef.current = cartela4Data;

  // Storage key and in-memory set for user-marked cell indices in manual mode
  const ACTIVE_MANUAL_MARKS_KEY = 'betika_bingo_manual_marks';
  const manualDaubedCellsRef = useRef<{ [cartelaId: number]: Set<number> }>({});

  const loadSavedManualMarks = (currentRound?: number) => {
    try {
      const raw = sessionStorage.getItem(ACTIVE_MANUAL_MARKS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (!currentRound || parsed.roundNumber === currentRound) {
          if (parsed.marks && typeof parsed.marks === 'object') {
            for (const [cId, indices] of Object.entries(parsed.marks)) {
              manualDaubedCellsRef.current[Number(cId)] = new Set(Array.isArray(indices) ? (indices as number[]) : []);
            }
          }
        }
      }
    } catch (e) {
      console.warn('Error reading manual marks storage:', e);
    }
  };

  const saveManualMarks = (roundNum: number) => {
    try {
      const serializable: { [cId: number]: number[] } = {};
      for (const [cId, set] of Object.entries(manualDaubedCellsRef.current)) {
        serializable[Number(cId)] = Array.from(set);
      }
      sessionStorage.setItem(ACTIVE_MANUAL_MARKS_KEY, JSON.stringify({
        roundNumber: roundNum,
        marks: serializable
      }));
    } catch {
      // ignore
    }
  };

  const clearManualMarks = () => {
    try {
      sessionStorage.removeItem(ACTIVE_MANUAL_MARKS_KEY);
      manualDaubedCellsRef.current = {};
    } catch {
      // ignore
    }
  };

  // Helper to rehydrate card checkmarks with drawn numbers
  // In Auto mode: marks all called numbers.
  // In Manual mode: strictly PRESERVES user manual marks (never wipes marks upon server snapshot or tab-out).
  const hydrateCardWithDrawn = (
    cardMatrix: BingoCell[],
    drawnNums?: number[],
    isAuto: boolean = true,
    cartelaId?: number,
    existingCells?: BingoCell[]
  ): BingoCell[] => {
    if (!cardMatrix || !Array.isArray(cardMatrix)) return cardMatrix;
    const drawnSet = new Set(drawnNums || []);

    if (isAuto) {
      return cardMatrix.map(c => {
        if (c.isFree || drawnSet.has(c.val as number)) {
          return { ...c, marked: true };
        }
        return { ...c, marked: false };
      });
    }

    // Manual mode: Strictly mark only cells that were explicitly daubed by the user in this round!
    const manualSet = cartelaId && manualDaubedCellsRef.current[cartelaId]
      ? manualDaubedCellsRef.current[cartelaId]
      : new Set<number>();

    return cardMatrix.map((c, idx) => {
      if (c.isFree) {
        return { ...c, marked: true };
      }
      const val = c.val as number;
      const isDrawn = drawnSet.has(val);
      if (manualSet.has(idx) && isDrawn) {
        return { ...c, marked: true };
      }
      return { ...c, marked: false };
    });
  };

  // Authoritative Round Number & Ball Liveness Watchdog Tracking
  const [roundNumber, setRoundNumber] = useState<number>(1);
  const roundNumberRef = useRef<number>(1);
  roundNumberRef.current = roundNumber;

  const lastBallTimeRef = useRef<number>(Date.now());

  // Storage key for persistent active ticket across app reloads / disconnects
  const ACTIVE_TICKET_STORAGE_KEY = 'betika_bingo_active_ticket';

  // ── Persistent Active Ticket & Disconnect Protection Rehydration ──
  useEffect(() => {
    try {
      const savedRaw = localStorage.getItem(ACTIVE_TICKET_STORAGE_KEY);
      if (savedRaw) {
        const saved = JSON.parse(savedRaw);
        const ageMs = Date.now() - (saved.timestamp || 0);
        // Valid within 15 minutes (active lobby or game in progress)
        if (ageMs < 15 * 60 * 1000) {
          if (typeof saved.betAmount === 'number') setBetAmountState(saved.betAmount);
          if (typeof saved.cardQuantity === 'number') setCardQuantityState(Math.max(1, Math.min(5, saved.cardQuantity)));
          if (typeof saved.isAutoPlay === 'boolean') {
            setAutoPlay(saved.isAutoPlay);
            autoPlayRef.current = saved.isAutoPlay;
            try { localStorage.setItem(AUTOPLAY_STORAGE_KEY, String(saved.isAutoPlay)); } catch {}
          }
          if (Array.isArray(saved.selectedCartelaIds) && saved.selectedCartelaIds.length > 0) {
            setSelectedCartelaIds([
              saved.selectedCartelaIds[0] || selectedCartelaIds[0],
              saved.selectedCartelaIds[1] || selectedCartelaIds[1],
              saved.selectedCartelaIds[2] || selectedCartelaIds[2],
              saved.selectedCartelaIds[3] || selectedCartelaIds[3]
            ].filter(Boolean));
            setCartela1Data(generateCardFromId(saved.selectedCartelaIds[0]));
            if (saved.selectedCartelaIds[1]) setCartela2Data(generateCardFromId(saved.selectedCartelaIds[1]));
            if (saved.selectedCartelaIds[2]) setCartela3Data(generateCardFromId(saved.selectedCartelaIds[2]));
            if (saved.selectedCartelaIds[3]) setCartela4Data(generateCardFromId(saved.selectedCartelaIds[3]));
          }
          setHasTicket(true);
          setGameActive(true);
          console.log('🔄 [BingoContext] Restored active waiting ticket from persistent session');
        } else {
          // Stale unplayed ticket that was abandoned while waiting in lobby: reconcile and refund stake
          const unplayedRefund = (saved.betAmount || 10) * (saved.cardQuantity || 1);
          if (unplayedRefund > 0) {
            addBalanceRef.current(unplayedRefund);
            refreshBalanceRef.current();
            showToast(`💸 ${unplayedRefund} ETB refunded from unplayed lobby round!`);
          }
          localStorage.removeItem(ACTIVE_TICKET_STORAGE_KEY);
        }
      }
    } catch (e) {
      console.warn('Error reading active ticket storage:', e);
    }
  }, []);

  // Socket.IO Multiplayer Room Listener (Active when viewing bingo or holding active ticket)
  useEffect(() => {
    const isBingoActive = currentPage === 'bingo' || hasTicket;
    if (!isBingoActive) {
      return;
    }

    const roomId = getActiveRoomId();
    socketService.joinRoom(roomId, userRef.current?.id, userRef.current?.fullName);
    if (userRef.current?.id) {
      socketService.updatePlayerMode(roomId, userRef.current.id, autoPlayRef.current);
    }

    // 1. Room State / Sync
    const unsubRoomState = socketService.onRoomState((state: any) => {
      // Room isolation guard: ignore broadcasts from other stake rooms
      if (state.roomId && state.roomId !== roomId) return;

      if (typeof state.roundNumber === 'number' && state.roundNumber !== roundNumberRef.current) {
        console.log(`🔄 [BingoContext] Round transition: #${roundNumberRef.current} -> #${state.roundNumber}`);
        setRoundNumber(state.roundNumber);
        clearManualMarks();
        const currentIds = selectedCartelaIdsRef.current;
        setCartela1Data(generateCardFromId(currentIds[0]));
        setCartela2Data(generateCardFromId(currentIds[1]));
        setCartela3Data(currentIds[2] ? generateCardFromId(currentIds[2]) : []);
        setCartela4Data(currentIds[3] ? generateCardFromId(currentIds[3]) : []);
      }

      if (state.phase) {
        setRoundPhase(prev => {
          if (prev !== 'lobby' && state.phase === 'lobby') {
            winModalDismissedForRoundRef.current = null;
            activeWinModalRoundRef.current = null;
            setShowWinModal(false);
            setHasTicket(hasPreBoughtNextRef.current);
            setHasPreBoughtNext(false);
            setCalledNumbers([]);
            setCurrentCall(null);
          } else if (state.phase === 'playing') {
            setGameActive(true);
          }
          return state.phase;
        });
      }
      if (typeof state.lobbyCountdown === 'number') setLobbyCountdown(state.lobbyCountdown);
      if (typeof state.winnerCountdown === 'number') setWinnerCountdown(state.winnerCountdown);
      if (typeof state.playersCount === 'number') setPlayersCount(state.playersCount);
      if (typeof state.totalPot === 'number') setTotalPot(state.totalPot);
      if (typeof state.winnerPayout === 'number') setPrizePool(state.winnerPayout);
      else if (typeof state.totalPot === 'number') setPrizePool(state.totalPot);
      if (typeof state.jackpotPool === 'number') setJackpotPool(state.jackpotPool);

      if (typeof state.waitingForPlayers === 'boolean') setWaitingForPlayers(state.waitingForPlayers);
      if (typeof state.waitingForOtherHouses === 'boolean') setWaitingForOtherHouses(state.waitingForOtherHouses);
      if (state.mode === 'active' || state.mode === 'spectating') setRoomMode(state.mode);
      if (typeof state.realPlayerCount === 'number') setRealPlayerCount(state.realPlayerCount);
      if (typeof state.activeUsersCount === 'number') setActiveUsersCount(state.activeUsersCount);
      if (state.stakeRoomsSummary) setStakeRoomsSummary(state.stakeRoomsSummary);
      if (Array.isArray(state.occupiedCartelaIds)) setOccupiedCartelaIds(state.occupiedCartelaIds);

      if (state.currentCall) {
        setCurrentCall(state.currentCall);
      }

      // Multi-Device & Disconnect Hydration: If server reports active tickets for this user
      if (state.userTickets && Array.isArray(state.userTickets) && state.userTickets.length > 0) {
        const tickets = state.userTickets;
        const newIds = tickets.map((t: any) => t.cartelaId);
        const updatedIds: number[] = [
          newIds[0] || selectedCartelaIdsRef.current[0],
          newIds[1] || selectedCartelaIdsRef.current[1],
          newIds[2] || selectedCartelaIdsRef.current[2],
          newIds[3] || selectedCartelaIdsRef.current[3]
        ].filter(Boolean);
        setSelectedCartelaIds(updatedIds);
        const drawn = (state.drawnNumbers && state.drawnNumbers.length > 0) ? state.drawnNumbers : calledNumbersRef.current;
        if (tickets[0]?.cardMatrix) setCartela1Data(hydrateCardWithDrawn(tickets[0].cardMatrix, drawn, autoPlayRef.current, updatedIds[0], cartela1DataRef.current));
        if (tickets[1]?.cardMatrix) setCartela2Data(hydrateCardWithDrawn(tickets[1].cardMatrix, drawn, autoPlayRef.current, updatedIds[1], cartela2DataRef.current));

        // Keep player auto/manual mode synchronized with server ticket
        if (tickets[0]?.isAutoPlay === false && autoPlayRef.current !== false) {
          setAutoPlay(false);
          autoPlayRef.current = false;
          try { localStorage.setItem(AUTOPLAY_STORAGE_KEY, 'false'); } catch {}
        } else if (!autoPlayRef.current && tickets[0]?.isAutoPlay === true && userRef.current?.id) {
          socketService.updatePlayerMode(roomId, userRef.current.id, false);
        }

        if (state.isPreBuy || state.mode === 'spectating') {
          setHasPreBoughtNext(true);
          setHasTicket(false);
        } else {
          setHasTicket(true);
          if (state.phase === 'playing') {
            setGameActive(true);
          }
        }
      }

      if (state.drawnNumbers && Array.isArray(state.drawnNumbers) && state.drawnNumbers.length > 0) {
        fastForwardCatchUpRef.current(state.drawnNumbers);
        lastBallTimeRef.current = Date.now();
      }

      if (state.winResult && winModalDismissedForRoundRef.current !== (state.roundNumber || roundNumberRef.current)) {
        if (state.winResult.roomId && state.winResult.roomId !== roomId) {
          // Ignore win event from external stake house
          return;
        }
        const currentRound = state.roundNumber || roundNumberRef.current;
        if (activeWinModalRoundRef.current !== currentRound) {
          activeWinModalRoundRef.current = currentRound;
          isClaimingRef.current = false;
          setClaimInProgress(false);
          const currentUser = userRef.current;
        const isRealUserWin = 
          Boolean(currentUser?.id && Array.isArray(state.winResult.winnerUserIds) && state.winResult.winnerUserIds.includes(currentUser.id)) ||
          Boolean(currentUser?.id && state.winResult.winnerId && state.winResult.winnerId.includes(currentUser.id)) || 
          Boolean(currentUser?.fullName && state.winResult.winnerNames && state.winResult.winnerNames.includes(currentUser.fullName));

        if (isRealUserWin) {
          lastLiveWinRoundRef.current = state.roundNumber || roundNumberRef.current;
        }

        const winType = state.winResult.isSplit
          ? (isRealUserWin ? 'user_split' : 'opponent_win')
          : (isRealUserWin ? 'user_solo' : 'opponent_win');

        const payout = isRealUserWin ? (state.winResult.sharePerWinner || state.winResult.userShare || 0) : 0;
        const displayPayout = typeof state.winResult.winnerPayout === 'number'
          ? state.winResult.winnerPayout
          : (state.winResult.sharePerWinner || state.winResult.totalPot || 50);

        setWinResult({
          winType,
          winningCartelaNumber: Number(state.winResult.winningCartelaNumber || state.winResult.winningCartelas?.[0] || 1) || 1,
          winningLine: Array.isArray(state.winResult.winningIndices) ? state.winResult.winningIndices : [],
          winnerName: typeof state.winResult.winnerName === 'string' ? state.winResult.winnerName : (Array.isArray(state.winResult.winnerNames) ? String(state.winResult.winnerNames[0] || 'Winner') : 'Winner'),
          coWinners: Array.isArray(state.winResult.coWinners) ? state.winResult.coWinners : (Array.isArray(state.winResult.winnerNames) ? state.winResult.winnerNames : []),
          totalPot: Number(state.winResult.totalPot || displayPayout) || 0,
          userShare: Number(payout) || 0,
          winnerPayout: Number(displayPayout) || 0,
          stakeAmount: Number(state.winResult.stakeAmount) || 10,
          houseFee: Number(state.winResult.houseFee) || 0,
          netPrizePot: Number(state.winResult.netPrizePot || displayPayout) || 0
        });
        setShowWinModal(true);
        }
      }
    });

    // 2. Ball Called
    const unsubBallCalled = socketService.onBallCalled((data: any) => {
      if (data.roomId && data.roomId !== roomId) return;
      // Staggered Audio Isolation: Suppress ball audio & speech if this room is in winner phase
      if (roundPhaseRef.current === 'winner') return;

      lastBallTimeRef.current = Date.now();
      if (data.currentCall) {
        applyDrawnNumberRef.current(data.currentCall.num, data.currentCall.col);
      }
      if (data.drawnNumbers) {
        setCalledNumbers(data.drawnNumbers);
      }
    });

    // 3. Round Started
    const unsubRoundStarted = socketService.onRoundStarted((data: any) => {
      if (data.roomId && data.roomId !== roomId) return;
      lastBallTimeRef.current = Date.now();
      if (typeof data.roundNumber === 'number') {
        setRoundNumber(data.roundNumber);
      }
      clearManualMarks();
      isClaimingRef.current = false;
      setClaimInProgress(false);
      setRoundPhase('playing');
      setGameActive(true);
      setWaitingForPlayers(false);
      if (data.mode === 'active' || data.mode === 'spectating') setRoomMode(data.mode);
      if (typeof data.realPlayerCount === 'number') {
        setRealPlayerCount(data.realPlayerCount);
      }
      if (typeof data.playersCount === 'number') {
        setPlayersCount(data.playersCount);
      }
      setCalledNumbers([]);
      setCurrentCall(null);
      setPreviousCall(null);
      setWinResult(null);
      winModalDismissedForRoundRef.current = null;
      setShowWinModal(false);
      if (data.winnerPayout) setPrizePool(data.winnerPayout);

      // If house is spectating (< 2 players), lone-player ticket is safely rolled over to next round
      if (data.mode === 'spectating') {
        setHasTicket(prevTicket => {
          if (prevTicket) {
            setHasPreBoughtNext(true);
          }
          return false;
        });
      } else {
        // Active house: If player had pre-bought ticket, transition to active playing
        setHasPreBoughtNext(prev => {
          if (prev) {
            setHasTicket(true);
            return false;
          }
          return false;
        });
      }

      // Generate fresh cards
      const currentIds = selectedCartelaIdsRef.current;
      setCartela1Data(generateCardFromId(currentIds[0]));
      setCartela2Data(generateCardFromId(currentIds[1]));
      setCartela3Data(currentIds[2] ? generateCardFromId(currentIds[2]) : []);
      setCartela4Data(currentIds[3] ? generateCardFromId(currentIds[3]) : []);
    });

    // 4. Round Winner & Split Pot Handler
    const unsubRoundWinner = socketService.onRoundWinner((winData: any) => {
      if (winData.roomId && winData.roomId !== roomId) return;
      setRoundPhase('winner');
      const currentUser = userRef.current;
      const isRealUserWin = 
        Boolean(currentUser?.id && Array.isArray(winData.winnerUserIds) && winData.winnerUserIds.includes(currentUser.id)) ||
        Boolean(currentUser?.id && winData.winnerId && winData.winnerId.includes(currentUser.id)) || 
        Boolean(currentUser?.fullName && winData.winnerNames && winData.winnerNames.includes(currentUser.fullName)) ||
        Boolean(currentUser?.id && winData.winnerId === currentUser.id);

      const winType = winData.isSplit
        ? (isRealUserWin ? 'user_split' : 'opponent_win')
        : (isRealUserWin ? 'user_solo' : 'opponent_win');

      const payout = isRealUserWin ? (winData.sharePerWinner || winData.userShare || 0) : 0;
      const displayPayout = typeof winData.winnerPayout === 'number'
        ? winData.winnerPayout
        : (winData.sharePerWinner || winData.totalPot || 50);

      setWinResult({
        winType,
        winningCartelaNumber: Number(winData.winningCartelaNumber || winData.winningCartelas?.[0] || 1) || 1,
        winningLine: Array.isArray(winData.winningIndices) ? winData.winningIndices : [],
        winnerName: typeof winData.winnerName === 'string' ? winData.winnerName : (Array.isArray(winData.winnerNames) ? String(winData.winnerNames[0] || 'Winner') : 'Winner'),
        coWinners: Array.isArray(winData.coWinners) ? winData.coWinners : (Array.isArray(winData.winnerNames) ? winData.winnerNames : []),
        totalPot: Number(winData.totalPot || displayPayout) || 0,
        userShare: Number(payout) || 0,
        winnerPayout: Number(displayPayout) || 0,
        stakeAmount: Number(winData.stakeAmount) || 10,
        houseFee: Number(winData.houseFee) || 0,
        netPrizePot: Number(winData.netPrizePot || displayPayout) || 0
      });
      setShowWinModal(true);

      if (isRealUserWin) {
        soundEngine.playWinFanfare();
        addBalanceRef.current(payout);
      } else {
        soundEngine.playPop();
      }
      try {
        localStorage.removeItem(ACTIVE_TICKET_STORAGE_KEY);
      } catch {}
      refreshBalanceRef.current();
    });

    // 5. Real-Time Server Balance Push
    let unsubBalance: (() => void) | null = null;
    if (user?.id) {
      unsubBalance = socketService.onUserBalanceUpdate(user.id, () => {
        refreshBalanceRef.current();
      });
    }

    // 6. Cross-Device Live Mirroring: Tickets Synced Across All Logged-in Devices
    const unsubTicketsSynced = socketService.onUserTicketsSynced((data: any) => {
      console.log('🎟️ [BingoContext] Multi-device ticket sync event received:', data);
      if (data.tickets && Array.isArray(data.tickets) && data.tickets.length > 0) {
        const tickets = data.tickets;
        const newIds = tickets.map((t: any) => t.cartelaId);
        const updatedIds: number[] = [
          newIds[0] || selectedCartelaIdsRef.current[0],
          newIds[1] || selectedCartelaIdsRef.current[1],
          newIds[2] || selectedCartelaIdsRef.current[2],
          newIds[3] || selectedCartelaIdsRef.current[3]
        ].filter(Boolean);
        setSelectedCartelaIds(updatedIds);
        const drawn = calledNumbersRef.current;
        if (tickets[0]?.cardMatrix) setCartela1Data(hydrateCardWithDrawn(tickets[0].cardMatrix, drawn, autoPlayRef.current, updatedIds[0], cartela1DataRef.current));
        if (tickets[1]?.cardMatrix) setCartela2Data(hydrateCardWithDrawn(tickets[1].cardMatrix, drawn, autoPlayRef.current, updatedIds[1], cartela2DataRef.current));
        if (tickets[2]?.cardMatrix) setCartela3Data(hydrateCardWithDrawn(tickets[2].cardMatrix, drawn, autoPlayRef.current, updatedIds[2], cartela3DataRef.current));
        if (tickets[3]?.cardMatrix) setCartela4Data(hydrateCardWithDrawn(tickets[3].cardMatrix, drawn, autoPlayRef.current, updatedIds[3], cartela4DataRef.current));

        if (data.isPreBuy) {
          setHasPreBoughtNext(true);
          showToast('🎟️ Tickets synced from your other phone (Pre-Bought for Next Round)!');
        } else {
          setHasTicket(true);
          showToast('🎟️ Tickets synced from your other phone! Ready for round.');
        }
      }
      refreshBalanceRef.current();
    });

    // 6.1 Lone-Player Stake Protection Notice (Spectator Mode Rollover)
    const unsubLonePlayer = socketService.onLonePlayerSpectatingNotice((data: any) => {
      if (data.roomId && data.roomId !== roomId) return;
      setHasTicket(false);
      setHasPreBoughtNext(true);
      setRoomMode('spectating');
      showToast(data.message || '👀 Watching as Spectator • Your ticket is reserved for the next round!');
    });

    // 7. Network Connection Status & Offline Win Listeners
    const unsubConn = socketService.onConnectionStatusChange((status, latency) => {
      setNetworkLatency(latency);
      setNetworkStatus(status);
    });

    const unsubOfflineWins = socketService.onOfflineWinNotification((wins) => {
      if (Array.isArray(wins) && wins.length > 0) {
        const currentRnd = roundNumberRef.current;
        const lastLiveRnd = lastLiveWinRoundRef.current;

        const trulyOfflineWins: any[] = [];
        wins.forEach((w: any) => {
          // If the win belongs to the current round or a round played live, auto-acknowledge silently without modal
          if (w.roundNumber === currentRnd || w.roundNumber === lastLiveRnd) {
            console.log(`🛡️ [BingoContext] Suppressing offline modal for live-participated round #${w.roundNumber}`);
            socketService.acknowledgeOfflineWin(w.id);
          } else {
            trulyOfflineWins.push(w);
          }
        });

        if (trulyOfflineWins.length > 0) {
          setOfflineWinsNotice(trulyOfflineWins);
          soundEngine.playWinFanfare();
          refreshBalanceRef.current();
        }
      }
    });

    // 8. Real-Time Lobby Player Joined Event (Ticket bought)
    const unsubPlayerJoined = socketService.onPlayerJoined((data: any) => {
      if (data.roomId && data.roomId !== roomId) return;
      if (typeof data.realPlayerCount === 'number') setRealPlayerCount(data.realPlayerCount);
      if (typeof data.waitingForPlayers === 'boolean') setWaitingForPlayers(data.waitingForPlayers);
      if (typeof data.activeUsersCount === 'number') setActiveUsersCount(data.activeUsersCount);
      if (typeof data.winnerPayout === 'number') setPrizePool(data.winnerPayout);
      else if (typeof data.totalPot === 'number') setPrizePool(data.totalPot);
      if (data.userName) {
        setJoinFeed(prev => [
          { id: Date.now(), userName: data.userName, countdownStarted: Boolean(data.countdownStarted) },
          ...prev
        ].slice(0, 4));
      }
    });

    // 8b. Real-Time Room User Entered Event (Room presence)
    const unsubRoomUserJoined = socketService.onRoomUserJoined((data: any) => {
      if (data.roomId && data.roomId !== roomId) return;
      if (typeof data.activeUsersCount === 'number') setActiveUsersCount(data.activeUsersCount);
      if (typeof data.realPlayerCount === 'number') setRealPlayerCount(data.realPlayerCount);
      if (typeof data.waitingForPlayers === 'boolean') setWaitingForPlayers(data.waitingForPlayers);
      if (data.userName) {
        setJoinFeed(prev => [
          { id: Date.now(), userName: `${data.userName} entered`, countdownStarted: false },
          ...prev
        ].slice(0, 4));
      }
    });

    // 9. Progressive Jackpot Live Updates & Hits
    const unsubJackpotUpdate = socketService.onJackpotUpdate((data: any) => {
      if (data && (data.roomId === roomId || !data.roomId || (roomId === 'room-10' && (data.roomId === 'arena' || data.roomId === 'default')))) {
        const poolVal = typeof data.balance === 'number' ? data.balance : (typeof data.pool === 'number' ? data.pool : null);
        if (poolVal !== null) setJackpotPool(poolVal);
      }
    });

    const unsubJackpotWon = socketService.onJackpotWon((data: any) => {
      if (data && (data.roomId === roomId || !data.roomId || (roomId === 'room-10' && (data.roomId === 'arena' || data.roomId === 'default')))) {
        const resetVal = typeof data.newPoolBalance === 'number' ? data.newPoolBalance : (typeof data.resetPool === 'number' ? data.resetPool : 0);
        setJackpotPool(resetVal);
        showToast(`🎰 💥 JACKPOT WON! ${data.winnerNames?.join(', ') || data.winnerName || 'Player'} won ${data.amount || data.jackpotAmount} ETB in ${data.ballsCount || data.calledCount} balls!`);
      }
    });

    // Fetch initial jackpot balance for current room
    fetch('/api/jackpots')
      .then(r => r.json())
      .then(d => {
        const list = Array.isArray(d?.jackpots) ? d.jackpots : (Array.isArray(d?.data) ? d.data : []);
        const p = list.find((item: any) => item.roomId === roomId || item.room_id === roomId || (roomId === 'room-10' && (item.roomId === 'arena' || item.room_id === 'default')));
        if (p && typeof p.balance === 'number') {
          setJackpotPool(p.balance);
        }
      })
      .catch(() => {});

    return () => {
      socketService.leaveRoom(roomId);
      unsubRoomState();
      unsubBallCalled();
      unsubRoundStarted();
      unsubRoundWinner();
      if (unsubBalance) unsubBalance();
      unsubTicketsSynced();
      unsubLonePlayer();
      unsubConn();
      unsubOfflineWins();
      unsubPlayerJoined();
      unsubRoomUserJoined();
      unsubJackpotUpdate();
      unsubJackpotWon();
    };
  }, [getActiveRoomId, user?.id, currentPage, hasTicket]);

  // Global Stake Rooms Player Count Summary (Runs continuously across all pages for modal/cards)
  useEffect(() => {
    const unsubStakeSummary = socketService.onStakeRoomsSummary((summary) => {
      if (summary) setStakeRoomsSummary(summary);
    });
    return () => {
      unsubStakeSummary();
    };
  }, []);

  // Central Authoritative Room Snapshot Reconciliation
  const applyRoomSnapshot = useCallback((data: any) => {
    if (!data || !data.success) return;

    if (typeof data.roundNumber === 'number' && data.roundNumber !== roundNumberRef.current) {
      setRoundNumber(data.roundNumber);
      clearManualMarks();
      const currentIds = selectedCartelaIdsRef.current;
      setCartela1Data(generateCardFromId(currentIds[0]));
      setCartela2Data(generateCardFromId(currentIds[1]));
      setCartela3Data(currentIds[2] ? generateCardFromId(currentIds[2]) : []);
      setCartela4Data(currentIds[3] ? generateCardFromId(currentIds[3]) : []);
    }

    if (data.phase) {
      setRoundPhase(prev => {
        if (prev !== 'lobby' && data.phase === 'lobby') {
          winModalDismissedForRoundRef.current = null;
          setShowWinModal(false);
          setWinResult(null);
          setHasTicket(hasPreBoughtNextRef.current);
          setHasPreBoughtNext(false);
          setCalledNumbers([]);
          setCurrentCall(null);
          isClaimingRef.current = false;
          setClaimInProgress(false);
          clearManualMarks();

          // Regenerate fresh unmarked cartelas on entering lobby so previous win-glow never persists
          const currentIds = selectedCartelaIdsRef.current;
          setCartela1Data(generateCardFromId(currentIds[0]));
          setCartela2Data(generateCardFromId(currentIds[1]));
          setCartela3Data(currentIds[2] ? generateCardFromId(currentIds[2]) : []);
          setCartela4Data(currentIds[3] ? generateCardFromId(currentIds[3]) : []);
        } else if (data.phase === 'playing') {
          setGameActive(true);
        }
        return data.phase;
      });
    }

    if (typeof data.lobbyCountdown === 'number') setLobbyCountdown(data.lobbyCountdown);
    if (typeof data.winnerCountdown === 'number') setWinnerCountdown(data.winnerCountdown);
    if (typeof data.playersCount === 'number') setPlayersCount(data.playersCount);
    if (typeof data.totalPot === 'number') setTotalPot(data.totalPot);
    if (typeof data.winnerPayout === 'number') setPrizePool(data.winnerPayout);
    else if (typeof data.totalPot === 'number') setPrizePool(data.totalPot);
    if (typeof data.waitingForPlayers === 'boolean') setWaitingForPlayers(data.waitingForPlayers);
    if (typeof data.waitingForOtherHouses === 'boolean') setWaitingForOtherHouses(data.waitingForOtherHouses);
    if (data.mode === 'active' || data.mode === 'spectating') setRoomMode(data.mode);
    if (typeof data.realPlayerCount === 'number') setRealPlayerCount(data.realPlayerCount);
    if (typeof data.activeUsersCount === 'number') setActiveUsersCount(data.activeUsersCount);
    if (data.stakeRoomsSummary) setStakeRoomsSummary(data.stakeRoomsSummary);

    if (Array.isArray(data.drawnNumbers) && data.drawnNumbers.length > 0) {
      fastForwardCatchUpRef.current(data.drawnNumbers);
      lastBallTimeRef.current = Date.now();
    }

    if (data.currentCall) {
      setCurrentCall(data.currentCall);
    }

    // Multi-Device Hydration: If user has active tickets on server, sync into local state
    if (data.userTickets && Array.isArray(data.userTickets) && data.userTickets.length > 0) {
      const tickets = data.userTickets;
      const newIds = tickets.map((t: any) => t.cartelaId);
      const updatedIds: number[] = [
        newIds[0] || selectedCartelaIdsRef.current[0],
        newIds[1] || selectedCartelaIdsRef.current[1],
        newIds[2] || selectedCartelaIdsRef.current[2],
        newIds[3] || selectedCartelaIdsRef.current[3]
      ].filter(Boolean);
      setSelectedCartelaIds(updatedIds);
      const drawn = (data.drawnNumbers && data.drawnNumbers.length > 0) ? data.drawnNumbers : calledNumbersRef.current;
      if (tickets[0]?.cardMatrix) setCartela1Data(hydrateCardWithDrawn(tickets[0].cardMatrix, drawn, autoPlayRef.current, updatedIds[0], cartela1DataRef.current));
      if (tickets[1]?.cardMatrix) setCartela2Data(hydrateCardWithDrawn(tickets[1].cardMatrix, drawn, autoPlayRef.current, updatedIds[1], cartela2DataRef.current));
      if (tickets[2]?.cardMatrix) setCartela3Data(hydrateCardWithDrawn(tickets[2].cardMatrix, drawn, autoPlayRef.current, updatedIds[2], cartela3DataRef.current));
      if (tickets[3]?.cardMatrix) setCartela4Data(hydrateCardWithDrawn(tickets[3].cardMatrix, drawn, autoPlayRef.current, updatedIds[3], cartela4DataRef.current));

      // Keep player auto/manual mode synchronized with server ticket
      if (tickets[0]?.isAutoPlay === false && autoPlayRef.current !== false) {
        setAutoPlay(false);
        autoPlayRef.current = false;
        try { localStorage.setItem(AUTOPLAY_STORAGE_KEY, 'false'); } catch {}
      } else if (!autoPlayRef.current && tickets[0]?.isAutoPlay === true && userRef.current?.id) {
        const activeRoom = data.roomId || getActiveRoomId();
        socketService.updatePlayerMode(activeRoom, userRef.current.id, false);
      }

      if (data.isPreBuy || data.mode === 'spectating') {
        setHasPreBoughtNext(true);
        setHasTicket(false);
      } else {
        setHasTicket(true);
        if (data.phase === 'playing') {
          setGameActive(true);
        }
      }
    }

    if (data.winResult && !showWinModal && winModalDismissedForRoundRef.current !== data.roundNumber) {
      const currentUser = userRef.current;
      const isRealUserWin = 
        Boolean(currentUser?.id && Array.isArray(data.winResult.winnerUserIds) && data.winResult.winnerUserIds.includes(currentUser.id)) ||
        Boolean(currentUser?.id && data.winResult.winnerId && data.winResult.winnerId.includes(currentUser.id)) || 
        Boolean(currentUser?.fullName && data.winResult.winnerNames && data.winResult.winnerNames.includes(currentUser.fullName));

      if (isRealUserWin) {
        lastLiveWinRoundRef.current = data.roundNumber || roundNumberRef.current;
      }

      const winType = data.winResult.isSplit
        ? (isRealUserWin ? 'user_split' : 'opponent_win')
        : (isRealUserWin ? 'user_solo' : 'opponent_win');

      const payout = isRealUserWin ? (data.winResult.sharePerWinner || data.winResult.userShare || 0) : 0;
      setWinResult({
        winType,
        winningCartelaNumber: Number(data.winResult.winningCartelaNumber || 1) || 1,
        winningLine: Array.isArray(data.winResult.winningIndices) ? data.winResult.winningIndices : [],
        winnerName: typeof data.winResult.winnerName === 'string' ? data.winResult.winnerName : 'Winner',
        coWinners: Array.isArray(data.winResult.coWinners) ? data.winResult.coWinners : [],
        totalPot: Number(data.winResult.totalPot || data.winResult.winnerPayout || 50) || 0,
        userShare: Number(payout) || 0,
        winnerPayout: Number(data.winResult.winnerPayout || data.winResult.totalPot || 50) || 0,
        stakeAmount: Number(data.winResult.stakeAmount) || 10,
        houseFee: Number(data.winResult.houseFee) || 0,
        netPrizePot: Number(data.winResult.netPrizePot || data.winResult.winnerPayout || 50) || 0
      });
      setShowWinModal(true);
    }
  }, [showWinModal]);

  // 1-Tap Manual Refresh Trigger (Instantly resolves freezes on weak network)
  const triggerManualSync = useCallback(async () => {
    const roomId = getActiveRoomId();
    console.log('⚡ [BingoContext] Manual 1-Tap Re-Sync triggered by user for room:', roomId);
    telegramService.triggerHaptic('light');
    setIsSyncing(true);
    showToast('🔄 Synchronizing game state...');

    try {
      // Re-verify room membership on socket
      socketService.joinRoom(roomId, userRef.current?.id, userRef.current?.fullName);

      // Resilient 6-second HTTP state snapshot fetch
      const data = await fetchRoomSyncWithTimeout(roomId, 6000, userRef.current?.id);
      if (data) {
        applyRoomSnapshot(data);
        socketService.markActivity();
        setNetworkStatus('connected');
        soundEngine.resumeAudioContext();
        telegramService.triggerHaptic('success');
        showToast('✅ Game state synchronized!');
      } else {
        // Safe reconnection that preserves all event listeners
        socketService.forceReconnect();
        showToast('⚠️ Reconnected to server. Fetching latest state...');
      }
    } finally {
      setIsSyncing(false);
    }
  }, [getActiveRoomId, applyRoomSnapshot, showToast]);

  // Dual-Engine HTTP Polling Fallback (Runs if Socket drops, degraded, or reconnecting)
  useEffect(() => {
    if (currentPage !== 'bingo' && !hasTicket) return;
    if (networkStatus !== 'reconnecting' && networkStatus !== 'polling' && networkStatus !== 'degraded') {
      return;
    }

    const roomId = getActiveRoomId();
    let isCancelled = false;

    const pollSync = async () => {
      const data = await fetchRoomSyncWithTimeout(roomId, 5000, userRef.current?.id);
      if (isCancelled || !data) return;
      if (networkStatus === 'reconnecting' || networkStatus === 'degraded') {
        setNetworkStatus('polling');
      }
      applyRoomSnapshot(data);
    };

    pollSync();
    const interval = setInterval(pollSync, 2000);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [networkStatus, getActiveRoomId, applyRoomSnapshot]);

  // 1. Mobile Foreground Lifecycle Resynchronization (Zero-Freeze Recovery)
  useEffect(() => {
    const handleForegroundSync = async () => {
      soundEngine.resumeAudioContext();
      const roomId = getActiveRoomId();
      try {
        const data = await fetchRoomSyncWithTimeout(roomId, 6000, userRef.current?.id);
        if (data) {
          console.log('⚡ [BingoContext] Fast-forward catch-up on foreground resume:', {
            phase: data.phase,
            roundNumber: data.roundNumber,
            totalDrawn: data.totalDrawn
          });
          applyRoomSnapshot(data);
          socketService.markActivity();
          setNetworkStatus('connected');
        }
      } catch (err) {
        console.warn('Foreground sync notice:', err);
      }
    };

    const unsubResume = socketService.onForegroundResume(handleForegroundSync);
    return () => {
      unsubResume();
    };
  }, [getActiveRoomId, applyRoomSnapshot]);

  // 2. Universal All-Phase Liveness Watchdog (Lobby + Playing + Winner)
  // Ensures countdowns, ball calls, and phase transitions never freeze even with packet drops
  useEffect(() => {
    if (currentPage !== 'bingo' && !hasTicket) return;
    const watchdogInterval = setInterval(async () => {
      const roomId = getActiveRoomId();

      if (roundPhase === 'playing') {
        const elapsedSinceLastBall = Date.now() - lastBallTimeRef.current;
        // Normal cadence is 3.0s. If > 3.8s has elapsed without a ball event:
        if (elapsedSinceLastBall > 3800) {
          console.warn(`⚠️ [Bingo Watchdog] No ball event for ${(elapsedSinceLastBall / 1000).toFixed(1)}s. Running silent sync...`);
          const data = await fetchRoomSyncWithTimeout(roomId, 4000, userRef.current?.id);
          if (data) {
            applyRoomSnapshot(data);
            lastBallTimeRef.current = Date.now();
          }
        }
      } else if (roundPhase === 'lobby') {
        // If lobby timer reaches <= 0 or stops updating for > 3s, verify if round started on server
        if (lobbyCountdown <= 0) {
          const data = await fetchRoomSyncWithTimeout(roomId, 4000, userRef.current?.id);
          if (data && data.phase !== 'lobby') {
            console.log('⚡ [Bingo Watchdog] Lobby ended. Auto-transitioning to active round...');
            applyRoomSnapshot(data);
          }
        }
      } else if (roundPhase === 'winner') {
        // If in winner phase and countdown is 0 or > 8s elapsed, sync to enter lobby
        if (winnerCountdown <= 0) {
          const data = await fetchRoomSyncWithTimeout(roomId, 4000, userRef.current?.id);
          if (data && data.phase !== 'winner') {
            applyRoomSnapshot(data);
          }
        }
      }
    }, 2000);

    return () => clearInterval(watchdogInterval);
  }, [roundPhase, lobbyCountdown, winnerCountdown, getActiveRoomId, applyRoomSnapshot]);

  const toggleVerticalBoard = () => setIsVerticalBoard(prev => !prev);
  const toggleMasterBoard = () => setShowMasterBoard(prev => !prev);
  const openCartelaPicker = () => setIsCartelaPickerOpen(true);
  const closeCartelaPicker = () => setIsCartelaPickerOpen(false);

  const chooseCartelaId = (slotIdx: number, newId: number) => {
    if (hasTicket && roundPhase === 'playing') return;
    const clamped = Math.max(1, Math.min(600, newId));
    setSelectedCartelaIds(prev => {
      const updated = [...prev];
      updated[slotIdx] = clamped;
      if (slotIdx === 0) setCartela1Data(generateCardFromId(clamped));
      else if (slotIdx === 1) setCartela2Data(generateCardFromId(clamped));
      else if (slotIdx === 2) setCartela3Data(generateCardFromId(clamped));
      else if (slotIdx === 3) setCartela4Data(generateCardFromId(clamped));
      return updated;
    });
    soundEngine.playPop();
    showToast(`🎟️ Selected Cartela #${clamped}`);
  };

  const toggleCartelaSelection = (cartelaId: number) => {
    if (hasTicket && roundPhase === 'playing') return;
    if (occupiedCartelaIds.includes(cartelaId)) {
      showToast(`🔒 Cartela #${cartelaId} is already taken in this arena!`);
      return;
    }

    setSelectedCartelaIds(prev => {
      const exists = prev.includes(cartelaId);
      let updated: number[];
      if (exists) {
        // Deselect
        updated = prev.filter(id => id !== cartelaId);
        showToast(`Deselected Cartela #${cartelaId}`);
      } else {
        // Select up to cardQuantity
        if (prev.length < cardQuantity) {
          updated = [...prev, cartelaId];
        } else {
          // Replace oldest
          updated = [...prev.slice(1), cartelaId];
        }
        showToast(`✓ Picked Cartela #${cartelaId}`);
      }

      // Sync data matrices
      setCartela1Data(updated[0] ? generateCardFromId(updated[0]) : []);
      setCartela2Data(updated[1] ? generateCardFromId(updated[1]) : []);
      setCartela3Data(updated[2] ? generateCardFromId(updated[2]) : []);
      setCartela4Data(updated[3] ? generateCardFromId(updated[3]) : []);

      return updated;
    });
    soundEngine.playPop();
  };

  const shuffleCartela = (cardIdx: number = 0) => {
    if (hasTicket && roundPhase === 'playing') return;
    setSelectedCartelaIds(prev => {
      const next = [...prev];
      let newId = Math.floor(1 + Math.random() * 600);
      while (next.includes(newId)) {
        newId = Math.floor(1 + Math.random() * 600);
      }
      next[cardIdx] = newId;

      if (cardIdx === 0) setCartela1Data(generateCardFromId(newId));
      else if (cardIdx === 1) setCartela2Data(generateCardFromId(newId));
      else if (cardIdx === 2) setCartela3Data(generateCardFromId(newId));
      else if (cardIdx === 3) setCartela4Data(generateCardFromId(newId));

      return next;
    });
    soundEngine.playPop();
  };

  const shuffleAllCartelas = (count: number = cardQuantity) => {
    if (hasTicket && roundPhase === 'playing') return;
    const used = new Set<number>();
    const getRandomUnique = () => {
      let id = Math.floor(1 + Math.random() * 600);
      while (used.has(id)) {
        id = Math.floor(1 + Math.random() * 600);
      }
      used.add(id);
      return id;
    };

    const targetCount = Math.max(1, Math.min(4, count));
    const newIds: number[] = [];
    for (let i = 0; i < targetCount; i++) {
      newIds.push(getRandomUnique());
    }

    setSelectedCartelaIds(newIds);
    setCartela1Data(newIds[0] ? generateCardFromId(newIds[0]) : []);
    setCartela2Data(newIds[1] ? generateCardFromId(newIds[1]) : []);
    setCartela3Data(newIds[2] ? generateCardFromId(newIds[2]) : []);
    setCartela4Data(newIds[3] ? generateCardFromId(newIds[3]) : []);

    soundEngine.playPop();
    showToast(count >= 2 ? `🎲 Shuffled Cartelas (#${newIds.join(', #')})` : `🎲 Shuffled to Cartela #${newIds[0]}`);
  };

  const selectSpecificCartela = (cardIdx: number, cartelaId: number) => {
    if (hasTicket && roundPhase === 'playing') return;
    const clamped = Math.max(1, Math.min(600, cartelaId));
    setSelectedCartelaIds(prev => {
      const next = [...prev];
      next[cardIdx] = clamped;
      if (cardIdx === 0) setCartela1Data(generateCardFromId(clamped));
      else if (cardIdx === 1) setCartela2Data(generateCardFromId(clamped));
      else if (cardIdx === 2) setCartela3Data(generateCardFromId(clamped));
      else if (cardIdx === 3) setCartela4Data(generateCardFromId(clamped));
      return next;
    });
    showToast(`🎟️ Selected Cartela #${clamped}`);
  };

  const stopGame = useCallback(() => {
    setGameActive(false);
  }, []);

  const toggleAutoPlay = () => {
    // MID-GAME LOCK: Prevent mode switching while game is in progress
    if (isAutoModeLocked) {
      showToast(
        lang === 'am'
          ? '🔒 ጨዋታው እየተካሄደ ስለሆነ ሞድ መቀየር አይቻልም'
          : '🔒 Mode is locked while game is in progress'
      );
      return;
    }

    const next = !autoPlay;
    setAutoPlay(next);
    autoPlayRef.current = next;
    try {
      localStorage.setItem(AUTOPLAY_STORAGE_KEY, String(next));
    } catch {}

    if (next) {
      // Switched to Auto-Play: auto-daub all numbers already drawn
      setCartela1Data(prev => prev.map(c => (!c.marked && !c.isFree && calledNumbers.includes(c.val as number) ? { ...c, marked: true } : c)));
      setCartela2Data(prev => prev.map(c => (!c.marked && !c.isFree && calledNumbers.includes(c.val as number) ? { ...c, marked: true } : c)));
      setCartela3Data(prev => prev.map(c => (!c.marked && !c.isFree && calledNumbers.includes(c.val as number) ? { ...c, marked: true } : c)));
      setCartela4Data(prev => prev.map(c => (!c.marked && !c.isFree && calledNumbers.includes(c.val as number) ? { ...c, marked: true } : c)));
      showToast('⚡ Auto-Play Activated');
    } else {
      showToast('✋ Manual Mode Activated');
    }

    if (user?.id) {
      socketService.updatePlayerMode(getActiveRoomId(), user.id, next);
    }
  };

  // Buy Ticket via Live Socket Engine & Neon DB with Anytime Pre-Betting
  const buyTicket = async () => {
    if (selectedCartelaIds.filter(id => id > 0).length < cardQuantity) {
      showToast('🎟️ Please select your cartela board(s) first!');
      openCartelaPicker();
      return;
    }
    const roomId = getActiveRoomId();
    const activeIds = selectedCartelaIds.slice(0, totalPlayableCards);
    const totalCost = betAmount * cardQuantity;

    // Check available funds (balance + bonus)
    const totalFunds = balance + bonus;
    if (totalFunds < totalCost) {
      setInsufficientBalanceDetails({
        required: totalCost,
        balance: totalFunds,
        shortfall: totalCost - totalFunds
      });
      setShowInsufficientBalanceModal(true);
      return;
    }

    // Send to live server with chosen isAutoPlay mode
    if (user?.id) {
      const res = await socketService.buyTicket(roomId, user.id, user.fullName, activeIds, betAmount, autoPlayRef.current);
      if (!res.success) {
        showToast(`❌ ${res.error || 'Ticket purchase failed'}`);
        return;
      }
      if (res.tickets && res.tickets.length > 0) {
        const newIds = res.tickets.map((t: any) => t.cartelaId);
        const updatedIds: number[] = [
          newIds[0] || selectedCartelaIds[0],
          newIds[1] || selectedCartelaIds[1],
          newIds[2] || selectedCartelaIds[2],
          newIds[3] || selectedCartelaIds[3]
        ].filter(Boolean);
        setSelectedCartelaIds(updatedIds);
        if (res.tickets[0]) setCartela1Data(res.tickets[0].cardMatrix);
        if (res.tickets[1]) setCartela2Data(res.tickets[1].cardMatrix);
        if (res.tickets[2]) setCartela3Data(res.tickets[2].cardMatrix);
        if (res.tickets[3]) setCartela4Data(res.tickets[3].cardMatrix);
      }

      if (res.preBoughtForNextRound) {
        setHasPreBoughtNext(true);
        soundEngine.playLuckyPick();
        refreshBalance();
        showToast(`🎟️ Ticket Pre-Bought for Upcoming Round ✓`);
        return;
      }
    } else {
      // Local fallback
      const success = deductBalance(totalCost);
      if (!success) {
        setInsufficientBalanceDetails({
          required: totalCost,
          balance: totalFunds,
          shortfall: totalCost - totalFunds
        });
        setShowInsufficientBalanceModal(true);
        return;
      }
      if (roundPhase !== 'lobby') {
        setHasPreBoughtNext(true);
        showToast('🎟️ Pre-Bought for next round!');
        return;
      }
    }

    setHasTicket(true);
    setGameActive(true);
    setPrizePool(prev => Math.max(prev, betAmount * cardQuantity, prev + (roundPhase === 'lobby' ? betAmount * cardQuantity : 0)));
    setRealPlayerCount(prev => Math.max(cardQuantity, prev + (roundPhase === 'lobby' ? cardQuantity : 0)));
    refreshBalance();

    // Persist active ticket session so app reload / close does not lose ticket or money
    try {
      localStorage.setItem(ACTIVE_TICKET_STORAGE_KEY, JSON.stringify({
        roomId,
        betAmount,
        cardQuantity,
        selectedCartelaIds: activeIds,
        timestamp: Date.now(),
        roundNumber: roundNumberRef.current,
        isAutoPlay: autoPlayRef.current
      }));
    } catch {}

    // If joining during playing phase, auto-daub any numbers already drawn ONLY if Auto-Play is active
    if (autoPlayRef.current && calledNumbers.length > 0) {
      setCartela1Data(prev => prev.map(c => (!c.marked && !c.isFree && calledNumbers.includes(c.val as number) ? { ...c, marked: true } : c)));
      setCartela2Data(prev => prev.map(c => (!c.marked && !c.isFree && calledNumbers.includes(c.val as number) ? { ...c, marked: true } : c)));
      setCartela3Data(prev => prev.map(c => (!c.marked && !c.isFree && calledNumbers.includes(c.val as number) ? { ...c, marked: true } : c)));
      setCartela4Data(prev => prev.map(c => (!c.marked && !c.isFree && calledNumbers.includes(c.val as number) ? { ...c, marked: true } : c)));
    }

    soundEngine.playLuckyPick();
    showToast(`🎟️ Playing ${totalPlayableCards} Cartela${totalPlayableCards > 1 ? 's' : ''} (${totalCost} ETB)!`);
  };

  const preBuyNextRound = async () => {
    const totalCost = betAmount * cardQuantity;
    const totalFunds = balance + bonus;
    if (totalFunds < totalCost) {
      setInsufficientBalanceDetails({
        required: totalCost,
        balance: totalFunds,
        shortfall: totalCost - totalFunds
      });
      setShowInsufficientBalanceModal(true);
      return;
    }

    if (user?.id) {
      const roomId = getActiveRoomId();
      const activeIds = selectedCartelaIds.slice(0, totalPlayableCards);
      const res = await socketService.buyTicket(roomId, user.id, user.fullName, activeIds, betAmount, autoPlayRef.current);
      if (!res.success) {
        showToast(`❌ ${res.error || 'Pre-buy failed'}`);
        return;
      }
      if (res.tickets && res.tickets.length > 0) {
        const newIds = res.tickets.map((t: any) => t.cartelaId);
        const updatedIds: number[] = [
          newIds[0] || selectedCartelaIds[0],
          newIds[1] || selectedCartelaIds[1],
          newIds[2] || selectedCartelaIds[2],
          newIds[3] || selectedCartelaIds[3]
        ].filter(Boolean);
        setSelectedCartelaIds(updatedIds);
        if (res.tickets[0]) setCartela1Data(res.tickets[0].cardMatrix);
        if (res.tickets[1]) setCartela2Data(res.tickets[1].cardMatrix);
        if (res.tickets[2]) setCartela3Data(res.tickets[2].cardMatrix);
        if (res.tickets[3]) setCartela4Data(res.tickets[3].cardMatrix);
      }
    } else {
      const success = deductBalance(totalCost);
      if (!success) {
        setInsufficientBalanceDetails({
          required: totalCost,
          balance: totalFunds,
          shortfall: totalCost - totalFunds
        });
        setShowInsufficientBalanceModal(true);
        return;
      }
    }

    setHasPreBoughtNext(true);
    soundEngine.playLuckyPick();
    refreshBalance();
    showToast(`🎟️ Pre-Bought ${totalPlayableCards} Cartelas for next round! ✓`);
  };

  // Safe Voluntary Lobby Exit / Disconnect Refund
  const cancelLobbyTicket = async (): Promise<boolean> => {
    if (!hasTicket && !hasPreBoughtNext) return false;
    const refundAmount = betAmount * cardQuantity;
    let refunded = false;

    if (userRef.current?.id) {
      try {
        const roomId = getActiveRoomId();
        const res = await socketService.cancelTicketLobby(roomId, userRef.current.id);
        if (res.success) {
          refunded = true;
        }
      } catch (err) {
        console.warn('Error cancelling lobby ticket:', err);
      }
    }

    if (!refunded) {
      addBalanceRef.current(refundAmount);
    }

    setHasTicket(false);
    setHasPreBoughtNext(false);
    try {
      localStorage.removeItem(ACTIVE_TICKET_STORAGE_KEY);
    } catch {}
    refreshBalanceRef.current();
    showToast(`💸 ${refundAmount} ETB refunded to your wallet!`);
    return true;
  };

  // Manual Daubing with 300ms double-tap debounce & session persistence
  const handleManualDaub = (cartelaIdx: number, cellIdx: number) => {
    const clickKey = `${cartelaIdx}_${cellIdx}`;
    const now = Date.now();
    const lastClick = lastDaubClickTimeRef.current[clickKey] || 0;
    if (now - lastClick < 300) {
      // Rapid double click debounce: avoid accidental un-marking
      return;
    }
    lastDaubClickTimeRef.current[clickKey] = now;

    const targetData = cartelaIdx === 0 ? cartela1Data : cartelaIdx === 1 ? cartela2Data : cartelaIdx === 2 ? cartela3Data : cartela4Data;
    const setTargetData = cartelaIdx === 0 ? setCartela1Data : cartelaIdx === 1 ? setCartela2Data : cartelaIdx === 2 ? setCartela3Data : setCartela4Data;
    const cell = targetData[cellIdx];
    const cartelaId = selectedCartelaIds[cartelaIdx];

    if (!cell || cell.isFree) return;

    if (cell.marked) {
      if (cartelaId && manualDaubedCellsRef.current[cartelaId]) {
        manualDaubedCellsRef.current[cartelaId].delete(cellIdx);
      }
      saveManualMarks(roundNumberRef.current);
      const newCells = [...targetData];
      newCells[cellIdx] = { ...cell, marked: false };
      setTargetData(newCells);
    } else {
      if (calledNumbers.includes(cell.val as number)) {
        if (cartelaId) {
          if (!manualDaubedCellsRef.current[cartelaId]) {
            manualDaubedCellsRef.current[cartelaId] = new Set();
          }
          manualDaubedCellsRef.current[cartelaId].add(cellIdx);
        }
        saveManualMarks(roundNumberRef.current);
        const newCells = [...targetData];
        newCells[cellIdx] = { ...cell, marked: true };
        setTargetData(newCells);
        soundEngine.playDaub();

        // In manual mode, completing a line does NOT auto-claim: player must click the in-game BINGO button!
        const winLine = checkWinningPatterns(newCells);
        if (winLine && winLine.length > 0) {
          const isCurrentBall = typeof cell.val === 'number' && cell.val === currentCall?.num;
          if (isCurrentBall) {
            console.log(`🎉 [ManualDaub] Winning line completed on Cartela #${selectedCartelaIds[cartelaIdx]} on active ball! Ready for manual claim via BINGO button.`);
          } else {
            console.log(`⚠️ [ManualDaub] Pattern marked on Cartela #${selectedCartelaIds[cartelaIdx]} for a past number.`);
          }
        }
      } else {
        showToast(`⚠️ ${cell.colLetter}-${cell.val} has not been called yet!`);
      }
    }
  };

  // Claim BINGO to Server Engine with in-flight debounce lock
  const claimBingo = async (overrideCardIdx?: number, overrideCells?: BingoCell[]) => {
    if (isClaimingRef.current || claimInProgress) {
      console.log('⚡ [BingoContext] Claim already in flight — ignoring duplicate click');
      return;
    }

    const c1 = overrideCardIdx === 0 && overrideCells ? overrideCells : cartela1Data;
    const c2 = overrideCardIdx === 1 && overrideCells ? overrideCells : cartela2Data;
    const c3 = overrideCardIdx === 2 && overrideCells ? overrideCells : cartela3Data;

    const currentNum = currentCall?.num ?? null;
    let activeWinCardIdx: number = -1;
    let detectedWinningLine: number[] = [];

    if (autoPlay) {
      const win1 = checkWinningPatterns(c1);
      const win2 = totalPlayableCards >= 2 ? checkWinningPatterns(c2) : null;
      const win3 = totalPlayableCards >= 3 ? checkWinningPatterns(c3) : null;
      if (win1) { activeWinCardIdx = 0; detectedWinningLine = win1; }
      else if (win2) { activeWinCardIdx = 1; detectedWinningLine = win2; }
      else if (win3) { activeWinCardIdx = 2; detectedWinningLine = win3; }
    } else {
      const eligibleBalls = typeof currentCall?.num === 'number' && currentCall.num > 0 ? [currentCall.num] : [];
      const active1 = getActiveWinningPatternOnBall(c1, eligibleBalls);
      const active2 = totalPlayableCards >= 2 ? getActiveWinningPatternOnBall(c2, eligibleBalls) : null;
      const active3 = totalPlayableCards >= 3 ? getActiveWinningPatternOnBall(c3, eligibleBalls) : null;
      if (active1) { activeWinCardIdx = 0; detectedWinningLine = active1; }
      else if (active2) { activeWinCardIdx = 1; detectedWinningLine = active2; }
      else if (active3) { activeWinCardIdx = 2; detectedWinningLine = active3; }
      else {
        // Player clicked BINGO in manual mode, but no pattern is active on the current ball
        const any1 = checkWinningPatterns(c1);
        const any2 = totalPlayableCards >= 2 ? checkWinningPatterns(c2) : null;
        const any3 = totalPlayableCards >= 3 ? checkWinningPatterns(c3) : null;
        if (any1 || any2 || any3) {
          showToast("⚠️ Missed Bingo! That pattern expired because the next number was called. Keep playing to complete a new pattern!");
        } else {
          showToast("Complete any 5-in-a-row line on your card to call BINGO!");
        }
        isClaimingRef.current = false;
        setClaimInProgress(false);
        return;
      }
    }

    if (activeWinCardIdx !== -1) {
      isClaimingRef.current = true;
      setClaimInProgress(true);

      const winningCartelaId = selectedCartelaIds[activeWinCardIdx];
      const roomId = getActiveRoomId();

      if (user?.id) {
        try {
          const res = await socketService.claimBingo(roomId, user.id, user.fullName, winningCartelaId);
          if (!res.success) {
            showToast(`⚠️ ${res.message}`);
            isClaimingRef.current = false;
            setClaimInProgress(false);
            return;
          }

          const winData = res.winResult;
          lastLiveWinRoundRef.current = winData?.roundNumber || roundNumberRef.current;
          const totalPot = winData?.totalPot || prizePool;
          const winnerPayout = winData?.winnerPayout || totalPot;
          const userShare = winData?.sharePerWinner || winData?.userShare || winnerPayout;

          const houseFee = Number(winData?.houseFee || 0);
          const netPrizePot = Number(winData?.netPrizePot || winnerPayout);

          setWinResult({
            winType: winData?.isSplit ? 'user_split' : 'user_solo',
            winningCartelaNumber: winningCartelaId,
            winningLine: detectedWinningLine,
            winnerName: user.fullName || 'እርስዎ (You)',
            coWinners: Array.isArray(winData?.coWinners) ? winData.coWinners : [],
            totalPot: totalPot,
            userShare: userShare,
            winnerPayout: winnerPayout,
            stakeAmount: betAmount,
            houseFee: houseFee,
            netPrizePot: netPrizePot
          });
          setShowWinModal(true);
          soundEngine.playWinFanfare();
          isClaimingRef.current = false;
          setClaimInProgress(false);
        } catch (e) {
          console.error('Error in claimBingo:', e);
          isClaimingRef.current = false;
          setClaimInProgress(false);
        }
        return;
      }

      setWinResult({
        winType: 'user_solo',
        winningCartelaNumber: winningCartelaId,
        winningLine: detectedWinningLine,
        winnerName: 'እርስዎ (You)',
        coWinners: [],
        totalPot: prizePool,
        userShare: prizePool,
        winnerPayout: prizePool,
        stakeAmount: betAmount,
        houseFee: 0,
        netPrizePot: prizePool
      });
      setShowWinModal(true);
      soundEngine.playWinFanfare();
      isClaimingRef.current = false;
      setClaimInProgress(false);
    } else {
      soundEngine.playPop();
      showToast('⚠️ Pattern not complete yet! Keep daubing!');
      isClaimingRef.current = false;
      setClaimInProgress(false);
    }
  };

  const closeWinModalAndRestart = () => {
    isClaimingRef.current = false;
    setClaimInProgress(false);
    winModalDismissedForRoundRef.current = roundNumberRef.current || roundNumber;
    activeWinModalRoundRef.current = null;
    setShowWinModal(false);
    setWinResult(null);
    setHasTicket(false);
  };

  const startLobbyCountdown = () => {
    // Controlled by server
  };

  return (
    <BingoContext.Provider
      value={{
        roundPhase,
        lobbyCountdown,
        winnerCountdown,
        betAmount,
        setBetAmount,
        jackpotPool,
        cardQuantity,
        setCardQuantity,
        hasTicket,
        hasPreBoughtNext,
        buyTicket,
        preBuyNextRound,
        stakeRoomsSummary,
        selectedCartelaIds,
        setSelectedCartelaIds,
        hasSelectedCartelas,
        hasWinningPattern,
        hasSleptPattern,
        isCartelaPickerOpen,
        openCartelaPicker,
        closeCartelaPicker,
        chooseCartelaId,
        toggleCartelaSelection,
        occupiedCartelaIds,
        gameActive,
        cartela1Data,
        cartela2Data,
        cartela3Data,
        cartela4Data,
        totalPlayableCards,
        activeCartelaIndex,
        setActiveCartelaIndex,
        currentCall,
        previousCall,
        calledNumbers,
        autoPlay,
        isAutoModeLocked,
        toggleAutoPlay,
        playersCount,
        prizePool,
        totalPot,
        opponents,
        canWin,
        winResult,
        showWinModal,
        spherePop,
        isVerticalBoard,
        toggleVerticalBoard,
        showMasterBoard,
        toggleMasterBoard,
        isMuted,
        toggleMute,
        waitingForPlayers,
        waitingForOtherHouses,
        roomMode,
        realPlayerCount,
        activeUsersCount,
        joinFeed,
        startLobbyCountdown,
        claimInProgress,
        handleManualDaub,
        claimBingo,
        closeWinModalAndRestart,
        stopGame,
        shuffleCartela,
        shuffleAllCartelas,
        selectSpecificCartela,
        networkStatus,
        networkLatency,
        offlineWinsNotice,
        dismissOfflineWin,
        triggerManualSync,
        isSyncing,
        cancelLobbyTicket,
        showInsufficientBalanceModal,
        setShowInsufficientBalanceModal,
        insufficientBalanceDetails
      }}
    >
      {children}
    </BingoContext.Provider>
  );
};

export const useBingo = (): BingoContextType => {
  const context = useContext(BingoContext);
  if (!context) throw new Error('useBingo must be used within a BingoProvider');
  return context;
};
