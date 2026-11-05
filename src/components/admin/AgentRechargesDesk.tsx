import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { useAdmin } from '../../context/AdminContext.tsx';
import { apiClient } from '../../services/apiClient.ts';
import { socketService } from '../../services/socketService.ts';

interface RechargeRequest {
  id: string;
  code: string;
  agentId: string;
  agentName: string;
  agentCode: string;
  agentCity: string;
  agentPhone: string;
  amount: number;
  receivedAmount: number;
  paymentMethod: string;
  transactionCode: string;
  receiptImage?: string | null;
  status: 'Requested' | 'Under review' | 'Awaiting 2nd approval' | 'Credited' | 'Rejected';
  adminNotes?: string | null;
  walletNow: number;
  walletAfter: number;
  createdAt: string;
  relativeTime: string;
  timeline: Array<[string, string]>;
  checklist: { c1?: boolean; c2?: boolean; c3?: boolean; c4?: boolean };
  isDuplicate: boolean;
  duplicateMsg: string;
}

interface HistoryRow {
  id: string;
  requestId: string;
  dbId: string;
  agentId: string;
  agentName: string;
  agentCode: string;
  agentCity: string;
  agentPhone: string;
  transactionCode: string;
  paymentMethod: string;
  amount: number;
  balanceBefore: number | null;
  balanceAfter: number | null;
  status: 'Credited' | 'Rejected';
  receiptImage?: string | null;
  dateFormatted: string;
  isoDate: string;
}

interface LowBalanceAgent {
  id: string;
  agentCode: string;
  agentName: string;
  agentPhone: string;
  walletBalance: number;
  city: string;
  lastRechargeDate: string;
}

export const AgentRechargesDesk: React.FC = () => {
  const { showToast } = useApp();
  const { isSidebarCollapsed, toggleSidebar } = useAdmin();

  // Top KPIs
  const [kpis, setKpis] = useState({
    openRequests: { count: 0, awaitingAmount: 0 },
    creditedToday: { count: 0, totalAmount: 0 },
    lowBalanceAgents: { count: 0 }
  });

  // 4-Step Flow
  const [flow, setFlow] = useState({
    step1: 0,
    step2: 0,
    step3: 0,
    step4: 0
  });

  // Tabs
  const [activeTab, setActiveTab] = useState<'req' | 'hist' | 'low'>('req');

  // Tab 1: Requests
  const [requestsFilter, setRequestsFilter] = useState<'Open' | 'Credited' | 'Rejected' | 'All'>('Open');
  const [requests, setRequests] = useState<RechargeRequest[]>([]);
  const [selectedReqId, setSelectedReqId] = useState<string | null>(null);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);

  // Tab 2: History
  const [historyPeriod, setHistoryPeriod] = useState<'today' | 'week' | 'month' | 'all' | 'custom'>('all');
  const [historyFrom, setHistoryFrom] = useState('');
  const [historyTo, setHistoryTo] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [historyAgentFilter, setHistoryAgentFilter] = useState('');
  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([]);
  const [historyStats, setHistoryStats] = useState({
    totalCredited: 0,
    creditedCount: 0,
    rejectedCount: 0,
    averageRecharge: 0,
    largestRecharge: 0
  });
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Tab 3: Low Balance
  const [lowBalanceAgents, setLowBalanceAgents] = useState<LowBalanceAgent[]>([]);
  const [isLoadingLowBal, setIsLoadingLowBal] = useState(false);

  // Modals
  const [proofModalData, setProofModalData] = useState<{
    method: string;
    amount: number;
    ref: string;
    date: string;
    phone: string;
    image?: string | null;
  } | null>(null);

  const [rejectModalReqId, setRejectModalReqId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('Payment not found');
  const [rejectNote, setRejectNote] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  // ----------------------------------------------------
  // Data Loaders
  // ----------------------------------------------------
  const loadKPIs = useCallback(async () => {
    try {
      const data = await apiClient.admin.getAgentRechargeKPIs();
      if (data && data.success && data.kpis) {
        setKpis(data.kpis);
      }
    } catch (e) {
      console.warn('Failed to load recharge KPIs:', e);
    }
  }, []);

  const loadFlow = useCallback(async () => {
    try {
      const data = await apiClient.admin.getAgentRechargeFlow();
      if (data && data.success && data.flow) {
        setFlow(data.flow);
      }
    } catch (e) {
      console.warn('Failed to load recharge flow:', e);
    }
  }, []);

  const loadRequests = useCallback(async (filter = requestsFilter) => {
    try {
      setIsLoadingRequests(true);
      const data = await apiClient.admin.getAgentRechargeRequests(filter);
      if (data && data.success) {
        const list: RechargeRequest[] = data.requests || [];
        setRequests(list);
        if (list.length > 0) {
          // If current selection is not in list, select the first row
          setSelectedReqId(prev => (list.some(r => r.id === prev) ? prev : list[0].id));
        } else {
          setSelectedReqId(null);
        }
      }
    } catch (e) {
      console.warn('Failed to load recharge requests:', e);
    } finally {
      setIsLoadingRequests(false);
    }
  }, [requestsFilter]);

  const loadHistory = useCallback(async () => {
    try {
      setIsLoadingHistory(true);
      const data = await apiClient.admin.getAgentRechargeHistory({
        period: historyPeriod,
        from: historyFrom,
        to: historyTo,
        search: historySearch,
        agent: historyAgentFilter
      });
      if (data && data.success) {
        setHistoryRows(data.rows || []);
        if (data.stats) setHistoryStats(data.stats);
      }
    } catch (e) {
      console.warn('Failed to load recharge history:', e);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [historyPeriod, historyFrom, historyTo, historySearch, historyAgentFilter]);

  const loadLowBalance = useCallback(async () => {
    try {
      setIsLoadingLowBal(true);
      const data = await apiClient.admin.getLowBalanceAgents();
      if (data && data.success) {
        setLowBalanceAgents(data.agents || []);
      }
    } catch (e) {
      console.warn('Failed to load low balance agents:', e);
    } finally {
      setIsLoadingLowBal(false);
    }
  }, []);

  // Initial Load & Real-Time WebSocket Listeners
  useEffect(() => {
    loadKPIs();
    loadFlow();
    loadRequests();
    loadLowBalance();

    const refreshAll = () => {
      loadKPIs();
      loadFlow();
      loadRequests();
      loadLowBalance();
      if (activeTab === 'hist') loadHistory();
    };

    const unsubNew = socketService.on('admin_agent_recharge_new', refreshAll);
    const unsubUpdate = socketService.on('admin_agent_recharge_update', refreshAll);
    const unsubCredited = socketService.on('agent_recharge_credited', refreshAll);
    const unsubWallet = socketService.on('agent_wallet_updated', refreshAll);

    return () => {
      unsubNew();
      unsubUpdate();
      unsubCredited();
      unsubWallet();
    };
  }, [loadKPIs, loadFlow, loadRequests, loadLowBalance, loadHistory, activeTab]);

  // Handle Tab Switch
  const handleTabChange = (tab: 'req' | 'hist' | 'low') => {
    setActiveTab(tab);
    if (tab === 'hist') loadHistory();
    if (tab === 'low') loadLowBalance();
  };

  // ----------------------------------------------------
  // Actions
  // ----------------------------------------------------
  const selectedReq = requests.find(r => r.id === selectedReqId) || null;

  const handleStartReview = async (id: string) => {
    try {
      setIsSubmittingAction(true);
      const data = await apiClient.admin.startAgentRechargeReview(id);
      if (data && data.success) {
        showToast('Review started');
        setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'Under review', timeline: data.timeline } : r));
        loadKPIs();
        loadFlow();
      }
    } catch (err: any) {
      showToast(`❌ Error: ${err.message}`);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleChecklistToggle = async (key: 'c1' | 'c2' | 'c3' | 'c4') => {
    if (!selectedReq) return;
    const currentChk = selectedReq.checklist || {};
    const updatedChk = { ...currentChk, [key]: !currentChk[key] };

    // Optimistic UI update
    setRequests(prev => prev.map(r => r.id === selectedReq.id ? { ...r, checklist: updatedChk } : r));

    try {
      await apiClient.admin.updateAgentRechargeChecklist(selectedReq.id, updatedChk, selectedReq.receivedAmount);
    } catch (err: any) {
      console.warn('Failed to save checklist:', err);
    }
  };

  const handleReceivedAmountChange = async (val: number) => {
    if (!selectedReq) return;
    setRequests(prev => prev.map(r => r.id === selectedReq.id ? { ...r, receivedAmount: val, walletAfter: r.walletNow + val } : r));
    try {
      await apiClient.admin.updateAgentRechargeChecklist(selectedReq.id, selectedReq.checklist, val);
    } catch (err: any) {
      console.warn('Failed to update received amount:', err);
    }
  };

  const handleCredit = async (r: RechargeRequest) => {
    try {
      setIsSubmittingAction(true);
      const data = await apiClient.admin.creditAgentRecharge(r.id);
      if (data && data.success) {
        showToast(data.message || 'Wallet credited');
        loadKPIs();
        loadFlow();
        loadRequests();
        loadLowBalance();
      } else {
        showToast(`❌ ${data?.message || 'Credit failed'}`);
      }
    } catch (err: any) {
      showToast(`❌ Error: ${err.message}`);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectModalReqId) return;
    try {
      setIsSubmittingAction(true);
      const data = await apiClient.admin.rejectAgentRecharge(rejectModalReqId, rejectReason, rejectNote);
      if (data && data.success) {
        showToast('Request rejected');
        setRejectModalReqId(null);
        setRejectReason('Payment not found');
        setRejectNote('');
        loadKPIs();
        loadFlow();
        loadRequests();
      }
    } catch (err: any) {
      showToast(`❌ Error: ${err.message}`);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleSendReminder = async (agentId: string, agentName: string) => {
    try {
      const data = await apiClient.admin.sendLowBalanceReminder(agentId);
      if (data && data.success) {
        showToast(`Reminder sent to ${agentName} by Telegram and SMS`);
      }
    } catch (err: any) {
      showToast(`❌ Failed to send reminder: ${err.message}`);
    }
  };

  const handleExportCSV = () => {
    if (historyRows.length === 0) {
      showToast('No history records to export');
      return;
    }
    const headers = ['Date', 'Transaction', 'Agent', 'Transaction ID', 'Method', 'Amount ETB', 'Balance Before', 'Balance After', 'Status'];
    const csvRows = [
      headers.join(','),
      ...historyRows.map(r => [
        `"${r.dateFormatted}"`,
        `"${r.id}"`,
        `"${r.agentName}"`,
        `"${r.transactionCode}"`,
        `"${r.paymentMethod}"`,
        r.amount,
        r.balanceBefore ?? '',
        r.balanceAfter ?? '',
        `"${r.status}"`
      ].join(','))
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agent-recharges-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exporting history as CSV');
  };

  // ----------------------------------------------------
  // Verification conditions for right inspection panel
  // ----------------------------------------------------
  const isReviewActive = selectedReq && ['Under review', 'Awaiting 2nd approval'].includes(selectedReq.status);
  const hasProofImage = Boolean(selectedReq?.receiptImage);
  const checksComplete = Boolean(
    selectedReq?.checklist?.c1 &&
    selectedReq?.checklist?.c2 &&
    selectedReq?.checklist?.c3 &&
    (!hasProofImage || selectedReq?.checklist?.c4)
  );
  const canCredit = Boolean(
    isReviewActive &&
    checksComplete &&
    !selectedReq?.isDuplicate &&
    selectedReq && selectedReq.receivedAmount > 0
  );

  return (
    <div className="enqu-recharges-desk" style={{
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
        .enqu-recharges-desk {
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
        .enqu-recharges-desk .grid { display: grid; gap: 15px; margin-bottom: 15px; }
        .enqu-recharges-desk .g4 { grid-template-columns: repeat(4, 1fr); }
        .enqu-recharges-desk .g3 { grid-template-columns: repeat(3, 1fr); }
        .enqu-recharges-desk .g2 { grid-template-columns: 1.7fr 1fr; }
        .enqu-recharges-desk .card { background: var(--card); border-radius: 20px; padding: 15px 16px; min-width: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.02); }
        .enqu-recharges-desk .card.d { background: linear-gradient(135deg, #1c1e1d, #2a2d2b 55%, #1a1c1b); color: #fff; }
        .enqu-recharges-desk .card h3 { font-size: 16.5px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
        .enqu-recharges-desk .card h3 .r { margin-left: auto; }
        .enqu-recharges-desk .lab { font-size: 14px; color: var(--mute); font-weight: 500; }
        .enqu-recharges-desk .card.d .lab { color: #e5e5e5; }
        .enqu-recharges-desk .val { font-size: 23px; font-weight: 700; margin: 8px 0; }
        .enqu-recharges-desk .tr { font-size: 12px; color: var(--mute); font-weight: 500; }
        .enqu-recharges-desk .up { color: var(--g); }
        .enqu-recharges-desk .dn { color: var(--r); }
        .enqu-recharges-desk table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .enqu-recharges-desk th { text-align: left; color: var(--mute); font-weight: 500; font-size: 14px; padding: 9px 8px; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
        .enqu-recharges-desk td { padding: 10px 8px; font-weight: 600; border-bottom: 1px solid var(--line); white-space: nowrap; }
        .enqu-recharges-desk tr:last-child td { border-bottom: 0; }
        .enqu-recharges-desk .wrap { overflow-x: auto; }
        .enqu-recharges-desk .b { display: inline-block; padding: 4px 12px; border-radius: 14px; background: var(--grey); color: #fff; font-size: 12.5px; font-weight: 600; }
        .enqu-recharges-desk .b.o { background: transparent; color: var(--mute); box-shadow: inset 0 0 0 1px var(--line); }
        .enqu-recharges-desk .b.k { background: var(--dark); color: #fff; }
        .enqu-recharges-desk .b.w { background: var(--r); color: #fff; }
        .enqu-recharges-desk button, .enqu-recharges-desk .btn { font: inherit; font-size: 12.5px; font-weight: 600; border: 0; border-radius: 14px; padding: 5px 13px; background: var(--chip); color: var(--ink); cursor: pointer; transition: all 0.15s ease; }
        .enqu-recharges-desk button.p { background: var(--grey); color: #fff; }
        .enqu-recharges-desk button.k { background: var(--dark); color: #fff; }
        .enqu-recharges-desk button:disabled { opacity: 0.4; cursor: default; }
        .enqu-recharges-desk .tabs { display: flex; gap: 8px; overflow-x: auto; margin-bottom: 15px; padding-bottom: 2px; }
        .enqu-recharges-desk .tabs button { background: var(--card); padding: 8px 16px; font-size: 14px; border-radius: 20px; white-space: nowrap; }
        .enqu-recharges-desk .tabs button.on { background: var(--grey); color: #fff; }
        .enqu-recharges-desk .flow { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .enqu-recharges-desk .fs { display: flex; gap: 10px; align-items: center; background: var(--panel); border-radius: 16px; padding: 12px; }
        .enqu-recharges-desk .fs b { font-size: 14px; }
        .enqu-recharges-desk .fn { width: 26px; height: 26px; border-radius: 50%; background: var(--dark); color: #fff; display: grid; place-items: center; font-weight: 700; font-size: 13px; flex: none; }
        .enqu-recharges-desk .fc { margin-left: auto; font-size: 21px; font-weight: 700; }
        .enqu-recharges-desk tr.sel td { background: var(--chip); }
        .enqu-recharges-desk .sec { border-top: 1px solid var(--line); margin-top: 16px; padding-top: 2px; }
        .enqu-recharges-desk .sec h4 { font-size: 14px; font-weight: 700; margin: 12px 0 6px; }
        .enqu-recharges-desk code { font-family: ui-monospace, Menlo, monospace; font-size: 12.5px; background: var(--chip); padding: 3px 8px; border-radius: 8px; }
        .enqu-recharges-desk .lg { display: flex; justify-content: space-between; font-size: 13.5px; font-weight: 600; padding: 4px 0; }
        .enqu-recharges-desk .lg span::before { content: ""; display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 8px; background: var(--grey); }
        .enqu-recharges-desk .lk { background: none; padding: 0; font-size: 14px; font-weight: 700; text-align: left; border-radius: 0; color: var(--ink); }
        .enqu-recharges-desk .lk:hover { text-decoration: underline; }
        .enqu-recharges-desk .av { width: 31px; height: 31px; border-radius: 50%; background: linear-gradient(#a8573c, #7d3524); flex: none; }
        .enqu-recharges-desk .av2 { width: 34px; height: 34px; border-radius: 50%; background: var(--chip); display: inline-grid; place-items: center; font-size: 12.5px; font-weight: 800; flex: none; }
        .enqu-recharges-desk .av2.big { width: 48px; height: 48px; font-size: 16px; }
        .enqu-recharges-desk input[type=number], .enqu-recharges-desk input[type=text], .enqu-recharges-desk input[type=date], .enqu-recharges-desk select, .enqu-recharges-desk textarea {
          width: 100%; background: var(--chip); border: 0; border-radius: 12px; padding: 9px 12px; font: inherit; font-weight: 600; color: var(--ink); box-sizing: border-box;
        }
        .enqu-recharges-desk input:focus-visible, .enqu-recharges-desk select:focus-visible, .enqu-recharges-desk textarea:focus-visible {
          outline: 2px solid var(--grey);
        }
        .enqu-recharges-desk .rcp { background: #fff; color: #111; border-radius: 16px; padding: 16px; border: 1px solid var(--line); max-width: 330px; margin: 14px auto; text-align: left; }
        .enqu-recharges-desk .rcp .rh { font-weight: 800; letter-spacing: .5px; font-size: 15px; }
        .enqu-recharges-desk .rcp .ro { color: #1f6a37; font-size: 12.5px; margin: 4px 0 10px; font-weight: 600; }
        .enqu-recharges-desk .rcp .ra { font-size: 26px; font-weight: 800; margin-bottom: 10px; }
        .enqu-recharges-desk .rcp .rr { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; padding: 7px 0; border-top: 1px solid #eee; }
        .enqu-recharges-desk .rcp .rr span { color: #777; }
        .enqu-recharges-desk .modalbg { position: fixed; inset: 0; background: rgba(0,0,0,.45); display: grid; place-items: center; z-index: 1000; padding: 16px; }
        .enqu-recharges-desk .modal { background: var(--card); border-radius: 24px; padding: 22px; width: min(580px, 100%); max-height: 90vh; overflow: auto; box-shadow: 0 20px 40px rgba(0,0,0,0.25); }
        @media (max-width: 900px) {
          .enqu-recharges-desk .g4, .enqu-recharges-desk .g3, .enqu-recharges-desk .g2 { grid-template-columns: 1fr; }
          .enqu-recharges-desk .flow { grid-template-columns: 1fr 1fr; }
        }
      `}</style>

      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
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
          <h1 style={{ fontSize: '29px', fontWeight: 700, letterSpacing: '-0.3px', margin: 0 }}>Agent Recharges</h1>
        </div>
        <span className="av" title="Agent Recharges Desk"></span>
      </div>

      {/* 3 Top KPI Cards */}
      <div className="grid g3">
        <div className="card d">
          <div className="lab">Open Requests</div>
          <div className="val">{kpis.openRequests.count}</div>
          <div className="tr">ETB {kpis.openRequests.awaitingAmount.toLocaleString('en-US')} awaiting</div>
        </div>
        <div className="card">
          <div className="lab">Credited Today</div>
          <div className="val">ETB {kpis.creditedToday.totalAmount.toLocaleString('en-US')}</div>
          <div className="tr">{kpis.creditedToday.count} wallet recharges</div>
        </div>
        <div className="card">
          <div className="lab">Low-balance Agents</div>
          <div className="val">{kpis.lowBalanceAgents.count}</div>
          <div className="tr">
            {kpis.lowBalanceAgents.count > 0 ? (
              <span className="dn">Below 1,000 ETB</span>
            ) : (
              'All healthy'
            )}
          </div>
        </div>
      </div>

      {/* 4-Step Workflow Bar Card */}
      <div className="card" style={{ marginBottom: '15px' }}>
        <div className="flow">
          <div className="fs">
            <span className="fn">1</span>
            <div>
              <b>Request</b>
              <div className="tr">Agent sends screenshot and ID</div>
            </div>
            <span className="fc">{flow.step1}</span>
          </div>
          <div className="fs">
            <span className="fn">2</span>
            <div>
              <b>Verify payment</b>
              <div className="tr">Admin checks the statement</div>
            </div>
            <span className="fc">{flow.step2}</span>
          </div>
          <div className="fs">
            <span className="fn">3</span>
            <div>
              <b>Credit wallet</b>
              <div className="tr">Second approval if large</div>
            </div>
            <span className="fc">{flow.step3}</span>
          </div>
          <div className="fs">
            <span className="fn">4</span>
            <div>
              <b>Record and notify</b>
              <div className="tr">Ledger entry and agent alert</div>
            </div>
            <span className="fc">{flow.step4}</span>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="tabs">
        <button
          className={activeTab === 'req' ? 'on' : ''}
          onClick={() => handleTabChange('req')}
        >
          Requests ({kpis.openRequests.count})
        </button>
        <button
          className={activeTab === 'hist' ? 'on' : ''}
          onClick={() => handleTabChange('hist')}
        >
          History
        </button>
        <button
          className={activeTab === 'low' ? 'on' : ''}
          onClick={() => handleTabChange('low')}
        >
          Low Balance ({kpis.lowBalanceAgents.count})
        </button>
      </div>

      {/* TAB 1: REQUESTS (2-COLUMN GRID) */}
      {activeTab === 'req' && (
        <div className="grid g2">
          {/* Left: Table with filter buttons */}
          <div className="card">
            <h3>Recharge Requests</h3>
            <div className="tabs" style={{ marginBottom: '8px' }}>
              {(['Open', 'Credited', 'Rejected', 'All'] as const).map(f => (
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
                    <th>Method</th>
                    <th>Transaction ID</th>
                    <th>Requested</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingRequests ? (
                    <tr>
                      <td colSpan={6} style={{ color: 'var(--mute)', textAlign: 'center', padding: '24px' }}>
                        Loading real requests from Neon DB...
                      </td>
                    </tr>
                  ) : requests.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ color: 'var(--mute)', textAlign: 'center', padding: '24px' }}>
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
                          <button className="lk" onClick={() => setSelectedReqId(r.id)}>
                            {r.code}
                          </button>
                          <div className="tr">{r.agentName}</div>
                        </td>
                        <td>
                          {r.amount.toLocaleString('en-US')} ETB
                          {r.amount > 20000 && (
                            <span className="b o" style={{ marginLeft: '6px', fontSize: '11px' }}>2 approvals</span>
                          )}
                        </td>
                        <td>{r.paymentMethod}</td>
                        <td>
                          <code>{r.transactionCode || '-'}</code>
                          {r.isDuplicate && ['Requested', 'Under review', 'Awaiting 2nd approval'].includes(r.status) && (
                            <span className="b w" style={{ marginLeft: '6px', fontSize: '11px' }}>Check</span>
                          )}
                        </td>
                        <td>{r.relativeTime}</td>
                        <td>
                          <span className={`b ${
                            r.status === 'Credited' ? 'k' :
                            r.status === 'Rejected' ? 'w' : 'o'
                          }`}>
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

          {/* Right: Inspection Card */}
          <div className="card">
            {!selectedReq ? (
              <div className="tr" style={{ padding: '20px 0', textAlign: 'center' }}>
                Select a request to review.
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 700 }}>
                      {selectedReq.code} · {selectedReq.agentName}
                    </div>
                    <div className="tr">Requested {selectedReq.relativeTime}</div>
                  </div>
                  <span className={`b ${
                    selectedReq.status === 'Credited' ? 'k' :
                    selectedReq.status === 'Rejected' ? 'w' : 'o'
                  }`}>
                    {selectedReq.status}
                  </span>
                </div>

                {/* Amounts & Balances */}
                <div style={{ marginTop: '12px' }}>
                  <div className="lg">
                    <span>Amount requested</span>
                    <b>{selectedReq.amount.toLocaleString('en-US')} ETB</b>
                  </div>
                  <div className="lg">
                    <span>Method</span>
                    <b>{selectedReq.paymentMethod}</b>
                  </div>
                  <div className="lg">
                    <span>Transaction ID</span>
                    <b><code>{selectedReq.transactionCode || '-'}</code></b>
                  </div>
                  <div className="lg">
                    <span>Wallet now</span>
                    <b>{selectedReq.walletNow.toLocaleString('en-US')} ETB</b>
                  </div>
                  <div className="lg">
                    <span>Wallet after credit</span>
                    <b>{selectedReq.walletAfter.toLocaleString('en-US')} ETB</b>
                  </div>
                </div>

                {/* Payment Proof Section */}
                <div className="sec">
                  <h4>Payment proof from agent</h4>
                  {selectedReq.receiptImage || selectedReq.transactionCode ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
                      <button
                        className="k"
                        onClick={() => setProofModalData({
                          method: selectedReq.paymentMethod,
                          amount: selectedReq.amount,
                          ref: selectedReq.transactionCode,
                          date: selectedReq.timeline[selectedReq.timeline.length - 1]?.[0] || 'Today',
                          phone: selectedReq.agentPhone,
                          image: selectedReq.receiptImage
                        })}
                      >
                        View screenshot
                      </button>
                      <span className="tr">Sent with transaction ID {selectedReq.transactionCode}</span>
                    </div>
                  ) : (
                    <div className="tr" style={{ marginTop: '8px' }}>No screenshot submitted.</div>
                  )}
                </div>

                {/* Verify Payment Section */}
                {isReviewActive ? (
                  <div className="sec">
                    <h4>Verify payment</h4>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0', fontWeight: 600, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={Boolean(selectedReq.checklist?.c1)}
                        onChange={() => handleChecklistToggle('c1')}
                      />
                      Transaction ID found in the {selectedReq.paymentMethod} statement
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0', fontWeight: 600, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={Boolean(selectedReq.checklist?.c2)}
                        onChange={() => handleChecklistToggle('c2')}
                      />
                      Amount matches what the agent sent
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0', fontWeight: 600, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={Boolean(selectedReq.checklist?.c3)}
                        onChange={() => handleChecklistToggle('c3')}
                      />
                      Sender phone matches the agent
                    </label>
                    {hasProofImage && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0', fontWeight: 600, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={Boolean(selectedReq.checklist?.c4)}
                          onChange={() => handleChecklistToggle('c4')}
                        />
                        Screenshot matches the transaction ID and amount
                      </label>
                    )}

                    {/* Duplicate Status */}
                    <div style={{ margin: '8px 0', fontWeight: 600, fontSize: '13px' }}>
                      {!selectedReq.isDuplicate ? (
                        <span style={{ color: 'var(--g)' }}>✓ Transaction ID not used before</span>
                      ) : (
                        <span className="dn">✗ {selectedReq.duplicateMsg}</span>
                      )}
                    </div>

                    {/* Received Amount Input */}
                    <div style={{ marginTop: '10px' }}>
                      <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                        Amount received in the account (ETB)
                      </label>
                      <input
                        type="number"
                        value={selectedReq.receivedAmount}
                        onChange={e => handleReceivedAmountChange(parseFloat(e.target.value) || 0)}
                      />
                      <div className="tr" style={{ marginTop: '4px' }}>
                        If it differs from the request, the received amount is credited.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="tr" style={{ marginTop: '10px' }}>
                    {selectedReq.status === 'Requested'
                      ? 'Start the review to verify the payment.'
                      : 'This request is closed.'}
                  </div>
                )}

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
                  {selectedReq.status === 'Requested' && (
                    <>
                      <button
                        className="k"
                        disabled={isSubmittingAction}
                        onClick={() => handleStartReview(selectedReq.id)}
                      >
                        Start review
                      </button>
                      <button
                        disabled={isSubmittingAction}
                        onClick={() => setRejectModalReqId(selectedReq.id)}
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {selectedReq.status === 'Under review' && (
                    <>
                      <button
                        className="k"
                        disabled={!canCredit || isSubmittingAction}
                        onClick={() => handleCredit(selectedReq)}
                      >
                        Verify &amp; credit wallet
                      </button>
                      <button
                        disabled={isSubmittingAction}
                        onClick={() => setRejectModalReqId(selectedReq.id)}
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {selectedReq.status === 'Awaiting 2nd approval' && (
                    <>
                      <button
                        className="k"
                        disabled={!canCredit || isSubmittingAction}
                        onClick={() => handleCredit(selectedReq)}
                      >
                        Approve as second admin &amp; credit
                      </button>
                      <button
                        disabled={isSubmittingAction}
                        onClick={() => setRejectModalReqId(selectedReq.id)}
                      >
                        Reject
                      </button>
                    </>
                  )}
                </div>

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
                    Rules: each transaction ID works once. Recharges above 20,000 ETB need a second admin. Requests expire after 48 hours.
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: HISTORY */}
      {activeTab === 'hist' && (
        <>
          <div className="card">
            <label style={{ marginTop: 0, fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              Search agents
            </label>
            <input
              type="text"
              placeholder="Agent name, agent ID or transaction ID"
              value={historySearch}
              onChange={e => setHistorySearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') loadHistory(); }}
            />

            {historyAgentFilter && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '10px' }}>
                <span className="b k">{historyAgentFilter}</span>
                <button onClick={() => { setHistoryAgentFilter(''); loadHistory(); }}>Clear</button>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginTop: '16px' }}>
              <div className="tabs" style={{ margin: 0 }}>
                {(['all', 'today', 'week', 'month'] as const).map(p => (
                  <button
                    key={p}
                    className={historyPeriod === p ? 'on' : ''}
                    onClick={() => {
                      setHistoryPeriod(p);
                      setHistoryFrom('');
                      setHistoryTo('');
                    }}
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
                <button className="k" onClick={loadHistory}>Fetch</button>
              </div>
            </div>
          </div>

          {/* 4 Period KPI Stats */}
          <div className="grid g4" style={{ marginTop: '15px' }}>
            <div className="card d">
              <div className="lab">Total Credited</div>
              <div className="val">ETB {historyStats.totalCredited.toLocaleString('en-US')}</div>
              <div className="tr">{historyStats.creditedCount} recharges</div>
            </div>
            <div className="card">
              <div className="lab">Rejected</div>
              <div className="val">{historyStats.rejectedCount}</div>
              <div className="tr">In this period</div>
            </div>
            <div className="card">
              <div className="lab">Average Recharge</div>
              <div className="val">ETB {historyStats.averageRecharge.toLocaleString('en-US')}</div>
              <div className="tr">Per credited request</div>
            </div>
            <div className="card">
              <div className="lab">Largest Recharge</div>
              <div className="val">ETB {historyStats.largestRecharge.toLocaleString('en-US')}</div>
              <div className="tr">In this period</div>
            </div>
          </div>

          {/* Transaction History Table */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0 }}>
                Transaction History <span className="tr" style={{ fontWeight: 400, marginLeft: '6px' }}>
                  {historyPeriod === 'all' ? 'All dates' : `${historyFrom || 'Start'} to ${historyTo || 'End'}`}
                </span>
              </h3>
              <button onClick={handleExportCSV}>Export CSV</button>
            </div>

            <div className="wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Transaction</th>
                    <th>Agent</th>
                    <th>Transaction ID</th>
                    <th>Method</th>
                    <th>Amount</th>
                    <th>Balance</th>
                    <th>Status</th>
                    <th>Proof</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingHistory ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', color: 'var(--mute)', padding: '24px' }}>
                        Loading transaction history...
                      </td>
                    </tr>
                  ) : historyRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', color: 'var(--mute)', padding: '24px' }}>
                        No recharges found for this selection.
                      </td>
                    </tr>
                  ) : (
                    historyRows.map(row => (
                      <tr key={row.id}>
                        <td>{row.dateFormatted}</td>
                        <td>{row.id}</td>
                        <td>
                          <button
                            className="lk"
                            onClick={() => {
                              setHistoryAgentFilter(row.agentName);
                              loadHistory();
                            }}
                          >
                            {row.agentName}
                          </button>
                        </td>
                        <td><code>{row.transactionCode || '-'}</code></td>
                        <td>{row.paymentMethod}</td>
                        <td>{row.amount.toLocaleString('en-US')} ETB</td>
                        <td>
                          {row.balanceBefore != null && row.balanceAfter != null
                            ? `${row.balanceBefore.toLocaleString('en-US')} to ${row.balanceAfter.toLocaleString('en-US')}`
                            : '-'}
                        </td>
                        <td>
                          <span className={`b ${row.status === 'Credited' ? 'k' : 'w'}`}>
                            {row.status}
                          </span>
                        </td>
                        <td>
                          <button
                            onClick={() => setProofModalData({
                              method: row.paymentMethod,
                              amount: row.amount,
                              ref: row.transactionCode,
                              date: row.dateFormatted,
                              phone: row.agentPhone,
                              image: row.receiptImage
                            })}
                          >
                            View
                          </button>
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

      {/* TAB 3: LOW BALANCE AGENTS */}
      {activeTab === 'low' && (
        <div className="card">
          <h3>Agents below 1,000 ETB</h3>
          <div className="wrap">
            <table>
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Wallet</th>
                  <th>Last recharge</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingLowBal ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: 'var(--mute)', padding: '24px' }}>
                      Loading agents with low balance...
                    </td>
                  </tr>
                ) : lowBalanceAgents.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: 'var(--mute)', padding: '24px' }}>
                      All agents are healthy (balances above 1,000 ETB).
                    </td>
                  </tr>
                ) : (
                  lowBalanceAgents.map(ag => (
                    <tr key={ag.id}>
                      <td>
                        <div style={{ fontWeight: 700 }}>{ag.agentName}</div>
                        <div className="tr">{ag.agentCode} · {ag.city}</div>
                      </td>
                      <td><b>{ag.walletBalance.toLocaleString('en-US')} ETB</b></td>
                      <td>{ag.lastRechargeDate}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            className="k"
                            onClick={() => handleSendReminder(ag.id, ag.agentName)}
                          >
                            Send reminder
                          </button>
                          <button
                            onClick={() => {
                              setHistoryAgentFilter(ag.agentName);
                              handleTabChange('hist');
                            }}
                          >
                            See history
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PROOF / RECEIPT MODAL */}
      {proofModalData && (
        <div className="modalbg" onClick={() => setProofModalData(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0 }}>Payment screenshot</h3>
              <button onClick={() => setProofModalData(null)} aria-label="Close">✕</button>
            </div>

            {proofModalData.image ? (
              <div style={{ textAlign: 'center', margin: '14px 0' }}>
                <img
                  src={proofModalData.image}
                  alt="Receipt Proof"
                  style={{ maxWidth: '100%', maxHeight: '400px', borderRadius: '12px', border: '1px solid var(--line)' }}
                />
              </div>
            ) : (
              <div className="rcp">
                <div className="rh">{proofModalData.method}</div>
                <div className="ro">Transaction successful</div>
                <div className="ra">ETB {proofModalData.amount.toLocaleString('en-US')}.00</div>
                <div className="rr">
                  <span>Transaction ID</span>
                  <b>{proofModalData.ref || 'N/A'}</b>
                </div>
                <div className="rr">
                  <span>Date</span>
                  <b>{proofModalData.date}</b>
                </div>
                <div className="rr">
                  <span>From</span>
                  <b>{proofModalData.phone}</b>
                </div>
                <div className="rr">
                  <span>To</span>
                  <b>Sonic Game PLC</b>
                </div>
              </div>
            )}

            <div className="tr" style={{ textAlign: 'center' }}>
              Submitted by the agent. Compare it with your {proofModalData.method} statement.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '18px' }}>
              <button className="k" onClick={() => setProofModalData(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {rejectModalReqId && (
        <div className="modalbg" onClick={() => setRejectModalReqId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0 }}>Reject request</h3>
              <button onClick={() => setRejectModalReqId(null)} aria-label="Close">✕</button>
            </div>

            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, margin: '10px 0 5px' }}>
              Reason
            </label>
            <select
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
            >
              <option>Payment not found</option>
              <option>Amount mismatch</option>
              <option>Duplicate transaction ID</option>
              <option>Wrong account</option>
              <option>Other</option>
            </select>

            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, margin: '10px 0 5px' }}>
              Note to agent
            </label>
            <textarea
              style={{ minHeight: '80px' }}
              value={rejectNote}
              onChange={e => setRejectNote(e.target.value)}
              placeholder="Explain to the agent what was missing or incorrect..."
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '18px' }}>
              <button onClick={() => setRejectModalReqId(null)} disabled={isSubmittingAction}>Cancel</button>
              <button className="k" onClick={handleConfirmReject} disabled={isSubmittingAction}>
                Reject request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentRechargesDesk;
