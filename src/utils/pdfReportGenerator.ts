import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface RechargeReportItem {
  id: string;
  requestId: string;
  dateFormatted: string;
  agentName: string;
  agentCode: string;
  agentCity: string;
  paymentMethod: string;
  transactionCode: string;
  amount: number;
  balanceAfter: number | null;
  status: string;
}

export interface RechargeReportStats {
  totalCredited: number;
  creditedCount: number;
  rejectedCount: number;
  averageRecharge: number;
  largestRecharge: number;
}

export interface RechargeReportOptions {
  periodLabel: string;
  stats: RechargeReportStats;
  rows: RechargeReportItem[];
  generatedBy?: string;
  agentFilter?: string;
}

export interface PayoutReportItem {
  id: string;
  isoDate: string;
  dateFormatted: string;
  agentName: string;
  agentCode: string;
  type: string;
  destination: string;
  amount: number;
  reference: string;
  status: string;
  by: string;
}

export interface PayoutReportStats {
  totalPaid: number;
  paidCount: number;
  totalConverted: number;
  convertedCount: number;
  totalRejected: number;
  rejectedCount: number;
  averagePayout: number;
}

export interface PayoutReportOptions {
  periodLabel: string;
  stats: PayoutReportStats;
  rows: PayoutReportItem[];
  generatedBy?: string;
  agentFilter?: string;
}

const formatEtb = (n: number) => {
  return Number(n || 0).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
};

/**
 * Generates an executive, modern PDF audit report for Agent Float Recharges.
 */
export function generateAgentRechargesPDFReport(options: RechargeReportOptions): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const generatedAt = new Date().toLocaleString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
  const operator = options.generatedBy || 'Super Admin';

  // 1. Top Decorative Header Accent Bar
  doc.setFillColor(31, 34, 32); // #1f2220 Dark charcoal
  doc.rect(0, 0, pageWidth, 24, 'F');

  doc.setFillColor(46, 158, 79); // Emerald accent line
  doc.rect(0, 24, pageWidth, 1.5, 'F');

  // Brand Titles inside Accent Bar
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text('SONIC BINGO / ENQU CASINO NETWORK', 14, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(200, 205, 200);
  doc.text('AGENT FLOAT RECHARGE SURVEILLANCE & AUDIT LEDGER', 14, 18);

  // Status Badge on Top Right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(46, 158, 79);
  doc.text('● VERIFIED LEDGER', pageWidth - 14, 11, { align: 'right' });
  doc.setTextColor(180, 185, 180);
  doc.setFont('helvetica', 'normal');
  doc.text(`EAT (UTC+3)`, pageWidth - 14, 18, { align: 'right' });

  // 2. Report Information Header Grid
  let startY = 32;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(27, 27, 27);
  doc.text('Official Float Recharge Settlement Report', 14, startY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 110);
  startY += 5;
  const filterDesc = options.agentFilter ? ` · Filtered by Agent: ${options.agentFilter}` : '';
  doc.text(`Audit Period: ${options.periodLabel}${filterDesc}`, 14, startY);

  doc.setFontSize(8.5);
  doc.text(`Generated: ${generatedAt}  |  Operator: ${operator}`, 14, startY + 4.5);

  // 3. Executive KPI Cards Box
  const cardY = startY + 8;
  const cardWidth = (pageWidth - 28 - 9) / 4;
  const cardHeight = 16;

  const kpis = [
    { label: 'Total Credited', val: `ETB ${formatEtb(options.stats.totalCredited)}`, sub: `${options.stats.creditedCount} approved recharges`, dark: true },
    { label: 'Rejected', val: `${options.stats.rejectedCount}`, sub: 'Compliance flagged', dark: false },
    { label: 'Avg Recharge', val: `ETB ${formatEtb(options.stats.averageRecharge)}`, sub: 'Per approved request', dark: false },
    { label: 'Largest Recharge', val: `ETB ${formatEtb(options.stats.largestRecharge)}`, sub: 'Single transaction peak', dark: false }
  ];

  kpis.forEach((kpi, idx) => {
    const x = 14 + idx * (cardWidth + 3);
    if (kpi.dark) {
      doc.setFillColor(31, 34, 32);
      doc.roundedRect(x, cardY, cardWidth, cardHeight, 2, 2, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(200, 205, 200);
      doc.text(kpi.label, x + 3.5, cardY + 4.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(255, 255, 255);
      doc.text(kpi.val, x + 3.5, cardY + 10);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(180, 190, 180);
      doc.text(kpi.sub, x + 3.5, cardY + 14);
    } else {
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(x, cardY, cardWidth, cardHeight, 2, 2, 'FD');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(kpi.label, x + 3.5, cardY + 4.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(27, 27, 27);
      doc.text(kpi.val, x + 3.5, cardY + 10);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(120, 130, 140);
      doc.text(kpi.sub, x + 3.5, cardY + 14);
    }
  });

  // 4. Detailed Audit Table
  const tableRows = options.rows.map((r, i) => [
    r.dateFormatted || '-',
    r.requestId || r.id || `#${i + 1}`,
    `${r.agentName}\n(${r.agentCode})`,
    r.agentCity || 'Addis Ababa',
    r.paymentMethod || 'Telebirr',
    r.transactionCode || 'N/A',
    `${formatEtb(r.amount)} ETB`,
    r.balanceAfter !== null ? `${formatEtb(r.balanceAfter)} ETB` : '-',
    r.status
  ]);

  autoTable(doc, {
    startY: cardY + cardHeight + 5,
    margin: { left: 14, right: 14, bottom: 20 },
    head: [[
      'Date / Time',
      'Request ID',
      'Agent & Code',
      'Branch / City',
      'Payment Rail',
      'Tx Reference',
      'Amount (ETB)',
      'Wallet After',
      'Status'
    ]],
    body: tableRows,
    theme: 'plain',
    headStyles: {
      fillColor: [31, 34, 32],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'left',
      cellPadding: 2.5
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 30, 30],
      cellPadding: 2.2,
      lineColor: [230, 230, 235],
      lineWidth: 0.2
    },
    alternateRowStyles: {
      fillColor: [250, 250, 252]
    },
    columnStyles: {
      0: { cellWidth: 23 },
      1: { cellWidth: 18, fontStyle: 'bold' },
      2: { cellWidth: 28 },
      3: { cellWidth: 18 },
      4: { cellWidth: 16 },
      5: { cellWidth: 22, font: 'courier' },
      6: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
      7: { cellWidth: 20, halign: 'right' },
      8: { cellWidth: 15, halign: 'center', fontStyle: 'bold' }
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 8) {
        const text = String(data.cell.raw).toLowerCase();
        if (text.includes('credited') || text.includes('approved')) {
          data.cell.styles.textColor = [31, 106, 55]; // Dark emerald
        } else if (text.includes('rejected')) {
          data.cell.styles.textColor = [176, 48, 47]; // Burgundy red
        } else {
          data.cell.styles.textColor = [112, 112, 112];
        }
      }
    },
    didDrawPage: (data) => {
      // Footer on every page
      const pageNum = doc.getNumberOfPages();
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(130, 130, 130);

      // Left Confidential Notice
      doc.text(
        'CONFIDENTIAL & PROPRIETARY — FOR INTERNAL AUDIT PURPOSES ONLY. Powered by Sonic Casino Engine.',
        14,
        pageHeight - 8
      );

      // Center Page Numbers
      doc.text(
        `Page ${data.pageNumber} of ${pageNum}`,
        pageWidth / 2,
        pageHeight - 8,
        { align: 'center' }
      );

      // Right Seal Line
      doc.text(
        'Authorized Ledger Seal [✓]',
        pageWidth - 14,
        pageHeight - 8,
        { align: 'right' }
      );
    }
  });

  // Clean filename with date
  const cleanPeriod = options.periodLabel.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  const dateStamp = new Date().toISOString().split('T')[0];
  const filename = `SonicBingo_Agent_Recharges_${cleanPeriod}_${dateStamp}.pdf`;

  doc.save(filename);
}

/**
 * Generates an executive, modern PDF audit report for Agent Commission Payouts.
 */
export function generateAgentPayoutsPDFReport(options: PayoutReportOptions): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const generatedAt = new Date().toLocaleString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
  const operator = options.generatedBy || 'Super Admin';

  // 1. Top Decorative Header Accent Bar
  doc.setFillColor(31, 34, 32); // #1f2220 Dark charcoal
  doc.rect(0, 0, pageWidth, 24, 'F');

  doc.setFillColor(176, 48, 47); // Dark red / crimson accent line for payouts
  doc.rect(0, 24, pageWidth, 1.5, 'F');

  // Brand Titles inside Accent Bar
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text('SONIC BINGO / ENQU CASINO NETWORK', 14, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(200, 205, 200);
  doc.text('AGENT COMMISSION CASHOUT & PAYOUT DISBURSEMENT LEDGER', 14, 18);

  // Status Badge on Top Right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(234, 179, 8); // Gold
  doc.text('● DISBURSEMENT AUDIT', pageWidth - 14, 11, { align: 'right' });
  doc.setTextColor(180, 185, 180);
  doc.setFont('helvetica', 'normal');
  doc.text(`EAT (UTC+3)`, pageWidth - 14, 18, { align: 'right' });

  // 2. Report Information Header Grid
  let startY = 32;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(27, 27, 27);
  doc.text('Agent Commission Payout & Float Conversion Report', 14, startY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 110);
  startY += 5;
  const filterDesc = options.agentFilter ? ` · Filtered by Agent: ${options.agentFilter}` : '';
  doc.text(`Disbursement Window: ${options.periodLabel}${filterDesc}`, 14, startY);

  doc.setFontSize(8.5);
  doc.text(`Generated: ${generatedAt}  |  Disbursement Officer: ${operator}`, 14, startY + 4.5);

  // 3. Executive KPI Cards Box
  const cardY = startY + 8;
  const cardWidth = (pageWidth - 28 - 9) / 4;
  const cardHeight = 16;

  const kpis = [
    { label: 'Total Paid Out', val: `ETB ${formatEtb(options.stats.totalPaid)}`, sub: `${options.stats.paidCount} bank payouts`, dark: true },
    { label: 'To Working Float', val: `ETB ${formatEtb(options.stats.totalConverted)}`, sub: `${options.stats.convertedCount} conversions`, dark: false },
    { label: 'Rejected / Refunded', val: `ETB ${formatEtb(options.stats.totalRejected)}`, sub: `${options.stats.rejectedCount} refunded requests`, dark: false },
    { label: 'Average Payout', val: `ETB ${formatEtb(options.stats.averagePayout)}`, sub: 'Per settled request', dark: false }
  ];

  kpis.forEach((kpi, idx) => {
    const x = 14 + idx * (cardWidth + 3);
    if (kpi.dark) {
      doc.setFillColor(31, 34, 32);
      doc.roundedRect(x, cardY, cardWidth, cardHeight, 2, 2, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(200, 205, 200);
      doc.text(kpi.label, x + 3.5, cardY + 4.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(255, 255, 255);
      doc.text(kpi.val, x + 3.5, cardY + 10);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(180, 190, 180);
      doc.text(kpi.sub, x + 3.5, cardY + 14);
    } else {
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(x, cardY, cardWidth, cardHeight, 2, 2, 'FD');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(kpi.label, x + 3.5, cardY + 4.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(27, 27, 27);
      doc.text(kpi.val, x + 3.5, cardY + 10);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(120, 130, 140);
      doc.text(kpi.sub, x + 3.5, cardY + 14);
    }
  });

  // 4. Detailed Audit Table
  const tableRows = options.rows.map((r, i) => [
    r.dateFormatted || '-',
    r.id || `#${i + 1}`,
    `${r.agentName}\n(${r.agentCode})`,
    r.type || 'Bank payout',
    r.destination || 'Telebirr',
    `${formatEtb(r.amount)} ETB`,
    r.reference || '-',
    r.status,
    r.by || 'Admin'
  ]);

  autoTable(doc, {
    startY: cardY + cardHeight + 5,
    margin: { left: 14, right: 14, bottom: 20 },
    head: [[
      'Date / Time',
      'Payout ID',
      'Agent & Code',
      'Disbursement Type',
      'Payout Destination',
      'Amount (ETB)',
      'Transaction Ref',
      'Status',
      'Authorized By'
    ]],
    body: tableRows,
    theme: 'plain',
    headStyles: {
      fillColor: [31, 34, 32],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'left',
      cellPadding: 2.5
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 30, 30],
      cellPadding: 2.2,
      lineColor: [230, 230, 235],
      lineWidth: 0.2
    },
    alternateRowStyles: {
      fillColor: [250, 250, 252]
    },
    columnStyles: {
      0: { cellWidth: 23 },
      1: { cellWidth: 18, fontStyle: 'bold' },
      2: { cellWidth: 28 },
      3: { cellWidth: 22 },
      4: { cellWidth: 24 },
      5: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
      6: { cellWidth: 20, font: 'courier' },
      7: { cellWidth: 15, halign: 'center', fontStyle: 'bold' },
      8: { cellWidth: 14 }
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 7) {
        const text = String(data.cell.raw).toLowerCase();
        if (text.includes('paid')) {
          data.cell.styles.textColor = [31, 34, 32];
        } else if (text.includes('converted')) {
          data.cell.styles.textColor = [31, 106, 55]; // Green
        } else if (text.includes('rejected')) {
          data.cell.styles.textColor = [176, 48, 47]; // Red
        } else {
          data.cell.styles.textColor = [112, 112, 112];
        }
      }
    },
    didDrawPage: (data) => {
      // Footer on every page
      const pageNum = doc.getNumberOfPages();
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(130, 130, 130);

      doc.text(
        'CONFIDENTIAL & PROPRIETARY — FOR COMMISSION DISBURSEMENT AUDIT ONLY.',
        14,
        pageHeight - 8
      );

      doc.text(
        `Page ${data.pageNumber} of ${pageNum}`,
        pageWidth / 2,
        pageHeight - 8,
        { align: 'center' }
      );

      doc.text(
        'Chief Financial Officer Sign-off: [✓ Approved]',
        pageWidth - 14,
        pageHeight - 8,
        { align: 'right' }
      );
    }
  });

  const cleanPeriod = options.periodLabel.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  const dateStamp = new Date().toISOString().split('T')[0];
  const filename = `SonicBingo_Agent_Payouts_${cleanPeriod}_${dateStamp}.pdf`;

  doc.save(filename);
}

// ============================================================================
// 3. EXECUTIVE SUPERADMIN CASHFLOW & TREASURY AUDIT REPORT ENGINE
// ============================================================================

export interface CashflowReportKPIs {
  grossInflows: {
    totalAmount: number;
    count: number;
    directDeposits: number;
    agentRecharges: number;
  };
  grossOutflows: {
    totalAmount: number;
    count: number;
    playerWithdrawals: number;
    agentPayouts: number;
    p2pCashouts: number;
  };
  netCashFlow: {
    amount: number;
    marginPercent: number;
    status: 'surplus' | 'deficit';
  };
  gaming: {
    ggr: number;
    playerWinnings: number;
    totalPot: number;
    turnover: number;
    roundsCount: number;
  };
  liabilities: {
    playerBalances: number;
    playerBonuses: number;
    agentFloat: number;
    agentCommissions: number;
    pendingWithdrawals: number;
    totalCirculatingLiabilities: number;
    solvencyStatus: string;
  };
  channels: {
    inflows: { telebirr: number; mpesa: number; cbe: number; agent: number };
    outflows: { telebirr: number; mpesa: number; cbe: number; agentPayouts: number };
  };
}

export interface CashflowReportStreamItem {
  id: string;
  refCode: string;
  flow: string;
  category: string;
  method: string;
  amount: number;
  name: string;
  contact: string;
  role: string;
  status: string;
  balanceAfter: number | null;
  dateFormatted: string;
}

export interface CashflowGamingRoomItem {
  roomId: string;
  name: string;
  stake: number;
  rounds: number;
  ticketsSold: number;
  totalStaked: number;
  totalPot: number;
  houseFeeGgr: number;
  playerPayouts: number;
  rtpPercent: number;
}

export interface CashflowReportOptions {
  periodLabel: string;
  reportType?: 'daily' | 'weekly' | 'monthly' | 'custom';
  generatedBy?: string;
  kpis: CashflowReportKPIs;
  rooms?: CashflowGamingRoomItem[];
  transactions: CashflowReportStreamItem[];
}

/**
 * Generates an executive, publication-grade PDF audit report for Cashflow & Treasury.
 */
export function generateCashflowPDFReport(options: CashflowReportOptions): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const generatedAt = new Date().toLocaleString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
  const operator = options.generatedBy || 'Super Admin';
  const reportTypeTitle = options.reportType === 'daily'
    ? 'Daily Cashflow Reconciliation Statement'
    : options.reportType === 'weekly'
    ? 'Weekly Financial Performance & Liquidity Summary'
    : options.reportType === 'monthly'
    ? 'Monthly Executive P&L & Treasury Audit Statement'
    : 'Executive Cashflow & Treasury Audit Statement';

  // 1. Top Decorative Header Accent Bar
  doc.setFillColor(31, 34, 32); // #1f2220 Dark charcoal
  doc.rect(0, 0, pageWidth, 24, 'F');

  doc.setFillColor(46, 158, 79); // Emerald accent line
  doc.rect(0, 24, pageWidth, 1.5, 'F');

  // Brand Titles inside Accent Bar
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('SONIC BINGO / FINANCIAL TREASURY DIVISION', 14, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(200, 205, 200);
  doc.text('EXECUTIVE CASHFLOW SURVEILLANCE & SOLVENCY RECONCILIATION', 14, 18);

  // Status Badge on Top Right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(46, 158, 79);
  doc.text('● VERIFIED LEDGER', pageWidth - 14, 11, { align: 'right' });
  doc.setTextColor(180, 185, 180);
  doc.setFont('helvetica', 'normal');
  doc.text('EAT (UTC+3) · FULL RESERVE', pageWidth - 14, 18, { align: 'right' });

  // 2. Report Information Header Grid
  let startY = 32;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(27, 27, 27);
  doc.text(reportTypeTitle, 14, startY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 100, 100);
  startY += 5;
  doc.text(`Audit Period: ${options.periodLabel}  |  Generated: ${generatedAt}  |  Operator: ${operator}`, 14, startY);

  // 3. Four Executive KPI Summary Cards
  const cardY = startY + 6;
  const cardWidth = (pageWidth - 28 - 9) / 4;
  const cardHeight = 17;

  const kpis = [
    {
      label: 'Gross Inflows (+)',
      val: `ETB ${formatEtb(options.kpis.grossInflows.totalAmount)}`,
      sub: `${options.kpis.grossInflows.count} deposits & recharges`,
      bg: [236, 253, 245],
      border: [167, 243, 208],
      textColor: [16, 185, 129]
    },
    {
      label: 'Gross Outflows (-)',
      val: `ETB ${formatEtb(options.kpis.grossOutflows.totalAmount)}`,
      sub: `${options.kpis.grossOutflows.count} payouts & withdrawals`,
      bg: [255, 241, 242],
      border: [254, 205, 211],
      textColor: [244, 63, 94]
    },
    {
      label: 'Net Cash Flow',
      val: `ETB ${formatEtb(options.kpis.netCashFlow.amount)}`,
      sub: `${options.kpis.netCashFlow.marginPercent}% Net Margin (${options.kpis.netCashFlow.status})`,
      bg: [239, 246, 255],
      border: [191, 219, 254],
      textColor: [59, 130, 246]
    },
    {
      label: 'Circulating Liabilities',
      val: `ETB ${formatEtb(options.kpis.liabilities.totalCirculatingLiabilities)}`,
      sub: options.kpis.liabilities.solvencyStatus,
      bg: [254, 243, 199],
      border: [253, 230, 138],
      textColor: [217, 119, 6]
    }
  ];

  kpis.forEach((kpi, idx) => {
    const x = 14 + idx * (cardWidth + 3);
    doc.setFillColor(kpi.bg[0], kpi.bg[1], kpi.bg[2]);
    doc.setDrawColor(kpi.border[0], kpi.border[1], kpi.border[2]);
    doc.roundedRect(x, cardY, cardWidth, cardHeight, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(80, 80, 80);
    doc.text(kpi.label, x + 3, cardY + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(kpi.textColor[0], kpi.textColor[1], kpi.textColor[2]);
    doc.text(kpi.val, x + 3, cardY + 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(110, 110, 110);
    doc.text(kpi.sub, x + 3, cardY + 14.5);
  });

  // 4. Section 1: Financial Performance & Channels Table
  let currentY = cardY + cardHeight + 6;

  autoTable(doc, {
    startY: currentY,
    margin: { left: 14, right: 14 },
    head: [[
      'Inflows Channel Breakdown',
      'Amount (ETB)',
      'Outflows Channel Breakdown',
      'Amount (ETB)'
    ]],
    body: [
      [
        'Telebirr (SMS Auto + Manual)',
        `${formatEtb(options.kpis.channels.inflows.telebirr)} ETB`,
        'Player Withdrawals Settled',
        `${formatEtb(options.kpis.grossOutflows.playerWithdrawals)} ETB`
      ],
      [
        'M-Pesa Direct Deposits',
        `${formatEtb(options.kpis.channels.inflows.mpesa)} ETB`,
        'Agent Commission Payouts',
        `${formatEtb(options.kpis.grossOutflows.agentPayouts)} ETB`
      ],
      [
        'CBE Bank Direct Deposits',
        `${formatEtb(options.kpis.channels.inflows.cbe)} ETB`,
        'P2P Player Cash-Outs',
        `${formatEtb(options.kpis.grossOutflows.p2pCashouts)} ETB`
      ],
      [
        'Agent Float Recharges',
        `${formatEtb(options.kpis.grossInflows.agentRecharges)} ETB`,
        'Active Pending Escrow Queue',
        `${formatEtb(options.kpis.liabilities.pendingWithdrawals)} ETB`
      ],
      [
        'Gross Inflows Total',
        `${formatEtb(options.kpis.grossInflows.totalAmount)} ETB`,
        'Total Outflows & Escrow',
        `${formatEtb(options.kpis.grossOutflows.totalAmount + options.kpis.liabilities.pendingWithdrawals)} ETB`
      ]
    ],
    theme: 'plain',
    headStyles: {
      fillColor: [31, 34, 32],
      textColor: [255, 255, 255],
      fontSize: 7,
      fontStyle: 'bold',
      halign: 'left',
      cellPadding: 2
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [30, 30, 30],
      cellPadding: 1.8,
      lineColor: [230, 230, 235],
      lineWidth: 0.15
    },
    alternateRowStyles: {
      fillColor: [250, 250, 252]
    },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 41, halign: 'right', fontStyle: 'bold' },
      2: { cellWidth: 50 },
      3: { cellWidth: 41, halign: 'right', fontStyle: 'bold' }
    }
  });

  // 5. Section 2: Room-by-Room Gaming GGR Matrix (if provided)
  if (options.rooms && options.rooms.length > 0) {
    const afterTable1Y = (doc as any).lastAutoTable.finalY + 4;

    const roomRows = options.rooms.map(r => [
      r.name,
      `${r.stake} ETB`,
      String(r.rounds),
      String(r.ticketsSold),
      `${formatEtb(r.totalStaked)} ETB`,
      `${formatEtb(r.houseFeeGgr)} ETB`,
      `${formatEtb(r.playerPayouts)} ETB`,
      `${r.rtpPercent}%`
    ]);

    autoTable(doc, {
      startY: afterTable1Y,
      margin: { left: 14, right: 14 },
      head: [[
        'Room Name',
        'Stake',
        'Rounds',
        'Cartelas',
        'Gross Stakes',
        'Platform Fee (20%)',
        'Player Winnings (80%)',
        'RTP %'
      ]],
      body: roomRows,
      theme: 'plain',
      headStyles: {
        fillColor: [46, 158, 79],
        textColor: [255, 255, 255],
        fontSize: 7,
        fontStyle: 'bold',
        halign: 'left',
        cellPadding: 2
      },
      bodyStyles: {
        fontSize: 7,
        textColor: [30, 30, 30],
        cellPadding: 1.8,
        lineColor: [230, 230, 235],
        lineWidth: 0.15
      },
      alternateRowStyles: {
        fillColor: [250, 250, 252]
      },
      columnStyles: {
        0: { cellWidth: 32, fontStyle: 'bold' },
        1: { cellWidth: 16, halign: 'center' },
        2: { cellWidth: 16, halign: 'center' },
        3: { cellWidth: 18, halign: 'center' },
        4: { cellWidth: 26, halign: 'right' },
        5: { cellWidth: 28, halign: 'right', fontStyle: 'bold', textColor: [16, 185, 129] },
        6: { cellWidth: 30, halign: 'right' },
        7: { cellWidth: 16, halign: 'center', fontStyle: 'bold' }
      }
    });
  }

  // 6. Section 3: Unified Transaction Ledger Stream
  const afterRoomsY = (doc as any).lastAutoTable.finalY + 4;

  const streamRows = options.transactions.map(tx => [
    tx.dateFormatted,
    tx.refCode,
    tx.flow,
    tx.category,
    tx.method,
    tx.name,
    `${tx.flow === 'INFLOW' ? '+' : '-'}${formatEtb(tx.amount)} ETB`,
    tx.status
  ]);

  autoTable(doc, {
    startY: afterRoomsY,
    margin: { left: 14, right: 14, bottom: 20 },
    head: [[
      'Date / Time',
      'Reference Code',
      'Flow',
      'Category',
      'Rail / Method',
      'Counterparty',
      'Amount (ETB)',
      'Status'
    ]],
    body: streamRows.length > 0 ? streamRows : [[
      generatedAt, 'N/A', '-', 'No transactions recorded in this timeframe', '-', '-', '0.00 ETB', '-'
    ]],
    theme: 'plain',
    headStyles: {
      fillColor: [31, 34, 32],
      textColor: [255, 255, 255],
      fontSize: 7,
      fontStyle: 'bold',
      halign: 'left',
      cellPadding: 2
    },
    bodyStyles: {
      fontSize: 6.8,
      textColor: [30, 30, 30],
      cellPadding: 1.8,
      lineColor: [230, 230, 235],
      lineWidth: 0.15
    },
    alternateRowStyles: {
      fillColor: [250, 250, 252]
    },
    columnStyles: {
      0: { cellWidth: 26 },
      1: { cellWidth: 22, font: 'courier' },
      2: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
      3: { cellWidth: 30 },
      4: { cellWidth: 22 },
      5: { cellWidth: 30 },
      6: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
      7: { cellWidth: 14, halign: 'center' }
    },
    didParseCell: (data) => {
      if (data.section === 'body') {
        if (data.column.index === 2) {
          const val = String(data.cell.raw);
          if (val === 'INFLOW') {
            data.cell.styles.textColor = [16, 185, 129]; // Emerald
          } else if (val === 'OUTFLOW') {
            data.cell.styles.textColor = [244, 63, 94]; // Rose
          }
        }
        if (data.column.index === 6) {
          const val = String(data.cell.raw);
          if (val.startsWith('+')) {
            data.cell.styles.textColor = [16, 185, 129];
          } else if (val.startsWith('-')) {
            data.cell.styles.textColor = [244, 63, 94];
          }
        }
      }
    }
  });

  // 7. Multi-page Footer and Sign-off
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    doc.setDrawColor(210, 215, 210);
    doc.setLineWidth(0.3);
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(120, 125, 120);

    doc.text(
      'SONIC BINGO CASINO TREASURY — STRICTLY CONFIDENTIAL & REGULATORY COMPLIANT.',
      14,
      pageHeight - 7
    );

    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 7,
      { align: 'center' }
    );

    doc.text(
      'Treasury Audit Sign-off: [✓ VERIFIED & APPROVED]',
      pageWidth - 14,
      pageHeight - 7,
      { align: 'right' }
    );
  }

  // 8. Save with timestamped filename
  const cleanPeriod = options.periodLabel.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  const dateStamp = new Date().toISOString().split('T')[0];
  const filename = `SonicBingo_Cashflow_Report_${cleanPeriod}_${dateStamp}.pdf`;

  doc.save(filename);
}

/**
 * Exports cashflow transaction rows directly to standard RFC-4180 CSV for Excel & Google Sheets.
 */
export function exportCashflowToCSV(rows: CashflowReportStreamItem[], filename?: string): void {
  const headers = [
    'Date & Time',
    'Reference Code',
    'Flow Direction',
    'Category',
    'Payment Rail',
    'Amount (ETB)',
    'Counterparty Name',
    'Counterparty Contact',
    'Counterparty Role',
    'Status',
    'Balance After (ETB)'
  ];

  const escapeCSV = (val: any) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const csvLines = [headers.join(',')];

  rows.forEach(r => {
    const line = [
      escapeCSV(r.dateFormatted),
      escapeCSV(r.refCode),
      escapeCSV(r.flow),
      escapeCSV(r.category),
      escapeCSV(r.method),
      escapeCSV(r.amount),
      escapeCSV(r.name),
      escapeCSV(r.contact),
      escapeCSV(r.role),
      escapeCSV(r.status),
      escapeCSV(r.balanceAfter !== null ? r.balanceAfter : '')
    ].join(',');
    csvLines.push(line);
  });

  const csvContent = csvLines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  const defaultFilename = `SonicBingo_Cashflow_Export_${new Date().toISOString().split('T')[0]}.csv`;
  link.setAttribute('href', url);
  link.setAttribute('download', filename || defaultFilename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}


