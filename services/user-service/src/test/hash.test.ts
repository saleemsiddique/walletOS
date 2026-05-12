import { describe, it, expect } from 'vitest';
import { hashPassword, comparePassword } from '../lib/hash';

describe('hash', () => {
  it('hashPassword returns a string different from the plain password', async () => {
    const hash = await hashPassword('mysecret123');
    expect(hash).not.toBe('mysecret123');
    expect(hash.startsWith('$2')).toBe(true);
  });

  it('comparePassword returns true for the original password', async () => {
    const hash = await hashPassword('mysecret123');
    expect(await comparePassword('mysecret123', hash)).toBe(true);
  });

  it('comparePassword returns false for a different password', async () => {
    const hash = await hashPassword('mysecret123');
    expect(await comparePassword('wrongpassword', hash)).toBe(false);
  });
});
