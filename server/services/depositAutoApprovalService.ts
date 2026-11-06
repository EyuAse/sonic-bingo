import { query, withTransaction } from '../db.ts';
import { io } from '../io.ts';
import { coinService } from '../services/coinService.ts';

export interface AutoApproveResult {
  success: boolean;
  type?: 'agent_deposit' | 'direct_deposit';
  requestId?: string;
  userId?: string;
  amount?: number;
  newBalance?: number;
  txRef?: string;
  error?: string;
  message?: string;
  claimedAmount?: number;
  verifiedAmount?: number;
  alreadyProcessed?: boolean;
  status?: string;
}

/**
 * Executes full ACID approval for an Agent Deposit Request
 */
export async function executeAgentDepositApproval(
  requestId: string,
  txRef: string,
  smsLogId?: number
): Promise<AutoApproveResult> {
  try {
    const result = await withTransaction(async (client) => {
      // 1. Lock and fetch Telebirr SMS Log (Source of Truth)
      let smsRowQuery: any;
      if (smsLogId) {
        smsRowQuery = await client.query(
          `SELECT id, amount, transaction_ref, payer_phone, recipient_name, status, received_at 
           FROM telebirr_sms_logs WHERE id = $1 FOR UPDATE`,
          [smsLogId]
        );
      } else {
        smsRowQuery = await client.query(
          `SELECT id, amount, transaction_ref, payer_phone, recipient_name, status, received_at 
           FROM telebirr_sms_logs WHERE transaction_ref ILIKE $1 FOR UPDATE`,
          [txRef]
        );
      }

      if (smsRowQuery.rows.length === 0) {
        throw new Error(`Telebirr SMS log for transaction ${txRef} not found in database.`);
      }

      const smsRecord = smsRowQuery.rows[0];
      if (smsRecord.status === 'credited') {
        return { success: true, alreadyProcessed: true, status: 'already_credited', txRef };
      }

      const verifiedAmount = parseFloat(smsRecord.amount);
      if (isNaN(verifiedAmount) || verifiedAmount <= 0) {
        throw new Error(`Invalid verified SMS amount for transaction ${txRef}: ${smsRecord.amount}`);
      }

      // 2. Lock agent deposit request
      const reqRes = await client.query(
        `SELECT * FROM agent_deposit_requests WHERE id = $1 FOR UPDATE`,
        [requestId]
      );

      if (reqRes.rows.length === 0) {
        throw new Error(`Agent deposit request ${requestId} not found`);
      }

      const depReq = reqRes.rows[0];
      if (depReq.status !== 'pending') {
        return { success: true, alreadyProcessed: true, status: depReq.status };
      }

      const userClaimedAmount = parseFloat(depReq.amount);

      // 🛡️ SECURITY PILLAR 1: Amount Reconciliation Firewall
      // If user claimed 100 ETB, but Telebirr received 53 ETB: STRICTLY REJECT to prevent theft!
      if (Math.abs(userClaimedAmount - verifiedAmount) > 0.01) {
        const mismatchReason = `Amount mismatch: User claimed ${userClaimedAmount.toFixed(2)} ETB in app, but Telebirr verified ${verifiedAmount.toFixed(2)} ETB. Auto-rejected.`;
        console.warn(`🚨 [SECURITY ALERT] ${mismatchReason} (Req: ${requestId}, Tx: ${txRef})`);

        await client.query(
          `UPDATE agent_deposit_requests 
           SET status = 'rejected', rejection_reason = $1, resolved_at = NOW() 
           WHERE id = $2`,
          [mismatchReason, requestId]
        );

        return {
          success: false,
          error: 'AMOUNT_MISMATCH',
          message: mismatchReason,
          claimedAmount: userClaimedAmount,
          verifiedAmount
        };
      }

      // 🛡️ SOURCE OF TRUTH: Always use the verified amount from the bank SMS!
      const depositAmount = verifiedAmount;
      const agentId = depReq.agent_id;
      const playerId = depReq.player_id;

      // 3. Lock agent profile
      const agentProfileRes = await client.query(
        `SELECT id, agent_code, wallet_balance, commission_rate FROM agent_profiles WHERE id = $1 FOR UPDATE`,
        [agentId]
      );
      const agentProfile = agentProfileRes.rows[0];
      const agentBalance = parseFloat(agentProfile?.wallet_balance || '0');

      // 🛡️ SECURITY PILLAR 7: Agent Float Solvency Guard
      if (agentBalance < depositAmount) {
        console.warn(`⚠️ [Agent Float Insufficient] Agent ${agentId} float balance ${agentBalance} < required ${depositAmount}`);
        await client.query(
          `UPDATE agent_deposit_requests 
           SET rejection_reason = 'Agent float temporarily insufficient. Please contact agent to top up float.' 
           WHERE id = $1`,
          [depReq.id]
        );
        return {
          success: false,
          error: 'AGENT_FLOAT_INSUFFICIENT',
          message: `Agent #${agentProfile?.agent_code || agentId} does not have sufficient float balance.`
        };
      }

      const commissionRate = parseFloat(agentProfile?.commission_rate || '5.0');
      const commissionEarned = depositAmount * (commissionRate / 100);
      const agentBalAfter = Math.max(0, agentBalance - depositAmount);

      // 4. Lock player wallet
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

      // 4. Update agent profile
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

      // 5. Credit player wallet
      await client.query(
        `UPDATE wallets SET balance = $1, updated_at = NOW() WHERE id = $2`,
        [playerBalAfter, playerWallet.id]
      );

      // 6. Award coins
      try {
        await coinService.awardCoinsForDeposit(playerId, depositAmount, txRef, client);
      } catch (cErr) {
        console.warn('⚠️ Coin award notice:', cErr);
      }

      // 7. Mark player verified
      await client.query(
        `UPDATE users SET has_deposited = true, agent_id = COALESCE(agent_id, $1) WHERE id = $2`,
        [agentId, playerId]
      );

      // 8. Audit logs
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
          [agentId, playerId, depositAmount, agentBalAfter, playerBalAfter, depReq.payment_method, txRef]
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
          txRef,
          depReq.payment_method,
          `Automated Deposit via Agent #${agentProfile?.agent_code || agentId} (${txRef})`
        ]
      );

      // 9. Update request to 'approved'
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

      // 10. Update telebirr_sms_logs
      if (smsLogId) {
        await client.query(
          `UPDATE telebirr_sms_logs 
           SET status = 'credited', matched_user_id = $1, matched_deposit_id = $2, deposit_type = 'agent_deposit', processed_at = NOW() 
           WHERE id = $3`,
          [playerId, depReq.id, smsLogId]
        );
      } else {
        await client.query(
          `UPDATE telebirr_sms_logs 
           SET status = 'credited', matched_user_id = $1, matched_deposit_id = $2, deposit_type = 'agent_deposit', processed_at = NOW() 
           WHERE transaction_ref ILIKE $3`,
          [playerId, depReq.id, txRef]
        );
      }

      return {
        success: true,
        type: 'agent_deposit',
        requestId: depReq.id,
        agentId,
        userId: playerId,
        amount: depositAmount,
        newBalance: playerBalAfter,
        txRef
      };
    });

    if (result.success && !result.alreadyProcessed) {
      io.emit('player_wallet_update', {
        userId: result.userId,
        balance: result.newBalance,
        amountAdded: result.amount,
        type: 'deposit_auto_approved',
        reference: result.txRef
      });

      io.emit('deposit_approved', {
        userId: result.userId,
        amount: result.amount,
        txRef: result.txRef
      });

      io.emit('agent_request_updated', {
        requestId: result.requestId,
        agentId: (result as any).agentId,
        status: 'approved',
        approvedBy: 'TELEBIRR_SMS_AUTO'
      });

      console.log(`✅ [Instant Auto-Approve] Credited ${result.amount} ETB to player ${result.userId} (Tx: ${result.txRef})`);
    }

    return result as AutoApproveResult;
  } catch (err: any) {
    console.error('❌ [AutoApprove Error]:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Executes full ACID approval for a Direct Central Cashier Deposit Request
 */
export async function executeDirectDepositApproval(
  depositId: string,
  txRef: string,
  smsLogId?: number
): Promise<AutoApproveResult> {
  try {
    const result = await withTransaction(async (client) => {
      // 1. Lock and fetch Telebirr SMS Log (Source of Truth)
      let smsRowQuery: any;
      if (smsLogId) {
        smsRowQuery = await client.query(
          `SELECT id, amount, transaction_ref, payer_phone, recipient_name, status, received_at 
           FROM telebirr_sms_logs WHERE id = $1 FOR UPDATE`,
          [smsLogId]
        );
      } else {
        smsRowQuery = await client.query(
          `SELECT id, amount, transaction_ref, payer_phone, recipient_name, status, received_at 
           FROM telebirr_sms_logs WHERE transaction_ref ILIKE $1 FOR UPDATE`,
          [txRef]
        );
      }

      if (smsRowQuery.rows.length === 0) {
        throw new Error(`Telebirr SMS log for transaction ${txRef} not found in database.`);
      }

      const smsRecord = smsRowQuery.rows[0];
      if (smsRecord.status === 'credited') {
        return { success: true, alreadyProcessed: true, status: 'already_credited', txRef };
      }

      const verifiedAmount = parseFloat(smsRecord.amount);
      if (isNaN(verifiedAmount) || verifiedAmount <= 0) {
        throw new Error(`Invalid verified SMS amount for transaction ${txRef}: ${smsRecord.amount}`);
      }

      // 2. Lock deposit request
      const reqRes = await client.query(
        `SELECT * FROM deposit_requests WHERE id = $1 FOR UPDATE`,
        [depositId]
      );

      if (reqRes.rows.length === 0) {
        throw new Error(`Deposit request ${depositId} not found`);
      }

      const depReq = reqRes.rows[0];
      if (depReq.status !== 'pending') {
        return { success: true, alreadyProcessed: true, status: depReq.status };
      }

      const userClaimedAmount = parseFloat(depReq.amount);

      // 🛡️ SECURITY PILLAR 1: Amount Reconciliation Firewall
      if (Math.abs(userClaimedAmount - verifiedAmount) > 0.01) {
        const mismatchReason = `Amount mismatch: User claimed ${userClaimedAmount.toFixed(2)} ETB, but Telebirr verified ${verifiedAmount.toFixed(2)} ETB. Auto-rejected.`;
        console.warn(`🚨 [SECURITY ALERT Direct Deposit] ${mismatchReason} (Req: ${depositId}, Tx: ${txRef})`);

        await client.query(
          `UPDATE deposit_requests 
           SET status = 'rejected', admin_notes = $1, reviewed_by = 'TELEBIRR_SMS_AUTO', reviewed_at = NOW() 
           WHERE id = $2`,
          [mismatchReason, depositId]
        );

        return {
          success: false,
          error: 'AMOUNT_MISMATCH',
          message: mismatchReason,
          claimedAmount: userClaimedAmount,
          verifiedAmount
        };
      }

      // 🛡️ SOURCE OF TRUTH: Credit strictly verified amount
      const depositAmount = verifiedAmount;
      const playerId = depReq.user_id;

      // 3. Lock player wallet
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

      // 3. Credit player wallet
      await client.query(
        `UPDATE wallets SET balance = $1, updated_at = NOW() WHERE id = $2`,
        [playerBalAfter, playerWallet.id]
      );

      // 4. Award coins
      try {
        await coinService.awardCoinsForDeposit(playerId, depositAmount, txRef, client);
      } catch (cErr) {
        console.warn('⚠️ Coin award notice:', cErr);
      }

      // 5. Mark user has_deposited
      await client.query(
        `UPDATE users SET has_deposited = true WHERE id = $1`,
        [playerId]
      );

      // 6. Record transaction
      await client.query(
        `INSERT INTO wallet_transactions 
          (user_id, type, amount, balance_after, reference_code, status, payment_method, description)
         VALUES ($1, 'deposit', $2, $3, $4, 'completed', $5, $6)`,
        [
          playerId,
          depositAmount,
          playerBalAfter,
          txRef,
          depReq.payment_method || 'Telebirr',
          `Automated Telebirr Cashier Deposit (${txRef})`
        ]
      );

      // 7. Update deposit_requests
      await client.query(
        `UPDATE deposit_requests 
         SET status = 'approved',
             transaction_ref = $1,
             reviewed_by = 'TELEBIRR_SMS_AUTO',
             reviewed_at = NOW()
         WHERE id = $2`,
        [txRef, depReq.id]
      );

      // 8. Update telebirr_sms_logs
      if (smsLogId) {
        await client.query(
          `UPDATE telebirr_sms_logs 
           SET status = 'credited', matched_user_id = $1, matched_deposit_id = $2, deposit_type = 'direct_deposit', processed_at = NOW() 
           WHERE id = $3`,
          [playerId, depReq.id, smsLogId]
        );
      } else {
        await client.query(
          `UPDATE telebirr_sms_logs 
           SET status = 'credited', matched_user_id = $1, matched_deposit_id = $2, deposit_type = 'direct_deposit', processed_at = NOW() 
           WHERE transaction_ref ILIKE $3`,
          [playerId, depReq.id, txRef]
        );
      }

      return {
        success: true,
        type: 'direct_deposit',
        requestId: depReq.id,
        userId: playerId,
        amount: depositAmount,
        newBalance: playerBalAfter,
        txRef
      };
    });

    if (result.success && !result.alreadyProcessed) {
      io.emit('player_wallet_update', {
        userId: result.userId,
        balance: result.newBalance,
        amountAdded: result.amount,
        type: 'deposit_auto_approved',
        reference: result.txRef
      });

      io.emit('deposit_approved', {
        userId: result.userId,
        amount: result.amount,
        txRef: result.txRef
      });

      console.log(`✅ [Instant Auto-Approve Cashier] Credited ${result.amount} ETB to player ${result.userId} (Tx: ${result.txRef})`);
    }

    return result as AutoApproveResult;
  } catch (err: any) {
    console.error('❌ [Direct AutoApprove Error]:', err);
    return { success: false, error: err.message };
  }
}
