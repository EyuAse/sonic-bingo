import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';

export const FooterBanner: React.FC = () => {
  const { t } = useLanguage();

  return (
    <div className="promo-banner">
      <div className="promo-left">
        <span className="promo-tag">🍋 LOMI VIP</span>
        <h4 className="promo-title">{t('games.moreFunBanner')}</h4>
      </div>
      <div className="promo-right">
        <div className="promo-gift-visual">🎁</div>
      </div>
    </div>
  );
};
