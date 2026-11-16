import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode
} from 'react';
import { io, Socket } from 'socket.io-client';
import { kenoAudio } from '../audio/WebAudioEngine.ts';

export type KenoPhase = 'betting' | 'drawing' | 'settlement';

export interface KenoTicket {
  id: string;
  roundId: string;
  roundNumber: number;
  userId: string;
  selectedNumbers: number[];
  spotCount: number;
  betAmount: number;
  isBonus: boolean;
  status: 'pending' | 'settled';
  hits?: number[];
  hitCount?: number;
  multiplier?: number;
  winAmount?: number;
  createdAt: number;
}

export interface HotColdStats {
  hotNumbers: number[];
  coldNumbers: number[];
  frequencyMap: Record<number, number>;
  totalRounds: number;
}

export interface KenoContextValue {
  // Round State
  roundId: string;
  roundNumber: number;
  phase: KenoPhase;
  timeRemaining: number;
  serverSeedHash: string;
  drawnBalls: number[];
  currentDrawnBall: number | null;
  
  // Player Interaction
  selectedNumbers: Set<number>;
  stake: number;
  activeTickets: KenoTicket[];
  balance: number;
  bonus: number;
  userId: string;

  // Analytics & Paytable
  hotNumbers: number[];
  coldNumbers: number[];
  frequencyMap: Record<number, number>;

  // Results & Verification
  lastSettlement: any | null;
  lastWinAmount: number;

  // Modals
  isRulesModalOpen: boolean;
  rulesModalTab: 'rules' | 'fairness';

  // Actions
  toggleNumber: (num: number) => void;
  quickPick: (count: number) => void;
  clearSelection: () => void;
  setStake: (amt: number) => void;
  adjustStake: (delta: number) => void;
  doubleStake: () => void;
  placeBet: () => Promise<{ success: boolean; error?: string }>;
  openRulesModal: (tab?: 'rules' | 'fairness') => void;
  closeRulesModal: () => void;
  switchRulesTab: (tab: 'rules' | 'fairness') => void;
  verifyRound: (payload: {
    serverSeed: string;
    expectedHash: string;
    clientSeed: string;
    nonce: number;
    expectedDrawn: number[];
  }) => Promise<{ valid: boolean; error?: string; actualHash?: string }>;
}

const KenoContext = createContext<KenoContextValue | null>(null);

interface KenoProviderProps {
  children: ReactNode;
  socketUrl?: string;
  userId?: string;
}

export const KenoProvider: React.FC<KenoProviderProps> = ({
  children,
  socketUrl = typeof window !== 'undefined' ? (window.location.port === '5050' ? window.location.origin : 'http://localhost:5050') : 'http://localhost:5050',
  userId = 'demo-user-1'
}) => {
  const socketRef = useRef<Socket | null>(null);

  // Round State
  const [roundId, setRoundId] = useState<string>('');
  const [roundNumber, setRoundNumber] = useState<number>(1001);
  const [phase, setPhase] = useState<KenoPhase>('betting');
  const [timeRemaining, setTimeRemaining] = useState<number>(15);
  const [serverSeedHash, setServerSeedHash] = useState<string>('');
  const [drawnBalls, setDrawnBalls] = useState<number[]>([]);
  const [currentDrawnBall, setCurrentDrawnBall] = useState<number | null>(null);

  // Player State
  const [selectedNumbers, setSelectedNumbers] = useState<Set<number>>(new Set());
  const selectedNumbersRef = useRef<Set<number>>(selectedNumbers);
  selectedNumbersRef.current = selectedNumbers;
  const hitsCountRef = useRef<number>(0);
  const [stake, setStakeState] = useState<number>(10.0);
  const [activeTickets, setActiveTickets] = useState<KenoTicket[]>([]);
  const [balance, setBalance] = useState<number>(250.0);
  const [bonus, setBonus] = useState<number>(50.0);

  // Stats
  const [hotNumbers, setHotNumbers] = useState<number[]>([]);
  const [coldNumbers, setColdNumbers] = useState<number[]>([]);
  const [frequencyMap, setFrequencyMap] = useState<Record<number, number>>({});

  // Settlements
  const [lastSettlement, setLastSettlement] = useState<any | null>(null);
  const [lastWinAmount, setLastWinAmount] = useState<number>(0);

  // Modal State
  const [isRulesModalOpen, setIsRulesModalOpen] = useState<boolean>(false);
  const [rulesModalTab, setRulesModalTab] = useState<'rules' | 'fairness'>('rules');

  // Fetch initial wallet balance
  const refreshBalance = useCallback(async () => {
    try {
      const res = await fetch(`${socketUrl}/api/keno/wallet/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setBalance(data.balance ?? 250);
        setBonus(data.bonus ?? 50);
      }
    } catch {
      // Fallback in isolated dev mode
    }
  }, [socketUrl, userId]);

  useEffect(() => {
    refreshBalance();
  }, [refreshBalance]);

  // Connect to Live Keno Socket.IO
  useEffect(() => {
    const s = io(socketUrl, {
      query: { userId },
      reconnectionAttempts: 10,
      transports: ['websocket', 'polling']
    });

    socketRef.current = s;

    s.on('connect', () => {
      s.emit('keno:join', { userId });
    });

    s.on('keno:init_state', (data: any) => {
      setRoundId(data.roundId);
      setRoundNumber(data.roundNumber);
      setPhase(data.phase);
      setTimeRemaining(data.timeRemaining);
      setServerSeedHash(data.serverSeedHash);
      setDrawnBalls(data.drawnNumbers || []);
      if (data.hotCold) {
        setHotNumbers(data.hotCold.hotNumbers || []);
        setColdNumbers(data.hotCold.coldNumbers || []);
        setFrequencyMap(data.hotCold.frequencyMap || {});
      }
      if (data.userTickets) {
        setActiveTickets(data.userTickets);
      }
    });

    s.on('keno:round_started', (data: any) => {
      setRoundId(data.roundId);
      setRoundNumber(data.roundNumber);
      setPhase('betting');
      setTimeRemaining(data.timeRemaining || 15);
      setServerSeedHash(data.serverSeedHash);
      setDrawnBalls([]);
      setCurrentDrawnBall(null);
      setActiveTickets([]);
      setLastWinAmount(0);
      hitsCountRef.current = 0;
      if (data.hotCold) {
        setHotNumbers(data.hotCold.hotNumbers || []);
        setColdNumbers(data.hotCold.coldNumbers || []);
        setFrequencyMap(data.hotCold.frequencyMap || {});
      }
    });

    s.on('keno:tick', (data: any) => {
      setRoundNumber(data.roundNumber);
      setPhase(data.phase);
      setTimeRemaining(data.timeRemaining);
      if (data.phase === 'betting' && data.timeRemaining <= 3 && data.timeRemaining > 0) {
        kenoAudio.playTick();
      }
    });

    s.on('keno:draw_started', (data: any) => {
      setRoundNumber(data.roundNumber);
      setPhase('drawing');
      setDrawnBalls([]);
      setCurrentDrawnBall(null);
      hitsCountRef.current = 0;
    });

    s.on('keno:ball_drawn', (data: any) => {
      setCurrentDrawnBall(data.ballNumber);
      setDrawnBalls((prev) => {
        if (!prev.includes(data.ballNumber)) {
          return [...prev, data.ballNumber];
        }
        return prev;
      });

      const isHit = selectedNumbersRef.current.has(data.ballNumber);
      if (isHit) {
        hitsCountRef.current += 1;
        kenoAudio.playMatchChime(hitsCountRef.current);
      } else {
        kenoAudio.playBallPop();
      }
    });

    s.on('keno:round_settled', (data: any) => {
      setPhase('settlement');
      setDrawnBalls(data.drawnNumbers || []);
      setLastSettlement(data);
      if (data.hotCold) {
        setHotNumbers(data.hotCold.hotNumbers || []);
        setColdNumbers(data.hotCold.coldNumbers || []);
        setFrequencyMap(data.hotCold.frequencyMap || {});
      }
      refreshBalance();
    });

    s.on('keno:player_settled', (data: any) => {
      if (data.userId === userId) {
        setLastWinAmount(data.totalWon || 0);
        if (data.totalWon > 0) {
          kenoAudio.playWinFanfare();
        }
        if (data.tickets) {
          setActiveTickets(data.tickets);
        }
        refreshBalance();
      }
    });

    return () => {
      s.disconnect();
    };
  }, [socketUrl, userId, refreshBalance]);

  // Actions
  const toggleNumber = useCallback((num: number) => {
    if (phase !== 'betting') return;
    setSelectedNumbers((prev) => {
      const next = new Set(prev);
      if (next.has(num)) {
        next.delete(num);
      } else {
        if (next.size >= 10) return prev; // Atlas-V Max 10 spots
        next.add(num);
      }
      return next;
    });
  }, [phase]);

  const quickPick = useCallback((count: number) => {
    if (phase !== 'betting') return;
    const clamped = Math.max(1, Math.min(10, count));
    const pool = Array.from({ length: 80 }, (_, i) => i + 1);
    // Fisher-Yates shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const picked = new Set(pool.slice(0, clamped));
    setSelectedNumbers(picked);
  }, [phase]);

  const clearSelection = useCallback(() => {
    if (phase !== 'betting') return;
    setSelectedNumbers(new Set());
  }, [phase]);

  const setStake = useCallback((amt: number) => {
    setStakeState(Math.max(1, Math.min(1000, Math.round(amt))));
  }, []);

  const adjustStake = useCallback((delta: number) => {
    setStakeState((prev) => Math.max(1, Math.min(1000, prev + delta)));
  }, []);

  const doubleStake = useCallback(() => {
    setStakeState((prev) => Math.max(1, Math.min(1000, prev * 2)));
  }, []);

  const placeBet = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (phase !== 'betting') {
      return { success: false, error: 'Betting is closed for this round' };
    }
    if (selectedNumbers.size === 0) {
      return { success: false, error: 'Please select 1 to 10 numbers' };
    }
    if (balance < stake) {
      return { success: false, error: 'Insufficient balance' };
    }

    const s = socketRef.current;
    if (!s) {
      return { success: false, error: 'Server connection offline' };
    }

    return new Promise((resolve) => {
      s.emit(
        'keno:place_ticket',
        {
          selectedNumbers: Array.from(selectedNumbers),
          betAmount: stake,
          isBonus: false
        },
        (resp: any) => {
          if (resp && resp.success) {
            setActiveTickets((prev) => [...prev, resp.ticket]);
            setBalance((prev) => prev - stake);
            resolve({ success: true });
          } else {
            resolve({ success: false, error: resp?.error || 'Failed to place bet' });
          }
        }
      );
    });
  }, [phase, selectedNumbers, stake, balance]);

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
    }) => {
      const s = socketRef.current;
      if (!s) return { valid: false, error: 'Socket offline' };

      return new Promise<{ valid: boolean; error?: string; actualHash?: string }>((resolve) => {
        s.emit('keno:verify_round', payload, (res: any) => {
          resolve(res);
        });
      });
    },
    []
  );

  const value: KenoContextValue = {
    roundId,
    roundNumber,
    phase,
    timeRemaining,
    serverSeedHash,
    drawnBalls,
    currentDrawnBall,
    selectedNumbers,
    stake,
    activeTickets,
    balance,
    bonus,
    userId,
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
    placeBet,
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
