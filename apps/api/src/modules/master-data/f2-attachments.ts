import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction, Router as ExpressRouter } from 'express';
import express from 'express';
import { GridFSBucket } from 'mongodb';
import { requireAuth } from '../../core/auth.js';
import { hasPermission, type Role } from '../../core/types.js';
import { tenantCollection } from '../../core/db.js';
import { fail, noContent, ok } from '../../core/api.js';
import { validateF2Reference } from './f2-hardening.js';

type Attachment = { _id: string; companyId: string; entityType: string; entityId: string; fileName: string; mimeType: string; size: number; storageKey: string; checksum?: string; createdAt: Date; updatedAt: Date };
type Actor = { id: string; companyId: string; role: Role };
const MAX_BYTES = 50_000_000;
const actor = (res: Response): Actor => res.locals.user as Actor;
const can = (res: Response, permission: 'master-data:read' | 'master-data:write') => hasPermission(actor(res).role, permission);
const header = (req: Request, name: string) => { const value = req.header(name); return value?.trim() || undefined; };

export function f2AttachmentRouter(db: any): ExpressRouter {
  const r = express.Router();
  const files = tenantCollection<Attachment>(db, 'master_attachments');
  const bucket = new GridFSBucket(db, { bucketName: 'f2_attachments' });
  r.use(requireAuth);

  r.post('/attachments/upload', async (req: Request, res: Response, next: NextFunction) => {
    if (!can(res, 'master-data:write')) return fail(res, 403, 'FORBIDDEN');
    const a = actor(res);
    const entityType = header(req, 'x-f2-entity-type');
    const entityId = header(req, 'x-f2-entity-id');
    const fileName = header(req, 'x-f2-file-name');
    const mimeType = header(req, 'x-f2-mime-type') ?? 'application/octet-stream';
    const declaredSize = Number(req.header('content-length') ?? 0);
    if (!entityType || !entityId || !fileName) return fail(res, 400, 'VALIDATION_ERROR', 'x-f2-entity-type, x-f2-entity-id and x-f2-file-name are required');
    if (!Number.isInteger(declaredSize) || declaredSize < 1 || declaredSize > MAX_BYTES) return fail(res, 413, 'VALIDATION_ERROR', 'Attachment size must be between 1 byte and 50 MB');
    const referenceError = await validateF2Reference(db, a.companyId, entityType, entityId, 'Attachment target');
    if (referenceError) return fail(res, 422, 'VALIDATION_ERROR', referenceError);
    const id = randomUUID();
    const storageKey = `f2_attachments/${a.companyId}/${id}`;
    const upload = bucket.openUploadStreamWithId(id as any, fileName, { metadata: { companyId: a.companyId, entityType, entityId, mimeType } });
    let size = 0;
    let aborted = false;
    const cleanup = async () => { try { await bucket.delete(id as any); } catch { /* no file or already deleted */ } };
    req.on('data', (chunk: Buffer) => { size += chunk.length; if (size > MAX_BYTES && !aborted) { aborted = true; void cleanup(); req.destroy(new Error('Attachment exceeds 50 MB')); } });
    upload.on('error', async error => { await cleanup(); if (!res.headersSent) next(error); });
    upload.on('finish', async () => {
      if (aborted || size !== declaredSize) { await cleanup(); if (!res.headersSent) return fail(res, 400, 'VALIDATION_ERROR', 'Attachment byte count does not match Content-Length'); return; }
      try {
        const now = new Date();
        const doc: Attachment = { _id: id, companyId: a.companyId, entityType, entityId, fileName, mimeType, size, storageKey, createdAt: now, updatedAt: now };
        await files.insertOne(a.companyId, doc);
        await db.collection('audit_logs').insertOne({ _id: randomUUID(), companyId: a.companyId, actorUserId: a.id, action: 'master-data.attachment.upload', resource: 'attachment', resourceId: id, metadata: { size, entityType, entityId }, createdAt: now });
        ok(res, { attachment: { id, companyId: a.companyId, entityType, entityId, fileName, mimeType, size, storageKey, createdAt: now, updatedAt: now } });
      } catch (error) { await cleanup(); next(error); }
    });
    req.pipe(upload);
  });

  r.get('/attachments/:id/download', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!can(res, 'master-data:read')) return fail(res, 403, 'FORBIDDEN');
      const a = actor(res), id = String(req.params.id), doc = await files.findOne(a.companyId, { _id: id });
      if (!doc) return fail(res, 404, 'NOT_FOUND');
      res.setHeader('Content-Type', doc.mimeType); res.setHeader('Content-Length', String(doc.size)); res.setHeader('Content-Disposition', `attachment; filename="${doc.fileName.replace(/["\\\r\n]/g, '_')}"`);
      const stream = bucket.openDownloadStream(id as any);
      stream.on('error', next); stream.pipe(res);
    } catch (error) { next(error); }
  });

  r.delete('/attachments/:id/file', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!can(res, 'master-data:write')) return fail(res, 403, 'FORBIDDEN');
      const a = actor(res), id = String(req.params.id), doc = await files.findOne(a.companyId, { _id: id });
      if (!doc) return fail(res, 404, 'NOT_FOUND');
      await bucket.delete(id as any).catch(() => undefined);
      await files.deleteOne(a.companyId, { _id: id });
      await db.collection('audit_logs').insertOne({ _id: randomUUID(), companyId: a.companyId, actorUserId: a.id, action: 'master-data.attachment.delete-file', resource: 'attachment', resourceId: id, createdAt: new Date() });
      noContent(res);
    } catch (error) { next(error); }
  });
  return r;
}
