export type EthiopianCarrier = 'ethiotelecom' | 'safaricom';

export interface AttachedAccount {
  id: string;
  type: 'Telebirr' | 'CBE';
  name: string;
  accountNumber: string;
  isDefault: boolean;
  isVerified: boolean;
}

export interface User {
  id: string;
  telegramId?: number;
  phone: string;              // Canonical e.g. "+251911234567"
  nationalPhone: string;      // National e.g. "0911234567"
  formattedPhone: string;     // Display e.g. "+251 91 123 4567"
  carrier: EthiopianCarrier;
  fullName: string;
  telegramUsername?: string;
  photoUrl?: string;
  avatar?: string;
  pin?: string;
  isPhoneVerified: boolean;
  role: 'player' | 'admin';
  status?: 'active' | 'suspended' | 'under_review';
  suspendReason?: string;
  referralCode?: string;
  attachedAccounts?: AttachedAccount[];
  createdAt: string;
  lastLogin: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface RegisterPayload {
  phone: string;
  fullName: string;
  pin: string;
  referralCode?: string;
  otpCode: string;
}

export interface LoginPayload {
  phone: string;
  pin: string;
  rememberMe?: boolean;
}

export interface OtpChallengeResponse {
  success: boolean;
  message: string;
  phone: string;
  devCode?: string;
  expiresInSeconds: number;
}

export interface OtpVerificationResult {
  valid: boolean;
  message: string;
}
