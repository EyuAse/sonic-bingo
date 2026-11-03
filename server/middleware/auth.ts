import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../db.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'lomi_bingo_super_secret_production_key_2026_et';

export interface AuthUser {
  id: string;
  telegramId?: number;
  telegramUsername?: string;
  phone?: string;
  fullName: string;
  role: 'player' | 'cashier' | 'admin' | 'agent';
  status?: string;
  suspendReason?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

// In-memory status cache for instant real-time suspension checks without DB bottleneck
const userStatusCache = new Map<string, { status: string; reason?: string; checkedAt: number }>();

export function markUserSuspended(userId: string, reason?: string, ...extraIds: (string | number | undefined | null)[]) {
  const all = [userId, ...extraIds];
  for (const id of all) {
    if (!id) continue;
    const str = String(id);
    userStatusCache.set(str, { status: 'suspended', reason, checkedAt: Date.now() });
  }
}

export function markUserActive(userId: string, ...extraIds: (string | number | undefined | null)[]) {
  const all = [userId, ...extraIds];
  for (const id of all) {
    if (!id) continue;
    const str = String(id);
    userStatusCache.delete(str);
    userStatusCache.set(str, { status: 'active', checkedAt: Date.now() });
  }
}

export function clearUserStatusCache(userId?: string) {
  if (userId) {
    userStatusCache.delete(String(userId));
  } else {
    userStatusCache.clear();
  }
}

/**
 * Verify JWT Bearer Token Middleware & Enforce Active Status
 */
export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Authentication required. Please log in.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    req.user = decoded;

    // Check suspension status for non-admin/non-cashier users (e.g. players & agents)
    if (decoded.role !== 'admin' && decoded.role !== 'cashier') {
      const cached = userStatusCache.get(decoded.id);
      const isFresh = cached && (Date.now() - cached.checkedAt < 10000); // 10s fresh window

      let isSuspended = false;
      let suspendReason = '';

      if (cached && isFresh) {
        if (cached.status === 'suspended') {
          isSuspended = true;
          suspendReason = cached.reason || 'Account suspended by compliance.';
        }
      } else {
        const statusRes = await query(
          'SELECT status, suspend_reason FROM users WHERE id::text = $1 OR telegram_id::text = $1 LIMIT 1',
          [decoded.id]
        );
        if (statusRes.rows.length > 0) {
          const row = statusRes.rows[0];
          const st = row.status || 'active';
          userStatusCache.set(decoded.id, { status: st, reason: row.suspend_reason, checkedAt: Date.now() });
          if (st === 'suspended') {
            isSuspended = true;
            suspendReason = row.suspend_reason || 'Account suspended by compliance.';
          }
        }
      }

      if (isSuspended) {
        return res.status(403).json({
          success: false,
          error: 'ACCOUNT_SUSPENDED',
          message: 'Your account has been suspended. Suspending blocks play, deposits, and withdrawals.',
          reason: suspendReason
        });
      }
    }

    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid or expired session. Please log in again.' });
  }
}

export const requireUser = requireAuth;

/**
 * Require Admin or Cashier Role
 */
export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'admin' && req.user?.role !== 'cashier') {
      return res.status(403).json({ success: false, error: 'Access denied: Admin/Cashier privilege required.' });
    }
    next();
  });
}

/**
 * Require Agent or Admin Role
 */
export function requireAgent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'agent' && req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Access denied: Agent portal privilege required.' });
    }
    next();
  });
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '30d' });
}

export async function checkIfUserSuspended(userId: string): Promise<{ suspended: boolean; reason?: string }> {
  if (!userId) return { suspended: false };
  const strId = String(userId);
  const cached = userStatusCache.get(strId);
  const isFresh = cached && (Date.now() - cached.checkedAt < 10000);
  if (cached && isFresh) {
    if (cached.status === 'suspended') {
      return { suspended: true, reason: cached.reason || 'Account suspended by compliance.' };
    }
    return { suspended: false };
  }
  try {
    const statusRes = await query(
      `SELECT status, suspend_reason FROM users 
       WHERE id::text = $1 OR telegram_id::text = $1 OR phone = $1 
       LIMIT 1`,
      [strId]
    );
    if (statusRes.rows.length > 0) {
      const row = statusRes.rows[0];
      const st = row.status || 'active';
      userStatusCache.set(strId, { status: st, reason: row.suspend_reason, checkedAt: Date.now() });
      if (st === 'suspended') {
        return { suspended: true, reason: row.suspend_reason || 'Account suspended by compliance.' };
      }
    }
  } catch (err: any) {
    console.warn('⚠️ [Suspension Check Warning]:', err.message);
  }
  return { suspended: false };
}
