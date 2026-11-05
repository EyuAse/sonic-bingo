import { Router, Response } from 'express';
import { query, withTransaction } from '../db.ts';
import { requireAdmin, AuthenticatedRequest } from '../middleware/auth.ts';
import { io } from '../server.ts';

export const adminPayoutsRouter = Router();

// Date formatting helper: '3 Nov 08:40'
function formatTimelineDate(d: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = d.getDate();
  const m = months[d.getMonth()];
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${m} ${hh}:${mm}`;
}

// Relative time helper: '20 min ago', '2 h ago', '3 d ago'
function getRelativeTime(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} d ago`;
}

// Normalize status values to Enqu spec
function normalizeStatus(st: string): 'Requested' | 'Under review' | 'Awaiting 2nd approval' | 'Paid' | 'Rejected' {
  const lower = (st || '').toLowerCase();
  if (lower === 'pending' || lower === 'requested') return 'Requested';
  if (lower === 'under review') return 'Under review';
  if (lower === 'awaiting 2nd approval') return 'Awaiting 2nd approval';
  if (lower === 'approved' || lower === 'paid') return 'Paid';
  if (lower === 'rejected') return 'Rejected';
  return 'Requested';
}

/**
 * 1. GET /api/admin/agent-payouts/kpis
 * Returns the 4 top KPI cards:
 * - Pending Payouts (count & ETB held)
 * - Paid This Month (ETB & count)
 * - Converted to Float (ETB this month)
 * - Commission Owed (available + held across all agents)
 */
adminPayoutsRouter.get('/kpis', requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const [payoutsAgg, conversionsAgg, agentsAgg] = await Promise.all([
      query(`
        SELECT 
          COUNT(*) FILTER (WHERE status IN ('Requested', 'Under review', 'Awaiting 2nd approval', 'pending')) as pending_count,
          COALESCE(SUM(amount) FILTER (WHERE status IN ('Requested', 'Under review', 'Awaiting 2nd approval', 'pending')), 0) as pending_amount,
          COUNT(*) FILTER (WHERE status IN ('Paid', 'approved') AND (COALESCE(settled_at, created_at) AT TIME ZONE 'Africa/Addis_Ababa') >= DATE_TRUNC('month', NOW() AT TIME ZONE 'Africa/Addis_Ababa')) as paid_month_count,
          COALESCE(SUM(amount) FILTER (WHERE status IN ('Paid', 'approved') AND (COALESCE(settled_at, created_at) AT TIME ZONE 'Africa/Addis_Ababa') >= DATE_TRUNC('month', NOW() AT TIME ZONE 'Africa/Addis_Ababa')), 0) as paid_month_amount
        FROM agent_commission_payout_requests
      `),
      query(`
        SELECT 
          COUNT(*) as converted_month_count,
          COALESCE(SUM(amount), 0) as converted_month_amount
        FROM agent_commissions
        WHERE source_type = 'commission_to_float'
        AND (created_at AT TIME ZONE 'Africa/Addis_Ababa') >= DATE_TRUNC('month', NOW() AT TIME ZONE 'Africa/Addis_Ababa')
      `),
      query(`
        SELECT COALESCE(SUM(commission_balance), 0) as total_available_commission
        FROM agent_profiles
      `)
    ]);

    const p = payoutsAgg.rows[0] || {};
    const c = conversionsAgg.rows[0] || {};
    const a = agentsAgg.rows[0] || {};

    const pendingCount = parseInt(p.pending_count || '0', 10);
    const pendingAmount = parseFloat(p.pending_amount || '0');
    const paidMonthCount = parseInt(p.paid_month_count || '0', 10);
    const paidMonthAmount = parseFloat(p.paid_month_amount || '0');
    const convertedMonthCount = parseInt(c.converted_month_count || '0', 10);
    const convertedMonthAmount = parseFloat(c.converted_month_amount || '0');
    const totalAvailableCommission = parseFloat(a.total_available_commission || '0');
    const commissionOwed = totalAvailableCommission + pendingAmount;

    return res.json({
      success: true,
      kpis: {
        pendingPayouts: { count: pendingCount, heldAmount: pendingAmount },
        paidThisMonth: { count: paidMonthCount, totalAmount: paidMonthAmount },
        convertedToFloat: { count: convertedMonthCount, totalAmount: convertedMonthAmount },
        commissionOwed: { totalOwed: commissionOwed, available: totalAvailableCommission, held: pendingAmount }
      }
    });
  } catch (err: any) {
    console.error('❌ [Admin Agent Payouts KPIs Error]:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to fetch payout KPIs' });
  }
});

/**
 * 2. GET /api/admin/agent-payouts/flow
 * Returns real counts for the 4-step visual workflow progress indicator:
 * - Step 1: Request (count in 'Requested')
 * - Step 2: Review (count in 'Under review')
 * - Step 3: Disburse (count in 'Awaiting 2nd approval')
 * - Step 4: Record and notify (count in 'Paid' today)
 */
adminPayoutsRouter.get('/flow', requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const flowRes = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE status IN ('Requested', 'pending')) as step1,
        COUNT(*) FILTER (WHERE status = 'Under review') as step2,
        COUNT(*) FILTER (WHERE status = 'Awaiting 2nd approval') as step3,
        COUNT(*) FILTER (WHERE status IN ('Paid', 'approved') AND (COALESCE(settled_at, created_at) AT TIME ZONE 'Africa/Addis_Ababa')::date = (NOW() AT TIME ZONE 'Africa/Addis_Ababa')::date) as step4
      FROM agent_commission_payout_requests
    `);

    const r = flowRes.rows[0] || {};
    return res.json({
      success: true,
      flow: {
        step1: parseInt(r.step1 || '0', 10),
        step2: parseInt(r.step2 || '0', 10),
        step3: parseInt(r.step3 || '0', 10),
        step4: parseInt(r.step4 || '0', 10)
      }
    });
  } catch (err: any) {
    console.error('❌ [Admin Agent Payouts Flow Error]:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to fetch workflow counts' });
  }
});

/**
 * 3. GET /api/admin/agent-payouts/requests
 * Lists cashout requests with filter: 'Open' | 'Paid' | 'Rejected' | 'All'
 */
adminPayoutsRouter.get('/requests', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const filter = (req.query.filter as string) || 'Open';

    let filterClause = '';
    if (filter === 'Open') {
      filterClause = "WHERE acpr.status IN ('Requested', 'Under review', 'Awaiting 2nd approval', 'pending')";
    } else if (filter === 'Paid') {
      filterClause = "WHERE acpr.status IN ('Paid', 'approved')";
    } else if (filter === 'Rejected') {
      filterClause = "WHERE acpr.status IN ('Rejected', 'rejected')";
    }

    const requestsRes = await query(`
      SELECT 
        acpr.id,
        acpr.code,
        acpr.agent_id,
        acpr.amount,
        acpr.payout_method,
        acpr.payout_account,
        acpr.account_name,
        acpr.status,
        acpr.admin_notes,
        acpr.rejection_reason,
        acpr.payout_tx_ref,
        acpr.timeline,
        acpr.checklist,
        acpr.created_at,
        acpr.settled_at,
        ap.agent_code,
        ap.commission_balance,
        ap.wallet_balance,
        ap.city,
        ap.status as agent_status,
        ap.telebirr_phone,
        ap.cbe_account,
        u.full_name as agent_name,
        u.phone as agent_phone
      FROM agent_commission_payout_requests acpr
      JOIN agent_profiles ap ON acpr.agent_id = ap.id
      JOIN users u ON ap.user_id = u.id
      ${filterClause}
      ORDER BY 
        CASE 
          WHEN acpr.status = 'Under review' THEN 1
          WHEN acpr.status = 'Awaiting 2nd approval' THEN 2
          WHEN acpr.status IN ('Requested', 'pending') THEN 3
          ELSE 4
        END,
        acpr.created_at DESC
      LIMIT 100
    `);

    const requests = requestsRes.rows.map((r, i) => {
      const createdDate = new Date(r.created_at);
      const normStatus = normalizeStatus(r.status);
      const code = r.code || `PO-${100 + requestsRes.rows.length - i}`;
      const timeline = Array.isArray(r.timeline) && r.timeline.length > 0
        ? r.timeline
        : [[formatTimelineDate(createdDate), 'Cashout requested. Commission held']];

      return {
        id: r.id,
        code,
        agentId: r.agent_id,
        agentName: r.agent_name || 'Agent',
        agentCode: r.agent_code,
        agentCity: r.city || 'Addis Ababa',
        agentPhone: r.agent_phone || r.telebirr_phone || '',
        agentStatus: r.agent_status || 'active',
        amount: parseFloat(r.amount),
        payoutMethod: r.payout_method || 'Telebirr',
        payoutAccount: r.payout_account || '',
        accountName: r.account_name || r.agent_name || 'Agent',
        status: normStatus,
        adminNotes: r.admin_notes || null,
        rejectionReason: r.rejection_reason || null,
        payoutTxRef: r.payout_tx_ref || '',
        commissionLeftAfterHold: parseFloat(r.commission_balance || '0'),
        createdAt: r.created_at,
        relativeTime: getRelativeTime(createdDate),
        timeline,
        checklist: r.checklist || {}
      };
    });

    return res.json({ success: true, requests });
  } catch (err: any) {
    console.error('❌ [Admin Agent Payouts Requests Error]:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to fetch payout requests' });
  }
});

/**
 * 4. POST /api/admin/agent-payouts/requests/:id/start-review
 * Transitions request from 'Requested' to 'Under review'
 */
adminPayoutsRouter.post('/requests/:id/start-review', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await withTransaction(async (client) => {
      const reqRes = await client.query(
        `SELECT acpr.*, ap.agent_code, u.full_name as agent_name 
         FROM agent_commission_payout_requests acpr
         JOIN agent_profiles ap ON acpr.agent_id = ap.id
         JOIN users u ON ap.user_id = u.id
         WHERE acpr.id = $1 FOR UPDATE`,
        [id]
      );
      if (reqRes.rows.length === 0) throw new Error('Payout request not found');

      const r = reqRes.rows[0];
      const normStatus = normalizeStatus(r.status);
      if (normStatus !== 'Requested') {
        throw new Error(`Request is already in status: ${normStatus}`);
      }

      const now = new Date();
      const timeStr = formatTimelineDate(now);
      const currentTimeline = Array.isArray(r.timeline) ? r.timeline : [];
      const newTimeline = [[timeStr, 'Review started by Super Admin'], ...currentTimeline];

      await client.query(
        `UPDATE agent_commission_payout_requests
         SET status = 'Under review',
             timeline = $1::jsonb
         WHERE id = $2`,
        [JSON.stringify(newTimeline), id]
      );

      return { id, code: r.code, agentName: r.agent_name, agentCode: r.agent_code };
    });

    io.emit('admin_agent_payout_update', { id: result.id, status: 'Under review' });

    return res.json({
      success: true,
      message: `Review started for payout ${result.code || result.id}`
    });
  } catch (err: any) {
    console.error('❌ [Start Review Error]:', err);
    return res.status(400).json({ success: false, error: err.message || 'Failed to start review' });
  }
});

/**
 * 5. POST /api/admin/agent-payouts/requests/:id/checklist
 * Saves checklist checkboxes: { o1: boolean }
 */
adminPayoutsRouter.post('/requests/:id/checklist', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { checklist } = req.body;

    await query(
      `UPDATE agent_commission_payout_requests
       SET checklist = $1::jsonb
       WHERE id = $2`,
      [JSON.stringify(checklist || {}), id]
    );

    return res.json({ success: true });
  } catch (err: any) {
    console.error('❌ [Update Checklist Error]:', err);
    return res.status(400).json({ success: false, error: err.message || 'Failed to update checklist' });
  }
});

/**
 * 6. POST /api/admin/agent-payouts/requests/:id/approve
 * Approves a cashout request.
 * - If amount > 20,000 ETB and status is 'Under review': sets status to 'Awaiting 2nd approval'.
 * - If amount <= 20,000 ETB: requires unique payoutTxRef, marks 'Paid', notifies agent.
 */
adminPayoutsRouter.post('/requests/:id/approve', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { payoutTxRef, notes } = req.body;

    const result = await withTransaction(async (client) => {
      const pRes = await client.query(
        `SELECT acpr.*, ap.agent_code, ap.user_id, u.full_name as agent_name 
         FROM agent_commission_payout_requests acpr
         JOIN agent_profiles ap ON acpr.agent_id = ap.id
         JOIN users u ON ap.user_id = u.id
         WHERE acpr.id = $1 FOR UPDATE`,
        [id]
      );
      if (pRes.rows.length === 0) throw new Error('Payout request not found');

      const payout = pRes.rows[0];
      const normStatus = normalizeStatus(payout.status);
      const amount = parseFloat(payout.amount);
      const now = new Date();
      const timeStr = formatTimelineDate(now);
      const currentTimeline = Array.isArray(payout.timeline) ? payout.timeline : [];

      // Case 1: Large amount (> 20,000 ETB) and in 'Under review' -> Needs 2nd approval
      if (amount > 20000 && normStatus === 'Under review') {
        const newTimeline = [
          [timeStr, 'Approved by First Admin. Needs a second approval (above 20,000 ETB)'],
          ...currentTimeline
        ];

        await client.query(
          `UPDATE agent_commission_payout_requests
           SET status = 'Awaiting 2nd approval',
               first_approved_by = $1,
               first_approved_at = NOW(),
               timeline = $2::jsonb
           WHERE id = $3`,
          [req.user!.id, JSON.stringify(newTimeline), id]
        );

        return {
          id: payout.id,
          code: payout.code,
          agentId: payout.agent_id,
          amount,
          status: 'Awaiting 2nd approval',
          needsSecondApproval: true
        };
      }

      // Case 2: Standard disbursement (<= 20,000 ETB or already has 2nd approval)
      const cleanRef = (payoutTxRef || '').trim();
      if (!cleanRef) {
        throw new Error('Please enter the payout transaction reference code (e.g. Telebirr / CBE transaction ID).');
      }

      // Check unique reference among Paid requests
      const dupRes = await client.query(
        `SELECT id, code FROM agent_commission_payout_requests 
         WHERE payout_tx_ref = $1 AND status IN ('Paid', 'approved') AND id != $2`,
        [cleanRef, id]
      );
      if (dupRes.rows.length > 0) {
        throw new Error(`Payout transaction ID '${cleanRef}' was already used on payout ${dupRes.rows[0].code || dupRes.rows[0].id}`);
      }

      const newTimeline = [
        [timeStr, `Paid ${amount.toLocaleString('en-US')} ETB to ${payout.payout_method} ${payout.payout_account}. Reference ${cleanRef}. Agent notified`],
        ...currentTimeline
      ];

      await client.query(
        `UPDATE agent_commission_payout_requests
         SET status = 'Paid',
             payout_tx_ref = $1,
             admin_notes = COALESCE($2, admin_notes),
             settled_at = NOW(),
             first_approved_by = COALESCE(first_approved_by, $3),
             first_approved_at = COALESCE(first_approved_at, NOW()),
             timeline = $4::jsonb
         WHERE id = $5`,
        [cleanRef, notes || null, req.user!.id, JSON.stringify(newTimeline), id]
      );

      return {
        id: payout.id,
        code: payout.code,
        agentId: payout.agent_id,
        agentCode: payout.agent_code,
        agentName: payout.agent_name,
        amount,
        payoutMethod: payout.payout_method,
        payoutAccount: payout.payout_account,
        payoutTxRef: cleanRef,
        status: 'Paid',
        needsSecondApproval: false
      };
    });

    if (result.needsSecondApproval) {
      io.emit('admin_agent_payout_update', { id: result.id, status: 'Awaiting 2nd approval' });
      return res.json({
        success: true,
        message: `Payout of ${result.amount.toLocaleString('en-US')} ETB approved by 1st Admin. Sent for second approval.`,
        status: 'Awaiting 2nd approval'
      });
    }

    // Emit live WebSocket events
    io.emit(`agent_${result.agentId}_payout_approved`, {
      id: result.id,
      amount: result.amount,
      payoutMethod: result.payoutMethod,
      payoutTxRef: result.payoutTxRef,
      status: 'Paid'
    });
    io.emit('admin_agent_payout_update', { id: result.id, status: 'Paid' });

    return res.json({
      success: true,
      message: `✓ Paid ${result.amount.toLocaleString('en-US')} ETB to Agent #${result.agentCode} via ${result.payoutMethod}. Ref: ${result.payoutTxRef}`,
      status: 'Paid'
    });
  } catch (err: any) {
    console.error('❌ [Approve Payout Error]:', err);
    return res.status(400).json({ success: false, error: err.message || 'Failed to approve payout' });
  }
});

/**
 * 7. POST /api/admin/agent-payouts/requests/:id/second-approve
 * Second admin approval for large payouts (> 20,000 ETB)
 */
adminPayoutsRouter.post('/requests/:id/second-approve', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { payoutTxRef, notes } = req.body;

    const cleanRef = (payoutTxRef || '').trim();
    if (!cleanRef) {
      throw new Error('Please enter the payout transaction reference code.');
    }

    const result = await withTransaction(async (client) => {
      const pRes = await client.query(
        `SELECT acpr.*, ap.agent_code, ap.user_id, u.full_name as agent_name 
         FROM agent_commission_payout_requests acpr
         JOIN agent_profiles ap ON acpr.agent_id = ap.id
         JOIN users u ON ap.user_id = u.id
         WHERE acpr.id = $1 FOR UPDATE`,
        [id]
      );
      if (pRes.rows.length === 0) throw new Error('Payout request not found');

      const payout = pRes.rows[0];
      const normStatus = normalizeStatus(payout.status);
      if (normStatus !== 'Awaiting 2nd approval') {
        throw new Error(`Request is not awaiting second approval (Current: ${normStatus})`);
      }

      // Check unique reference
      const dupRes = await client.query(
        `SELECT id, code FROM agent_commission_payout_requests 
         WHERE payout_tx_ref = $1 AND status IN ('Paid', 'approved') AND id != $2`,
        [cleanRef, id]
      );
      if (dupRes.rows.length > 0) {
        throw new Error(`Payout transaction ID '${cleanRef}' was already used on payout ${dupRes.rows[0].code || dupRes.rows[0].id}`);
      }

      const amount = parseFloat(payout.amount);
      const now = new Date();
      const timeStr = formatTimelineDate(now);
      const currentTimeline = Array.isArray(payout.timeline) ? payout.timeline : [];
      const newTimeline = [
        [timeStr, `Second admin approved. Paid ${amount.toLocaleString('en-US')} ETB to ${payout.payout_method} ${payout.payout_account}. Reference ${cleanRef}. Agent notified`],
        ...currentTimeline
      ];

      await client.query(
        `UPDATE agent_commission_payout_requests
         SET status = 'Paid',
             payout_tx_ref = $1,
             admin_notes = COALESCE($2, admin_notes),
             settled_at = NOW(),
             second_approved_by = $3,
             second_approved_at = NOW(),
             timeline = $4::jsonb
         WHERE id = $5`,
        [cleanRef, notes || null, req.user!.id, JSON.stringify(newTimeline), id]
      );

      return {
        id: payout.id,
        code: payout.code,
        agentId: payout.agent_id,
        agentCode: payout.agent_code,
        agentName: payout.agent_name,
        amount,
        payoutMethod: payout.payout_method,
        payoutAccount: payout.payout_account,
        payoutTxRef: cleanRef
      };
    });

    io.emit(`agent_${result.agentId}_payout_approved`, {
      id: result.id,
      amount: result.amount,
      payoutMethod: result.payoutMethod,
      payoutTxRef: result.payoutTxRef,
      status: 'Paid'
    });
    io.emit('admin_agent_payout_update', { id: result.id, status: 'Paid' });

    return res.json({
      success: true,
      message: `✓ Second admin approved and paid ${result.amount.toLocaleString('en-US')} ETB to Agent #${result.agentCode}. Ref: ${result.payoutTxRef}`,
      status: 'Paid'
    });
  } catch (err: any) {
    console.error('❌ [Second Approve Payout Error]:', err);
    return res.status(400).json({ success: false, error: err.message || 'Failed to second approve payout' });
  }
});

/**
 * 8. POST /api/admin/agent-payouts/requests/:id/reject
 * Rejects cashout request and ATOMICALLY REFUNDS held commission to agent profile.
 */
adminPayoutsRouter.post('/requests/:id/reject', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason, note } = req.body;
    const rejectionReason = (reason || '').trim() || 'Disbursement rejected by compliance';

    const result = await withTransaction(async (client) => {
      const pRes = await client.query(
        `SELECT acpr.*, ap.agent_code, ap.commission_balance, u.full_name as agent_name 
         FROM agent_commission_payout_requests acpr
         JOIN agent_profiles ap ON acpr.agent_id = ap.id
         JOIN users u ON ap.user_id = u.id
         WHERE acpr.id = $1 FOR UPDATE`,
        [id]
      );
      if (pRes.rows.length === 0) throw new Error('Payout request not found');

      const payout = pRes.rows[0];
      const normStatus = normalizeStatus(payout.status);
      if (normStatus === 'Paid' || normStatus === 'Rejected') {
        throw new Error(`Payout request is already ${normStatus}`);
      }

      const refundAmount = parseFloat(payout.amount);
      const now = new Date();
      const timeStr = formatTimelineDate(now);
      const currentTimeline = Array.isArray(payout.timeline) ? payout.timeline : [];
      const noteSuffix = note ? `. Note: ${note.trim()}` : '';
      const newTimeline = [
        [timeStr, `Rejected: ${rejectionReason}${noteSuffix}. ${refundAmount.toLocaleString('en-US')} ETB refunded to agent commission balance. Agent notified`],
        ...currentTimeline
      ];

      // 1. Mark request as Rejected
      await client.query(
        `UPDATE agent_commission_payout_requests
         SET status = 'Rejected',
             rejection_reason = $1,
             admin_notes = COALESCE($2, admin_notes),
             settled_at = NOW(),
             timeline = $3::jsonb
         WHERE id = $4`,
        [rejectionReason, note || null, JSON.stringify(newTimeline), id]
      );

      // 2. Atomically refund held commission balance back to agent profile
      const agentUpdateRes = await client.query(
        `UPDATE agent_profiles
         SET commission_balance = COALESCE(commission_balance, 0) + $1,
             updated_at = NOW()
         WHERE id = $2
         RETURNING commission_balance`,
        [refundAmount, payout.agent_id]
      );

      const newCommissionBal = parseFloat(agentUpdateRes.rows[0]?.commission_balance || '0');

      return {
        id: payout.id,
        code: payout.code,
        agentId: payout.agent_id,
        agentCode: payout.agent_code,
        agentName: payout.agent_name,
        amount: refundAmount,
        newCommissionBal,
        reason: rejectionReason
      };
    });

    io.emit(`agent_${result.agentId}_payout_rejected`, {
      id: result.id,
      amount: result.amount,
      reason: result.reason,
      newCommissionBalance: result.newCommissionBal,
      status: 'Rejected'
    });
    io.emit('admin_agent_payout_update', { id: result.id, status: 'Rejected' });

    return res.json({
      success: true,
      message: `❌ Rejected payout for Agent #${result.agentCode}. ${result.amount.toLocaleString('en-US')} ETB refunded to commission balance!`,
      payout: result
    });
  } catch (err: any) {
    console.error('❌ [Reject Payout Error]:', err);
    return res.status(400).json({ success: false, error: err.message || 'Failed to reject payout' });
  }
});

/**
 * 9. GET /api/admin/agent-payouts/history
 * Transaction history across time periods: 'today' | 'week' | 'month' | 'all' | 'custom'
 * Combines bank payouts with instant float conversions (source_type = 'commission_to_float').
 * Includes 4 period stats cards: Total Paid Out, Converted to Float, Rejected and Refunded, Average Payout.
 */
adminPayoutsRouter.get('/history', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const period = (req.query.period as string) || 'all';
    const fromDate = req.query.from as string;
    const toDate = req.query.to as string;
    const search = ((req.query.search as string) || '').trim().toLowerCase();
    const agentFilter = (req.query.agent as string) || '';
    const statusFilter = (req.query.status as string) || 'All'; // 'All' | 'Paid' | 'Converted' | 'Rejected'

    let payoutDateClause = '';
    let convDateClause = '';
    const payoutParams: any[] = [];
    const convParams: any[] = [];

    if (period === 'today') {
      payoutDateClause = "AND ((COALESCE(acpr.settled_at, acpr.created_at) AT TIME ZONE 'Africa/Addis_Ababa')::date = (NOW() AT TIME ZONE 'Africa/Addis_Ababa')::date)";
      convDateClause = "AND ((ac.created_at AT TIME ZONE 'Africa/Addis_Ababa')::date = (NOW() AT TIME ZONE 'Africa/Addis_Ababa')::date)";
    } else if (period === 'week') {
      payoutDateClause = "AND ((COALESCE(acpr.settled_at, acpr.created_at) AT TIME ZONE 'Africa/Addis_Ababa') >= (NOW() AT TIME ZONE 'Africa/Addis_Ababa' - INTERVAL '7 days'))";
      convDateClause = "AND ((ac.created_at AT TIME ZONE 'Africa/Addis_Ababa') >= (NOW() AT TIME ZONE 'Africa/Addis_Ababa' - INTERVAL '7 days'))";
    } else if (period === 'month') {
      payoutDateClause = "AND ((COALESCE(acpr.settled_at, acpr.created_at) AT TIME ZONE 'Africa/Addis_Ababa') >= DATE_TRUNC('month', NOW() AT TIME ZONE 'Africa/Addis_Ababa'))";
      convDateClause = "AND ((ac.created_at AT TIME ZONE 'Africa/Addis_Ababa') >= DATE_TRUNC('month', NOW() AT TIME ZONE 'Africa/Addis_Ababa'))";
    } else if (period === 'custom' || fromDate || toDate) {
      if (fromDate && toDate) {
        payoutParams.push(fromDate, toDate);
        convParams.push(fromDate, toDate);
        payoutDateClause = `AND ((COALESCE(acpr.settled_at, acpr.created_at) AT TIME ZONE 'Africa/Addis_Ababa')::date BETWEEN $1::date AND $2::date)`;
        convDateClause = `AND ((ac.created_at AT TIME ZONE 'Africa/Addis_Ababa')::date BETWEEN $1::date AND $2::date)`;
      } else if (fromDate) {
        payoutParams.push(fromDate);
        convParams.push(fromDate);
        payoutDateClause = `AND ((COALESCE(acpr.settled_at, acpr.created_at) AT TIME ZONE 'Africa/Addis_Ababa')::date >= $1::date)`;
        convDateClause = `AND ((ac.created_at AT TIME ZONE 'Africa/Addis_Ababa')::date >= $1::date)`;
      } else if (toDate) {
        payoutParams.push(toDate);
        convParams.push(toDate);
        payoutDateClause = `AND ((COALESCE(acpr.settled_at, acpr.created_at) AT TIME ZONE 'Africa/Addis_Ababa')::date <= $1::date)`;
        convDateClause = `AND ((ac.created_at AT TIME ZONE 'Africa/Addis_Ababa')::date <= $1::date)`;
      }
    }

    // 1. Query settled bank payouts
    const payoutsRes = await query(`
      SELECT 
        acpr.id,
        acpr.code,
        acpr.agent_id,
        acpr.amount,
        acpr.payout_method,
        acpr.payout_account,
        acpr.payout_tx_ref,
        acpr.status,
        acpr.admin_notes,
        acpr.created_at,
        acpr.settled_at,
        ap.agent_code,
        ap.city,
        u.full_name as agent_name
      FROM agent_commission_payout_requests acpr
      JOIN agent_profiles ap ON acpr.agent_id = ap.id
      JOIN users u ON ap.user_id = u.id
      WHERE acpr.status IN ('Paid', 'approved', 'Rejected', 'rejected')
      ${payoutDateClause}
      ORDER BY COALESCE(acpr.settled_at, acpr.created_at) DESC
      LIMIT 300
    `, payoutParams);

    // 2. Query instant float conversions
    const conversionsRes = await query(`
      SELECT 
        ac.id,
        ac.agent_id,
        ac.amount,
        ac.created_at,
        ap.agent_code,
        ap.city,
        u.full_name as agent_name
      FROM agent_commissions ac
      JOIN agent_profiles ap ON ac.agent_id = ap.id
      JOIN users u ON ap.user_id = u.id
      WHERE ac.source_type = 'commission_to_float'
      ${convDateClause}
      ORDER BY ac.created_at DESC
      LIMIT 300
    `, convParams);

    // 3. Format bank payout rows
    const bankRows = payoutsRes.rows.map((r, i) => {
      const eventDate = new Date(r.settled_at || r.created_at);
      const normStatus = normalizeStatus(r.status);
      return {
        id: r.code || `PO-${100 + payoutsRes.rows.length - i}`,
        dbId: r.id,
        aid: r.agent_id,
        agentName: r.agent_name || 'Agent',
        agentCode: r.agent_code,
        type: 'Bank payout',
        destination: `${r.payout_method || 'Telebirr'} ${r.payout_account || ''}`.trim(),
        amount: parseFloat(r.amount),
        reference: r.payout_tx_ref || r.admin_notes || '-',
        status: normStatus,
        by: normStatus === 'Paid' ? 'Super Admin' : 'Admin',
        isoDate: eventDate.toISOString().split('T')[0],
        dateFormatted: formatTimelineDate(eventDate),
        timestamp: eventDate.getTime()
      };
    });

    // 4. Format float conversion rows
    const convRows = conversionsRes.rows.map((c, i) => {
      const eventDate = new Date(c.created_at);
      return {
        id: `CV-${String(conversionsRes.rows.length - i).padStart(3, '0')}`,
        dbId: c.id,
        aid: c.agent_id,
        agentName: c.agent_name || 'Agent',
        agentCode: c.agent_code,
        type: 'Float conversion',
        destination: 'Agent working float',
        amount: parseFloat(c.amount),
        reference: 'Instant conversion',
        status: 'Converted',
        by: 'Automatic',
        isoDate: eventDate.toISOString().split('T')[0],
        dateFormatted: formatTimelineDate(eventDate),
        timestamp: eventDate.getTime()
      };
    });

    // 5. Combine and sort
    let allRows = [...bankRows, ...convRows];
    allRows.sort((a, b) => b.timestamp - a.timestamp);

    // 6. Apply filters
    if (statusFilter !== 'All') {
      allRows = allRows.filter(r => r.status.toLowerCase() === statusFilter.toLowerCase());
    }
    if (agentFilter) {
      allRows = allRows.filter(r => 
        r.agentName.toLowerCase() === agentFilter.toLowerCase() ||
        r.agentCode.toLowerCase() === agentFilter.toLowerCase()
      );
    }
    if (search) {
      allRows = allRows.filter(r => 
        r.agentName.toLowerCase().includes(search) ||
        r.agentCode.toLowerCase().includes(search) ||
        r.id.toLowerCase().includes(search) ||
        r.reference.toLowerCase().includes(search)
      );
    }

    // 7. Compute period stats
    const paidRows = allRows.filter(r => r.status === 'Paid');
    const convertedRows = allRows.filter(r => r.status === 'Converted');
    const rejectedRows = allRows.filter(r => r.status === 'Rejected');

    const totalPaid = paidRows.reduce((sum, r) => sum + r.amount, 0);
    const totalConverted = convertedRows.reduce((sum, r) => sum + r.amount, 0);
    const totalRejected = rejectedRows.reduce((sum, r) => sum + r.amount, 0);
    const avgPayout = paidRows.length > 0 ? Math.round(totalPaid / paidRows.length) : 0;

    return res.json({
      success: true,
      stats: {
        totalPaid,
        paidCount: paidRows.length,
        totalConverted,
        convertedCount: convertedRows.length,
        totalRejected,
        rejectedCount: rejectedRows.length,
        averagePayout: avgPayout
      },
      rows: allRows
    });
  } catch (err: any) {
    console.error('❌ [Admin Agent Payouts History Error]:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to fetch payout history' });
  }
});

/**
 * 10. GET /api/admin/agent-payouts/commission-balances
 * Lists all agents with Available, Held, Paid out, To float, and Total earned.
 */
adminPayoutsRouter.get('/commission-balances', requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const balancesRes = await query(`
      SELECT 
        ap.id as agent_id,
        ap.agent_code,
        ap.status as agent_status,
        ap.city,
        ap.wallet_balance,
        COALESCE(ap.commission_balance, 0) as available_balance,
        u.full_name as agent_name,
        u.phone as agent_phone,
        COALESCE((
          SELECT SUM(amount)
          FROM agent_commission_payout_requests
          WHERE agent_id = ap.id AND status IN ('Requested', 'Under review', 'Awaiting 2nd approval', 'pending')
        ), 0) as held_amount,
        COALESCE((
          SELECT SUM(amount)
          FROM agent_commission_payout_requests
          WHERE agent_id = ap.id AND status IN ('Paid', 'approved')
        ), 0) as paid_amount,
        COALESCE((
          SELECT SUM(amount)
          FROM agent_commissions
          WHERE agent_id = ap.id AND source_type = 'commission_to_float'
        ), 0) as to_float_amount
      FROM agent_profiles ap
      JOIN users u ON ap.user_id = u.id
      ORDER BY ap.commission_balance DESC, u.full_name ASC
    `);

    const agents = balancesRes.rows.map(r => {
      const available = parseFloat(r.available_balance || '0');
      const held = parseFloat(r.held_amount || '0');
      const paid = parseFloat(r.paid_amount || '0');
      const toFloat = parseFloat(r.to_float_amount || '0');
      const totalEarned = available + held + paid + toFloat;

      return {
        id: r.agent_id,
        code: r.agent_code,
        name: r.agent_name || 'Agent',
        phone: r.agent_phone || '',
        city: r.city || 'Addis Ababa',
        status: r.agent_status || 'active',
        available,
        held,
        paidOut: paid,
        toFloat,
        totalEarned
      };
    });

    return res.json({ success: true, agents });
  } catch (err: any) {
    console.error('❌ [Admin Commission Balances Error]:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to fetch commission balances' });
  }
});

