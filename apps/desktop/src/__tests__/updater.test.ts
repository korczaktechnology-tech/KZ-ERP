import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('desktop test foundation', () => {
  it('keeps the updater test suite available without invoking native Tauri APIs', () => {
    assert.equal(typeof process.version, 'string');
  });
});
