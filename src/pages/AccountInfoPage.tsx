import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { validateEthiopianPhone } from '../services/ethiopianPhoneValidator';
import { TelebirrLogo, CBELogo } from '../components/wallet/PaymentLogos';

interface AttachedAccount {
  id: string;
  type: 'Telebirr' | 'M-Pesa' | 'CBE';
  name: string;
  accountNumber: string;
  isDefault: boolean;
  isVerified: boolean;
}

export const AccountInfoPage: React.FC = () => {
  const { switchPage, showToast } = useApp();
  const { t, lang } = useLanguage();
  const { user, updateProfile } = useAuth();

  const [fullName, setFullName] = useState<string>(user?.fullName || 'Telegram Player');
  const [isEditingName, setIsEditingName] = useState<boolean>(false);

  // Phone Number Linking / Editing State
  const tgIdStr = user?.telegramId ? String(user.telegramId) : '';
  const hasRealPhone =
    !!user?.phone &&
    user.phone.length >= 9 &&
    !user.phone.startsWith('+25198888') &&
    user.phone !== '0911234567' &&
    (!tgIdStr || (!user.phone.includes(tgIdStr.slice(-6)) && user.phone !== `09${tgIdStr.slice(-8)}`));
  const [phoneInput, setPhoneInput] = useState<string>(hasRealPhone ? (user?.nationalPhone || user?.phone || '') : '');
  const [isEditingPhone, setIsEditingPhone] = useState<boolean>(!hasRealPhone);

  // Telegram Account Linking State
  const [telegramUsername, setTelegramUsername] = useState<string>(user?.telegramUsername || '');
  const [isEditingTelegram, setIsEditingTelegram] = useState<boolean>(false);
  const [tempTelegramInput, setTempTelegramInput] = useState<string>(user?.telegramUsername || '');

  // Attached Accounts List (Telebirr & CBE ONLY)
  const [attachedAccounts, setAttachedAccounts] = useState<AttachedAccount[]>(() => {
    if (user?.attachedAccounts && user.attachedAccounts.length > 0) {
      return user.attachedAccounts;
    }
    try {
      const saved = localStorage.getItem('betika_attached_payout_accounts');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  // Sync state if user changes
  useEffect(() => {
    if (user) {
      setFullName(user.fullName || (user.telegramUsername ? `@${user.telegramUsername}` : ''));
      if (user.telegramUsername) {
        setTelegramUsername(user.telegramUsername);
        setTempTelegramInput(user.telegramUsername);
      }
      if (hasRealPhone && (user.nationalPhone || user.phone)) {
        setPhoneInput(user.nationalPhone || user.phone);
        setIsEditingPhone(false);
      } else if (!hasRealPhone) {
        setIsEditingPhone(true);
      }
      if (user.attachedAccounts && user.attachedAccounts.length > 0) {
        setAttachedAccounts(user.attachedAccounts);
      }
    }
  }, [user, hasRealPhone]);

  useEffect(() => {
    try {
      localStorage.setItem('betika_attached_payout_accounts', JSON.stringify(attachedAccounts));
    } catch {}
  }, [attachedAccounts]);

  // New Account Form State (Telebirr & CBE ONLY)
  const [showAddAccount, setShowAddAccount] = useState<boolean>(false);
  const [newAccType, setNewAccType] = useState<'Telebirr' | 'CBE'>('Telebirr');
  const [newAccName, setNewAccName] = useState<string>('');
  const [newAccNumber, setNewAccNumber] = useState<string>('');

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`📋 ${t('common.copied')}: ${label}`);
  };

  const handleSaveName = async () => {
    if (!fullName.trim()) {
      showToast('⚠️ Please enter a valid name.');
      return;
    }
    await updateProfile({ fullName: fullName.trim() });
    setIsEditingName(false);
    showToast('✅ Full Name updated successfully!');
  };

  const handleSavePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateEthiopianPhone(phoneInput);
    if (!validation.isValid) {
      showToast(validation.errorMessage || '⚠️ Please enter a valid Ethiopian phone number (09... or 07...).');
      return;
    }

    let updatedAttached = [...attachedAccounts];
    // Auto add or update as default telebirr account if not existing
    const telebirrIndex = updatedAttached.findIndex(a => a.type === 'Telebirr');
    if (telebirrIndex === -1) {
      updatedAttached = [
        {
          id: `acc-${Date.now()}`,
          type: 'Telebirr',
          name: `${fullName || user?.fullName || 'My Account'} (Telebirr)`,
          accountNumber: validation.nationalNumber,
          isDefault: true,
          isVerified: true
        },
        ...updatedAttached
      ];
    } else if (!updatedAttached[telebirrIndex].accountNumber) {
      updatedAttached[telebirrIndex] = {
        ...updatedAttached[telebirrIndex],
        accountNumber: validation.nationalNumber
      };
    }
    setAttachedAccounts(updatedAttached);

    await updateProfile({
      phone: validation.canonicalNumber,
      nationalPhone: validation.nationalNumber,
      formattedPhone: validation.formattedDisplay,
      carrier: validation.carrier || undefined,
      attachedAccounts: updatedAttached
    });

    setIsEditingPhone(false);
    showToast(
      lang === 'am'
        ? `✅ ስልክ ቁጥርዎ (${validation.formattedDisplay}) በተሳካ ሁኔታ ተቀምጧል!`
        : `✅ Phone number (${validation.formattedDisplay}) saved successfully!`
    );
  };

  const handleLinkTelegram = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = tempTelegramInput.trim().replace(/^@/, '');
    if (!cleanUsername) {
      showToast('⚠️ Please enter your Telegram username or ID.');
      return;
    }
    setTelegramUsername(cleanUsername);
    await updateProfile({ telegramUsername: cleanUsername });
    setIsEditingTelegram(false);
    showToast(`✅ Telegram @${cleanUsername} ${t('accountInfo.connected')}!`);
  };

  const handleSetDefault = async (id: string) => {
    const updated = attachedAccounts.map(acc => ({
      ...acc,
      isDefault: acc.id === id
    }));
    setAttachedAccounts(updated);
    await updateProfile({ attachedAccounts: updated });
    showToast('⭐ Default payout account updated!');
  };

  const handleRemoveAccount = async (id: string) => {
    const updated = attachedAccounts.filter(a => a.id !== id);
    setAttachedAccounts(updated);
    await updateProfile({ attachedAccounts: updated });
    showToast('🗑️ Attached account removed.');
  };

  const handleAddNewAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccNumber || newAccNumber.trim().length < 8) {
      showToast('⚠️ Please enter a valid account or phone number.');
      return;
    }

    const newAcc: AttachedAccount = {
      id: `acc-${Date.now()}`,
      type: newAccType,
      name: newAccName.trim() || `${fullName || user?.fullName || 'Player'} (${newAccType})`,
      accountNumber: newAccNumber.trim(),
      isDefault: attachedAccounts.length === 0,
      isVerified: true
    };

    const updated = [...attachedAccounts, newAcc];
    setAttachedAccounts(updated);
    setShowAddAccount(false);
    setNewAccNumber('');
    setNewAccName('');
    await updateProfile({ attachedAccounts: updated });
    showToast(`✅ ${newAccType} account attached successfully!`);
  };

  const initials = fullName
    .split(' ')
    .map(p => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || (user?.telegramUsername ? user.telegramUsername.slice(0, 2).toUpperCase() : 'TG');

  const userIdDisplay = user?.id || 'UID-TG-USER';
  const registeredDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Today';

  return (
    <div className="page active page-subpage-dedicated" id="page-account-info">
      {/* Top Back Navigation Bar */}
      <div className="subpage-back-header">
        <button
          type="button"
          className="btn-subpage-back"
          onClick={() => switchPage('profile')}
        >
          <i className="fa-solid fa-chevron-left"></i>
          <span>{t('nav.profile')}</span>
        </button>
        <h2 className="subpage-header-title">{t('accountInfo.title')}</h2>
        <div style={{ width: '40px' }}></div>
      </div>

      <div className="subpage-content-scroll">
        {/* 1. Identity & VIP Badge Hero Card */}
        <div className="user-kyc-hero-box">
          <div className="kyc-avatar-wrap">
            <span className="avatar-letters">{initials}</span>
            <span className="kyc-verified-badge" title="Verified Player">
              <i className="fa-solid fa-circle-check"></i>
            </span>
          </div>

          <div className="kyc-user-details-col">
            <div className="user-name-edit-row">
              {isEditingName ? (
                <div className="name-edit-input-wrap">
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    className="input-inline-name"
                  />
                  <button type="button" className="btn-save-name-tiny" onClick={handleSaveName}>
                    {t('common.save')}
                  </button>
                </div>
              ) : (
                <div className="name-display-row">
                  <strong className="user-full-name">{fullName}</strong>
                  <button
                    type="button"
                    className="btn-pencil-edit-name"
                    onClick={() => setIsEditingName(true)}
                    title="Edit Name"
                  >
                    <i className="fa-solid fa-pen"></i>
                  </button>
                </div>
              )}
            </div>

            <div className="user-meta-chips-row">
              <span className="meta-vip-tier-chip">
                <i className="fa-solid fa-crown gold"></i> {t('accountInfo.vipTier')}
              </span>
              <span className="meta-kyc-chip">
                <i className="fa-solid fa-shield-halved green"></i> {t('accountInfo.kycLevel')}
              </span>
            </div>
          </div>
        </div>

        {/* 2. Real Ethiopian Phone / Telebirr Number Card */}
        <div className="info-section-group">
          <span className="info-group-title">
            <i className="fa-solid fa-mobile-screen gold"></i>{' '}
            {lang === 'am' ? 'የቴሌብር / ስልክ ቁጥር' : 'Telebirr / Payout Phone'}
          </span>

          <div className="telegram-linking-card">
            <div className="tg-card-top-row">
              <div className="tg-logo-name-wrap">
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: '#ecfdf5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    color: '#16a34a'
                  }}
                >
                  <i className="fa-solid fa-phone"></i>
                </div>
                <div>
                  <strong className="tg-card-title">
                    {hasRealPhone ? user?.formattedPhone : (lang === 'am' ? 'ስልክ ቁጥር አልተያያዘም' : 'No Phone Linked')}
                  </strong>
                  <span className="tg-card-sub">
                    {hasRealPhone
                      ? (user?.carrier === 'safaricom' ? '🔴 Safaricom Ethiopia' : '🟢 Ethio Telecom')
                      : (lang === 'am' ? 'ለፈጣን ወጪ ክፍያ ስልክዎን ያያይዙ' : 'Link for instant Telebirr cashouts')}
                  </span>
                </div>
              </div>

              {!isEditingPhone && (
                <button
                  type="button"
                  className="btn-change-tg"
                  onClick={() => setIsEditingPhone(true)}
                >
                  {hasRealPhone ? (lang === 'am' ? 'ቀይር' : 'Change') : (lang === 'am' ? 'አያይዝ' : 'Link Phone')}
                </button>
              )}
            </div>

            {isEditingPhone && (
              <form className="tg-edit-form" onSubmit={handleSavePhone} style={{ marginTop: '12px' }}>
                <div className="tg-input-wrapper">
                  <span className="tg-at-prefix">+251</span>
                  <input
                    type="tel"
                    value={phoneInput.replace(/^\+251|^0/, '')}
                    onChange={e => setPhoneInput('0' + e.target.value.replace(/\D/g, ''))}
                    placeholder="911234567"
                    className="input-tg-handle"
                    autoFocus
                    required
                  />
                </div>
                <div className="tg-form-actions-row">
                  <button type="submit" className="btn-tg-save">
                    <i className="fa-solid fa-check"></i> {lang === 'am' ? 'አስቀምጥ' : 'Save'}
                  </button>
                  <button
                    type="button"
                    className="btn-tg-cancel"
                    onClick={() => setIsEditingPhone(false)}
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* 3. Telegram Account Link & Verification Card */}
        <div className="info-section-group">
          <span className="info-group-title">
            <i className="fa-brands fa-telegram telegram-color"></i> {t('accountInfo.telegramTitle')}
          </span>

          <div className="telegram-linking-card">
            <div className="tg-card-top-row">
              <div className="tg-logo-name-wrap">
                <i className="fa-brands fa-telegram tg-card-icon"></i>
                <div>
                  <strong className="tg-card-title">Telegram Mini App</strong>
                  <span className="tg-card-sub">{t('accountInfo.telegramSub')}</span>
                </div>
              </div>

              {!isEditingTelegram && (
                <button
                  type="button"
                  className="btn-change-tg"
                  onClick={() => {
                    setTempTelegramInput(telegramUsername);
                    setIsEditingTelegram(true);
                  }}
                >
                  {telegramUsername ? t('accountInfo.change') : t('accountInfo.add')}
                </button>
              )}
            </div>

            {isEditingTelegram ? (
              <form className="tg-edit-form" onSubmit={handleLinkTelegram}>
                <div className="tg-input-wrapper">
                  <span className="tg-at-prefix">@</span>
                  <input
                    type="text"
                    value={tempTelegramInput}
                    onChange={e => setTempTelegramInput(e.target.value)}
                    placeholder="username"
                    className="input-tg-handle"
                    autoFocus
                  />
                </div>
                <div className="tg-form-actions-row">
                  <button type="submit" className="btn-tg-save">
                    {t('common.save')}
                  </button>
                  <button
                    type="button"
                    className="btn-tg-cancel"
                    onClick={() => setIsEditingTelegram(false)}
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </form>
            ) : (
              <div className="tg-status-display-row">
                <strong className="tg-handle-txt">@{telegramUsername || 'Telegram User'}</strong>
                <span className="tg-connected-badge">
                  <i className="fa-solid fa-circle-check"></i> {t('accountInfo.connected')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 4. Attached Payout Accounts (Telebirr & CBE ONLY with Official Logos) */}
        <div className="info-section-group">
          <div className="section-title-with-btn">
            <span className="info-group-title">
              <i className="fa-solid fa-wallet gold"></i> {t('accountInfo.attachedAccounts')}
            </span>
            <button
              type="button"
              className="btn-attach-new-acc"
              onClick={() => setShowAddAccount(!showAddAccount)}
            >
              <i className="fa-solid fa-plus"></i> {t('accountInfo.attachAccount')}
            </button>
          </div>

          {/* Add New Account Form (Telebirr & CBE ONLY) */}
          {showAddAccount && (
            <form className="add-attached-acc-form" onSubmit={handleAddNewAccount}>
              <div className="form-head-title">
                {lang === 'am' ? 'የቴሌብር ወይም የንግድ ባንክ አካውንት አያይዝ' : 'Attach Telebirr or CBE Bank Account'}
              </div>

              {/* 2-Option Selector with Official Logos */}
              <div className="add-acc-type-selector-two">
                <button
                  type="button"
                  className={`btn-type-card-logo ${newAccType === 'Telebirr' ? 'active' : ''}`}
                  onClick={() => setNewAccType('Telebirr')}
                >
                  <TelebirrLogo size={24} />
                  <span className="type-card-label">Telebirr</span>
                  {newAccType === 'Telebirr' && <i className="fa-solid fa-circle-check check-dot"></i>}
                </button>

                <button
                  type="button"
                  className={`btn-type-card-logo ${newAccType === 'CBE' ? 'active' : ''}`}
                  onClick={() => setNewAccType('CBE')}
                >
                  <CBELogo size={24} />
                  <span className="type-card-label">CBE Bank</span>
                  {newAccType === 'CBE' && <i className="fa-solid fa-circle-check check-dot"></i>}
                </button>
              </div>

              <div className="field-input-box" style={{ marginTop: '8px' }}>
                <i className="fa-solid fa-user field-icon"></i>
                <input
                  type="text"
                  value={newAccName}
                  onChange={e => setNewAccName(e.target.value)}
                  placeholder={lang === 'am' ? 'የአካውንት ባለቤት ሙሉ ስም' : 'Account Holder Full Name'}
                  required
                />
              </div>

              <div className="field-input-box" style={{ marginTop: '8px' }}>
                <i className={`fa-solid ${newAccType === 'Telebirr' ? 'fa-mobile-screen' : 'fa-building-columns'} field-icon`}></i>
                <input
                  type="text"
                  value={newAccNumber}
                  onChange={e => setNewAccNumber(e.target.value)}
                  placeholder={newAccType === 'Telebirr' ? (lang === 'am' ? 'የቴሌብር ስልክ ቁጥር (ምሳሌ፡ 0911234567)' : 'Telebirr Phone Number') : (lang === 'am' ? 'የኢትዮጵያ ንግድ ባንክ ሒሳብ ቁጥር' : 'CBE Bank Account Number')}
                  required
                />
              </div>

              <div className="add-acc-actions-row">
                <button type="submit" className="btn-confirm-add-acc">
                  <i className="fa-solid fa-check"></i> {t('accountInfo.attachAccount')}
                </button>
                <button
                  type="button"
                  className="btn-cancel-add-acc"
                  onClick={() => setShowAddAccount(false)}
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          )}

          {/* List of Attached Accounts with Logos */}
          <div className="attached-accounts-list">
            {attachedAccounts.length > 0 ? (
              attachedAccounts.map(acc => (
                <div key={acc.id} className={`attached-account-card ${acc.isDefault ? 'default-card' : ''}`}>
                  <div className="attached-acc-logo-wrap">
                    {acc.type === 'Telebirr' ? (
                      <TelebirrLogo size={28} />
                    ) : (
                      <CBELogo size={28} />
                    )}
                  </div>

                  <div className="attached-acc-info-col">
                    <div className="acc-name-badge-row">
                      <strong className="acc-type-title">{acc.name}</strong>
                      {acc.isDefault && <span className="default-payout-pill">⭐ {t('common.defaultPayout')}</span>}
                    </div>
                    <span className="acc-num-mono">{acc.accountNumber}</span>
                  </div>

                  <div className="attached-acc-actions-col">
                    {!acc.isDefault && (
                      <button
                        type="button"
                        className="btn-set-default"
                        onClick={() => handleSetDefault(acc.id)}
                        title="Set as Default Payout Method"
                      >
                        {t('common.defaultPayout')}
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-trash-acc"
                      onClick={() => handleRemoveAccount(acc.id)}
                      title="Remove Account"
                    >
                      <i className="fa-regular fa-trash-can"></i>
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '16px', color: '#64748b', fontSize: '13px', background: '#ffffff', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
                {lang === 'am' ? 'ምንም የተያያዘ የክፍያ አካውንት የለም። ከላይ "+" በመንካት የቴሌብር ቁጥርዎን ያያይዙ።' : 'No payout accounts linked yet. Tap "+" above to link your Telebirr or CBE account.'}
              </div>
            )}
          </div>
        </div>

        {/* 5. Credentials & Registration Details Strip */}
        <div className="info-section-group">
          <span className="info-group-title">
            <i className="fa-solid fa-shield gold"></i> {t('accountInfo.credentials')}
          </span>

          <div className="credentials-grid-strip">
            <div className="cred-item-box">
              <span className="cred-lbl">{t('accountInfo.userId')}</span>
              <div className="cred-val-copy-row">
                <strong className="cred-mono">{userIdDisplay}</strong>
                <button
                  type="button"
                  className="btn-cred-copy"
                  onClick={() => handleCopy(userIdDisplay, 'User ID')}
                >
                  <i className="fa-regular fa-copy"></i>
                </button>
              </div>
            </div>

            <div className="cred-item-box">
              <span className="cred-lbl">{t('accountInfo.phoneNumber')}</span>
              <div className="cred-val-copy-row">
                <strong className="cred-mono">{hasRealPhone ? user?.formattedPhone : (lang === 'am' ? 'አልተያያዘም' : 'Not Linked')}</strong>
                {hasRealPhone && <span className="verified-dot-tag">✓ {t('common.verified')}</span>}
              </div>
            </div>

            <div className="cred-item-box">
              <span className="cred-lbl">Network Operator</span>
              <span className="cred-val-txt" style={{ textTransform: 'capitalize', fontWeight: 700 }}>
                {hasRealPhone ? (user?.carrier === 'safaricom' ? '🔴 Safaricom Ethiopia' : '🟢 Ethio Telecom') : '⚡ Telegram Web'}
              </span>
            </div>

            <div className="cred-item-box">
              <span className="cred-lbl">{t('accountInfo.registered')}</span>
              <span className="cred-val-txt">{registeredDate}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
