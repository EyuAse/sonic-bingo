import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '../services/apiClient.ts';
import { useApp } from '../context/AppContext.tsx';
import { renderQrToCanvas, downloadQrPng } from '../utils/qrCodeGenerator.ts';

type PortalTab = 'overview' | 'players' | 'commissions' | 'wallet' | 'profile';

const fmtETB = (n: number) =>
  Number(n || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

const fmtInt = (n: number) => Number(n || 0).toLocaleString('en-US');

const fmtDate = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const AffiliatePortalPage: React.FC = () => {
  const { showToast, switchPage } = useApp();
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [token, setToken] = useState<string | null>(() =>
    typeof window !== 'undefined' ? localStorage.getItem('sonic_affiliate_token') : null
  );
  const [activeTab, setActiveTab] = useState<PortalTab>('overview');
  const [overview, setOverview] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(token));
  const [authError, setAuthError] = useState<string | null>(null);

  // Login State
  const [loginForm, setLoginForm] = useState({ phone: '', password: '' });
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Tab 2: Players State
  const [players, setPlayers] = useState<any[]>([]);
  const [playerFilter, setPlayerFilter] = useState<'all' | 'new_30d' | 'active_14d' | 'inactive'>('all');
  const [playerSearch, setPlayerSearch] = useState('');
  const [playerPage, setPlayerPage] = useState(1);
  const [playerTotalPages, setPlayerTotalPages] = useState(1);
  const [playerTotalCount, setPlayerTotalCount] = useState(0);
  const [inspectedPlayer, setInspectedPlayer] = useState<{ player: any; deposits: any[] } | null>(null);
  const [loadingPlayers, setLoadingPlayers] = useState(false);

  // Tab 3: Commissions State
  const [commissions, setCommissions] = useState<any[]>([]);
  const [commBreakdown, setCommBreakdown] = useState<any[]>([]);
  const [commTypeFilter, setCommTypeFilter] = useState('all');
  const [commStatusFilter, setCommStatusFilter] = useState('all');
  const [commFrom, setCommFrom] = useState('');
  const [commTo, setCommTo] = useState('');
  const [commPage, setCommPage] = useState(1);
  const [commTotalPages, setCommTotalPages] = useState(1);
  const [commTotalCount, setCommTotalCount] = useState(0);
  const [loadingComms, setLoadingComms] = useState(false);

  // Tab 4: Wallet & Withdrawals State
  const [walletData, setWalletData] = useState<any>(null);
  const [wdForm, setWdForm] = useState({ amount: '', payoutMethod: 'Telebirr', payoutAccount: '', payoutAccountName: '' });
  const [wdError, setWdError] = useState<string | null>(null);
  const [isSubmittingWd, setIsSubmittingWd] = useState(false);

  // Tab 5: Profile State
  const [profileForm, setProfileForm] = useState({
    fullName: '',
    phone: '',
    payoutMethod: 'Telebirr',
    payoutAccount: '',
    payoutAccountName: '',
    currentPassword: '',
    newPassword: ''
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const handleSessionError = useCallback(
    (err: any) => {
      const msg = err?.message || 'Request failed';
      showToast(`⚠️ ${msg}`);
      if (/expired|invalid affiliate|authentication required|pending admin approval|suspended|declined/i.test(msg)) {
        localStorage.removeItem('sonic_affiliate_token');
        localStorage.removeItem('sonic_affiliate_user');
        setToken(null);
        setOverview(null);
        setAuthError(msg);
      }
    },
    [showToast]
  );

  const loadOverview = useCallback(async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      const res = await apiClient.affiliatePortal.getOverview();
      if (res?.success && res.overview) {
        setOverview(res.overview);
        setWdForm(prev => ({
          ...prev,
          payoutMethod: prev.payoutMethod || res.overview.payoutMethod || 'Telebirr',
          payoutAccount: prev.payoutAccount || res.overview.payoutAccount || res.overview.phone || '',
          payoutAccountName: prev.payoutAccountName || res.overview.payoutAccountName || res.overview.fullName || ''
        }));
        setProfileForm(prev => ({
          ...prev,
          fullName: res.overview.fullName || '',
          phone: res.overview.phone || '',
          payoutMethod: res.overview.payoutMethod || 'Telebirr',
          payoutAccount: res.overview.payoutAccount || '',
          payoutAccountName: res.overview.payoutAccountName || ''
        }));
      }
    } catch (err: any) {
      handleSessionError(err);
    } finally {
      setIsLoading(false);
    }
  }, [token, handleSessionError]);

  const loadPlayers = useCallback(async () => {
    if (!token) return;
    try {
      setLoadingPlayers(true);
      const res = await apiClient.affiliatePortal.getPlayers({
        filter: playerFilter,
        search: playerSearch.trim() || undefined,
        page: playerPage,
        limit: 20
      });
      if (res?.success) {
        setPlayers(res.players || []);
        setPlayerTotalPages(res.totalPages || 1);
        setPlayerTotalCount(res.totalCount || 0);
      }
    } catch (err: any) {
      handleSessionError(err);
    } finally {
      setLoadingPlayers(false);
    }
  }, [token, playerFilter, playerSearch, playerPage, handleSessionError]);

  const loadCommissions = useCallback(async () => {
    if (!token) return;
    try {
      setLoadingComms(true);
      const res = await apiClient.affiliatePortal.getCommissions({
        type: commTypeFilter,
        status: commStatusFilter,
        from: commFrom || undefined,
        to: commTo || undefined,
        page: commPage,
        limit: 20
      });
      if (res?.success) {
        setCommissions(res.commissions || []);
        setCommBreakdown(res.breakdown || []);
        setCommTotalPages(res.totalPages || 1);
        setCommTotalCount(res.totalCount || 0);
      }
    } catch (err: any) {
      handleSessionError(err);
    } finally {
      setLoadingComms(false);
    }
  }, [token, commTypeFilter, commStatusFilter, commFrom, commTo, commPage, handleSessionError]);

  const loadWallet = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiClient.affiliatePortal.getWallet();
      if (res?.success && res.wallet) {
        setWalletData(res.wallet);
        setWdForm(prev => ({
          ...prev,
          payoutMethod: prev.payoutMethod || res.wallet.payoutMethod || 'Telebirr',
          payoutAccount: prev.payoutAccount || res.wallet.payoutAccount || '',
          payoutAccountName: prev.payoutAccountName || res.wallet.payoutAccountName || ''
        }));
      }
    } catch (err: any) {
      handleSessionError(err);
    }
  }, [token, handleSessionError]);

  useEffect(() => {
    if (token) {
      loadOverview();
    }
  }, [token, loadOverview]);

  useEffect(() => {
    if (!token) return;
    if (activeTab === 'players') loadPlayers();
    if (activeTab === 'commissions') loadCommissions();
    if (activeTab === 'wallet') loadWallet();
  }, [token, activeTab, loadPlayers, loadCommissions, loadWallet]);

  const originBase = typeof window !== 'undefined' ? window.location.origin : '';
  const affiliateCode = overview?.affiliateCode || '';
  const botUsername = overview?.botUsername || 'LomiBingobot';
  const webReferralUrl = affiliateCode ? `${originBase}/?ref=aff_${affiliateCode}` : '';
  const tgReferralUrl = affiliateCode ? `https://t.me/${botUsername}?startapp=aff_${affiliateCode}` : '';

  useEffect(() => {
    if ((activeTab === 'overview' || activeTab === 'profile') && webReferralUrl && qrCanvasRef.current) {
      renderQrToCanvas(qrCanvasRef.current, webReferralUrl, 200);
    }
  }, [activeTab, webReferralUrl]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      setIsLoggingIn(true);
      const res = await apiClient.affiliatePortal.login(loginForm.phone, loginForm.password);
      if (res?.success && res.token) {
        localStorage.setItem('sonic_affiliate_token', res.token);
        localStorage.setItem('sonic_affiliate_user', JSON.stringify(res.affiliate));
        setToken(res.token);
        showToast(`✅ Welcome back, ${res.affiliate.fullName}`);
      }
    } catch (err: any) {
      setAuthError(err?.message || 'Login failed');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('sonic_affiliate_token');
    localStorage.removeItem('sonic_affiliate_user');
    setToken(null);
    setOverview(null);
    setInspectedPlayer(null);
    setActiveTab('overview');
  };

  const handleCopy = (val: string, label: string) => {
    try {
      navigator.clipboard.writeText(val);
      showToast(`📋 Copied ${label}`);
    } catch {
      showToast('Copy failed');
    }
  };

  const handleInspectPlayer = async (playerId: string) => {
    try {
      const res = await apiClient.affiliatePortal.getPlayerDeposits(playerId);
      if (res?.success) {
        setInspectedPlayer({ player: res.player, deposits: res.deposits || [] });
      }
    } catch (err: any) {
      showToast(`⚠️ ${err?.message || 'Failed to load player deposits'}`);
    }
  };

  const handleRequestWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    setWdError(null);
    const amt = Number(wdForm.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setWdError('Please enter a valid withdrawal amount.');
      return;
    }

    try {
      setIsSubmittingWd(true);
      const res = await apiClient.affiliatePortal.requestWithdrawal({
        amount: amt,
        payoutMethod: wdForm.payoutMethod,
        payoutAccount: wdForm.payoutAccount,
        payoutAccountName: wdForm.payoutAccountName
      });
      if (res?.success) {
        showToast(`✅ Withdrawal request for ETB ${fmtETB(amt)} submitted!`);
        setWdForm(prev => ({ ...prev, amount: '' }));
        await Promise.all([loadWallet(), loadOverview()]);
      }
    } catch (err: any) {
      setWdError(err?.message || 'Withdrawal request failed');
    } finally {
      setIsSubmittingWd(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSavingProfile(true);
      const res = await apiClient.affiliatePortal.updateProfile({
        fullName: profileForm.fullName,
        phone: profileForm.phone,
        payoutMethod: profileForm.payoutMethod,
        payoutAccount: profileForm.payoutAccount,
        payoutAccountName: profileForm.payoutAccountName,
        currentPassword: profileForm.newPassword ? profileForm.currentPassword : undefined,
        newPassword: profileForm.newPassword || undefined
      });
      if (res?.success) {
        showToast('✅ Partner profile saved');
        setProfileForm(p => ({ ...p, currentPassword: '', newPassword: '' }));
        loadOverview();
      }
    } catch (err: any) {
      showToast(`❌ ${err?.message || 'Failed to save profile'}`);
    } finally {
      setIsSavingProfile(false);
    }
  };

  if (!token) {
    return (
      <div className="aff-portal-root">
        <div className="aff-portal-login-shell">
          <form className="aff-portal-login-card" onSubmit={handleLoginSubmit}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span className="aff-portal-badge">AFFILIATE PARTNER PORTAL</span>
              <button type="button" className="aff-portal-btn-ghost" onClick={() => switchPage('landing')}>
                Home
              </button>
            </div>
            <h1 style={{ margin: '0 0 6px', fontSize: '25px', fontWeight: 800 }}>Partner Sign In</h1>
            <p style={{ margin: '0 0 18px', fontSize: '13.5px', color: '#64748b' }}>
              Track your referred players, 6 commission tiers, monthly target progress, and payouts.
            </p>

            {authError && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#991b1b',
                  padding: '10px 12px',
                  borderRadius: '12px',
                  fontSize: '13px',
                  fontWeight: 600,
                  marginBottom: '14px'
                }}
              >
                {authError}
              </div>
            )}

            <div className="aff-portal-field">
              <label>Phone Number</label>
              <input
                className="aff-portal-input"
                required
                placeholder="0911223344"
                value={loginForm.phone}
                onChange={e => setLoginForm(f => ({ ...f, phone: e.target.value }))}
              />
            </div>

            <div className="aff-portal-field">
              <label>Portal Password / PIN</label>
              <input
                type="password"
                className="aff-portal-input"
                required
                placeholder="Enter your password"
                value={loginForm.password}
                onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))}
              />
            </div>

            <button type="submit" className="aff-portal-btn-dark" style={{ width: '100%', padding: '12px' }} disabled={isLoggingIn}>
              {isLoggingIn ? 'Signing In…' : 'Sign In to Partner Dashboard'}
            </button>

            <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
              Have an Admin invite token?{' '}
              <button
                type="button"
                onClick={() => switchPage('affiliate-register')}
                style={{ background: 'none', border: 'none', color: '#1b1b1b', fontWeight: 800, cursor: 'pointer', textDecoration: 'underline' }}
              >
                Apply as an Affiliate
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="aff-portal-root">
      <div className="aff-portal-wrap">
        {overview?.impersonatedByAdmin && (
          <div className="aff-portal-support-banner">
            <span>🛡️ Admin Support Inspection Session ({overview.affiliateCode} · {overview.fullName})</span>
            <button type="button" className="aff-portal-btn-ghost" onClick={handleLogout}>
              End Support Session
            </button>
          </div>
        )}

        {/* Portal Top Bar */}
        <div className="aff-portal-nav">
          <div className="aff-portal-brand">
            <div>
              <div style={{ fontWeight: 800, fontSize: '17px' }}>
                {overview?.fullName || 'Affiliate Partner'}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                <span className="aff-portal-badge">{affiliateCode || 'AFF-PARTNER'}</span> · {overview?.phone || ''}
              </div>
            </div>
          </div>

          <div className="aff-portal-tabs" role="tablist">
            {(
              [
                ['overview', 'Overview'],
                ['players', 'Players'],
                ['commissions', 'Commissions'],
                ['wallet', 'Wallet'],
                ['profile', 'Profile']
              ] as Array<[PortalTab, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`aff-portal-tab ${activeTab === key ? 'active' : ''}`}
                onClick={() => setActiveTab(key)}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="aff-portal-btn-ghost"
              onClick={() => {
                loadOverview();
                if (activeTab === 'players') loadPlayers();
                if (activeTab === 'commissions') loadCommissions();
                if (activeTab === 'wallet') loadWallet();
              }}
              disabled={isLoading}
            >
              {isLoading ? 'Syncing…' : '↻ Refresh'}
            </button>
            <button type="button" className="aff-portal-btn-ghost" onClick={handleLogout}>
              Sign Out
            </button>
          </div>
        </div>

        {/* =================================================================
            TAB 1: DASHBOARD OVERVIEW + QR
            ================================================================= */}
        {activeTab === 'overview' && (
          <>
            <div className="aff-portal-grid aff-portal-g4">
              <div className="aff-portal-card dark-hero">
                <div className="aff-portal-lab">Wallet Balance (Available)</div>
                <div className="aff-portal-val">ETB {fmtETB(overview?.walletBalance || 0)}</div>
                <div className="aff-portal-sub">
                  Total Earned: ETB {fmtETB(overview?.totalEarned || 0)} · Pending: ETB {fmtETB(overview?.pendingCommission || 0)}
                </div>
              </div>
              <div className="aff-portal-card">
                <div className="aff-portal-lab">Total Referred Players</div>
                <div className="aff-portal-val">{fmtInt(overview?.totalPlayers || 0)}</div>
                <div className="aff-portal-sub">
                  {fmtInt(overview?.newPlayers30d || 0)} new in last 30 days
                </div>
              </div>
              <div className="aff-portal-card">
                <div className="aff-portal-lab">Active Players (14d)</div>
                <div className="aff-portal-val">{fmtInt(overview?.activePlayers14d || 0)}</div>
                <div className="aff-portal-sub">Deposited in last 14 days</div>
              </div>
              <div className="aff-portal-card">
                <div className="aff-portal-lab">Player Deposits (30d)</div>
                <div className="aff-portal-val">ETB {fmtETB(overview?.totalDeposits30d || 0)}</div>
                <div className="aff-portal-sub">Lifetime: ETB {fmtETB(overview?.lifetimeDeposits || 0)}</div>
              </div>
            </div>

            <div className="aff-portal-grid aff-portal-g2">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div className="aff-portal-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>Monthly Player Registration Target</h3>
                      <div className="aff-portal-lab" style={{ marginTop: '2px' }}>
                        Progress toward unlocking this month's target bonus
                      </div>
                    </div>
                    <span className={`aff-portal-chip ${(overview?.targetProgressPct || 0) >= 100 ? 'green' : 'blue'}`}>
                      {overview?.monthPlayersCount || 0} / {overview?.monthlyTarget || 50} Players ({overview?.targetProgressPct || 0}%)
                    </span>
                  </div>

                  <div className="aff-portal-progress-track">
                    <div
                      className="aff-portal-progress-fill"
                      style={{ width: `${Math.min(100, overview?.targetProgressPct || 0)}%` }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: '#64748b' }}>
                    <span>
                      {(overview?.monthPlayersCount || 0) >= (overview?.monthlyTarget || 50)
                        ? '🎉 Monthly target achieved!'
                        : `${Math.max(0, (overview?.monthlyTarget || 50) - (overview?.monthPlayersCount || 0))} more referred players needed this month`}
                    </span>
                    <span>
                      Withdrawal Window:{' '}
                      <b>{overview?.scheduleStatus?.allowed ? 'Open Now' : overview?.scheduleStatus?.nextWindowLabel || 'End of Month'}</b>
                    </span>
                  </div>
                </div>

                <div className="aff-portal-card">
                  <h3 style={{ margin: '0 0 10px', fontSize: '16.5px', fontWeight: 800 }}>Active Commission Streams</h3>
                  <div className="aff-portal-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Commission Type</th>
                          <th>Rate / Reward</th>
                          <th>Qualification</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(overview?.activeRules || []).length === 0 ? (
                          <tr>
                            <td colSpan={3} style={{ textAlign: 'center', padding: '14px', color: '#707070' }}>
                              No active commission rules loaded.
                            </td>
                          </tr>
                        ) : (
                          overview.activeRules.map((r: any) => (
                            <tr key={r.commission_type}>
                              <td><b>{r.display_name}</b></td>
                              <td>
                                <span className="aff-portal-chip green">
                                  {r.calc_mode === 'percent' ? `${parseFloat(r.rate_or_amount)}%` : `ETB ${fmtETB(r.rate_or_amount)}`}
                                </span>
                              </td>
                              <td style={{ fontSize: '12.5px', color: '#64748b' }}>
                                {Number(r.min_qualifying_deposit) > 0 && `Deposit > ETB ${fmtETB(r.min_qualifying_deposit)}`}
                                {Number(r.min_monthly_players) > 0 && `${r.min_monthly_players} players/mo`}
                                {Number(r.min_qualifying_deposit) === 0 && Number(r.min_monthly_players) === 0 && 'Standard active rule'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="aff-portal-card">
                <h3 style={{ margin: '0 0 4px', fontSize: '17px', fontWeight: 800 }}>Your Referral Link &amp; QR Code</h3>
                <div className="aff-portal-lab">
                  Every player signing up via your link or QR is locked exclusively under your account.
                </div>

                <div className="aff-portal-qr-box">
                  <canvas ref={qrCanvasRef} />
                  <div style={{ marginTop: '10px', fontSize: '12px', fontWeight: 700, color: '#475569' }}>
                    Scan to join Lomi Bingo ({affiliateCode})
                  </div>
                </div>

                <div style={{ marginBottom: '6px', fontSize: '12px', fontWeight: 700, color: '#475569' }}>Web Referral Link</div>
                <div className="aff-portal-link-row">
                  <code>{webReferralUrl || 'Loading...'}</code>
                  <button type="button" className="aff-portal-btn-ghost" onClick={() => handleCopy(webReferralUrl, 'Web Link')}>
                    Copy
                  </button>
                </div>

                <div style={{ marginBottom: '6px', fontSize: '12px', fontWeight: 700, color: '#475569' }}>Telegram Mini-App Link</div>
                <div className="aff-portal-link-row">
                  <code>{tgReferralUrl || 'Loading...'}</code>
                  <button type="button" className="aff-portal-btn-ghost" onClick={() => handleCopy(tgReferralUrl, 'Telegram Link')}>
                    Copy
                  </button>
                </div>

                <button
                  type="button"
                  className="aff-portal-btn-dark"
                  style={{ width: '100%', marginTop: '8px' }}
                  disabled={!webReferralUrl}
                  onClick={() => {
                    downloadQrPng(webReferralUrl, `lomi-bingo-${affiliateCode}-qr.png`);
                    showToast('📥 Downloaded referral QR code PNG');
                  }}
                >
                  ↓ Download QR Code (PNG)
                </button>
              </div>
            </div>
          </>
        )}

        {/* =================================================================
            TAB 2: REFERRED PLAYERS & DEPOSIT HISTORY
            ================================================================= */}
        {activeTab === 'players' && (
          <div className="aff-portal-grid" style={{ gridTemplateColumns: inspectedPlayer ? '1.45fr 1fr' : '1fr' }}>
            <div className="aff-portal-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>Referred Players ({fmtInt(playerTotalCount)})</h3>
                  <div className="aff-portal-lab">Each player can belong exclusively to one affiliate</div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <input
                    className="aff-portal-input"
                    style={{ width: '190px' }}
                    placeholder="Search name or phone..."
                    value={playerSearch}
                    onChange={e => {
                      setPlayerSearch(e.target.value);
                      setPlayerPage(1);
                    }}
                  />
                  <select
                    className="aff-portal-input"
                    style={{ width: 'auto' }}
                    value={playerFilter}
                    onChange={e => {
                      setPlayerFilter(e.target.value as any);
                      setPlayerPage(1);
                    }}
                  >
                    <option value="all">All Players</option>
                    <option value="new_30d">New (Last 30d)</option>
                    <option value="active_14d">Active (14d)</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="aff-portal-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>Joined</th>
                      <th>Activity</th>
                      <th>Total Deposits</th>
                      <th>History</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingPlayers ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '20px', color: '#707070' }}>
                          Loading referred players...
                        </td>
                      </tr>
                    ) : players.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '22px', color: '#707070' }}>
                          No referred players found matching this filter.
                        </td>
                      </tr>
                    ) : (
                      players.map(p => (
                        <tr key={p.id}>
                          <td>
                            <b>{p.fullName}</b>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>{p.phone}</div>
                          </td>
                          <td style={{ fontSize: '12px', color: '#64748b' }}>{fmtDate(p.createdAt)}</td>
                          <td>
                            <span className={`aff-portal-chip ${p.isActive14d ? 'green' : 'amber'}`}>
                              {p.isActive14d ? 'Active 14d' : 'Inactive'}
                            </span>
                            {p.isNew30d && <span className="aff-portal-chip blue" style={{ marginLeft: '5px' }}>New</span>}
                          </td>
                          <td>
                            <b>ETB {fmtETB(p.totalDeposits)}</b>
                            <div style={{ fontSize: '11.5px', color: '#64748b' }}>{fmtInt(p.depositCount)} deposits</div>
                          </td>
                          <td>
                            <button type="button" className="aff-portal-btn-ghost" onClick={() => handleInspectPlayer(p.id)}>
                              Deposits
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', fontSize: '12.5px', color: '#64748b' }}>
                <span>Page <b>{playerPage}</b> of <b>{playerTotalPages}</b></span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="aff-portal-btn-ghost"
                    disabled={playerPage <= 1}
                    onClick={() => setPlayerPage(p => Math.max(1, p - 1))}
                  >
                    ← Prev
                  </button>
                  <button
                    type="button"
                    className="aff-portal-btn-ghost"
                    disabled={playerPage >= playerTotalPages}
                    onClick={() => setPlayerPage(p => Math.min(playerTotalPages, p + 1))}
                  >
                    Next →
                  </button>
                </div>
              </div>
            </div>

            {inspectedPlayer && (
              <div className="aff-portal-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16.5px', fontWeight: 800 }}>{inspectedPlayer.player.fullName}</h3>
                    <div className="aff-portal-lab">
                      {inspectedPlayer.player.phone} · Joined {fmtDate(inspectedPlayer.player.createdAt)}
                    </div>
                  </div>
                  <button type="button" className="aff-portal-btn-ghost" onClick={() => setInspectedPlayer(null)}>✕</button>
                </div>

                <div className="aff-portal-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Amount</th>
                        <th>Method</th>
                        <th>Status</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inspectedPlayer.deposits.length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ textAlign: 'center', padding: '18px', color: '#707070' }}>
                            No deposits recorded for this player yet.
                          </td>
                        </tr>
                      ) : (
                        inspectedPlayer.deposits.map((d: any) => (
                          <tr key={d.id}>
                            <td><b>ETB {fmtETB(d.amount)}</b></td>
                            <td style={{ fontSize: '12px' }}>{d.paymentMethod} ({d.channel})</td>
                            <td>
                              <span
                                className={`aff-portal-chip ${
                                  d.status === 'approved' ? 'green' : d.status === 'rejected' ? 'red' : 'amber'
                                }`}
                              >
                                {String(d.status).toUpperCase()}
                              </span>
                            </td>
                            <td style={{ fontSize: '11.5px', color: '#64748b' }}>{fmtDate(d.createdAt)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =================================================================
            TAB 3: COMMISSIONS HISTORY (ALL 6 STREAMS)
            ================================================================= */}
        {activeTab === 'commissions' && (
          <>
            <div className="aff-portal-grid aff-portal-g3">
              {commBreakdown.map(b => (
                <div key={b.commissionType} className="aff-portal-card">
                  <div className="aff-portal-lab">{b.label}</div>
                  <div className="aff-portal-val" style={{ fontSize: '21px' }}>ETB {fmtETB(b.approvedAmt)}</div>
                  <div className="aff-portal-sub">
                    {fmtInt(b.count)} entries · Pending: ETB {fmtETB(b.pendingAmt)}
                  </div>
                </div>
              ))}
            </div>

            <div className="aff-portal-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>Commission History ({fmtInt(commTotalCount)})</h3>
                  <div className="aff-portal-lab">Pending, Approved, Rejected &amp; Reversed commission ledger</div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <input
                    type="date"
                    className="aff-portal-input"
                    style={{ width: '145px' }}
                    value={commFrom}
                    onChange={e => {
                      setCommFrom(e.target.value);
                      setCommPage(1);
                    }}
                  />
                  <input
                    type="date"
                    className="aff-portal-input"
                    style={{ width: '145px' }}
                    value={commTo}
                    onChange={e => {
                      setCommTo(e.target.value);
                      setCommPage(1);
                    }}
                  />
                  <select
                    className="aff-portal-input"
                    style={{ width: 'auto' }}
                    value={commTypeFilter}
                    onChange={e => {
                      setCommTypeFilter(e.target.value);
                      setCommPage(1);
                    }}
                  >
                    <option value="all">All 6 Types</option>
                    <option value="registration">Registration</option>
                    <option value="first_deposit">First Deposit</option>
                    <option value="regular_deposit">Regular Deposit</option>
                    <option value="target">Target</option>
                    <option value="monthly">Monthly</option>
                    <option value="loyalty">Loyalty</option>
                  </select>
                  <select
                    className="aff-portal-input"
                    style={{ width: 'auto' }}
                    value={commStatusFilter}
                    onChange={e => {
                      setCommStatusFilter(e.target.value);
                      setCommPage(1);
                    }}
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="reversed">Reversed</option>
                  </select>
                </div>
              </div>

              <div className="aff-portal-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Rule Snapshot</th>
                      <th>Player</th>
                      <th>Base</th>
                      <th>Commission</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingComms ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '20px', color: '#707070' }}>
                          Loading commissions...
                        </td>
                      </tr>
                    ) : commissions.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '22px', color: '#707070' }}>
                          No commission records match your filters.
                        </td>
                      </tr>
                    ) : (
                      commissions.map(c => (
                        <tr key={c.id}>
                          <td><span className="aff-portal-chip">{c.commission_type}</span></td>
                          <td style={{ fontSize: '12px' }}>
                            v{c.rule_version} ({c.calc_mode === 'percent' ? `${c.rate_applied}%` : `ETB ${c.rate_applied}`})
                          </td>
                          <td style={{ fontSize: '12.5px' }}>{c.player_name || 'Monthly / Target'}</td>
                          <td>ETB {fmtETB(c.base_amount)}</td>
                          <td><b>ETB {fmtETB(c.amount)}</b></td>
                          <td>
                            <span
                              className={`aff-portal-chip ${
                                c.status === 'approved' ? 'green' : c.status === 'reversed' || c.status === 'rejected' ? 'red' : 'amber'
                              }`}
                            >
                              {String(c.status).toUpperCase()}
                            </span>
                          </td>
                          <td style={{ fontSize: '11.5px', color: '#64748b' }}>{fmtDate(c.created_at)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', fontSize: '12.5px', color: '#64748b' }}>
                <span>Page <b>{commPage}</b> of <b>{commTotalPages}</b></span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="aff-portal-btn-ghost"
                    disabled={commPage <= 1}
                    onClick={() => setCommPage(p => Math.max(1, p - 1))}
                  >
                    ← Prev
                  </button>
                  <button
                    type="button"
                    className="aff-portal-btn-ghost"
                    disabled={commPage >= commTotalPages}
                    onClick={() => setCommPage(p => Math.min(commTotalPages, p + 1))}
                  >
                    Next →
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* =================================================================
            TAB 4: WALLET & MONTHLY WITHDRAWALS
            ================================================================= */}
        {activeTab === 'wallet' && (
          <>
            <div className="aff-portal-grid aff-portal-g3">
              <div className="aff-portal-card dark-hero">
                <div className="aff-portal-lab">Available Withdrawal Balance</div>
                <div className="aff-portal-val">ETB {fmtETB(walletData?.walletBalance ?? overview?.walletBalance ?? 0)}</div>
                <div className="aff-portal-sub">
                  Min withdrawal: ETB {fmtETB(walletData?.payoutSettings?.minWithdrawalAmount ?? 100)}
                </div>
              </div>
              <div className="aff-portal-card">
                <div className="aff-portal-lab">Total Lifetime Earnings</div>
                <div className="aff-portal-val">ETB {fmtETB(walletData?.totalEarned ?? overview?.totalEarned ?? 0)}</div>
                <div className="aff-portal-sub">
                  Pending approval: ETB {fmtETB(walletData?.pendingCommission ?? overview?.pendingCommission ?? 0)}
                </div>
              </div>
              <div className="aff-portal-card">
                <div className="aff-portal-lab">Total Withdrawn / Paid</div>
                <div className="aff-portal-val">ETB {fmtETB(walletData?.totalWithdrawn ?? overview?.totalWithdrawn ?? 0)}</div>
                <div className="aff-portal-sub">
                  Payout Window: <b>{walletData?.scheduleStatus?.allowed ? 'Open Now' : walletData?.scheduleStatus?.nextWindowLabel || 'End of Month'}</b>
                </div>
              </div>
            </div>

            <div className="aff-portal-grid aff-portal-g2-eq">
              {/* Request Withdrawal Form */}
              <form className="aff-portal-card" onSubmit={handleRequestWithdrawal}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>Request Withdrawal</h3>
                  <span className={`aff-portal-chip ${walletData?.scheduleStatus?.allowed ? 'green' : 'amber'}`}>
                    {walletData?.scheduleStatus?.allowed
                      ? 'Payout Window Open'
                      : `Opens ${walletData?.scheduleStatus?.nextWindowLabel || 'Month-End'}`}
                  </span>
                </div>

                {wdError && (
                  <div style={{ background: '#fef2f2', color: '#991b1b', padding: '10px 12px', borderRadius: '12px', fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>
                    {wdError}
                  </div>
                )}

                <div className="aff-portal-grid aff-portal-g2-eq">
                  <div className="aff-portal-field">
                    <label>Amount (ETB)</label>
                    <input
                      type="number"
                      step="0.01"
                      min={walletData?.payoutSettings?.minWithdrawalAmount || 10}
                      className="aff-portal-input"
                      required
                      placeholder={`Min ${walletData?.payoutSettings?.minWithdrawalAmount || 100}`}
                      value={wdForm.amount}
                      onChange={e => setWdForm(f => ({ ...f, amount: e.target.value }))}
                    />
                  </div>
                  <div className="aff-portal-field">
                    <label>Payout Method</label>
                    <select
                      className="aff-portal-input"
                      value={wdForm.payoutMethod}
                      onChange={e => setWdForm(f => ({ ...f, payoutMethod: e.target.value }))}
                    >
                      <option value="Telebirr">Telebirr</option>
                      <option value="CBE Birr">CBE Birr</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                    </select>
                  </div>
                </div>

                <div className="aff-portal-grid aff-portal-g2-eq">
                  <div className="aff-portal-field">
                    <label>Account / Phone</label>
                    <input
                      className="aff-portal-input"
                      required
                      value={wdForm.payoutAccount}
                      onChange={e => setWdForm(f => ({ ...f, payoutAccount: e.target.value }))}
                    />
                  </div>
                  <div className="aff-portal-field">
                    <label>Account Holder Name</label>
                    <input
                      className="aff-portal-input"
                      value={wdForm.payoutAccountName}
                      onChange={e => setWdForm(f => ({ ...f, payoutAccountName: e.target.value }))}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="aff-portal-btn-dark"
                  style={{ width: '100%' }}
                  disabled={isSubmittingWd || !walletData?.scheduleStatus?.allowed}
                >
                  {isSubmittingWd
                    ? 'Submitting Request…'
                    : walletData?.scheduleStatus?.allowed
                      ? 'Submit Withdrawal Request'
                      : `Payouts Open ${walletData?.scheduleStatus?.nextWindowLabel || 'End of Month'}`}
                </button>
              </form>

              {/* Withdrawal History */}
              <div className="aff-portal-card">
                <h3 style={{ margin: '0 0 12px', fontSize: '17px', fontWeight: 800 }}>Withdrawal History</h3>
                <div className="aff-portal-table-wrap" style={{ maxHeight: '290px', overflowY: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Amount</th>
                        <th>Method</th>
                        <th>Status</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(walletData?.withdrawals || []).length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ textAlign: 'center', padding: '18px', color: '#707070' }}>
                            No withdrawal requests submitted yet.
                          </td>
                        </tr>
                      ) : (
                        walletData.withdrawals.map((w: any) => (
                          <tr key={w.id}>
                            <td><b>ETB {fmtETB(w.amount)}</b></td>
                            <td style={{ fontSize: '12px' }}>{w.payout_method} · {w.payout_account}</td>
                            <td>
                              <span
                                className={`aff-portal-chip ${
                                  w.status === 'paid' ? 'green' : w.status === 'rejected' ? 'red' : w.status === 'approved' ? 'blue' : 'amber'
                                }`}
                              >
                                {String(w.status).toUpperCase()}
                              </span>
                            </td>
                            <td style={{ fontSize: '11.5px', color: '#64748b' }}>{fmtDate(w.created_at)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="aff-portal-card">
              <h3 style={{ margin: '0 0 12px', fontSize: '17px', fontWeight: 800 }}>Wallet Transactions Ledger</h3>
              <div className="aff-portal-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>Balance After</th>
                      <th>Reason / Note</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(walletData?.transactions || []).length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '18px', color: '#707070' }}>
                          No wallet transactions yet.
                        </td>
                      </tr>
                    ) : (
                      walletData.transactions.map((tx: any) => (
                        <tr key={tx.id}>
                          <td><span className="aff-portal-chip">{tx.type}</span></td>
                          <td style={{ fontWeight: 700, color: Number(tx.amount) >= 0 ? '#15803d' : '#b91c1c' }}>
                            {Number(tx.amount) >= 0 ? '+' : ''}ETB {fmtETB(tx.amount)}
                          </td>
                          <td>ETB {fmtETB(tx.balance_after)}</td>
                          <td style={{ fontSize: '12.5px' }}>{tx.reason}</td>
                          <td style={{ fontSize: '11.5px', color: '#64748b' }}>{fmtDate(tx.created_at)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* =================================================================
            TAB 5: PROFILE & SETTINGS + REFERRAL QR ACCESS
            ================================================================= */}
        {activeTab === 'profile' && (
          <div className="aff-portal-grid aff-portal-g2">
            <form className="aff-portal-card" onSubmit={handleSaveProfile}>
              <h3 style={{ margin: '0 0 14px', fontSize: '17.5px', fontWeight: 800 }}>Partner Account &amp; Payout Settings</h3>

              <div className="aff-portal-grid aff-portal-g2-eq">
                <div className="aff-portal-field">
                  <label>Full Name</label>
                  <input
                    className="aff-portal-input"
                    required
                    value={profileForm.fullName}
                    onChange={e => setProfileForm(f => ({ ...f, fullName: e.target.value }))}
                  />
                </div>
                <div className="aff-portal-field">
                  <label>Phone Number</label>
                  <input
                    className="aff-portal-input"
                    required
                    value={profileForm.phone}
                    onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))}
                  />
                </div>
              </div>

              <div className="aff-portal-grid aff-portal-g3">
                <div className="aff-portal-field">
                  <label>Default Payout Method</label>
                  <select
                    className="aff-portal-input"
                    value={profileForm.payoutMethod}
                    onChange={e => setProfileForm(f => ({ ...f, payoutMethod: e.target.value }))}
                  >
                    <option value="Telebirr">Telebirr</option>
                    <option value="CBE Birr">CBE Birr</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
                <div className="aff-portal-field">
                  <label>Payout Account</label>
                  <input
                    className="aff-portal-input"
                    value={profileForm.payoutAccount}
                    onChange={e => setProfileForm(f => ({ ...f, payoutAccount: e.target.value }))}
                  />
                </div>
                <div className="aff-portal-field">
                  <label>Account Name</label>
                  <input
                    className="aff-portal-input"
                    value={profileForm.payoutAccountName}
                    onChange={e => setProfileForm(f => ({ ...f, payoutAccountName: e.target.value }))}
                  />
                </div>
              </div>

              <div className="aff-portal-grid aff-portal-g2-eq" style={{ marginTop: '6px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                <div className="aff-portal-field">
                  <label>Current Password (only to change)</label>
                  <input
                    type="password"
                    className="aff-portal-input"
                    placeholder="Required to set new password"
                    value={profileForm.currentPassword}
                    onChange={e => setProfileForm(f => ({ ...f, currentPassword: e.target.value }))}
                  />
                </div>
                <div className="aff-portal-field">
                  <label>New Portal Password / PIN</label>
                  <input
                    type="password"
                    className="aff-portal-input"
                    placeholder="Leave blank to keep existing"
                    value={profileForm.newPassword}
                    onChange={e => setProfileForm(f => ({ ...f, newPassword: e.target.value }))}
                  />
                </div>
              </div>

              <button type="submit" className="aff-portal-btn-dark" disabled={isSavingProfile}>
                {isSavingProfile ? 'Saving Changes…' : 'Save Profile Settings'}
              </button>
            </form>

            <div className="aff-portal-card">
              <h3 style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: 800 }}>Personal Referral QR &amp; Link</h3>
              <div className="aff-portal-qr-box">
                <canvas ref={qrCanvasRef} />
              </div>
              <div className="aff-portal-link-row">
                <code>{webReferralUrl}</code>
                <button type="button" className="aff-portal-btn-ghost" onClick={() => handleCopy(webReferralUrl, 'Referral Link')}>
                  Copy
                </button>
              </div>
              <button
                type="button"
                className="aff-portal-btn-dark"
                style={{ width: '100%' }}
                onClick={() => downloadQrPng(webReferralUrl, `lomi-bingo-${affiliateCode}-qr.png`)}
              >
                ↓ Download QR Code (PNG)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
