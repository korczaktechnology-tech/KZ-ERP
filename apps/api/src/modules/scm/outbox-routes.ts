import { randomUUID } from 'node:crypto';
import type { Db, Filter } from 'mongodb';
import { Router } from 'express';
import { z } from 'zod';
import { fail, ok, paginated, parsePagination } from '../../core/api.js';
import { tenantCollection } from '../../core/db.js';
import { requireAuth } from '../../core/auth.js';
import { hasPermission, type Role } from '../../core/types.js';
import type { ScmOutboxEvent } from './types.js';

type Actor = { id: string; companyId: string; role: Role };
type Audit = { _id: string; companyId: string; actorUserId: string; action: string; resource: string; resourceId: string; metadata?: Record<string, unknown>; createdAt: Date };

const eventId = z.string().uuid();
const status = z.enum(['pending', 'processing', 'published', 'dead_letter']);

function actor(res: Parameters<typeof requireAuth>[1]): Actor {
  return res.locals.user as Actor;
}

function can(res: Parameters<typeof requireAuth>[1], permission: string) {
  return hasPermission(actor(res).role, permission);
}

export function scmOutboxRouter(db: Db): Router {
  const router = Router();
  router.use(requireAuth);
  const events = tenantCollection<ScmOutboxEvent>(db, 'scm_outbox_events');

  router.get('/', async (req, res, next) => {
    try {
      if (!can(res, 'scm:read')) { fail(res, 403, 'FORBIDDEN'); return; }
      const a = actor(res);
      const p = parsePagination(req.query);
      const filter: Filter<ScmOutboxEvent> = {};
      if (typeof req.query.status === 'string') filter.status = status.parse(req.query.status);
      if (typeof req.query.type === 'string') filter.type = req.query.type;
      if (typeof req.query.aggregateType === 'string') filter.aggregateType = req.query.aggregateType;
      const [items, total] = await Promise.all([
        events.find(a.companyId, filter).sort({ createdAt: -1 }).skip(p.offset).limit(p.limit).toArray(),
        events.find(a.companyId, filter).count()
      ]);
      paginated(res, items.map(v => ({
        id: v._id,
        type: v.type,
        aggregateType: v.aggregateType,
        aggregateId: v.aggregateId,
        status: v.status,
        attempts: v.attempts,
        availableAt: v.availableAt,
        lastError: v.lastError,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt
      })), total, p);
    } catch (e) { next(e); }
  });

  router.post('/:id/replay', async (req, res, next) => {
    try {
      if (!can(res, 'scm:write')) { fail(res, 403, 'FORBIDDEN'); return; }
      const a = actor(res);
      const id = eventId.parse(req.params.id);
      const event = await events.findOne(a.companyId, { _id: id });
      if (!event) { fail(res, 404, 'NOT_FOUND', 'SCM outbox event not found'); return; }
      if (event.status !== 'dead_letter') { fail(res, 409, 'CONFLICT', 'Only dead-letter events can be replayed'); return; }

      const now = new Date();
      const updated = await db.collection<ScmOutboxEvent>('scm_outbox_events').findOneAndUpdate(
        { companyId: a.companyId, _id: id, status: 'dead_letter' },
        { $set: { status: 'pending', attempts: 0, availableAt: now, updatedAt: now }, $unset: { lastError: '' } },
        { returnDocument: 'after' }
      );
      if (!updated) { fail(res, 409, 'CONFLICT', 'Outbox event changed before replay'); return; }

      await db.collection<Audit>('audit_logs').insertOne({
        _id: randomUUID(), companyId: a.companyId, actorUserId: a.id,
        action: 'scm.outbox.replay', resource: 'scm_outbox_event', resourceId: id,
        metadata: { type: event.type, aggregateType: event.aggregateType, aggregateId: event.aggregateId }, createdAt: now
      });
      ok(res, { event: { id: updated._id, status: updated.status, attempts: updated.attempts, availableAt: updated.availableAt } });
    } catch (e) { next(e); }
  });

  return router;
}
