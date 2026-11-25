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
import { kenoAudio } from '../components/keno/WebAudioEngine.ts';
import { useWallet } from './WalletContext.tsx';
import { useAuth } from './AuthContext.tsx';
import { useApp } from './AppContext.tsx';

export type KenoPhase = 'betting' | 'drawing' | 'settling' | 'settlement';

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
  const { balance: walletBalance, bonus: walletBonus, deductBalance, addBalance, refreshBalance } = useWallet();
  const { currentPage, switchPage, showToast } = useApp();

  const isKenoActive = currentPage === 'keno';

  const userId = user?.id || (typeof window !== 'undefined' ? localStorage.getItem('sonic_user_id') : '') || '';
  const userDisplayId = user?.phone ? user.phone : (user?.id ? user.id.slice(0, 8) : '886122631');

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

  const [isRulesModalOpen, setIsRulesModalOpen] = useState<boolean>(false);
  const [rulesModalTab, setRulesModalTab] = useState<'rules' | 'fairness'>('rules');

  // Refresh wallet balance only when player enters the Keno screen (zero boot overhead for Bingo)
  useEffect(() => {
    if (isKenoActive) {
      refreshBalance();
    }
  }, [isKenoActive, refreshBalance]);

  // Connect & join 'keno_room' ONLY when currentPage === 'keno'; leave cleanly on exit
  useEffect(() => {
    if (!isKenoActive) return;

    const socket: Socket = socketService.connect();

    const handleConnect = () => {
      socket.emit('keno:join', { userId });
    };

    if (socket.connected) {
      handleConnect();
    } else {
      socket.on('connect', handleConnect);
    }

    const onInitState = (data: any) => {
      if (data.roundNumber) setRoundNumber(data.roundNumber);
      if (data.phase) setPhase(data.phase === 'settling' ? 'settlement' : data.phase);
      if (typeof data.timeRemaining === 'number') setTimeRemaining(data.timeRemaining);
      if (data.serverSeedHash) setServerSeedHash(data.serverSeedHash);
      if (data.drawnBalls) setDrawnBalls(data.drawnBalls);
      if (data.hotCold) {
        setHotNumbers(data.hotCold.hotNumbers || []);
        setColdNumbers(data.hotCold.coldNumbers || []);
        setFrequencyMap(data.hotCold.frequencyMap || {});
      }
      if (data.userTickets) {
        setActiveTickets(data.userTickets);
      }
      if (data.allActiveTickets && Array.isArray(data.allActiveTickets)) {
        setAllRoomTickets(data.allActiveTickets);
      }
    };

    const onRoundStarted = (data: any) => {
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
      if (data.roundNumber) setRoundNumber(data.roundNumber);
      if (data.phase) setPhase(data.phase === 'settling' ? 'settlement' : data.phase);
      if (typeof data.timeRemaining === 'number') {
        setTimeRemaining(data.timeRemaining);
        if (data.phase === 'betting' && data.timeRemaining <= 3 && data.timeRemaining > 0) {
          kenoAudio.playTick();
        }
      }
    };

    const onDrawStarted = (data: any) => {
      if (data.roundNumber) setRoundNumber(data.roundNumber);
      setPhase('drawing');
      setDrawnBalls([]);
      setCurrentDrawnBall(null);
      hitsCountRef.current = 0;
    };

    const onBallDrawn = (data: any) => {
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
      setPhase('settlement');
      if (data.drawnNumbers) setDrawnBalls(data.drawnNumbers);
      setLastSettlement(data);
      if (data.hotCold) {
        setHotNumbers(data.hotCold.hotNumbers || []);
        setColdNumbers(data.hotCold.coldNumbers || []);
        setFrequencyMap(data.hotCold.frequencyMap || {});
      }
      refreshBalance();
    };

    const onPlayerSettled = (data: any) => {
      if (data.userId === userId) {
        setLastWinAmount(data.userTotalWin || 0);
        if (data.userTotalWin > 0) {
          kenoAudio.playWinFanfare();
          addBalance(data.userTotalWin);
          refreshBalance();
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

    return () => {
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
  }, [isKenoActive, userId, refreshBalance, addBalance]);

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
    setStakeState(Math.max(1, Math.min(500, Math.round(amt))));
  }, []);

  const adjustStake = useCallback((delta: number) => {
    setStakeState(prev => Math.max(1, Math.min(500, prev + delta)));
  }, []);

  const doubleStake = useCallback(() => {
    setStakeState(prev => Math.max(1, Math.min(500, prev * 2)));
  }, []);

  const maxStake = useCallback(() => {
    setStakeState(() => Math.max(1, Math.min(500, Math.max(1, Math.floor(walletBalance)))));
  }, [walletBalance]);

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
    if (walletBalance < stake) {
      showToast(`Not enough credits (${walletBalance.toFixed(2)} < ${stake.toFixed(2)} ETB). Opening Deposit...`);
      switchPage('deposit');
      return { success: false, error: 'Not enough credits' };
    }

    const socket = socketService.getSocket();
    if (!socket || !socket.connected) {
      return { success: false, error: 'Connection to game server offline' };
    }

    return new Promise(resolve => {
      socket.emit(
        'keno:place_ticket',
        {
          selectedNumbers: Array.from(selectedNumbers),
          betAmount: stake,
          isBonus: false,
          userId
        },
        (resp: any) => {
          if (resp && resp.success) {
            if (resp.ticket) {
              setActiveTickets(prev => [...prev, resp.ticket]);
              setAllRoomTickets(prev => {
                if (prev.some(t => t.ticketId === resp.ticket.ticketId)) return prev;
                return [resp.ticket, ...prev];
              });
            }
            deductBalance(stake);
            refreshBalance();
            setSelectedNumbers(new Set());
            resolve({ success: true, ticket: resp.ticket });
          } else {
            resolve({ success: false, error: resp?.error || 'Failed to place ticket' });
          }
        }
      );
    });
  }, [phase, selectedNumbers, stake, walletBalance, userId, deductBalance, refreshBalance, switchPage, showToast]);

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
