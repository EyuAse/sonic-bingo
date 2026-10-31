import React from 'react';
import { AgentDeskTab } from './AgentSidebar.tsx';

interface AgentHeaderProps {
  activeTab: AgentDeskTab;
  agentProfile: any;
  openMobile: () => void;
  onPlayBingo: () => void;
  onLogout: () => void;
}

export const AgentHeader: React.FC<AgentHeaderProps> = ({
  activeTab,
  agentProfile,
  openMobile,
  onPlayBingo,
  onLogout
}) => {
  const agentName = agentProfile?.fullName || agentProfile?.agentCode || 'Agent001';
  const initial = agentName.charAt(0).toUpperCase();

  return (
    <header
      className="sonic-agent-header"
      style={{
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '12px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 30,
        minHeight: '70px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)'
      }}
    >
      {/* Left: Mobile Menu Trigger + Search Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, maxWidth: '420px' }}>
        <button
          type="button"
          className="sonic-mobile-menu-btn"
          onClick={openMobile}
          title="Open Menu"
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            color: '#0f172a',
            padding: '8px 12px',
            borderRadius: '8px',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          <i className="fa-solid fa-bars"></i>
        </button>

        {/* Search Bar matching Reference UI */}
        <div style={{ position: 'relative', width: '100%' }}>
          <i
            className="fa-solid fa-magnifying-glass"
            style={{
              position: 'absolute',
              left: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#94a3b8',
              fontSize: '13px'
            }}
          ></i>
          <input
            type="text"
            placeholder="Search..."
            style={{
              width: '100%',
              background: '#f1f5f9',
              border: '1px solid transparent',
              borderRadius: '9999px',
              padding: '10px 16px 10px 38px',
              fontSize: '13px',
              color: '#0f172a',
              outline: 'none',
              boxSizing: 'border-box',
              fontWeight: 500,
              transition: 'all 0.15s ease'
            }}
            onFocus={e => (e.target.style.background = '#ffffff', e.target.style.borderColor = '#cbd5e1')}
            onBlur={e => (e.target.style.background = '#f1f5f9', e.target.style.borderColor = 'transparent')}
          />
        </div>
      </div>

      {/* Right: Notifications Bell + Profile Dropdown + Quick Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Notification Bell with Red Badge "3" */}
        <div
          style={{
            position: 'relative',
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#334155',
            fontSize: '15px',
            cursor: 'pointer'
          }}
          title="3 unread notifications"
        >
          <i className="fa-regular fa-bell"></i>
          <span
            style={{
              position: 'absolute',
              top: '2px',
              right: '2px',
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              background: '#ef4444',
              color: '#ffffff',
              fontSize: '10px',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid #ffffff'
            }}
          >
            3
          </span>
        </div>

        {/* Profile Pill Badge matching Reference UI */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '4px 12px 4px 6px',
            borderRadius: '9999px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
          }}
          title={agentName}
        >
          {/* Avatar Circle with Initial "A" */}
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: '#1e293b',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              fontWeight: 800
            }}
          >
            {initial}
          </div>

          <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
            {agentName}
          </span>

          <i className="fa-solid fa-chevron-down" style={{ fontSize: '11px', color: '#94a3b8' }}></i>
        </div>

        {/* Quick Return to Player Bingo App */}
        <button
          type="button"
          onClick={onPlayBingo}
          style={{
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            padding: '8px 14px',
            fontSize: '12px',
            fontWeight: 700,
            color: '#334155',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
          title="Return to Player Gaming App"
        >
          <i className="fa-solid fa-gamepad" style={{ color: '#f59e0b' }}></i>
          <span className="hidden sm:inline">Play Bingo</span>
        </button>
      </div>
    </header>
  );
};
