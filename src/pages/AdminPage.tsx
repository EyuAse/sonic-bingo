import React, { useState } from 'react';
import { useAdmin } from '../context/AdminContext.tsx';
import { useApp } from '../context/AppContext.tsx';
import { AdminPINModal } from '../components/admin/AdminPINModal.tsx';
import { AdminSidebar, AdminTab } from '../components/admin/AdminSidebar.tsx';
import { DashboardOverview } from '../components/admin/DashboardOverview.tsx';
import { CashflowDesk } from '../components/admin/CashflowDesk.tsx';
import { CashierDesk } from '../components/admin/CashierDesk.tsx';
import { PlayerAccountsDesk } from '../components/admin/PlayerAccountsDesk.tsx';
import { CartelasDesk } from '../components/admin/CartelasDesk.tsx';
import { TelegramBotDesk } from '../components/admin/TelegramBotDesk.tsx';
import { BotEngineControllerDesk } from '../components/admin/BotEngineControllerDesk.tsx';
import { AgentsDesk } from '../components/admin/AgentsDesk.tsx';
import { AgentRechargesDesk } from '../components/admin/AgentRechargesDesk.tsx';
import { AgentPayoutsDesk } from '../components/admin/AgentPayoutsDesk.tsx';
import { JackpotDesk } from '../components/admin/JackpotDesk.tsx';
import { BonusRewardsDesk } from '../components/admin/BonusRewardsDesk.tsx';
import { OfficialAccountsDesk } from '../components/admin/OfficialAccountsDesk.tsx';
import { BotsSimulatorDesk } from '../components/admin/BotsSimulatorDesk.tsx';
import { AdminSettings } from '../components/admin/AdminSettings.tsx';
import '../styles/admin.css';
import '../styles/admin-jackpot.css';
import '../styles/admin-cartelas.css';
import '../styles/admin-bot-engine.css';
import '../styles/admin-official-accounts.css';

const TAB_TITLES: Record<AdminTab, string> = {
  overview: '📊 Dashboard',
  cashflow: '📈 Cashflow & Treasury',
  cashier: '🛡️ P2P Cashier',
  users: '👥 Players',
  'bot-engine': '🎚️ Bot Engine (0-50)',
  'bot-players': '🤖 Bot Player Accounts',
  cartelas: '🗂️ 600 Cards',
  'telegram-bot': '📢 Telegram Bot',
  agents: '🤝 Agents',
  'agent-recharges': '⚡ Recharges',
  'agent-payouts': '💸 Payouts',
  'official-accounts': '🏛️ Official Accounts',
  jackpots: '🎰 Jackpots',
  coins: '🎁 Bonus & Rewards',
  settings: '⚙️ System Settings'
};

export const AdminPage: React.FC = () => {
  const { isAuthenticated, isSidebarCollapsed, toggleSidebar } = useAdmin();
  const { showToast } = useApp();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Tabs rendered using full-bleed Enqu design system (no duplicate topbar or quick ribbon)
  const isEnquTab =
    activeTab === 'overview' ||
    activeTab === 'cashflow' ||
    activeTab === 'cashier' ||
    activeTab === 'telegram-bot' ||
    activeTab === 'agents' ||
    activeTab === 'users' ||
    activeTab === 'coins' ||
    activeTab === 'agent-recharges' ||
    activeTab === 'agent-payouts' ||
    activeTab === 'jackpots' ||
    activeTab === 'cartelas' ||
    activeTab === 'bot-engine' ||
    activeTab === 'bot-players' ||
    activeTab === 'settings' ||
    activeTab === 'official-accounts';

  // If not authenticated, render the PIN lock guard
  if (!isAuthenticated) {
    return <AdminPINModal />;
  }

  return (
    <div className={`admin-layout-shell ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* 1. Modern Collapsible Sidebar */}
      <AdminSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isMobileOpen={isMobileSidebarOpen}
        closeMobileSidebar={() => setIsMobileSidebarOpen(false)}
      />

      {/* 2. Admin Content Viewport */}
      <div className={`admin-main-viewport ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        {/* Universal Sleek Mobile Topbar (Shown on mobile for ALL desks) */}
        <header className="admin-mobile-global-topbar">
          <div className="admin-mobile-topbar-left">
            <button
              type="button"
              className="admin-mobile-hamburger-btn"
              onClick={() => setIsMobileSidebarOpen(true)}
              aria-label="Open Navigation Drawer"
            >
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div className="admin-mobile-brand-group">
              <span className="admin-mobile-brand-title">Sonic Bingo</span>
              <span className="admin-mobile-desk-badge">{TAB_TITLES[activeTab]}</span>
            </div>
          </div>

          <div className="admin-mobile-topbar-right">
            <div className="admin-mobile-profile-avatar" title="Super Admin">
              <i className="fa-solid fa-crown gold" style={{ fontSize: '11px', color: '#f59e0b' }}></i>
            </div>
          </div>
        </header>

        {/* Top Header Bar (Shown on non-Enqu desks on desktop) */}
        {!isEnquTab && (
          <header className="admin-viewport-header-light">
            <div className="viewport-header-left-light">
              {isSidebarCollapsed && (
                <button
                  type="button"
                  className="btn-chatgpt-toggle"
                  onClick={toggleSidebar}
                  title="Open sidebar"
                  style={{ marginRight: '6px' }}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <line x1="9" y1="3" x2="9" y2="21" />
                  </svg>
                </button>
              )}
              <button
                className="admin-mobile-toggle-light"
                onClick={() => setIsMobileSidebarOpen(true)}
                title="Open Navigation"
              >
                <i className="fa-solid fa-bars"></i>
              </button>
              <div className="viewport-page-title-box">
                <h2 className="viewport-page-main-heading">
                  <i className="fa-solid fa-bolt-lightning header-gold-bolt"></i>
                  {activeTab === 'cashier' && 'P2P Cashier Surveillance & Network Audit Ledger'}
                </h2>
                <p className="viewport-page-amharic-sub">
                  {activeTab === 'cashier' && 'የወኪሎች P2P ተቀማጭ እና ክፍያ ክትትል፣ የሞባይል ገንዘብ ኦዲት መዝገብ እና የፍሎት ቁጥጥር'}
                </p>
              </div>
            </div>

            <div className="viewport-header-right-light">
              {/* Language Switcher Pill */}
              <div className="admin-lang-pill-light">
                <span className="lang-flag-icon">🇪🇹</span>
                <span className="lang-text-amharic">አማ</span>
                <i className="fa-solid fa-chevron-down lang-chevron-down"></i>
              </div>

              {/* Notification Bell with Badge */}
              <button
                type="button"
                className="admin-bell-btn-light"
                onClick={() => showToast('🔔 12 Pending Action items')}
                title="Notifications"
              >
                <i className="fa-regular fa-bell"></i>
                <span className="bell-red-badge">12</span>
              </button>

              {/* Admin Profile Pill */}
              <div className="admin-profile-pill-light">
                <div className="profile-crown-icon">
                  <i className="fa-solid fa-crown gold"></i>
                </div>
                <div className="profile-text-group">
                  <strong className="profile-name">Admin</strong>
                  <span className="profile-role">Super Admin</span>
                </div>
              </div>
            </div>
          </header>
        )}

        {/* Quick Tab Switcher Ribbon (Shown on non-Enqu desks) */}
        {!isEnquTab && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 1.5rem',
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-x pan-y',
            scrollbarWidth: 'none'
          }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
              Quick Nav:
            </span>
            {[
              { id: 'overview', label: '📊 Dashboard' },
              { id: 'bot-engine', label: '🎚️ Bot Engine (0-50)', highlight: true },
              { id: 'cashier', label: '🛡️ P2P Cashier' },
              { id: 'users', label: '👥 Players' },
              { id: 'telegram-bot', label: '📢 Telegram Bot' },
              { id: 'cartelas', label: '🗂️ 600 Cartelas' },
              { id: 'agents', label: '🤝 Agents' },
              { id: 'agent-recharges', label: '⚡ Recharges' },
              { id: 'agent-payouts', label: '💸 Payouts' },
              { id: 'jackpots', label: '🎰 Jackpots' },
              { id: 'coins', label: '🎁 Bonus & Rewards' }
            ].map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id as AdminTab)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: activeTab === t.id
                    ? '2px solid #10b981'
                    : (t.highlight ? '1px dashed #10b981' : '1px solid #e2e8f0'),
                  backgroundColor: activeTab === t.id
                    ? '#ecfdf5'
                    : (t.highlight ? '#f0fdf4' : '#f8fafc'),
                  color: activeTab === t.id
                    ? '#065f46'
                    : (t.highlight ? '#047857' : '#334155'),
                  fontSize: '0.8125rem',
                  fontWeight: activeTab === t.id || t.highlight ? 700 : 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease'
                }}
              >
                {t.label}
                {t.highlight && (activeTab as string) !== 'bot-engine' && (
                  <span style={{
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    fontSize: '0.625rem',
                    padding: '1px 5px',
                    borderRadius: '10px',
                    fontWeight: 800
                  }}>HOT</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Tab Content Panes */}
        <main className={`admin-tab-content ${isEnquTab ? 'enqu-overview-mode' : ''}`}>
          {/* TAB 1: OVERVIEW & ANALYTICS */}
          {activeTab === 'overview' && <DashboardOverview onNavigateTab={setActiveTab} />}

          {/* TAB 1b: CASHFLOW & TREASURY ANALYTICS */}
          {activeTab === 'cashflow' && <CashflowDesk />}

          {/* TAB 2: CASHIER APPROVALS DESK */}
          {activeTab === 'cashier' && <CashierDesk />}

          {/* TAB 3: PLAYER ACCOUNTS & WALLETS DIRECTORY */}
          {activeTab === 'users' && <PlayerAccountsDesk />}

          {/* TAB 5b: ROOM 10 DYNAMIC BOT ENGINE (0-50) */}
          {activeTab === 'bot-engine' && <BotEngineControllerDesk />}

          {/* TAB 5c: BOT PLAYER ACCOUNTS (260+ BOT ROSTER) */}
          {activeTab === 'bot-players' && <BotsSimulatorDesk />}

          {/* TAB 6: 600 SERIAL CARTELA CARDS LIBRARY */}
          {activeTab === 'cartelas' && <CartelasDesk />}

          {/* TAB 7: TELEGRAM BOT & ADS BROADCAST CENTER */}
          {activeTab === 'telegram-bot' && <TelegramBotDesk />}

          {/* TAB 8: AGENTS DIRECTORY */}
          {activeTab === 'agents' && <AgentsDesk />}

          {/* TAB 9: AGENT RECHARGES */}
          {activeTab === 'agent-recharges' && <AgentRechargesDesk />}

          {/* TAB 9b: AGENT COMMISSION PAYOUTS */}
          {activeTab === 'agent-payouts' && <AgentPayoutsDesk />}

          {/* TAB 9c: OFFICIAL RECEIVING ACCOUNTS */}
          {activeTab === 'official-accounts' && <OfficialAccountsDesk showToast={showToast} />}

          {/* TAB 10: PROGRESSIVE JACKPOTS */}
          {activeTab === 'jackpots' && <JackpotDesk />}

          {/* TAB 11: BONUS & REWARD MANAGEMENT */}
          {activeTab === 'coins' && <BonusRewardsDesk />}

          {/* TAB 12: SYSTEM CONFIGURATION & COMMISSION SETTINGS */}
          {activeTab === 'settings' && <AdminSettings />}
        </main>
      </div>
    </div>
  );
};
