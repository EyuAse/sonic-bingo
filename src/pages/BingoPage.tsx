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
    autoPlay, hasWinningPattern, hasSleptPattern, claimBingo, claimInProgress,
    totalPlayableCards, cardQuantity
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

  // Active card count: in lobby before ticket bought, use cardQuantity; once bought/playing, use totalPlayableCards
  const activeCardCount = (hasTicket || roundPhase !== 'lobby') ? totalPlayableCards : cardQuantity;
  // Dynamic layout rule: 3 or 4 cards hide the 1-75 flashboard so users focus 100% on their 2x2 cards!
  // 1 or 2 cards show the 1-75 flashboard on the left side!
  const is3or4Cards = activeCardCount >= 3;

  return (
    <div className={`fresh-bingo-page ${isDesktop ? 'is-desktop-view' : ''}`}>
      {/* Confetti Celebration for Wins */}
      <ConfettiCanvas active={showWinModal} />

      <div className={`bingo-page-content-wrapper ${isDesktop ? 'is-desktop-view' : ''}`}>

        {/* 1. Ultra-Slim Top Action Bar matching Image */}
        <div className="bingo-top-action-bar">
          <button
            type="button"
            className="btn-bingo-mini-back"
            onClick={handleBackClick}
            title="Back to Games"
          >
            <i className="fa-solid fa-chevron-left"></i>
          </button>
          <StatsStrip />
        </div>

        {/* Real-Time Network Resilience Alerts */}
        <NetworkStatusBanner />

        {/* 2. Top Banner: Current Call / Lobby Status Banner with Sound & Auto Toggles (Matching Image!) */}
        <CurrentCallBanner />

        {/* 3. Main Arena: Dynamic Layout Based on Card Count */}
        {is3or4Cards ? (
          /* 3-4 Cartelas: Full-Width 2x2 Grid (NO 1-75 flashboard, 100% focus on Cartelas!) */
          <div className="bingo-fullwidth-cartelas-area">
            {hasTicket || roundPhase === 'lobby' ? (
              <ErrorBoundary componentName="BingoGrid" fallback={null}>
                <BingoGrid isFullWidth={true} />
              </ErrorBoundary>
            ) : (
              <SpectatorCard />
            )}
          </div>
        ) : (
          /* 1-2 Cartelas: 2-Column Split Layout (1-75 Flashboard on LEFT, Cartelas on RIGHT) */
          <div className="bingo-split-layout-grid">
            <div className="bingo-left-flashboard-col">
              <MasterBoard75 />
            </div>
            <div className="bingo-right-cartelas-col">
              {hasTicket || roundPhase === 'lobby' ? (
                <ErrorBoundary componentName="BingoGrid" fallback={null}>
                  <BingoGrid isFullWidth={false} />
                </ErrorBoundary>
              ) : (
                <SpectatorCard />
              )}
            </div>
          </div>
        )}

        {/* 4. Bottom Controls (Lobby Betting Bar or In-Game Action Bar) */}
        {roundPhase === 'lobby' ? (
          <BettingBar />
        ) : roundPhase === 'playing' ? (
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
        ) : null}
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
