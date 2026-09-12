import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { tenantRequestGuard } from '../core/tenant-guard.js';

function run(input: { companyId?: string }, authenticated?: string) {
  const result: { status?: number; body?: unknown; next: boolean } = { next: false };
  const req = { body: input, query: {}, params: {} } as never;
  const user = authenticated ? { companyId: authenticated } : undefined;
  const res = { locals: { user }, status(code: number) { result.status = code; return this; }, json(body: unknown) { result.body = body; return this; } } as never;
  tenantRequestGuard(req, res, () => { result.next = true; });
  return result;
}

describe('F1 tenant request guard', () => {
  it('accepts the authenticated company', () => assert.equal(run({ companyId: 'tenant-a' }, 'tenant-a').next, true));
  it('rejects a conflicting company in request data', () => { const result = run({ companyId: 'tenant-b' }, 'tenant-a'); assert.equal(result.status, 403); assert.equal(result.next, false); });
  it('does not impose a tenant when authentication has not populated locals', () => { const result = run({ companyId: 'anything' }); assert.equal(result.next, true); });
});
