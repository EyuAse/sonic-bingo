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

  // Short round game code
  const gameId = `KI-${betAmount}`;

  // Matchmaking player display for clarity: never show misleading "0/2" or "2/2 ⏳" when waiting for opponent
  const isLobbyWaiting = roundPhase === 'lobby' && waitingForPlayers;
  const effectiveInRoom = Math.max(activeUsersCount, currentPlayers, hasTicket ? (cardQuantity || 1) : 0);
  const playersDisplay = isLobbyWaiting
    ? (betAmount === 10
        ? `${effectivePlayerCount}`
        : (effectivePlayerCount >= 1 || hasTicket
            ? '1/2 ⏳'
            : (effectiveInRoom >= 2
                ? (lang === 'am' ? `${effectiveInRoom} ተጫዋች` : `${effectiveInRoom} in Room`)
                : (lang === 'am' ? 'ይጠብቁ ⏳' : 'Waiting ⏳'))))
    : (isSpectatingHouse && roundPhase === 'playing'
        ? (lang === 'am' ? 'እይታ 👁️' : 'Spectate 👁️')
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

      <div className="bingo-top-status-strip">
        {/* 1. Game ID */}
        <div className="status-strip-box gameid-strip-box">
          <span className="status-strip-lbl">GAME ID</span>
          <span className="status-strip-val text-dark-val">{gameId}</span>
        </div>

        {/* 2. Derash (ደራሽ / Prize Pool 70%) */}
        <div className="status-strip-box derash-box">
          <span className="status-strip-lbl">{lang === 'am' ? 'ደራሽ (70%)' : 'DERASH (70%)'}</span>
          <span className="status-strip-val text-green">{prizeDisplay}</span>
        </div>

        {/* 3. Progressive Jackpot Vault (10% Pool) */}
        <div className="status-strip-box jackpot-strip-box" title="Progressive Jackpot">
          <div className="jackpot-hdr-row">
            <span className="jackpot-crown-emblem">👑</span>
            <span className="status-strip-lbl jackpot-lbl">{lang === 'am' ? 'ጃክፖት' : 'JACKPOT'}</span>
          </div>
          <span className="status-strip-val jackpot-val">
            {jackpotPool >= 1000 ? `${(jackpotPool / 1000).toFixed(1)}K` : `${jackpotPool || 526}`}
          </span>
        </div>

        {/* 4. Players */}
        <div className={`status-strip-box players-strip-box ${isLobbyWaiting ? 'waiting-match' : ''}`}>
          <div className="players-hdr-row">
            <i className="fa-solid fa-users players-hdr-icon"></i>
            <span className="status-strip-lbl">{lang === 'am' ? 'ተጫዋቾች' : 'PLAYERS'}</span>
          </div>
          <span className={`status-strip-val ${isLobbyWaiting ? 'text-gold' : 'text-dark-val'}`}>{playersDisplay}</span>
        </div>

        {/* 5. Stake */}
        <div
          className={`status-strip-box stake-strip-box ${canSwitchStake ? 'clickable-stake-pill' : ''}`}
          onClick={canSwitchStake ? () => setShowStakeModal(true) : undefined}
          title={canSwitchStake ? "Tap to change stake room" : undefined}
          style={{ cursor: canSwitchStake ? 'pointer' : 'default' }}
        >
          <div className="stake-hdr-row">
            <span className="stake-b-medallion">Ⓑ</span>
            <span className="status-strip-lbl">{lang === 'am' ? 'መደብ' : 'STAKE'}</span>
          </div>
          <span className="status-strip-val text-dark-val">
            {betAmount}
            {canSwitchStake && <span className="stake-down-chevron">⌵</span>}
          </span>
        </div>
      </div>
    </>
  );
};
