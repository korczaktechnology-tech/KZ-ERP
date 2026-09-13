import test from 'node:test';
import assert from 'node:assert/strict';
import { validLocationParentKind, wouldCreateCycle } from '../modules/master-data/f2-hardening.js';

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

test('cycle detection is scoped to the company', async () => {
  const collection: any = { findOne: async (filter: any) => filter.companyId === 'company-a' ? { parentId: undefined } : { parentId: 'other' } };
  assert.equal(await wouldCreateCycle(collection, 'company-a', 'new', 'parent'), false);
});
