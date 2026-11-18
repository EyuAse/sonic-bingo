import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { useBingo } from '../context/BingoContext.tsx';
import { useLanguage } from '../context/LanguageContext.tsx';
import { telegramService } from '../services/telegramService.ts';

interface WinnerHistoryItem {
  id: string;
  winnerName: string;
  cartelaNumber: number;
  amount: number;
  ballsCount: number;
  dateStr: string;
  isBot?: boolean;
}

export const JackpotPage: React.FC = () => {
  const { switchPage } = useApp();
  const { jackpotPool, setBetAmount } = useBingo();
  const { lang } = useLanguage();

  const [recentWinners, setRecentWinners] = useState<WinnerHistoryItem[]>([
    {
      id: 'JW-101',
      winnerName: 'Selamawit T.',
      cartelaNumber: 42,
      amount: 500,
      ballsCount: 18,
      dateStr: 'Today, 2:40 PM',
      isBot: false
    },
    {
      id: 'JW-100',
      winnerName: 'Kalkidan B.',
      cartelaNumber: 15,
      amount: 500,
      ballsCount: 19,
      dateStr: 'Yesterday',
      isBot: true
    },
    {
      id: 'JW-099',
      winnerName: 'Yonas M.',
      cartelaNumber: 88,
      amount: 500,
      ballsCount: 17,
      dateStr: '2 days ago',
      isBot: false
    }
  ]);

  const poolAmount = Math.max(0, Math.floor(jackpotPool ?? 280));
  const progressPercent = Math.min(100, Math.max(5, (poolAmount / 500) * 100));
  const isReadyToDrop = poolAmount >= 500;

  const handlePlayBingo = () => {
    telegramService.triggerHaptic('medium');
    setBetAmount(10);
    switchPage('bingo');
  };

  return (
    <div
      className="jackpot-hub-page"
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(ellipse at 50% 0%, #2e0854 0%, #150928 50%, #080314 100%)',
        color: '#ffffff',
        paddingBottom: '90px',
        overflowX: 'hidden'
      }}
    >
      {/* Top Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          background: 'rgba(21, 9, 40, 0.85)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(255, 215, 0, 0.15)',
          position: 'sticky',
          top: 0,
          zIndex: 40
        }}
      >
        <button
          type="button"
          onClick={() => switchPage('games')}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#facc15',
            fontSize: '14px',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <i className="fa-solid fa-arrow-left"></i>
          <span>{lang === 'am' ? 'ጨዋታዎች' : 'Games'}</span>
        </button>

        <h1
          style={{
            fontSize: '16px',
            fontWeight: 900,
            margin: 0,
            letterSpacing: '0.5px',
            background: 'linear-gradient(135deg, #fffbeb 0%, #fef08a 40%, #facc15 70%, #eab308 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <span>👑</span>
          <span>{lang === 'am' ? 'ታላቁ ጃክፖት 500' : 'GRAND JACKPOT 500'}</span>
        </h1>

        <div style={{ width: '40px' }}></div>
      </div>

      <div style={{ maxWidth: '440px', margin: '0 auto', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* ── 3D HERO "HIT THE JACKPOT" BANNER (Inspired by Image 2) ── */}
        <div
          style={{
            position: 'relative',
            background: 'linear-gradient(145deg, #3b0764 0%, #1e1145 60%, #13092b 100%)',
            borderRadius: '24px',
            padding: '24px 18px 20px',
            border: '2px solid rgba(250, 204, 21, 0.4)',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 0 24px rgba(234, 179, 8, 0.25)',
            textAlign: 'center',
            overflow: 'hidden'
          }}
        >
          {/* Ambient Gold Glow Aura */}
          <div
            style={{
              position: 'absolute',
              top: '-40px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '260px',
              height: '140px',
              background: 'radial-gradient(circle, rgba(250, 204, 21, 0.35) 0%, transparent 70%)',
              filter: 'blur(25px)',
              pointerEvents: 'none'
            }}
          />

          {/* Floating Gold Coin Emblems */}
          <span style={{ position: 'absolute', top: '16px', left: '16px', fontSize: '20px', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.4))' }}>🪙</span>
          <span style={{ position: 'absolute', top: '24px', right: '20px', fontSize: '24px', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.4))' }}>💰</span>
          <span style={{ position: 'absolute', bottom: '20px', left: '20px', fontSize: '18px', opacity: 0.6 }}>⭐</span>
          <span style={{ position: 'absolute', bottom: '24px', right: '24px', fontSize: '18px', opacity: 0.6 }}>✨</span>

          {/* 3D Imperial Gold Crown Artwork */}
          <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'center' }}>
            <div
              style={{
                width: '74px',
                height: '74px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, #fef08a 0%, #eab308 60%, #ca8a04 100%)',
                padding: '3px',
                boxShadow: '0 6px 18px rgba(234, 179, 8, 0.5), inset 0 2px 4px rgba(255, 255, 255, 0.6)',
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
                  fontSize: '34px'
                }}
              >
                👑
              </div>
            </div>
          </div>

          {/* Crimson Ribbon & 3D Metallic "HIT THE JACKPOT" Typography (Image 2) */}
          <div
            style={{
              display: 'inline-block',
              background: 'linear-gradient(180deg, #dc2626 0%, #991b1b 100%)',
              color: '#ffffff',
              padding: '6px 24px',
              borderRadius: '999px',
              border: '2px solid #facc15',
              boxShadow: '0 4px 14px rgba(220, 38, 38, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
              marginBottom: '14px'
            }}
          >
            <span
              style={{
                fontSize: '18px',
                fontWeight: 900,
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                background: 'linear-gradient(180deg, #ffffff 0%, #fef08a 40%, #facc15 80%, #ca8a04 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 2px 3px rgba(0, 0, 0, 0.8))'
              }}
            >
              ★ HIT THE JACKPOT ★
            </span>
          </div>

          {/* Live Progressive Vault Counter */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#fef08a', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
              {lang === 'am' ? 'የጃክፖት ካዝና መጠን' : 'PROGRESSIVE VAULT BALANCE'}
            </div>
            <div
              style={{
                fontSize: '44px',
                fontWeight: 900,
                lineHeight: 1,
                fontFamily: 'system-ui, -apple-system, sans-serif',
                background: 'linear-gradient(180deg, #ffffff 0%, #fffbeb 30%, #fef08a 60%, #eab308 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 4px 12px rgba(234, 179, 8, 0.5))'
              }}
            >
              {poolAmount}
              <span style={{ fontSize: '20px', fontWeight: 800, color: '#fde047', WebkitTextFillColor: '#fde047', marginLeft: '6px' }}>
                / 500 ETB
              </span>
            </div>
          </div>

          {/* Animated Glowing Progress Bar */}
          <div style={{ margin: '14px 10px 16px' }}>
            <div
              style={{
                width: '100%',
                height: '14px',
                background: 'rgba(15, 7, 34, 0.8)',
                borderRadius: '999px',
                padding: '2px',
                border: '1px solid rgba(250, 204, 21, 0.3)',
                boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.6)'
              }}
            >
              <div
                style={{
                  width: `${progressPercent}%`,
                  height: '100%',
                  borderRadius: '999px',
                  background: isReadyToDrop
                    ? 'linear-gradient(90deg, #ef4444 0%, #f59e0b 50%, #22c55e 100%)'
                    : 'linear-gradient(90deg, #f59e0b 0%, #facc15 70%, #eab308 100%)',
                  boxShadow: isReadyToDrop
                    ? '0 0 12px rgba(34, 197, 94, 0.8)'
                    : '0 0 10px rgba(250, 204, 21, 0.6)',
                  transition: 'width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)'
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '10px', color: '#cbd5e1', fontWeight: 700 }}>
              <span>0 ETB</span>
              <span style={{ color: isReadyToDrop ? '#4ade80' : '#fef08a', fontWeight: 800 }}>
                {isReadyToDrop ? (lang === 'am' ? '🔥 ዝግጁ ነው! (100%)' : '🔥 READY TO DROP! (100%)') : `${progressPercent.toFixed(0)}%`}
              </span>
              <span>500 ETB</span>
            </div>
          </div>

          {/* Status Alert Badge */}
          <div
            style={{
              background: isReadyToDrop ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.12)',
              border: isReadyToDrop ? '1px solid #22c55e' : '1px solid rgba(250, 204, 21, 0.3)',
              borderRadius: '12px',
              padding: '8px 12px',
              fontSize: '11px',
              fontWeight: 800,
              color: isReadyToDrop ? '#86efac' : '#fef08a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              marginBottom: '16px'
            }}
          >
            <span>{isReadyToDrop ? '🔥' : '⏳'}</span>
            <span>
              {isReadyToDrop
                ? (lang === 'am' ? 'አሁን ይወድቃል! የሚቀጥለውን ቢንጎ ያጠናቀቀ 500 ብር ይወስዳል!' : 'READY TO DROP! The next Bingo winner wins 500 ETB Jackpot!')
                : (lang === 'am' ? `ካዝናው 500 ብር ሲሞላ ይወድቃል (ቀሪ ${500 - poolAmount} ብር)` : `Vault drops when reaching 500 ETB (${500 - poolAmount} ETB left)`)}
            </span>
          </div>

          {/* Play Bingo Now CTA Button */}
          <button
            type="button"
            onClick={handlePlayBingo}
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, #fef08a 0%, #facc15 35%, #eab308 70%, #ca8a04 100%)',
              color: '#0f172a',
              border: 'none',
              borderRadius: '14px',
              padding: '13px 20px',
              fontSize: '15px',
              fontWeight: 900,
              letterSpacing: '0.5px',
              cursor: 'pointer',
              boxShadow: '0 6px 18px rgba(234, 179, 8, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'transform 0.15s ease'
            }}
          >
            <i className="fa-solid fa-play"></i>
            <span>{lang === 'am' ? 'አሁን ቢንጎ ይጫወቱ (KI-10)' : 'PLAY BINGO NOW (KI-10)'}</span>
          </button>
        </div>

        {/* ── 4-STEP HOW THE JACKPOT WORKS ── */}
        <div
          style={{
            background: 'rgba(30, 17, 69, 0.7)',
            borderRadius: '20px',
            padding: '18px 16px',
            border: '1px solid rgba(255, 215, 0, 0.15)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)'
          }}
        >
          <h3
            style={{
              fontSize: '14px',
              fontWeight: 900,
              color: '#fef08a',
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
              margin: '0 0 14px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <i className="fa-solid fa-circle-question" style={{ color: '#facc15' }}></i>
            <span>{lang === 'am' ? 'የ 500 ብር ጃክፖት ህጎች' : 'How the 500 ETB Jackpot Works'}</span>
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Step 1 */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', background: 'rgba(15, 7, 34, 0.6)', padding: '12px', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: '#ffffff', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '13px' }}>1</div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#ffffff', marginBottom: '2px' }}>
                  {lang === 'am' ? '10% ቀጣይነት ያለው መዋጮ' : '10% Cartela Contribution'}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.4 }}>
                  {lang === 'am' ? 'በእያንዳንዱ ዙር ከሚቆረጡ ካርቴላዎች 10% በቀጥታ ወደዚህ ጃክፖት ካዝና ይገባል።' : 'In every KI-10 round, 10% of each ticket automatically grows the progressive jackpot vault.'}
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', background: 'rgba(15, 7, 34, 0.6)', padding: '12px', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#ffffff', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '13px' }}>2</div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#ffffff', marginBottom: '2px' }}>
                  {lang === 'am' ? 'የ 500 ብር መድረሻ መጠን' : 'The 500 ETB Trigger'}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.4 }}>
                  {lang === 'am' ? 'ካዝናው 500 ብር ወይም ከዚያ በላይ ሲደርስ ጃክፖቱ ይነሳሳል እና በማንኛውም ቅጽበት ለመውደቅ ይዘጋጃል።' : 'When the jackpot accumulates to 500 ETB or more, the jackpot is primed and ready to drop on the next win!'}
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', background: 'rgba(15, 7, 34, 0.6)', padding: '12px', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'linear-gradient(135deg, #10b981, #047857)', color: '#ffffff', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '13px' }}>3</div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#ffffff', marginBottom: '2px' }}>
                  {lang === 'am' ? 'ሙሉ 500 ብር ለዙሩ አሸናፊ' : 'Instant 500 ETB Winner Payout'}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.4 }}>
                  {lang === 'am' ? 'በዚህ ወቅት ቢንጎ ያጠናቀቀ ተጫዋች (እውነተኛ ሰው ወይም ቦት) መደበኛውን የዙሩ ደራሽ ሽልማት + 500 ብር ጃክፖት በአንድ ላይ ያሸንፋል!' : 'Whichever card calls BINGO first (real player or bot) wins the 500 ETB Jackpot ON TOP OF the regular round pot!'}
                </div>
              </div>
            </div>

            {/* Step 4 */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', background: 'rgba(15, 7, 34, 0.6)', padding: '12px', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', color: '#ffffff', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '13px' }}>4</div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#ffffff', marginBottom: '2px' }}>
                  {lang === 'am' ? 'ትርፍ ወደ ቀጣይ ዙር ይዘዋወራል' : 'Excess Rollover Carryover'}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.4 }}>
                  {lang === 'am' ? 'ከ 500 ብር በላይ የሆነው ትርፍ በሙሉ ወደ ቀጣዩ ጃክፖት ካዝና ይዘዋወራል። ለምሳሌ 501 ብር ቢሆን አሸናፊው 500 ብር ያገኛል፣ 1 ብር ቀጣዩን ካዝና ያስጀምራል።' : 'Any amount above 500 ETB immediately carries over to seed the next jackpot pool (e.g. 501 ETB -> 500 awarded, 1 ETB starts next pool).'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── RECENT JACKPOT WINNERS ── */}
        <div
          style={{
            background: 'rgba(30, 17, 69, 0.7)',
            borderRadius: '20px',
            padding: '18px 16px',
            border: '1px solid rgba(255, 215, 0, 0.15)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h3
              style={{
                fontSize: '14px',
                fontWeight: 900,
                color: '#fef08a',
                textTransform: 'uppercase',
                letterSpacing: '0.8px',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span>🏆</span>
              <span>{lang === 'am' ? 'የቅርብ ጊዜ ጃክፖት አሸናፊዎች' : 'Recent Jackpot Winners'}</span>
            </h3>
            <span style={{ fontSize: '11px', color: '#facc15', fontWeight: 700 }}>500 ETB</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recentWinners.map((w, idx) => (
              <div
                key={w.id || idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  background: 'rgba(15, 7, 34, 0.6)',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.05)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: 'radial-gradient(circle, #fef08a, #ca8a04)',
                      color: '#0f172a',
                      fontWeight: 900,
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    #{w.cartelaNumber}
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#ffffff' }}>
                      {w.winnerName}
                    </div>
                    <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                      {w.ballsCount} balls • {w.dateStr}
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '14px', fontWeight: 900, color: '#4ade80' }}>
                    +{w.amount} ETB
                  </div>
                  <div style={{ fontSize: '9px', color: '#facc15', fontWeight: 700 }}>
                    JACKPOT HIT
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};
