import React from 'react';
import { AgentDeskTab } from './AgentSidebar.tsx';

interface AgentHeaderProps {
  activeTab: AgentDeskTab;
  agentProfile: any;
  pendingCount?: number;
  pendingWithdrawalsCount?: number;
  openMobile: () => void;
  onPlayBingo?: () => void;
  onLogout?: () => void;
  onNavigateTab?: (tab: AgentDeskTab) => void;
}

export const AgentHeader: React.FC<AgentHeaderProps> = ({
  activeTab,
  agentProfile,
  pendingCount = 0,
  pendingWithdrawalsCount = 0,
  openMobile,
  onNavigateTab
}) => {
  const agentName = agentProfile?.fullName || agentProfile?.agentCode || 'Admin';
  const initial = (agentProfile?.fullName || agentProfile?.agentCode || 'A').charAt(0).toUpperCase();

  return (
    <header
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
        minHeight: '64px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)'
      }}
    >
      {/* Left: Mobile Drawer Trigger + Search Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, maxWidth: '280px' }}>
        <button
          type="button"
          className="sonic-mobile-menu-btn"
          onClick={openMobile}
          title="Open Menu"
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            color: '#0f172a',
            padding: '7px 11px',
            borderRadius: '8px',
            fontSize: '13px',
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
              fontSize: '12px'
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
              padding: '8px 16px 8px 36px',
              fontSize: '12px',
              color: '#0f172a',
              outline: 'none',
              boxSizing: 'border-box',
              fontWeight: 500,
              transition: 'all 0.15s ease'
            }}
            onFocus={e => {
              e.target.style.background = '#ffffff';
              e.target.style.borderColor = '#cbd5e1';
            }}
            onBlur={e => {
              e.target.style.background = '#f1f5f9';
              e.target.style.borderColor = 'transparent';
            }}
          />
        </div>
      </div>

      {/* Right: Notifications Bell (Red Badge '3') + Profile Pill ('A Admin v') */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* Notification Bell with Badge '3' */}
        <div
          onClick={() => onNavigateTab?.('deposit_requests')}
          style={{
            position: 'relative',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#334155',
            fontSize: '14px',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}
          title={pendingCount > 0 ? `${pendingCount} notifications` : 'Notifications'}
        >
          <i className="fa-regular fa-bell"></i>
          <span
            style={{
              position: 'absolute',
              top: '-3px',
              right: '-3px',
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
            {pendingCount > 0 ? pendingCount : 3}
          </span>
        </div>

        {/* Profile Pill Badge ('A Admin v') */}
        <div
          onClick={() => onNavigateTab?.('profile')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 12px 4px 6px',
            borderRadius: '9999px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}
          title={agentName}
        >
          {/* Avatar Circle with Initial 'A' */}
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: '#0f172a',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 800
            }}
          >
            {initial}
          </div>

          <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>
            {agentName}
          </span>

          <i className="fa-solid fa-chevron-down" style={{ fontSize: '9px', color: '#94a3b8' }}></i>
        </div>
      </div>
    </header>
  );
};
