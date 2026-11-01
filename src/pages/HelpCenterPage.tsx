import React, { useState } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { useLanguage } from '../context/LanguageContext.tsx';

interface FAQItem {
  id: string;
  category: 'deposit' | 'withdraw' | 'bingo' | 'affiliate' | 'security';
  qEn: string;
  qAm: string;
  aEn: string;
  aAm: string;
}

export const HelpCenterPage: React.FC = () => {
  const { switchPage, showToast } = useApp();
  const { t, lang } = useLanguage();
  const [activeFaqId, setActiveFaqId] = useState<string | null>('faq-1');

  const faqs: FAQItem[] = [
    {
      id: 'faq-1',
      category: 'deposit',
      qEn: 'How do I deposit funds via Telebirr or CBE?',
      qAm: 'በቴሌብር ወይም በንግድ ባንክ እንዴት ገንዘብ ማስገባት እችላለሁ?',
      aEn:
        'Tap "+ Deposit" in the top bar or Wallet page. Choose Telebirr or CBE Bank, copy our official cashier account number, transfer the exact amount from your banking app, and paste the SMS confirmation reference ID. Deposits are verified and credited within ~30 seconds.',
      aAm:
        'ከላይ "+ አስገባ" የሚለውን ይጫኑ። ቴሌብር ወይም የኢትዮጵያ ንግድ ባንክ ይምረጡ፣ ይፋዊ የሂሳብ ቁጥራችንን ገልብጠው (ኮፒ አድርገው) የሚፈልጉትን መጠን ይላኩ፤ በመቀጠል የግብይት ማረጋገጫ ቁጥሩን ያስገቡ። በ30 ሰከንዶች ውስጥ ገቢ ይደረጋል።'
    },
    {
      id: 'faq-2',
      category: 'withdraw',
      qEn: 'How long do withdrawals take to settle?',
      qAm: 'የገንዘብ ማውጣት ሂደት ምን ያህል ጊዜ ይወስዳል?',
      aEn:
        'Withdrawals are processed 24/7 by our automated settlement desk. Telebirr cashouts typically arrive in 1–3 minutes, while CBE Bank transfers arrive within 5–15 minutes. There are zero withdrawal fees.',
      aAm:
        'የማውጣት ጥያቄዎች በቀን 24 ሰዓት በራስ ሰር ይከናወናሉ። የቴሌብር ክፍያዎች ከ1-3 ደቂቃዎች፣ የንግድ ባንክ ክፍያዎች ደግሞ ከ5-15 ደቂቃዎች ውስጥ ያለ ምንም ተጨማሪ ክፍያ ይደርሳሉ።'
    },
    {
      id: 'faq-3',
      category: 'bingo',
      qEn: 'How does 75-Ball Fast Express Bingo work?',
      qAm: 'የ75-ኳስ ፈጣን ቢንጎ አጨዋወት እንዴት ነው?',
      aEn:
        'Each round draws numbers from 1 to 75. Your 5x5 Cartela has 24 numbers and 1 center FREE star. Complete any horizontal, vertical, or diagonal 5-in-a-row line or four corners, then hit the pulsing BINGO button to claim the round prize pool!',
      aAm:
        'በእያንዳንዱ ዙር ከ1 እስከ 75 ያሉት ቁጥሮች ይወጣሉ። የእርስዎ 5x5 ካርቴላ 24 ቁጥሮች እና 1 ነፃ ኮከብ ይዟል። ማንኛውንም አግድም፣ ቁልቁል ወይም ሰያፍ መስመር አሟልተው ቢንጎ የሚለውን በመጫን አሸናፊ ይሁኑ!'
    },
    {
      id: 'faq-4',
      category: 'affiliate',
      qEn: 'How does the 10% Referral Affiliate Bonus work?',
      qAm: 'የ10% ጓደኛ መጋበዣ ቦነስ እንዴት ይሰራል?',
      aEn:
        'Share your exclusive referral link or code with friends. Whenever a friend registers and makes their first deposit, you receive an instant 10% cash bonus directly into your bonus balance, with zero wager requirements!',
      aAm:
        'የእርስዎን ልዩ መጋበዣ ሊንክ ለጓደኞችዎ ያጋሩ። ጓደኛዎ ተመዝግቦ ገንዘብ ባስገባ ቁጥር የ10% ቦነስ በቀጥታ ወደ ሂሳብዎ ይገባል!'
    },
    {
      id: 'faq-5',
      category: 'security',
      qEn: 'Are my wallet balance and transactions safe?',
      qAm: 'የዋሌት ቀሪ ሂሳቤ እና የገንዘብ ዝውውሮቼ አስተማማኝ ናቸው?',
      aEn:
        'Yes. Sonic Bingo is licensed and regulated by the National Lottery Administration of Ethiopia (NLA). All games utilize certified cryptographic Random Number Generation (RNG), and funds are secured in segregated Ethiopian escrow accounts.',
      aAm:
        'አዎ! ሶኒክ ቢንጎ በኢትዮጵያ ብሔራዊ ሎተሪ አስተዳደር (NLA) ፈቃድ ያለው እና ቁጥጥር የሚደረግበት ሲሆን፣ ጨዋታዎች በ100% ፍትሃዊ የRNG ቴክኖሎጂ የሚመሩ ናቸው።'
    }
  ];

  const handleOpenTelegramSupport = () => {
    window.open('https://t.me/SonicGameBot', '_blank');
  };

  const handleOpenCommunity = () => {
    window.open('https://t.me/SonicGameBot', '_blank');
  };

  const toggleFaq = (id: string) => {
    setActiveFaqId(prev => (prev === id ? null : id));
  };

  return (
    <div className="page active page-subpage-dedicated" id="page-help-center">
      {/* Top Back Navigation Bar */}
      <div className="subpage-back-header">
        <button
          type="button"
          className="btn-subpage-back"
          onClick={() => switchPage('profile')}
        >
          <i className="fa-solid fa-chevron-left"></i>
          <span>{t('nav.profile')}</span>
        </button>
        <h2 className="subpage-header-title">{t('help.title')}</h2>
        <div style={{ width: '40px' }}></div>
      </div>

      <div className="subpage-content-scroll">
        {/* Top 24/7 Live Support Banner */}
        <div className="support-hero-banner">
          <div className="support-hero-icon-wrap">
            <i className="fa-brands fa-telegram telegram-big-icon"></i>
          </div>
          <div className="support-hero-text-col">
            <strong className="support-hero-title">{t('help.liveSupport')}</strong>
            <span className="support-hero-sub">{t('help.responseEta')} • @SonicGameBot</span>
          </div>
          <button
            type="button"
            className="btn-chat-live-telegram"
            onClick={handleOpenTelegramSupport}
          >
            <span>{t('help.chatNow')}</span>
            <i className="fa-solid fa-paper-plane"></i>
          </button>
        </div>

        {/* Quick Contact Hotlines Strip */}
        <div className="contact-channels-grid">
          <div
            className="channel-contact-card"
            onClick={handleOpenTelegramSupport}
          >
            <i className="fa-brands fa-telegram channel-icon" style={{ color: '#229ED9' }}></i>
            <div className="channel-txt-col">
              <span className="channel-lbl">Telegram Support</span>
              <strong className="channel-val">@SonicGameBot</strong>
            </div>
          </div>

          <div
            className="channel-contact-card"
            onClick={() => {
              navigator.clipboard.writeText('+251911000000');
              showToast('📋 Copied Hotline: +251 911 000000');
            }}
          >
            <i className="fa-solid fa-phone-volume channel-icon gold"></i>
            <div className="channel-txt-col">
              <span className="channel-lbl">{t('help.phoneHotline')}</span>
              <strong className="channel-val">+251 911 00 00 00</strong>
            </div>
          </div>

          <div
            className="channel-contact-card"
            onClick={() => {
              navigator.clipboard.writeText('support@sonicbingo.com');
              showToast('📋 Copied Email: support@sonicbingo.com');
            }}
          >
            <i className="fa-regular fa-envelope channel-icon blue"></i>
            <div className="channel-txt-col">
              <span className="channel-lbl">{t('help.emailHelpdesk')}</span>
              <strong className="channel-val">support@sonicbingo.com</strong>
            </div>
          </div>
        </div>

        {/* Official Community Banner */}
        <div className="community-channel-card" onClick={handleOpenCommunity}>
          <div className="community-left-col">
            <i className="fa-solid fa-users community-icon"></i>
            <div>
              <strong className="community-title">{t('help.communityTitle')}</strong>
              <span className="community-sub">{t('help.communitySub')}</span>
            </div>
          </div>
          <i className="fa-solid fa-arrow-up-right-from-square community-ext-icon"></i>
        </div>

        {/* Frequently Asked Questions */}
        <div className="faqs-section-wrap">
          <span className="faqs-heading-title">
            <i className="fa-solid fa-circle-question gold"></i> {t('help.faqsTitle')}
          </span>

          <div className="faqs-accordion-list">
            {faqs.map(faq => {
              const isOpen = activeFaqId === faq.id;
              const question = lang === 'am' ? faq.qAm : faq.qEn;
              const answer = lang === 'am' ? faq.aAm : faq.aEn;

              return (
                <div key={faq.id} className={`faq-accordion-item ${isOpen ? 'open' : ''}`}>
                  <button
                    type="button"
                    className="faq-question-btn"
                    onClick={() => toggleFaq(faq.id)}
                  >
                    <span className="faq-q-text">{question}</span>
                    <i className={`fa-solid ${isOpen ? 'fa-chevron-up' : 'fa-chevron-down'} faq-chevron`}></i>
                  </button>

                  {isOpen && (
                    <div className="faq-answer-body">
                      <p>{answer}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
