import { User, RegisterPayload, LoginPayload, OtpChallengeResponse, OtpVerificationResult } from '../types/auth';
import { validateEthiopianPhone } from './ethiopianPhoneValidator';
import { smsGateway } from './smsGatewayAdapter';

const USERS_STORAGE_KEY = 'sonic_registered_users_v5';
const SESSION_STORAGE_KEY = 'sonic_auth_session_v5';
const OTP_STORAGE_KEY = 'sonic_active_otps_v5';

interface StoredUser extends User {
  pin: string;
}

interface StoredOtp {
  phone: string;
  code: string;
  validCodes: string[];
  expiresAt: number;
  lastSentAt: number;
  attempts: number;
}

// Zero pre-existing demo users for clean production launch
const INITIAL_DEMO_USERS: StoredUser[] = [];

class AuthService {
  private static instance: AuthService;
  private memoryUsers: StoredUser[] = [];
  private memoryOtps: Record<string, StoredOtp> = {};
  private memorySession: { user: User; token: string } | null = null;

  private constructor() {
    this.ensureInitialized();
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  private ensureInitialized() {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    try {
      // Purge all legacy test data
      const legacyKeys = [
        'sonic_registered_users',
        'sonic_registered_users_v2',
        'sonic_registered_users_v3',
        'sonic_registered_users_v4',
        'sonic_auth_session',
        'sonic_auth_session_v2',
        'sonic_auth_session_v3',
        'sonic_auth_session_v4',
        'sonic_active_otps',
        'sonic_active_otps_v2',
        'sonic_active_otps_v3',
        'sonic_active_otps_v4',
        'sonic_explicit_logout'
      ];
      legacyKeys.forEach(k => localStorage.removeItem(k));

      const existing = localStorage.getItem(USERS_STORAGE_KEY);
      if (!existing) {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify([]));
      }
    } catch {}
  }

  private getStoredUsers(): StoredUser[] {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return this.memoryUsers;
    }
    try {
      const data = localStorage.getItem(USERS_STORAGE_KEY);
      return data ? JSON.parse(data) : this.memoryUsers;
    } catch {
      return this.memoryUsers;
    }
  }

  private saveStoredUsers(users: StoredUser[]) {
    this.memoryUsers = users;
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    } catch {}
  }

  private getActiveOtps(): Record<string, StoredOtp> {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return this.memoryOtps;
    }
    try {
      const data = localStorage.getItem(OTP_STORAGE_KEY);
      return data ? JSON.parse(data) : this.memoryOtps;
    } catch {
      return this.memoryOtps;
    }
  }

  private saveActiveOtps(otps: Record<string, StoredOtp>) {
    this.memoryOtps = otps;
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(OTP_STORAGE_KEY, JSON.stringify(otps));
    } catch {}
  }

  /**
   * Request OTP verification code via AfroMessage SMS
   */
  public async requestOtp(phoneInput: string, lang: 'en' | 'am' = 'am'): Promise<OtpChallengeResponse> {
    const validation = validateEthiopianPhone(phoneInput);
    if (!validation.isValid) {
      throw new Error(validation.errorMessage || 'Invalid Ethiopian phone number.');
    }

    const canonicalPhone = validation.canonicalNumber;
    const now = Date.now();
    const otps = this.getActiveOtps();
    const existingOtp = otps[canonicalPhone];

    // Rate-limiting check: 60-second cooldown between resends
    if (existingOtp && now - existingOtp.lastSentAt < 60000) {
      const remainingSeconds = Math.ceil((60000 - (now - existingOtp.lastSentAt)) / 1000);
      throw new Error(
        lang === 'am'
          ? `እባክዎ እንደገና ከመሞከርዎ በፊት ${remainingSeconds} ሰከንድ ይጠብቁ።`
          : `Please wait ${remainingSeconds}s before requesting a new code.`
      );
    }

    // Generate secure 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = now + 5 * 60 * 1000; // 5 minutes TTL

    const previousCodes = existingOtp?.validCodes || (existingOtp?.code ? [existingOtp.code] : []);
    const updatedCodes = Array.from(new Set([code, ...previousCodes])).slice(0, 5);

    otps[canonicalPhone] = {
      phone: canonicalPhone,
      code,
      validCodes: updatedCodes,
      expiresAt,
      lastSentAt: now,
      attempts: 0
    };
    this.saveActiveOtps(otps);

    // Send via AfroMessage SMS Gateway
    const smsResult = await smsGateway.sendOtpSms(canonicalPhone, code, lang);

    console.log(`📱 OTP generated for ${canonicalPhone}: [${code}] (Delivery: ${smsResult.deliveredViaSms ? 'REAL SMS SENT' : smsResult.error})`);

    let message = '';
    if (smsResult.deliveredViaSms) {
      message =
        lang === 'am'
          ? `የማረጋገጫ ኮድ ወደ ${validation.formattedDisplay} በSMS ተልኳል!`
          : `Real SMS verification code sent to ${validation.formattedDisplay}!`;
    } else if (smsResult.unverifiedContact) {
      message =
        lang === 'am'
          ? `በAfroMessage Dashboard ላይ 'Verify phone' የሚለውን በመጫን ቁጥርዎን ያረጋግጡ።`
          : `Please click 'Verify phone' for ${validation.canonicalNumber} on your AfroMessage Dashboard.`;
    } else {
      message =
        lang === 'am'
          ? `የማረጋገጫ ኮድ ወደ ${validation.formattedDisplay} ተዘጋጅቷል።`
          : `Verification code generated for ${validation.formattedDisplay}.`;
    }

    return {
      success: true,
      phone: canonicalPhone,
      message,
      devCode: code,
      expiresInSeconds: 300
    };
  }

  /**
   * Verify an entered OTP code
   */
  public verifyOtp(phoneInput: string, code: string): OtpVerificationResult {
    const validation = validateEthiopianPhone(phoneInput);
    if (!validation.isValid) {
      return { valid: false, message: 'Invalid phone number format.' };
    }

    const canonicalPhone = validation.canonicalNumber;
    const cleanCode = code.trim();
    const otps = this.getActiveOtps();
    const stored = otps[canonicalPhone];

    if (!stored) {
      return { valid: false, message: 'No active verification code found. Please request a new code.' };
    }

    if (Date.now() > stored.expiresAt) {
      delete otps[canonicalPhone];
      this.saveActiveOtps(otps);
      return { valid: false, message: 'Verification code has expired. Please request a new one.' };
    }

    stored.attempts += 1;
    if (stored.attempts > 10) {
      delete otps[canonicalPhone];
      this.saveActiveOtps(otps);
      return { valid: false, message: 'Too many incorrect attempts. Please request a new code.' };
    }

    const validList = stored.validCodes || [stored.code];
    const isMatch = validList.includes(cleanCode) || stored.code === cleanCode;

    if (!isMatch) {
      this.saveActiveOtps(otps);
      return { valid: false, message: 'Incorrect 6-digit verification code. Please check your SMS.' };
    }

    // Success: consume OTP
    delete otps[canonicalPhone];
    this.saveActiveOtps(otps);

    return { valid: true, message: 'Phone number successfully verified!' };
  }

  /**
   * Check if a Telegram user already has an account
   */
  public checkTelegramUserExists(tgId: number, username?: string): StoredUser | null {
    const users = this.getStoredUsers();
    const tgUsername = username ? username.replace(/^@/, '') : `tg_${tgId}`;
    return (
      users.find(
        u => u.telegramUsername === tgUsername || u.id === `UID-TG-${tgId}`
      ) || null
    );
  }

  /**
   * 1-Click Login / Register with Telegram WebApp Account & Phone Number
   */
  public async loginWithTelegram(
    tgUser: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
    },
    customPhone?: string
  ): Promise<{ user: User; token: string; isNewUser: boolean }> {
    const users = this.getStoredUsers();
    const tgUsername = tgUser.username ? tgUser.username.replace(/^@/, '') : `tg_${tgUser.id}`;
    const fullName = `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim() || tgUsername;

    // Check if user already exists by telegram username or telegram ID pattern
    let user = users.find(
      u => u.telegramUsername === tgUsername || u.id === `UID-TG-${tgUser.id}`
    );

    let isNewUser = false;
    if (!user) {
      isNewUser = true;
      let finalPhone = customPhone || '';
      const validation = finalPhone ? validateEthiopianPhone(finalPhone) : null;

      const newUser: StoredUser = {
        id: `UID-TG-${tgUser.id}`,
        phone: validation?.canonicalNumber || '',
        nationalPhone: validation?.nationalNumber || '',
        formattedPhone: validation?.formattedDisplay || '',
        carrier: validation?.carrier || 'ethiotelecom',
        fullName: fullName,
        telegramUsername: tgUsername,
        isPhoneVerified: !!validation?.isValid,
        role: 'player',
        pin: '1234',
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString()
      };
      users.push(newUser);
      this.saveStoredUsers(users);
      user = newUser;
    } else {
      user.lastLogin = new Date().toISOString();
      if (fullName && (user.fullName === 'Sonic Player' || user.fullName.startsWith('tg_'))) {
        user.fullName = fullName;
      }
      if (customPhone) {
        const validation = validateEthiopianPhone(customPhone);
        if (validation.isValid) {
          user.phone = validation.canonicalNumber;
          user.nationalPhone = validation.nationalNumber;
          user.formattedPhone = validation.formattedDisplay;
          user.carrier = validation.carrier || user.carrier;
        }
      }
      this.saveStoredUsers(users);
    }

    const token = `lomi_tg_jwt_${Date.now()}_${user.id}`;
    const safeUser: User = {
      id: user.id,
      phone: user.phone,
      nationalPhone: user.nationalPhone,
      formattedPhone: user.formattedPhone,
      carrier: user.carrier,
      fullName: user.fullName,
      telegramUsername: user.telegramUsername,
      isPhoneVerified: user.isPhoneVerified,
      role: user.role,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin
    };

    this.saveSession(safeUser, token);
    return { user: safeUser, token, isNewUser };
  }

  /**
   * Register a new Ethiopian user
   */
  public async register(payload: RegisterPayload): Promise<{ user: User; token: string }> {
    const validation = validateEthiopianPhone(payload.phone);
    if (!validation.isValid) {
      throw new Error(validation.errorMessage || 'Invalid Ethiopian phone number.');
    }

    if (!payload.fullName || payload.fullName.trim().length < 2) {
      throw new Error('Please enter your full name.');
    }

    if (!payload.pin || payload.pin.length < 4 || payload.pin.length > 8) {
      throw new Error('PIN / Password must be between 4 and 8 digits.');
    }

    const users = this.getStoredUsers();
    const existing = users.find(u => u.phone === validation.canonicalNumber);
    if (existing) {
      throw new Error('An account with this phone number already exists. Please log in.');
    }

    const newUser: StoredUser = {
      id: `UID-${Math.floor(1000000 + Math.random() * 9000000)}`,
      phone: validation.canonicalNumber,
      nationalPhone: validation.nationalNumber,
      formattedPhone: validation.formattedDisplay,
      carrier: validation.carrier || 'ethiotelecom',
      fullName: payload.fullName.trim(),
      isPhoneVerified: true,
      role: 'player',
      pin: payload.pin,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    };

    users.push(newUser);
    this.saveStoredUsers(users);

    const token = `lomi_jwt_${Date.now()}_${newUser.id}`;
    const safeUser: User = {
      id: newUser.id,
      phone: newUser.phone,
      nationalPhone: newUser.nationalPhone,
      formattedPhone: newUser.formattedPhone,
      carrier: newUser.carrier,
      fullName: newUser.fullName,
      telegramUsername: newUser.telegramUsername,
      isPhoneVerified: newUser.isPhoneVerified,
      role: newUser.role,
      createdAt: newUser.createdAt,
      lastLogin: newUser.lastLogin
    };

    this.saveSession(safeUser, token);
    return { user: safeUser, token };
  }

  /**
   * Login with Ethiopian phone and PIN
   */
  public async login(payload: LoginPayload): Promise<{ user: User; token: string }> {
    const validation = validateEthiopianPhone(payload.phone);
    if (!validation.isValid) {
      throw new Error(validation.errorMessage || 'Please enter a valid Ethiopian phone number.');
    }

    if (!payload.pin) {
      throw new Error('Please enter your PIN / Password.');
    }

    const users = this.getStoredUsers();
    const user = users.find(u => u.phone === validation.canonicalNumber);

    if (!user) {
      throw new Error('No account found for this phone number. Please create an account.');
    }

    if (user.pin !== payload.pin) {
      throw new Error('Incorrect PIN / Password. Please check and try again.');
    }

    user.lastLogin = new Date().toISOString();
    this.saveStoredUsers(users);

    const token = `lomi_jwt_${Date.now()}_${user.id}`;
    const safeUser: User = {
      id: user.id,
      phone: user.phone,
      nationalPhone: user.nationalPhone,
      formattedPhone: user.formattedPhone,
      carrier: user.carrier,
      fullName: user.fullName,
      telegramUsername: user.telegramUsername,
      isPhoneVerified: user.isPhoneVerified,
      role: user.role,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin
    };

    this.saveSession(safeUser, token);
    return { user: safeUser, token };
  }

  /**
   * Reset user PIN using verified OTP
   */
  public async resetPin(phoneInput: string, otpCode: string, newPin: string): Promise<boolean> {
    const otpRes = this.verifyOtp(phoneInput, otpCode);
    if (!otpRes.valid) {
      throw new Error(otpRes.message);
    }

    if (!newPin || newPin.length < 4) {
      throw new Error('New PIN must be at least 4 digits.');
    }

    const validation = validateEthiopianPhone(phoneInput);
    const users = this.getStoredUsers();
    const userIndex = users.findIndex(u => u.phone === validation.canonicalNumber);

    if (userIndex === -1) {
      throw new Error('User not found.');
    }

    users[userIndex].pin = newPin;
    this.saveStoredUsers(users);
    return true;
  }

  /**
   * Update User Profile (e.g. name, telegram username)
   */
  public updateProfile(userId: string, data: Partial<User>): User {
    const users = this.getStoredUsers();
    const index = users.findIndex(u => u.id === userId);
    if (index === -1) {
      throw new Error('User not found.');
    }

    const updated = {
      ...users[index],
      ...data
    };
    users[index] = updated;
    this.saveStoredUsers(users);

    const safeUser: User = {
      id: updated.id,
      phone: updated.phone,
      nationalPhone: updated.nationalPhone,
      formattedPhone: updated.formattedPhone,
      carrier: updated.carrier,
      fullName: updated.fullName,
      telegramUsername: updated.telegramUsername,
      isPhoneVerified: updated.isPhoneVerified,
      role: updated.role,
      createdAt: updated.createdAt,
      lastLogin: updated.lastLogin
    };

    const session = this.getSession();
    if (session && session.user.id === userId) {
      this.saveSession(safeUser, session.token);
    }

    return safeUser;
  }

  private saveSession(user: User, token: string) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ user, token }));
  }

  public getSession(): { user: User; token: string } | null {
    if (typeof window === 'undefined') return null;
    try {
      const data = localStorage.getItem(SESSION_STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  public clearSession() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(SESSION_STORAGE_KEY);
  }
}

export const authService = AuthService.getInstance();
