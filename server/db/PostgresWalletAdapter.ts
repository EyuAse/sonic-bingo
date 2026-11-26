/**
 * PostgresWalletAdapter.ts
 * Production-Ready ACID Wallet Adapter for Fast Keno
 * Connects directly to Neon Serverless PostgreSQL with row-level locks (FOR UPDATE).
 * 100% Additive: Uses existing wallets & wallet_transactions without altering schema, deposit, or withdrawal flows.
 */

import { withTransaction, query } from '../db.ts';

export interface WalletBalance {
  balance: number;
  bonus: number;
  currency: string;
}

export interface DebitResult {
  success: boolean;
  error?: string;
  balanceAfter: number;
  bonusAfter: number;
  referenceCode: string;
  usedBonus?: boolean;
  realDeducted?: number;
  bonusDeducted?: number;
  alreadyProcessed?: boolean;
}

export interface CreditResult {
  success: boolean;
  error?: string;
  balanceAfter: number;
  referenceCode: string;
}

export interface IWalletAdapter {
  getBalance(userId: string): Promise<WalletBalance>;
  deductBet(
    userId: string,
    amount: number,
    roundId: string,
    isBonus: boolean,
    roundNumber?: number,
    idempotencyKey?: string
  ): Promise<DebitResult>;
  refundBet(
    userId: string,
    realAmount: number,
    bonusAmount: number,
    roundId: string,
    referenceCode: string,
    roundNumber?: number
  ): Promise<CreditResult>;
  creditWin(
    userId: string,
    amount: number,
    roundId: string,
    referenceCode: string,
    roundNumber?: number
  ): Promise<CreditResult>;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class PostgresWalletAdapter implements IWalletAdapter {
  /**
   * Helper to resolve userId: if passed a Telegram ID, maps to users.id UUID.
   */
  public async resolveUserId(userId: string): Promise<string> {
    if (UUID_REGEX.test(userId)) {
      return userId;
    }

    try {
      const userRes = await query<{ id: string }>(
        `SELECT id FROM users WHERE telegram_id::text = $1 LIMIT 1`,
        [userId]
      );
      if (userRes.rows.length > 0) {
        return userRes.rows[0].id;
      }
    } catch {
      // Fallback to input if telegram_id resolution fails
    }

    return userId;
  }

  /**
   * Retrieves live player balance directly from Neon DB.
   */
  async getBalance(userId: string): Promise<WalletBalance> {
    const resolvedId = await this.resolveUserId(userId);

    const res = await query<{ balance: string; bonus: string; currency: string }>(
      `SELECT balance, bonus, currency FROM wallets WHERE user_id = $1`,
      [resolvedId]
    );

    if (res.rows.length === 0) {
      throw new Error(`Wallet not found for user ${userId}`);
    }

    return {
      balance: parseFloat(res.rows[0].balance || '0.00'),
      bonus: parseFloat(res.rows[0].bonus || '0.00'),
      currency: res.rows[0].currency || 'ETB'
    };
  }

  /**
   * Atomically debits bet amount using row-level locking (FOR UPDATE).
   */
  async deductBet(
    userId: string,
    amount: number,
    roundId: string,
    isBonus: boolean,
    roundNumber: number = 0,
    idempotencyKey?: string
  ): Promise<DebitResult> {
    const resolvedId = await this.resolveUserId(userId);
    const parsedAmount = Number(amount.toFixed(2));
    const safeKey = idempotencyKey ? idempotencyKey.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60) : '';

    if (parsedAmount <= 0) {
      return {
        success: false,
        error: 'Bet amount must be greater than 0',
        balanceAfter: 0,
        bonusAfter: 0,
        referenceCode: ''
      };
    }

    return await withTransaction(async (client) => {
      const walletRes = await client.query(
        `SELECT balance, bonus FROM wallets WHERE user_id = $1 FOR UPDATE`,
        [resolvedId]
      );

      if (walletRes.rows.length === 0) {
        return {
          success: false,
          error: `Wallet not found for user ${userId}`,
          balanceAfter: 0,
          bonusAfter: 0,
          referenceCode: ''
        };
      }

      const currentBalance = parseFloat(walletRes.rows[0].balance || '0.00');
      const currentBonus = parseFloat(walletRes.rows[0].bonus || '0.00');

      const roundTag = roundNumber > 0 ? `R${roundNumber}` : roundId.slice(0, 8);
      const ref = safeKey
        ? `KENO_BET_${safeKey}`.slice(0, 95)
        : `KENO_BET_${roundTag}_${Date.now()}_${Math.floor(Math.random() * 1000)}`.slice(0, 95);

      if (safeKey) {
        const existingTx = await client.query(
          `SELECT 1 FROM wallet_transactions WHERE reference_code = $1 LIMIT 1`,
          [ref]
        );
        if (existingTx.rows.length > 0) {
          return {
            success: true,
            alreadyProcessed: true,
            balanceAfter: currentBalance,
            bonusAfter: currentBonus,
            referenceCode: ref,
            realDeducted: 0,
            bonusDeducted: 0
          };
        }
      }

      const totalFunds = Number((currentBalance + currentBonus).toFixed(2));

      if (totalFunds < parsedAmount) {
        return {
          success: false,
          error: `Insufficient funds (${totalFunds.toFixed(2)} < ${parsedAmount.toFixed(2)} ETB)`,
          balanceAfter: currentBalance,
          bonusAfter: currentBonus,
          referenceCode: '',
          usedBonus: false
        };
      }

      const deductFromBonus = Math.min(currentBonus, parsedAmount);
      const deductFromReal = Number((parsedAmount - deductFromBonus).toFixed(2));

      const newBalance = Number((currentBalance - deductFromReal).toFixed(2));
      const newBonus = Number((currentBonus - deductFromBonus).toFixed(2));

      await client.query(
        `UPDATE wallets SET balance = $1, bonus = $2, updated_at = CURRENT_TIMESTAMP WHERE user_id = $3`,
        [newBalance, newBonus, resolvedId]
      );

      const desc = roundNumber > 0
        ? `Fast Keno Round #${roundNumber} Ticket Bet`
        : `Fast Keno Ticket Bet (${roundTag})`;

      await client.query(
        `INSERT INTO wallet_transactions (
          user_id, type, amount, balance_after, reference_code, status, description
        ) VALUES ($1, 'bet', $2, $3, $4, 'completed', $5)`,
        [resolvedId, parsedAmount, Number((newBalance + newBonus).toFixed(2)), ref, desc]
      );

      return {
        success: true,
        balanceAfter: newBalance,
        bonusAfter: newBonus,
        referenceCode: ref,
        usedBonus: deductFromBonus > 0,
        realDeducted: deductFromReal,
        bonusDeducted: deductFromBonus
      };
    });
  }

  /**
   * Atomically refunds an unplayed or interrupted Keno bet back to real cash and bonus wallets.
   * Idempotent via deterministic reference_code so retries never double-refund.
   */
  async refundBet(
    userId: string,
    realAmount: number,
    bonusAmount: number,
    roundId: string,
    referenceCode: string,
    roundNumber: number = 0
  ): Promise<CreditResult> {
    const resolvedId = await this.resolveUserId(userId);
    const parsedReal = Math.max(0, Number((realAmount || 0).toFixed(2)));
    const parsedBonus = Math.max(0, Number((bonusAmount || 0).toFixed(2)));
    const totalRefund = Number((parsedReal + parsedBonus).toFixed(2));

    if (totalRefund <= 0) {
      return {
        success: true,
        balanceAfter: (await this.getBalance(userId)).balance,
        referenceCode
      };
    }

    const roundTag = roundNumber > 0 ? `R${roundNumber}` : roundId.slice(0, 8);
    const cleanRef = String(referenceCode || `${roundTag}_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '');
    const refundRef = (cleanRef.startsWith('KENO_REFUND_') ? cleanRef : `KENO_REFUND_${cleanRef}`).slice(0, 95);

    return await withTransaction(async (client) => {
      const walletRes = await client.query(
        `SELECT balance, bonus FROM wallets WHERE user_id = $1 FOR UPDATE`,
        [resolvedId]
      );

      if (walletRes.rows.length === 0) {
        return {
          success: false,
          error: `Wallet not found for user ${userId}`,
          balanceAfter: 0,
          referenceCode: ''
        };
      }

      const existingRefund = await client.query(
        `SELECT balance_after FROM wallet_transactions WHERE reference_code = $1 LIMIT 1`,
        [refundRef]
      );
      const currentBalance = parseFloat(walletRes.rows[0].balance || '0.00');
      const currentBonus = parseFloat(walletRes.rows[0].bonus || '0.00');

      if (existingRefund.rows.length > 0) {
        return {
          success: true,
          balanceAfter: currentBalance,
          referenceCode: refundRef
        };
      }

      const newBalance = Number((currentBalance + parsedReal).toFixed(2));
      const newBonus = Number((currentBonus + parsedBonus).toFixed(2));

      await client.query(
        `UPDATE wallets SET balance = $1, bonus = $2, updated_at = CURRENT_TIMESTAMP WHERE user_id = $3`,
        [newBalance, newBonus, resolvedId]
      );

      const desc = roundNumber > 0
        ? `Fast Keno Round #${roundNumber} Auto-Refund (Interrupted Round)`
        : `Fast Keno Auto-Refund (${roundTag})`;

      await client.query(
        `INSERT INTO wallet_transactions (
          user_id, type, amount, balance_after, reference_code, status, description
        ) VALUES ($1, 'refund', $2, $3, $4, 'completed', $5)`,
        [resolvedId, totalRefund, Number((newBalance + newBonus).toFixed(2)), refundRef, desc]
      );

      return {
        success: true,
        balanceAfter: newBalance,
        referenceCode: refundRef
      };
    });
  }

  /**
   * Atomically credits winning payout using row-level locking (FOR UPDATE).
   * Deterministic reference_code prevents duplicate payout credits across retries.
   */
  async creditWin(
    userId: string,
    amount: number,
    roundId: string,
    referenceCode: string,
    roundNumber: number = 0
  ): Promise<CreditResult> {
    const resolvedId = await this.resolveUserId(userId);
    const parsedAmount = Number(amount.toFixed(2));

    if (parsedAmount <= 0) {
      return {
        success: true,
        balanceAfter: (await this.getBalance(userId)).balance,
        referenceCode
      };
    }

    const roundTag = roundNumber > 0 ? `R${roundNumber}` : roundId.slice(0, 8);
    const cleanRef = referenceCode ? referenceCode.replace(/[^a-zA-Z0-9_-]/g, '') : '';
    const winRef = cleanRef
      ? (cleanRef.startsWith('KENO_WIN_') ? cleanRef : `KENO_WIN_${cleanRef}`).slice(0, 95)
      : `KENO_WIN_${roundTag}_${Date.now()}`.slice(0, 95);

    return await withTransaction(async (client) => {
      const walletRes = await client.query(
        `SELECT balance FROM wallets WHERE user_id = $1 FOR UPDATE`,
        [resolvedId]
      );

      if (walletRes.rows.length === 0) {
        return {
          success: false,
          error: `Wallet not found for user ${userId}`,
          balanceAfter: 0,
          referenceCode: ''
        };
      }

      const currentBalance = parseFloat(walletRes.rows[0].balance || '0.00');

      const existingWin = await client.query(
        `SELECT balance_after FROM wallet_transactions WHERE reference_code = $1 LIMIT 1`,
        [winRef]
      );
      if (existingWin.rows.length > 0) {
        return {
          success: true,
          balanceAfter: currentBalance,
          referenceCode: winRef
        };
      }

      const newBalance = Number((currentBalance + parsedAmount).toFixed(2));

      await client.query(
        `UPDATE wallets SET balance = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2`,
        [newBalance, resolvedId]
      );

      const desc = roundNumber > 0
        ? `Fast Keno Round #${roundNumber} Winning Payout`
        : `Fast Keno Winning Payout (${roundTag})`;

      await client.query(
        `INSERT INTO wallet_transactions (
          user_id, type, amount, balance_after, reference_code, status, description
        ) VALUES ($1, 'win', $2, $3, $4, 'completed', $5)`,
        [resolvedId, parsedAmount, newBalance, winRef, desc]
      );

      return {
        success: true,
        balanceAfter: newBalance,
        referenceCode: winRef
      };
    });
  }
}

export const postgresWalletAdapter = new PostgresWalletAdapter();
