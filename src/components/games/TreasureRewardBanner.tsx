import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { useApp } from '../../context/AppContext.tsx';

export const TreasureRewardBanner: React.FC = () => {
  const { lang } = useLanguage();
  const { switchPage } = useApp();

  return (
    <div
      className="lobby-rewards-chest-card"
      onClick={() => switchPage('affiliate')}
      role="button"
      tabIndex={0}
      title="Rewards & Bonuses"
    >
      {/* Left: 3D Glossy Balls Cluster (75, 32, 61) */}
      <div className="chest-balls-cluster-left">
        {/* Top: 75 Ball (Cyan Blue Glossy) */}
        <div className="chest-3d-ball ball-blue-75">
          <div className="ball-inner-ring">
            <span className="ball-num-bold">75</span>
          </div>
          <div className="ball-gloss-highlight"></div>
        </div>

        {/* Bottom Pair: 32 (Green) & 61 (Magenta) */}
        <div className="chest-balls-bottom-row">
          <div className="chest-3d-ball ball-green-32">
            <div className="ball-inner-ring">
              <span className="ball-num-bold">32</span>
            </div>
            <div className="ball-gloss-highlight"></div>
          </div>

          <div className="chest-3d-ball ball-magenta-61">
            <div className="ball-inner-ring">
              <span className="ball-num-bold">61</span>
            </div>
            <div className="ball-gloss-highlight"></div>
          </div>
        </div>
      </div>

      {/* Center Text */}
      <div className="chest-center-text">
        <h3 className="chest-title-bold">
          {lang === 'am' ? 'ተጨማሪ ደስታ፣ ተጨማሪ ድሎች!' : 'More fun, More wins!'}
        </h3>
        <p className="chest-sub-txt">
          {lang === 'am' ? 'ይጫወቱ፣ ያሸንፉ እና በታላቅ ሽልማቶች ይደሰቱ!' : 'Play, Win & Enjoy Big Rewards!'}
        </p>
      </div>

      {/* Right: Glowing 3D Golden Treasure Chest Overflowing with Coins */}
      <div className="chest-graphic-right">
        <img
          src="/assets/images/sonic-rewards-chest-coins.png"
          alt="Golden Treasure Chest with Coins"
          className="treasure-chest-3d-img"
          loading="lazy"
        />
      </div>
    </div>
  );
};
