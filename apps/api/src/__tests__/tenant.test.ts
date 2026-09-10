import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { tenantFilter } from '../core/db.js';

describe('multi-tenancy', () => {
  it('always binds a query to the authenticated company', () => {
    const filter = tenantFilter('company-a', { status: 'active', companyId: 'company-b' } as never);
    assert.equal(filter.companyId, 'company-a');
    assert.equal(filter.status, 'active');
  });
});
