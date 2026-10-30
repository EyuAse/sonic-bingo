import { query, withTransaction } from '../db.ts';
import { io } from '../io.ts';

export interface CoinBalanceSummary {
  balance: number;
  lifetimeEarned: number;
  lifetimeRedeemed: number;
}

export interface CoinTransactionRecord {
  id: string;
  userId: string;
  amount: number;
  type: 'earned_deposit' | 'redeemed_bonus' | 'admin_adjustment';
  balanceAfter: number;
  referenceId?: string;
  description?: string;
  createdAt: string;
}

export class CoinService {
  private static instance: CoinService;

  public static getInstance(): CoinService {
    if (!CoinService.instance) {
      CoinService.instance = new CoinService();
    }
    return CoinService.instance;
  }

  /**
   * Award Coins on Approved Deposit
   * Rate: 1.5 coins per 1 ETB eligible deposit (e.g. 50 ETB -> 75 coins)
   */
  public async awardCoinsForDeposit(
    userId: string,
    depositAmount: number,
    transactionRef?: string,
    dbClient?: any
  ): Promise<{ coinsAwarded: number; newBalance: number }> {
    const coinsAwarded = Math.floor(depositAmount * 1.5);
    if (coinsAwarded <= 0) {
      return { coinsAwarded: 0, newBalance: 0 };
    }

    const runner = dbClient || { query };

    // Upsert coin wallet
    const walletRes = await runner.query(
      `INSERT INTO coin_wallets (user_id, balance, lifetime_earned, lifetime_redeemed, updated_at)
       VALUES ($1, $2, $2, 0, NOW())
       ON CONFLICT (user_id) DO UPDATE 
       SET balance = coin_wallets.balance + EXCLUDED.balance,
           lifetime_earned = coin_wallets.lifetime_earned + EXCLUDED.balance,
           updated_at = NOW()
       RETURNING balance`,
      [userId, coinsAwarded]
    );

    const newBalance = parseInt(walletRes.rows[0]?.balance || '0', 10);

    // Record ledger entry in coin_transactions
    await runner.query(
      `INSERT INTO coin_transactions (user_id, amount, type, balance_after, reference_id, description)
       VALUES ($1, $2, 'earned_deposit', $3, $4, $5)`,
      [
        userId,
        coinsAwarded,
        newBalance,
        transactionRef || null,
        `Earned ${coinsAwarded} coins from ${depositAmount.toFixed(2)} ETB deposit (1.5x rate)`
      ]
    );

    // Emit live WebSocket notification
    io.emit(`user_${userId}_coins`, {
      type: 'coins_earned',
      amount: coinsAwarded,
      newBalance
    });
    io.emit('user_coins_updated', {
      userId,
      coinsEarned: coinsAwarded,
      newBalance
    });

    console.log(`🪙 [CoinService] Awarded ${coinsAwarded} coins to user ${userId} for ${depositAmount} ETB deposit (Balance: ${newBalance})`);
    return { coinsAwarded, newBalance };
  }

  /**
   * Redeem Coins for Game Bonus Balance
   * Rate: 1,000 coins = 10.00 ETB Bonus
   * Must be redeemed in multiples of 1,000 coins (1000, 2000, 3000, etc.)
   */
  public async redeemCoinsForBonus(
    userId: string,
    coinsToRedeem: number = 1000
  ): Promise<{
    success: boolean;
    error?: string;
    coinsRedeemed?: number;
    bonusAwarded?: number;
    newCoinBalance?: number;
    newBonusBalance?: number;
  }> {
    if (coinsToRedeem < 1000 || coinsToRedeem % 1000 !== 0) {
      return {
        success: false,
        error: 'Coins must be redeemed in increments of 1,000 (1,000 coins = 10 ETB)'
      };
    }

    const bonusAmount = (coinsToRedeem / 1000) * 10.00;

    try {
      const result = await withTransaction(async (client) => {
        // 1. Lock coin wallet row and check balance
        const coinWalletRes = await client.query(
          'SELECT balance FROM coin_wallets WHERE user_id = $1 FOR UPDATE',
          [userId]
        );

        if (coinWalletRes.rows.length === 0) {
          throw new Error('Coin wallet not found');
        }

        const currentCoins = parseInt(coinWalletRes.rows[0].balance || '0', 10);
        if (currentCoins < coinsToRedeem) {
          throw new Error(`Insufficient coins. You have ${currentCoins} coins, but need ${coinsToRedeem}`);
        }

        // 2. Deduct coins
        const updatedCoinsRes = await client.query(
          `UPDATE coin_wallets 
           SET balance = balance - $1, 
               lifetime_redeemed = lifetime_redeemed + $1, 
               updated_at = NOW() 
           WHERE user_id = $2 
           RETURNING balance`,
          [coinsToRedeem, userId]
        );
        const newCoinBalance = parseInt(updatedCoinsRes.rows[0].balance, 10);

        // 3. Credit user's BONUS wallet
        const updatedWalletRes = await client.query(
          `UPDATE wallets 
           SET bonus = bonus + $1, updated_at = NOW() 
           WHERE user_id = $2 
           RETURNING balance, bonus`,
          [bonusAmount, userId]
        );
        const newBonusBalance = parseFloat(updatedWalletRes.rows[0].bonus);
        const realBalance = parseFloat(updatedWalletRes.rows[0].balance);

        const refCode = `COIN-RED-${Date.now().toString().slice(-6)}`;

        // 4. Log to coin_transactions
        await client.query(
          `INSERT INTO coin_transactions (user_id, amount, type, balance_after, reference_id, description)
           VALUES ($1, $2, 'redeemed_bonus', $3, $4, $5)`,
          [
            userId,
            -coinsToRedeem,
            newCoinBalance,
            refCode,
            `Redeemed ${coinsToRedeem} coins for ${bonusAmount.toFixed(2)} ETB Bonus`
          ]
        );

        // 5. Log to wallet_transactions
        await client.query(
          `INSERT INTO wallet_transactions (user_id, type, amount, balance_after, reference_code, status, payment_method, description)
           VALUES ($1, 'bonus', $2, $3, $4, 'completed', 'coin_reward', $5)`,
          [
            userId,
            bonusAmount,
            realBalance + newBonusBalance,
            refCode,
            `Coin Reward: Exchanged ${coinsToRedeem} coins for ${bonusAmount.toFixed(2)} ETB game play bonus`
          ]
        );

        return {
          coinsRedeemed: coinsToRedeem,
          bonusAwarded: bonusAmount,
          newCoinBalance,
          newBonusBalance,
          newTotalBalance: realBalance + newBonusBalance
        };
      });

      // Emit live balance & coin notifications
      io.emit(`user_${userId}_balance`, {
        type: 'bonus_reward',
        bonus: result.newBonusBalance,
        newBalance: result.newTotalBalance
      });
      io.emit(`user_${userId}_coins`, {
        type: 'coins_redeemed',
        amount: coinsToRedeem,
        newBalance: result.newCoinBalance
      });
      io.emit('user_balance_updated', { userId });
      io.emit('user_coins_updated', { userId, newBalance: result.newCoinBalance });

      console.log(`🎉 [CoinService] User ${userId} successfully redeemed ${coinsToRedeem} coins for ${bonusAmount} ETB bonus!`);

      return {
        success: true,
        coinsRedeemed: result.coinsRedeemed,
        bonusAwarded: result.bonusAwarded,
        newCoinBalance: result.newCoinBalance,
        newBonusBalance: result.newBonusBalance
      };
    } catch (err: any) {
      console.error(`❌ [CoinService Error redeeming coins for user ${userId}]:`, err);
      return {
        success: false,
        error: err.message || 'Failed to redeem coins'
      };
    }
  }

  /**
   * Get User Coin Summary & History
   */
  public async getUserCoins(userId: string): Promise<{
    balance: number;
    lifetimeEarned: number;
    lifetimeRedeemed: number;
    transactions: CoinTransactionRecord[];
  }> {
    const [walletRes, txRes] = await Promise.all([
      query('SELECT balance, lifetime_earned, lifetime_redeemed FROM coin_wallets WHERE user_id = $1', [userId]),
      query(
        `SELECT id, user_id as "userId", amount, type, balance_after as "balanceAfter", reference_id as "referenceId", description, created_at as "createdAt"
         FROM coin_transactions 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT 50`,
        [userId]
      )
    ]);

    const w = walletRes.rows[0];
    return {
      balance: w ? parseInt(w.balance || '0', 10) : 0,
      lifetimeEarned: w ? parseInt(w.lifetime_earned || '0', 10) : 0,
      lifetimeRedeemed: w ? parseInt(w.lifetime_redeemed || '0', 10) : 0,
      transactions: txRes.rows
    };
  }

  /**
   * Admin Manual Coin Adjustment
   */
  public async adminAdjustCoins(
    userId: string,
    amount: number,
    description: string
  ): Promise<{ success: boolean; newBalance: number }> {
    return withTransaction(async (client) => {
      const walletRes = await client.query(
        `INSERT INTO coin_wallets (user_id, balance, lifetime_earned, lifetime_redeemed, updated_at)
         VALUES ($1, GREATEST(0, $2), GREATEST(0, $2), 0, NOW())
         ON CONFLICT (user_id) DO UPDATE 
         SET balance = GREATEST(0, coin_wallets.balance + EXCLUDED.balance),
             lifetime_earned = coin_wallets.lifetime_earned + (CASE WHEN EXCLUDED.balance > 0 THEN EXCLUDED.balance ELSE 0 END),
             updated_at = NOW()
         RETURNING balance`,
        [userId, amount]
      );

      const newBalance = parseInt(walletRes.rows[0].balance, 10);

      await client.query(
        `INSERT INTO coin_transactions (user_id, amount, type, balance_after, description)
         VALUES ($1, $2, 'admin_adjustment', $3, $4)`,
        [userId, amount, newBalance, description]
      );

      io.emit(`user_${userId}_coins`, { type: 'coins_adjusted', amount, newBalance });
      io.emit('user_coins_updated', { userId, newBalance });

      return { success: true, newBalance };
    });
  }
}

export const coinService = CoinService.getInstance();
