import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { translations } from '../locales/translations.ts';
import { soundEngine } from '../services/soundEngine.ts';

export type Language = 'en' | 'am';

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
  t: (path: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>(() => {
    const saved = localStorage.getItem('sonic_bingo_lang') || localStorage.getItem('lomi_bingo_lang');
    return saved === 'en' || saved === 'am' ? saved : 'am';
  });

  const setLang = (nextLang: Language) => {
    setLangState(nextLang);
    localStorage.setItem('sonic_bingo_lang', nextLang);
    soundEngine.setVoiceLang(nextLang);
  };

  const toggleLang = () => {
    const nextLang = lang === 'en' ? 'am' : 'en';
    setLang(nextLang);
  };

  useEffect(() => {
    soundEngine.setVoiceLang(lang);
  }, [lang]);

  // Translation resolver with nested dot-notation (e.g. 'nav.games', 'bingo.soloWinSub')
  const t = (path: string, params?: Record<string, string | number>): string => {
    const keys = path.split('.');
    let current: unknown = translations[lang];

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = (current as Record<string, unknown>)[key];
      } else {
        // Fallback to English if key missing in Amharic
        let fallback: unknown = translations['en'];
        for (const fbKey of keys) {
          if (fallback && typeof fallback === 'object' && fbKey in fallback) {
            fallback = (fallback as Record<string, unknown>)[fbKey];
          } else {
            return path;
          }
        }
        current = fallback;
        break;
      }
    }

    if (typeof current !== 'string') {
      return path;
    }

    let result = current;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        result = result.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      });
    }

    return result;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
