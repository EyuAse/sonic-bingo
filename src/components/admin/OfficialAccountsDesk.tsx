import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiClient } from '../../services/apiClient.ts';

interface AccountAgent {
  id: string;
  name: string;
  code?: string;
  city?: string;
}

interface RecentDeposit {
  id: string;
  playerName: string;
  amount: number;
  ref: string;
  createdAt: string;
}

interface AuditLogEntry {
  id: string;
  actor: string;
  action: string;
  createdAt: string;
}

interface OfficialAccount {
  id: string;
  provider: string;
  accountNumber: string;
  accountName: string;
  accountTitle: string;
  badge?: string;
  isActive: boolean;
  dailyLimit: number;
  maxPerDeposit: number;
  autoPauseAtDailyLimit: boolean;
  status: 'Active' | 'Paused' | 'Pending' | 'Deactivated';
  isPrimary: boolean;
  isVerified: boolean;
  deactivationReason?: string | null;
  displayOrder: number;
  agentId?: string | null;
  agent: AccountAgent;
  receivedToday: number;
  total30d: number;
  count30d: number;
  avgDeposit: number;
  lastDeposit: string | null;
  recentDeposits: RecentDeposit[];
  auditLogs: AuditLogEntry[];
  createdAt: string;
  updatedAt: string;
}

interface DeskStats {
  activeCount: number;
  totalCount: number;
  pausedCount: number;
  pendingCount: number;
  deactivatedCount: number;
  nearLimitCount: number;
  receivedToday: number;
  confirmedDepositsToday: number;
}

interface OfficialAccountsDeskProps {
  showToast?: (msg: string) => void;
}

const PROVIDER_THEMES: Record<string, { gradient: string; accent: string; abbr: string }> = {
  Telebirr: { gradient: 'linear-gradient(135deg, #17293b, #245a86)', accent: '#7cc4ff', abbr: 'TB' },
  'M-Pesa': { gradient: 'linear-gradient(135deg, #10291f, #1f6a4a)', accent: '#7ce8b6', abbr: 'MP' },
  CBE: { gradient: 'linear-gradient(135deg, #2b1c3a, #5b2f86)', accent: '#d6a8ff', abbr: 'CBE' },
  Default: { gradient: 'linear-gradient(135deg, #23272f, #343a46)', accent: '#e2e8f0', abbr: 'BANK' }
};

const DEACTIVATE_REASONS = [
  'Account closed by owner',
  'Number changed by owner',
  'Suspicious activity',
  'Agent removed',
  'Replaced by a new account',
  'Other'
];

const NUMBER_CHANGE_REASONS = [
  'Owner changed the number',
  'Wrong number entered',
  'Provider changed',
  'Other'
];

export const OfficialAccountsDesk: React.FC<OfficialAccountsDeskProps> = ({ showToast: parentToast }) => {
  const [accounts, setAccounts] = useState<OfficialAccount[]>([]);
  const [agents, setAgents] = useState<AccountAgent[]>([]);
  const [stats, setStats] = useState<DeskStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Tabs & Filters
  const [activeTab, setActiveTab] = useState<'all' | 'Active' | 'Paused' | 'Pending' | 'Deactivated'>('all');
  const [providerFilter, setProviderFilter] = useState<string>('All');
  const [agentFilter, setAgentFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Inspector selection & reveal state
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [revealedMap, setRevealedMap] = useState<Record<string, boolean>>({});

  // In-desk Toast notification
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Modals state
  const [isAddEditOpen, setIsAddEditOpen] = useState<boolean>(false);
  const [editingAccount, setEditingAccount] = useState<OfficialAccount | null>(null);

  const [verifyTarget, setVerifyTarget] = useState<OfficialAccount | null>(null);
  const [verifyAck, setVerifyAck] = useState<boolean>(false);

  const [deactTarget, setDeactTarget] = useState<OfficialAccount | null>(null);
  const [deactReason, setDeactReason] = useState<string>(DEACTIVATE_REASONS[0]);
  const [deactAck, setDeactAck] = useState<boolean>(false);

  const [reactTarget, setReactTarget] = useState<OfficialAccount | null>(null);

  // Add / Edit Form State
  const [formProvider, setFormProvider] = useState<string>('Telebirr');
  const [formNumber, setFormNumber] = useState<string>('');
  const [formName, setFormName] = useState<string>('');
  const [formAgentId, setFormAgentId] = useState<string>('PLATFORM');
  const [formDailyLimit, setFormDailyLimit] = useState<number>(50000);
  const [formMaxPerDeposit, setFormMaxPerDeposit] = useState<number>(1500);
  const [formAutoPause, setFormAutoPause] = useState<boolean>(true);
  const [formChangeReason, setFormChangeReason] = useState<string>(NUMBER_CHANGE_REASONS[0]);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const showNotification = useCallback((msg: string) => {
    if (parentToast) {
      parentToast(msg);
    }
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg(null);
    }, 2800);
  }, [parentToast]);

  // Load Real Data from Neon PostgreSQL
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [accRes, agentRes] = await Promise.all([
        apiClient.admin.getOfficialAccounts(),
        apiClient.admin.getOfficialAccountAgents()
      ]);

      if (accRes.success && accRes.accounts) {
        setAccounts(accRes.accounts);
        setStats(accRes.stats);
        if (!selectedAccountId && accRes.accounts.length > 0) {
          setSelectedAccountId(accRes.accounts[0].id);
        }
      }

      if (agentRes.success && agentRes.agents) {
        setAgents(agentRes.agents);
      }
    } catch (err: any) {
      console.error('Error fetching official accounts data:', err);
      showNotification(`❌ ${err.message || 'Failed to load official accounts'}`);
    } finally {
      setLoading(false);
    }
  }, [selectedAccountId, showNotification]);

  useEffect(() => {
    fetchData();
  }, []);

  // Selected account for inspector
  const selectedAccount = useMemo(() => {
    if (!accounts.length) return null;
    return accounts.find(a => a.id === selectedAccountId) || accounts[0];
  }, [accounts, selectedAccountId]);

  // Providers list
  const availableProviders = useMemo(() => {
    const set = new Set<string>(['Telebirr', 'M-Pesa', 'CBE']);
    accounts.forEach(a => set.add(a.provider));
    return Array.from(set);
  }, [accounts]);

  // Filtered accounts list
  const filteredAccounts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return accounts.filter(acc => {
      // Tab filter
      if (activeTab !== 'all' && acc.status !== activeTab) {
        return false;
      }
      // Provider filter
      if (providerFilter !== 'All' && acc.provider !== providerFilter) {
        return false;
      }
      // Agent filter
      if (agentFilter !== 'All') {
        const accAgentId = acc.agentId || 'PLATFORM';
        if (accAgentId !== agentFilter) return false;
      }
      // Search query
      if (q) {
        const matchString = `${acc.id} ${acc.accountName} ${acc.accountNumber} ${acc.provider} ${acc.agent.name} ${acc.agent.code || ''}`.toLowerCase();
        if (!matchString.includes(q)) return false;
      }
      return true;
    });
  }, [accounts, activeTab, providerFilter, agentFilter, searchQuery]);

  // Format Helpers
  const getTheme = (provider: string) => PROVIDER_THEMES[provider] || PROVIDER_THEMES.Default;

  const maskNumber = (provider: string, num: string) => {
    const clean = (num || '').replace(/\s+/g, '');
    if (!clean) return '••••';
    if (provider === 'CBE') {
      return clean.length >= 8 ? `${clean.slice(0, 4)} ••• ${clean.slice(-4)}` : clean;
    }
    return clean.length >= 7 ? `${clean.slice(0, 4)} ••• ${clean.slice(-3)}` : clean;
  };

  const formatNumberRevealed = (provider: string, num: string) => {
    const clean = (num || '').replace(/\s+/g, '');
    if (provider === 'CBE' && clean.length === 13) {
      return `${clean.slice(0, 4)} ${clean.slice(4, 8)} ${clean.slice(8)}`;
    }
    if ((provider === 'Telebirr' || provider === 'M-Pesa') && clean.length === 10) {
      return `${clean.slice(0, 4)} ${clean.slice(4, 7)} ${clean.slice(7)}`;
    }
    return clean;
  };

  const getInitials = (name: string) => {
    if (!name) return '??';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0])
      .join('')
      .toUpperCase();
  };

  const formatETB = (val: number | string) => {
    return Number(val || 0).toLocaleString('en-US', { maximumFractionDigits: 1 });
  };

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatTimeDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch {
      return '';
    }
  };

  const getStatusColor = (acc: OfficialAccount) => {
    if (acc.status === 'Active') return '#5fe39a';
    if (acc.status === 'Paused') {
      return acc.autoPauseAtDailyLimit && acc.receivedToday >= acc.dailyLimit ? '#e6a21f' : '#c9c9cd';
    }
    if (acc.status === 'Pending') return '#f6d453';
    return '#ff7b72'; // Deactivated
  };

  const getStatusLabel = (acc: OfficialAccount) => {
    if (acc.status === 'Paused' && acc.autoPauseAtDailyLimit && acc.receivedToday >= acc.dailyLimit) {
      return 'Limit reached';
    }
    if (acc.status === 'Pending') return 'Unverified';
    return acc.status;
  };

  // CSV Exporter
  const handleExportCSV = () => {
    try {
      const headers = ['ID', 'Provider', 'Number (Masked)', 'Account Name', 'Agent', 'Status', 'Verified', 'Primary', 'Daily Limit (ETB)', 'Received Today (ETB)'];
      const rows = filteredAccounts.map(a => [
        `"${a.id}"`,
        `"${a.provider}"`,
        `"${maskNumber(a.provider, a.accountNumber)}"`,
        `"${a.accountName.replace(/"/g, '""')}"`,
        `"${a.agent.name.replace(/"/g, '""')}"`,
        `"${getStatusLabel(a)}"`,
        `"${a.isVerified ? 'Yes' : 'No'}"`,
        `"${a.isPrimary ? 'Yes' : 'No'}"`,
        `"${a.dailyLimit}"`,
        `"${a.receivedToday}"`
      ]);

      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `enqu-payment-accounts-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showNotification(`Exported ${filteredAccounts.length} accounts as CSV`);
    } catch (err: any) {
      showNotification('Export failed: ' + (err.message || 'Browser not supported'));
    }
  };

  // Clipboard Copy
  const handleCopy = (text: string) => {
    try {
      navigator.clipboard.writeText(text.replace(/\s+/g, ''));
      showNotification('Account number copied to clipboard');
    } catch {
      showNotification('Unable to copy');
    }
  };

  // 1-Click Receiving Toggle
  const handleToggle = async (acc: OfficialAccount) => {
    if (acc.status === 'Pending' || !acc.isVerified) {
      showNotification('Verify the account first before turning it on');
      return;
    }
    if (acc.status === 'Paused' && acc.autoPauseAtDailyLimit && acc.receivedToday >= acc.dailyLimit) {
      showNotification('Daily limit reached. Raise the limit first to turn it on');
      return;
    }

    try {
      const res = await apiClient.admin.toggleOfficialAccount(acc.id);
      if (res.success) {
        showNotification(acc.status === 'Active' ? `${maskNumber(acc.provider, acc.accountNumber)} is now off` : `${maskNumber(acc.provider, acc.accountNumber)} is now receiving payments`);
        fetchData();
      } else {
        showNotification(`❌ ${res.error || 'Failed to toggle account'}`);
      }
    } catch (err: any) {
      showNotification(`❌ ${err.message || 'Toggle failed'}`);
    }
  };

  // Toggle Auto-Pause
  const handleToggleAutoPause = async (acc: OfficialAccount) => {
    try {
      const res = await apiClient.admin.toggleOfficialAccountAutoPause(acc.id);
      if (res.success) {
        showNotification(`Auto-pause ${!acc.autoPauseAtDailyLimit ? 'enabled' : 'disabled'}`);
        fetchData();
      } else {
        showNotification(`❌ ${res.error || 'Failed to update auto-pause'}`);
      }
    } catch (err: any) {
      showNotification(`❌ ${err.message || 'Auto-pause update failed'}`);
    }
  };

  // Make Primary
  const handleMakePrimary = async (acc: OfficialAccount) => {
    try {
      const res = await apiClient.admin.setPrimaryOfficialAccount(acc.id);
      if (res.success) {
        showNotification(`Set as primary ${acc.provider} account`);
        fetchData();
      } else {
        showNotification(`❌ ${res.error || 'Failed to set primary'}`);
      }
    } catch (err: any) {
      showNotification(`❌ ${err.message || 'Primary update failed'}`);
    }
  };

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingAccount(null);
    setFormProvider('Telebirr');
    setFormNumber('');
    setFormName('');
    setFormAgentId('PLATFORM');
    setFormDailyLimit(50000);
    setFormMaxPerDeposit(1500);
    setFormAutoPause(true);
    setFormChangeReason(NUMBER_CHANGE_REASONS[0]);
    setFormError(null);
    setIsAddEditOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (acc: OfficialAccount) => {
    setEditingAccount(acc);
    setFormProvider(acc.provider);
    setFormNumber(formatNumberRevealed(acc.provider, acc.accountNumber));
    setFormName(acc.accountName);
    setFormAgentId(acc.agentId || 'PLATFORM');
    setFormDailyLimit(acc.dailyLimit);
    setFormMaxPerDeposit(acc.maxPerDeposit);
    setFormAutoPause(acc.autoPauseAtDailyLimit);
    setFormChangeReason(NUMBER_CHANGE_REASONS[0]);
    setFormError(null);
    setIsAddEditOpen(true);
  };

  // Save Form (Add or Edit)
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanNum = formNumber.replace(/\D/g, '');
    if (!cleanNum) {
      setFormError('Account number is required');
      return;
    }

    // Provider regex validation
    if (formProvider === 'Telebirr' && !/^09\d{8}$/.test(cleanNum)) {
      setFormError('Telebirr numbers must be 10 digits starting with 09.');
      return;
    }
    if (formProvider === 'M-Pesa' && !/^07\d{8}$/.test(cleanNum)) {
      setFormError('M-Pesa numbers must be 10 digits starting with 07.');
      return;
    }
    if (formProvider === 'CBE' && !/^1000\d{9}$/.test(cleanNum)) {
      setFormError('Enter a 13-digit CBE account number starting with 1000.');
      return;
    }

    if (!formName.trim()) {
      setFormError('Account holder name is required.');
      return;
    }

    if (formDailyLimit < 1000 || formDailyLimit > 2000000) {
      setFormError('Daily limit must be between 1,000 and 2,000,000 ETB.');
      return;
    }

    if (formMaxPerDeposit < 50 || formMaxPerDeposit > 50000) {
      setFormError('Max per deposit must be between 50 and 50,000 ETB.');
      return;
    }

    if (formMaxPerDeposit > formDailyLimit) {
      setFormError('Max per deposit cannot exceed the daily limit.');
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingAccount) {
        const res = await apiClient.admin.updateOfficialAccount(editingAccount.id, {
          provider: formProvider,
          accountNumber: cleanNum,
          accountName: formName.trim(),
          accountTitle: `${formProvider.toUpperCase()} OFFICIAL`,
          agentId: formAgentId === 'PLATFORM' ? null : formAgentId,
          dailyLimit: formDailyLimit,
          maxPerDeposit: formMaxPerDeposit,
          autoPauseAtDailyLimit: formAutoPause,
          changeReason: formChangeReason
        });
        if (res.success) {
          showNotification(res.message || 'Account updated successfully');
          setIsAddEditOpen(false);
          fetchData();
        } else {
          setFormError(res.error || 'Failed to update account');
        }
      } else {
        const res = await apiClient.admin.createOfficialAccount({
          provider: formProvider,
          accountNumber: cleanNum,
          accountName: formName.trim(),
          accountTitle: `${formProvider.toUpperCase()} OFFICIAL`,
          agentId: formAgentId === 'PLATFORM' ? null : formAgentId,
          dailyLimit: formDailyLimit,
          maxPerDeposit: formMaxPerDeposit,
          autoPauseAtDailyLimit: formAutoPause
        });
        if (res.success) {
          showNotification('Account added. Verify it to enable payments');
          setIsAddEditOpen(false);
          fetchData();
        } else {
          setFormError(res.error || 'Failed to add account');
        }
      }
    } catch (err: any) {
      setFormError(err.message || 'Submission error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirm Verification
  const handleConfirmVerify = async () => {
    if (!verifyTarget || !verifyAck) {
      showNotification('Please acknowledge the test payment first');
      return;
    }
    try {
      const res = await apiClient.admin.verifyOfficialAccount(verifyTarget.id);
      if (res.success) {
        showNotification('Verified. Turn the account on to start receiving deposits');
        setVerifyTarget(null);
        setVerifyAck(false);
        fetchData();
      } else {
        showNotification(`❌ ${res.error || 'Verification failed'}`);
      }
    } catch (err: any) {
      showNotification(`❌ ${err.message || 'Verification error'}`);
    }
  };

  // Confirm Deactivate
  const handleConfirmDeactivate = async () => {
    if (!deactTarget) return;

    // Check if only active account for that provider
    const otherActives = accounts.filter(
      a => a.provider === deactTarget.provider && a.status === 'Active' && a.id !== deactTarget.id
    );
    const isOnlyActive = otherActives.length === 0 && deactTarget.status === 'Active';

    if (isOnlyActive && !deactAck) {
      showNotification(`Please confirm that deposits via ${deactTarget.provider} will stop`);
      return;
    }

    try {
      const res = await apiClient.admin.deactivateOfficialAccount(deactTarget.id, deactReason);
      if (res.success) {
        showNotification('Account deactivated');
        setDeactTarget(null);
        setDeactAck(false);
        fetchData();
      } else {
        showNotification(`❌ ${res.error || 'Failed to deactivate'}`);
      }
    } catch (err: any) {
      showNotification(`❌ ${err.message || 'Deactivation error'}`);
    }
  };

  // Confirm Reactivate
  const handleConfirmReactivate = async () => {
    if (!reactTarget) return;
    try {
      const res = await apiClient.admin.reactivateOfficialAccount(reactTarget.id);
      if (res.success) {
        showNotification('Reactivated. Turn it on when ready');
        setReactTarget(null);
        fetchData();
      } else {
        showNotification(`❌ ${res.error || 'Reactivation failed'}`);
      }
    } catch (err: any) {
      showNotification(`❌ ${err.message || 'Reactivation error'}`);
    }
  };

  return (
    <div className="official-accounts-enqu-root">
      {/* 1. Header Information Note */}
      <div className="note">
        Players pay into these accounts through agents. Turning an account off hides it from players straight away. Deactivating retires it and keeps its history.
      </div>

      {/* 2. Elevated 4 KPI Stat Cards */}
      <div className="grid g4">
        <div className="card d">
          <div className="lab">Active Accounts</div>
          <div className="val">
            {stats ? `${stats.activeCount} / ${stats.totalCount}` : '...'}
          </div>
          <div className="tr">
            {stats ? `${stats.deactivatedCount} deactivated` : 'Loading accounts...'}
          </div>
        </div>

        <div className="card">
          <div className="lab">Received Today</div>
          <div className="val">
            ETB {stats ? formatETB(stats.receivedToday) : '0'}
          </div>
          <div className="tr">
            {stats ? `${stats.confirmedDepositsToday} confirmed deposits` : '0 confirmed deposits'}
          </div>
        </div>

        <div className="card">
          <div className="lab">Near Daily Limit</div>
          <div className="val">
            {stats ? stats.nearLimitCount : 0}
          </div>
          <div className="tr">
            {stats && stats.nearLimitCount > 0 ? 'Review limits to avoid auto-pause' : 'All accounts have room'}
          </div>
        </div>

        <div className="card">
          <div className="lab">Awaiting Verification</div>
          <div className="val">
            {stats ? stats.pendingCount : 0}
          </div>
          <div className="tr">
            {stats && stats.pendingCount > 0 ? 'Verify before enabling' : 'Nothing pending'}
          </div>
        </div>
      </div>

      {/* 3. Filter & Action Control Card */}
      <div className="card" style={{ marginBottom: '15px' }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          {/* Status Tabs */}
          <div className="tabs" style={{ margin: 0 }}>
            <button
              type="button"
              className={activeTab === 'all' ? 'on' : ''}
              onClick={() => setActiveTab('all')}
            >
              All ({accounts.length})
            </button>
            <button
              type="button"
              className={activeTab === 'Active' ? 'on' : ''}
              onClick={() => setActiveTab('Active')}
            >
              Active ({accounts.filter(a => a.status === 'Active').length})
            </button>
            <button
              type="button"
              className={activeTab === 'Paused' ? 'on' : ''}
              onClick={() => setActiveTab('Paused')}
            >
              Paused ({accounts.filter(a => a.status === 'Paused').length})
            </button>
            <button
              type="button"
              className={activeTab === 'Pending' ? 'on' : ''}
              onClick={() => setActiveTab('Pending')}
            >
              Unverified ({accounts.filter(a => a.status === 'Pending').length})
            </button>
            <button
              type="button"
              className={activeTab === 'Deactivated' ? 'on' : ''}
              onClick={() => setActiveTab('Deactivated')}
            >
              Deactivated ({accounts.filter(a => a.status === 'Deactivated').length})
            </button>
          </div>

          {/* Action Buttons Right */}
          <div className="row">
            <button type="button" onClick={handleExportCSV}>
              Export CSV
            </button>
            <button type="button" className="k" onClick={handleOpenAdd}>
              + Add account
            </button>
          </div>
        </div>

        {/* Filters Row */}
        <div className="row" style={{ marginTop: '12px' }}>
          <input
            type="text"
            placeholder="Search number, name, agent or ID"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ flex: 1, minWidth: '180px' }}
          />

          <select
            value={providerFilter}
            onChange={e => setProviderFilter(e.target.value)}
            style={{ width: 'auto' }}
          >
            <option value="All">All providers</option>
            {availableProviders.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          <select
            value={agentFilter}
            onChange={e => setAgentFilter(e.target.value)}
            style={{ width: 'auto' }}
          >
            <option value="All">All agents</option>
            {agents.map(ag => (
              <option key={ag.id} value={ag.id}>
                {ag.name} {ag.id !== 'PLATFORM' ? `(${ag.code || ag.id})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 4. 2-Column Responsive Workspace */}
      <div className="grid g2" style={{ alignItems: 'start' }}>
        {/* Left: Accounts Cards Grid */}
        <div className="pa-grid">
          {filteredAccounts.length === 0 ? (
            <div className="pa-empty">
              {loading ? 'Loading official accounts from database...' : 'No accounts match these filters.'}
            </div>
          ) : (
            filteredAccounts.map(acc => {
              const theme = getTheme(acc.provider);
              const isSelected = selectedAccountId === acc.id;
              const isDeactivated = acc.status === 'Deactivated';
              const canToggle = acc.status === 'Active' || acc.status === 'Paused';
              const isReceiving = acc.status === 'Active';
              const progressPct = Math.min(100, Math.round((acc.receivedToday / (acc.dailyLimit || 1)) * 100));

              return (
                <div
                  key={acc.id}
                  className={`pac ${isSelected ? 'sel' : ''} ${isDeactivated ? 'dx' : ''}`}
                  tabIndex={0}
                  onClick={() => setSelectedAccountId(acc.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedAccountId(acc.id);
                    }
                  }}
                >
                  {/* Card Top: Gradient Hero */}
                  <div
                    className="pac-top"
                    style={{
                      background: theme.gradient,
                      ['--ac' as any]: theme.accent
                    }}
                  >
                    <div className="pac-hd">
                      <span className="pac-lg">
                        <b>{theme.abbr}</b>
                        {acc.provider}
                      </span>
                      <span className="pas" style={{ ['--c' as any]: getStatusColor(acc) }}>
                        <i></i>
                        {getStatusLabel(acc)}
                      </span>
                    </div>

                    <div className="pac-num">
                      {maskNumber(acc.provider, acc.accountNumber)}
                    </div>

                    <div className="pac-nm">
                      <span>{acc.accountName}</span>
                      {acc.isPrimary && !isDeactivated && (
                        <span className="pri">PRIMARY</span>
                      )}
                    </div>
                  </div>

                  {/* Card Body: Agent & Usage */}
                  <div className="pac-bd">
                    <div className="pac-ag">
                      <span className="av2">{getInitials(acc.agent.name)}</span>
                      <div>
                        <div>{acc.agent.name}</div>
                        <small>
                          {acc.agent.id === 'PLATFORM'
                            ? 'Platform'
                            : `${acc.agent.code || acc.agent.id} · ${acc.agent.city || 'Addis Ababa'}`}
                        </small>
                      </div>
                    </div>

                    {/* Today Usage Bar */}
                    <div
                      className="row"
                      style={{
                        justifyContent: 'space-between',
                        marginTop: '12px',
                        fontSize: '12.5px',
                        fontWeight: 600
                      }}
                    >
                      <span>Today</span>
                      <span>
                        {formatETB(acc.receivedToday)} / {formatETB(acc.dailyLimit)} ETB
                      </span>
                    </div>

                    <div className={`pab ${progressPct >= 100 ? 'x' : progressPct >= 80 ? 'w' : ''}`}>
                      <i style={{ width: `${progressPct}%` }}></i>
                    </div>

                    {/* Card Footer Actions */}
                    <div className="pac-ft">
                      <div className="row">
                        {canToggle ? (
                          <>
                            <button
                              type="button"
                              className={`tog ${isReceiving ? 'on' : ''}`}
                              onClick={e => {
                                e.stopPropagation();
                                handleToggle(acc);
                              }}
                              aria-label="Receiving payments"
                            ></button>
                            <span>{isReceiving ? 'Receiving' : 'Off'}</span>
                          </>
                        ) : (
                          <span className="tr">
                            {acc.status === 'Pending' ? 'Verify to enable' : 'Retired'}
                          </span>
                        )}
                      </div>

                      <div>
                        {acc.status === 'Pending' ? (
                          <button
                            type="button"
                            className="k"
                            onClick={e => {
                              e.stopPropagation();
                              setVerifyTarget(acc);
                              setVerifyAck(false);
                            }}
                          >
                            Verify
                          </button>
                        ) : isDeactivated ? (
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              setReactTarget(acc);
                            }}
                          >
                            Reactivate
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              handleOpenEdit(acc);
                            }}
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right: Sticky Inspector */}
        <div className="padet">
          {selectedAccount ? (
            <div className="card">
              {/* Selected Inspector Hero */}
              <div
                className="pdh"
                style={{
                  background: getTheme(selectedAccount.provider).gradient,
                  ['--ac' as any]: getTheme(selectedAccount.provider).accent
                }}
              >
                <div className="pac-hd">
                  <span className="pac-lg">
                    <b>{getTheme(selectedAccount.provider).abbr}</b>
                    {selectedAccount.provider} · {selectedAccount.id.slice(0, 8)}
                  </span>
                  <span className="pas" style={{ ['--c' as any]: getStatusColor(selectedAccount) }}>
                    <i></i>
                    {getStatusLabel(selectedAccount)}
                  </span>
                </div>

                <div className="pn">
                  {revealedMap[selectedAccount.id]
                    ? formatNumberRevealed(selectedAccount.provider, selectedAccount.accountNumber)
                    : maskNumber(selectedAccount.provider, selectedAccount.accountNumber)}
                </div>

                <div className="pac-nm">
                  <span>{selectedAccount.accountName}</span>
                  {selectedAccount.isPrimary && selectedAccount.status !== 'Deactivated' && (
                    <span className="pri">PRIMARY</span>
                  )}
                </div>

                <div className="row" style={{ marginTop: '12px' }}>
                  <button
                    type="button"
                    onClick={() =>
                      setRevealedMap(prev => ({
                        ...prev,
                        [selectedAccount.id]: !prev[selectedAccount.id]
                      }))
                    }
                  >
                    {revealedMap[selectedAccount.id] ? 'Hide number' : 'Reveal number'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy(selectedAccount.accountNumber)}
                  >
                    Copy
                  </button>
                </div>
              </div>

              {/* Receiving Payments Live Toggle */}
              {(selectedAccount.status === 'Active' || selectedAccount.status === 'Paused') && (
                <div
                  className="row"
                  style={{
                    justifyContent: 'space-between',
                    padding: '6px 2px 12px'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px' }}>Receiving payments</div>
                    <div className="tr">
                      {selectedAccount.status === 'Active'
                        ? 'Players can pay into this account.'
                        : 'Hidden from players while off.'}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`tog ${selectedAccount.status === 'Active' ? 'on' : ''}`}
                    onClick={() => handleToggle(selectedAccount)}
                    aria-label="Receiving payments"
                  ></button>
                </div>
              )}

              {/* Warning Notice Banners */}
              {selectedAccount.status === 'Pending' && (
                <div className="pa-warn">
                  This account is not verified yet. Confirm a test payment before it can receive deposits.
                </div>
              )}

              {selectedAccount.status === 'Paused' &&
                selectedAccount.autoPauseAtDailyLimit &&
                selectedAccount.receivedToday >= selectedAccount.dailyLimit && (
                  <div className="pa-warn">
                    Auto-paused: the daily limit of {formatETB(selectedAccount.dailyLimit)} ETB was reached. Raise the limit to turn it back on today.
                  </div>
                )}

              {selectedAccount.status === 'Deactivated' && (
                <div className="pa-warn" style={{ background: '#f6dedd', color: '#8a2a24' }}>
                  Deactivated: {selectedAccount.deactivationReason || 'No reason recorded'}. History is kept.
                </div>
              )}

              {/* Action Buttons Row */}
              <div className="row" style={{ margin: '12px 0 6px' }}>
                {selectedAccount.status === 'Deactivated' ? (
                  <button
                    type="button"
                    className="k"
                    onClick={() => setReactTarget(selectedAccount)}
                  >
                    Reactivate
                  </button>
                ) : (
                  <>
                    {selectedAccount.status === 'Pending' && (
                      <button
                        type="button"
                        className="k"
                        onClick={() => {
                          setVerifyTarget(selectedAccount);
                          setVerifyAck(false);
                        }}
                      >
                        Verify account
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(selectedAccount)}
                    >
                      Edit account
                    </button>
                    {selectedAccount.status === 'Active' &&
                      selectedAccount.isVerified &&
                      !selectedAccount.isPrimary && (
                        <button
                          type="button"
                          onClick={() => handleMakePrimary(selectedAccount)}
                        >
                          Make primary
                        </button>
                      )}
                    <button
                      type="button"
                      onClick={() => {
                        setDeactTarget(selectedAccount);
                        setDeactReason(DEACTIVATE_REASONS[0]);
                        setDeactAck(false);
                      }}
                      style={{ color: 'var(--pa-r)' }}
                    >
                      Deactivate
                    </button>
                  </>
                )}
              </div>

              {/* Details Section */}
              <div className="sec">
                <h4>Details</h4>
                <div className="lg">
                  <span style={{ ['--c' as any]: 'var(--pa-grey)' }}>Assigned to</span>
                  <b>
                    {selectedAccount.agent.name}{' '}
                    {selectedAccount.agent.id !== 'PLATFORM' && (
                      <span className="tr">{selectedAccount.agent.code}</span>
                    )}
                  </b>
                </div>
                <div className="lg">
                  <span style={{ ['--c' as any]: 'var(--pa-grey)' }}>Verification</span>
                  {selectedAccount.isVerified ? (
                    <span className="b ok">Verified</span>
                  ) : (
                    <span className="b am">Not verified</span>
                  )}
                </div>
                <div className="lg">
                  <span style={{ ['--c' as any]: 'var(--pa-grey)' }}>Added</span>
                  <b>{formatDateDisplay(selectedAccount.createdAt)}</b>
                </div>
              </div>

              {/* Limits & Usage Section */}
              <div className="sec">
                <h4>Limits &amp; usage</h4>
                <div
                  className="row"
                  style={{
                    justifyContent: 'space-between',
                    fontSize: '13px',
                    fontWeight: 600,
                    marginTop: '8px'
                  }}
                >
                  <span>Received today</span>
                  <span>
                    {formatETB(selectedAccount.receivedToday)} / {formatETB(selectedAccount.dailyLimit)} ETB
                  </span>
                </div>
                <div
                  className={`pab ${
                    (selectedAccount.receivedToday / (selectedAccount.dailyLimit || 1)) >= 1
                      ? 'x'
                      : (selectedAccount.receivedToday / (selectedAccount.dailyLimit || 1)) >= 0.8
                      ? 'w'
                      : ''
                  }`}
                >
                  <i
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round((selectedAccount.receivedToday / (selectedAccount.dailyLimit || 1)) * 100)
                      )}%`
                    }}
                  ></i>
                </div>
                <div className="lg">
                  <span style={{ ['--c' as any]: 'var(--pa-grey)' }}>Max per deposit</span>
                  <b>{formatETB(selectedAccount.maxPerDeposit)} ETB</b>
                </div>
                <div
                  className="row"
                  style={{
                    justifyContent: 'space-between',
                    padding: '8px 0'
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: '13px' }}>
                    Auto-pause at daily limit
                  </span>
                  <button
                    type="button"
                    className={`tog ${selectedAccount.autoPauseAtDailyLimit ? 'on' : ''}`}
                    onClick={() => handleToggleAutoPause(selectedAccount)}
                    aria-label="Auto-pause"
                  ></button>
                </div>
              </div>

              {/* Performance Section */}
              <div className="sec">
                <h4>Performance</h4>
                <div className="lg">
                  <span style={{ ['--c' as any]: 'var(--pa-grey)' }}>Last 30 days</span>
                  <b>ETB {formatETB(selectedAccount.total30d)}</b>
                </div>
                <div className="lg">
                  <span style={{ ['--c' as any]: 'var(--pa-grey)' }}>Deposits (30 days)</span>
                  <b>{selectedAccount.count30d}</b>
                </div>
                <div className="lg">
                  <span style={{ ['--c' as any]: 'var(--pa-grey)' }}>Average deposit</span>
                  <b>ETB {formatETB(selectedAccount.avgDeposit)}</b>
                </div>
                <div className="lg">
                  <span style={{ ['--c' as any]: 'var(--pa-grey)' }}>Last deposit</span>
                  <b>
                    {selectedAccount.lastDeposit
                      ? `${formatDateDisplay(selectedAccount.lastDeposit)} ${formatTimeDisplay(selectedAccount.lastDeposit)}`
                      : 'None yet'}
                  </b>
                </div>
              </div>

              {/* Recent Deposits Section */}
              <div className="sec">
                <h4>Recent deposits</h4>
                {selectedAccount.recentDeposits && selectedAccount.recentDeposits.length > 0 ? (
                  selectedAccount.recentDeposits.map(d => (
                    <div key={d.id} className="pa-dep">
                      <span>
                        {d.playerName}
                        <small>
                          {formatDateDisplay(d.createdAt)} {formatTimeDisplay(d.createdAt)} · {d.ref}
                        </small>
                      </span>
                      <span>{formatETB(d.amount)} ETB</span>
                    </div>
                  ))
                ) : (
                  <div className="tr" style={{ marginTop: '8px' }}>
                    No confirmed deposits yet.
                  </div>
                )}
              </div>

              {/* Activity Log Section */}
              <div className="sec">
                <h4>Activity log</h4>
                <div className="pa-log">
                  {selectedAccount.auditLogs && selectedAccount.auditLogs.length > 0 ? (
                    selectedAccount.auditLogs.map(log => (
                      <div key={log.id}>
                        <b>
                          {formatDateDisplay(log.createdAt)} {formatTimeDisplay(log.createdAt)} · {log.actor}
                        </b>
                        {log.action}
                      </div>
                    ))
                  ) : (
                    <div>
                      <b>System</b>
                      Account operational
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="pa-empty" style={{ background: 'none' }}>
                Select an account to inspect details.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: Add or Edit Payment Account */}
      {isAddEditOpen && (
        <div className="modalbg" onClick={() => setIsAddEditOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                {editingAccount ? `Edit account ${editingAccount.id.slice(0, 8)}` : 'Add payment account'}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddEditOpen(false)}
                style={{ background: 'none', border: 0, fontSize: '16px', cursor: 'pointer' }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveForm}>
              {/* Provider Segment Selector */}
              <label>Provider</label>
              <div className="seg">
                {['Telebirr', 'M-Pesa', 'CBE'].map(p => (
                  <button
                    key={p}
                    type="button"
                    className={formProvider === p ? 'on' : ''}
                    onClick={() => setFormProvider(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>

              {/* Account Number & Holder Name */}
              <div className="two" style={{ marginTop: '6px' }}>
                <div>
                  <label>Account number</label>
                  <input
                    type="text"
                    value={formNumber}
                    onChange={e => setFormNumber(e.target.value)}
                    placeholder={
                      formProvider === 'CBE'
                        ? '1000 0000 00000'
                        : formProvider === 'M-Pesa'
                        ? '0700 000 000'
                        : '0911 000 000'
                    }
                    inputMode="numeric"
                  />
                </div>
                <div>
                  <label>Account holder name</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="Full legal account name"
                  />
                </div>
              </div>

              {/* Assigned Agent Selector */}
              <label>Assigned to</label>
              <select
                value={formAgentId}
                onChange={e => setFormAgentId(e.target.value)}
              >
                {agents.map(ag => (
                  <option key={ag.id} value={ag.id}>
                    {ag.name} {ag.id !== 'PLATFORM' ? `(${ag.code || ag.id})` : ''}
                  </option>
                ))}
              </select>

              {/* Limits */}
              <div className="two">
                <div>
                  <label>Daily limit (ETB)</label>
                  <input
                    type="number"
                    min="1000"
                    max="2000000"
                    value={formDailyLimit}
                    onChange={e => setFormDailyLimit(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label>Max per deposit (ETB)</label>
                  <input
                    type="number"
                    min="50"
                    max="50000"
                    value={formMaxPerDeposit}
                    onChange={e => setFormMaxPerDeposit(Number(e.target.value))}
                  />
                </div>
              </div>

              {/* Auto Pause Checkbox */}
              <label className="pa-chk" style={{ marginTop: '14px' }}>
                <input
                  type="checkbox"
                  checked={formAutoPause}
                  onChange={e => setFormAutoPause(e.target.checked)}
                />
                Auto-pause when the daily limit is reached
              </label>

              {/* Edit Number Change Warning */}
              {editingAccount && (formNumber.replace(/\D/g, '') !== editingAccount.accountNumber || formProvider !== editingAccount.provider) && (
                <div style={{ marginTop: '12px' }}>
                  <div className="pa-warn">
                    Changing the number or provider takes the account offline until it is verified again. Players stop seeing it immediately.
                  </div>
                  <label style={{ marginTop: '8px' }}>Reason for change</label>
                  <select
                    value={formChangeReason}
                    onChange={e => setFormChangeReason(e.target.value)}
                  >
                    {NUMBER_CHANGE_REASONS.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              )}

              {!editingAccount && (
                <div className="tr" style={{ marginTop: '12px' }}>
                  New accounts start as unverified and stay off until you confirm a test payment.
                </div>
              )}

              {/* Form Error */}
              {formError && (
                <div style={{ color: 'var(--pa-r)', fontSize: '13px', fontWeight: 600, marginTop: '10px' }}>
                  ❌ {formError}
                </div>
              )}

              {/* Form Buttons */}
              <div className="row" style={{ justifyContent: 'flex-end', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setIsAddEditOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="k"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : editingAccount ? 'Save changes' : 'Add account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Verify Test Payment */}
      {verifyTarget && (
        <div className="modalbg" onClick={() => setVerifyTarget(null)}>
          <div className="modal" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Verify account</h3>
              <button
                type="button"
                onClick={() => setVerifyTarget(null)}
                style={{ background: 'none', border: 0, fontSize: '16px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div className="card" style={{ background: 'var(--pa-panel)', marginTop: '12px', padding: '12px 14px' }}>
              <b>{verifyTarget.provider} · {maskNumber(verifyTarget.provider, verifyTarget.accountNumber)}</b>
              <div className="tr">{verifyTarget.accountName} · {verifyTarget.agent.name}</div>
            </div>

            <div className="tr" style={{ marginTop: '12px', lineHeight: 1.5 }}>
              Send a 10 ETB test payment to this account from a personal number and confirm that it arrived with the correct account name.
            </div>

            <label className="pa-chk" style={{ marginTop: '14px' }}>
              <input
                type="checkbox"
                checked={verifyAck}
                onChange={e => setVerifyAck(e.target.checked)}
              />
              I received the test payment and the account name matches
            </label>

            <div className="row" style={{ justifyContent: 'flex-end', marginTop: '18px' }}>
              <button type="button" onClick={() => setVerifyTarget(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="k"
                disabled={!verifyAck}
                onClick={handleConfirmVerify}
              >
                Mark as verified
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Deactivate Account */}
      {deactTarget && (
        <div className="modalbg" onClick={() => setDeactTarget(null)}>
          <div className="modal" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Deactivate account</h3>
              <button
                type="button"
                onClick={() => setDeactTarget(null)}
                style={{ background: 'none', border: 0, fontSize: '16px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div className="card" style={{ background: 'var(--pa-panel)', marginTop: '12px', padding: '12px 14px' }}>
              <b>{deactTarget.provider} · {maskNumber(deactTarget.provider, deactTarget.accountNumber)}</b>
              <div className="tr">{deactTarget.accountName} · {deactTarget.agent.name}</div>
            </div>

            <div className="tr" style={{ marginTop: '12px', lineHeight: 1.5 }}>
              Players can no longer pay into this account. Deposits already sent still need confirming. History is kept and you can reactivate later.
            </div>

            {/* Guard: check if this is the only active account for that provider */}
            {accounts.filter(a => a.provider === deactTarget.provider && a.status === 'Active' && a.id !== deactTarget.id).length === 0 && deactTarget.status === 'Active' && (
              <div style={{ marginTop: '10px' }}>
                <div className="pa-warn">
                  This is the only active {deactTarget.provider} account. Players will not be able to deposit with {deactTarget.provider} until another account is on.
                </div>
                <label className="pa-chk" style={{ marginTop: '10px' }}>
                  <input
                    type="checkbox"
                    checked={deactAck}
                    onChange={e => setDeactAck(e.target.checked)}
                  />
                  I understand deposits via {deactTarget.provider} will stop
                </label>
              </div>
            )}

            <label style={{ marginTop: '12px' }}>Reason</label>
            <select
              value={deactReason}
              onChange={e => setDeactReason(e.target.value)}
            >
              {DEACTIVATE_REASONS.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>

            <div className="row" style={{ justifyContent: 'flex-end', marginTop: '18px' }}>
              <button type="button" onClick={() => setDeactTarget(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="k"
                onClick={handleConfirmDeactivate}
              >
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Reactivate Account */}
      {reactTarget && (
        <div className="modalbg" onClick={() => setReactTarget(null)}>
          <div className="modal" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Reactivate account</h3>
              <button
                type="button"
                onClick={() => setReactTarget(null)}
                style={{ background: 'none', border: 0, fontSize: '16px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div className="card" style={{ background: 'var(--pa-panel)', marginTop: '12px', padding: '12px 14px' }}>
              <b>{reactTarget.provider} · {maskNumber(reactTarget.provider, reactTarget.accountNumber)}</b>
              <div className="tr">{reactTarget.accountName} · {reactTarget.agent.name}</div>
            </div>

            <div className="tr" style={{ marginTop: '12px', lineHeight: 1.5 }}>
              The account returns as paused. Turn it on when you are ready for it to receive deposits.
            </div>

            <div className="row" style={{ justifyContent: 'flex-end', marginTop: '18px' }}>
              <button type="button" onClick={() => setReactTarget(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="k"
                onClick={handleConfirmReactivate}
              >
                Reactivate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMsg && (
        <div className="toast">
          {toastMsg}
        </div>
      )}
    </div>
  );
};
