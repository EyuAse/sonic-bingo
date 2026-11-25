import React from 'react';
import { telegramService } from '../../services/telegramService.ts';

export type LobbyGameMode = 'bingo' | 'keno';

interface GameModeSwitcherProps {
  activeMode: LobbyGameMode;
  onSelectMode: (mode: LobbyGameMode) => void;
  bingoLabel?: string;
  kenoLabel?: string;
}

export const BingoBallIcon75: React.FC = () => (
  <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true" className="game-mode-ball-svg">
    <defs>
      <radialGradient id="bingoBallGrad75" cx="35%" cy="28%" r="68%">
        <stop offset="0%" stopColor="#64748b" />
        <stop offset="35%" stopColor="#1e293b" />
        <stop offset="80%" stopColor="#090f1d" />
        <stop offset="100%" stopColor="#020617" />
      </radialGradient>
    </defs>
    <circle cx="16" cy="16" r="15" fill="url(#bingoBallGrad75)" stroke="rgba(255,255,255,0.28)" strokeWidth="1" />
    <ellipse cx="12" cy="8.5" rx="6.5" ry="3.2" fill="rgba(255,255,255,0.35)" transform="rotate(-18 12 8.5)" />
    <circle cx="16" cy="16.5" r="10" fill="none" stroke="rgba(226,232,240,0.65)" strokeWidth="1.2" />
    <text
      x="16"
      y="20.2"
      textAnchor="middle"
      fill="#ffffff"
      fontSize="11.5"
      fontWeight="900"
      fontFamily="Outfit, Inter, system-ui, sans-serif"
    >
      75
    </text>
  </svg>
);

export const KenoBallIcon80: React.FC = () => (
  <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true" className="game-mode-ball-svg">
    <defs>
      <radialGradient id="kenoBallGrad80" cx="35%" cy="28%" r="68%">
        <stop offset="0%" stopColor="#5eead4" />
        <stop offset="35%" stopColor="#0f766e" />
        <stop offset="80%" stopColor="#064e3b" />
        <stop offset="100%" stopColor="#022c22" />
      </radialGradient>
    </defs>
    <circle cx="16" cy="16" r="15" fill="url(#kenoBallGrad80)" stroke="rgba(110,231,183,0.5)" strokeWidth="1" />
    <ellipse cx="12" cy="8.5" rx="6.5" ry="3.2" fill="rgba(255,255,255,0.38)" transform="rotate(-18 12 8.5)" />
    <circle cx="16" cy="16.5" r="10" fill="none" stroke="rgba(167,243,208,0.75)" strokeWidth="1.2" />
    <text
      x="16"
      y="20.2"
      textAnchor="middle"
      fill="#ffffff"
      fontSize="11.5"
      fontWeight="900"
      fontFamily="Outfit, Inter, system-ui, sans-serif"
    >
      80
    </text>
  </svg>
);

export const GameModeSwitcher: React.FC<GameModeSwitcherProps> = ({
  activeMode,
  onSelectMode,
  bingoLabel = 'Bingo',
  kenoLabel = 'Keno'
}) => {
  const handleSelect = (mode: LobbyGameMode) => {
    if (mode !== activeMode) {
      telegramService.triggerHaptic('light');
      onSelectMode(mode);
    }
  };

  return (
    <div className="game-mode-switcher-pill" role="tablist" aria-label="Select Game">
      <button
        type="button"
        role="tab"
        aria-selected={activeMode === 'bingo'}
        className={`game-mode-pill-btn ${activeMode === 'bingo' ? 'active' : ''}`}
        onClick={() => handleSelect('bingo')}
      >
        <BingoBallIcon75 />
        <span>{bingoLabel}</span>
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={activeMode === 'keno'}
        className={`game-mode-pill-btn ${activeMode === 'keno' ? 'active' : ''}`}
        onClick={() => handleSelect('keno')}
      >
        <KenoBallIcon80 />
        <span>{kenoLabel}</span>
      </button>
    </div>
  );
};
