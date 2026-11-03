import React, { useState, useEffect } from 'react';
import { apiClient } from '../../services/apiClient.ts';
import { useApp } from '../../context/AppContext.tsx';

type TabType = 'settings' | 'wallets' | 'holders' | 'winners';

export const BonusRewardsDesk: React.FC = () => {
  const { showToast } = useApp();
  const [activeTab, setActiveTab] = useState<TabType>('settings');
  const [isLoading, setIsLoading] = useState(true);

  // 1. KPI Metrics (3 Cards)
  const [kpis, setKpis] = useState({
    bonusWallets: { totalEtb: 0, playersCount: 0, label: 'Across 0 players' },
    coinsCirculation: { totalCoins: 0, liabilityEtb: 0, label: 'Liability: ETB 0' },
    rewardsPaid: { totalEtb: 0, label: 'Redemptions and prizes' }
  });

  // 2. Settings State
  const [settings, setSettings] = useState({
    regBonusEnabled: true,
    regBonusAmount: 20,
    regBonusExpiresDays: 0,
    refBonusEnabled: true,
    refBonusPercent: 10,
    refMinDeposit: 50,
    refMaxCap: 500,
    coinEarningEnabled: true,
    coinEarningRate: 1.5,
    coinRedemptionCoinsPerBlock: 1000,
    coinRedemptionRewardEtb: 10,
    coinRedemptionMinCoins: 1000,
    coinCreditTarget: 'Bonus wallet'
  });
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Live Preview Calculator Input
  const [sampleDeposit, setSampleDeposit] = useState<number>(50);

  // 3. Bonus Wallets State
  const [walletsList, setWalletsList] = useState<any[]>([]);
  const [walletsSearch, setWalletsSearch] = useState('');
  const [walletsPage, setWalletsPage] = useState(1);
  const [walletsTotalPages, setWalletsTotalPages] = useState(1);
  const [isLoadingWallets, setIsLoadingWallets] = useState(false);

  // 4. Top Coin Holders State
  const [topHolders, setTopHolders] = useState<any[]>([]);

  // 5. Bonus Winners State (100% Real from wallet_transactions)
  const [winnersList, setWinnersList] = useState<any[]>([]);
  const [isLoadingWinners, setIsLoadingWinners] = useState(false);

  // 6. Adjust Modal State (Unified Bonus & Coins)
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<'bonus' | 'coins'>('bonus');
  const [adjustType, setAdjustType] = useState<'add' | 'deduct'>('add');
  const [adjustPlayer, setAdjustPlayer] = useState<any | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('Correction');
  const [adjustNote, setAdjustNote] = useState('');
  const [isSubmittingAdjust, setIsSubmittingAdjust] = useState(false);

  // Load KPI Metrics & Settings on Mount
  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      const [kpiRes, setRes] = await Promise.all([
        apiClient.admin.rewards.getKpis(),
        apiClient.admin.rewards.getSettings()
      ]);

      if (kpiRes && kpiRes.success && kpiRes.kpis) {
        setKpis({
          bonusWallets: kpiRes.kpis.bonusWallets || { totalEtb: 0, playersCount: 0, label: 'Across 0 players' },
          coinsCirculation: kpiRes.kpis.coinsCirculation || { totalCoins: 0, liabilityEtb: 0, label: 'Liability: ETB 0' },
          rewardsPaid: kpiRes.kpis.rewardsPaid || { totalEtb: 0, label: 'Redemptions and prizes' }
        });
      }
      if (setRes && setRes.success) {
        if (setRes.settings) setSettings(setRes.settings);
        if (setRes.auditLogs) setAuditLogs(setRes.auditLogs);
      }
    } catch (err: any) {
      console.error('Failed to load rewards initial data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Fetch Bonus Wallets
  const fetchBonusWallets = async (page = walletsPage, search = walletsSearch) => {
    try {
      setIsLoadingWallets(true);
      const res = await apiClient.admin.rewards.getBonusWallets({ page, limit: 8, search });
      if (res && res.success) {
        setWalletsList(res.players || []);
        if (res.pagination) {
          setWalletsTotalPages(res.pagination.totalPages || 1);
        }
      }
    } catch (err) {
      console.error('Error fetching bonus wallets:', err);
    } finally {
      setIsLoadingWallets(false);
    }
  };

  // Fetch Top Coin Holders
  const fetchTopHolders = async () => {
    try {
      const res = await apiClient.admin.rewards.getTopCoinHolders();
      if (res && res.success) {
        setTopHolders(res.holders || []);
      }
    } catch (err) {
      console.error('Error fetching top coin holders:', err);
    }
  };

  // Fetch Winners (100% Real from wallet_transactions)
  const fetchWinners = async () => {
    try {
      setIsLoadingWinners(true);
      const res = await apiClient.admin.rewards.getWinners();
      if (res && res.success) {
        setWinnersList(res.winners || []);
      }
    } catch (err) {
      console.error('Error fetching winners:', err);
    } finally {
      setIsLoadingWinners(false);
    }
  };

  // Handle Tab Switch
  useEffect(() => {
    if (activeTab === 'wallets') {
      fetchBonusWallets();
    } else if (activeTab === 'holders') {
      fetchTopHolders();
    } else if (activeTab === 'winners') {
      fetchWinners();
    }
  }, [activeTab]);

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const res = await apiClient.admin.rewards.saveSettings(settings);
      if (res && res.success) {
        showToast('Bonus settings saved successfully!');
        loadInitialData();
      } else {
        showToast(res.message || 'Failed to save settings');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to save settings');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Open Adjust Modal
  const openAdjust = (target: 'bonus' | 'coins', player: any) => {
    setAdjustTarget(target);
    setAdjustPlayer(player);
    setAdjustType('add');
    setAdjustAmount('');
    setAdjustReason('Correction');
    setAdjustNote('');
    setShowAdjustModal(true);
  };

  // Submit Adjustment
  const handleSubmitAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(adjustAmount);
    if (!adjustPlayer || isNaN(num) || num <= 0) {
      showToast('Please enter a valid positive amount');
      return;
    }
    if (!adjustNote.trim()) {
      showToast('An explanatory note is required for the audit trail');
      return;
    }

    setIsSubmittingAdjust(true);
    try {
      const res = await apiClient.admin.rewards.adjust({
        target: adjustTarget,
        type: adjustType,
        userId: adjustPlayer.id || adjustPlayer.userId,
        amount: num,
        reason: adjustReason,
        note: adjustNote.trim()
      });

      if (res && res.success) {
        showToast(res.message || 'Adjustment applied successfully!');
        setShowAdjustModal(false);
        if (adjustTarget === 'bonus') {
          fetchBonusWallets();
        } else {
          fetchTopHolders();
        }
        loadInitialData();
      } else {
        showToast(res.message || 'Adjustment failed');
      }
    } catch (err: any) {
      showToast(err.message || 'Adjustment failed');
    } finally {
      setIsSubmittingAdjust(false);
    }
  };

  // Dynamic calculations for live preview card
  const calculatedCoins = Math.floor(sampleDeposit * (settings.coinEarningEnabled ? settings.coinEarningRate : 0));
  const calculatedCoinValue = settings.coinRedemptionCoinsPerBlock > 0
    ? ((calculatedCoins / settings.coinRedemptionCoinsPerBlock) * settings.coinRedemptionRewardEtb).toFixed(2)
    : '0.00';
  const calculatedRefBonus = settings.refBonusEnabled && sampleDeposit >= settings.refMinDeposit
    ? Math.min(settings.refMaxCap, (sampleDeposit * settings.refBonusPercent) / 100).toFixed(2)
    : '0.00';

  return (
    <div className="enqu-rewards-desk" style={{ fontFamily: 'Urbanist, "Helvetica Neue", Arial, sans-serif', color: '#1b1b1b' }}>
      <style>{`
        .enqu-rewards-desk { 
          width: 100%; 
          box-sizing: border-box; 
          padding: 24px 28px;
          background: var(--panel, #e8e6e9);
          min-height: 100vh;
          overflow-y: auto;
        }
        .enqu-rewards-container {
          max-width: 1400px;
          margin: 0 auto;
          width: 100%;
        }
        .enqu-top { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
        .enqu-top h1 { font-size: 28px; font-weight: 700; letter-spacing: -0.3px; flex: 1; color: #1b1b1b; margin: 0; }
        .enqu-pillbox { background: #ffffff; border-radius: 20px; padding: 7px 16px; font-size: 13.5px; font-weight: 600; color: #707070; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
        .enqu-av { width: 34px; height: 34px; border-radius: 50%; background: linear-gradient(135deg, #a8573c, #7d3524); display: grid; place-items: center; color: #fff; font-weight: 700; font-size: 13px; }
        
        .enqu-grid { display: grid; gap: 16px; margin-bottom: 20px; }
        .enqu-g3 { grid-template-columns: repeat(3, 1fr); }
        .enqu-g2 { grid-template-columns: 1.7fr 1fr; }
        
        .enqu-card { background: #ffffff; border-radius: 20px; padding: 20px 22px; min-width: 0; box-shadow: 0 2px 6px rgba(0,0,0,0.03); border: 1px solid #e9e9ea; }
        .enqu-card.dark { background: linear-gradient(135deg, #1c1e1d, #2a2d2b 55%, #1a1c1b); color: #ffffff; border: 0; }
        .enqu-card h3 { font-size: 17px; font-weight: 600; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
        
        .enqu-lab { font-size: 13.5px; color: #707070; font-weight: 500; }
        .enqu-card.dark .enqu-lab { color: #e5e5e5; }
        .enqu-val { font-size: 26px; font-weight: 800; margin: 10px 0 6px; letter-spacing: -0.5px; }
        .enqu-tr { font-size: 12.5px; color: #707070; font-weight: 500; }
        .enqu-card.dark .enqu-tr { color: #b3b3b3; }

        .enqu-tabs { display: flex; gap: 8px; overflow-x: auto; margin-bottom: 20px; padding-bottom: 4px; }
        .enqu-tabs button { background: #ffffff; border: 1px solid #e9e9ea; padding: 9px 18px; font-size: 14px; font-weight: 600; border-radius: 20px; color: #1b1b1b; cursor: pointer; white-space: nowrap; transition: all 0.15s ease; }
        .enqu-tabs button:hover { background: #f4f4f5; }
        .enqu-tabs button.on { background: #1f2220; color: #ffffff; border-color: #1f2220; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }

        .enqu-input { width: 100%; background: #e9e9ea; border: 0; border-radius: 12px; padding: 10px 14px; font: inherit; font-weight: 600; color: #1b1b1b; outline: none; }
        .enqu-input:focus { box-shadow: 0 0 0 2px #1f2220; }
        .enqu-select { width: 100%; background: #e9e9ea; border: 0; border-radius: 12px; padding: 10px 14px; font: inherit; font-weight: 600; color: #1b1b1b; outline: none; cursor: pointer; }

        .enqu-btn { font: inherit; font-size: 13.5px; font-weight: 700; border: 0; border-radius: 14px; padding: 9px 18px; cursor: pointer; transition: all 0.15s ease; display: inline-flex; align-items: center; justify-content: center; gap: 8px; }
        .enqu-btn.dark { background: #1f2220; color: #ffffff; }
        .enqu-btn.dark:hover { background: #333835; }
        .enqu-btn.grey { background: #e9e9ea; color: #1b1b1b; }
        .enqu-btn.grey:hover { background: #dedede; }
        .enqu-btn.success { background: #10b981; color: #ffffff; }
        .enqu-btn.danger { background: #ef4444; color: #ffffff; }

        .enqu-toggle { width: 44px; height: 24px; border-radius: 12px; background: #e9e9ea; position: relative; cursor: pointer; border: 0; padding: 0; transition: background 0.2s ease; flex-shrink: 0; }
        .enqu-toggle::after { content: ""; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.3); transition: transform 0.2s ease; }
        .enqu-toggle.on { background: #1f2220; }
        .enqu-toggle.on::after { transform: translateX(20px); }

        .enqu-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .enqu-table th { text-align: left; color: #707070; font-weight: 600; font-size: 13px; padding: 12px 10px; border-bottom: 1px solid #d9d9db; }
        .enqu-table td { padding: 12px 10px; font-weight: 600; border-bottom: 1px solid #f1f1f2; white-space: nowrap; vertical-align: middle; }
        .enqu-table tr:hover td { background: #f9f9fa; }

        .enqu-tag { display: inline-block; font-size: 11.5px; font-weight: 700; padding: 3px 10px; border-radius: 10px; }
        .enqu-tag.ok { background: #e4f1e8; color: #1f6a37; }
        .enqu-tag.warn { background: #fef3c7; color: #92400e; }
        .enqu-tag.bad { background: #fee2e2; color: #991b1b; }

        @media (max-width: 900px) {
          .enqu-g3 { grid-template-columns: 1fr; }
          .enqu-g2 { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="enqu-rewards-container">
        {/* Top Header */}
        <div className="enqu-top">
          <h1>Bonus & Reward Management</h1>
          <div className="enqu-pillbox">● Live System</div>
          <div className="enqu-av" title="Administrator">A</div>
        </div>

        {/* 3 Top KPI Cards (Redemptions Card Removed) */}
        <div className="enqu-grid enqu-g3">
          {/* Card 1: Bonus Wallets (Dark Card) */}
          <div className="enqu-card dark">
            <div className="enqu-lab">Bonus Wallets</div>
            <div className="enqu-val">ETB {kpis.bonusWallets.totalEtb.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</div>
            <div className="enqu-tr">{kpis.bonusWallets.label}</div>
          </div>

          {/* Card 2: Coins in Circulation */}
          <div className="enqu-card">
            <div className="enqu-lab">Coins in Circulation</div>
            <div className="enqu-val">{kpis.coinsCirculation.totalCoins.toLocaleString('en-US')}</div>
            <div className="enqu-tr">{kpis.coinsCirculation.label}</div>
          </div>

          {/* Card 3: Rewards Paid */}
          <div className="enqu-card">
            <div className="enqu-lab">Rewards Paid</div>
            <div className="enqu-val">ETB {kpis.rewardsPaid.totalEtb.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</div>
            <div className="enqu-tr">{kpis.rewardsPaid.label}</div>
          </div>
        </div>

        {/* 4 Navigation Tabs (Redemptions Tab Removed) */}
        <div className="enqu-tabs">
          <button className={activeTab === 'settings' ? 'on' : ''} onClick={() => setActiveTab('settings')}>
            Bonus Settings
          </button>
          <button className={activeTab === 'wallets' ? 'on' : ''} onClick={() => setActiveTab('wallets')}>
            Bonus Wallets
          </button>
          <button className={activeTab === 'holders' ? 'on' : ''} onClick={() => setActiveTab('holders')}>
            🏆 Top Coin Holders
          </button>
          <button className={activeTab === 'winners' ? 'on' : ''} onClick={() => setActiveTab('winners')}>
            Bonus Winners
          </button>
        </div>

        {/* =========================================================================
            TAB 1: BONUS SETTINGS & LIVE PREVIEW CALCULATOR
           ========================================================================= */}
        {activeTab === 'settings' && (
          <div className="enqu-grid enqu-g2">
            {/* Left Form Card */}
            <div className="enqu-card">
              <h3>Bonus Settings</h3>
              <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
                {/* Registration bonus */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '15px' }}>Registration bonus</div>
                      <div style={{ fontSize: '12.5px', color: '#707070' }}>Credited to the bonus wallet. Playable, not withdrawable.</div>
                    </div>
                    <button
                      type="button"
                      className={`enqu-toggle ${settings.regBonusEnabled ? 'on' : ''}`}
                      onClick={() => setSettings(s => ({ ...s, regBonusEnabled: !s.regBonusEnabled }))}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '12px', color: '#707070', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Bonus per new user (ETB)</label>
                      <input
                        type="number"
                        step="any"
                        className="enqu-input"
                        value={settings.regBonusAmount}
                        onChange={e => setSettings(s => ({ ...s, regBonusAmount: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: '#707070', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Expires after (days, 0 = never)</label>
                      <input
                        type="number"
                        className="enqu-input"
                        value={settings.regBonusExpiresDays}
                        onChange={e => setSettings(s => ({ ...s, regBonusExpiresDays: parseInt(e.target.value, 10) || 0 }))}
                      />
                    </div>
                  </div>
                </div>

                {/* Referral bonus */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '15px' }}>Referral bonus</div>
                      <div style={{ fontSize: '12.5px', color: '#707070' }}>Paid to the referrer as a percent of the first deposit made by the player they referred.</div>
                    </div>
                    <button
                      type="button"
                      className={`enqu-toggle ${settings.refBonusEnabled ? 'on' : ''}`}
                      onClick={() => setSettings(s => ({ ...s, refBonusEnabled: !s.refBonusEnabled }))}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '12px', color: '#707070', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Percent of first deposit (%)</label>
                      <input
                        type="number"
                        step="any"
                        className="enqu-input"
                        value={settings.refBonusPercent}
                        onChange={e => setSettings(s => ({ ...s, refBonusPercent: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: '#707070', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Minimum first deposit (ETB)</label>
                      <input
                        type="number"
                        className="enqu-input"
                        value={settings.refMinDeposit}
                        onChange={e => setSettings(s => ({ ...s, refMinDeposit: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: '#707070', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Maximum per referral (ETB)</label>
                      <input
                        type="number"
                        className="enqu-input"
                        value={settings.refMaxCap}
                        onChange={e => setSettings(s => ({ ...s, refMaxCap: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                  </div>
                </div>

                {/* Coin earning */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '15px' }}>Coin earning</div>
                      <div style={{ fontSize: '12.5px', color: '#707070' }}>Earned on eligible deposits per game. At {settings.coinEarningRate}, a 50 ETB deposit earns {Math.floor(50 * settings.coinEarningRate)} coins.</div>
                    </div>
                    <button
                      type="button"
                      className={`enqu-toggle ${settings.coinEarningEnabled ? 'on' : ''}`}
                      onClick={() => setSettings(s => ({ ...s, coinEarningEnabled: !s.coinEarningEnabled }))}
                    />
                  </div>
                  <div style={{ maxWidth: '280px' }}>
                    <label style={{ fontSize: '12px', color: '#707070', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Coins per eligible ETB</label>
                    <input
                      type="number"
                      step="any"
                      className="enqu-input"
                      value={settings.coinEarningRate}
                      onChange={e => setSettings(s => ({ ...s, coinEarningRate: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                </div>

                {/* Coin redemption */}
                <div>
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ fontWeight: 700, fontSize: '15px' }}>Coin redemption</div>
                    <div style={{ fontSize: '12.5px', color: '#707070' }}>How coins convert to ETB and which wallet the reward is paid to.</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '12px', color: '#707070', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Coins per block</label>
                      <input
                        type="number"
                        className="enqu-input"
                        value={settings.coinRedemptionCoinsPerBlock}
                        onChange={e => setSettings(s => ({ ...s, coinRedemptionCoinsPerBlock: parseInt(e.target.value, 10) || 1000 }))}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: '#707070', fontWeight: 600, display: 'block', marginBottom: '4px' }}>ETB reward per block</label>
                      <input
                        type="number"
                        step="any"
                        className="enqu-input"
                        value={settings.coinRedemptionRewardEtb}
                        onChange={e => setSettings(s => ({ ...s, coinRedemptionRewardEtb: parseFloat(e.target.value) || 10 }))}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: '#707070', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Minimum coins to redeem</label>
                      <input
                        type="number"
                        className="enqu-input"
                        value={settings.coinRedemptionMinCoins}
                        onChange={e => setSettings(s => ({ ...s, coinRedemptionMinCoins: parseInt(e.target.value, 10) || 1000 }))}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: '#707070', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Credit rewards to</label>
                      <select
                        className="enqu-select"
                        value={settings.coinCreditTarget}
                        onChange={e => setSettings(s => ({ ...s, coinCreditTarget: e.target.value }))}
                      >
                        <option value="Bonus wallet">Bonus wallet</option>
                        <option value="Withdrawable wallet">Withdrawable wallet</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid #f1f1f2' }}>
                  <div style={{ fontSize: '12.5px', color: '#707070' }}>Every change is saved to the rule history.</div>
                  <button type="submit" className="enqu-btn dark" disabled={isSavingSettings}>
                    {isSavingSettings ? 'Saving...' : 'Save bonus settings'}
                  </button>
                </div>
              </form>
            </div>

            {/* Right Column: Live Preview & Recent Rule Changes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Live Preview Card (Dark) */}
              <div className="enqu-card dark">
                <h3>Live preview</h3>
                <label style={{ fontSize: '12.5px', color: '#e5e5e5', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Sample deposit (ETB)</label>
                <input
                  type="number"
                  value={sampleDeposit}
                  onChange={e => setSampleDeposit(Math.max(0, parseFloat(e.target.value) || 0))}
                  style={{
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.12)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '12px',
                    padding: '10px 14px',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '15px',
                    outline: 'none',
                    marginBottom: '16px'
                  }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13.5px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#b3b3b3' }}>● Coins earned</span>
                    <span style={{ fontWeight: 700 }}>{calculatedCoins}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#b3b3b3' }}>● Coin value</span>
                    <span style={{ fontWeight: 700 }}>ETB {calculatedCoinValue}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#b3b3b3' }}>● Referral bonus</span>
                    <span style={{ fontWeight: 700 }}>ETB {calculatedRefBonus}</span>
                  </div>
                </div>
              </div>

              {/* Recent Rule Changes Table (100% Real from audit logs) */}
              <div className="enqu-card">
                <h3>Recent rule changes</h3>
                {auditLogs.length === 0 ? (
                  <div style={{ padding: '24px 16px', textAlign: 'center', color: '#707070', fontSize: '13px' }}>
                    No rule changes recorded yet. Changes will appear here when settings are updated.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="enqu-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>By</th>
                          <th>Change</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogs.slice(0, 5).map(log => {
                          const d = new Date(log.createdAt);
                          const dateFormatted = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                          return (
                            <tr key={log.id}>
                              <td style={{ color: '#707070' }}>{dateFormatted}</td>
                              <td style={{ color: '#1b1b1b' }}>{log.by}</td>
                              <td style={{ color: '#475569', fontSize: '12.5px', whiteSpace: 'normal', maxWidth: '280px' }}>{log.change}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 2: BONUS WALLETS PLAYER DIRECTORY
           ========================================================================= */}
        {activeTab === 'wallets' && (
          <div className="enqu-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <h3>Bonus Wallets</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Search player name, phone, code..."
                  className="enqu-input"
                  style={{ width: '280px', padding: '8px 12px', fontSize: '13px' }}
                  value={walletsSearch}
                  onChange={e => {
                    setWalletsSearch(e.target.value);
                    fetchBonusWallets(1, e.target.value);
                  }}
                />
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="enqu-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Bonus Wallet</th>
                    <th>Withdrawable</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingWallets ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: '#707070' }}>Loading player bonus wallets...</td>
                    </tr>
                  ) : walletsList.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: '#707070' }}>No players found matching query.</td>
                    </tr>
                  ) : (
                    walletsList.map(player => (
                      <tr key={player.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#e9e9ea', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: '13px' }}>
                              {player.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700 }}>{player.name}</div>
                              <div style={{ fontSize: '12px', color: '#707070' }}>{player.phone || player.username || 'Direct'}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ color: '#10b981', fontWeight: 800 }}>ETB {player.bonus.toFixed(2)}</td>
                        <td style={{ color: '#1b1b1b' }}>ETB {player.wallet.toFixed(2)}</td>
                        <td>
                          <span className={`enqu-tag ${player.status === 'Active' ? 'ok' : 'bad'}`}>
                            {player.status}
                          </span>
                        </td>
                        <td style={{ color: '#707070', fontSize: '12px' }}>
                          {new Date(player.joinedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="enqu-btn grey"
                            style={{ padding: '5px 12px', fontSize: '12px' }}
                            onClick={() => openAdjust('bonus', player)}
                          >
                            Adjust
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button
                className="enqu-btn grey"
                disabled={walletsPage <= 1}
                onClick={() => {
                  const p = walletsPage - 1;
                  setWalletsPage(p);
                  fetchBonusWallets(p);
                }}
              >
                Previous
              </button>
              <span style={{ display: 'flex', alignItems: 'center', fontSize: '13px', fontWeight: 600, color: '#707070', padding: '0 8px' }}>
                Page {walletsPage} of {walletsTotalPages}
              </span>
              <button
                className="enqu-btn grey"
                disabled={walletsPage >= walletsTotalPages}
                onClick={() => {
                  const p = walletsPage + 1;
                  setWalletsPage(p);
                  fetchBonusWallets(p);
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 3: TOP COIN HOLDERS LEADERBOARD
           ========================================================================= */}
        {activeTab === 'holders' && (
          <div className="enqu-card">
            <h3>🏆 Top Coin Holders</h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="enqu-table">
                <thead>
                  <tr>
                    <th style={{ width: '60px' }}>Rank</th>
                    <th>Player</th>
                    <th>Coin Balance</th>
                    <th>ETB Value</th>
                    <th>Games Played</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {topHolders.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: '#707070' }}>No coin holders registered yet.</td>
                    </tr>
                  ) : (
                    topHolders.map(h => (
                      <tr key={h.userId}>
                        <td style={{ fontSize: '18px', textAlign: 'center' }}>{h.medal}</td>
                        <td>
                          <div style={{ fontWeight: 700 }}>{h.name}</div>
                          <div style={{ fontSize: '12px', color: '#707070' }}>{h.phone || h.username}</div>
                        </td>
                        <td style={{ fontWeight: 800, color: '#f59e0b' }}>
                          🪙 {h.coins.toLocaleString('en-US')} coins
                        </td>
                        <td style={{ fontWeight: 700, color: '#10b981' }}>
                          ETB {h.etbValue}
                        </td>
                        <td style={{ color: '#707070' }}>{h.gamesPlayed} games</td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="enqu-btn grey"
                            style={{ padding: '5px 12px', fontSize: '12px' }}
                            onClick={() => openAdjust('coins', h)}
                          >
                            Adjust coins
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 4: BONUS & PROMOTION WINNERS (100% REAL FROM DATABASE)
           ========================================================================= */}
        {activeTab === 'winners' && (
          <div className="enqu-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0 }}>Bonus & Promotion Winners</h3>
                <div style={{ fontSize: '12.5px', color: '#707070', marginTop: '2px' }}>
                  Real live ledger of players who received registration, referral, and coin bonuses.
                </div>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="enqu-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Winner</th>
                    <th>Promotion / Reward</th>
                    <th>Prize ETB</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th style={{ textAlign: 'right' }}>Ledger Status</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingWinners ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: '#707070' }}>Loading real bonus records...</td>
                    </tr>
                  ) : winnersList.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: '#707070' }}>No bonus rewards awarded yet.</td>
                    </tr>
                  ) : (
                    winnersList.map(w => (
                      <tr key={w.id}>
                        <td style={{ fontWeight: 700, color: '#707070' }}>#{String(w.id).slice(-8)}</td>
                        <td>
                          <div style={{ fontWeight: 700 }}>{w.winnerName}</div>
                          <div style={{ fontSize: '12px', color: '#707070' }}>{w.phone}</div>
                        </td>
                        <td style={{ fontWeight: 600 }}>{w.promotionName}</td>
                        <td style={{ fontWeight: 800, color: '#10b981' }}>ETB {w.prizeAmount.toFixed(2)}</td>
                        <td>
                          <span className={`enqu-tag ${w.status === 'paid' ? 'ok' : 'warn'}`}>
                            {w.status === 'paid' ? 'Paid / Credited' : 'Pending'}
                          </span>
                        </td>
                        <td style={{ color: '#707070', fontSize: '12px' }}>
                          {new Date(w.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 700 }}>
                            ✓ Credited by {w.paidBy || 'System'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =========================================================================
            UNIFIED ADJUST MODAL (BONUS OR COINS)
           ========================================================================= */}
        {showAdjustModal && adjustPlayer && (
          <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}>
            <div style={{
              maxWidth: '460px',
              width: '100%',
              background: '#ffffff',
              borderRadius: '24px',
              padding: '28px 24px',
              boxShadow: '0 25px 60px -15px rgba(0,0,0,0.4)',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>
                  Adjust {adjustTarget === 'bonus' ? 'Bonus Wallet' : 'Coins'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  style={{ background: 'transparent', border: 0, fontSize: '20px', cursor: 'pointer', color: '#707070' }}
                >
                  ✕
                </button>
              </div>

              <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '12px', marginBottom: '18px', fontSize: '13px' }}>
                <div style={{ fontWeight: 700, color: '#1e293b' }}>{adjustPlayer.name || adjustPlayer.playerName}</div>
                <div style={{ color: '#64748b', fontSize: '12px' }}>User ID: {adjustPlayer.id || adjustPlayer.userId}</div>
              </div>

              <form onSubmit={handleSubmitAdjust} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Add or Deduct Type */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    className={`enqu-btn ${adjustType === 'add' ? 'dark' : 'grey'}`}
                    onClick={() => setAdjustType('add')}
                  >
                    ➕ Add / Credit
                  </button>
                  <button
                    type="button"
                    className={`enqu-btn ${adjustType === 'deduct' ? 'danger' : 'grey'}`}
                    onClick={() => setAdjustType('deduct')}
                  >
                    ➖ Deduct / Debit
                  </button>
                </div>

                {/* Amount */}
                <div>
                  <label style={{ fontSize: '12.5px', color: '#707070', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    {adjustTarget === 'bonus' ? 'Amount (ETB)' : 'Number of Coins'}
                  </label>
                  <input
                    type="number"
                    step={adjustTarget === 'bonus' ? '0.01' : '1'}
                    className="enqu-input"
                    placeholder={adjustTarget === 'bonus' ? 'e.g. 50.00' : 'e.g. 1000'}
                    value={adjustAmount}
                    onChange={e => setAdjustAmount(e.target.value)}
                    required
                  />
                </div>

                {/* Reason */}
                <div>
                  <label style={{ fontSize: '12.5px', color: '#707070', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    Reason Category
                  </label>
                  <select
                    className="enqu-select"
                    value={adjustReason}
                    onChange={e => setAdjustReason(e.target.value)}
                  >
                    <option value="Correction">Administrative Correction</option>
                    <option value="Promotion">Promotional Reward</option>
                    <option value="Contest">Contest / Tournament Prize</option>
                    <option value="Loyalty">VIP Loyalty Compensation</option>
                    <option value="Compliance">Security / Compliance Adjustment</option>
                  </select>
                </div>

                {/* Note */}
                <div>
                  <label style={{ fontSize: '12.5px', color: '#707070', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    Audit Trail Note (Required)
                  </label>
                  <textarea
                    className="enqu-input"
                    style={{ minHeight: '70px', resize: 'vertical' }}
                    placeholder="Explain why this adjustment is being made..."
                    value={adjustNote}
                    onChange={e => setAdjustNote(e.target.value)}
                    required
                  />
                </div>

                {/* Safety Notice */}
                {(parseFloat(adjustAmount) >= 500 || (adjustTarget === 'coins' && parseFloat(adjustAmount) >= 5000)) && (
                  <div style={{
                    background: '#fef3c7',
                    border: '1px solid #fde68a',
                    borderRadius: '12px',
                    padding: '10px 12px',
                    fontSize: '12px',
                    color: '#92400e',
                    lineHeight: 1.4
                  }}>
                    ⚠️ <b>2-Man Rule Compliance Notice:</b> High-value manual balance adjustment. This action will be permanently recorded in the security ledger with your admin credentials.
                  </div>
                )}

                {/* Buttons */}
                <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                  <button
                    type="button"
                    className="enqu-btn grey"
                    style={{ flex: 1 }}
                    onClick={() => setShowAdjustModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="enqu-btn dark"
                    style={{ flex: 1.5 }}
                    disabled={isSubmittingAdjust}
                  >
                    {isSubmittingAdjust ? 'Applying...' : 'Confirm Adjustment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
