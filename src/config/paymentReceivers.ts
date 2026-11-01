/**
 * Official Betika Bingo Cashier Payment Receivers Configuration
 * Centralized source of truth for deposit accounts and round-robin swapping.
 */

export interface PaymentReceiver {
  id: string;
  provider: 'Telebirr' | 'CBE';
  serviceName: string; // 'Telebirr' or 'CBE Birr'
  accountNumber: string;
  formattedNumber: string;
  accountName: string;
  badge?: string;
}

// 1. Official CBE Birr Receiver
export const CBE_BIRR_RECEIVER: PaymentReceiver = {
  id: 'cbe_birr_yenegeta',
  provider: 'CBE',
  serviceName: 'CBE Birr',
  accountNumber: '0998983344',
  formattedNumber: '09 98 98 33 44',
  accountName: 'Yenegeta atalay',
  badge: 'CBE Birr'
};

// 2. Official Telebirr Swapping Accounts
// Account 1: Abduurehim Sheycho (Presented first)
// Account 2: Mekonen Woldekidane (Presented next)
export const TELEBIRR_RECEIVERS: PaymentReceiver[] = [
  {
    id: 'tb_abduurehim',
    provider: 'Telebirr',
    serviceName: 'Telebirr',
    accountNumber: '0952013863',
    formattedNumber: '09 52 01 38 63',
    accountName: 'Abduurehim Sheycho',
    badge: 'Account 1'
  },
  {
    id: 'tb_mekonen',
    provider: 'Telebirr',
    serviceName: 'Telebirr',
    accountNumber: '0998983344',
    formattedNumber: '09 98 98 33 44',
    accountName: 'Mekonen Woldekidane',
    badge: 'Account 2'
  }
];

const TELEBIRR_SWAP_KEY = 'betika_telebirr_swap_idx';

/**
 * Returns current active Telebirr receiver index (0 or 1).
 */
export function getTelebirrIndex(): number {
  if (typeof window === 'undefined') return 0;
  const val = localStorage.getItem(TELEBIRR_SWAP_KEY);
  const idx = val ? parseInt(val, 10) : 0;
  return isNaN(idx) || idx < 0 ? 0 : idx % TELEBIRR_RECEIVERS.length;
}

/**
 * Returns the currently active Telebirr receiver based on the alternating round-robin index.
 */
export function getCurrentTelebirrReceiver(): PaymentReceiver {
  const idx = getTelebirrIndex();
  return TELEBIRR_RECEIVERS[idx] || TELEBIRR_RECEIVERS[0];
}

/**
 * Rotates to the next Telebirr account in the sequence.
 * Call this on successful deposit submission or next session.
 */
export function rotateTelebirrReceiver(): PaymentReceiver {
  if (typeof window === 'undefined') return TELEBIRR_RECEIVERS[0];
  const nextIdx = (getTelebirrIndex() + 1) % TELEBIRR_RECEIVERS.length;
  localStorage.setItem(TELEBIRR_SWAP_KEY, nextIdx.toString());
  return TELEBIRR_RECEIVERS[nextIdx];
}

/**
 * Manually swaps between Telebirr accounts (e.g., when user taps "Swap Account" button).
 */
export function toggleTelebirrReceiver(): PaymentReceiver {
  return rotateTelebirrReceiver();
}

/**
 * Official Support Telegram Configuration
 */
export const SUPPORT_CONFIG = {
  telegramUsername: 'SonicGameBot',
  telegramHandle: '@SonicGameBot',
  telegramUrl: 'https://t.me/SonicGameBot',
  email: 'support@sonicbingo.com',
  phoneHotline: '+251 911 00 00 00'
};
