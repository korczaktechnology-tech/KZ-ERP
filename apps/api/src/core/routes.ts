import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import type { Db } from 'mongodb';
import { createToken, hashPassword, requireAuth, verifyPassword } from './auth.js';
import type { AuditLog, CoreCompany, CoreUser } from './db.js';
import { hasPermission } from './types.js';

const loginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(200),
  companySlug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80).optional()
});
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
  const companies = db.collection<CoreCompany>('companies');
  const users = db.collection<CoreUser>('users');
  const audit = db.collection<AuditLog>('audit_logs');

  const tenantAuth = [requireAuth, async (req: Parameters<typeof requireAuth>[0], res: Parameters<typeof requireAuth>[1], next: Parameters<typeof requireAuth>[2]) => {
    try {
      const authUser = res.locals.user as { id: string; companyId: string };
      const user = await users.findOne({ _id: authUser.id, companyId: authUser.companyId, active: true }, { projection: { _id: 1, companyId: 1 } });
      const company = await companies.findOne({ _id: authUser.companyId, active: true }, { projection: { _id: 1 } });
      if (!user || !company) { res.status(401).json({ error: 'TENANT_INACTIVE' }); return; }
      next();
    } catch (error) { next(error); }
  }] as const;

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
      const email = input.email.toLowerCase();
      let user: CoreUser | null = null;

      if (input.companySlug) {
        const company = await companies.findOne({ slug: input.companySlug, active: true }, { projection: { _id: 1 } });
        if (!company?._id) { res.status(401).json({ error: 'INVALID_CREDENTIALS' }); return; }
        user = await users.findOne({ email, companyId: String(company._id), active: true });
      } else {
        const matches = await users.find({ email, active: true }).limit(2).toArray();
        if (matches.length > 1) { res.status(409).json({ error: 'COMPANY_REQUIRED' }); return; }
        user = matches[0] ?? null;
      }

      if (!user || !verifyPassword(input.password, user.passwordHash)) { res.status(401).json({ error: 'INVALID_CREDENTIALS' }); return; }
      const company = await companies.findOne({ _id: user.companyId, active: true }, { projection: { _id: 1 } });
      if (!company) { res.status(401).json({ error: 'TENANT_INACTIVE' }); return; }
      res.json({ token: createToken({ id: String(user._id), companyId: user.companyId, email: user.email, role: user.role, name: user.name }) });
    } catch (error) { next(error); }
  });

  router.get('/core/me', ...tenantAuth, (req, res) => {
    res.json({ user: res.locals.user, companyId: (res.locals.user as { companyId: string }).companyId });
  });

  router.get('/core/company', ...tenantAuth, async (req, res, next) => {
    try {
      const companyId = (res.locals.user as { companyId: string }).companyId;
      const company = await companies.findOne({ _id: companyId, active: true }, { projection: { _id: 0, name: 1, slug: 1, active: 1, createdAt: 1, updatedAt: 1 } });
      if (!company) { res.status(404).json({ error: 'COMPANY_NOT_FOUND' }); return; }
      res.json({ company });
    } catch (error) { next(error); }
  });

  router.get('/core/audit', ...tenantAuth, async (req, res, next) => {
    try {
      const user = res.locals.user as { companyId: string; role: Parameters<typeof hasPermission>[0] };
      if (!hasPermission(user.role, 'audit:read')) { res.status(403).json({ error: 'FORBIDDEN' }); return; }
      const limit = Math.min(Math.max(Number(req.query.limit ?? 50), 1), 100);
      const items = await audit.find({ companyId: user.companyId }).sort({ createdAt: -1 }).limit(limit).toArray();
      res.json({ items, limit });
    } catch (error) { next(error); }
  });

  return router;
}
