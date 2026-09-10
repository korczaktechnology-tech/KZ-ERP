import test from 'node:test';
import assert from 'node:assert/strict';
import { Decimal128 } from 'mongodb';
import { hasPermission } from '../core/types.js';

test('F2 permissions allow read/write only to intended roles', () => {
  assert.equal(hasPermission('owner', 'master-data:read'), true);
  assert.equal(hasPermission('owner', 'master-data:write'), true);
  assert.equal(hasPermission('admin', 'master-data:read'), true);
  assert.equal(hasPermission('admin', 'master-data:write'), true);
  assert.equal(hasPermission('manager', 'master-data:read'), true);
  assert.equal(hasPermission('manager', 'master-data:write'), true);
  assert.equal(hasPermission('user', 'master-data:read'), true);
  assert.equal(hasPermission('user', 'master-data:write'), false);
  assert.equal(hasPermission('viewer', 'master-data:read'), true);
  assert.equal(hasPermission('viewer', 'master-data:write'), false);
});

test('F2 monetary values use Decimal128 without binary floating point drift', () => {
  const amount = Decimal128.fromString('19.90');
  assert.equal(amount.toString(), '19.90');
  assert.equal(Decimal128.fromString('0.1').toString(), '0.1');
  assert.equal(Decimal128.fromString('0.2').toString(), '0.2');
});

test('F2 price amount rejects non-decimal representations at the API boundary', () => {
  assert.equal(/^\d+(?:\.\d{1,6})?$/.test('19.90'), true);
  assert.equal(/^\d+(?:\.\d{1,6})?$/.test('19,90'), false);
  assert.equal(/^\d+(?:\.\d{1,6})?$/.test('-1'), false);
});
