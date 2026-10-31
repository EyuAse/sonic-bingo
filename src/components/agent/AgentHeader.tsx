import React from 'react';
import { AgentDeskTab } from './AgentSidebar.tsx';

interface AgentHeaderProps {
  activeTab: AgentDeskTab;
  agentProfile: any;
  pendingCount?: number;
  openMobile: () => void;
  onPlayBingo: () => void;
  onLogout: () => void;
  onNavigateTab?: (tab: AgentDeskTab) => void;
}

export const AgentHeader: React.FC<AgentHeaderProps> = ({
  activeTab,
  agentProfile,
  pendingCount = 0,
  openMobile,
  onNavigateTab
}) => {
  const agentName = agentProfile?.fullName || agentProfile?.agentCode || 'Agent001';
  const initial = (agentProfile?.fullName || agentProfile?.agentCode || 'A').charAt(0).toUpperCase();

  return (
    <header
      style={{
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '14px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 30,
        minHeight: '68px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)'
      }}
    >
      {/* Left: Mobile Drawer Trigger + Search Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, maxWidth: '380px' }}>
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
              left: '16px',
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
              padding: '9px 16px 9px 40px',
              fontSize: '13px',
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

      {/* Right: Balance Pills + Notifications Bell + Profile Pill matching Reference UI */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Float Balance Pill */}
        <button
          type="button"
          onClick={() => onNavigateTab?.('recharge')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            borderRadius: '9999px',
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#065f46',
            fontSize: '12px',
            fontWeight: 800,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          title="Click to recharge float balance"
        >
          <i className="fa-solid fa-wallet" style={{ color: '#10b981' }}></i>
          <span>Float: <strong style={{ color: '#047857' }}>{Number(agentProfile?.walletBalance ?? agentProfile?.wallet_balance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB</strong></span>
          <span style={{ background: '#10b981', color: '#fff', borderRadius: '50%', width: '16px', height: '16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 900 }}>+</span>
        </button>

        {/* Commission Balance Pill */}
        <button
          type="button"
          onClick={() => onNavigateTab?.('cash_out')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            borderRadius: '9999px',
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            color: '#1e40af',
            fontSize: '12px',
            fontWeight: 800,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          title="Click to view and convert earned commission"
        >
          <i className="fa-solid fa-coins" style={{ color: '#3b82f6' }}></i>
          <span>Comm: <strong style={{ color: '#1d4ed8' }}>{Number(agentProfile?.commissionBalance ?? agentProfile?.commission_balance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB</strong></span>
          <i className="fa-solid fa-arrow-right" style={{ fontSize: '10px', color: '#3b82f6' }}></i>
        </button>

        {/* Notification Bell with Badge */}
        <div
          onClick={() => onNavigateTab?.('deposit_requests')}
          style={{
            position: 'relative',
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#334155',
            fontSize: '14px',
            cursor: 'pointer'
          }}
          title={pendingCount > 0 ? `${pendingCount} pending deposit requests` : 'Notifications'}
        >
          <i className="fa-regular fa-bell"></i>
          {pendingCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-2px',
                right: '-2px',
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
              {pendingCount}
            </span>
          )}
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
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              background: '#0f172a',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              fontWeight: 800
            }}
          >
            {initial}
          </div>

          <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
            {agentName}
          </span>

          <i className="fa-solid fa-chevron-down" style={{ fontSize: '10px', color: '#94a3b8' }}></i>
        </div>
      </div>
    </header>
  );
};
