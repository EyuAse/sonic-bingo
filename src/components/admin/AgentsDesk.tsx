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

interface CreatedCredentials {
  agentCode: string;
  fullName: string;
  phone: string;
  password: string;
  refLink: string;
}

export const AgentsDesk: React.FC = () => {
  const { adminToken } = useAdmin();
  const { showToast } = useApp();

  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // New Agent Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [newDeposit, setNewDeposit] = useState('10000');
  const [newTarget, setNewTarget] = useState('50000');
  const [newCommission, setNewCommission] = useState('5');
  const [newCustomCode, setNewCustomCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Credentials Handover Modal State
  const [createdCredentials, setCreatedCredentials] = useState<CreatedCredentials | null>(null);

  // Edit Agent Modal State
  const [editingAgent, setEditingAgent] = useState<AgentRecord | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCommission, setEditCommission] = useState('');
  const [editTarget, setEditTarget] = useState('');
  const [editThreshold, setEditThreshold] = useState('');
  const [editFloat, setEditFloat] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'suspended'>('active');
  const [editPassword, setEditPassword] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Delete Confirmation State
  const [deletingAgent, setDeletingAgent] = useState<AgentRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let randomPart = '';
    for (let i = 0; i < 4; i++) {
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const numPart = Math.floor(1000 + Math.random() * 9000);
    return `Sonic@${numPart}`;
  };

  const handleOpenCreateModal = () => {
    setNewName('');
    setNewPhone('');
    setNewPassword(generateRandomPassword());
    setShowNewPassword(true);
    setNewDeposit('10000');
    setNewTarget('50000');
    setNewCommission('5');
    setNewCustomCode('');
    setShowCreateModal(true);
  };

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
        password: newPassword.trim() || undefined,
        initialDeposit: parseFloat(newDeposit) || 10000,
        targetMonthly: parseFloat(newTarget) || 50000,
        commissionRate: parseFloat(newCommission) || 5,
        customCode: newCustomCode.trim() || undefined
      });

      if (data && data.success) {
        showToast(`🎉 Agent ${data.agent?.agent_code || ''} created successfully!`);
        setShowCreateModal(false);

        // Open Credentials Handover Modal
        setCreatedCredentials({
          agentCode: data.agent?.agent_code || 'AGT-XXXX',
          fullName: newName.trim(),
          phone: newPhone.trim(),
          password: data.agent?.initialPassword || newPassword.trim(),
          refLink: data.agent?.refLink || `https://t.me/SonicGameOfficialBot?start=agent_${data.agent?.agent_code}`
        });

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

  const handleOpenEdit = (a: AgentRecord) => {
    setEditingAgent(a);
    setEditName(a.full_name);
    setEditPhone(a.phone);
    setEditCommission(String(a.commission_rate));
    setEditTarget(String(a.target_monthly));
    setEditThreshold(String(a.low_balance_threshold));
    setEditFloat(String(a.wallet_balance));
    setEditStatus(a.status === 'suspended' ? 'suspended' : 'active');
    setEditPassword('');
    setShowEditPassword(false);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAgent) return;

    try {
      setIsSavingEdit(true);
      const res = await apiClient.admin.updateAgent(editingAgent.id, {
        fullName: editName.trim(),
        phone: editPhone.trim(),
        commissionRate: parseFloat(editCommission) || 5,
        targetMonthly: parseFloat(editTarget) || 50000,
        lowBalanceThreshold: parseFloat(editThreshold) || 1000,
        walletBalance: parseFloat(editFloat) >= 0 ? parseFloat(editFloat) : undefined,
        status: editStatus,
        password: editPassword.trim() ? editPassword.trim() : undefined
      });

      if (res && res.success) {
        showToast(`✅ Agent ${editingAgent.agent_code} updated successfully!`);
        setEditingAgent(null);
        fetchAgents();
      } else {
        showToast(`❌ ${res?.error || 'Update failed'}`);
      }
    } catch (err: any) {
      showToast(`❌ Error: ${err.message}`);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteAgent = async () => {
    if (!deletingAgent) return;

    try {
      setIsDeleting(true);
      const res = await apiClient.admin.deleteAgent(deletingAgent.id);
      if (res && res.success) {
        showToast(`🗑️ Agent ${deletingAgent.agent_code} removed successfully`);
        setDeletingAgent(null);
        fetchAgents();
      } else {
        showToast(`❌ ${res?.error || 'Failed to delete agent'}`);
      }
    } catch (err: any) {
      showToast(`❌ Error: ${err.message}`);
    } finally {
      setIsDeleting(false);
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

  const handleCopyHandoverMessage = () => {
    if (!createdCredentials) return;
    const msg = `🎉 Sonic Bingo Agent Onboarding Credentials:
━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 Name: ${createdCredentials.fullName}
🏷️ Agent Code: ${createdCredentials.agentCode}
📱 Login Phone: ${createdCredentials.phone}
🔑 Initial Password: ${createdCredentials.password}
🤖 Telegram Bot: ${createdCredentials.refLink}
━━━━━━━━━━━━━━━━━━━━━━━━━━
Log into your Agent Portal to accept player deposits, issue cash-ins, and earn commissions!`;
    navigator.clipboard.writeText(msg);
    showToast('📋 Copied full handover message to clipboard!');
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
            የወኪሎች ምዝገባ፣ የይለፍ ቃል አመዳደብ፣ የካሽ-ኢን ፍሎት ዋሌት፣ የተጫዋቾች ድርሻ እና የወር የኮሚሽን ኢላማ ቁጥጥር
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreateModal}
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
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
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
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          {/* Copy Bot Link */}
                          <button
                            type="button"
                            onClick={() => handleCopy(a.refLink, 'Referral Link')}
                            title="Copy Agent Bot Invite Link"
                            style={{
                              padding: '5px 8px',
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

                          {/* Edit Agent */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(a)}
                            title="Edit Agent Information & Settings"
                            style={{
                              padding: '5px 8px',
                              backgroundColor: '#fef3c7',
                              border: 'none',
                              borderRadius: '6px',
                              color: '#b45309',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              cursor: 'pointer'
                            }}
                          >
                            <i className="fa-solid fa-pen-to-square"></i> Edit
                          </button>

                          {/* Toggle Active / Suspend */}
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(a)}
                            title={a.status === 'active' ? 'Suspend Agent' : 'Activate Agent'}
                            style={{
                              padding: '5px 8px',
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

                          {/* Delete Agent */}
                          <button
                            type="button"
                            onClick={() => setDeletingAgent(a)}
                            title="Delete Agent"
                            style={{
                              padding: '5px 8px',
                              backgroundColor: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              color: '#ef4444',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              cursor: 'pointer'
                            }}
                          >
                            <i className="fa-solid fa-trash-can"></i>
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

      {/* 4. Register New Agent Modal */}
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
              maxWidth: '500px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                Register New Deposit Agent
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', color: '#94a3b8', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <p style={{ margin: '0 0 18px 0', color: '#64748b', fontSize: '0.8125rem' }}>
              Assign an initial password and set up the agent's float wallet and commission terms.
            </p>

            {/* Agent Full Name */}
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

            {/* Phone Number */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Phone Number * (used for login)
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

            {/* Initial Password with Auto-Generate */}
            <div style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#334155' }}>
                  Initial Password *
                </label>
                <button
                  type="button"
                  onClick={() => setNewPassword(generateRandomPassword())}
                  style={{
                    background: '#ecfdf5',
                    color: '#047857',
                    border: '1px solid #a7f3d0',
                    borderRadius: '6px',
                    padding: '2px 8px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  🎲 Auto-Generate
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  placeholder="Set initial password (min 4 chars)"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 38px 10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.875rem',
                    boxSizing: 'border-box',
                    fontFamily: showNewPassword ? 'monospace' : 'inherit',
                    fontWeight: 600
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    fontSize: '0.875rem'
                  }}
                >
                  <i className={`fa-solid ${showNewPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
              <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px', display: 'block' }}>
                The agent will use this password to log into the Agent Portal and can change it anytime.
              </span>
            </div>

            {/* Initial Float & Commission Rate */}
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
                  step="0.5"
                  value={newCommission}
                  onChange={e => setNewCommission(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.875rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* Monthly Target & Custom Code */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
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

      {/* 5. Credentials Handover Modal (Post-Registration) */}
      {createdCredentials && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          backdropFilter: 'blur(6px)'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '18px',
            padding: '28px',
            width: '90%',
            maxWidth: '520px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: '#ecfdf5',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
              margin: '0 auto 16px auto'
            }}>
              🎉
            </div>

            <h3 style={{ fontSize: '1.375rem', fontWeight: 800, margin: '0 0 6px 0', color: '#0f172a' }}>
              Agent Successfully Registered!
            </h3>
            <p style={{ margin: '0 0 20px 0', color: '#64748b', fontSize: '0.875rem' }}>
              Hand over these login credentials to the agent. They can change their password anytime in the Agent Portal.
            </p>

            <div style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '16px',
              textAlign: 'left',
              marginBottom: '20px',
              fontSize: '0.875rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e2e8f0' }}>
                <span style={{ color: '#64748b' }}>Agent Name:</span>
                <strong style={{ color: '#0f172a' }}>{createdCredentials.fullName}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e2e8f0' }}>
                <span style={{ color: '#64748b' }}>Agent Code:</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#047857', background: '#d1fae5', padding: '2px 8px', borderRadius: '4px' }}>
                  {createdCredentials.agentCode}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e2e8f0' }}>
                <span style={{ color: '#64748b' }}>Login Phone:</span>
                <strong style={{ color: '#0f172a' }}>{createdCredentials.phone}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e2e8f0', alignItems: 'center' }}>
                <span style={{ color: '#64748b' }}>Initial Password:</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#b45309', background: '#fef3c7', padding: '2px 8px', borderRadius: '4px' }}>
                  {createdCredentials.password}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', alignItems: 'center' }}>
                <span style={{ color: '#64748b' }}>Bot Link:</span>
                <a
                  href={createdCredentials.refLink}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#0284c7', fontWeight: 700, textDecoration: 'none', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {createdCredentials.refLink}
                </a>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                onClick={handleCopyHandoverMessage}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#047857',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 800,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <i className="fa-solid fa-copy"></i>
                Copy All Credentials (Telegram / SMS Handover)
              </button>

              <button
                type="button"
                onClick={() => setCreatedCredentials(null)}
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  cursor: 'pointer'
                }}
              >
                Close & Return to Desk
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Edit Agent Modal (Full Control) */}
      {editingAgent && (
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
            onSubmit={handleSaveEdit}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '28px',
              width: '90%',
              maxWidth: '520px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#047857', textTransform: 'uppercase' }}>
                  Agent #{editingAgent.agent_code}
                </span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '2px 0 0 0', color: '#0f172a' }}>
                  Edit Agent Information
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingAgent(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', color: '#94a3b8', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <p style={{ margin: '0 0 18px 0', color: '#64748b', fontSize: '0.8125rem' }}>
              Update contact info, float balance, commission percentage, status, or reset credentials.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.875rem', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Phone Number
                </label>
                <input
                  type="text"
                  required
                  value={editPhone}
                  onChange={e => setEditPhone(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.875rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Commission Rate (%)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={editCommission}
                  onChange={e => setEditCommission(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.875rem', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Monthly Target (ETB)
                </label>
                <input
                  type="number"
                  value={editTarget}
                  onChange={e => setEditTarget(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.875rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Wallet Float (ETB)
                </label>
                <input
                  type="number"
                  value={editFloat}
                  onChange={e => setEditFloat(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.875rem', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Low Balance Alert (ETB)
                </label>
                <input
                  type="number"
                  value={editThreshold}
                  onChange={e => setEditThreshold(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.875rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Account Status
              </label>
              <select
                value={editStatus}
                onChange={e => setEditStatus(e.target.value as 'active' | 'suspended')}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.875rem', boxSizing: 'border-box', backgroundColor: '#ffffff' }}
              >
                <option value="active">Active (Full access to deposits & cash-ins)</option>
                <option value="suspended">Suspended (Blocked from logging in and operations)</option>
              </select>
            </div>

            {/* Optional Reset Password */}
            <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a' }}>
                  🔑 Reset Password (Optional)
                </label>
                <button
                  type="button"
                  onClick={() => setEditPassword(generateRandomPassword())}
                  style={{
                    background: '#fef3c7',
                    color: '#b45309',
                    border: '1px solid #fde68a',
                    borderRadius: '6px',
                    padding: '2px 8px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  🎲 Generate
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showEditPassword ? 'text' : 'password'}
                  placeholder="Leave blank to keep existing password"
                  value={editPassword}
                  onChange={e => setEditPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 36px 8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.8125rem',
                    boxSizing: 'border-box',
                    fontFamily: showEditPassword ? 'monospace' : 'inherit'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowEditPassword(!showEditPassword)}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer'
                  }}
                >
                  <i className={`fa-solid ${showEditPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
              <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px', display: 'block' }}>
                If you enter a new password, it will be hashed and immediately updated.
              </span>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setEditingAgent(null)}
                style={{ flex: 1, padding: '12px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '10px', fontWeight: 700, color: '#475569', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingEdit}
                style={{ flex: 1, padding: '12px', backgroundColor: '#047857', border: 'none', borderRadius: '10px', fontWeight: 700, color: '#ffffff', cursor: 'pointer' }}
              >
                {isSavingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 7. Delete Agent Confirmation Modal */}
      {deletingAgent && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            padding: '28px',
            width: '90%',
            maxWidth: '440px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: '#fee2e2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.75rem',
              margin: '0 auto 16px auto'
            }}>
              ⚠️
            </div>

            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 8px 0', color: '#0f172a' }}>
              Delete Agent #{deletingAgent.agent_code}?
            </h3>
            <p style={{ margin: '0 0 20px 0', color: '#64748b', fontSize: '0.875rem', lineHeight: '1.4' }}>
              Are you sure you want to delete <strong>{deletingAgent.full_name}</strong>?
              This will remove agent privileges, cancel any pending recharge requests, and downgrade the user to a standard player.
            </p>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setDeletingAgent(null)}
                style={{ flex: 1, padding: '12px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '10px', fontWeight: 700, color: '#475569', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAgent}
                disabled={isDeleting}
                style={{ flex: 1, padding: '12px', backgroundColor: '#dc2626', border: 'none', borderRadius: '10px', fontWeight: 700, color: '#ffffff', cursor: 'pointer' }}
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete Agent'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
