import { registerInternalEmitListener } from '../io.ts';
import { triggerDepositCommission } from './affiliateCommissionService.ts';

let observerRegistered = false;
const RECENT_SIGNUP_TTL_MS = 10 * 60 * 1000;
const recentVerifiedNewSignups = new Map<string, number>();

export function recordVerifiedNewSignup(userId: string): void {
  if (!userId) return;
  const now = Date.now();
  recentVerifiedNewSignups.set(userId, now);
  if (recentVerifiedNewSignups.size > 500) {
    for (const [id, ts] of recentVerifiedNewSignups.entries()) {
      if (now - ts > RECENT_SIGNUP_TTL_MS) {
        recentVerifiedNewSignups.delete(id);
      }
    }
  }
}

/**
 * Consumes a server-verified brand-new signup marker recorded when auth.ts emits `admin_new_user`.
 */
export function consumeVerifiedNewSignup(userId: string): boolean {
  if (!userId) return false;
  const ts = recentVerifiedNewSignups.get(userId);
  if (!ts) return false;
  recentVerifiedNewSignups.delete(userId);
  return Date.now() - ts <= RECENT_SIGNUP_TTL_MS;
}

/**
 * Passively listens to already-existing post-commit deposit & new-user Socket.IO events
 * so Affiliate commissions & signup-only verification run automatically
 * with ZERO edits to Auth, Admin, Cashier Agent, Telebirr Auto-Approve, or Wallet routes.
 */
export function registerAffiliateEventObserver() {
  if (observerRegistered) return;
  observerRegistered = true;

  registerInternalEmitListener((eventName: string, payload: any) => {
    if (!payload || typeof payload !== 'object') return;

    // 0. Verified brand-new account creation (`admin_new_user` emitted strictly on INSERT in auth.ts)
    if (eventName === 'admin_new_user') {
      const newUserId = typeof payload.id === 'string' ? payload.id : '';
      if (newUserId) {
        recordVerifiedNewSignup(newUserId);
      }
      return;
    }

    // 1. Direct & Agent Telebirr Auto-Approval event (`deposit_approved`)
    if (eventName === 'deposit_approved') {
      const userId = typeof payload.userId === 'string' ? payload.userId : '';
      const amount = Number(payload.amount || 0);
      const txRef = typeof payload.txRef === 'string' ? payload.txRef : undefined;
      if (userId && amount > 0) {
        triggerDepositCommission(userId, amount, txRef).catch((err) => {
          console.warn('⚠️ [Affiliate Observer deposit_approved error]:', err?.message || err);
        });
      }
      return;
    }

    // 2. Manual Admin & Agent Deposit Approval event (`user_<uuid>_deposit_approved`)
    const userDepositMatch = /^user_([0-9a-fA-F-]+)_deposit_approved$/.exec(eventName);
    if (userDepositMatch) {
      const userId = userDepositMatch[1];
      const amount = Number(payload.amount || 0);
      const txRef =
        typeof payload.transactionCode === 'string'
          ? payload.transactionCode
          : typeof payload.requestId === 'string'
            ? payload.requestId
            : undefined;
      if (userId && amount > 0) {
        triggerDepositCommission(userId, amount, txRef).catch((err) => {
          console.warn('⚠️ [Affiliate Observer user_*_deposit_approved error]:', err?.message || err);
        });
      }
    }
  });

  console.log('👂 [Affiliate Event Observer] Zero-touch post-commit deposit listener active');
}
