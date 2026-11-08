import React, { useState, useEffect } from 'react';
import { useAdmin } from '../../context/AdminContext.tsx';
import { useApp } from '../../context/AppContext.tsx';

export type AdminTab =
  | 'overview'
  | 'cashflow'
  | 'cashier'
  | 'users'
  | 'bot-engine'
  | 'bot-players'
  | 'cartelas'
  | 'telegram-bot'
  | 'agents'
  | 'agent-recharges'
  | 'agent-payouts'
  | 'official-accounts'
  | 'jackpots'
  | 'coins'
  | 'settings';

interface AdminSidebarProps {
  activeTab: AdminTab;
  setActiveTab: (tab: AdminTab) => void;
  isMobileOpen: boolean;
  closeMobileSidebar: () => void;
}

export interface NavSubItem {
  id: AdminTab;
  label: string;
  badge?: string | number;
  urgentBadge?: boolean;
  statusTag?: string;
}

export interface NavGroup {
  id: string;
  label: string;
  iconPath?: string;
  directTab?: AdminTab;
  subItems?: NavSubItem[];
  badge?: string | number;
  urgentBadge?: boolean;
}

// Minimalist SVG Stroke Icons
const IC = {
  dash: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  bolt: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  cf: 'M3 3v18h18M7 16l4-4 4 4 6-6M17 6h4v4',
  p2p: 'M4 8h14l-3-3M20 16H6l3 3',
  pl: 'M12 4a4 4 0 100 8 4 4 0 000-8zM4 20c0-4 4-6 8-6s8 2 8 6',
  bot: 'M6 8h12v10H6zM12 4v4M9 13h.01M15 13h.01',
  eng: 'M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v3M12 19v3M2 12h3M19 12h3',
  room: 'M3 5h18v14H3zM3 10h18M9 5v14',
  tg: 'M21 4L3 11l6 2 2 6 3-4 4 3z',
  ads: 'M3 10v4h4l6 4V6L7 10zM17 9a4 4 0 010 6',
  ag: 'M3 7h18v13H3zM8 7V4h8v3',
  rc: 'M12 3v18M7 8h7a3 3 0 010 6H8',
  po: 'M4 6h16v12H4zM4 10h16M8 15h3',
  of: 'M4 10l8-6 8 6M6 10v8M10 10v8M14 10v8M18 10v8M3 20h18',
  jp: 'M12 3l3 6 6 1-4.5 4.5L18 21l-6-3-6 3 1.5-6.5L3 10l6-1z',
  co: 'M12 3a9 9 0 100 18 9 9 0 000-18zM9 12h6M12 9v6',
  set: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z',
  out: 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
  chevron: 'M6 9l6 6 6-6'
};

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  activeTab,
  setActiveTab,
  isMobileOpen,
  closeMobileSidebar
}) => {
  const {
    isSidebarCollapsed,
    toggleSidebar,
    logoutAdmin,
    transactions,
    users,
    totalUsersCount
  } = useAdmin();

  const { showToast, switchPage } = useApp();

  const pendingCount = (transactions || []).filter(t => t.status === 'pending').length;

  const handleSelectTab = (tab: AdminTab) => {
    setActiveTab(tab);
    closeMobileSidebar();
  };

  // Structured Hierarchical Navigation Groups matching the reference design
  const navGroups: NavGroup[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      iconPath: IC.bolt,
      directTab: 'overview'
    },
    {
      id: 'player',
      label: 'Player',
      iconPath: IC.pl,
      subItems: [
        {
          id: 'users',
          label: 'Player Accounts',
          badge: totalUsersCount || users.length || 7
        }
      ]
    },
    {
      id: 'bingo',
      label: 'Bingo Game',
      iconPath: IC.room,
      subItems: [
        { id: 'cartelas', label: 'Cartelas', statusTag: '600' }
      ]
    },
    {
      id: 'bot',
      label: 'Bot',
      iconPath: IC.eng,
      subItems: [
        { id: 'bot-engine', label: 'Bot Engine', statusTag: '0-50' },
        { id: 'bot-players', label: 'Bot Player Accounts', statusTag: '200' }
      ]
    },
    {
      id: 'agent',
      label: 'Agent',
      iconPath: IC.ag,
      subItems: [
        { id: 'agents', label: 'Agents Directory', statusTag: 'Portal' },
        { id: 'agent-recharges', label: 'Agent Recharges', statusTag: 'Float' },
        { id: 'agent-payouts', label: 'Agent Payouts', statusTag: 'Cashout' }
      ]
    },
    {
      id: 'bonus',
      label: 'Bonus & Rewards',
      iconPath: IC.co,
      subItems: [
        { id: 'coins', label: 'Bonus', statusTag: 'Live' },
        { id: 'jackpots', label: 'Jackpots', statusTag: 'Vault' }
      ]
    },
    {
      id: 'transaction',
      label: 'Transaction',
      iconPath: IC.cf,
      urgentBadge: pendingCount > 0,
      badge: pendingCount > 0 ? pendingCount : undefined,
      subItems: [
        { id: 'cashflow', label: 'Cash-flow & reward alert', statusTag: 'Live' },
        {
          id: 'cashier',
          label: 'P2P Cashier',
          badge: pendingCount > 0 ? pendingCount : undefined,
          urgentBadge: pendingCount > 0
        },
        { id: 'official-accounts', label: 'Official Accounts', statusTag: 'Rails' }
      ]
    },
    {
      id: 'telegram',
      label: 'Telegram Bot & Ads',
      iconPath: IC.tg,
      directTab: 'telegram-bot'
    }
  ];

  // Helper to determine which group owns the given tab
  const getGroupForTab = (tab: AdminTab): string | null => {
    for (const g of navGroups) {
      if (g.directTab === tab) return g.id;
      if (g.subItems?.some(s => s.id === tab)) return g.id;
    }
    return null;
  };

  // State: Only the currently active group is expanded by default, others start collapsed
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const activeGroupId = getGroupForTab(activeTab);
    return activeGroupId && activeGroupId !== 'dashboard' && activeGroupId !== 'telegram'
      ? { [activeGroupId]: true }
      : {};
  });

  // Whenever activeTab changes, auto-expand its parent group
  useEffect(() => {
    const activeGroupId = getGroupForTab(activeTab);
    if (activeGroupId && activeGroupId !== 'dashboard' && activeGroupId !== 'telegram') {
      setOpenGroups(prev => ({
        ...prev,
        [activeGroupId]: true
      }));
    }
  }, [activeTab]);

  const toggleGroup = (groupId: string) => {
    setOpenGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      <div
        className={`admin-mobile-backdrop ${isMobileOpen ? 'active' : ''}`}
        onClick={closeMobileSidebar}
        aria-hidden="true"
      />

      <aside className={`enqu-sidebar tree-sidebar ${isSidebarCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}>
        {/* Header Row: Logo, Collapse Toggle Button & Mobile Close Button */}
        <div className={`sidebar-header-row ${isSidebarCollapsed ? 'collapsed' : ''}`}>
          {!isSidebarCollapsed ? (
            <div className="logo">Sonic Bingo</div>
          ) : (
            <div className="logo-compact" title="Sonic Bingo">
              SB
            </div>
          )}
          <button
            type="button"
            className="btn-chatgpt-toggle hide-on-mobile"
            onClick={toggleSidebar}
            title={isSidebarCollapsed ? 'Open sidebar' : 'Close sidebar'}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>

          {/* Mobile Drawer Dismiss Button */}
          <button
            type="button"
            className="btn-mobile-drawer-close"
            onClick={closeMobileSidebar}
            title="Close navigation"
            aria-label="Close navigation"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Main Navigation List: Hierarchical Tree with Dropdowns */}
        <nav className="enqu-nav tree-nav">
          {navGroups.map(group => {
            // Case 1: Standalone Direct Tab (Dashboard or Telegram Bot)
            if (group.directTab) {
              const isDirectActive = activeTab === group.directTab;
              const isDashboard = group.id === 'dashboard';

              return (
                <div key={group.id} className="tree-direct-wrap">
                  <a
                    className={`${isDashboard ? 'tree-dash-pill' : 'tree-group-direct'} ${isDirectActive ? 'active' : ''}`}
                    onClick={() => handleSelectTab(group.directTab!)}
                    title={isSidebarCollapsed ? group.label : undefined}
                  >
                    {group.iconPath && (
                      <svg viewBox="0 0 24 24" className="tree-nav-svg">
                        <path d={group.iconPath} />
                      </svg>
                    )}
                    <span className="tree-nav-text">{group.label}</span>
                  </a>
                </div>
              );
            }

            // Case 2: Parent Category Group with Tree Sub-Items
            const isOpen = !!openGroups[group.id];
            const hasActiveChild = group.subItems?.some(s => s.id === activeTab) ?? false;

            return (
              <div
                key={group.id}
                className={`tree-group-box ${isOpen ? 'group-open' : ''} ${hasActiveChild ? 'group-has-active' : ''}`}
              >
                {/* Parent Group Header (Collapsible Accordion Trigger) */}
                <div
                  className={`tree-group-header ${hasActiveChild ? 'active-header' : ''}`}
                  onClick={() => {
                    if (isSidebarCollapsed) {
                      // If collapsed, navigate to the first sub-item
                      if (group.subItems && group.subItems.length > 0) {
                        handleSelectTab(group.subItems[0].id);
                      }
                    } else {
                      toggleGroup(group.id);
                    }
                  }}
                  title={isSidebarCollapsed ? group.label : undefined}
                >
                  <div className="tree-header-left">
                    {group.iconPath && isSidebarCollapsed && (
                      <svg viewBox="0 0 24 24" className="tree-nav-svg">
                        <path d={group.iconPath} />
                      </svg>
                    )}
                    <span className="tree-group-title">{group.label}</span>
                  </div>

                  {!isSidebarCollapsed && (
                    <div className="tree-header-right">
                      {group.badge != null && (
                        <span
                          className={`tree-count-badge ${group.urgentBadge ? 'urgent' : ''}`}
                        >
                          {group.badge}
                        </span>
                      )}
                      <svg
                        viewBox="0 0 24 24"
                        className={`tree-chevron-icon ${isOpen ? 'rotated' : ''}`}
                      >
                        <path d={IC.chevron} />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Tree Sub-Items Branch Container */}
                {!isSidebarCollapsed && isOpen && group.subItems && (
                  <div className="tree-branch-container">
                    {group.subItems.map((sub, idx) => {
                      const isSubActive = activeTab === sub.id;
                      const isLast = idx === group.subItems!.length - 1;

                      return (
                        <a
                          key={sub.id}
                          className={`tree-sub-link ${isSubActive ? 'sub-active' : ''} ${isLast ? 'tree-last-branch' : ''}`}
                          onClick={() => handleSelectTab(sub.id)}
                        >
                          <span className="tree-branch-line" />
                          <span className="tree-sub-text">{sub.label}</span>

                          {sub.badge != null && (
                            <span
                              className={`tree-sub-badge ${sub.urgentBadge ? 'urgent' : ''}`}
                            >
                              {sub.badge}
                            </span>
                          )}

                          {sub.statusTag && (
                            <span className="tree-sub-tag">{sub.statusTag}</span>
                          )}
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Pinned Footer Actions */}
        <div className="foot nav tree-foot">
          <div className="tree-divider" />
          <nav>
            <a
              onClick={() => switchPage('withdrawals')}
              title={isSidebarCollapsed ? 'Withdrawals Desk' : undefined}
              className="tree-footer-link"
            >
              <svg viewBox="0 0 24 24" className="tree-nav-svg">
                <path d="M12 15V3M7 8l5-5 5 5M4 17v3h16v-3" />
              </svg>
              <span>Withdrawals Desk</span>
            </a>
            <a
              onClick={() => handleSelectTab('settings')}
              title={isSidebarCollapsed ? 'Settings' : undefined}
              className={`tree-footer-link ${activeTab === 'settings' ? 'sub-active' : ''}`}
            >
              <svg viewBox="0 0 24 24" className="tree-nav-svg">
                <path d={IC.set} />
              </svg>
              <span>Settings</span>
            </a>
            <a
              onClick={() => {
                logoutAdmin();
                showToast('👋 Logged out from Admin Portal');
              }}
              title={isSidebarCollapsed ? 'Log out' : undefined}
              className="tree-footer-link logout"
            >
              <svg viewBox="0 0 24 24" className="tree-nav-svg">
                <path d={IC.out} />
              </svg>
              <span>Log out</span>
            </a>
          </nav>
        </div>
      </aside>
    </>
  );
};
