import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from '../../src/modules/auth/password.js';

describe('Password security', () => {
  it('should hash a password without exposing the original value', async () => {
    const password = 'SenhaTeste123!';
    const hash = await hashPassword(password);

    expect(hash).not.toBe(password);
    expect(hash).toContain(':');
  });

  it('should generate different hashes for the same password', async () => {
    const password = 'SenhaTeste123!';

    const firstHash = await hashPassword(password);
    const secondHash = await hashPassword(password);

    expect(firstHash).not.toBe(secondHash);
  });

  it('should accept the correct password', async () => {
    const password = 'SenhaTeste123!';
    const hash = await hashPassword(password);

    expect(await verifyPassword(password, hash)).toBe(true);
  });

  it('should reject an incorrect password', async () => {
    const hash = await hashPassword('SenhaCorreta123!');

    expect(await verifyPassword('SenhaIncorreta123!', hash)).toBe(false);
  });

  it('should reject an invalid stored hash', async () => {
    expect(await verifyPassword('SenhaTeste123!', 'invalid-hash')).toBe(false);
  });
});
