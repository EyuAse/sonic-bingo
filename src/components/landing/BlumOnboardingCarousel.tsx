import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useAdmin } from '../../context/AdminContext';
import { telegramService } from '../../services/telegramService';

interface BlumOnboardingCarouselProps {
  onClaimBonus: () => void;
  isLoading: boolean;
  onSkip?: () => void;
}

export const BlumOnboardingCarousel: React.FC<BlumOnboardingCarouselProps> = ({
  onClaimBonus,
  isLoading,
  onSkip
}) => {
  const { lang } = useLanguage();
  const { registerBonus } = useAdmin();
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      id: 0,
      badge: lang === 'am' ? '⚡ የቀጥታ 75-ኳስ ቢንጎ' : '⚡ 🎯 75-BALL EXPRESS',
      title1: lang === 'am' ? 'የቀጥታ ቢንጎ ይጫወቱ' : 'Play Live Bingo',
      title2: lang === 'am' ? 'ከፍተኛ ጃክፖት ያሸንፉ' : 'Win Huge Jackpots',
      sub: lang === 'am'
        ? 'በየ60 ሰከንዱ የቀጥታ ዙሮች እና ሺዎች የሚቆጠሩ እውነተኛ ኢትዮጵያውያን ተጫዋቾች!'
        : 'Fast-paced 75-ball express rounds with thousands of real Ethiopian players.',
      art: '/assets/images/sonic-hero-75-vip.jpg',
      features: [
        {
          icon: '⚡',
          iconBg: '#ecfdf5',
          title: lang === 'am' ? 'የ60 ሰከንድ የቀጥታ ዙሮች' : 'Express Rounds',
          desc: lang === 'am' ? 'የማያቋርጥ ፈጣን የቀጥታ ጨዋታ' : '60-second non-stop live action'
        },
        {
          icon: '🏆',
          iconBg: '#fef9c3',
          title: lang === 'am' ? 'የየዕለቱ ጃክፖቶች' : 'Daily Jackpots',
          desc: lang === 'am' ? 'እስከ 50,000 ብር ሽልማቶች' : 'Up to 50,000 ETB prize pools'
        },
        {
          icon: '🎮',
          iconBg: '#eff6ff',
          title: lang === 'am' ? 'ራስ-ሰር ምልክት ማድረጊያ' : 'Auto-Marking',
          desc: lang === 'am' ? 'የአሸናፊ ቁጥር እንዳያመልጥዎ' : 'Never miss a winning number'
        }
      ]
    },
    {
      id: 1,
      badge: lang === 'am' ? '⚡ 💸 ፈጣን ክፍያ' : '⚡ 💸 INSTANT PAYOUTS',
      title1: lang === 'am' ? 'ያሸነፉትን ገንዘብ' : 'Cashout Instantly',
      title2: lang === 'am' ? 'ወዲያውኑ ወጪ ያድርጉ' : 'When You Win',
      sub: lang === 'am'
        ? 'ያሸነፉትን ገንዘብ በሰከንዶች ውስጥ ወደ ቴሌብር ወይም ንግድ ባንክ ያስገቡ። 0% ክፍያ።'
        : 'Withdraw your winnings directly to Telebirr or CBE in seconds. 0% fees.',
      art: '/assets/images/auth-header-75.jpg',
      features: [
        {
          icon: '⚡',
          iconBg: '#ecfdf5',
          title: lang === 'am' ? 'ፈጣን ዝውውር' : 'Instant Transfers',
          desc: lang === 'am' ? 'ገንዘብዎ በ0-60 ሰከንድ ውስጥ ይደርሳል' : 'Get your winnings in 0–60 seconds'
        },
        {
          icon: '🛡️',
          iconBg: '#fef3c7',
          title: lang === 'am' ? '100% አስተማማኝ' : '100% Secure',
          desc: lang === 'am' ? 'ደህንነቱ የተጠበቀና የታመነ አሰራር' : 'Safe, fair & encrypted transactions'
        },
        {
          icon: '🎧',
          iconBg: '#ecfdf5',
          title: lang === 'am' ? 'የ24/7 ድጋፍ' : '24/7 Support',
          desc: lang === 'am' ? 'በማንኛውም ሰዓት ከጎንዎ ነን' : "We're here for you anytime"
        }
      ]
    },
    {
      id: 2,
      badge: lang === 'am' ? '🎁 👑 የነፃ መመዝገቢያ ስጦታ' : '🎁 👑 STARTER REWARD PACK',
      title1: lang === 'am' ? `በ${registerBonus} ብር ቦነስ ይጀምሩ` : `Start With ${registerBonus} ETB`,
      title2: lang === 'am' ? 'ያለ ምንም ቅድመ ክፍያ' : 'Zero Deposit Needed',
      sub: lang === 'am'
        ? `በቴሌግራም በአንድ ንክኪ ይመዝገቡና የ${registerBonus} ብር ነፃ ቦነስዎን ወዲያውኑ ተቀብለው ይጫወቱ!`
        : `Create account in 1-tap via Telegram and claim ${registerBonus} ETB welcome bonus now.`,
      art: '/assets/images/sonic-hero-75-vip.jpg',
      features: [
        {
          icon: '🎁',
          iconBg: '#fef9c3',
          title: lang === 'am' ? `የ${registerBonus} ብር ነፃ ስጦታ` : 'Free Starter Pack',
          desc: lang === 'am' ? `+${registerBonus.toFixed(2)} ብር ቦነስ ወደ ቦርሳዎ ገቢ ይሆናል` : `+${registerBonus.toFixed(2)} ETB added directly to wallet`
        },
        {
          icon: '⚡',
          iconBg: '#eff6ff',
          title: lang === 'am' ? '1-ንክኪ ቴሌግራም' : '1-Click Telegram',
          desc: lang === 'am' ? 'የይለፍ ቃል ወይም ፎርም አያስፈልግም' : 'Zero passwords or forms needed'
        },
        {
          icon: '💰',
          iconBg: '#ecfdf5',
          title: lang === 'am' ? 'እውነተኛ የብር ሽልማቶች' : 'Real Cash Prizes',
          desc: lang === 'am' ? 'ያሸነፉትን ወዲያውኑ ወጪ ያድርጉ' : 'Play & withdraw real Ethiopian Birr'
        }
      ]
    }
  ];

  const handleNext = () => {
    telegramService.triggerHaptic('light');
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(prev => prev + 1);
    } else {
      onClaimBonus();
    }
  };

  const handleSkipClick = () => {
    telegramService.triggerHaptic('light');
    setCurrentSlide(slides.length - 1);
  };

  const slide = slides[currentSlide];
  const isLastSlide = currentSlide === slides.length - 1;

  return (
    <div
      className="exact-ref-onboarding-container"
      style={{
        width: '100%',
        maxWidth: '420px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '2px 4px 6px 4px',
        boxSizing: 'border-box'
      }}
    >
      {/* 1. Progress Segments & Skip Button Row */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '10px',
          padding: '0 4px'
        }}
      >
        {/* 3 Rounded Segment Bars */}
        <div style={{ display: 'flex', gap: '5px', flex: 1, maxWidth: '160px' }}>
          {slides.map((s, idx) => (
            <div
              key={s.id}
              onClick={() => setCurrentSlide(idx)}
              style={{
                flex: 1,
                height: '5px',
                borderRadius: '999px',
                background: idx <= currentSlide ? '#eab308' : '#e2e8f0',
                cursor: 'pointer',
                transition: 'all 0.25s ease'
              }}
            ></div>
          ))}
        </div>

        {/* Skip Pill Button (Opens Register Modal) */}
        <button
          type="button"
          onClick={handleSkipClick}
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '999px',
            padding: '4px 14px',
            fontSize: '12px',
            fontWeight: '700',
            color: '#0f172a',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
          }}
        >
          {lang === 'am' ? 'ዝለል' : 'Skip'}
        </button>
      </div>

      {/* 2. Centered Badge Tag */}
      <div
        style={{
          background: 'rgba(236, 253, 245, 0.95)',
          border: '1px solid #a7f3d0',
          borderRadius: '999px',
          padding: '3px 12px',
          fontSize: '10.5px',
          fontWeight: '800',
          color: '#047857',
          letterSpacing: '0.6px',
          textTransform: 'uppercase',
          marginBottom: '6px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px'
        }}
      >
        <span>{slide.badge}</span>
      </div>

      {/* 3. Dual-Tone Heading */}
      <h1
        style={{
          fontSize: '21px',
          fontWeight: '900',
          lineHeight: '1.15',
          margin: '0 0 4px 0',
          textAlign: 'center',
          letterSpacing: '-0.3px'
        }}
      >
        <div style={{ color: '#0f172a' }}>{slide.title1}</div>
        <div style={{ color: isLastSlide ? '#ca8a04' : '#16a34a' }}>{slide.title2}</div>
      </h1>

      {/* 4. Subtitle */}
      <p
        style={{
          fontSize: '11.5px',
          color: '#64748b',
          textAlign: 'center',
          lineHeight: '1.35',
          margin: '0 0 10px 0',
          maxWidth: '310px'
        }}
      >
        {slide.sub}
      </p>

      {/* 5. 3D Artwork Frame (Compact for zero-scroll fit) */}
      <div
        style={{
          width: '100%',
          maxWidth: '340px',
          height: '115px',
          borderRadius: '18px',
          overflow: 'hidden',
          marginBottom: '10px',
          boxShadow: '0 8px 20px -6px rgba(0, 0, 0, 0.12)',
          border: '1.5px solid rgba(255, 255, 255, 0.8)',
          background: '#fefce8'
        }}
      >
        <img
          src={slide.art}
          alt={slide.title1}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>

      {/* 6. Exact 3 Stacked White Checklist Cards (Compact) */}
      <div
        style={{
          width: '100%',
          maxWidth: '340px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          marginBottom: '12px'
        }}
      >
        {slide.features.map((feat, idx) => (
          <div
            key={idx}
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              boxShadow: '0 1px 4px rgba(0, 0, 0, 0.03)',
              border: '1px solid #f1f5f9'
            }}
          >
            {/* Icon Bubble */}
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '8px',
                background: feat.iconBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '15px',
                flexShrink: 0
              }}
            >
              {feat.icon}
            </div>

            {/* Texts */}
            <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: '800', color: '#0f172a' }}>
                {feat.title}
              </div>
              <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {feat.desc}
              </div>
            </div>

            {/* Green Checkmark Badge */}
            <div
              style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                background: '#16a34a',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '9.5px',
                flexShrink: 0
              }}
            >
              <i className="fa-solid fa-check"></i>
            </div>
          </div>
        ))}
      </div>

      {/* 7. Action CTA Button (Lush Green / Gold) */}
      <div style={{ width: '100%', maxWidth: '340px' }}>
        <button
          type="button"
          onClick={handleNext}
          disabled={isLoading}
          style={{
            width: '100%',
            background: isLastSlide
              ? 'linear-gradient(135deg, #facc15 0%, #eab308 50%, #ca8a04 100%)'
              : 'linear-gradient(135deg, #22c55e 0%, #16a34a 50%, #15803d 100%)',
            color: isLastSlide ? '#0f172a' : '#ffffff',
            fontSize: '14.5px',
            fontWeight: '900',
            border: 'none',
            borderRadius: '999px',
            padding: '13px 18px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: isLastSlide
              ? '0 6px 20px rgba(234, 179, 8, 0.4)'
              : '0 6px 20px rgba(22, 163, 74, 0.4)',
            letterSpacing: '0.2px',
            transition: 'all 0.15s ease'
          }}
        >
          {isLastSlide ? (
            <span>
              {isLoading
                ? lang === 'am'
                  ? 'በመግባት ላይ...'
                  : 'Connecting...'
                : lang === 'am'
                ? `🎁 የ${registerBonus} ብር ቦነስዎን ተቀብለው ይጫወቱ ➔`
                : `🎁 Claim ${registerBonus} ETB Bonus & Play ➔`}
            </span>
          ) : (
            <>
              <span>{lang === 'am' ? 'ቀጣይ' : 'Next'}</span>
              <i className="fa-solid fa-arrow-right"></i>
            </>
          )}
        </button>
      </div>

      {/* 8. Bottom Trust Badge */}
      <div
        style={{
          marginTop: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          fontSize: '10.5px',
          color: '#475569',
          fontWeight: '600'
        }}
      >
        <span style={{ color: '#16a34a' }}>🛡️</span>
        <span>
          {lang === 'am'
            ? 'ፈጣን • ታማኝ • 100% አስተማማኝ'
            : 'Licensed • Trusted • Reliable'}
        </span>
      </div>
    </div>
  );
};
