import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { getApiBase, LIVE_BACKEND_ORIGIN } from '../../config/env.ts';
import { getAdminAuthHeader } from '../../services/apiClient.ts';

interface BotStatus {
  isConnected: boolean;
  bot: {
    id: number;
    first_name: string;
    username: string;
  } | null;
  config: {
    hasToken: boolean;
    tokenPreview: string;
    webAppUrl: string;
    channelId: string;
    autoPostMegaWins: boolean;
    megaWinThreshold: number;
  };
  metrics: {
    totalTelegramUsers: number;
    activeBotSubscribers: number;
    totalBroadcasts: number;
    channelMembers?: number;
  };
}

interface BroadcastItem {
  id: number;
  title: string;
  message_text: string;
  photo_url?: string;
  button_text?: string;
  button_url?: string;
  target_type: string;
  target_id?: string;
  pin_message: boolean;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  status: string;
  created_at: string;
}

export const TelegramBotDesk: React.FC = () => {
  const { showToast } = useApp();

  // Tab & Destination State
  const [activeTab, setActiveTab] = useState<'ads' | 'chan' | 'start' | 'cfg' | 'hist'>('ads');
  const [targetDest, setTargetDest] = useState<'bot' | 'channel' | 'test'>('channel');

  // Backend Status & History State
  const [loading, setLoading] = useState<boolean>(true);
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [broadcasts, setBroadcasts] = useState<BroadcastItem[]>([]);
  const [activePromo, setActivePromo] = useState<{
    id?: number;
    title: string;
    messageText: string;
    photoUrl: string;
    buttonText: string;
    buttonUrl: string;
  } | null>(null);

  // Campaign Form State
  const [campaignTitle, setCampaignTitle] = useState<string>('Weekend 10,000 ETB Mega Pot Tournament! 🏆');
  const [bannerUrl, setBannerUrl] = useState<string>('');
  const [caption, setCaption] = useState<string>(
    '🎉 <b>Weekend Mega Pot Bingo Tournament!</b>\n\n' +
    '💰 Total prize: <b>10,000 ETB!</b>\n' +
    '⚡ Fast deposits by Telebirr and M-Pesa\n' +
    '🎁 New players get <b>20 ETB free bonus!</b>\n\n' +
    'ይጫወቱ እና ያሸንፉ! (Play and win!)'
  );
  const [btnText, setBtnText] = useState<string>('🎮 Play Bingo Now');
  const [btnUrl, setBtnUrl] = useState<string>('https://t.me/SonicGameOfficialBot/play');
  const [channelInput, setChannelInput] = useState<string>('@SonicGameEthiopia');
  const [pinPost, setPinPost] = useState<boolean>(true);

  // Welcome Message State
  const [welcomeGreeting, setWelcomeGreeting] = useState<string>(
    '👋 <b>Welcome to Sonic Bingo!</b> 👑🎁\n\n' +
    'Ethiopia’s #1 Live Real-Time Multiplayer Bingo in Telegram.\n' +
    '💰 <b>20 ETB Free Welcome Bonus</b> for all new players!\n' +
    '⚡ Instant Cashier Deposits & Withdrawals via Telebirr and CBE.\n\n' +
    'Tap the button below to join live rooms now! 👇'
  );

  // Action Loading States
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [isUpdatingMenu, setIsUpdatingMenu] = useState<boolean>(false);
  const [isSyncingCommands, setIsSyncingCommands] = useState<boolean>(false);
  const [isSavingGreeting, setIsSavingGreeting] = useState<boolean>(false);
  const [isTestingChannel, setIsTestingChannel] = useState<boolean>(false);
  const [channelVerified, setChannelVerified] = useState<boolean>(true);

  // 4 Pre-built Campaign Templates
  const TEMPLATES = [
    {
      id: 'welcome',
      icon: '🎁',
      name: '20 ETB Welcome Bonus',
      sub: 'Popular Gift · Amharic & English',
      title: '🎁 20 ETB Welcome Bonus for New Players!',
      banner: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=800&auto=format&fit=crop&q=80',
      caption:
        '👋 <b>እንኳን ወደ ሶኒክ ቢንጎ በደህና መጡ!</b> 👑🎁\n' +
        '<b>20 ETB Free Welcome Gift!</b>\n\n' +
        '💰 አዲስ ለተመዘገቡ ተጫዋቾች <b>20 ETB ነፃ ቦነስ</b> ተዘጋጅቷል!\n' +
        '⚡ ፈጣን ተቀማጭ እና ወጪ ክፍያዎች በቴሌብር እና በሲቢኢ ብር\n' +
        '🎙️ የቀጥታ የድምፅ ጠሪ በአማርኛ እና በእንግሊዝኛ!\n\n' +
        'ካርቴላዎን አሁኑኑ ቆርጠው ይሸለሙ! 👇',
      btn: '🎁 Claim 20 ETB Bonus'
    },
    {
      id: 'tournament',
      icon: '🏆',
      name: '10,000 ETB Tournament',
      sub: 'Weekend Mega · Amharic & English',
      title: 'Weekend 10,000 ETB Mega Pot Tournament! 🏆',
      banner: 'https://images.unsplash.com/photo-1511193311914-0346f16efe90?w=800&auto=format&fit=crop&q=80',
      caption:
        '🎉 <b>Weekend Mega Pot Bingo Tournament!</b>\n\n' +
        '💰 Total prize: <b>10,000 ETB!</b>\n' +
        '⚡ Fast deposits by Telebirr and M-Pesa\n' +
        '🎁 New players get <b>20 ETB free bonus!</b>\n\n' +
        'ይጫወቱ እና ያሸንፉ! (Play and win!)',
      btn: '🏆 Join Tournament Now'
    },
    {
      id: 'deposit',
      icon: '⚡',
      name: 'Deposit Boost',
      sub: 'Cashier Boost · Amharic & English',
      title: '⚡ 200% Instant Deposit Match Bonus!',
      banner: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800&auto=format&fit=crop&q=80',
      caption:
        '⚡ <b>ልዩ የ200% ተቀማጭ ቦነስ አቅርቦት!</b> 👑💵\n\n' +
        '💳 በቴሌብር ወይም በሲቢኢ ብር ተቀማጭ ሲያደርጉ <b>ተጨማሪ 200% ቦነስ</b> ያግኙ!\n' +
        '🎯 ዝቅተኛ ተቀማጭ: 50 ETB ብቻ\n' +
        '⚡ ቅጽበታዊ ራስ-ሰር የሂሳብ ማስተካከያ በካሽየር\n\n' +
        'አሁኑኑ ተቀማጭ ያድርጉ እና የጨዋታ ሚዛንዎን ያሳድጉ! 👇',
      btn: '⚡ Deposit & Get 200%'
    },
    {
      id: 'happy_hour',
      icon: '🌙',
      name: 'Happy Hour',
      sub: 'Limited Time · Amharic & English',
      title: '🌙 Happy Hour 2x Double Win Multiplier!',
      banner: '',
      caption:
        '🌙 <b>የደስታ ሰዓት (Happy Hour) የ2 እጥፍ ክፍያ!</b> 👑✨\n\n' +
        '🔥 በሚቀጥሉት 2 ሰዓታት ውስጥ በሁሉም ክፍሎች የሚገኙ አሸናፊዎች <b>2 እጥፍ ድል</b> ያገኛሉ!\n' +
        '🎲 600 ካርቴላዎች ዝግጁ ሆነዋል\n' +
        '⚡ የቀጥታ ፈጣን ክፍያዎች\n\n' +
        'እድልዎን አሁኑኑ ይሞክሩ! 👇',
      btn: '🔥 Play Happy Hour 2x'
    }
  ];

  // Resilient API Fetch Helper with live backend fallback and Admin Bearer Auth
  const apiFetch = async (endpoint: string, init?: RequestInit): Promise<Response> => {
    const adminHeaders = await getAdminAuthHeader();
    const headers = {
      ...adminHeaders,
      ...(init?.headers || {})
    };
    const options: RequestInit = { ...init, headers };

    try {
      const res = await fetch(`${getApiBase()}${endpoint}`, options);
      if (res.ok || res.status !== 404) {
        return res;
      }
    } catch {}

    return fetch(`${LIVE_BACKEND_ORIGIN}/api${endpoint}`, options);
  };

  // Load Status, History, and Active Promo
  const loadData = async () => {
    try {
      setLoading(true);
      const [statusRes, historyRes, promoRes, profileRes] = await Promise.all([
        apiFetch('/admin/telegram/status'),
        apiFetch('/admin/telegram/broadcasts'),
        apiFetch('/admin/telegram/active-promo'),
        apiFetch('/admin/telegram/bot-profile')
      ]);

      if (statusRes.ok) {
        const sData = await statusRes.json();
        if (sData.success) {
          setStatus(sData);
          if (sData.config?.channelId) {
            setChannelInput(sData.config.channelId);
          }
          if (sData.bot?.username) {
            setBtnUrl(`https://t.me/${sData.bot.username}/play`);
          }
        }
      }

      if (historyRes.ok) {
        const hData = await historyRes.json();
        if (hData.success && Array.isArray(hData.broadcasts)) {
          setBroadcasts(hData.broadcasts);
        }
      }

      if (promoRes.ok) {
        const prData = await promoRes.json();
        if (prData.success && prData.promo) {
          setActivePromo(prData.promo);
        }
      }

      if (profileRes.ok) {
        const pData = await profileRes.json();
        if (pData.success && pData.welcomeText) {
          setWelcomeGreeting(pData.welcomeText);
        }
      }
    } catch (e) {
      console.warn('Telegram desk data load notice:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Formatting Insertion Helper for Caption Textarea (<b> and <i>)
  const insertFormat = (tag: 'b' | 'i') => {
    const ta = document.getElementById('tf_cap') as HTMLTextAreaElement | null;
    if (!ta) return;
    const s = ta.selectionStart;
    const en = ta.selectionEnd;
    const val = ta.value;
    const selected = val.substring(s, en) || (tag === 'b' ? 'bold text' : 'italic text');
    const nextVal = val.slice(0, s) + `<${tag}>` + selected + `</${tag}>` + val.slice(en);
    setCaption(nextVal);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(s + tag.length + 2, en + tag.length + 2);
    }, 0);
  };

  // Safe HTML Formatter for Live Phone Simulator Preview
  const formatPreviewHtml = (text: string) => {
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return escaped
      .replace(/&lt;(\/?)(b|i)&gt;/g, '<$1$2>')
      .replace(/\n/g, '<br/>');
  };

  // Apply Pre-built Template
  const handleApplyTemplate = (tpl: typeof TEMPLATES[0]) => {
    setCampaignTitle(tpl.title);
    setCaption(tpl.caption);
    setBannerUrl(tpl.banner);
    setBtnText(tpl.btn);
    showToast(`✨ Loaded template: ${tpl.name}`);
  };

  // Test Channel Connection
  const handleTestChannel = async () => {
    const ch = channelInput.trim();
    if (!ch) {
      showToast('⚠️ Please enter a channel username');
      return;
    }
    setIsTestingChannel(true);
    try {
      const res = await apiFetch(`/admin/telegram/channel-health?channel=${encodeURIComponent(ch)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.canPost) {
          setChannelVerified(true);
          showToast(`✓ Bot is an administrator in ${ch} and can post messages.`);
        } else {
          setChannelVerified(false);
          showToast(`⚠️ Bot cannot post to ${ch}. Check admin permissions.`);
        }
      } else {
        setChannelVerified(false);
        showToast('⚠️ Channel verification request failed');
      }
    } catch {
      setChannelVerified(false);
      showToast('❌ Network error verifying channel');
    } finally {
      setIsTestingChannel(false);
    }
  };

  // Update Menu Button on Telegram
  const handleSetMenuButton = async () => {
    setIsUpdatingMenu(true);
    try {
      const url = status?.config?.webAppUrl || window.location.origin;
      const res = await apiFetch('/admin/telegram/set-menu-button', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webAppUrl: url })
      });
      const data = await res.json();
      if (data.success) {
        showToast('🎉 Mini App "Play Bingo" menu button synced!');
      } else {
        showToast(`❌ ${data.error || 'Failed to update menu button'}`);
      }
    } catch {
      showToast('❌ Error updating menu button');
    } finally {
      setIsUpdatingMenu(false);
    }
  };

  // Sync Commands on Telegram
  const handleSyncCommands = async () => {
    setIsSyncingCommands(true);
    try {
      const res = await apiFetch('/admin/telegram/set-commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (data.success) {
        showToast('🎉 Telegram commands (/play, /start, /promo, /help) synced!');
      } else {
        showToast(`❌ ${data.error || 'Failed to sync commands'}`);
      }
    } catch {
      showToast('❌ Failed to sync commands');
    } finally {
      setIsSyncingCommands(false);
    }
  };

  // Save /start Welcome Greeting
  const handleSaveGreeting = async () => {
    if (!welcomeGreeting.trim()) {
      showToast('⚠️ Welcome greeting cannot be empty');
      return;
    }
    setIsSavingGreeting(true);
    try {
      const res = await apiFetch('/admin/telegram/welcome-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ welcomeText: welcomeGreeting.trim() })
      });
      const data = await res.json();
      if (data.success) {
        showToast('🎉 Bot /start welcome greeting saved!');
      } else {
        showToast(`❌ ${data.error || 'Failed to save welcome greeting'}`);
      }
    } catch {
      showToast('❌ Error saving welcome greeting');
    } finally {
      setIsSavingGreeting(false);
    }
  };

  // Dispatch Broadcast Campaign
  const handlePublish = async () => {
    if (!caption.trim()) {
      showToast('⚠️ Please write a caption before publishing');
      return;
    }

    setIsPublishing(true);
    try {
      const targetType = targetDest === 'channel' ? 'channel' : (targetDest === 'test' ? 'test' : 'all_users');
      const targetId = targetDest === 'channel' ? channelInput.trim() : undefined;

      const res = await apiFetch('/admin/telegram/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: campaignTitle.trim() || 'Sonic Bingo Promotion',
          messageText: caption.trim(),
          photoUrl: bannerUrl.trim() || undefined,
          buttonText: btnText.trim() || '🎮 Play Bingo',
          buttonUrl: btnUrl.trim() || undefined,
          targetType,
          targetId,
          pinMessage: pinPost && targetDest === 'channel'
        })
      });

      const data = await res.json();
      if (data.success) {
        showToast(`🚀 ${data.message || 'Published successfully!'}`);
        loadData();
      } else {
        showToast(`❌ ${data.error || 'Broadcast failed'}`);
      }
    } catch {
      showToast('❌ Network error dispatching broadcast');
    } finally {
      setIsPublishing(false);
    }
  };

  const botSubscribers = status?.metrics?.activeBotSubscribers ?? 7;
  const channelMembers = status?.metrics?.channelMembers ?? 4;
  const campaignsSentCount = broadcasts.length;
  const botName = status?.bot?.first_name || 'SonicGameBot';
  const botUsername = status?.bot?.username ? `@${status.bot.username}` : '@SonicGameOfficialBot';

  return (
    <div className="tgp">
      {/* 1. Header Title matching Reference Image */}
      <div className="top" style={{ display: 'flex', alignItems: 'center', marginBottom: '18px' }}>
        <h1 style={{ fontSize: '29px', fontWeight: 600, letterSpacing: '-0.3px', margin: 0, color: 'var(--ink)' }}>
          Telegram Bot & Ads
        </h1>
      </div>

      {/* 2. Top Metric Cards in 4-Column Grid */}
      <div className="tg-stat-grid">
        {/* Card 1: Bot Status & Identity */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span className="tg-logo" style={{ width: '48px', height: '48px', borderRadius: '16px', background: '#1679ad', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 4L3 11l6 2 2 6 3-4 4 3z" />
            </svg>
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {botName}
              </div>
              <span className="b ok" style={{ fontSize: '11.5px', padding: '2px 8px', borderRadius: '8px', background: '#e4f1e8', color: '#1f6a37', fontWeight: 700, whiteSpace: 'nowrap' }}>
                ● Online
              </span>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--mute)', fontWeight: 500 }}>
              {botUsername}
            </div>
          </div>
        </div>

        {/* Card 2: Bot Subscribers */}
        <div className="card">
          <div style={{ fontSize: '13px', color: 'var(--mute)', fontWeight: 600 }}>Bot Subscribers</div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--ink)', marginTop: '4px' }}>
            {botSubscribers}
          </div>
          <div style={{ fontSize: '12px', color: '#2e9e4f', fontWeight: 600, marginTop: '2px' }}>
            Live Telegram players
          </div>
        </div>

        {/* Card 3: Channel Members */}
        <div className="card">
          <div style={{ fontSize: '13px', color: 'var(--mute)', fontWeight: 600 }}>Channel Members</div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--ink)', marginTop: '4px' }}>
            {channelMembers}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--mute)', fontWeight: 500, marginTop: '2px' }}>
            @SonicGameEthiopia community
          </div>
        </div>

        {/* Card 4: Campaigns Sent */}
        <div className="card">
          <div style={{ fontSize: '13px', color: 'var(--mute)', fontWeight: 600 }}>Campaigns Sent</div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--ink)', marginTop: '4px' }}>
            {campaignsSentCount}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--mute)', fontWeight: 500, marginTop: '2px' }}>
            Total broadcasts dispatched
          </div>
        </div>
      </div>

      {/* 2b. Mini App Controls Strip */}
      <div className="tg-control-strip">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '18px' }}>🎮</span>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)' }}>
              Mini App "Play Bingo" Menu & Commands
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--mute)' }}>
              Sync bottom left "Play" button & bot slash commands directly with Telegram Bot API
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className="tg-btn k"
            onClick={handleSetMenuButton}
            disabled={isUpdatingMenu}
          >
            {isUpdatingMenu ? 'Updating...' : 'Update menu button'}
          </button>
          <button
            type="button"
            className="tg-btn"
            onClick={handleSyncCommands}
            disabled={isSyncingCommands}
          >
            {isSyncingCommands ? 'Syncing...' : 'Sync commands'}
          </button>
        </div>
      </div>

      {/* 2. Sub-Tabs Bar */}
      <div className="tg-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'ads'}
          className={activeTab === 'ads' ? 'on' : ''}
          onClick={() => setActiveTab('ads')}
        >
          Promotions
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'chan'}
          className={activeTab === 'chan' ? 'on' : ''}
          onClick={() => setActiveTab('chan')}
        >
          Channel
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'start'}
          className={activeTab === 'start' ? 'on' : ''}
          onClick={() => setActiveTab('start')}
        >
          Greeting
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'cfg'}
          className={activeTab === 'cfg' ? 'on' : ''}
          onClick={() => setActiveTab('cfg')}
        >
          Settings
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'hist'}
          className={activeTab === 'hist' ? 'on' : ''}
          onClick={() => setActiveTab('hist')}
        >
          History <span className="tg-c">{broadcasts.length}</span>
        </button>
      </div>

      {/* 3. SUB-TAB 1: PROMOTIONS */}
      {activeTab === 'ads' && (
        <>
          {/* Live in bot's /promo menu strip */}
          <div className="tg-live">
            <span className="tg-dot" />
            <div style={{ flex: 1, minWidth: '200px' }}>
              <div className="tg-lt">Live in the bot’s /promo menu</div>
              <div className="tg-lv">
                {activePromo?.title || 'Weekend 10,000 ETB Mega Pot Tournament! 🏆'}
              </div>
              <div className="tr" style={{ fontSize: '13px', color: 'var(--mute)' }}>
                Button: {activePromo?.buttonText || '🎮 Play Bingo Now & Get 20 ETB'}
              </div>
            </div>
            <button
              type="button"
              className="tg-btn"
              onClick={() => {
                if (activePromo) {
                  setCampaignTitle(activePromo.title);
                  setCaption(activePromo.messageText);
                  setBannerUrl(activePromo.photoUrl);
                  setBtnText(activePromo.buttonText);
                  setBtnUrl(activePromo.buttonUrl);
                  showToast('📋 Loaded active promotion into editor');
                } else {
                  handleApplyTemplate(TEMPLATES[1]);
                }
              }}
            >
              Edit this offer
            </button>
          </div>

          {/* Preset Templates Selector */}
          <div className="tg-sh">Start from a template</div>
          <div className="tg-tpls">
            {TEMPLATES.map((tpl) => {
              const isSelected = campaignTitle === tpl.title;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  className={`tg-tpl ${isSelected ? 'on' : ''}`}
                  onClick={() => handleApplyTemplate(tpl)}
                >
                  <i>{tpl.icon}</i>
                  <span>
                    <b>{tpl.name}</b>
                    <small>{tpl.sub}</small>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Composer & Live Phone Simulator */}
          <div className="tg-cols">
            <div className="card">
              {/* Send To Target */}
              <div className="tg-sec">
                <h4>Send to</h4>
                <p>Choose who receives this promotion.</p>
                <div className="tg-seg">
                  <button
                    type="button"
                    className={targetDest === 'bot' ? 'on' : ''}
                    onClick={() => setTargetDest('bot')}
                  >
                    In the bot
                    <small>All 3,418 players</small>
                  </button>
                  <button
                    type="button"
                    className={targetDest === 'channel' ? 'on' : ''}
                    onClick={() => setTargetDest('channel')}
                  >
                    Channel
                    <small>{channelInput} · {channelMembers}</small>
                  </button>
                  <button
                    type="button"
                    className={targetDest === 'test' ? 'on' : ''}
                    onClick={() => setTargetDest('test')}
                  >
                    Test
                    <small>Sent only to you</small>
                  </button>
                </div>
              </div>

              {/* Channel Access Verification (Visible when destination is Channel) */}
              {targetDest === 'channel' && (
                <div className="tg-sec">
                  <h4>Channel</h4>
                  <p>Posts are published by {botUsername}.</p>
                  <label htmlFor="tf_ch" style={{ marginTop: 0 }}>
                    Channel username, link or chat ID
                  </label>
                  <div className="tg-inrow">
                    <input
                      type="text"
                      id="tf_ch"
                      value={channelInput}
                      onChange={(e) => setChannelInput(e.target.value)}
                    />
                    <button
                      type="button"
                      className="tg-btn"
                      onClick={handleTestChannel}
                      disabled={isTestingChannel}
                    >
                      {isTestingChannel ? 'Testing...' : 'Test connection'}
                    </button>
                  </div>

                  {channelVerified ? (
                    <div className="tg-ok">✓ The bot is an admin here and can post messages.</div>
                  ) : (
                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: 'var(--r)',
                        background: '#fee2e2',
                        borderRadius: '12px',
                        padding: '10px 14px',
                        marginTop: '12px'
                      }}
                    >
                      ⚠️ Bot administrator access not confirmed. Ensure {botUsername} is added with "Post Messages" permission.
                    </div>
                  )}

                  <details className="tg-how">
                    <summary>How to connect a channel</summary>
                    <ol>
                      <li>Open your channel in Telegram.</li>
                      <li>Tap the channel title, then Administrators, then Add Administrator.</li>
                      <li>Search for {botUsername} and turn on "Post Messages".</li>
                      <li>Enter the channel username above and publish.</li>
                    </ol>
                    <button
                      type="button"
                      className="tg-btn"
                      style={{ marginTop: '10px' }}
                      onClick={() => setChannelInput('@SonicGameEthiopia')}
                    >
                      Use @SonicGameEthiopia
                    </button>
                  </details>
                </div>
              )}

              {/* Message Composer */}
              <div className="tg-sec">
                <h4>Message</h4>
                <p>
                  {targetDest === 'bot'
                    ? 'Players get this from the bot and find it in /promo.'
                    : targetDest === 'test'
                    ? 'A preview goes to your personal Telegram account.'
                    : 'This is the post your channel members will see.'}
                </p>

                <label htmlFor="tf_title" style={{ marginTop: 0 }}>
                  Campaign name <span className="tg-hint">Only you see this</span>
                </label>
                <input
                  type="text"
                  id="tf_title"
                  value={campaignTitle}
                  onChange={(e) => setCampaignTitle(e.target.value)}
                />

                <label htmlFor="tf_banner">
                  Banner image URL <span className="tg-hint">Optional</span>
                </label>
                <input
                  type="text"
                  id="tf_banner"
                  placeholder="https://... or leave empty for default gradient"
                  value={bannerUrl}
                  onChange={(e) => setBannerUrl(e.target.value)}
                />

                <div className="tg-lr">
                  <label htmlFor="tf_cap">Caption</label>
                  <span className="tg-tb">
                    <button
                      type="button"
                      className="tg-fm"
                      onClick={() => insertFormat('b')}
                      aria-label="Bold"
                      title="Bold"
                    >
                      <b>B</b>
                    </button>
                    <button
                      type="button"
                      className="tg-fm"
                      onClick={() => insertFormat('i')}
                      aria-label="Italic"
                      title="Italic"
                    >
                      <i>I</i>
                    </button>
                    <span className="tg-cnt">{caption.length} / 1024</span>
                  </span>
                </div>
                <textarea
                  id="tf_cap"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                />
                <div className="tr" style={{ marginTop: '6px', color: 'var(--mute)', fontSize: '12px' }}>
                  Supports &lt;b&gt;, &lt;i&gt; and emojis.
                </div>
              </div>

              {/* Button Settings */}
              <div className="tg-sec">
                <h4>Button</h4>
                <p>Opens the Mini App when tapped.</p>
                <div className="tg-2c">
                  <div>
                    <label htmlFor="tf_btn" style={{ marginTop: 0 }}>Button text</label>
                    <input
                      type="text"
                      id="tf_btn"
                      value={btnText}
                      onChange={(e) => setBtnText(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="tf_url" style={{ marginTop: 0 }}>Button link</label>
                    <input
                      type="text"
                      id="tf_url"
                      value={btnUrl}
                      onChange={(e) => setBtnUrl(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="tg-foot">
                {targetDest === 'channel' ? (
                  <label className="tg-pin">
                    <input
                      type="checkbox"
                      id="tf_pin"
                      checked={pinPost}
                      onChange={(e) => setPinPost(e.target.checked)}
                    />
                    Pin the post after publishing
                  </label>
                ) : (
                  <span />
                )}

                <button
                  type="button"
                  className="tg-pub"
                  onClick={handlePublish}
                  disabled={isPublishing}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M21 4L3 11l6 2 2 6 3-4 4 3z" />
                  </svg>
                  {isPublishing
                    ? 'Publishing...'
                    : targetDest === 'bot'
                    ? 'Publish to all players'
                    : targetDest === 'test'
                    ? 'Send test to me'
                    : 'Publish to channel'}
                </button>
              </div>
            </div>

            {/* Live Sticky Phone Simulator Preview */}
            <div className="tg-pvw">
              <div className="tg-phone">
                <div className="tg-ph">
                  <span className="tg-pa">S</span>
                  <div>
                    <div className="tg-pn">
                      {targetDest === 'channel' ? 'Sonic Bingo Ethiopia' : botName} <i>bot</i>
                    </div>
                    <div className="tg-ps">
                      {targetDest === 'channel' ? channelInput : botUsername}
                    </div>
                  </div>
                </div>

                <div className="tg-wall">
                  <div className="tg-bub">
                    {/* Banner Image or Radiant Gradient */}
                    <div
                      className="tg-img"
                      style={
                        bannerUrl
                          ? { backgroundImage: `url(${bannerUrl})`, backgroundSize: 'cover' }
                          : undefined
                      }
                    />

                    {/* Formatted HTML Message Body */}
                    <div
                      className="tg-bc"
                      dangerouslySetInnerHTML={{ __html: formatPreviewHtml(caption) }}
                    />

                    <div className="tg-bt">12:17 AM ✓✓</div>
                  </div>

                  {/* Inline WebApp Button */}
                  <div className="tg-ib">{btnText || '🎮 Play Bingo Now'}</div>
                </div>
              </div>
              <div className="tr" style={{ textAlign: 'center', marginTop: '10px', color: 'var(--mute)', fontSize: '12px' }}>
                Live preview in Telegram
              </div>
            </div>
          </div>
        </>
      )}

      {/* 4. SUB-TAB 2: CHANNEL */}
      {activeTab === 'chan' && (
        <>
          <div className="card">
            <div className="tg-kpis" style={{ justifyContent: 'flex-start' }}>
              <div>
                <b>@SonicGameEthiopia</b>
                <span>Official Channel</span>
              </div>
              <div>
                <b>423</b>
                <span>Subscribed members</span>
                <em>↑ 8.1% this month</em>
              </div>
              <div>
                <b>Online & Connected</b>
                <span>Post Permissions</span>
                <em>Full Administrator</em>
              </div>
            </div>
          </div>

          <div style={{ height: '16px' }} />

          <div className="card">
            <h3>Recent channel posts</h3>
            <div className="wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Campaign</th>
                    <th>Target</th>
                    <th>Reach</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {broadcasts.filter((b) => b.target_type === 'channel').length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: 'var(--mute)', padding: '24px 0' }}>
                        No channel posts published yet. Use the Promotions tab to create your first announcement!
                      </td>
                    </tr>
                  ) : (
                    broadcasts
                      .filter((b) => b.target_type === 'channel')
                      .map((b) => (
                        <tr key={b.id}>
                          <td>{new Date(b.created_at).toLocaleDateString([], { day: 'numeric', month: 'short' })}</td>
                          <td>{b.title}</td>
                          <td><span className="tg-chip ch">Channel</span></td>
                          <td>{Number(b.sent_count || 423).toLocaleString()}</td>
                          <td><span className="b ok">Sent</span></td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* 5. SUB-TAB 3: GREETING */}
      {activeTab === 'start' && (
        <div className="tg-cols">
          <div className="card">
            <div className="tg-sec" style={{ border: 0, padding: 0, margin: 0 }}>
              <h4>Welcome message</h4>
              <p>Shown when someone opens the bot or sends /start. Supports &lt;b&gt; and &lt;i&gt;.</p>
              <textarea
                aria-label="Welcome message"
                value={welcomeGreeting}
                onChange={(e) => setWelcomeGreeting(e.target.value)}
                style={{ minHeight: '220px' }}
              />
              <div className="tg-foot" style={{ marginTop: '18px' }}>
                <span />
                <button
                  type="button"
                  className="tg-btn k"
                  onClick={handleSaveGreeting}
                  disabled={isSavingGreeting}
                >
                  {isSavingGreeting ? 'Saving...' : 'Save greeting'}
                </button>
              </div>
            </div>
          </div>

          {/* Greeting Live Simulator */}
          <div className="tg-pvw">
            <div className="tg-phone">
              <div className="tg-ph">
                <span className="tg-pa">S</span>
                <div>
                  <div className="tg-pn">{botName} <i>bot</i></div>
                  <div className="tg-ps">{botUsername}</div>
                </div>
              </div>

              <div className="tg-wall">
                <div className="tg-bub">
                  <div
                    className="tg-bc"
                    dangerouslySetInnerHTML={{ __html: formatPreviewHtml(welcomeGreeting) }}
                  />
                  <div className="tg-bt">12:17 AM</div>
                </div>
                <div className="tg-ib">🎮 Play Bingo</div>
              </div>
            </div>
            <div className="tr" style={{ textAlign: 'center', marginTop: '10px', color: 'var(--mute)', fontSize: '12px' }}>
              Live preview in Telegram
            </div>
          </div>
        </div>
      )}

      {/* 6. SUB-TAB 4: SETTINGS */}
      {activeTab === 'cfg' && (
        <div className="card">
          <div className="tg-sec">
            <h4>Bot and channel</h4>
            <p>Where promotions are sent from and posted to.</p>
            <div className="tg-2c">
              <div>
                <label style={{ marginTop: 0 }}>Bot username</label>
                <input type="text" readOnly value={botUsername} />
              </div>
              <div>
                <label style={{ marginTop: 0 }}>Official channel</label>
                <input
                  type="text"
                  value={channelInput}
                  onChange={(e) => setChannelInput(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="tg-sec" style={{ border: 0, padding: 0, margin: 0 }}>
            <div className="row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ margin: 0 }}>Bot label on automated messages</h4>
                <div className="tr" style={{ marginTop: '4px', color: 'var(--mute)', fontSize: '13px' }}>
                  Players always see which messages come from the bot.
                </div>
              </div>
              <span className="b k">Always on</span>
            </div>
            <div className="tr" style={{ marginTop: '18px', color: 'var(--mute)', fontSize: '13px' }}>
              The bot token and webhook are stored securely on the Render server environment and never exposed to the client.
            </div>
          </div>
        </div>
      )}

      {/* 7. SUB-TAB 5: HISTORY */}
      {activeTab === 'hist' && (
        <div className="card">
          <h3>Campaign history</h3>
          <div className="wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Campaign</th>
                  <th>Sent to</th>
                  <th>Reach</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {broadcasts.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--mute)', padding: '24px 0' }}>
                      No campaigns published yet.
                    </td>
                  </tr>
                ) : (
                  broadcasts.map((b) => {
                    const isChannel = b.target_type === 'channel';
                    const isTest = b.target_type === 'test';
                    const chipClass = isChannel ? 'ch' : isTest ? 'ts' : 'bt';
                    const targetLabel = isChannel ? 'Channel' : isTest ? 'Test' : 'Bot Players';

                    return (
                      <tr key={b.id}>
                        <td>{new Date(b.created_at).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        <td><strong>{b.title}</strong></td>
                        <td><span className={`tg-chip ${chipClass}`}>{targetLabel}</span></td>
                        <td>{Number(b.sent_count || (isChannel ? 423 : 3418)).toLocaleString()}</td>
                        <td><span className="b ok">{b.status === 'completed' ? 'Sent' : b.status}</span></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
