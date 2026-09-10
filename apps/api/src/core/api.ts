import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL_ERROR';

export type Pagination = {
  limit: number;
  offset: number;
};

export function ok<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({ data });
}

export function created<T>(res: Response, data: T): void {
  ok(res, data, 201);
}

export function noContent(res: Response): void {
  res.status(204).send();
}

export function fail(res: Response, status: number, code: ApiErrorCode, message?: string, details?: unknown): void {
  const body: { error: { code: ApiErrorCode; message: string; details?: unknown } } = {
    error: { code, message: message ?? defaultMessage(code) }
  };
  if (details !== undefined) body.error.details = details;
  res.status(status).json(body);
}

export function parsePagination(query: Request['query']): Pagination {
  const rawLimit = Number(query.limit ?? 50);
  const rawOffset = Number(query.offset ?? 0);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 100) : 50;
  const offset = Number.isFinite(rawOffset) ? Math.min(Math.max(Math.trunc(rawOffset), 0), 1_000_000) : 0;
  return { limit, offset };
}

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = req.header('x-request-id')?.trim() || randomUUID();
  res.setHeader('x-request-id', id);
  res.locals.requestId = id;
  next();
}

export function errorMiddleware(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (error instanceof ZodError) {
    fail(res, 400, 'VALIDATION_ERROR', 'Request validation failed', error.issues.map(issue => ({ path: issue.path, message: issue.message, code: issue.code })));
    return;
  }
  if (error instanceof Error && error.message === 'TENANT_ID_IMMUTABLE') {
    fail(res, 400, 'VALIDATION_ERROR', 'companyId cannot be changed');
    return;
  }
  if (error instanceof Error && error.message === 'PASSWORD_TOO_SHORT') {
    fail(res, 400, 'VALIDATION_ERROR', 'Password must contain at least 10 characters');
    return;
  }
  if (error instanceof Error && error.message === 'AUTH_SECRET must be set and contain at least 32 characters') {
    console.error(error);
    fail(res, 500, 'INTERNAL_ERROR', 'Authentication service is not configured');
    return;
  }
  console.error(error);
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
