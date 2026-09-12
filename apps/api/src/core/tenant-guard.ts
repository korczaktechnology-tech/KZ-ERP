import type { NextFunction, Request, Response } from 'express';
import type { AuthUser } from './types.js';

/** Rejects client-supplied tenant identifiers that disagree with the authenticated tenant. */
export function tenantRequestGuard(req: Request, res: Response, next: NextFunction): void {
  const user = res.locals.user as AuthUser | undefined;
  if (!user) { next(); return; }
  const values: unknown[] = [req.body?.companyId, req.query?.companyId, req.params?.companyId];
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '' && value !== user.companyId) {
      res.status(403).json({ error: { code: 'TENANT_CONTEXT_MISMATCH', message: 'Tenant context does not match the authenticated company' }, requestId: res.locals.requestId });
      return;
    }
  }
  next();
}
