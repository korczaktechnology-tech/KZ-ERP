import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import type { Db } from 'mongodb';
import { createRefreshToken, createToken, hashPassword, hashRefreshToken, requireAuth, verifyPassword } from './auth.js';
import type { AuditLog, AuthSession, CoreCompany, CoreUser } from './db.js';
import { hasPermission, type Role } from './types.js';

const loginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(200),
  companySlug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80).optional()
});
const refreshSchema = z.object({ refreshToken: z.string().min(40).max(200) });
const bootstrapSchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  name: z.string().trim().min(2).max(120),
  email: z.string().email().max(320),
  password: z.string().min(10).max(200),
  bootstrapKey: z.string().min(1)
});
const createUserSchema = z.object({
  email: z.string().email().max(320),
  name: z.string().trim().min(2).max(120),
  password: z.string().min(10).max(200),
  role: z.enum(['admin', 'manager', 'user', 'viewer'])
});
const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(200), newPassword: z.string().min(10).max(200) });

const refreshTtlMs = 30 * 24 * 60 * 60 * 1000;

export function coreRouter(db: Db): Router {
  const router = Router();
  const companies = db.collection<CoreCompany>('companies');
  const users = db.collection<CoreUser>('users');
  const audit = db.collection<AuditLog>('audit_logs');
  const sessions = db.collection<AuthSession>('auth_sessions');

  const tenantAuth = [requireAuth, async (req: Parameters<typeof requireAuth>[0], res: Parameters<typeof requireAuth>[1], next: Parameters<typeof requireAuth>[2]) => {
    try {
      const authUser = res.locals.user as { id: string; companyId: string };
      const user = await users.findOne({ _id: authUser.id, companyId: authUser.companyId, active: true }, { projection: { _id: 1, companyId: 1 } });
      const company = await companies.findOne({ _id: authUser.companyId, active: true }, { projection: { _id: 1 } });
      if (!user || !company) { res.status(401).json({ error: 'TENANT_INACTIVE' }); return; }
      next();
    } catch (error) { next(error); }
  }] as const;

  const issueSession = async (user: CoreUser) => {
    const { token, hash } = createRefreshToken();
    const now = new Date();
    await sessions.insertOne({ companyId: user.companyId, userId: String(user._id), tokenHash: hash, createdAt: now, expiresAt: new Date(now.getTime() + refreshTtlMs) });
    return { token, accessToken: createToken({ id: String(user._id), companyId: user.companyId, email: user.email, role: user.role, name: user.name }) };
  };

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
      const user: CoreUser = { _id: userId, companyId, email: input.email.toLowerCase(), name: input.name, passwordHash: hashPassword(input.password), role: 'owner', active: true, createdAt: now, updatedAt: now };
      await users.insertOne(user);
      await audit.insertOne({ companyId, actorUserId: userId, action: 'core.bootstrap', resource: 'company', resourceId: companyId, createdAt: now });
      const auth = await issueSession(user);
      res.status(201).json({ accessToken: auth.accessToken, refreshToken: auth.token, companyId, userId });
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
      const auth = await issueSession(user);
      res.json({ accessToken: auth.accessToken, refreshToken: auth.token, expiresIn: 60 * 60 * 8 });
    } catch (error) { next(error); }
  });

  router.post('/auth/refresh', async (req, res, next) => {
    try {
      const { refreshToken } = refreshSchema.parse(req.body);
      const tokenHash = hashRefreshToken(refreshToken);
      const session = await sessions.findOne({ tokenHash });
      if (!session || session.expiresAt <= new Date()) { res.status(401).json({ error: 'INVALID_REFRESH_TOKEN' }); return; }
      const user = await users.findOne({ _id: session.userId, companyId: session.companyId, active: true });
      const company = await companies.findOne({ _id: session.companyId, active: true });
      if (!user || !company) { await sessions.deleteOne({ _id: session._id }); res.status(401).json({ error: 'TENANT_INACTIVE' }); return; }
      await sessions.deleteOne({ _id: session._id });
      const auth = await issueSession(user);
      res.json({ accessToken: auth.accessToken, refreshToken: auth.token, expiresIn: 60 * 60 * 8 });
    } catch (error) { next(error); }
  });

  router.post('/auth/logout', async (req, res, next) => {
    try {
      const { refreshToken } = refreshSchema.parse(req.body);
      await sessions.deleteOne({ tokenHash: hashRefreshToken(refreshToken) });
      res.status(204).send();
    } catch (error) { next(error); }
  });

  router.get('/core/me', ...tenantAuth, (req, res) => {
    res.json({ user: res.locals.user, companyId: (res.locals.user as { companyId: string }).companyId });
  });

  router.post('/core/users', ...tenantAuth, async (req, res, next) => {
    try {
      const actor = res.locals.user as { id: string; companyId: string; role: Role };
      if (!hasPermission(actor.role, 'users:write')) { res.status(403).json({ error: 'FORBIDDEN' }); return; }
      const input = createUserSchema.parse(req.body);
      const now = new Date();
      const user: CoreUser = { _id: randomUUID(), companyId: actor.companyId, email: input.email.toLowerCase(), name: input.name, passwordHash: hashPassword(input.password), role: input.role, active: true, createdAt: now, updatedAt: now };
      await users.insertOne(user);
      await audit.insertOne({ companyId: actor.companyId, actorUserId: actor.id, action: 'core.user.create', resource: 'user', resourceId: user._id, createdAt: now });
      res.status(201).json({ user: { id: user._id, email: user.email, name: user.name, role: user.role, active: user.active } });
    } catch (error) { next(error); }
  });

  router.post('/auth/change-password', ...tenantAuth, async (req, res, next) => {
    try {
      const actor = res.locals.user as { id: string; companyId: string };
      const input = changePasswordSchema.parse(req.body);
      const user = await users.findOne({ _id: actor.id, companyId: actor.companyId, active: true });
      if (!user || !verifyPassword(input.currentPassword, user.passwordHash)) { res.status(401).json({ error: 'INVALID_CREDENTIALS' }); return; }
      const now = new Date();
      await users.updateOne({ _id: actor.id, companyId: actor.companyId }, { $set: { passwordHash: hashPassword(input.newPassword), updatedAt: now } });
      await sessions.deleteMany({ companyId: actor.companyId, userId: actor.id });
      await audit.insertOne({ companyId: actor.companyId, actorUserId: actor.id, action: 'core.auth.password_change', resource: 'user', resourceId: actor.id, createdAt: now });
      res.status(204).send();
    } catch (error) { next(error); }
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
      const user = res.locals.user as { companyId: string; role: Role };
      if (!hasPermission(user.role, 'audit:read')) { res.status(403).json({ error: 'FORBIDDEN' }); return; }
      const limit = Math.min(Math.max(Number(req.query.limit ?? 50), 1), 100);
      const items = await audit.find({ companyId: user.companyId }).sort({ createdAt: -1 }).limit(limit).toArray();
      res.json({ items, limit });
    } catch (error) { next(error); }
  });

  return router;
}
