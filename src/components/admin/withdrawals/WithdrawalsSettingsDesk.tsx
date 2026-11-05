import React, { useState, useEffect } from 'react';
import { apiClient } from '../../../services/apiClient.ts';

interface WithdrawalsSettingsDeskProps {
  showToast: (msg: string) => void;
  onPinChanged?: () => void;
}

export const WithdrawalsSettingsDesk: React.FC<WithdrawalsSettingsDeskProps> = ({
  showToast,
  onPinChanged
}) => {
  // Security PIN state
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isChangingPin, setIsChangingPin] = useState(false);

  // Operational limits state
  const [maxLimit, setMaxLimit] = useState(5000);
  const [highThreshold, setHighThreshold] = useState(2000);
  const [minLimit, setMinLimit] = useState(50);

  // AML Policy toggles
  const [requireKyc, setRequireKyc] = useState(false);
  const [requireTurnover, setRequireTurnover] = useState(true);
  const [strictNameMatch, setStrictNameMatch] = useState(true);

  // Notifications & Auto-Refresh
  const [telegramAlerts, setTelegramAlerts] = useState(true);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState('15');

  const [savingSettings, setSavingSettings] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);

  // Load live settings from database on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoadingSettings(true);
        const res = await apiClient.withdrawalsAdmin.getSettings();
        if (res.success && res.settings) {
          const s = res.settings;
          if (s.max_request_limit != null) setMaxLimit(Number(s.max_request_limit));
          if (s.high_value_threshold != null) setHighThreshold(Number(s.high_value_threshold));
          if (s.min_request_limit != null) setMinLimit(Number(s.min_request_limit));
          if (s.require_kyc_verification != null) setRequireKyc(Boolean(s.require_kyc_verification));
          if (s.require_turnover_met != null) setRequireTurnover(Boolean(s.require_turnover_met));
          if (s.strict_name_matching != null) setStrictNameMatch(Boolean(s.strict_name_matching));
          if (s.telegram_player_alerts != null) setTelegramAlerts(Boolean(s.telegram_player_alerts));
          if (s.auto_refresh_seconds != null) setAutoRefreshInterval(String(s.auto_refresh_seconds));
        }
      } catch (err: any) {
        console.warn('Settings load note:', err.message);
      } finally {
        setLoadingSettings(false);
      }
    };
    fetchSettings();
  }, []);

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPin.trim()) {
      showToast('⚠️ Please enter your current PIN');
      return;
    }
    if (!newPin.trim() || newPin.length < 4 || newPin.length > 6) {
      showToast('⚠️ New PIN must be 4 to 6 numeric digits');
      return;
    }
    if (newPin !== confirmPin) {
      showToast('❌ New PIN and Confirmation PIN do not match');
      return;
    }

    try {
      setIsChangingPin(true);
      const res = await apiClient.withdrawalsAdmin.changePin(currentPin.trim(), newPin.trim());
      if (res.success) {
        showToast('🔒 Security PIN updated successfully!');
        setCurrentPin('');
        setNewPin('');
        setConfirmPin('');
        if (onPinChanged) onPinChanged();
      }
    } catch (err: any) {
      showToast(`❌ ${err.message || 'PIN update failed'}`);
    } finally {
      setIsChangingPin(false);
    }
  };

  const handleSaveOperationalSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingSettings(true);
      const res = await apiClient.withdrawalsAdmin.updateSettings({
        max_request_limit: Number(maxLimit),
        high_value_threshold: Number(highThreshold),
        min_request_limit: Number(minLimit),
        require_kyc_verification: requireKyc,
        require_turnover_met: requireTurnover,
        strict_name_matching: strictNameMatch,
        telegram_player_alerts: telegramAlerts,
        auto_refresh_seconds: Number(autoRefreshInterval)
      });
      if (res.success) {
        showToast('✅ Payout limits & AML policy preferences saved to database!');
      }
    } catch (err: any) {
      showToast(`❌ ${err.message || 'Failed to save settings'}`);
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner Notice */}
      <div className="w-note" style={{ margin: 0 }}>
        Configure operational payout policies, AML surveillance rules, and cashier credentials. Changes apply immediately across all live cashout requests.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px', alignItems: 'start' }}>
        {/* Card 1: Change Security PIN / Password */}
        <div className="w-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #1c1e1d, #2a2d2b)',
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              fontSize: '16px'
            }}>
              🔑
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16.5px', fontWeight: 700 }}>Security PIN & Password</h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--mute)' }}>Update your 4-6 digit officer terminal PIN</p>
            </div>
          </div>

          <form onSubmit={handlePinSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--mute)', marginBottom: '5px' }}>
                Current Security PIN
              </label>
              <input
                type="password"
                maxLength={6}
                value={currentPin}
                onChange={e => setCurrentPin(e.target.value)}
                placeholder="Enter current PIN"
                style={{
                  width: '100%',
                  background: 'var(--chip)',
                  border: 0,
                  borderRadius: '12px',
                  padding: '10px 14px',
                  fontWeight: 600,
                  fontSize: '14px',
                  color: 'var(--ink)'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--mute)', marginBottom: '5px' }}>
                  New PIN (4-6 digits)
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={newPin}
                  onChange={e => setNewPin(e.target.value)}
                  placeholder="New PIN"
                  style={{
                    width: '100%',
                    background: 'var(--chip)',
                    border: 0,
                    borderRadius: '12px',
                    padding: '10px 14px',
                    fontWeight: 600,
                    fontSize: '14px',
                    color: 'var(--ink)'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--mute)', marginBottom: '5px' }}>
                  Confirm New PIN
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={confirmPin}
                  onChange={e => setConfirmPin(e.target.value)}
                  placeholder="Confirm PIN"
                  style={{
                    width: '100%',
                    background: 'var(--chip)',
                    border: 0,
                    borderRadius: '12px',
                    padding: '10px 14px',
                    fontWeight: 600,
                    fontSize: '14px',
                    color: 'var(--ink)'
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isChangingPin || !currentPin || !newPin}
              className="w-btn k"
              style={{
                marginTop: '8px',
                padding: '11px',
                borderRadius: '12px',
                fontWeight: 700,
                fontSize: '13.5px'
              }}
            >
              {isChangingPin ? 'Updating PIN...' : 'Update Security PIN'}
            </button>
          </form>
        </div>

        {/* Card 2: Financial Limits & Controls */}
        <div className="w-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: '#e4f1e8',
              color: '#1f6a37',
              display: 'grid',
              placeItems: 'center',
              fontSize: '16px'
            }}>
              💰
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16.5px', fontWeight: 700 }}>Financial Limits & Thresholds</h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--mute)' }}>Payout bounds per single transaction</p>
            </div>
          </div>

          <form onSubmit={handleSaveOperationalSettings} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--mute)', marginBottom: '5px' }}>
                  Max Request Limit (ETB)
                </label>
                <input
                  type="number"
                  value={maxLimit}
                  onChange={e => setMaxLimit(Number(e.target.value))}
                  style={{
                    width: '100%',
                    background: 'var(--chip)',
                    border: 0,
                    borderRadius: '12px',
                    padding: '10px 14px',
                    fontWeight: 700,
                    color: 'var(--ink)'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--mute)', marginBottom: '5px' }}>
                  High-Value Review Flag (ETB)
                </label>
                <input
                  type="number"
                  value={highThreshold}
                  onChange={e => setHighThreshold(Number(e.target.value))}
                  style={{
                    width: '100%',
                    background: 'var(--chip)',
                    border: 0,
                    borderRadius: '12px',
                    padding: '10px 14px',
                    fontWeight: 700,
                    color: 'var(--ink)'
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--mute)', marginBottom: '5px' }}>
                Minimum Single Withdrawal (ETB)
              </label>
              <input
                type="number"
                value={minLimit}
                onChange={e => setMinLimit(Number(e.target.value))}
                style={{
                  width: '100%',
                  background: 'var(--chip)',
                  border: 0,
                  borderRadius: '12px',
                  padding: '10px 14px',
                  fontWeight: 700,
                  color: 'var(--ink)'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              className="w-btn k"
              style={{
                marginTop: '8px',
                padding: '11px',
                borderRadius: '12px',
                fontWeight: 700,
                fontSize: '13.5px'
              }}
            >
              {savingSettings ? 'Saving...' : 'Save Financial Limits'}
            </button>
          </form>
        </div>

        {/* Card 3: AML Compliance Policies */}
        <div className="w-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: '#fef3c7',
              color: '#d97706',
              display: 'grid',
              placeItems: 'center',
              fontSize: '16px'
            }}>
              🛡️
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16.5px', fontWeight: 700 }}>AML Anti-Fraud Policies</h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--mute)' }}>Automated compliance verification rules</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 700 }}>Require KYC Identity Verification</div>
                <div style={{ fontSize: '11.5px', color: 'var(--mute)' }}>Flag accounts that haven't verified national ID</div>
              </div>
              <input
                type="checkbox"
                checked={requireKyc}
                onChange={e => setRequireKyc(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
            </label>

            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 700 }}>Require 1x Deposit Turnover</div>
                <div style={{ fontSize: '11.5px', color: 'var(--mute)' }}>Flag cashouts if player hasn't wagered deposited funds</div>
              </div>
              <input
                type="checkbox"
                checked={requireTurnover}
                onChange={e => setRequireTurnover(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
            </label>

            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 700 }}>Strict Name Matching</div>
                <div style={{ fontSize: '11.5px', color: 'var(--mute)' }}>Flag requests where payout account name differs from registration</div>
              </div>
              <input
                type="checkbox"
                checked={strictNameMatch}
                onChange={e => setStrictNameMatch(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
            </label>
          </div>
        </div>

        {/* Card 4: Telegram Alerts & Polling Operations */}
        <div className="w-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: '#e0f2fe',
              color: '#0284c7',
              display: 'grid',
              placeItems: 'center',
              fontSize: '16px'
            }}>
              📢
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16.5px', fontWeight: 700 }}>Operational Alerts</h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--mute)' }}>Telegram bot dispatch and heartbeat</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 700 }}>Telegram Direct DMs to Players</div>
                <div style={{ fontSize: '11.5px', color: 'var(--mute)' }}>Send instant receipt upon approval or refund upon rejection</div>
              </div>
              <input
                type="checkbox"
                checked={telegramAlerts}
                onChange={e => setTelegramAlerts(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
            </label>

            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--mute)', marginBottom: '5px' }}>
                Queue Auto-Refresh Heartbeat
              </label>
              <select
                value={autoRefreshInterval}
                onChange={e => setAutoRefreshInterval(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--chip)',
                  border: 0,
                  borderRadius: '12px',
                  padding: '10px 14px',
                  fontWeight: 600,
                  color: 'var(--ink)'
                }}
              >
                <option value="10">Every 10 seconds (High volume)</option>
                <option value="15">Every 15 seconds (Recommended)</option>
                <option value="30">Every 30 seconds</option>
                <option value="60">Every 60 seconds</option>
                <option value="0">Manual only</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
