import React, { useState, useEffect } from 'react';
import { apiClient } from '../../services/apiClient.ts';
import { TelebirrLogo, MpesaLogo } from '../wallet/PaymentLogos.tsx';

interface AgentPaymentRailsDeskProps {
  agentProfile: any;
  showToast: (msg: string) => void;
  openMobile?: () => void;
}

interface PaymentRailAccount {
  accountNumber: string;
  accountName: string;
  isActive: boolean;
}

interface PaymentAccountsState {
  telebirr: PaymentRailAccount;
  mpesa: PaymentRailAccount;
}

export const AgentPaymentRailsDesk: React.FC<AgentPaymentRailsDeskProps> = ({
  agentProfile,
  showToast,
  openMobile
}) => {
  // Configured Payment Rails State (Telebirr & M-Pesa Only)
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccountsState>({
    telebirr: { accountNumber: '', accountName: '', isActive: true },
    mpesa: { accountNumber: '', accountName: '', isActive: false }
  });

  const [supportedRails, setSupportedRails] = useState<string[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState<boolean>(true);
  const [isSavingAccounts, setIsSavingAccounts] = useState<boolean>(false);

  // Fetch agent's saved accounts from backend
  const fetchAccounts = async () => {
    try {
      setIsLoadingAccounts(true);
      const res = await apiClient.agent.getPaymentAccounts();
      if (res.success && res.accounts) {
        setPaymentAccounts({
          telebirr: {
            accountNumber: res.accounts.telebirr?.accountNumber || '',
            accountName: res.accounts.telebirr?.accountName || '',
            isActive: Boolean(res.accounts.telebirr?.isActive)
          },
          mpesa: {
            accountNumber: res.accounts.mpesa?.accountNumber || '',
            accountName: res.accounts.mpesa?.accountName || '',
            isActive: Boolean(res.accounts.mpesa?.isActive)
          }
        });
        setSupportedRails((res.supportedRails || []).filter((r: string) => r !== 'CBE'));
      }
    } catch (err: any) {
      console.warn('Failed to load payment accounts:', err);
      showToast(`⚠️ ${err.message || 'Failed to load payment accounts'}`);
    } finally {
      setIsLoadingAccounts(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  // Save Configured Payment Rails
  const handleSaveAccounts = async (e: React.FormEvent) => {
    e.preventDefault();

    const hasActive =
      (paymentAccounts.telebirr.isActive && paymentAccounts.telebirr.accountNumber.trim()) ||
      (paymentAccounts.mpesa.isActive && paymentAccounts.mpesa.accountNumber.trim());

    if (!hasActive) {
      showToast('⚠️ You must have at least one active payment rail (Telebirr or M-Pesa) configured.');
      return;
    }

    try {
      setIsSavingAccounts(true);
      // Cleanly deactivate CBE in database payload
      const payload = {
        ...paymentAccounts,
        cbe: { accountNumber: '', accountName: '', isActive: false }
      };
      const res = await apiClient.agent.updatePaymentAccounts(payload);
      if (res.success) {
        showToast('✅ Official payment accounts saved and live!');
        if (res.accounts) {
          setPaymentAccounts({
            telebirr: {
              accountNumber: res.accounts.telebirr?.accountNumber || '',
              accountName: res.accounts.telebirr?.accountName || '',
              isActive: Boolean(res.accounts.telebirr?.isActive)
            },
            mpesa: {
              accountNumber: res.accounts.mpesa?.accountNumber || '',
              accountName: res.accounts.mpesa?.accountName || '',
              isActive: Boolean(res.accounts.mpesa?.isActive)
            }
          });
        }
        if (res.supportedRails) {
          setSupportedRails(res.supportedRails.filter((r: string) => r !== 'CBE'));
        }
      } else {
        showToast(`❌ ${res.error || 'Failed to update accounts'}`);
      }
    } catch (err: any) {
      console.error('Update payment accounts error:', err);
      showToast(`❌ ${err.message || 'Failed to save payment accounts'}`);
    } finally {
      setIsSavingAccounts(false);
    }
  };

  // Compute active count
  const activeRailsCount = [
    paymentAccounts.telebirr.isActive && paymentAccounts.telebirr.accountNumber.trim(),
    paymentAccounts.mpesa.isActive && paymentAccounts.mpesa.accountNumber.trim()
  ].filter(Boolean).length;

  return (
    <div className="sonic-agent-desk-container" style={{ padding: '24px 20px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* ====================================================================
          1. DESK HEADER
          ==================================================================== */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {openMobile && (
            <button
              type="button"
              onClick={openMobile}
              className="sonic-mobile-menu-btn"
              aria-label="Open mobile menu"
              style={{
                display: 'none',
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                color: '#0f172a',
                fontSize: '18px',
                cursor: 'pointer'
              }}
            >
              <i className="fa-solid fa-bars"></i>
            </button>
          )}

          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
              color: '#d97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              boxShadow: '0 4px 12px rgba(217, 119, 6, 0.15)'
            }}
          >
            <i className="fa-solid fa-building-columns"></i>
          </div>

          <div>
            <h1
              style={{
                fontSize: '22px',
                fontWeight: 900,
                color: '#0f172a',
                margin: 0,
                letterSpacing: '-0.3px'
              }}
            >
              Receiving & Cashout Payment Rails
            </h1>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0 0' }}>
              Configure your official mobile & bank accounts for player deposits and counter cashouts.
            </p>
          </div>
        </div>

        {/* Live Active Rails Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {paymentAccounts.telebirr.isActive && paymentAccounts.telebirr.accountNumber.trim() && (
            <span
              style={{
                fontSize: '12px',
                fontWeight: 800,
                padding: '5px 12px',
                borderRadius: '10px',
                background: '#ecfdf5',
                color: '#059669',
                border: '1px solid #a7f3d0',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981' }} />
              Telebirr
            </span>
          )}

          {paymentAccounts.mpesa.isActive && paymentAccounts.mpesa.accountNumber.trim() && (
            <span
              style={{
                fontSize: '12px',
                fontWeight: 800,
                padding: '5px 12px',
                borderRadius: '10px',
                background: '#ecfdf5',
                color: '#059669',
                border: '1px solid #a7f3d0',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981' }} />
              M-Pesa
            </span>
          )}

          {activeRailsCount === 0 && (
            <span
              style={{
                fontSize: '12px',
                fontWeight: 800,
                padding: '5px 12px',
                borderRadius: '10px',
                background: '#fef2f2',
                color: '#dc2626',
                border: '1px solid #fecaca'
              }}
            >
              ⚠️ No Active Rails
            </span>
          )}
        </div>
      </div>

      {/* ====================================================================
          2. MAIN CONFIGURATION FORM
          ==================================================================== */}
      <form onSubmit={handleSaveAccounts}>
        <div
          className="sonic-white-card"
          style={{
            borderRadius: '20px',
            border: '1px solid #e2e8f0',
            padding: '28px',
            marginBottom: '24px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)'
          }}
        >
          {isLoadingAccounts ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
              <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '24px', marginBottom: '12px', color: '#d97706' }}></i>
              <div>Loading your configured payment rails...</div>
            </div>
          ) : (
            <>
              {/* Rails Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                  gap: '20px',
                  marginBottom: '26px'
                }}
              >
                {/* 1. Telebirr Account Card */}
                <div
                  style={{
                    background: paymentAccounts.telebirr.isActive ? '#ffffff' : '#f8fafc',
                    border: paymentAccounts.telebirr.isActive ? '1.5px solid #0284c7' : '1px solid #e2e8f0',
                    borderRadius: '16px',
                    padding: '20px',
                    boxShadow: paymentAccounts.telebirr.isActive ? '0 4px 14px rgba(2, 132, 199, 0.08)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '16px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <TelebirrLogo size={26} />
                      <div>
                        <strong style={{ fontSize: '15px', color: '#0f172a', display: 'block' }}>
                          Telebirr Mobile Wallet
                        </strong>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>Fast track mobile deposits</div>
                      </div>
                    </div>

                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 800
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={paymentAccounts.telebirr.isActive}
                        onChange={e =>
                          setPaymentAccounts(prev => ({
                            ...prev,
                            telebirr: { ...prev.telebirr, isActive: e.target.checked }
                          }))
                        }
                        style={{ width: '16px', height: '16px', accentColor: '#0284c7', cursor: 'pointer' }}
                      />
                      <span style={{ color: paymentAccounts.telebirr.isActive ? '#0284c7' : '#94a3b8' }}>
                        {paymentAccounts.telebirr.isActive ? 'Active' : 'Off'}
                      </span>
                    </label>
                  </div>

                  <div style={{ opacity: paymentAccounts.telebirr.isActive ? 1 : 0.6 }}>
                    <div style={{ marginBottom: '12px' }}>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '11px',
                          fontWeight: 800,
                          color: '#475569',
                          marginBottom: '6px'
                        }}
                      >
                        Telebirr Phone Number
                      </label>
                      <input
                        type="text"
                        className="sonic-input-field"
                        placeholder="e.g. 09 83 62 45 74"
                        value={paymentAccounts.telebirr.accountNumber}
                        disabled={!paymentAccounts.telebirr.isActive}
                        onChange={e =>
                          setPaymentAccounts(prev => ({
                            ...prev,
                            telebirr: { ...prev.telebirr, accountNumber: e.target.value }
                          }))
                        }
                        style={{ padding: '10px 14px', fontSize: '13px' }}
                      />
                    </div>

                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '11px',
                          fontWeight: 800,
                          color: '#475569',
                          marginBottom: '6px'
                        }}
                      >
                        Registered Account Holder Name
                      </label>
                      <input
                        type="text"
                        className="sonic-input-field"
                        placeholder="e.g. Remedan"
                        value={paymentAccounts.telebirr.accountName}
                        disabled={!paymentAccounts.telebirr.isActive}
                        onChange={e =>
                          setPaymentAccounts(prev => ({
                            ...prev,
                            telebirr: { ...prev.telebirr, accountName: e.target.value }
                          }))
                        }
                        style={{ padding: '10px 14px', fontSize: '13px' }}
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Safaricom M-Pesa Card */}
                <div
                  style={{
                    background: paymentAccounts.mpesa.isActive ? '#ffffff' : '#f8fafc',
                    border: paymentAccounts.mpesa.isActive ? '1.5px solid #10b981' : '1px solid #e2e8f0',
                    borderRadius: '16px',
                    padding: '20px',
                    boxShadow: paymentAccounts.mpesa.isActive ? '0 4px 14px rgba(16, 185, 129, 0.08)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '16px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <MpesaLogo size={26} />
                      <div>
                        <strong style={{ fontSize: '15px', color: '#0f172a', display: 'block' }}>
                          Safaricom M-Pesa
                        </strong>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>Instant mobile settlement</div>
                      </div>
                    </div>

                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 800
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={paymentAccounts.mpesa.isActive}
                        onChange={e =>
                          setPaymentAccounts(prev => ({
                            ...prev,
                            mpesa: { ...prev.mpesa, isActive: e.target.checked }
                          }))
                        }
                        style={{ width: '16px', height: '16px', accentColor: '#10b981', cursor: 'pointer' }}
                      />
                      <span style={{ color: paymentAccounts.mpesa.isActive ? '#10b981' : '#94a3b8' }}>
                        {paymentAccounts.mpesa.isActive ? 'Active' : 'Off'}
                      </span>
                    </label>
                  </div>

                  <div style={{ opacity: paymentAccounts.mpesa.isActive ? 1 : 0.6 }}>
                    <div style={{ marginBottom: '12px' }}>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '11px',
                          fontWeight: 800,
                          color: '#475569',
                          marginBottom: '6px'
                        }}
                      >
                        M-Pesa Phone Number
                      </label>
                      <input
                        type="text"
                        className="sonic-input-field"
                        placeholder="e.g. 07 12 34 56 78"
                        value={paymentAccounts.mpesa.accountNumber}
                        disabled={!paymentAccounts.mpesa.isActive}
                        onChange={e =>
                          setPaymentAccounts(prev => ({
                            ...prev,
                            mpesa: { ...prev.mpesa, accountNumber: e.target.value }
                          }))
                        }
                        style={{ padding: '10px 14px', fontSize: '13px' }}
                      />
                    </div>

                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '11px',
                          fontWeight: 800,
                          color: '#475569',
                          marginBottom: '6px'
                        }}
                      >
                        M-Pesa Account Holder Name
                      </label>
                      <input
                        type="text"
                        className="sonic-input-field"
                        placeholder="e.g. Remedan"
                        value={paymentAccounts.mpesa.accountName}
                        disabled={!paymentAccounts.mpesa.isActive}
                        onChange={e =>
                          setPaymentAccounts(prev => ({
                            ...prev,
                            mpesa: { ...prev.mpesa, accountName: e.target.value }
                          }))
                        }
                        style={{ padding: '10px 14px', fontSize: '13px' }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Tip & Save Action */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '16px',
                  paddingTop: '16px',
                  borderTop: '1px solid #f1f5f9'
                }}
              >
                <div style={{ fontSize: '13px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-lightbulb" style={{ color: '#eab308', fontSize: '15px' }}></i>
                  <span>
                    <strong>Counter Tip:</strong> Players will only be presented with the payment options you have enabled above.
                  </span>
                </div>

                <button
                  type="submit"
                  className="sonic-btn-gold"
                  style={{
                    width: 'auto',
                    minWidth: '240px',
                    padding: '13px 28px',
                    fontSize: '13px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                  disabled={isSavingAccounts || isLoadingAccounts}
                >
                  {isSavingAccounts ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin"></i> Saving Payment Accounts...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-floppy-disk"></i> Save & Update Payment Rails
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </form>

      {/* ====================================================================
          3. HELPFUL GUIDE CARD
          ==================================================================== */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '20px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '16px'
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: '#ecfdf5',
            color: '#059669',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            flexShrink: 0
          }}
        >
          <i className="fa-solid fa-shield-halved"></i>
        </div>
        <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.6 }}>
          <strong style={{ color: '#0f172a', display: 'block', fontSize: '13px', marginBottom: '4px' }}>
            Instant Counter & Player Deposit Routing
          </strong>
          When recruited players request a deposit or counter cashout, your active payment accounts will be shown to them. Always verify incoming SMS transaction codes from your official Telebirr or CBE provider before accepting player deposit requests.
        </div>
      </div>
    </div>
  );
};

export default AgentPaymentRailsDesk;

