import React, { useState, useEffect } from 'react';
import { useBingo } from '../../context/BingoContext.tsx';
import { useApp } from '../../context/AppContext.tsx';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { telegramService } from '../../services/telegramService.ts';
import { apiClient } from '../../services/apiClient.ts';
import '../../styles/grand_jackpot.css';

interface GrandJackpotModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface JackpotWinnerRecord {
  id: string;
  winnerName: string;
  amount: number;
  ballsCount: number;
  wonAt: string;
}

export const GrandJackpotModal: React.FC<GrandJackpotModalProps> = ({ isOpen, onClose }) => {
  const { jackpotPool, setJackpotPool, setBetAmount } = useBingo();
  const { switchPage } = useApp();
  const { lang } = useLanguage();

  const [poolAmount, setPoolAmount] = useState<number>(() => Math.max(jackpotPool || 0, 480));
  const [recentWinners, setRecentWinners] = useState<JackpotWinnerRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Sync pool amount whenever context jackpotPool updates
  useEffect(() => {
    if (jackpotPool && jackpotPool > 0) {
      setPoolAmount(jackpotPool);
    }
  }, [jackpotPool]);

  // Fetch live jackpot details & recent champions on modal open
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchDetails = async () => {
      try {
        setLoading(true);
        const res = await apiClient.public.getJackpotDetails();
        if (isMounted && res && res.success) {
          if (res.poolBalance !== undefined && res.poolBalance > 0) {
            setPoolAmount(res.poolBalance);
            setJackpotPool?.(res.poolBalance);
          }
          if (Array.isArray(res.recentWinners)) {
            setRecentWinners(res.recentWinners);
          }
        }
      } catch (err) {
        console.warn('⚠️ Could not fetch public jackpot details:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDetails();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const currentPool = Math.max(poolAmount, jackpotPool ?? 0);
  const targetThreshold = 500;
  const progressPercent = Math.min(100, Math.max(0, (currentPool / targetThreshold) * 100));
  const isReadyToDrop = currentPool >= targetThreshold;
  const etbRemaining = Math.max(0, targetThreshold - Math.floor(currentPool));

  const handlePlayNow = () => {
    telegramService.triggerHaptic('medium');
    setBetAmount(10);
    switchPage('bingo');
    onClose();
  };

  const handleClose = () => {
    telegramService.triggerHaptic('light');
    onClose();
  };

  return (
    <div className="grand-jackpot-modal-overlay" onClick={handleClose}>
      <div
        className="grand-jackpot-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Sticky Header */}
        <div className="grand-jackpot-header">
          <div className="grand-jackpot-header-title">
            <span>👑</span>
            <span>{lang === 'am' ? 'ግራንድ ጃክፖት 500' : 'GRAND JACKPOT 500'}</span>
          </div>
          <button
            type="button"
            className="grand-jackpot-close-btn"
            onClick={handleClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="grand-jackpot-body">
          {/* 1. 3D Banner Graphic */}
          <div className="grand-jackpot-hero-graphic">
            <img
              src="/images/hit_the_jackpot.jpg"
              alt="Hit The Jackpot 500 ETB"
              onError={(e) => {
                // Fallback graceful banner if image fails
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>

          {/* 2. Live Vault Progress Card */}
          <div className="grand-jackpot-vault-card">
            <div className="grand-jackpot-vault-lbl">
              <span>⚡</span>
              <span>{lang === 'am' ? 'የጃክፖት ካዝና መጠን' : 'PROGRESSIVE VAULT BALANCE'}</span>
              <span>⚡</span>
            </div>

            <div className="grand-jackpot-vault-amount">
              {Math.floor(currentPool)}
              <span className="grand-jackpot-vault-unit">ETB</span>
              <span className="grand-jackpot-threshold-target"> / {targetThreshold} ETB</span>
            </div>

            {/* Glowing Progress Bar */}
            <div className="grand-jackpot-progress-wrap">
              <div
                className="grand-jackpot-progress-bar"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>

            {/* Status Drop Indicator */}
            {isReadyToDrop ? (
              <div className="grand-jackpot-status-pill ready">
                <span>🔥</span>
                <span>
                  {lang === 'am'
                    ? 'ካዝናው 500 ሞልቷል! በዚህ ዙር አሸናፊው ጃክፖቱን ያገኛል!'
                    : 'VAULT REACHED 500 ETB! Winner takes pot + 500 ETB this round!'}
                </span>
              </div>
            ) : (
              <div className="grand-jackpot-status-pill charging">
                <span>⏳</span>
                <span>
                  {lang === 'am'
                    ? `ካዝናው 500 ሲደርስ ይከፈታል (${etbRemaining} ብር ቀርቷል)`
                    : `Vault drops at 500 ETB (${etbRemaining} ETB left to drop)`}
                </span>
              </div>
            )}
          </div>

          {/* 3. Big CTA Play Button */}
          <button
            type="button"
            className="grand-jackpot-play-cta-btn"
            onClick={handlePlayNow}
          >
            <span>▶</span>
            <span>
              {lang === 'am'
                ? 'አሁን በ10 ብር ክፍል ይጫወቱ!'
                : 'PLAY BINGO NOW (10 ETB ROOM)'}
            </span>
          </button>

          {/* 4. How To Win Rules Card */}
          <div className="grand-jackpot-section-card">
            <div className="grand-jackpot-section-hdr">
              <i className="fa-solid fa-circle-question" style={{ color: '#fbbf24' }}></i>
              <span>{lang === 'am' ? 'ጃክፖቱን እንዴት ማሸነፍ ይቻላል?' : 'HOW TO WIN THE JACKPOT'}</span>
            </div>

            <div className="grand-jackpot-rules-list">
              <div className="grand-jackpot-rule-item">
                <span className="grand-jackpot-rule-num">1</span>
                <div>
                  <strong>{lang === 'am' ? 'በ10 ብር ክፍል ይጫወቱ:' : '10 ETB Starter Room:'}</strong>{' '}
                  {lang === 'am'
                    ? 'ይህ ጃክፖት የሚሰራው በ10 ብር ክፍል (Room 10) ውስጥ ብቻ ነው።'
                    : 'The progressive jackpot is exclusive to the 10 ETB room.'}
                </div>
              </div>

              <div className="grand-jackpot-rule-item">
                <span className="grand-jackpot-rule-num">2</span>
                <div>
                  <strong>{lang === 'am' ? 'የካዝናው ፈጣን እድገት:' : 'Continuous Vault Growth:'}</strong>{' '}
                  {lang === 'am'
                    ? 'በእያንዳንዱ ዙር ጨዋታ የጃክፖት ካዝናው ያለማቋረጥ እያደገ ወደ 500 ብር ግብ በፍጥነት ይቃረባል።'
                    : 'Every active round automatically boosts the jackpot vault closer and closer to the 500 ETB drop target!'}
                </div>
              </div>

              <div className="grand-jackpot-rule-item">
                <span className="grand-jackpot-rule-num">3</span>
                <div>
                  <strong>{lang === 'am' ? 'የማሸነፊያ ደንብ (500 ብር):' : 'The 500 ETB Drop:'}</strong>{' '}
                  {lang === 'am'
                    ? 'ካዝናው 500 ብር ወይም ከዚያ በላይ ሲደርስ፣ በዚያ ዙር ቀድሞ ቢንጎ ያጠናቀቀው ተጫዋች መደበኛውን ደራሽ እና ተጨማሪ 500 ብር ጃክፖት ይወስዳል!'
                    : 'When the vault hits 500 ETB or more, the round winner takes the standard pot PLUS the 500 ETB Grand Jackpot!'}
                </div>
              </div>

              <div className="grand-jackpot-rule-item">
                <span className="grand-jackpot-rule-num">4</span>
                <div>
                  <strong>{lang === 'am' ? 'ቀሪ ገንዘብ (Carryover):' : 'Surplus Carryover:'}</strong>{' '}
                  {lang === 'am'
                    ? 'ከ500 ብር በላይ የሆነው ቀሪ ገንዘብ ለቀጣዩ ጃክፖት መነሻነት ይሸጋገራል።'
                    : 'Any excess amount above 500 ETB automatically rolls over to seed the next jackpot!'}
                </div>
              </div>
            </div>
          </div>

          {/* 5. Past 5 Real Jackpot Champions */}
          <div className="grand-jackpot-section-card">
            <div className="grand-jackpot-section-hdr">
              <i className="fa-solid fa-trophy" style={{ color: '#fbbf24' }}></i>
              <span>{lang === 'am' ? 'ያለፉት 5 የጃክፖት አሸናፊዎች' : 'PAST 5 JACKPOT CHAMPIONS'}</span>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '16px', color: '#94a3b8', fontSize: '12px' }}>
                <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '6px' }}></i>
                {lang === 'am' ? 'መረጃ በመጫን ላይ...' : 'Loading champions...'}
              </div>
            ) : recentWinners.length === 0 ? (
              <div className="grand-jackpot-empty-state">
                <span className="grand-jackpot-empty-icon">🛡️</span>
                <strong>{lang === 'am' ? 'እስካሁን ያሸነፈ የለም!' : 'No Jackpot Champions Yet!'}</strong>
                <p style={{ margin: '4px 0 0 0' }}>
                  {lang === 'am'
                    ? `ካዝናው ${Math.floor(currentPool)} ብር ደርሷል! የመጀመሪያው 500 ብር አሸናፊ ለመሆን አሁኑኑ በ10 ብር ክፍል ይጫወቱ።`
                    : `The vault is at ${Math.floor(currentPool)} ETB! Play in Room 10 now to become the very first 500 ETB champion.`}
                </p>
              </div>
            ) : (
              <div className="grand-jackpot-champions-list">
                {recentWinners.slice(0, 5).map((winner, idx) => (
                  <div key={winner.id || idx} className="grand-jackpot-champion-row">
                    <div className="grand-jackpot-champ-left">
                      <div className="grand-jackpot-champ-avatar">
                        {winner.winnerName ? winner.winnerName.charAt(0).toUpperCase() : 'P'}
                      </div>
                      <div>
                        <div className="grand-jackpot-champ-name">{winner.winnerName || 'Player'}</div>
                        <div className="grand-jackpot-champ-meta">
                          {winner.wonAt ? new Date(winner.wonAt).toLocaleDateString() : 'Recent'}{' '}
                          {winner.ballsCount ? `• in ${winner.ballsCount} balls` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="grand-jackpot-champ-right">
                      <div className="grand-jackpot-champ-amount">+{winner.amount || 500} ETB</div>
                      <span className="grand-jackpot-champ-badge">👑 JACKPOT</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

