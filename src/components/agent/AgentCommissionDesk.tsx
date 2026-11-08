import React, { useState, useEffect } from 'react';
import { apiClient } from '../../services/apiClient.ts';
import { socketService } from '../../services/socketService.ts';

interface AgentCommissionDeskProps {
  agentProfile: any;
  onRefresh: () => void;
  showToast: (msg: string) => void;
  openMobile?: () => void;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const AgentCommissionDesk: React.FC<AgentCommissionDeskProps> = ({
  agentProfile,
  onRefresh,
  showToast
}) => {
  const [overview, setOverview] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Active view tab: 'wd' (Withdrawals) or 'ea' (Earnings)
  const [activeTab, setActiveTab] = useState<'wd' | 'ea'>('wd');

  // Earnings source filter: 'All' | 'Top-up commission' | 'Referral bonus'
  const [sourceFilter, setSourceFilter] = useState<'All' | 'Top-up commission' | 'Referral bonus'>('All');

  // Withdraw Commission Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [payoutMethod, setPayoutMethod] = useState<'Telebirr' | 'M-Pesa' | 'Bank transfer'>('Telebirr');
  const [payoutAccount, setPayoutAccount] = useState<string>('');
  const [accountName, setAccountName] = useState<string>('');
  const [modalError, setModalError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Fetch real-time authoritative overview from Neon DB
  const fetchOverview = async (quiet = false) => {
    try {
      if (!quiet) setIsLoading(true);
      const res = await apiClient.agent.getCommissionOverview();
      if (res.success) {
        setOverview(res);
        if (!accountName && res.agentName) {
          setAccountName(res.agentName);
        }
        if (!payoutAccount && res.agentPhone) {
          setPayoutAccount(res.agentPhone);
        }
      }
    } catch (err: any) {
      console.warn('Failed to load commission overview:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
    const interval = setInterval(() => fetchOverview(true), 15000);

    const agentId = agentProfile?.id;
    const unsubApproved = agentId
      ? socketService.on(`agent_${agentId}_payout_approved`, (data: any) => {
          showToast(`🎉 Payout Approved: ${data.amount} ETB via ${data.payoutMethod}! Ref: ${data.adminRef || 'Settled'}`);
          fetchOverview(true);
          onRefresh();
        })
      : null;

    const unsubRejected = agentId
      ? socketService.on(`agent_${agentId}_payout_rejected`, (data: any) => {
          showToast(`⚠️ Payout Rejected: ${data.reason}. ${data.amount} ETB refunded to your balance.`);
          fetchOverview(true);
          onRefresh();
        })
      : null;

    const unsubGeneric = socketService.on('agent_payout_status_updated', () => {
      fetchOverview(true);
    });

    return () => {
      clearInterval(interval);
      if (unsubApproved) unsubApproved();
      if (unsubRejected) unsubRejected();
      if (unsubGeneric) unsubGeneric();
    };
  }, [agentProfile?.id]);

  // Derived real data
  const availableBalance = overview?.commissionBalance ?? agentProfile?.commissionBalance ?? 0;
  const lifetimeEarned = overview?.lifetimeEarned ?? 0;
  const earned30d = overview?.earned30d ?? 0;
  const topUpCommission = overview?.topUpCommission ?? 0;
  const referralBonus = overview?.referralBonus ?? 0;
  const commissionRate = overview?.commissionRate ?? agentProfile?.commissionRate ?? 4;
  const pendingPayoutAmount = overview?.pendingPayoutAmount ?? 0;
  const pendingPayoutCount = overview?.pendingPayoutCount ?? 0;
  const paidOutTotal = overview?.paidOutTotal ?? 0;

  const totalCalculated = topUpCommission + referralBonus;
  const topUpPercent = totalCalculated > 0 ? Math.round((topUpCommission / totalCalculated) * 100) : 50;
  const referralPercent = totalCalculated > 0 ? Math.round((referralBonus / totalCalculated) * 100) : 50;

  // 8-Week Rolling Stacked Bar Chart
  const weeklyChart = overview?.weeklyChart || [];
  const maxWeekly = Math.max(...weeklyChart.map((w: any) => w.total), 1);

  // Payout requests & earnings ledger
  const payoutRequests = overview?.payoutRequests || overview?.recentPayoutRequests || [];
  const earningsLedger = overview?.earningsLedger || [];

  const filteredLedger = earningsLedger.filter((item: any) => {
    if (sourceFilter === 'All') return true;
    return item.source === sourceFilter;
  });

  const maskAccount = (method: string, acc: string) => {
    if (!acc) return '';
    const clean = acc.replace(/\s+/g, '');
    if (method === 'Bank transfer' || method === 'CBE') {
      return clean.length > 4 ? `•••• ${clean.slice(-4)}` : clean;
    }
    return clean.length >= 7 ? `${clean.slice(0, 4)} ••• ${clean.slice(-3)}` : clean;
  };

  const formatDate = (isoString: string) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  };

  // Open withdrawal modal
  const handleOpenModal = () => {
    if (availableBalance < 500) {
      showToast('⚠️ Minimum withdrawal is ETB 500.');
      return;
    }
    setWithdrawAmount('500');
    setModalError('');
    setIsModalOpen(true);
  };

  // Quick Amount Selector
  const handleQuickAmount = (val: number) => {
    setWithdrawAmount(val > 0 ? `${val}` : '');
    setModalError('');
  };

  // Submit Withdrawal Request
  const handleSubmitWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    const amt = parseFloat(withdrawAmount);

    if (isNaN(amt) || amt < 500) {
      setModalError('Minimum withdrawal is ETB 500.');
      return;
    }
    if (amt > availableBalance) {
      setModalError(`You can withdraw up to ETB ${availableBalance.toLocaleString()}.`);
      return;
    }

    const cleanAcc = payoutAccount.trim().replace(/\s+/g, '');
    if (payoutMethod === 'Bank transfer') {
      if (cleanAcc.length < 8) {
        setModalError('Enter a valid bank account number (min 8 digits).');
        return;
      }
    } else {
      if (!/^0[79]\d{8}$/.test(cleanAcc.replace(/\D/g, ''))) {
        setModalError('Phone numbers are 10 digits starting with 09 or 07.');
        return;
      }
    }

    if (!accountName.trim() || accountName.trim().length < 3) {
      setModalError('Enter the account holder name.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await apiClient.agent.requestCommissionCashout({
        amount: amt,
        payoutMethod,
        payoutAccount: cleanAcc,
        accountName: accountName.trim()
      });

      if (res.success) {
        showToast(`🎉 ETB ${amt.toLocaleString()} requested. Admin will review it soon`);
        setIsModalOpen(false);
        setActiveTab('wd');
        await fetchOverview(true);
        onRefresh();
      }
    } catch (err: any) {
      setModalError(err.message || 'Failed to request withdrawal.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cancel Payout Request
  const handleCancelPayout = async (payoutId: string) => {
    if (!window.confirm('Cancel this withdrawal request? The money will be returned to your balance immediately.')) {
      return;
    }

    try {
      const res = await apiClient.agent.cancelCommissionCashout(payoutId);
      if (res.success) {
        showToast('Request cancelled. Money is back in your balance');
        await fetchOverview(true);
        onRefresh();
      }
    } catch (err: any) {
      showToast(`❌ ${err.message || 'Failed to cancel payout request'}`);
    }
  };

  const parsedWithdrawAmount = parseFloat(withdrawAmount) || 0;
  const leftAfterWithdraw = Math.max(0, availableBalance - parsedWithdrawAmount);

  return (
    <div className="comm-page">
      {/* 1. Header */}
      <div className="comm-top">
        <div>
          <h1>Commission desk</h1>
          <div className="sub">Your earnings from top-ups and referrals. Withdraw them straight from admin.</div>
        </div>
      </div>

      {/* 2. Specular Obsidian Hero Banner */}
      <div className="comm-hero">
        <div>
          <div className="comm-kl">Available to withdraw</div>
          <div className="comm-big">
            <small>ETB</small>
            {availableBalance.toLocaleString()}
          </div>
          <p>Paid to your Telebirr, M-Pesa or bank account by admin, usually within 24 hours. Minimum withdrawal is ETB 500, no fees.</p>

          <div className="comm-btns">
            <button
              type="button"
              className="comm-btn-gold"
              onClick={handleOpenModal}
              disabled={availableBalance < 500}
            >
              Withdraw commission
            </button>
            <button
              type="button"
              className="comm-btn-ghost"
              onClick={() => setActiveTab('ea')}
            >
              View earnings
            </button>
          </div>

          {availableBalance < 500 && (
            <div className="comm-sm" style={{ color: '#d6d6d9', marginTop: '10px' }}>
              You need at least ETB 500 to withdraw.
            </div>
          )}
        </div>

        {/* Right Mini-Metrics */}
        <div className="comm-mini">
          <div>
            <span>Earned, last 30 days</span>
            <b>ETB {earned30d.toLocaleString()}</b>
          </div>
          <div>
            <span>Waiting for admin</span>
            <b>ETB {pendingPayoutAmount.toLocaleString()}</b>
          </div>
          <div>
            <span>Paid out so far</span>
            <b>ETB {paidOutTotal.toLocaleString()}</b>
          </div>
        </div>
      </div>

      {/* 3. 4-KPI Metric Cards Grid */}
      <div className="comm-grid comm-g4">
        <div className="comm-card comm-stat">
          <div className="comm-l">Lifetime earned</div>
          <div className="comm-v">ETB {lifetimeEarned.toLocaleString()}</div>
          <div className="comm-t">Since you joined</div>
        </div>
        <div className="comm-card comm-stat">
          <div className="comm-l">Top-up commission</div>
          <div className="comm-v">ETB {topUpCommission.toLocaleString()}</div>
          <div className="comm-t">{commissionRate}% of every approved recharge</div>
        </div>
        <div className="comm-card comm-stat">
          <div className="comm-l">Referral bonus</div>
          <div className="comm-v">ETB {referralBonus.toLocaleString()}</div>
          <div className="comm-t">10% of players’ first deposits</div>
        </div>
        <div className="comm-card comm-stat">
          <div className="comm-l">Pending payout</div>
          <div className="comm-v">ETB {pendingPayoutAmount.toLocaleString()}</div>
          <div className="comm-t">{pendingPayoutCount > 0 ? 'Admin is reviewing' : 'Nothing waiting'}</div>
        </div>
      </div>

      {/* 4. 2-Column Analytics */}
      <div className="comm-grid comm-g2">
        {/* Column 1: 8-Week Stacked Bar Chart */}
        <div className="comm-card">
          <h3>
            Earnings by week
            <span className="r">
              <span><i className="comm-dot"></i>Top-up</span>
              <span><i className="comm-dot g2c"></i>Referral</span>
            </span>
          </h3>

          <div className="comm-ch">
            {weeklyChart.map((w: any, idx: number) => {
              const topH = maxWeekly > 0 ? (w.topUp / maxWeekly) * 88 : 0;
              const refH = maxWeekly > 0 ? (w.referral / maxWeekly) * 88 : 0;

              return (
                <div key={idx} className="comm-cb" title={w.title}>
                  {w.referral > 0 && <i className="a" style={{ height: `${refH}%` }} />}
                  {w.topUp > 0 && <i className="b" style={{ height: `${topH}%` }} />}
                  <span>{w.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Column 2: Source Distribution */}
        <div className="comm-card">
          <h3>Where it comes from</h3>

          <div className="comm-fn">
            <div className="comm-rw">
              <span>Top-up commission ({commissionRate}%)</span>
              <span>ETB {topUpCommission.toLocaleString()} · {topUpPercent}%</span>
            </div>
            <div className="comm-pb">
              <i style={{ width: `${topUpPercent}%` }} />
            </div>
          </div>

          <div className="comm-fn">
            <div className="comm-rw">
              <span>Referral bonus (10%)</span>
              <span>ETB {referralBonus.toLocaleString()} · {referralPercent}%</span>
            </div>
            <div className="comm-pb f">
              <i style={{ width: `${referralPercent}%` }} />
            </div>
          </div>

          <div className="comm-sm" style={{ marginTop: '16px', lineHeight: 1.5 }}>
            Top-up commission is added when admin approves your recharge. Referral bonus is added when your player makes a first deposit.
          </div>
        </div>
      </div>

      {/* 5. Segmented Operations Card */}
      <div className="comm-card">
        <div className="comm-bar">
          <div className="comm-tabs">
            <button
              type="button"
              className={activeTab === 'wd' ? 'on' : ''}
              onClick={() => setActiveTab('wd')}
            >
              Withdrawals
            </button>
            <button
              type="button"
              className={activeTab === 'ea' ? 'on' : ''}
              onClick={() => setActiveTab('ea')}
            >
              Earnings
            </button>
          </div>

          {activeTab === 'ea' ? (
            <div className="comm-tabs" style={{ marginLeft: 'auto' }}>
              {(['All', 'Top-up commission', 'Referral bonus'] as const).map(f => (
                <button
                  key={f}
                  type="button"
                  className={sourceFilter === f ? 'on' : ''}
                  onClick={() => setSourceFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>
          ) : (
            <button
              type="button"
              className="comm-btn-k"
              style={{ marginLeft: 'auto' }}
              onClick={handleOpenModal}
              disabled={availableBalance < 500}
            >
              + New withdrawal
            </button>
          )}
        </div>

        {/* View A: Withdrawals List */}
        {activeTab === 'wd' && (
          <div>
            {payoutRequests.length === 0 ? (
              <div className="comm-empty">No withdrawals yet.</div>
            ) : (
              payoutRequests.map((p: any) => {
                const isUnderReview = p.status === 'Under review' || p.status === 'Requested';
                const isPaid = p.status === 'Paid';
                const isRejectedOrCancelled = p.status === 'Rejected' || p.status === 'Cancelled';

                return (
                  <div key={p.id} className="comm-wd">
                    <div>
                      <div className="a">ETB {p.amount.toLocaleString()}</div>
                      <div className="comm-sm">
                        {p.payoutMethod} · {maskAccount(p.payoutMethod, p.payoutAccount)} · {p.code}
                      </div>
                    </div>

                    <div className="rt">
                      <span className={`comm-pill ${isPaid ? 'ok' : isRejectedOrCancelled ? 'bd' : 'wn'}`}>
                        {p.status}
                      </span>
                      <div className="comm-sm" style={{ marginTop: '6px' }}>
                        Requested {formatDate(p.createdAt)}
                        {p.payoutTxRef ? ` · Ref ${p.payoutTxRef}` : ''}
                      </div>
                      {isUnderReview && (
                        <button
                          type="button"
                          className="comm-cancel"
                          onClick={() => handleCancelPayout(p.id)}
                        >
                          Cancel request
                        </button>
                      )}
                    </div>

                    {!isRejectedOrCancelled && (
                      <div className="comm-steps">
                        <div className="dn">Requested</div>
                        <div className={isPaid ? 'dn' : 'on'}>Admin review</div>
                        <div className={isPaid ? 'dn' : ''}>Paid to you</div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* View B: High-Density Earnings Ledger Table */}
        {activeTab === 'ea' && (
          <div className="comm-wrap">
            <table className="comm-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Source</th>
                  <th>Details</th>
                  <th className="r">Amount</th>
                </tr>
              </thead>
              <tbody>
                {filteredLedger.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="comm-empty">
                      No earnings records found.
                    </td>
                  </tr>
                ) : (
                  filteredLedger.map((row: any) => (
                    <tr key={row.id}>
                      <td>{formatDate(row.date)}</td>
                      <td>
                        <span className={`comm-pill ${row.source === 'Top-up commission' ? 'gr' : 'wn'}`}>
                          {row.source}
                        </span>
                      </td>
                      <td>{row.details}</td>
                      <td className="r comm-plus">+ETB {row.commissionEarned.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 6. Withdraw Commission Modal */}
      {isModalOpen && (
        <div className="comm-mbg" onClick={() => setIsModalOpen(false)}>
          <div className="comm-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="comm-mh">
              <h3>Withdraw commission</h3>
              <button type="button" onClick={() => setIsModalOpen(false)} aria-label="Close">
                ✕
              </button>
            </div>

            <div className="comm-note" style={{ marginTop: 0 }}>
              Available now: <b>ETB {availableBalance.toLocaleString()}</b>. Admin reviews your request and pays you directly.
            </div>

            <form onSubmit={handleSubmitWithdrawal}>
              <label>Amount (ETB)</label>
              <input
                type="number"
                min="500"
                max={availableBalance}
                step="50"
                placeholder="Minimum 500"
                value={withdrawAmount}
                onChange={e => {
                  setWithdrawAmount(e.target.value);
                  setModalError('');
                }}
                required
              />

              <div className="comm-qs">
                <button
                  type="button"
                  onClick={() => handleQuickAmount(Math.min(availableBalance, 500))}
                >
                  500
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAmount(Math.floor(availableBalance / 2 / 50) * 50)}
                >
                  Half
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAmount(Math.floor(availableBalance))}
                >
                  All
                </button>
              </div>

              <label>Pay me by</label>
              <div className="comm-seg">
                {(['Telebirr', 'M-Pesa', 'Bank transfer'] as const).map(m => (
                  <button
                    key={m}
                    type="button"
                    className={payoutMethod === m ? 'on' : ''}
                    onClick={() => {
                      setPayoutMethod(m);
                      setModalError('');
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>

              <label>
                {payoutMethod === 'Bank transfer'
                  ? 'Bank account number'
                  : 'Phone number to receive money'}
              </label>
              <input
                type="text"
                inputMode={payoutMethod === 'Bank transfer' ? 'text' : 'numeric'}
                placeholder={payoutMethod === 'Bank transfer' ? '1000 0000 0000' : '0911 000 000'}
                value={payoutAccount}
                onChange={e => {
                  setPayoutAccount(e.target.value);
                  setModalError('');
                }}
                required
              />

              <label>Account holder name</label>
              <input
                type="text"
                placeholder="Full Name"
                value={accountName}
                onChange={e => {
                  setAccountName(e.target.value);
                  setModalError('');
                }}
                required
              />

              <div className="comm-sum">
                <div className="comm-lg">
                  <span>Withdrawal</span>
                  <b>ETB {parsedWithdrawAmount.toLocaleString()}</b>
                </div>
                <div className="comm-lg">
                  <span>Fee</span>
                  <span>ETB 0</span>
                </div>
                <div className="comm-lg t">
                  <span>Left to withdraw</span>
                  <b>ETB {leftAfterWithdraw.toLocaleString()}</b>
                </div>
              </div>

              {modalError && <div className="comm-err">{modalError}</div>}

              <div className="comm-mf">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="comm-btn-k"
                  disabled={isSubmitting || parsedWithdrawAmount < 500 || parsedWithdrawAmount > availableBalance}
                >
                  {isSubmitting ? 'Sending...' : 'Send request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentCommissionDesk;
