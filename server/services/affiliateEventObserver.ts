import { registerInternalEmitListener } from '../io.ts';
import { triggerDepositCommission } from './affiliateCommissionService.ts';

let observerRegistered = false;

/**
 * Passively listens to already-existing post-commit deposit Socket.IO events
 * so Affiliate First-Deposit & Regular-Deposit commissions run automatically
 * with ZERO edits to Admin, Cashier Agent, Telebirr Auto-Approve, or Wallet routes.
 */
export function registerAffiliateEventObserver() {
  if (observerRegistered) return;
  observerRegistered = true;

  registerInternalEmitListener((eventName: string, payload: any) => {
    if (!payload || typeof payload !== 'object') return;

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
