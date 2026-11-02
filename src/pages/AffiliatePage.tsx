import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useWallet } from '../context/WalletContext.tsx';
import { useLanguage } from '../context/LanguageContext.tsx';
import { telegramService } from '../services/telegramService.ts';
import { apiClient } from '../services/apiClient.ts';

interface ReferredFriend {
  id: string;
  name: string;
  avatar: string;
  isPremium?: boolean;
  joinedAt: string;
  depositAmount: number;
  bonusEarned: number;
  status: 'paid' | 'pending_deposit';
}

export const AffiliatePage: React.FC = () => {
  const { switchPage, showToast } = useApp();
  const { user } = useAuth();
  const { balance, bonus, coins, redeemCoins } = useWallet();
  const { lang } = useLanguage();

  const [isRedeemingCoins, setIsRedeemingCoins] = useState(false);

  const [referralData, setReferralData] = useState<{
    referralCode: string;
    referralLink: string;
    totalInvited: number;
    totalEarned: number;
    friends: ReferredFriend[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchReferralStats = async () => {
      if (!user) return;
      try {
        setLoading(true);
        const res = await apiClient.wallet.getReferrals();
        if (isMounted && res.success) {
          setReferralData({
            referralCode: res.referralCode,
            referralLink: res.referralLink,
            totalInvited: res.totalInvited,
            totalEarned: res.totalEarned,
            friends: res.friends.map(f => ({
              id: f.id,
              name: f.name,
              avatar: f.avatar,
              isPremium: f.isPremium,
              joinedAt: f.joinedAt,
              depositAmount: f.depositAmount,
              bonusEarned: f.bonusEarned,
              status: f.status
            }))
          });
        }
      } catch (err) {
        console.warn('Could not load live referral stats:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchReferralStats();
    return () => { isMounted = false; };
  }, [user]);

  const referralCode =
    referralData?.referralCode ||
    user?.referralCode ||
    (user?.id ? user.id.replace(/^UID-TG-/, 'SONIC-') : 'SONIC-7842');
  const referralLink =
    referralData?.referralLink ||
    `https://t.me/SonicGameBot/play?startapp=ref_${referralCode}`;

  const totalInvited = referralData ? referralData.totalInvited : 0;
  const totalEarned = referralData ? referralData.totalEarned : 0;
  const friendsList = referralData ? referralData.friends : [];

  const handleCopyLink = () => {
    telegramService.triggerHaptic('light');
    navigator.clipboard.writeText(referralLink);
    setCopiedLink(true);
    showToast(
      lang === 'am'
        ? '📋 የግብዣ ሊንክ ተቀድቷል! ለጓደኞችዎ ያጋሩ።'
        : '📋 Referral link copied to clipboard!'
    );
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleRedeemCoins = async () => {
    if (coins < 1000) {
      showToast(lang === 'am' ? '⚠️ ኮይኖችን ለመቀየር ቢያንስ 1,000 ኮይኖች ያስፈልጋሉ።' : '⚠️ At least 1,000 coins are required to redeem for 10 ETB bonus.');
      return;
    }
    setIsRedeemingCoins(true);
    try {
      const res = await redeemCoins();
      if (res.success) {
        showToast(`🎉 ${res.message}`);
      } else {
        showToast(`❌ ${res.message}`);
      }
    } finally {
      setIsRedeemingCoins(false);
    }
  };

  const handleInviteTelegramFriends = () => {
    telegramService.triggerHaptic('medium');
    const shareText = encodeURIComponent(
      `⚡ Join me on Sonic Bingo! Get 20 ETB Free Welcome Bonus to play live 75-Ball Express Bingo with instant Telebirr payouts! 🎁💰\n\nPlay here:`
    );
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${shareText}`;
    telegramService.openTelegramLink(shareUrl);
  };

  return (
    <div className="page active page-affiliate-fresh" id="page-affiliate" style={{ background: '#fffdf8', minHeight: '100dvh' }}>
      {/* 1. Top Navigation Bar */}
      <div
        className="affiliate-top-navbar"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          background: '#ffffff',
          borderBottom: '1px solid #f1f5f9',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)'
        }}
      >
        <button
          type="button"
          className="btn-affiliate-back"
          onClick={() => switchPage('games')}
          style={{ color: '#0f172a', background: 'transparent', border: 'none', fontSize: '14px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <i className="fa-solid fa-arrow-left"></i>
          <span>{lang === 'am' ? 'ጨዋታዎች' : 'Games'}</span>
        </button>

        <h2 className="affiliate-page-title" style={{ fontSize: '16px', fontWeight: '900', color: '#0f172a', margin: 0 }}>
          {lang === 'am' ? '🎁 ሽልማቶችና ግብዣ' : '🎁 Rewards & Invites'}
        </h2>

        <div style={{ width: '32px' }}></div>
      </div>

      {/* Main Content Scroll */}
      <div
        className="affiliate-content-scroll"
        style={{
          padding: '14px 14px 28px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          maxWidth: '430px',
          margin: '0 auto'
        }}
      >
        {/* 1b. Executive 3-Wallet Suite (Cash, Play Bonus, Loyalty Coins) */}
        <div style={{
          background: '#ffffff',
          borderRadius: '20px',
          padding: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.04)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <i className="fa-solid fa-wallet" style={{ color: '#d97706' }}></i>
              {lang === 'am' ? 'የእርስዎ ቦርሳዎችና የሳንቲም ማዕከል' : 'Your Wallets & Rewards'}
            </span>
            <button
              type="button"
              onClick={() => switchPage('wallet')}
              style={{ background: 'transparent', border: 'none', color: '#d97706', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
            >
              {lang === 'am' ? 'ዝርዝር ይመልከቱ →' : 'Wallet Hub →'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {/* Wallet 1: Withdrawable Cash */}
            <div style={{ background: '#f8fafc', borderRadius: '14px', padding: '10px 8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>{lang === 'am' ? 'ዋና ሂሳብ' : 'Cash'}</div>
              <div style={{ fontSize: '14px', fontWeight: 900, color: '#0f172a', margin: '3px 0' }}>{balance.toFixed(0)} <span style={{ fontSize: '10px' }}>ETB</span></div>
              <button
                type="button"
                onClick={() => switchPage('deposit')}
                style={{ width: '100%', background: '#059669', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '4px 0', fontSize: '10px', fontWeight: 800, cursor: 'pointer' }}
              >
                {lang === 'am' ? '+ አስገባ' : '+ Deposit'}
              </button>
            </div>

            {/* Wallet 2: Game Bonus */}
            <div style={{ background: '#ecfdf5', borderRadius: '14px', padding: '10px 8px', border: '1px solid #a7f3d0', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: '#065f46', fontWeight: 700 }}>{lang === 'am' ? 'ቦነስ' : 'Bonus'}</div>
              <div style={{ fontSize: '14px', fontWeight: 900, color: '#059669', margin: '3px 0' }}>{bonus.toFixed(0)} <span style={{ fontSize: '10px' }}>ETB</span></div>
              <button
                type="button"
                onClick={() => switchPage('games')}
                style={{ width: '100%', background: '#047857', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '4px 0', fontSize: '10px', fontWeight: 800, cursor: 'pointer' }}
              >
                {lang === 'am' ? 'ተጫወት' : 'Play'}
              </button>
            </div>

            {/* Wallet 3: Loyalty Coins */}
            <div style={{ background: '#fffbeb', borderRadius: '14px', padding: '10px 8px', border: '1px solid #fde68a', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: '#92400e', fontWeight: 700 }}>{lang === 'am' ? 'ሳንቲሞች' : 'Coins'}</div>
              <div style={{ fontSize: '14px', fontWeight: 900, color: '#d97706', margin: '3px 0' }}>{coins.toLocaleString()} <span style={{ fontSize: '11px' }}>🪙</span></div>
              <button
                type="button"
                disabled={coins < 1000 || isRedeemingCoins}
                onClick={handleRedeemCoins}
                style={{
                  width: '100%',
                  background: coins >= 1000 ? '#d97706' : '#fcd34d',
                  color: coins >= 1000 ? '#ffffff' : '#78350f',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '4px 0',
                  fontSize: '9.5px',
                  fontWeight: 800,
                  cursor: coins >= 1000 ? 'pointer' : 'default'
                }}
              >
                {isRedeemingCoins ? '...' : coins >= 1000 ? (lang === 'am' ? '10 ብር ቅያሬ' : 'Redeem 10') : `${coins}/1000`}
              </button>
            </div>
          </div>

          {/* Coin Progress Bar toward 1,000 Coin reward */}
          <div style={{ marginTop: '10px', background: '#f1f5f9', borderRadius: '999px', height: '6px', overflow: 'hidden' }}>
            <div style={{
              width: `${Math.min(100, ((coins % 1000) / 1000) * 100)}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #f59e0b, #10b981)',
              borderRadius: '999px',
              transition: 'width 0.3s ease'
            }}></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
            <span>{lang === 'am' ? '💡 1,000 ሳንቲም = 10 ብር የጨዋታ ቦነስ' : '💡 1,000 coins = 10 ETB game bonus'}</span>
            <span style={{ fontWeight: 700, color: '#d97706' }}>{coins % 1000} / 1000 🪙</span>
          </div>
        </div>

        {/* 2. Top Hero Card: Warm Creamy Lemon Background with 3D Treasure Chest */}
        <div
          style={{
            background: 'linear-gradient(135deg, #fefce8 0%, #fef08a 60%, #fde047 100%)',
            border: '1.5px solid #facc15',
            borderRadius: '24px',
            padding: '18px 16px',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 8px 24px rgba(234, 179, 8, 0.18)'
          }}
        >
          {/* Top Tag: TELEGRAM VIRAL REWARDS */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#ffffff',
              border: '1px solid #ca8a04',
              borderRadius: '999px',
              padding: '3px 12px',
              fontSize: '10.5px',
              fontWeight: '800',
              color: '#854d0e',
              letterSpacing: '0.8px',
              textTransform: 'uppercase',
              marginBottom: '10px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
            }}
          >
            <i className="fa-solid fa-users"></i>
            <span>TELEGRAM VIRAL REWARDS</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            {/* Left Texts */}
            <div style={{ flex: 1, zIndex: 2 }}>
              <h1
                style={{
                  fontSize: '22px',
                  fontWeight: '900',
                  color: '#0f172a',
                  margin: '0 0 6px 0',
                  lineHeight: '1.2',
                  letterSpacing: '-0.3px'
                }}
              >
                {lang === 'am' ? 'ጓደኞችን ይጋብዙና ' : 'Invite Friends & '}
                <span style={{ color: '#16a34a' }}>{lang === 'am' ? '10% ቦነስ ያግኙ!' : 'Earn 10% Bonus!'}</span>
              </h1>

              <p style={{ fontSize: '12px', color: '#475569', margin: 0, lineHeight: '1.4', fontWeight: '500' }}>
                {lang === 'am'
                  ? 'የሚጋብዙት ሰው ለመጀመሪያ ጊዜ ካስገባው ገንዘብ 10% የአንድ ጊዜ ቦነስ ያግኙ! ቦነሱ ለቢንጎ ጨዋታ የሚውል ሲሆን ያሸነፉትን ማውጣት ይችላሉ።'
                  : "Earn a 10% bonus on your friend's first deposit! Credited strictly for gameplay — all winnings are 100% withdrawable cash."}
              </p>
            </div>

            {/* Right: 3D Royal Treasure Chest Graphic */}
            <div
              style={{
                width: '100px',
                height: '100px',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                filter: 'drop-shadow(0 8px 16px rgba(202, 138, 4, 0.35))'
              }}
            >
              <img
                src="/assets/images/sonic-rewards-chest-coins.png"
                alt="3D ETB Royal Treasure Chest"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
          </div>
        </div>

        {/* 3. Big Glowing 1-Click Telegram Invite Button */}
        <button
          type="button"
          onClick={handleInviteTelegramFriends}
          style={{
            width: '100%',
            background: 'linear-gradient(135deg, #2AABEE 0%, #229ED9 50%, #0284c7 100%)',
            color: '#ffffff',
            fontSize: '15px',
            fontWeight: '900',
            border: 'none',
            borderRadius: '999px',
            padding: '14px 18px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 8px 25px rgba(34, 158, 217, 0.4)',
            letterSpacing: '0.2px',
            transition: 'all 0.15s ease'
          }}
        >
          {/* Left Telegram Plane Icon in White Circle */}
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: '#ffffff',
              color: '#2AABEE',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '17px',
              flexShrink: 0
            }}
          >
            <i className="fa-brands fa-telegram"></i>
          </div>

          {/* Center Text */}
          <span style={{ fontSize: '15.5px', fontWeight: '900' }}>
            👥 {lang === 'am' ? 'ጓደኞችን በቴሌግራም ይጋብዙ' : 'Invite Telegram Friends'}
          </span>

          {/* Right Bonus Pill Badge */}
          <span
            style={{
              background: 'rgba(255, 255, 255, 0.25)',
              color: '#ffffff',
              padding: '3px 10px',
              borderRadius: '999px',
              fontSize: '12px',
              fontWeight: '900',
              flexShrink: 0
            }}
          >
            10% BONUS
          </span>
        </button>

        {/* 4. Exact "YOUR INVITE LINK" Box with Copy Button */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '18px',
            padding: '12px 14px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)'
          }}
        >
          <div
            style={{
              fontSize: '10.5px',
              fontWeight: '800',
              color: '#64748b',
              letterSpacing: '0.8px',
              textTransform: 'uppercase',
              marginBottom: '8px',
              textAlign: 'left'
            }}
          >
            {lang === 'am' ? 'የእርስዎ የግብዣ ሊንክ' : 'YOUR INVITE LINK'}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '4px 6px 4px 12px',
              gap: '8px'
            }}
          >
            <i className="fa-solid fa-link" style={{ color: '#0284c7', fontSize: '13px' }}></i>
            <span
              style={{
                flex: 1,
                fontSize: '12px',
                color: '#0f172a',
                fontWeight: '600',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                textAlign: 'left',
                fontFamily: 'monospace'
              }}
            >
              {referralLink}
            </span>

            <button
              type="button"
              onClick={handleCopyLink}
              style={{
                background: copiedLink ? '#22c55e' : '#facc15',
                color: '#0f172a',
                border: 'none',
                borderRadius: '10px',
                padding: '8px 16px',
                fontSize: '12.5px',
                fontWeight: '900',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                flexShrink: 0,
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)'
              }}
            >
              <i className={`fa-solid ${copiedLink ? 'fa-check' : 'fa-copy'}`}></i>
              <span>{copiedLink ? (lang === 'am' ? 'ተቀድቷል' : 'Copied') : (lang === 'am' ? 'ቅዳ' : 'Copy')}</span>
            </button>
          </div>
        </div>

        {/* 5. Bonus Policy Cards (10% 1st Deposit Bonus & Gameplay Wallet rules) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {/* Card 1: 10% 1st Deposit Bonus */}
          <div
            style={{
              background: '#ffffff',
              border: '1.5px solid #e2e8f0',
              borderRadius: '20px',
              padding: '16px 12px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)'
            }}
          >
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: '#ecfdf5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#16a34a',
                fontSize: '18px',
                marginBottom: '2px'
              }}
            >
              <i className="fa-solid fa-coins"></i>
            </div>

            <strong style={{ fontSize: '13px', color: '#0f172a', fontWeight: '800' }}>
              {lang === 'am' ? '1ኛ ተቀማጭ ቦነስ' : '1st Deposit Bonus'}
            </strong>

            <div style={{ fontSize: '22px', fontWeight: '900', color: '#16a34a', letterSpacing: '-0.3px' }}>
              10% BONUS
            </div>

            <span style={{ fontSize: '11px', color: '#64748b' }}>
              {lang === 'am' ? 'ከተጋባዡ 1ኛ ገቢ ብቻ' : "1-Time on friend's 1st deposit"}
            </span>

            <span style={{ fontSize: '10px', color: '#059669', background: '#ecfdf5', padding: '2px 8px', borderRadius: '999px', fontWeight: '700' }}>
              {lang === 'am' ? 'የአንድ ጊዜ ቦነስ' : '1-Time Reward'}
            </span>
          </div>

          {/* Card 2: Gameplay Only Rule (Withdrawable Winnings) */}
          <div
            style={{
              background: 'linear-gradient(180deg, #fefce8 0%, #fef9c3 100%)',
              border: '1.5px solid #facc15',
              borderRadius: '20px',
              padding: '16px 12px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 4px 12px rgba(234, 179, 8, 0.15)'
            }}
          >
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #facc15 0%, #eab308 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#713f12',
                fontSize: '18px',
                marginBottom: '2px',
                boxShadow: '0 2px 8px rgba(234, 179, 8, 0.35)'
              }}
            >
              <i className="fa-solid fa-gamepad"></i>
            </div>

            <strong style={{ fontSize: '13px', color: '#713f12', fontWeight: '800' }}>
              {lang === 'am' ? 'ጨዋታ ብቻ' : 'Game Play Only'}
            </strong>

            <div style={{ fontSize: '20px', fontWeight: '900', color: '#ca8a04', letterSpacing: '-0.3px' }}>
              PLAY & WIN
            </div>

            <span style={{ fontSize: '11px', color: '#854d0e', fontWeight: '600' }}>
              {lang === 'am' ? 'ለቢንጎ ጨዋታ የሚውል' : 'Used directly to play'}
            </span>

            <span style={{ fontSize: '10px', color: '#854d0e', background: 'rgba(250, 204, 21, 0.3)', padding: '2px 8px', borderRadius: '999px', fontWeight: '700' }}>
              {lang === 'am' ? 'አሸናፊው ይወጣል' : 'Winnings 100% Cash'}
            </span>
          </div>
        </div>

        {/* 6. Analytics KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {/* Friends Invited */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.02)'
            }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: '#fef9c3',
                color: '#ca8a04',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                flexShrink: 0
              }}
            >
              <i className="fa-solid fa-users"></i>
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '18px', fontWeight: '900', color: '#0f172a' }}>
                {totalInvited}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>
                {lang === 'am' ? 'የተጋበዙ ጓደኞች' : 'Friends Invited'}
              </div>
            </div>
          </div>

          {/* Bonus Earned */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.02)'
            }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: '#ecfdf5',
                color: '#16a34a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                flexShrink: 0
              }}
            >
              <i className="fa-solid fa-gift"></i>
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '18px', fontWeight: '900', color: '#16a34a' }}>
                {totalEarned.toFixed(2)} ETB
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>
                {lang === 'am' ? 'የተገኘ የጨዋታ ቦነስ' : 'Game Bonus Earned'}
              </div>
            </div>
          </div>
        </div>

        {/* 7. Client Specified Rule Strip */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            fontSize: '11.5px',
            color: '#475569',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
            textAlign: 'center',
            lineHeight: '1.4'
          }}
        >
          <span style={{ color: '#16a34a', fontSize: '14px' }}>
            <i className="fa-solid fa-circle-info"></i>
          </span>
          <span>
            {lang === 'am'
              ? 'ቦነሱ ለጨዋታ መጫወቻ የሚውል ሲሆን (ወዲያውኑ አይወጣም)፣ በጨዋታ ያሸነፉትን ግን 100% ሙሉ በሙሉ ማውጣት ይችላሉ!'
              : "Referral bonus (10%) is strictly for gameplay and cannot be withdrawn directly. All winnings from playing are 100% withdrawable cash!"}
          </span>
        </div>

        {/* 8. Live Referred Friends List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 2px'
            }}
          >
            <span style={{ fontSize: '12px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              {lang === 'am' ? `የተጋበዙ ጓደኞች (${friendsList.length})` : `Referred Friends (${friendsList.length})`}
            </span>
            {loading && (
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                <i className="fa-solid fa-spinner fa-spin"></i>
              </span>
            )}
          </div>

          {friendsList.length === 0 ? (
            <div
              style={{
                background: '#ffffff',
                border: '1.5px dashed #cbd5e1',
                borderRadius: '16px',
                padding: '24px 16px',
                textAlign: 'center',
                color: '#64748b'
              }}
            >
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>🎁</div>
              <div style={{ fontSize: '13px', fontWeight: '800', color: '#1e293b', marginBottom: '4px' }}>
                {lang === 'am' ? 'እስካሁን ምንም ጓደኛ አልተጋበዘም' : 'No Friends Invited Yet'}
              </div>
              <div style={{ fontSize: '11.5px', color: '#64748b', maxWidth: '280px', margin: '0 auto' }}>
                {lang === 'am'
                  ? 'የእርስዎን ሊንክ ለጓደኞችዎ ያጋሩ፤ ለመጀመሪያ ጊዜ ሲያስገቡ 10% ቦነስ ያግኙ!'
                  : 'Share your invite link above. When friends register and make their first deposit, you instantly receive 10% in your game bonus!'}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {friendsList.map((friend) => (
                <div
                  key={friend.id}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '14px',
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        background: '#f1f5f9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '18px',
                        flexShrink: 0
                      }}
                    >
                      {friend.avatar || '👤'}
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {friend.name}
                        {friend.isPremium && (
                          <span style={{ fontSize: '11px', color: '#ca8a04' }}>★</span>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                        {new Date(friend.joinedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    {friend.status === 'paid' ? (
                      <>
                        <div style={{ fontSize: '13.5px', fontWeight: '900', color: '#16a34a' }}>
                          +{friend.bonusEarned.toFixed(2)} ETB
                        </div>
                        <span style={{ fontSize: '10px', color: '#15803d', background: '#dcfce7', padding: '2px 8px', borderRadius: '999px', fontWeight: '700' }}>
                          {lang === 'am' ? 'ተከፍሏል (10%)' : 'Rewarded (10%)'}
                        </span>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>
                          {lang === 'am' ? 'ተቀማጭ ይጠበቃል' : 'Waiting 1st Deposit'}
                        </div>
                        <span style={{ fontSize: '10px', color: '#b45309', background: '#fef3c7', padding: '2px 8px', borderRadius: '999px', fontWeight: '700' }}>
                          {lang === 'am' ? '10% ቦነስ' : '10% Pending'}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
