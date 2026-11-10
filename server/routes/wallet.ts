import { Router } from 'express';
import { query, withTransaction } from '../db.ts';
import { requireAuth, optionalAuth, AuthenticatedRequest } from '../middleware/auth.ts';
import { io } from '../io.ts';
import { gameEngine } from '../game/BingoGameEngine.ts';
import { generateCardFromId } from '../game/cartelaGenerator.ts';
import { coinService } from '../services/coinService.ts';
import { executeAgentDepositApproval, executeDirectDepositApproval } from '../services/depositAutoApprovalService.ts';

const router = Router();

/**
 * Get User Live Wallet Balance from Neon DB
 */
router.get('/balance', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const [walletRes, coinRes] = await Promise.all([
      query('SELECT balance, bonus, locked_balance, currency FROM wallets WHERE user_id = $1', [userId]),
      query('SELECT balance, lifetime_earned, lifetime_redeemed FROM coin_wallets WHERE user_id = $1', [userId])
    ]);

    if (walletRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Wallet not found' });
    }

    const w = walletRes.rows[0];
    const cw = coinRes.rows[0];
    return res.json({
      success: true,
      balance: parseFloat(w.balance || '0'),
      bonus: parseFloat(w.bonus || '0'),
      lockedBalance: parseFloat(w.locked_balance || '0'),
      currency: w.currency || 'ETB',
      coins: cw ? parseInt(cw.balance || '0', 10) : 0,
      coinsLifetimeEarned: cw ? parseInt(cw.lifetime_earned || '0', 10) : 0
    });
  } catch (error: any) {
    console.error('❌ [Wallet Balance Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve balance' });
  }
});

/**
 * Submit Deposit Request (Telebirr / CBE)
 */
router.post('/deposit', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { amount, paymentMethod, playerPhone, transactionRef, receiptImage } = req.body;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 50 || numAmount > 1500) {
      return res.status(400).json({ success: false, error: 'Deposit amount must be between 50 and 1,500 ETB.' });
    }

    if (!paymentMethod || !['Telebirr', 'CBE', 'M-Pesa'].includes(paymentMethod)) {
      return res.status(400).json({ success: false, error: 'Payment method must be Telebirr, CBE, or M-Pesa.' });
    }

    if (!playerPhone || playerPhone.trim().length < 8) {
      return res.status(400).json({ success: false, error: 'Valid phone number is required.' });
    }

    const cleanRef = transactionRef?.trim() || `TX-${paymentMethod.toUpperCase()}-${Date.now().toString().slice(-6)}`;

    // Check for duplicate reference
    const checkDuplicate = await query(
      'SELECT id FROM deposit_requests WHERE transaction_ref = $1',
      [cleanRef]
    );

    if (checkDuplicate.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'A deposit with this transaction reference already exists.' });
    }

    const insertRes = await query(
      `INSERT INTO deposit_requests (user_id, amount, payment_method, player_phone, transaction_ref, receipt_image, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING id, amount, payment_method, player_phone, transaction_ref, status, created_at`,
      [userId, numAmount, paymentMethod, playerPhone.trim(), cleanRef, receiptImage || null]
    );

    const deposit = insertRes.rows[0];

    // 🛡️ SECURITY HARDENING: Check if matching Telebirr SMS already arrived in telebirr_sms_logs
    if (paymentMethod === 'Telebirr') {
      const phoneLast4 = playerPhone.trim().length >= 4 ? playerPhone.trim().slice(-4) : '';
      const smsMatchRes = await query(
        `SELECT id, transaction_ref, amount, payer_phone FROM telebirr_sms_logs 
         WHERE transaction_ref ILIKE $1
           AND status = 'unmatched'
           AND received_at >= NOW() - INTERVAL '60 minutes'
         ORDER BY received_at DESC LIMIT 1`,
        [cleanRef]
      );

      if (smsMatchRes.rows.length > 0) {
        const matchedSms = smsMatchRes.rows[0];
        const verifiedAmount = parseFloat(matchedSms.amount);

        // 🛡️ SECURITY PILLAR 1: Amount Reconciliation Firewall
        if (Math.abs(numAmount - verifiedAmount) > 0.01) {
          console.warn(`🚨 [SECURITY AMOUNT MISMATCH Cashier] User claimed ${numAmount} ETB, but Telebirr verified ${verifiedAmount} ETB (Tx: ${cleanRef})`);
          await query(
            `UPDATE deposit_requests 
             SET status = 'rejected', admin_notes = $1, reviewed_by = 'TELEBIRR_SMS_AUTO', reviewed_at = NOW() 
             WHERE id = $2`,
            [`Amount mismatch: You requested ${numAmount.toFixed(2)} ETB, but Telebirr received ${verifiedAmount.toFixed(2)} ETB. Auto-rejected.`, deposit.id]
          );

          return res.status(400).json({
            success: false,
            error: `Amount mismatch: You entered ${numAmount.toFixed(2)} ETB, but Telebirr received ${verifiedAmount.toFixed(2)} ETB for transaction ${cleanRef}. Please enter the exact amount transferred.`
          });
        }

        // 🛡️ SECURITY PILLAR 3: Phone Number Last-4 Bi-Directional Match
        const smsPayerPhone = matchedSms.payer_phone || '';
        const smsLast4Match = smsPayerPhone.match(/(\d{4})\)?$/);
        const smsLast4 = smsLast4Match ? smsLast4Match[1] : undefined;

        if (smsLast4 && phoneLast4 && smsLast4 !== phoneLast4) {
          console.warn(`⚠️ [SECURITY PHONE MISMATCH Cashier] Tx ${cleanRef} sender is ***${smsLast4}, player phone is ***${phoneLast4}`);
          return res.json({
            success: true,
            message: 'Deposit submitted. Cashier will verify shortly.',
            deposit: {
              id: deposit.id,
              amount: numAmount,
              paymentMethod,
              transactionRef: cleanRef,
              status: 'pending',
              note: 'Phone mismatch detected. Awaiting cashier review.',
              createdAt: deposit.created_at
            }
          });
        }

        console.log(`⚡ [Instant Auto-Approve Cashier] Verified match (ID: ${matchedSms.id}, Tx: ${matchedSms.transaction_ref}, ${verifiedAmount} ETB) for Cashier Deposit ${deposit.id}`);
        const approveResult = await executeDirectDepositApproval(deposit.id, matchedSms.transaction_ref || cleanRef, matchedSms.id);
        if (approveResult.success) {
          return res.json({
            success: true,
            message: `🎉 Deposit of ${verifiedAmount} ETB instantly verified & credited via Telebirr SMS!`,
            deposit: {
              id: deposit.id,
              amount: verifiedAmount,
              paymentMethod,
              transactionRef: cleanRef,
              status: 'approved',
              instant: true,
              createdAt: deposit.created_at
            }
          });
        }
      }
    }

    // Notify Connected Admin/Cashier in real-time
    io.emit('admin_new_deposit', {
      id: deposit.id,
      userId,
      userName: req.user!.fullName,
      phone: playerPhone,
      amount: numAmount,
      method: paymentMethod,
      reference: cleanRef,
      createdAt: deposit.created_at
    });

    return res.json({
      success: true,
      message: 'Deposit submitted successfully. Cashier will verify shortly.',
      deposit: {
        id: deposit.id,
        amount: numAmount,
        paymentMethod,
        transactionRef: cleanRef,
        status: 'pending',
        createdAt: deposit.created_at
      }
    });
  } catch (error: any) {
    console.error('❌ [Wallet Deposit Error]:', error);
    return res.status(500).json({ success: false, error: error.message || 'Deposit submission failed' });
  }
});

/**
 * 🛡️ Anti-Fraud & Responsible Gaming Financial Validation
 * - Min withdrawal: 50 ETB
 * - Max withdrawal: 2,000 ETB per transaction
 * - Max withdrawals: 3 times per day
 * - Must complete at least 5 games before becoming eligible
 */
async function verifyWithdrawalEligibility(userId: string) {
  // 1. Check completed games count (player must have played and completed at least 5 games)
  const gamesRes = await query(`
    SELECT COUNT(DISTINCT gt.round_id) as completed_games
    FROM game_tickets gt
    JOIN game_rounds gr ON gt.round_id = gr.id
    WHERE gt.user_id = $1 AND (gr.phase IN ('winner', 'ended') OR gt.status IN ('won', 'lost'))
  `, [userId]);

  const completedGames = parseInt(gamesRes.rows[0]?.completed_games || '0', 10);
  const requiredGames = 5;

  // 2. Check today's withdrawal count across central & agent requests
  const todayRes = await query(`
    SELECT COUNT(*) as today_count 
    FROM (
      SELECT id FROM withdrawal_requests 
      WHERE user_id = $1 AND created_at >= CURRENT_DATE AND status IN ('pending', 'approved', 'completed')
      UNION ALL
      SELECT id FROM agent_withdrawal_requests 
      WHERE player_id = $1 AND created_at >= CURRENT_DATE AND status IN ('pending', 'approved')
    ) t
  `, [userId]);

  const todayWithdrawals = parseInt(todayRes.rows[0]?.today_count || '0', 10);
  const maxDailyWithdrawals = 3;

  let eligible = true;
  let reason = '';

  if (completedGames < requiredGames) {
    eligible = false;
    reason = `A player must complete at least ${requiredGames} games before becoming eligible to withdraw. You have completed ${completedGames}/${requiredGames} games.`;
  } else if (todayWithdrawals >= maxDailyWithdrawals) {
    eligible = false;
    reason = `Maximum ${maxDailyWithdrawals} withdrawals allowed per day. Please try again tomorrow.`;
  }

  return {
    eligible,
    completedGames,
    requiredGames,
    todayWithdrawals,
    maxDailyWithdrawals,
    minAmount: 50,
    maxAmount: 2000,
    reason: eligible ? undefined : reason
  };
}

/**
 * GET /api/wallet/withdrawal-eligibility
 * Returns live player eligibility metrics for the client withdrawal modal
 */
router.get('/withdrawal-eligibility', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const status = await verifyWithdrawalEligibility(userId);
    return res.json({ success: true, ...status });
  } catch (err: any) {
    console.error('❌ [Withdrawal Eligibility Check Error]:', err);
    return res.status(500).json({ success: false, error: 'Failed to verify withdrawal eligibility' });
  }
});

/**
 * Submit Withdrawal Request with Atomic Balance Lock
 */
router.post('/withdraw', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { amount, paymentMethod, accountPhone, accountName } = req.body;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 50 || numAmount > 2000) {
      return res.status(400).json({ success: false, error: 'Withdrawal amount must be between 50 and 2,000 ETB per transaction.' });
    }

    // 🛡️ Enforce anti-fraud eligibility rules (completed 5 games, max 3/day)
    const eligibility = await verifyWithdrawalEligibility(userId);
    if (!eligibility.eligible) {
      return res.status(400).json({ success: false, error: eligibility.reason });
    }

    if (!paymentMethod || !['Telebirr', 'CBE', 'M-Pesa'].includes(paymentMethod)) {
      return res.status(400).json({ success: false, error: 'Payment method must be Telebirr, CBE, or M-Pesa.' });
    }

    if (!accountPhone || accountPhone.trim().length < 8) {
      return res.status(400).json({ success: false, error: 'Valid account phone/number is required.' });
    }

    // Execute withdrawal deduction with ACID row-lock on wallet
    const result = await withTransaction(async (client) => {
      // 1. Lock wallet row for update
      const walletRes = await client.query(
        'SELECT balance, bonus FROM wallets WHERE user_id = $1 FOR UPDATE',
        [userId]
      );

      if (walletRes.rows.length === 0) {
        throw new Error('Wallet not found.');
      }

      const currentBalance = parseFloat(walletRes.rows[0].balance);
      if (currentBalance < numAmount) {
        throw new Error(`Insufficient balance. Available: ${currentBalance.toFixed(2)} ETB`);
      }

      const newBalance = currentBalance - numAmount;

      // 2. Deduct balance
      await client.query(
        'UPDATE wallets SET balance = $1, updated_at = NOW() WHERE user_id = $2',
        [newBalance, userId]
      );

      // 3. Create withdrawal request
      const withdrawRes = await client.query(
        `INSERT INTO withdrawal_requests (user_id, amount, payment_method, account_phone, account_name, status)
         VALUES ($1, $2, $3, $4, $5, 'pending')
         RETURNING *`,
        [userId, numAmount, paymentMethod, accountPhone.trim(), accountName || req.user!.fullName]
      );

      // 4. Record pending transaction in ledger
      const txRef = `WD-${paymentMethod.toUpperCase()}-${Date.now().toString().slice(-6)}`;
      await client.query(
        `INSERT INTO wallet_transactions (user_id, type, amount, balance_after, reference_code, status, payment_method, description)
         VALUES ($1, 'withdrawal', $2, $3, $4, 'pending', $5, $6)`,
        [userId, numAmount, newBalance, txRef, paymentMethod, `Withdrawal to ${paymentMethod} (${accountPhone})`]
      );

      return {
        withdrawal: withdrawRes.rows[0],
        newBalance
      };
    });

    // Notify Connected Admin/Cashier in real-time
    io.emit('admin_new_withdrawal', {
      id: result.withdrawal.id,
      userId,
      userName: req.user!.fullName,
      phone: accountPhone,
      amount: numAmount,
      method: paymentMethod,
      createdAt: result.withdrawal.created_at
    });

    return res.json({
      success: true,
      message: 'Withdrawal request submitted successfully.',
      newBalance: result.newBalance,
      withdrawal: result.withdrawal
    });
  } catch (error: any) {
    console.error('❌ [Wallet Withdraw Error]:', error);
    return res.status(400).json({ success: false, error: error.message || 'Withdrawal failed' });
  }
});

/**
 * Get User Transaction History (Unified Decentralized Agent Deposits, Withdrawals & Ledger)
 */
router.get('/transactions', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;

    // 1. Fetch agent deposit requests (new decentralized cashier)
    const agentDepRes = await query(
      `SELECT adr.id, adr.amount, adr.payment_method, adr.player_phone, adr.transaction_code,
              adr.screenshot_url, adr.status, adr.rejection_reason, adr.created_at, adr.resolved_at,
              ap.agent_code, COALESCE(u.full_name, ap.telebirr_name, CONCAT('Sonic Agent #', ap.agent_code)) as agent_name
       FROM agent_deposit_requests adr
       LEFT JOIN agent_profiles ap ON adr.agent_id = ap.id
       LEFT JOIN users u ON ap.user_id = u.id
       WHERE adr.player_id = $1
       ORDER BY adr.created_at DESC
       LIMIT 50`,
      [userId]
    );

    // 2. Fetch agent withdrawal requests (new decentralized cashier)
    const agentWithRes = await query(
      `SELECT awr.id, awr.amount, awr.payout_method, awr.payout_account, awr.payout_account_name,
              awr.agent_tx_ref, awr.status, awr.rejection_reason, awr.created_at, awr.resolved_at,
              ap.agent_code, COALESCE(u.full_name, ap.telebirr_name, CONCAT('Sonic Agent #', ap.agent_code)) as agent_name
       FROM agent_withdrawal_requests awr
       LEFT JOIN agent_profiles ap ON awr.agent_id = ap.id
       LEFT JOIN users u ON ap.user_id = u.id
       WHERE awr.player_id = $1
       ORDER BY awr.created_at DESC
       LIMIT 50`,
      [userId]
    );

    // 3. Fetch legacy deposit requests
    const depRes = await query(
      `SELECT id, amount, payment_method, player_phone, transaction_ref, 
              (receipt_image IS NOT NULL AND receipt_image != '' AND receipt_image NOT LIKE '[ARCHIVED%') as has_receipt,
              status, created_at, reviewed_at
       FROM deposit_requests
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    );

    // 4. Fetch legacy withdrawal requests
    const withRes = await query(
      `SELECT id, amount, payment_method, account_phone, account_name, status, created_at, reviewed_at
       FROM withdrawal_requests
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    );

    // 5. Fetch completed wallet ledger entries
    const txRes = await query(
      `SELECT id, type, amount, balance_after, reference_code, status, payment_method, description, created_at
       FROM wallet_transactions 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [userId]
    );

    // Format Agent Deposits
    const agentDeposits = agentDepRes.rows.map(d => ({
      id: d.id,
      userId,
      userName: req.user!.fullName,
      phone: d.player_phone,
      accountNumber: d.player_phone,
      type: 'deposit' as const,
      amount: parseFloat(d.amount),
      method: d.payment_method,
      referenceNumber: d.transaction_code,
      receiptImage: d.screenshot_url || undefined,
      status: (d.status === 'completed' ? 'approved' : d.status) as 'pending' | 'approved' | 'rejected',
      adminNote: d.status === 'rejected' ? d.rejection_reason : (d.agent_name ? `Via ${d.agent_name}` : undefined),
      agentCode: d.agent_code,
      agentName: d.agent_name,
      createdAt: d.created_at,
      timestamp: d.created_at
    }));

    // Format Agent Withdrawals
    const agentWithdrawals = agentWithRes.rows.map(w => ({
      id: w.id,
      userId,
      userName: w.payout_account_name || req.user!.fullName,
      phone: w.payout_account,
      accountNumber: w.payout_account,
      type: 'withdrawal' as const,
      amount: parseFloat(w.amount),
      method: w.payout_method,
      referenceNumber: w.agent_tx_ref || `WD-AGT-${w.id.slice(0, 8)}`,
      receiptImage: undefined,
      status: (w.status === 'completed' || w.status === 'approved' ? 'approved' : w.status === 'cancelled' ? 'rejected' : w.status) as 'pending' | 'approved' | 'rejected',
      adminNote: w.status === 'rejected' || w.status === 'cancelled'
        ? (w.rejection_reason || 'Request cancelled')
        : (w.agent_name ? `Via ${w.agent_name}` : undefined),
      agentCode: w.agent_code,
      agentName: w.agent_name,
      createdAt: w.created_at,
      timestamp: w.created_at
    }));

    // Format Legacy Deposits
    const legacyDeposits = depRes.rows.map(d => ({
      id: d.id,
      userId,
      userName: req.user!.fullName,
      phone: d.player_phone,
      accountNumber: d.player_phone,
      type: 'deposit' as const,
      amount: parseFloat(d.amount),
      method: d.payment_method,
      referenceNumber: d.transaction_ref,
      receiptImage: d.has_receipt ? `/api/wallet/deposits/${d.id}/receipt` : undefined,
      status: d.status as 'pending' | 'approved' | 'rejected',
      createdAt: d.created_at,
      timestamp: d.created_at
    }));

    // Format Legacy Withdrawals
    const legacyWithdrawals = withRes.rows.map(w => ({
      id: w.id,
      userId,
      userName: w.account_name || req.user!.fullName,
      phone: w.account_phone,
      accountNumber: w.account_phone,
      type: 'withdrawal' as const,
      amount: parseFloat(w.amount),
      method: w.payment_method,
      referenceNumber: `WD-${w.payment_method.toUpperCase()}-${w.id.slice(0, 8)}`,
      receiptImage: undefined,
      status: w.status as 'pending' | 'approved' | 'rejected',
      createdAt: w.created_at,
      timestamp: w.created_at
    }));

    const ledger = txRes.rows.map(t => ({
      id: t.id,
      userId,
      userName: req.user!.fullName,
      phone: req.user!.phone || '',
      accountNumber: req.user!.phone || '',
      type: t.type,
      amount: parseFloat(t.amount),
      method: t.payment_method || 'System',
      referenceNumber: t.reference_code,
      status: t.status,
      description: t.description,
      createdAt: t.created_at,
      timestamp: t.created_at
    }));

    // Combine and sort by createdAt DESC
    const all = [...agentDeposits, ...agentWithdrawals, ...legacyDeposits, ...legacyWithdrawals].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return res.json({
      success: true,
      transactions: all,
      ledger
    });
  } catch (error: any) {
    console.error('❌ [Wallet Transactions Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve transaction history' });
  }
});

/**
 * Stream Single Deposit Receipt Image On-Demand for Player
 */
router.get('/deposits/:id/receipt', async (req, res) => {
  try {
    const depositId = req.params.id;

    // UUID format validation guard
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(depositId)) {
      return res.status(400).send('Invalid receipt ID');
    }

    const receiptRes = await query(
      'SELECT receipt_image FROM deposit_requests WHERE id = $1',
      [depositId]
    );

    if (receiptRes.rows.length === 0 || !receiptRes.rows[0].receipt_image) {
      return res.status(404).send('Receipt not found');
    }

    const rawData = receiptRes.rows[0].receipt_image.trim();
    if (rawData.startsWith('[ARCHIVED')) {
      return res.status(404).send('Receipt image has been archived');
    }

    if (rawData.startsWith('http://') || rawData.startsWith('https://')) {
      return res.redirect(rawData);
    }

    const dataUriMatch = rawData.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/s);
    if (dataUriMatch) {
      const mimeSubtype = dataUriMatch[1].toLowerCase();
      const base64Data = dataUriMatch[2];
      const buffer = Buffer.from(base64Data, 'base64');
      const contentType = mimeSubtype === 'jpg' ? 'image/jpeg' : `image/${mimeSubtype}`;

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Cache-Control', 'private, max-age=86400');
      return res.end(buffer);
    }

    const buffer = Buffer.from(rawData, 'base64');
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    return res.end(buffer);
  } catch (error: any) {
    console.error('❌ [Wallet Receipt Stream Error]:', error);
    return res.status(500).send('Failed to stream receipt');
  }
});

/**
 * GET /api/wallet/referrals
 * Returns live real referral stats, unique referral link, and friends list
 */
router.get('/referrals', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;

    // 1. Get or generate user's referral code
    const userRes = await query('SELECT referral_code FROM users WHERE id = $1', [userId]);
    let referralCode = userRes.rows[0]?.referral_code;

    if (!referralCode) {
      referralCode = 'SONIC-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      await query('UPDATE users SET referral_code = $1 WHERE id = $2', [referralCode, userId]);
    }

    const referralLink = `https://t.me/SonicGameOfficialBot/play?startapp=ref_${referralCode}`;

    // 2. Fetch real referrals data from Neon DB
    const friendsRes = await query(
      `SELECT 
         r.id,
         u.full_name as name,
         COALESCE(u.avatar, '👤') as avatar,
         COALESCE(r.is_telegram_premium, false) as "isPremium",
         r.created_at as "joinedAt",
         COALESCE(r.deposit_amount, 0) as "depositAmount",
         COALESCE(r.reward_amount, 0) as "bonusEarned",
         r.status
       FROM referrals r
       JOIN users u ON r.referred_user_id = u.id
       WHERE r.referrer_id = $1
       ORDER BY r.created_at DESC
       LIMIT 100`,
      [userId]
    );

    const friends = friendsRes.rows.map(f => ({
      id: f.id,
      name: f.name,
      avatar: f.avatar,
      isPremium: f.isPremium,
      joinedAt: f.joinedAt,
      depositAmount: parseFloat(f.depositAmount),
      bonusEarned: parseFloat(f.bonusEarned),
      status: f.status === 'rewarded' ? 'paid' : 'pending_deposit'
    }));

    const totalInvited = friends.length;
    const totalEarned = friends.reduce((acc, f) => acc + f.bonusEarned, 0);

    return res.json({
      success: true,
      referralCode,
      referralLink,
      totalInvited,
      totalEarned,
      friends
    });
  } catch (error: any) {
    console.error('❌ [Wallet Referrals Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve referral data' });
  }
});

/**
 * GET /api/wallet/game-history
 * Returns user's personal game & bet history, win/loss stats, and tickets grouped by round
 */
router.get('/game-history', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;

    // 1. Authoritative Personal Tickets from Neon DB (Phase 4: omit heavy card_matrix)
    const ticketsRes = await query(`
      SELECT 
        gt.id as ticket_id,
        gt.round_id,
        gt.cartela_id,
        gt.bet_amount,
        gt.status as ticket_status,
        gt.created_at as bet_time,
        gr.room_id,
        gr.round_number,
        gr.phase,
        gr.drawn_numbers,
        gr.total_pot,
        gr.winner_payout,
        gr.winner_user_ids,
        gr.winner_cartelas,
        gr.winner_names,
        gr.ended_at,
        COALESCE(rm.name, gr.room_id) as room_name
      FROM game_tickets gt
      JOIN game_rounds gr ON gt.round_id = gr.id
      LEFT JOIN game_rooms rm ON gr.room_id = rm.id
      WHERE gt.user_id = $1
      ORDER BY gt.created_at DESC
      LIMIT 100
    `, [userId]);

    const roundsMap = new Map<string, any>();

    for (const row of ticketsRes.rows) {
      if (!roundsMap.has(row.round_id)) {
        const winnerUserIds = Array.isArray(row.winner_user_ids)
          ? row.winner_user_ids
          : (typeof row.winner_user_ids === 'string' ? JSON.parse(row.winner_user_ids || '[]') : []);
        const winnerCartelas = Array.isArray(row.winner_cartelas)
          ? row.winner_cartelas
          : (typeof row.winner_cartelas === 'string' ? JSON.parse(row.winner_cartelas || '[]') : []);
        const winnerNames = Array.isArray(row.winner_names)
          ? row.winner_names
          : (typeof row.winner_names === 'string' ? JSON.parse(row.winner_names || '[]') : []);
        const drawnNumbers = Array.isArray(row.drawn_numbers)
          ? row.drawn_numbers
          : (typeof row.drawn_numbers === 'string' ? JSON.parse(row.drawn_numbers || '[]') : []);

        const betTimeMs = new Date(row.bet_time || Date.now()).getTime();
        const ageMs = Date.now() - betTimeMs;
        const isStale = row.phase === 'playing' && ageMs > 2 * 60 * 1000;
        const resolvedPhase = isStale ? 'ended' : row.phase;
        const isRefunded = row.ticket_status === 'refunded' || winnerNames.includes('Refunded');

        roundsMap.set(row.round_id, {
          roundId: row.round_id,
          roomId: row.room_id,
          roomName: row.room_name,
          roundNumber: row.round_number,
          phase: resolvedPhase,
          status: isRefunded ? 'refunded' : (resolvedPhase === 'ended' ? 'ended' : 'in_progress'),
          totalPot: parseFloat(row.total_pot || '0'),
          winnerPayout: parseFloat(row.winner_payout || '0'),
          winnerNames,
          winnerCartelas,
          winnerUserIds,
          drawnNumbers,
          endedAt: row.ended_at,
          betTime: row.bet_time,
          tickets: [],
          totalStake: 0,
          isWinner: false,
          userWonAmount: 0,
          netPnl: 0,
          isLive: resolvedPhase !== 'ended' && !isRefunded
        });
      }

      const round = roundsMap.get(row.round_id);
      const betAmt = parseFloat(row.bet_amount || '0');
      round.totalStake += betAmt;

      const isWinningCartela = round.winnerCartelas.includes(row.cartela_id);
      if (isWinningCartela) {
        round.isWinner = true;
      }

      // Phase 4: Deterministic RAM Reconstruction (drops ~2 KB per ticket over Neon connection)
      const cardMatrix = row.cartela_id ? generateCardFromId(Number(row.cartela_id)) : [];

      round.tickets.push({
        id: row.ticket_id,
        cartelaId: row.cartela_id,
        cardMatrix,
        betAmount: betAmt,
        isWinner: isWinningCartela,
        status: row.ticket_status
      });
    }

    // 2. Real-Time In-Flight Personal Tickets (Lobby, Playing, or Lone-Player Rollover)
    try {
      const liveActiveRounds = gameEngine.getUserActiveTickets(userId);
      for (const active of liveActiveRounds) {
        const existingKey = active.roundId;
        if (existingKey && roundsMap.has(existingKey)) {
          // Already in DB roundsMap, skip duplicate
          continue;
        }

        const liveRoundKey = active.roundId || `live_${active.roomId}_${active.roundNumber}_${active.isQueued ? 'q' : 'a'}`;
        const totalStake = active.tickets.reduce((sum, t) => sum + t.betAmount, 0);

        roundsMap.set(liveRoundKey, {
          roundId: liveRoundKey,
          roomId: active.roomId,
          roomName: active.roomName,
          roundNumber: active.roundNumber,
          phase: active.isQueued ? 'queued' : active.phase,
          status: active.isQueued ? 'queued' : 'in_progress',
          totalPot: active.totalPot,
          winnerPayout: active.winnerPayout,
          winnerNames: [],
          winnerCartelas: [],
          winnerUserIds: [],
          drawnNumbers: [],
          endedAt: null,
          betTime: new Date().toISOString(),
          tickets: active.tickets.map((t, idx) => ({
            id: `live_ticket_${idx}_${t.cartelaId}`,
            cartelaId: t.cartelaId,
            cardMatrix: t.cardMatrix,
            betAmount: t.betAmount,
            isWinner: false,
            status: active.isQueued ? 'queued' : 'in_progress'
          })),
          totalStake,
          isWinner: false,
          userWonAmount: 0,
          netPnl: 0,
          isLive: true
        });
      }
    } catch (liveErr) {
      console.warn('⚠️ [Wallet Game History] Could not query live active tickets from engine:', liveErr);
    }

    // 3. Fallback Reconciliation with Financial Ledger (wallet_transactions)
    try {
      const txRes = await query(`
        SELECT id, type, amount, description, status, created_at
        FROM wallet_transactions
        WHERE user_id = $1 AND type IN ('bet', 'win')
        ORDER BY created_at DESC
        LIMIT 50
      `, [userId]);

      const betTxs = txRes.rows.filter((tx: any) => tx.type === 'bet');
      const winTxs = txRes.rows.filter((tx: any) => tx.type === 'win');

      for (const betTx of betTxs) {
        const betTime = new Date(betTx.created_at).getTime();
        // Check if an existing round in roundsMap matches within ~3 minutes
        const hasMatchingRound = Array.from(roundsMap.values()).some(r => {
          const roundTime = new Date(r.betTime).getTime();
          return Math.abs(roundTime - betTime) < 3 * 60 * 1000;
        });

        if (!hasMatchingRound) {
          // Synthesize an audited historical round from ledger
          const betAmt = parseFloat(betTx.amount || '0');
          const roomMatch = (betTx.description || '').match(/(?:in\s+)?(\d+\s+Birr\s+Room|VIP\s+Room)/i);
          const roomName = roomMatch ? roomMatch[1] : 'Live Bingo Room';

          // Check if there was a corresponding win within 3 minutes after this bet
          const matchingWin = winTxs.find((w: any) => {
            const wTime = new Date(w.created_at).getTime();
            return wTime >= betTime && wTime - betTime <= 3 * 60 * 1000;
          });

          const isWin = !!matchingWin;
          const userWonAmount = matchingWin ? parseFloat(matchingWin.amount || '0') : 0;
          const cartelaMatch = (betTx.description || '').match(/(\d+)\s+cartela/i);
          const cartelaCount = cartelaMatch ? parseInt(cartelaMatch[1], 10) : 1;

          const syntheticRoundId = `tx_${betTx.id}`;
          roundsMap.set(syntheticRoundId, {
            roundId: syntheticRoundId,
            roomId: 'room-history',
            roomName,
            roundNumber: 0,
            phase: 'ended',
            status: 'ended',
            totalPot: isWin ? userWonAmount : betAmt * 2,
            winnerPayout: isWin ? userWonAmount : 0,
            winnerNames: isWin ? [req.user!.fullName || 'You'] : ['House Winner'],
            winnerCartelas: [],
            winnerUserIds: isWin ? [userId] : [],
            drawnNumbers: [],
            endedAt: betTx.created_at,
            betTime: betTx.created_at,
            tickets: Array.from({ length: cartelaCount }).map((_, i) => ({
              id: `tx_ticket_${betTx.id}_${i + 1}`,
              cartelaId: i + 1,
              cardMatrix: [],
              betAmount: betAmt / cartelaCount,
              isWinner: isWin,
              status: isWin ? 'won' : 'lost'
            })),
            totalStake: betAmt,
            isWinner: isWin,
            userWonAmount,
            netPnl: userWonAmount - betAmt,
            isLive: false
          });
        }
      }
    } catch (txReconcileErr) {
      console.warn('⚠️ [Wallet Game History] Could not reconcile wallet transactions:', txReconcileErr);
    }

    // 4. Sort All Personal Rounds by Time Descending
    const rounds = Array.from(roundsMap.values()).sort((a, b) => {
      return new Date(b.betTime).getTime() - new Date(a.betTime).getTime();
    });

    // 5. Accurate Personal Metrics Calculation
    let totalGames = rounds.length;
    let totalWins = 0;
    let totalLosses = 0;
    let totalStaked = 0;
    let totalWon = 0;

    for (const r of rounds) {
      totalStaked += r.totalStake;

      if (r.status === 'refunded') {
        r.isWinner = false;
        r.userWonAmount = 0;
        r.netPnl = 0;
      } else if (r.phase === 'ended') {
        if (r.winnerUserIds.includes(userId)) {
          r.isWinner = true;
        }

        if (r.isWinner) {
          totalWins++;
          if (r.userWonAmount === 0) {
            const userWinningCartelaCount = r.tickets.filter((t: any) => t.isWinner).length || 1;
            const totalWinningCards = (r.winnerCartelas && r.winnerCartelas.length) || 1;
            const perCard = r.winnerPayout / totalWinningCards;
            r.userWonAmount = userWinningCartelaCount * perCard;
          }
          totalWon += r.userWonAmount;
        } else {
          totalLosses++;
          r.userWonAmount = 0;
        }
        r.netPnl = r.userWonAmount - r.totalStake;
      } else {
        // Round is in-flight: 'playing', 'lobby', or 'queued'
        r.status = r.phase === 'queued' ? 'queued' : 'in_progress';
        r.isPending = true;
        r.netPnl = 0;
      }
    }

    const netProfit = totalWon - totalStaked;
    const completedGames = totalWins + totalLosses;
    const winRate = completedGames > 0 ? Math.round((totalWins / completedGames) * 1000) / 10 : 0;

    return res.json({
      success: true,
      summary: {
        totalGames,
        totalWins,
        totalLosses,
        winRate,
        totalStaked,
        totalWon,
        netProfit,
      },
      rounds
    });
  } catch (error: any) {
    console.error('❌ [Wallet Game History Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve game history' });
  }
});

/**
 * GET /api/wallet/recent-games
 * Public & authenticated ledger of recent completed rounds across rooms with stake filtering & search
 */
router.get('/recent-games', optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const currentUserId = req.user?.id || null;
    const { roomId, search, limit = '50', offset = '0' } = req.query;

    const parsedLimit = Math.min(Math.max(parseInt(limit as string, 10) || 50, 1), 100);
    const parsedOffset = Math.max(parseInt(offset as string, 10) || 0, 0);

    const conditions: string[] = ["gr.phase = 'ended'"];
    const params: any[] = [];
    let pIdx = 1;

    // Optional user ID for participation check ($1)
    params.push(currentUserId);
    pIdx++; // 2

    // Filter by roomId (e.g. 'room-10', 'room-20', 'room-50', 'room-100')
    if (roomId && roomId !== 'all' && typeof roomId === 'string') {
      conditions.push(`gr.room_id = $${pIdx}`);
      params.push(roomId);
      pIdx++;
    }

    // Filter by search query (e.g. '1042', '#1042', or round id)
    if (search && typeof search === 'string' && search.trim()) {
      const cleanSearch = search.trim().replace(/^#/, '');
      if (/^\d+$/.test(cleanSearch)) {
        conditions.push(`(gr.round_number = $${pIdx} OR gr.id::text ILIKE $${pIdx + 1})`);
        params.push(parseInt(cleanSearch, 10), `%${cleanSearch}%`);
        pIdx += 2;
      } else {
        conditions.push(`gr.id::text ILIKE $${pIdx}`);
        params.push(`%${cleanSearch}%`);
        pIdx++;
      }
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const limitParam = `$${pIdx}`;
    const offsetParam = `$${pIdx + 1}`;
    params.push(parsedLimit, parsedOffset);

    const sql = `
      SELECT 
        gr.id,
        gr.room_id,
        gr.round_number,
        gr.phase,
        gr.drawn_numbers,
        gr.total_pot,
        gr.platform_fee,
        gr.winner_payout,
        gr.winner_user_ids,
        gr.winner_cartelas,
        gr.winner_names,
        gr.started_at,
        gr.ended_at,
        gr.created_at,
        COALESCE(rm.name, gr.room_id) as room_name,
        COALESCE(rm.stake_amount, 
          CASE 
            WHEN gr.room_id = 'room-10' THEN 10
            WHEN gr.room_id = 'room-20' THEN 20
            WHEN gr.room_id = 'room-50' THEN 50
            WHEN gr.room_id = 'room-100' THEN 100
            ELSE 10 
          END
        ) as room_stake,
        (
          SELECT COUNT(*) FROM game_tickets gt WHERE gt.round_id = gr.id
        ) as total_tickets,
        CASE 
          WHEN $1::text IS NOT NULL THEN EXISTS (
            SELECT 1 FROM game_tickets gt WHERE gt.round_id = gr.id AND gt.user_id::text = $1
          )
          ELSE false
        END as user_participated
      FROM game_rounds gr
      LEFT JOIN game_rooms rm ON gr.room_id = rm.id
      ${whereClause}
      ORDER BY gr.ended_at DESC NULLS LAST, gr.created_at DESC
      LIMIT ${limitParam} OFFSET ${offsetParam}
    `;

    const result = await query(sql, params);

    const rounds = result.rows.map(row => {
      const drawn = Array.isArray(row.drawn_numbers) ? row.drawn_numbers : [];
      const winnerNames = Array.isArray(row.winner_names) ? row.winner_names : [];
      const winnerCartelas = Array.isArray(row.winner_cartelas) ? row.winner_cartelas : [];
      const winnerUserIds = Array.isArray(row.winner_user_ids) ? row.winner_user_ids : [];

      return {
        id: row.id,
        roomId: row.room_id,
        roomName: row.room_name,
        roomStake: parseFloat(row.room_stake || '10'),
        roundNumber: row.round_number,
        phase: row.phase,
        drawnNumbers: drawn,
        ballsCount: drawn.length,
        totalPot: parseFloat(row.total_pot || '0'),
        platformFee: parseFloat(row.platform_fee || '0'),
        winnerPayout: parseFloat(row.winner_payout || '0'),
        winnerNames,
        winnerCartelas,
        winnerUserIds,
        endedAt: row.ended_at || row.created_at,
        totalTickets: parseInt(row.total_tickets || '0', 10),
        userParticipated: Boolean(row.user_participated)
      };
    });

    return res.json({
      success: true,
      rounds,
      total: rounds.length,
      limit: parsedLimit,
      offset: parsedOffset
    });
  } catch (error: any) {
    console.error('❌ [Wallet Recent Games Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve recent games' });
  }
});

/**
 * GET /api/wallet/coins
 * Retrieve Player's Current Coin Balance & Coin Transaction Ledger
 */
router.get('/coins', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const summary = await coinService.getUserCoins(userId);
    return res.json({
      success: true,
      coins: summary.balance,
      lifetimeEarned: summary.lifetimeEarned,
      lifetimeRedeemed: summary.lifetimeRedeemed,
      transactions: summary.transactions,
      rate: {
        earning: '1.5 coins per 1 ETB deposit',
        redemption: '1,000 coins = 10 ETB bonus'
      }
    });
  } catch (error: any) {
    console.error('❌ [Wallet Coins Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve coin details' });
  }
});

/**
 * POST /api/wallet/redeem-coins
 * Exchange 1,000 Coins for 20.00 ETB Game Play Bonus (Non-Withdrawable)
 */
router.post('/redeem-coins', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const coins = typeof req.body.coins === 'number' ? req.body.coins : 1000;

    const result = await coinService.redeemCoinsForBonus(userId, coins);
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    return res.json({
      success: true,
      message: `Successfully redeemed ${result.coinsRedeemed} coins for ${result.bonusAwarded} ETB bonus!`,
      coinsRedeemed: result.coinsRedeemed,
      bonusAwarded: result.bonusAwarded,
      newCoinBalance: result.newCoinBalance,
      newBonusBalance: result.newBonusBalance
    });
  } catch (error: any) {
    console.error('❌ [Wallet Redeem Coins Error]:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to redeem coins' });
  }
});

/**
 * Generate Secure 6-Character Voucher Code Helper
 */
function generateVoucherCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = 'CW-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * POST /api/wallet/agent-voucher/create
 * Player requests Cash-Out Voucher to withdraw at any authorized Agent Counter
 */
router.post('/agent-voucher/create', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { amount } = req.body;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 50 || numAmount > 2000) {
      return res.status(400).json({ success: false, error: 'Withdrawal amount must be between 50 and 2,000 ETB per transaction.' });
    }

    // 🛡️ Enforce anti-fraud eligibility rules (completed 5 games, max 3/day)
    const eligibility = await verifyWithdrawalEligibility(userId);
    if (!eligibility.eligible) {
      return res.status(400).json({ success: false, error: eligibility.reason });
    }

    // Check if player already has an active pending voucher
    const existingVoucher = await query(
      `SELECT id, voucher_code, amount, expires_at 
       FROM agent_cashout_vouchers 
       WHERE user_id = $1 AND status = 'pending' AND expires_at > NOW()`,
      [userId]
    );

    if (existingVoucher.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'You already have an active cash-out voucher. Please redeem or cancel it first.',
        activeVoucher: existingVoucher.rows[0]
      });
    }

    const result = await withTransaction(async (client) => {
      // 1. Lock wallet
      const walletRes = await client.query(
        'SELECT balance, locked_balance FROM wallets WHERE user_id = $1 FOR UPDATE',
        [userId]
      );

      if (walletRes.rows.length === 0) {
        throw new Error('Wallet not found');
      }

      const balance = parseFloat(walletRes.rows[0].balance || '0');
      const locked = parseFloat(walletRes.rows[0].locked_balance || '0');

      if (balance < numAmount) {
        throw new Error(`Insufficient withdrawable cash balance (${balance.toFixed(2)} ETB).`);
      }

      // 2. Transfer funds to locked_balance (escrow)
      const newBalance = balance - numAmount;
      const newLocked = locked + numAmount;

      await client.query(
        'UPDATE wallets SET balance = $1, locked_balance = $2, updated_at = NOW() WHERE user_id = $3',
        [newBalance, newLocked, userId]
      );

      // 3. Generate unique voucher code
      let voucherCode = generateVoucherCode();
      let isUnique = false;
      let attempts = 0;

      while (!isUnique && attempts < 5) {
        const check = await client.query('SELECT id FROM agent_cashout_vouchers WHERE voucher_code = $1', [voucherCode]);
        if (check.rows.length === 0) {
          isUnique = true;
        } else {
          voucherCode = generateVoucherCode();
          attempts++;
        }
      }

      // 4. Create voucher record
      const voucherRes = await client.query(
        `INSERT INTO agent_cashout_vouchers (voucher_code, user_id, amount, status)
         VALUES ($1, $2, $3, 'pending')
         RETURNING *`,
        [voucherCode, userId, numAmount]
      );

      return {
        voucher: voucherRes.rows[0],
        newBalance,
        newLocked
      };
    });

    // Notify user via Socket
    io.emit(`user_${userId}_balance`, {
      type: 'voucher_created',
      amount: numAmount,
      newBalance: result.newBalance,
      lockedBalance: result.newLocked
    });
    io.emit('user_balance_updated', { userId });

    return res.json({
      success: true,
      message: `Voucher ${result.voucher.voucher_code} created! Present this code to any agent to collect cash.`,
      voucher: {
        id: result.voucher.id,
        voucherCode: result.voucher.voucher_code,
        amount: parseFloat(result.voucher.amount),
        status: result.voucher.status,
        createdAt: result.voucher.created_at,
        expiresAt: result.voucher.expires_at
      },
      newBalance: result.newBalance
    });
  } catch (error: any) {
    console.error('❌ [Wallet Create Voucher Error]:', error);
    return res.status(400).json({ success: false, error: error.message || 'Failed to create voucher' });
  }
});

/**
 * POST /api/wallet/agent-voucher/cancel
 * Player cancels pending voucher before redemption and unlocks funds
 */
router.post('/agent-voucher/cancel', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { voucherId } = req.body;

    const result = await withTransaction(async (client) => {
      // 1. Lock voucher
      const voucherRes = await client.query(
        `SELECT * FROM agent_cashout_vouchers 
         WHERE user_id = $1 AND status = 'pending' AND ($2::uuid IS NULL OR id = $2::uuid)
         FOR UPDATE`,
        [userId, voucherId || null]
      );

      if (voucherRes.rows.length === 0) {
        throw new Error('No pending voucher found to cancel.');
      }

      const voucher = voucherRes.rows[0];
      const refundAmount = parseFloat(voucher.amount);

      // 2. Mark voucher cancelled
      await client.query(
        `UPDATE agent_cashout_vouchers 
         SET status = 'cancelled' 
         WHERE id = $1`,
        [voucher.id]
      );

      // 3. Unlock funds in player wallet
      const walletRes = await client.query(
        'SELECT balance, locked_balance FROM wallets WHERE user_id = $1 FOR UPDATE',
        [userId]
      );

      const balance = parseFloat(walletRes.rows[0].balance || '0');
      const locked = parseFloat(walletRes.rows[0].locked_balance || '0');

      const newBalance = balance + refundAmount;
      const newLocked = Math.max(0, locked - refundAmount);

      await client.query(
        'UPDATE wallets SET balance = $1, locked_balance = $2, updated_at = NOW() WHERE user_id = $3',
        [newBalance, newLocked, userId]
      );

      return {
        voucherCode: voucher.voucher_code,
        refundAmount,
        newBalance,
        newLocked
      };
    });

    // Notify user via Socket
    io.emit(`user_${userId}_balance`, {
      type: 'voucher_cancelled',
      amount: result.refundAmount,
      newBalance: result.newBalance,
      lockedBalance: result.newLocked
    });
    io.emit('user_balance_updated', { userId });

    return res.json({
      success: true,
      message: `Voucher ${result.voucherCode} cancelled. ${result.refundAmount.toFixed(2)} ETB returned to your balance.`,
      newBalance: result.newBalance
    });
  } catch (error: any) {
    console.error('❌ [Wallet Cancel Voucher Error]:', error);
    return res.status(400).json({ success: false, error: error.message || 'Failed to cancel voucher' });
  }
});

/**
 * GET /api/wallet/agent-voucher/active
 * Get Player's Active Cash-Out Voucher
 */
router.get('/agent-voucher/active', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const voucherRes = await query(
      `SELECT * FROM agent_cashout_vouchers 
       WHERE user_id = $1 AND status = 'pending' AND expires_at > NOW()
       ORDER BY created_at DESC 
       LIMIT 1`,
      [userId]
    );

    if (voucherRes.rows.length === 0) {
      return res.json({ success: true, hasActiveVoucher: false, voucher: null });
    }

    const v = voucherRes.rows[0];
    return res.json({
      success: true,
      hasActiveVoucher: true,
      voucher: {
        id: v.id,
        voucherCode: v.voucher_code,
        amount: parseFloat(v.amount),
        status: v.status,
        createdAt: v.created_at,
        expiresAt: v.expires_at
      }
    });
  } catch (error: any) {
    console.error('❌ [Wallet Active Voucher Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve active voucher' });
  }
});

/**
 * GET /api/wallet/agents/active (and /api/wallet/agents/available)
 * Get Active Authorized Agents for Player Counter Deposits & Cash-Outs
 * STRICT PRIVACY: Agent real names are REDACTED. Only Unique Agent Codes and payment rails are returned.
 */
router.get(['/agents/active', '/agents/available'], async (_req, res) => {
  try {
    const agentsRes = await query(
      `SELECT ap.id, ap.agent_code, ap.status, 
              ap.telebirr_phone, 
              ap.telebirr_name, 
              ap.cbe_account, 
              ap.cbe_name, 
              ap.mpesa_phone, 
              ap.mpesa_name,
              ap.active_rails, 
              COALESCE(ap.is_online, true) as is_online, 
              ap.wallet_balance,
              u.full_name, u.phone as user_phone
       FROM agent_profiles ap
       JOIN users u ON ap.user_id = u.id
       WHERE ap.status = 'active'
         AND COALESCE(ap.is_online, true) = true
         AND ap.wallet_balance >= 50.00
       ORDER BY ap.wallet_balance DESC, ap.created_at ASC
       LIMIT 30`
    );

    const formattedAgents = agentsRes.rows.map(a => {
      const activeList = (a.active_rails || '').split(',').map((s: string) => s.trim()).filter(Boolean);
      const supportedRails: string[] = [];
      
      const cleanTelebirr = a.telebirr_phone ? String(a.telebirr_phone).trim() : '';
      if (activeList.includes('Telebirr') && cleanTelebirr.length >= 8) {
        supportedRails.push('Telebirr');
      }

      const cleanMpesa = a.mpesa_phone ? String(a.mpesa_phone).trim() : '';
      if (activeList.includes('M-Pesa') && cleanMpesa.length >= 8) {
        supportedRails.push('M-Pesa');
      }

      const effectiveTelebirrName = (a.telebirr_name && a.telebirr_name.trim()) || a.full_name || 'Sonic Agent';
      const effectiveMpesaName = (a.mpesa_name && a.mpesa_name.trim()) || a.full_name || 'Sonic Agent';

      return {
        id: a.id,
        agentCode: a.agent_code,
        displayName: `Sonic Agent #${a.agent_code}`,
        phone: cleanTelebirr || cleanMpesa || a.user_phone || null,
        telebirrPhone: cleanTelebirr || null,
        telebirrName: effectiveTelebirrName,
        mpesaPhone: cleanMpesa || null,
        mpesaName: effectiveMpesaName,
        supportedRails,
        hasConfiguredRails: supportedRails.length > 0,
        isOnline: a.is_online !== false,
        avgApprovalMinutes: 2
      };
    });

    return res.json({
      success: true,
      agents: formattedAgents
    });
  } catch (error: any) {
    console.error('❌ [Wallet Active Agents Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve active agents' });
  }
});

/**
 * GET /api/wallet/agents/assigned
 * Returns EXACTLY ONE assigned agent for the player's deposit session.
 * Uses Damped Square-Root Weighted Lottery:
 *   weight_i = 100 + floor(sqrt(wallet_balance_i))
 * Gives agents with more float capital a fair, proportional advantage while ensuring
 * every active agent with active rails has a solid baseline probability of selection.
 * Supports optional `excludeAgentId` when player requests to re-roll for another agent.
 */
router.get('/agents/assigned', async (req, res) => {
  try {
    const excludeAgentId = req.query.excludeAgentId ? String(req.query.excludeAgentId).trim() : null;
    const preferredAgentId = req.query.preferredAgentId ? String(req.query.preferredAgentId).trim() : null;

    const agentsRes = await query(
      `SELECT ap.id, ap.agent_code, ap.status, 
              ap.telebirr_phone, 
              ap.telebirr_name, 
              ap.mpesa_phone, 
              ap.mpesa_name,
              ap.active_rails, 
              COALESCE(ap.is_online, true) as is_online, 
              ap.wallet_balance,
              u.full_name, u.phone as user_phone
       FROM agent_profiles ap
       JOIN users u ON ap.user_id = u.id
       WHERE ap.status = 'active'
         AND COALESCE(ap.is_online, true) = true
         AND ap.wallet_balance >= 50.00
       ORDER BY ap.wallet_balance DESC, ap.created_at ASC`
    );

    // Format & filter agents who have configured active rails (Telebirr or M-Pesa)
    const eligibleAgents = agentsRes.rows
      .map(a => {
        const activeList = (a.active_rails || '').split(',').map((s: string) => s.trim()).filter(Boolean);
        const supportedRails: string[] = [];

        const cleanTelebirr = a.telebirr_phone ? String(a.telebirr_phone).trim() : '';
        if (activeList.includes('Telebirr') && cleanTelebirr.length >= 8) {
          supportedRails.push('Telebirr');
        }

        const cleanMpesa = a.mpesa_phone ? String(a.mpesa_phone).trim() : '';
        if (activeList.includes('M-Pesa') && cleanMpesa.length >= 8) {
          supportedRails.push('M-Pesa');
        }

        const effectiveTelebirrName = (a.telebirr_name && a.telebirr_name.trim()) || a.full_name || 'Sonic Agent';
        const effectiveMpesaName = (a.mpesa_name && a.mpesa_name.trim()) || a.full_name || 'Sonic Agent';

        const rawBalance = Math.max(0, parseFloat(a.wallet_balance || '0'));
        // Damped weighted tickets: Base 100 + floor(sqrt(balance))
        const weight = 100 + Math.floor(Math.sqrt(rawBalance));

        return {
          id: a.id,
          agentCode: a.agent_code,
          displayName: `Sonic Agent #${a.agent_code}`,
          phone: cleanTelebirr || cleanMpesa || a.user_phone || null,
          telebirrPhone: cleanTelebirr || null,
          telebirrName: effectiveTelebirrName,
          mpesaPhone: cleanMpesa || null,
          mpesaName: effectiveMpesaName,
          supportedRails,
          hasConfiguredRails: supportedRails.length > 0,
          isOnline: a.is_online !== false,
          avgApprovalMinutes: 2,
          walletBalance: rawBalance,
          weight
        };
      })
      .filter(a => a.hasConfiguredRails);

    if (eligibleAgents.length === 0) {
      return res.json({
        success: true,
        agent: null,
        totalOnlineAgents: 0,
        message: 'No certified agents currently online with active payment rails'
      });
    }

    // If player has a preferred active agent (session persistence) and did not ask to exclude it, serve it directly
    if (preferredAgentId && !excludeAgentId) {
      const preferred = eligibleAgents.find(a => a.id === preferredAgentId || a.agentCode === preferredAgentId);
      if (preferred) {
        const { weight, walletBalance, ...sanitizedAgent } = preferred;
        return res.json({
          success: true,
          agent: sanitizedAgent,
          totalOnlineAgents: eligibleAgents.length
        });
      }
    }

    // Filter out excludeAgentId if multiple candidates exist
    let pool = eligibleAgents;
    if (excludeAgentId && eligibleAgents.length > 1) {
      const filtered = eligibleAgents.filter(a => a.id !== excludeAgentId && a.agentCode !== excludeAgentId);
      if (filtered.length > 0) {
        pool = filtered;
      }
    }

    // Run Roulette-Wheel Weighted Selection
    const totalWeight = pool.reduce((sum, a) => sum + a.weight, 0);
    let randomVal = Math.random() * totalWeight;
    let selectedAgent = pool[0];

    for (const candidate of pool) {
      if (randomVal < candidate.weight) {
        selectedAgent = candidate;
        break;
      }
      randomVal -= candidate.weight;
    }

    // Strip internal weight & balance before sending to client for privacy
    const { weight, walletBalance, ...sanitizedAgent } = selectedAgent;

    return res.json({
      success: true,
      agent: sanitizedAgent,
      totalOnlineAgents: eligibleAgents.length
    });
  } catch (error: any) {
    console.error('❌ [Wallet Assigned Agent Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to assign certified agent' });
  }
});

/**
 * POST /api/wallet/deposit-via-agent
 * Player submits a deposit request to a certified agent by unique agent code or ID.
 */
router.post('/deposit-via-agent', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { agentId, agentCode, amount, paymentMethod, playerPhone, transactionCode, screenshotUrl } = req.body;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 50 || numAmount > 1500) {
      return res.status(400).json({ success: false, error: 'Deposit amount must be between 50 and 1,500 ETB.' });
    }

    if (!paymentMethod || !['Telebirr', 'CBE', 'M-Pesa'].includes(paymentMethod)) {
      return res.status(400).json({ success: false, error: 'Payment method must be Telebirr, CBE, or M-Pesa.' });
    }

    const cleanTxCode = (transactionCode || '').trim().toUpperCase();
    if (!cleanTxCode || cleanTxCode.length < 4) {
      return res.status(400).json({ success: false, error: 'Valid SMS Transaction Reference Code is required.' });
    }

    const cleanPhone = (playerPhone || '').trim();
    if (!cleanPhone || cleanPhone.length < 8) {
      return res.status(400).json({ success: false, error: 'Valid player phone number is required.' });
    }

    // 1. Locate Agent Profile (by ID or Unique Code)
    let agentQuery = 'SELECT id, agent_code, wallet_balance, status, is_online, telebirr_phone, cbe_account, mpesa_phone, active_rails FROM agent_profiles WHERE ';
    let agentParam: any[] = [];
    if (agentId) {
      agentQuery += 'id = $1';
      agentParam = [agentId];
    } else if (agentCode) {
      agentQuery += 'agent_code = $1';
      agentParam = [agentCode.trim().toUpperCase()];
    } else {
      return res.status(400).json({ success: false, error: 'Agent ID or Unique Agent Code is required.' });
    }

    const agentRes = await query(agentQuery, agentParam);
    if (agentRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Selected certified agent not found.' });
    }

    const agent = agentRes.rows[0];
    if (agent.status !== 'active') {
      return res.status(400).json({ success: false, error: 'Selected agent is currently inactive.' });
    }
    if (agent.is_online === false) {
      return res.status(400).json({ success: false, error: 'Selected agent is currently offline. Please choose another agent.' });
    }
    if (parseFloat(agent.wallet_balance) < numAmount) {
      return res.status(400).json({ 
        success: false, 
        error: `Agent #${agent.agent_code} does not have sufficient float for this amount right now. Please select another agent or try a lower amount.` 
      });
    }

    // Verify agent supports requested paymentMethod
    const activeList = (agent.active_rails || 'Telebirr,CBE').split(',').map((s: string) => s.trim());
    let railConfigured = false;
    if (paymentMethod === 'Telebirr' && activeList.includes('Telebirr') && agent.telebirr_phone) railConfigured = true;
    if (paymentMethod === 'CBE' && activeList.includes('CBE') && agent.cbe_account) railConfigured = true;
    if (paymentMethod === 'M-Pesa' && activeList.includes('M-Pesa') && agent.mpesa_phone) railConfigured = true;

    if (!railConfigured) {
      return res.status(400).json({ 
        success: false, 
        error: `Agent #${agent.agent_code} does not currently support deposits via ${paymentMethod}. Please choose another payment method or agent.` 
      });
    }

    // 2. Check for duplicate pending or approved transaction code
    const duplicateCheck = await query(
      `SELECT id, status FROM agent_deposit_requests WHERE transaction_code = $1 AND status IN ('pending', 'approved') LIMIT 1`,
      [cleanTxCode]
    );
    if (duplicateCheck.rows.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: `Transaction Code "${cleanTxCode}" has already been submitted (${duplicateCheck.rows[0].status}). Duplicate requests are strictly blocked.` 
      });
    }

    // 3. Insert deposit request
    const insertRes = await query(
      `INSERT INTO agent_deposit_requests 
        (player_id, agent_id, amount, payment_method, player_phone, transaction_code, screenshot_url, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
       RETURNING id, created_at, status`,
      [userId, agent.id, numAmount, paymentMethod, cleanPhone, cleanTxCode, screenshotUrl || null]
    );

    const newRequest = insertRes.rows[0];

    // 3b. TWO-WAY AUTO-APPROVAL: Check if matching Telebirr SMS already arrived in telebirr_sms_logs
    if (paymentMethod === 'Telebirr') {
      const phoneLast4 = cleanPhone.length >= 4 ? cleanPhone.slice(-4) : '';
      const smsMatchRes = await query(
        `SELECT id, transaction_ref, amount, payer_phone FROM telebirr_sms_logs 
         WHERE transaction_ref ILIKE $1
           AND status = 'unmatched'
           AND received_at >= NOW() - INTERVAL '60 minutes'
         ORDER BY received_at DESC LIMIT 1`,
        [cleanTxCode]
      );

      if (smsMatchRes.rows.length > 0) {
        const matchedSms = smsMatchRes.rows[0];
        const verifiedAmount = parseFloat(matchedSms.amount);

        // 🛡️ SECURITY PILLAR 1: Amount Reconciliation Firewall
        // If user claimed 100 ETB, but Telebirr received 53 ETB: REJECT immediately!
        if (Math.abs(numAmount - verifiedAmount) > 0.01) {
          console.warn(`🚨 [SECURITY AMOUNT MISMATCH] User claimed ${numAmount} ETB, but Telebirr verified ${verifiedAmount} ETB (Tx: ${cleanTxCode})`);
          await query(
            `UPDATE agent_deposit_requests 
             SET status = 'rejected', rejection_reason = $1, resolved_at = NOW() 
             WHERE id = $2`,
            [`Amount mismatch: You requested ${numAmount.toFixed(2)} ETB, but Telebirr received ${verifiedAmount.toFixed(2)} ETB. Auto-rejected.`, newRequest.id]
          );

          return res.status(400).json({
            success: false,
            error: `Amount mismatch: You entered ${numAmount.toFixed(2)} ETB, but Telebirr received ${verifiedAmount.toFixed(2)} ETB for transaction ${cleanTxCode}. Please enter the exact amount transferred.`
          });
        }

        // 🛡️ SECURITY PILLAR 3: Phone Number Last-4 Bi-Directional Match
        const smsPayerPhone = matchedSms.payer_phone || '';
        const smsLast4Match = smsPayerPhone.match(/(\d{4})\)?$/);
        const smsLast4 = smsLast4Match ? smsLast4Match[1] : undefined;

        if (smsLast4 && phoneLast4 && smsLast4 !== phoneLast4) {
          console.warn(`⚠️ [SECURITY PHONE MISMATCH] Tx ${cleanTxCode} sender is ***${smsLast4}, player phone is ***${phoneLast4}`);
          return res.json({
            success: true,
            message: `Deposit request for ${numAmount} ETB submitted to Agent #${agent.agent_code}. Verification in progress.`,
            requestId: newRequest.id,
            status: 'pending',
            note: 'Phone mismatch detected. Awaiting manual cashier review.'
          });
        }

        console.log(`⚡ [Instant Auto-Approve] Verified match (ID: ${matchedSms.id}, Tx: ${matchedSms.transaction_ref}, ${verifiedAmount} ETB) for Agent Deposit ${newRequest.id}`);
        const approveResult = await executeAgentDepositApproval(newRequest.id, matchedSms.transaction_ref || cleanTxCode, matchedSms.id);
        if (approveResult.success) {
          return res.json({
            success: true,
            message: `🎉 Deposit of ${verifiedAmount} ETB instantly verified & credited via Telebirr SMS!`,
            requestId: newRequest.id,
            agentCode: agent.agent_code,
            agentDisplayName: `Sonic Agent #${agent.agent_code}`,
            status: 'approved',
            instant: true,
            newBalance: approveResult.newBalance
          });
        } else if (approveResult.error === 'AMOUNT_MISMATCH') {
          return res.status(400).json({
            success: false,
            error: approveResult.message || 'Amount mismatch detected between deposit request and Telebirr SMS.'
          });
        }
      }
    }

    // 4. Broadcast real-time WebSocket event to the Agent
    io.emit(`agent_${agent.id}_new_request`, {
      requestId: newRequest.id,
      amount: numAmount,
      playerPhone: cleanPhone,
      paymentMethod,
      transactionCode: cleanTxCode,
      createdAt: newRequest.created_at
    });
    io.emit('agent_new_deposit_request', {
      agentId: agent.id,
      requestId: newRequest.id
    });

    return res.json({
      success: true,
      message: `Deposit request for ${numAmount} ETB submitted to Sonic Agent #${agent.agent_code}.`,
      requestId: newRequest.id,
      agentCode: agent.agent_code,
      agentDisplayName: `Sonic Agent #${agent.agent_code}`,
      status: 'pending',
      estimatedWaitMinutes: 2
    });
  } catch (error: any) {
    console.error('❌ [Wallet Deposit via Agent Error]:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to submit agent deposit request' });
  }
});

/**
 * GET /api/wallet/my-agent-deposits
 * Retrieve Player's recent agent deposit requests with real-time status.
 */
router.get('/my-agent-deposits', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const requestsRes = await query(
      `SELECT req.id, req.amount, req.payment_method, req.transaction_code, req.status, 
              req.rejection_reason, req.created_at, req.resolved_at,
              ap.agent_code, ap.telebirr_phone
       FROM agent_deposit_requests req
       JOIN agent_profiles ap ON req.agent_id = ap.id
       WHERE req.player_id = $1
       ORDER BY req.created_at DESC
       LIMIT 20`,
      [userId]
    );

    return res.json({
      success: true,
      requests: requestsRes.rows.map(r => ({
        id: r.id,
        amount: parseFloat(r.amount),
        paymentMethod: r.payment_method,
        transactionCode: r.transaction_code,
        status: r.status,
        rejectionReason: r.rejection_reason,
        createdAt: r.created_at,
        resolvedAt: r.resolved_at,
        agentCode: r.agent_code,
        agentDisplayName: `Sonic Agent #${r.agent_code}`
      }))
    });
  } catch (error: any) {
    console.error('❌ [Wallet My Agent Deposits Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve agent deposit requests' });
  }
});

/**
 * POST /api/wallet/withdraw-via-agent
 * Decentralized Player Withdrawal through Selected Online Agent
 * Locks player funds into atomic escrow until agent confirms mobile payout.
 */
router.post('/withdraw-via-agent', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { agentId, amount, payoutMethod, payoutAccount, payoutAccountName } = req.body;

    if (!agentId || !amount || !payoutMethod || !payoutAccount) {
      return res.status(400).json({
        success: false,
        error: 'Agent ID, amount, payout method, and receiving account are required'
      });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 50 || numAmount > 2000) {
      return res.status(400).json({
        success: false,
        error: 'Withdrawal amount must be between 50 and 2,000 ETB per transaction.'
      });
    }

    // 🛡️ Enforce anti-fraud eligibility rules (completed 5 games, max 3/day)
    const eligibility = await verifyWithdrawalEligibility(userId);
    if (!eligibility.eligible) {
      return res.status(400).json({ success: false, error: eligibility.reason });
    }

    const validMethods = ['Telebirr', 'CBE', 'M-Pesa'];
    if (!validMethods.includes(payoutMethod)) {
      return res.status(400).json({
        success: false,
        error: `Invalid payout method. Supported: ${validMethods.join(', ')}`
      });
    }

    // 1. Verify agent exists, is active, and online
    const agentRes = await query(
      `SELECT id, agent_code, status, is_online, telebirr_phone, cbe_account, mpesa_phone, active_rails FROM agent_profiles WHERE id = $1`,
      [agentId]
    );
    if (agentRes.rows.length === 0 || agentRes.rows[0].status !== 'active') {
      return res.status(400).json({ success: false, error: 'Selected agent is not available. Please pick another agent.' });
    }
    const agent = agentRes.rows[0];

    // Verify agent supports requested payoutMethod
    const activeList = (agent.active_rails || 'Telebirr,CBE').split(',').map((s: string) => s.trim());
    let payoutRailSupported = false;
    if (payoutMethod === 'Telebirr' && activeList.includes('Telebirr') && agent.telebirr_phone) payoutRailSupported = true;
    if (payoutMethod === 'CBE' && activeList.includes('CBE') && agent.cbe_account) payoutRailSupported = true;
    if (payoutMethod === 'M-Pesa' && activeList.includes('M-Pesa') && agent.mpesa_phone) payoutRailSupported = true;

    if (!payoutRailSupported) {
      return res.status(400).json({
        success: false,
        error: `Agent #${agent.agent_code} does not support payouts via ${payoutMethod}. Please select another agent or payout method.`
      });
    }

    // 2. Atomic Escrow Transaction
    const result = await withTransaction(async (client) => {
      // Lock player wallet FOR UPDATE
      const walletRes = await client.query(
        `SELECT id, balance FROM wallets WHERE user_id = $1 FOR UPDATE`,
        [userId]
      );
      if (walletRes.rows.length === 0) {
        throw new Error('Wallet not found');
      }

      const currentBalance = parseFloat(walletRes.rows[0].balance || '0');
      if (currentBalance < numAmount) {
        throw new Error(`Insufficient withdrawable balance. Available: ${currentBalance.toFixed(2)} ETB`);
      }

      const newBalance = currentBalance - numAmount;

      // Deduct balance into escrow
      await client.query(
        `UPDATE wallets SET balance = $1, updated_at = NOW() WHERE user_id = $2`,
        [newBalance, userId]
      );

      // Create withdrawal request row
      const reqRes = await client.query(
        `INSERT INTO agent_withdrawal_requests (
          player_id, agent_id, amount, payout_method, payout_account,
          payout_account_name, player_balance_before, player_balance_after, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
        RETURNING *`,
        [
          userId,
          agent.id,
          numAmount,
          payoutMethod,
          payoutAccount.trim(),
          payoutAccountName ? payoutAccountName.trim() : (req.user!.fullName || null),
          currentBalance,
          newBalance
        ]
      );

      // Record pending ledger transaction
      const txRef = `WDR-AGT-${Date.now().toString().slice(-6)}`;
      await client.query(
        `INSERT INTO wallet_transactions (
          user_id, type, amount, balance_after, reference_code,
          status, payment_method, description
        )
        VALUES ($1, 'withdrawal', $2, $3, $4, 'pending', $5, $6)`,
        [
          userId,
          numAmount,
          newBalance,
          txRef,
          payoutMethod,
          `Withdrawal via Sonic Agent #${agent.agent_code} (${payoutMethod}: ${payoutAccount})`
        ]
      );

      return {
        withdrawal: reqRes.rows[0],
        newBalance,
        txRef
      };
    });

    // 3. Emit real-time WebSocket notifications
    const agentAlertPayload = {
      requestId: result.withdrawal.id,
      amount: numAmount,
      payoutMethod,
      payoutAccount: payoutAccount.trim(),
      payoutAccountName: payoutAccountName || req.user!.fullName,
      playerName: req.user!.fullName || 'Player',
      playerUsername: req.user!.telegramUsername || null,
      createdAt: result.withdrawal.created_at
    };

    io.emit(`agent_${agent.id}_new_withdrawal_request`, agentAlertPayload);
    io.emit(`agent_${agent.id}_request_updated`, {
      type: 'withdrawal',
      requestId: result.withdrawal.id,
      status: 'pending'
    });

    // Push updated balance to player
    const balancePayload = {
      userId,
      newBalance: result.newBalance,
      balance: result.newBalance,
      amount: -numAmount,
      type: 'withdrawal_escrow'
    };
    io.emit('user_balance_updated', balancePayload);
    io.emit(`user_${userId}_balance`, balancePayload);

    return res.json({
      success: true,
      message: `Withdrawal request for ${numAmount.toFixed(2)} ETB submitted to Sonic Agent #${agent.agent_code}.`,
      request: {
        id: result.withdrawal.id,
        amount: numAmount,
        payoutMethod,
        payoutAccount: payoutAccount.trim(),
        agentCode: agent.agent_code,
        agentDisplayName: `Sonic Agent #${agent.agent_code}`,
        status: 'pending',
        createdAt: result.withdrawal.created_at
      },
      newBalance: result.newBalance
    });
  } catch (error: any) {
    console.error('❌ [Wallet Withdraw via Agent Error]:', error);
    return res.status(400).json({ success: false, error: error.message || 'Failed to submit withdrawal request' });
  }
});

/**
 * GET /api/wallet/my-agent-withdrawals
 * Get player's recent agent withdrawal requests
 */
router.get('/my-agent-withdrawals', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const requestsRes = await query(
      `SELECT req.id, req.amount, req.payout_method, req.payout_account, req.payout_account_name,
              req.status, req.agent_tx_ref, req.rejection_reason, req.created_at, req.resolved_at,
              ap.agent_code, ap.telebirr_phone, ap.cbe_account
       FROM agent_withdrawal_requests req
       JOIN agent_profiles ap ON req.agent_id = ap.id
       WHERE req.player_id = $1
       ORDER BY req.created_at DESC
       LIMIT 20`,
      [userId]
    );

    return res.json({
      success: true,
      requests: requestsRes.rows.map(r => ({
        id: r.id,
        amount: parseFloat(r.amount),
        payoutMethod: r.payout_method,
        payoutAccount: r.payout_account,
        payoutAccountName: r.payout_account_name,
        agentTxRef: r.agent_tx_ref,
        status: r.status,
        rejectionReason: r.rejection_reason,
        createdAt: r.created_at,
        resolvedAt: r.resolved_at,
        agentCode: r.agent_code,
        agentDisplayName: `Sonic Agent #${r.agent_code}`
      }))
    });
  } catch (error: any) {
    console.error('❌ [Wallet My Agent Withdrawals Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve agent withdrawal requests' });
  }
});

/**
 * POST /api/wallet/cancel-agent-withdrawal
 * Allows player to cancel a pending agent withdrawal request and refunds escrow.
 */
router.post('/cancel-agent-withdrawal', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { requestId } = req.body;

    if (!requestId) {
      return res.status(400).json({ success: false, error: 'Request ID is required' });
    }

    const result = await withTransaction(async (client) => {
      const reqRes = await client.query(
        `SELECT * FROM agent_withdrawal_requests 
         WHERE id = $1 AND player_id = $2 FOR UPDATE`,
        [requestId, userId]
      );

      if (reqRes.rows.length === 0) {
        throw new Error('Withdrawal request not found');
      }

      const withReq = reqRes.rows[0];
      if (withReq.status !== 'pending') {
        throw new Error(`Cannot cancel request with status "${withReq.status}"`);
      }

      const refundAmount = parseFloat(withReq.amount);

      // Refund escrow to player wallet
      const walletRes = await client.query(
        `UPDATE wallets 
         SET balance = balance + $1, updated_at = NOW() 
         WHERE user_id = $2 
         RETURNING balance`,
        [refundAmount, userId]
      );
      const refundedBal = parseFloat(walletRes.rows[0].balance);

      // Mark request as cancelled
      await client.query(
        `UPDATE agent_withdrawal_requests 
         SET status = 'cancelled', resolved_at = NOW() 
         WHERE id = $1`,
        [requestId]
      );

      // Update wallet_transactions ledger
      await client.query(
        `UPDATE wallet_transactions 
         SET status = 'cancelled' 
         WHERE user_id = $1 AND type = 'withdrawal' AND status = 'pending' 
           AND amount = $2 AND created_at >= $3`,
        [userId, refundAmount, withReq.created_at]
      );

      return {
        refundAmount,
        refundedBal,
        agentId: withReq.agent_id
      };
    });

    // Real-time WebSocket push
    const balancePayload = {
      userId,
      newBalance: result.refundedBal,
      balance: result.refundedBal,
      amount: result.refundAmount,
      type: 'withdrawal_cancelled_refund'
    };
    io.emit('user_balance_updated', balancePayload);
    io.emit(`user_${userId}_balance`, balancePayload);
    io.emit(`agent_${result.agentId}_request_updated`, {
      type: 'withdrawal',
      requestId,
      status: 'cancelled'
    });

    return res.json({
      success: true,
      message: `Withdrawal request cancelled. ${result.refundAmount.toFixed(2)} ETB refunded to your balance.`,
      newBalance: result.refundedBal
    });
  } catch (error: any) {
    console.error('❌ [Wallet Cancel Agent Withdrawal Error]:', error);
    return res.status(400).json({ success: false, error: error.message || 'Failed to cancel withdrawal request' });
  }
});

/**
 * GET /api/wallet/my-withdrawals
 * Get player's recent central withdrawal requests
 */
router.get('/my-withdrawals', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const requestsRes = await query(
      `SELECT id, amount, payment_method, account_phone, account_name,
              status, payout_reference, rejection_reason, created_at, reviewed_at
       FROM withdrawal_requests
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [userId]
    );

    return res.json({
      success: true,
      requests: requestsRes.rows.map(r => ({
        id: r.id,
        amount: parseFloat(r.amount),
        payoutMethod: r.payment_method,
        payoutAccount: r.account_phone,
        payoutAccountName: r.account_name,
        payoutReference: r.payout_reference,
        status: r.status,
        rejectionReason: r.rejection_reason,
        createdAt: r.created_at,
        reviewedAt: r.reviewed_at
      }))
    });
  } catch (error: any) {
    console.error('❌ [Wallet My Withdrawals Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve withdrawal requests' });
  }
});

/**
 * POST /api/wallet/cancel-withdrawal
 * Allows player to cancel a pending central withdrawal request and refunds escrow.
 */
router.post('/cancel-withdrawal', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { requestId } = req.body;

    if (!requestId) {
      return res.status(400).json({ success: false, error: 'Request ID is required' });
    }

    const result = await withTransaction(async (client) => {
      const reqRes = await client.query(
        `SELECT * FROM withdrawal_requests 
         WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [requestId, userId]
      );

      if (reqRes.rows.length === 0) {
        throw new Error('Withdrawal request not found');
      }

      const withReq = reqRes.rows[0];
      if (withReq.status !== 'pending') {
        throw new Error(`Cannot cancel request with status "${withReq.status}"`);
      }

      const refundAmount = parseFloat(withReq.amount);

      // Refund escrow to player wallet
      const walletRes = await client.query(
        `UPDATE wallets 
         SET balance = balance + $1, updated_at = NOW() 
         WHERE user_id = $2 
         RETURNING balance`,
        [refundAmount, userId]
      );
      const refundedBal = parseFloat(walletRes.rows[0].balance);

      // Mark request as cancelled
      await client.query(
        `UPDATE withdrawal_requests 
         SET status = 'cancelled', reviewed_at = NOW() 
         WHERE id = $1`,
        [requestId]
      );

      // Update wallet_transactions ledger
      await client.query(
        `UPDATE wallet_transactions 
         SET status = 'cancelled' 
         WHERE user_id = $1 AND type = 'withdrawal' AND status = 'pending' 
           AND amount = $2 AND created_at >= $3`,
        [userId, refundAmount, withReq.created_at]
      );

      return {
        refundAmount,
        refundedBal
      };
    });

    // Real-time WebSocket push
    const balancePayload = {
      userId,
      newBalance: result.refundedBal,
      balance: result.refundedBal,
      amount: result.refundAmount,
      type: 'withdrawal_cancelled_refund'
    };
    io.emit('user_balance_updated', balancePayload);
    io.emit(`user_${userId}_balance`, balancePayload);
    io.emit('withdrawal_status_updated', {
      requestId,
      status: 'cancelled',
      userId
    });

    return res.json({
      success: true,
      message: `Withdrawal request cancelled. ${result.refundAmount.toFixed(2)} ETB refunded to your balance.`,
      newBalance: result.refundedBal
    });
  } catch (error: any) {
    console.error('❌ [Wallet Cancel Withdrawal Error]:', error);
    return res.status(400).json({ success: false, error: error.message || 'Failed to cancel withdrawal request' });
  }
});

export default router;

