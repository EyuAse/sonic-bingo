import React from 'react';
import { AgentDeskTab } from './AgentSidebar.tsx';

interface AgentDashboardDeskProps {
  profile: any;
  metrics: any;
  onNavigateTab: (tab: AgentDeskTab) => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export const AgentDashboardDesk: React.FC<AgentDashboardDeskProps> = ({
  profile,
  metrics,
  onNavigateTab,
  onRefresh,
  isLoading
}) => {
  const floatBal = profile ? Number(profile.walletBalance) : 0;
  const threshold = profile ? Number(profile.lowBalanceThreshold) : 1000;
  const isLowFloat = floatBal <= threshold;

  const todayVol = metrics ? Number(metrics.todayDeposited) : 0;
  const monthVol = metrics ? Number(metrics.monthDeposited) : 0;
  const targetMonthly = metrics ? Number(metrics.targetMonthly) : 50000;
  const targetProgress = metrics ? Number(metrics.targetProgress) : 0;
  const commissionRate = metrics ? Number(metrics.commissionRate) : 5;
  const estimatedCommission = metrics ? Number(metrics.estimatedCommission) : 0;
  const activePlayers = metrics ? Number(metrics.activePlayers) : 0;
  const totalPlayers = metrics ? Number(metrics.totalPlayers) : 0;

  return (
    <div className="space-y-6">
      {/* 1. Low-Balance Warning Alert Banner (Triggers when Float <= 1,000 ETB) */}
      {isLowFloat && (
        <div className="sonic-alert-low-float">
          <div className="flex items-center gap-3">
            <span style={{ fontSize: '26px' }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 900, color: '#991b1b', fontSize: '15px' }}>
                LOW FLOAT WARNING: {floatBal.toFixed(2)} ETB
              </div>
              <div style={{ fontSize: '12px', color: '#b91c1c', marginTop: '2px' }}>
                Your platform float balance has dropped below the {threshold.toLocaleString()} ETB safety threshold.
                Submit a float recharge to continue processing instant player cash-ins.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('recharge')}
            style={{
              background: '#dc2626',
              color: '#ffffff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '10px',
              fontWeight: 800,
              fontSize: '12px',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            + Recharge Float
          </button>
        </div>
      )}

      {/* 2. Hero Float Balance Card (Reference UI Styling) */}
      <div className="sonic-contrast-card">
        <div className="sonic-contrast-card-header">
          <h3>
            <span>👑</span>
            <span>Platform Float Liquidity</span>
          </h3>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <i className={`fa-solid fa-rotate-right ${isLoading ? 'fa-spin' : ''}`}></i> Refresh
          </button>
        </div>

        <div className="sonic-contrast-card-body">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {/* Float Number */}
            <div className="md:col-span-2">
              <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>
                Available Agent Balance
              </span>
              <div style={{ fontSize: '38px', fontWeight: 900, color: '#047857', marginTop: '2px', lineHeight: 1.1 }}>
                {floatBal.toLocaleString('en-US', { minimumFractionDigits: 2 })} <span style={{ fontSize: '20px', fontWeight: 800 }}>ETB</span>
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                Initial Float: <strong>{profile ? Number(profile.initialDeposit).toLocaleString() : '10,000'} ETB</strong> | Warning Threshold: <strong>{threshold.toLocaleString()} ETB</strong>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="sonic-btn-gold"
                onClick={() => onNavigateTab('cash_in')}
                style={{ padding: '12px' }}
              >
                <i className="fa-solid fa-bolt"></i>
                <span>+ Credit Player (Cash-In)</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('cash_out')}
                style={{
                  background: '#ecfdf5',
                  border: '1px solid #10b981',
                  color: '#047857',
                  borderRadius: '12px',
                  padding: '12px',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <i className="fa-solid fa-money-bill-transfer"></i>
                <span>Redeem Voucher (Cash-Out)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Four Core Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="sonic-white-card" style={{ padding: '18px', margin: 0 }}>
          <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>
            Today's Volume
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#f59e0b', marginTop: '4px' }}>
            {todayVol.toLocaleString()} <span style={{ fontSize: '12px', fontWeight: 700 }}>ETB</span>
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Processed today</div>
        </div>

        {/* Metric 2 */}
        <div className="sonic-white-card" style={{ padding: '18px', margin: 0 }}>
          <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>
            Month's Volume
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#3b82f6', marginTop: '4px' }}>
            {monthVol.toLocaleString()} <span style={{ fontSize: '12px', fontWeight: 700 }}>ETB</span>
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Calendar month total</div>
        </div>

        {/* Metric 3 */}
        <div className="sonic-white-card" style={{ padding: '18px', margin: 0 }}>
          <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>
            Active Players
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#8b5cf6', marginTop: '4px' }}>
            {activePlayers} <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>/ {totalPlayers} total</span>
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Under your agency</div>
        </div>

        {/* Metric 4 */}
        <div className="sonic-white-card" style={{ padding: '18px', margin: 0 }}>
          <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>
            Commission ({commissionRate}%)
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#10b981', marginTop: '4px' }}>
            {estimatedCommission.toLocaleString()} <span style={{ fontSize: '12px', fontWeight: 700 }}>ETB</span>
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Estimated earnings</div>
        </div>
      </div>

      {/* 4. Monthly Target Progress Bar */}
      <div className="sonic-white-card" style={{ margin: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div>
            <strong style={{ fontSize: '14px', color: '#0f172a' }}>Monthly Target Quota</strong>
            <span style={{ fontSize: '12px', color: '#64748b', display: 'block' }}>
              Target: {targetMonthly.toLocaleString()} ETB | Progress: {monthVol.toLocaleString()} ETB
            </span>
          </div>
          <span style={{ fontSize: '16px', fontWeight: 900, color: '#f59e0b' }}>
            {targetProgress}%
          </span>
        </div>

        <div style={{ width: '100%', height: '10px', background: '#f1f5f9', borderRadius: '20px', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${Math.min(100, targetProgress)}%`,
              background: 'linear-gradient(135deg, #f59e0b, #10b981)',
              borderRadius: '20px',
              transition: 'width 0.4s ease'
            }}
          />
        </div>
        <p style={{ fontSize: '11px', color: '#94a3b8', margin: '8px 0 0 0' }}>
          Meet your target to unlock tier-2 commission bonuses (up to 7.5%) and priority float replenishment.
        </p>
      </div>
    </div>
  );
};
