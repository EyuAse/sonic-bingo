import React, { useState } from 'react';
import { useBingo } from '../context/BingoContext.tsx';
import { useApp } from '../context/AppContext.tsx';
import { CurrentCallBanner } from '../components/bingo/CurrentCallBanner.tsx';
import { StatsStrip } from '../components/bingo/StatsStrip.tsx';
import { SpectatorCard } from '../components/bingo/SpectatorCard.tsx';
import { BingoGrid } from '../components/bingo/BingoGrid.tsx';
import { BettingBar } from '../components/bingo/BettingBar.tsx';
import { WinModal, WinModalEmergencyFallback } from '../components/bingo/WinModal.tsx';
import { InsufficientBalanceModal } from '../components/bingo/InsufficientBalanceModal.tsx';
import { ConfettiCanvas } from '../components/common/ConfettiCanvas.tsx';
import { NetworkStatusBanner } from '../components/bingo/NetworkStatusBanner.tsx';
import { MasterBoard75 } from '../components/bingo/MasterBoard75.tsx';
import { LeaveConfirmModal } from '../components/bingo/LeaveConfirmModal.tsx';
import { CartelaPickerModal } from '../components/bingo/CartelaPickerModal.tsx';
import { ErrorBoundary } from '../components/common/ErrorBoundary.tsx';
import { telegramService } from '../services/telegramService.ts';

export const BingoPage: React.FC = () => {
  const isDesktop = telegramService.isDesktopPlatform();
  const {
    hasTicket, showWinModal,
    roundPhase, waitingForPlayers, realPlayerCount, lobbyCountdown, cancelLobbyTicket,
    autoPlay, hasWinningPattern, hasSleptPattern, claimBingo, claimInProgress
  } = useBingo();
  const { switchPage, showToast } = useApp();
  const [showLeaveModal, setShowLeaveModal] = useState<boolean>(false);

  // Safe Back Handler: If player is waiting in lobby with bought ticket, auto-refund on exit
  const handleBackClick = async () => {
    if (hasTicket && (roundPhase === 'lobby' || waitingForPlayers)) {
      await cancelLobbyTicket();
    }
    switchPage('games');
  };

  // Derive hero title text based on game phase
  const heroTitle = roundPhase === 'playing'
    ? 'GAME IN PROGRESS'
    : waitingForPlayers
    ? 'WAITING FOR PLAYERS'
    : `STARTS IN ${lobbyCountdown}s`;

  // Split into base and highlight
  const titleParts = heroTitle.split(' ');
  const heroTitleBase = titleParts.slice(0, -1).join(' ') + ' ';
  const heroTitleHighlight = titleParts[titleParts.length - 1];

  return (
    <div className={`fresh-bingo-page ${isDesktop ? 'is-desktop-view' : ''}`}>
      {/* Confetti Celebration for Wins */}
      <ConfettiCanvas active={showWinModal} />

      <div className={`bingo-page-content-wrapper ${isDesktop ? 'is-desktop-view' : ''}`}>

        {/* 1. Ultra-Slim Top Action Bar matching Image 2 */}
        <div className="bingo-top-action-bar">
          <button
            type="button"
            className="btn-bingo-mini-back"
            onClick={handleBackClick}
            title="Back to Games"
          >
            <i className="fa-solid fa-chevron-left"></i>
          </button>

          {/* 5-Box Game Status Strip from Image 2 */}
          <StatsStrip />
        </div>

        {/* Real-Time Network Resilience Alerts */}
        <NetworkStatusBanner />

        {/* ── Main Split 2-Column Board & Cartela Layout (Cartelas on Left, Flashboard 1-75 on Right) ── */}
        <div className="bingo-split-layout-grid">
          {/* Left Column: Active Cartelas (BingoGrid) or Spectator View */}
          <div className="bingo-left-cartela-col">
            {hasTicket || roundPhase === 'lobby' ? (
              <ErrorBoundary componentName="BingoGrid" fallback={null}>
                <BingoGrid />
              </ErrorBoundary>
            ) : (
              <SpectatorCard />
            )}
          </div>

          {/* Right Column: Current Call Banner, Flashboard 1-75, and Controls */}
          <div className="bingo-right-flashboard-col">
            <CurrentCallBanner />

            <MasterBoard75 />

            {/* Stake Bar: Visible strictly during lobby matchmaking only */}
            {roundPhase === 'lobby' && (
              <BettingBar />
            )}

            {/* In-Game Bottom Action Bar: Visible during active game! */}
            {roundPhase === 'playing' && (
              <div className="in-game-bottom-action-bar">
                <button
                  type="button"
                  className="btn-in-game-leave"
                  onClick={() => setShowLeaveModal(true)}
                  title="Leave this game round safely"
                >
                  <i className="fa-solid fa-arrow-right-from-bracket"></i>
                  <span>Leave Game</span>
                </button>

                {!autoPlay && (
                  <button
                    type="button"
                    disabled={claimInProgress}
                    className={`btn-in-game-bingo ${claimInProgress ? 'claiming' : ''}`}
                    onClick={() => {
                      if (claimInProgress) return;
                      if (hasWinningPattern) {
                        claimBingo();
                      } else if (hasSleptPattern) {
                        showToast("⚠️ Missed Bingo! That pattern expired because the next number was called. Complete another 5-in-a-row line to call BINGO!");
                      } else {
                        showToast("Complete any 5-in-a-row line on your card to call BINGO!");
                      }
                    }}
                    title={claimInProgress ? "Claiming your win..." : "Call BINGO to claim your win"}
                  >
                    <i className={claimInProgress ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-trophy"}></i>
                    <span>{claimInProgress ? 'CLAIMING...' : 'BINGO'}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Leave Game Confirmation Modal */}
      <LeaveConfirmModal
        isOpen={showLeaveModal}
        onConfirm={() => {
          setShowLeaveModal(false);
          switchPage('games');
        }}
        onCancel={() => setShowLeaveModal(false)}
      />

      {/* 600 Cartela Selection Modal */}
      <CartelaPickerModal />

      {/* Victory Celebration Modal — Guaranteed zero-error display */}
      <ErrorBoundary componentName="WinModal" fallback={<WinModalEmergencyFallback />}>
        <WinModal />
      </ErrorBoundary>

      {/* Insufficient Balance Pop-Up Alert Modal */}
      <InsufficientBalanceModal />
    </div>
  );
};
