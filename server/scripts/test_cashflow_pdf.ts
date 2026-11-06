import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { generateCashflowPDFReport, exportCashflowToCSV, CashflowReportOptions } from '../../src/utils/pdfReportGenerator.ts';

console.log('══════════════════════════════════════════════════════════════════');
console.log('🧪 TESTING PHASE 2: CASHFLOW PDF & CSV REPORT ENGINE');
console.log('══════════════════════════════════════════════════════════════════');

const mockOptions: CashflowReportOptions = {
  periodLabel: 'Today (Nov 07, 2026)',
  reportType: 'daily',
  generatedBy: 'Super Admin Test',
  kpis: {
    grossInflows: {
      totalAmount: 27558,
      count: 31,
      directDeposits: 22558,
      agentRecharges: 5000
    },
    grossOutflows: {
      totalAmount: 4310,
      count: 5,
      playerWithdrawals: 3000,
      agentPayouts: 1310,
      p2pCashouts: 0
    },
    netCashFlow: {
      amount: 23248,
      marginPercent: 84.36,
      status: 'surplus'
    },
    gaming: {
      ggr: 1064,
      playerWinnings: 4031,
      totalPot: 5095,
      turnover: 540,
      roundsCount: 23
    },
    liabilities: {
      playerBalances: 4440,
      playerBonuses: 500,
      agentFloat: 79070,
      agentCommissions: 940,
      pendingWithdrawals: 0,
      totalCirculatingLiabilities: 84950,
      solvencyStatus: '100% Fully Backed'
    },
    channels: {
      inflows: { telebirr: 18000, mpesa: 4558, cbe: 5000, agent: 0 },
      outflows: { telebirr: 2500, mpesa: 500, cbe: 0, agentPayouts: 1310 }
    }
  },
  rooms: [
    {
      roomId: 'room-10',
      name: '10 ETB Room',
      stake: 10,
      rounds: 23,
      ticketsSold: 54,
      totalStaked: 540,
      totalPot: 5095,
      houseFeeGgr: 1064,
      playerPayouts: 4031,
      rtpPercent: 79.1
    },
    {
      roomId: 'room-20',
      name: '20 ETB Room',
      stake: 20,
      rounds: 0,
      ticketsSold: 0,
      totalStaked: 0,
      totalPot: 0,
      houseFeeGgr: 0,
      playerPayouts: 0,
      rtpPercent: 80.0
    }
  ],
  transactions: [
    {
      id: 'tx-1',
      refCode: 'WD-c8165d7a',
      flow: 'OUTFLOW',
      category: 'Player Withdrawal',
      method: 'Telebirr',
      amount: 50,
      name: 'Eyu Ase',
      contact: '0983624574',
      role: 'player',
      status: 'approved',
      balanceAfter: 200,
      dateFormatted: 'Nov 07, 2026, 01:20 AM'
    },
    {
      id: 'tx-2',
      refCode: 'REC-12345678',
      flow: 'INFLOW',
      category: 'Agent Float Recharge',
      method: 'CBE',
      amount: 5000,
      name: 'Agent Eyob',
      contact: 'AGT-1517',
      role: 'agent',
      status: 'approved',
      balanceAfter: 15000,
      dateFormatted: 'Nov 07, 2026, 01:00 AM'
    }
  ]
};

// In Node environment, mock browser download
if (typeof window === 'undefined') {
  (globalThis as any).window = globalThis;
  (globalThis as any).document = {
    createElement: () => ({
      setAttribute: () => {},
      style: {},
      click: () => {}
    }),
    body: {
      appendChild: () => {},
      removeChild: () => {}
    }
  };
}

try {
  console.log('\n📄 Testing generateCashflowPDFReport function...');
  generateCashflowPDFReport(mockOptions);
  console.log('   ✓ PASS: generateCashflowPDFReport generated PDF without errors!');

  console.log('\n📊 Testing exportCashflowToCSV function...');
  exportCashflowToCSV(mockOptions.transactions, 'test_cashflow.csv');
  console.log('   ✓ PASS: exportCashflowToCSV executed and created CSV blob without errors!');

  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log('🎉 PHASE 2 PDF & CSV REPORT ENGINE TESTS PASSED WITH 100% SUCCESS!');
  console.log('══════════════════════════════════════════════════════════════════');
  process.exit(0);
} catch (err) {
  console.error('❌ Failed:', err);
  process.exit(1);
}
