import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/apiClient.ts';
import { useApp } from '../context/AppContext.tsx';

function extractInviteFromLocation(): string {
  if (typeof window === 'undefined') return '';
  try {
    const hash = window.location.hash || '';
    const qIdx = hash.indexOf('?');
    if (qIdx !== -1) {
      const hp = new URLSearchParams(hash.slice(qIdx + 1));
      const hToken = hp.get('invite');
      if (hToken) return hToken.trim().toUpperCase();
    }
    const sp = new URLSearchParams(window.location.search || '');
    const sToken = sp.get('invite');
    if (sToken) return sToken.trim().toUpperCase();
  } catch {}
  return '';
}

export const AffiliateRegisterPage: React.FC = () => {
  const { showToast, switchPage } = useApp();

  const [inviteToken, setInviteToken] = useState<string>(() => extractInviteFromLocation());
  const [manualTokenInput, setManualTokenInput] = useState<string>(() => extractInviteFromLocation());
  const [inviteInfo, setInviteInfo] = useState<{
    token: string;
    label: string;
    requiresApproval: boolean;
    maxUses: number | null;
    usesCount: number;
    expiresAt: string | null;
  } | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [checkingInvite, setCheckingInvite] = useState<boolean>(false);

  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    password: '',
    confirmPassword: '',
    payoutMethod: 'Telebirr',
    payoutAccount: '',
    payoutAccountName: '',
    applicationNotes: ''
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdResult, setCreatedResult] = useState<{
    requiresApproval: boolean;
    affiliate: {
      id: string;
      affiliateCode: string;
      fullName: string;
      phone: string;
      payoutMethod: string;
      payoutAccount: string;
      status: string;
      approvalStatus: string;
    };
  } | null>(null);

  const validateToken = useCallback(async (tokenToCheck: string) => {
    const clean = tokenToCheck.trim().toUpperCase();
    if (!clean) {
      setInviteInfo(null);
      setInviteError('Please enter your Admin-provided invite token to continue.');
      return;
    }

    try {
      setCheckingInvite(true);
      setInviteError(null);
      const res = await apiClient.affiliatesPublic.validateInvite(clean);
      if (res?.success && res.invite) {
        setInviteInfo(res.invite);
        setInviteToken(res.invite.token);
      } else {
        setInviteInfo(null);
        setInviteError('Invalid or expired affiliate registration link.');
      }
    } catch (err: any) {
      setInviteInfo(null);
      setInviteError(err?.message || 'Unable to verify registration link.');
    } finally {
      setCheckingInvite(false);
    }
  }, []);

  useEffect(() => {
    if (inviteToken) {
      validateToken(inviteToken);
    }
  }, [inviteToken, validateToken]);

  const handleApplyToken = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = manualTokenInput.trim().toUpperCase();
    if (clean) {
      setInviteToken(clean);
      validateToken(clean);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!inviteInfo?.token) {
      setSubmitError('A verified invite link token is required.');
      return;
    }
    if (form.password.trim().length < 4) {
      setSubmitError('Portal password / PIN must be at least 4 characters.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setSubmitError('Passwords do not match.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await apiClient.affiliatesPublic.register({
        inviteToken: inviteInfo.token,
        fullName: form.fullName,
        phone: form.phone,
        password: form.password,
        payoutMethod: form.payoutMethod,
        payoutAccount: form.payoutAccount || form.phone,
        payoutAccountName: form.payoutAccountName || form.fullName,
        applicationNotes: form.applicationNotes || undefined
      });
      if (res?.success) {
        setCreatedResult({
          requiresApproval: res.requiresApproval,
          affiliate: res.affiliate
        });
        showToast('✅ Affiliate application submitted!');
      }
    } catch (err: any) {
      setSubmitError(err?.message || 'Registration failed. Please check your details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCode = (val: string, label: string) => {
    try {
      navigator.clipboard.writeText(val);
      showToast(`📋 Copied ${label}`);
    } catch {
      showToast('Copy failed');
    }
  };

  const originBase = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="aff-reg-root">
      <div className="aff-reg-shell">
        {/* Left: Obsidian Enqu Partner Overview */}
        <div className="aff-reg-hero">
          <div className="aff-reg-brand">
            <span>◆</span> LOMI BINGO AFFILIATE PROGRAM
          </div>
          <h1>Partner &amp; Earn on Every Player You Refer</h1>
          <p className="aff-reg-hero-sub">
            Join the official Lomi Bingo Partner Network. Refer players via your unique link or QR code and earn
            across six transparent, automated commission tiers.
          </p>

          <div className="aff-reg-perks">
            <div className="aff-reg-perk">
              <div className="aff-reg-perk-icon">💎</div>
              <div>
                <b>Up to 6% Deposit &amp; Registration Commissions</b>
                <span>Registration bonus, 6% first qualifying deposit, 2% recurring deposits, plus monthly &amp; loyalty rewards.</span>
              </div>
            </div>
            <div className="aff-reg-perk">
              <div className="aff-reg-perk-icon">🎯</div>
              <div>
                <b>Monthly Target Bonuses</b>
                <span>Unlock extra milestone bonuses automatically when your monthly referred players hit your target.</span>
              </div>
            </div>
            <div className="aff-reg-perk">
              <div className="aff-reg-perk-icon">⚡</div>
              <div>
                <b>Telebirr, CBE Birr &amp; Bank Payouts</b>
                <span>Track pending vs. approved wallet earnings and request scheduled withdrawals from your Partner Portal.</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '12px', color: '#94a3b8' }}>
            <span>Single-owner player guarantee</span>
            <span>ETB Real-Time Ledger</span>
          </div>
        </div>

        {/* Right: Application / Confirmation Card */}
        <div className="aff-reg-card">
          {createdResult ? (
            <div>
              <div className="aff-reg-card-head">
                <div>
                  <h2>{createdResult.requiresApproval ? 'Application Received' : 'Welcome, Partner!'}</h2>
                  <div style={{ fontSize: '13.5px', color: '#64748b', marginTop: '4px' }}>
                    {createdResult.requiresApproval
                      ? 'Your application is queued for Admin review.'
                      : 'Your Affiliate Partner account is approved and active.'}
                  </div>
                </div>
                <span className={`aff-reg-pill ${createdResult.requiresApproval ? 'amber' : 'green'}`}>
                  {createdResult.requiresApproval ? 'Pending Review' : 'Active Partner'}
                </span>
              </div>

              <div className="aff-reg-code-box">
                <div>
                  <div style={{ fontSize: '11.5px', color: '#a1a1aa', fontWeight: 700 }}>YOUR AFFILIATE CODE</div>
                  <div style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '0.5px', marginTop: '2px' }}>
                    {createdResult.affiliate.affiliateCode}
                  </div>
                </div>
                <button
                  type="button"
                  className="aff-reg-btn-ghost"
                  onClick={() => handleCopyCode(createdResult.affiliate.affiliateCode, 'Affiliate Code')}
                >
                  Copy Code
                </button>
              </div>

              <div className="aff-reg-alert info">
                {createdResult.requiresApproval ? (
                  <>
                    <strong>Next Step:</strong> An Administrator will approve your account from the{' '}
                    <b>Affiliate Manager</b> desk. Once approved, you can sign in to your Affiliate Portal with phone{' '}
                    <b>{createdResult.affiliate.phone}</b>.
                  </>
                ) : (
                  <>
                    <strong>Ready to Refer!</strong> Share your referral link:{' '}
                    <code>{`${originBase}/?ref=aff_${createdResult.affiliate.affiliateCode}`}</code>
                  </>
                )}
              </div>

              <div style={{ fontSize: '13px', color: '#475569', display: 'grid', gap: '6px', marginBottom: '18px' }}>
                <div><b>Full Name:</b> {createdResult.affiliate.fullName}</div>
                <div><b>Phone:</b> {createdResult.affiliate.phone}</div>
                <div><b>Payout Method:</b> {createdResult.affiliate.payoutMethod} ({createdResult.affiliate.payoutAccount})</div>
              </div>

              {!createdResult.requiresApproval && (
                <button
                  type="button"
                  className="aff-reg-btn-primary"
                  style={{ marginBottom: '10px' }}
                  onClick={() =>
                    handleCopyCode(`${originBase}/?ref=aff_${createdResult.affiliate.affiliateCode}`, 'Player Referral Link')
                  }
                >
                  Copy Player Referral Link
                </button>
              )}

              <button type="button" className="aff-reg-btn-ghost" style={{ width: '100%' }} onClick={() => switchPage('landing')}>
                Back to Lomi Bingo Home
              </button>
            </div>
          ) : (
            <div>
              <div className="aff-reg-card-head">
                <div>
                  <h2>Affiliate Application</h2>
                  <div style={{ fontSize: '13px', color: '#64748b', marginTop: '3px' }}>
                    {inviteInfo ? inviteInfo.label : 'Verify your Admin invite link to register'}
                  </div>
                </div>
                {checkingInvite ? (
                  <span className="aff-reg-pill">Verifying invite…</span>
                ) : inviteInfo ? (
                  <span className={`aff-reg-pill ${inviteInfo.requiresApproval ? 'amber' : 'green'}`}>
                    {inviteInfo.requiresApproval ? 'Approval Required' : 'Instant Activation'}
                  </span>
                ) : (
                  <span className="aff-reg-pill red">Invite Needed</span>
                )}
              </div>

              {!inviteInfo && (
                <form onSubmit={handleApplyToken} style={{ marginBottom: '16px' }}>
                  {inviteError && <div className="aff-reg-alert error">{inviteError}</div>}
                  <div className="aff-reg-field">
                    <label>Admin Invite Token</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        className="aff-reg-input"
                        placeholder="Paste invite code (e.g. 623340A07AE93F0A)"
                        value={manualTokenInput}
                        onChange={e => setManualTokenInput(e.target.value)}
                      />
                      <button type="submit" className="aff-reg-btn-ghost" disabled={checkingInvite}>
                        Verify
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {inviteInfo && (
                <form onSubmit={handleSubmit}>
                  {submitError && <div className="aff-reg-alert error">{submitError}</div>}

                  <div className="aff-reg-grid2">
                    <div className="aff-reg-field">
                      <label>Full Name *</label>
                      <input
                        className="aff-reg-input"
                        required
                        placeholder="e.g. Abebe Kebede"
                        value={form.fullName}
                        onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                      />
                    </div>
                    <div className="aff-reg-field">
                      <label>Phone Number *</label>
                      <input
                        className="aff-reg-input"
                        required
                        placeholder="0911223344"
                        value={form.phone}
                        onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="aff-reg-grid2">
                    <div className="aff-reg-field">
                      <label>Portal Password / PIN *</label>
                      <input
                        type="password"
                        className="aff-reg-input"
                        required
                        minLength={4}
                        placeholder="Min 4 characters"
                        value={form.password}
                        onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      />
                    </div>
                    <div className="aff-reg-field">
                      <label>Confirm Password *</label>
                      <input
                        type="password"
                        className="aff-reg-input"
                        required
                        minLength={4}
                        placeholder="Repeat password"
                        value={form.confirmPassword}
                        onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="aff-reg-grid2">
                    <div className="aff-reg-field">
                      <label>Preferred Payout Method</label>
                      <select
                        className="aff-reg-input"
                        value={form.payoutMethod}
                        onChange={e => setForm(f => ({ ...f, payoutMethod: e.target.value }))}
                      >
                        <option value="Telebirr">Telebirr</option>
                        <option value="CBE Birr">CBE Birr</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                      </select>
                    </div>
                    <div className="aff-reg-field">
                      <label>Payout Account / Phone</label>
                      <input
                        className="aff-reg-input"
                        placeholder="Defaults to phone number"
                        value={form.payoutAccount}
                        onChange={e => setForm(f => ({ ...f, payoutAccount: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="aff-reg-field">
                    <label>How Will You Promote Lomi Bingo? (Optional)</label>
                    <input
                      className="aff-reg-input"
                      placeholder="Telegram channel, TikTok, offline community..."
                      value={form.applicationNotes}
                      onChange={e => setForm(f => ({ ...f, applicationNotes: e.target.value }))}
                    />
                  </div>

                  <button type="submit" className="aff-reg-btn-primary" disabled={isSubmitting}>
                    {isSubmitting ? 'Submitting Application…' : 'Submit Affiliate Application'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
