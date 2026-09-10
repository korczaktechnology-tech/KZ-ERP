import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { tenantFilter } from '../core/db.js';

describe('multi-tenancy', () => {
  it('always binds a query to the authenticated company', () => {
    const filter = tenantFilter('company-a', { status: 'active', companyId: 'company-b' } as never);
    assert.equal(filter.companyId, 'company-a');
    assert.equal(filter.status, 'active');
  });

  it('keeps tenant binding outside complex query operators', () => {
    const filter = tenantFilter('company-a', { $or: [{ status: 'active' }, { status: 'pending' }] } as never);
    assert.equal(filter.companyId, 'company-a');
    assert.deepEqual(filter.$or, [{ status: 'active' }, { status: 'pending' }]);
  });

  it('rejects an empty tenant identifier instead of creating an unscoped query', () => {
    assert.throws(() => tenantFilter('   '), /TENANT_ID_REQUIRED/);
  });
});
