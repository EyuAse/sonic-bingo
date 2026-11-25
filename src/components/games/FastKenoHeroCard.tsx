import React from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { telegramService } from '../../services/telegramService.ts';

export const FastKenoHeroCard: React.FC = () => {
  const { switchPage } = useApp();
  const { lang } = useLanguage();

  const handleOpenKeno = () => {
    telegramService.triggerHaptic('medium');
    switchPage('keno');
  };

  return (
    <div
      className="keno-home-hero-card"
      onClick={handleOpenKeno}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleOpenKeno();
        }
      }}
      aria-label={lang === 'am' ? 'ፈጣን ኬኖ ይጫወቱ' : 'Play Fast Keno'}
    >
      {/* Background Hero Artwork using exact user image */}
      <img
        src="/assets/images/fast-keno-hero-exact.png"
        alt="Fast Keno 80 and 70 Balls"
        className="keno-home-hero-bg-img"
        loading="eager"
      />

      {/* Left emerald vignette ensures razor-sharp typography while balls shine on right */}
      <div className="keno-home-hero-scrim" aria-hidden="true"></div>

      {/* Left Overlay Content matching exact target reference */}
      <div className="keno-home-hero-content">
        <div className="keno-home-wordmark" aria-label="FASTKENO">
          <span className="keno-word-fast">FAST</span>
          <span className="keno-word-keno">KENO</span>
        </div>

        <p className="keno-home-subtitle">
          {lang === 'am' ? (
            <>
              እድለኛ ቁጥሮችዎን ይምረጡና
              <br />
              ትልቅ ሽልማት ያሸንፉ!
            </>
          ) : (
            <>
              Pick your lucky numbers
              <br />
              and win big!
            </>
          )}
        </p>

        <button
          type="button"
          className="btn-keno-home-cta"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenKeno();
          }}
        >
          <span>{lang === 'am' ? 'ኬኖ ይጫወቱ' : 'PLAY KENO'}</span>
          <i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
        </button>
      </div>
    </div>
  );
};
