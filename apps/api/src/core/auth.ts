import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { Collection } from 'mongodb';
import type { AuthUser, Role } from './types.js';

const TOKEN_TTL_SECONDS = 60 * 60 * 8;
const SECRET = process.env.AUTH_SECRET;
if (!SECRET || SECRET.length < 32) throw new Error('AUTH_SECRET must be set and contain at least 32 characters');

type TokenPayload = AuthUser & { iat: number; exp: number };
const b64 = (value: string | Buffer) => Buffer.from(value).toString('base64url');
const sign = (input: string) => b64(crypto.createHmac('sha256', SECRET).update(input).digest());

export function hashPassword(password: string): string {
  if (password.length < 10) throw new Error('PASSWORD_TOO_SHORT');
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, encoded: string): boolean {
  const [salt, expected] = encoded.split(':');
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}

export function createToken(user: AuthUser): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64(JSON.stringify({ ...user, iat: now, exp: now + TOKEN_TTL_SECONDS }));
  return `${header}.${payload}.${sign(`${header}.${payload}`)}`;
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const [header, payload, signature] = token.split('.');
    if (!header || !payload || !signature || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(sign(`${header}.${payload}`)))) return null;
    const value = JSON.parse(Buffer.from(payload, 'base64url').toString()) as TokenPayload;
    if (value.exp <= Math.floor(Date.now() / 1000) || !value.id || !value.companyId || !value.email || !value.role) return null;
    return { id: value.id, companyId: value.companyId, email: value.email, role: value.role, name: value.name };
  } catch { return null; }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.header('authorization');
  const user = header?.startsWith('Bearer ') ? verifyToken(header.slice(7)) : null;
  if (!user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }
  res.locals.user = user;
  next();
}

export function userFromRequest(req: Request): AuthUser {
  return resUser(req.res?.locals.user);
}

function resUser(value: unknown): AuthUser {
  return value as AuthUser;
}

export function validRole(value: unknown): value is Role {
  return value === 'owner' || value === 'admin' || value === 'manager' || value === 'user' || value === 'viewer';
}

export type UserCollection = Collection<{
  _id: string;
  companyId: string;
  email: string;
  name: string;
  passwordHash: string;
  role: Role;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}>;
