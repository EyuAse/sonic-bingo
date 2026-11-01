import React from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';

interface ProfileHeaderProps {
  onEditClick?: () => void;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({ onEditClick }) => {
  const { switchPage } = useApp();
  const { user } = useAuth();

  const handleAction = () => {
    if (onEditClick) {
      onEditClick();
    } else {
      switchPage('account-info');
    }
  };

  const displayName = user?.fullName || 'Eyu Ase';
  const displayHandle = user?.telegramUsername
    ? `@${user.telegramUsername}`
    : (user?.phone ? user.phone : '@Troy019');

  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map(p => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'EA';

  return (
    <div className="fresh-profile-banner-card" onClick={handleAction} role="button" tabIndex={0}>
      {/* Top-Left Dark Obsidian Geometric Swoosh Accent */}
      <div className="banner-obsidian-corner-cut" aria-hidden="true"></div>

      {/* Avatar Container with Edit Pencil Badge */}
      <div className="profile-avatar-wrapper">
        <div className="avatar-ea-circle">{initials}</div>
        <button
          type="button"
          className="btn-avatar-edit-pencil"
          onClick={(e) => {
            e.stopPropagation();
            handleAction();
          }}
          title="Edit Profile & Accounts"
          aria-label="Edit Profile"
        >
          <i className="fa-solid fa-pencil"></i>
        </button>
      </div>

      {/* Profile Name, Telegram Handle & Rank Badge */}
      <div className="profile-details-group">
        <h2 className="profile-name-bold">{displayName}</h2>
        <div className="profile-handle-rank-row">
          <span className="profile-handle-txt">{displayHandle}</span>
          <span className="profile-rank-pill">
            <span className="rank-star-icon">★</span> Rank #281
          </span>
        </div>
      </div>

      {/* Right: 3D Royal Gold Crown & Flowing Golden Silk Ribbon */}
      <div className="profile-crown-graphic-right" aria-hidden="true">
        <img
          src="/assets/images/wallet-vip-crown-ribbon.jpg"
          alt="VIP 3D Royal Gold Crown and Silk Ribbon"
          className="vip-crown-ribbon-img"
          loading="eager"
        />
      </div>
    </div>
  );
};
