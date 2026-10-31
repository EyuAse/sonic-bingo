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
  const getTabTitle = (tab: AgentDeskTab) => {
    switch (tab) {
      case 'overview': return 'Executive Dashboard & Float Liquidity';
      case 'cash_in': return 'Player Cash-In Terminal (Instant Deposit)';
      case 'cash_out': return 'Cash-Out Counter (Voucher Redemption)';
      case 'recharge': return 'Float Replenishment Desk';
      case 'players': return 'Referred Players CRM & Network';
      case 'statements': return 'Financial Statement & Audit Ledger';
      case 'profile': return 'Agency Profile & QR Deep Link';
      default: return 'Agent Operations Terminal';
    }
  };

  const floatBal = agentProfile ? Number(agentProfile.walletBalance) : 0;
  const threshold = agentProfile ? Number(agentProfile.lowBalanceThreshold) : 1000;
  const isLowFloat = floatBal <= threshold;

  return (
    <header className="sonic-agent-header">
      <div className="sonic-header-left">
        {/* Mobile Hamburger Toggle */}
        <button
          type="button"
          className="sonic-mobile-menu-btn"
          onClick={openMobile}
          title="Open Menu"
        >
          <i className="fa-solid fa-bars"></i>
        </button>

        <div className="sonic-header-title-box">
          <h1>
            <span>👑</span>
            <span>{getTabTitle(activeTab)}</span>
          </h1>
          <p>Sonic Bingo Decentralized Agent Network</p>
        </div>
      </div>

      <div className="sonic-header-actions">
        {/* Reference Screenshot Style Glossy Pills */}
        <div className="sonic-header-pills-row">
          <div className="sonic-glossy-pill gold" title="Agent Code">
            <i className="fa-solid fa-id-badge" style={{ color: '#f59e0b' }}></i>
            <span>{agentProfile?.agentCode || 'AGENT'}</span>
          </div>

          <div
            className={`sonic-glossy-pill ${isLowFloat ? 'crimson' : 'emerald'}`}
            title="Live Agent Float Liquidity"
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: isLowFloat ? '#ef4444' : '#10b981',
                display: 'inline-block'
              }}
            />
            <span>{floatBal.toLocaleString('en-US', { minimumFractionDigits: 2 })} ETB</span>
          </div>
        </div>

        {/* Action Buttons */}
        <button
          type="button"
          onClick={onPlayBingo}
          className="sonic-btn-header-action"
          title="Switch to Player Gaming View"
        >
          <i className="fa-solid fa-gamepad" style={{ color: '#f59e0b' }}></i>
          <span>Play Game</span>
        </button>

        <button
          type="button"
          onClick={onLogout}
          className="sonic-btn-header-action"
          style={{ color: '#ef4444', borderColor: '#fecaca' }}
          title="Sign Out of Agent Portal"
        >
          <i className="fa-solid fa-arrow-right-from-bracket"></i>
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
};

