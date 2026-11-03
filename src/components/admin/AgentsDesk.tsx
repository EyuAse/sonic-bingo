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
  city?: string;
  status: 'active' | 'suspended' | 'pending';
  wallet_balance: number;
  initial_deposit: number;
  low_balance_threshold: number;
  target_monthly: number;
  target_players?: number;
  commission_rate: number; // Deposit commission rate %
  cashout_commission_rate: number; // Withdraw commission rate %
  portal_access?: boolean;
  total_players: number;
  active_players: number;
  total_volume_deposited: number;
  refLink: string;
  created_at: string;
}

interface AgentDetails {
  agent: AgentRecord;
  stats: {
    totalDeposits: number;
    depositCount: number;
    totalPayouts: number;
    payoutCount: number;
    totalPlayers: number;
  };
  players: Array<{
    id: string;
    fullName: string;
    phone: string;
    balance: number;
    totalDeposited: number;
    hasDeposited: boolean;
    createdAt: string;
  }>;
  recentTransactions: Array<{
    id: string;
    player_name: string;
    player_phone: string;
    amount: number;
    deposit_method: string;
    status: string;
    created_at: string;
  }>;
}

interface CreatedCredentials {
  agentCode: string;
  fullName: string;
  phone: string;
  city: string;
  password: string;
  portalUrl: string;
  refLink: string;
}

export const AgentsDesk: React.FC = () => {
  const { showToast } = useApp();

  // State
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [agentDetails, setAgentDetails] = useState<AgentDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);
  const [detailTab, setDetailTab] = useState<'players' | 'cashflow'>('players');

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Pending' | 'Suspended'>('All');
  const [generatedInviteLink, setGeneratedInviteLink] = useState<string | null>(null);

  // Register Agent Multi-Step Modal State
  const [showRegisterModal, setShowRegisterModal] = useState<boolean>(false);
  const [modalStep, setModalStep] = useState<number>(1);
  const [regName, setRegName] = useState<string>('');
  const [regPhone, setRegPhone] = useState<string>('');
  const [regCity, setRegCity] = useState<string>('Addis Ababa');
  const [regFloat, setRegFloat] = useState<number>(10000);
  const [regPassword, setRegPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [regDepositComm, setRegDepositComm] = useState<number>(3.0);
  const [regWithdrawComm, setRegWithdrawComm] = useState<number>(2.0);
  const [regTargetPlayers, setRegTargetPlayers] = useState<number>(50);
  const [regTargetVolume, setRegTargetVolume] = useState<number>(50000);
  const [regIsSubmitting, setRegIsSubmitting] = useState<boolean>(false);
  const [createdCredentials, setCreatedCredentials] = useState<CreatedCredentials | null>(null);

  // Edit Commission & Targets State (Right Panel)
  const [editDepComm, setEditDepComm] = useState<number>(3.0);
  const [editWithComm, setEditWithComm] = useState<number>(2.0);
  const [editTargetPlayers, setEditTargetPlayers] = useState<number>(50);
  const [editTargetVolume, setEditTargetVolume] = useState<number>(50000);
  const [isSavingTargets, setIsSavingTargets] = useState<boolean>(false);

  // Edit Agent Info Modal State
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editName, setEditName] = useState<string>('');
  const [editPhone, setEditPhone] = useState<string>('');
  const [editCity, setEditCity] = useState<string>('');
  const [editPassword, setEditPassword] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  // Share Credentials Modal
  const [showShareModal, setShowShareModal] = useState<boolean>(false);

  // Helpers
  const formatNumber = (num: number) => Number(num || 0).toLocaleString('en-US');
  const getInitials = (name: string) => {
    if (!name) return 'AG';
    return name
      .split(' ')
      .map((w) => w[0] || '')
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const generateRandomPassword = () => {
    const num = Math.floor(1000 + Math.random() * 9000);
    return `Sonic@${num}`;
  };

  const copyToClipboard = (text: string, msg: string = 'Copied to clipboard!') => {
    try {
      navigator.clipboard.writeText(text);
      showToast(`✓ ${msg}`);
    } catch {
      showToast('⚠️ Could not copy text');
    }
  };

  // Fetch all agents
  const fetchAgents = async (preserveSelected: boolean = true) => {
    try {
      setLoading(true);
      const res = await apiClient.admin.getAgents();
      if (res && res.success) {
        const list = res.agents || [];
        setAgents(list);
        if (res.summary) {
          setSummary(res.summary);
        } else {
          let ac = 0,
            pd = 0,
            fl = 0,
            lw = 0;
          list.forEach((a: AgentRecord) => {
            if (a.status === 'active') ac++;
            if (a.status === 'pending') pd++;
            fl += a.wallet_balance;
            if (a.wallet_balance < (a.low_balance_threshold || 1000) && a.status === 'active') lw++;
          });
          setSummary({
            totalAgents: list.length,
            activeAgents: ac,
            pendingAgents: pd,
            suspendedAgents: list.length - ac - pd,
            totalFloat: fl,
            lowBalanceAlerts: lw
          });
        }

        if (list.length > 0) {
          if (!preserveSelected || !selectedAgentId || !list.some((a) => a.id === selectedAgentId)) {
            setSelectedAgentId(list[0].id);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching agents:', err);
      showToast('❌ Failed to load agents directory');
    } finally {
      setLoading(false);
    }
  };

  // Fetch details for selected agent
  const fetchAgentDetails = async (id: string) => {
    try {
      setLoadingDetails(true);
      const res = await apiClient.admin.getAgentDetails(id);
      if (res && res.success) {
        setAgentDetails(res);
        setEditDepComm(res.agent.commission_rate ?? 3.0);
        setEditWithComm(res.agent.cashout_commission_rate ?? 2.0);
        setEditTargetPlayers(res.agent.target_players ?? 50);
        setEditTargetVolume(res.agent.target_monthly ?? 50000);
      }
    } catch (err) {
      console.error('Error fetching agent details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    fetchAgents(false);
  }, []);

  useEffect(() => {
    if (selectedAgentId) {
      fetchAgentDetails(selectedAgentId);
    }
  }, [selectedAgentId]);

  // Selected agent reference
  const selectedAgent = agents.find((a) => a.id === selectedAgentId) || agents[0];

  // Filtering
  const filteredAgents = agents.filter((ag) => {
    const matchesStatus =
      statusFilter === 'All' ||
      (statusFilter === 'Active' && ag.status === 'active') ||
      (statusFilter === 'Pending' && ag.status === 'pending') ||
      (statusFilter === 'Suspended' && ag.status === 'suspended');

    const q = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !q ||
      ag.full_name.toLowerCase().includes(q) ||
      ag.phone.toLowerCase().includes(q) ||
      ag.agent_code.toLowerCase().includes(q) ||
      (ag.city && ag.city.toLowerCase().includes(q));

    return matchesStatus && matchesSearch;
  });

  // Action handlers
  const handleToggleStatus = async (ag: AgentRecord) => {
    const nextStatus = ag.status === 'active' ? 'suspended' : 'active';
    try {
      const res = await apiClient.admin.setAgentStatus(ag.id, nextStatus as any);
      if (res && res.success) {
        showToast(`✓ Agent ${ag.agent_code} ${nextStatus === 'active' ? 'activated' : 'suspended'}`);
        fetchAgents();
      } else {
        showToast(`❌ ${res?.error || 'Failed to update agent status'}`);
      }
    } catch {
      showToast('❌ Error updating status');
    }
  };

  const handleTogglePortal = async (ag: AgentRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (ag.status !== 'active') {
      showToast('⚠️ Activate the agent account before granting portal access.');
      return;
    }
    const current = ag.portal_access ?? true;
    try {
      const res = await apiClient.admin.toggleAgentPortal(ag.id, !current);
      if (res && res.success) {
        showToast(`✓ Agent portal access ${!current ? 'enabled' : 'disabled'}`);
        fetchAgents();
      }
    } catch {
      showToast('❌ Failed to toggle portal access');
    }
  };

  const handleSaveTargetsAndCommission = async () => {
    if (!selectedAgent) return;
    setIsSavingTargets(true);
    try {
      const res = await apiClient.admin.updateAgent(selectedAgent.id, {
        commissionRate: editDepComm,
        cashoutCommissionRate: editWithComm,
        targetPlayers: editTargetPlayers,
        targetMonthly: editTargetVolume
      } as any);

      if (res && res.success) {
        showToast('✓ Commission rates and monthly targets saved!');
        fetchAgents();
      } else {
        showToast(`❌ ${res?.error || 'Failed to save settings'}`);
      }
    } catch {
      showToast('❌ Error saving commission rates');
    } finally {
      setIsSavingTargets(false);
    }
  };

  const handleOpenEditModal = () => {
    if (!selectedAgent) return;
    setEditName(selectedAgent.full_name);
    setEditPhone(selectedAgent.phone);
    setEditCity(selectedAgent.city || 'Addis Ababa');
    setEditPassword('');
    setShowEditModal(true);
  };

  const handleSaveEditAgent = async () => {
    if (!selectedAgent) return;
    if (!editName.trim() || !editPhone.trim()) {
      showToast('⚠️ Full name and phone are required');
      return;
    }
    setIsSavingEdit(true);
    try {
      const payload: any = {
        fullName: editName.trim(),
        phone: editPhone.trim(),
        city: editCity.trim()
      };
      if (editPassword.trim()) {
        payload.password = editPassword.trim();
      }
      const res = await apiClient.admin.updateAgent(selectedAgent.id, payload);
      if (res && res.success) {
        showToast('✓ Agent profile updated successfully!');
        setShowEditModal(false);
        fetchAgents();
      } else {
        showToast(`❌ ${res?.error || 'Failed to update agent'}`);
      }
    } catch {
      showToast('❌ Error updating agent profile');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Multi-step Registration
  const handleOpenRegister = () => {
    setModalStep(1);
    setRegName('');
    setRegPhone('');
    setRegCity('Addis Ababa');
    setRegFloat(10000);
    setRegPassword(generateRandomPassword());
    setRegDepositComm(3.0);
    setRegWithdrawComm(2.0);
    setRegTargetPlayers(50);
    setRegTargetVolume(50000);
    setCreatedCredentials(null);
    setShowRegisterModal(true);
  };

  const handleNextStep = () => {
    if (modalStep === 1) {
      if (!regName.trim()) {
        showToast('⚠️ Please enter the agent full name');
        return;
      }
      const cleanPhone = regPhone.replace(/[^0-9]/g, '');
      if (cleanPhone.length < 9) {
        showToast('⚠️ Please enter a valid Ethiopian phone number (09XXXXXXXX)');
        return;
      }
      if (!regPassword.trim()) {
        setRegPassword(generateRandomPassword());
      }
      setModalStep(2);
    } else if (modalStep === 2) {
      if (regDepositComm < 0 || regDepositComm > 100 || regWithdrawComm < 0 || regWithdrawComm > 100) {
        showToast('⚠️ Commission rates must be between 0% and 100%');
        return;
      }
      if (regTargetPlayers <= 0 || regTargetVolume <= 0) {
        showToast('⚠️ Targets must be positive numbers');
        return;
      }
      setModalStep(3);
    }
  };

  const handleCreateAgentSubmit = async () => {
    setRegIsSubmitting(true);
    try {
      const res = await apiClient.admin.createAgent({
        fullName: regName.trim(),
        phone: regPhone.trim(),
        city: regCity.trim() || 'Addis Ababa',
        initialDeposit: regFloat,
        targetMonthly: regTargetVolume,
        targetPlayers: regTargetPlayers,
        commissionRate: regDepositComm,
        cashoutCommissionRate: regWithdrawComm,
        password: regPassword.trim()
      });

      if (res && res.success && res.agent) {
        const ag = res.agent;
        const portalUrl = `${window.location.origin}/#agent`;
        const refLink = `https://t.me/SonicGameOfficialBot?start=agent_${ag.agent_code}`;

        setCreatedCredentials({
          agentCode: ag.agent_code,
          fullName: regName.trim(),
          phone: regPhone.trim(),
          city: regCity.trim() || 'Addis Ababa',
          password: regPassword.trim(),
          portalUrl,
          refLink
        });
        showToast(`🎉 Agent ${ag.agent_code} registered successfully!`);
        setModalStep(4);
        fetchAgents();
      } else {
        showToast(`❌ ${res?.error || 'Failed to create agent'}`);
      }
    } catch (err: any) {
      showToast(`❌ ${err.message || 'Error creating agent'}`);
    } finally {
      setRegIsSubmitting(false);
    }
  };

  // Credential Handover Formatting
  const getCredentialShareText = (cred: CreatedCredentials | null) => {
    if (!cred) return '';
    return (
      `👋 *እንኳን ወደ ሶኒክ ቢንጎ ወኪሎች መረብ በደህና መጡ!* (Welcome to Sonic Bingo Agent Portal)\n\n` +
      `👤 *Agent Name:* ${cred.fullName}\n` +
      `🆔 *Agent Code:* ${cred.agentCode}\n` +
      `📞 *Login Phone:* ${cred.phone}\n` +
      `🔑 *Password:* ${cred.password}\n` +
      `📍 *Branch / City:* ${cred.city}\n\n` +
      `🌐 *Agent Portal:* ${cred.portalUrl}\n` +
      `🔗 *Player Referral Link:* ${cred.refLink}\n\n` +
      `⚡ *የተመደበ ፍሎት:* ${formatNumber(regFloat)} ETB\n` +
      `💰 *ተቀማጭ ኮሚሽን (Deposit):* ${regDepositComm}%\n` +
      `💸 *ወጪ ኮሚሽን (Withdraw):* ${regWithdrawComm}%\n\n` +
      `ይግቡ እና ተጫዋቾችን በማስመዝገብ የቀጥታ ኮሚሽን ያግኙ! (Login now and start earning!)`
    );
  };

  const handleShareTelegram = (cred: CreatedCredentials | null) => {
    if (!cred) return;
    const text = encodeURIComponent(getCredentialShareText(cred));
    const url = `https://t.me/share/url?url=${encodeURIComponent(cred.portalUrl)}&text=${text}`;
    window.open(url, '_blank');
  };

  const handleShareWhatsApp = (cred: CreatedCredentials | null) => {
    if (!cred) return;
    const text = encodeURIComponent(getCredentialShareText(cred));
    const url = `https://api.whatsapp.com/send?text=${text}`;
    window.open(url, '_blank');
  };

  const handleGenerateInvite = () => {
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    const link = `https://t.me/SonicGameOfficialBot?start=join_agent_${code}`;
    setGeneratedInviteLink(link);
    copyToClipboard(link, 'Onboarding invite link generated and copied!');
  };

  const activeCredentials = createdCredentials || (selectedAgent ? {
    agentCode: selectedAgent.agent_code,
    fullName: selectedAgent.full_name,
    phone: selectedAgent.phone,
    city: selectedAgent.city || 'Addis Ababa',
    password: '(Contact Super Admin if reset is needed)',
    portalUrl: `${window.location.origin}/#agent`,
    refLink: selectedAgent.refLink
  } : null);

  return (
    <div className="enqu-dashboard-main">
      {/* 1. Header Bar matching Enqu Game Admin */}
      <div className="top">
        <h1>Agents Directory</h1>
        <span className="pillbox">
          {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
        <span className="av" title="Admin Profile" />
      </div>

      {/* 2. Top 4 Stat Cards Grid (.g4) */}
      <div className="grid g4">
        {/* Card 1: Total Agents (Dark Charcoal Gradient) */}
        <div className="card d">
          <div className="lab">Total Agents</div>
          <div className="val">{formatNumber(summary.totalAgents || agents.length)}</div>
          <div className="tr">
            <span className="up">● Active</span> Registered on platform
          </div>
        </div>

        {/* Card 2: Active Agents */}
        <div className="card">
          <div className="lab">Active Agents</div>
          <div className="val">{formatNumber(summary.activeAgents || 0)}</div>
          <div className="tr">
            {summary.pendingAgents ? (
              <span className="up">{summary.pendingAgents} awaiting approval</span>
            ) : (
              '100% network operational'
            )}
          </div>
        </div>

        {/* Card 3: Float Held */}
        <div className="card">
          <div className="lab">Float Held</div>
          <div className="val">ETB {formatNumber(summary.totalFloat || 0)}</div>
          <div className="tr">Warning below 1,000 ETB</div>
        </div>

        {/* Card 4: Low Balance Alerts */}
        <div className="card">
          <div className="lab">Low Balance Alerts</div>
          <div className="val">{formatNumber(summary.lowBalanceAlerts || 0)}</div>
          <div className="tr">
            {summary.lowBalanceAlerts > 0 ? (
              <span className="dn">Recharge needed</span>
            ) : (
              <span className="up">All healthy</span>
            )}
          </div>
        </div>
      </div>

      {/* 3. Filter & Action Ribbon Card */}
      <div className="card" style={{ marginBottom: '15px' }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="row" style={{ gap: '12px' }}>
            <input
              type="text"
              id="ag_q"
              placeholder="Search agents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '220px' }}
            />
            <span className="tabs" style={{ margin: 0 }}>
              {(['All', 'Active', 'Pending', 'Suspended'] as const).map((s) => {
                const count =
                  s === 'All'
                    ? agents.length
                    : s === 'Active'
                    ? summary.activeAgents || agents.filter((a) => a.status === 'active').length
                    : s === 'Pending'
                    ? summary.pendingAgents || agents.filter((a) => a.status === 'pending').length
                    : summary.suspendedAgents || agents.filter((a) => a.status === 'suspended').length;

                return (
                  <button
                    key={s}
                    type="button"
                    className={statusFilter === s ? 'on' : ''}
                    onClick={() => setStatusFilter(s)}
                  >
                    {s} ({count})
                  </button>
                );
              })}
            </span>
          </div>
          <div className="row" style={{ gap: '10px' }}>
            <button type="button" onClick={handleGenerateInvite} title="Generate onboarding invitation link">
              Generate link
            </button>
            <button type="button" className="k" onClick={handleOpenRegister}>
              + Register agent
            </button>
          </div>
        </div>
      </div>

      {/* Optional Generated Invite Alert */}
      {generatedInviteLink && (
        <div className="note" style={{ boxShadow: 'none' }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="row" style={{ gap: '8px' }}>
              <b style={{ color: 'var(--ink)' }}>Agent registration link:</b>
              <code>{generatedInviteLink}</code>
            </div>
            <div className="row" style={{ gap: '6px' }}>
              <button
                type="button"
                className="k"
                onClick={() => copyToClipboard(generatedInviteLink, 'Agent registration link copied!')}
              >
                Copy
              </button>
              <button type="button" onClick={() => setGeneratedInviteLink(null)}>
                Dismiss
              </button>
            </div>
          </div>
          <div style={{ marginTop: '6px', fontSize: '12.5px' }}>
            Share this link with prospective agents. They can apply directly, and you can approve them from the Pending tab.
          </div>
        </div>
      )}

      {/* 4. Main Two-Column Layout (.grid.g2) */}
      <div className="grid g2">
        {/* Left Column: Agents Table */}
        <div className="card">
          <h3>
            Agents
            <span className="r" style={{ fontSize: '13px', color: 'var(--mute)' }}>
              Showing {filteredAgents.length} agents
            </span>
          </h3>

          <div className="wrap">
            <table>
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Status</th>
                  <th>Wallet</th>
                  <th>Players</th>
                  <th>Target</th>
                  <th>Portal</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--mute)', padding: '24px 0' }}>
                      Loading agents from database...
                    </td>
                  </tr>
                ) : filteredAgents.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--mute)', padding: '24px 0' }}>
                      No agents found matching criteria.
                    </td>
                  </tr>
                ) : (
                  filteredAgents.map((ag) => {
                    const isSelected = selectedAgentId === ag.id;
                    const isLow = ag.wallet_balance < (ag.low_balance_threshold || 1000);
                    const targetPl = ag.target_players || 50;
                    const pct = Math.min(100, Math.round((ag.total_players / targetPl) * 100));
                    const portalActive = ag.portal_access ?? true;

                    return (
                      <tr
                        key={ag.id}
                        className={isSelected ? 'sel' : ''}
                        onClick={() => setSelectedAgentId(ag.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>
                          <div className="row" style={{ flexWrap: 'nowrap', gap: '10px' }}>
                            <span className="av2">{getInitials(ag.full_name)}</span>
                            <div>
                              <button
                                type="button"
                                className="lk"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedAgentId(ag.id);
                                }}
                              >
                                {ag.full_name}
                              </button>
                              <div className="tr" style={{ fontSize: '11.5px' }}>
                                {ag.city || 'Addis Ababa'} · {ag.agent_code}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`b ${ag.status === 'pending' ? 'o' : ag.status === 'suspended' ? 'w' : 'k'}`}>
                            {ag.status === 'active' ? 'Active' : ag.status === 'pending' ? 'Pending' : 'Suspended'}
                          </span>
                        </td>
                        <td>
                          {formatNumber(ag.wallet_balance)} ETB
                          {isLow && ag.status === 'active' && (
                            <span className="b w" style={{ marginLeft: '6px', fontSize: '10px', padding: '2px 6px' }}>
                              Low
                            </span>
                          )}
                        </td>
                        <td>{formatNumber(ag.total_players)}</td>
                        <td>
                          <span className="prog">
                            <i style={{ width: `${pct}%` }} />
                          </span>
                          <span style={{ fontSize: '12px', color: 'var(--mute)' }}>
                            {ag.total_players}/{targetPl}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={`tog ${portalActive ? 'on' : ''}`}
                            onClick={(e) => handleTogglePortal(ag, e)}
                            title={portalActive ? 'Disable portal access' : 'Enable portal access'}
                            aria-label="toggle portal access"
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className={ag.status === 'active' ? '' : 'k'}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleStatus(ag);
                            }}
                          >
                            {ag.status === 'active' ? 'Suspend' : ag.status === 'pending' ? 'Approve' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Detailed Selected Agent Panel */}
        {selectedAgent ? (
          <div className="card">
            {/* Header info */}
            <div className="row" style={{ flexWrap: 'nowrap', gap: '14px', alignItems: 'center' }}>
              <span className="av2 big">{getInitials(selectedAgent.full_name)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--ink)' }}>
                    {selectedAgent.full_name}
                  </div>
                  <span
                    className={`b ${
                      selectedAgent.status === 'pending' ? 'o' : selectedAgent.status === 'suspended' ? 'w' : 'k'
                    }`}
                  >
                    {selectedAgent.status === 'active' ? 'Active' : selectedAgent.status === 'pending' ? 'Pending' : 'Suspended'}
                  </span>
                </div>
                <div className="tr" style={{ fontSize: '12.5px', marginTop: '2px' }}>
                  {selectedAgent.phone} · {selectedAgent.city || 'Addis Ababa'} · joined{' '}
                  {new Date(selectedAgent.created_at).toLocaleDateString('en-US', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })}
                </div>
              </div>
            </div>

            {/* 2 KPI Cards */}
            <div className="two" style={{ marginTop: '14px' }}>
              <div className="card" style={{ background: 'var(--panel)' }}>
                <div className="lab">Wallet</div>
                <div className="val" style={{ margin: '4px 0' }}>
                  {formatNumber(selectedAgent.wallet_balance)} ETB
                </div>
                <div className="tr">
                  {selectedAgent.wallet_balance < (selectedAgent.low_balance_threshold || 1000) ? (
                    <span className="dn">Below 1,000 ETB warning</span>
                  ) : (
                    <span className="up">Healthy balance</span>
                  )}
                </div>
              </div>

              <div className="card" style={{ background: 'var(--panel)' }}>
                <div className="lab">Monthly target</div>
                <div className="val" style={{ margin: '4px 0' }}>
                  {selectedAgent.total_players} / {selectedAgent.target_players || 50}
                </div>
                <div className="tr">players registered</div>
              </div>
            </div>

            {/* Float Recharge Action */}
            <div className="row" style={{ marginTop: '10px' }}>
              <button
                type="button"
                className="k"
                onClick={() => {
                  showToast(`Open Agent Recharges to credit float to ${selectedAgent.agent_code}`);
                }}
              >
                Recharge wallet
              </button>
              <button type="button" onClick={handleOpenEditModal}>
                Edit agent info
              </button>
            </div>

            {/* Registration Links */}
            <div className="sec">
              <h4>Registration links</h4>
              <label>Player registration link</label>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <input type="text" readOnly value={selectedAgent.refLink} />
                <button
                  type="button"
                  className="k"
                  onClick={() => copyToClipboard(selectedAgent.refLink, 'Player referral link copied!')}
                >
                  Copy
                </button>
              </div>

              {selectedAgent.status === 'pending' && (
                <>
                  <label>Agent onboarding link (expires in 7 days)</label>
                  <div className="row" style={{ flexWrap: 'nowrap' }}>
                    <input
                      type="text"
                      readOnly
                      value={`https://t.me/SonicGameOfficialBot?start=join_agent_${selectedAgent.agent_code}`}
                    />
                    <button
                      type="button"
                      className="k"
                      onClick={() =>
                        copyToClipboard(
                          `https://t.me/SonicGameOfficialBot?start=join_agent_${selectedAgent.agent_code}`,
                          'Agent onboarding link copied!'
                        )
                      }
                    >
                      Copy
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Agent Portal Access & Credentials Sharing */}
            <div className="sec">
              <h4>Agent portal access</h4>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="tr">Login with phone number and password</span>
                <button
                  type="button"
                  className={`tog ${(selectedAgent.portal_access ?? true) ? 'on' : ''}`}
                  onClick={() => handleTogglePortal(selectedAgent)}
                  aria-label="Toggle agent portal access"
                />
              </div>
              <div className="row" style={{ marginTop: '10px', gap: '8px' }}>
                <button type="button" onClick={() => setShowShareModal(true)}>
                  Share credentials (Telegram / WhatsApp)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(
                      getCredentialShareText(activeCredentials),
                      'Agent credentials copied to clipboard!'
                    )
                  }
                >
                  Copy credentials
                </button>
              </div>
            </div>

            {/* Commission Rates: ONLY Deposit & Withdraw (Custom requirement!) */}
            <div className="sec">
              <h4>Commission rates (%)</h4>
              <div className="two">
                <div>
                  <label htmlFor="ad_cd">Deposit commission (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    id="ad_cd"
                    value={editDepComm}
                    onChange={(e) => setEditDepComm(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label htmlFor="ad_cw">Withdraw commission (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    id="ad_cw"
                    value={editWithComm}
                    onChange={(e) => setEditWithComm(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              <h4>Monthly targets</h4>
              <div className="two">
                <div>
                  <label htmlFor="ad_tp">Players to register</label>
                  <input
                    type="number"
                    id="ad_tp"
                    value={editTargetPlayers}
                    onChange={(e) => setEditTargetPlayers(parseInt(e.target.value, 10) || 0)}
                  />
                </div>
                <div>
                  <label htmlFor="ad_td">Deposit volume (ETB)</label>
                  <input
                    type="number"
                    id="ad_td"
                    value={editTargetVolume}
                    onChange={(e) => setEditTargetVolume(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              <button
                type="button"
                className="pubb"
                onClick={handleSaveTargetsAndCommission}
                disabled={isSavingTargets}
                style={{ marginTop: '14px' }}
              >
                {isSavingTargets ? 'Saving...' : 'Save targets & commission'}
              </button>
            </div>

            {/* Deep-Dive: Live Recruited Players & Cash Flow Activity */}
            <div className="sec">
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <h4>Agent Live Analytics</h4>
                <span className="tabs" style={{ margin: 0 }}>
                  <button
                    type="button"
                    className={detailTab === 'players' ? 'on' : ''}
                    onClick={() => setDetailTab('players')}
                  >
                    Players ({agentDetails?.players?.length || selectedAgent.total_players})
                  </button>
                  <button
                    type="button"
                    className={detailTab === 'cashflow' ? 'on' : ''}
                    onClick={() => setDetailTab('cashflow')}
                  >
                    Cash Flow
                  </button>
                </span>
              </div>

              {loadingDetails ? (
                <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--mute)' }}>
                  Loading agent analytics...
                </div>
              ) : detailTab === 'players' ? (
                <div className="wrap" style={{ maxHeight: '240px', overflowY: 'auto', marginTop: '10px' }}>
                  {agentDetails?.players && agentDetails.players.length > 0 ? (
                    <table>
                      <thead>
                        <tr>
                          <th>Player</th>
                          <th>Phone</th>
                          <th>Balance</th>
                          <th>Deposited</th>
                        </tr>
                      </thead>
                      <tbody>
                        {agentDetails.players.map((p) => (
                          <tr key={p.id}>
                            <td>{p.fullName}</td>
                            <td>{p.phone || '—'}</td>
                            <td>ETB {formatNumber(p.balance)}</td>
                            <td>ETB {formatNumber(p.totalDeposited)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ padding: '12px 0', color: 'var(--mute)', fontSize: '13px' }}>
                      No recruited players registered under this agent yet.
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ marginTop: '12px' }}>
                  <div className="two">
                    <div className="card" style={{ background: 'var(--panel)', padding: '12px' }}>
                      <div className="lab">Total Deposits Handled</div>
                      <div className="val" style={{ margin: '4px 0', fontSize: '18px' }}>
                        ETB {formatNumber(agentDetails?.stats?.totalDeposits || selectedAgent.total_volume_deposited)}
                      </div>
                      <div className="tr">{agentDetails?.stats?.depositCount || 0} transactions</div>
                    </div>
                    <div className="card" style={{ background: 'var(--panel)', padding: '12px' }}>
                      <div className="lab">Commission Earned</div>
                      <div className="val" style={{ margin: '4px 0', fontSize: '18px', color: 'var(--g)' }}>
                        ETB{' '}
                        {formatNumber(
                          ((agentDetails?.stats?.totalDeposits || selectedAgent.total_volume_deposited) *
                            (selectedAgent.commission_rate || 3)) /
                            100
                        )}
                      </div>
                      <div className="tr">At {selectedAgent.commission_rate}% rate</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--mute)' }}>
            Select an agent from the list to view profile, commissions, and recruited players.
          </div>
        )}
      </div>

      {/* 5. MULTI-STEP REGISTER AGENT MODAL */}
      {showRegisterModal && (
        <div className="modalbg">
          <div className="modal">
            {/* Modal Header */}
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0 }}>Register New Agent</h3>
              <button
                type="button"
                onClick={() => setShowRegisterModal(false)}
                style={{ background: 'none', fontSize: '18px' }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Stepper (Steps 1 to 3) */}
            {modalStep < 4 && (
              <div className="steps">
                <span className={modalStep >= 1 ? 'on' : ''}>1. Details</span>
                <span className={modalStep >= 2 ? 'on' : ''}>2. Commission & Targets</span>
                <span className={modalStep >= 3 ? 'on' : ''}>3. Review</span>
              </div>
            )}

            {/* Step 1: Details */}
            {modalStep === 1 && (
              <div>
                <label htmlFor="am_name">Full name</label>
                <input
                  type="text"
                  id="am_name"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="e.g. Kebede Alemu"
                />

                <div className="two">
                  <div>
                    <label htmlFor="am_ph">Phone (Telebirr / Login)</label>
                    <input
                      type="text"
                      id="am_ph"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="09XXXXXXXX"
                    />
                  </div>
                  <div>
                    <label htmlFor="am_city">City / Region</label>
                    <input
                      type="text"
                      id="am_city"
                      value={regCity}
                      onChange={(e) => setRegCity(e.target.value)}
                      placeholder="e.g. Addis Ababa"
                    />
                  </div>
                </div>

                <label htmlFor="am_pw">Agent Portal Password</label>
                <div className="row" style={{ flexWrap: 'nowrap', gap: '8px' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="am_pw"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Enter password or auto-generate"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegPassword(generateRandomPassword())}
                    title="Generate random password"
                  >
                    Generate
                  </button>
                </div>

                <label htmlFor="am_fl">Initial float recharge (ETB)</label>
                <input
                  type="number"
                  id="am_fl"
                  value={regFloat}
                  onChange={(e) => setRegFloat(parseFloat(e.target.value) || 0)}
                />
                <div className="tr" style={{ marginTop: '6px' }}>
                  Standard float is 10,000 ETB. The agent can use this immediately to credit players.
                </div>
              </div>
            )}

            {/* Step 2: Commission & Targets (ONLY Deposit & Withdraw!) */}
            {modalStep === 2 && (
              <div>
                <div className="two">
                  <div>
                    <label htmlFor="am_d">Deposit Commission (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      id="am_d"
                      value={regDepositComm}
                      onChange={(e) => setRegDepositComm(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <label htmlFor="am_w">Withdraw Commission (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      id="am_w"
                      value={regWithdrawComm}
                      onChange={(e) => setRegWithdrawComm(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="two" style={{ marginTop: '8px' }}>
                  <div>
                    <label htmlFor="am_tp">Monthly player target</label>
                    <input
                      type="number"
                      id="am_tp"
                      value={regTargetPlayers}
                      onChange={(e) => setRegTargetPlayers(parseInt(e.target.value, 10) || 0)}
                    />
                  </div>
                  <div>
                    <label htmlFor="am_td">Monthly deposit target (ETB)</label>
                    <input
                      type="number"
                      id="am_td"
                      value={regTargetVolume}
                      onChange={(e) => setRegTargetVolume(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="tr" style={{ marginTop: '12px' }}>
                  Commissions are automatically settled to the agent's commission balance whenever players deposit or cash out through them.
                </div>
              </div>
            )}

            {/* Step 3: Review */}
            {modalStep === 3 && (
              <div>
                <div className="cred-box">
                  <div className="cred-row">
                    <span className="cred-lab">Full Name</span>
                    <span className="cred-val">{regName}</span>
                  </div>
                  <div className="cred-row">
                    <span className="cred-lab">Phone</span>
                    <span className="cred-val">{regPhone}</span>
                  </div>
                  <div className="cred-row">
                    <span className="cred-lab">City</span>
                    <span className="cred-val">{regCity || 'Addis Ababa'}</span>
                  </div>
                  <div className="cred-row">
                    <span className="cred-lab">Initial Float</span>
                    <span className="cred-val">{formatNumber(regFloat)} ETB</span>
                  </div>
                  <div className="cred-row">
                    <span className="cred-lab">Commission</span>
                    <span className="cred-val">
                      Deposit: {regDepositComm}% · Withdraw: {regWithdrawComm}%
                    </span>
                  </div>
                  <div className="cred-row">
                    <span className="cred-lab">Monthly Targets</span>
                    <span className="cred-val">
                      {regTargetPlayers} players · {formatNumber(regTargetVolume)} ETB
                    </span>
                  </div>
                  <div className="cred-row">
                    <span className="cred-lab">Initial Password</span>
                    <span className="cred-val"><code>{regPassword}</code></span>
                  </div>
                </div>

                <div className="tr">
                  On the next step, you will be able to share these login credentials directly with the agent via Telegram or WhatsApp.
                </div>
              </div>
            )}

            {/* Step 4: Credential Handover Screen */}
            {modalStep === 4 && createdCredentials && (
              <div>
                <div className="note" style={{ boxShadow: 'none', background: '#e4f1e8', color: '#1f6a37' }}>
                  ✓ Agent created successfully! Status: Active with portal access enabled.
                </div>

                <div className="cred-box">
                  <div className="cred-row">
                    <span className="cred-lab">Agent Code</span>
                    <span className="cred-val">{createdCredentials.agentCode}</span>
                  </div>
                  <div className="cred-row">
                    <span className="cred-lab">Login Phone</span>
                    <span className="cred-val">{createdCredentials.phone}</span>
                  </div>
                  <div className="cred-row">
                    <span className="cred-lab">Login Password</span>
                    <span className="cred-val"><code>{createdCredentials.password}</code></span>
                  </div>
                  <div className="cred-row">
                    <span className="cred-lab">Portal Login URL</span>
                    <span className="cred-val" style={{ fontSize: '12px' }}>{createdCredentials.portalUrl}</span>
                  </div>
                </div>

                <div className="share-btns">
                  <button
                    type="button"
                    className="share-btn tg"
                    onClick={() => handleShareTelegram(createdCredentials)}
                  >
                    <span>✈️ Share via Telegram</span>
                  </button>
                  <button
                    type="button"
                    className="share-btn wa"
                    onClick={() => handleShareWhatsApp(createdCredentials)}
                  >
                    <span>💬 Share via WhatsApp</span>
                  </button>
                  <button
                    type="button"
                    className="share-btn cp"
                    onClick={() =>
                      copyToClipboard(
                        getCredentialShareText(createdCredentials),
                        'Agent welcome packet copied to clipboard!'
                      )
                    }
                  >
                    <span>📋 Copy Complete Welcome Packet</span>
                  </button>
                </div>
              </div>
            )}

            {/* Modal Footer Controls */}
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: '18px', gap: '8px' }}>
              {modalStep === 4 ? (
                <button
                  type="button"
                  className="k"
                  onClick={() => {
                    setShowRegisterModal(false);
                    setCreatedCredentials(null);
                  }}
                >
                  Done
                </button>
              ) : (
                <>
                  {modalStep > 1 ? (
                    <button type="button" onClick={() => setModalStep(modalStep - 1)}>
                      Back
                    </button>
                  ) : (
                    <button type="button" onClick={() => setShowRegisterModal(false)}>
                      Cancel
                    </button>
                  )}

                  {modalStep < 3 ? (
                    <button type="button" className="k" onClick={handleNextStep}>
                      Next
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="k"
                      onClick={handleCreateAgentSubmit}
                      disabled={regIsSubmitting}
                    >
                      {regIsSubmitting ? 'Creating agent...' : 'Create agent'}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. EDIT AGENT INFO MODAL */}
      {showEditModal && selectedAgent && (
        <div className="modalbg">
          <div className="modal">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0 }}>Edit Agent: {selectedAgent.agent_code}</h3>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                style={{ background: 'none', fontSize: '18px' }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginTop: '14px' }}>
              <label>Full name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />

              <div className="two">
                <div>
                  <label>Phone number</label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                  />
                </div>
                <div>
                  <label>City / Location</label>
                  <input
                    type="text"
                    value={editCity}
                    onChange={(e) => setEditCity(e.target.value)}
                  />
                </div>
              </div>

              <label>Reset Password (leave empty to keep existing)</label>
              <div className="row" style={{ flexWrap: 'nowrap', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="New password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setEditPassword(generateRandomPassword())}
                >
                  Generate
                </button>
              </div>
            </div>

            <div className="row" style={{ justifyContent: 'flex-end', marginTop: '20px', gap: '8px' }}>
              <button type="button" onClick={() => setShowEditModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="k"
                onClick={handleSaveEditAgent}
                disabled={isSavingEdit}
              >
                {isSavingEdit ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. SHARE CREDENTIALS MODAL */}
      {showShareModal && activeCredentials && (
        <div className="modalbg">
          <div className="modal">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0 }}>Share Credentials: {activeCredentials.agentCode}</h3>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                style={{ background: 'none', fontSize: '18px' }}
              >
                ✕
              </button>
            </div>

            <div className="cred-box">
              <div className="cred-row">
                <span className="cred-lab">Agent Name</span>
                <span className="cred-val">{activeCredentials.fullName}</span>
              </div>
              <div className="cred-row">
                <span className="cred-lab">Phone</span>
                <span className="cred-val">{activeCredentials.phone}</span>
              </div>
              <div className="cred-row">
                <span className="cred-lab">Agent Code</span>
                <span className="cred-val">{activeCredentials.agentCode}</span>
              </div>
              <div className="cred-row">
                <span className="cred-lab">Portal URL</span>
                <span className="cred-val" style={{ fontSize: '12px' }}>{activeCredentials.portalUrl}</span>
              </div>
            </div>

            <div className="share-btns">
              <button
                type="button"
                className="share-btn tg"
                onClick={() => handleShareTelegram(activeCredentials)}
              >
                <span>✈️ Share via Telegram</span>
              </button>
              <button
                type="button"
                className="share-btn wa"
                onClick={() => handleShareWhatsApp(activeCredentials)}
              >
                <span>💬 Share via WhatsApp</span>
              </button>
              <button
                type="button"
                className="share-btn cp"
                onClick={() =>
                  copyToClipboard(
                    getCredentialShareText(activeCredentials),
                    'Credentials copied to clipboard!'
                  )
                }
              >
                <span>📋 Copy Complete Welcome Message</span>
              </button>
            </div>

            <div className="row" style={{ justifyContent: 'flex-end', marginTop: '16px' }}>
              <button type="button" className="k" onClick={() => setShowShareModal(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
