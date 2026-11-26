import { registerInternalEmitListener } from '../io.ts';
import { query, withTransaction } from '../db.ts';
import { triggerDepositCommission, triggerRegistrationCommission } from './affiliateCommissionService.ts';

let observerRegistered = false;
let tgPendingTableReady = false;
const RECENT_SIGNUP_TTL_MS = 10 * 60 * 1000;
const recentVerifiedNewSignups = new Map<string, number>();

function normalizeEthiopianPhone(raw: string): string {
  const clean = String(raw || '').trim().replace(/^\+?251/, '0').replace(/[\s\-()]/g, '');
  if (!clean) return '';
  return clean.startsWith('0') ? clean : `0${clean}`;
}

async function ensureAffiliateTgPendingTable(): Promise<void> {
  if (tgPendingTableReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS affiliate_tg_pending (
      telegram_id BIGINT PRIMARY KEY,
      affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);
  tgPendingTableReady = true;
}

/**
 * Records a first-touch pending affiliate referral on /start aff_<CODE> strictly when the
 * Telegram user does NOT yet exist in `users` (zero users-table pollution, zero poaching).
 */
export async function recordPendingTelegramAffiliate(
  telegramId: string | number,
  rawAffCode: string
): Promise<boolean> {
  const tgId = Number(telegramId);
  if (!Number.isFinite(tgId) || tgId <= 0) return false;

  const normalizedCode = String(rawAffCode || '').trim().replace(/^aff[_-]?/i, '').trim().toUpperCase();
  if (!normalizedCode) return false;

  try {
    await ensureAffiliateTgPendingTable();

    const affRes = await query(
      `SELECT id FROM affiliates
       WHERE UPPER(affiliate_code) = $1 AND status = 'active' AND approval_status = 'approved'
       LIMIT 1`,
      [normalizedCode]
    );
    if (affRes.rows.length === 0) return false;
    const affiliateId = affRes.rows[0].id;

    // Never poach or record pending attribution for users who already exist
    const existingUserRes = await query(
      `SELECT id FROM users WHERE telegram_id = $1 LIMIT 1`,
      [tgId]
    );
    if (existingUserRes.rows.length > 0) return false;

    await query(
      `INSERT INTO affiliate_tg_pending (telegram_id, affiliate_id)
       VALUES ($1, $2)
       ON CONFLICT (telegram_id) DO NOTHING`,
      [tgId, affiliateId]
    );
    return true;
  } catch (err: any) {
    console.warn('⚠️ [Affiliate TG Pending Record Error]:', err?.message || err);
    return false;
  }
}

/**
 * Atomically consumes a pending Telegram /start referral once a new player verifies their phone
 * (or registers via Mini App fallback), blocking duplicate phones, self-referrals, and existing accounts.
 */
export async function attributeVerifiedTelegramUserFromPending(params: {
  userId: string;
  telegramId?: string | number | null;
  verifiedPhone?: string | null;
  wasNewRegistration: boolean;
}): Promise<boolean> {
  const { userId, wasNewRegistration } = params;
  if (!userId) return false;

  try {
    await ensureAffiliateTgPendingTable();

    const txResult = await withTransaction(async (client) => {
      const userRes = await client.query(
        `SELECT id, telegram_id, phone, affiliate_id,
                (last_login_at > created_at + INTERVAL '2 seconds') AS has_repeat_login
         FROM users WHERE id = $1 FOR UPDATE`,
        [userId]
      );
      if (userRes.rows.length === 0) return null;

      const u = userRes.rows[0];
      const tgId = params.telegramId ?? u.telegram_id;
      if (!tgId) return null;

      // Consume pending entry atomically (single-use)
      const pendingRes = await client.query(
        `DELETE FROM affiliate_tg_pending WHERE telegram_id = $1 RETURNING affiliate_id`,
        [tgId]
      );
      if (pendingRes.rows.length === 0) return null;

      if (!wasNewRegistration || u.affiliate_id || u.has_repeat_login) {
        return null;
      }

      const affiliateId = pendingRes.rows[0].affiliate_id;
      const affRes = await client.query(
        `SELECT id, phone, status, approval_status FROM affiliates WHERE id = $1 LIMIT 1`,
        [affiliateId]
      );
      if (affRes.rows.length === 0) return null;
      const aff = affRes.rows[0];
      if (aff.status !== 'active' || aff.approval_status !== 'approved') {
        return null;
      }

      const normPlayerPhone = normalizeEthiopianPhone(params.verifiedPhone || u.phone || '');
      const normAffPhone = normalizeEthiopianPhone(aff.phone || '');
      if (normPlayerPhone && normAffPhone && normPlayerPhone === normAffPhone) {
        return null; // Self-referral blocked
      }

      if (normPlayerPhone) {
        const altPhone = normPlayerPhone.startsWith('0') ? `+251${normPlayerPhone.slice(1)}` : normPlayerPhone;
        const dupPhoneRes = await client.query(
          `SELECT 1 FROM users WHERE id <> $1 AND phone IN ($2, $3) LIMIT 1`,
          [userId, normPlayerPhone, altPhone]
        );
        if (dupPhoneRes.rows.length > 0) {
          return null; // Phone already belongs to another player
        }
      }

      const historyRes = await client.query(
        `SELECT
           EXISTS(SELECT 1 FROM deposit_requests WHERE user_id = $1) AS has_deposits,
           EXISTS(SELECT 1 FROM game_tickets WHERE user_id = $1) AS has_tickets,
           EXISTS(SELECT 1 FROM wallet_transactions WHERE user_id = $1 AND type <> 'bonus') AS has_non_bonus_tx`,
        [userId]
      );
      const history = historyRes.rows[0];
      if (history?.has_deposits || history?.has_tickets || history?.has_non_bonus_tx) {
        return null;
      }

      const updateRes = await client.query(
        `UPDATE users SET affiliate_id = $1 WHERE id = $2 AND affiliate_id IS NULL RETURNING id`,
        [affiliateId, userId]
      );
      if (updateRes.rowCount === 0) return null;

      return { affiliateId };
    });

    if (txResult?.affiliateId) {
      await triggerRegistrationCommission(userId, txResult.affiliateId);
      return true;
    }
    return false;
  } catch (err: any) {
    console.warn('⚠️ [Affiliate TG Pending Attribution Error]:', err?.message || err);
    return false;
  }
}

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
        // Path B fallback: if a user registered via Mini App Menu Button after /start aff_..., consume pending attribution
        attributeVerifiedTelegramUserFromPending({
          userId: newUserId,
          verifiedPhone: typeof payload.phone === 'string' ? payload.phone : null,
          wasNewRegistration: true
        }).catch(() => {});
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
