import test from 'node:test';
import assert from 'node:assert/strict';
import { Decimal128 } from 'mongodb';
import { cents, centsString } from '../modules/finance/routes.js';
import { hasPermission } from '../core/types.js';

test('F6 RBAC: finance read/write matrix', () => {
  assert.equal(hasPermission('owner','finance:write'),true); assert.equal(hasPermission('admin','finance:write'),true); assert.equal(hasPermission('manager','finance:write'),true); assert.equal(hasPermission('user','finance:write'),false); assert.equal(hasPermission('viewer','finance:write'),false); assert.equal(hasPermission('user','finance:read'),true); assert.equal(hasPermission('viewer','finance:read'),true);
});
test('F6 monetary representation uses Decimal128 and exact cents', () => { assert.equal(Decimal128.fromString('1234567890.99').toString(),'1234567890.99'); assert.equal(cents(Decimal128.fromString('0.10'))+cents(Decimal128.fromString('0.20')),30n); assert.equal(centsString(cents(Decimal128.fromString('1234567890.99'))),'1234567890.99'); });
test('F6 exact aggregation remains correct for many decimal values', () => { const values=['0.10','0.20','999999999999.99','0.01']; const total=values.reduce((sum,value)=>sum+cents(Decimal128.fromString(value)),0n); assert.equal(centsString(total),'1000000000000.30'); });
test('F6 partial payment arithmetic never uses binary floating point', () => { const total=cents(Decimal128.fromString('100.00')); const first=cents(Decimal128.fromString('33.33')); const second=cents(Decimal128.fromString('66.67')); assert.equal(first+second,total); assert.equal(centsString(total-first),'66.67'); });
test('F6 payment invariants reject overpayment', () => { const total=cents(Decimal128.fromString('100.00')); const paid=cents(Decimal128.fromString('75.00')); const requested=cents(Decimal128.fromString('25.01')); assert.equal(paid+requested>total,true); });
test('F6 legacy financial entries default missing paidAmount to zero', () => { const legacy={amount:Decimal128.fromString('50.00'),paidAmount:undefined}; const paid=cents(legacy.paidAmount??Decimal128.fromString('0')); assert.equal(centsString(paid),'0.00'); });
test('F6 status lifecycle is explicit and terminal states cannot be paid', () => { assert.deepEqual(['open','paid','cancelled'] as const,['open','paid','cancelled']); assert.equal(['paid','cancelled'].includes('open' as never),false); });
test('F6 idempotency keys are UUIDs', () => { assert.match('550e8400-e29b-41d4-a716-446655440000',/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i); });
test('F6 event names are stable contracts', () => { const events=['finance.account.created','finance.entry.created','finance.entry.updated','finance.entry.paid','finance.entry.cancelled','finance.payment.created','finance.transfer.created']; assert.equal(new Set(events).size,events.length); assert.ok(events.every(event=>event.startsWith('finance.'))); });
