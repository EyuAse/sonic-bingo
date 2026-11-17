import React from 'react';
import { useBingo } from '../../context/BingoContext.tsx';
import { useLanguage } from '../../context/LanguageContext.tsx';

export const SpectatorCard: React.FC = () => {
  const { buyTicket, lobbyCountdown, roundPhase, hasPreBoughtNext, roomMode, betAmount } = useBingo();
  const { t, lang } = useLanguage();

  const isLobby = roundPhase === 'lobby';
  const isPlaying = roundPhase === 'playing' || roundPhase === 'locked';
  const isSpectatingHouse = roomMode === 'spectating';
  const formattedCountdown = `00:${lobbyCountdown < 10 ? `0${lobbyCountdown}` : lobbyCountdown}`;

  return (
    <div className="fresh-spectator-card">
      {/* Cartoon Eyes Mascot with Sparkle Stars */}
      <div className="spectator-mascot-wrap">
        <svg className="mascot-eyes-svg" viewBox="0 0 160 160" fill="none">
          {/* Sparkle Stars */}
          <path d="M136 52L138 42L148 40L138 38L136 28L134 38L124 40L134 42L136 52Z" fill="#facc15" />
          <path d="M24 76L25 70L31 69L25 68L24 62L23 68L17 69L23 70L24 76Z" fill="#facc15" />

          {/* Main Cream Face */}
          <circle cx="80" cy="80" r="64" fill="#fefce8" stroke="#fef08a" strokeWidth="4" />
          
          {/* Left Eye */}
          <ellipse cx="62" cy="78" rx="16" ry="20" fill="#ffffff" stroke="#facc15" strokeWidth="2" />
          <circle cx="62" cy="78" r="11" fill="#0f172a" />
          <circle cx="58" cy="72" r="4.5" fill="#ffffff" />
          <circle cx="66" cy="83" r="2" fill="#ffffff" />

          {/* Right Eye */}
          <ellipse cx="98" cy="78" rx="16" ry="20" fill="#ffffff" stroke="#facc15" strokeWidth="2" />
          <circle cx="98" cy="78" r="11" fill="#0f172a" />
          <circle cx="94" cy="72" r="4.5" fill="#ffffff" />
          <circle cx="102" cy="83" r="2" fill="#ffffff" />
        </svg>
      </div>

      {/* Title & Subtitle */}
      <h3 className="spectator-card-title">
        {isSpectatingHouse
          ? (lang === 'am' ? 'ይህ ክፍል በመመልከት ላይ ነው' : 'House Spectating Live Stream')
          : t('bingo.spectatorTitle')}
      </h3>
      <p className="spectator-card-sub">
        {isSpectatingHouse
          ? (lang === 'am'
              ? `ይህ ${betAmount} ብር ክፍል ቢያንስ 2 ተጫዋቾች እስኪገቡ በመመልከት ላይ ነው።`
              : `This ${betAmount} ETB house is currently waiting for players.`)
          : (isPlaying
              ? (lang === 'am' ? 'የቀጥታ ጨዋታ በመካሄድ ላይ ነው። ጨዋታው ሲያልቅ ካርቴላ መግዛት ይችላሉ!' : 'A live round is currently in progress. You can buy cartelas as soon as this game completes!')
              : t('bingo.spectatorSub'))}
      </p>

      {/* Next Round Countdown Card / Live Status */}
      <div className="spectator-countdown-pill-card">
        {isLobby ? (
          <>
            <span className="countdown-tiny-lbl">{t('bingo.nextRoundIn')}</span>
            <strong className="countdown-digits-huge">{formattedCountdown}</strong>
          </>
        ) : (
          <>
            <span className="countdown-tiny-lbl">LIVE STATUS</span>
            <strong className="countdown-digits-huge" style={{ fontSize: '1.15rem', color: isSpectatingHouse ? '#eab308' : '#16a34a' }}>
              {isSpectatingHouse ? '👁️ SPECTATING LIVE STREAM' : '🎱 LIVE IN PROGRESS'}
            </strong>
          </>
        )}
      </div>

      {/* Action Button: Disabled during active gameplay */}
      <button
        type="button"
        className={`btn-spectator-buy-gold ${isPlaying ? 'disabled-waiting' : ''}`}
        onClick={isPlaying ? undefined : buyTicket}
        disabled={isPlaying}
        style={isPlaying ? { opacity: 0.65, cursor: 'not-allowed', filter: 'grayscale(0.3)' } : undefined}
      >
        <i className={isPlaying ? "fa-solid fa-hourglass-half" : "fa-solid fa-ticket"}></i>
        <span>
          {isPlaying
            ? (lang === 'am' ? 'ጨዋታው እስኪያልቅ ይጠብቁ...' : 'WAIT FOR GAME TO COMPLETE...')
            : t('bingo.buyTicket')}
        </span>
      </button>
    </div>
  );
};

