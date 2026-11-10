import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { StakeRoomSelectorModal } from './StakeRoomSelectorModal.tsx';

export const BigBingoCard: React.FC = () => {
  const { lang } = useLanguage();
  const [showStakeModal, setShowStakeModal] = useState<boolean>(false);

  const handlePlayNow = () => {
    setShowStakeModal(true);
  };

  return (
    <div className="fresh-fast-bingo-card">
      {/* Top Badges Row */}
      <div className="card-top-badges">
        <span className="badge-live-room-emerald">
          <span className="emerald-pulse-dot" aria-hidden="true"></span>
          <span>{lang === 'am' ? 'ቀጥታ ስርጭት' : 'LIVE ROOM'}</span>
        </span>

        <span className="badge-live-arena-peach">
          <span className="fire-emoji-icon" aria-hidden="true">🔥</span>
          <span>{lang === 'am' ? 'ቀጥታ ቢንጎ አሬና' : 'LIVE ARENA'}</span>
        </span>
      </div>

      {/* Main Content: Left Info & Right 3D Artwork */}
      <div className="card-main-split">
        {/* Left Info Column */}
        <div className="card-left-info">
          <h3 className="card-title-fast">
            {lang === 'am' ? 'ፈጣን ቢንጎ' : 'Fast Bingo'}
          </h3>

          <span className="badge-75-ball-action">
            {lang === 'am' ? '75-ኳስ ፈጣን ጨዋታ' : '75-Ball Fast Action'}
          </span>

          <div className="stakes-values-txt">10 - 20 - 50 - 100 ETB</div>

          <div className="stakes-limits-sub">
            {lang === 'am' ? 'ዝቅተኛ፡ 10 ብር • ፈጣን የቢንጎ ክፍል' : 'Min: 10 ETB • Fast Bingo Arena'}
          </div>

          {/* Micro Stats: Signup Bonus & Multiplier */}
          <div className="card-micro-stats-row">
            <div className="micro-stat-item">
              <div className="stat-icon-circ" aria-hidden="true">
                <i className="fa-solid fa-users"></i>
              </div>
              <div className="stat-text-meta">
                <strong className="stat-bold-val">20 ETB</strong>
                <span className="stat-sub-lbl">
                  {lang === 'am' ? 'የመመዝገቢያ ቦነስ' : 'Signup Bonus'}
                </span>
              </div>
            </div>

            <div className="micro-stat-item">
              <div className="stat-icon-circ" aria-hidden="true">
                <i className="fa-solid fa-trophy"></i>
              </div>
              <div className="stat-text-meta">
                <strong className="stat-bold-val">45x MULTI</strong>
                <span className="stat-sub-lbl">
                  {lang === 'am' ? 'እስከ 4,500 ብር' : 'Up to 4500 ETB'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right 3D Artwork Column with Exact Image */}
        <div className="card-right-art">
          <img
            src="/assets/images/fast-bingo-exact-hero.jpg"
            alt="Fast Bingo 3D Cards, Crown Coin and Balls"
            className="fast-bingo-3d-hero-img"
            loading="eager"
          />
        </div>
      </div>

      {/* Full-width Pitch-Black Obsidian CTA Button */}
      <button
        type="button"
        className="btn-obsidian-fast-bingo-cta"
        onClick={handlePlayNow}
        aria-label={lang === 'am' ? 'ቢንጎ ይጫወቱ' : 'Play Bingo'}
      >
        <span>
          {lang === 'am' ? 'ቢንጎ ይጫወቱ' : 'Play Bingo'}
        </span>
        <i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
      </button>

      {/* Stake Room Selection Modal */}
      <StakeRoomSelectorModal
        isOpen={showStakeModal}
        onClose={() => setShowStakeModal(false)}
      />
    </div>
  );
};
