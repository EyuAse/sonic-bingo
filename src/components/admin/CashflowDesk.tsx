import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { apiClient } from '../../services/apiClient.ts';
import {
  generateCashflowPDFReport,
  exportCashflowToCSV,
  CashflowReportOptions,
  CashflowReportStreamItem,
  CashflowGamingRoomItem,
  CashflowReportKPIs
} from '../../utils/pdfReportGenerator.ts';

type PeriodType = 'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom';
type FlowFilterType = 'all' | 'inflow' | 'outflow';

const formatETB = (n: number) => {
  return Number(n || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const formatInt = (n: number) => {
  return Number(n || 0).toLocaleString('en-US');
};

export const CashflowDesk: React.FC = () => {
  const { showToast } = useApp();

  // Period State
  const [period, setPeriod] = useState<PeriodType>('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // Active Workspace Tab: 'stream' | 'gaming' | 'treasury'
  const [activeTab, setActiveTab] = useState<'stream' | 'gaming' | 'treasury'>('stream');

  // Loading States
  const [isLoadingKPIs, setIsLoadingKPIs] = useState(true);
  const [isLoadingTrend, setIsLoadingTrend] = useState(true);
  const [isLoadingStream, setIsLoadingStream] = useState(true);
  const [isLoadingGaming, setIsLoadingGaming] = useState(false);
  const [isLoadingTreasury, setIsLoadingTreasury] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // PDF Modal State
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('daily');

  // Hovered Chart Day Index
  const [hoveredDayIdx, setHoveredDayIdx] = useState<number | null>(null);

  // Stream Filters & Pagination
  const [flowFilter, setFlowFilter] = useState<FlowFilterType>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Data States
  const [kpis, setKpis] = useState<CashflowReportKPIs | null>(null);
  const [trendBuckets, setTrendBuckets] = useState<Array<{
    date: string;
    label: string;
    inflow: number;
    outflow: number;
    net: number;
    ggr: number;
    pot: number;
  }>>([]);
  const [transactions, setTransactions] = useState<CashflowReportStreamItem[]>([]);
  const [gamingRooms, setGamingRooms] = useState<CashflowGamingRoomItem[]>([]);
  const [balanceSheet, setBalanceSheet] = useState<any>(null);

  // 1. Fetch KPIs
  const fetchKPIs = useCallback(async () => {
    try {
      setIsLoadingKPIs(true);
      const res = await apiClient.admin.getCashflowKPIs({
        period,
        from: period === 'custom' ? customFrom : undefined,
        to: period === 'custom' ? customTo : undefined
      });
      if (res && res.success && res.kpis) {
        setKpis(res.kpis);
      }
    } catch (err: any) {
      console.warn('Failed to load cashflow KPIs:', err);
    } finally {
      setIsLoadingKPIs(false);
    }
  }, [period, customFrom, customTo]);

  // 2. Fetch Trend Buckets
  const fetchTrend = useCallback(async () => {
    try {
      setIsLoadingTrend(true);
      const res = await apiClient.admin.getCashflowTrend({
        period,
        from: period === 'custom' ? customFrom : undefined,
        to: period === 'custom' ? customTo : undefined
      });
      if (res && res.success && res.buckets) {
        setTrendBuckets(res.buckets);
      }
    } catch (err: any) {
      console.warn('Failed to load cashflow trend:', err);
    } finally {
      setIsLoadingTrend(false);
    }
  }, [period, customFrom, customTo]);

  // 3. Fetch Transaction Stream
  const fetchStream = useCallback(async () => {
    try {
      setIsLoadingStream(true);
      const res = await apiClient.admin.getCashflowStream({
        period,
        from: period === 'custom' ? customFrom : undefined,
        to: period === 'custom' ? customTo : undefined,
        flow: flowFilter,
        category: categoryFilter,
        search: searchQuery.trim(),
        page: currentPage,
        limit: 20
      });
      if (res && res.success) {
        setTransactions(res.transactions || []);
        if (res.pagination) {
          setTotalPages(res.pagination.totalPages || 1);
          setTotalCount(res.pagination.total || 0);
        }
      }
    } catch (err: any) {
      console.warn('Failed to load cashflow stream:', err);
    } finally {
      setIsLoadingStream(false);
    }
  }, [period, customFrom, customTo, flowFilter, categoryFilter, searchQuery, currentPage]);

  // 4. Fetch Gaming Breakdown
  const fetchGaming = useCallback(async () => {
    try {
      setIsLoadingGaming(true);
      const res = await apiClient.admin.getCashflowGamingBreakdown({
        period,
        from: period === 'custom' ? customFrom : undefined,
        to: period === 'custom' ? customTo : undefined
      });
      if (res && res.success && res.rooms) {
        setGamingRooms(res.rooms);
      }
    } catch (err: any) {
      console.warn('Failed to load gaming breakdown:', err);
    } finally {
      setIsLoadingGaming(false);
    }
  }, [period, customFrom, customTo]);

  // 5. Fetch Treasury Balance Sheet
  const fetchTreasury = useCallback(async () => {
    try {
      setIsLoadingTreasury(true);
      const res = await apiClient.admin.getCashflowTreasuryBalance();
      if (res && res.success && res.balanceSheet) {
        setBalanceSheet(res.balanceSheet);
      }
    } catch (err: any) {
      console.warn('Failed to load treasury balance sheet:', err);
    } finally {
      setIsLoadingTreasury(false);
    }
  }, []);

  // Reload on filter changes
  useEffect(() => {
    fetchKPIs();
    fetchTrend();
    setCurrentPage(1);
  }, [fetchKPIs, fetchTrend]);

  useEffect(() => {
    fetchStream();
  }, [fetchStream]);

  useEffect(() => {
    if (activeTab === 'gaming') fetchGaming();
    if (activeTab === 'treasury') fetchTreasury();
  }, [activeTab, fetchGaming, fetchTreasury]);

  // Period label for reports
  const getPeriodLabel = () => {
    if (period === 'today') return 'Today (Day View)';
    if (period === 'yesterday') return 'Yesterday (Previous Day)';
    if (period === 'week') return 'Last 7 Days (Weekly Summary)';
    if (period === 'month') return 'Last 30 Days (Monthly Audit)';
    if (period === 'custom') return `Custom Range (${customFrom || 'Start'} to ${customTo || 'End'})`;
    return 'All Time Historical';
  };

  // Download PDF Action
  const handleDownloadPDF = () => {
    if (!kpis) {
      showToast('⚠️ No cashflow data loaded to generate PDF.');
      return;
    }
    try {
      setIsExporting(true);
      const options: CashflowReportOptions = {
        periodLabel: getPeriodLabel(),
        reportType: selectedReportType,
        generatedBy: 'Super Admin',
        kpis,
        rooms: gamingRooms.length > 0 ? gamingRooms : undefined,
        transactions
      };
      generateCashflowPDFReport(options);
      showToast('📄 Executive Cashflow PDF Report downloaded!');
      setShowReportModal(false);
    } catch (err: any) {
      showToast(`❌ Failed to generate PDF: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Export CSV Action
  const handleExportCSV = () => {
    if (transactions.length === 0) {
      showToast('⚠️ No transactions to export for the selected filter.');
      return;
    }
    try {
      exportCashflowToCSV(transactions);
      showToast(`📊 Exported ${transactions.length} transactions to CSV.`);
    } catch (err: any) {
      showToast(`❌ CSV Export failed: ${err.message}`);
    }
  };

  // Chart max value calculation for proportional bar heights
  const chartMaxVal = Math.max(
    ...trendBuckets.map(b => Math.max(b.inflow, b.outflow)),
    100
  );

  return (
    <div className="enqu-cashflow-desk">
      <style>{`
        .enqu-cashflow-desk {
          width: 100%;
          box-sizing: border-box;
          padding: 24px 28px;
          background: var(--panel, #e8e6e9);
          min-height: 100vh;
          font-family: 'Urbanist', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          color: #1b1b1b;
        }
        .enqu-cf-container {
          max-width: 1400px;
          margin: 0 auto;
          width: 100%;
        }

        /* Top Header */
        .enqu-cf-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 14px;
          margin-bottom: 22px;
        }
        .enqu-cf-title h1 {
          font-size: 26px;
          font-weight: 800;
          letter-spacing: -0.4px;
          margin: 0 0 4px 0;
          color: #1a1a1a;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .enqu-cf-title p {
          margin: 0;
          font-size: 13px;
          color: #6a6a6a;
          font-weight: 500;
        }

        .enqu-cf-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .enqu-cf-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 9px 18px;
          border-radius: 14px;
          font-size: 13.5px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          border: 0;
        }
        .enqu-cf-btn.primary {
          background: #10b981;
          color: #ffffff;
          box-shadow: 0 3px 8px rgba(16, 185, 129, 0.25);
        }
        .enqu-cf-btn.primary:hover {
          background: #059669;
          transform: translateY(-1px);
        }
        .enqu-cf-btn.secondary {
          background: #ffffff;
          color: #2a2a2a;
          border: 1px solid #dcdce0;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        .enqu-cf-btn.secondary:hover {
          background: #f6f6f8;
        }

        /* Time Travel Period Ribbon */
        .enqu-cf-period-ribbon {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #ffffff;
          border-radius: 18px;
          padding: 8px 12px;
          margin-bottom: 22px;
          border: 1px solid #e2e2e6;
          box-shadow: 0 2px 5px rgba(0,0,0,0.03);
          flex-wrap: wrap;
          gap: 10px;
        }
        .enqu-cf-pills {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .enqu-cf-pill {
          padding: 8px 16px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 700;
          color: #656565;
          background: transparent;
          border: 0;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .enqu-cf-pill:hover {
          background: #f0f0f4;
          color: #1b1b1b;
        }
        .enqu-cf-pill.active {
          background: #1c1e1d;
          color: #ffffff;
          box-shadow: 0 2px 6px rgba(0,0,0,0.12);
        }

        .enqu-cf-custom-range {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 600;
          color: #555;
        }
        .enqu-cf-custom-range input[type="date"] {
          border: 1px solid #d5d5db;
          border-radius: 10px;
          padding: 6px 10px;
          font-size: 12.5px;
          font-weight: 600;
          color: #1b1b1b;
          background: #f9f9fb;
        }

        /* 4 Executive KPI Cards */
        .enqu-cf-kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 22px;
        }
        .enqu-cf-kpi-card {
          background: #ffffff;
          border-radius: 20px;
          padding: 20px 22px;
          border: 1px solid #e5e5ea;
          box-shadow: 0 2px 7px rgba(0,0,0,0.03);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          position: relative;
          overflow: hidden;
        }
        .enqu-cf-kpi-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
        }
        .enqu-cf-kpi-card.inflows::before { background: #10b981; }
        .enqu-cf-kpi-card.outflows::before { background: #f43f5e; }
        .enqu-cf-kpi-card.net::before { background: #3b82f6; }
        .enqu-cf-kpi-card.liabilities::before { background: #f59e0b; }

        .enqu-cf-kpi-label {
          font-size: 13px;
          font-weight: 700;
          color: #6d6d72;
          margin-bottom: 6px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .enqu-cf-kpi-badge {
          font-size: 11px;
          font-weight: 800;
          padding: 3px 8px;
          border-radius: 8px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        .badge-green { background: #d1fae5; color: #047857; }
        .badge-rose { background: #ffe4e6; color: #be123c; }
        .badge-blue { background: #dbeafe; color: #1d4ed8; }
        .badge-amber { background: #fef3c7; color: #b45309; }

        .enqu-cf-kpi-val {
          font-size: 27px;
          font-weight: 800;
          letter-spacing: -0.6px;
          margin-bottom: 8px;
          color: #111827;
        }
        .enqu-cf-kpi-sub {
          font-size: 12px;
          color: #71717a;
          font-weight: 600;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        /* Trend Visual Chart Card */
        .enqu-cf-chart-card {
          background: #ffffff;
          border-radius: 20px;
          padding: 22px 24px;
          border: 1px solid #e5e5ea;
          box-shadow: 0 2px 7px rgba(0,0,0,0.03);
          margin-bottom: 22px;
        }
        .enqu-cf-chart-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 18px;
        }
        .enqu-cf-chart-top h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 800;
          color: #1b1b1b;
        }
        .enqu-cf-legend {
          display: flex;
          align-items: center;
          gap: 16px;
          font-size: 12.5px;
          font-weight: 700;
        }
        .legend-dot {
          display: inline-block;
          width: 10px;
          height: 10px;
          border-radius: 3px;
          margin-right: 6px;
        }

        .enqu-cf-bars-tray {
          display: flex;
          align-items: flex-end;
          gap: 8px;
          height: 170px;
          padding-top: 20px;
          border-bottom: 1px solid #e5e5ea;
          overflow-x: auto;
          position: relative;
        }
        .enqu-cf-bar-col {
          flex: 1;
          min-width: 28px;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          align-items: center;
          cursor: pointer;
          position: relative;
        }
        .enqu-cf-bars-group {
          display: flex;
          align-items: flex-end;
          gap: 3px;
          width: 100%;
          justify-content: center;
        }
        .bar-inflow {
          background: #10b981;
          border-radius: 4px 4px 0 0;
          width: 10px;
          transition: height 0.3s ease;
        }
        .bar-outflow {
          background: #f43f5e;
          border-radius: 4px 4px 0 0;
          width: 10px;
          transition: height 0.3s ease;
        }
        .bar-date-lbl {
          font-size: 10.5px;
          font-weight: 700;
          color: #8e8e93;
          margin-top: 8px;
          white-space: nowrap;
        }

        /* Tooltip */
        .enqu-cf-tooltip {
          position: absolute;
          bottom: 105%;
          background: #1c1e1d;
          color: #ffffff;
          padding: 8px 12px;
          border-radius: 10px;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
          box-shadow: 0 4px 12px rgba(0,0,0,0.25);
          z-index: 10;
          pointer-events: none;
        }

        /* Workspace Tabs */
        .enqu-cf-tabs-nav {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
        }
        .enqu-cf-tab-btn {
          padding: 10px 20px;
          border-radius: 14px;
          font-size: 14px;
          font-weight: 800;
          color: #666;
          background: #e2e2e6;
          border: 0;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .enqu-cf-tab-btn.active {
          background: #ffffff;
          color: #1b1b1b;
          box-shadow: 0 2px 6px rgba(0,0,0,0.06);
        }

        /* Stream Desk Table */
        .enqu-cf-table-card {
          background: #ffffff;
          border-radius: 20px;
          padding: 22px 24px;
          border: 1px solid #e5e5ea;
          box-shadow: 0 2px 7px rgba(0,0,0,0.03);
        }
        .enqu-cf-filter-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 18px;
        }
        .enqu-cf-search-box {
          display: flex;
          align-items: center;
          gap: 10px;
          flex: 1;
          max-width: 420px;
          background: #f4f4f6;
          border: 1px solid #dedee2;
          border-radius: 12px;
          padding: 8px 14px;
        }
        .enqu-cf-search-box input {
          border: 0;
          background: transparent;
          font-size: 13.5px;
          font-weight: 600;
          width: 100%;
          outline: none;
          color: #1b1b1b;
        }

        .enqu-cf-select {
          border: 1px solid #dedee2;
          border-radius: 12px;
          background: #f4f4f6;
          padding: 8px 14px;
          font-size: 13px;
          font-weight: 700;
          color: #2a2a2a;
          outline: none;
        }

        .enqu-table-wrapper {
          overflow-x: auto;
          margin-bottom: 16px;
        }
        .enqu-cf-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }
        .enqu-cf-table th {
          background: #f8f8fa;
          font-size: 11.5px;
          font-weight: 800;
          color: #71717a;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          padding: 12px 14px;
          border-bottom: 1px solid #e5e5ea;
        }
        .enqu-cf-table td {
          padding: 14px;
          font-size: 13px;
          color: #27272a;
          border-bottom: 1px solid #f0f0f4;
          font-weight: 600;
        }
        .enqu-cf-table tr:hover td {
          background: #fafafc;
        }

        .flow-pill {
          display: inline-block;
          font-size: 10.5px;
          font-weight: 800;
          padding: 3px 8px;
          border-radius: 7px;
          text-align: center;
          letter-spacing: 0.3px;
        }
        .flow-pill.inflow { background: #d1fae5; color: #065f46; }
        .flow-pill.outflow { background: #ffe4e6; color: #9f1239; }

        /* Pagination */
        .enqu-cf-pagination {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 10px;
        }
        .enqu-page-btn {
          padding: 7px 14px;
          border-radius: 10px;
          font-size: 12.5px;
          font-weight: 700;
          border: 1px solid #d4d4d8;
          background: #ffffff;
          cursor: pointer;
        }
        .enqu-page-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        /* Modal Backdrop */
        .enqu-cf-modal-bg {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          display: grid;
          place-items: center;
          z-index: 9999;
          padding: 20px;
        }
        .enqu-cf-modal {
          background: #ffffff;
          border-radius: 24px;
          padding: 28px;
          max-width: 500px;
          width: 100%;
          box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }

        @media (max-width: 1024px) {
          .enqu-cf-kpi-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 640px) {
          .enqu-cashflow-desk { padding: 16px; }
          .enqu-cf-kpi-grid { grid-template-columns: 1fr; }
          .enqu-cf-period-ribbon { flex-direction: column; align-items: stretch; }
        }
      `}</style>

      <div className="enqu-cf-container">
        {/* Top Header */}
        <div className="enqu-cf-header">
          <div className="enqu-cf-title">
            <h1>
              <span>📈</span>
              <span>Cashflow & Treasury Surveillance</span>
            </h1>
            <p>Full-Reserve Liquidity, Gross Gaming Revenue (GGR), and Disbursement Velocity</p>
          </div>

          <div className="enqu-cf-actions">
            <button
              type="button"
              className="enqu-cf-btn secondary"
              onClick={() => {
                fetchKPIs();
                fetchTrend();
                fetchStream();
                if (activeTab === 'gaming') fetchGaming();
                if (activeTab === 'treasury') fetchTreasury();
                showToast('🔄 Cashflow data refreshed from live ledger');
              }}
            >
              🔄 Refresh
            </button>
            <button
              type="button"
              className="enqu-cf-btn secondary"
              onClick={handleExportCSV}
            >
              📊 Export CSV
            </button>
            <button
              type="button"
              className="enqu-cf-btn primary"
              onClick={() => setShowReportModal(true)}
            >
              📄 Download PDF Report
            </button>
          </div>
        </div>

        {/* Time Travel Period Ribbon */}
        <div className="enqu-cf-period-ribbon">
          <div className="enqu-cf-pills">
            {(['today', 'yesterday', 'week', 'month', 'all', 'custom'] as PeriodType[]).map(p => (
              <button
                key={p}
                type="button"
                className={`enqu-cf-pill ${period === p ? 'active' : ''}`}
                onClick={() => setPeriod(p)}
              >
                {p === 'today' && 'Today'}
                {p === 'yesterday' && 'Yesterday'}
                {p === 'week' && '7 Days'}
                {p === 'month' && '30 Days'}
                {p === 'all' && 'All Time'}
                {p === 'custom' && '📅 Custom'}
              </button>
            ))}
          </div>

          {period === 'custom' && (
            <div className="enqu-cf-custom-range">
              <span>From:</span>
              <input
                type="date"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
              />
              <span>To:</span>
              <input
                type="date"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
              />
              <button
                type="button"
                className="enqu-cf-btn primary"
                style={{ padding: '6px 12px', fontSize: '12px' }}
                onClick={() => {
                  fetchKPIs();
                  fetchTrend();
                  fetchStream();
                }}
              >
                Apply
              </button>
            </div>
          )}
        </div>

        {/* 4 Executive KPI Cards */}
        <div className="enqu-cf-kpi-grid">
          {/* Card 1: Gross Inflows */}
          <div className="enqu-cf-kpi-card inflows">
            <div className="enqu-cf-kpi-label">
              <span>GROSS INFLOWS (+)</span>
              <span className="enqu-cf-kpi-badge badge-green">
                {kpis ? `+${formatInt(kpis.grossInflows.count)} txs` : '...'}
              </span>
            </div>
            <div className="enqu-cf-kpi-val" style={{ color: '#047857' }}>
              {isLoadingKPIs ? '...' : `ETB ${formatETB(kpis?.grossInflows.totalAmount || 0)}`}
            </div>
            <div className="enqu-cf-kpi-sub">
              <div>• Direct Deposits: ETB {formatETB(kpis?.grossInflows.directDeposits || 0)} ({kpis?.grossInflows.directDepositCount || 0})</div>
              <div>• Agent Recharges: ETB {formatETB(kpis?.grossInflows.agentRecharges || 0)} ({kpis?.grossInflows.agentRechargeCount || 0})</div>
            </div>
          </div>

          {/* Card 2: Gross Outflows */}
          <div className="enqu-cf-kpi-card outflows">
            <div className="enqu-cf-kpi-label">
              <span>GROSS OUTFLOWS (-)</span>
              <span className="enqu-cf-kpi-badge badge-rose">
                {kpis ? `-${formatInt(kpis.grossOutflows.count)} txs` : '...'}
              </span>
            </div>
            <div className="enqu-cf-kpi-val" style={{ color: '#be123c' }}>
              {isLoadingKPIs ? '...' : `ETB ${formatETB(kpis?.grossOutflows.totalAmount || 0)}`}
            </div>
            <div className="enqu-cf-kpi-sub">
              <div>• Player Withdrawals: ETB {formatETB(kpis?.grossOutflows.playerWithdrawals || 0)}</div>
              <div>• Agent Commission Payouts: ETB {formatETB(kpis?.grossOutflows.agentPayouts || 0)}</div>
            </div>
          </div>

          {/* Card 3: Net Cashflow */}
          <div className="enqu-cf-kpi-card net">
            <div className="enqu-cf-kpi-label">
              <span>NET CASH FLOW</span>
              <span className={`enqu-cf-kpi-badge ${kpis?.netCashFlow.status === 'surplus' ? 'badge-blue' : 'badge-rose'}`}>
                {kpis ? `${kpis.netCashFlow.marginPercent}% MARGIN` : '...'}
              </span>
            </div>
            <div className="enqu-cf-kpi-val" style={{ color: (kpis?.netCashFlow.amount || 0) >= 0 ? '#1d4ed8' : '#be123c' }}>
              {isLoadingKPIs ? '...' : `ETB ${formatETB(kpis?.netCashFlow.amount || 0)}`}
            </div>
            <div className="enqu-cf-kpi-sub">
              <div>• GGR (20% House Fee): ETB {formatETB(kpis?.gaming.ggr || 0)}</div>
              <div>• Player Derash (80% Won): ETB {formatETB(kpis?.gaming.playerWinnings || 0)}</div>
            </div>
          </div>

          {/* Card 4: Treasury Liabilities */}
          <div className="enqu-cf-kpi-card liabilities">
            <div className="enqu-cf-kpi-label">
              <span>TREASURY LIABILITIES</span>
              <span className="enqu-cf-kpi-badge badge-amber">
                {kpis?.liabilities.solvencyStatus || '100% BACKED'}
              </span>
            </div>
            <div className="enqu-cf-kpi-val" style={{ color: '#b45309' }}>
              {isLoadingKPIs ? '...' : `ETB ${formatETB(kpis?.liabilities.totalCirculatingLiabilities || 0)}`}
            </div>
            <div className="enqu-cf-kpi-sub">
              <div>• Player Wallets: ETB {formatETB(kpis?.liabilities.playerBalances || 0)} ({kpis?.liabilities.totalPlayers || 0})</div>
              <div>• Agent Float & Comm: ETB {formatETB((kpis?.liabilities.agentFloat || 0) + (kpis?.liabilities.agentCommissions || 0))}</div>
            </div>
          </div>
        </div>

        {/* Dynamic Visual Trend Chart Card */}
        <div className="enqu-cf-chart-card">
          <div className="enqu-cf-chart-top">
            <h3>Daily Cashflow Velocity (Inflows vs Outflows)</h3>
            <div className="enqu-cf-legend">
              <div><span className="legend-dot" style={{ background: '#10b981' }}></span>Inflows</div>
              <div><span className="legend-dot" style={{ background: '#f43f5e' }}></span>Outflows</div>
              <div><span className="legend-dot" style={{ background: '#3b82f6' }}></span>Net Margin</div>
            </div>
          </div>

          {isLoadingTrend ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
              Loading velocity trend...
            </div>
          ) : trendBuckets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
              No transactions recorded for this period.
            </div>
          ) : (
            <div className="enqu-cf-bars-tray">
              {trendBuckets.map((bucket, idx) => {
                const inHeightPct = Math.max(Math.min((bucket.inflow / chartMaxVal) * 100, 100), 4);
                const outHeightPct = Math.max(Math.min((bucket.outflow / chartMaxVal) * 100, 100), 4);
                const isHovered = hoveredDayIdx === idx;

                return (
                  <div
                    key={bucket.date}
                    className="enqu-cf-bar-col"
                    onMouseEnter={() => setHoveredDayIdx(idx)}
                    onMouseLeave={() => setHoveredDayIdx(null)}
                  >
                    {isHovered && (
                      <div className="enqu-cf-tooltip">
                        <div style={{ fontWeight: 800, marginBottom: '2px' }}>{bucket.label}</div>
                        <div style={{ color: '#34d399' }}>+ Inflow: {formatETB(bucket.inflow)} ETB</div>
                        <div style={{ color: '#f87171' }}>- Outflow: {formatETB(bucket.outflow)} ETB</div>
                        <div style={{ color: '#60a5fa' }}>Net: {formatETB(bucket.net)} ETB</div>
                      </div>
                    )}
                    <div className="enqu-cf-bars-group">
                      <div className="bar-inflow" style={{ height: `${inHeightPct}%` }}></div>
                      <div className="bar-outflow" style={{ height: `${outHeightPct}%` }}></div>
                    </div>
                    <div className="bar-date-lbl">
                      {bucket.date.slice(5)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Workspace 3-Tab Navigation Bar */}
        <div className="enqu-cf-tabs-nav">
          <button
            type="button"
            className={`enqu-cf-tab-btn ${activeTab === 'stream' ? 'active' : ''}`}
            onClick={() => setActiveTab('stream')}
          >
            📋 Unified Stream ({totalCount})
          </button>
          <button
            type="button"
            className={`enqu-cf-tab-btn ${activeTab === 'gaming' ? 'active' : ''}`}
            onClick={() => setActiveTab('gaming')}
          >
            🎲 Gaming & GGR Matrix
          </button>
          <button
            type="button"
            className={`enqu-cf-tab-btn ${activeTab === 'treasury' ? 'active' : ''}`}
            onClick={() => setActiveTab('treasury')}
          >
            🏦 Treasury & Solvency Sheet
          </button>
        </div>

        {/* Tab 1: Unified Stream Desk Table */}
        {activeTab === 'stream' && (
          <div className="enqu-cf-table-card">
            <div className="enqu-cf-filter-bar">
              {/* Flow Direction Pills */}
              <div className="enqu-cf-pills">
                <button
                  type="button"
                  className={`enqu-cf-pill ${flowFilter === 'all' ? 'active' : ''}`}
                  onClick={() => { setFlowFilter('all'); setCurrentPage(1); }}
                >
                  All Flows
                </button>
                <button
                  type="button"
                  className={`enqu-cf-pill ${flowFilter === 'inflow' ? 'active' : ''}`}
                  style={{ color: flowFilter === 'inflow' ? '#fff' : '#047857', background: flowFilter === 'inflow' ? '#047857' : '#ecfdf5' }}
                  onClick={() => { setFlowFilter('inflow'); setCurrentPage(1); }}
                >
                  🟢 Inflows Only
                </button>
                <button
                  type="button"
                  className={`enqu-cf-pill ${flowFilter === 'outflow' ? 'active' : ''}`}
                  style={{ color: flowFilter === 'outflow' ? '#fff' : '#be123c', background: flowFilter === 'outflow' ? '#be123c' : '#fff1f2' }}
                  onClick={() => { setFlowFilter('outflow'); setCurrentPage(1); }}
                >
                  🔴 Outflows Only
                </button>
              </div>

              {/* Category Filter Dropdown */}
              <select
                className="enqu-cf-select"
                value={categoryFilter}
                onChange={e => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
              >
                <option value="all">All Categories</option>
                <option value="deposit">Player Deposits</option>
                <option value="recharge">Agent Float Recharges</option>
                <option value="withdrawal">Player Withdrawals</option>
                <option value="payout">Agent Commission Payouts</option>
                <option value="p2p">P2P Cash-Outs</option>
              </select>

              {/* Search Bar */}
              <div className="enqu-cf-search-box">
                <span>🔍</span>
                <input
                  type="text"
                  placeholder="Search ref code, player, agent, phone..."
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    style={{ background: 'transparent', border: 0, cursor: 'pointer', color: '#999' }}
                    onClick={() => setSearchQuery('')}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="enqu-table-wrapper">
              <table className="enqu-cf-table">
                <thead>
                  <tr>
                    <th>Date / Time</th>
                    <th>Reference</th>
                    <th>Flow</th>
                    <th>Category</th>
                    <th>Rail / Method</th>
                    <th>Counterparty</th>
                    <th>Amount (ETB)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingStream ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: '#888' }}>
                        Loading real-time financial ledger...
                      </td>
                    </tr>
                  ) : transactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: '#888' }}>
                        No transactions found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    transactions.map(tx => (
                      <tr key={tx.id}>
                        <td style={{ color: '#71717a', fontSize: '12px' }}>{tx.dateFormatted}</td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{tx.refCode}</td>
                        <td>
                          <span className={`flow-pill ${tx.flow === 'INFLOW' ? 'inflow' : 'outflow'}`}>
                            {tx.flow === 'INFLOW' ? '+ INFLOW' : '- OUTFLOW'}
                          </span>
                        </td>
                        <td>{tx.category}</td>
                        <td>
                          <span style={{ background: '#f4f4f6', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>
                            {tx.method}
                          </span>
                        </td>
                        <td>
                          <div>{tx.name}</div>
                          <div style={{ fontSize: '11px', color: '#888' }}>{tx.contact} ({tx.role})</div>
                        </td>
                        <td style={{
                          textAlign: 'right',
                          color: tx.flow === 'INFLOW' ? '#047857' : '#be123c',
                          fontWeight: 800,
                          fontSize: '13.5px'
                        }}>
                          {tx.flow === 'INFLOW' ? '+' : '-'}{formatETB(tx.amount)} ETB
                        </td>
                        <td>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 700,
                            background: tx.status === 'completed' || tx.status === 'approved' || tx.status === 'paid' ? '#d1fae5' : '#fee2e2',
                            color: tx.status === 'completed' || tx.status === 'approved' || tx.status === 'paid' ? '#065f46' : '#991b1b'
                          }}>
                            {tx.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="enqu-cf-pagination">
              <span style={{ fontSize: '12.5px', color: '#71717a', fontWeight: 600 }}>
                Showing page {currentPage} of {totalPages} ({totalCount} total entries)
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="enqu-page-btn"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                >
                  ◀ Previous
                </button>
                <button
                  type="button"
                  className="enqu-page-btn"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                >
                  Next ▶
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Gaming Revenue & GGR Matrix */}
        {activeTab === 'gaming' && (
          <div className="enqu-cf-table-card">
            <h3 style={{ margin: '0 0 16px 0', fontSize: '17px', fontWeight: 800 }}>
              🎮 Gaming Turnover, Platform House Fee (20% GGR), and Player Prize Pool
            </h3>

            <div className="enqu-table-wrapper">
              <table className="enqu-cf-table">
                <thead>
                  <tr>
                    <th>Stake Room</th>
                    <th>Stake / Card</th>
                    <th>Rounds Played</th>
                    <th>Cartelas Sold</th>
                    <th>Gross Turnover</th>
                    <th>Platform Fee (20% GGR)</th>
                    <th>Player Payout (80% Derash)</th>
                    <th>RTP Ratio</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingGaming ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: '#888' }}>
                        Loading gaming metrics...
                      </td>
                    </tr>
                  ) : gamingRooms.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: '#888' }}>
                        No game rounds played in this timeframe.
                      </td>
                    </tr>
                  ) : (
                    gamingRooms.map(r => (
                      <tr key={r.roomId}>
                        <td style={{ fontWeight: 800 }}>{r.name}</td>
                        <td>{r.stake} ETB</td>
                        <td>{r.rounds}</td>
                        <td>{r.ticketsSold}</td>
                        <td style={{ fontWeight: 700 }}>ETB {formatETB(r.totalStaked)}</td>
                        <td style={{ color: '#047857', fontWeight: 800 }}>ETB {formatETB(r.houseFeeGgr)}</td>
                        <td style={{ color: '#1d4ed8', fontWeight: 700 }}>ETB {formatETB(r.playerPayouts)}</td>
                        <td style={{ fontWeight: 800 }}>{r.rtpPercent}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div style={{
              background: '#f8f8fa',
              padding: '16px 20px',
              borderRadius: '14px',
              marginTop: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div>
                <b style={{ color: '#1b1b1b' }}>House Commission Rule:</b>
                <span style={{ color: '#666', marginLeft: '6px' }}>Strict 80% to winner, 20% retained by platform as Gross Gaming Revenue (GGR).</span>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#047857' }}>
                Total Period GGR: ETB {formatETB(kpis?.gaming.ggr || 0)}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Treasury & Solvency Balance Sheet */}
        {activeTab === 'treasury' && (
          <div className="enqu-cf-table-card">
            <h3 style={{ margin: '0 0 16px 0', fontSize: '17px', fontWeight: 800 }}>
              🏦 Platform Treasury & Circulating Liability Balance Sheet
            </h3>

            {isLoadingTreasury ? (
              <div style={{ textAlign: 'center', padding: '36px', color: '#888' }}>
                Computing live balance sheet...
              </div>
            ) : balanceSheet ? (
              <div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '16px',
                  marginBottom: '20px'
                }}>
                  <div style={{ background: '#fcfcfd', border: '1px solid #e5e5ea', borderRadius: '16px', padding: '16px' }}>
                    <div style={{ fontSize: '12px', color: '#777', fontWeight: 700 }}>PLAYER CASH BALANCES</div>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: '#1b1b1b', margin: '6px 0' }}>
                      ETB {formatETB(balanceSheet.playerCashLiabilities)}
                    </div>
                    <div style={{ fontSize: '12px', color: '#555' }}>
                      {balanceSheet.playerCount} registered players ({balanceSheet.fundedPlayerCount} funded)
                    </div>
                  </div>

                  <div style={{ background: '#fcfcfd', border: '1px solid #e5e5ea', borderRadius: '16px', padding: '16px' }}>
                    <div style={{ fontSize: '12px', color: '#777', fontWeight: 700 }}>AGENT FLOAT LIABILITIES</div>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: '#1b1b1b', margin: '6px 0' }}>
                      ETB {formatETB(balanceSheet.agentFloatLiabilities)}
                    </div>
                    <div style={{ fontSize: '12px', color: '#555' }}>
                      {balanceSheet.agentCount} total agents ({balanceSheet.activeAgentCount} active)
                    </div>
                  </div>

                  <div style={{ background: '#fcfcfd', border: '1px solid #e5e5ea', borderRadius: '16px', padding: '16px' }}>
                    <div style={{ fontSize: '12px', color: '#777', fontWeight: 700 }}>UNPAID AGENT COMMISSIONS</div>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: '#1b1b1b', margin: '6px 0' }}>
                      ETB {formatETB(balanceSheet.agentCommissionLiabilities)}
                    </div>
                    <div style={{ fontSize: '12px', color: '#555' }}>
                      Earned agent commissions awaiting payout
                    </div>
                  </div>

                  <div style={{ background: '#fcfcfd', border: '1px solid #e5e5ea', borderRadius: '16px', padding: '16px' }}>
                    <div style={{ fontSize: '12px', color: '#777', fontWeight: 700 }}>PENDING ESCROW QUEUE</div>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: '#be123c', margin: '6px 0' }}>
                      ETB {formatETB(balanceSheet.pendingWithdrawalEscrow)}
                    </div>
                    <div style={{ fontSize: '12px', color: '#555' }}>
                      {balanceSheet.pendingWithdrawalCount} requests awaiting cashier decision
                    </div>
                  </div>
                </div>

                <div style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '16px',
                  padding: '20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '14px'
                }}>
                  <div>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 800, color: '#166534' }}>
                      🛡️ Solvency Reserve Status: {balanceSheet.solvencyStatus}
                    </h4>
                    <p style={{ margin: 0, fontSize: '13px', color: '#15803d' }}>
                      All customer and agent circulating liabilities are 100% matched with liquid reserves.
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', color: '#166534', fontWeight: 700 }}>TOTAL CIRCULATING LIABILITIES</div>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: '#14532d' }}>
                      ETB {formatETB(balanceSheet.totalCirculatingLiabilities)}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* PDF Download Selection Modal */}
      {showReportModal && (
        <div className="enqu-cf-modal-bg" onClick={() => setShowReportModal(false)}>
          <div className="enqu-cf-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Download Executive Audit Report</h3>
              <button
                type="button"
                style={{ background: 'transparent', border: 0, fontSize: '18px', cursor: 'pointer' }}
                onClick={() => setShowReportModal(false)}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '13.5px', color: '#666', marginTop: 0, marginBottom: '18px' }}>
              Select the audit format you wish to generate. All reports include verified SHA timestamps, KPI breakdowns, room GGR matrix, and official sign-off footers.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '22px' }}>
              {[
                { id: 'daily', label: '📄 Daily Cashflow Reconciliation Statement', desc: 'Reconciles today\'s deposits, withdrawals, and closing liabilities.' },
                { id: 'weekly', label: '📑 Weekly Financial Summary Report', desc: '7-day comparative analysis of gross inflows vs disbursements.' },
                { id: 'monthly', label: '📊 Monthly P&L Audit Statement', desc: 'Complete executive financial audit for accounting & tax compliance.' },
                { id: 'custom', label: '📅 Custom Period Statement', desc: `Generates statement matching currently active filter (${getPeriodLabel()}).` }
              ].map(opt => (
                <label
                  key={opt.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    border: selectedReportType === opt.id ? '2px solid #10b981' : '1px solid #e0e0e4',
                    background: selectedReportType === opt.id ? '#f0fdf4' : '#ffffff',
                    cursor: 'pointer'
                  }}
                >
                  <input
                    type="radio"
                    name="reportType"
                    checked={selectedReportType === opt.id}
                    onChange={() => setSelectedReportType(opt.id as any)}
                    style={{ marginTop: '3px' }}
                  />
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#1b1b1b' }}>{opt.label}</div>
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="enqu-cf-btn secondary"
                onClick={() => setShowReportModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="enqu-cf-btn primary"
                disabled={isExporting}
                onClick={handleDownloadPDF}
              >
                {isExporting ? 'Generating PDF...' : 'Download PDF Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

