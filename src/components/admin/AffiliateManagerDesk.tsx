import React, { useState, useEffect, useCallback } from 'react';
import { useAdmin } from '../../context/AdminContext.tsx';
import { useApp } from '../../context/AppContext.tsx';
import { apiClient } from '../../services/apiClient.ts';

export type AffiliateManagerView = 'directory' | 'wallets' | 'rules' | 'reports';

interface AffiliateManagerDeskProps {
  view: AffiliateManagerView;
  onNavigateView?: (tab: 'affiliates-dir' | 'affiliates-wallets' | 'affiliates-rules' | 'affiliates-reports') => void;
}

const fmtETB = (n: number) =>
  Number(n || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

const fmtInt = (n: number) => Number(n || 0).toLocaleString('en-US');

const fmtDate = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

type ReportPeriod = 'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom';
type ReportGranularity = 'daily' | 'weekly' | 'monthly';

function getEatYmdOffset(daysDelta: number): string {
  const nowEatMs = Date.now() + 3 * 60 * 60 * 1000 + daysDelta * 86400000;
  return new Date(nowEatMs).toISOString().slice(0, 10);
}

function getClientPresetDates(period: ReportPeriod, fromInput: string, toInput: string): { from?: string; to?: string } {
  const today = getEatYmdOffset(0);
  if (period === 'today') return { from: today, to: today };
  if (period === 'yesterday') {
    const yest = getEatYmdOffset(-1);
    return { from: yest, to: yest };
  }
  if (period === 'week') return { from: getEatYmdOffset(-6), to: today };
  if (period === 'month') return { from: getEatYmdOffset(-29), to: today };
  if (period === 'custom') return { from: fromInput || undefined, to: toInput || undefined };
  return {};
}

const fmtCompactAxis = (n: number) => {
  const v = Math.round(n || 0);
  if (v >= 1000000) return `${(v / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(v);
};

const RULE_THEMES: Record<string, { bg: string; fg: string; badge: string; icon: string }> = {
  registration: { bg: '#dbeafe', fg: '#1d4ed8', badge: 'SIGNUP', icon: '👤' },
  first_deposit: { bg: '#dcfce7', fg: '#15803d', badge: '1ST DEPOSIT', icon: '💎' },
  regular_deposit: { bg: '#fef3c7', fg: '#b45309', badge: 'RECURRING', icon: '🔁' },
  target: { bg: '#f3e8ff', fg: '#7e22ce', badge: 'TARGET', icon: '🎯' },
  monthly: { bg: '#cffafe', fg: '#0e7490', badge: 'MONTHLY', icon: '📅' },
  loyalty: { bg: '#ffe4e6', fg: '#be123c', badge: 'LOYALTY', icon: '👑' }
};

export const AffiliateManagerDesk: React.FC<AffiliateManagerDeskProps> = ({ view, onNavigateView: _onNavigateView }) => {
  const { isSidebarCollapsed, toggleSidebar } = useAdmin();
  const { showToast } = useApp();

  // Overview & Lists
  const [overview, setOverview] = useState<any>(null);
  const [affiliates, setAffiliates] = useState<any[]>([]);
  const [selectedAffiliateId, setSelectedAffiliateId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<any>(null);
  const [links, setLinks] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [payoutSettings, setPayoutSettings] = useState<any>(null);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [wdFilter, setWdFilter] = useState('all');
  const [commTypeFilter, setCommTypeFilter] = useState('all');
  const [commStatusFilter, setCommStatusFilter] = useState('all');

  // Modern Reports & Analytics State
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('week');
  const [reportGranularity, setReportGranularity] = useState<ReportGranularity>('daily');
  const [reportFrom, setReportFrom] = useState(() => getEatYmdOffset(-6));
  const [reportTo, setReportTo] = useState(() => getEatYmdOffset(0));
  const [reportAffiliateId, setReportAffiliateId] = useState('');
  const [reportData, setReportData] = useState<any>(null);
  const [reportSubTab, setReportSubTab] = useState<'ledger' | 'leaderboard' | 'withdrawals'>('ledger');
  const [chartMetric, setChartMetric] = useState<'commissions' | 'deposits'>('commissions');
  const [hoveredRuleType, setHoveredRuleType] = useState<string | null>(null);
  const [commSearch, setCommSearch] = useState('');
  const [commPage, setCommPage] = useState(1);
  const [commTotalPages, setCommTotalPages] = useState(1);
  const [commTotalCount, setCommTotalCount] = useState(0);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    fullName: '',
    phone: '',
    password: '',
    payoutMethod: 'Telebirr',
    payoutAccount: '',
    monthlyTargetOverride: ''
  });

  const [editingAffiliate, setEditingAffiliate] = useState<any>(null);
  const [walletModalAff, setWalletModalAff] = useState<any>(null);
  const [walletAdjustForm, setWalletAdjustForm] = useState({
    mode: 'recharge' as 'recharge' | 'credit' | 'debit',
    amount: '100',
    reason: ''
  });

  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkForm, setLinkForm] = useState({ label: 'Partner Invite Link', maxUses: '', requiresApproval: true });

  const [editingRule, setEditingRule] = useState<any>(null);
  const [ruleForm, setRuleForm] = useState({
    calcMode: 'percent',
    rateOrAmount: '0',
    minQualifyingDeposit: '0',
    minMonthlyPlayers: '0',
    activeWindowDays: '14',
    autoApprove: false,
    isActive: true,
    description: ''
  });

  const [payoutForm, setPayoutForm] = useState({
    minWithdrawalAmount: '100',
    payoutScheduleMode: 'end_of_month',
    payoutWindowDays: '3'
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const ovRes = await apiClient.admin.affiliates.getOverview();
      if (ovRes?.success) setOverview(ovRes.overview);

      if (view === 'directory') {
        const [listRes, linksRes] = await Promise.all([
          apiClient.admin.affiliates.list({ search: searchQuery || undefined, status: statusFilter }),
          apiClient.admin.affiliates.listLinks()
        ]);
        if (listRes?.success) {
          setAffiliates(listRes.affiliates || []);
          if (!selectedAffiliateId && listRes.affiliates?.length > 0) {
            setSelectedAffiliateId(listRes.affiliates[0].id);
          }
        }
        if (linksRes?.success) setLinks(linksRes.links || []);
      } else if (view === 'wallets') {
        const [listRes, wdRes] = await Promise.all([
          apiClient.admin.affiliates.list({ search: searchQuery || undefined }),
          apiClient.admin.affiliates.listWithdrawals(wdFilter)
        ]);
        if (listRes?.success) setAffiliates(listRes.affiliates || []);
        if (wdRes?.success) setWithdrawals(wdRes.withdrawals || []);
      } else if (view === 'rules') {
        const [rRes, pRes, aRes] = await Promise.all([
          apiClient.admin.affiliates.getRules(),
          apiClient.admin.affiliates.getPayoutSettings(),
          apiClient.admin.affiliates.getAuditLogs()
        ]);
        if (rRes?.success) setRules(rRes.rules || []);
        if (pRes?.success && pRes.settings) {
          setPayoutSettings(pRes.settings);
          setPayoutForm({
            minWithdrawalAmount: String(pRes.settings.min_withdrawal_amount ?? 100),
            payoutScheduleMode: pRes.settings.payout_schedule_mode || 'end_of_month',
            payoutWindowDays: String(pRes.settings.payout_window_days ?? 3)
          });
        }
        if (aRes?.success) setAuditLogs(aRes.logs || []);
      } else if (view === 'reports') {
        const range = getClientPresetDates(reportPeriod, reportFrom, reportTo);
        const [repRes, cRes, listRes] = await Promise.all([
          apiClient.admin.affiliates.getReports({
            period: reportPeriod,
            from: reportPeriod === 'custom' ? reportFrom : undefined,
            to: reportPeriod === 'custom' ? reportTo : undefined,
            granularity: reportGranularity,
            affiliateId: reportAffiliateId || undefined
          }),
          apiClient.admin.affiliates.listCommissions({
            type: commTypeFilter,
            status: commStatusFilter,
            affiliateId: reportAffiliateId || undefined,
            from: range.from,
            to: range.to,
            search: commSearch.trim() || undefined,
            page: commPage,
            limit: 20
          }),
          apiClient.admin.affiliates.list()
        ]);
        if (repRes?.success) setReportData(repRes);
        if (cRes?.success) {
          setCommissions(cRes.commissions || []);
          setCommTotalPages(cRes.totalPages || 1);
          setCommTotalCount(cRes.totalCount || 0);
        }
        if (listRes?.success) setAffiliates(listRes.affiliates || []);
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to load affiliate manager data');
    } finally {
      setIsLoading(false);
    }
  }, [
    view,
    searchQuery,
    statusFilter,
    wdFilter,
    commTypeFilter,
    commStatusFilter,
    reportPeriod,
    reportGranularity,
    reportFrom,
    reportTo,
    reportAffiliateId,
    commSearch,
    commPage,
    selectedAffiliateId,
    showToast
  ]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (view === 'directory' && selectedAffiliateId) {
      apiClient.admin.affiliates
        .getDetails(selectedAffiliateId)
        .then(res => {
          if (res?.success) setSelectedDetail(res);
        })
        .catch(() => {});
    }
  }, [view, selectedAffiliateId]);

  const handleCopy = (text: string, label: string) => {
    try {
      navigator.clipboard.writeText(text);
      showToast(`📋 Copied ${label}`);
    } catch {
      showToast('Copy failed');
    }
  };

  const handleCreateAffiliate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const res = await apiClient.admin.affiliates.create({
        fullName: createForm.fullName,
        phone: createForm.phone,
        password: createForm.password || undefined,
        payoutMethod: createForm.payoutMethod,
        payoutAccount: createForm.payoutAccount || undefined,
        monthlyTargetOverride: createForm.monthlyTargetOverride ? Number(createForm.monthlyTargetOverride) : null
      });
      if (res.success) {
        showToast(`✅ Affiliate ${res.affiliate.affiliate_code} registered`);
        setShowCreateModal(false);
        setCreateForm({ fullName: '', phone: '', password: '', payoutMethod: 'Telebirr', payoutAccount: '', monthlyTargetOverride: '' });
        loadData();
      }
    } catch (err: any) {
      showToast(`❌ ${err?.message || 'Create failed'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveEditAffiliate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAffiliate) return;
    try {
      setIsSubmitting(true);
      await apiClient.admin.affiliates.update(editingAffiliate.id, {
        fullName: editingAffiliate.fullName,
        phone: editingAffiliate.phone,
        payoutMethod: editingAffiliate.payoutMethod,
        payoutAccount: editingAffiliate.payoutAccount,
        monthlyTargetOverride: editingAffiliate.monthlyTargetOverride || null
      });
      showToast('✅ Affiliate updated');
      setEditingAffiliate(null);
      loadData();
      if (selectedAffiliateId === editingAffiliate.id) {
        const d = await apiClient.admin.affiliates.getDetails(editingAffiliate.id);
        if (d?.success) setSelectedDetail(d);
      }
    } catch (err: any) {
      showToast(`❌ ${err?.message || 'Update failed'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetStatus = async (aff: any, status: 'active' | 'inactive' | 'suspended') => {
    try {
      await apiClient.admin.affiliates.setStatus(aff.id, status);
      showToast(`✅ ${aff.affiliateCode} set to ${status.toUpperCase()}`);
      loadData();
    } catch (err: any) {
      showToast(`❌ ${err?.message || 'Status change failed'}`);
    }
  };

  const handleReviewApplication = async (aff: any, decision: 'approve' | 'reject') => {
    const reason = decision === 'reject' ? window.prompt('Rejection reason:') || 'Declined by Admin' : undefined;
    try {
      await apiClient.admin.affiliates.reviewRegistration(aff.id, decision, reason);
      showToast(decision === 'approve' ? `✅ Approved ${aff.fullName}` : `❌ Declined ${aff.fullName}`);
      loadData();
    } catch (err: any) {
      showToast(`❌ ${err?.message || 'Action failed'}`);
    }
  };

  const handleOpenSupportPortal = async (aff: any) => {
    try {
      const res = await apiClient.admin.affiliates.impersonate(aff.id);
      if (res.success && res.token) {
        localStorage.setItem('sonic_affiliate_token', res.token);
        localStorage.setItem('sonic_affiliate_user', JSON.stringify(res.affiliate));
        showToast(`🔑 Support session ready for ${aff.affiliateCode}. Affiliate Portal UI unlocks in Milestone 3.`);
      }
    } catch (err: any) {
      showToast(`❌ ${err?.message || 'Support access failed'}`);
    }
  };

  const handleWalletAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletModalAff) return;
    try {
      setIsSubmitting(true);
      const res = await apiClient.admin.affiliates.adjustWallet(walletModalAff.id, {
        mode: walletAdjustForm.mode,
        amount: Number(walletAdjustForm.amount),
        reason: walletAdjustForm.reason
      });
      if (res.success) {
        showToast(`✅ Wallet updated → ETB ${fmtETB(res.newBalance)}`);
        setWalletModalAff(null);
        setWalletAdjustForm({ mode: 'recharge', amount: '100', reason: '' });
        loadData();
      }
    } catch (err: any) {
      showToast(`❌ ${err?.message || 'Wallet adjustment failed'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const res = await apiClient.admin.affiliates.createLink({
        label: linkForm.label,
        maxUses: linkForm.maxUses ? Number(linkForm.maxUses) : null,
        requiresApproval: linkForm.requiresApproval
      });
      if (res.success) {
        showToast('✅ Registration link created');
        setShowLinkModal(false);
        loadData();
      }
    } catch (err: any) {
      showToast(`❌ ${err?.message || 'Link creation failed'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditRule = (r: any) => {
    setEditingRule(r);
    setRuleForm({
      calcMode: r.calc_mode || 'percent',
      rateOrAmount: String(r.rate_or_amount ?? 0),
      minQualifyingDeposit: String(r.min_qualifying_deposit ?? 0),
      minMonthlyPlayers: String(r.min_monthly_players ?? 0),
      activeWindowDays: String(r.active_window_days ?? 14),
      autoApprove: Boolean(r.auto_approve),
      isActive: Boolean(r.is_active),
      description: r.description || ''
    });
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule) return;
    try {
      setIsSubmitting(true);
      await apiClient.admin.affiliates.updateRule(editingRule.commission_type, {
        calcMode: ruleForm.calcMode,
        rateOrAmount: Number(ruleForm.rateOrAmount),
        minQualifyingDeposit: Number(ruleForm.minQualifyingDeposit),
        minMonthlyPlayers: Number(ruleForm.minMonthlyPlayers),
        activeWindowDays: Number(ruleForm.activeWindowDays),
        autoApprove: ruleForm.autoApprove,
        isActive: ruleForm.isActive,
        description: ruleForm.description
      });
      showToast(`✅ Saved ${editingRule.display_name} (Version bumped cleanly)`);
      setEditingRule(null);
      loadData();
    } catch (err: any) {
      showToast(`❌ ${err?.message || 'Failed to save rule'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleRuleActive = async (r: any) => {
    try {
      await apiClient.admin.affiliates.updateRule(r.commission_type, { isActive: !r.is_active });
      showToast(`${r.display_name} ${!r.is_active ? 'enabled' : 'disabled'}`);
      loadData();
    } catch (err: any) {
      showToast(`❌ ${err?.message || 'Toggle failed'}`);
    }
  };

  const handleSavePayoutSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await apiClient.admin.affiliates.updatePayoutSettings({
        minWithdrawalAmount: Number(payoutForm.minWithdrawalAmount),
        payoutScheduleMode: payoutForm.payoutScheduleMode,
        payoutWindowDays: Number(payoutForm.payoutWindowDays)
      });
      showToast('✅ Affiliate payout schedule updated');
      loadData();
    } catch (err: any) {
      showToast(`❌ ${err?.message || 'Failed to update payout settings'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRunPeriodic = async () => {
    try {
      setIsSubmitting(true);
      const res = await apiClient.admin.affiliates.runPeriodicCommissions();
      if (res.success) {
        showToast(`✅ Settled ${res.createdCount} Monthly/Loyalty entries (ETB ${fmtETB(res.totalAmount)})`);
        loadData();
      }
    } catch (err: any) {
      showToast(`❌ ${err?.message || 'Batch failed'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingApplications = affiliates.filter(a => a.approvalStatus === 'pending');
  const selectedAff = affiliates.find(a => a.id === selectedAffiliateId) || affiliates[0] || null;
  const originBase = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="affiliate-enqu-root">
      {/* Header Bar */}
      <div className="aff-top">
        {isSidebarCollapsed && (
          <button type="button" className="btn-chatgpt-toggle" onClick={toggleSidebar} title="Open sidebar">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>
        )}
        <h1>
          {view === 'directory' && 'Affiliate Manager'}
          {view === 'wallets' && 'Affiliate Wallets & Payouts'}
          {view === 'rules' && 'Commission & Payout Setup'}
          {view === 'reports' && 'Affiliate Reports & Analytics'}
        </h1>

        <div className="aff-pill-bar">
          <button type="button" className="aff-btn-ghost" onClick={loadData} disabled={isLoading}>
            {isLoading ? 'Refreshing…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* =================================================================
          VIEW 1: AFFILIATES DIRECTORY & REGISTRATION LINKS
          ================================================================= */}
      {view === 'directory' && (
        <>
          <div className="aff-grid aff-g4">
            <div className="aff-card dark-hero">
              <div className="aff-lab">Total Affiliates</div>
              <div className="aff-val">{fmtInt(overview?.totalAffiliates || 0)}</div>
              <div className="aff-sub">{fmtInt(overview?.activeAffiliates || 0)} active &amp; approved</div>
            </div>
            <div className="aff-card">
              <div className="aff-lab">Referred Players</div>
              <div className="aff-val">{fmtInt(overview?.totalReferredPlayers || 0)}</div>
              <div className="aff-sub">
                {fmtInt(overview?.newPlayers30d || 0)} new (30d) · {fmtInt(overview?.activePlayers14d || 0)} active (14d)
              </div>
            </div>
            <div className="aff-card">
              <div className="aff-lab">Affiliate Deposits</div>
              <div className="aff-val">ETB {fmtETB(overview?.totalAffiliateDeposits || 0)}</div>
              <div className="aff-sub">30d volume: ETB {fmtETB(overview?.deposits30d || 0)}</div>
            </div>
            <div className="aff-card">
              <div className="aff-lab">Pending Applications</div>
              <div className="aff-val">{fmtInt(overview?.pendingApplications || 0)}</div>
              <div className="aff-sub">
                {(overview?.pendingApplications || 0) > 0 ? 'Requires admin review' : 'All applications reviewed'}
              </div>
            </div>
          </div>

          {pendingApplications.length > 0 && (
            <div className="aff-card" style={{ marginBottom: '15px', border: '1px solid #fde68a' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>
                  Pending Affiliate Applications ({pendingApplications.length})
                </h3>
                <span className="aff-chip amber">Approval Required</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {pendingApplications.map(app => (
                  <div
                    key={app.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: '14px',
                      background: '#fffbeb',
                      gap: '10px',
                      flexWrap: 'wrap'
                    }}
                  >
                    <div>
                      <b>{app.fullName}</b> · {app.phone}{' '}
                      <span className="aff-chip">{app.affiliateCode}</span>
                      {app.applicationNotes && (
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{app.applicationNotes}</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button type="button" className="aff-btn-dark" onClick={() => handleReviewApplication(app, 'approve')}>
                        Approve
                      </button>
                      <button type="button" className="aff-btn-ghost" onClick={() => handleReviewApplication(app, 'reject')}>
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="aff-grid aff-g2">
            {/* Left: Affiliates Table + Registration Links */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div className="aff-card">
                <div className="aff-dir-head">
                  <div>
                    <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>Affiliates Directory</h3>
                    <div className="aff-lab" style={{ marginTop: '2px' }}>
                      Manage approved partners, monthly player targets &amp; wallet status
                    </div>
                  </div>
                  <div className="aff-dir-toolbar">
                    <input
                      type="text"
                      className="aff-input"
                      style={{ width: '185px' }}
                      placeholder="Search name, phone, AFF-..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                    />
                    <select
                      className="aff-input"
                      style={{ width: 'auto' }}
                      value={statusFilter}
                      onChange={e => setStatusFilter(e.target.value)}
                    >
                      <option value="all">All Status</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="suspended">Suspended</option>
                    </select>
                    <button type="button" className="aff-btn-dark aff-btn-cta" onClick={() => setShowCreateModal(true)}>
                      + Register Affiliate
                    </button>
                  </div>
                </div>

                <div className="aff-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Affiliate</th>
                        <th>Status</th>
                        <th>Wallet</th>
                        <th>Players / Active</th>
                        <th>Target</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading && affiliates.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: '20px', color: '#707070' }}>
                            Loading affiliates...
                          </td>
                        </tr>
                      ) : affiliates.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: '#707070' }}>
                            <div style={{ marginBottom: '10px' }}>
                              No affiliates registered yet. Add one directly or generate an invite link below.
                            </div>
                            <button type="button" className="aff-btn-dark aff-btn-cta" onClick={() => setShowCreateModal(true)}>
                              + Register Affiliate
                            </button>
                          </td>
                        </tr>
                      ) : (
                        affiliates.map(a => (
                          <tr
                            key={a.id}
                            className={`aff-row-clickable ${selectedAff?.id === a.id ? 'aff-row-selected' : ''}`}
                            onClick={() => setSelectedAffiliateId(a.id)}
                          >
                            <td>
                              <div style={{ fontWeight: 700 }}>{a.fullName}</div>
                              <div style={{ fontSize: '12px', color: '#707070' }}>
                                {a.affiliateCode} · {a.phone}
                              </div>
                            </td>
                            <td>
                              <span
                                className={`aff-chip ${
                                  a.status === 'active' ? 'green' : a.status === 'suspended' ? 'red' : 'amber'
                                }`}
                              >
                                {a.status.toUpperCase()}
                              </span>
                            </td>
                            <td><b>ETB {fmtETB(a.walletBalance)}</b></td>
                            <td>
                              {fmtInt(a.totalPlayers)} / <span style={{ color: '#16a34a', fontWeight: 700 }}>{fmtInt(a.activePlayers)}</span>
                            </td>
                            <td>
                              {fmtInt(a.monthPlayers)} / {fmtInt(a.monthlyTarget)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Registration Link Generator */}
              <div className="aff-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>Affiliate Registration Links</h3>
                    <div className="aff-lab" style={{ marginTop: '2px' }}>Share invite links so new affiliates can apply</div>
                  </div>
                  <button type="button" className="aff-btn-dark" onClick={() => setShowLinkModal(true)}>
                    + Generate Link
                  </button>
                </div>

                <div className="aff-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Label</th>
                        <th>Invite URL</th>
                        <th>Uses</th>
                        <th>State</th>
                      </tr>
                    </thead>
                    <tbody>
                      {links.length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ textAlign: 'center', padding: '14px', color: '#707070' }}>
                            No registration links generated yet.
                          </td>
                        </tr>
                      ) : (
                        links.map(l => {
                          const shareUrl = `${originBase}/#/affiliate-register?invite=${l.token}`;
                          return (
                            <tr key={l.id}>
                              <td><b>{l.label || 'Partner Link'}</b></td>
                              <td>
                                <button
                                  type="button"
                                  className="aff-btn-ghost"
                                  style={{ padding: '4px 10px', fontSize: '12px' }}
                                  onClick={() => handleCopy(shareUrl, 'Registration Link')}
                                >
                                  Copy ?invite={l.token}
                                </button>
                              </td>
                              <td>
                                {l.uses_count}{l.max_uses ? ` / ${l.max_uses}` : ' / ∞'}
                              </td>
                              <td>
                                <label className="aff-switch">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(l.is_active)}
                                    onChange={() => apiClient.admin.affiliates.toggleLink(l.id, !l.is_active).then(loadData)}
                                  />
                                  <span className="aff-switch-track" />
                                </label>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right: Luxury Dark Partner Pass Inspector */}
            <div>
              {selectedAff ? (
                <div className="aff-card">
                  <div className="aff-partner-pass">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span className="aff-pass-code">{selectedAff.affiliateCode}</span>
                      <span className={`aff-chip ${selectedAff.status === 'active' ? 'green' : 'red'}`}>
                        {selectedAff.status.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 800 }}>{selectedAff.fullName}</div>
                    <div style={{ fontSize: '13px', color: '#cbd5e1', marginTop: '2px' }}>
                      {selectedAff.phone} · {selectedAff.payoutMethod} ({selectedAff.payoutAccount || selectedAff.phone})
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '16px' }}>
                      <div>
                        <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>Wallet Balance</div>
                        <div style={{ fontSize: '18px', fontWeight: 800 }}>ETB {fmtETB(selectedAff.walletBalance)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>Pending Comm.</div>
                        <div style={{ fontSize: '18px', fontWeight: 800, color: '#fde047' }}>
                          ETB {fmtETB(selectedAff.pendingCommission)}
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#cbd5e1' }}>
                        <span>Monthly Target Progress</span>
                        <b>
                          {selectedAff.monthPlayers} / {selectedAff.monthlyTarget} players
                        </b>
                      </div>
                      <div className="aff-progress-track">
                        <div
                          className="aff-progress-fill"
                          style={{
                            width: `${Math.min(100, Math.round((selectedAff.monthPlayers / Math.max(1, selectedAff.monthlyTarget)) * 100))}%`
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
                    <button type="button" className="aff-btn-ghost" onClick={() => setEditingAffiliate({ ...selectedAff })}>
                      Edit Info / Target
                    </button>
                    <button type="button" className="aff-btn-ghost" onClick={() => setWalletModalAff(selectedAff)}>
                      Recharge / Adjust
                    </button>
                    <button
                      type="button"
                      className="aff-btn-ghost"
                      onClick={() => handleSetStatus(selectedAff, selectedAff.status === 'active' ? 'suspended' : 'active')}
                    >
                      {selectedAff.status === 'active' ? 'Suspend' : 'Activate'}
                    </button>
                    <button type="button" className="aff-btn-dark" onClick={() => handleOpenSupportPortal(selectedAff)}>
                      Access Portal
                    </button>
                  </div>

                  <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 800 }}>
                    Recent Referred Players ({selectedDetail?.players?.length || 0})
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {(selectedDetail?.players || []).slice(0, 5).map((p: any) => (
                      <div
                        key={p.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '12.5px',
                          padding: '7px 10px',
                          background: '#f8fafc',
                          borderRadius: '10px'
                        }}
                      >
                        <span>
                          <b>{p.full_name}</b> · {p.phone || 'TG'}
                        </span>
                        <span style={{ fontWeight: 700, color: '#16a34a' }}>ETB {fmtETB(p.total_deposited)}</span>
                      </div>
                    ))}
                    {(!selectedDetail?.players || selectedDetail.players.length === 0) && (
                      <div style={{ fontSize: '12.5px', color: '#707070' }}>No referred players assigned yet.</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="aff-card" style={{ color: '#707070', textAlign: 'center', padding: '32px' }}>
                  Select an affiliate to inspect their wallet pass, monthly target, and referred players.
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* =================================================================
          VIEW 2: WALLETS & MONTHLY WITHDRAWALS
          ================================================================= */}
      {view === 'wallets' && (
        <>
          <div className="aff-grid aff-g4">
            <div className="aff-card dark-hero">
              <div className="aff-lab">Affiliate Wallet Liabilities</div>
              <div className="aff-val">ETB {fmtETB(overview?.totalWalletBalance || 0)}</div>
              <div className="aff-sub">Available withdrawable balances</div>
            </div>
            <div className="aff-card">
              <div className="aff-lab">Pending Commissions</div>
              <div className="aff-val">ETB {fmtETB(overview?.totalPendingCommission || 0)}</div>
              <div className="aff-sub">Awaiting admin approval</div>
            </div>
            <div className="aff-card">
              <div className="aff-lab">Pending Withdrawals</div>
              <div className="aff-val">{fmtInt(overview?.pendingWithdrawalsCount || 0)}</div>
              <div className="aff-sub">ETB {fmtETB(overview?.pendingWithdrawalsAmt || 0)} queued</div>
            </div>
            <div className="aff-card">
              <div className="aff-lab">Total Paid Out</div>
              <div className="aff-val">ETB {fmtETB(overview?.paidWithdrawalsAmt || 0)}</div>
              <div className="aff-sub">Historical completed payouts</div>
            </div>
          </div>

          <div className="aff-grid aff-g2-eq">
            <div className="aff-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>Affiliate Wallets</h3>
                <input
                  type="text"
                  className="aff-input"
                  style={{ width: '180px' }}
                  placeholder="Search affiliate..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="aff-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Affiliate</th>
                      <th>Available</th>
                      <th>Earned</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {affiliates.map(a => (
                      <tr key={a.id}>
                        <td>
                          <b>{a.fullName}</b>
                          <div style={{ fontSize: '11.5px', color: '#707070' }}>{a.affiliateCode}</div>
                        </td>
                        <td><b>ETB {fmtETB(a.walletBalance)}</b></td>
                        <td>ETB {fmtETB(a.totalEarned)}</td>
                        <td>
                          <button type="button" className="aff-btn-ghost" onClick={() => setWalletModalAff(a)}>
                            Recharge / Adjust
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="aff-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>Withdrawal Requests</h3>
                <select className="aff-input" style={{ width: 'auto' }} value={wdFilter} onChange={e => setWdFilter(e.target.value)}>
                  <option value="all">All</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="paid">Paid</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div className="aff-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Affiliate</th>
                      <th>Account</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {withdrawals.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '18px', color: '#707070' }}>
                          No withdrawal requests found.
                        </td>
                      </tr>
                    ) : (
                      withdrawals.map(w => (
                        <tr key={w.id}>
                          <td>
                            <b>{w.affiliate_name}</b>
                            <div style={{ fontSize: '11.5px', color: '#707070' }}>{w.affiliate_code}</div>
                          </td>
                          <td style={{ fontSize: '12.5px' }}>
                            {w.payout_method} · {w.payout_account}
                          </td>
                          <td><b>ETB {fmtETB(w.amount)}</b></td>
                          <td>
                            <span className={`aff-chip ${w.status === 'paid' ? 'green' : w.status === 'rejected' ? 'red' : 'amber'}`}>
                              {String(w.status).toUpperCase()}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              {w.status === 'pending' && (
                                <button
                                  type="button"
                                  className="aff-btn-ghost"
                                  style={{ padding: '4px 8px', fontSize: '11.5px' }}
                                  onClick={() => apiClient.admin.affiliates.approveWithdrawal(w.id).then(loadData)}
                                >
                                  Approve
                                </button>
                              )}
                              {(w.status === 'pending' || w.status === 'approved') && (
                                <>
                                  <button
                                    type="button"
                                    className="aff-btn-dark"
                                    style={{ padding: '4px 8px', fontSize: '11.5px' }}
                                    onClick={() => {
                                      const ref = window.prompt('Payment reference / Tx ID:') || undefined;
                                      apiClient.admin.affiliates.markWithdrawalPaid(w.id, ref).then(() => {
                                        showToast('✅ Marked as paid');
                                        loadData();
                                      });
                                    }}
                                  >
                                    Mark Paid
                                  </button>
                                  <button
                                    type="button"
                                    className="aff-btn-ghost"
                                    style={{ padding: '4px 8px', fontSize: '11.5px', color: '#b0302f' }}
                                    onClick={() => {
                                      const reason = window.prompt('Rejection reason:') || 'Declined';
                                      apiClient.admin.affiliates.rejectWithdrawal(w.id, reason).then(() => {
                                        showToast('Refunded to affiliate wallet');
                                        loadData();
                                      });
                                    }}
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {/* =================================================================
          VIEW 3: SIX COMMISSION RULES + PAYOUT SETTINGS + AUDIT LOG
          ================================================================= */}
      {view === 'rules' && (
        <>
          <div className="aff-grid aff-g3">
            {rules.map(r => {
              const theme = RULE_THEMES[r.commission_type] || { bg: '#f1f5f9', fg: '#334155', badge: r.commission_type, icon: '⚡' };
              return (
                <div key={r.commission_type} className="aff-rule-card">
                  <div className="aff-rule-top">
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <div className="aff-rule-icon" style={{ background: theme.bg, color: theme.fg }}>
                        {theme.icon}
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '15px' }}>{r.display_name}</div>
                        <div style={{ display: 'flex', gap: '5px', marginTop: '3px', flexWrap: 'wrap' }}>
                          <span className="aff-chip">{theme.badge}</span>
                          <span className="aff-chip blue">v{r.version}</span>
                          <span className={`aff-chip ${r.auto_approve ? 'green' : 'amber'}`}>
                            {r.auto_approve ? 'Auto-Approve' : 'Pending Review'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <label className="aff-switch" title="Enable / Disable Rule">
                      <input type="checkbox" checked={Boolean(r.is_active)} onChange={() => handleToggleRuleActive(r)} />
                      <span className="aff-switch-track" />
                    </label>
                  </div>

                  <div className="aff-rule-rate">
                    {r.calc_mode === 'percent' ? `${parseFloat(r.rate_or_amount)}%` : `ETB ${fmtETB(r.rate_or_amount)}`}
                  </div>

                  <div style={{ fontSize: '12.5px', color: '#64748b', minHeight: '34px' }}>{r.description}</div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>
                      {Number(r.min_qualifying_deposit) > 0 && `Min Deposit > ETB ${fmtETB(r.min_qualifying_deposit)}`}
                      {Number(r.min_monthly_players) > 0 && `Target: ${r.min_monthly_players} players/mo`}
                      {(r.commission_type === 'monthly' || r.commission_type === 'loyalty') && `Active: ${r.active_window_days}d`}
                      {Number(r.min_qualifying_deposit) === 0 &&
                        Number(r.min_monthly_players) === 0 &&
                        r.commission_type !== 'monthly' &&
                        r.commission_type !== 'loyalty' &&
                        'No minimum threshold'}
                    </span>
                    <button type="button" className="aff-btn-ghost" onClick={() => openEditRule(r)}>
                      Configure
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="aff-grid aff-g2-eq">
            {/* Payout Schedule Settings */}
            <form className="aff-card" onSubmit={handleSavePayoutSettings}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>Payout Setup &amp; Monthly Batch</h3>
                  <div className="aff-lab">Controls when affiliates can withdraw approved wallet balance</div>
                </div>
                <button type="button" className="aff-btn-ghost" disabled={isSubmitting} onClick={handleRunPeriodic}>
                  Run Monthly Batch (2% &amp; 1%)
                </button>
              </div>

              <div className="aff-grid aff-g3" style={{ marginBottom: '12px' }}>
                <div className="aff-field" style={{ marginBottom: 0 }}>
                  <label>Min Withdrawal (ETB)</label>
                  <input
                    type="number"
                    className="aff-input"
                    min="10"
                    value={payoutForm.minWithdrawalAmount}
                    onChange={e => setPayoutForm(p => ({ ...p, minWithdrawalAmount: e.target.value }))}
                  />
                </div>
                <div className="aff-field" style={{ marginBottom: 0 }}>
                  <label>Schedule Mode</label>
                  <select
                    className="aff-input"
                    value={payoutForm.payoutScheduleMode}
                    onChange={e => setPayoutForm(p => ({ ...p, payoutScheduleMode: e.target.value }))}
                  >
                    <option value="end_of_month">End of Month Only</option>
                    <option value="anytime">Anytime</option>
                  </select>
                </div>
                <div className="aff-field" style={{ marginBottom: 0 }}>
                  <label>Month-End Window (Days)</label>
                  <input
                    type="number"
                    className="aff-input"
                    min="1"
                    max="15"
                    value={payoutForm.payoutWindowDays}
                    onChange={e => setPayoutForm(p => ({ ...p, payoutWindowDays: e.target.value }))}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="aff-lab">
                  Current rule: Min ETB {fmtETB(payoutSettings?.min_withdrawal_amount || 100)} ·{' '}
                  {payoutSettings?.payout_schedule_mode === 'anytime' ? 'Open anytime' : `Last ${payoutSettings?.payout_window_days || 3} days of month`}
                </span>
                <button type="submit" className="aff-btn-dark" disabled={isSubmitting}>
                  Save Payout Setup
                </button>
              </div>
            </form>

            {/* Admin Audit Log */}
            <div className="aff-card">
              <h3 style={{ margin: '0 0 10px 0', fontSize: '17px', fontWeight: 800 }}>Commission &amp; Wallet Audit Log</h3>
              <div className="aff-table-wrap" style={{ maxHeight: '240px', overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Admin</th>
                      <th>Action</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: '14px', color: '#707070' }}>
                          No audit events recorded yet.
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map(log => (
                        <tr key={log.id}>
                          <td style={{ fontSize: '11.5px', color: '#707070' }}>{fmtDate(log.created_at)}</td>
                          <td><b>{log.admin_name || 'Admin'}</b></td>
                          <td><span className="aff-chip">{log.action}</span></td>
                          <td style={{ fontSize: '12px' }}>{log.reason || log.target_id || '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {/* =================================================================
          VIEW 4: MODERN REPORTS & ANALYTICS SUITE
          ================================================================= */}
      {view === 'reports' && (() => {
        const repKpis = reportData?.kpis || {
          totalCommissions: 0,
          approvedCommissions: 0,
          pendingCommissions: 0,
          pendingCount: 0,
          reversedCommissions: 0,
          generatedDeposits: 0,
          depositCount: 0,
          activeDepositors: 0,
          newPlayers: 0,
          paidWithdrawals: 0,
          approvedWithdrawals: 0,
          pendingWithdrawals: 0,
          rejectedWithdrawals: 0,
          withdrawalsCount: 0
        };
        const buckets: any[] = reportData?.trendBuckets || [];
        const breakdown: any[] = reportData?.typeBreakdown || [];
        const leaderboard: any[] = reportData?.leaderboard || [];
        const periodWithdrawals: any[] = reportData?.withdrawals || [];

        const maxChartVal = Math.max(
          100,
          ...buckets.map(b => Math.max(Number(b.deposits || 0), Number(b.commissions || 0)))
        );
        const totalBreakdownAmt = Math.max(
          1,
          breakdown.reduce((acc, row) => acc + Number(row.totalAmt || 0), 0)
        );

        const selectPreset = (next: ReportPeriod) => {
          setReportPeriod(next);
          setCommPage(1);
          if (next === 'today') {
            const t = getEatYmdOffset(0);
            setReportFrom(t);
            setReportTo(t);
            setReportGranularity('daily');
          } else if (next === 'yesterday') {
            const y = getEatYmdOffset(-1);
            setReportFrom(y);
            setReportTo(y);
            setReportGranularity('daily');
          } else if (next === 'week') {
            setReportFrom(getEatYmdOffset(-6));
            setReportTo(getEatYmdOffset(0));
            setReportGranularity('daily');
          } else if (next === 'month') {
            setReportFrom(getEatYmdOffset(-29));
            setReportTo(getEatYmdOffset(0));
            setReportGranularity('weekly');
          } else if (next === 'all') {
            setReportFrom('2024-01-01');
            setReportTo(getEatYmdOffset(0));
            setReportGranularity('monthly');
          }
        };

        const handleExportReportCsv = () => {
          const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
          let csvRows: string[] = [];
          let fileName = `affiliate-${reportSubTab}-${reportFrom}-to-${reportTo}.csv`;

          if (reportSubTab === 'leaderboard') {
            csvRows.push(['Rank', 'Code', 'Affiliate', 'Status', 'New Players', 'Total Players', 'Active 14d', 'Monthly Target', 'Generated Deposits ETB', 'Approved Commissions ETB', 'Pending Commissions ETB'].map(esc).join(','));
            leaderboard.forEach((row, idx) => {
              csvRows.push([
                idx + 1,
                row.affiliateCode,
                row.fullName,
                row.status,
                row.newPlayers,
                row.totalPlayers,
                row.activePlayers,
                row.monthlyTarget,
                row.deposits,
                row.commissionsEarned,
                row.pendingCommissions
              ].map(esc).join(','));
            });
          } else if (reportSubTab === 'withdrawals') {
            csvRows.push(['Code', 'Affiliate', 'Phone', 'Method', 'Account', 'Amount ETB', 'Status', 'Payment Ref', 'Created At'].map(esc).join(','));
            periodWithdrawals.forEach(w => {
              csvRows.push([
                w.affiliate_code,
                w.affiliate_name,
                w.affiliate_phone,
                w.payout_method,
                w.payout_account,
                w.amount,
                w.status,
                w.payment_reference || '',
                w.created_at
              ].map(esc).join(','));
            });
          } else {
            csvRows.push(['Code', 'Affiliate', 'Commission Type', 'Rule Version', 'Mode', 'Rate', 'Base ETB', 'Commission ETB', 'Player', 'Status', 'Created At'].map(esc).join(','));
            commissions.forEach(c => {
              csvRows.push([
                c.affiliate_code,
                c.affiliate_name,
                c.commission_type,
                `v${c.rule_version}`,
                c.calc_mode,
                c.rate_applied,
                c.base_amount,
                c.amount,
                c.player_name || '',
                c.status,
                c.created_at
              ].map(esc).join(','));
            });
          }

          const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = fileName;
          link.click();
          URL.revokeObjectURL(url);
          showToast(`📥 Exported ${fileName}`);
        };

        return (
          <>
            {/* 1. Timeframe, Custom Date Search & Granularity Toolbar */}
            <div className="aff-card aff-report-bar">
              <div className="aff-seg-group" role="group" aria-label="Report period presets">
                {(
                  [
                    ['today', 'Today (Daily)'],
                    ['yesterday', 'Yesterday'],
                    ['week', 'Weekly (7D)'],
                    ['month', 'Monthly (30D)'],
                    ['all', 'All Time'],
                    ['custom', 'Custom Dates']
                  ] as Array<[ReportPeriod, string]>
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={`aff-seg-btn ${reportPeriod === key ? 'active' : ''}`}
                    onClick={() => selectPreset(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="aff-date-cluster">
                <span className="aff-date-label">From</span>
                <input
                  type="date"
                  className="aff-date-input"
                  value={reportFrom}
                  onChange={e => {
                    setReportFrom(e.target.value);
                    setReportPeriod('custom');
                    setCommPage(1);
                  }}
                />
                <span className="aff-date-label">To</span>
                <input
                  type="date"
                  className="aff-date-input"
                  value={reportTo}
                  onChange={e => {
                    setReportTo(e.target.value);
                    setReportPeriod('custom');
                    setCommPage(1);
                  }}
                />
              </div>

              <div className="aff-date-cluster">
                <div className="aff-seg-group" role="group" aria-label="Chart grouping">
                  {(['daily', 'weekly', 'monthly'] as ReportGranularity[]).map(g => (
                    <button
                      key={g}
                      type="button"
                      className={`aff-seg-btn ${reportGranularity === g ? 'active' : ''}`}
                      onClick={() => setReportGranularity(g)}
                    >
                      {g.charAt(0).toUpperCase() + g.slice(1)}
                    </button>
                  ))}
                </div>

                <select
                  className="aff-input"
                  style={{ width: 'auto', minWidth: '155px' }}
                  value={reportAffiliateId}
                  onChange={e => {
                    setReportAffiliateId(e.target.value);
                    setCommPage(1);
                  }}
                >
                  <option value="">All Affiliates</option>
                  {affiliates.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.affiliateCode} · {a.fullName}
                    </option>
                  ))}
                </select>

                <button type="button" className="aff-btn-dark" onClick={handleExportReportCsv}>
                  ↓ Export CSV
                </button>
              </div>
            </div>

            {/* 2. Period-Scoped 4 Executive Hero Cards */}
            <div className="aff-grid aff-g4">
              <div className="aff-card dark-hero">
                <div className="aff-lab">Commissions ({reportPeriod === 'all' ? 'All Time' : `${reportFrom} → ${reportTo}`})</div>
                <div className="aff-val">ETB {fmtETB(repKpis.totalCommissions)}</div>
                <div className="aff-sub">
                  Approved: ETB {fmtETB(repKpis.approvedCommissions)}
                </div>
              </div>
              <div className="aff-card">
                <div className="aff-lab">Generated Player Deposits</div>
                <div className="aff-val">ETB {fmtETB(repKpis.generatedDeposits)}</div>
                <div className="aff-sub">
                  {fmtInt(repKpis.depositCount)} deposits · {fmtInt(repKpis.activeDepositors)} depositors
                </div>
              </div>
              <div className="aff-card">
                <div className="aff-lab">New Referred Players</div>
                <div className="aff-val">{fmtInt(repKpis.newPlayers)}</div>
                <div className="aff-sub">
                  Paid payouts: ETB {fmtETB(repKpis.paidWithdrawals)}
                </div>
              </div>
              <div className="aff-card">
                <div className="aff-lab">Pending Review &amp; Reversals</div>
                <div className="aff-val">ETB {fmtETB(repKpis.pendingCommissions)}</div>
                <div className="aff-sub">
                  {fmtInt(repKpis.pendingCount)} pending · Reversed: ETB {fmtETB(repKpis.reversedCommissions)}
                </div>
              </div>
            </div>

            {/* 3. Clean Dashboard-Matched Revenue Bar Chart + Conic Donut */}
            <div className="aff-grid aff-g2">
              {(() => {
                const vals = buckets.map(b =>
                  Math.round(Number(chartMetric === 'deposits' ? b.deposits || 0 : b.commissions || 0))
                );
                const maxVal = Math.max(...vals, 100);
                const todayIndex = buckets.length - 1;
                const periodSub =
                  reportPeriod === 'today'
                    ? 'Today'
                    : reportPeriod === 'yesterday'
                      ? 'Yesterday'
                      : reportPeriod === 'week'
                        ? 'Last 7 Days'
                        : reportPeriod === 'month'
                          ? 'Last 30 Days'
                          : reportPeriod === 'all'
                            ? 'All Time'
                            : `${reportFrom} - ${reportTo}`;

                return (
                  <div className="aff-card">
                    <div className="aff-clean-head">
                      <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                        {chartMetric === 'deposits' ? 'Player Deposits' : 'Affiliate Revenue'}
                      </h3>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <span className="aff-lab">ETB ({periodSub})</span>
                        <div className="aff-seg-group" role="group" aria-label="Chart metric toggle">
                          <button
                            type="button"
                            className={`aff-seg-btn ${chartMetric === 'commissions' ? 'active' : ''}`}
                            onClick={() => setChartMetric('commissions')}
                          >
                            Commissions
                          </button>
                          <button
                            type="button"
                            className={`aff-seg-btn ${chartMetric === 'deposits' ? 'active' : ''}`}
                            onClick={() => setChartMetric('deposits')}
                          >
                            Deposits
                          </button>
                        </div>
                      </div>
                    </div>

                    {buckets.length === 0 ? (
                      <div style={{ padding: '48px 16px', textAlign: 'center', color: '#707070', fontSize: '13px' }}>
                        No data available for this date range.
                      </div>
                    ) : (
                      <div className="aff-clean-scroll">
                        <div
                          className="aff-clean-bars"
                          style={{ minWidth: buckets.length > 14 ? `${buckets.length * 52}px` : '100%' }}
                        >
                          {[100, 75, 50, 25, 0].map((p, i) => (
                            <span key={p} className="aff-clean-yl" style={{ top: `${i * 38}px` }}>
                              {fmtInt(Math.round((maxVal * p) / 100))}
                            </span>
                          ))}

                          {buckets.map((b, i) => {
                            const v = vals[i] || 0;
                            const isHighlight = i === todayIndex;
                            const barHeight = Math.max(8, Math.round((v / maxVal) * 145));
                            const shortLabel =
                              buckets.length <= 7 && b.subLabel ? b.subLabel : b.label;

                            return (
                              <div
                                key={b.bucketKey || i}
                                className={`aff-clean-bar ${chartMetric === 'deposits' ? 'is-dep' : ''} ${
                                  isHighlight ? 'h' : ''
                                }`}
                              >
                                <i
                                  style={{ height: `${barHeight}px` }}
                                  title={`${b.label}: ETB ${fmtInt(v)} (${fmtInt(b.registrations || 0)} signups)`}
                                />
                                <span>{shortLabel}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Right Card: Dashboard-Matched Conic-Gradient Donut (6 Commission Types) */}
              {(() => {
                const rawTotal = breakdown.reduce((acc, row) => acc + Number(row.totalAmt || 0), 0);
                let cursorPct = 0;
                const slices: string[] = [];
                if (rawTotal > 0) {
                  breakdown.forEach(item => {
                    const val = Number(item.totalAmt || 0);
                    if (val <= 0) return;
                    const theme = RULE_THEMES[item.commissionType] || { fg: '#1c1e1d' };
                    const spanPct = (val / rawTotal) * 100;
                    const nextPct = Math.min(100, cursorPct + spanPct);
                    slices.push(`${theme.fg} ${cursorPct.toFixed(2)}% ${nextPct.toFixed(2)}%`);
                    cursorPct = nextPct;
                  });
                }
                const donutBg =
                  slices.length > 0
                    ? `conic-gradient(${slices.join(', ')})`
                    : 'conic-gradient(#1c1e1d 0% 16%, #e4e4e7 16% 100%)';

                const focusedItem = hoveredRuleType
                  ? breakdown.find(b => b.commissionType === hoveredRuleType)
                  : null;

                return (
                  <div className="aff-card">
                    <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '16.5px', fontWeight: 800 }}>Commission Allocation</h3>
                        <div className="aff-lab" style={{ marginTop: '2px' }}>
                          6 rule share in selected range
                        </div>
                      </div>
                      <span className="aff-chip">6 Rules</span>
                    </div>

                    <div className="aff-donut-wrap">
                      <div className="aff-donut" style={{ background: donutBg }}>
                        <div className="aff-donut-inner">
                          <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                            {focusedItem ? focusedItem.label : 'Total Mix'}
                          </span>
                          <b style={{ fontSize: '14px', fontWeight: 800, color: '#1b1b1b', marginTop: '2px' }}>
                            ETB {fmtCompactAxis(focusedItem ? Number(focusedItem.totalAmt || 0) : rawTotal)}
                          </b>
                        </div>
                      </div>
                    </div>

                    <div className="aff-donut-legend">
                      {breakdown.map(item => {
                        const theme = RULE_THEMES[item.commissionType] || { fg: '#334155', icon: '⚡' };
                        const pct = rawTotal > 0 ? Math.round((Number(item.totalAmt || 0) / totalBreakdownAmt) * 100) : 0;
                        return (
                          <div
                            key={item.commissionType}
                            className={`aff-donut-row ${hoveredRuleType === item.commissionType ? 'active' : ''}`}
                            onMouseEnter={() => setHoveredRuleType(item.commissionType)}
                            onMouseLeave={() => setHoveredRuleType(null)}
                          >
                            <span className="aff-donut-label">
                              <span
                                style={{
                                  width: '9px',
                                  height: '9px',
                                  borderRadius: '50%',
                                  background: theme.fg,
                                  display: 'inline-block'
                                }}
                              />
                              <span>{item.label}</span>
                              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>({fmtInt(item.count)})</span>
                            </span>
                            <span style={{ fontWeight: 700 }}>
                              ETB {fmtETB(item.totalAmt)}{' '}
                              <span style={{ fontSize: '11px', color: '#64748b' }}>({pct}%)</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* 4. Sub-Tabs + Ledger / Leaderboard / Withdrawals Report */}
            <div className="aff-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <div className="aff-subtabs" style={{ marginBottom: 0 }}>
                  <button
                    type="button"
                    className={`aff-subtab-btn ${reportSubTab === 'ledger' ? 'active' : ''}`}
                    onClick={() => setReportSubTab('ledger')}
                  >
                    Commission Ledger <span className="aff-subtab-count">{fmtInt(commTotalCount)}</span>
                  </button>
                  <button
                    type="button"
                    className={`aff-subtab-btn ${reportSubTab === 'leaderboard' ? 'active' : ''}`}
                    onClick={() => setReportSubTab('leaderboard')}
                  >
                    Top Affiliates &amp; Targets <span className="aff-subtab-count">{fmtInt(leaderboard.length)}</span>
                  </button>
                  <button
                    type="button"
                    className={`aff-subtab-btn ${reportSubTab === 'withdrawals' ? 'active' : ''}`}
                    onClick={() => setReportSubTab('withdrawals')}
                  >
                    Withdrawals &amp; Payouts <span className="aff-subtab-count">{fmtInt(periodWithdrawals.length)}</span>
                  </button>
                </div>

                {reportSubTab === 'ledger' && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      className="aff-input"
                      style={{ width: '215px' }}
                      placeholder="Search affiliate, AFF-, player..."
                      value={commSearch}
                      onChange={e => {
                        setCommSearch(e.target.value);
                        setCommPage(1);
                      }}
                    />
                    <select
                      className="aff-input"
                      style={{ width: 'auto' }}
                      value={commTypeFilter}
                      onChange={e => {
                        setCommTypeFilter(e.target.value);
                        setCommPage(1);
                      }}
                    >
                      <option value="all">All 6 Types</option>
                      <option value="registration">Registration</option>
                      <option value="first_deposit">First Deposit</option>
                      <option value="regular_deposit">Regular Deposit</option>
                      <option value="target">Target</option>
                      <option value="monthly">Monthly</option>
                      <option value="loyalty">Loyalty</option>
                    </select>
                    <select
                      className="aff-input"
                      style={{ width: 'auto' }}
                      value={commStatusFilter}
                      onChange={e => {
                        setCommStatusFilter(e.target.value);
                        setCommPage(1);
                      }}
                    >
                      <option value="all">All Status</option>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="reversed">Reversed</option>
                    </select>
                  </div>
                )}
              </div>

              {reportSubTab === 'ledger' && (
                <>
                  <div className="aff-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Affiliate</th>
                          <th>Type</th>
                          <th>Rule</th>
                          <th>Player</th>
                          <th>Base</th>
                          <th>Commission</th>
                          <th>Status</th>
                          <th>Date</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {commissions.length === 0 ? (
                          <tr>
                            <td colSpan={9} style={{ textAlign: 'center', padding: '22px', color: '#707070' }}>
                              No commission records match the selected date range and filters.
                            </td>
                          </tr>
                        ) : (
                          commissions.map(c => (
                            <tr key={c.id}>
                              <td>
                                <b>{c.affiliate_name}</b>
                                <div style={{ fontSize: '11.5px', color: '#707070' }}>{c.affiliate_code}</div>
                              </td>
                              <td><span className="aff-chip">{c.commission_type}</span></td>
                              <td style={{ fontSize: '12px' }}>
                                v{c.rule_version} ({c.calc_mode === 'percent' ? `${c.rate_applied}%` : `ETB ${c.rate_applied}`})
                              </td>
                              <td style={{ fontSize: '12.5px' }}>{c.player_name || '—'}</td>
                              <td>ETB {fmtETB(c.base_amount)}</td>
                              <td><b>ETB {fmtETB(c.amount)}</b></td>
                              <td>
                                <span
                                  className={`aff-chip ${
                                    c.status === 'approved' ? 'green' : c.status === 'reversed' || c.status === 'rejected' ? 'red' : 'amber'
                                  }`}
                                >
                                  {String(c.status).toUpperCase()}
                                </span>
                              </td>
                              <td style={{ fontSize: '11.5px', color: '#707070' }}>{fmtDate(c.created_at)}</td>
                              <td>
                                <div style={{ display: 'flex', gap: '5px' }}>
                                  {c.status === 'pending' && (
                                    <>
                                      <button
                                        type="button"
                                        className="aff-btn-dark"
                                        style={{ padding: '4px 8px', fontSize: '11.5px' }}
                                        onClick={() => apiClient.admin.affiliates.approveCommission(c.id).then(loadData)}
                                      >
                                        Approve
                                      </button>
                                      <button
                                        type="button"
                                        className="aff-btn-ghost"
                                        style={{ padding: '4px 8px', fontSize: '11.5px' }}
                                        onClick={() => {
                                          const r = window.prompt('Rejection reason:') || 'Declined';
                                          apiClient.admin.affiliates.rejectCommission(c.id, r).then(loadData);
                                        }}
                                      >
                                        Reject
                                      </button>
                                    </>
                                  )}
                                  {(c.status === 'pending' || c.status === 'approved') && (
                                    <button
                                      type="button"
                                      className="aff-btn-ghost"
                                      style={{ padding: '4px 8px', fontSize: '11.5px', color: '#b0302f' }}
                                      onClick={() => {
                                        const r = window.prompt('Reversal reason (required):');
                                        if (!r) return;
                                        apiClient.admin.affiliates
                                          .reverseCommission(c.id, r)
                                          .then(() => {
                                            showToast('✅ Commission reversed cleanly');
                                            loadData();
                                          })
                                          .catch(err => showToast(`❌ ${err?.message || 'Reversal failed'}`));
                                      }}
                                    >
                                      Reverse
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="aff-pagination">
                    <span>
                      Page <b>{commPage}</b> of <b>{commTotalPages}</b> · {fmtInt(commTotalCount)} total records
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        className="aff-btn-ghost"
                        disabled={commPage <= 1}
                        onClick={() => setCommPage(p => Math.max(1, p - 1))}
                      >
                        ← Previous
                      </button>
                      <button
                        type="button"
                        className="aff-btn-ghost"
                        disabled={commPage >= commTotalPages}
                        onClick={() => setCommPage(p => Math.min(commTotalPages, p + 1))}
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                </>
              )}

              {reportSubTab === 'leaderboard' && (
                <div className="aff-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Affiliate</th>
                        <th>New Players</th>
                        <th>Total / Active (14d)</th>
                        <th>Target Progress</th>
                        <th>Period Deposits</th>
                        <th>Commissions Earned</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ textAlign: 'center', padding: '22px', color: '#707070' }}>
                            No approved affiliates found in this period.
                          </td>
                        </tr>
                      ) : (
                        leaderboard.map((row, idx) => {
                          const targetPct = Math.min(100, Math.round((row.newPlayers / Math.max(1, row.monthlyTarget)) * 100));
                          return (
                            <tr key={row.id}>
                              <td><b>#{idx + 1}</b></td>
                              <td>
                                <b>{row.fullName}</b>
                                <div style={{ fontSize: '11.5px', color: '#707070' }}>
                                  {row.affiliateCode} · <span className={`aff-chip ${row.status === 'active' ? 'green' : 'amber'}`}>{row.status.toUpperCase()}</span>
                                </div>
                              </td>
                              <td><b>{fmtInt(row.newPlayers)}</b></td>
                              <td>
                                {fmtInt(row.totalPlayers)} / <span style={{ color: '#16a34a', fontWeight: 700 }}>{fmtInt(row.activePlayers)}</span>
                              </td>
                              <td>
                                <div style={{ fontSize: '12px', fontWeight: 700 }}>
                                  {fmtInt(row.newPlayers)} / {fmtInt(row.monthlyTarget)} ({targetPct}%)
                                </div>
                                <div className="aff-mini-progress">
                                  <div className="aff-mini-progress-fill" style={{ width: `${targetPct}%` }} />
                                </div>
                              </td>
                              <td><b>ETB {fmtETB(row.deposits)}</b></td>
                              <td>
                                <b style={{ color: '#15803d' }}>ETB {fmtETB(row.commissionsEarned)}</b>
                                {row.pendingCommissions > 0 && (
                                  <div style={{ fontSize: '11px', color: '#b45309' }}>+ETB {fmtETB(row.pendingCommissions)} pending</div>
                                )}
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="aff-btn-ghost"
                                  style={{ padding: '4px 10px', fontSize: '12px' }}
                                  onClick={() => {
                                    setReportAffiliateId(row.id);
                                    setReportSubTab('ledger');
                                    setCommPage(1);
                                  }}
                                >
                                  Inspect
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {reportSubTab === 'withdrawals' && (
                <>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
                    <span className="aff-chip green">Paid: ETB {fmtETB(repKpis.paidWithdrawals)}</span>
                    <span className="aff-chip blue">Approved (Queued): ETB {fmtETB(repKpis.approvedWithdrawals)}</span>
                    <span className="aff-chip amber">Pending: ETB {fmtETB(repKpis.pendingWithdrawals)}</span>
                    <span className="aff-chip red">Rejected: ETB {fmtETB(repKpis.rejectedWithdrawals)}</span>
                  </div>

                  <div className="aff-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Affiliate</th>
                          <th>Method &amp; Account</th>
                          <th>Amount</th>
                          <th>Status</th>
                          <th>Payment Ref</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {periodWithdrawals.length === 0 ? (
                          <tr>
                            <td colSpan={6} style={{ textAlign: 'center', padding: '22px', color: '#707070' }}>
                              No affiliate withdrawals in this date range.
                            </td>
                          </tr>
                        ) : (
                          periodWithdrawals.map(w => (
                            <tr key={w.id}>
                              <td>
                                <b>{w.affiliate_name}</b>
                                <div style={{ fontSize: '11.5px', color: '#707070' }}>{w.affiliate_code} · {w.affiliate_phone}</div>
                              </td>
                              <td>
                                <b>{w.payout_method}</b>
                                <div style={{ fontSize: '11.5px', color: '#707070' }}>{w.payout_account}</div>
                              </td>
                              <td><b>ETB {fmtETB(w.amount)}</b></td>
                              <td>
                                <span
                                  className={`aff-chip ${
                                    w.status === 'paid' ? 'green' : w.status === 'rejected' ? 'red' : w.status === 'approved' ? 'blue' : 'amber'
                                  }`}
                                >
                                  {String(w.status).toUpperCase()}
                                </span>
                              </td>
                              <td style={{ fontSize: '12px' }}>{w.payment_reference || w.rejection_reason || '—'}</td>
                              <td style={{ fontSize: '11.5px', color: '#707070' }}>{fmtDate(w.created_at)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </>
        );
      })()}

      {/* =================================================================
          MODALS
          ================================================================= */}
      {showCreateModal && (
        <div className="aff-modal-overlay" onClick={() => setShowCreateModal(false)}>
          <form className="aff-modal" onClick={e => e.stopPropagation()} onSubmit={handleCreateAffiliate}>
            <div className="aff-modal-head">
              <h3>Register Affiliate Manually</h3>
              <button type="button" className="aff-btn-ghost" onClick={() => setShowCreateModal(false)}>✕</button>
            </div>
            <div className="aff-field">
              <label>Full Name</label>
              <input className="aff-input" required value={createForm.fullName} onChange={e => setCreateForm(f => ({ ...f, fullName: e.target.value }))} />
            </div>
            <div className="aff-field">
              <label>Phone Number</label>
              <input className="aff-input" required placeholder="0911223344" value={createForm.phone} onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="aff-field">
              <label>Portal Password / PIN</label>
              <input className="aff-input" placeholder="Default: 1234" value={createForm.password} onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))} />
            </div>
            <div className="aff-grid aff-g2-eq">
              <div className="aff-field">
                <label>Payout Method</label>
                <select className="aff-input" value={createForm.payoutMethod} onChange={e => setCreateForm(f => ({ ...f, payoutMethod: e.target.value }))}>
                  <option value="Telebirr">Telebirr</option>
                  <option value="M-Pesa">Safaricom M-Pesa</option>
                  <option value="CBE">CBE</option>
                </select>
              </div>
              <div className="aff-field">
                <label>Monthly Target (Players)</label>
                <input type="number" className="aff-input" placeholder="Default 50" value={createForm.monthlyTargetOverride} onChange={e => setCreateForm(f => ({ ...f, monthlyTargetOverride: e.target.value }))} />
              </div>
            </div>
            <div className="aff-field">
              <label>Payout Account Number</label>
              <input className="aff-input" placeholder="Defaults to phone" value={createForm.payoutAccount} onChange={e => setCreateForm(f => ({ ...f, payoutAccount: e.target.value }))} />
            </div>
            <button type="submit" className="aff-btn-dark" style={{ width: '100%', justifyContent: 'center' }} disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Affiliate Account'}
            </button>
          </form>
        </div>
      )}

      {editingAffiliate && (
        <div className="aff-modal-overlay" onClick={() => setEditingAffiliate(null)}>
          <form className="aff-modal" onClick={e => e.stopPropagation()} onSubmit={handleSaveEditAffiliate}>
            <div className="aff-modal-head">
              <h3>Edit {editingAffiliate.affiliateCode}</h3>
              <button type="button" className="aff-btn-ghost" onClick={() => setEditingAffiliate(null)}>✕</button>
            </div>
            <div className="aff-field">
              <label>Full Name</label>
              <input className="aff-input" required value={editingAffiliate.fullName} onChange={e => setEditingAffiliate((p: any) => ({ ...p, fullName: e.target.value }))} />
            </div>
            <div className="aff-field">
              <label>Phone</label>
              <input className="aff-input" required value={editingAffiliate.phone} onChange={e => setEditingAffiliate((p: any) => ({ ...p, phone: e.target.value }))} />
            </div>
            <div className="aff-grid aff-g2-eq">
              <div className="aff-field">
                <label>Payout Method</label>
                <select className="aff-input" value={editingAffiliate.payoutMethod || 'Telebirr'} onChange={e => setEditingAffiliate((p: any) => ({ ...p, payoutMethod: e.target.value }))}>
                  <option value="Telebirr">Telebirr</option>
                  <option value="M-Pesa">M-Pesa</option>
                  <option value="CBE">CBE</option>
                </select>
              </div>
              <div className="aff-field">
                <label>Monthly Target</label>
                <input type="number" className="aff-input" value={editingAffiliate.monthlyTargetOverride ?? ''} placeholder="Default 50" onChange={e => setEditingAffiliate((p: any) => ({ ...p, monthlyTargetOverride: e.target.value }))} />
              </div>
            </div>
            <div className="aff-field">
              <label>Payout Account</label>
              <input className="aff-input" value={editingAffiliate.payoutAccount || ''} onChange={e => setEditingAffiliate((p: any) => ({ ...p, payoutAccount: e.target.value }))} />
            </div>
            <button type="submit" className="aff-btn-dark" style={{ width: '100%', justifyContent: 'center' }} disabled={isSubmitting}>
              Save Changes
            </button>
          </form>
        </div>
      )}

      {walletModalAff && (
        <div className="aff-modal-overlay" onClick={() => setWalletModalAff(null)}>
          <form className="aff-modal" onClick={e => e.stopPropagation()} onSubmit={handleWalletAdjustSubmit}>
            <div className="aff-modal-head">
              <h3>Wallet · {walletModalAff.affiliateCode}</h3>
              <button type="button" className="aff-btn-ghost" onClick={() => setWalletModalAff(null)}>✕</button>
            </div>
            <div className="aff-field">
              <label>Action Type</label>
              <select className="aff-input" value={walletAdjustForm.mode} onChange={e => setWalletAdjustForm(f => ({ ...f, mode: e.target.value as any }))}>
                <option value="recharge">Recharge Wallet (+)</option>
                <option value="credit">Manual Commission Credit (+)</option>
                <option value="debit">Manual Deduction (-)</option>
              </select>
            </div>
            <div className="aff-field">
              <label>Amount (ETB)</label>
              <input type="number" min="1" step="0.01" className="aff-input" required value={walletAdjustForm.amount} onChange={e => setWalletAdjustForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div className="aff-field">
              <label>Reason (Required for Audit Log)</label>
              <input type="text" className="aff-input" required placeholder="e.g. Monthly bonus adjustment" value={walletAdjustForm.reason} onChange={e => setWalletAdjustForm(f => ({ ...f, reason: e.target.value }))} />
            </div>
            <button type="submit" className="aff-btn-dark" style={{ width: '100%', justifyContent: 'center' }} disabled={isSubmitting}>
              Apply Wallet Adjustment
            </button>
          </form>
        </div>
      )}

      {showLinkModal && (
        <div className="aff-modal-overlay" onClick={() => setShowLinkModal(false)}>
          <form className="aff-modal" onClick={e => e.stopPropagation()} onSubmit={handleCreateLink}>
            <div className="aff-modal-head">
              <h3>Generate Registration Link</h3>
              <button type="button" className="aff-btn-ghost" onClick={() => setShowLinkModal(false)}>✕</button>
            </div>
            <div className="aff-field">
              <label>Campaign / Partner Label</label>
              <input className="aff-input" value={linkForm.label} onChange={e => setLinkForm(f => ({ ...f, label: e.target.value }))} />
            </div>
            <div className="aff-field">
              <label>Max Uses (Leave blank for unlimited)</label>
              <input type="number" min="1" className="aff-input" value={linkForm.maxUses} onChange={e => setLinkForm(f => ({ ...f, maxUses: e.target.value }))} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', fontWeight: 600, marginBottom: '14px' }}>
              <input type="checkbox" checked={linkForm.requiresApproval} onChange={e => setLinkForm(f => ({ ...f, requiresApproval: e.target.checked }))} />
              Require Admin approval before affiliate login
            </label>
            <button type="submit" className="aff-btn-dark" style={{ width: '100%', justifyContent: 'center' }} disabled={isSubmitting}>
              Create Invite Link
            </button>
          </form>
        </div>
      )}

      {editingRule && (
        <div className="aff-modal-overlay" onClick={() => setEditingRule(null)}>
          <form className="aff-modal" onClick={e => e.stopPropagation()} onSubmit={handleSaveRule}>
            <div className="aff-modal-head">
              <h3>Configure · {editingRule.display_name}</h3>
              <button type="button" className="aff-btn-ghost" onClick={() => setEditingRule(null)}>✕</button>
            </div>
            <div className="aff-grid aff-g2-eq">
              <div className="aff-field">
                <label>Calculation Mode</label>
                <select className="aff-input" value={ruleForm.calcMode} onChange={e => setRuleForm(f => ({ ...f, calcMode: e.target.value }))}>
                  <option value="percent">Percentage (%)</option>
                  <option value="fixed">Fixed Amount (ETB)</option>
                </select>
              </div>
              <div className="aff-field">
                <label>{ruleForm.calcMode === 'percent' ? 'Rate (%)' : 'Amount (ETB)'}</label>
                <input type="number" step="0.01" min="0" className="aff-input" value={ruleForm.rateOrAmount} onChange={e => setRuleForm(f => ({ ...f, rateOrAmount: e.target.value }))} />
              </div>
            </div>
            <div className="aff-grid aff-g3">
              <div className="aff-field">
                <label>Min Deposit</label>
                <input type="number" step="1" min="0" className="aff-input" value={ruleForm.minQualifyingDeposit} onChange={e => setRuleForm(f => ({ ...f, minQualifyingDeposit: e.target.value }))} />
              </div>
              <div className="aff-field">
                <label>Min Players/mo</label>
                <input type="number" step="1" min="0" className="aff-input" value={ruleForm.minMonthlyPlayers} onChange={e => setRuleForm(f => ({ ...f, minMonthlyPlayers: e.target.value }))} />
              </div>
              <div className="aff-field">
                <label>Active Window (d)</label>
                <input type="number" step="1" min="1" className="aff-input" value={ruleForm.activeWindowDays} onChange={e => setRuleForm(f => ({ ...f, activeWindowDays: e.target.value }))} />
              </div>
            </div>
            <div className="aff-field">
              <label>Description</label>
              <input className="aff-input" value={ruleForm.description} onChange={e => setRuleForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: '16px', marginBottom: '14px', fontSize: '13.5px', fontWeight: 600 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input type="checkbox" checked={ruleForm.autoApprove} onChange={e => setRuleForm(f => ({ ...f, autoApprove: e.target.checked }))} />
                Auto-Approve Earnings
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input type="checkbox" checked={ruleForm.isActive} onChange={e => setRuleForm(f => ({ ...f, isActive: e.target.checked }))} />
                Active
              </label>
            </div>
            <button type="submit" className="aff-btn-dark" style={{ width: '100%', justifyContent: 'center' }} disabled={isSubmitting}>
              Save Rule (v{Number(editingRule.version || 1) + 1})
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
