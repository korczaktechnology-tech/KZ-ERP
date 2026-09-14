import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../core/auth.js';
import { hasPermission } from '../../core/types.js';
import { fail } from '../../core/api.js';
import { F2_RELATION_TYPES, validateF2Reference } from './f2-hardening.js';
import type { Db } from 'mongodb';

const relation = z.enum(F2_RELATION_TYPES);

export function f2SemanticGuardRouter(db: Db) {
  const r = Router();
  r.use(requireAuth);
  r.use('/relationships', async (req, res, next) => {
    try {
      const user = res.locals.user;
      if (!hasPermission(user.role, 'master-data:write')) return next();
      if (req.method !== 'POST') return next();
      const body = req.body ?? {};
      const parsedRelation = relation.safeParse(body.relation);
      if (!parsedRelation.success) {
        return fail(res, 422, 'VALIDATION_ERROR', `Unsupported relationship type '${String(body.relation)}'`);
      }
      for (const [type, id, label] of [
        [body.sourceType, body.sourceId, 'Relationship source'],
        [body.targetType, body.targetId, 'Relationship target']
      ] as const) {
        if (typeof type !== 'string' || typeof id !== 'string') {
          return fail(res, 422, 'VALIDATION_ERROR', `${label} is required`);
        }
        const error = await validateF2Reference(db, user.companyId, type, id, label);
        if (error) return fail(res, 422, 'VALIDATION_ERROR', error);
      }
      return next();
    } catch (error) {
      return next(error);
    }
  });
  return r;
}
