import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import { BigBingoCard } from '../components/games/BigBingoCard.tsx';
import { FastKenoHeroCard } from '../components/games/FastKenoHeroCard.tsx';
import { GameModeSwitcher, LobbyGameMode } from '../components/games/GameModeSwitcher.tsx';
import { MoreGamesGrid } from '../components/games/MoreGamesGrid.tsx';
import { TreasureRewardBanner } from '../components/games/TreasureRewardBanner.tsx';

export const GamesPage: React.FC = () => {
  const { lang } = useLanguage();
  const [activeGameMode, setActiveGameMode] = useState<LobbyGameMode>('bingo');

  return (
    <div className="page active page-lobby-fresh" id="page-games">
      <main className="lobby-content-scroll-container">
        {/* 1. Bingo (75) / Keno (80) Pill Mode Switcher */}
        <GameModeSwitcher
          activeMode={activeGameMode}
          onSelectMode={setActiveGameMode}
          bingoLabel={lang === 'am' ? 'ቢንጎ' : 'Bingo'}
          kenoLabel={lang === 'am' ? 'ኬኖ' : 'Keno'}
        />

        {/* 2. Active Game Hero Feature Card */}
        {activeGameMode === 'bingo' ? <BigBingoCard /> : <FastKenoHeroCard />}

        {/* 3. "More fun, More wins!" Reward Banner with 75-Ball and Golden Treasure Chest */}
        <TreasureRewardBanner />

        {/* 4. "More Games" 2x2 Grid */}
        <MoreGamesGrid />
      </main>
    </div>
  );
};
