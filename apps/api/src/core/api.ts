import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { MongoServerError } from 'mongodb';
import { ZodError, z } from 'zod';

export type ApiErrorCode = 'VALIDATION_ERROR' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'INTERNAL_ERROR';
export type Pagination = { limit: number; offset: number };

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0)
});

export function ok<T>(res: Response, data: T, status = 200): void { res.status(status).json({ data, requestId: res.locals.requestId }); }
export function created<T>(res: Response, data: T): void { ok(res, data, 201); }
export function noContent(res: Response): void { res.status(204).send(); }

export function paginated<T>(res: Response, items: T[], total: number, pagination: Pagination): void {
  ok(res, { items, pagination: { ...pagination, total, hasMore: pagination.offset + items.length < total } });
}

export function fail(res: Response, status: number, code: ApiErrorCode, message?: string, details?: unknown): void {
  res.status(status).json({ error: { code, message: message ?? defaultMessage(code), ...(details === undefined ? {} : { details }) }, requestId: res.locals.requestId });
}

export function parsePagination(query: Request['query']): Pagination { return paginationSchema.parse({ limit: query.limit, offset: query.offset }); }

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header('x-request-id')?.trim();
  const id = incoming && incoming.length <= 128 ? incoming : randomUUID();
  res.setHeader('x-request-id', id);
  res.locals.requestId = id;
  next();
}

export function errorMiddleware(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (res.headersSent) return;
  if (error instanceof ZodError) { fail(res, 400, 'VALIDATION_ERROR', 'Request validation failed', error.issues.map(i => ({ path: i.path, message: i.message, code: i.code }))); return; }
  if (error instanceof Error && error.message === 'TENANT_ID_IMMUTABLE') { fail(res, 400, 'VALIDATION_ERROR', 'companyId cannot be changed'); return; }
  if (error instanceof Error && error.message === 'PASSWORD_TOO_SHORT') { fail(res, 400, 'VALIDATION_ERROR', 'Password must contain at least 10 characters'); return; }
  if (error instanceof MongoServerError && error.code === 11000) { fail(res, 409, 'CONFLICT', 'Resource already exists'); return; }
  console.error({ requestId: res.locals.requestId, error });
  fail(res, 500, 'INTERNAL_ERROR');
}

function defaultMessage(code: ApiErrorCode): string {
  switch (code) {
    case 'VALIDATION_ERROR': return 'Invalid request';
    case 'UNAUTHORIZED': return 'Authentication required';
    case 'FORBIDDEN': return 'Access denied';
    case 'NOT_FOUND': return 'Resource not found';
    case 'CONFLICT': return 'Resource conflict';
    default: return 'Internal server error';
  }
}
