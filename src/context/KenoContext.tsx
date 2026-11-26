/**
 * src/context/KenoContext.tsx
 * Real Production Keno Context for Sonic Bingo Mini-App
 * Strictly active only when user is on 'keno' page (room-scoped Socket.IO 'keno_room').
 * Wired to Real Account Money (WalletContext) • Real Auth Session (AuthContext) • Zero Bingo Interference.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode
} from 'react';
import { Socket } from 'socket.io-client';
import { socketService } from '../services/socketService.ts';
import { apiClient } from '../services/apiClient.ts';
import { kenoAudio } from '../components/keno/WebAudioEngine.ts';
import { useWallet } from './WalletContext.tsx';
import { useAuth } from './AuthContext.tsx';
import { useApp } from './AppContext.tsx';

export type KenoPhase = 'betting' | 'drawing' | 'settling' | 'settlement';

export const KENO_MIN_BET = 2;
export const KENO_MAX_TICKET_BET = 500;
export const KENO_MAX_ROUND_BET = 1000;

export interface KenoTicket {
  ticketDbId?: string;
  id?: string;
  ticketId: string;
  roundNumber: number;
  userId: string;
  selectedNumbers: number[];
  spotCount: number;
  betAmount: number;
  isBonus: boolean;
  hitNumbers?: number[];
  hitCount?: number;
  multiplier?: number;
  payoutAmount?: number;
  winAmount?: number;
  status: 'active' | 'won' | 'lost';
  createdAt: number;
}

export interface HotColdStats {
  hotNumbers: number[];
  coldNumbers: number[];
  frequencyMap: Record<number, number>;
}

export interface KenoContextValue {
  roundNumber: number;
  phase: KenoPhase;
  timeRemaining: number;
  serverSeedHash: string;
  drawnBalls: number[];
  currentDrawnBall: number | null;

  selectedNumbers: Set<number>;
  stake: number;
  activeTickets: KenoTicket[];
  allRoomTickets: KenoTicket[];
  balance: number;
  bonus: number;
  userId: string;
  userDisplayId: string;
  isAuthenticated: boolean;

  hotNumbers: number[];
  coldNumbers: number[];
  frequencyMap: Record<number, number>;

  lastSettlement: any | null;
  lastWinAmount: number;
  isPlacingBet: boolean;

  isRulesModalOpen: boolean;
  rulesModalTab: 'rules' | 'fairness';

  toggleNumber: (num: number) => void;
  quickPick: (count: number) => void;
  clearSelection: () => void;
  setStake: (amt: number) => void;
  adjustStake: (delta: number) => void;
  doubleStake: () => void;
  maxStake: () => void;
  placeBet: () => Promise<{ success: boolean; error?: string; ticket?: KenoTicket }>;
  openDeposit: () => void;
  openRulesModal: (tab?: 'rules' | 'fairness') => void;
  closeRulesModal: () => void;
  switchRulesTab: (tab: 'rules' | 'fairness') => void;
  refreshStats: () => Promise<void>;
  verifyRound: (payload: {
    serverSeed: string;
    expectedHash: string;
    clientSeed: string;
    nonce: number;
    expectedDrawn: number[];
  }) => Promise<{ valid: boolean; error?: string; calculatedDrawn?: number[] }>;
}

const KenoContext = createContext<KenoContextValue | null>(null);

export const KenoProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const { balance: walletBalance, bonus: walletBonus, deductBalance, deductBonus, addBalance, refreshBalance } = useWallet();
  const { currentPage, switchPage, showToast } = useApp();

  const refreshBalanceRef = useRef(refreshBalance);
  refreshBalanceRef.current = refreshBalance;
  const addBalanceRef = useRef(addBalance);
  addBalanceRef.current = addBalance;

  const isKenoActive = currentPage === 'keno';

  const userId = user?.id || (typeof window !== 'undefined' ? localStorage.getItem('sonic_user_id') : '') || '';
  const userDisplayId = user?.publicId
    ? String(user.publicId)
    : user?.telegramId
      ? String(user.telegramId).slice(-6)
      : user?.phone
        ? user.phone
        : (user?.id ? user.id.slice(0, 8) : '600001');

  const [roundNumber, setRoundNumber] = useState<number>(1);
  const [phase, setPhase] = useState<KenoPhase>('betting');
  const [timeRemaining, setTimeRemaining] = useState<number>(30);
  const [serverSeedHash, setServerSeedHash] = useState<string>('');
  const [drawnBalls, setDrawnBalls] = useState<number[]>([]);
  const [currentDrawnBall, setCurrentDrawnBall] = useState<number | null>(null);

  const [selectedNumbers, setSelectedNumbers] = useState<Set<number>>(new Set());
  const selectedNumbersRef = useRef<Set<number>>(selectedNumbers);
  selectedNumbersRef.current = selectedNumbers;
  const hitsCountRef = useRef<number>(0);

  const [stake, setStakeState] = useState<number>(2.0);
  const [activeTickets, setActiveTickets] = useState<KenoTicket[]>([]);
  const [allRoomTickets, setAllRoomTickets] = useState<KenoTicket[]>([]);

  const [hotNumbers, setHotNumbers] = useState<number[]>([]);
  const [coldNumbers, setColdNumbers] = useState<number[]>([]);
  const [frequencyMap, setFrequencyMap] = useState<Record<number, number>>({});

  const [lastSettlement, setLastSettlement] = useState<any | null>(null);
  const [lastWinAmount, setLastWinAmount] = useState<number>(0);
  const [isPlacingBet, setIsPlacingBet] = useState<boolean>(false);
  const [connStatus, setConnStatus] = useState<string>('connected');

  const isPlacingBetRef = useRef<boolean>(false);
  const lastEventAtRef = useRef<number>(Date.now());
  const zeroTickSinceRef = useRef<number>(0);
  const shownAwayRoundRef = useRef<number>(0);
  const phaseRef = useRef<KenoPhase>('betting');
  phaseRef.current = phase;
  const timeRemainingRef = useRef<number>(30);
  timeRemainingRef.current = timeRemaining;

  const [isRulesModalOpen, setIsRulesModalOpen] = useState<boolean>(false);
  const [rulesModalTab, setRulesModalTab] = useState<'rules' | 'fairness'>('rules');

  const refreshStats = useCallback(async () => {
    try {
      const res = await apiClient.keno.getStats();
      if (res?.success && res.stats) {
        setHotNumbers(res.stats.hotNumbers || []);
        setColdNumbers(res.stats.coldNumbers || []);
        setFrequencyMap(res.stats.frequencyMap || {});
      }
    } catch {
      // Socket init_state / round_settled fallback handles updates
    }
  }, []);

  // Refresh wallet balance & initial hot/cold statistics when player enters the Keno screen
  useEffect(() => {
    if (isKenoActive) {
      refreshBalance();
      void refreshStats();
    }
  }, [isKenoActive, refreshBalance, refreshStats]);

  const applyKenoSnapshot = useCallback((data: any) => {
    if (!data) return;
    lastEventAtRef.current = Date.now();
    if (data.roundNumber) setRoundNumber(data.roundNumber);
    if (data.phase) {
      const normalizedPhase: KenoPhase = data.phase === 'settling' ? 'settlement' : data.phase;
      setPhase(normalizedPhase);
      if (normalizedPhase !== 'betting') {
        zeroTickSinceRef.current = 0;
      }
    }
    if (typeof data.timeRemaining === 'number') {
      setTimeRemaining(data.timeRemaining);
      if (data.timeRemaining > 0) zeroTickSinceRef.current = 0;
    }
    if (data.serverSeedHash) setServerSeedHash(data.serverSeedHash);
    if (Array.isArray(data.drawnBalls)) {
      setDrawnBalls(data.drawnBalls);
      if (data.drawnBalls.length > 0) {
        setCurrentDrawnBall(data.drawnBalls[data.drawnBalls.length - 1]);
      } else {
        setCurrentDrawnBall(null);
      }
    }
    if (data.hotCold) {
      setHotNumbers(data.hotCold.hotNumbers || []);
      setColdNumbers(data.hotCold.coldNumbers || []);
      setFrequencyMap(data.hotCold.frequencyMap || {});
    }
    if (Array.isArray(data.userTickets)) {
      setActiveTickets(data.userTickets);
      const settledWin = data.userTickets.reduce((sum: number, t: any) => sum + Number(t.payoutAmount || 0), 0);
      if (settledWin > 0) {
        setLastWinAmount(settledWin);
      }
    }
    if (Array.isArray(data.allActiveTickets)) {
      setAllRoomTickets(data.allActiveTickets);
    }
    if (data.recentAwaySettlement && data.recentAwaySettlement.roundNumber !== shownAwayRoundRef.current) {
      const away = data.recentAwaySettlement;
      shownAwayRoundRef.current = away.roundNumber;
      if (away.totalWin > 0) {
        showToast(`🎉 Keno Round #${away.roundNumber} won while away: +${away.totalWin.toFixed(2)} ETB!`);
      } else {
        showToast(`🎰 Keno Round #${away.roundNumber} finished while away — Try Again!`);
      }
      refreshBalanceRef.current();
    }
  }, [showToast]);

  const syncFromHttp = useCallback(async (wakeActive = false) => {
    try {
      const res = await apiClient.keno.getState(userId || undefined, wakeActive);
      if (res?.success) {
        applyKenoSnapshot(res);
      }
    } catch {
      // Transient HTTP error ignored; next socket tick or retry recovers
    }
  }, [userId, applyKenoSnapshot]);

  // Connect & join 'keno_room' ONLY when currentPage === 'keno'; leave cleanly on exit
  useEffect(() => {
    if (!isKenoActive) return;

    const socket: Socket = socketService.connect();

    const handleConnect = () => {
      lastEventAtRef.current = Date.now();
      socket.emit('keno:join', { userId });
    };

    // Always attach 'connect' listener even when already connected so mobile reconnects never lose 'keno_room'
    socket.on('connect', handleConnect);
    if (socket.connected) {
      handleConnect();
    }

    const unsubForeground = socketService.onForegroundResume(() => {
      handleConnect();
      void syncFromHttp(true);
    });
    const unsubStatus = socketService.onConnectionStatusChange((status) => {
      setConnStatus(status);
    });

    const onInitState = (data: any) => {
      applyKenoSnapshot(data);
    };

    const onRoundStarted = (data: any) => {
      lastEventAtRef.current = Date.now();
      zeroTickSinceRef.current = 0;
      setRoundNumber(data.roundNumber);
      setPhase('betting');
      setTimeRemaining(data.timeRemaining || 30);
      setServerSeedHash(data.serverSeedHash || '');
      setDrawnBalls([]);
      setCurrentDrawnBall(null);
      setActiveTickets([]);
      setAllRoomTickets([]);
      setSelectedNumbers(new Set());
      setLastSettlement(null);
      setLastWinAmount(0);
      hitsCountRef.current = 0;
    };

    const onTick = (data: any) => {
      lastEventAtRef.current = Date.now();
      if (data.roundNumber) setRoundNumber(data.roundNumber);
      if (data.phase) setPhase(data.phase === 'settling' ? 'settlement' : data.phase);
      if (typeof data.timeRemaining === 'number') {
        setTimeRemaining(data.timeRemaining);
        if (data.timeRemaining <= 0) {
          if (!zeroTickSinceRef.current) zeroTickSinceRef.current = Date.now();
        } else {
          zeroTickSinceRef.current = 0;
        }
        if (data.phase === 'betting' && data.timeRemaining <= 3 && data.timeRemaining > 0) {
          kenoAudio.playTick();
        }
      }
    };

    const onDrawStarted = (data: any) => {
      lastEventAtRef.current = Date.now();
      zeroTickSinceRef.current = 0;
      if (data.roundNumber) setRoundNumber(data.roundNumber);
      setPhase('drawing');
      setDrawnBalls([]);
      setCurrentDrawnBall(null);
      hitsCountRef.current = 0;
    };

    const onBallDrawn = (data: any) => {
      lastEventAtRef.current = Date.now();
      const ball = data.ball ?? data.ballNumber;
      if (typeof ball === 'number') {
        setCurrentDrawnBall(ball);
        setDrawnBalls(prev => (prev.includes(ball) ? prev : [...prev, ball]));

        const isHit = selectedNumbersRef.current.has(ball);
        if (isHit) {
          hitsCountRef.current += 1;
          kenoAudio.playMatchChime(hitsCountRef.current);
        } else {
          kenoAudio.playBallPop();
        }
      }
    };

    const onRoundSettled = (data: any) => {
      lastEventAtRef.current = Date.now();
      zeroTickSinceRef.current = 0;
      setPhase('settlement');
      if (data.drawnNumbers) setDrawnBalls(data.drawnNumbers);
      setLastSettlement(data);
      if (data.hotCold) {
        setHotNumbers(data.hotCold.hotNumbers || []);
        setColdNumbers(data.hotCold.coldNumbers || []);
        setFrequencyMap(data.hotCold.frequencyMap || {});
      }
      refreshBalanceRef.current();
    };

    const onPlayerSettled = (data: any) => {
      if (data.userId === userId) {
        setLastWinAmount(data.userTotalWin || 0);
        if (data.userTotalWin > 0) {
          kenoAudio.playWinFanfare();
          addBalanceRef.current(data.userTotalWin);
          refreshBalanceRef.current();
        }
        if (data.tickets) {
          setActiveTickets(data.tickets);
        }
      }
    };

    const onTicketPlaced = (data: any) => {
      if (data?.ticket) {
        setAllRoomTickets(prev => {
          if (prev.some(t => t.ticketId === data.ticket.ticketId)) return prev;
          return [data.ticket, ...prev];
        });
      }
    };

    socket.on('keno:init_state', onInitState);
    socket.on('keno:round_started', onRoundStarted);
    socket.on('keno:tick', onTick);
    socket.on('keno:draw_started', onDrawStarted);
    socket.on('keno:ball_drawn', onBallDrawn);
    socket.on('keno:ticket_placed', onTicketPlaced);
    socket.on('keno:round_settled', onRoundSettled);
    socket.on('keno:player_settled', onPlayerSettled);

    // Client-side stall watchdog: auto-recovers via HTTP /api/keno/state if a round phase hangs
    const stallWatchdog = setInterval(() => {
      const now = Date.now();
      if (phaseRef.current === 'betting' && timeRemainingRef.current <= 0) {
        if (!zeroTickSinceRef.current) zeroTickSinceRef.current = now;
        if (now - zeroTickSinceRef.current > 3000) {
          zeroTickSinceRef.current = now;
          void syncFromHttp(true);
        }
      } else if (phaseRef.current === 'drawing' && now - lastEventAtRef.current > 4000) {
        lastEventAtRef.current = now;
        void syncFromHttp(true);
      } else if (phaseRef.current === 'settlement' && now - lastEventAtRef.current > 8500) {
        lastEventAtRef.current = now;
        void syncFromHttp(true);
      }
    }, 1500);

    return () => {
      clearInterval(stallWatchdog);
      unsubForeground();
      unsubStatus();
      socket.emit('keno:leave');
      socket.off('connect', handleConnect);
      socket.off('keno:init_state', onInitState);
      socket.off('keno:round_started', onRoundStarted);
      socket.off('keno:tick', onTick);
      socket.off('keno:draw_started', onDrawStarted);
      socket.off('keno:ball_drawn', onBallDrawn);
      socket.off('keno:ticket_placed', onTicketPlaced);
      socket.off('keno:round_settled', onRoundSettled);
      socket.off('keno:player_settled', onPlayerSettled);
    };
  }, [isKenoActive, userId, applyKenoSnapshot, syncFromHttp]);

  // Dual-engine HTTP fallback polling strictly while socket is reconnecting/degraded/polling
  useEffect(() => {
    if (!isKenoActive) return;
    if (connStatus !== 'reconnecting' && connStatus !== 'degraded' && connStatus !== 'polling') {
      return;
    }
    void syncFromHttp(true);
    const poll = setInterval(() => {
      void syncFromHttp(true);
    }, 2500);
    return () => clearInterval(poll);
  }, [isKenoActive, connStatus, syncFromHttp]);

  const toggleNumber = useCallback((num: number) => {
    if (phase !== 'betting') return;
    setSelectedNumbers(prev => {
      const next = new Set(prev);
      if (next.has(num)) {
        next.delete(num);
      } else {
        if (next.size >= 10) {
          showToast('Maximum 10 numbers allowed');
          return prev;
        }
        next.add(num);
      }
      return next;
    });
  }, [phase, showToast]);

  const quickPick = useCallback((count: number) => {
    if (phase !== 'betting') return;
    const clamped = Math.max(1, Math.min(10, count));
    const pool = Array.from({ length: 80 }, (_, i) => i + 1);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    setSelectedNumbers(new Set(pool.slice(0, clamped)));
  }, [phase]);

  const clearSelection = useCallback(() => {
    if (phase !== 'betting') return;
    setSelectedNumbers(new Set());
  }, [phase]);

  const setStake = useCallback((amt: number) => {
    const parsed = Number(amt);
    if (!Number.isFinite(parsed)) return;
    const rounded = Number(parsed.toFixed(2));
    setStakeState(Math.max(KENO_MIN_BET, Math.min(KENO_MAX_TICKET_BET, rounded)));
  }, []);

  const adjustStake = useCallback((delta: number) => {
    setStakeState(prev => Math.max(KENO_MIN_BET, Math.min(KENO_MAX_TICKET_BET, Number((prev + delta).toFixed(2)))));
  }, []);

  const doubleStake = useCallback(() => {
    setStakeState(prev => Math.max(KENO_MIN_BET, Math.min(KENO_MAX_TICKET_BET, Number((prev * 2).toFixed(2)))));
  }, []);

  const maxStake = useCallback(() => {
    const totalPlayable = walletBalance + walletBonus;
    const currentRoundStaked = activeTickets.reduce((sum, t) => sum + Number(t.betAmount || 0), 0);
    const remainingRoundAllowance = Math.max(0, KENO_MAX_ROUND_BET - currentRoundStaked);
    const effectiveCap = remainingRoundAllowance > 0
      ? Math.min(KENO_MAX_TICKET_BET, totalPlayable, remainingRoundAllowance)
      : Math.min(KENO_MAX_TICKET_BET, totalPlayable);
    setStakeState(() => Math.max(KENO_MIN_BET, Math.min(KENO_MAX_TICKET_BET, Math.floor(effectiveCap))));
  }, [walletBalance, walletBonus, activeTickets]);

  const openDeposit = useCallback(() => {
    switchPage('deposit');
  }, [switchPage]);

  const placeBet = useCallback(async (): Promise<{ success: boolean; error?: string; ticket?: KenoTicket }> => {
    if (phase !== 'betting') {
      return { success: false, error: 'Betting is closed for this round' };
    }
    if (selectedNumbers.size === 0) {
      return { success: false, error: 'Please select 1 to 10 numbers' };
    }
    if (!Number.isFinite(stake) || stake < KENO_MIN_BET || stake > KENO_MAX_TICKET_BET) {
      return { success: false, error: `Stake must be between ${KENO_MIN_BET} and ${KENO_MAX_TICKET_BET} ETB` };
    }

    const currentRoundStaked = activeTickets.reduce((sum, t) => sum + Number(t.betAmount || 0), 0);
    if (currentRoundStaked + stake > KENO_MAX_ROUND_BET) {
      const remaining = Math.max(0, KENO_MAX_ROUND_BET - currentRoundStaked);
      return {
        success: false,
        error: `Max ${KENO_MAX_ROUND_BET} ETB per round reached (Remaining: ${remaining.toFixed(2)} ETB)`
      };
    }

    const totalPlayable = Number((walletBalance + walletBonus).toFixed(2));
    if (totalPlayable < stake) {
      showToast(`Insufficient balance (${totalPlayable.toFixed(2)} < ${stake.toFixed(2)} ETB)`);
      return { success: false, error: 'Insufficient balance' };
    }

    if (isPlacingBetRef.current) {
      return { success: false, error: 'Bet is already confirming, please wait...' };
    }

    const socket = socketService.getSocket();
    if (!socket || !socket.connected) {
      return { success: false, error: 'Connection to game server offline' };
    }

    isPlacingBetRef.current = true;
    setIsPlacingBet(true);
    const idempotencyKey = `K_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    return new Promise(resolve => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        isPlacingBetRef.current = false;
        setIsPlacingBet(false);
        void syncFromHttp(true);
        refreshBalanceRef.current();
        resolve({ success: false, error: 'Network timeout — checking round & wallet status...' });
      }, 8000);

      socket.emit(
        'keno:place_ticket',
        {
          selectedNumbers: Array.from(selectedNumbers),
          betAmount: stake,
          isBonus: false,
          userId,
          idempotencyKey
        },
        (resp: any) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          isPlacingBetRef.current = false;
          setIsPlacingBet(false);

          if (resp && resp.success) {
            if (resp.ticket) {
              setActiveTickets(prev => {
                if (prev.some(t => t.ticketId === resp.ticket.ticketId)) return prev;
                return [...prev, resp.ticket];
              });
              setAllRoomTickets(prev => {
                if (prev.some(t => t.ticketId === resp.ticket.ticketId)) return prev;
                return [resp.ticket, ...prev];
              });
            }
            const deductFromBonus = Math.min(walletBonus, stake);
            const deductFromReal = Number((stake - deductFromBonus).toFixed(2));
            if (deductFromBonus > 0) deductBonus(deductFromBonus);
            if (deductFromReal > 0) deductBalance(deductFromReal);
            refreshBalanceRef.current();
            setSelectedNumbers(new Set());
            resolve({ success: true, ticket: resp.ticket });
          } else {
            refreshBalanceRef.current();
            resolve({ success: false, error: resp?.error || 'Failed to place ticket' });
          }
        }
      );
    });
  }, [phase, selectedNumbers, stake, activeTickets, walletBalance, walletBonus, userId, deductBalance, deductBonus, showToast, syncFromHttp]);

  const openRulesModal = useCallback((tab: 'rules' | 'fairness' = 'rules') => {
    setRulesModalTab(tab);
    setIsRulesModalOpen(true);
  }, []);

  const closeRulesModal = useCallback(() => {
    setIsRulesModalOpen(false);
  }, []);

  const switchRulesTab = useCallback((tab: 'rules' | 'fairness') => {
    setRulesModalTab(tab);
  }, []);

  const verifyRound = useCallback(
    async (payload: {
      serverSeed: string;
      expectedHash: string;
      clientSeed: string;
      nonce: number;
      expectedDrawn: number[];
    }): Promise<{ valid: boolean; error?: string; calculatedDrawn?: number[] }> => {
      const socket = socketService.getSocket();
      if (!socket || !socket.connected) {
        return { valid: false, error: 'Socket not connected' };
      }

      return new Promise(resolve => {
        socket.emit('keno:verify_round', payload, (res: any) => {
          resolve(res || { valid: false, error: 'No response from verification server' });
        });
      });
    },
    []
  );

  const value: KenoContextValue = {
    roundNumber,
    phase,
    timeRemaining,
    serverSeedHash,
    drawnBalls,
    currentDrawnBall,
    selectedNumbers,
    stake,
    activeTickets,
    allRoomTickets,
    balance: walletBalance,
    bonus: walletBonus,
    userId,
    userDisplayId,
    isAuthenticated,
    hotNumbers,
    coldNumbers,
    frequencyMap,
    lastSettlement,
    lastWinAmount,
    isPlacingBet,
    isRulesModalOpen,
    rulesModalTab,
    toggleNumber,
    quickPick,
    clearSelection,
    setStake,
    adjustStake,
    doubleStake,
    maxStake,
    placeBet,
    openDeposit,
    openRulesModal,
    closeRulesModal,
    switchRulesTab,
    refreshStats,
    verifyRound
  };

  return <KenoContext.Provider value={value}>{children}</KenoContext.Provider>;
};

export const useKeno = (): KenoContextValue => {
  const ctx = useContext(KenoContext);
  if (!ctx) {
    throw new Error('useKeno must be used within a KenoProvider');
  }
  return ctx;
};
