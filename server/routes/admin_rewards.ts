import { Router, Response } from 'express';
import { query, withTransaction } from '../db.ts';
import { requireAdmin, AuthenticatedRequest } from '../middleware/auth.ts';
import { io } from '../io.ts';
import { TelegramBotService } from '../services/telegramBotService.ts';

export const adminRewardsRouter = Router();

/**
 * 1. GET /api/admin/rewards/kpis
 * Returns real live aggregates matching the Enqu 4 KPI Cards
 */
adminRewardsRouter.get('/kpis', requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const [settingsRes, walletsRes, coinsRes, redemptionsRes, rewardsPaidRes] = await Promise.all([
      // Settings for liability calculations
      query(`SELECT coin_redemption_coins_per_block, coin_redemption_reward_etb FROM bonus_reward_settings WHERE id = 1`),
      // Bonus Wallets Total & Players
      query(`
        SELECT 
          COALESCE(SUM(w.bonus), 0) as total_bonus,
          COUNT(*) FILTER (WHERE w.bonus > 0) as bonus_players
        FROM wallets w
        JOIN users u ON w.user_id = u.id
        WHERE u.role = 'player' 
          AND (u.is_bot IS NULL OR u.is_bot = false)
          AND u.full_name NOT LIKE 'Synthetic%'
      `),
      // Coins in Circulation
      query(`
        SELECT 
          COALESCE(SUM(cw.balance), 0) as total_coins,
          COUNT(*) as coin_holders
        FROM coin_wallets cw
        JOIN users u ON cw.user_id = u.id
        WHERE u.role = 'player' AND (u.is_bot IS NULL OR u.is_bot = false)
      `),
      // Pending Redemptions (0 if table is clean)
      query(`
        SELECT 
          COUNT(*) as pending_count,
          COALESCE(SUM(reward_amount), 0) as pending_amount
        FROM coin_redemptions
        WHERE status = 'pending'
      `),
      // Rewards Paid Total (100% Real from wallet_transactions where type = 'bonus')
      query(`
        SELECT 
          COALESCE(SUM(amount), 0) as total_paid
        FROM wallet_transactions
        WHERE type = 'bonus' AND status = 'completed'
      `)
    ]);

    const s = settingsRes.rows[0] || {};
    const coinsPerBlock = parseInt(s.coin_redemption_coins_per_block || '1000', 10);
    const rewardPerBlock = parseFloat(s.coin_redemption_reward_etb || '10');

    const totalBonus = parseFloat(walletsRes.rows[0]?.total_bonus || '0');
    const bonusPlayers = parseInt(walletsRes.rows[0]?.bonus_players || '0', 10);

    const totalCoins = parseInt(coinsRes.rows[0]?.total_coins || '0', 10);
    const liabilityEtb = coinsPerBlock > 0 ? (totalCoins / coinsPerBlock) * rewardPerBlock : 0;

    const pendingCount = parseInt(redemptionsRes.rows[0]?.pending_count || '0', 10);
    const pendingAmount = parseFloat(redemptionsRes.rows[0]?.pending_amount || '0');

    const totalPaid = parseFloat(rewardsPaidRes.rows[0]?.total_paid || '0');

    return res.json({
      success: true,
      kpis: {
        bonusWallets: {
          totalEtb: totalBonus,
          playersCount: bonusPlayers,
          label: `Across ${bonusPlayers} players`
        },
        coinsCirculation: {
          totalCoins,
          liabilityEtb: Math.round(liabilityEtb),
          label: `Liability: ETB ${Math.round(liabilityEtb).toLocaleString('en-US')}`
        },
        pendingRedemptions: {
          count: pendingCount,
          toPayEtb: pendingAmount,
          label: `ETB ${pendingAmount.toFixed(0)} to pay`
        },
        rewardsPaid: {
          totalEtb: totalPaid,
          label: 'Redemptions and prizes'
        }
      }
    });
  } catch (error: any) {
    console.error('❌ [Admin Rewards KPIs Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve rewards KPIs' });
  }
});

/**
 * 2. GET /api/admin/rewards/settings
 * Returns current rules and recent audit log history
 */
adminRewardsRouter.get('/settings', requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const [settingsRes, auditRes] = await Promise.all([
      query(`SELECT * FROM bonus_reward_settings WHERE id = 1`),
      query(`SELECT id, admin_username, change_description, created_at FROM bonus_rule_audit_logs ORDER BY created_at DESC LIMIT 15`)
    ]);

    const settings = settingsRes.rows[0] || {
      reg_bonus_enabled: true,
      reg_bonus_amount: 50,
      reg_bonus_expires_days: 0,
      ref_bonus_enabled: true,
      ref_bonus_percent: 10,
      ref_min_deposit: 50,
      ref_max_cap: 500,
      coin_earning_enabled: true,
      coin_earning_rate: 1.5,
      coin_redemption_coins_per_block: 1000,
      coin_redemption_reward_etb: 10,
      coin_redemption_min_coins: 1000,
      coin_credit_target: 'Bonus wallet'
    };

    return res.json({
      success: true,
      settings: {
        regBonusEnabled: Boolean(settings.reg_bonus_enabled),
        regBonusAmount: parseFloat(settings.reg_bonus_amount || '50'),
        regBonusExpiresDays: parseInt(settings.reg_bonus_expires_days || '0', 10),
        refBonusEnabled: Boolean(settings.ref_bonus_enabled),
        refBonusPercent: parseFloat(settings.ref_bonus_percent || '10'),
        refMinDeposit: parseFloat(settings.ref_min_deposit || '50'),
        refMaxCap: parseFloat(settings.ref_max_cap || '500'),
        coinEarningEnabled: Boolean(settings.coin_earning_enabled),
        coinEarningRate: parseFloat(settings.coin_earning_rate || '1.5'),
        coinRedemptionCoinsPerBlock: parseInt(settings.coin_redemption_coins_per_block || '1000', 10),
        coinRedemptionRewardEtb: parseFloat(settings.coin_redemption_reward_etb || '10'),
        coinRedemptionMinCoins: parseInt(settings.coin_redemption_min_coins || '1000', 10),
        coinCreditTarget: settings.coin_credit_target || 'Bonus wallet',
        updatedAt: settings.updated_at
      },
      auditLogs: auditRes.rows.map(r => ({
        id: r.id,
        by: r.admin_username,
        change: r.change_description,
        createdAt: r.created_at
      }))
    });
  } catch (error: any) {
    console.error('❌ [Admin Rewards Settings GET Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve bonus settings' });
  }
});

/**
 * 3. POST /api/admin/rewards/settings
 * Saves updated rules and appends to rule audit log
 */
adminRewardsRouter.post('/settings', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      regBonusEnabled,
      regBonusAmount,
      regBonusExpiresDays,
      refBonusEnabled,
      refBonusPercent,
      refMinDeposit,
      refMaxCap,
      coinEarningEnabled,
      coinEarningRate,
      coinRedemptionCoinsPerBlock,
      coinRedemptionRewardEtb,
      coinRedemptionMinCoins,
      coinCreditTarget
    } = req.body;

    const numRegAmount = parseFloat(regBonusAmount);
    const numRegDays = parseInt(regBonusExpiresDays, 10);
    const numRefPercent = parseFloat(refBonusPercent);
    const numRefMin = parseFloat(refMinDeposit);
    const numRefMax = parseFloat(refMaxCap);
    const numCoinRate = parseFloat(coinEarningRate);
    const numRedCoins = parseInt(coinRedemptionCoinsPerBlock, 10);
    const numRedEtb = parseFloat(coinRedemptionRewardEtb);
    const numRedMin = parseInt(coinRedemptionMinCoins, 10);
    const creditTarget = coinCreditTarget === 'Withdrawable wallet' ? 'Withdrawable wallet' : 'Bonus wallet';

    if (isNaN(numRegAmount) || numRegAmount < 0) {
      return res.status(400).json({ success: false, error: 'Invalid registration bonus amount' });
    }
    if (isNaN(numRefPercent) || numRefPercent < 0 || numRefPercent > 100) {
      return res.status(400).json({ success: false, error: 'Invalid referral bonus percent (0-100)' });
    }
    if (isNaN(numCoinRate) || numCoinRate < 0) {
      return res.status(400).json({ success: false, error: 'Invalid coin earning rate' });
    }
    if (isNaN(numRedCoins) || numRedCoins <= 0 || isNaN(numRedEtb) || numRedEtb <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid coin redemption block parameters' });
    }

    // Atomic update
    await query(`
      UPDATE bonus_reward_settings
      SET 
        reg_bonus_enabled = $1,
        reg_bonus_amount = $2,
        reg_bonus_expires_days = $3,
        ref_bonus_enabled = $4,
        ref_bonus_percent = $5,
        ref_min_deposit = $6,
        ref_max_cap = $7,
        coin_earning_enabled = $8,
        coin_earning_rate = $9,
        coin_redemption_coins_per_block = $10,
        coin_redemption_reward_etb = $11,
        coin_redemption_min_coins = $12,
        coin_credit_target = $13,
        updated_at = NOW()
      WHERE id = 1
    `, [
      Boolean(regBonusEnabled),
      numRegAmount,
      isNaN(numRegDays) ? 0 : numRegDays,
      Boolean(refBonusEnabled),
      numRefPercent,
      isNaN(numRefMin) ? 50 : numRefMin,
      isNaN(numRefMax) ? 500 : numRefMax,
      Boolean(coinEarningEnabled),
      numCoinRate,
      numRedCoins,
      numRedEtb,
      isNaN(numRedMin) ? 1000 : numRedMin,
      creditTarget
    ]);

    // Record human-readable audit change log
    const changesSummary = `Updated rules: Reg Bonus = ${numRegAmount} ETB, Ref Bonus = ${numRefPercent}%, Coins = ${numCoinRate}x, Redemption = ${numRedCoins} coins / ${numRedEtb} ETB (${creditTarget})`;
    await query(`
      INSERT INTO bonus_rule_audit_logs (admin_username, change_description, created_at)
      VALUES ($1, $2, NOW())
    `, ['Admin', changesSummary]);

    // Real-time broadcast to all clients so UI updates instantly
    io.emit('bonus_settings_updated', {
      regBonusEnabled: Boolean(regBonusEnabled),
      regBonusAmount: numRegAmount,
      regBonusExpiresDays: isNaN(numRegDays) ? 0 : numRegDays,
      refBonusEnabled: Boolean(refBonusEnabled),
      refBonusPercent: numRefPercent,
      refMinDeposit: isNaN(numRefMin) ? 50 : numRefMin,
      refMaxCap: isNaN(numRefMax) ? 500 : numRefMax,
      coinEarningEnabled: Boolean(coinEarningEnabled),
      coinEarningRate: numCoinRate,
      coinRedemptionCoinsPerBlock: numRedCoins,
      coinRedemptionRewardEtb: numRedEtb,
      coinRedemptionMinCoins: isNaN(numRedMin) ? 1000 : numRedMin,
      coinCreditTarget: creditTarget
    });

    return res.json({
      success: true,
      message: 'Bonus & reward rules updated successfully!'
    });
  } catch (error: any) {
    console.error('❌ [Admin Rewards Settings POST Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to update bonus settings' });
  }
});

/**
 * 4. GET /api/admin/rewards/bonus-wallets
 * Player table with real bonus and withdrawable balances
 */
adminRewardsRouter.get('/bonus-wallets', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 10, 1), 50);
    const offset = (page - 1) * limit;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

    const conditions: string[] = [
      "u.role = 'player'",
      "(u.is_bot IS NULL OR u.is_bot = false)",
      "u.full_name NOT LIKE 'Synthetic%'"
    ];
    const params: any[] = [];

    if (search) {
      params.push(`%${search}%`);
      const idx = params.length;
      conditions.push(`(u.full_name ILIKE $${idx} OR u.phone ILIKE $${idx} OR CAST(u.id AS TEXT) ILIKE $${idx} OR u.telegram_username ILIKE $${idx})`);
    }

    const whereClause = conditions.join(' AND ');

    const [countRes, playersRes] = await Promise.all([
      query(`SELECT COUNT(*) as total FROM users u WHERE ${whereClause}`, params),
      query(`
        SELECT 
          u.id,
          u.full_name,
          u.phone,
          u.telegram_username,
          u.telegram_id,
          COALESCE(u.status, 'active') as status,
          COALESCE(w.balance, 0.00) as wallet,
          COALESCE(w.bonus, 0.00) as bonus,
          u.created_at as joined_at
        FROM users u
        LEFT JOIN wallets w ON u.id = w.user_id
        WHERE ${whereClause}
        ORDER BY w.bonus DESC, w.balance DESC, u.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `, params)
    ]);

    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    return res.json({
      success: true,
      players: playersRes.rows.map(p => ({
        id: p.id,
        name: p.full_name || 'Player',
        phone: p.phone || `09${String(p.telegram_id || '').slice(-8)}`,
        username: p.telegram_username ? `@${p.telegram_username}` : null,
        status: p.status === 'suspended' ? 'Suspended' : 'Active',
        wallet: parseFloat(p.wallet || '0'),
        bonus: parseFloat(p.bonus || '0'),
        joinedAt: p.joined_at
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error('❌ [Admin Bonus Wallets Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve bonus wallets' });
  }
});

/**
 * 5. GET /api/admin/rewards/top-coin-holders
 * Ranked leaderboard of coin holders
 */
adminRewardsRouter.get('/top-coin-holders', requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const [settingsRes, holdersRes] = await Promise.all([
      query(`SELECT coin_redemption_coins_per_block, coin_redemption_reward_etb FROM bonus_reward_settings WHERE id = 1`),
      query(`
        SELECT 
          cw.user_id,
          u.full_name,
          u.phone,
          u.telegram_username,
          u.telegram_id,
          COALESCE(u.status, 'active') as status,
          COALESCE(cw.balance, 0) as coins,
          COALESCE(cw.lifetime_earned, 0) as lifetime_earned,
          COALESCE(cw.lifetime_redeemed, 0) as lifetime_redeemed,
          (
            SELECT COUNT(*) 
            FROM game_tickets gt 
            WHERE gt.user_id = cw.user_id
          ) as games_played
        FROM coin_wallets cw
        JOIN users u ON cw.user_id = u.id
        WHERE u.role = 'player' 
          AND (u.is_bot IS NULL OR u.is_bot = false)
          AND u.full_name NOT LIKE 'Synthetic%'
        ORDER BY cw.balance DESC
        LIMIT 25
      `)
    ]);

    const s = settingsRes.rows[0] || {};
    const coinsPerBlock = parseInt(s.coin_redemption_coins_per_block || '1000', 10);
    const rewardPerBlock = parseFloat(s.coin_redemption_reward_etb || '10');

    const holders = holdersRes.rows.map((h, index) => {
      const coins = parseInt(h.coins || '0', 10);
      const etbValue = coinsPerBlock > 0 ? (coins / coinsPerBlock) * rewardPerBlock : 0;
      const rank = index + 1;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}`;

      return {
        rank,
        medal,
        userId: h.user_id,
        name: h.full_name || 'Player',
        phone: h.phone || `09${String(h.telegram_id || '').slice(-8)}`,
        username: h.telegram_username ? `@${h.telegram_username}` : null,
        status: h.status === 'suspended' ? 'Suspended' : 'Active',
        coins,
        etbValue: etbValue.toFixed(2),
        gamesPlayed: parseInt(h.games_played || '0', 10)
      };
    });

    return res.json({
      success: true,
      holders
    });
  } catch (error: any) {
    console.error('❌ [Admin Top Coin Holders Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve top coin holders' });
  }
});

/**
 * 6. GET /api/admin/rewards/redemptions
 * Queue of coin redemptions with real player details
 */
adminRewardsRouter.get('/redemptions', requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const redRes = await query(`
      SELECT 
        cr.id,
        cr.user_id,
        u.full_name,
        u.phone,
        u.telegram_username,
        u.telegram_id,
        cr.coins_redeemed,
        cr.reward_amount,
        cr.credit_target,
        cr.status,
        cr.created_at,
        cr.reviewed_at,
        cr.reviewed_by
      FROM coin_redemptions cr
      JOIN users u ON cr.user_id = u.id
      ORDER BY 
        CASE WHEN cr.status = 'pending' THEN 0 ELSE 1 END,
        cr.created_at DESC
      LIMIT 50
    `);

    return res.json({
      success: true,
      redemptions: redRes.rows.map(r => ({
        id: r.id,
        userId: r.user_id,
        playerName: r.full_name || 'Player',
        phone: r.phone || `09${String(r.telegram_id || '').slice(-8)}`,
        coins: parseInt(r.coins_redeemed, 10),
        rewardAmount: parseFloat(r.reward_amount),
        creditTarget: r.credit_target,
        status: r.status,
        createdAt: r.created_at,
        reviewedAt: r.reviewed_at,
        reviewedBy: r.reviewed_by
      }))
    });
  } catch (error: any) {
    console.error('❌ [Admin Redemptions Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve redemptions' });
  }
});

/**
 * 7. POST /api/admin/rewards/redemptions/:id/approve
 * Approves a redemption request, credits target wallet, records transactions
 */
adminRewardsRouter.post('/redemptions/:id/approve', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await withTransaction(async (client) => {
      // Lock row
      const checkRes = await client.query(`
        SELECT cr.*, u.full_name, u.telegram_id 
        FROM coin_redemptions cr 
        JOIN users u ON cr.user_id = u.id 
        WHERE cr.id = $1 FOR UPDATE
      `, [id]);

      if (checkRes.rows.length === 0) {
        throw new Error('Redemption request not found');
      }
      const item = checkRes.rows[0];
      if (item.status !== 'pending') {
        throw new Error(`Redemption has already been ${item.status}`);
      }

      const rewardAmount = parseFloat(item.reward_amount);
      const isWithdrawable = item.credit_target === 'Withdrawable wallet';

      // 1. Credit target wallet
      let updateWalRes;
      if (isWithdrawable) {
        updateWalRes = await client.query(`
          UPDATE wallets 
          SET balance = balance + $1, updated_at = NOW() 
          WHERE user_id = $2 
          RETURNING balance, bonus
        `, [rewardAmount, item.user_id]);
      } else {
        updateWalRes = await client.query(`
          UPDATE wallets 
          SET bonus = bonus + $1, updated_at = NOW() 
          WHERE user_id = $2 
          RETURNING balance, bonus
        `, [rewardAmount, item.user_id]);
      }

      const newBal = parseFloat(updateWalRes.rows[0].balance);
      const newBon = parseFloat(updateWalRes.rows[0].bonus);

      // 2. Mark redemption approved
      await client.query(`
        UPDATE coin_redemptions 
        SET status = 'approved', reviewed_by = 'Admin', reviewed_at = NOW() 
        WHERE id = $1
      `, [id]);

      // 3. Record in wallet_transactions
      const refCode = `RED-OK-${Date.now().toString().slice(-6)}`;
      await client.query(`
        INSERT INTO wallet_transactions 
          (user_id, type, amount, balance_after, reference_code, status, payment_method, description)
        VALUES 
          ($1, $2, $3, $4, $5, 'completed', 'coin_redemption', $6)
      `, [
        item.user_id,
        isWithdrawable ? 'deposit' : 'bonus',
        rewardAmount,
        isWithdrawable ? newBal : newBon,
        refCode,
        `Approved Coin Redemption (${item.coins_redeemed} coins -> ${rewardAmount.toFixed(2)} ETB into ${item.credit_target})`
      ]);

      return {
        userId: item.user_id,
        telegramId: item.telegram_id ? String(item.telegram_id) : null,
        newBalance: newBal,
        newBonus: newBon,
        rewardAmount,
        creditTarget: item.credit_target
      };
    });

    // Real-time WebSocket balance notification
    const strId = String(result.userId);
    const balancePayload = {
      userId: strId,
      telegramId: result.telegramId,
      balance: result.newBalance,
      bonus: result.newBonus,
      newBalance: result.newBalance,
      delta: result.rewardAmount,
      reason: `Coin Redemption Approved: ${result.rewardAmount.toFixed(2)} ETB`
    };

    io.to(`user_${strId}`).emit('user_balance_updated', balancePayload);
    if (result.telegramId) io.to(`user_${result.telegramId}`).emit('user_balance_updated', balancePayload);
    io.emit('user_balance_updated', balancePayload);

    // Send Telegram alert
    if (result.telegramId) {
      try {
        const msg = `🎉 <b>Coin Redemption Approved!</b>\n\n` +
          `Your request to exchange coins for <b>${result.rewardAmount.toFixed(2)} ETB</b> has been approved and credited to your <b>${result.creditTarget}</b>!\n\n` +
          `Enjoy playing on Sonic Bingo!`;
        await TelegramBotService.getInstance().sendMessage(result.telegramId, msg, { parseMode: 'HTML' });
      } catch {}
    }

    return res.json({
      success: true,
      message: `Redemption ${id} approved successfully!`
    });
  } catch (error: any) {
    console.error('❌ [Admin Approve Redemption Error]:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to approve redemption' });
  }
});

/**
 * 8. POST /api/admin/rewards/redemptions/:id/reject
 * Rejects a redemption request and refunds coins back to user coin wallet
 */
adminRewardsRouter.post('/redemptions/:id/reject', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await withTransaction(async (client) => {
      const checkRes = await client.query(`
        SELECT cr.*, u.full_name, u.telegram_id 
        FROM coin_redemptions cr 
        JOIN users u ON cr.user_id = u.id 
        WHERE cr.id = $1 FOR UPDATE
      `, [id]);

      if (checkRes.rows.length === 0) {
        throw new Error('Redemption request not found');
      }
      const item = checkRes.rows[0];
      if (item.status !== 'pending') {
        throw new Error(`Redemption has already been ${item.status}`);
      }

      // 1. Refund coins to coin_wallets
      const cwRes = await client.query(`
        UPDATE coin_wallets 
        SET balance = balance + $1, updated_at = NOW() 
        WHERE user_id = $2 
        RETURNING balance
      `, [item.coins_redeemed, item.user_id]);
      const newCoins = parseInt(cwRes.rows[0]?.balance || '0', 10);

      // 2. Mark rejected
      await client.query(`
        UPDATE coin_redemptions 
        SET status = 'rejected', reviewed_by = 'Admin', reviewed_at = NOW() 
        WHERE id = $1
      `, [id]);

      // 3. Log in coin_transactions
      await client.query(`
        INSERT INTO coin_transactions 
          (user_id, amount, type, balance_after, reference_id, description)
        VALUES 
          ($1, $2, 'admin_adjustment', $3, $4, $5)
      `, [
        item.user_id,
        item.coins_redeemed,
        newCoins,
        `REJECT-${id}`,
        `Refunded ${item.coins_redeemed} coins from rejected redemption request`
      ]);

      return {
        userId: item.user_id,
        telegramId: item.telegram_id ? String(item.telegram_id) : null,
        refundedCoins: item.coins_redeemed,
        newCoins
      };
    });

    // Real-time coin update
    io.emit('user_coins_updated', {
      userId: result.userId,
      newBalance: result.newCoins
    });

    return res.json({
      success: true,
      message: `Redemption ${id} rejected and ${result.refundedCoins} coins refunded to player.`
    });
  } catch (error: any) {
    console.error('❌ [Admin Reject Redemption Error]:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to reject redemption' });
  }
});

/**
 * 9. GET /api/admin/rewards/winners
 * List of promotional bonus winners
 */
adminRewardsRouter.get('/winners', requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    // 100% Real bonus winner records from wallet_transactions (Registration bonuses, Referral bonuses, Coin rewards)
    const winRes = await query(`
      SELECT 
        wt.id,
        wt.user_id,
        u.full_name,
        u.phone,
        u.telegram_username,
        u.telegram_id,
        CASE 
          WHEN wt.payment_method = 'welcome_reward' THEN 'Welcome Registration Bonus'
          WHEN wt.payment_method = 'referral_reward' THEN 'Referral Commission Bonus'
          WHEN wt.payment_method = 'coin_reward' THEN 'Coin Exchange Reward'
          ELSE COALESCE(wt.description, 'Promotional Bonus')
        END as promotion_name,
        wt.amount as prize_amount,
        'paid' as status,
        'System' as paid_by,
        wt.created_at as paid_at,
        wt.created_at
      FROM wallet_transactions wt
      JOIN users u ON wt.user_id = u.id
      WHERE wt.type = 'bonus'
      ORDER BY wt.created_at DESC
      LIMIT 50
    `);

    return res.json({
      success: true,
      winners: winRes.rows.map(w => ({
        id: w.id,
        userId: w.user_id,
        winnerName: w.full_name || 'Player',
        phone: w.phone || (w.telegram_id ? `09${String(w.telegram_id).slice(-8)}` : 'Direct'),
        promotionName: w.promotion_name,
        prizeAmount: parseFloat(w.prize_amount || '0'),
        status: w.status,
        paidBy: w.paid_by,
        paidAt: w.paid_at,
        createdAt: w.created_at
      }))
    });
  } catch (error: any) {
    console.error('❌ [Admin Bonus Winners Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve bonus winners' });
  }
});

/**
 * 10. POST /api/admin/rewards/winners/:id/pay
 * Pays out a promotional bonus prize to user wallet
 */
adminRewardsRouter.post('/winners/:id/pay', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await withTransaction(async (client) => {
      const checkRes = await client.query(`
        SELECT bw.*, u.full_name, u.telegram_id 
        FROM bonus_winners bw 
        JOIN users u ON bw.user_id = u.id 
        WHERE bw.id = $1 FOR UPDATE
      `, [id]);

      if (checkRes.rows.length === 0) {
        throw new Error('Winner record not found');
      }
      const item = checkRes.rows[0];
      if (item.status !== 'pending') {
        throw new Error(`Winner prize has already been ${item.status}`);
      }

      const prizeAmount = parseFloat(item.prize_amount);

      // 1. Credit withdrawable wallet
      const walRes = await client.query(`
        UPDATE wallets 
        SET balance = balance + $1, updated_at = NOW() 
        WHERE user_id = $2 
        RETURNING balance, bonus
      `, [prizeAmount, item.user_id]);

      const newBal = parseFloat(walRes.rows[0].balance);
      const newBon = parseFloat(walRes.rows[0].bonus);

      // 2. Mark paid
      await client.query(`
        UPDATE bonus_winners 
        SET status = 'paid', paid_by = 'Admin', paid_at = NOW() 
        WHERE id = $1
      `, [id]);

      // 3. Log transaction
      const refCode = `WIN-PAY-${Date.now().toString().slice(-6)}`;
      await client.query(`
        INSERT INTO wallet_transactions 
          (user_id, type, amount, balance_after, reference_code, status, payment_method, description)
        VALUES 
          ($1, 'deposit', $2, $3, $4, 'completed', 'bonus_prize', $5)
      `, [
        item.user_id,
        prizeAmount,
        newBal,
        refCode,
        `Prize Payout: ${item.promotion_name} (${prizeAmount.toFixed(2)} ETB)`
      ]);

      return {
        userId: item.user_id,
        telegramId: item.telegram_id ? String(item.telegram_id) : null,
        promotionName: item.promotion_name,
        prizeAmount,
        newBal,
        newBon
      };
    });

    // Real-time balance notification
    const strId = String(result.userId);
    const balancePayload = {
      userId: strId,
      telegramId: result.telegramId,
      balance: result.newBal,
      bonus: result.newBon,
      newBalance: result.newBal,
      delta: result.prizeAmount,
      reason: `Prize Payout: ${result.promotionName}`
    };

    io.to(`user_${strId}`).emit('user_balance_updated', balancePayload);
    if (result.telegramId) io.to(`user_${result.telegramId}`).emit('user_balance_updated', balancePayload);
    io.emit('user_balance_updated', balancePayload);

    // Send Telegram celebration message
    if (result.telegramId) {
      try {
        const msg = `🏆 <b>CONGRATULATIONS! Bonus Prize Paid!</b>\n\n` +
          `You have been awarded <b>${result.prizeAmount.toFixed(2)} ETB</b> for <b>${result.promotionName}</b>!\n\n` +
          `The funds are now available in your withdrawable balance. Keep playing and winning on Sonic Bingo!`;
        await TelegramBotService.getInstance().sendMessage(result.telegramId, msg, { parseMode: 'HTML' });
      } catch {}
    }

    return res.json({
      success: true,
      message: `Winner prize of ${result.prizeAmount.toFixed(2)} ETB paid successfully!`
    });
  } catch (error: any) {
    console.error('❌ [Admin Pay Winner Error]:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to pay winner' });
  }
});

/**
 * 11. POST /api/admin/rewards/adjust
 * Unified Adjust endpoint for Bonus Wallet or Coins
 */
adminRewardsRouter.post('/adjust', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { target = 'bonus', type = 'Credit', userId, amount, reason = 'Adjustment', note } = req.body;

    const numAmount = parseFloat(amount);
    if (!userId || isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Valid userId and positive amount are required' });
    }

    const isCredit = type.toLowerCase() === 'credit' || type.toLowerCase() === 'add';
    const delta = isCredit ? numAmount : -numAmount;

    if (target === 'coins') {
      // Adjust Coin Wallet
      const intAmount = Math.floor(delta);
      const cwRes = await query(`SELECT balance FROM coin_wallets WHERE user_id = $1`, [userId]);
      const currentCoins = parseInt(cwRes.rows[0]?.balance || '0', 10);

      if (!isCredit && Math.abs(intAmount) > currentCoins) {
        return res.status(400).json({ success: false, error: 'Debit amount exceeds player coin balance' });
      }

      const updateRes = await query(`
        INSERT INTO coin_wallets (user_id, balance, lifetime_earned, lifetime_redeemed, updated_at)
        VALUES ($1, GREATEST(0, $2), GREATEST(0, $2), 0, NOW())
        ON CONFLICT (user_id) DO UPDATE 
        SET balance = GREATEST(0, coin_wallets.balance + $2),
            lifetime_earned = CASE WHEN $2 > 0 THEN coin_wallets.lifetime_earned + $2 ELSE coin_wallets.lifetime_earned END,
            updated_at = NOW()
        RETURNING balance
      `, [userId, intAmount]);

      const newBalance = parseInt(updateRes.rows[0]?.balance || '0', 10);

      // Record in coin_transactions
      await query(`
        INSERT INTO coin_transactions (user_id, amount, type, balance_after, reference_id, description)
        VALUES ($1, $2, 'admin_adjustment', $3, $4, $5)
      `, [
        userId,
        intAmount,
        newBalance,
        `ADJ-COIN-${Date.now().toString().slice(-6)}`,
        `Admin ${isCredit ? 'Credit' : 'Debit'}: ${reason}. ${note || ''}`
      ]);

      io.emit('user_coins_updated', { userId, newBalance });

      return res.json({
        success: true,
        message: `Successfully adjusted coins by ${isCredit ? '+' : ''}${intAmount} (New balance: ${newBalance})`,
        newBalance
      });
    } else {
      // Adjust Bonus Wallet
      const walRes = await query(`SELECT balance, bonus FROM wallets WHERE user_id = $1`, [userId]);
      if (walRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Player wallet not found' });
      }

      const currentBonus = parseFloat(walRes.rows[0].bonus || '0');
      const currentBalance = parseFloat(walRes.rows[0].balance || '0');

      if (!isCredit && numAmount > currentBonus) {
        return res.status(400).json({ success: false, error: 'Debit amount exceeds player bonus wallet balance' });
      }

      const newBonus = Math.max(0, currentBonus + delta);
      await query(`UPDATE wallets SET bonus = $1, updated_at = NOW() WHERE user_id = $2`, [newBonus, userId]);

      // Record transaction
      const refCode = `ADJ-BON-${Date.now().toString().slice(-6)}`;
      await query(`
        INSERT INTO wallet_transactions 
          (user_id, type, amount, balance_after, reference_code, status, description)
        VALUES 
          ($1, 'admin_adjustment', $2, $3, $4, 'completed', $5)
      `, [
        userId,
        delta,
        newBonus,
        refCode,
        `Admin bonus ${isCredit ? 'credit' : 'debit'}: ${reason}. ${note || ''}`
      ]);

      // WebSocket push
      const strId = String(userId);
      const balancePayload = {
        userId: strId,
        balance: currentBalance,
        bonus: newBonus,
        newBalance: currentBalance,
        delta,
        reason: `Bonus ${isCredit ? 'Credit' : 'Debit'}: ${reason}`
      };
      io.to(`user_${strId}`).emit('user_balance_updated', balancePayload);
      io.emit('user_balance_updated', balancePayload);

      return res.json({
        success: true,
        message: `Successfully adjusted bonus wallet by ${isCredit ? '+' : '-'}${numAmount.toFixed(2)} ETB!`,
        bonus: newBonus
      });
    }
  } catch (error: any) {
    console.error('❌ [Admin Rewards Adjust Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to perform balance adjustment' });
  }
});

