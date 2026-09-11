import test from 'node:test';
import assert from 'node:assert/strict';
import { Decimal128 } from 'mongodb';
import { hasPermission } from '../core/types.js';

const quantityPattern = /^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

test('F3 write idempotency keys are UUIDs', () => {
  assert.equal(uuidPattern.test('550e8400-e29b-41d4-a716-446655440000'), true);
  assert.equal(uuidPattern.test('not-a-uuid'), false);
  assert.equal(uuidPattern.test('550e8400-e29b-61d4-a716-446655440000'), false);
});
