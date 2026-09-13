import test from 'node:test';
import assert from 'node:assert/strict';
import { validLocationParentKind, wouldCreateCycle, validateF2Reference, validateF2ImportReferences } from '../modules/master-data/f2-hardening.js';

test('warehouse location hierarchy accepts only the immediate semantic parent', () => {
  assert.equal(validLocationParentKind('zone'), true);
  assert.equal(validLocationParentKind('aisle', 'zone'), true);
  assert.equal(validLocationParentKind('rack', 'zone'), false);
  assert.equal(validLocationParentKind('rack', 'aisle'), true);
  assert.equal(validLocationParentKind('shelf', 'rack'), true);
  assert.equal(validLocationParentKind('bin', 'shelf'), true);
  assert.equal(validLocationParentKind('bin', 'rack'), false);
});

test('warehouse root cannot have a parent', () => {
  assert.equal(validLocationParentKind('zone', 'zone'), false);
  assert.equal(validLocationParentKind('zone', 'aisle'), false);
});

test('cycle detection catches indirect parent cycles', async () => {
  const docs = new Map([['a', { parentId: 'b' }], ['b', { parentId: 'c' }], ['c', { parentId: 'a' }]]);
  const collection: any = { findOne: async (filter: any) => docs.get(filter._id) ?? null };
  assert.equal(await wouldCreateCycle(collection, 'company', 'a', 'b'), true);
});

test('cycle detection catches direct self-parenting', async () => {
  const collection: any = { findOne: async () => null };
  assert.equal(await wouldCreateCycle(collection, 'company', 'node', 'node'), true);
});

test('cycle detection accepts an acyclic hierarchy', async () => {
  const docs = new Map([['child', { parentId: 'parent' }], ['parent', { parentId: undefined }]]);
  const collection: any = { findOne: async (filter: any) => docs.get(filter._id) ?? null };
  assert.equal(await wouldCreateCycle(collection, 'company', 'new', 'parent'), false);
});

test('cycle detection stops at a missing parent', async () => {
  const collection: any = { findOne: async () => null };
  assert.equal(await wouldCreateCycle(collection, 'company', 'new', 'missing'), false);
});

test('reference validation rejects unsupported entity types', async () => {
  const db: any = { collection: () => ({ findOne: async () => null }) };
  assert.equal(await validateF2Reference(db, 'company', 'unsupported', 'id'), "Reference type 'unsupported' is not supported");
});

test('reference validation enforces tenant ownership', async () => {
  const db: any = { collection: () => ({ findOne: async (filter: any) => filter.companyId === 'company-a' ? { _id: filter._id } : null }) };
  assert.equal(await validateF2Reference(db, 'company-a', 'product', 'p1'), null);
  assert.equal(await validateF2Reference(db, 'company-b', 'product', 'p1'), "Reference 'product:p1' not found");
});

test('price import requires both product and price-list references', async () => {
  const db: any = { collection: (name: string) => ({ findOne: async (filter: any) => ({ _id: filter._id, companyId: filter.companyId }) }) };
  assert.equal(await validateF2ImportReferences(db, 'company', 'prices', { amount: 10 }), 'Price list id is required');
  assert.equal(await validateF2ImportReferences(db, 'company', 'prices', { priceListId: 'p', productId: 'x' }), null);
});
