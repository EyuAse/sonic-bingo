import { Router, Response } from 'express';
import { query, withTransaction } from '../db.ts';
import { requireAdmin, AuthenticatedRequest } from '../middleware/auth.ts';
import { io } from '../io.ts';

export const adminRechargesRouter = Router();

function formatRelativeTime(dateInput: Date | string): string {
  const d = new Date(dateInput);
  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} d ago`;
  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths} mo ago`;
}

function formatTimelineDate(d: Date = new Date()): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = d.getDate();
  const month = months[d.getMonth()];
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${hours}:${minutes}`;
}

function normalizeStatus(st: string): 'Requested' | 'Under review' | 'Awaiting 2nd approval' | 'Credited' | 'Rejected' {
  const s = (st || '').toLowerCase().trim();
  if (s === 'approved' || s === 'credited') return 'Credited';
  if (s === 'rejected') return 'Rejected';
  if (s === 'under_review' || s === 'under review') return 'Under review';
  if (s === 'awaiting_2nd_approval' || s === 'awaiting 2nd approval') return 'Awaiting 2nd approval';
  return 'Requested';
}

/**
 * 1. GET /api/admin/agent-recharges/kpis
 * 3 Top KPI Cards: Open Requests (Dark Card), Credited Today, Low-balance Agents
 */
adminRechargesRouter.get('/kpis', requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    // 1. Open Requests
    const openRes = await query(`
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as total_amount
      FROM agent_recharge_requests
      WHERE status IN ('pending', 'Requested', 'under_review', 'Under review', 'awaiting_2nd_approval', 'Awaiting 2nd approval')
    `);
    const openCount = parseInt(openRes.rows[0]?.count || '0', 10);
    const openAmount = parseFloat(openRes.rows[0]?.total_amount || '0');

    // 2. Credited Today
    const creditedRes = await query(`
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(COALESCE(received_amount, amount)), 0) as total_amount
      FROM agent_recharge_requests
      WHERE status IN ('approved', 'Credited')
        AND (
          (reviewed_at IS NOT NULL AND DATE(reviewed_at) = CURRENT_DATE)
          OR (reviewed_at IS NULL AND DATE(created_at) = CURRENT_DATE)
        )
    `);
    const creditedTodayCount = parseInt(creditedRes.rows[0]?.count || '0', 10);
    const creditedTodayAmount = parseFloat(creditedRes.rows[0]?.total_amount || '0');

    // 3. Low-balance Agents (< 1000 ETB)
    const lowBalRes = await query(`
      SELECT COUNT(*) as count
      FROM agent_profiles
      WHERE status = 'active' AND wallet_balance < 1000
    `);
    const lowBalanceCount = parseInt(lowBalRes.rows[0]?.count || '0', 10);

    return res.json({
      success: true,
      kpis: {
        openRequests: {
          count: openCount,
          awaitingAmount: openAmount
        },
        creditedToday: {
          count: creditedTodayCount,
          totalAmount: creditedTodayAmount
        },
        lowBalanceAgents: {
          count: lowBalanceCount
        }
      }
    });
  } catch (err: any) {
    console.error('❌ [Agent Recharges KPIs Error]:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to fetch KPIs' });
  }
});

/**
 * 2. GET /api/admin/agent-recharges/flow
 * 4-Step Workflow Bar metrics
 */
adminRechargesRouter.get('/flow', requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const flowRes = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE status IN ('pending', 'Requested')) as step1_request,
        COUNT(*) FILTER (WHERE status IN ('under_review', 'Under review')) as step2_verify,
        COUNT(*) FILTER (WHERE status IN ('awaiting_2nd_approval', 'Awaiting 2nd approval')) as step3_credit,
        COUNT(*) FILTER (
          WHERE status IN ('approved', 'Credited') 
          AND (
            (reviewed_at IS NOT NULL AND DATE(reviewed_at) = CURRENT_DATE)
            OR (reviewed_at IS NULL AND DATE(created_at) = CURRENT_DATE)
          )
        ) as step4_notify
      FROM agent_recharge_requests
    `);

    const r = flowRes.rows[0] || {};
    return res.json({
      success: true,
      flow: {
        step1: parseInt(r.step1_request || '0', 10),
        step2: parseInt(r.step2_verify || '0', 10),
        step3: parseInt(r.step3_credit || '0', 10),
        step4: parseInt(r.step4_notify || '0', 10)
      }
    });
  } catch (err: any) {
    console.error('❌ [Agent Recharges Flow Error]:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to fetch flow' });
  }
});

/**
 * 3. GET /api/admin/agent-recharges/requests
 * Filtered requests list: 'Open' | 'Credited' | 'Rejected' | 'All'
 */
adminRechargesRouter.get('/requests', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const filter = (req.query.filter as string) || 'Open';

    let statusCondition = '';
    if (filter === 'Open') {
      statusCondition = "AND arr.status IN ('pending', 'Requested', 'under_review', 'Under review', 'awaiting_2nd_approval', 'Awaiting 2nd approval')";
    } else if (filter === 'Credited') {
      statusCondition = "AND arr.status IN ('approved', 'Credited')";
    } else if (filter === 'Rejected') {
      statusCondition = "AND arr.status = 'rejected'";
    }

    const requestsRes = await query(`
      SELECT 
        arr.id,
        arr.agent_id,
        arr.amount,
        arr.received_amount,
        arr.payment_method,
        arr.transaction_code,
        arr.receipt_image,
        arr.status,
        arr.admin_notes,
        arr.created_at,
        arr.reviewed_at,
        arr.timeline,
        arr.checklist,
        ap.agent_code,
        ap.wallet_balance as current_wallet_balance,
        ap.city,
        ap.telebirr_phone,
        ap.mpesa_phone,
        ap.cbe_account,
        u.full_name as agent_name,
        u.phone as agent_phone
      FROM agent_recharge_requests arr
      JOIN agent_profiles ap ON arr.agent_id = ap.id
      JOIN users u ON ap.user_id = u.id
      WHERE 1=1 ${statusCondition}
      ORDER BY arr.created_at DESC
      LIMIT 100
    `);

    // Check for duplicate transaction codes across other requests
    const allTxsRes = await query(`
      SELECT id, transaction_code, status 
      FROM agent_recharge_requests 
      WHERE transaction_code IS NOT NULL AND TRIM(transaction_code) != ''
    `);

    const txCodeMap = new Map<string, Array<{ id: string; status: string }>>();
    allTxsRes.rows.forEach(r => {
      const code = r.transaction_code.trim().toUpperCase();
      if (!txCodeMap.has(code)) txCodeMap.set(code, []);
      txCodeMap.get(code)!.push({ id: r.id, status: r.status });
    });

    const requests = requestsRes.rows.map((r, index) => {
      const codeUpper = (r.transaction_code || '').trim().toUpperCase();
      const otherMatches = (txCodeMap.get(codeUpper) || []).filter(m => m.id !== r.id && m.status !== 'rejected');
      const isDuplicate = otherMatches.length > 0;
      let duplicateMsg = '';
      if (isDuplicate) {
        const creditedMatch = otherMatches.find(m => m.status === 'approved' || m.status === 'Credited');
        if (creditedMatch) {
          duplicateMsg = `Already used in completed recharge`;
        } else {
          duplicateMsg = `Also used in open request`;
        }
      }

      const amt = parseFloat(r.amount || '0');
      const recvAmt = r.received_amount ? parseFloat(r.received_amount) : amt;
      const walletNow = parseFloat(r.current_wallet_balance || '0');
      const normStatus = normalizeStatus(r.status);

      // Parse timeline
      let tl: Array<[string, string]> = [];
      if (Array.isArray(r.timeline) && r.timeline.length > 0) {
        tl = r.timeline;
      } else {
        tl = [[formatTimelineDate(new Date(r.created_at)), `Request submitted with code ${r.transaction_code || 'N/A'}`]];
      }

      // Parse checklist
      const chk = r.checklist && typeof r.checklist === 'object' ? r.checklist : { c1: false, c2: false, c3: false, c4: false };

      // Deterministic request code (e.g. R-301)
      const codeNum = 300 + requestsRes.rows.length - index;
      const displayCode = `R-${codeNum}`;

      return {
        id: r.id,
        code: displayCode,
        agentId: r.agent_id,
        agentName: r.agent_name || 'Agent',
        agentCode: r.agent_code,
        agentCity: r.city || 'Addis Ababa',
        agentPhone: r.agent_phone || r.telebirr_phone || r.mpesa_phone || '09-- --- ---',
        amount: amt,
        receivedAmount: recvAmt,
        paymentMethod: r.payment_method || 'Telebirr',
        transactionCode: r.transaction_code || '',
        receiptImage: r.receipt_image || null,
        status: normStatus,
        adminNotes: r.admin_notes || null,
        walletNow,
        walletAfter: walletNow + (recvAmt || amt),
        createdAt: r.created_at,
        relativeTime: formatRelativeTime(r.created_at),
        timeline: tl,
        checklist: chk,
        isDuplicate,
        duplicateMsg: isDuplicate ? duplicateMsg : ''
      };
    });

    return res.json({
      success: true,
      requests
    });
  } catch (err: any) {
    console.error('❌ [Agent Recharges Requests List Error]:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to fetch requests' });
  }
});

/**
 * 4. POST /api/admin/agent-recharges/:id/start-review
 * Advances status to 'Under review' and writes timeline event
 */
adminRechargesRouter.post('/:id/start-review', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const adminName = req.user?.fullName || 'Admin';

    const reqRes = await query(`SELECT * FROM agent_recharge_requests WHERE id = $1`, [id]);
    if (reqRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Recharge request not found' });
    }
    const current = reqRes.rows[0];

    const currentTl: Array<[string, string]> = Array.isArray(current.timeline) ? current.timeline : [];
    const newEvent: [string, string] = [formatTimelineDate(), `Review started by ${adminName}`];
    const updatedTl = [newEvent, ...currentTl];

    await query(`
      UPDATE agent_recharge_requests 
      SET status = 'Under review',
          timeline = $1::jsonb
      WHERE id = $2
    `, [JSON.stringify(updatedTl), id]);

    io.emit('admin_agent_recharge_update', { id, status: 'Under review' });

    return res.json({
      success: true,
      status: 'Under review',
      timeline: updatedTl
    });
  } catch (err: any) {
    console.error('❌ [Agent Recharges Start Review Error]:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to start review' });
  }
});

/**
 * 5. POST /api/admin/agent-recharges/:id/checklist
 * Saves 4 verification checklist states and received amount
 */
adminRechargesRouter.post('/:id/checklist', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { checklist, receivedAmount } = req.body;

    await query(`
      UPDATE agent_recharge_requests 
      SET checklist = COALESCE($1::jsonb, checklist),
          received_amount = COALESCE($2, received_amount)
      WHERE id = $3
    `, [checklist ? JSON.stringify(checklist) : null, receivedAmount !== undefined ? receivedAmount : null, id]);

    return res.json({ success: true, message: 'Checklist updated' });
  } catch (err: any) {
    console.error('❌ [Agent Recharges Checklist Error]:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to update checklist' });
  }
});

/**
 * 6. POST /api/admin/agent-recharges/:id/credit
 * Verifies & Credits Agent Wallet:
 * - If amount > 20,000 ETB and not yet second-approved: sets 'Awaiting 2nd approval'
 * - Otherwise: atomically credits agent_profiles.wallet_balance and records ledger entry
 */
adminRechargesRouter.post('/:id/credit', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const adminUser = req.user;
    const adminName = adminUser?.fullName || 'Admin';

    const result = await withTransaction(async (client) => {
      const rRes = await client.query(`
        SELECT arr.*, ap.wallet_balance, ap.user_id as agent_user_id, ap.agent_code, u.full_name as agent_name
        FROM agent_recharge_requests arr
        JOIN agent_profiles ap ON arr.agent_id = ap.id
        JOIN users u ON ap.user_id = u.id
        WHERE arr.id = $1
        FOR UPDATE
      `, [id]);

      if (rRes.rows.length === 0) {
        throw new Error('Recharge request not found');
      }

      const recharge = rRes.rows[0];
      const normStatus = normalizeStatus(recharge.status);

      if (normStatus === 'Credited') {
        throw new Error('This recharge request has already been credited.');
      }
      if (normStatus === 'Rejected') {
        throw new Error('Cannot credit a rejected request.');
      }

      const requestedAmt = parseFloat(recharge.amount);
      const creditAmt = recharge.received_amount ? parseFloat(recharge.received_amount) : requestedAmt;

      if (isNaN(creditAmt) || creditAmt <= 0) {
        throw new Error('Invalid recharge amount');
      }

      const currentTl: Array<[string, string]> = Array.isArray(recharge.timeline) ? recharge.timeline : [];

      // Check > 20,000 ETB 2nd Approval Rule
      if (creditAmt > 20000 && normStatus !== 'Awaiting 2nd approval') {
        const newEvent: [string, string] = [
          formatTimelineDate(),
          `Verified by ${adminName}. Needs a second approval (above 20,000 ETB)`
        ];
        const updatedTl = [newEvent, ...currentTl];

        await client.query(`
          UPDATE agent_recharge_requests
          SET status = 'Awaiting 2nd approval',
              timeline = $1::jsonb
          WHERE id = $2
        `, [JSON.stringify(updatedTl), id]);

        return {
          status: 'Awaiting 2nd approval',
          message: 'Sent for second approval (above 20,000 ETB)',
          timeline: updatedTl
        };
      }

      // Approved / Second Approved -> Execute Credit
      const currentBal = parseFloat(recharge.wallet_balance || '0');
      const newBal = currentBal + creditAmt;
      const txCode = `TX-${Date.now().toString().slice(-6)}`;

      // 1. Update recharge request status
      const newEvent: [string, string] = [
        formatTimelineDate(),
        `Credited ${creditAmt.toLocaleString('en-US')} ETB${creditAmt !== requestedAmt ? ` (received amount, requested ${requestedAmt.toLocaleString('en-US')})` : ''}. Balance ${currentBal.toLocaleString('en-US')} to ${newBal.toLocaleString('en-US')} ETB. Transaction ${txCode}. Agent notified`
      ];
      const updatedTl = [newEvent, ...currentTl];

      await client.query(`
        UPDATE agent_recharge_requests
        SET status = 'Credited',
            received_amount = $1,
            reviewed_by = $2,
            reviewed_at = NOW(),
            second_approved_by = CASE WHEN $3 = 'Awaiting 2nd approval' THEN $2 ELSE second_approved_by END,
            second_approved_at = CASE WHEN $3 = 'Awaiting 2nd approval' THEN NOW() ELSE second_approved_at END,
            timeline = $4::jsonb
        WHERE id = $5
      `, [creditAmt, adminUser?.id || null, normStatus, JSON.stringify(updatedTl), id]);

      // 2. Increment Agent Wallet Balance
      await client.query(`
        UPDATE agent_profiles
        SET wallet_balance = wallet_balance + $1,
            updated_at = NOW()
        WHERE id = $2
      `, [creditAmt, recharge.agent_id]);

      // 3. Record in wallet_transactions for agent ledger
      await client.query(`
        INSERT INTO wallet_transactions (
          user_id,
          type,
          amount,
          balance_after,
          reference_code,
          status,
          payment_method,
          description
        ) VALUES ($1, 'deposit', $2, $3, $4, 'completed', $5, $6)
      `, [
        recharge.agent_user_id,
        creditAmt,
        newBal,
        txCode,
        recharge.payment_method || 'Telebirr',
        `Agent Float Recharge: ${creditAmt.toFixed(2)} ETB (Ref: ${recharge.transaction_code || txCode})`
      ]);

      return {
        status: 'Credited',
        message: `Wallet credited: ${creditAmt.toLocaleString('en-US')} ETB`,
        txCode,
        agentId: recharge.agent_id,
        agentUserId: recharge.agent_user_id,
        newBalance: newBal,
        timeline: updatedTl
      };
    });

    // Notify Agent Portal & Admin Dashboard via WebSockets
    if (result.status === 'Credited') {
      io.to(`user_${result.agentUserId}`).emit('agent_wallet_updated', {
        agentId: result.agentId,
        walletBalance: result.newBalance,
        message: `Your agent wallet has been credited with ${result.message}`
      });
      io.emit('admin_agent_recharge_update', { id, status: 'Credited', balance: result.newBalance });
    } else {
      io.emit('admin_agent_recharge_update', { id, status: result.status });
    }

    return res.json({
      success: true,
      status: result.status,
      message: result.message,
      timeline: result.timeline
    });
  } catch (err: any) {
    console.error('❌ [Agent Recharges Credit Error]:', err);
    return res.status(400).json({ success: false, error: err.message || 'Failed to credit wallet' });
  }
});

/**
 * 7. POST /api/admin/agent-recharges/:id/reject
 * Rejects request with audit note and updates timeline
 */
adminRechargesRouter.post('/:id/reject', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason, note } = req.body;
    const adminName = req.user?.fullName || 'Admin';

    const reqRes = await query(`
      SELECT arr.*, ap.user_id as agent_user_id 
      FROM agent_recharge_requests arr
      JOIN agent_profiles ap ON arr.agent_id = ap.id
      WHERE arr.id = $1
    `, [id]);

    if (reqRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Recharge request not found' });
    }
    const recharge = reqRes.rows[0];

    const currentTl: Array<[string, string]> = Array.isArray(recharge.timeline) ? recharge.timeline : [];
    const rejReason = reason || 'Payment not found';
    const rejNote = note && note.trim() ? `. ${note.trim()}` : '';
    const newEvent: [string, string] = [
      formatTimelineDate(),
      `Rejected: ${rejReason}${rejNote}. Agent notified`
    ];
    const updatedTl = [newEvent, ...currentTl];

    await query(`
      UPDATE agent_recharge_requests 
      SET status = 'Rejected',
          admin_notes = $1,
          reviewed_by = $2,
          reviewed_at = NOW(),
          timeline = $3::jsonb
      WHERE id = $4
    `, [rejReason + rejNote, req.user?.id || null, JSON.stringify(updatedTl), id]);

    // Notify agent portal
    io.to(`user_${recharge.agent_user_id}`).emit('agent_recharge_rejected', {
      id,
      reason: rejReason,
      note: note || ''
    });
    io.emit('admin_agent_recharge_update', { id, status: 'Rejected' });

    return res.json({
      success: true,
      status: 'Rejected',
      message: 'Request rejected',
      timeline: updatedTl
    });
  } catch (err: any) {
    console.error('❌ [Agent Recharges Reject Error]:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to reject request' });
  }
});

/**
 * 8. GET /api/admin/agent-recharges/history
 * Transaction history across time periods: 'today' | 'week' | 'month' | 'all' | 'custom'
 * Includes 4 period stats cards: Total Credited, Rejected, Average Recharge, Largest Recharge
 */
adminRechargesRouter.get('/history', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const period = (req.query.period as string) || 'all';
    const fromDate = req.query.from as string;
    const toDate = req.query.to as string;
    const search = ((req.query.search as string) || '').trim().toLowerCase();
    const agentFilter = (req.query.agent as string) || '';

    let dateClause = '';
    const params: any[] = [];

    if (period === 'today') {
      dateClause = "AND ((COALESCE(arr.reviewed_at, arr.created_at) AT TIME ZONE 'Africa/Addis_Ababa')::date = (NOW() AT TIME ZONE 'Africa/Addis_Ababa')::date)";
    } else if (period === 'week') {
      dateClause = "AND ((COALESCE(arr.reviewed_at, arr.created_at) AT TIME ZONE 'Africa/Addis_Ababa') >= (NOW() AT TIME ZONE 'Africa/Addis_Ababa' - INTERVAL '7 days'))";
    } else if (period === 'month') {
      dateClause = "AND ((COALESCE(arr.reviewed_at, arr.created_at) AT TIME ZONE 'Africa/Addis_Ababa') >= DATE_TRUNC('month', NOW() AT TIME ZONE 'Africa/Addis_Ababa'))";
    } else if (period === 'custom' || fromDate || toDate) {
      if (fromDate && toDate) {
        params.push(fromDate, toDate);
        dateClause = `AND ((COALESCE(arr.reviewed_at, arr.created_at) AT TIME ZONE 'Africa/Addis_Ababa')::date BETWEEN $${params.length - 1}::date AND $${params.length}::date)`;
      } else if (fromDate) {
        params.push(fromDate);
        dateClause = `AND ((COALESCE(arr.reviewed_at, arr.created_at) AT TIME ZONE 'Africa/Addis_Ababa')::date >= $${params.length}::date)`;
      } else if (toDate) {
        params.push(toDate);
        dateClause = `AND ((COALESCE(arr.reviewed_at, arr.created_at) AT TIME ZONE 'Africa/Addis_Ababa')::date <= $${params.length}::date)`;
      }
    }

    const historyRes = await query(`
      SELECT 
        arr.id,
        arr.agent_id,
        arr.amount,
        arr.received_amount,
        arr.payment_method,
        arr.transaction_code,
        arr.receipt_image,
        arr.status,
        arr.admin_notes,
        arr.created_at,
        arr.reviewed_at,
        ap.agent_code,
        ap.wallet_balance as current_wallet_balance,
        ap.city,
        ap.telebirr_phone,
        ap.mpesa_phone,
        ap.cbe_account,
        u.full_name as agent_name
      FROM agent_recharge_requests arr
      JOIN agent_profiles ap ON arr.agent_id = ap.id
      JOIN users u ON ap.user_id = u.id
      WHERE arr.status IN ('approved', 'Credited', 'rejected', 'Rejected')
      ${dateClause}
      ORDER BY COALESCE(arr.reviewed_at, arr.created_at) DESC
      LIMIT 500
    `, params);

    let rows = historyRes.rows.map((r, i) => {
      const amt = parseFloat(r.received_amount || r.amount || '0');
      const normStatus = normalizeStatus(r.status);
      const isCredited = normStatus === 'Credited';
      const eventDate = r.reviewed_at || r.created_at;

      return {
        id: `TX-${9000 + historyRes.rows.length - i}`,
        requestId: `R-${300 + historyRes.rows.length - i}`,
        dbId: r.id,
        agentId: r.agent_id,
        agentName: r.agent_name || 'Agent',
        agentCode: r.agent_code,
        agentCity: r.city || 'Addis Ababa',
        agentPhone: r.agent_phone || r.telebirr_phone || r.mpesa_phone || '09-- --- ---',
        transactionCode: r.transaction_code || '',
        paymentMethod: r.payment_method || 'Telebirr',
        amount: amt,
        balanceBefore: isCredited ? Math.max(0, parseFloat(r.current_wallet_balance || '0') - amt) : null,
        balanceAfter: isCredited ? parseFloat(r.current_wallet_balance || '0') : null,
        status: normStatus,
        receiptImage: r.receipt_image || null,
        dateFormatted: formatTimelineDate(new Date(eventDate)),
        isoDate: new Date(eventDate).toISOString().split('T')[0]
      };
    });

    // Apply agent or text search filtering
    if (agentFilter) {
      rows = rows.filter(r => r.agentName.toLowerCase() === agentFilter.toLowerCase() || r.agentCode.toLowerCase() === agentFilter.toLowerCase());
    }
    if (search) {
      rows = rows.filter(r => 
        r.agentName.toLowerCase().includes(search) ||
        r.agentCode.toLowerCase().includes(search) ||
        r.transactionCode.toLowerCase().includes(search) ||
        r.id.toLowerCase().includes(search)
      );
    }

    // Compute period stats
    const creditedRows = rows.filter(r => r.status === 'Credited');
    const totalCredited = creditedRows.reduce((sum, r) => sum + r.amount, 0);
    const rejectedCount = rows.filter(r => r.status === 'Rejected').length;
    const avgRecharge = creditedRows.length > 0 ? Math.round(totalCredited / creditedRows.length) : 0;
    const largestRecharge = creditedRows.reduce((max, r) => Math.max(max, r.amount), 0);

    return res.json({
      success: true,
      stats: {
        totalCredited,
        creditedCount: creditedRows.length,
        rejectedCount,
        averageRecharge: avgRecharge,
        largestRecharge
      },
      rows
    });
  } catch (err: any) {
    console.error('❌ [Agent Recharges History Error]:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to fetch history' });
  }
});

/**
 * 9. GET /api/admin/agent-recharges/low-balance
 * Returns agents with wallet_balance < 1000 ETB
 */
adminRechargesRouter.get('/low-balance', requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const lowAgentsRes = await query(`
      SELECT 
        ap.id,
        ap.agent_code,
        ap.wallet_balance,
        ap.city,
        ap.telebirr_phone,
        ap.mpesa_phone,
        ap.cbe_account,
        u.full_name as agent_name,
        u.phone as agent_phone,
        (
          SELECT COALESCE(reviewed_at, created_at)
          FROM agent_recharge_requests
          WHERE agent_id = ap.id AND status IN ('approved', 'Credited')
          ORDER BY created_at DESC
          LIMIT 1
        ) as last_recharge_at
      FROM agent_profiles ap
      JOIN users u ON ap.user_id = u.id
      WHERE ap.status = 'active' AND ap.wallet_balance < 1000
      ORDER BY ap.wallet_balance ASC
    `);

    const agents = lowAgentsRes.rows.map(a => ({
      id: a.id,
      agentCode: a.agent_code,
      agentName: a.agent_name,
      agentPhone: a.agent_phone || a.telebirr_phone || a.mpesa_phone || '09-- --- ---',
      walletBalance: parseFloat(a.wallet_balance || '0'),
      city: a.city || 'Addis Ababa',
      lastRechargeDate: a.last_recharge_at ? formatTimelineDate(new Date(a.last_recharge_at)) : 'Never'
    }));

    return res.json({
      success: true,
      agents
    });
  } catch (err: any) {
    console.error('❌ [Agent Recharges Low Balance Error]:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to fetch low balance agents' });
  }
});

/**
 * 10. POST /api/admin/agent-recharges/remind
 * Sends Telegram or real-time alert reminder to low-balance agent
 */
adminRechargesRouter.post('/remind', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { agentId } = req.body;
    if (!agentId) {
      return res.status(400).json({ success: false, error: 'agentId is required' });
    }

    const agentRes = await query(`
      SELECT ap.*, u.full_name, u.telegram_id, u.phone 
      FROM agent_profiles ap
      JOIN users u ON ap.user_id = u.id
      WHERE ap.id = $1 OR ap.agent_code = $1
    `, [agentId]);

    if (agentRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }
    const agent = agentRes.rows[0];

    // Emit real-time notification to agent portal
    io.to(`user_${agent.user_id}`).emit('agent_low_balance_reminder', {
      message: `⚠️ Low Float Balance Alert: Your balance is currently ${parseFloat(agent.wallet_balance).toFixed(2)} ETB. Please submit a recharge request to maintain operations.`
    });

    return res.json({
      success: true,
      message: `Reminder sent to ${agent.full_name} (${agent.agent_code})`
    });
  } catch (err: any) {
    console.error('❌ [Agent Recharges Remind Error]:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to send reminder' });
  }
});

export default adminRechargesRouter;
