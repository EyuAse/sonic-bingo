import { Router, Request, Response } from 'express';
import { query } from '../db.ts';
import { parseTelebirrSMS } from '../services/telebirrParser.ts';
import { executeAgentDepositApproval, executeDirectDepositApproval } from '../services/depositAutoApprovalService.ts';

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

    // 🛡️ SECURITY GUARD: Strictly ignore Outgoing Transfers
    if (parsed.isOutgoing) {
      console.log(`ℹ️ [Telebirr Webhook] Ignored outgoing transfer SMS from ${sender}`);
      return res.json({ 
        success: true, 
        status: 'ignored', 
        reason: 'Outgoing transfer is not eligible for deposit credit.' 
      });
    }

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

    // 4. Check if transaction has already been credited (Anti-Replay Protection)
    const existingTx = await query(
      `SELECT id, status, matched_user_id FROM telebirr_sms_logs WHERE transaction_ref = $1 LIMIT 1`,
      [transactionRef]
    );

    if (existingTx.rows.length > 0 && existingTx.rows[0].status === 'credited') {
      console.log(`ℹ️ [Telebirr Webhook] Transaction ${transactionRef} already credited.`);
      return res.json({ 
        success: true,
        status: 'already_processed', 
        txRef: transactionRef,
        userId: existingTx.rows[0].matched_user_id 
      });
    }

    // 5. Upsert SMS Log Record (Status: 'unmatched' initially)
    const logRes = await query(
      `INSERT INTO telebirr_sms_logs 
        (sender, message_body, transaction_ref, amount, payer_phone, payer_name, recipient_name, balance_after, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'unmatched')
       ON CONFLICT (transaction_ref) DO UPDATE 
       SET message_body = $2, amount = $4, payer_phone = $5, payer_name = $6, recipient_name = $7, balance_after = $8
       RETURNING id, status`,
      [sender, messageBody, transactionRef, amount, senderPhone || null, senderName || null, recipientName || null, balanceAfter || null]
    );
    const smsLogId = logRes.rows[0]?.id;

    // 6. SEARCH 1: Check Agent Portal Deposits (`agent_deposit_requests`)
    // Match by exact transaction_code within 60 minutes
    let agentDepRes = await query(
      `SELECT id, amount, player_phone FROM agent_deposit_requests 
       WHERE status = 'pending' AND transaction_code ILIKE $1 
         AND created_at >= NOW() - INTERVAL '60 minutes'
       ORDER BY created_at DESC LIMIT 1`,
      [transactionRef]
    );

    if (agentDepRes.rows.length === 0 && senderLast4) {
      agentDepRes = await query(
        `SELECT id, amount, player_phone FROM agent_deposit_requests 
         WHERE status = 'pending' 
           AND amount = $1 
           AND player_phone LIKE '%' || $2
           AND created_at >= NOW() - INTERVAL '60 minutes'
         ORDER BY created_at DESC LIMIT 1`,
        [amount, senderLast4]
      );
    }

    if (agentDepRes.rows.length > 0) {
      const matchRow = agentDepRes.rows[0];
      const claimedAmt = parseFloat(matchRow.amount);

      // 🛡️ SECURITY PILLAR 1: Check Amount Mismatch
      if (Math.abs(claimedAmt - amount) > 0.01) {
        const mismatchReason = `Amount mismatch: User claimed ${claimedAmt.toFixed(2)} ETB, but Telebirr verified ${amount.toFixed(2)} ETB. Auto-rejected to prevent fraud.`;
        console.warn(`🚨 [SECURITY ALERT Webhook] ${mismatchReason} (Req: ${matchRow.id}, Tx: ${transactionRef})`);

        await query(
          `UPDATE agent_deposit_requests 
           SET status = 'rejected', rejection_reason = $1, resolved_at = NOW() 
           WHERE id = $2`,
          [mismatchReason, matchRow.id]
        );

        return res.json({
          success: true,
          status: 'rejected',
          reason: mismatchReason,
          claimedAmount: claimedAmt,
          verifiedAmount: amount
        });
      }

      console.log(`🎯 [Telebirr Webhook] Matched pending Agent Deposit Request: ${matchRow.id} (Verified: ${amount} ETB)`);
      const approveResult = await executeAgentDepositApproval(matchRow.id, transactionRef, smsLogId);
      return res.json({ success: true, result: approveResult });
    }

    // 7. SEARCH 2: Check Direct Central Cashier Deposits (`deposit_requests`)
    let dirDepRes = await query(
      `SELECT id, amount, player_phone FROM deposit_requests 
       WHERE status = 'pending' AND transaction_ref ILIKE $1 
         AND created_at >= NOW() - INTERVAL '60 minutes'
       ORDER BY created_at DESC LIMIT 1`,
      [transactionRef]
    );

    if (dirDepRes.rows.length === 0 && senderLast4) {
      dirDepRes = await query(
        `SELECT id, amount, player_phone FROM deposit_requests 
         WHERE status = 'pending' 
           AND amount = $1 
           AND player_phone LIKE '%' || $2
           AND created_at >= NOW() - INTERVAL '60 minutes'
         ORDER BY created_at DESC LIMIT 1`,
        [amount, senderLast4]
      );
    }

    if (dirDepRes.rows.length > 0) {
      const matchRow = dirDepRes.rows[0];
      const claimedAmt = parseFloat(matchRow.amount);

      // 🛡️ SECURITY PILLAR 1: Check Amount Mismatch
      if (Math.abs(claimedAmt - amount) > 0.01) {
        const mismatchReason = `Amount mismatch: User claimed ${claimedAmt.toFixed(2)} ETB, but Telebirr verified ${amount.toFixed(2)} ETB. Auto-rejected.`;
        console.warn(`🚨 [SECURITY ALERT Webhook Direct] ${mismatchReason} (Req: ${matchRow.id}, Tx: ${transactionRef})`);

        await query(
          `UPDATE deposit_requests 
           SET status = 'rejected', admin_notes = $1, reviewed_by = 'TELEBIRR_SMS_AUTO', reviewed_at = NOW() 
           WHERE id = $2`,
          [mismatchReason, matchRow.id]
        );

        return res.json({
          success: true,
          status: 'rejected',
          reason: mismatchReason,
          claimedAmount: claimedAmt,
          verifiedAmount: amount
        });
      }

      console.log(`🎯 [Telebirr Webhook] Matched pending Central Cashier Deposit Request: ${matchRow.id} (Verified: ${amount} ETB)`);
      const approveResult = await executeDirectDepositApproval(matchRow.id, transactionRef, smsLogId);
      return res.json({ success: true, result: approveResult });
    }

    // 8. No pending request matched yet -> Remains logged as 'unmatched'
    // When the player opens the app and submits within the next 60 minutes, wallet.ts will match it instantly!
    console.log(`⏳ [Telebirr Webhook] SMS logged (ID: ${smsLogId}, Tx: ${transactionRef}, ${amount} ETB). Waiting for player request submission.`);
    return res.json({
      success: true,
      result: {
        status: 'unmatched',
        txRef: transactionRef,
        amount,
        phone: senderPhone,
        senderName,
        message: 'SMS received and logged. Will auto-match when player submits deposit request.'
      }
    });
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
