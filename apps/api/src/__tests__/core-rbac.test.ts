import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hasPermission, ROLE_PERMISSIONS, ROLES, validRole } from '../core/types.js';

describe('CORE RBAC', () => {
  it('declares the complete role set', () => {
    assert.deepEqual(ROLES, ['owner', 'admin', 'manager', 'user', 'viewer']);
  });

  it('gives owner unrestricted permission while keeping regular roles scoped', () => {
    assert.equal(hasPermission('owner', 'anything:new'), true);
    assert.equal(hasPermission('admin', 'users:write'), true);
    assert.equal(hasPermission('manager', 'users:write'), false);
    assert.equal(hasPermission('user', 'audit:read'), false);
    assert.equal(hasPermission('viewer', 'company:write'), false);
  });

  it('does not expose undeclared roles as valid', () => {
    for (const role of ROLES) assert.equal(validRole(role), true);
    assert.equal(validRole('superadmin'), false);
    assert.equal(validRole(null), false);
    assert.equal(validRole(undefined), false);
  });

  it('keeps permission definitions explicit and reviewable', () => {
    assert.ok(ROLE_PERMISSIONS.owner.includes('*'));
    assert.ok(ROLE_PERMISSIONS.admin.includes('company:write'));
    assert.ok(ROLE_PERMISSIONS.admin.includes('users:read'));
    assert.ok(ROLE_PERMISSIONS.admin.includes('users:write'));
    assert.ok(ROLE_PERMISSIONS.admin.includes('audit:read'));
  });
});
