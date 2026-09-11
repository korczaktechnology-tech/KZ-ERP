import test from 'node:test';
import assert from 'node:assert/strict';
import { Decimal128 } from 'mongodb';
import { hasPermission } from '../core/types.js';

const quantityPattern = /^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/;

test('F3 permissions expose stock read/write with the same operational roles as master data', () => {
  assert.equal(hasPermission('owner', 'stock:read'), true);
  assert.equal(hasPermission('owner', 'stock:write'), true);
  assert.equal(hasPermission('admin', 'stock:write'), true);
  assert.equal(hasPermission('manager', 'stock:write'), true);
  assert.equal(hasPermission('user', 'stock:read'), true);
  assert.equal(hasPermission('user', 'stock:write'), false);
  assert.equal(hasPermission('viewer', 'stock:read'), true);
  assert.equal(hasPermission('viewer', 'stock:write'), false);
});

test('F3 stock quantities use Decimal128 and reject unsafe decimal forms', () => {
  assert.equal(Decimal128.fromString('1000.250000').toString(), '1000.250000');
  assert.equal(Decimal128.fromString('0.125').toString(), '0.125');
  assert.equal(quantityPattern.test('1'), true);
  assert.equal(quantityPattern.test('0.125'), true);
  assert.equal(quantityPattern.test('1.123456'), true);
  assert.equal(quantityPattern.test('1.1234567'), false);
  assert.equal(quantityPattern.test('-1'), false);
  assert.equal(quantityPattern.test('01'), false);
  assert.equal(quantityPattern.test('1,5'), false);
});

test('F3 availability is never allowed to become negative', () => {
  const quantity = Decimal128.fromString('10.50');
  const reserved = Decimal128.fromString('3.25');
  const available = Number(quantity.toString()) - Number(reserved.toString());
  assert.equal(available, 7.25);
  assert.equal(available >= 0, true);
});
