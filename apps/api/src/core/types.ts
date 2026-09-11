export const ROLES = ['owner', 'admin', 'manager', 'user', 'viewer'] as const;
export type Role = typeof ROLES[number];
export type AuthUser = { id: string; companyId: string; email: string; role: Role; name?: string };
export type TenantContext = { user: AuthUser; companyId: string };
export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  owner: ['*'],
  admin: ['company:read','company:write','users:read','users:write','audit:read','master-data:read','master-data:write','stock:read','stock:write','sales:read','sales:write','finance:read','finance:write','scm:read','scm:write'],
  manager: ['company:read','users:read','audit:read','master-data:read','master-data:write','stock:read','stock:write','sales:read','sales:write','finance:read','finance:write','scm:read','scm:write'],
  user: ['company:read','master-data:read','stock:read','sales:read','finance:read','scm:read'],
  viewer: ['company:read','master-data:read','stock:read','sales:read','finance:read','scm:read']
};
export function hasPermission(role: Role, permission: string): boolean { const permissions = ROLE_PERMISSIONS[role]; return permissions.includes('*') || permissions.includes(permission); }
