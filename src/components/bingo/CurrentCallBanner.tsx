import React from 'react';
import { useBingo } from '../../context/BingoContext.tsx';
import { useLanguage } from '../../context/LanguageContext.tsx';

// ── Column helpers ─────────────────────────────────────────
const getColClass = (num: number): string => {
  if (num <= 15) return 'b';
  if (num <= 30) return 'i';
  if (num <= 45) return 'n';
  if (num <= 60) return 'g';
  return 'o';
};

const getColLetter = (num: number): string => getColClass(num).toUpperCase();

export const CurrentCallBanner: React.FC = () => {
  const {
    currentCall,
    spherePop,
    calledNumbers,
    lobbyCountdown,
    roundPhase,
    waitingForPlayers,
    playersCount,
    realPlayerCount,
    activeUsersCount,
    hasTicket,
    betAmount,
    isMuted,
    toggleMute,
    autoPlay,
    isAutoModeLocked,
    toggleAutoPlay,
    waitingForOtherHouses,
    winnerCountdown
  } = useBingo();
  const { t, lang } = useLanguage();

  // Last 3-4 previous balls (skip the active one)
  const prevTrail = [...calledNumbers].reverse().slice(currentCall ? 1 : 0, 4);

  const mainColClass = currentCall
    ? `col-${currentCall.col.toLowerCase()}`
    : 'col-none';

  // Determine matchmaking status in lobby: countdown is strictly active when not waitingForPlayers!
  const isCountdown = roundPhase === 'lobby' && !waitingForPlayers;
  const is1Ready = roundPhase === 'lobby' && waitingForPlayers && (realPlayerCount >= 1 || hasTicket);
  const isMultipleInRoom = roundPhase === 'lobby' && waitingForPlayers && !is1Ready && activeUsersCount >= 2 && betAmount !== 10;
  const isWaitingAlone = roundPhase === 'lobby' && waitingForPlayers && !is1Ready && !isMultipleInRoom;

  return (
    <div className="sonic-lobby-call-card">
      {/* ── LOBBY VIEW (100% Exact Clone of Image 7) ── */}
      {roundPhase === 'lobby' ? (
        <div className="sonic-lobby-card-body">
          {/* Row 1: Rocket Lobby Title on left + Pitch-black obsidian countdown pill on right */}
          <div className="sonic-lobby-row-header">
            <div className="sonic-lobby-title-wrap">
              <span className="sonic-rocket-emoji" aria-hidden="true">🚀</span>
              <span className="sonic-lobby-title-txt">
                {lang === 'am' ? 'ሎቢ' : 'Lobby'}
              </span>
            </div>

            {/* Obsidian Countdown Pill */}
            <div className="sonic-obsidian-timer-pill">
              <span className="sonic-timer-clock-icon" aria-hidden="true">🕒</span>
              <span className="sonic-timer-seconds-txt">
                {isCountdown ? `${lobbyCountdown}s` : betAmount === 10 ? `${lobbyCountdown}s` : '45s'}
              </span>
            </div>
          </div>

          {/* Row 2: Full-width soft pill status */}
          <div className="sonic-lobby-row-status-pill">
            <span className="sonic-status-dot-pulse">🟢</span>
            <span className="sonic-status-primary-txt">
              {isCountdown
                ? (lang === 'am' ? `በ ${lobbyCountdown}s ይጀምራል!` : `Starts in ${lobbyCountdown}s!`)
                : is1Ready
                ? (lang === 'am' ? '1/2 ተጫዋች ዝግጁ ነው!' : '1/2 Players Ready!')
                : isMultipleInRoom
                ? (lang === 'am' ? `${activeUsersCount} ተጫዋቾች በክፍሉ አሉ` : `${activeUsersCount} Players in Room`)
                : betAmount === 10
                ? (lang === 'am' ? `${playersCount} ተጫዋቾች ዝግጁ!` : `${playersCount} Players Ready!`)
                : (lang === 'am' ? 'ተጫዋቾችን በመጠበቅ ላይ...' : 'Waiting for players...')}
            </span>
            <span className="sonic-status-sub-txt">
              {isCountdown
                ? (lang === 'am' ? 'ይዘጋጁ!' : 'Get ready!')
                : (lang === 'am' ? 'ካርቴላ ይግዙ!' : 'Buy ticket to play!')}
            </span>
          </div>

          {/* Row 3: Sound Pill Button on left + Auto Toggle on right */}
          <div className="sonic-lobby-row-controls">
            <button
              type="button"
              className={`sonic-sound-pill-btn ${isMuted ? 'is-muted' : 'is-active'}`}
              onClick={toggleMute}
              title={isMuted ? 'Sound Muted — Click to unmute' : 'Sound ON — Click to mute'}
              aria-label="Sound Toggle"
            >
              <span className="sound-text-label">Sound</span>
              <i className={`fa-solid ${isMuted ? 'fa-volume-xmark' : 'fa-volume-high'}`}></i>
            </button>

            <div
              className={`sonic-auto-toggle-wrap ${isAutoModeLocked ? 'is-locked' : ''}`}
              onClick={isAutoModeLocked ? undefined : toggleAutoPlay}
              role="button"
              tabIndex={0}
              title={
                isAutoModeLocked
                  ? (lang === 'am' ? '🔒 ጨዋታው እየተካሄደ ስለሆነ ሞድ መቀየር አይቻልም' : '🔒 Mode is locked while game is in progress')
                  : (autoPlay ? 'Auto Daub ON — Click to switch' : 'Auto Daub OFF — Click to switch')
              }
            >
              <span className="auto-text-label">Auto</span>
              <span className={`sonic-auto-obsidian-badge ${autoPlay ? 'badge-on' : 'badge-off'}`}>
                {autoPlay ? 'ON' : 'OFF'}
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* ── IN-GAME PLAYING / WINNER VIEW ── */
        <div className={`sonic-ingame-call-body ${spherePop ? 'call-pop' : ''}`}>
          <div className="sonic-call-top-row">
            <div className="sonic-call-left-meta">
              <span className="sonic-call-phase-badge">
                {roundPhase === 'winner'
                  ? (lang === 'am' ? '🏆 የአሸናፊ ማስታወቂያ' : '🏆 WINNER CALLED')
                  : (lang === 'am' ? 'የተጠራ ቁጥር' : 'CURRENT CALL')}
              </span>
              {currentCall && (
                <span className="sonic-call-column-hint">
                  Column {currentCall.col} · Ball #{calledNumbers.length}/75
                </span>
              )}
            </div>

            {/* Current Ball Pill */}
            <div className="sonic-call-right-ball">
              {roundPhase === 'winner' ? (
                <div className="sonic-ball-winner-pill">
                  <span>{waitingForOtherHouses ? '⏳' : '🏆'}</span>
                  <span>{waitingForOtherHouses ? 'Syncing...' : `${winnerCountdown}s`}</span>
                </div>
              ) : currentCall ? (
                <div className={`sonic-current-ball-capsule ${mainColClass}`}>
                  <span className="ball-col-letter">{currentCall.col}</span>
                  <span className="ball-dash">-</span>
                  <span className="ball-num-val">{currentCall.num}</span>
                </div>
              ) : (
                <div className="sonic-current-ball-capsule ball-waiting">
                  <span>--</span>
                </div>
              )}
            </div>
          </div>

          {/* Recent Balls Tray */}
          <div className="sonic-recent-tray-row">
            <span className="sonic-recent-tray-lbl">PREVIOUS:</span>
            <div className="sonic-recent-balls-list">
              {prevTrail.length > 0 ? (
                prevTrail.map((num, idx) => {
                  const colClass = getColClass(num);
                  const colLetter = getColLetter(num);
                  return (
                    <div key={`${num}-${idx}`} className={`sonic-recent-ball-dot col-${colClass}`}>
                      <span className="recent-letter">{colLetter}</span>
                      <span className="recent-num">{num}</span>
                    </div>
                  );
                })
              ) : (
                <span className="recent-tray-empty">Waiting for first ball...</span>
              )}
            </div>

            {/* In-game controls */}
            <div className="sonic-ingame-mini-controls">
              <button
                type="button"
                className="btn-mini-sound"
                onClick={toggleMute}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                <i className={`fa-solid ${isMuted ? 'fa-volume-xmark' : 'fa-volume-high'}`}></i>
              </button>
              <div
                className={`sonic-auto-toggle-wrap mini ${isAutoModeLocked ? 'is-locked' : ''}`}
                onClick={isAutoModeLocked ? undefined : toggleAutoPlay}
              >
                <span className="auto-text-label">Auto</span>
                <span className={`sonic-auto-obsidian-badge ${autoPlay ? 'badge-on' : 'badge-off'}`}>
                  {autoPlay ? 'ON' : 'OFF'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
