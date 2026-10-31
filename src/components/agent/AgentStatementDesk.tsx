import React, { useState, useEffect } from 'react';
import { apiClient } from '../../services/apiClient.ts';

interface AgentStatementDeskProps {
  showToast: (msg: string) => void;
}

interface StatementItem {
  id: string;
  type: 'cash_in' | 'cash_out' | 'recharge';
  amount: number;
  payment_method: string;
  reference_code: string;
  agent_balance_after?: number;
  agent_commission_earned?: number;
  player_name?: string;
  player_phone?: string;
  created_at: string;
}

export const AgentStatementDesk: React.FC<AgentStatementDeskProps> = ({ showToast }) => {
  const [transactions, setTransactions] = useState<StatementItem[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'cash_in' | 'cash_out'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const fetchTransactions = async () => {
    try {
      setIsLoading(true);
      const res = await apiClient.agent.getTransactions();
      if (res.success && res.transactions) {
        setTransactions(res.transactions as StatementItem[]);
      }
    } catch (err) {
      console.error('Error fetching transactions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`📋 Copied ${label}: ${text}`);
  };

  // Compute metrics
  const totalCashIn = transactions
    .filter(t => t.type === 'cash_in')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const totalCashOut = transactions
    .filter(t => t.type === 'cash_out')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const totalCommission = transactions
    .filter(t => t.type === 'cash_out')
    .reduce((sum, t) => sum + Number(t.agent_commission_earned || 0), 0);

  // Filtered transactions
  const filtered = transactions.filter(t => {
    if (filterType !== 'all' && t.type !== filterType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const refMatch = t.reference_code?.toLowerCase().includes(q);
      const nameMatch = t.player_name?.toLowerCase().includes(q);
      const phoneMatch = t.player_phone?.includes(q);
      return refMatch || nameMatch || phoneMatch;
    }
    return true;
  });

  return (
    <div className="sonic-desk-container">
      {/* 1. Header with Stats Bar */}
      <div className="sonic-white-card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="sonic-badge-pill badge-primary">ACID LEDGER</span>
              <h2 style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                Financial Statements & Audit Trail
              </h2>
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>
              Comprehensive real-time ledger of player cash-ins, voucher cash-outs, and earned commissions.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchTransactions}
            disabled={isLoading}
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <i className={`fa-solid fa-rotate-right ${isLoading ? 'fa-spin' : ''}`}></i>
            <span>Refresh Ledger</span>
          </button>
        </div>

        {/* 3 Micro KPI Stat Chips */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>
              Total Cash-In Volume
            </div>
            <div style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>
              {totalCashIn.toLocaleString()} <span style={{ fontSize: '12px', color: '#94a3b8' }}>ETB</span>
            </div>
          </div>

          <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>
              Total Cash-Out Paid
            </div>
            <div style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>
              {totalCashOut.toLocaleString()} <span style={{ fontSize: '12px', color: '#94a3b8' }}>ETB</span>
            </div>
          </div>

          <div style={{ background: '#ecfdf5', padding: '12px 14px', borderRadius: '10px', border: '1px solid #a7f3d0' }}>
            <div style={{ fontSize: '11px', color: '#065f46', fontWeight: 800, textTransform: 'uppercase' }}>
              Counter Commission Earned (+1.5%)
            </div>
            <div style={{ fontSize: '18px', fontWeight: 900, color: '#059669', marginTop: '2px' }}>
              +{totalCommission.toFixed(2)} <span style={{ fontSize: '12px' }}>ETB</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Filter & Search Controls */}
      <div className="sonic-white-card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
            <input
              type="text"
              className="sonic-input-field"
              style={{ width: '100%', padding: '10px 14px 10px 36px', boxSizing: 'border-box' }}
              placeholder="Search by Ref Code, Player Phone, or Name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <i
              className="fa-solid fa-magnifying-glass"
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
            ></i>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            {(
              [
                { id: 'all', label: `All (${transactions.length})` },
                { id: 'cash_in', label: `Cash-In (${transactions.filter(t => t.type === 'cash_in').length})` },
                { id: 'cash_out', label: `Cash-Out (${transactions.filter(t => t.type === 'cash_out').length})` }
              ] as const
            ).map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterType(tab.id)}
                style={{
                  padding: '9px 14px',
                  borderRadius: '8px',
                  border: filterType === tab.id ? '1px solid #f59e0b' : '1px solid #e2e8f0',
                  background: filterType === tab.id ? '#fffbeb' : '#ffffff',
                  color: filterType === tab.id ? '#b45309' : '#64748b',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Transactions Table */}
      <div className="sonic-white-card" style={{ padding: 0, overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: '#94a3b8' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📜</div>
            <div style={{ fontWeight: 800, color: '#475569', fontSize: '14px' }}>No Transactions Found</div>
            <div style={{ fontSize: '12px', marginTop: '4px' }}>
              {transactions.length === 0
                ? 'Your agency ledger has no recorded cash-ins or cash-outs yet.'
                : 'No transactions match the selected filters or search query.'}
            </div>
          </div>
        ) : (
          <div className="sonic-table-shell" style={{ border: 'none', borderRadius: 0 }}>
            <table className="sonic-clean-table">
              <thead>
                <tr>
                  <th>Type & Reference</th>
                  <th>Player / Beneficiary</th>
                  <th>Amount (ETB)</th>
                  <th>Incentive / Balance</th>
                  <th>Method</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => {
                  const isCashIn = t.type === 'cash_in';
                  return (
                    <tr key={t.id}>
                      {/* Type & Ref */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            className="sonic-badge-pill"
                            style={{
                              background: isCashIn ? '#fef3c7' : '#dbeafe',
                              color: isCashIn ? '#92400e' : '#1e40af',
                              borderColor: isCashIn ? '#fde68a' : '#bfdbfe',
                              fontSize: '10px',
                              padding: '2px 6px'
                            }}
                          >
                            <i className={`fa-solid ${isCashIn ? 'fa-arrow-down' : 'fa-money-bill-transfer'}`} style={{ marginRight: '4px' }}></i>
                            {isCashIn ? 'CASH-IN' : 'CASH-OUT'}
                          </span>
                          <span
                            onClick={() => handleCopy(t.reference_code, 'Reference')}
                            style={{
                              fontFamily: 'monospace',
                              fontWeight: 800,
                              fontSize: '12px',
                              color: '#0f172a',
                              cursor: 'pointer',
                              textDecoration: 'underline dotted'
                            }}
                            title="Click to copy reference"
                          >
                            {t.reference_code}
                          </span>
                        </div>
                      </td>

                      {/* Player */}
                      <td>
                        <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '13px' }}>
                          {t.player_name || 'Direct Player'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                          {t.player_phone || '—'}
                        </div>
                      </td>

                      {/* Amount */}
                      <td>
                        <div
                          style={{
                            fontWeight: 900,
                            fontSize: '14px',
                            color: isCashIn ? '#0f172a' : '#2563eb'
                          }}
                        >
                          {Number(t.amount).toLocaleString()} ETB
                        </div>
                      </td>

                      {/* Incentive / Balance */}
                      <td>
                        {isCashIn ? (
                          t.agent_balance_after !== undefined ? (
                            <span style={{ fontSize: '11px', color: '#64748b' }}>
                              Float: {Number(t.agent_balance_after).toFixed(2)} ETB
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#d97706', fontWeight: 700 }}>
                              +{Math.round(t.amount * 1.5)} Coins
                            </span>
                          )
                        ) : (
                          <span style={{ fontSize: '11px', color: '#059669', fontWeight: 800, background: '#ecfdf5', padding: '2px 8px', borderRadius: '4px', border: '1px solid #a7f3d0' }}>
                            +{Number(t.agent_commission_earned || 0).toFixed(2)} ETB Comm
                          </span>
                        )}
                      </td>

                      {/* Payment Method */}
                      <td>
                        <span style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>
                          {t.payment_method || 'Sonic Internal'}
                        </span>
                      </td>

                      {/* Timestamp */}
                      <td>
                        <div style={{ fontSize: '12px', color: '#0f172a', fontWeight: 600 }}>
                          {new Date(t.created_at).toLocaleDateString()}
                        </div>
                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                          {new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
