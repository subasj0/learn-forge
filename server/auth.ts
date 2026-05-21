import type { Request, Response, NextFunction } from 'express';
import { adminAuth } from './firebaseAdmin';

export interface AuthedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    name?: string;
  };
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const header = req.header('authorization') || '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return res.status(401).json({ error: 'Missing authorization token' });
    }

    const decoded = await adminAuth.verifyIdToken(match[1]);
    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name,
    };
    next();
  } catch (error: any) {
    res.status(401).json({ error: error.message || 'Invalid authorization token' });
  }
}

