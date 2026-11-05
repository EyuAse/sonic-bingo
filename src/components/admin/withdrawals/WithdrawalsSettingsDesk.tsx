import React, { useState } from 'react';
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

  return (
    <div style={{ maxWidth: '520px', margin: '20px auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Top Banner Notice */}
      <div className="w-note" style={{ margin: 0 }}>
        Change your officer security PIN to protect the withdrawal terminal. Never share your cashier credentials.
      </div>

      {/* Security PIN & Password Card */}
      <div className="w-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #1c1e1d, #2a2d2b)',
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              fontSize: '18px'
            }}
          >
            🔑
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>Security PIN & Password</h3>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--mute)' }}>Update your 4-6 digit cashier terminal PIN</p>
          </div>
        </div>

        <form onSubmit={handlePinSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--mute)', marginBottom: '6px' }}>
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
                padding: '11px 14px',
                fontWeight: 600,
                fontSize: '14px',
                color: 'var(--ink)'
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--mute)', marginBottom: '6px' }}>
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
                  padding: '11px 14px',
                  fontWeight: 600,
                  fontSize: '14px',
                  color: 'var(--ink)'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--mute)', marginBottom: '6px' }}>
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
                  padding: '11px 14px',
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
              marginTop: '10px',
              padding: '12px',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '14px',
              cursor: isChangingPin || !currentPin || !newPin ? 'not-allowed' : 'pointer'
            }}
          >
            {isChangingPin ? 'Updating PIN...' : 'Update Security PIN'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default WithdrawalsSettingsDesk;
