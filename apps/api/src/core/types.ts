export const ROLES = ['owner', 'admin', 'manager', 'user', 'viewer'] as const;
export type Role = typeof ROLES[number];

export type AuthUser = {
  id: string;
  companyId: string;
  email: string;
  role: Role;
  name?: string;
};

export type TenantContext = {
  user: AuthUser;
  companyId: string;
};

export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  owner: ['*'],
  admin: ['company:read', 'company:write', 'users:read', 'users:write', 'audit:read'],
  manager: ['company:read', 'users:read', 'audit:read'],
  user: ['company:read'],
  viewer: ['company:read']
};

export function hasPermission(role: Role, permission: string): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  return permissions.includes('*') || permissions.includes(permission);
}
