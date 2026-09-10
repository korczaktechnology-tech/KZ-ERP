import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { paginationSchema } from '../core/api.js';

describe('API contract', () => {
  it('applies safe pagination defaults', () => {
    assert.deepEqual(paginationSchema.parse({}), { limit: 50, offset: 0 });
  });

  it('rejects pagination outside the public contract', () => {
    assert.throws(() => paginationSchema.parse({ limit: 101 }));
    assert.throws(() => paginationSchema.parse({ offset: -1 }));
  });
});
