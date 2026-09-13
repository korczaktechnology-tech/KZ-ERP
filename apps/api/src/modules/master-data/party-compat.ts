import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { Db } from 'mongodb';
import { z } from 'zod';
import { created, fail, noContent, paginated, parsePagination } from '../../core/api.js';
import { tenantCollection } from '../../core/db.js';
import { requireAuth } from '../../core/auth.js';
import { hasPermission, type Role } from '../../core/types.js';
import type { MasterParty } from './types.js';

const compatibilitySchema = z.object({
  code: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(160),
  document: z.string().trim().max(40).optional(),
  email: z.string().email().max(320).optional(),
  phone: z.string().trim().max(40).optional(),
  active: z.boolean().default(true)
});

type Actor = { id: string; companyId: string; role: Role };
const actor = (res: { locals: { user?: unknown } }): Actor => res.locals.user as Actor;
const canRead = (res: Parameters<typeof requireAuth>[1]) => hasPermission(actor(res).role, 'master-data:read');
const canWrite = (res: Parameters<typeof requireAuth>[1]) => hasPermission(actor(res).role, 'master-data:write');
const legacy = (party: MasterParty) => ({ id: String(party._id), code: party.code, name: party.name, document: party.document, email: party.email, phone: party.phone, active: party.active, createdAt: party.createdAt, updatedAt: party.updatedAt });

export function partyCompatibilityRouter(db: Db): Router {
  const router = Router();
  router.use(requireAuth);
  const parties = tenantCollection<MasterParty>(db, 'parties');

  for (const kind of ['customer', 'supplier'] as const) {
    const role = kind;
    router.get(`/${kind}s`, async (req, res, next) => {
      try {
        if (!canRead(res)) { fail(res, 403, 'FORBIDDEN'); return; }
        const a = actor(res); const p = parsePagination(req.query);
        const filter = { roles: role };
        const [items, total] = await Promise.all([
          parties.find(a.companyId, filter).sort({ createdAt: -1 }).skip(p.offset).limit(p.limit).toArray(),
          parties.find(a.companyId, filter).count()
        ]);
        paginated(res, items.map(legacy), total, p);
      } catch (e) { next(e); }
    });

    router.post(`/${kind}s`, async (req, res, next) => {
      try {
        if (!canWrite(res)) { fail(res, 403, 'FORBIDDEN'); return; }
        const a = actor(res); const input = compatibilitySchema.parse(req.body); const now = new Date();
        const party: MasterParty = { _id: randomUUID(), companyId: a.companyId, kind: 'company', roles: [role], ...input, createdAt: now, updatedAt: now };
        await parties.insertOne(a.companyId, party);
        created(res, { [kind]: legacy(party) });
      } catch (e) { next(e); }
    });

    router.delete(`/${kind}s/:id`, async (req, res, next) => {
      try {
        if (!canWrite(res)) { fail(res, 403, 'FORBIDDEN'); return; }
        const a = actor(res);
        const result = await parties.updateOne(a.companyId, { _id: req.params.id, roles: role, active: true }, { $set: { active: false, updatedAt: new Date() } });
        if (!result.matchedCount) { fail(res, 404, 'NOT_FOUND', `${kind[0].toUpperCase()}${kind.slice(1)} not found`); return; }
        noContent(res);
      } catch (e) { next(e); }
    });
  }
  return router;
}
