import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';

interface GameInstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type InstructionTab = 'how-to-play' | 'registration' | 'platform' | 'deposits' | 'withdrawals';

export const GameInstructionsModal: React.FC<GameInstructionsModalProps> = ({ isOpen, onClose }) => {
  const { lang } = useLanguage();
  const [activeTab, setActiveTab] = useState<InstructionTab>('how-to-play');

  if (!isOpen) return null;

  return (
    <div className="custom-modal-backdrop" onClick={onClose} style={{ zIndex: 9999 }}>
      <div
        className="fresh-payment-modal-card"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '540px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden'
        }}
      >
        {/* Modal Header */}
        <div
          className="payment-modal-header"
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(0,0,0,0.06)',
            background: 'linear-gradient(135deg, #181b20, #0f1216)',
            color: '#ffffff'
          }}
        >
          <div className="payment-modal-title-group">
            <div
              className="modal-title-icon"
              style={{
                background: 'rgba(245, 158, 11, 0.2)',
                color: '#fbbf24',
                border: '1px solid rgba(245, 158, 11, 0.4)'
              }}
            >
              <i className="fa-solid fa-book-open-reader"></i>
            </div>
            <div className="modal-title-texts">
              <h3 className="modal-heading" style={{ color: '#ffffff', fontSize: '17px' }}>
                {lang === 'am' ? 'የጨዋታ መመሪያዎች እና ደንቦች' : 'Game Instructions & Rules'}
              </h3>
              <span className="modal-subheading" style={{ color: '#94a3b8', fontSize: '12px' }}>
                {lang === 'am' ? 'ኦፊሴላዊ የፕላትፎርሙ አጠቃላይ መመሪያ' : 'Official Platform & Gameplay Guide'}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="btn-modal-close"
            onClick={onClose}
            title="Close"
            style={{ color: '#94a3b8' }}
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* 5 Tab Navigation Bar */}
        <div
          style={{
            display: 'flex',
            overflowX: 'auto',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            padding: '8px 12px',
            gap: '6px',
            scrollbarWidth: 'none'
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('how-to-play')}
            style={{
              padding: '6px 12px',
              borderRadius: '20px',
              border: 'none',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              background: activeTab === 'how-to-play' ? '#0f172a' : '#ffffff',
              color: activeTab === 'how-to-play' ? '#fbbf24' : '#64748b',
              boxShadow: activeTab === 'how-to-play' ? '0 2px 8px rgba(0,0,0,0.12)' : '0 1px 3px rgba(0,0,0,0.04)'
            }}
          >
            🎮 {lang === 'am' ? 'አጨዋወት' : 'How to Play'}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('registration')}
            style={{
              padding: '6px 12px',
              borderRadius: '20px',
              border: 'none',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              background: activeTab === 'registration' ? '#0f172a' : '#ffffff',
              color: activeTab === 'registration' ? '#fbbf24' : '#64748b',
              boxShadow: activeTab === 'registration' ? '0 2px 8px rgba(0,0,0,0.12)' : '0 1px 3px rgba(0,0,0,0.04)'
            }}
          >
            🎁 {lang === 'am' ? 'ምዝገባ' : 'Registration'}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('platform')}
            style={{
              padding: '6px 12px',
              borderRadius: '20px',
              border: 'none',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              background: activeTab === 'platform' ? '#0f172a' : '#ffffff',
              color: activeTab === 'platform' ? '#fbbf24' : '#64748b',
              boxShadow: activeTab === 'platform' ? '0 2px 8px rgba(0,0,0,0.12)' : '0 1px 3px rgba(0,0,0,0.04)'
            }}
          >
            🏛️ {lang === 'am' ? 'ፕላትፎርም' : 'Platform'}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('deposits')}
            style={{
              padding: '6px 12px',
              borderRadius: '20px',
              border: 'none',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              background: activeTab === 'deposits' ? '#0f172a' : '#ffffff',
              color: activeTab === 'deposits' ? '#fbbf24' : '#64748b',
              boxShadow: activeTab === 'deposits' ? '0 2px 8px rgba(0,0,0,0.12)' : '0 1px 3px rgba(0,0,0,0.04)'
            }}
          >
            💳 {lang === 'am' ? 'ተቀማጭ' : 'Deposits'}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('withdrawals')}
            style={{
              padding: '6px 12px',
              borderRadius: '20px',
              border: 'none',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              background: activeTab === 'withdrawals' ? '#0f172a' : '#ffffff',
              color: activeTab === 'withdrawals' ? '#fbbf24' : '#64748b',
              boxShadow: activeTab === 'withdrawals' ? '0 2px 8px rgba(0,0,0,0.12)' : '0 1px 3px rgba(0,0,0,0.04)'
            }}
          >
            🏧 {lang === 'am' ? 'ወጪ' : 'Withdrawals'}
          </button>
        </div>

        {/* Scrollable Tab Content */}
        <div
          style={{
            padding: '20px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            fontSize: '13px',
            lineHeight: 1.6,
            color: '#334155'
          }}
        >
          {/* TAB 1: HOW TO PLAY */}
          {activeTab === 'how-to-play' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div
                style={{
                  background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
                  border: '1px solid #facc15',
                  borderRadius: '14px',
                  padding: '12px 14px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '18px' }}>🎯</span>
                  <strong style={{ color: '#92400e', fontSize: '14px' }}>
                    {lang === 'am' ? 'ቢንጎን እንዴት መጫወት ይቻላል?' : 'How to Play Bingo'}
                  </strong>
                </div>
                <p style={{ margin: 0, color: '#78350f', fontSize: '12.5px' }}>
                  {lang === 'am'
                    ? 'ቢንጎ በቁጥር እድል እና ፍጥነት ላይ የተመሰረተ አስደሳች የቀጥታ ካሲኖ ጨዋታ ነው። ኳሶች ከ 1 እስከ 75 በቅደም ተከተል ይወጣሉ።'
                    : 'Bingo is an exciting live casino multiplayer game based on luck and speed. 75 balls numbered 1 to 75 are drawn live.'}
                </p>
              </div>

              {/* Step by step */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#0f172a', color: '#fbbf24', display: 'grid', placeItems: 'center', fontWeight: 800, flexShrink: 0, fontSize: '12px' }}>1</div>
                  <div>
                    <strong style={{ color: '#0f172a' }}>{lang === 'am' ? 'የጨዋታ ክፍል ይምረጡ (Choose Stake Room)' : 'Choose a Stake Room'}</strong>
                    <div style={{ color: '#64748b', fontSize: '12px' }}>
                      {lang === 'am'
                        ? 'በፍላጎትዎ መሰረት 10 ብር፣ 20 ብር፣ 50 ብር ወይም 100 ብር የቪአይፒ ክፍል ይምረጡ።'
                        : 'Select your preferred stake room: 10 ETB, 20 ETB, 50 ETB, or 100 ETB VIP.'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#0f172a', color: '#fbbf24', display: 'grid', placeItems: 'center', fontWeight: 800, flexShrink: 0, fontSize: '12px' }}>2</div>
                  <div>
                    <strong style={{ color: '#0f172a' }}>{lang === 'am' ? 'ካርቴላ ይቁረጡ (Pick 1 or 2 Cartelas)' : 'Pick 1 or 2 Cartelas'}</strong>
                    <div style={{ color: '#64748b', fontSize: '12px' }}>
                      {lang === 'am'
                        ? 'በአንድ ዙር 1 ወይም 2 ካርቴላዎችን መቁረጥ ይችላሉ። ካርቴላዎቹ 5x5 የቁጥር ሰንጠረዥ አላቸው።'
                        : 'Choose 1 or 2 cartelas per round. Each cartela contains a 5x5 matrix of numbers from 1 to 75.'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#0f172a', color: '#fbbf24', display: 'grid', placeItems: 'center', fontWeight: 800, flexShrink: 0, fontSize: '12px' }}>3</div>
                  <div>
                    <strong style={{ color: '#0f172a' }}>{lang === 'am' ? 'አውቶማቲክ ምልክት ማድረጊያ (Auto-Daub)' : 'Automatic Auto-Daubing'}</strong>
                    <div style={{ color: '#64748b', fontSize: '12px' }}>
                      {lang === 'am'
                        ? 'ኳሶች በአማርኛ ድምፅ እየተጠሩ ሲወጡ፣ ሲስተሙ በካርቴላዎ ላይ ያሉትን ቁጥሮች በራሱ ምልክት ያደርግልዎታል።'
                        : 'As numbered balls are called with native Amharic audio, our auto-dauber marks matching numbers automatically.'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#0f172a', color: '#fbbf24', display: 'grid', placeItems: 'center', fontWeight: 800, flexShrink: 0, fontSize: '12px' }}>4</div>
                  <div>
                    <strong style={{ color: '#0f172a' }}>{lang === 'am' ? 'ቢንጎ በማለት አሸንፉ (Claim BINGO)' : 'Claim BINGO & Win'}</strong>
                    <div style={{ color: '#64748b', fontSize: '12px' }}>
                      {lang === 'am'
                        ? 'ከ 13ቱ የማሸነፊያ ቅጦች አንዱን ቀድመው ሲያጠናቅቁ ቢንጎ ይበሉ። አሸናፊው የጠቅላላውን ፖት 80% ወዲያውኑ ይወስዳል!'
                        : 'Be the first to complete any of the 13 winning patterns to hit BINGO and win 80% of the total round pot!'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Coin Loyalty Rule Callout */}
              <div
                style={{
                  background: 'rgba(5, 150, 105, 0.08)',
                  border: '1px solid rgba(5, 150, 105, 0.25)',
                  borderRadius: '12px',
                  padding: '12px',
                  display: 'flex',
                  gap: '10px'
                }}
              >
                <span style={{ fontSize: '22px' }}>🪙</span>
                <div>
                  <strong style={{ color: '#065f46', fontSize: '13px' }}>
                    {lang === 'am' ? 'የሳንቲም (Coin) ሽልማት ህግ' : 'Sonic Coin Loyalty Rewards'}
                  </strong>
                  <div style={{ color: '#047857', fontSize: '12px', marginTop: '3px' }}>
                    {lang === 'am' ? (
                      <>
                        • በእያንዳንዱ በተጫወቱት 1 ብር <strong>1.5 ሳንቲሞች</strong> ያገኛሉ።<br />
                        • <em>ምሳሌ፡</em> 50 ብር ሲጫወቱ <strong>75 ሳንቲሞች</strong> ይሸለማሉ።<br />
                        • <strong>1,000 ሳንቲሞች = 20 ብር</strong> የጨዋታ ቦነስ ይቀየራሉ።<br />
                        • ሳንቲሞች ለጨዋታ ቦነስ ብቻ የሚውሉ ሲሆን በቀጥታ በጥሬ ገንዘብ ሊወጡ አይችሉም።
                      </>
                    ) : (
                      <>
                        • Earn <strong>1.5 coins</strong> per eligible Birr played.<br />
                        • <em>Example:</em> A 50 ETB game play earns <strong>75 coins</strong>.<br />
                        • <strong>1,000 coins = 20 ETB</strong> game bonus redemption.<br />
                        • Coins are for bonus game rewards and cannot be withdrawn directly as cash.
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: REGISTRATION */}
          {activeTab === 'registration' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div
                style={{
                  background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
                  border: '1px solid #bfdbfe',
                  borderRadius: '14px',
                  padding: '14px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '20px' }}>🎁</span>
                  <strong style={{ color: '#1e40af', fontSize: '14px' }}>
                    {lang === 'am' ? 'የ50 ብር የእንኳን ደህና መጡ ቦነስ!' : '50 ETB Welcome Gift!'}
                  </strong>
                </div>
                <p style={{ margin: 0, color: '#1e3a8a', fontSize: '12.5px' }}>
                  {lang === 'am'
                    ? 'አዲስ ተጫዋች ሲመዘገብ የ 50 ብር የእንኳን ደህና መጡ ስጦታ በቦነስ ዋሌቱ ውስጥ ወዲያውኑ ገቢ ይደረግለታል። በዚህ ቦነስ የቢንጎ ጨዋታዎችን መሞከር ይችላሉ!'
                    : 'Every new player instantly receives 50 ETB welcome bonus credited directly to their bonus wallet upon registration to start trying real games immediately!'}
                </p>
              </div>

              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <strong style={{ color: '#0f172a', display: 'block', marginBottom: '4px' }}>
                  🚀 {lang === 'am' ? 'ቀላል የ1-ጠቅታ ቴሌግራም ምዝገባ' : '1-Click Telegram Account Setup'}
                </strong>
                <p style={{ margin: 0, color: '#64748b', fontSize: '12px' }}>
                  {lang === 'am'
                    ? 'ምንም ረጅም ፎርም መሙላት ወይም የይለፍ ቃል ማስታወስ አያስፈልግዎትም። መለያዎ ከቴሌግራም መታወቂያዎ ጋር በከፍተኛ ጥበቃ የተያያዘ ነው።'
                    : 'No long registration forms or complex passwords. Your profile is automatically linked to your authenticated Telegram ID.'}
                </p>
              </div>

              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <strong style={{ color: '#0f172a', display: 'block', marginBottom: '4px' }}>
                  🛡️ {lang === 'am' ? 'የመለያ ደህንነት እና ጥበቃ' : 'Anti-Fraud & Account Protection'}
                </strong>
                <p style={{ margin: 0, color: '#64748b', fontSize: '12px' }}>
                  {lang === 'am'
                    ? 'ፍትሃዊነትን ለመጠበቅ በአንድ ቴሌግራም መለያ አንድ ተጫዋች ብቻ ይፈቀዳል። ተደጋጋሚ ወይም የቦት መለያዎች በራስ-ሰር ይታገዳሉ።'
                    : 'To protect platform fairness, only one account is permitted per Telegram user. Automated bot firewalls strictly block duplicate fake accounts.'}
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: PLATFORM OVERVIEW */}
          {activeTab === 'platform' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <strong style={{ color: '#0f172a', display: 'block', marginBottom: '4px' }}>
                  🎲 {lang === 'am' ? 'የ75-ኳስ የቀጥታ መልቲፕሌየር ቢንጎ' : '75-Ball Live Multiplayer Casino'}
                </strong>
                <p style={{ margin: 0, color: '#64748b', fontSize: '12px' }}>
                  {lang === 'am'
                    ? 'ከመላው ኢትዮጵያ ካሉ ተጫዋቾች ጋር በአንድ ላይ በቀጥታ የሚካሄድ ፈጣን እና ፍትሃዊ የቢንጎ ውድድር። ኳሶች ከ B-1 እስከ O-75 ይወጣሉ።'
                    : 'Synchronous real-time Bingo with live players across Ethiopia. Balls B-1 through O-75 are called by random verified algorithms.'}
                </p>
              </div>

              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <strong style={{ color: '#0f172a', display: 'block', marginBottom: '6px' }}>
                  🏟️ {lang === 'am' ? '4 የተለያዩ የውርርድ ክፍሎች (Rooms)' : '4 Multi-Stake Rooms'}
                </strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                  <div><strong>Room 10 (10 ብር):</strong> {lang === 'am' ? 'ለጀማሪዎች ተስማሚ ማህበራዊ ክፍል' : 'Social continuous gameplay room'}</div>
                  <div><strong>Room 20 (20 ብር):</strong> {lang === 'am' ? 'የእውነተኛ ተጫዋቾች P2P ፍልሚያ (Strictly Real Players)' : '100% Human-only P2P competition'}</div>
                  <div><strong>Room 50 (50 ብር):</strong> {lang === 'am' ? 'ከፍተኛ ሽልማት ያለው የውድድር ክፍል' : 'High-roller tournament room'}</div>
                  <div><strong>Room 100 VIP (100 ብር):</strong> {lang === 'am' ? 'የቪአይፒ ከፍተኛ ተወራራሾች አሬና' : 'Elite VIP arena'}</div>
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <strong style={{ color: '#0f172a', display: 'block', marginBottom: '4px' }}>
                  🏆 {lang === 'am' ? '80/20 የፖት ክፍፍል (Fair Pot Split)' : '80/20 Pot Distribution'}
                </strong>
                <p style={{ margin: 0, color: '#64748b', fontSize: '12px' }}>
                  {lang === 'am'
                    ? 'የአንድ ዙር አጠቃላይ የተሰበሰበው ፖት 80% ሙሉ በሙሉ ለአሸናፊው (ለደራሽ) ይሰጣል። 20% የፕላትፎርሙ የአገልግሎት ክፍያ ነው።'
                    : '80% of all cartela stakes in a round are paid directly to the winning player. 20% is retained as platform operating fee.'}
                </p>
              </div>

              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <strong style={{ color: '#0f172a', display: 'block', marginBottom: '4px' }}>
                  🎙️ {lang === 'am' ? 'የአማርኛ ድምፅ ጠሪ (Amharic Voice Caller)' : 'Native Amharic Audio Caller'}
                </strong>
                <p style={{ margin: 0, color: '#64748b', fontSize: '12px' }}>
                  {lang === 'am'
                    ? 'ሁሉም 75 ኳሶች ጥርት ባለ የሀገር ውስጥ የአማርኛ ድምፅ እና የካሲኖ ሳውንድ ኢፌክት አብረው ይደመጣሉ።'
                    : 'All 75 balls are voiced live by clear native Amharic audio callers with authentic casino sound effects.'}
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: DEPOSITS */}
          {activeTab === 'deposits' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div
                style={{
                  background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)',
                  border: '1px solid #a7f3d0',
                  borderRadius: '14px',
                  padding: '14px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '20px' }}>💳</span>
                  <strong style={{ color: '#065f46', fontSize: '14px' }}>
                    {lang === 'am' ? 'የተቀማጭ ገደቦች (Deposit Limits)' : 'Deposit Limits & Rules'}
                  </strong>
                </div>
                <div style={{ color: '#047857', fontSize: '12.5px' }}>
                  • <strong>{lang === 'am' ? 'ዝቅተኛ ተቀማጭ፡' : 'Minimum Deposit:'}</strong> 50 {lang === 'am' ? 'ብር' : 'ETB'}<br />
                  • <strong>{lang === 'am' ? 'ከፍተኛ ተቀማጭ፡' : 'Maximum Deposit:'}</strong> 1,500 {lang === 'am' ? 'ብር በአንድ ግብይት' : 'ETB per transaction'}<br />
                  • <strong>{lang === 'am' ? 'የአገልግሎት ክፍያ፡' : 'Service Fee:'}</strong> 0% ({lang === 'am' ? 'ሙሉው ገንዘብ ዋሌትዎ ላይ ይገባል' : 'Zero fee, 100% credited'})
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <strong style={{ color: '#0f172a', display: 'block', marginBottom: '4px' }}>
                  ⚡ {lang === 'am' ? 'ቴሌብር (Telebirr SMS Auto-Approval)' : 'Telebirr Instant SMS Verification'}
                </strong>
                <p style={{ margin: 0, color: '#64748b', fontSize: '12px' }}>
                  {lang === 'am'
                    ? 'በቴሌብር ሲያስገቡ የግብይት መለያ ቁጥሩን (SMS Code) በማስገባት በ 2-5 ሰከንዶች ውስጥ አውቶማቲክ ገቢ ይደረግልዎታል።'
                    : 'Transfer via Telebirr and submit your SMS transaction reference. Funds are reconciled and credited instantly within seconds.'}
                </p>
              </div>

              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <strong style={{ color: '#0f172a', display: 'block', marginBottom: '4px' }}>
                  🏦 {lang === 'am' ? 'የኢትዮጵያ ንግድ ባንክ (CBE & CBE Birr)' : 'Commercial Bank of Ethiopia'}
                </strong>
                <p style={{ margin: 0, color: '#64748b', fontSize: '12px' }}>
                  {lang === 'am'
                    ? 'ወደ ኦፊሴላዊ የCBE አካውንታችን ገንዘብ በማስተላለፍ የደረሰኝ ፎቶ በማያያዝ በካሺየሮቻችን በፍጥነት ይረጋገጣል።'
                    : 'Transfer to our official CBE account and attach your receipt. Our cashier verifies and credits your wallet swiftly.'}
                </p>
              </div>

              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <strong style={{ color: '#0f172a', display: 'block', marginBottom: '4px' }}>
                  🏪 {lang === 'am' ? 'የተመሰከረላቸው ኤጀንቶች (Certified Agents)' : 'Certified Cashier Agents'}
                </strong>
                <p style={{ margin: 0, color: '#64748b', fontSize: '12px' }}>
                  {lang === 'am'
                    ? 'በአቅራቢያዎ በሚገኙ የተፈቀደላቸው የሶኒክ ቢንጎ ኤጀንቶች በኩል በቀጥታ በጥሬ ገንዘብ ወይም በሞባይል ማስገባት ይችላሉ።'
                    : 'Deposit in cash or float through any active certified local Sonic Bingo agent across Ethiopian cities.'}
                </p>
              </div>
            </div>
          )}

          {/* TAB 5: WITHDRAWALS */}
          {activeTab === 'withdrawals' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div
                style={{
                  background: 'linear-gradient(135deg, #fef2f2, #fee2e2)',
                  border: '1px solid #fecaca',
                  borderRadius: '14px',
                  padding: '14px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '20px' }}>🏧</span>
                  <strong style={{ color: '#991b1b', fontSize: '14px' }}>
                    {lang === 'am' ? 'የማውጣት ደንቦች እና ገደቦች' : 'Withdrawal Limits & Rules'}
                  </strong>
                </div>
                <div style={{ color: '#b91c1c', fontSize: '12.5px' }}>
                  • <strong>{lang === 'am' ? 'ዝቅተኛ ወጪ፡' : 'Minimum Withdrawal:'}</strong> 50 {lang === 'am' ? 'ብር' : 'ETB'}<br />
                  • <strong>{lang === 'am' ? 'ከፍተኛ ወጪ፡' : 'Maximum Withdrawal:'}</strong> 2,000 {lang === 'am' ? 'ብር በአንድ ግብይት' : 'ETB per transaction'}<br />
                  • <strong>{lang === 'am' ? 'የቀን ገደብ፡' : 'Daily Limit:'}</strong> {lang === 'am' ? 'በቀን ቢበዛ 3 ጊዜ ብቻ' : 'Maximum 3 withdrawals per day'}
                </div>
              </div>

              {/* 5 Completed Games Anti-Fraud Rule Callout */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #fffbeb, #fef3c7)',
                  border: '1.5px solid #f59e0b',
                  borderRadius: '14px',
                  padding: '14px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '20px' }}>🛡️</span>
                  <strong style={{ color: '#92400e', fontSize: '13.5px' }}>
                    {lang === 'am' ? 'የ5 ጨዋታዎች ማጠናቀቅ ግዴታ (Anti-Fraud Rule)' : '5 Completed Games Requirement'}
                  </strong>
                </div>
                <p style={{ margin: '0 0 8px 0', color: '#78350f', fontSize: '12px', lineHeight: 1.5 }}>
                  {lang === 'am'
                    ? 'አንድ ተጫዋች ገንዘብ ለማውጣት ብቁ ለመሆን ቢያንስ 5 ጨዋታዎችን ማጠናቀቅ አለበት።'
                    : 'A player must complete at least 5 games before becoming eligible to withdraw.'}
                </p>
                <div
                  style={{
                    background: '#ffffff',
                    border: '1px dashed #d97706',
                    borderRadius: '10px',
                    padding: '8px 12px',
                    fontSize: '11.5px',
                    color: '#92400e'
                  }}
                >
                  <strong>{lang === 'am' ? 'የማውጣት ምሳሌ (Withdrawal Example):' : 'Withdrawal Example:'}</strong><br />
                  {lang === 'am'
                    ? 'አንድ ተጫዋች 100 ብር ቢያስገባ ያንኑ 100 ብር ወዲያውኑ ማውጣት አይችልም። መጀመሪያ በ 5 ጨዋታዎች ላይ መሳተፍ እና ማጠናቀቅ አለበት።'
                    : 'A player deposits 100 Birr. They cannot immediately withdraw the 100 Birr. They must first participate in and complete 5 games before requesting a withdrawal.'}
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <strong style={{ color: '#0f172a', display: 'block', marginBottom: '4px' }}>
                  ⚡ {lang === 'am' ? 'ፈጣን የሞባይል ክፍያ ወደ ሂሳብዎ' : 'Fast Direct Payout to Mobile'}
                </strong>
                <p style={{ margin: 0, color: '#64748b', fontSize: '12px' }}>
                  {lang === 'am'
                    ? 'የወጪ ጥያቄዎ እንደተረጋገጠ ገንዘቡ በቀጥታ ወደ ቴሌብር ቁጥርዎ ወይም የንግድ ባንክ ሂሳብዎ ይተላለፋል። በቴሌግራም ፈጣን ማሳወቂያ ይደርስዎታል።'
                    : 'Once verified, funds are transferred directly to your registered Telebirr number or CBE bank account with instant Telegram confirmation.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Button */}
        <div
          style={{
            padding: '12px 20px',
            background: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'flex-end'
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '9px 20px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #181b20, #0f1216)',
              color: '#fbbf24',
              border: 'none',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            {lang === 'am' ? 'ተረድቻለሁ (እሺ)' : 'Got it, thanks!'}
          </button>
        </div>
      </div>
    </div>
  );
};
