import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { COLLECTION_NAMES, logicalCollectionName, physicalCollectionName } from '../core/collection-names.js';
import { hasPermission, ROLE_PERMISSIONS, ROLES } from '../core/types.js';

describe('F1 schema contract', () => {
  it('maps every F1 collection to contextual Portuguese names', () => {
    for (const name of ['system','companies','users','audit_logs','auth_sessions','branches','tenants','permissions','role_permissions','access_scopes','access_policies']) {
      const physical = physicalCollectionName(name);
      assert.notEqual(physical, name);
      assert.equal(logicalCollectionName(physical), name);
      assert.match(physical, /^[a-z0-9_]+$/);
    }
    assert.equal(COLLECTION_NAMES.parties, 'parceiros');
  });
  it('keeps the F1 role matrix explicit', () => {
    assert.deepEqual(ROLES, ['owner','admin','manager','user','viewer']);
    assert.equal(hasPermission('owner','anything:new'), true);
    assert.equal(hasPermission('admin','company:write'), true);
    assert.equal(hasPermission('viewer','company:write'), false);
    assert.ok(ROLE_PERMISSIONS.admin.includes('audit:read'));
  });
});
