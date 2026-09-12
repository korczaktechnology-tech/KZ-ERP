import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { tenantFilter, tenantCollection } from '../core/db.js';

describe('F1 tenant boundary', () => {
  it('cannot be replaced by a conflicting companyId in a filter', () => {
    const result = tenantFilter('tenant-a', { companyId: 'tenant-b', $or: [{ active: true }, { active: false }] } as never);
    assert.equal(result.companyId, 'tenant-a');
    assert.deepEqual(result.$or, [{ active: true }, { active: false }]);
  });

  it('rejects an empty tenant context', () => {
    assert.throws(() => tenantFilter('  '), /TENANT_ID_REQUIRED/);
  });

  it('rejects attempts to mutate companyId through the tenant collection guard', () => {
    const calls: unknown[] = [];
    const fake = {
      collection: () => ({
        updateOne: async (...args: unknown[]) => { calls.push(args); return { matchedCount: 1 }; },
        updateMany: async (...args: unknown[]) => { calls.push(args); return { matchedCount: 1 }; },
        findOne: async () => null,
        find: () => ({}),
        insertOne: async () => ({ acknowledged: true }),
        deleteOne: async () => ({ deletedCount: 0 })
      })
    } as never;
    const collection = tenantCollection(fake, 'sample');
    assert.throws(
      () => collection.updateOne('tenant-a', { _id: 'x' } as never, { $set: { companyId: 'tenant-b' } } as never),
      /TENANT_ID_IMMUTABLE/
    );
    assert.equal(calls.length, 0);
  });
});
