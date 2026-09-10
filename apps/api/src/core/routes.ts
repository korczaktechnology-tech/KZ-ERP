import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { createToken, hashPassword, requireAuth, verifyPassword } from './auth.js';
import type { Db } from 'mongodb';
import { hasPermission } from './types.js';

const loginSchema = z.object({ email: z.string().email().max(320), password: z.string().min(1).max(200) });
const bootstrapSchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  name: z.string().trim().min(2).max(120),
  email: z.string().email().max(320),
  password: z.string().min(10).max(200),
  bootstrapKey: z.string().min(1)
});

export function coreRouter(db: Db): Router {
  const router = Router();
  const companies = db.collection('companies');
  const users = db.collection('users');
  const audit = db.collection('audit_logs');

  router.post('/auth/bootstrap', async (req, res, next) => {
    try {
      const input = bootstrapSchema.parse(req.body);
      const key = process.env.CORE_BOOTSTRAP_KEY;
      if (!key || input.bootstrapKey !== key) { res.status(403).json({ error: 'FORBIDDEN' }); return; }
      if (await companies.countDocuments({}) > 0) { res.status(409).json({ error: 'BOOTSTRAP_ALREADY_COMPLETED' }); return; }
      const now = new Date();
      const companyId = randomUUID();
      const userId = randomUUID();
      await companies.insertOne({ _id: companyId, name: input.companyName, slug: input.slug, active: true, createdAt: now, updatedAt: now });
      await users.insertOne({ _id: userId, companyId, email: input.email.toLowerCase(), name: input.name, passwordHash: hashPassword(input.password), role: 'owner', active: true, createdAt: now, updatedAt: now });
      await audit.insertOne({ companyId, actorUserId: userId, action: 'core.bootstrap', resource: 'company', resourceId: companyId, createdAt: now });
      res.status(201).json({ token: createToken({ id: userId, companyId, email: input.email.toLowerCase(), role: 'owner', name: input.name }), companyId, userId });
    } catch (error) { next(error); }
  });

  router.post('/auth/login', async (req, res, next) => {
    try {
      const input = loginSchema.parse(req.body);
      const user = await users.findOne({ email: input.email.toLowerCase(), active: true });
      if (!user || !verifyPassword(input.password, String(user.passwordHash))) { res.status(401).json({ error: 'INVALID_CREDENTIALS' }); return; }
      res.json({ token: createToken({ id: String(user._id), companyId: String(user.companyId), email: String(user.email), role: user.role, name: String(user.name) }) });
    } catch (error) { next(error); }
  });

  router.get('/core/me', requireAuth, (req, res) => {
    res.json({ user: res.locals.user, companyId: res.locals.user.companyId });
  });

  router.get('/core/company', requireAuth, async (req, res, next) => {
    try {
      const company = await companies.findOne({ _id: res.locals.user.companyId, active: true }, { projection: { _id: 0, name: 1, slug: 1, active: 1, createdAt: 1, updatedAt: 1 } });
      if (!company) { res.status(404).json({ error: 'COMPANY_NOT_FOUND' }); return; }
      res.json({ company });
    } catch (error) { next(error); }
  });

  router.get('/core/audit', requireAuth, async (req, res, next) => {
    try {
      if (!hasPermission(res.locals.user.role, 'audit:read')) { res.status(403).json({ error: 'FORBIDDEN' }); return; }
      const limit = Math.min(Math.max(Number(req.query.limit ?? 50), 1), 100);
      const items = await audit.find({ companyId: res.locals.user.companyId }).sort({ createdAt: -1 }).limit(limit).toArray();
      res.json({ items, limit });
    } catch (error) { next(error); }
  });

  return router;
}
