/**
 * Pluggable Wallet Interface for Atlas-V Fast Keno
 * Enables 100% standalone development with MockWalletAdapter,
 * and seamless 1-click drop-in connection to Neon PostgreSQL in production.
 */

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
}

export interface CreditResult {
  success: boolean;
  error?: string;
  balanceAfter: number;
  referenceCode: string;
}

export interface IWalletAdapter {
  getBalance(userId: string): Promise<WalletBalance>;
  deductBet(userId: string, amount: number, roundId: string, isBonus: boolean): Promise<DebitResult>;
  creditWin(userId: string, amount: number, roundId: string, referenceCode: string): Promise<CreditResult>;
}

/**
 * In-Memory Mock Wallet for Isolated Standalone Development
 */
export class MockWalletAdapter implements IWalletAdapter {
  private balances = new Map<string, { balance: number; bonus: number }>();

  constructor() {
    // Seed default player wallet
    this.balances.set('demo-user-1', { balance: 250.00, bonus: 50.00 });
    this.balances.set('demo-user-vip', { balance: 1500.00, bonus: 100.00 });
  }

  async getBalance(userId: string): Promise<WalletBalance> {
    if (!this.balances.has(userId)) {
      this.balances.set(userId, { balance: 100.00, bonus: 50.00 });
    }
    const b = this.balances.get(userId)!;
    return {
      balance: Number(b.balance.toFixed(2)),
      bonus: Number(b.bonus.toFixed(2)),
      currency: 'ETB'
    };
  }

  async deductBet(userId: string, amount: number, roundId: string, isBonus: boolean): Promise<DebitResult> {
    const w = await this.getBalance(userId);
    const targetBalance = isBonus ? w.bonus : w.balance;

    if (targetBalance < amount) {
      return {
        success: false,
        error: `Insufficient ${isBonus ? 'bonus' : 'cash'} balance (${targetBalance} < ${amount})`,
        balanceAfter: w.balance,
        bonusAfter: w.bonus,
        referenceCode: ''
      };
    }

    if (isBonus) {
      w.bonus = Number((w.bonus - amount).toFixed(2));
    } else {
      w.balance = Number((w.balance - amount).toFixed(2));
    }
    this.balances.set(userId, { balance: w.balance, bonus: w.bonus });

    const ref = `KENO_BET_${roundId.slice(0, 8)}_${Date.now()}`;
    return {
      success: true,
      balanceAfter: w.balance,
      bonusAfter: w.bonus,
      referenceCode: ref
    };
  }

  async creditWin(userId: string, amount: number, roundId: string, referenceCode: string): Promise<CreditResult> {
    const w = await this.getBalance(userId);
    w.balance = Number((w.balance + amount).toFixed(2));
    this.balances.set(userId, { balance: w.balance, bonus: w.bonus });

    const winRef = `KENO_WIN_${roundId.slice(0, 8)}_${Date.now()}`;
    return {
      success: true,
      balanceAfter: w.balance,
      referenceCode: winRef
    };
  }
}

// Active singleton instance for standalone environment
export const walletAdapter: IWalletAdapter = new MockWalletAdapter();

