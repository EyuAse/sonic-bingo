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
    <div className="compact-current-call-block">
      {/* 1. Main Current Call Header Bar */}
      <div className={`compact-call-header ${spherePop ? 'call-pop' : ''}`}>
        <div className="compact-call-title">
          {roundPhase === 'playing'
            ? (lang === 'am' ? 'የተጠራ ቁጥር' : 'Current Call')
            : roundPhase === 'winner'
            ? (lang === 'am' ? 'የአሸናፊ ማስታወቂያ 🏆' : 'Round Concluded 🏆')
            : (lang === 'am' ? '🚀 ሎቢ' : '🚀 Lobby')}
        </div>

        <div className="compact-call-badge-wrap">
          {roundPhase === 'winner' ? (
            <div className="compact-current-ball-pill" style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fcd34d' }}>
              <span className="call-ball-col">{waitingForOtherHouses ? '⏳' : '🏆'}</span>
              <span className="call-ball-num lobby-status-text">
                {waitingForOtherHouses
                  ? (lang === 'am' ? 'ሌሎች ክፍሎች በመጠበቅ...' : 'Waiting other houses...')
                  : `${winnerCountdown}s`}
              </span>
            </div>
          ) : currentCall ? (
            <div className={`compact-current-ball-pill ${mainColClass}`}>
              <span className="call-ball-col">{currentCall.col}</span>
              <span className="call-ball-hyphen">-</span>
              <span className="call-ball-num">{currentCall.num}</span>
            </div>
          ) : roundPhase === 'lobby' ? (
            <div
              className={`compact-current-ball-pill lobby-timer ${
                isCountdown
                  ? 'countdown-active'
                  : is1Ready
                  ? 'ready-waiting'
                  : isMultipleInRoom
                  ? 'players-in-room'
                  : betAmount === 10
                  ? 'ready-waiting'
                  : 'waiting-match'
              }`}
            >
              <span className="call-ball-col">
                {isCountdown ? '⏱️' : (is1Ready || betAmount === 10) ? '🟡' : isMultipleInRoom ? '👥' : '⏳'}
              </span>
              <span className="call-ball-num lobby-status-text">
                {isCountdown
                  ? `${lobbyCountdown}s`
                  : is1Ready
                  ? (lang === 'am' ? '1/2 ዝግጁ' : '1/2 Ready')
                  : isMultipleInRoom
                  ? (lang === 'am' ? `${activeUsersCount} ተጫዋች` : `${activeUsersCount} in Room`)
                  : betAmount === 10
                  ? (lang === 'am' ? `${playersCount} ዝግጁ` : `${playersCount} Ready`)
                  : (lang === 'am' ? 'በመጠበቅ...' : 'Waiting...')}
              </span>
            </div>
          ) : (
            <div className="compact-current-ball-pill waiting">
              <span className="call-ball-col">🎱</span>
              <span className="call-ball-num">--</span>
            </div>
          )}
        </div>
      </div>

      {/* 2a. Full-Width Lobby Status Pill (Matching Reference Image 1) */}
      {roundPhase === 'lobby' && (
        <div className="lobby-fullwidth-status-pill">
          <span className="lobby-status-dot">●</span>
          <span className="lobby-status-main">
            {isCountdown
              ? (lang === 'am' ? `በ ${lobbyCountdown}s ይጀምራል!` : `Starts in ${lobbyCountdown}s!`)
              : is1Ready
              ? (lang === 'am' ? '1/2 ተጫዋች ዝግጁ' : '1/2 Players Ready')
              : isMultipleInRoom
              ? (lang === 'am' ? `${activeUsersCount} ተጫዋቾች አሉ` : `${activeUsersCount} in Room`)
              : betAmount === 10
              ? (lang === 'am' ? `${playersCount} ዝግጁ` : `${playersCount} Players Ready`)
              : (lang === 'am' ? 'ተጫዋች በመጠበቅ...' : 'Waiting for players...')}
          </span>
          <span className="lobby-status-sub">
            {isCountdown
              ? (lang === 'am' ? 'ይዘጋጁ!' : 'Get ready!')
              : (lang === 'am' ? 'ካርቴላ ይግዙ!' : 'Buy ticket to play!')}
          </span>
        </div>
      )}

      {/* 2b. Recent Balls Tray (Visible during active playing) */}
      {roundPhase !== 'lobby' && (
        <div className="compact-recent-balls-tray">
          <div className="compact-recent-balls-inner">
            {prevTrail.length > 0 ? (
              prevTrail.map((num, idx) => {
                const colClass = getColClass(num);
                const colLetter = getColLetter(num);
                return (
                  <div key={`${num}-${idx}`} className={`compact-recent-ball col-${colClass}`}>
                    <span className="recent-ball-col">{colLetter}</span>
                    <span className="recent-ball-num">{num}</span>
                  </div>
                );
              })
            ) : (
              <div className="compact-recent-empty-dots">
                <span className="recent-empty-ball">--</span>
                <span className="recent-empty-ball">--</span>
                <span className="recent-empty-ball">--</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. In-line Sound & Auto-Daub Controls Strip */}
      <div className="compact-call-controls-row">
        <button
          type="button"
          className={`btn-compact-sound ${isMuted ? 'muted' : 'active'}`}
          onClick={toggleMute}
          title={isMuted ? 'Sound Muted — Click to unmute' : 'Sound ON — Click to mute'}
        >
          <span className="sound-lbl">Sound</span>
          <i className={`fa-solid ${isMuted ? 'fa-volume-xmark' : 'fa-volume-high'}`}></i>
        </button>

        <button
          type="button"
          className={`btn-compact-auto ${autoPlay ? 'on' : 'off'} ${isAutoModeLocked ? 'locked' : ''}`}
          onClick={toggleAutoPlay}
          title={
            isAutoModeLocked
              ? (lang === 'am' ? '🔒 ጨዋታው እየተካሄደ ስለሆነ ሞድ መቀየር አይቻልም' : '🔒 Mode is locked while game is in progress')
              : (autoPlay ? 'Auto Daub ON — Click to switch' : 'Auto Daub OFF — Click to switch')
          }
        >
          <span className="auto-lbl">
            {isAutoModeLocked && <i className="fa-solid fa-lock auto-lock-icon"></i>}
            Auto
          </span>
          <span className={`auto-switch-pill ${autoPlay ? 'on' : 'off'} ${isAutoModeLocked ? 'locked' : ''}`}>
            {autoPlay ? 'ON' : 'OFF'}
          </span>
        </button>
      </div>
    </div>
  );
};
