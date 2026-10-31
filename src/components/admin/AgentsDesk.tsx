import React, { useState, useEffect } from 'react';
import { useAdmin } from '../../context/AdminContext.tsx';
import { useApp } from '../../context/AppContext.tsx';
import { apiClient } from '../../services/apiClient.ts';

interface AgentRecord {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  agent_code: string;
  status: 'active' | 'suspended' | 'pending';
  wallet_balance: number;
  initial_deposit: number;
  low_balance_threshold: number;
  target_monthly: number;
  commission_rate: number;
  total_players: number;
  active_players: number;
  total_volume_deposited: number;
  refLink: string;
  created_at: string;
}

export const AgentsDesk: React.FC = () => {
  const { adminToken } = useAdmin();
  const { showToast } = useApp();

  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // New Agent Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newDeposit, setNewDeposit] = useState('10000');
  const [newTarget, setNewTarget] = useState('50000');
  const [newCommission, setNewCommission] = useState('5');
  const [newCustomCode, setNewCustomCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAgents = async () => {
    try {
      setLoading(true);
      const data = await apiClient.admin.getAgents();
      if (data && data.success) {
        setAgents(data.agents || []);
      }
    } catch (err) {
      console.error('Failed to fetch agents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) {
      showToast('❌ Full name and phone are required');
      return;
    }

    try {
      setIsSubmitting(true);
      const data = await apiClient.admin.createAgent({
        fullName: newName.trim(),
        phone: newPhone.trim(),
        initialDeposit: parseFloat(newDeposit) || 10000,
        targetMonthly: parseFloat(newTarget) || 50000,
        commissionRate: parseFloat(newCommission) || 5,
        customCode: newCustomCode.trim() || undefined
      });
      if (data && data.success) {
        showToast(`🎉 Agent ${data.agent?.agent_code || ''} created successfully!`);
        setShowCreateModal(false);
        setNewName('');
        setNewPhone('');
        setNewCustomCode('');
        fetchAgents();
      } else {
        showToast(`❌ ${data?.error || 'Failed to create agent'}`);
      }
    } catch (err: any) {
      showToast(`❌ Error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (agent: AgentRecord) => {
    const nextStatus = agent.status === 'active' ? 'suspended' : 'active';
    try {
      const data = await apiClient.admin.setAgentStatus(agent.id, nextStatus);
      if (data && data.success) {
        showToast(`Agent ${agent.agent_code} is now ${nextStatus}`);
        fetchAgents();
      } else {
        showToast(`❌ ${data?.error || 'Status update failed'}`);
      }
    } catch (err: any) {
      showToast(`❌ Error: ${err.message}`);
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`📋 Copied ${label} to clipboard!`);
  };

  const totalAgentFloat = agents.reduce((acc, a) => acc + (a.wallet_balance || 0), 0);
  const totalVolume = agents.reduce((acc, a) => acc + (a.total_volume_deposited || 0), 0);
  const totalReferredPlayers = agents.reduce((acc, a) => acc + (a.total_players || 0), 0);

  return (
    <div className="admin-subpage-wrap animate-fadeIn">
      {/* 1. Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #064e3b 0%, #047857 50%, #10b981 100%)',
        borderRadius: '16px',
        padding: '24px',
        color: '#ffffff',
        marginBottom: '24px',
        boxShadow: '0 10px 25px -5px rgba(4, 120, 87, 0.3)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span style={{ fontSize: '1.75rem' }}>🤝</span>
            <h2 style={{ fontSize: '1.375rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
              Decentralized Agents Management Desk
            </h2>
          </div>
          <p style={{ margin: 0, color: '#d1fae5', fontSize: '0.875rem' }}>
            የወኪሎች ምዝገባ፣ የካሽ-ኢን ፍሎት ዋሌት፣ የተጫዋቾች ድርሻ እና የወር የኮሚሽን ኢላማ ቁጥጥር
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          style={{
            backgroundColor: '#ffffff',
            color: '#065f46',
            padding: '10px 20px',
            borderRadius: '10px',
            border: 'none',
            fontWeight: 800,
            fontSize: '0.875rem',
            cursor: 'pointer',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <i className="fa-solid fa-user-plus"></i>
          Register New Agent
        </button>
      </div>

      {/* 2. Key Metrics Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div style={{ backgroundColor: '#ffffff', padding: '18px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Total Agents</div>
          <div style={{ fontSize: '1.625rem', fontWeight: 900, color: '#0f172a', marginTop: '4px' }}>
            {agents.length} <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#059669' }}>({agents.filter(a => a.status === 'active').length} Active)</span>
          </div>
        </div>

        <div style={{ backgroundColor: '#ffffff', padding: '18px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Total Agent Float Balance</div>
          <div style={{ fontSize: '1.625rem', fontWeight: 900, color: '#047857', marginTop: '4px' }}>
            {totalAgentFloat.toLocaleString()} <span style={{ fontSize: '0.875rem', fontWeight: 700 }}>ETB</span>
          </div>
        </div>

        <div style={{ backgroundColor: '#ffffff', padding: '18px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Total Volume Deposited</div>
          <div style={{ fontSize: '1.625rem', fontWeight: 900, color: '#3b82f6', marginTop: '4px' }}>
            {totalVolume.toLocaleString()} <span style={{ fontSize: '0.875rem', fontWeight: 700 }}>ETB</span>
          </div>
        </div>

        <div style={{ backgroundColor: '#ffffff', padding: '18px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Referred Players</div>
          <div style={{ fontSize: '1.625rem', fontWeight: 900, color: '#8b5cf6', marginTop: '4px' }}>
            {totalReferredPlayers.toLocaleString()}
          </div>
        </div>
      </div>

      {/* 3. Agents Table */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.04)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
            Registered Agent Profiles
          </h3>
          <button
            type="button"
            onClick={fetchAgents}
            style={{ padding: '6px 12px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600 }}
          >
            <i className="fa-solid fa-rotate-right"></i> Refresh
          </button>
        </div>

        {agents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
            <i className="fa-solid fa-users" style={{ fontSize: '2.5rem', marginBottom: '12px', color: '#cbd5e1' }}></i>
            <p style={{ margin: 0, fontWeight: 600 }}>No agents registered yet.</p>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8125rem' }}>
              Click "Register New Agent" above to add your first decentralized deposit agent.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 12px' }}>Agent Code</th>
                  <th style={{ padding: '10px 12px' }}>Name & Phone</th>
                  <th style={{ padding: '10px 12px' }}>Wallet Float</th>
                  <th style={{ padding: '10px 12px' }}>Players (Active)</th>
                  <th style={{ padding: '10px 12px' }}>Volume (ETB)</th>
                  <th style={{ padding: '10px 12px' }}>Monthly Target</th>
                  <th style={{ padding: '10px 12px' }}>Status</th>
                  <th style={{ padding: '10px 12px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {agents.map(a => {
                  const isLow = a.wallet_balance <= a.low_balance_threshold;
                  return (
                    <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px', fontWeight: 800, color: '#0f172a' }}>
                        <span style={{ backgroundColor: '#f1f5f9', padding: '4px 8px', borderRadius: '6px', fontFamily: 'monospace' }}>
                          {a.agent_code}
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{a.full_name}</div>
                        <div style={{ color: '#64748b', fontSize: '0.75rem' }}>{a.phone}</div>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ fontWeight: 800, color: isLow ? '#dc2626' : '#047857' }}>
                          {a.wallet_balance.toLocaleString()} ETB
                        </div>
                        {isLow && (
                          <span style={{ fontSize: '0.6875rem', color: '#dc2626', fontWeight: 700 }}>
                            ⚠️ Low Balance Alert
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px', color: '#334155' }}>
                        <strong>{a.total_players}</strong> <span style={{ color: '#059669', fontSize: '0.75rem' }}>({a.active_players} deposited)</span>
                      </td>
                      <td style={{ padding: '12px', fontWeight: 700, color: '#3b82f6' }}>
                        {a.total_volume_deposited.toLocaleString()} ETB
                      </td>
                      <td style={{ padding: '12px', color: '#64748b' }}>
                        <div>{a.target_monthly.toLocaleString()} ETB</div>
                        <span style={{ fontSize: '0.6875rem', color: '#047857', fontWeight: 700 }}>{a.commission_rate}% Comm</span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          backgroundColor: a.status === 'active' ? '#ecfdf5' : '#fef2f2',
                          color: a.status === 'active' ? '#047857' : '#b91c1c',
                          padding: '3px 10px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          textTransform: 'capitalize'
                        }}>
                          {a.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => handleCopy(a.refLink, 'Referral Link')}
                            title="Copy Agent Bot Invite Link"
                            style={{
                              padding: '6px 10px',
                              backgroundColor: '#e0f2fe',
                              border: 'none',
                              borderRadius: '6px',
                              color: '#0369a1',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              cursor: 'pointer'
                            }}
                          >
                            <i className="fa-solid fa-link"></i> Link
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(a)}
                            title={a.status === 'active' ? 'Suspend Agent' : 'Activate Agent'}
                            style={{
                              padding: '6px 10px',
                              backgroundColor: a.status === 'active' ? '#fee2e2' : '#dcfce7',
                              border: 'none',
                              borderRadius: '6px',
                              color: a.status === 'active' ? '#b91c1c' : '#15803d',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              cursor: 'pointer'
                            }}
                          >
                            {a.status === 'active' ? 'Suspend' : 'Activate'}
                          </button>
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

      {/* 4. Create Agent Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          backdropFilter: 'blur(4px)'
        }}>
          <form
            onSubmit={handleCreateAgent}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '28px',
              width: '90%',
              maxWidth: '480px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
            }}
          >
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 6px 0', color: '#0f172a' }}>
              Register New Deposit Agent
            </h3>
            <p style={{ margin: '0 0 20px 0', color: '#64748b', fontSize: '0.8125rem' }}>
              Create an agent profile with a pre-funded wallet float (Default: 10,000 ETB).
            </p>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Agent Full Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Samuel Kebede"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.875rem', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Phone Number * (used for portal login)
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 0911223344"
                value={newPhone}
                onChange={e => setNewPhone(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.875rem', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Initial Float (ETB)
                </label>
                <input
                  type="number"
                  value={newDeposit}
                  onChange={e => setNewDeposit(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.875rem', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Commission Rate (%)
                </label>
                <input
                  type="number"
                  value={newCommission}
                  onChange={e => setNewCommission(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.875rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Monthly Target (ETB)
                </label>
                <input
                  type="number"
                  value={newTarget}
                  onChange={e => setNewTarget(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.875rem', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Custom Code (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. AGT-SAMUEL"
                  value={newCustomCode}
                  onChange={e => setNewCustomCode(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.875rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ flex: 1, padding: '12px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '10px', fontWeight: 700, color: '#475569', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                style={{ flex: 1, padding: '12px', backgroundColor: '#047857', border: 'none', borderRadius: '10px', fontWeight: 700, color: '#ffffff', cursor: 'pointer' }}
              >
                {isSubmitting ? 'Registering...' : 'Confirm Registration'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

