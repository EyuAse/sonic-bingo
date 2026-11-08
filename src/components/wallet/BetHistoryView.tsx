import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { useApp } from '../../context/AppContext.tsx';
import { apiClient } from '../../services/apiClient.ts';
import { socketService } from '../../services/socketService.ts';

interface BetHistoryViewProps {
  onBack: () => void;
}

interface TicketData {
  id: string;
  cartelaId: number;
  cardMatrix: Array<{
    col: number;
    row: number;
    val: number | string;
    index: number;
    isFree: boolean;
    colLetter?: string;
  }>;
  betAmount: number;
  isWinner: boolean;
  status: string;
}

interface RoundHistoryItem {
  roundId: string;
  roomId: string;
  roomName: string;
  roundNumber: number;
  phase: string;
  status?: string;
  isLive?: boolean;
  isPending?: boolean;
  totalPot: number;
  winnerPayout: number;
  winnerNames: string[];
  winnerCartelas: number[];
  winnerUserIds: string[];
  drawnNumbers: number[];
  endedAt: string | null;
  betTime: string;
  totalStake: number;
  isWinner: boolean;
  userWonAmount: number;
  netPnl: number;
  tickets: TicketData[];
}

interface HistorySummary {
  totalGames: number;
  totalWins: number;
  totalLosses: number;
  winRate: number;
  totalStaked: number;
  totalWon: number;
  netProfit: number;
}

interface RecentGameItem {
  id: string;
  roomId: string;
  roomName: string;
  roomStake: number;
  roundNumber: number;
  phase: string;
  drawnNumbers: number[];
  ballsCount: number;
  totalPot: number;
  platformFee: number;
  winnerPayout: number;
  winnerNames: string[];
  winnerCartelas: number[];
  winnerUserIds: string[];
  endedAt: string;
  totalTickets: number;
  userParticipated: boolean;
}

export const BetHistoryView: React.FC<BetHistoryViewProps> = ({ onBack }) => {
  const { t, lang } = useLanguage();
  const { switchPage } = useApp();

  // 1. Primary View Mode: 'recent' (Recent Games) vs 'my_games' (My Games)
  const [activeMode, setActiveMode] = useState<'recent' | 'my_games'>('recent');

  // --------------------------------------------------------------------------
  // Mode A: Recent Games State
  // --------------------------------------------------------------------------
  const [recentRounds, setRecentRounds] = useState<RecentGameItem[]>([]);
  const [recentRoomFilter, setRecentRoomFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoadingRecent, setIsLoadingRecent] = useState<boolean>(true);
  const [expandedRecentId, setExpandedRecentId] = useState<string | null>(null);

  // --------------------------------------------------------------------------
  // Mode B: My Games State
  // --------------------------------------------------------------------------
  const [mySummary, setMySummary] = useState<HistorySummary>({
    totalGames: 0,
    totalWins: 0,
    totalLosses: 0,
    winRate: 0,
    totalStaked: 0,
    totalWon: 0,
    netProfit: 0,
  });
  const [myRounds, setMyRounds] = useState<RoundHistoryItem[]>([]);
  const [myOutcomeFilter, setMyOutcomeFilter] = useState<'all' | 'wins' | 'losses'>('all');
  const [isLoadingMy, setIsLoadingMy] = useState<boolean>(true);
  const [expandedRoundId, setExpandedRoundId] = useState<string | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  // --------------------------------------------------------------------------
  // Data Fetchers
  // --------------------------------------------------------------------------
  const fetchRecent = useCallback(async () => {
    try {
      setIsLoadingRecent(true);
      const res = await apiClient.wallet.getRecentGames({
        roomId: recentRoomFilter === 'all' ? undefined : recentRoomFilter,
        search: searchQuery.trim() || undefined,
        limit: 50
      });
      if (res && res.success) {
        setRecentRounds(res.rounds || []);
      }
    } catch (err) {
      console.warn('Could not fetch recent games:', err);
    } finally {
      setIsLoadingRecent(false);
    }
  }, [recentRoomFilter, searchQuery]);

  const fetchMyHistory = useCallback(async () => {
    try {
      setIsLoadingMy(true);
      const data = await apiClient.wallet.getGameHistory();
      if (data && data.success) {
        setMySummary(data.summary);
        setMyRounds(data.rounds || []);
      }
    } catch (err) {
      console.warn('Could not fetch bet history:', err);
    } finally {
      setIsLoadingMy(false);
    }
  }, []);

  // Initial and reactive load
  useEffect(() => {
    fetchRecent();
  }, [fetchRecent]);

  useEffect(() => {
    fetchMyHistory();
  }, [fetchMyHistory]);

  // Live real-time socket events
  useEffect(() => {
    const handleUpdate = () => {
      fetchRecent();
      fetchMyHistory();
    };

    window.addEventListener('lb_wallet_updated', handleUpdate);
    window.addEventListener('round_ended', handleUpdate);
    window.addEventListener('user_tickets_synced', handleUpdate);
    window.addEventListener('user_balance_updated', handleUpdate);

    const unsubRoundEnded = socketService.on('round_ended', handleUpdate);

    return () => {
      window.removeEventListener('lb_wallet_updated', handleUpdate);
      window.removeEventListener('round_ended', handleUpdate);
      window.removeEventListener('user_tickets_synced', handleUpdate);
      window.removeEventListener('user_balance_updated', handleUpdate);
      if (unsubRoundEnded) unsubRoundEnded();
    };
  }, [fetchRecent, fetchMyHistory]);

  // Filtered personal rounds
  const filteredMyRounds = useMemo(() => {
    return myRounds.filter(r => {
      if (myOutcomeFilter === 'wins') return r.isWinner && r.phase === 'ended';
      if (myOutcomeFilter === 'losses') return !r.isWinner && r.phase === 'ended';
      return true;
    });
  }, [myRounds, myOutcomeFilter]);

  const toggleExpandMy = (roundId: string, firstTicketId?: string) => {
    if (expandedRoundId === roundId) {
      setExpandedRoundId(null);
      setSelectedTicketId(null);
    } else {
      setExpandedRoundId(roundId);
      if (firstTicketId) {
        setSelectedTicketId(firstTicketId);
      }
    }
  };

  const toggleExpandRecent = (roundId: string) => {
    setExpandedRecentId(prev => (prev === roundId ? null : roundId));
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString(lang === 'am' ? 'am-ET' : 'en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    try {
      const diffMin = Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000));
      if (diffMin < 1) return lang === 'am' ? 'አሁን' : 'just now';
      if (diffMin < 60) return `${diffMin} ${lang === 'am' ? 'ደቂቃ በፊት' : 'm ago'}`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `${diffHours} ${lang === 'am' ? 'ሰዓት በፊት' : 'h ago'}`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays} ${lang === 'am' ? 'ቀን በፊት' : 'd ago'}`;
    } catch {
      return '';
    }
  };

  // 75-Ball Column Letter Generator
  const getBallLetter = (val: number): string => {
    if (val <= 15) return 'B';
    if (val <= 30) return 'I';
    if (val <= 45) return 'N';
    if (val <= 60) return 'G';
    return 'O';
  };

  return (
    <div className="fresh-tx-history-container bet-history-container">
      {/* 1. Top Navigation Bar */}
      <div className="tx-history-top-navbar">
        <button type="button" className="btn-tx-back" onClick={onBack}>
          <i className="fa-solid fa-arrow-left"></i>
          <span>{t('history.backToWallet') || 'Back'}</span>
        </button>
        <h2 className="tx-page-title">{t('wallet.betHistory') || 'Game & Bet History'}</h2>
        <button
          type="button"
          className="btn-refresh-history"
          onClick={() => {
            if (activeMode === 'recent') fetchRecent();
            else fetchMyHistory();
          }}
          disabled={isLoadingRecent || isLoadingMy}
          title="Refresh"
        >
          <i className={`fa-solid fa-rotate-right ${(isLoadingRecent || isLoadingMy) ? 'fa-spin' : ''}`}></i>
        </button>
      </div>

      {/* 2. Primary Segmented Mode Switcher (Recent Games vs My Games) */}
      <div className="history-mode-switcher-bar">
        <button
          type="button"
          className={`history-mode-btn ${activeMode === 'recent' ? 'active' : ''}`}
          onClick={() => setActiveMode('recent')}
        >
          <i className="fa-solid fa-earth-africa"></i>
          <span>{t('history.recentGames') || 'Recent Games'}</span>
        </button>
        <button
          type="button"
          className={`history-mode-btn ${activeMode === 'my_games' ? 'active' : ''}`}
          onClick={() => setActiveMode('my_games')}
        >
          <i className="fa-solid fa-user-clock"></i>
          <span>{t('history.myGames') || 'My Games'}</span>
        </button>
      </div>

      {/* ==================================================================== */}
      {/* MODE 1: RECENT GAMES (PLATFORM-WIDE LEDGER)                          */}
      {/* ==================================================================== */}
      {activeMode === 'recent' && (
        <>
          {/* A. Secondary Stake Filter Pills */}
          <div className="history-subfilter-bar">
            <button
              type="button"
              className={`history-subfilter-pill ${recentRoomFilter === 'all' ? 'active' : ''}`}
              onClick={() => setRecentRoomFilter('all')}
            >
              <span>{t('history.allStakes') || 'All Stakes'}</span>
            </button>
            <button
              type="button"
              className={`history-subfilter-pill ${recentRoomFilter === 'room-10' ? 'active' : ''}`}
              onClick={() => setRecentRoomFilter('room-10')}
            >
              <span>10 Birr</span>
            </button>
            <button
              type="button"
              className={`history-subfilter-pill ${recentRoomFilter === 'room-20' ? 'active' : ''}`}
              onClick={() => setRecentRoomFilter('room-20')}
            >
              <span>20 Birr</span>
            </button>
            <button
              type="button"
              className={`history-subfilter-pill ${recentRoomFilter === 'room-50' ? 'active' : ''}`}
              onClick={() => setRecentRoomFilter('room-50')}
            >
              <span>50 Birr</span>
            </button>
            <button
              type="button"
              className={`history-subfilter-pill ${recentRoomFilter === 'room-100' ? 'active' : ''}`}
              onClick={() => setRecentRoomFilter('room-100')}
            >
              <span>100 Birr</span>
            </button>
          </div>

          {/* B. Search By Game Number */}
          <div className="history-search-bar">
            <i className="fa-solid fa-magnifying-glass history-search-icon"></i>
            <input
              type="text"
              className="history-search-input"
              placeholder={t('history.searchByGameNumber') || 'Search by game number...'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="history-search-clear-btn"
                onClick={() => setSearchQuery('')}
                title="Clear"
              >
                <i className="fa-solid fa-circle-xmark"></i>
              </button>
            )}
          </div>

          {/* C. Recent Concluded Rounds List */}
          <div className="bet-history-rounds-list">
            {isLoadingRecent && recentRounds.length === 0 ? (
              <div className="tx-history-empty-card">
                <div className="empty-icon-circle">
                  <i className="fa-solid fa-spinner fa-spin"></i>
                </div>
                <p className="empty-subtext">Loading recent rounds...</p>
              </div>
            ) : recentRounds.length === 0 ? (
              <div className="tx-history-empty-card">
                <div className="empty-icon-circle gold">
                  <i className="fa-solid fa-dice"></i>
                </div>
                <h3 className="empty-title">{t('history.noRecentGames') || 'No games found'}</h3>
                <p className="empty-subtext">
                  {lang === 'am'
                    ? 'ለተመረጠው ክፍል እስካሁን የተጠናቀቀ ጨዋታ አልተገኘም። ክፍል ይምረጡና ይጫወቱ!'
                    : 'No completed rounds found matching this filter. Jump in and play!'}
                </p>
                <button
                  type="button"
                  className="btn-play-empty-cta"
                  onClick={() => switchPage('games')}
                >
                  <i className="fa-solid fa-gamepad"></i>
                  <span>{lang === 'am' ? 'አሁን ተጫወት' : 'Play Bingo Now'}</span>
                </button>
              </div>
            ) : (
              recentRounds.map(round => {
                const isExpanded = expandedRecentId === round.id;
                const winnerDisplay = round.winnerNames.length > 0 ? round.winnerNames.join(', ') : 'Winner';
                const winningCartela = round.winnerCartelas.length > 0 ? `#${round.winnerCartelas[0]}` : null;
                const winningBall = round.drawnNumbers.length > 0 ? round.drawnNumbers[round.drawnNumbers.length - 1] : null;

                return (
                  <div
                    key={round.id}
                    className="recent-game-card"
                    onClick={() => toggleExpandRecent(round.id)}
                  >
                    {/* Top Row: Game #, Stake, You Played, Time */}
                    <div className="recent-game-top-row">
                      <div className="recent-game-id-group">
                        <span className="recent-game-round-badge">
                          Game #{round.roundNumber}
                        </span>
                        <span className="recent-game-stake-badge">
                          {round.roomStake} ETB
                        </span>
                        {round.userParticipated && (
                          <span className="recent-game-you-played-pill">
                            <i className="fa-solid fa-crown"></i>
                            <span>{t('history.youPlayed') || 'You Played'}</span>
                          </span>
                        )}
                      </div>

                      <span className="recent-game-time" title={formatDate(round.endedAt)}>
                        {formatTimeAgo(round.endedAt)}
                      </span>
                    </div>

                    {/* Middle Row: Winner Info & Payout */}
                    <div className="recent-game-content-row">
                      <div className="recent-game-winner-info">
                        <div className="recent-game-winner-avatar">
                          👑
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div className="recent-game-winner-names">
                            {winnerDisplay}
                          </div>
                          {winningCartela && (
                            <div className="recent-game-winner-cartela">
                              Cartela {winningCartela}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="recent-game-payout-block">
                        <div className="recent-game-payout-amount">
                          +{round.winnerPayout.toLocaleString()} ETB
                        </div>
                        <div className="recent-game-pot-sub">
                          Pot: {round.totalPot.toLocaleString()} ETB
                        </div>
                      </div>
                    </div>

                    {/* Bottom Row: Balls Count & Expand Hint */}
                    <div className="recent-game-footer-row">
                      <span className="recent-game-balls-count">
                        <i className="fa-solid fa-bowling-ball text-gold"></i>
                        <span>
                          {t('history.finishedInBalls') || 'Finished in'} <b>{round.ballsCount}</b> {t('history.balls') || 'balls'}
                        </span>
                      </span>

                      <span className="recent-game-expand-hint">
                        <span>{isExpanded ? (lang === 'am' ? 'ደብቅ' : 'Hide balls') : (lang === 'am' ? 'የተጠሩ ኳሶች' : 'View balls')}</span>
                        <i className={`fa-solid ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                      </span>
                    </div>

                    {/* Expanded Drawer: All Called Balls Sequence */}
                    {isExpanded && round.drawnNumbers.length > 0 && (
                      <div
                        className="recent-game-called-balls-box"
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="called-balls-header">
                          <span>{t('history.calledBalls') || 'Called Balls Sequence'}</span>
                          <span>{round.drawnNumbers.length} balls</span>
                        </div>

                        <div className="called-balls-chips-flow">
                          {round.drawnNumbers.map((num, idx) => {
                            const isFinal = idx === round.drawnNumbers.length - 1;
                            const letter = getBallLetter(num);

                            return (
                              <div
                                key={idx}
                                className={`called-ball-chip ${isFinal ? 'winning-ball' : ''}`}
                                title={`${letter}-${num} ${isFinal ? '(Winning Ball)' : ''}`}
                              >
                                {letter}{num}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* ==================================================================== */}
      {/* MODE 2: MY GAMES (PERSONAL BET & CARTELLA HISTORY)                   */}
      {/* ==================================================================== */}
      {activeMode === 'my_games' && (
        <>
          {/* A. Hero Performance Summary Card */}
          <div className="bet-history-hero-card">
            <div className="hero-winrate-section">
              <div className="winrate-circle-badge">
                <span className="winrate-percent-num">{mySummary.winRate}%</span>
                <span className="winrate-percent-lbl">{t('history.winRate') || 'Win Rate'}</span>
              </div>
              <div className="hero-main-stats">
                <div className="hero-profit-badge" style={{ color: mySummary.netProfit >= 0 ? '#10b981' : '#f43f5e' }}>
                  <i className={mySummary.netProfit >= 0 ? 'fa-solid fa-chart-line' : 'fa-solid fa-chart-line-down'}></i>
                  <span>{mySummary.netProfit >= 0 ? '+' : ''}{mySummary.netProfit.toFixed(2)} ETB</span>
                  <small className="profit-subtext">{t('history.netProfit') || 'Net Profit'}</small>
                </div>
                <div className="hero-games-record">
                  <span>{mySummary.totalGames} {t('history.gamesPlayed') || 'Games'}</span>
                  <span className="record-divider">•</span>
                  <span className="record-wins">{mySummary.totalWins}W</span>
                  <span className="record-divider">/</span>
                  <span className="record-losses">{mySummary.totalLosses}L</span>
                </div>
              </div>
            </div>

            <div className="hero-secondary-stats-row">
              <div className="secondary-stat-pill">
                <span className="sec-stat-label">{t('history.totalStaked') || 'Total Staked'}</span>
                <strong className="sec-stat-val">{mySummary.totalStaked.toFixed(2)} ETB</strong>
              </div>
              <div className="secondary-stat-pill">
                <span className="sec-stat-label">{t('history.totalWon') || 'Total Won'}</span>
                <strong className="sec-stat-val text-emerald">+{mySummary.totalWon.toFixed(2)} ETB</strong>
              </div>
            </div>
          </div>

          {/* B. Outcome Filter Pills */}
          <div className="history-subfilter-bar">
            <button
              type="button"
              className={`history-subfilter-pill ${myOutcomeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setMyOutcomeFilter('all')}
            >
              <span>{t('history.all') || 'All Games'}</span>
              <span style={{ opacity: 0.75, fontSize: 11 }}>({myRounds.length})</span>
            </button>
            <button
              type="button"
              className={`history-subfilter-pill ${myOutcomeFilter === 'wins' ? 'active wins' : ''}`}
              onClick={() => setMyOutcomeFilter('wins')}
            >
              <span>{t('history.wins') || 'Wins'}</span>
              <span style={{ opacity: 0.9, fontSize: 11 }}>({mySummary.totalWins})</span>
            </button>
            <button
              type="button"
              className={`history-subfilter-pill ${myOutcomeFilter === 'losses' ? 'active losses' : ''}`}
              onClick={() => setMyOutcomeFilter('losses')}
            >
              <span>{t('history.losses') || 'Losses'}</span>
              <span style={{ opacity: 0.9, fontSize: 11 }}>({mySummary.totalLosses})</span>
            </button>
          </div>

          {/* C. Personal Rounds List */}
          <div className="bet-history-rounds-list">
            {isLoadingMy && myRounds.length === 0 ? (
              <div className="tx-history-empty-card">
                <div className="empty-icon-circle">
                  <i className="fa-solid fa-spinner fa-spin"></i>
                </div>
                <p className="empty-subtext">Loading your game records...</p>
              </div>
            ) : filteredMyRounds.length === 0 ? (
              <div className="tx-history-empty-card">
                <div className="empty-icon-circle gold">
                  <i className="fa-solid fa-dice"></i>
                </div>
                <h3 className="empty-title">{t('history.noHistory') || 'No games played yet'}</h3>
                <p className="empty-subtext">
                  {lang === 'am'
                    ? 'በክፍሎቻችን የቀጥታ 75-ኳስ ቢንጎ በመጫወት እዚህ ያሸነፉትን እና የተጣራ ትርፍዎን ይከታተሉ!'
                    : 'Play live 75-ball express bingo in any room to track your games, cartelas, and profit!'}
                </p>
                <button
                  type="button"
                  className="btn-play-empty-cta"
                  onClick={() => switchPage('games')}
                >
                  <i className="fa-solid fa-gamepad"></i>
                  <span>{lang === 'am' ? 'አሁን ተጫወት' : 'Play Bingo Now'}</span>
                </button>
              </div>
            ) : (
              filteredMyRounds.map(round => {
                const isExpanded = expandedRoundId === round.roundId;
                const userTickets = round.tickets || [];
                const selectedTicket = userTickets.find(t => t.id === selectedTicketId) || userTickets[0];

                return (
                  <div
                    key={round.roundId}
                    className={`bet-round-card ${round.isWinner ? 'winner-card' : ''}`}
                  >
                    {/* Top Row: Room & Result Status */}
                    <div className="round-card-top-header">
                      <div className="round-room-group">
                        <span className="round-room-name">{round.roomName}</span>
                        <span className="round-number-tag">
                          {round.roundNumber > 0 ? `#${round.roundNumber}` : 'Round'}
                        </span>
                        {round.isLive && (
                          <span className="badge-live-tag">
                            <span className="live-dot-pulse"></span>
                            {round.phase === 'queued' ? 'Queued' : 'Live'}
                          </span>
                        )}
                      </div>

                      <div className="round-result-badge-wrap">
                        {round.isLive ? (
                          <span className="round-status-pill in-play">
                            <i className="fa-solid fa-spinner fa-spin"></i>
                            <span>{round.phase === 'queued' ? 'Queued' : 'In Play'}</span>
                          </span>
                        ) : round.isWinner ? (
                          <span className="round-status-pill win">
                            <i className="fa-solid fa-trophy"></i>
                            <span>+{round.userWonAmount.toFixed(2)} ETB</span>
                          </span>
                        ) : (
                          <span className="round-status-pill loss">
                            <span>-{round.totalStake.toFixed(2)} ETB</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Meta Row: Bet Time, Pot, Tickets */}
                    <div className="round-meta-grid">
                      <div className="meta-item">
                        <span className="meta-lbl">{lang === 'am' ? 'ሰዓት' : 'Time'}</span>
                        <span className="meta-val">{formatDate(round.betTime)}</span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-lbl">{lang === 'am' ? 'ካርቴላዎች' : 'Cartelas'}</span>
                        <span className="meta-val">{userTickets.length}</span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-lbl">{lang === 'am' ? 'ጠቅላላ ውርርድ' : 'Stake'}</span>
                        <span className="meta-val">{round.totalStake.toFixed(2)} ETB</span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-lbl">{lang === 'am' ? 'ጠቅላላ ፖት' : 'Pot'}</span>
                        <span className="meta-val text-gold">{round.totalPot.toFixed(2)} ETB</span>
                      </div>
                    </div>

                    {/* Cartelas Pills Bar & Inspect Toggle */}
                    <div className="round-cartelas-actions-bar">
                      <div className="cartela-pills-flow">
                        {userTickets.map(ticket => {
                          const isWinningCartela = ticket.isWinner || round.winnerCartelas.includes(ticket.cartelaId);
                          const isSelected = selectedTicket?.id === ticket.id;

                          return (
                            <button
                              key={ticket.id}
                              type="button"
                              className={`cartela-pill ${isWinningCartela ? 'winner' : ''} ${isSelected && isExpanded ? 'selected' : ''}`}
                              onClick={() => {
                                if (!isExpanded) {
                                  setExpandedRoundId(round.roundId);
                                }
                                setSelectedTicketId(ticket.id);
                              }}
                            >
                              {isWinningCartela && <i className="fa-solid fa-crown text-gold"></i>}
                              <span>#{ticket.cartelaId}</span>
                              <small className="cartela-bet-stake">({ticket.betAmount} ETB)</small>
                            </button>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        className="btn-toggle-inspector"
                        onClick={() => toggleExpandMy(round.roundId, userTickets[0]?.id)}
                      >
                        <span>{isExpanded ? (t('history.hideCartela') || 'Hide Cartela') : (t('history.viewCartela') || 'View Cartela')}</span>
                        <i className={`fa-solid ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                      </button>
                    </div>

                    {/* Expandable 5x5 Cartela Inspector */}
                    {isExpanded && selectedTicket && (
                      <div className="round-cartela-inspector-panel">
                        <div className="inspector-header">
                          <div className="inspector-title">
                            <i className="fa-solid fa-table-cells"></i>
                            <span>Cartela #{selectedTicket.cartelaId}</span>
                            {selectedTicket.isWinner && (
                              <span className="winning-badge">🏆 {lang === 'am' ? 'አሸናፊ ካርቴላ' : 'Winning Card'}</span>
                            )}
                          </div>
                          <span className="inspector-stake">{selectedTicket.betAmount} ETB Stake</span>
                        </div>

                        {/* 5x5 Mini Matrix Grid */}
                        <div className="inspector-grid-5x5">
                          <div className="grid-col-header col-b">B</div>
                          <div className="grid-col-header col-i">I</div>
                          <div className="grid-col-header col-n">N</div>
                          <div className="grid-col-header col-g">G</div>
                          <div className="grid-col-header col-o">O</div>

                          {Array.isArray(selectedTicket.cardMatrix) && selectedTicket.cardMatrix.map((cell, idx) => {
                            const isFree = cell.isFree || cell.val === 'FREE';
                            const val = cell.val;
                            const numVal = typeof val === 'number' ? val : parseInt(val as string, 10);
                            const isDrawn = !isNaN(numVal) && round.drawnNumbers.includes(numVal);
                            const isHighlight = isFree || (selectedTicket.isWinner && isDrawn);

                            return (
                              <div
                                key={idx}
                                className={`inspector-cell ${isFree ? 'cell-free' : ''} ${isDrawn ? 'cell-drawn' : ''} ${isHighlight ? 'cell-highlight' : ''}`}
                              >
                                {isFree ? (
                                  <i className="fa-solid fa-star text-gold"></i>
                                ) : (
                                  <span>{cell.val}</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default BetHistoryView;
