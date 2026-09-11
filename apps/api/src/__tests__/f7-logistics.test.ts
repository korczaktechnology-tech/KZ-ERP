import test from 'node:test';
import assert from 'node:assert/strict';
import { hasPermission, ROLE_PERMISSIONS } from '../core/types.js';

test('F7 logistics RBAC exposes read/write permissions to operational roles', () => {
  assert.equal(hasPermission('owner', 'logistics:read'), true);
  assert.equal(hasPermission('owner', 'logistics:write'), true);
  assert.equal(hasPermission('admin', 'logistics:read'), true);
  assert.equal(hasPermission('admin', 'logistics:write'), true);
  assert.equal(hasPermission('manager', 'logistics:read'), true);
  assert.equal(hasPermission('manager', 'logistics:write'), true);
  assert.equal(hasPermission('user', 'logistics:read'), true);
  assert.equal(hasPermission('user', 'logistics:write'), false);
  assert.equal(hasPermission('viewer', 'logistics:read'), true);
  assert.equal(hasPermission('viewer', 'logistics:write'), false);
});

test('F7 logistics permissions are explicit and do not grant unrelated write access', () => {
  assert.ok(ROLE_PERMISSIONS.admin.includes('logistics:write'));
  assert.ok(ROLE_PERMISSIONS.manager.includes('logistics:write'));
  assert.equal(ROLE_PERMISSIONS.user.includes('logistics:write'), false);
  assert.equal(ROLE_PERMISSIONS.viewer.includes('logistics:write'), false);
});
