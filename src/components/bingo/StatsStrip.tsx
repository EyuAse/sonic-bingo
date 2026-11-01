import React, { useState } from 'react';
import { useBingo } from '../../context/BingoContext.tsx';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { StakeRoomSelectorModal } from '../games/StakeRoomSelectorModal.tsx';

export const StatsStrip: React.FC = () => {
  const {
    betAmount,
    setBetAmount,
    jackpotPool,
    prizePool,
    totalPot,
    playersCount,
    realPlayerCount,
    activeUsersCount,
    calledNumbers,
    roundPhase,
    waitingForPlayers,
    hasTicket,
    cardQuantity,
    roomMode
  } = useBingo();
  const { lang } = useLanguage();
  const [showStakeModal, setShowStakeModal] = useState<boolean>(false);

  const isSpectatingHouse = roomMode === 'spectating' && !hasTicket;
  const currentPlayers = betAmount === 10
    ? playersCount
    : (realPlayerCount > 0 ? realPlayerCount : playersCount);

  // Effective player count — reflects live active players in room plus locally held tickets if pending sync
  const effectivePlayerCount = hasTicket
    ? Math.max(currentPlayers, cardQuantity || 1)
    : currentPlayers;

  // Dynamic Real-Flow Derash Calculation (70% Winner Payout):
  // 70% winner payout, 10% progressive jackpot contribution, 20% house fee
  const expectedPot = effectivePlayerCount * betAmount;
  const calculatedPrize = Math.floor(expectedPot * 0.70);

  // Derash strictly displays the net prize pool (70% share)
  const currentPrize = prizePool > 0 ? prizePool : calculatedPrize;

  const prizeDisplay = isSpectatingHouse && roundPhase === 'playing'
    ? '0'
    : (currentPrize >= 1000 ? `${(currentPrize / 1000).toFixed(1)}K` : `${currentPrize}`);

  // Short round game code matching Image 1: KI-10
  const gameId = `KI-${betAmount}`;

  // Matchmaking player display for clarity
  const isLobbyWaiting = roundPhase === 'lobby' && waitingForPlayers;
  const effectiveInRoom = Math.max(activeUsersCount, currentPlayers, hasTicket ? (cardQuantity || 1) : 0);
  const playersDisplay = isLobbyWaiting
    ? (betAmount === 10
        ? `${effectivePlayerCount}`
        : (effectivePlayerCount >= 1 || hasTicket
            ? '1/2 ⏳'
            : (effectiveInRoom >= 2
                ? (lang === 'am' ? `${effectiveInRoom}` : `${effectiveInRoom}`)
                : (lang === 'am' ? '1' : '1'))))
    : (isSpectatingHouse && roundPhase === 'playing'
        ? (lang === 'am' ? 'እይታ 👁️' : 'Spec 👁️')
        : `${betAmount === 10 ? effectivePlayerCount : Math.max(currentPlayers, hasTicket ? (cardQuantity || 1) : 0)}`);

  const canSwitchStake = roundPhase === 'lobby' || !hasTicket;

  return (
    <>
      <StakeRoomSelectorModal
        isOpen={showStakeModal}
        onClose={() => setShowStakeModal(false)}
        onSelectStake={(stake) => {
          setBetAmount(stake);
          setShowStakeModal(false);
        }}
      />

      <div className="sonic-stats-pill-strip">
        {/* 1. GAME ID Pill */}
        <div className="sonic-stat-pill pill-game-id">
          <span className="sonic-pill-meta-lbl">GAME ID</span>
          <span className="sonic-pill-main-val val-game-id">{gameId}</span>
        </div>

        {/* 2. DERASH (70%) Pill */}
        <div className="sonic-stat-pill pill-derash">
          <span className="sonic-pill-meta-lbl">
            {lang === 'am' ? 'ደራሽ (70%)' : 'DERASH (70%)'}
          </span>
          <span className="sonic-pill-main-val val-derash">{prizeDisplay}</span>
        </div>

        {/* 3. 👑 JACKPOT Radiant Gold Pill */}
        <div
          className="sonic-stat-pill pill-jackpot-radiant-gold"
          title="Progressive 10% Jackpot Vault (Won in <= 18 balls)"
        >
          <div className="sonic-pill-jackpot-header">
            <span className="jackpot-crown-icon" aria-hidden="true">👑</span>
            <span className="jackpot-title-txt">JACKPOT</span>
          </div>
          <span className="sonic-pill-main-val val-jackpot">
            {jackpotPool >= 1000 ? `${(jackpotPool / 1000).toFixed(1)}K` : jackpotPool}
          </span>
        </div>

        {/* 4. PLAYERS Pill with users icon */}
        <div className={`sonic-stat-pill pill-players ${isLobbyWaiting ? 'waiting-mode' : ''}`}>
          <i className="fa-solid fa-users sonic-pill-leading-icon" aria-hidden="true"></i>
          <div className="sonic-pill-col">
            <span className="sonic-pill-meta-lbl">
              {lang === 'am' ? 'ተጫዋች' : 'PLAYERS'}
            </span>
            <span className="sonic-pill-main-val val-players">{playersDisplay}</span>
          </div>
        </div>

        {/* 5. STAKE Pill with golden B coin badge and dropdown chevron */}
        <div
          className={`sonic-stat-pill pill-stake ${canSwitchStake ? 'is-clickable' : ''}`}
          onClick={canSwitchStake ? () => setShowStakeModal(true) : undefined}
          title={canSwitchStake ? "Tap to change stake room" : undefined}
        >
          <span className="sonic-b-coin-badge" aria-hidden="true">B</span>
          <div className="sonic-pill-col">
            <span className="sonic-pill-meta-lbl">
              {lang === 'am' ? 'መደብ' : 'STAKE'}
            </span>
            <span className="sonic-pill-main-val val-stake">{betAmount}</span>
          </div>
          {canSwitchStake && (
            <i className="fa-solid fa-chevron-down sonic-pill-trailing-chevron" aria-hidden="true"></i>
          )}
        </div>

        {/* 6. Called balls count during active gameplay */}
        {roundPhase === 'playing' && calledNumbers.length > 0 && (
          <div className="sonic-stat-pill pill-called">
            <span className="sonic-pill-meta-lbl">
              {lang === 'am' ? 'የተጠራ' : 'CALLED'}
            </span>
            <span className="sonic-pill-main-val val-called">{calledNumbers.length}</span>
          </div>
        )}
      </div>
    </>
  );
};
