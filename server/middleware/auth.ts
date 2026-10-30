import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'lomi_bingo_super_secret_production_key_2026_et';

export interface AuthUser {
  id: string;
  telegramId?: number;
  telegramUsername?: string;
  phone?: string;
  fullName: string;
  role: 'player' | 'cashier' | 'admin' | 'agent';
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

/**
 * Verify JWT Bearer Token Middleware
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Authentication required. Please log in.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid or expired session. Please log in again.' });
  }
}

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
