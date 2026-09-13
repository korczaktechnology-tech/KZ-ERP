import type { Db } from 'mongodb';
import { Router } from 'express';
import { requireAuth } from '../../core/auth.js';
import { hasPermission, type Role } from '../../core/types.js';
import { tenantCollection } from '../../core/db.js';
import { fail, noContent } from '../../core/api.js';
import { randomUUID } from 'node:crypto';

type Actor = { id: string; companyId: string; role: Role };
type Attachment = { _id: string; storageManaged?: boolean };

export function f2AttachmentGuardRouter(db: Db): Router {
  const r = Router();
  r.use(requireAuth);
  const collection = tenantCollection<Attachment & Record<string, unknown>>(db, 'master_attachments');
  r.delete('/attachments/:id', async (req, res, next) => {
    try {
      const actor = res.locals.user as Actor;
      if (!hasPermission(actor.role, 'master-data:write')) return fail(res, 403, 'FORBIDDEN');
      const id = String(req.params.id);
      const doc = await collection.findOne(actor.companyId, { _id: id });
      if (!doc) return fail(res, 404, 'NOT_FOUND');
      if (doc.storageManaged) return fail(res, 409, 'CONFLICT', 'Managed attachments must be deleted through /attachments/:id/file');
      await collection.deleteOne(actor.companyId, { _id: id });
      await db.collection('audit_logs').insertOne({ _id: randomUUID(), companyId: actor.companyId, actorUserId: actor.id, action: 'master-data.attachment.delete', resource: 'attachment', resourceId: id, metadata: { storageManaged: false }, createdAt: new Date(), updatedAt: new Date() });
      return noContent(res);
    } catch (error) {
      next(error);
    }
  });
  return r;
}
