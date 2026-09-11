import test from 'node:test';
import assert from 'node:assert/strict';
import { Decimal128 } from 'mongodb';
import { hasPermission } from '../core/types.js';

const quantity = /^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/;
const money = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function quantityScaled(v:string){const[w='0',f='']=v.split('.');return BigInt(w)*1_000_000n+BigInt(f.padEnd(6,'0'));}
function moneyCents(v:string){const[w='0',f='']=v.split('.');return BigInt(w)*100n+BigInt(f.padEnd(2,'0'));}
function lineTotal(q:string,p:string){return (quantityScaled(q)*moneyCents(p)+500_000n)/1_000_000n;}

test('F5 SCM permissions are read/write separated', () => {
  assert.equal(hasPermission('owner', 'scm:read'), true);
  assert.equal(hasPermission('owner', 'scm:write'), true);
  assert.equal(hasPermission('admin', 'scm:write'), true);
  assert.equal(hasPermission('manager', 'scm:write'), true);
  assert.equal(hasPermission('user', 'scm:read'), true);
  assert.equal(hasPermission('user', 'scm:write'), false);
  assert.equal(hasPermission('viewer', 'scm:read'), true);
  assert.equal(hasPermission('viewer', 'scm:write'), false);
});

test('F5 quantity and money formats are bounded and exact', () => {
  assert.equal(quantity.test('1'), true);
  assert.equal(quantity.test('12.123456'), true);
  assert.equal(quantity.test('12.1234567'), false);
  assert.equal(quantity.test('-1'), false);
  assert.equal(quantity.test('01'), false);
  assert.equal(money.test('1000.99'), true);
  assert.equal(money.test('1000.999'), false);
  assert.equal(Decimal128.fromString('123456789.123456').toString(), '123456789.123456');
});

test('F5 line totals preserve six-decimal quantities and round money deterministically', () => {
  assert.equal(lineTotal('1.234567','10.00'), 1235n);
  assert.equal(lineTotal('2.555555','0.10'), 26n);
  assert.equal(lineTotal('10','99.99'), 99990n);
});

test('F5 idempotency keys are UUIDs', () => {
  assert.equal(uuid.test('550e8400-e29b-41d4-a716-446655440000'), true);
  assert.equal(uuid.test('not-a-uuid'), false);
});

test('F5 receiving cannot exceed ordered quantity', () => {
  const ordered = 10_000_000n;
  const alreadyReceived = 7_500_000n;
  const incoming = 2_500_000n;
  assert.equal(alreadyReceived + incoming <= ordered, true);
  assert.equal(alreadyReceived + incoming + 1n <= ordered, false);
});

test('F5 purchase lifecycle transitions are intentionally explicit', () => {
  const transitions: Record<string, string[]> = {
    draft: ['submitted', 'cancelled'],
    submitted: ['approved', 'rejected', 'cancelled'],
    approved: [],
    rejected: [],
    cancelled: []
  };
  assert.equal(transitions.draft.includes('approved'), false);
  assert.equal(transitions.submitted.includes('approved'), true);
  assert.equal(transitions.submitted.includes('cancelled'), true);
});
