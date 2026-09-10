import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { AuthUser, Role } from './types.js';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const getSecret = (): string => {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error('AUTH_SECRET must be set and contain at least 32 characters');
  return secret;
};

type TokenPayload = AuthUser & { iat: number; exp: number; jti: string };
const b64 = (value: string | Buffer) => Buffer.from(value).toString('base64url');
const sign = (input: string) => b64(crypto.createHmac('sha256', getSecret()).update(input).digest());

export function hashPassword(password: string): string {
  if (password.length < 10) throw new Error('PASSWORD_TOO_SHORT');
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, encoded: string): boolean {
  try {
    const [salt, expected] = encoded.split(':');
    if (!salt || !expected || !/^[0-9a-f]+$/i.test(expected)) return false;
    const actual = crypto.scryptSync(password, salt, 64).toString('hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    const actualBuffer = Buffer.from(actual, 'hex');
    return expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
  } catch { return false; }
}

export function createToken(user: AuthUser): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64(JSON.stringify({ ...user, iat: now, exp: now + ACCESS_TOKEN_TTL_SECONDS, jti: crypto.randomUUID() }));
  return `${header}.${payload}.${sign(`${header}.${payload}`)}`;
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const [header, payload, signature] = token.split('.');
    if (!header || !payload || !signature || token.split('.').length !== 3) return null;
    const expected = Buffer.from(sign(`${header}.${payload}`));
    const actual = Buffer.from(signature);
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
    const value = JSON.parse(Buffer.from(payload, 'base64url').toString()) as TokenPayload;
    if (value.exp <= Math.floor(Date.now() / 1000) || !Number.isInteger(value.iat) || !value.jti || !value.id || !value.companyId || !value.email || !validRole(value.role)) return null;
    return { id: value.id, companyId: value.companyId, email: value.email, role: value.role, name: value.name };
  } catch { return null; }
}

export function createRefreshToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(48).toString('base64url');
  return { token, hash: crypto.createHash('sha256').update(token).digest('hex') };
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.header('authorization');
  const value = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const user = value ? verifyToken(value) : null;
  if (!user) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' }, requestId: res.locals.requestId });
    return;
  }
  res.locals.user = user;
  next();
}

export function validRole(value: unknown): value is Role {
  return value === 'owner' || value === 'admin' || value === 'manager' || value === 'user' || value === 'viewer';
}
