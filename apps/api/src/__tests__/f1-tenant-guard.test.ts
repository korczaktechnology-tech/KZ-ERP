import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { tenantRequestGuard } from '../core/tenant-guard.js';

function run(input: { companyId?: string }, authenticated = 'tenant-a') {
  const result: { status?: number; body?: unknown; next: boolean } = { next: false };
  const req = { body: input, query: {}, params: {} } as never;
  const res = { locals: { user: { companyId: authenticated } }, status(code: number) { result.status = code; return this; }, json(body: unknown) { result.body = body; return this; } } as never;
  tenantRequestGuard(req, res, () => { result.next = true; });
  return result;
}

describe('F1 tenant request guard', () => {
  it('accepts the authenticated company', () => assert.equal(run({ companyId: 'tenant-a' }).next, true));
  it('rejects a conflicting company in request data', () => { const result = run({ companyId: 'tenant-b' }); assert.equal(result.status, 403); assert.equal(result.next, false); });
  it('does not impose a tenant when authentication has not yet populated locals', () => { const result = run({ companyId: 'anything' }, undefined as never); assert.equal(result.next, true); });
});
