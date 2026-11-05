import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { useAdmin } from '../../context/AdminContext.tsx';
import { apiClient } from '../../services/apiClient.ts';
import { socketService } from '../../services/socketService.ts';
import { generateAgentPayoutsPDFReport } from '../../utils/pdfReportGenerator.ts';

interface PayoutRequestItem {
  id: string;
  code: string;
  agentId: string;
  agentName: string;
  agentCode: string;
  agentCity: string;
  agentPhone: string;
  agentStatus: string;
  amount: number;
  payoutMethod: string;
  payoutAccount: string;
  accountName: string;
  status: 'Requested' | 'Under review' | 'Awaiting 2nd approval' | 'Paid' | 'Rejected';
  adminNotes?: string | null;
  rejectionReason?: string | null;
  payoutTxRef?: string;
  commissionLeftAfterHold: number;
  createdAt: string;
  relativeTime: string;
  timeline: Array<[string, string]>;
  checklist: { o1?: boolean };
}

interface HistoryItem {
  id: string;
  dbId: string;
  aid: string;
  agentName: string;
  agentCode: string;
  type: string;
  destination: string;
  amount: number;
  reference: string;
  status: string;
  by: string;
  isoDate: string;
  dateFormatted: string;
  timestamp: number;
}

interface CommissionBalanceItem {
  id: string;
  code: string;
  name: string;
  phone: string;
  city: string;
  status: string;
  available: number;
  held: number;
  paidOut: number;
  toFloat: number;
  totalEarned: number;
}

export const AgentPayoutsDesk: React.FC = () => {
  const { showToast } = useApp();
  const { isSidebarCollapsed, toggleSidebar } = useAdmin();

  // Top KPIs
  const [kpis, setKpis] = useState({
    pendingPayouts: { count: 0, heldAmount: 0 },
    paidThisMonth: { count: 0, totalAmount: 0 },
    convertedToFloat: { count: 0, totalAmount: 0 },
    commissionOwed: { totalOwed: 0, available: 0, held: 0 }
  });

  // 4-Step Flow
  const [flow, setFlow] = useState({
    step1: 0,
    step2: 0,
    step3: 0,
    step4: 0
  });

  // Tabs: 'req' | 'hist' | 'bal'
  const [activeTab, setActiveTab] = useState<'req' | 'hist' | 'bal'>('req');

  // Tab 1: Requests
  const [requestsFilter, setRequestsFilter] = useState<'Open' | 'Paid' | 'Rejected' | 'All'>('Open');
  const [requests, setRequests] = useState<PayoutRequestItem[]>([]);
  const [selectedReqId, setSelectedReqId] = useState<string | null>(null);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);
  const [payoutTxRefInput, setPayoutTxRefInput] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [rejectModalReqId, setRejectModalReqId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('Account name mismatch');
  const [rejectNote, setRejectNote] = useState('');

  // Tab 2: History
  const [historyPeriod, setHistoryPeriod] = useState<'today' | 'week' | 'month' | 'all' | 'custom'>('all');
  const [historyFrom, setHistoryFrom] = useState('');
  const [historyTo, setHistoryTo] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [historyAgentFilter, setHistoryAgentFilter] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'All' | 'Paid' | 'Converted' | 'Rejected'>('All');
  const [historyRows, setHistoryRows] = useState<HistoryItem[]>([]);
  const [historyStats, setHistoryStats] = useState({
    totalPaid: 0,
    paidCount: 0,
    totalConverted: 0,
    convertedCount: 0,
    totalRejected: 0,
    rejectedCount: 0,
    averagePayout: 0
  });
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Tab 3: Commission Balances
  const [balances, setBalances] = useState<CommissionBalanceItem[]>([]);
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);

  // Helper number formatter
  const formatNumber = (num: number) => Number(num || 0).toLocaleString('en-US');

  // ====================================================
  // 1. DATA LOADERS
  // ====================================================
  const loadKPIs = useCallback(async () => {
    try {
      const data = await apiClient.admin.getAgentPayoutKPIs();
      if (data && data.success && data.kpis) {
        setKpis(data.kpis);
      }
    } catch (e) {
      console.warn('Failed to load payout KPIs:', e);
    }
  }, []);

  const loadFlow = useCallback(async () => {
    try {
      const data = await apiClient.admin.getAgentPayoutFlow();
      if (data && data.success && data.flow) {
        setFlow(data.flow);
      }
    } catch (e) {
      console.warn('Failed to load payout workflow counts:', e);
    }
  }, []);

  const loadRequests = useCallback(async (filterOverride?: 'Open' | 'Paid' | 'Rejected' | 'All') => {
    try {
      setIsLoadingRequests(true);
      const f = filterOverride || requestsFilter;
      const data = await apiClient.admin.getAgentPayoutRequests(f);
      if (data && data.success) {
        const reqs = data.requests || [];
        setRequests(reqs);

        // Auto-select first request or keep existing selection
        if (reqs.length > 0) {
          setSelectedReqId(prev => (prev && reqs.some((r: any) => r.id === prev) ? prev : reqs[0].id));
        } else {
          setSelectedReqId(null);
        }
      }
    } catch (e) {
      console.warn('Failed to load payout requests:', e);
    } finally {
      setIsLoadingRequests(false);
    }
  }, [requestsFilter]);

  const loadHistory = useCallback(async (overrides?: {
    period?: 'today' | 'week' | 'month' | 'all' | 'custom';
    from?: string;
    to?: string;
    search?: string;
    agent?: string;
    status?: string;
  }) => {
    const p = overrides?.period !== undefined ? overrides.period : historyPeriod;
    const f = overrides?.from !== undefined ? overrides.from : historyFrom;
    const t = overrides?.to !== undefined ? overrides.to : historyTo;
    const s = overrides?.search !== undefined ? overrides.search : historySearch;
    const a = overrides?.agent !== undefined ? overrides.agent : historyAgentFilter;
    const st = overrides?.status !== undefined ? overrides.status : historyStatusFilter;

    try {
      setIsLoadingHistory(true);
      const data = await apiClient.admin.getAgentPayoutHistory({
        period: p,
        from: f,
        to: t,
        search: s,
        agent: a,
        status: st
      });
      if (data && data.success) {
        setHistoryRows(data.rows || []);
        if (data.stats) setHistoryStats(data.stats);
      }
    } catch (e) {
      console.warn('Failed to load payout history:', e);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [historyPeriod, historyFrom, historyTo, historySearch, historyAgentFilter, historyStatusFilter]);

  const loadBalances = useCallback(async () => {
    try {
      setIsLoadingBalances(true);
      const data = await apiClient.admin.getAgentCommissionBalances();
      if (data && data.success) {
        setBalances(data.agents || []);
      }
    } catch (e) {
      console.warn('Failed to load commission balances:', e);
    } finally {
      setIsLoadingBalances(false);
    }
  }, []);

  // Initial load & real-time WebSocket listeners
  useEffect(() => {
    loadKPIs();
    loadFlow();
    loadRequests();
    loadBalances();

    const refreshAll = () => {
      loadKPIs();
      loadFlow();
      loadRequests();
      loadBalances();
      if (activeTab === 'hist') loadHistory();
    };

    const unsubUpdate = socketService.on('admin_agent_payout_update', refreshAll);
    const unsubStatus = socketService.on('agent_payout_status_updated', refreshAll);
    const unsubRecharge = socketService.on('admin_agent_recharge_new', refreshAll);
    const unsubWallet = socketService.on('agent_wallet_updated', refreshAll);

    return () => {
      unsubUpdate();
      unsubStatus();
      unsubRecharge();
      unsubWallet();
    };
  }, [loadKPIs, loadFlow, loadRequests, loadBalances, loadHistory, activeTab]);

  // Tab switch
  const handleTabChange = (tab: 'req' | 'hist' | 'bal') => {
    setActiveTab(tab);
    if (tab === 'hist') loadHistory();
    if (tab === 'bal') loadBalances();
  };

  // Selected request reference
  const selectedReq = requests.find(r => r.id === selectedReqId) || null;

  // Sync ref input when selection changes
  useEffect(() => {
    if (selectedReq) {
      setPayoutTxRefInput(selectedReq.payoutTxRef || '');
    }
  }, [selectedReqId, selectedReq]);

  // ====================================================
  // 2. ACTION HANDLERS (REQUESTS TAB)
  // ====================================================
  const handleStartReview = async (reqItem: PayoutRequestItem) => {
    try {
      setIsSubmittingAction(true);
      const res = await apiClient.admin.startAgentPayoutReview(reqItem.id);
      if (res && res.success) {
        showToast(`✓ Review started for payout ${reqItem.code}`);
        loadKPIs();
        loadFlow();
        loadRequests();
      } else {
        showToast('❌ Failed to start review');
      }
    } catch (err: any) {
      showToast(`❌ Error: ${err.message || 'Failed to start review'}`);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleChecklistToggle = async (key: 'o1') => {
    if (!selectedReq) return;
    const current = Boolean(selectedReq.checklist?.[key]);
    const updatedChecklist = { ...selectedReq.checklist, [key]: !current };

    // Optimistic UI update
    setRequests(prev => prev.map(r => r.id === selectedReq.id ? { ...r, checklist: updatedChecklist } : r));

    try {
      await apiClient.admin.updateAgentPayoutChecklist(selectedReq.id, updatedChecklist);
    } catch (e) {
      console.warn('Failed to update checklist:', e);
    }
  };

  const handleApprove = async (reqItem: PayoutRequestItem) => {
    const isAbove20k = reqItem.amount > 20000;
    const isFirstStep = reqItem.status === 'Under review';

    if (!isAbove20k || !isFirstStep) {
      if (!payoutTxRefInput.trim()) {
        showToast('⚠️ Please enter the payout transaction ID from Telebirr / CBE.');
        return;
      }
    }

    try {
      setIsSubmittingAction(true);
      const res = await apiClient.admin.approveAgentPayoutEnqu(
        reqItem.id,
        payoutTxRefInput.trim(),
        'Approved by Super Admin'
      );

      if (res && res.success) {
        showToast(res.message || '✓ Payout recorded successfully!');
        loadKPIs();
        loadFlow();
        loadRequests();
      } else {
        showToast('❌ Failed to approve payout');
      }
    } catch (err: any) {
      showToast(`❌ ${err.message || 'Approval failed'}`);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleSecondApprove = async (reqItem: PayoutRequestItem) => {
    if (!payoutTxRefInput.trim()) {
      showToast('⚠️ Please enter the payout transaction ID from Telebirr / CBE.');
      return;
    }

    try {
      setIsSubmittingAction(true);
      const res = await apiClient.admin.secondApproveAgentPayout(
        reqItem.id,
        payoutTxRefInput.trim(),
        'Second approval granted'
      );

      if (res && res.success) {
        showToast(res.message || '✓ Second approval recorded and marked paid!');
        loadKPIs();
        loadFlow();
        loadRequests();
      } else {
        showToast('❌ Failed to second approve payout');
      }
    } catch (err: any) {
      showToast(`❌ ${err.message || 'Second approval failed'}`);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleRejectAndRefund = async () => {
    if (!rejectModalReqId) return;
    try {
      setIsSubmittingAction(true);
      const res = await apiClient.admin.rejectAgentPayoutEnqu(
        rejectModalReqId,
        rejectReason,
        rejectNote.trim() || undefined
      );

      if (res && res.success) {
        showToast(res.message || '❌ Payout rejected and commission refunded to agent.');
        setRejectModalReqId(null);
        setRejectNote('');
        loadKPIs();
        loadFlow();
        loadRequests();
        loadBalances();
      } else {
        showToast('❌ Failed to reject payout');
      }
    } catch (err: any) {
      showToast(`❌ ${err.message || 'Failed to reject payout'}`);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // ====================================================
  // 3. HISTORY TAB ACTIONS (FILTERS, CSV, PDF)
  // ====================================================
  const handlePeriodChange = (p: 'all' | 'today' | 'week' | 'month') => {
    setHistoryPeriod(p);
    setHistoryFrom('');
    setHistoryTo('');
    loadHistory({ period: p, from: '', to: '' });
  };

  const handleCustomDateFetch = () => {
    if (!historyFrom && !historyTo) {
      showToast('⚠️ Please select a start or end date to fetch.');
      return;
    }
    if (historyFrom && historyTo && historyFrom > historyTo) {
      showToast('⚠️ Start date must be before or equal to end date.');
      return;
    }
    setHistoryPeriod('custom');
    loadHistory({ period: 'custom', from: historyFrom, to: historyTo });
  };

  const handleExportCSV = () => {
    if (historyRows.length === 0) {
      showToast('⚠️ No history records to export.');
      return;
    }
    const headers = ['Date', 'ID', 'Agent Name', 'Agent Code', 'Type', 'Destination', 'Amount (ETB)', 'Reference', 'Status', 'Authorized By'];
    const csvRows = [
      headers.join(','),
      ...historyRows.map(r => [
        `"${r.dateFormatted}"`,
        `"${r.id}"`,
        `"${r.agentName}"`,
        `"${r.agentCode}"`,
        `"${r.type}"`,
        `"${r.destination}"`,
        r.amount,
        `"${r.reference}"`,
        `"${r.status}"`,
        `"${r.by}"`
      ].join(','))
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agent-payouts-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exporting payouts history as CSV');
  };

  const handleDownloadPDFReport = () => {
    if (historyRows.length === 0) {
      showToast('⚠️ No history records to export for this period.');
      return;
    }
    let periodLabel = 'All Time';
    if (historyPeriod === 'today') {
      periodLabel = `Daily (${new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })})`;
    } else if (historyPeriod === 'week') {
      periodLabel = 'Weekly (Last 7 Days)';
    } else if (historyPeriod === 'month') {
      periodLabel = `Monthly (${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })})`;
    } else if (historyPeriod === 'custom') {
      periodLabel = `Custom (${historyFrom || 'Start'} to ${historyTo || 'End'})`;
    }

    try {
      generateAgentPayoutsPDFReport({
        periodLabel,
        stats: historyStats,
        rows: historyRows,
        generatedBy: 'Super Admin',
        agentFilter: historyAgentFilter || undefined
      });
      showToast('📄 Downloaded official Agent Payouts PDF audit report!');
    } catch (err: any) {
      console.error('Failed to generate payouts PDF report:', err);
      showToast('❌ Failed to generate PDF report.');
    }
  };

  // Conditions for inspection panel
  const isPendingReview = selectedReq && ['Requested', 'Under review', 'Awaiting 2nd approval'].includes(selectedReq.status);
  const isAgentActive = selectedReq?.agentStatus === 'active';
  const isAmountValid = Boolean(selectedReq && selectedReq.amount >= 500);
  const isChecklistPassed = Boolean(selectedReq?.checklist?.o1);
  const isLargePayout = Boolean(selectedReq && selectedReq.amount > 20000);

  const canApproveUnderReview = Boolean(
    selectedReq?.status === 'Under review' &&
    isAgentActive &&
    isAmountValid &&
    isChecklistPassed &&
    (isLargePayout || payoutTxRefInput.trim().length > 0)
  );

  const canSecondApprove = Boolean(
    selectedReq?.status === 'Awaiting 2nd approval' &&
    payoutTxRefInput.trim().length > 0
  );

  return (
    <div className="enqu-payouts-desk" style={{
      width: '100%',
      minHeight: '100vh',
      flex: 1,
      padding: '22px 24px',
      background: 'var(--panel, #e8e6e9)',
      boxSizing: 'border-box',
      overflowY: 'auto',
      fontFamily: 'Urbanist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: 'var(--ink, #1b1b1b)'
    }}>
      <style>{`
        .enqu-payouts-desk {
          --bg: #fff;
          --side: #fff;
          --panel: #e8e6e9;
          --card: #fff;
          --ink: #1b1b1b;
          --mute: #707070;
          --line: #d9d9db;
          --chip: #e9e9ea;
          --dark: #1f2220;
          --grey: #858585;
          --g: #2e9e4f;
          --r: #b0302f;
        }
        .enqu-payouts-desk .grid { display: grid; gap: 15px; margin-bottom: 15px; }
        .enqu-payouts-desk .g4 { grid-template-columns: repeat(4, 1fr); }
        .enqu-payouts-desk .g2 { grid-template-columns: 1.6fr 1fr; }
        .enqu-payouts-desk .two { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .enqu-payouts-desk .card { background: var(--card); border-radius: 20px; padding: 16px 18px; min-width: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
        .enqu-payouts-desk .card.d { background: linear-gradient(135deg, #1c1e1d, #2a2d2b 55%, #1a1c1b); color: #fff; }
        .enqu-payouts-desk .card h3 { font-size: 16.5px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
        .enqu-payouts-desk .card h3 .r { margin-left: auto; }
        .enqu-payouts-desk .lab { font-size: 13.5px; color: var(--mute); font-weight: 500; }
        .enqu-payouts-desk .card.d .lab { color: #e5e5e5; }
        .enqu-payouts-desk .val { font-size: 24px; font-weight: 700; margin: 6px 0; }
        .enqu-payouts-desk .tr { font-size: 12.5px; color: var(--mute); font-weight: 500; }
        .enqu-payouts-desk .up { color: var(--g); }
        .enqu-payouts-desk .dn { color: var(--r); }
        .enqu-payouts-desk .note { background: var(--card); border-radius: 16px; padding: 13px 18px; font-size: 13.5px; color: var(--mute); margin-bottom: 15px; box-shadow: inset 3px 0 0 var(--dark); line-height: 1.45; }
        .enqu-payouts-desk .flow { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .enqu-payouts-desk .fs { display: flex; gap: 10px; align-items: center; background: var(--panel); border-radius: 16px; padding: 12px 14px; }
        .enqu-payouts-desk .fs b { font-size: 14px; }
        .enqu-payouts-desk .fn { width: 26px; height: 26px; border-radius: 50%; background: var(--dark); color: #fff; display: grid; place-items: center; font-weight: 700; font-size: 13px; flex: none; }
        .enqu-payouts-desk .fc { margin-left: auto; font-size: 21px; font-weight: 700; }
        .enqu-payouts-desk .tabs { display: flex; gap: 8px; overflow-x: auto; margin-bottom: 15px; padding-bottom: 2px; }
        .enqu-payouts-desk .tabs button { background: var(--card); padding: 8px 16px; font-size: 14px; border-radius: 20px; white-space: nowrap; color: var(--ink); font-weight: 600; border: 0; cursor: pointer; transition: all 0.15s ease; }
        .enqu-payouts-desk .tabs button.on { background: var(--dark); color: #fff; }
        .enqu-payouts-desk table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .enqu-payouts-desk th { text-align: left; color: var(--mute); font-weight: 600; font-size: 13.5px; padding: 10px 8px; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
        .enqu-payouts-desk td { padding: 11px 8px; font-weight: 600; border-bottom: 1px solid var(--line); white-space: nowrap; }
        .enqu-payouts-desk tr:last-child td { border-bottom: 0; }
        .enqu-payouts-desk tr.sel td { background: var(--chip); }
        .enqu-payouts-desk .wrap { overflow-x: auto; }
        .enqu-payouts-desk .b { display: inline-block; padding: 4px 11px; border-radius: 14px; background: var(--grey); color: #fff; font-size: 12px; font-weight: 600; }
        .enqu-payouts-desk .b.o { background: transparent; color: var(--mute); box-shadow: inset 0 0 0 1px var(--line); }
        .enqu-payouts-desk .b.k { background: var(--dark); color: #fff; }
        .enqu-payouts-desk .b.w { background: var(--r); color: #fff; }
        .enqu-payouts-desk button, .enqu-payouts-desk .btn { font: inherit; font-size: 13px; font-weight: 600; border: 0; border-radius: 14px; padding: 6px 14px; background: var(--chip); color: var(--ink); cursor: pointer; transition: opacity 0.15s; }
        .enqu-payouts-desk button:hover { opacity: 0.88; }
        .enqu-payouts-desk button.k { background: var(--dark); color: #fff; }
        .enqu-payouts-desk button.p { background: var(--grey); color: #fff; }
        .enqu-payouts-desk button:disabled { opacity: 0.38; cursor: not-allowed; }
        .enqu-payouts-desk .lk { background: none; padding: 0; font-size: 14px; font-weight: 700; text-align: left; border-radius: 0; color: var(--ink); border: none; cursor: pointer; }
        .enqu-payouts-desk .lk:hover { text-decoration: underline; }
        .enqu-payouts-desk .row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
        .enqu-payouts-desk .sec { border-top: 1px solid var(--line); margin-top: 16px; padding-top: 4px; }
        .enqu-payouts-desk .sec h4 { font-size: 14px; font-weight: 700; margin: 12px 0 4px; }
        .enqu-payouts-desk .lg { display: flex; justify-content: space-between; font-size: 13.5px; font-weight: 600; padding: 5px 0; }
        .enqu-payouts-desk .lg span { color: var(--mute); }
        .enqu-payouts-desk label { display: block; font-size: 13px; color: var(--mute); font-weight: 500; margin: 10px 0 5px; }
        .enqu-payouts-desk input[type=number], .enqu-payouts-desk input[type=text], .enqu-payouts-desk input[type=date], .enqu-payouts-desk select, .enqu-payouts-desk textarea {
          width: 100%; background: var(--chip); border: 0; border-radius: 12px; padding: 10px 13px; font: inherit; font-weight: 600; color: var(--ink); outline: none; box-sizing: border-box;
        }
        .enqu-payouts-desk textarea { font-weight: 500; resize: vertical; min-height: 85px; line-height: 1.45; }
        .enqu-payouts-desk code { font-family: ui-monospace, Menlo, monospace; font-size: 12.5px; background: var(--chip); padding: 3px 8px; border-radius: 8px; }
        .enqu-payouts-desk .av { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #a8573c, #7d3524); flex: none; }
        .enqu-payouts-desk .av2 { width: 36px; height: 36px; border-radius: 50%; background: var(--chip); display: inline-grid; place-items: center; font-size: 13px; font-weight: 800; flex: none; }
        .enqu-payouts-desk .av2.big { width: 48px; height: 48px; font-size: 16px; }
        .enqu-payouts-desk .modalbg { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: grid; place-items: center; z-index: 1000; padding: 16px; }
        .enqu-payouts-desk .modal { background: var(--card); border-radius: 24px; padding: 24px; width: min(520px, 100%); max-height: 90vh; overflow-y: auto; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
        .enqu-payouts-desk .pillbox { background: var(--card); border-radius: 20px; padding: 7px 14px; font-size: 13.5px; font-weight: 500; color: var(--mute); }
        @media (max-width: 980px) {
          .enqu-payouts-desk .g4 { grid-template-columns: 1fr 1fr; }
          .enqu-payouts-desk .g2 { grid-template-columns: 1fr; }
          .enqu-payouts-desk .flow { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 560px) {
          .enqu-payouts-desk .g4 { grid-template-columns: 1fr; }
          .enqu-payouts-desk .two { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* 1. TOP HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isSidebarCollapsed && (
            <button
              type="button"
              className="btn-chatgpt-toggle"
              onClick={toggleSidebar}
              title="Open sidebar"
              style={{ marginRight: '4px' }}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
            </button>
          )}
          <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.4px', margin: 0 }}>Agent Payouts</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="pillbox">
            {new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          <span className="av" title="Super Admin"></span>
        </div>
      </div>

      {/* 2. INFORMATIONAL NOTE CALLOUT */}
      <div className="note">
        Review and disburse agent commission cashout requests directly to their Telebirr phone or CBE bank account. Rejecting a request automatically refunds the commission to the agent.
      </div>

      {/* 3. 4 TOP KPI CARDS */}
      <div className="grid g4">
        <div className="card d">
          <div className="lab">Pending Payouts</div>
          <div className="val">{kpis.pendingPayouts.count}</div>
          <div className="tr">ETB {formatNumber(kpis.pendingPayouts.heldAmount)} held</div>
        </div>
        <div className="card">
          <div className="lab">Paid This Month</div>
          <div className="val">ETB {formatNumber(kpis.paidThisMonth.totalAmount)}</div>
          <div className="tr">Bank payouts</div>
        </div>
        <div className="card">
          <div className="lab">Converted to Float</div>
          <div className="val">ETB {formatNumber(kpis.convertedToFloat.totalAmount)}</div>
          <div className="tr">This month</div>
        </div>
        <div className="card">
          <div className="lab">Commission Owed</div>
          <div className="val">ETB {formatNumber(kpis.commissionOwed.totalOwed)}</div>
          <div className="tr">Available plus held</div>
        </div>
      </div>

      {/* 4. 4-STEP WORKFLOW PROGRESS BAR */}
      <div className="card" style={{ marginBottom: '15px' }}>
        <div className="flow">
          <div className="fs">
            <span className="fn">1</span>
            <div>
              <b>Request</b>
              <div className="tr">Agent asks to cash out</div>
            </div>
            <span className="fc">{flow.step1}</span>
          </div>
          <div className="fs">
            <span className="fn">2</span>
            <div>
              <b>Review</b>
              <div className="tr">Admin checks the account</div>
            </div>
            <span className="fc">{flow.step2}</span>
          </div>
          <div className="fs">
            <span className="fn">3</span>
            <div>
              <b>Disburse</b>
              <div className="tr">Pay by Telebirr or CBE</div>
            </div>
            <span className="fc">{flow.step3}</span>
          </div>
          <div className="fs">
            <span className="fn">4</span>
            <div>
              <b>Record and notify</b>
              <div className="tr">History entry and alert</div>
            </div>
            <span className="fc">{flow.step4}</span>
          </div>
        </div>
      </div>

      {/* 5. MAIN TABS */}
      <div className="tabs">
        <button
          className={activeTab === 'req' ? 'on' : ''}
          onClick={() => handleTabChange('req')}
        >
          Requests ({kpis.pendingPayouts.count})
        </button>
        <button
          className={activeTab === 'hist' ? 'on' : ''}
          onClick={() => handleTabChange('hist')}
        >
          History
        </button>
        <button
          className={activeTab === 'bal' ? 'on' : ''}
          onClick={() => handleTabChange('bal')}
        >
          Commission Balances
        </button>
      </div>

      {/* ====================================================
          TAB 1: REQUESTS (2-COLUMN GRID)
          ==================================================== */}
      {activeTab === 'req' && (
        <div className="grid g2">
          {/* Left Column: Requests List Card */}
          <div className="card">
            <h3>Cashout Requests</h3>
            <div className="tabs" style={{ marginBottom: '8px' }}>
              {(['Open', 'Paid', 'Rejected', 'All'] as const).map(f => (
                <button
                  key={f}
                  className={requestsFilter === f ? 'on' : ''}
                  onClick={() => {
                    setRequestsFilter(f);
                    loadRequests(f);
                  }}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="wrap">
              <table>
                <thead>
                  <tr>
                    <th>Request</th>
                    <th>Amount</th>
                    <th>Pay to</th>
                    <th>Requested</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingRequests ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: 'var(--mute)', padding: '24px' }}>
                        Loading cashout requests...
                      </td>
                    </tr>
                  ) : requests.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: 'var(--mute)', padding: '24px' }}>
                        No requests here.
                      </td>
                    </tr>
                  ) : (
                    requests.map(r => (
                      <tr
                        key={r.id}
                        className={selectedReqId === r.id ? 'sel' : ''}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelectedReqId(r.id)}
                      >
                        <td>
                          <button
                            type="button"
                            className="lk"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedReqId(r.id);
                            }}
                          >
                            {r.code}
                          </button>
                          <div className="tr">{r.agentName}</div>
                        </td>
                        <td>
                          {formatNumber(r.amount)} ETB
                          {r.amount > 20000 && (
                            <span className="b o" style={{ marginLeft: '6px' }}>2 approvals</span>
                          )}
                        </td>
                        <td>
                          {r.payoutMethod} <span className="tr">{r.payoutAccount}</span>
                        </td>
                        <td>{r.relativeTime}</td>
                        <td>
                          <span className={`b ${r.status === 'Paid' ? 'k' : r.status === 'Rejected' ? 'w' : 'o'}`}>
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Column: Inspection & Action Card */}
          <div className="card">
            {!selectedReq ? (
              <div className="tr" style={{ padding: '24px', textAlign: 'center' }}>
                Select a request to review.
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 700 }}>
                      {selectedReq.code} · {selectedReq.agentName}
                    </div>
                    <div className="tr">
                      {selectedReq.agentCode} · code {selectedReq.agentCode} · requested {selectedReq.relativeTime}
                    </div>
                  </div>
                  <span className={`b ${selectedReq.status === 'Paid' ? 'k' : selectedReq.status === 'Rejected' ? 'w' : 'o'}`}>
                    {selectedReq.status}
                  </span>
                </div>

                <div style={{ marginTop: '14px' }}>
                  <div className="lg">
                    <span>Amount requested</span>
                    <b>{formatNumber(selectedReq.amount)} ETB</b>
                  </div>
                  <div className="lg">
                    <span>Pay to</span>
                    <b>{selectedReq.payoutMethod}</b>
                  </div>
                  <div className="lg">
                    <span>{selectedReq.payoutMethod === 'CBE' ? 'Account number' : 'Phone number'}</span>
                    <b><code>{selectedReq.payoutAccount}</code></b>
                  </div>
                  <div className="lg">
                    <span>Account name</span>
                    <b>{selectedReq.accountName}</b>
                  </div>
                  <div className="lg">
                    <span>Commission left after hold</span>
                    <b>{formatNumber(selectedReq.commissionLeftAfterHold)} ETB</b>
                  </div>
                </div>

                {/* Status-dependent Inspection Body */}
                {selectedReq.status === 'Requested' && (
                  <div className="sec">
                    <div className="tr" style={{ marginTop: '10px' }}>
                      Start the review to check the payout destination.
                    </div>
                    <div className="row" style={{ marginTop: '14px' }}>
                      <button
                        className="k"
                        disabled={isSubmittingAction}
                        onClick={() => handleStartReview(selectedReq)}
                      >
                        Start review
                      </button>
                      <button
                        disabled={isSubmittingAction}
                        onClick={() => setRejectModalReqId(selectedReq.id)}
                      >
                        Reject &amp; refund
                      </button>
                    </div>
                  </div>
                )}

                {selectedReq.status === 'Under review' && (
                  <div className="sec">
                    <h4>Checks</h4>
                    <div className="row" style={{ margin: '8px 0', fontWeight: 600 }}>
                      {isAgentActive ? (
                        <span className="up">✓ Agent account is active</span>
                      ) : (
                        <span className="dn">✗ Agent account is inactive or suspended</span>
                      )}
                    </div>
                    <div className="row" style={{ margin: '8px 0', fontWeight: 600 }}>
                      {isAmountValid ? (
                        <span className="up">✓ Amount is at least 500 ETB</span>
                      ) : (
                        <span className="dn">✗ Amount is below 500 ETB minimum</span>
                      )}
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0', fontWeight: 600, cursor: 'pointer', color: 'var(--ink)' }}>
                      <input
                        type="checkbox"
                        checked={Boolean(selectedReq.checklist?.o1)}
                        onChange={() => handleChecklistToggle('o1')}
                      />
                      Account name matches the agent
                    </label>

                    {isLargePayout ? (
                      <div className="tr" style={{ marginTop: '8px', color: '#b45309', fontWeight: 600 }}>
                        ⚠️ This is above 20,000 ETB, so a second admin must approve before it is paid.
                      </div>
                    ) : (
                      <>
                        <label>Payout transaction ID ({selectedReq.payoutMethod})</label>
                        <input
                          type="text"
                          value={payoutTxRefInput}
                          placeholder="Enter after sending the money"
                          onChange={e => setPayoutTxRefInput(e.target.value)}
                        />
                        <div className="tr" style={{ marginTop: '6px' }}>Each payout ID can be used once.</div>
                      </>
                    )}

                    <div className="row" style={{ marginTop: '14px' }}>
                      <button
                        className="k"
                        disabled={!canApproveUnderReview || isSubmittingAction}
                        onClick={() => handleApprove(selectedReq)}
                      >
                        {isLargePayout ? 'Approve (needs 2nd admin)' : 'Approve & mark paid'}
                      </button>
                      <button
                        disabled={isSubmittingAction}
                        onClick={() => setRejectModalReqId(selectedReq.id)}
                      >
                        Reject &amp; refund
                      </button>
                    </div>
                  </div>
                )}

                {selectedReq.status === 'Awaiting 2nd approval' && (
                  <div className="sec">
                    <h4>Second Approval Required</h4>
                    <div className="tr" style={{ marginBottom: '8px' }}>
                      First approval granted. As a second admin, verify disbursement details and enter payout transaction ID.
                    </div>
                    <label>Payout transaction ID ({selectedReq.payoutMethod})</label>
                    <input
                      type="text"
                      value={payoutTxRefInput}
                      placeholder="Enter after sending the money"
                      onChange={e => setPayoutTxRefInput(e.target.value)}
                    />
                    <div className="row" style={{ marginTop: '14px' }}>
                      <button
                        className="k"
                        disabled={!canSecondApprove || isSubmittingAction}
                        onClick={() => handleSecondApprove(selectedReq)}
                      >
                        Second admin: approve &amp; mark paid
                      </button>
                      <button
                        disabled={isSubmittingAction}
                        onClick={() => setRejectModalReqId(selectedReq.id)}
                      >
                        Reject &amp; refund
                      </button>
                    </div>
                  </div>
                )}

                {selectedReq.status === 'Paid' && (
                  <div className="sec">
                    <div className="lg">
                      <span>Paid by</span>
                      <b>Super Admin</b>
                    </div>
                    <div className="lg">
                      <span>Payout transaction ID</span>
                      <b><code>{selectedReq.payoutTxRef || '-'}</code></b>
                    </div>
                  </div>
                )}

                {selectedReq.status === 'Rejected' && (
                  <div className="sec">
                    <div className="lg">
                      <span>Reason</span>
                      <b>{selectedReq.rejectionReason || selectedReq.adminNotes || 'Disbursement rejected'}</b>
                    </div>
                    <div className="lg">
                      <span>Refund</span>
                      <b style={{ color: 'var(--g)' }}>Returned to agent commission</b>
                    </div>
                  </div>
                )}

                {/* Timeline */}
                <div className="sec">
                  <h4>Timeline</h4>
                  {selectedReq.timeline.map((x, idx) => (
                    <div key={idx} className="tr" style={{ marginTop: '6px' }}>
                      <b style={{ color: 'var(--ink)' }}>{x[0]}</b> {x[1]}
                    </div>
                  ))}
                </div>

                {/* Rules Note */}
                <div className="sec">
                  <div className="tr" style={{ marginTop: '10px' }}>
                    Rules: commission is held when the agent requests a cashout. Rejecting returns it automatically. Minimum payout 500 ETB. Above 20,000 ETB needs a second admin.
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ====================================================
          TAB 2: HISTORY
          ==================================================== */}
      {activeTab === 'hist' && (
        <>
          <div className="card">
            <label style={{ marginTop: 0, fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              Search history
            </label>
            <input
              type="text"
              placeholder="Agent name, agent ID, agent code, request ID or reference"
              value={historySearch}
              onChange={e => setHistorySearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') loadHistory(); }}
            />

            {historyAgentFilter && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '10px' }}>
                <span className="b k">{historyAgentFilter}</span>
                <button onClick={() => { setHistoryAgentFilter(''); loadHistory({ agent: '' }); }}>Clear</button>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginTop: '16px' }}>
              <div className="tabs" style={{ margin: 0 }}>
                {(['all', 'today', 'week', 'month'] as const).map(p => (
                  <button
                    key={p}
                    className={historyPeriod === p ? 'on' : ''}
                    onClick={() => handlePeriodChange(p)}
                  >
                    {p === 'all' ? 'All time' : p === 'today' ? 'Daily' : p === 'week' ? 'Weekly' : 'Monthly'}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="date"
                  value={historyFrom}
                  onChange={e => { setHistoryFrom(e.target.value); setHistoryPeriod('custom'); }}
                />
                <span className="tr">to</span>
                <input
                  type="date"
                  value={historyTo}
                  onChange={e => { setHistoryTo(e.target.value); setHistoryPeriod('custom'); }}
                />
                <button className="k" onClick={handleCustomDateFetch}>Fetch</button>
              </div>
            </div>
          </div>

          {/* 4 Period KPI Stats */}
          <div className="grid g4" style={{ marginTop: '15px' }}>
            <div className="card d">
              <div className="lab">Total Paid Out</div>
              <div className="val">ETB {formatNumber(historyStats.totalPaid)}</div>
              <div className="tr">{historyStats.paidCount} bank payouts</div>
            </div>
            <div className="card">
              <div className="lab">Converted to Float</div>
              <div className="val">ETB {formatNumber(historyStats.totalConverted)}</div>
              <div className="tr">{historyStats.convertedCount} instant conversions</div>
            </div>
            <div className="card">
              <div className="lab">Rejected and Refunded</div>
              <div className="val">ETB {formatNumber(historyStats.totalRejected)}</div>
              <div className="tr">{historyStats.rejectedCount} requests</div>
            </div>
            <div className="card">
              <div className="lab">Average Payout</div>
              <div className="val">ETB {formatNumber(historyStats.averagePayout)}</div>
              <div className="tr">Per paid request</div>
            </div>
          </div>

          {/* Transaction History Card */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <h3 style={{ margin: 0 }}>
                Payout History <span className="tr" style={{ fontWeight: 400, marginLeft: '6px' }}>
                  {historyPeriod === 'all' ? 'All dates' : `${historyFrom || 'Start'} to ${historyTo || 'End'}`}
                </span>
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button onClick={handleExportCSV}>Export CSV</button>
                <button
                  className="k"
                  onClick={handleDownloadPDFReport}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  title="Download clean modern PDF audit report"
                >
                  <i className="fa-solid fa-file-pdf" style={{ color: '#ef4444' }}></i>
                  Download PDF Report
                </button>
              </div>
            </div>

            {/* Sub-tabs: All | Paid | Converted | Rejected */}
            <div className="tabs" style={{ marginBottom: '8px' }}>
              {(['All', 'Paid', 'Converted', 'Rejected'] as const).map(st => (
                <button
                  key={st}
                  className={historyStatusFilter === st ? 'on' : ''}
                  onClick={() => {
                    setHistoryStatusFilter(st);
                    loadHistory({ status: st });
                  }}
                >
                  {st}
                </button>
              ))}
            </div>

            <div className="wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>ID</th>
                    <th>Agent</th>
                    <th>Type</th>
                    <th>Destination</th>
                    <th>Amount</th>
                    <th>Reference</th>
                    <th>Status</th>
                    <th>By</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingHistory ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', color: 'var(--mute)', padding: '24px' }}>
                        Loading payout history...
                      </td>
                    </tr>
                  ) : historyRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', color: 'var(--mute)', padding: '24px' }}>
                        No payouts found for this selection.
                      </td>
                    </tr>
                  ) : (
                    historyRows.map(row => (
                      <tr key={row.id}>
                        <td>{row.dateFormatted}</td>
                        <td><b>{row.id}</b></td>
                        <td>
                          {row.agentName} <span className="tr">{row.agentCode}</span>
                        </td>
                        <td>{row.type}</td>
                        <td>{row.destination}</td>
                        <td><b>{formatNumber(row.amount)} ETB</b></td>
                        <td><code>{row.reference}</code></td>
                        <td>
                          <span className={`b ${row.status === 'Paid' ? 'k' : row.status === 'Rejected' ? 'w' : ''}`}>
                            {row.status}
                          </span>
                        </td>
                        <td>{row.by}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ====================================================
          TAB 3: COMMISSION BALANCES
          ==================================================== */}
      {activeTab === 'bal' && (
        <>
          <div className="two" style={{ gap: '15px', marginBottom: '15px' }}>
            <div className="card">
              <h3>⚡ Instant Convert to Float</h3>
              <div className="tr" style={{ color: '#1f6a37', fontWeight: 600 }}>
                ✓ Ready to convert directly into working float
              </div>
              <div className="tr" style={{ marginTop: '8px' }}>
                Agents turn earned commission into float immediately, with no approval. It appears in History as a float conversion.
              </div>
            </div>
            <div className="card">
              <h3>🏦 Request Admin Bank Transfer</h3>
              <div className="tr" style={{ color: '#1f6a37', fontWeight: 600 }}>
                ✓ Telebirr or CBE Bank Payout
              </div>
              <div className="tr" style={{ marginTop: '8px' }}>
                Agents ask headquarters to pay their commission to a Telebirr phone or CBE bank account. You review each request.
              </div>
            </div>
          </div>

          <div className="card">
            <h3>Commission Balances</h3>
            <div className="wrap">
              <table>
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>Available</th>
                    <th>Held</th>
                    <th>Paid out</th>
                    <th>To float</th>
                    <th>Total earned</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingBalances ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', color: 'var(--mute)', padding: '24px' }}>
                        Loading commission balances...
                      </td>
                    </tr>
                  ) : balances.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', color: 'var(--mute)', padding: '24px' }}>
                        No agent records found.
                      </td>
                    </tr>
                  ) : (
                    balances.map(ag => (
                      <tr key={ag.id}>
                        <td>
                          <b>{ag.name}</b> <span className="tr">{ag.code}</span>
                        </td>
                        <td><b>{formatNumber(ag.available)} ETB</b></td>
                        <td>{formatNumber(ag.held)} ETB</td>
                        <td>{formatNumber(ag.paidOut)} ETB</td>
                        <td>{formatNumber(ag.toFloat)} ETB</td>
                        <td><b>{formatNumber(ag.totalEarned)} ETB</b></td>
                        <td>
                          <span className={`b ${ag.status === 'active' ? 'k' : ag.status === 'suspended' ? 'w' : 'o'}`}>
                            {ag.status === 'active' ? 'Active' : ag.status === 'suspended' ? 'Suspended' : 'Pending'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ====================================================
          REJECT & REFUND MODAL
          ==================================================== */}
      {rejectModalReqId && (
        <div className="modalbg">
          <div className="modal">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Reject and refund</h3>
              <button
                type="button"
                onClick={() => setRejectModalReqId(null)}
                aria-label="Close"
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <div className="tr" style={{ marginTop: '8px' }}>
              The commission is returned to the agent automatically.
            </div>

            <label>Reason</label>
            <select
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
            >
              <option>Account name mismatch</option>
              <option>Insufficient verified commission</option>
              <option>Agent suspended</option>
              <option>Suspicious activity</option>
              <option>Other</option>
            </select>

            <label>Note to agent</label>
            <textarea
              value={rejectNote}
              placeholder="Explain why the payout was rejected..."
              onChange={e => setRejectNote(e.target.value)}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '18px' }}>
              <button
                type="button"
                onClick={() => setRejectModalReqId(null)}
                disabled={isSubmittingAction}
              >
                Cancel
              </button>
              <button
                type="button"
                className="k"
                disabled={isSubmittingAction}
                onClick={handleRejectAndRefund}
              >
                Reject and refund
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
