import { Router, Request, Response } from 'express';
import { query, withTransaction } from '../db.ts';
import { parseTelebirrSMS } from '../services/telebirrParser.ts';
import { io } from '../io.ts';
import { coinService } from '../services/coinService.ts';

const router = Router();

// Automatic DB table initialization
let isSchemaInitialized = false;
async function ensureTelebirrLogsTable() {
  if (isSchemaInitialized) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS telebirr_sms_logs (
        id SERIAL PRIMARY KEY,
        sender VARCHAR(50) NOT NULL,
        message_body TEXT NOT NULL,
        transaction_ref VARCHAR(100) UNIQUE,
        amount NUMERIC(10, 2),
        payer_phone VARCHAR(50),
        payer_name VARCHAR(150),
        recipient_name VARCHAR(100),
        balance_after NUMERIC(10, 2),
        status VARCHAR(50) DEFAULT 'unmatched',
        matched_user_id UUID REFERENCES users(id),
        matched_deposit_id UUID,
        deposit_type VARCHAR(50),
        received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        processed_at TIMESTAMP WITH TIME ZONE
      );

      ALTER TABLE telebirr_sms_logs ADD COLUMN IF NOT EXISTS deposit_type VARCHAR(50);
      CREATE INDEX IF NOT EXISTS idx_telebirr_sms_tx_ref ON telebirr_sms_logs(transaction_ref);
      CREATE INDEX IF NOT EXISTS idx_telebirr_sms_phone ON telebirr_sms_logs(payer_phone);
    `);
    isSchemaInitialized = true;
  } catch (err) {
    console.warn('⚠️ [Telebirr Webhook] DB table initialization note:', err);
  }
}
ensureTelebirrLogsTable().catch(() => {});

const SMS_GATEWAY_SECRET = process.env.SMS_GATEWAY_SECRET || 'telebirr_secret_sonic_2026';

/**
 * POST /api/webhooks/telebirr-sms
 * Webhook endpoint called automatically by Android SMS Gateway
 */
router.post('/telebirr-sms', async (req: Request, res: Response) => {
  try {
    // 1. Secret authorization check
    const authHeader = req.headers['x-gateway-secret'] || 
                       req.headers['authorization'] || 
                       req.query.secret || 
                       req.body.secret;

    const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;

    if (token !== SMS_GATEWAY_SECRET) {
      console.warn('🚨 [Telebirr Webhook] Unauthorized attempt with token:', token);
      return res.status(401).json({ success: false, error: 'Unauthorized SMS Gateway webhook request.' });
    }

    // 2. Extract payload (Supports capcom6 android-sms-gateway, generic SMS gateways, and custom POSTs)
    const rawPayload = req.body.payload || req.body;
    const sender = rawPayload.phone || rawPayload.from || rawPayload.sender || '127';
    const messageBody = rawPayload.message || rawPayload.text || rawPayload.body || rawPayload.msg || '';

    if (!messageBody || typeof messageBody !== 'string') {
      return res.status(400).json({ success: false, error: 'Empty or invalid message body.' });
    }

    console.log(`📩 [Telebirr Webhook] Received SMS from ${sender}:\n"${messageBody}"`);

    // 3. Parse Telebirr Details using the Regex Engine
    const parsed = parseTelebirrSMS(messageBody);

    if (!parsed.success || !parsed.transactionRef || !parsed.amount) {
      // Store unparsed / unrelated SMS for admin inspection without failing
      await query(
        `INSERT INTO telebirr_sms_logs (sender, message_body, status) VALUES ($1, $2, 'unrecognized')`,
        [sender, messageBody]
      );
      return res.json({ 
        success: true, 
        status: 'ignored', 
        reason: 'Not a recognized Telebirr deposit confirmation SMS.' 
      });
    }

    const { transactionRef, amount, senderPhone, senderLast4, senderName, recipientName, balanceAfter } = parsed;

    // 4. Atomic Database Execution: Idempotency, Agent/Direct Matching, and Wallet Credit
    const result = await withTransaction(async (client) => {
      // 4a. Check if this transaction has already been credited (Anti-Replay Attack)
      const existingTx = await client.query(
        `SELECT id, status, matched_user_id FROM telebirr_sms_logs WHERE transaction_ref = $1 FOR UPDATE`,
        [transactionRef]
      );

      if (existingTx.rows.length > 0 && existingTx.rows[0].status === 'credited') {
        console.log(`ℹ️ [Telebirr Webhook] Transaction ${transactionRef} already credited.`);
        return { 
          status: 'already_processed', 
          txRef: transactionRef,
          userId: existingTx.rows[0].matched_user_id 
        };
      }

      // 4b. SEARCH 1: Check Agent Portal Deposits (`agent_deposit_requests`)
      // Match by exact transaction_code OR (matching amount + last 4 digits of phone in last 60 mins)
      let agentDepRes = await client.query(
        `SELECT * FROM agent_deposit_requests 
         WHERE status = 'pending' AND transaction_code ILIKE $1 
         ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
        [transactionRef]
      );

      if (agentDepRes.rows.length === 0 && senderLast4) {
        agentDepRes = await client.query(
          `SELECT * FROM agent_deposit_requests 
           WHERE status = 'pending' 
             AND amount = $1 
             AND player_phone LIKE '%' || $2
             AND created_at >= NOW() - INTERVAL '60 minutes'
           ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
          [amount, senderLast4]
        );
      }

      // If matched with an Agent Deposit Request:
      if (agentDepRes.rows.length > 0) {
        const depReq = agentDepRes.rows[0];
        const agentId = depReq.agent_id;
        const playerId = depReq.player_id;
        const depositAmount = parseFloat(depReq.amount);

        // Fetch Agent Profile
        const agentProfileRes = await client.query(
          `SELECT id, agent_code, wallet_balance, commission_rate FROM agent_profiles WHERE id = $1 FOR UPDATE`,
          [agentId]
        );
        const agentProfile = agentProfileRes.rows[0];
        const agentBalance = parseFloat(agentProfile?.wallet_balance || '0');

        // Check Agent Float Solvency
        if (agentBalance < depositAmount) {
          console.warn(`⚠️ [Agent Deposit Auto-Approve] Agent ${agentId} low float balance: ${agentBalance} < ${depositAmount}`);
        }

        const commissionRate = parseFloat(agentProfile?.commission_rate || '5.0');
        const commissionEarned = depositAmount * (commissionRate / 100);
        const agentBalAfter = Math.max(0, agentBalance - depositAmount);

        // Fetch Player Wallet
        let playerWalletRes = await client.query(
          `SELECT id, balance, user_id FROM wallets WHERE user_id = $1 FOR UPDATE`,
          [playerId]
        );

        if (playerWalletRes.rows.length === 0) {
          await client.query(
            `INSERT INTO wallets (user_id, balance, bonus, currency, updated_at)
             VALUES ($1, 0.00, 0.00, 'ETB', NOW())
             ON CONFLICT (user_id) DO NOTHING`,
            [playerId]
          );
          playerWalletRes = await client.query(
            `SELECT id, balance, user_id FROM wallets WHERE user_id = $1 FOR UPDATE`,
            [playerId]
          );
        }

        const playerWallet = playerWalletRes.rows[0];
        const playerOldBalance = parseFloat(playerWallet.balance || '0');
        const playerBalAfter = playerOldBalance + depositAmount;
        const coinsEarned = Math.round(depositAmount * 1.5);

        // Update Agent Profile (Deduct float, add commission)
        if (agentProfile) {
          await client.query(
            `UPDATE agent_profiles 
             SET wallet_balance = $1, 
                 commission_balance = COALESCE(commission_balance, 0.00) + $2, 
                 updated_at = NOW() 
             WHERE id = $3`,
            [agentBalAfter, commissionEarned, agentId]
          );
        }

        // Credit Player Balance
        await client.query(
          `UPDATE wallets SET balance = $1, updated_at = NOW() WHERE id = $2`,
          [playerBalAfter, playerWallet.id]
        );

        // Award Coins
        try {
          await coinService.awardCoinsForDeposit(playerId, depositAmount, transactionRef, client);
        } catch (cErr) {
          console.warn('⚠️ Coin award notice:', cErr);
        }

        // Mark Player as has_deposited & link to agent
        await client.query(
          `UPDATE users SET has_deposited = true, agent_id = COALESCE(agent_id, $1) WHERE id = $2`,
          [agentId, playerId]
        );

        // Audit Records
        if (agentProfile) {
          await client.query(
            `INSERT INTO agent_commissions 
              (agent_id, source_type, source_id, amount, commission_rate, commission_earned)
             VALUES ($1, 'deposit', $2, $3, $4, $5)`,
            [agentId, depReq.id, depositAmount, commissionRate, commissionEarned]
          );

          await client.query(
            `INSERT INTO agent_player_deposits 
              (agent_id, player_user_id, amount, agent_balance_after, player_balance_after, payment_method, reference_code)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [agentId, playerId, depositAmount, agentBalAfter, playerBalAfter, depReq.payment_method, transactionRef]
          );
        }

        await client.query(
          `INSERT INTO wallet_transactions 
            (user_id, type, amount, balance_after, reference_code, status, payment_method, description)
           VALUES ($1, 'deposit', $2, $3, $4, 'completed', $5, $6)`,
          [
            playerId,
            depositAmount,
            playerBalAfter,
            transactionRef,
            depReq.payment_method,
            `Automated Deposit via Agent #${agentProfile?.agent_code || agentId} (${transactionRef})`
          ]
        );

        // Update agent_deposit_requests to 'approved'
        await client.query(
          `UPDATE agent_deposit_requests
           SET status = 'approved',
               resolved_at = NOW(),
               agent_balance_before = $1,
               agent_balance_after = $2,
               player_balance_before = $3,
               player_balance_after = $4
           WHERE id = $5`,
          [agentBalance, agentBalAfter, playerOldBalance, playerBalAfter, depReq.id]
        );

        // Record in telebirr_sms_logs
        await client.query(
          `INSERT INTO telebirr_sms_logs (sender, message_body, transaction_ref, amount, payer_phone, payer_name, recipient_name, balance_after, status, matched_user_id, matched_deposit_id, deposit_type, processed_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'credited', $9, $10, 'agent_deposit', NOW())
           ON CONFLICT (transaction_ref) DO UPDATE 
           SET status = 'credited', matched_user_id = $9, matched_deposit_id = $10, deposit_type = 'agent_deposit', processed_at = NOW()`,
          [sender, messageBody, transactionRef, depositAmount, senderPhone || null, senderName || null, recipientName || null, balanceAfter || null, playerId, depReq.id]
        );

        return {
          status: 'credited',
          type: 'agent_deposit',
          agentId,
          userId: playerId,
          depositId: depReq.id,
          amount: depositAmount,
          prevBal: playerOldBalance,
          newBal: playerBalAfter,
          txRef: transactionRef
        };
      }

      // 4c. SEARCH 2: Check Direct Cashier Deposits (`deposit_requests`)
      let matchedUserId: string | null = null;
      let matchedDepositId: string | null = null;

      const depByRef = await client.query(
        `SELECT * FROM deposit_requests 
         WHERE status = 'pending' AND transaction_ref ILIKE $1 
         ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
        [transactionRef]
      );

      if (depByRef.rows.length > 0) {
        matchedUserId = depByRef.rows[0].user_id;
        matchedDepositId = depByRef.rows[0].id;
      }

      if (!matchedUserId && senderLast4) {
        const depByPhone = await client.query(
          `SELECT * FROM deposit_requests 
           WHERE status = 'pending' 
             AND amount = $1 
             AND player_phone LIKE '%' || $2
             AND created_at >= NOW() - INTERVAL '60 minutes'
           ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
          [amount, senderLast4]
        );

        if (depByPhone.rows.length > 0) {
          matchedUserId = depByPhone.rows[0].user_id;
          matchedDepositId = depByPhone.rows[0].id;
        }
      }

      // Fallback search in users table
      if (!matchedUserId && senderLast4) {
        const userByPhone = await client.query(
          `SELECT id FROM users 
           WHERE phone LIKE '%' || $1 
           LIMIT 1`,
          [senderLast4]
        );

        if (userByPhone.rows.length > 0) {
          matchedUserId = userByPhone.rows[0].id;
        }
      }

      if (!matchedUserId) {
        await client.query(
          `INSERT INTO telebirr_sms_logs (sender, message_body, transaction_ref, amount, payer_phone, payer_name, recipient_name, balance_after, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'unmatched')
           ON CONFLICT (transaction_ref) DO UPDATE 
           SET message_body = $2, amount = $4, payer_phone = $5, payer_name = $6, recipient_name = $7, balance_after = $8`,
          [sender, messageBody, transactionRef, amount, senderPhone || null, senderName || null, recipientName || null, balanceAfter || null]
        );

        return { 
          status: 'unmatched', 
          txRef: transactionRef, 
          amount, 
          phone: senderPhone,
          senderName,
          message: 'SMS logged, but no matching agent or direct deposit request found.'
        };
      }

      // Credit Player for Direct Cashier Deposit
      const walletRes = await client.query(
        `SELECT balance FROM wallets WHERE user_id = $1 FOR UPDATE`,
        [matchedUserId]
      );

      const prevBal = parseFloat(walletRes.rows[0]?.balance || '0');
      const newBal = prevBal + amount;

      await client.query(
        `UPDATE wallets SET balance = $1, updated_at = NOW() WHERE user_id = $2`,
        [newBal, matchedUserId]
      );

      if (matchedDepositId) {
        await client.query(
          `UPDATE deposit_requests 
           SET status = 'approved', transaction_ref = $1, reviewed_by = 'TELEBIRR_SMS_BOT', reviewed_at = NOW() 
           WHERE id = $2`,
          [transactionRef, matchedDepositId]
        );
      } else {
        const newDep = await client.query(
          `INSERT INTO deposit_requests (user_id, amount, payment_method, player_phone, transaction_ref, status, reviewed_by, reviewed_at)
           VALUES ($1, $2, 'Telebirr', $3, $4, 'approved', 'TELEBIRR_SMS_BOT', NOW())
           RETURNING id`,
          [matchedUserId, amount, senderPhone || 'Unknown', transactionRef]
        );
        matchedDepositId = newDep.rows[0].id;
      }

      await client.query(
        `INSERT INTO wallet_transactions (user_id, type, amount, balance_after, reference_code, status, payment_method, description)
         VALUES ($1, 'deposit', $2, $3, $4, 'completed', 'Telebirr', $5)`,
        [matchedUserId, amount, newBal, transactionRef, `Automated Telebirr Deposit (${transactionRef})`]
      );

      await client.query(`UPDATE users SET has_deposited = TRUE WHERE id = $1`, [matchedUserId]);
      try {
        await coinService.awardCoinsForDeposit(matchedUserId, amount, transactionRef, client);
      } catch (cErr) {
        console.warn('⚠️ Coin reward notice:', cErr);
      }

      await client.query(
        `INSERT INTO telebirr_sms_logs (sender, message_body, transaction_ref, amount, payer_phone, payer_name, recipient_name, balance_after, status, matched_user_id, matched_deposit_id, deposit_type, processed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'credited', $9, $10, 'direct_deposit', NOW())
         ON CONFLICT (transaction_ref) DO UPDATE 
         SET status = 'credited', matched_user_id = $9, matched_deposit_id = $10, deposit_type = 'direct_deposit', processed_at = NOW()`,
        [sender, messageBody, transactionRef, amount, senderPhone || null, senderName || null, recipientName || null, balanceAfter || null, matchedUserId, matchedDepositId]
      );

      return {
        status: 'credited',
        type: 'direct_deposit',
        userId: matchedUserId,
        depositId: matchedDepositId,
        amount,
        prevBal,
        newBal,
        txRef: transactionRef
      };
    });

    // 5. Fire Real-Time WebSocket Events
    if (result.status === 'credited') {
      io.emit('player_wallet_update', {
        userId: result.userId,
        balance: result.newBal,
        amountAdded: result.amount,
        type: 'deposit_auto_approved',
        reference: result.txRef
      });

      io.emit('deposit_approved', {
        userId: result.userId,
        amount: result.amount,
        txRef: result.txRef
      });

      if (result.type === 'agent_deposit') {
        io.emit('agent_request_updated', {
          requestId: result.depositId,
          agentId: (result as any).agentId,
          status: 'approved',
          approvedBy: 'SMS_AUTOMATION'
        });
      }

      console.log(`✅ [Telebirr Webhook] Successfully auto-approved ${result.type} of ${result.amount} ETB for user ${result.userId} (Tx: ${result.txRef})`);
    }

    return res.json({ success: true, result });
  } catch (error: any) {
    console.error('❌ [Telebirr Webhook Error]:', error);
    return res.status(500).json({ success: false, error: error.message || 'Webhook processing failed.' });
  }
});

/**
 * GET /api/webhooks/telebirr-logs
 * Admin list of recent SMS logs
 */
router.get('/telebirr-logs', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers['x-gateway-secret'] || req.headers['authorization'] || req.query.secret;
    const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;

    if (token !== SMS_GATEWAY_SECRET) {
      return res.status(401).json({ success: false, error: 'Unauthorized.' });
    }

    const logsRes = await query(`
      SELECT l.*, u.full_name as user_name, u.phone as user_phone
      FROM telebirr_sms_logs l
      LEFT JOIN users u ON l.matched_user_id = u.id
      ORDER BY l.received_at DESC
      LIMIT 100
    `);

    return res.json({ success: true, logs: logsRes.rows });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export const webhooksRouter = router;
