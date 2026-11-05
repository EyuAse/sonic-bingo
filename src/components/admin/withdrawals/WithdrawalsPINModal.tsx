import React, { useState } from 'react';
import { apiClient } from '../../../services/apiClient.ts';

interface WithdrawalsPINModalProps {
  onSuccess: (token: string, admin: any) => void;
  onCancel?: () => void;
}

export const WithdrawalsPINModal: React.FC<WithdrawalsPINModalProps> = ({ onSuccess, onCancel }) => {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) {
      setError('Please enter security PIN');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.withdrawalsAdmin.login(pin.trim());
      if (res.success && res.token) {
        sessionStorage.setItem('sonic_withdrawals_token', res.token);
        localStorage.setItem('sonic_withdrawals_token', res.token);
        onSuccess(res.token, res.admin);
      } else {
        setError('Invalid Security PIN. Access denied.');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid PIN. Try 5678 or 1234');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyClick = (digit: string) => {
    if (pin.length < 6) {
      setPin(prev => prev + digit);
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPin('');
  };

  return (
    <div className="w-modal-bg">
      <div className="w-modal" style={{ width: 'min(400px, 92vw)', textAlign: 'center', padding: '28px 24px' }}>
        <div style={{
          width: '54px',
          height: '54px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #1c1e1d, #2a2d2b)',
          color: '#fff',
          display: 'grid',
          placeItems: 'center',
          fontSize: '22px',
          margin: '0 auto 16px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)'
        }}>
          🏦
        </div>

        <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 4px', letterSpacing: '-0.4px' }}>
          Withdrawals Desk
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--mute)', margin: '0 0 20px', fontWeight: 500 }}>
          Enter Withdrawal Officer Security PIN to access approval queue
        </p>

        {error && (
          <div style={{
            background: '#fef2f2',
            color: 'var(--r)',
            padding: '10px 14px',
            borderRadius: '12px',
            fontSize: '12.5px',
            fontWeight: 600,
            marginBottom: '16px',
            border: '1px solid #fee2e2'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* PIN Display Circles */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '22px' }}>
            {[0, 1, 2, 3].map(idx => (
              <div
                key={idx}
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: pin.length > idx ? 'var(--dark)' : 'var(--chip)',
                  transition: 'background 0.15s ease',
                  border: pin.length === idx ? '2px solid var(--grey)' : 'none'
                }}
              />
            ))}
          </div>

          <input
            type="password"
            maxLength={6}
            value={pin}
            onChange={e => setPin(e.target.value)}
            placeholder="Enter PIN (e.g. 5678)"
            style={{
              width: '100%',
              background: 'var(--chip)',
              border: 0,
              borderRadius: '12px',
              padding: '10px 14px',
              fontSize: '15px',
              fontWeight: 700,
              textAlign: 'center',
              letterSpacing: '4px',
              marginBottom: '18px'
            }}
          />

          {/* Quick Keypad */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '20px' }}>
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => handleKeyClick(n)}
                style={{
                  padding: '12px 0',
                  background: 'var(--card)',
                  border: '1px solid var(--line)',
                  borderRadius: '14px',
                  fontSize: '18px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  color: 'var(--ink)'
                }}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              style={{
                padding: '12px 0',
                background: 'var(--chip)',
                border: 0,
                borderRadius: '14px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                color: 'var(--mute)'
              }}
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => handleKeyClick('0')}
              style={{
                padding: '12px 0',
                background: 'var(--card)',
                border: '1px solid var(--line)',
                borderRadius: '14px',
                fontSize: '18px',
                fontWeight: 700,
                cursor: 'pointer',
                color: 'var(--ink)'
              }}
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              style={{
                padding: '12px 0',
                background: 'var(--chip)',
                border: 0,
                borderRadius: '14px',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                color: 'var(--mute)'
              }}
            >
              ⌫
            </button>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                style={{
                  flex: 1,
                  padding: '11px',
                  borderRadius: '14px',
                  background: 'var(--chip)',
                  border: 0,
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: 'pointer',
                  color: 'var(--ink)'
                }}
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={loading || pin.length < 4}
              className="w-btn k"
              style={{
                flex: 2,
                padding: '11px',
                borderRadius: '14px',
                fontWeight: 700,
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              {loading ? 'Verifying...' : 'Unlock Portal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
