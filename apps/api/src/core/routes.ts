import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import type { Db } from 'mongodb';
import { createRefreshToken, createToken, hashPassword, hashRefreshToken, requireAuth, verifyPassword } from './auth.js';
import type { AuditLog, AuthSession, CoreCompany, CoreUser } from './db.js';
import { hasPermission, type Role } from './types.js';
import { created, fail, noContent, ok, paginated, parsePagination } from './api.js';

const loginSchema = z.object({ email: z.string().email().max(320), password: z.string().min(1).max(200), companySlug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80).optional() });
const refreshSchema = z.object({ refreshToken: z.string().min(40).max(200) });
const bootstrapSchema = z.object({ companyName: z.string().trim().min(2).max(120), slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80), name: z.string().trim().min(2).max(120), email: z.string().email().max(320), password: z.string().min(10).max(200), bootstrapKey: z.string().min(1) });
const createUserSchema = z.object({ email: z.string().email().max(320), name: z.string().trim().min(2).max(120), password: z.string().min(10).max(200), role: z.enum(['admin', 'manager', 'user', 'viewer']) });
const updateUserSchema = z.object({ name: z.string().trim().min(2).max(120).optional(), role: z.enum(['admin', 'manager', 'user', 'viewer']).optional(), active: z.boolean().optional(), password: z.string().min(10).max(200).optional() }).refine(value => Object.keys(value).length > 0, 'At least one field must be supplied');
const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(200), newPassword: z.string().min(10).max(200) });
const updateCompanySchema = z.object({ name: z.string().trim().min(2).max(120) });
const refreshTtlMs = 30 * 24 * 60 * 60 * 1000;

function publicUser(user: CoreUser) {
  return { id: String(user._id), email: user.email, name: user.name, role: user.role, active: user.active, createdAt: user.createdAt, updatedAt: user.updatedAt };
}

export function coreRouter(db: Db): Router {
  const router = Router();
  const companies = db.collection<CoreCompany>('companies');
  const users = db.collection<CoreUser>('users');
  const audit = db.collection<AuditLog>('audit_logs');
  const sessions = db.collection<AuthSession>('auth_sessions');
  const system = db.collection('system');

  const tenantAuth = [requireAuth, async (_req: Parameters<typeof requireAuth>[0], res: Parameters<typeof requireAuth>[1], next: Parameters<typeof requireAuth>[2]) => {
    try {
      const authUser = res.locals.user as { id: string; companyId: string };
      const user = await users.findOne({ _id: authUser.id, companyId: authUser.companyId, active: true }, { projection: { _id: 1, companyId: 1 } });
      const company = await companies.findOne({ _id: authUser.companyId, active: true }, { projection: { _id: 1 } });
      if (!user || !company) { fail(res, 401, 'UNAUTHORIZED', 'Tenant or user is inactive'); return; }
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
    let lockAcquired = false;
    try {
      const input = bootstrapSchema.parse(req.body);
      const key = process.env.CORE_BOOTSTRAP_KEY;
      if (!key || input.bootstrapKey !== key) { fail(res, 403, 'FORBIDDEN'); return; }
      if (await companies.countDocuments({}) > 0) { fail(res, 409, 'CONFLICT', 'Bootstrap already completed'); return; }
      const lock = await system.findOneAndUpdate({ _id: 'bootstrap' }, { $setOnInsert: { createdAt: new Date() } }, { upsert: true, returnDocument: 'before' });
      if (lock) { fail(res, 409, 'CONFLICT', 'Bootstrap already in progress or completed'); return; }
      lockAcquired = true;
      const now = new Date();
      const companyId = randomUUID();
      const userId = randomUUID();
      await companies.insertOne({ _id: companyId, name: input.companyName, slug: input.slug, active: true, createdAt: now, updatedAt: now });
      const user: CoreUser = { _id: userId, companyId, email: input.email.toLowerCase(), name: input.name, passwordHash: hashPassword(input.password), role: 'owner', active: true, createdAt: now, updatedAt: now };
      await users.insertOne(user);
      await audit.insertOne({ companyId, actorUserId: userId, action: 'core.bootstrap', resource: 'company', resourceId: companyId, createdAt: now });
      const auth = await issueSession(user);
      await system.deleteOne({ _id: 'bootstrap' });
      lockAcquired = false;
      created(res, { accessToken: auth.accessToken, refreshToken: auth.token, companyId, userId });
    } catch (error) {
      if (lockAcquired) await system.deleteOne({ _id: 'bootstrap' }).catch(() => undefined);
      next(error);
    }
  });

  router.post('/auth/login', async (req, res, next) => {
    try {
      const input = loginSchema.parse(req.body);
      const email = input.email.toLowerCase();
      let user: CoreUser | null = null;
      if (input.companySlug) {
        const company = await companies.findOne({ slug: input.companySlug, active: true }, { projection: { _id: 1 } });
        if (!company?._id) { fail(res, 401, 'UNAUTHORIZED', 'Invalid credentials'); return; }
        user = await users.findOne({ email, companyId: String(company._id), active: true });
      } else {
        const matches = await users.find({ email, active: true }).limit(2).toArray();
        if (matches.length > 1) { fail(res, 409, 'CONFLICT', 'Company is required'); return; }
        user = matches[0] ?? null;
      }
      if (!user || !verifyPassword(input.password, user.passwordHash)) { fail(res, 401, 'UNAUTHORIZED', 'Invalid credentials'); return; }
      const company = await companies.findOne({ _id: user.companyId, active: true }, { projection: { _id: 1 } });
      if (!company) { fail(res, 401, 'UNAUTHORIZED', 'Tenant is inactive'); return; }
      const auth = await issueSession(user);
      ok(res, { accessToken: auth.accessToken, refreshToken: auth.token, expiresIn: 60 * 60 * 8 });
    } catch (error) { next(error); }
  });

  router.post('/auth/refresh', async (req, res, next) => {
    try {
      const { refreshToken } = refreshSchema.parse(req.body);
      const tokenHash = hashRefreshToken(refreshToken);
      const session = await sessions.findOne({ tokenHash });
      if (!session || session.expiresAt <= new Date()) { fail(res, 401, 'UNAUTHORIZED', 'Invalid refresh token'); return; }
      const user = await users.findOne({ _id: session.userId, companyId: session.companyId, active: true });
      const company = await companies.findOne({ _id: session.companyId, active: true });
      if (!user || !company) { await sessions.deleteOne({ _id: session._id }); fail(res, 401, 'UNAUTHORIZED', 'Tenant is inactive'); return; }
      await sessions.deleteOne({ _id: session._id });
      const auth = await issueSession(user);
      ok(res, { accessToken: auth.accessToken, refreshToken: auth.token, expiresIn: 60 * 60 * 8 });
    } catch (error) { next(error); }
  });

  router.post('/auth/logout', async (req, res, next) => {
    try { const { refreshToken } = refreshSchema.parse(req.body); await sessions.deleteOne({ tokenHash: hashRefreshToken(refreshToken) }); noContent(res); }
    catch (error) { next(error); }
  });

  router.get('/core/me', ...tenantAuth, (_req, res) => ok(res, { user: res.locals.user, companyId: (res.locals.user as { companyId: string }).companyId }));

  router.get('/core/users', ...tenantAuth, async (req, res, next) => {
    try {
      const actor = res.locals.user as { companyId: string; role: Role };
      if (!hasPermission(actor.role, 'users:read')) { fail(res, 403, 'FORBIDDEN'); return; }
      const pagination = parsePagination(req.query);
      const [items, total] = await Promise.all([
        users.find({ companyId: actor.companyId }, { projection: { passwordHash: 0 } }).sort({ createdAt: -1 }).skip(pagination.offset).limit(pagination.limit).toArray(),
        users.countDocuments({ companyId: actor.companyId })
      ]);
      paginated(res, items.map(publicUser), total, pagination);
    } catch (error) { next(error); }
  });

  router.post('/core/users', ...tenantAuth, async (req, res, next) => {
    try {
      const actor = res.locals.user as { id: string; companyId: string; role: Role };
      if (!hasPermission(actor.role, 'users:write')) { fail(res, 403, 'FORBIDDEN'); return; }
      const input = createUserSchema.parse(req.body);
      const now = new Date();
      const user: CoreUser = { _id: randomUUID(), companyId: actor.companyId, email: input.email.toLowerCase(), name: input.name, passwordHash: hashPassword(input.password), role: input.role, active: true, createdAt: now, updatedAt: now };
      await users.insertOne(user);
      await audit.insertOne({ companyId: actor.companyId, actorUserId: actor.id, action: 'core.user.create', resource: 'user', resourceId: user._id, metadata: { role: user.role }, createdAt: now });
      created(res, { user: publicUser(user) });
    } catch (error) { next(error); }
  });

  router.patch('/core/users/:id', ...tenantAuth, async (req, res, next) => {
    try {
      const actor = res.locals.user as { id: string; companyId: string; role: Role };
      if (!hasPermission(actor.role, 'users:write')) { fail(res, 403, 'FORBIDDEN'); return; }
      const input = updateUserSchema.parse(req.body);
      const target = await users.findOne({ _id: req.params.id, companyId: actor.companyId, active: true });
      if (!target) { fail(res, 404, 'NOT_FOUND', 'User not found'); return; }
      if (target.role === 'owner' && actor.role !== 'owner') { fail(res, 403, 'FORBIDDEN'); return; }
      if (input.active === false && target._id === actor.id) { fail(res, 400, 'VALIDATION_ERROR', 'You cannot deactivate your own account'); return; }
      if (input.active === false && target.role === 'owner') { fail(res, 400, 'VALIDATION_ERROR', 'The owner account cannot be deactivated'); return; }
      if (input.role && target.role === 'owner') { fail(res, 400, 'VALIDATION_ERROR', 'The owner role cannot be changed'); return; }
      const now = new Date();
      const set: Record<string, unknown> = { updatedAt: now };
      if (input.name !== undefined) set.name = input.name;
      if (input.role !== undefined) set.role = input.role;
      if (input.active !== undefined) set.active = input.active;
      if (input.password !== undefined) set.passwordHash = hashPassword(input.password);
      await users.updateOne({ _id: target._id, companyId: actor.companyId }, { $set: set });
      if (input.active === false || input.password !== undefined) await sessions.deleteMany({ companyId: actor.companyId, userId: String(target._id) });
      const updated = await users.findOne({ _id: target._id, companyId: actor.companyId });
      if (!updated) { fail(res, 404, 'NOT_FOUND', 'User not found'); return; }
      await audit.insertOne({ companyId: actor.companyId, actorUserId: actor.id, action: 'core.user.update', resource: 'user', resourceId: target._id, metadata: { changed: Object.keys(input).filter(key => key !== 'password') }, createdAt: now });
      ok(res, { user: publicUser(updated) });
    } catch (error) { next(error); }
  });

  router.post('/auth/change-password', ...tenantAuth, async (req, res, next) => {
    try {
      const actor = res.locals.user as { id: string; companyId: string };
      const input = changePasswordSchema.parse(req.body);
      const user = await users.findOne({ _id: actor.id, companyId: actor.companyId, active: true });
      if (!user || !verifyPassword(input.currentPassword, user.passwordHash)) { fail(res, 401, 'UNAUTHORIZED', 'Invalid credentials'); return; }
      const now = new Date();
      await users.updateOne({ _id: actor.id, companyId: actor.companyId }, { $set: { passwordHash: hashPassword(input.newPassword), updatedAt: now } });
      await sessions.deleteMany({ companyId: actor.companyId, userId: actor.id });
      await audit.insertOne({ companyId: actor.companyId, actorUserId: actor.id, action: 'core.auth.password_change', resource: 'user', resourceId: actor.id, createdAt: now });
      noContent(res);
    } catch (error) { next(error); }
  });

  router.get('/core/company', ...tenantAuth, async (_req, res, next) => {
    try {
      const companyId = (res.locals.user as { companyId: string }).companyId;
      const company = await companies.findOne({ _id: companyId, active: true }, { projection: { _id: 0, name: 1, slug: 1, active: 1, createdAt: 1, updatedAt: 1 } });
      if (!company) { fail(res, 404, 'NOT_FOUND', 'Company not found'); return; }
      ok(res, { company });
    } catch (error) { next(error); }
  });

  router.patch('/core/company', ...tenantAuth, async (req, res, next) => {
    try {
      const actor = res.locals.user as { id: string; companyId: string; role: Role };
      if (!hasPermission(actor.role, 'company:write')) { fail(res, 403, 'FORBIDDEN'); return; }
      const input = updateCompanySchema.parse(req.body);
      const now = new Date();
      const result = await companies.updateOne({ _id: actor.companyId, active: true }, { $set: { name: input.name, updatedAt: now } });
      if (result.matchedCount !== 1) { fail(res, 404, 'NOT_FOUND', 'Company not found'); return; }
      await audit.insertOne({ companyId: actor.companyId, actorUserId: actor.id, action: 'core.company.update', resource: 'company', resourceId: actor.companyId, metadata: { changed: ['name'] }, createdAt: now });
      ok(res, { company: await companies.findOne({ _id: actor.companyId }) });
    } catch (error) { next(error); }
  });

  router.get('/core/audit', ...tenantAuth, async (req, res, next) => {
    try {
      const user = res.locals.user as { companyId: string; role: Role };
      if (!hasPermission(user.role, 'audit:read')) { fail(res, 403, 'FORBIDDEN'); return; }
      const pagination = parsePagination(req.query);
      const [items, total] = await Promise.all([audit.find({ companyId: user.companyId }).sort({ createdAt: -1 }).skip(pagination.offset).limit(pagination.limit).toArray(), audit.countDocuments({ companyId: user.companyId })]);
      paginated(res, items, total, pagination);
    } catch (error) { next(error); }
  });

  return router;
}
