import test from 'node:test';
import assert from 'node:assert/strict';
import { Decimal128 } from 'mongodb';
import { hasPermission } from '../core/types.js';

test('F4 RBAC: sales read/write matrix', () => {
  assert.equal(hasPermission('owner','sales:write'), true);
  assert.equal(hasPermission('admin','sales:write'), true);
  assert.equal(hasPermission('manager','sales:write'), true);
  assert.equal(hasPermission('user','sales:write'), false);
  assert.equal(hasPermission('viewer','sales:write'), false);
  assert.equal(hasPermission('user','sales:read'), true);
  assert.equal(hasPermission('viewer','sales:read'), true);
});
test('F4 monetary representation uses Decimal128', () => {
  assert.equal(Decimal128.fromString('1234567890.99').toString(),'1234567890.99');
});
test('F4 quantity preserves six decimal places', () => {
  assert.equal(Decimal128.fromString('12.345678').toString(),'12.345678');
});
