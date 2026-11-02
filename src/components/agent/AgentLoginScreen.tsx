import React from 'react';

interface AgentLoginScreenProps {
  loginPhone: string;
  setLoginPhone: (val: string) => void;
  loginPassword: string;
  setLoginPassword: (val: string) => void;
  loginCode: string;
  setLoginCode: (val: string) => void;
  isLoggingIn: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onReturnToBingo: () => void;
}

export const AgentLoginScreen: React.FC<AgentLoginScreenProps> = ({
  loginPhone,
  setLoginPhone,
  loginPassword,
  setLoginPassword,
  loginCode,
  setLoginCode,
  isLoggingIn,
  onSubmit,
  onReturnToBingo
}) => {
  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        backgroundColor: '#ffffff',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '30px 16px',
        boxSizing: 'border-box',
        overflow: 'hidden',
        fontFamily: "'Inter', sans-serif"
      }}
    >
      {/* 1. Top-Left Elegant Black & Metallic Gold Ribbon Waves */}
      <svg
        viewBox="0 0 280 220"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '240px',
          height: '190px',
          pointerEvents: 'none',
          zIndex: 0
        }}
      >
        {/* Deep Black Obsidian Base Curve */}
        <path
          d="M0 0 L180 0 C130 50 80 90 0 170 Z"
          fill="#0a0d14"
        />
        {/* Metallic Gold Fluid Ribbon */}
        <path
          d="M0 45 C80 45 130 75 210 0 L230 0 C145 95 90 140 0 205 Z"
          fill="url(#agentGoldWaveGrad)"
          filter="drop-shadow(0 4px 10px rgba(0, 0, 0, 0.25))"
        />
        {/* Subtle Inner Accent Highlight */}
        <path
          d="M0 85 C65 85 110 115 175 45 L185 45 C120 125 75 160 0 220 Z"
          fill="url(#agentGoldWaveLight)"
          opacity="0.8"
        />
        <defs>
          <linearGradient id="agentGoldWaveGrad" x1="0" y1="0" x2="220" y2="190" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="30%" stopColor="#facc15" />
            <stop offset="70%" stopColor="#d97706" />
            <stop offset="100%" stopColor="#92400e" />
          </linearGradient>
          <linearGradient id="agentGoldWaveLight" x1="0" y1="60" x2="180" y2="190" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.6" />
            <stop offset="60%" stopColor="#fef08a" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#d97706" stopOpacity="0.2" />
          </linearGradient>
        </defs>
      </svg>

      {/* 2. Top-Right Soft Watermark Royal Crown */}
      <svg
        viewBox="0 0 100 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          position: 'absolute',
          top: '15px',
          right: '18px',
          width: '140px',
          height: '110px',
          pointerEvents: 'none',
          zIndex: 0,
          opacity: 0.12
        }}
      >
        <path
          d="M10 70 L90 70 L80 30 L50 55 L20 30 Z"
          stroke="#ca8a04"
          strokeWidth="3.5"
          strokeLinejoin="round"
          fill="none"
        />
        <circle cx="10" cy="25" r="4.5" fill="#ca8a04" />
        <circle cx="50" cy="18" r="5.5" fill="#ca8a04" />
        <circle cx="90" cy="25" r="4.5" fill="#ca8a04" />
        <path d="M10 70 L90 70 L85 78 L15 78 Z" fill="#ca8a04" />
      </svg>

      {/* Main Form Container */}
      <div
        style={{
          width: '100%',
          maxWidth: '430px',
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}
      >
        {/* 3. Branded App Squircle with Crown and Golden 'S' Monogram */}
        <div
          style={{
            width: '84px',
            height: '84px',
            borderRadius: '24px',
            background: 'radial-gradient(circle at 50% 30%, #1e293b 0%, #0a0d14 70%, #030508 100%)',
            border: '2px solid rgba(254, 240, 138, 0.45)',
            boxShadow: '0 14px 32px rgba(245, 158, 11, 0.38), inset 0 2px 4px rgba(255, 255, 255, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
            position: 'relative'
          }}
        >
          <svg width="54" height="54" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* 3D Polished Royal Crown */}
            <path
              d="M12 38 L52 38 L47 18 L32 28 L17 18 Z"
              fill="url(#brandCrownGrad)"
              stroke="#fef08a"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="15" r="2.8" fill="#fef08a" />
            <circle cx="23" cy="11" r="3.2" fill="#fef08a" />
            <circle cx="32" cy="8" r="3.8" fill="#ffffff" />
            <circle cx="41" cy="11" r="3.2" fill="#fef08a" />
            <circle cx="52" cy="15" r="2.8" fill="#fef08a" />
            {/* Crown Base Rim */}
            <rect x="14" y="38" width="36" height="4.5" rx="2" fill="url(#brandRimGrad)" stroke="#fef08a" strokeWidth="0.6" />
            {/* Golden 3D 'S' Monogram */}
            <text
              x="32"
              y="54"
              textAnchor="middle"
              fill="url(#brandSGrad)"
              fontSize="17"
              fontWeight="950"
              fontFamily="'Outfit', 'Inter', sans-serif"
              letterSpacing="0.5"
              filter="drop-shadow(0 2px 4px rgba(0,0,0,0.9))"
            >
              S
            </text>
            <defs>
              <linearGradient id="brandCrownGrad" x1="12" y1="8" x2="52" y2="38" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="40%" stopColor="#facc15" />
                <stop offset="80%" stopColor="#eab308" />
                <stop offset="100%" stopColor="#ca8a04" />
              </linearGradient>
              <linearGradient id="brandRimGrad" x1="14" y1="38" x2="50" y2="42.5" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="50%" stopColor="#facc15" />
                <stop offset="100%" stopColor="#b45309" />
              </linearGradient>
              <linearGradient id="brandSGrad" x1="22" y1="40" x2="42" y2="56" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="35%" stopColor="#fef08a" />
                <stop offset="75%" stopColor="#facc15" />
                <stop offset="100%" stopColor="#d97706" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* 4. Dual-Tone Title: Sonic Bingo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
          <span
            style={{
              fontSize: '32px',
              fontWeight: 950,
              fontFamily: "'Outfit', 'Inter', sans-serif",
              letterSpacing: '-0.5px',
              color: '#0f172a'
            }}
          >
            Sonic
          </span>
          <span
            style={{
              fontSize: '32px',
              fontWeight: 950,
              fontFamily: "'Outfit', 'Inter', sans-serif",
              letterSpacing: '-0.5px',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}
          >
            Bingo
          </span>
        </div>

        {/* 5. Pill Badge: 🛡️ Agent Terminal */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: '#fef3c7',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            padding: '5px 16px',
            borderRadius: '20px',
            marginBottom: '16px',
            boxShadow: '0 2px 6px rgba(245, 158, 11, 0.12)'
          }}
        >
          {/* Black Shield with White Checkmark */}
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M12 2L3 6V12C3 17.52 6.84 22.74 12 24C17.16 22.74 21 17.52 21 12V6L12 2Z"
              fill="#0f172a"
            />
            <path
              d="M10 15.5L6.5 12L7.91 10.59L10 12.67L16.09 6.59L17.5 8L10 15.5Z"
              fill="#ffffff"
            />
          </svg>
          <span
            style={{
              fontSize: '13px',
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '0.2px'
            }}
          >
            Agent Terminal
          </span>
        </div>

        {/* 6. Subtitle with Horizontal Dividing Lines */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            marginBottom: '26px',
            gap: '12px'
          }}
        >
          <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
          <span
            style={{
              fontSize: '12.5px',
              fontWeight: 600,
              color: '#475569',
              whiteSpace: 'nowrap'
            }}
          >
            Authorized Cash-In & Cash-Out Network Portal
          </span>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
        </div>

        {/* 7. Card Form Shell */}
        <div
          style={{
            width: '100%',
            background: '#ffffff',
            borderRadius: '24px',
            padding: '24px 20px',
            boxShadow: '0 16px 40px -10px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(0, 0, 0, 0.04)',
            boxSizing: 'border-box'
          }}
        >
          <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* ROW 1: Agent Phone Number */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              {/* Left Circle: Person Silhouette */}
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: '#fef3c7',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <i className="fa-solid fa-user" style={{ color: '#000000', fontSize: '20px' }}></i>
              </div>

              {/* Right Field */}
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13.5px',
                    fontWeight: 800,
                    color: '#0f172a',
                    marginBottom: '6px'
                  }}
                >
                  Agent Phone Number
                </label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    backgroundColor: '#f8fafc',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '10px 14px'
                  }}
                >
                  <i
                    className="fa-solid fa-phone"
                    style={{
                      color: '#0f172a',
                      fontSize: '15px',
                      transform: 'rotate(15deg)'
                    }}
                  ></i>
                  <input
                    type="text"
                    value={loginPhone}
                    onChange={e => setLoginPhone(e.target.value)}
                    placeholder="e.g. 0911223344"
                    required
                    style={{
                      width: '100%',
                      border: 'none',
                      outline: 'none',
                      backgroundColor: 'transparent',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#0f172a'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* ROW 2: PIN / Password */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              {/* Left Circle: Padlock */}
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: '#fef3c7',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <i className="fa-solid fa-lock" style={{ color: '#000000', fontSize: '20px' }}></i>
              </div>

              {/* Right Field */}
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13.5px',
                    fontWeight: 800,
                    color: '#0f172a',
                    marginBottom: '6px'
                  }}
                >
                  PIN / Password
                </label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    backgroundColor: '#f8fafc',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '10px 14px'
                  }}
                >
                  <i className="fa-solid fa-lock" style={{ color: '#0f172a', fontSize: '15px' }}></i>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    placeholder="Enter 4-digit PIN (default: 1234)"
                    style={{
                      width: '100%',
                      border: 'none',
                      outline: 'none',
                      backgroundColor: 'transparent',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#0f172a'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* ROW 3: Agent Code (Optional) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              {/* Left Circle: Ticket with Plus Notch */}
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: '#fef3c7',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M3 8.5C4.38 8.5 5.5 7.38 5.5 6V4.5C5.5 3.67 6.17 3 7 3H17C17.83 3 18.5 3.67 18.5 4.5V6C18.5 7.38 19.62 8.5 21 8.5C21.55 8.5 22 8.95 22 9.5V14.5C22 15.05 21.55 15.5 21 15.5C19.62 15.5 18.5 16.62 18.5 18V19.5C18.5 20.33 17.83 21 17 21H7C6.17 21 5.5 20.33 5.5 19.5V18C5.5 16.62 4.38 15.5 3 15.5C2.45 15.5 2 15.05 2 14.5V9.5C2 8.95 2.45 8.5 3 8.5Z"
                    fill="#0f172a"
                  />
                  <path
                    d="M12 8.5V15.5M8.5 12H15.5"
                    stroke="#fef3c7"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              {/* Right Field */}
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13.5px',
                    fontWeight: 800,
                    color: '#0f172a',
                    marginBottom: '6px'
                  }}
                >
                  Agent Code (Optional)
                </label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    backgroundColor: '#f8fafc',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '10px 14px'
                  }}
                >
                  <i
                    className="fa-solid fa-tag"
                    style={{
                      color: '#0f172a',
                      fontSize: '15px',
                      transform: 'rotate(-10deg)'
                    }}
                  ></i>
                  <input
                    type="text"
                    value={loginCode}
                    onChange={e => setLoginCode(e.target.value)}
                    placeholder="e.g. AGT-1001"
                    style={{
                      width: '100%',
                      border: 'none',
                      outline: 'none',
                      backgroundColor: 'transparent',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#0f172a'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* 8. Metallic Gold Action Button with Right Dark Arrow Circle */}
            <button
              type="submit"
              disabled={isLoggingIn}
              style={{
                width: '100%',
                borderRadius: '35px',
                padding: '8px 10px 8px 24px',
                background: 'linear-gradient(135deg, #fef08a 0%, #facc15 35%, #eab308 70%, #ca8a04 100%)',
                border: 'none',
                boxShadow: '0 10px 25px rgba(234, 179, 8, 0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: isLoggingIn ? 'not-allowed' : 'pointer',
                opacity: isLoggingIn ? 0.75 : 1,
                marginTop: '10px',
                transition: 'all 0.2s ease'
              }}
            >
              {/* Left Side: Door Icon + Text */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <i
                  className="fa-solid fa-arrow-right-to-bracket"
                  style={{ color: '#0f172a', fontSize: '18px', fontWeight: 900 }}
                ></i>
                <span
                  style={{
                    color: '#0f172a',
                    fontWeight: 900,
                    fontSize: '15.5px',
                    letterSpacing: '0.2px'
                  }}
                >
                  {isLoggingIn ? 'Authenticating...' : 'Access Agent Terminal'}
                </span>
              </div>

              {/* Right Side: Black Circular Badge with Gold Arrow */}
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  backgroundColor: '#0f172a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)'
                }}
              >
                {isLoggingIn ? (
                  <i className="fa-solid fa-spinner fa-spin" style={{ color: '#facc15', fontSize: '15px' }}></i>
                ) : (
                  <i className="fa-solid fa-arrow-right" style={{ color: '#facc15', fontSize: '15px' }}></i>
                )}
              </div>
            </button>
          </form>

          {/* 9. Return to Player App */}
          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <button
              type="button"
              onClick={onReturnToBingo}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px'
              }}
            >
              <i className="fa-solid fa-arrow-left"></i> Return to Sonic Bingo Game
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentLoginScreen;
