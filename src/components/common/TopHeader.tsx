import React from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { useBingo } from '../../context/BingoContext.tsx';
import { LanguageDropdown } from './LanguageDropdown.tsx';

export const TopHeader: React.FC = () => {
  const { switchPage, showToast } = useApp();
  const { isMuted, toggleMute } = useBingo();

  return (
    <header className="lobby-fresh-header">
      {/* Left: Circular Hamburger Drawer Toggle */}
      <button
        type="button"
        className="btn-lobby-hamburger"
        id="header-menu-btn"
        onClick={() => switchPage('landing')}
        title="Menu"
        aria-label="Navigation Menu"
      >
        <i className="fa-solid fa-bars"></i>
      </button>

      {/* Center: Unified Sonic Bingo Brand + Language Selector Pill */}
      <div className="lobby-brand-lang-pill">
        <div
          className="brand-sonic-clickable"
          onClick={() => switchPage('games')}
          title="Sonic Bingo"
          role="button"
          tabIndex={0}
        >
          <span className="sonic-crown-emblem" aria-hidden="true">👑</span>
          <span className="brand-sonic-txt">SONIC</span>
          <span className="brand-pill-pipe" aria-hidden="true">|</span>
          <span className="brand-bingo-gold">BINGO</span>
        </div>

        <div className="brand-pill-divider" aria-hidden="true"></div>

        <LanguageDropdown />
      </div>

      {/* Right: Sound Mute/Unmute & Notification Bell Buttons */}
      <div className="lobby-header-right">
        {/* Sound Toggle */}
        <button
          type="button"
          className="btn-lobby-sound"
          onClick={toggleMute}
          title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
        >
          <i className={`fa-solid ${isMuted ? 'fa-volume-xmark' : 'fa-volume-high'}`}></i>
        </button>

        {/* Notification Bell */}
        <button
          type="button"
          className="btn-lobby-notif"
          id="header-notif-btn"
          onClick={() => showToast('🔔 No new unread notifications.')}
          title="Notifications"
          aria-label="Notifications"
        >
          <i className="fa-regular fa-bell"></i>
        </button>
      </div>
    </header>
  );
};
