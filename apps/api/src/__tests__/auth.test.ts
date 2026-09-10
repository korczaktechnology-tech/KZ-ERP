import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hashPassword, verifyPassword, createToken, verifyToken } from '../core/auth.js';

process.env.AUTH_SECRET = 'test-secret-with-at-least-32-characters-long';

describe('authentication', () => {
  it('hashes and verifies passwords', () => {
    const password = 'strong-test-password';
    const encoded = hashPassword(password);
    assert.notEqual(encoded, password);
    assert.equal(verifyPassword(password, encoded), true);
    assert.equal(verifyPassword('wrong-password', encoded), false);
  });

  it('rejects passwords shorter than the policy', () => {
    assert.throws(() => hashPassword('short'));
  });

  it('signs and verifies access tokens', () => {
    const user = { id: 'user-1', companyId: 'company-1', email: 'user@example.com', role: 'user' as const, name: 'Test User' };
    const token = createToken(user);
    assert.deepEqual(verifyToken(token), user);
    const parts = token.split('.');
    parts[1] = `${parts[1]}x`;
    assert.equal(verifyToken(parts.join('.')), null);
  });
});
