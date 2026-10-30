import React, { useEffect, useRef } from 'react';
import { useAdmin } from '../../context/AdminContext.tsx';
import { AdminTab } from './AdminSidebar.tsx';

interface AdminBottomNavProps {
  activeTab: AdminTab;
  setActiveTab: (tab: AdminTab) => void;
}

interface TabDef {
  id: AdminTab;
  label: string;
  amharicLabel: string;
  iconClass: string;
  badge?: number;
}

export const AdminBottomNav: React.FC<AdminBottomNavProps> = ({
  activeTab,
  setActiveTab
}) => {
  const { transactions } = useAdmin();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);

  const pendingCashierCount = (transactions || []).filter(t => t.status === 'pending').length;

  const tabs: TabDef[] = [
    {
      id: 'overview',
      label: 'Dashboard',
      amharicLabel: 'ዳሽቦርድ',
      iconClass: 'fa-solid fa-house'
    },
    {
      id: 'cashier',
      label: 'Cashier',
      amharicLabel: 'ካሺየር',
      iconClass: 'fa-solid fa-inbox',
      badge: pendingCashierCount > 0 ? pendingCashierCount : undefined
    },
    {
      id: 'cashflow',
      label: 'Cash Flow',
      amharicLabel: 'የገንዘብ ፍሰት',
      iconClass: 'fa-solid fa-scale-balanced'
    },
    {
      id: 'users',
      label: 'Players',
      amharicLabel: 'ተጫዋቾች',
      iconClass: 'fa-solid fa-user-group'
    },
    {
      id: 'bots',
      label: '200+ Bots',
      amharicLabel: 'ቦቶች',
      iconClass: 'fa-solid fa-robot'
    },
    {
      id: 'bot-engine',
      label: 'Bot Engine',
      amharicLabel: 'ቦት ሞተር',
      iconClass: 'fa-solid fa-sliders'
    },
    {
      id: 'cartelas',
      label: '600 Cards',
      amharicLabel: 'ካርቴላዎች',
      iconClass: 'fa-solid fa-layer-group'
    },
    {
      id: 'telegram-bot',
      label: 'Telegram Bot',
      amharicLabel: 'ቴሌግራም',
      iconClass: 'fa-brands fa-telegram'
    },
    {
      id: 'agents',
      label: 'Agents',
      amharicLabel: 'ወኪሎች',
      iconClass: 'fa-solid fa-handshake'
    },
    {
      id: 'agent-recharges',
      label: 'Recharges',
      amharicLabel: 'መሙያ',
      iconClass: 'fa-solid fa-bolt'
    },
    {
      id: 'jackpots',
      label: 'Jackpots',
      amharicLabel: 'ጃክፖት',
      iconClass: 'fa-solid fa-trophy'
    },
    {
      id: 'coins',
      label: 'Coins',
      amharicLabel: 'ኮይኖች',
      iconClass: 'fa-solid fa-coins'
    }
  ];

  // Auto-scroll active tab into view when activeTab changes
  useEffect(() => {
    if (activeTabRef.current && scrollContainerRef.current) {
      activeTabRef.current.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest'
      });
    }
  }, [activeTab]);

  return (
    <nav className="admin-bottom-nav">
      <div className="admin-bottom-nav-scroll" ref={scrollContainerRef}>
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              ref={isActive ? activeTabRef : null}
              type="button"
              className={`admin-bottom-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(tab.id);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              title={tab.label}
            >
              <div className="admin-bottom-nav-icon-wrap">
                <i className={tab.iconClass}></i>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="admin-bottom-nav-badge">{tab.badge}</span>
                )}
              </div>
              <span className="admin-bottom-nav-label">{tab.label}</span>
              {isActive && <div className="admin-bottom-nav-active-pill" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
