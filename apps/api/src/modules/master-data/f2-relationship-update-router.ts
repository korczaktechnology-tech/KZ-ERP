import { randomUUID } from 'node:crypto';
import type { Db } from 'mongodb';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../core/auth.js';
import { hasPermission, type Role } from '../../core/types.js';
import { tenantCollection } from '../../core/db.js';
import { fail, ok } from '../../core/api.js';
import { validateF2Reference, F2_RELATION_TYPES } from './f2-hardening.js';

const id = z.string().uuid();
const schema = z.object({
  sourceType: z.string().trim().min(1).max(80), sourceId: id,
  relation: z.enum(F2_RELATION_TYPES), targetType: z.string().trim().min(1).max(80),
  targetId: id, metadata: z.record(z.string(), z.unknown()).optional()
}).partial();

type Actor = { id: string; companyId: string; role: Role };

export function f2RelationshipUpdateRouter(db: Db): Router {
  const r = Router();
  r.use(requireAuth);
  r.patch('/relationships/:id', async (req, res, next) => {
    try {
      const actor = res.locals.user as Actor;
      if (!hasPermission(actor.role, 'master-data:write')) return fail(res, 403, 'FORBIDDEN');
      const relationshipId = String(req.params.id);
      const input = schema.parse(req.body);
      const collection = tenantCollection<any>(db, 'master_relationships');
      const current = await collection.findOne(actor.companyId, { _id: relationshipId });
      if (!current) return fail(res, 404, 'NOT_FOUND');

      const sourceType = input.sourceType ?? current.sourceType;
      const sourceId = input.sourceId ?? current.sourceId;
      const targetType = input.targetType ?? current.targetType;
      const targetId = input.targetId ?? current.targetId;
      const sourceError = await validateF2Reference(db, actor.companyId, sourceType, sourceId, 'Relationship source');
      const targetError = await validateF2Reference(db, actor.companyId, targetType, targetId, 'Relationship target');
      if (sourceError || targetError) return fail(res, 422, 'VALIDATION_ERROR', sourceError ?? targetError!);

      const next = { ...input, sourceType, sourceId, targetType, targetId, updatedAt: new Date() };
      await collection.updateOne(actor.companyId, { _id: relationshipId }, { $set: next });
      const updated: any = await collection.findOne(actor.companyId, { _id: relationshipId });
      if (!updated) return fail(res, 404, 'NOT_FOUND');
      const publicDoc: Record<string, any> = { ...updated };
      delete publicDoc._id;
      await db.collection('audit_logs').insertOne({
        _id: randomUUID(), companyId: actor.companyId, actorUserId: actor.id,
        action: 'master-data.relationship.update', resource: 'relationship', resourceId: relationshipId,
        metadata: { changed: Object.keys(input) }, createdAt: new Date(), updatedAt: new Date()
      });
      return ok(res, { relationship: { id: relationshipId, ...publicDoc } });
    } catch (error) { next(error); }
  });
  return r;
}
