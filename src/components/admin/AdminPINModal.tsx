import React, { useState } from 'react';
import { useAdmin } from '../../context/AdminContext.tsx';
import { useApp } from '../../context/AppContext.tsx';

export const AdminPINModal: React.FC = () => {
  const { loginAdmin } = useAdmin();
  const { switchPage, showToast } = useApp();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);

  const handleBackToGame = () => {
    window.location.hash = '';
    switchPage('games');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || isLoading) return;

    setIsLoading(true);
    setError(false);

    try {
      const success = await loginAdmin(password.trim());
      if (success) {
        showToast('🔓 Admin Portal Unlocked');
      } else {
        setError(true);
        showToast('❌ Incorrect Admin Password');
      }
    } catch {
      setError(true);
      showToast('❌ Login Failed');
    } finally {
      setIsLoading(false);
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

        <p className="pin-prompt">Enter Security Master Password to access system controls</p>

        <form onSubmit={handleSubmit} className="admin-password-form">
          <div className="admin-password-input-wrapper">
            <i className="fa-solid fa-lock admin-password-input-icon"></i>
            <input
              type={showPassword ? 'text' : 'password'}
              className={`admin-password-input ${error ? 'input-error shake-error' : ''}`}
              placeholder="Enter Admin Password..."
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(false);
              }}
              autoFocus
              autoComplete="current-password"
            />
            <button
              type="button"
              className="admin-password-toggle-btn"
              onClick={() => setShowPassword(!showPassword)}
              title={showPassword ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
            </button>
          </div>

          {error && (
            <p className="pin-error-text">⚠️ Invalid Admin Password. Access Denied.</p>
          )}

          <div className="pin-actions-row">
            <button
              type="button"
              className="btn-pin-cancel"
              onClick={handleBackToGame}
              disabled={isLoading}
            >
              <i className="fa-solid fa-arrow-left"></i> Exit to Games
            </button>
            <button
              type="submit"
              className="btn-pin-unlock"
              disabled={!password.trim() || isLoading}
            >
              {isLoading ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin"></i> Verifying...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-lock-open"></i> Unlock Portal
                </>
              )}
            </button>
          </div>
        </form>

        <div className="pin-footer-hint">
          <span>Protected by Sonic Bingo Enterprise V3 Security</span>
        </div>
      </div>
    </div>
  );
};
