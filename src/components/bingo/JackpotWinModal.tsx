import React from 'react';
import { useBingo } from '../../context/BingoContext.tsx';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { telegramService } from '../../services/telegramService.ts';

interface JackpotWinModalProps {
  onClose?: () => void;
  winnerName?: string;
  cartelaNumber?: number;
  jackpotAmount?: number;
  totalPayout?: number;
  ballsCount?: number;
  isUserWinner?: boolean;
}

export const JackpotWinModal: React.FC<JackpotWinModalProps> = ({
  onClose,
  winnerName: propWinnerName,
  cartelaNumber: propCartelaNum,
  jackpotAmount = 500,
  totalPayout: propTotalPayout,
  ballsCount: propBallsCount,
  isUserWinner: propIsUserWinner
}) => {
  const { winResult, closeWinModalAndRestart } = useBingo();
  const { lang } = useLanguage();

  const handleDismiss = onClose || closeWinModalAndRestart;

  const isUserWinner = propIsUserWinner !== undefined
    ? propIsUserWinner
    : (winResult?.winType === 'user_solo' || winResult?.winType === 'user_split');

  const winnerName = propWinnerName || winResult?.winnerName || 'Lucky Player';
  const cartelaNumber = propCartelaNum || winResult?.winningCartelaNumber || 77;
  const totalPayout = propTotalPayout || winResult?.winnerPayout || (jackpotAmount + 424);
  const ballsCount = propBallsCount || (winResult as any)?.ballsDrawn || 18;

  const handleShare = () => {
    telegramService.triggerHaptic('medium');
    const shareText = encodeURIComponent(
      `🔥 ጃክፖት ተመታ! I just won the 500 ETB PROGRESSIVE JACKPOT on Sonic Bingo!\n\n👑 Prize Won: +${jackpotAmount} ETB\n🎯 Cartela #${cartelaNumber}\n\nPlay with me on Telegram: https://t.me/SonicGameBot/play`
    );
    window.open(`https://t.me/share/url?url=${shareText}`, '_blank');
  };

  return (
    <div
      className="jackpot-celebration-backdrop"
      onClick={handleDismiss}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(9, 2, 20, 0.92)',
        backdropFilter: 'blur(12px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.3s ease-out'
      }}
    >
      {/* ── Outer Casino Stage (Inspired by Image 3) ── */}
      <div
        className="jackpot-celebration-card"
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '400px',
          background: 'radial-gradient(ellipse at 50% 25%, #2e0854 0%, #15092b 60%, #090214 100%)',
          borderRadius: '28px',
          padding: '30px 20px 24px',
          border: '2px solid rgba(250, 204, 21, 0.6)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(168, 85, 247, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
          textAlign: 'center',
          overflow: 'hidden'
        }}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={handleDismiss}
          style={{
            position: 'absolute',
            top: '14px',
            right: '14px',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#cbd5e1',
            fontSize: '14px',
            fontWeight: 900,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10
          }}
        >
          ✕
        </button>

        {/* Ambient Starburst Rays */}
        <div
          style={{
            position: 'absolute',
            top: '-20px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '320px',
            height: '200px',
            background: 'radial-gradient(circle, rgba(250, 204, 21, 0.35) 0%, rgba(168, 85, 247, 0.2) 40%, transparent 70%)',
            filter: 'blur(30px)',
            pointerEvents: 'none'
          }}
        />

        {/* Floating Confetti / Sparkles */}
        <span style={{ position: 'absolute', top: '15px', left: '20px', fontSize: '20px' }}>✨</span>
        <span style={{ position: 'absolute', top: '25px', right: '45px', fontSize: '22px' }}>🎉</span>
        <span style={{ position: 'absolute', bottom: '30px', left: '25px', fontSize: '18px' }}>🪙</span>
        <span style={{ position: 'absolute', bottom: '35px', right: '25px', fontSize: '20px' }}>⭐</span>

        {/* 1. 3D Royal Gold Crown (Image 3) */}
        <div style={{ marginBottom: '6px', display: 'flex', justifyContent: 'center' }}>
          <div
            style={{
              width: '76px',
              height: '76px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, #fef08a 0%, #facc15 50%, #ca8a04 100%)',
              padding: '3px',
              boxShadow: '0 8px 24px rgba(234, 179, 8, 0.6), inset 0 2px 4px rgba(255, 255, 255, 0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #1e1145 0%, #2e0854 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '38px',
                filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.5))'
              }}
            >
              👑
            </div>
          </div>
        </div>

        {/* 2. Marquee Bulb "JACKPOT" 3D Sign (Image 3) */}
        <div
          style={{
            position: 'relative',
            display: 'inline-block',
            margin: '8px 0 6px',
            transform: 'perspective(400px) rotateX(8deg)'
          }}
        >
          <div
            style={{
              fontSize: '38px',
              fontWeight: 900,
              letterSpacing: '5px',
              lineHeight: 1,
              fontFamily: '"Impact", "Arial Black", sans-serif',
              background: 'linear-gradient(180deg, #fffbeb 0%, #fef08a 30%, #facc15 65%, #ca8a04 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 4px 0 #854d0e) drop-shadow(0 6px 12px rgba(234, 179, 8, 0.8))',
              textShadow: '0 0 10px rgba(250, 204, 21, 0.8)'
            }}
          >
            JACKPOT
          </div>

          {/* Marquee Bulb Dots Row */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '2px' }}>
            {[...Array(7)].map((_, i) => (
              <span
                key={i}
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#fef08a',
                  boxShadow: '0 0 6px #fde047, 0 0 10px #facc15',
                  animation: `pulse ${(i % 2 === 0 ? 0.8 : 1.2)}s infinite alternate`
                }}
              />
            ))}
          </div>
        </div>

        {/* 3. Glowing Neon Cursive "You are a" Script (Image 3) */}
        <div
          style={{
            fontSize: '18px',
            fontFamily: '"Brush Script MT", "Caveat", cursive, sans-serif',
            color: '#f472b6',
            textShadow: '0 0 8px rgba(244, 114, 182, 0.9), 0 0 16px rgba(236, 72, 153, 0.6)',
            margin: '4px 0 2px'
          }}
        >
          {isUserWinner ? (lang === 'am' ? 'እንኳን ደስ አለዎት እርስዎ' : 'You are a') : (lang === 'am' ? 'የዙሩ ታላቅ አሸናፊ' : 'Round Winner')}
        </div>

        {/* 4. Electric Cyan Neon "MEGA WINNER!" (Image 3) */}
        <div
          style={{
            fontSize: '24px',
            fontWeight: 900,
            letterSpacing: '2px',
            textTransform: 'uppercase',
            color: '#67e8f9',
            textShadow: '0 0 10px #06b6d4, 0 0 20px #0891b2, 0 0 30px #0e7490',
            marginBottom: '16px'
          }}
        >
          {isUserWinner ? (lang === 'am' ? 'ጃክፖት አሸናፊ!' : 'JACKPOT WINNER!') : `${winnerName}!`}
        </div>

        {/* 5. Glowing Royal Magenta/Gold Ribbon with Prize (Image 3) */}
        <div
          style={{
            background: 'linear-gradient(135deg, #701a75 0%, #4a044e 50%, #2e0854 100%)',
            border: '2px solid #facc15',
            borderRadius: '18px',
            padding: '14px 18px',
            boxShadow: '0 8px 24px rgba(112, 26, 117, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
            marginBottom: '16px'
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#fef08a', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px' }}>
            {lang === 'am' ? 'የተሸለመው የጃክፖት ገንዘብ' : 'JACKPOT PRIZE AWARDED'}
          </div>
          <div
            style={{
              fontSize: '32px',
              fontWeight: 900,
              color: '#ffffff',
              letterSpacing: '1px',
              textShadow: '0 2px 8px rgba(0, 0, 0, 0.8), 0 0 12px rgba(250, 204, 21, 0.7)'
            }}
          >
            +{jackpotAmount}.00 ETB
          </div>
          <div style={{ fontSize: '11px', color: '#86efac', fontWeight: 800, marginTop: '4px' }}>
            {isUserWinner
              ? (lang === 'am' ? '✓ በቀጥታ ወደ ቦርሳዎ ገቢ ተደርጓል!' : '✓ Instantly credited to your wallet!')
              : `Cartela #${cartelaNumber} • ${ballsCount} Balls`}
          </div>
        </div>

        {/* Winner & Round Metadata Card */}
        <div
          style={{
            background: 'rgba(15, 7, 34, 0.7)',
            borderRadius: '14px',
            padding: '10px 14px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            marginBottom: '18px',
            fontSize: '12px'
          }}
        >
          <div>
            <span style={{ color: '#94a3b8', display: 'block', fontSize: '10px' }}>WINNER</span>
            <strong style={{ color: '#ffffff' }}>{winnerName}</strong>
          </div>
          <div style={{ width: '1px', height: '24px', background: 'rgba(255, 255, 255, 0.1)' }}></div>
          <div>
            <span style={{ color: '#94a3b8', display: 'block', fontSize: '10px' }}>CARTELA</span>
            <strong style={{ color: '#facc15' }}>#{cartelaNumber}</strong>
          </div>
          <div style={{ width: '1px', height: '24px', background: 'rgba(255, 255, 255, 0.1)' }}></div>
          <div>
            <span style={{ color: '#94a3b8', display: 'block', fontSize: '10px' }}>TOTAL POT</span>
            <strong style={{ color: '#4ade80' }}>{totalPayout} ETB</strong>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            type="button"
            onClick={handleDismiss}
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, #fef08a 0%, #facc15 35%, #eab308 70%, #ca8a04 100%)',
              color: '#0f172a',
              border: 'none',
              borderRadius: '14px',
              padding: '13px 20px',
              fontSize: '15px',
              fontWeight: 900,
              cursor: 'pointer',
              boxShadow: '0 6px 18px rgba(234, 179, 8, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <i className="fa-solid fa-play"></i>
            <span>{isUserWinner ? `CLAIM ${jackpotAmount} ETB & PLAY NEXT` : 'PLAY NEXT ROUND'}</span>
          </button>

          {isUserWinner && (
            <button
              type="button"
              onClick={handleShare}
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '14px',
                padding: '11px 16px',
                fontSize: '13px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <i className="fa-brands fa-telegram" style={{ color: '#38bdf8' }}></i>
              <span>{lang === 'am' ? '📲 ለጓደኞችዎ ያጋሩ' : '📲 SHARE WITH YOUR FRIENDS'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

