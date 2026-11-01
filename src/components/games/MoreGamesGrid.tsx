import React from 'react';
import { useApp } from '../../context/AppContext.tsx';

interface GameCardItem {
  id: string;
  title: string;
  subtitle: string;
  img: string;
  playerCount: string;
  tag?: string;
}

const gameList: GameCardItem[] = [
  {
    id: 'lucky-mines',
    title: 'Lucky Mines',
    subtitle: 'Diamond Multiplier',
    img: '/assets/images/lucky-mines.jpg',
    playerCount: '1,024',
    tag: 'SOON'
  },
  {
    id: 'fast-keno',
    title: 'Fast Keno',
    subtitle: 'Instant Win',
    img: '/assets/images/fast-keno.jpg',
    playerCount: '543',
    tag: 'SOON'
  },
  {
    id: 'aviator',
    title: 'Aviator',
    subtitle: 'Crash Multiplier',
    img: '/assets/images/aviator.png',
    playerCount: '312',
    tag: 'SOON'
  },
  {
    id: 'chicken-road',
    title: 'Chicken Road',
    subtitle: 'Mini Arcade',
    img: '/assets/images/chicken-road.jpg',
    playerCount: '278',
    tag: 'SOON'
  }
];

export const MoreGamesGrid: React.FC = () => {
  const { showToast } = useApp();

  const handleGameClick = (game: GameCardItem) => {
    showToast(`🚀 ${game.title} is coming soon! Instant Play will be unlocked in the next release.`);
  };

  return (
    <section className="fresh-more-games-section">
      {/* Section Header: All Games | View All ➔ */}
      <div className="fresh-games-section-header">
        <div className="section-title-left">
          <span className="lemon-emoji-title">🍋</span>
          <h2 className="title-text-bold">More Games</h2>
        </div>

        <button
          type="button"
          className="btn-view-all-green"
          onClick={() => showToast('✨ Showing all upcoming mini-games!')}
        >
          <span>View All</span>
          <i className="fa-solid fa-arrow-right"></i>
        </button>
      </div>

      {/* 2x2 Grid of Game Cards */}
      <div className="fresh-game-cards-grid">
        {gameList.map(game => (
          <div
            key={game.id}
            className="fresh-mini-game-card"
            onClick={() => handleGameClick(game)}
          >
            {/* Image Artwork Container */}
            <div className="game-card-thumbnail-wrap">
              <img src={game.img} alt={game.title} className="game-card-img" />

              {/* Player Count & SOON Badge */}
              <div className="game-card-top-pill">
                <i className="fa-solid fa-user-group"></i>
                <span>{game.playerCount}</span>
                {game.tag && <span className="tag-soon-mini">{game.tag}</span>}
              </div>
            </div>

            {/* Game Meta Labels */}
            <div className="game-card-meta">
              <h3 className="game-card-name">{game.title}</h3>
              <span className="game-card-category">{game.subtitle}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
