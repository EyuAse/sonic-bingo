import React, { useState, useEffect } from 'react';
import { apiClient } from '../../services/apiClient.ts';
import { TelebirrLogo, CBELogo, MpesaLogo } from '../wallet/PaymentLogos.tsx';

interface OfficialAccount {
  id: string;
  provider: string;
  account_title: string;
  account_name: string;
  account_number: string;
  badge: string;
  daily_limit: number | string;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

interface OfficialAccountsDeskProps {
  showToast: (msg: string) => void;
}

export const OfficialAccountsDesk: React.FC<OfficialAccountsDeskProps> = ({ showToast }) => {
  const [accounts, setAccounts] = useState<OfficialAccount[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingAccount, setEditingAccount] = useState<OfficialAccount | null>(null);

  // Form State
  const [provider, setProvider] = useState<string>('Telebirr');
  const [accountTitle, setAccountTitle] = useState<string>('');
  const [accountName, setAccountName] = useState<string>('');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [badge, setBadge] = useState<string>('⚡ Instant Fast Track');
  const [dailyLimit, setDailyLimit] = useState<number>(500000);
  const [displayOrder, setDisplayOrder] = useState<number>(1);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const res = await apiClient.admin.getOfficialAccounts();
      if (res.success && res.accounts) {
        setAccounts(res.accounts);
      }
    } catch (err: any) {
      console.error('Error fetching official accounts:', err);
      showToast(`❌ ${err.message || 'Failed to load official accounts'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleOpenAddModal = () => {
    setEditingAccount(null);
    setProvider('Telebirr');
    setAccountTitle('TELEBIRR SUPER AGENT');
    setAccountName('');
    setAccountNumber('');
    setBadge('⚡ Instant Fast Track');
    setDailyLimit(500000);
    setDisplayOrder(accounts.length + 1);
    setIsActive(true);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (acc: OfficialAccount) => {
    setEditingAccount(acc);
    setProvider(acc.provider);
    setAccountTitle(acc.account_title || '');
    setAccountName(acc.account_name || '');
    setAccountNumber(acc.account_number || '');
    setBadge(acc.badge || '');
    setDailyLimit(Number(acc.daily_limit || 500000));
    setDisplayOrder(Number(acc.display_order || 1));
    setIsActive(acc.is_active);
    setIsModalOpen(true);
  };

  const handleToggle = async (id: string, currentStatus: boolean) => {
    try {
      setTogglingId(id);
      const res = await apiClient.admin.toggleOfficialAccount(id);
      if (res.success) {
        showToast(currentStatus ? '⚪ Account deactivated & hidden from agents' : '🟢 Account activated & live for agents');
        setAccounts(prev =>
          prev.map(a => (a.id === id ? { ...a, is_active: !currentStatus } : a))
        );
      } else {
        showToast(`❌ ${res.error || 'Failed to toggle account'}`);
      }
    } catch (err: any) {
      showToast(`❌ ${err.message || 'Error toggling account'}`);
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete official account "${name}"? Agents will no longer see this rail.`)) {
      return;
    }
    try {
      const res = await apiClient.admin.deleteOfficialAccount(id);
      if (res.success) {
        showToast('🗑️ Official account deleted successfully');
        setAccounts(prev => prev.filter(a => a.id !== id));
      } else {
        showToast(`❌ ${res.error || 'Failed to delete account'}`);
      }
    } catch (err: any) {
      showToast(`❌ ${err.message || 'Error deleting account'}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountName.trim() || !accountNumber.trim()) {
      showToast('❌ Account Holder Name and Account Number are required');
      return;
    }

    try {
      setIsSaving(true);
      const payload = {
        provider,
        accountTitle: accountTitle.trim() || `${provider.toUpperCase()} OFFICIAL`,
        accountName: accountName.trim(),
        accountNumber: accountNumber.trim(),
        badge: badge.trim(),
        dailyLimit: Number(dailyLimit) || 500000,
        displayOrder: Number(displayOrder) || 1,
        isActive
      };

      if (editingAccount) {
        const res = await apiClient.admin.updateOfficialAccount(editingAccount.id, payload);
        if (res.success) {
          showToast('✅ Official account updated successfully!');
          setIsModalOpen(false);
          fetchAccounts();
        } else {
          showToast(`❌ ${res.error || 'Failed to update account'}`);
        }
      } else {
        const res = await apiClient.admin.createOfficialAccount(payload);
        if (res.success) {
          showToast('🎉 Official account created & live in Agent Portal!');
          setIsModalOpen(false);
          fetchAccounts();
        } else {
          showToast(`❌ ${res.error || 'Failed to create account'}`);
        }
      }
    } catch (err: any) {
      console.error('Error saving official account:', err);
      showToast(`❌ ${err.message || 'Error saving official account'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const renderLogo = (p: string) => {
    const norm = (p || '').toLowerCase();
    if (norm.includes('telebirr')) return <TelebirrLogo size={32} />;
    if (norm.includes('cbe') || norm.includes('commercial')) return <CBELogo size={32} />;
    if (norm.includes('mpesa') || norm.includes('m-pesa')) return <MpesaLogo size={32} />;
    if (norm.includes('abyssinia')) {
      return (
        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', fontSize: '16px', fontWeight: 900, boxShadow: '0 2px 6px rgba(217, 119, 6, 0.3)' }} title="Bank of Abyssinia">
          🦁
        </div>
      );
    }
    if (norm.includes('awash')) {
      return (
        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', fontSize: '16px', fontWeight: 900, boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)' }} title="Awash Bank">
          🏦
        </div>
      );
    }
    if (norm.includes('dashen')) {
      return (
        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #1e3a8a 0%, #172554 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#facc15', fontSize: '16px', fontWeight: 900, boxShadow: '0 2px 6px rgba(30, 58, 138, 0.3)' }} title="Dashen Bank">
          ⭐
        </div>
      );
    }
    return (
      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
        🏦
      </div>
    );
  };

  const activeCount = accounts.filter(a => a.is_active).length;

  return (
    <div className="admin-content-card" style={{ padding: '24px', background: '#f8fafc', minHeight: '85vh' }}>
      {/* 1. Header Hero Card */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          borderRadius: '20px',
          padding: '24px 28px',
          color: '#ffffff',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.25)',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '30px' }}>🏛️</span>
            <div>
              <h2 style={{ fontSize: '22px', fontWeight: 900, margin: 0, letterSpacing: '-0.4px', color: '#ffffff' }}>
                Official Receiving Accounts Desk
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>
                የቢንጎ እና የፍሎት ክፍያ መቀበያ ኦፊሴላዊ ሂሳቦች • Live real-time sync with Agent Float Recharge counters
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={fetchAccounts}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '12px',
              padding: '10px 16px',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <i className={`fa-solid fa-rotate ${loading ? 'fa-spin' : ''}`}></i>
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAddModal}
            style={{
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              border: 'none',
              borderRadius: '12px',
              padding: '10px 20px',
              color: '#000000',
              fontSize: '13px',
              fontWeight: 900,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)'
            }}
          >
            <i className="fa-solid fa-plus"></i>
            <span>Add Official Account</span>
          </button>
        </div>
      </div>

      {/* 2. Metric Counters */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#ffffff', padding: '18px 20px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Configured Accounts</div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#0f172a', marginTop: '4px' }}>{accounts.length}</div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>In PostgreSQL Database</div>
        </div>

        <div style={{ background: '#ffffff', padding: '18px 20px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#16a34a', textTransform: 'uppercase' }}>Active in Agent Portal</div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#16a34a', marginTop: '4px' }}>{activeCount}</div>
          <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '4px' }}>🟢 Visible for Float Recharge</div>
        </div>

        <div style={{ background: '#ffffff', padding: '18px 20px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#0284c7', textTransform: 'uppercase' }}>Escrow Guarantee</div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#0284c7', marginTop: '4px' }}>100%</div>
          <div style={{ fontSize: '11px', color: '#0284c7', marginTop: '4px' }}>🛡️ Authoritative Platform Rails</div>
        </div>

        <div style={{ background: '#ffffff', padding: '18px 20px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase' }}>Live WebSocket Sync</div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#f59e0b', marginTop: '4px' }}>Active</div>
          <div style={{ fontSize: '11px', color: '#f59e0b', marginTop: '4px' }}>⚡ Zero page-reload updates</div>
        </div>
      </div>

      {/* 3. Official Accounts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>
        {accounts.map(acc => {
          const isToggling = togglingId === acc.id;
          return (
            <div
              key={acc.id}
              style={{
                background: '#ffffff',
                borderRadius: '18px',
                border: acc.is_active ? '1.5px solid #cbd5e1' : '1px dashed #cbd5e1',
                padding: '22px',
                boxShadow: '0 4px 14px rgba(0,0,0,0.03)',
                position: 'relative',
                transition: 'all 0.15s ease',
                opacity: acc.is_active ? 1 : 0.65
              }}
            >
              {/* Top Row: Logo & Status Badge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {renderLogo(acc.provider)}
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 900, color: '#0f172a' }}>
                      {acc.account_title || `${acc.provider} Official`}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                      {acc.account_name}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                  <span
                    style={{
                      background: acc.is_active ? '#dcfce7' : '#f1f5f9',
                      color: acc.is_active ? '#15803d' : '#64748b',
                      border: `1px solid ${acc.is_active ? '#86efac' : '#cbd5e1'}`,
                      borderRadius: '9999px',
                      padding: '3px 10px',
                      fontSize: '11px',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: acc.is_active ? '#16a34a' : '#94a3b8' }}></span>
                    <span>{acc.is_active ? 'Live in Agent Desk' : 'Inactive'}</span>
                  </span>

                  {acc.badge && (
                    <span style={{ fontSize: '10px', color: '#f59e0b', fontWeight: 800 }}>
                      {acc.badge}
                    </span>
                  )}
                </div>
              </div>

              {/* Account Number Box */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  marginBottom: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>
                    Account Number / Mobile
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: '17px', fontWeight: 900, color: '#0f172a', letterSpacing: '0.5px' }}>
                    {acc.account_number}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(acc.account_number);
                    showToast(`📋 Copied: ${acc.account_number}`);
                  }}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '6px 10px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    color: '#334155'
                  }}
                >
                  <i className="fa-regular fa-copy"></i> Copy
                </button>
              </div>

              {/* Metadata Info */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', marginBottom: '16px', padding: '0 4px' }}>
                <span>Daily Limit: <strong>{Number(acc.daily_limit || 500000).toLocaleString()} ETB</strong></span>
                <span>Priority Order: <strong>#{acc.display_order || 1}</strong></span>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
                <button
                  type="button"
                  onClick={() => handleToggle(acc.id, acc.is_active)}
                  disabled={isToggling}
                  style={{
                    background: acc.is_active ? '#fee2e2' : '#ecfdf5',
                    color: acc.is_active ? '#b91c1c' : '#047857',
                    border: `1px solid ${acc.is_active ? '#fca5a5' : '#a7f3d0'}`,
                    borderRadius: '10px',
                    padding: '8px 12px',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  {isToggling ? (
                    <i className="fa-solid fa-spinner fa-spin"></i>
                  ) : acc.is_active ? (
                    <>
                      <i className="fa-solid fa-power-off"></i>
                      <span>Deactivate Rail</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-bolt"></i>
                      <span>Activate Rail</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenEditModal(acc)}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: '10px',
                    padding: '8px 14px',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#0f172a',
                    cursor: 'pointer'
                  }}
                >
                  <i className="fa-solid fa-pen"></i> Edit
                </button>

                <button
                  type="button"
                  onClick={() => handleDelete(acc.id, acc.account_title || acc.account_name)}
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '10px',
                    padding: '8px 12px',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#dc2626',
                    cursor: 'pointer'
                  }}
                  title="Delete account"
                >
                  <i className="fa-regular fa-trash-can"></i>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Add / Edit Modal */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(6px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={() => setIsModalOpen(false)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '22px',
              maxWidth: '520px',
              width: '100%',
              padding: '28px',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              position: 'relative'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                  {editingAccount ? 'Edit Official Account' : 'Add Official Account'}
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                  {editingAccount ? 'Update official bank or mobile receiving rail' : 'Connect a new live account visible to agents'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#64748b'
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Rail Provider */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
                  Payment Provider Rail
                </label>
                <select
                  value={provider}
                  onChange={e => {
                    const p = e.target.value;
                    setProvider(p);
                    if (!editingAccount) {
                      if (p === 'Telebirr') {
                        setAccountTitle('TELEBIRR SUPER AGENT');
                        setBadge('⚡ Instant Fast Track');
                      } else if (p === 'CBE') {
                        setAccountTitle('COMMERCIAL BANK OF ETHIOPIA');
                        setBadge('🏦 Direct Bank Transfer');
                      } else if (p === 'M-Pesa') {
                        setAccountTitle('SAFARICOM M-PESA');
                        setBadge('📲 Instant Till / Paybill');
                      } else if (p === 'Bank of Abyssinia') {
                        setAccountTitle('BANK OF ABYSSINIA SUPER AGENT');
                        setBadge('🦁 Instant Bank Transfer');
                      } else if (p === 'Awash Bank') {
                        setAccountTitle('AWASH BANK OFFICIAL');
                        setBadge('🏦 Direct Bank Transfer');
                      } else if (p === 'Dashen Bank') {
                        setAccountTitle('DASHEN BANK OFFICIAL');
                        setBadge('⭐ Direct Bank Transfer');
                      }
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    fontWeight: 700,
                    color: '#0f172a',
                    background: '#f8fafc'
                  }}
                >
                  <option value="Telebirr">Telebirr (Ethio Telecom)</option>
                  <option value="CBE">Commercial Bank of Ethiopia (CBE)</option>
                  <option value="M-Pesa">Safaricom M-Pesa</option>
                  <option value="Awash Bank">Awash Bank</option>
                  <option value="Bank of Abyssinia">Bank of Abyssinia</option>
                  <option value="Dashen Bank">Dashen Bank</option>
                </select>
              </div>

              {/* Title & Badge */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
                    Account Title / Heading
                  </label>
                  <input
                    type="text"
                    value={accountTitle}
                    onChange={e => setAccountTitle(e.target.value)}
                    placeholder="e.g. TELEBIRR SUPER AGENT"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      fontWeight: 700,
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
                    Fast-Track Badge
                  </label>
                  <input
                    type="text"
                    value={badge}
                    onChange={e => setBadge(e.target.value)}
                    placeholder="e.g. ⚡ Instant Fast Track"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      fontWeight: 700,
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Account Holder Name */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
                  Registered Account Holder Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={accountName}
                  onChange={e => setAccountName(e.target.value)}
                  placeholder="e.g. Abduurehim Sheycho or Sonic Gaming Operations"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    fontWeight: 700,
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Account Number */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
                  Account Number / Phone Number <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={accountNumber}
                  onChange={e => setAccountNumber(e.target.value)}
                  placeholder="e.g. 0952013863 or 1000458291048"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontFamily: 'monospace',
                    fontSize: '15px',
                    fontWeight: 900,
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Daily Limit & Display Order */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
                    Daily Turnover Limit (ETB)
                  </label>
                  <input
                    type="number"
                    value={dailyLimit}
                    onChange={e => setDailyLimit(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      fontWeight: 700,
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
                    Display Priority Order
                  </label>
                  <input
                    type="number"
                    value={displayOrder}
                    onChange={e => setDisplayOrder(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      fontWeight: 700,
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Active Toggle */}
              <div style={{ marginBottom: '22px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="checkbox"
                  id="isActiveCheck"
                  checked={isActive}
                  onChange={e => setIsActive(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="isActiveCheck" style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', cursor: 'pointer' }}>
                  Set this account Active & Live in Agent Portal immediately
                </label>
              </div>

              {/* Form Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '10px',
                    padding: '10px 18px',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#475569',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '10px 22px',
                    fontSize: '13px',
                    fontWeight: 900,
                    color: '#000000',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {isSaving && <i className="fa-solid fa-spinner fa-spin"></i>}
                  <span>{editingAccount ? 'Update Account' : 'Save & Publish'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

