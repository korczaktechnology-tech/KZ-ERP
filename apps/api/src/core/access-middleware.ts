import type { NextFunction, Request, Response } from 'express';
import type { Db } from 'mongodb';
import type { AuthUser } from './types.js';
import { authorizeABAC, resolveScope } from './governance.js';

const moduleForPath = (path: string): string | null => {
  if (path.startsWith('/core/tenant') || path.startsWith('/core/company') || path.startsWith('/core/branches') || path.startsWith('/core/org_units') || path.startsWith('/core/departments') || path.startsWith('/core/cost_centers') || path.startsWith('/core/teams') || path.startsWith('/core/configurations')) return 'company';
  if (path.startsWith('/core/users') || path.startsWith('/core/rbac') || path.startsWith('/core/scopes') || path.startsWith('/core/policies')) return 'users';
  if (path.startsWith('/core/audit')) return 'audit';
  const first = path.split('/').filter(Boolean)[0];
  return first || null;
};

const permissionFor = (method: string, path: string): string | null => {
  if (path === '/core/me') return null;
  const module = moduleForPath(path);
  if (!module) return null;
  return `${module}:${method === 'GET' || method === 'HEAD' ? 'read' : 'write'}`;
};

function firstValue(req: Request, key: string): string | undefined {
  const body = req.body as Record<string, unknown> | undefined;
  const query = req.query as Record<string, unknown>;
  const params = req.params as Record<string, unknown>;
  for (const source of [body, query, params]) {
    const value = source?.[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return undefined;
}

export function accessControlGuard(db: Db) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (req.path.startsWith('/auth/') || req.path === '/system') { next(); return; }
    const user = res.locals.user as AuthUser | undefined;
    if (!user) { next(); return; }
    const permission = permissionFor(req.method, req.path);
    if (permission) {
      const allowed = await authorizeABAC(db, user, permission, { resource: req.path, method: req.method });
      if (!allowed) { res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied by RBAC/ABAC policy' }, requestId: res.locals.requestId }); return; }
    }
    const module = moduleForPath(req.path);
    if (module) {
      const scopes = await resolveScope(db, user, module);
      if (scopes.length > 0) {
        const dimensions = [
          ['branchId','branchIds'], ['unitId','unitIds'], ['departmentId','departmentIds'], ['costCenterId','costCenterIds'], ['teamId','teamIds']
        ] as const;
        for (const [requestKey, scopeKey] of dimensions) {
          const value = firstValue(req, requestKey);
          if (!value) continue;
          const relevant = scopes.filter(scope => !scope.module || scope.module === module);
          if (relevant.some(scope => scope.effect === 'deny' && scope[scopeKey].includes(value))) {
            res.status(403).json({ error: { code: 'SCOPE_DENIED', message: `Access denied for ${requestKey}` }, requestId: res.locals.requestId }); return;
          }
          const allows = relevant.filter(scope => scope.effect === 'allow' && scope[scopeKey].length > 0);
          if (allows.length > 0 && !allows.some(scope => scope[scopeKey].includes(value))) {
            res.status(403).json({ error: { code: 'SCOPE_DENIED', message: `Access denied for ${requestKey}` }, requestId: res.locals.requestId }); return;
          }
        }
      }
    }
    next();
  };
}
