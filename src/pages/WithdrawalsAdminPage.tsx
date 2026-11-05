import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { apiClient } from '../services/apiClient.ts';
import { socketService } from '../services/socketService.ts';

// Dedicated Enqu Stylesheet
import '../styles/withdrawals_admin.css';

// Components
import { WithdrawalsPINModal } from '../components/admin/withdrawals/WithdrawalsPINModal.tsx';
import { WithdrawalsHeader } from '../components/admin/withdrawals/WithdrawalsHeader.tsx';
import { WithdrawalsQueueDesk } from '../components/admin/withdrawals/WithdrawalsQueueDesk.tsx';
import { WithdrawalsHistoryDesk } from '../components/admin/withdrawals/WithdrawalsHistoryDesk.tsx';

export const WithdrawalsAdminPage: React.FC = () => {
  const { switchPage, showToast } = useApp();

  const [activeTab, setActiveTab] = useState<'req' | 'hist'>('req');
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return (
        sessionStorage.getItem('sonic_withdrawals_token') ||
        localStorage.getItem('sonic_withdrawals_token') ||
        localStorage.getItem('sonic_admin_token')
      );
    }
    return null;
  });

  const [adminUser, setAdminUser] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Queue and KPI data
  const [queue, setQueue] = useState<any[]>([]);
  const [kpis, setKpis] = useState({
    pendingCount: 0,
    pendingAmount: 0,
    longestWaitingMinutes: 0,
    longestWaitingPlayer: 'Queue is clear',
    approvedTodayCount: 0,
    approvedTodayAmount: 0,
    rejectedTodayCount: 0,
    rejectedTodayAmount: 0,
    needsAttentionCount: 0,
    highValueCount: 0
  });

  const loadQueueData = async () => {
    if (!token) return;
    try {
      setIsRefreshing(true);
      const res = await apiClient.withdrawalsAdmin.getQueue();
      if (res.success) {
        setQueue(res.queue || []);
        if (res.kpis) {
          setKpis(res.kpis);
        }
      }
    } catch (err: any) {
      console.warn('Queue fetch note:', err.message);
      if (err.message && (err.message.includes('401') || err.message.includes('token'))) {
        handleLogout();
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadQueueData();
    } else {
      setLoading(false);
    }
  }, [token]);

  // Real-time WebSocket Listeners for Instant Live Queue Updates
  useEffect(() => {
    if (!token) return;

    const unsubNewWithdrawal = socketService.on('admin_new_withdrawal', (data: any) => {
      showToast(`📥 New Withdrawal Request: ${data.amount} ETB to ${data.method}`);
      loadQueueData();
    });

    const unsubStatusUpdated = socketService.on('withdrawal_status_updated', () => {
      loadQueueData();
    });

    return () => {
      unsubNewWithdrawal();
      unsubStatusUpdated();
    };
  }, [token]);

  const handleLoginSuccess = (newToken: string, admin: any) => {
    setToken(newToken);
    setAdminUser(admin);
    showToast('🔓 Withdrawals Desk Unlocked');
  };

  const handleLogout = () => {
    sessionStorage.removeItem('sonic_withdrawals_token');
    localStorage.removeItem('sonic_withdrawals_token');
    setToken(null);
    setAdminUser(null);
    showToast('🔒 Withdrawals Desk Locked');
  };

  // If not authenticated, prompt for PIN
  if (!token) {
    return (
      <div className="withdrawals-fullscreen-root" style={{ display: 'grid', placeItems: 'center' }}>
        <WithdrawalsPINModal
          onSuccess={handleLoginSuccess}
          onCancel={() => switchPage('landing')}
        />
      </div>
    );
  }

  return (
    <div className="withdrawals-fullscreen-root">
      {/* Fixed Sticky Header */}
      <WithdrawalsHeader
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingCount={kpis.pendingCount}
        adminName={adminUser?.name || 'Withdrawal Officer'}
        onRefresh={loadQueueData}
        onLogout={handleLogout}
        onExitToPortal={() => switchPage('admin')}
        isRefreshing={isRefreshing}
      />

      {/* Main Viewport Container */}
      <main className="withdrawals-main">
        {activeTab === 'req' && (
          <WithdrawalsQueueDesk
            queue={queue}
            kpis={kpis}
            onActionCompleted={loadQueueData}
            showToast={showToast}
          />
        )}

        {activeTab === 'hist' && (
          <WithdrawalsHistoryDesk
            showToast={showToast}
          />
        )}
      </main>
    </div>
  );
};

export default WithdrawalsAdminPage;
