import React from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import { BigBingoCard } from '../components/games/BigBingoCard.tsx';
import { MoreGamesGrid } from '../components/games/MoreGamesGrid.tsx';
import { TreasureRewardBanner } from '../components/games/TreasureRewardBanner.tsx';

export const GamesPage: React.FC = () => {
  const { lang, t } = useLanguage();

  return (
    <div className="page active page-lobby-fresh" id="page-games">
      <main className="lobby-content-scroll-container">
        {/* 1. "Ready to Play?" Dark Obsidian Luxury Hero Banner */}
        <div className="lobby-ready-play-card">
          <div className="ready-gold-swoosh-bg" aria-hidden="true"></div>

          <div className="ready-text-group">
            <h2 className="ready-title-bold">
              {lang === 'am' ? 'ለመጫወት ዝግጁ ኖት?' : 'Ready to Play?'}
            </h2>
            <p className="ready-subtitle-txt">
              {lang === 'am' ? (
                <>
                  የእርስዎን እድለኛ ካርቴላ ይምረጡና
                  <br />
                  ቀጥታ <strong className="txt-gold-highlight">75-ኳስ ቢንጎ</strong> በብር ይጫወቱ!
                </>
              ) : (
                <>
                  Pick your lucky Cartela and play
                  <br />
                  live <strong className="txt-gold-highlight">75-Ball Bingo</strong> in ETB!
                </>
              )}
            </p>
          </div>

          <div className="ready-hero-graphic-wrap">
            <img
              src="/assets/images/ready-to-play-gift-hero.jpg"
              alt="Ready to Play 3D Luxury Gift Box, Coins and Lucky Balls"
              className="ready-hero-gift-img"
              loading="eager"
            />
          </div>
        </div>

        {/* 2. Hero Fast Bingo (75-Ball) Feature Card */}
        <BigBingoCard />

        {/* 3. "More fun, More wins!" Reward Banner with 75-Ball and Golden Treasure Chest */}
        <TreasureRewardBanner />

        {/* 4. "More Games" 2x2 Grid */}
        <MoreGamesGrid />
      </main>
    </div>
  );
};
