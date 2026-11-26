import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query, withTransaction } from '../db.ts';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.ts';
import { logAffiliateAudit, triggerRegistrationCommission } from '../services/affiliateCommissionService.ts';
import { consumeVerifiedNewSignup } from '../services/affiliateEventObserver.ts';

export const publicAffiliatesRouter = Router();

function normalizePhone(raw: string): string {
  const clean = String(raw || '').trim().replace(/^\+?251/, '0').replace(/[\s\-()]/g, '');
  if (!clean) return '';
  return clean.startsWith('0') ? clean : `0${clean}`;
}

async function generateUniqueAffiliateCode(clientOrQuery: (sql: string, params?: any[]) => Promise<{ rows: any[] }>): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = `AFF-${1000 + Math.floor(Math.random() * 9000)}`;
    const existing = await clientOrQuery(`SELECT id FROM affiliates WHERE affiliate_code = $1 LIMIT 1`, [code]);
    if (existing.rows.length === 0) return code;
  }
  return `AFF-${Date.now().toString().slice(-6)}`;
}

/**
 * GET /api/affiliates/invite/:token
 * Public invite validation endpoint for /#/affiliate-register
 */
publicAffiliatesRouter.get('/invite/:token', async (req: Request, res: Response) => {
  try {
    const token = String(req.params.token || '').trim().toUpperCase();
    if (!token) {
      return res.status(400).json({ success: false, error: 'Invite token is required' });
    }

    const linkRes = await query(
      `SELECT id, token, label, max_uses, uses_count, requires_approval, is_active, expires_at
       FROM affiliate_registration_links
       WHERE UPPER(token) = $1
       LIMIT 1`,
      [token]
    );

    if (linkRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Invalid affiliate registration link.' });
    }

    const link = linkRes.rows[0];
    if (!link.is_active) {
      return res.status(403).json({ success: false, error: 'This registration link has been deactivated by Admin.' });
    }
    if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) {
      return res.status(410).json({ success: false, error: 'This registration link has expired.' });
    }
    if (link.max_uses !== null && Number(link.uses_count || 0) >= Number(link.max_uses)) {
      return res.status(410).json({ success: false, error: 'This registration link has reached its maximum uses.' });
    }

    return res.json({
      success: true,
      invite: {
        token: link.token,
        label: link.label || 'Affiliate Partner Application',
        requiresApproval: Boolean(link.requires_approval),
        maxUses: link.max_uses,
        usesCount: link.uses_count,
        expiresAt: link.expires_at
      }
    });
  } catch (err: any) {
    console.error('❌ [Validate Affiliate Invite Error]:', err);
    return res.status(500).json({ success: false, error: 'Failed to validate registration link' });
  }
});

/**
 * POST /api/affiliates/register
 * Public self-registration endpoint for prospective Affiliates
 */
publicAffiliatesRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const {
      inviteToken,
      fullName,
      phone,
      password,
      payoutMethod = 'Telebirr',
      payoutAccount,
      payoutAccountName,
      applicationNotes
    } = req.body || {};

    const cleanToken = String(inviteToken || '').trim().toUpperCase();
    const cleanName = String(fullName || '').trim();
    const cleanPhone = normalizePhone(phone || '');
    const cleanPass = String(password || '').trim();

    if (!cleanToken) {
      return res.status(400).json({ success: false, error: 'Valid registration invite token is required.' });
    }
    if (cleanName.length < 2) {
      return res.status(400).json({ success: false, error: 'Full name is required.' });
    }
    if (cleanPhone.length < 9) {
      return res.status(400).json({ success: false, error: 'Please enter a valid Ethiopian phone number.' });
    }
    if (cleanPass.length < 4) {
      return res.status(400).json({ success: false, error: 'Portal PIN/Password must be at least 4 characters.' });
    }

    const result = await withTransaction(async (client) => {
      const linkRes = await client.query(
        `SELECT * FROM affiliate_registration_links WHERE UPPER(token) = $1 FOR UPDATE`,
        [cleanToken]
      );
      if (linkRes.rows.length === 0) {
        throw new Error('Invalid affiliate registration link.');
      }
      const link = linkRes.rows[0];
      if (!link.is_active) {
        throw new Error('This registration link has been disabled by Admin.');
      }
      if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) {
        throw new Error('This registration link has expired.');
      }
      if (link.max_uses !== null && Number(link.uses_count || 0) >= Number(link.max_uses)) {
        throw new Error('This registration link has reached its maximum uses.');
      }

      const dupPhone = await client.query(`SELECT id, approval_status FROM affiliates WHERE phone = $1 LIMIT 1`, [cleanPhone]);
      if (dupPhone.rows.length > 0) {
        const st = dupPhone.rows[0].approval_status;
        if (st === 'pending') {
          throw new Error('An application with this phone number is already pending Admin review.');
        }
        throw new Error('An affiliate account with this phone number already exists.');
      }

      const passwordHash = await bcrypt.hash(cleanPass, 10);
      const affiliateCode = await generateUniqueAffiliateCode(client.query.bind(client));
      const approvalStatus = link.requires_approval ? 'pending' : 'approved';

      const insRes = await client.query(
        `INSERT INTO affiliates (
           affiliate_code, full_name, phone, password_hash,
           payout_method, payout_account, payout_account_name,
           status, approval_status, invited_by_token, application_notes, approved_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8, $9, $10, $11)
         RETURNING id, affiliate_code, full_name, phone, payout_method, payout_account, status, approval_status, created_at`,
        [
          affiliateCode,
          cleanName,
          cleanPhone,
          passwordHash,
          String(payoutMethod || 'Telebirr').trim(),
          String(payoutAccount || cleanPhone).trim(),
          String(payoutAccountName || cleanName).trim(),
          approvalStatus,
          link.token,
          applicationNotes ? String(applicationNotes).trim() : null,
          link.requires_approval ? null : new Date()
        ]
      );

      await client.query(
        `UPDATE affiliate_registration_links SET uses_count = uses_count + 1 WHERE id = $1`,
        [link.id]
      );

      const created = insRes.rows[0];
      await logAffiliateAudit(
        client.query.bind(client),
        { fullName: `${cleanName} (Self-Register)` },
        'AFFILIATE_APPLICATION_SUBMITTED',
        'affiliate',
        created.id,
        null,
        { affiliateCode: created.affiliate_code, approvalStatus: created.approval_status, inviteToken: link.token },
        link.requires_approval ? 'Submitted via invite link (awaiting approval)' : 'Auto-approved via open invite link'
      );

      return { affiliate: created, requiresApproval: Boolean(link.requires_approval) };
    });

    return res.status(201).json({
      success: true,
      requiresApproval: result.requiresApproval,
      affiliate: {
        id: result.affiliate.id,
        affiliateCode: result.affiliate.affiliate_code,
        fullName: result.affiliate.full_name,
        phone: result.affiliate.phone,
        payoutMethod: result.affiliate.payout_method,
        payoutAccount: result.affiliate.payout_account,
        status: result.affiliate.status,
        approvalStatus: result.affiliate.approval_status,
        createdAt: result.affiliate.created_at
      }
    });
  } catch (err: any) {
    console.error('❌ [Affiliate Public Register Error]:', err);
    return res.status(400).json({ success: false, error: err?.message || 'Registration submission failed' });
  }
});

/**
 * POST /api/affiliates/attribute-player
 * Standalone, zero-auth-touch attribution hook invoked silently after a new player logs in via ?ref=aff_...
 * Enforces single-affiliate lock, new-player window (<= 30m), and self-referral protection.
 */
publicAffiliatesRouter.post('/attribute-player', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const rawCode = String(req.body?.affiliateCode || '').trim();
    if (!userId || !rawCode) {
      return res.json({ success: true, attributed: false });
    }

    const normalizedCode = rawCode.replace(/^aff[_-]?/i, '').trim().toUpperCase();
    if (!normalizedCode) {
      return res.json({ success: true, attributed: false });
    }

    const result = await withTransaction(async (client) => {
      const userRes = await client.query(
        `SELECT id, phone, affiliate_id, created_at, last_login_at,
                (last_login_at > created_at + INTERVAL '2 seconds') AS has_repeat_login
         FROM users WHERE id = $1 FOR UPDATE`,
        [userId]
      );
      if (userRes.rows.length === 0) {
        return { attributed: false, reason: 'user_not_found' };
      }

      const u = userRes.rows[0];
      if (u.affiliate_id) {
        return { attributed: false, alreadyAttributed: true };
      }

      // Industry-standard signup-only attribution: require fresh brand-new signup signal & zero prior history
      const isFreshSignupEvent = consumeVerifiedNewSignup(userId);
      const isRestartFallback =
        !isFreshSignupEvent &&
        process.uptime() < 30 &&
        Date.now() - new Date(u.created_at).getTime() <= 30 * 1000;

      if ((!isFreshSignupEvent && !isRestartFallback) || u.has_repeat_login) {
        return { attributed: false, reason: 'existing_account' };
      }

      const historyRes = await client.query(
        `SELECT
           EXISTS(SELECT 1 FROM deposit_requests WHERE user_id = $1) AS has_deposits,
           EXISTS(SELECT 1 FROM game_tickets WHERE user_id = $1) AS has_tickets,
           EXISTS(SELECT 1 FROM wallet_transactions WHERE user_id = $1 AND type <> 'bonus') AS has_non_bonus_tx`,
        [userId]
      );
      const history = historyRes.rows[0];
      if (history?.has_deposits || history?.has_tickets || history?.has_non_bonus_tx) {
        return { attributed: false, reason: 'existing_account' };
      }

      const affRes = await client.query(
        `SELECT id, affiliate_code, phone, status, approval_status
         FROM affiliates
         WHERE UPPER(affiliate_code) = $1 AND status = 'active' AND approval_status = 'approved'
         LIMIT 1`,
        [normalizedCode]
      );
      if (affRes.rows.length === 0) {
        return { attributed: false, reason: 'affiliate_not_found' };
      }

      const aff = affRes.rows[0];
      if (u.phone && aff.phone && normalizePhone(u.phone) === normalizePhone(aff.phone)) {
        return { attributed: false, reason: 'self_referral_blocked' };
      }

      await client.query(
        `UPDATE users SET affiliate_id = $1 WHERE id = $2 AND affiliate_id IS NULL`,
        [aff.id, userId]
      );

      return { attributed: true, affiliateId: aff.id, affiliateCode: aff.affiliate_code };
    });

    if (result.attributed && result.affiliateId) {
      triggerRegistrationCommission(userId, result.affiliateId).catch((err) => {
        console.warn('⚠️ [Affiliate Attribution Reg Commission Error]:', err?.message || err);
      });
    }

    return res.json({ success: true, ...result });
  } catch (err: any) {
    console.warn('⚠️ [Affiliate Attribute Player Warning]:', err?.message || err);
    return res.json({ success: true, attributed: false });
  }
});
