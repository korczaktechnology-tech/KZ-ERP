import type { Db } from 'mongodb';
import type { NextFunction, Request, Response } from 'express';

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 120;

type RateRecord = { _id: string; expiresAt: Date; count: number };

export function distributedRateLimit(db: Db) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/system' || req.path.startsWith('/auth/')) return next();
    const tenant = typeof res.locals.user?.companyId === 'string' ? res.locals.user.companyId : 'anonymous';
    const identity = typeof res.locals.user?.id === 'string' ? res.locals.user.id : req.ip ?? 'unknown';
    const bucket = Math.floor(Date.now() / WINDOW_MS);
    const id = `${tenant}:${identity}:${bucket}`;
    try {
      const collection = db.collection<RateRecord>('api_rate_limits');
      const now = new Date();
      const result = await collection.findOneAndUpdate(
        { _id: id },
        { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((bucket + 1) * WINDOW_MS) } },
        { upsert: true, returnDocument: 'after' }
      );
      const count = result?.count ?? 0;
      const remaining = Math.max(0, MAX_REQUESTS - count);
      res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', Math.ceil((bucket + 1) * WINDOW_MS / 1000));
      if (count > MAX_REQUESTS) {
        res.setHeader('Retry-After', Math.max(1, Math.ceil(((bucket + 1) * WINDOW_MS - now.getTime()) / 1000)));
        res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests' }, requestId: res.locals.requestId });
        return;
      }
      next();
    } catch {
      next();
    }
  };
}
