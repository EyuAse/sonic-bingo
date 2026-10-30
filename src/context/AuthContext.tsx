import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, RegisterPayload, LoginPayload, OtpChallengeResponse, OtpVerificationResult } from '../types/auth';
import { TelegramUser } from '../types/telegram';
import { authService } from '../services/authService';
import { telegramService } from '../services/telegramService';
import { apiClient } from '../services/apiClient';
import { socketService } from '../services/socketService';
import { useLanguage } from './LanguageContext';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInsideTelegram: boolean;
  telegramUser: TelegramUser | null;
  isFirstTimeTelegramUser: boolean;
  dismissFirstTimeModal: () => void;
  concurrentSessionNotice: { reason: string; message: string } | null;
  dismissConcurrentSessionNotice: () => void;
  reclaimSessionOnThisDevice: () => Promise<void>;
  sendOtp: (phone: string) => Promise<OtpChallengeResponse>;
  verifyOtp: (phone: string, code: string) => OtpVerificationResult;
  register: (payload: RegisterPayload) => Promise<User>;
  login: (payload: LoginPayload) => Promise<User>;
  loginWithPhone: (phone: string, pin: string) => Promise<User>;
  loginWithTelegram: (tgUser?: TelegramUser, customPhone?: string, referralCode?: string) => Promise<{ user: User; isNewUser: boolean }>;
  logout: () => void;
  resetPin: (phone: string, otpCode: string, newPin: string) => Promise<boolean>;
  updateProfile: (data: Partial<User>) => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { lang } = useLanguage();
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem('sonic_user');
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      if (!parsed || !parsed.id) return null;

      // Check explicit logout
      if (parsed.telegramId && localStorage.getItem(`sonic_explicit_logout_${parsed.telegramId}`) === 'true') {
        return null;
      }
      if (localStorage.getItem('sonic_explicit_logout') === 'true') {
        return null;
      }

      // Check if inside Telegram with a different account
      const tgUser = (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user;
      if (tgUser && tgUser.id && parsed.telegramId) {
        if (String(parsed.telegramId) !== String(tgUser.id)) {
          return null; // Different Telegram account on same phone
        }
      }

      return parsed;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem('sonic_user');
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      if (parsed?.telegramId && localStorage.getItem(`sonic_explicit_logout_${parsed.telegramId}`) === 'true') {
        return null;
      }
      if (localStorage.getItem('sonic_explicit_logout') === 'true') {
        return null;
      }
      return localStorage.getItem('sonic_auth_token');
    } catch {
      return null;
    }
  });

  const [isLoading, setIsLoading] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const stored = localStorage.getItem('sonic_user');
      const storedToken = localStorage.getItem('sonic_auth_token');
      if (stored && storedToken) {
        const parsed = JSON.parse(stored);
        if (parsed?.telegramId && localStorage.getItem(`sonic_explicit_logout_${parsed.telegramId}`) === 'true') {
          return true;
        }
        if (localStorage.getItem('sonic_explicit_logout') === 'true') {
          return true;
        }
        const tgUser = (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user;
        if (tgUser && tgUser.id && parsed?.telegramId && String(parsed.telegramId) !== String(tgUser.id)) {
          return true;
        }
        return false; // Valid cached session exists — instant frame-1 auth
      }
    } catch {}
    return true;
  });
  const [isInsideTelegram, setIsInsideTelegram] = useState<boolean>(false);
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);
  const [isFirstTimeTelegramUser, setIsFirstTimeTelegramUser] = useState<boolean>(false);
  const [concurrentSessionNotice, setConcurrentSessionNotice] = useState<{ reason: string; message: string } | null>(null);

  const dismissConcurrentSessionNotice = () => {
    setConcurrentSessionNotice(null);
  };

  const reclaimSessionOnThisDevice = async () => {
    setConcurrentSessionNotice(null);
    const tgUser = telegramUser || telegramService.getTelegramUser();
    if (tgUser && tgUser.id) {
      localStorage.removeItem(`sonic_explicit_logout_${tgUser.id}`);
      localStorage.removeItem('sonic_explicit_logout');
      try {
        await loginWithTelegram(tgUser);
      } catch (e) {
        console.warn('Reclaim session via Telegram failed:', e);
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      }
    } else {
      localStorage.removeItem('sonic_explicit_logout');
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    }
  };

  // Listen for Single-Device Enforcement events: if account logged in on another device, terminate session here
  useEffect(() => {
    const unsub = socketService.onSessionTerminated((data) => {
      console.warn('⚠️ [AuthContext] Single Active Device Policy triggered: logged in elsewhere:', data);
      socketService.terminateSession();
      setConcurrentSessionNotice(data);
      authService.clearSession();
      localStorage.removeItem('sonic_auth_token');
      localStorage.removeItem('sonic_user');
      localStorage.removeItem('sonic_live_balance');
      localStorage.removeItem('sonic_live_bonus');
      const tgId = telegramUser?.id || telegramService.getTelegramUser()?.id;
      if (tgId) {
        localStorage.setItem(`sonic_explicit_logout_${tgId}`, 'true');
      }
      localStorage.setItem('sonic_explicit_logout', 'true');
      setUser(null);
      setToken(null);
    });

    return () => {
      unsub();
    };
  }, [telegramUser]);

  // Initialize Telegram WebApp, Purge Legacy Test Data & Auto-Authenticate with Neon DB
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Purge all legacy storage keys from previous client apps
    if (typeof window !== 'undefined') {
      try {
        Object.keys(localStorage).forEach(k => {
          if (k.startsWith('lomi_') || k.startsWith('betika_') || k.startsWith('lb_')) {
            localStorage.removeItem(k);
          }
        });
      } catch {}
    }
    // Legacy storage keys
        if (typeof window !== 'undefined') {
          const legacyKeys = [
            'betika_user_balance',
            'betika_user_bonus',
            'lb_admin_users',
            'lb_admin_transactions',
            'sonic_registered_users',
            'sonic_registered_users_v2',
            'sonic_registered_users_v3',
            'sonic_registered_users_v4'
          ];
          legacyKeys.forEach(k => localStorage.removeItem(k));
        }

        // 1. Initialize Telegram WebApp SDK
        telegramService.initWebApp();
        const startParam = telegramService.getStartParam();
        if (startParam && typeof window !== 'undefined') {
          sessionStorage.setItem('sonic_pending_referral', startParam);
        }
        const tgUser = telegramService.getTelegramUser();
        const isTg = telegramService.isTelegram() && !!tgUser;
        setIsInsideTelegram(isTg);
        setTelegramUser(tgUser);

        // 2. Multi-Account Isolation: If inside Telegram, clear previous user's cached data if account switched
        if (isTg && tgUser && tgUser.id) {
          const storedUserJson = localStorage.getItem('sonic_user');
          if (storedUserJson) {
            try {
              const parsed = JSON.parse(storedUserJson);
              if (parsed.telegramId && String(parsed.telegramId) !== String(tgUser.id)) {
                // Switched to a different Telegram account on the same phone!
                localStorage.removeItem('sonic_auth_token');
                localStorage.removeItem('sonic_user');
                localStorage.removeItem('sonic_live_balance');
                localStorage.removeItem('sonic_live_bonus');
              }
            } catch {}
          }

          const isExplicitlyLoggedOut =
            typeof window !== 'undefined' && localStorage.getItem(`sonic_explicit_logout_${tgUser.id}`) === 'true';

          // Auto-authenticate: loginWithTelegram handles both login + registration
          try {
            if (!isExplicitlyLoggedOut) {
              const apiResult = await apiClient.auth.loginWithTelegram(tgUser);
              const rawPhone = apiResult.user.phone;
              const tgIdStr = String(tgUser.id);
              const isRealServerPhone =
                rawPhone &&
                rawPhone.length >= 9 &&
                !rawPhone.startsWith('+25198888') &&
                rawPhone !== '0911234567' &&
                !rawPhone.includes(tgIdStr.slice(-6)) &&
                rawPhone !== `09${tgIdStr.slice(-8)}`;

              const mappedUser: User = {
                id: apiResult.user.id,
                telegramId: apiResult.user.telegramId,
                telegramUsername: apiResult.user.telegramUsername,
                fullName: apiResult.user.fullName || tgUser.first_name,
                phone: isRealServerPhone ? rawPhone : '',
                nationalPhone: isRealServerPhone ? `0${rawPhone.slice(-9)}` : '',
                formattedPhone: isRealServerPhone ? rawPhone : '',
                carrier: isRealServerPhone ? (apiResult.user.carrier || 'ethiotelecom') : undefined,
                isPhoneVerified: !!isRealServerPhone,
                role: apiResult.user.role || 'player',
                referralCode: apiResult.user.referralCode,
                attachedAccounts: apiResult.user.attachedAccounts || [],
                pin: '1234',
                createdAt: apiResult.user.createdAt || new Date().toISOString(),
                lastLogin: new Date().toISOString()
              };

              setUser(mappedUser);
              setToken(apiResult.token);
              setIsFirstTimeTelegramUser(!!apiResult.isNewUser);
              localStorage.setItem('sonic_user', JSON.stringify(mappedUser));
              localStorage.setItem('sonic_auth_token', apiResult.token);
              if (apiResult.wallet) {
                localStorage.setItem('sonic_live_balance', apiResult.wallet.balance.toFixed(2));
                localStorage.setItem('sonic_live_bonus', apiResult.wallet.bonus.toFixed(2));
                window.dispatchEvent(new CustomEvent('lb_wallet_updated', { detail: apiResult.wallet }));
              }
              return;
            }
          } catch (err) {
            console.warn('⚠️ Server auth check notice:', (err as any)?.message || err);
            // Fall back to existing cached session on any network/server glitch so existing user is never kicked to sign-up
            const cachedUser = localStorage.getItem('sonic_user');
            const cachedToken = localStorage.getItem('sonic_auth_token');
            if (cachedUser && cachedToken) {
              try {
                const parsed = JSON.parse(cachedUser);
                if (parsed && parsed.id) {
                  setUser(parsed);
                  setToken(cachedToken);
                  return; // Silently use cached session — user sees their real balance & game
                }
              } catch {}
            }
          }
        }

        // 3. Fallback to existing verified session (Web browser)
        const isWebExplicitLogout =
          typeof window !== 'undefined' && localStorage.getItem('sonic_explicit_logout') === 'true';

        if (!isWebExplicitLogout && !isTg) {
          const storedToken = localStorage.getItem('sonic_auth_token');
          if (storedToken) {
            try {
              const meRes = await apiClient.auth.getMe();
              const u = meRes.user;
              const isRealWebPhone =
                u.phone &&
                u.phone.length >= 9 &&
                !u.phone.startsWith('+25198888') &&
                u.phone !== '0911234567';

              const mappedUser: User = {
                id: u.id,
                telegramId: u.telegramId,
                telegramUsername: u.telegramUsername,
                fullName: u.fullName,
                phone: isRealWebPhone ? u.phone : '',
                nationalPhone: isRealWebPhone ? `0${u.phone.slice(-9)}` : '',
                formattedPhone: isRealWebPhone ? u.phone : '',
                carrier: isRealWebPhone ? (u.carrier || 'ethiotelecom') : undefined,
                isPhoneVerified: !!isRealWebPhone,
                role: u.role || 'player',
                referralCode: u.referralCode,
                attachedAccounts: u.attachedAccounts || [],
                pin: '1234',
                createdAt: u.createdAt || new Date().toISOString(),
                lastLogin: new Date().toISOString()
              };
              setUser(mappedUser);
              setToken(storedToken);
              if (meRes.wallet) {
                localStorage.setItem('sonic_live_balance', meRes.wallet.balance.toFixed(2));
                localStorage.setItem('sonic_live_bonus', meRes.wallet.bonus.toFixed(2));
              }
              return;
            } catch {
              // Token expired
            }
          }
        }
      } catch (err) {
        console.error('Error initializing Telegram WebApp auth:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const dismissFirstTimeModal = () => {
    setIsFirstTimeTelegramUser(false);
  };

  const sendOtp = async (phone: string): Promise<OtpChallengeResponse> => {
    return await authService.requestOtp(phone, lang as 'en' | 'am');
  };

  const verifyOtp = (phone: string, code: string): OtpVerificationResult => {
    return authService.verifyOtp(phone, code);
  };

  const register = async (payload: RegisterPayload): Promise<User> => {
    setIsLoading(true);
    try {
      try {
        const apiRes = await apiClient.auth.register({
          phone: payload.phone,
          pin: payload.pin,
          fullName: payload.fullName,
          referralCode: payload.referralCode || (typeof window !== 'undefined' ? sessionStorage.getItem('sonic_pending_referral') || undefined : undefined)
        });
        localStorage.removeItem('sonic_explicit_logout');
        const u = apiRes.user;
        const mappedUser: User = {
          id: u.id,
          phone: u.phone || payload.phone,
          nationalPhone: payload.phone,
          formattedPhone: payload.phone,
          carrier: 'ethiotelecom',
          fullName: u.fullName,
          isPhoneVerified: true,
          role: u.role || 'player',
          referralCode: u.referralCode,
          pin: payload.pin,
          createdAt: u.createdAt || new Date().toISOString(),
          lastLogin: new Date().toISOString()
        };
        setUser(mappedUser);
        setToken(apiRes.token);
        if (apiRes.wallet) {
          localStorage.setItem('sonic_live_balance', apiRes.wallet.balance.toFixed(2));
          localStorage.setItem('sonic_live_bonus', apiRes.wallet.bonus.toFixed(2));
          window.dispatchEvent(new CustomEvent('lb_wallet_updated', { detail: apiRes.wallet }));
        }
        return mappedUser;
      } catch (backendErr) {
        console.warn('Backend register notice, using local service:', backendErr);
        const result = await authService.register(payload);
        localStorage.removeItem('sonic_explicit_logout');
        setUser(result.user);
        setToken(result.token);
        return result.user;
      }
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (payload: LoginPayload): Promise<User> => {
    setIsLoading(true);
    try {
      const apiResult = await apiClient.auth.loginWithPin(payload.phone, payload.pin);
      localStorage.removeItem('sonic_explicit_logout');
      const u = apiResult.user;
      const mappedUser: User = {
        id: u.id,
        telegramId: u.telegramId,
        telegramUsername: u.telegramUsername,
        fullName: u.fullName,
        phone: u.phone || payload.phone,
        nationalPhone: payload.phone,
        formattedPhone: payload.phone,
        carrier: 'ethiotelecom',
        isPhoneVerified: true,
        role: u.role || 'player',
        pin: payload.pin,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString()
      };
      setUser(mappedUser);
      setToken(apiResult.token);
      localStorage.setItem('sonic_user', JSON.stringify(mappedUser));
      localStorage.setItem('sonic_auth_token', apiResult.token);
      return mappedUser;
    } catch {
      const result = await authService.login(payload);
      localStorage.removeItem('sonic_explicit_logout');
      setUser(result.user);
      setToken(result.token);
      return result.user;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithTelegram = async (
    customTgUser?: TelegramUser,
    customPhone?: string,
    referralCode?: string
  ): Promise<{ user: User; isNewUser: boolean }> => {
    const tgUser = customTgUser || telegramUser;
    if (!tgUser) {
      throw new Error('Telegram session not found. Please register or login with your phone number.');
    }

    setIsLoading(true);
    try {
      const refCode = referralCode || (typeof window !== 'undefined' ? sessionStorage.getItem('sonic_pending_referral') || undefined : undefined);
      const apiResult = await apiClient.auth.loginWithTelegram(tgUser, customPhone, refCode);
      localStorage.removeItem('sonic_explicit_logout');

      const tgIdStr = String(tgUser.id);
      const isRealPhoneProvided = customPhone || (apiResult.user.phone &&
        apiResult.user.phone.length >= 9 &&
        !apiResult.user.phone.startsWith('+25198888') &&
        apiResult.user.phone !== '0911234567' &&
        !apiResult.user.phone.includes(tgIdStr.slice(-6)) &&
        apiResult.user.phone !== `09${tgIdStr.slice(-8)}`);
      const finalPhone = isRealPhoneProvided ? (customPhone || apiResult.user.phone) : '';

      const mappedUser: User = {
        id: apiResult.user.id,
        telegramId: apiResult.user.telegramId,
        telegramUsername: apiResult.user.telegramUsername,
        fullName: apiResult.user.fullName || `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim(),
        phone: finalPhone,
        nationalPhone: finalPhone ? `0${finalPhone.slice(-9)}` : '',
        formattedPhone: finalPhone,
        carrier: finalPhone ? (apiResult.user.carrier || 'ethiotelecom') : undefined,
        isPhoneVerified: !!finalPhone,
        role: apiResult.user.role || 'player',
        referralCode: apiResult.user.referralCode,
        attachedAccounts: apiResult.user.attachedAccounts || [],
        pin: '1234',
        createdAt: apiResult.user.createdAt || new Date().toISOString(),
        lastLogin: new Date().toISOString()
      };

      setUser(mappedUser);
      setToken(apiResult.token);
      localStorage.setItem('sonic_user', JSON.stringify(mappedUser));
      localStorage.setItem('sonic_auth_token', apiResult.token);
      if (apiResult.wallet) {
        localStorage.setItem('sonic_live_balance', apiResult.wallet.balance.toFixed(2));
        localStorage.setItem('sonic_live_bonus', apiResult.wallet.bonus.toFixed(2));
        window.dispatchEvent(new CustomEvent('lb_wallet_updated', { detail: apiResult.wallet }));
      }

      telegramService.triggerHaptic('success');
      return { user: mappedUser, isNewUser: apiResult.isNewUser };
    } catch (err: any) {
      console.error('❌ [Login Error]:', err);
      const msg = err?.message || '';
      // Show simple, user-friendly messages — no technical jargon
      if (msg.includes('Too many')) {
        throw new Error(
          lang === 'am'
            ? '⏳ በጣም ብዙ ሙከራዎች። እባክዎ ከ2 ደቂቃ በኋላ እንደገና ይሞክሩ።'
            : '⏳ Too many attempts. Please wait 2 minutes and try again.'
        );
      }
      throw new Error(
        lang === 'am'
          ? '⚠️ ግንኙነት አልተሳካም። እባክዎ እንደገና ይሞክሩ።'
          : '⚠️ Connection failed. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    authService.clearSession();
    localStorage.removeItem('sonic_auth_token');
    localStorage.removeItem('sonic_user');
    localStorage.removeItem('sonic_live_balance');
    localStorage.removeItem('sonic_live_bonus');
    if (telegramUser?.id) {
      localStorage.setItem(`sonic_explicit_logout_${telegramUser.id}`, 'true');
    }
    localStorage.setItem('sonic_explicit_logout', 'true');
    setUser(null);
    setToken(null);
  };

  const resetPin = async (phone: string, otpCode: string, newPin: string): Promise<boolean> => {
    return await authService.resetPin(phone, otpCode, newPin);
  };

  const updateProfile = async (data: Partial<User>): Promise<User | null> => {
    if (!user) return null;

    try {
      // 1. Send update to Neon DB
      const res = await apiClient.auth.updateProfile({
        phone: data.phone,
        fullName: data.fullName,
        telegramUsername: data.telegramUsername,
        attachedAccounts: data.attachedAccounts
      });

      if (res.success && res.user) {
        const u = res.user;
        const finalPhone = u.phone !== undefined ? u.phone : (data.phone !== undefined ? data.phone : user.phone);
        const updatedUser: User = {
          ...user,
          fullName: u.fullName || data.fullName || user.fullName,
          phone: finalPhone || '',
          nationalPhone: finalPhone ? (finalPhone.startsWith('+251') ? `0${finalPhone.slice(4)}` : (finalPhone.startsWith('0') ? finalPhone : `0${finalPhone}`)) : '',
          formattedPhone: finalPhone || '',
          telegramUsername: u.telegramUsername !== undefined ? u.telegramUsername : (data.telegramUsername || user.telegramUsername),
          attachedAccounts: u.attachedAccounts !== undefined ? u.attachedAccounts : (data.attachedAccounts || user.attachedAccounts || []),
          isPhoneVerified: !!finalPhone
        };
        setUser(updatedUser);
        localStorage.setItem('sonic_user', JSON.stringify(updatedUser));
        if (updatedUser.attachedAccounts) {
          localStorage.setItem('betika_attached_payout_accounts', JSON.stringify(updatedUser.attachedAccounts));
        }
        return updatedUser;
      }
    } catch (err) {
      console.warn('⚠️ Backend updateProfile error, applying optimistic local fallback:', err);
    }

    // Optimistic fallback
    const rawPhone = data.phone !== undefined ? data.phone : user.phone;
    const fallbackUser: User = {
      ...user,
      ...data,
      phone: rawPhone || '',
      nationalPhone: rawPhone ? (rawPhone.startsWith('+251') ? `0${rawPhone.slice(4)}` : (rawPhone.startsWith('0') ? rawPhone : `0${rawPhone}`)) : user.nationalPhone,
      formattedPhone: rawPhone || user.formattedPhone,
      isPhoneVerified: !!rawPhone
    };
    setUser(fallbackUser);
    localStorage.setItem('sonic_user', JSON.stringify(fallbackUser));
    if (fallbackUser.attachedAccounts) {
      localStorage.setItem('betika_attached_payout_accounts', JSON.stringify(fallbackUser.attachedAccounts));
    }
    return fallbackUser;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        isInsideTelegram,
        telegramUser,
        isFirstTimeTelegramUser,
        dismissFirstTimeModal,
        concurrentSessionNotice,
        dismissConcurrentSessionNotice,
        reclaimSessionOnThisDevice,
        sendOtp,
        verifyOtp,
        register,
        login,
        loginWithPhone: (phone: string, pin: string) => login({ phone, pin }),
        loginWithTelegram,
        logout,
        resetPin,
        updateProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
