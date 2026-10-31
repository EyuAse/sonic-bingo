import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query, withTransaction } from '../db.ts';
import { requireAgent, AuthenticatedRequest, generateToken } from '../middleware/auth.ts';
import { io } from '../io.ts';
import { coinService } from '../services/coinService.ts';

const router = Router();

/**
 * Agent Login (Phone + Password or Agent Code)
 */
router.post('/login', async (req, res) => {
  try {
    const { phone, password, agentCode } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }

    const cleanPhone = phone.trim();

    // Query user and agent profile
    const userRes = await query(
      `SELECT u.*, ap.id as agent_profile_id, ap.agent_code, ap.wallet_balance, ap.status as agent_status,
              ap.low_balance_threshold, ap.target_monthly, ap.commission_rate
       FROM users u
       JOIN agent_profiles ap ON u.id = ap.user_id
       WHERE u.phone = $1 AND u.role IN ('agent', 'admin')`,
      [cleanPhone]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Agent profile not found. Please contact admin.' });
    }

    const user = userRes.rows[0];

    if (user.agent_status === 'suspended') {
      return res.status(403).json({ success: false, error: 'Your agent account has been suspended. Please contact admin.' });
    }

    // Password verification (or fallback to agentCode if initial PIN setup)
    let isMatch = false;
    if (user.password_hash && password) {
      isMatch = await bcrypt.compare(password, user.password_hash);
    } else if (agentCode && user.agent_code) {
      isMatch = agentCode.trim().toUpperCase() === user.agent_code.trim().toUpperCase();
    } else if (password && user.agent_code) {
      isMatch = password.trim().toUpperCase() === user.agent_code.trim().toUpperCase() || password === '1234';
    }

    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid agent credentials.' });
    }

    const token = generateToken({
      id: user.id,
      phone: user.phone,
      fullName: user.full_name,
      role: 'agent'
    });

    return res.json({
      success: true,
      token,
      agent: {
        id: user.agent_profile_id,
        userId: user.id,
        fullName: user.full_name,
        phone: user.phone,
        agentCode: user.agent_code,
        walletBalance: parseFloat(user.wallet_balance || '0'),
        lowBalanceThreshold: parseFloat(user.low_balance_threshold || '1000'),
        targetMonthly: parseFloat(user.target_monthly || '50000'),
        commissionRate: parseFloat(user.commission_rate || '5'),
        refLink: `https://t.me/SonicGameOfficialBot?start=agent_${user.agent_code}`
      }
    });
  } catch (error: any) {
    console.error('❌ [Agent Login Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to authenticate agent' });
  }
});

/**
 * Get Current Agent Profile & Live Wallet Balance
 */
router.get('/profile', requireAgent, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const resProfile = await query(
      `SELECT ap.*, u.full_name, u.phone
       FROM agent_profiles ap
       JOIN users u ON ap.user_id = u.id
       WHERE ap.user_id = $1`,
      [userId]
    );

    if (resProfile.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Agent profile not found' });
    }

    const ap = resProfile.rows[0];
    const balance = parseFloat(ap.wallet_balance || '0');
    const threshold = parseFloat(ap.low_balance_threshold || '1000');
    const isLowBalance = balance <= threshold;

    return res.json({
      success: true,
      profile: {
        id: ap.id,
        agentCode: ap.agent_code,
        fullName: ap.full_name,
        phone: ap.phone,
        walletBalance: balance,
        initialDeposit: parseFloat(ap.initial_deposit || '10000'),
        lowBalanceThreshold: threshold,
        isLowBalance,
        targetMonthly: parseFloat(ap.target_monthly || '50000'),
        commissionRate: parseFloat(ap.commission_rate || '5'),
        status: ap.status,
        inviteLink: `https://t.me/SonicGameOfficialBot?start=agent_${ap.agent_code}`
      }
    });
  } catch (error: any) {
    console.error('❌ [Agent Profile GET Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve agent profile' });
  }
});

/**
 * Deposit for Player (Cash-in)
 * Agent collects payment from player via Telebirr/M-Pesa and instantly credits player's wallet
 * from the agent's pre-funded platform wallet balance.
 */
router.post('/deposit-for-player', requireAgent, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { playerPhone, amount, paymentMethod } = req.body;

    if (!playerPhone || !amount) {
      return res.status(400).json({ success: false, error: 'Player phone and deposit amount are required' });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 50) {
      return res.status(400).json({ success: false, error: 'Minimum deposit amount is 50 ETB' });
    }

    const method = paymentMethod === 'M-Pesa' ? 'M-Pesa' : 'Telebirr';
    const cleanPhone = playerPhone.trim();

    const result = await withTransaction(async (client) => {
      // 1. Lock agent profile
      const agentRes = await client.query(
        `SELECT id, agent_code, wallet_balance, low_balance_threshold 
         FROM agent_profiles 
         WHERE user_id = $1 FOR UPDATE`,
        [userId]
      );

      if (agentRes.rows.length === 0) {
        throw new Error('Agent profile not found');
      }

      const agent = agentRes.rows[0];
      const agentBal = parseFloat(agent.wallet_balance || '0');

      if (agentBal < numAmount) {
        throw new Error(`Insufficient agent balance (${agentBal.toFixed(2)} ETB). Please recharge your agent wallet.`);
      }

      // 2. Find player user
      const playerRes = await client.query(
        `SELECT u.id, u.full_name, u.agent_id, w.balance 
         FROM users u
         JOIN wallets w ON u.id = w.user_id
         WHERE u.phone = $1 FOR UPDATE`,
        [cleanPhone]
      );

      if (playerRes.rows.length === 0) {
        throw new Error(`Player with phone ${cleanPhone} not found in Sonic Bingo.`);
      }

      const player = playerRes.rows[0];
      const newAgentBal = agentBal - numAmount;
      const newPlayerBal = parseFloat(player.balance || '0') + numAmount;
      const refCode = `AGT-DEP-${Date.now().toString().slice(-6)}`;

      // 3. Deduct from agent wallet
      await client.query(
        `UPDATE agent_profiles 
         SET wallet_balance = $1, 
             low_balance_alert_sent = (CASE WHEN $1 <= low_balance_threshold THEN TRUE ELSE FALSE END),
             updated_at = NOW() 
         WHERE id = $2`,
        [newAgentBal, agent.id]
      );

      // 4. Credit player wallet
      await client.query(
        `UPDATE wallets 
         SET balance = $1, updated_at = NOW() 
         WHERE user_id = $2`,
        [newPlayerBal, player.id]
      );

      // 5. Flag player has_deposited and link agent if not linked
      await client.query(
        `UPDATE users 
         SET has_deposited = TRUE,
             agent_id = COALESCE(agent_id, $1)
         WHERE id = $2`,
        [agent.id, player.id]
      );

      // 6. Record in agent_player_deposits
      await client.query(
        `INSERT INTO agent_player_deposits (agent_id, player_user_id, amount, agent_balance_after, player_balance_after, payment_method, reference_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [agent.id, player.id, numAmount, newAgentBal, newPlayerBal, method, refCode]
      );

      // 7. Record in player's wallet_transactions
      await client.query(
        `INSERT INTO wallet_transactions (user_id, type, amount, balance_after, reference_code, status, payment_method, description)
         VALUES ($1, 'deposit', $2, $3, $4, 'completed', $5, $6)`,
        [
          player.id,
          numAmount,
          newPlayerBal,
          refCode,
          method,
          `Agent Deposit via ${method} (Agent: ${agent.agent_code})`
        ]
      );

      // 8. Award Player Coins: 1.5x coins per eligible ETB
      try {
        await coinService.awardCoinsForDeposit(player.id, numAmount, refCode, client);
      } catch (coinErr) {
        console.error('⚠️ [Agent Deposit] Failed to award coins:', coinErr);
      }

      return {
        refCode,
        agentId: agent.id,
        agentCode: agent.agent_code,
        newAgentBal,
        playerId: player.id,
        playerName: player.full_name,
        newPlayerBal,
        isLowBalance: newAgentBal <= parseFloat(agent.low_balance_threshold || '1000')
      };
    });

    // Live Socket Notifications
    io.emit(`user_${result.playerId}_balance`, {
      type: 'deposit_credited',
      amount: numAmount,
      newBalance: result.newPlayerBal
    });
    io.emit('user_balance_updated', { userId: result.playerId });

    return res.json({
      success: true,
      message: `Successfully credited ${numAmount.toFixed(2)} ETB to ${result.playerName}`,
      referenceCode: result.refCode,
      playerName: result.playerName,
      playerPhone: cleanPhone,
      amount: numAmount,
      newAgentBalance: result.newAgentBal,
      isLowBalance: result.isLowBalance,
      warning: result.isLowBalance ? '⚠️ Warning: Agent wallet balance is below 1,000 ETB. Please recharge soon.' : null
    });
  } catch (error: any) {
    console.error('❌ [Agent Deposit Player Error]:', error);
    return res.status(400).json({ success: false, error: error.message || 'Failed to process player deposit' });
  }
});

/**
 * Request Agent Wallet Recharge
 * Agent sends payment via Telebirr, M-Pesa, or CBE to recharge their agent float.
 */
router.post('/recharge', requireAgent, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { amount, paymentMethod, transactionCode, receiptImage } = req.body;

    if (!amount || !paymentMethod || !transactionCode) {
      return res.status(400).json({ success: false, error: 'Amount, payment method, and transaction code are required' });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 1000) {
      return res.status(400).json({ success: false, error: 'Minimum agent recharge is 1,000 ETB' });
    }

    const agentRes = await query('SELECT id FROM agent_profiles WHERE user_id = $1', [userId]);
    if (agentRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Agent profile not found' });
    }

    const agentId = agentRes.rows[0].id;
    const cleanCode = transactionCode.trim();

    const insertRes = await query(
      `INSERT INTO agent_recharge_requests (agent_id, amount, payment_method, transaction_code, receipt_image, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING *`,
      [agentId, numAmount, paymentMethod, cleanCode, receiptImage || null]
    );

    // Notify admins via WebSocket
    io.emit('admin_agent_recharge_new', insertRes.rows[0]);

    return res.json({
      success: true,
      message: 'Recharge request submitted successfully. Admin will verify and credit your wallet.',
      request: insertRes.rows[0]
    });
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(409).json({ success: false, error: 'This transaction code has already been submitted.' });
    }
    console.error('❌ [Agent Recharge Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to submit recharge request' });
  }
});

/**
 * Get Agent Recharge History
 */
router.get('/recharges', requireAgent, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const agentRes = await query('SELECT id FROM agent_profiles WHERE user_id = $1', [userId]);
    if (agentRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Agent profile not found' });
    }

    const agentId = agentRes.rows[0].id;

    const listRes = await query(
      `SELECT * FROM agent_recharge_requests 
       WHERE agent_id = $1 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [agentId]
    );

    return res.json({
      success: true,
      recharges: listRes.rows
    });
  } catch (error: any) {
    console.error('❌ [Agent Recharges GET Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve recharge requests' });
  }
});

/**
 * Get Agent Players & Commission Performance Dashboard
 */
router.get('/performance', requireAgent, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const agentRes = await query(
      `SELECT id, agent_code, wallet_balance, low_balance_threshold, target_monthly, commission_rate 
       FROM agent_profiles WHERE user_id = $1`,
      [userId]
    );
    if (agentRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Agent profile not found' });
    }

    const agent = agentRes.rows[0];
    const agentId = agent.id;

    const [playersRes, depositsRes, recentDepositsRes] = await Promise.all([
      query(`
        SELECT 
          COUNT(*) as total_players,
          COUNT(*) FILTER (WHERE u.has_deposited = true) as active_players
        FROM users u 
        WHERE u.agent_id = $1
      `, [agentId]),
      query(`
        SELECT 
          COALESCE(SUM(amount), 0) as total_deposited_all_time,
          COALESCE(SUM(amount) FILTER (WHERE created_at >= CURRENT_DATE), 0) as today_deposited,
          COALESCE(SUM(amount) FILTER (WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)), 0) as month_deposited
        FROM agent_player_deposits
        WHERE agent_id = $1
      `, [agentId]),
      query(`
        SELECT apd.*, u.full_name as player_name, u.phone as player_phone
        FROM agent_player_deposits apd
        JOIN users u ON apd.player_user_id = u.id
        WHERE apd.agent_id = $1
        ORDER BY apd.created_at DESC
        LIMIT 25
      `, [agentId])
    ]);

    const p = playersRes.rows[0] || {};
    const d = depositsRes.rows[0] || {};

    const monthDeposited = parseFloat(d.month_deposited || '0');
    const targetMonthly = parseFloat(agent.target_monthly || '50000');
    const targetProgress = targetMonthly > 0 ? Math.min(100, Math.round((monthDeposited / targetMonthly) * 100)) : 0;
    const commissionRate = parseFloat(agent.commission_rate || '5');
    const estimatedCommission = Math.round(monthDeposited * (commissionRate / 100) * 100) / 100;

    return res.json({
      success: true,
      agentCode: agent.agent_code,
      walletBalance: parseFloat(agent.wallet_balance || '0'),
      lowBalanceThreshold: parseFloat(agent.low_balance_threshold || '1000'),
      isLowBalance: parseFloat(agent.wallet_balance || '0') <= parseFloat(agent.low_balance_threshold || '1000'),
      metrics: {
        totalPlayers: parseInt(p.total_players || '0', 10),
        activePlayers: parseInt(p.active_players || '0', 10),
        todayDeposited: parseFloat(d.today_deposited || '0'),
        monthDeposited,
        totalDepositedAllTime: parseFloat(d.total_deposited_all_time || '0'),
        targetMonthly,
        targetProgress,
        commissionRate,
        estimatedCommission
      },
      recentDeposits: recentDepositsRes.rows
    });
  } catch (error: any) {
    console.error('❌ [Agent Performance Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve agent performance' });
  }
});

/**
 * Search Players for Fast Cash-In (By Phone Number, Full Name, or Username)
 */
router.get('/search-player', requireAgent, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rawQuery = (req.query.q as string || '').trim();
    if (!rawQuery || rawQuery.length < 2) {
      return res.json({ success: true, players: [] });
    }

    const searchParam = `%${rawQuery}%`;
    const searchRes = await query(
      `SELECT u.id, u.full_name, u.phone, u.username, w.balance
       FROM users u
       LEFT JOIN wallets w ON u.id = w.user_id
       WHERE (u.phone ILIKE $1 OR u.full_name ILIKE $1 OR u.username ILIKE $1)
       ORDER BY u.created_at DESC
       LIMIT 10`,
      [searchParam]
    );

    const players = searchRes.rows.map(row => ({
      id: row.id,
      fullName: row.full_name,
      phone: row.phone,
      username: row.username,
      balance: parseFloat(row.balance || '0')
    }));

    return res.json({ success: true, players });
  } catch (error: any) {
    console.error('❌ [Agent Search Player Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to search players' });
  }
});

/**
 * Verify Cash-Out Voucher Code (Before Agent Hands Out Cash)
 */
router.post('/cashout/verify', requireAgent, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { voucherCode } = req.body;
    if (!voucherCode || !voucherCode.trim()) {
      return res.status(400).json({ success: false, error: 'Voucher code is required' });
    }

    const cleanCode = voucherCode.trim().toUpperCase();

    const voucherRes = await query(
      `SELECT v.id, v.voucher_code, v.amount, v.status, v.created_at, v.expires_at,
              u.id as user_id, u.full_name, u.phone
       FROM agent_cashout_vouchers v
       JOIN users u ON v.user_id = u.id
       WHERE UPPER(v.voucher_code) = $1`,
      [cleanCode]
    );

    if (voucherRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Invalid voucher code. Please check and try again.' });
    }

    const v = voucherRes.rows[0];

    if (v.status === 'redeemed') {
      return res.status(400).json({ success: false, error: 'This voucher has already been redeemed.' });
    }
    if (v.status === 'cancelled') {
      return res.status(400).json({ success: false, error: 'This voucher was cancelled by the player.' });
    }
    if (new Date(v.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ success: false, error: 'This voucher has expired.' });
    }
    if (v.status !== 'pending') {
      return res.status(400).json({ success: false, error: `Voucher is not valid (status: ${v.status}).` });
    }

    return res.json({
      success: true,
      voucher: {
        id: v.id,
        voucherCode: v.voucher_code,
        amount: parseFloat(v.amount),
        playerName: v.full_name,
        playerPhone: v.phone,
        status: v.status,
        createdAt: v.created_at,
        expiresAt: v.expires_at
      }
    });
  } catch (error: any) {
    console.error('❌ [Agent Verify Voucher Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to verify voucher' });
  }
});

/**
 * Redeem Cash-Out Voucher & Payout Player
 * Agent pays physical cash / Telebirr to the player.
 * System marks voucher redeemed, finishes withdrawal, and reimburses Agent's platform float
 * PLUS an Agent Cash-Out Commission (default 1.5%).
 */
router.post('/cashout/redeem', requireAgent, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { voucherCode } = req.body;

    if (!voucherCode || !voucherCode.trim()) {
      return res.status(400).json({ success: false, error: 'Voucher code is required' });
    }

    const cleanCode = voucherCode.trim().toUpperCase();

    const result = await withTransaction(async (client) => {
      // 1. Lock agent profile
      const agentRes = await client.query(
        `SELECT id, agent_code, wallet_balance, cashout_commission_rate, low_balance_threshold
         FROM agent_profiles
         WHERE user_id = $1 FOR UPDATE`,
        [userId]
      );

      if (agentRes.rows.length === 0) {
        throw new Error('Agent profile not found');
      }

      const agent = agentRes.rows[0];

      // 2. Lock voucher
      const voucherRes = await client.query(
        `SELECT v.*, u.full_name, u.phone, w.locked_balance, w.balance
         FROM agent_cashout_vouchers v
         JOIN users u ON v.user_id = u.id
         JOIN wallets w ON u.id = w.user_id
         WHERE UPPER(v.voucher_code) = $1 FOR UPDATE`,
        [cleanCode]
      );

      if (voucherRes.rows.length === 0) {
        throw new Error('Voucher code not found');
      }

      const voucher = voucherRes.rows[0];

      if (voucher.status === 'redeemed') {
        throw new Error('This voucher has already been redeemed');
      }
      if (voucher.status === 'cancelled') {
        throw new Error('This voucher was cancelled by the player');
      }
      if (new Date(voucher.expires_at).getTime() < Date.now()) {
        throw new Error('This voucher has expired');
      }
      if (voucher.status !== 'pending') {
        throw new Error(`Voucher is not redeemable (status: ${voucher.status})`);
      }

      const payoutAmount = parseFloat(voucher.amount);
      const commissionRate = parseFloat(agent.cashout_commission_rate || '1.5');
      const commissionEarned = Math.round(payoutAmount * (commissionRate / 100) * 100) / 100;

      // Reimbursement to agent float = payout amount + commission earned
      const currentAgentBal = parseFloat(agent.wallet_balance || '0');
      const newAgentBal = currentAgentBal + payoutAmount + commissionEarned;

      // 3. Update voucher to redeemed
      await client.query(
        `UPDATE agent_cashout_vouchers
         SET status = 'redeemed',
             redeemed_by_agent_id = $1,
             redeemed_at = NOW(),
             agent_commission_earned = $2
         WHERE id = $3`,
        [agent.id, commissionEarned, voucher.id]
      );

      // 4. Reimburse agent float + commission
      await client.query(
        `UPDATE agent_profiles
         SET wallet_balance = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [newAgentBal, agent.id]
      );

      // 5. Deduct player's locked balance
      const currentLocked = parseFloat(voucher.locked_balance || '0');
      const newLocked = Math.max(0, currentLocked - payoutAmount);

      await client.query(
        `UPDATE wallets
         SET locked_balance = $1,
             updated_at = NOW()
         WHERE user_id = $2`,
        [newLocked, voucher.user_id]
      );

      // 6. Complete player's withdrawal transaction in ledger
      const refCode = `AGT-WDR-${Date.now().toString().slice(-6)}`;
      await client.query(
        `INSERT INTO wallet_transactions (user_id, type, amount, balance_after, reference_code, status, payment_method, description)
         VALUES ($1, 'withdrawal', $2, $3, $4, 'completed', 'Agent Counter', $5)`,
        [
          voucher.user_id,
          payoutAmount,
          parseFloat(voucher.balance || '0'),
          refCode,
          `Agent Counter Cash-Out (Voucher: ${cleanCode}, Agent: ${agent.agent_code})`
        ]
      );

      return {
        voucherCode: cleanCode,
        payoutAmount,
        commissionEarned,
        newAgentBal,
        playerId: voucher.user_id,
        playerName: voucher.full_name,
        playerPhone: voucher.phone,
        agentCode: agent.agent_code,
        refCode
      };
    });

    // Notify player via WebSocket
    io.emit(`user_${result.playerId}_balance`, {
      type: 'withdrawal_redeemed',
      amount: result.payoutAmount,
      voucherCode: result.voucherCode
    });
    io.emit('user_balance_updated', { userId: result.playerId });

    return res.json({
      success: true,
      message: `Successfully paid out ${result.payoutAmount.toFixed(2)} ETB to ${result.playerName}`,
      referenceCode: result.refCode,
      voucherCode: result.voucherCode,
      payoutAmount: result.payoutAmount,
      commissionEarned: result.commissionEarned,
      newAgentBalance: result.newAgentBal,
      playerName: result.playerName,
      playerPhone: result.playerPhone
    });
  } catch (error: any) {
    console.error('❌ [Agent Redeem Voucher Error]:', error);
    return res.status(400).json({ success: false, error: error.message || 'Failed to redeem voucher' });
  }
});

/**
 * Get Referred Players List Under This Agent
 */
router.get('/players', requireAgent, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const agentRes = await query('SELECT id FROM agent_profiles WHERE user_id = $1', [userId]);
    if (agentRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Agent profile not found' });
    }

    const agentId = agentRes.rows[0].id;

    const playersRes = await query(
      `SELECT u.id, u.full_name, u.phone, u.username, u.has_deposited, u.created_at,
              COALESCE(w.balance, 0) as balance,
              COALESCE((SELECT SUM(amount) FROM agent_player_deposits WHERE player_user_id = u.id AND agent_id = $1), 0) as total_deposited_by_agent
       FROM users u
       LEFT JOIN wallets w ON u.id = w.user_id
       WHERE u.agent_id = $1
       ORDER BY u.created_at DESC
       LIMIT 100`,
      [agentId]
    );

    return res.json({
      success: true,
      players: playersRes.rows.map(r => ({
        id: r.id,
        fullName: r.full_name,
        phone: r.phone,
        username: r.username,
        hasDeposited: r.has_deposited,
        balance: parseFloat(r.balance || '0'),
        totalDepositedByAgent: parseFloat(r.total_deposited_by_agent || '0'),
        createdAt: r.created_at
      }))
    });
  } catch (error: any) {
    console.error('❌ [Agent Players GET Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve agent players' });
  }
});

/**
 * Get Unified Transaction History (Cash-Ins & Cash-Out Redemptions)
 */
router.get('/transactions', requireAgent, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const agentRes = await query('SELECT id FROM agent_profiles WHERE user_id = $1', [userId]);
    if (agentRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Agent profile not found' });
    }

    const agentId = agentRes.rows[0].id;

    const [depositsRes, redemptionsRes] = await Promise.all([
      query(
        `SELECT apd.id, 'cash_in' as type, apd.amount, apd.payment_method, apd.reference_code,
                apd.agent_balance_after, apd.created_at,
                u.full_name as player_name, u.phone as player_phone
         FROM agent_player_deposits apd
         JOIN users u ON apd.player_user_id = u.id
         WHERE apd.agent_id = $1
         ORDER BY apd.created_at DESC
         LIMIT 50`,
        [agentId]
      ),
      query(
        `SELECT v.id, 'cash_out' as type, v.amount, 'Cash Counter' as payment_method,
                v.voucher_code as reference_code, v.agent_commission_earned,
                v.redeemed_at as created_at,
                u.full_name as player_name, u.phone as player_phone
         FROM agent_cashout_vouchers v
         JOIN users u ON v.user_id = u.id
         WHERE v.redeemed_by_agent_id = $1 AND v.status = 'redeemed'
         ORDER BY v.redeemed_at DESC
         LIMIT 50`,
        [agentId]
      )
    ]);

    // Merge & sort descending
    const combined = [...depositsRes.rows, ...redemptionsRes.rows].sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }).slice(0, 50);

    return res.json({
      success: true,
      transactions: combined
    });
  } catch (error: any) {
    console.error('❌ [Agent Transactions GET Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve transactions' });
  }
});

export default router;

