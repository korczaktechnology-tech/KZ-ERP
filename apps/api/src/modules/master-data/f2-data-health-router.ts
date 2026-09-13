import type { Db } from 'mongodb';
import { Router } from 'express';
import { requireAuth } from '../../core/auth.js';
import { hasPermission, type Role } from '../../core/types.js';
import { fail, ok } from '../../core/api.js';
import { scanF2Integrity } from './f2-integrity.js';

type Actor = { id: string; companyId: string; role: Role };

export function f2DataHealthRouter(db: Db): Router {
  const r = Router();
  r.use(requireAuth);
  r.get('/integrity', async (_req, res, next) => {
    try {
      const actor = res.locals.user as Actor;
      if (!hasPermission(actor.role, 'master-data:read')) return fail(res, 403, 'FORBIDDEN');
      return ok(res, await scanF2Integrity(db, actor.companyId));
    } catch (error) {
      next(error);
    }
  });
  return r;
}
