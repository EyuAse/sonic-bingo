import React, { useState } from 'react';
import { useAdmin } from '../../context/AdminContext.tsx';
import { useApp } from '../../context/AppContext.tsx';

export const AdminPINModal: React.FC = () => {
  const { loginAdmin, brandName } = useAdmin();
  const { switchPage, showToast } = useApp();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handleKeyPress = (num: string) => {
    if (pin.length < 6) {
      const newPin = pin + num;
      setPin(newPin);
      setError(false);
      if (newPin.length === 4) {
        // Auto-check on 4 digits
        if (loginAdmin(newPin)) {
          showToast('🔓 Admin Portal Unlocked');
        } else {
          setError(true);
        }
      }
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
    setError(false);
  };

  const handleClear = () => {
    setPin('');
    setError(false);
  };

  const handleBackToGame = () => {
    window.location.hash = '';
    switchPage('games');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginAdmin(pin)) {
      showToast('🔓 Admin Portal Unlocked');
    } else {
      setError(true);
      showToast('❌ Incorrect PIN');
    }
  };

  return (
    <div className="admin-pin-overlay">
      <div className="admin-pin-card">
        <div className="pin-brand-header">
          <div className="pin-brand-icon">
            <i className="fa-solid fa-shield-halved"></i>
          </div>
          <h2 className="pin-brand-title">
            <span className="text-white">SONIC</span> <span className="text-gold">BINGO</span>
          </h2>
          <span className="pin-portal-badge">PRIVATE ADMIN PORTAL</span>
        </div>

        <p className="pin-prompt">Enter Security Master PIN to access system controls</p>

        {/* PIN Indicators */}
        <div className={`pin-dots-row ${error ? 'shake-error' : ''}`}>
          {[0, 1, 2, 3].map(idx => (
            <div
              key={idx}
              className={`pin-dot ${idx < pin.length ? 'filled' : ''} ${error ? 'dot-error' : ''}`}
            ></div>
          ))}
        </div>

        {error && <p className="pin-error-text">⚠️ Invalid Admin PIN. Try default: 1234</p>}

        {/* Numeric Keypad */}
        <div className="pin-keypad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(digit => (
            <button
              key={digit}
              type="button"
              className="pin-key-btn"
              onClick={() => handleKeyPress(digit)}
            >
              {digit}
            </button>
          ))}
          <button type="button" className="pin-key-btn key-action" onClick={handleClear}>
            C
          </button>
          <button type="button" className="pin-key-btn" onClick={() => handleKeyPress('0')}>
            0
          </button>
          <button type="button" className="pin-key-btn key-action" onClick={handleBackspace}>
            <i className="fa-solid fa-delete-left"></i>
          </button>
        </div>

        <div className="pin-actions-row">
          <button type="button" className="btn-pin-cancel" onClick={handleBackToGame}>
            <i className="fa-solid fa-arrow-left"></i> Exit to Games
          </button>
          <button
            type="button"
            className="btn-pin-unlock"
            disabled={pin.length < 4}
            onClick={handleSubmit}
          >
            <i className="fa-solid fa-lock-open"></i> Unlock
          </button>
        </div>

        <div className="pin-footer-hint">
          <span>Protected by Sonic Bingo Engine V3 Security</span>
        </div>
      </div>
    </div>
  );
};
