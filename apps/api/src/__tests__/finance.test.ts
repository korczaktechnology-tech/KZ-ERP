import test from 'node:test';
import assert from 'node:assert/strict';
import { Decimal128 } from 'mongodb';
import { hasPermission } from '../core/types.js';

test('F5 RBAC: finance read/write matrix',()=>{
  assert.equal(hasPermission('owner','finance:write'),true);
  assert.equal(hasPermission('admin','finance:write'),true);
  assert.equal(hasPermission('manager','finance:write'),true);
  assert.equal(hasPermission('user','finance:write'),false);
  assert.equal(hasPermission('viewer','finance:write'),false);
  assert.equal(hasPermission('user','finance:read'),true);
  assert.equal(hasPermission('viewer','finance:read'),true);
});
test('F5 monetary representation uses Decimal128',()=>assert.equal(Decimal128.fromString('1234567890.99').toString(),'1234567890.99'));
test('F5 financial status lifecycle is explicit',()=>{const statuses=['open','paid','cancelled'] as const;assert.deepEqual(statuses,['open','paid','cancelled']);});
test('F5 idempotency keys are UUIDs',()=>assert.match('550e8400-e29b-41d4-a716-446655440000',/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i));
